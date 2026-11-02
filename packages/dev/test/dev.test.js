import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

const BIN = new URL('../bin/dsh-dev.js', import.meta.url).pathname

test('--help exits 0', () => {
  const out = spawnSync(process.execPath, [BIN, '--help'], { encoding: 'utf8' })
  assert.equal(out.status, 0, out.stderr)
  assert.match(out.stdout, /dsh-dev/)
})

test('new delegates to start', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-dev-'))
  const target = path.join(dir, 'app')
  const out = spawnSync(process.execPath, [BIN, 'new', 'demo-app', '--dir', target], { encoding: 'utf8' })
  assert.equal(out.status, 0, out.stderr)
  assert.ok(fs.existsSync(path.join(target, 'package.json')))
})

test('submit on a non-plugin fails the compat subset', () => {
  const out = spawnSync(process.execPath, [BIN, 'submit', '.', '--json'], { encoding: 'utf8' })
  assert.equal(out.status, 2)
})
