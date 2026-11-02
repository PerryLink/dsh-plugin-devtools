import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

const BIN = new URL('../bin/dsh-dev.js', import.meta.url).pathname
const NODE_DIR = path.dirname(process.execPath)

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-dev-test-'))
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'demo-test', version: '0.1.0' }, null, 2))
  return dir
}

function fakeBin() {
  const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-dev-bin-'))
  for (const name of ['dsh', 'pnpm']) {
    const file = path.join(bin, name)
    fs.writeFileSync(file, `#!/bin/sh\necho "$@" >> "$DSH_DEV_TEST_LOG"\nexit 0\n`)
    fs.chmodSync(file, 0o755)
  }
  return bin
}

test('test drives install, dump-config, and remove in a temp DSH_HOME', () => {
  const dir = fixture()
  const bin = fakeBin()
  const log = path.join(bin, 'calls.log')
  const out = spawnSync(process.execPath, [BIN, 'test', dir, '--boot', '--json'], {
    encoding: 'utf8',
    env: { ...process.env, PATH: `${bin}:${NODE_DIR}:/usr/bin:/bin`, DSH_DEV_TEST_LOG: log },
  })
  assert.equal(out.status, 0, out.stderr)
  const json = JSON.parse(out.stdout)
  assert.equal(json.status, 'pass')
  assert.equal(json.commands.length, 4)
  assert.equal(json.boot.status, 'pass')
  assert.match(fs.readFileSync(log, 'utf8'), /plugin --profile test add/)
  assert.match(fs.readFileSync(log, 'utf8'), /--dump-config/)
  assert.match(fs.readFileSync(log, 'utf8'), /plugin --profile test remove/)
})

test('test is blocked without dsh', () => {
  const dir = fixture()
  const out = spawnSync(process.execPath, [BIN, 'test', dir, '--json'], {
    encoding: 'utf8',
    env: { ...process.env, PATH: `${NODE_DIR}:/usr/bin:/bin` },
  })
  assert.equal(out.status, 3)
  const json = JSON.parse(out.stdout)
  assert.equal(json.status, 'blocked')
})
