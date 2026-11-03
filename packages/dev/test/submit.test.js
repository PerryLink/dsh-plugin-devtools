import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

const BIN = new URL('../bin/dsh-dev.js', import.meta.url).pathname

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-dev-submit-'))
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({
    name: 'demo-submit', version: '0.1.0', description: 'x', license: 'Apache-2.0', type: 'module',
    main: './index.js', exports: { '.': './index.js' },
    engines: { node: '>=20', dsh: '>=0.2.2-alpha.2 <0.3.0' },
    dsh: { manifestVersion: 1, bundle: { patch: './cordis.patch.yml' } },
  }, null, 2))
  fs.writeFileSync(path.join(dir, 'index.js'), 'export default {}\n')
  fs.writeFileSync(path.join(dir, 'cordis.patch.yml'), '- insert: []\n')
  fs.writeFileSync(path.join(dir, 'README.md'), '# demo\n')
  fs.writeFileSync(path.join(dir, 'LICENSE'), 'Apache-2.0\n')
  return dir
}

test('submit without standards runs the vendored full checker and is incomplete without C1/C7', () => {
  const dir = fixture()
  const out = spawnSync(process.execPath, [BIN, 'submit', dir, '--json'], { encoding: 'utf8' })
  assert.equal(out.status, 3, out.stderr)
  const json = JSON.parse(out.stdout)
  assert.equal(json.schema, 'dsh-entry-audit/1')
  assert.equal(json.conclusion.status, 'incomplete')
  assert.equal(json.checks.find(c => c.id === 'C3').status, 'not-applicable')
})

test('submit delegates to a discovered entry-validate script', () => {
  const dir = fixture()
  const standards = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-standards-'))
  const script = path.join(standards, '40-checker', 'scripts')
  fs.mkdirSync(script, { recursive: true })
  fs.writeFileSync(path.join(script, 'entry-validate.mjs'), 'process.exit(0)\n')
  const out = spawnSync(process.execPath, [BIN, 'submit', dir, '--standards', standards], { encoding: 'utf8' })
  assert.equal(out.status, 0, out.stderr)
})

test('submit with meta but no host evidence passes the ENTRY full checker', () => {
  const dir = fixture()
  const meta = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-meta-')), 'meta.json')
  fs.writeFileSync(meta, JSON.stringify({ repo: 'PerryLink/demo-submit', topics: ['dsh-plugin'], archived: false, commit: 'abc123', pushedAt: '2026-11-02' }))
  const out = spawnSync(process.execPath, [BIN, 'submit', dir, '--meta', meta, '--json'], { encoding: 'utf8' })
  assert.equal(out.status, 0, out.stderr)
  const json = JSON.parse(out.stdout)
  assert.equal(json.conclusion.status, 'pass-with-warnings')
  assert.equal(json.checks.find(c => c.id === 'C3').status, 'not-applicable')
  assert.deepEqual(json.checks.filter(c => c.status === 'fail'), [])
})

test('submit passes --host-version through to the vendored C4 check', () => {
  const dir = fixture()
  const meta = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-meta-')), 'meta.json')
  fs.writeFileSync(meta, JSON.stringify({ repo: 'PerryLink/demo-submit', topics: ['dsh-plugin'], archived: false, commit: 'abc123', pushedAt: '2026-11-02' }))
  const out = spawnSync(process.execPath, [BIN, 'submit', dir, '--meta', meta, '--host-version', '0.2.1-rc.5', '--json'], { encoding: 'utf8' })
  assert.equal(out.status, 0, out.stderr)
  const json = JSON.parse(out.stdout)
  assert.equal(json.checks.find(c => c.id === 'C4').status, 'warn')
})

test('submit accepts dsh-evidence/1 host evidence', () => {
  const dir = fixture()
  const meta = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-meta-')), 'meta.json')
  fs.writeFileSync(meta, JSON.stringify({ repo: 'PerryLink/demo-submit', topics: ['dsh-plugin'], archived: false, commit: 'abc123', pushedAt: '2026-11-02' }))
  const evidence = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-evidence-')), 'evidence.json')
  fs.writeFileSync(evidence, JSON.stringify({
    schema: 'dsh-evidence/1',
    kind: 'host-install',
    subject: { repo: dir, version: '0.1.0', commit: null },
    host: 'dsh 0.2.1-rc.5',
    command: 'dsh plugin add',
    status: 'pass',
    startedAt: '2026-11-03T00:00:00Z',
    finishedAt: '2026-11-03T00:01:00Z',
    artifacts: [],
    limitations: [],
    notClaimed: [],
  }))
  const out = spawnSync(process.execPath, [BIN, 'submit', dir, '--meta', meta, '--host-evidence', evidence, '--json'], { encoding: 'utf8' })
  assert.equal(out.status, 0, out.stderr)
  const json = JSON.parse(out.stdout)
  assert.equal(json.checks.find(c => c.id === 'C3').status, 'pass')
})
