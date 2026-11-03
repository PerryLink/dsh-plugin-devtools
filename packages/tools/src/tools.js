import { spawnSync } from 'node:child_process'
import fs from 'node:fs'

const VERSION = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version

export const KNOWN = [
  { id: 'start', pkg: 'dsh-plugin-start', bin: 'dsh-start', role: 'scaffold a plugin' },
  { id: 'ready', pkg: 'dsh-plugin-ready', bin: 'dsh-ready', role: 'static preflight' },
  { id: 'dev', pkg: 'dsh-plugin-dev', bin: 'dsh-dev', role: 'unified dispatcher' },
  { id: 'tools', pkg: 'dsh-plugin-tools', bin: 'dsh-tools', role: 'toolchain manager' },
  { id: 'primer', pkg: 'dsh-primer', bin: null, role: 'learn/plan/scaffold knowledge' },
  { id: 'clinic', pkg: 'dsh-clinic', bin: 'dsh-clinic', role: 'static + host-contract checks' },
  { id: 'test-drive', pkg: 'dsh-test-drive', bin: null, role: 'isolated install/smoke (C3)' },
  { id: 'codemod', pkg: 'dsh-codemod', bin: 'dsh-codemod', role: 'version migration' },
  { id: 'standards', pkg: null, bin: null, role: 'ENTRY/FLOW/BOOST spec and entry-validate' },
]

export function usage() {
  return `dsh-tools ${VERSION} — toolchain list/doctor/install guidance

Usage:
  dsh-tools list [--json]
  dsh-tools doctor [--json]
  dsh-tools install <tool> [--json]
  dsh-tools update [--json]

Options:
  --json        machine-readable output
  -h, --help    show this help
  -v, --version show the version

This tool never installs or updates anything by itself; it prints the exact
commands. There is no dsh-plugin-kit requirement.
`
}

export function parse(argv) {
  const out = { command: null, arg: null, json: false, help: false, version: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--json') out.json = true
    else if (a === '--help' || a === '-h') out.help = true
    else if (a === '--version' || a === '-v') out.version = true
    else if (a.startsWith('-')) throw new Error(`unknown option: ${a}`)
    else if (!out.command) out.command = a
    else if (!out.arg) out.arg = a
    else throw new Error(`unexpected argument: ${a}`)
  }
  return out
}

export function hasCommand(command) {
  if (!command) return null
  const which = process.platform === 'win32' ? 'where' : 'which'
  const r = spawnSync(which, [command], { encoding: 'utf8', timeout: 3000 })
  return r.status === 0
}

export function list() {
  return KNOWN.map(t => ({ ...t, installed: hasCommand(t.bin) }))
}

export function doctor() {
  const major = Number(process.versions.node.split('.')[0])
  const node = { id: 'node', status: major >= 20 ? 'pass' : 'fail', detail: `Node ${process.versions.node}; >=20 required` }
  const npm = { id: 'npm', status: hasCommand('npm') ? 'pass' : 'fail', detail: 'npm is required for publishing' }
  const dsh = { id: 'dsh', status: hasCommand('dsh') ? 'pass' : 'warn', detail: 'dsh CLI is needed for profile/host tests' }
  const git = { id: 'git', status: hasCommand('git') ? 'pass' : 'warn', detail: 'git is needed for commits/releases' }
  const checks = [node, npm, dsh, git]
  const failed = checks.filter(c => c.status === 'fail').length
  const warnings = checks.filter(c => c.status === 'warn').length
  return {
    schema: 'dsh-plugin-tools/1',
    tool: 'dsh-plugin-tools',
    version: VERSION,
    generatedAt: new Date().toISOString(),
    status: failed > 0 ? 'fail' : warnings > 0 ? 'pass-with-warnings' : 'pass',
    checks,
    notClaimed: ['not a package audit', 'not a host install', 'not a security audit'],
  }
}

export async function main(argv) {
  let args
  try {
    args = parse(argv)
  } catch (error) {
    console.error(error.message)
    console.error(usage())
    return 1
  }
  if (args.help) {
    console.log(usage())
    return 0
  }
  if (args.version) {
    console.log(VERSION)
    return 0
  }
  const command = args.command || 'list'
  if (command === 'list') {
    const rows = list()
    if (args.json) {
      process.stdout.write(JSON.stringify({ schema: 'dsh-plugin-tools/1', tools: rows }, null, 2) + '\n')
    } else {
      console.log('tool              package                 installed  role')
      for (const t of rows) {
        const installed = t.installed === null ? 'unknown' : t.installed ? 'yes' : 'no'
        console.log(`${t.id.padEnd(16)} ${String(t.pkg ?? '-').padEnd(23)} ${installed.padEnd(10)} ${t.role}`)
      }
      console.log('\ninstall with: npm install -g <package>  (the command is not executed here)')
    }
    return 0
  }
  if (command === 'doctor') {
    const result = doctor()
    if (args.json) process.stdout.write(JSON.stringify(result, null, 2) + '\n')
    else {
      console.log(`dsh-tools ${VERSION}`)
      for (const c of result.checks) console.log(`${c.id.padEnd(5)} ${c.status.toUpperCase()} ${c.detail}`)
      console.log(`\nstatus: ${result.status}`)
    }
    return result.status === 'fail' ? 1 : 0
  }
  if (command === 'install') {
    const tool = KNOWN.find(t => t.id === args.arg || t.pkg === args.arg)
    if (!tool || !tool.pkg) {
      console.error(`unknown or non-installable tool: ${args.arg ?? '(missing)'}`)
      console.error('try: dsh-tools list')
      return 1
    }
    const commandLine = `npm install -g ${tool.pkg}`
    if (args.json) process.stdout.write(JSON.stringify({ schema: 'dsh-plugin-tools/1', tool: tool.id, package: tool.pkg, command: commandLine, executed: false }, null, 2) + '\n')
    else {
      console.log(`${tool.pkg} — ${tool.role}`)
      console.log(`  ${commandLine}`)
      console.log('  (not executed by dsh-tools; run it yourself)')
    }
    return 0
  }
  if (command === 'update') {
    const rows = list().filter(t => t.pkg)
    if (args.json) process.stdout.write(JSON.stringify({ schema: 'dsh-plugin-tools/1', commands: rows.map(t => `npm install -g ${t.pkg}@latest`), executed: false }, null, 2) + '\n')
    else {
      console.log('update commands (not executed):')
      for (const t of rows) console.log(`  npm install -g ${t.pkg}@latest`)
    }
    return 0
  }
  console.error(`unknown command: ${command}`)
  console.error(usage())
  return 1
}
