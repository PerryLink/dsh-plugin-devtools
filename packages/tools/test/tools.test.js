import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

const BIN = new URL('../bin/dsh-tools.js', import.meta.url).pathname

test('list --json includes the family and does not install', () => {
  const out = spawnSync(process.execPath, [BIN, 'list', '--json'], { encoding: 'utf8' })
  assert.equal(out.status, 0, out.stderr)
  const json = JSON.parse(out.stdout)
  assert.ok(json.tools.some(t => t.pkg === 'dsh-plugin-start'))
  assert.ok(json.tools.some(t => t.pkg === 'dsh-plugin-ready'))
  assert.ok(json.tools.every(t => !t.pkg || t.pkg !== 'dsh-plugin-kit'))
})

test('install prints a command and does not execute it', () => {
  const out = spawnSync(process.execPath, [BIN, 'install', 'dsh-plugin-ready', '--json'], { encoding: 'utf8' })
  assert.equal(out.status, 0, out.stderr)
  const json = JSON.parse(out.stdout)
  assert.equal(json.executed, false)
  assert.match(json.command, /npm install -g dsh-plugin-ready/)
})

test('doctor --json always returns a machine-readable report', () => {
  const out = spawnSync(process.execPath, [BIN, 'doctor', '--json'], { encoding: 'utf8' })
  assert.ok([0, 1].includes(out.status))
  const json = JSON.parse(out.stdout)
  assert.equal(json.tool, 'dsh-plugin-tools')
  assert.ok(Array.isArray(json.checks))
})
