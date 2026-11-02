import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

const BIN = new URL('../bin/dsh-start.js', import.meta.url).pathname

function temp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-start-'))
}

test('creates a host plugin skeleton', () => {
  const dir = temp()
  const out = spawnSync(process.execPath, [BIN, 'new', 'demo-plugin', '--dir', dir, '--yes'], { encoding: 'utf8' })
  assert.equal(out.status, 0, out.stderr)
  const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'))
  assert.equal(pkg.name, 'demo-plugin')
  assert.equal(pkg.dsh.manifestVersion, 1)
  assert.equal(pkg.dsh.bundle.patch, './cordis.patch.yml')
  assert.equal(pkg.exports['./client'], undefined)
  assert.ok(fs.existsSync(path.join(dir, 'cordis.patch.yml')))
  assert.ok(fs.existsSync(path.join(dir, 'LICENSE')))
})

test('creates a client plugin with --client', () => {
  const dir = temp()
  const out = spawnSync(process.execPath, [BIN, 'new', 'demo-client', '--dir', dir, '--client'], { encoding: 'utf8' })
  assert.equal(out.status, 0, out.stderr)
  const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'))
  assert.equal(pkg.exports['./client'], './client.js')
  assert.equal(pkg.dsh.client.platform, 'web')
  assert.ok(fs.existsSync(path.join(dir, 'client.js')))
})

test('refuses a non-empty target', () => {
  const dir = temp()
  fs.writeFileSync(path.join(dir, 'keep.txt'), 'x')
  const out = spawnSync(process.execPath, [BIN, 'new', 'demo', '--dir', dir], { encoding: 'utf8' })
  assert.equal(out.status, 1)
  assert.match(out.stderr, /not empty/)
})
