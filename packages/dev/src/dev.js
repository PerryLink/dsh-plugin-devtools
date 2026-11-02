import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import { main as startMain } from 'dsh-plugin-start'
import { main as readyMain } from 'dsh-plugin-ready'
import { main as toolsMain } from 'dsh-plugin-tools'
import { testDrive } from './host-test.js'
import { submit } from './submit.js'

const VERSION = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version

export function usage() {
  return `dsh-dev ${VERSION} — one command for the DSH plugin developer workflow

Usage:
  dsh-dev new <name> [--dir <dir>] [--client]
  dsh-dev check [<dir>] [--json] [--strict]
  dsh-dev tools [list|doctor|install|update]
  dsh-dev test <dir>
  dsh-dev submit <dir> [--standards <checkout>] [--meta <file>] [--host-evidence <file>]
  dsh-dev upgrade

This command only dispatches. It does not install a plugin, run a host, or
certify anything. test/submit/upgrade tell you the exact next command when the
underlying tool is not bundled.
`
}

export async function main(argv) {
  if (argv.includes('--help') || argv.includes('-h') || argv.length === 0) {
    console.log(usage())
    return 0
  }
  if (argv.includes('--version') || argv.includes('-v')) {
    console.log(VERSION)
    return 0
  }
  const [command, ...rest] = argv
  if (command === 'new' || command === 'start') return startMain(rest)
  if (command === 'check' || command === 'ready') return readyMain(rest)
  if (command === 'tools') return toolsMain(rest)
  if (command === 'test') {
    let dir = null
    let json = false
    for (let i = 0; i < rest.length; i++) {
      if (rest[i] === '--json') json = true
      else if (!dir && !rest[i].startsWith('-')) dir = rest[i]
    }
    const result = testDrive(dir || '.')
    if (json) process.stdout.write(JSON.stringify(result, null, 2) + '\n')
    else {
      console.log(`dsh-dev test: ${result.status}`)
      console.log(result.reason ?? `target: ${result.target}`)
      for (const c of result.commands ?? []) console.log(`  ${c.exit === 0 ? 'PASS' : 'FAIL'} ${c.command}`)
      console.log('not claimed: full UI/boot, C3 certification, security audit')
    }
    return result.status === 'fail' ? 2 : result.status === 'blocked' ? 3 : 0
  }
  if (command === 'submit') {
    let dir = null
    let standards = null
    let meta = null
    let host = null
    let json = false
    for (let i = 0; i < rest.length; i++) {
      if (rest[i] === '--standards') { standards = rest[++i] ?? null; continue }
      if (rest[i] === '--meta') { meta = rest[++i] ?? null; continue }
      if (rest[i] === '--host-evidence') { host = rest[++i] ?? null; continue }
      if (rest[i] === '--json') { json = true; continue }
      if (!dir && !rest[i].startsWith('-')) dir = rest[i]
    }
    return submit({ dir, standards, meta, hostEvidence: host, json })
  }
  if (command === 'upgrade') {
    console.error('dsh-dev upgrade: install dsh-plugin-upgrade, then run:')
    console.error('  dsh-plugin-upgrade-scan .')
    return 3
  }
  console.error(`unknown command: ${command}`)
  console.error(usage())
  return 1
}
