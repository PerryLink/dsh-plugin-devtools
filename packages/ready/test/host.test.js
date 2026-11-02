import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

const BIN = new URL('../bin/dsh-ready.js', import.meta.url).pathname
const NODE_DIR = path.dirname(process.execPath)

function pkg() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-ready-host-'))
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({
    name: 'demo-host', version: '0.1.0', description: 'x', license: 'Apache-2.0', type: 'module',
    main: './index.js', exports: { '.': './index.js' },
    engines: { node: '>=20', dsh: '>=0.2.2-alpha.2 <0.3.0' },
    dsh: { manifestVersion: 1, bundle: { patch: './cordis.patch.yml' } },
  }, null, 2))
  fs.writeFileSync(path.join(dir, 'index.js'), 'export default {}\n')
  fs.writeFileSync(path.join(dir, 'cordis.patch.yml'), '- insert:\n    - id: demo\n      name: ./index.js\n')
  fs.writeFileSync(path.join(dir, 'README.md'), '# demo\n')
  fs.writeFileSync(path.join(dir, 'LICENSE'), 'Apache-2.0\n')
  return dir
}

function fakeClinic(result) {
  const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-clinic-bin-'))
  const file = path.join(bin, 'dsh-clinic')
  fs.writeFileSync(file, `#!/bin/sh\ncat <<'JSON'\n${JSON.stringify(result)}\nJSON\n`)
  fs.chmodSync(file, 0o755)
  return bin
}

test('--host reports pass from a clinic X result', () => {
  const dir = pkg()
  const bin = fakeClinic({ groups: { X: { total: 5, ran: 5, pass: 5, warn: 0, fail: 0, skipped: 0 } } })
  const out = spawnSync(process.execPath, [BIN, dir, '--host', '--json'], {
    encoding: 'utf8',
    env: { ...process.env, PATH: `${bin}:${NODE_DIR}:/usr/bin:/bin` },
  })
  assert.equal(out.status, 0, out.stderr)
  const json = JSON.parse(out.stdout)
  assert.equal(json.host.status, 'pass')
})

test('--host is blocked when clinic is unavailable', () => {
  const dir = pkg()
  const out = spawnSync(process.execPath, [BIN, dir, '--host', '--json'], {
    encoding: 'utf8',
    env: { ...process.env, PATH: `${NODE_DIR}:/usr/bin:/bin` },
  })
  assert.equal(out.status, 3)
  const json = JSON.parse(out.stdout)
  assert.equal(json.host.status, 'blocked')
})
