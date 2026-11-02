import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

const BIN = new URL('../bin/dsh-ready.js', import.meta.url).pathname

function fixture({ client = false, bundle = true } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-ready-'))
  const pkg = {
    name: 'demo-ready',
    version: '0.1.0',
    description: 'fixture',
    license: 'Apache-2.0',
    type: 'module',
    main: './index.js',
    exports: { '.': './index.js' },
    engines: { node: '>=20', dsh: '>=0.2.2-alpha.2 <0.3.0' },
    dsh: { manifestVersion: 1 },
  }
  if (bundle) pkg.dsh.bundle = { patch: './cordis.patch.yml' }
  if (client) {
    pkg.exports['./client'] = './client.js'
    pkg.dsh.client = { platform: 'web' }
    pkg.files = ['index.js', 'client.js', 'cordis.patch.yml']
  }
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(pkg, null, 2))
  fs.writeFileSync(path.join(dir, 'index.js'), 'export default {}\n')
  if (bundle) fs.writeFileSync(path.join(dir, 'cordis.patch.yml'), '- insert:\n    - id: demo\n      name: ./index.js\n')
  if (client) fs.writeFileSync(path.join(dir, 'client.js'), 'export default {}\\n')
  fs.writeFileSync(path.join(dir, 'README.md'), '# demo\n')
  fs.writeFileSync(path.join(dir, 'LICENSE'), 'Apache-2.0\n')
  return dir
}

test('passes a good static package', () => {
  const dir = fixture()
  const out = spawnSync(process.execPath, [BIN, dir, '--json'], { encoding: 'utf8' })
  assert.equal(out.status, 0, out.stderr)
  const json = JSON.parse(out.stdout)
  assert.equal(json.static.failed, 0)
  assert.equal(json.host.status, 'not-run')
})

test('fails a package without dsh.bundle', () => {
  const dir = fixture({ bundle: false })
  const out = spawnSync(process.execPath, [BIN, dir, '--json'], { encoding: 'utf8' })
  assert.equal(out.status, 2)
  const json = JSON.parse(out.stdout)
  assert.ok(json.static.checks.some(c => c.id === 'R7' && c.status === 'fail'))
})

test('fails a client declaration without ./client export', () => {
  const dir = fixture()
  const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'))
  pkg.dsh.client = { platform: 'web' }
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(pkg, null, 2))
  const out = spawnSync(process.execPath, [BIN, dir, '--json'], { encoding: 'utf8' })
  assert.equal(out.status, 2)
  const json = JSON.parse(out.stdout)
  assert.ok(json.static.checks.some(c => c.id === 'R9' && c.status === 'fail'))
})

test('--strict turns a warning into exit 2', () => {
  const dir = fixture()
  fs.rmSync(path.join(dir, 'README.md'))
  const out = spawnSync(process.execPath, [BIN, dir, '--strict'], { encoding: 'utf8' })
  assert.equal(out.status, 2)
})
