import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { main as startMain } from 'dsh-plugin-start'
import { main as readyMain } from 'dsh-plugin-ready'
import { main as toolsMain } from 'dsh-plugin-tools'

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
    console.error('dsh-dev test: host install is not bundled in this package.')
    console.error('Install dsh-test-drive, then run its isolated install/smoke flow and feed the result to:')
    console.error('  dsh-dev submit <dir> --standards <dsh-standards-checkout> --host-evidence <host.json>')
    return 3
  }
  if (command === 'submit') {
    let dir = null
    let standards = null
    for (let i = 0; i < rest.length; i++) {
      if (rest[i] === '--standards') { standards = rest[++i] ?? null; continue }
      if (!dir && !rest[i].startsWith('-')) dir = rest[i]
    }
    if (!standards) {
      console.error('dsh-dev submit: pass --standards <checkout> to run entry-validate.')
      console.error('Otherwise run: entry-validate <dir> --meta <meta.json> --host-evidence <host.json>')
      return 3
    }
    const script = path.join(standards, '40-checker', 'scripts', 'entry-validate.mjs')
    if (!fs.existsSync(script)) {
      console.error(`entry-validate not found: ${script}`)
      return 1
    }
    const args = [script]
    if (dir) args.push(dir)
    for (let i = 0; i < rest.length; i++) {
      if (rest[i] === '--standards') { i++; continue }
      args.push(rest[i])
    }
    const run = spawnSync(process.execPath, args, { stdio: 'inherit' })
    return run.status ?? 1
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
