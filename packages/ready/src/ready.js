import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const VERSION = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version
const SEMVER = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/

export function usage() {
  return `dsh-ready ${VERSION} — static preflight for a DSH plugin package

Usage:
  dsh-ready [<dir>] [--json] [--out <file>] [--strict] [--host]

Options:
  --json        machine-readable report
  --out <file>  write the JSON report to a file
  --strict      treat warnings as failures
  --host        also run dsh-clinic X (host contract; not C3)
  -h, --help    show this help
  -v, --version show the version

This checks the static ENTRY surface only. It does not install the plugin,
start a host, measure performance, audit security, or certify anything.
C3 host evidence must come from a real host install (for example test-drive)
and be fed to entry-validate --host-evidence.
`
}

export function parse(argv) {
  const out = { dir: null, json: false, out: null, strict: false, host: false, help: false, version: false }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--json') out.json = true
    else if (arg === '--out') out.out = argv[++i]
    else if (arg === '--strict') out.strict = true
    else if (arg === '--host') out.host = true
    else if (arg === '--help' || arg === '-h') out.help = true
    else if (arg === '--version' || arg === '-v') out.version = true
    else if (arg.startsWith('-')) throw new Error(`unknown option: ${arg}`)
    else if (!out.dir) out.dir = arg
    else throw new Error(`unexpected argument: ${arg}`)
  }
  return out
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function add(checks, id, status, detail) {
  checks.push({ id, status, detail })
}

export function check(dir) {
  const target = path.resolve(dir || '.')
  const checks = []
  const pkgFile = path.join(target, 'package.json')
  if (!fs.existsSync(pkgFile)) {
    add(checks, 'R1', 'fail', 'package.json is missing')
    return report(target, checks, null)
  }
  let pkg
  try {
    pkg = readJson(pkgFile)
  } catch (error) {
    add(checks, 'R1', 'fail', `package.json is not valid JSON: ${error.message}`)
    return report(target, checks, null)
  }

  add(checks, 'R1', 'pass', 'package.json exists and is valid JSON')
  if (typeof pkg.name === 'string' && pkg.name.length > 0) add(checks, 'R2', 'pass', `name: ${pkg.name}`)
  else add(checks, 'R2', 'fail', 'name is missing')
  if (typeof pkg.version === 'string' && SEMVER.test(pkg.version)) add(checks, 'R3', 'pass', `version: ${pkg.version}`)
  else add(checks, 'R3', 'fail', 'version is missing or not semver')
  if (typeof pkg.description === 'string' && pkg.description.trim()) add(checks, 'R4', 'pass', 'description is present')
  else add(checks, 'R4', 'warn', 'description is missing')
  if (typeof pkg.license === 'string' && pkg.license.length > 0) add(checks, 'R5', 'pass', `license: ${pkg.license}`)
  else add(checks, 'R5', 'warn', 'license is missing (legal/market profile, not an entry hard fail)')

  const entry = pkg.exports?.['.'] || (typeof pkg.exports === 'string' ? pkg.exports : null) || pkg.main
  if (typeof entry === 'string' && entry.length > 0) add(checks, 'R6', 'pass', `entry: ${entry}`)
  else add(checks, 'R6', 'fail', 'main/exports["."] is missing')

  const bundle = pkg.dsh?.bundle
  if (!bundle || typeof bundle !== 'object') {
    add(checks, 'R7', 'fail', 'dsh.bundle is missing; a client-only package is not installable')
  } else {
    add(checks, 'R7', 'pass', 'dsh.bundle is present')
    const patches = Array.isArray(bundle.patch) ? bundle.patch : [bundle.patch]
    if (patches.length === 0 || patches.some(p => typeof p !== 'string' || !p)) {
      add(checks, 'R8', 'fail', 'dsh.bundle.patch is empty or not a string/list of strings')
    } else {
      for (const patch of patches) {
        const file = path.resolve(target, patch)
        if (!fs.existsSync(file)) {
          add(checks, 'R8', 'fail', `patch file is missing: ${patch}`)
          continue
        }
        const text = fs.readFileSync(file, 'utf8').trim()
        if (!text) add(checks, 'R8', 'warn', `patch file is empty: ${patch}`)
        else if (/^-?\s*insert:\s*\[\s*\]\s*$/m.test(text) || text === '- insert: []') add(checks, 'R8', 'warn', `patch inserts nothing: ${patch}`)
        else add(checks, 'R8', 'pass', `patch file: ${patch}`)
      }
    }
  }

  if (pkg.dsh?.client) {
    const clientExport = pkg.exports?.['./client']
    if (typeof clientExport !== 'string') add(checks, 'R9', 'fail', 'dsh.client is declared but exports["./client"] is missing')
    else {
      const clientFile = path.resolve(target, clientExport)
      if (!fs.existsSync(clientFile)) add(checks, 'R9', 'fail', `client export target is missing: ${clientExport}`)
      else add(checks, 'R9', 'pass', `client export: ${clientExport}`)
    }
    if (!pkg.dsh.client.platform) add(checks, 'R9', 'warn', 'dsh.client.platform is missing')
  } else {
    add(checks, 'R9', 'pass', 'no dsh.client declared')
  }

  if (typeof pkg.engines?.dsh === 'string' && pkg.engines.dsh.trim()) add(checks, 'R10', 'pass', `engines.dsh: ${pkg.engines.dsh}`)
  else add(checks, 'R10', 'warn', 'engines.dsh is missing (compatibility profile)')
  if (typeof pkg.engines?.node === 'string' && pkg.engines.node.trim()) add(checks, 'R11', 'pass', `engines.node: ${pkg.engines.node}`)
  else add(checks, 'R11', 'warn', 'engines.node is missing')

  if (pkg.dsh?.manifestVersion === 1) add(checks, 'R12', 'pass', 'dsh.manifestVersion: 1')
  else add(checks, 'R12', 'warn', 'dsh.manifestVersion is missing or not 1')

  if (pkg.engines?.dsh && !pkg.peerDependencies?.['@deepseek-ai/dsh']) add(checks, 'R18', 'warn', 'engines.dsh is not read by the host; add peerDependencies["@deepseek-ai/dsh"] with the same range')
  else add(checks, 'R18', 'pass', 'host version carrier (peerDependencies) is present or no engines.dsh is declared')

  if (pkg.repository) add(checks, 'R13', 'pass', 'repository is present')
  else add(checks, 'R13', 'warn', 'repository is missing')

  for (const [id, file, label] of [['R14', 'README.md', 'README.md'], ['R15', 'LICENSE', 'LICENSE']]) {
    if (fs.existsSync(path.join(target, file))) add(checks, id, 'pass', `${label} is present`)
    else add(checks, id, 'warn', `${label} is missing`)
  }

  const forbidden = ['grade', 'score', 'rank', 'level'].filter(k => pkg.dsh?.[k] !== undefined)
  if (forbidden.length > 0) add(checks, 'R16', 'fail', `dsh.${forbidden.join('/dsh.')} must not be a grade/rank field`)
  else add(checks, 'R16', 'pass', 'no dsh grade/score/rank/level field')

  if (pkg.dsh?.standards?.entry?.status && pkg.dsh.standards.entry.status !== 'not-run') {
    add(checks, 'R17', 'warn', 'dsh.standards claims a status; dsh-ready does not verify it')
  }

  return report(target, checks, pkg)
}

function report(target, checks, pkg) {
  const passed = checks.filter(c => c.status === 'pass').length
  const warnings = checks.filter(c => c.status === 'warn').length
  const failed = checks.filter(c => c.status === 'fail').length
  const status = failed > 0 ? 'fail' : warnings > 0 ? 'pass-with-warnings' : 'pass'
  return {
    schema: 'dsh-plugin-ready/1',
    tool: 'dsh-plugin-ready',
    version: VERSION,
    generatedAt: new Date().toISOString(),
    target,
    package: pkg ? { name: pkg.name, version: pkg.version } : null,
    static: { status, passed, warnings, failed, checks },
    host: { status: 'not-run', reason: 'static preflight only; use test-drive for a real host install' },
    notClaimed: [
      'not a host install',
      'not a security audit',
      'not a performance measurement',
      'not a certification or official endorsement',
    ],
  }
}

export function runHost(dir) {
  const which = process.platform === 'win32' ? 'where' : 'which'
  const probe = spawnSync(which, ['dsh-clinic'], { encoding: 'utf8', timeout: 3000 })
  if (probe.status !== 0) {
    return { status: 'blocked', reason: 'dsh-clinic is not installed; npm i -g dsh-clinic', command: null, groups: null }
  }
  const command = ['dsh-clinic', '--repo', dir, '--no-smoke', '--only', 'X', '--json', '-']
  const run = spawnSync(command[0], command.slice(1), { encoding: 'utf8', timeout: 60_000 })
  let json = null
  try { json = JSON.parse(run.stdout) } catch {}
  const groups = json?.groups?.X ?? null
  if (!json) return { status: 'blocked', reason: `dsh-clinic produced no JSON (exit ${run.status})`, command: command.join(' '), groups: null }
  if (groups?.fail > 0) return { status: 'fail', reason: 'dsh-clinic X reported fail', command: command.join(' '), groups }
  if (!groups || groups.ran === 0 || groups.skipped > 0) return { status: 'blocked', reason: 'dsh-clinic X did not run all checks', command: command.join(' '), groups }
  return { status: 'pass', reason: 'dsh-clinic X passed', command: command.join(' '), groups }
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
  const result = check(args.dir || '.')
  if (args.host) result.host = runHost(result.target)
  let exit = result.static.failed > 0 || (args.strict && result.static.warnings > 0) ? 2 : 0
  if (args.host && result.host.status === 'fail') exit = 2
  if (args.host && result.host.status === 'blocked' && exit === 0) exit = 3
  if (args.json) {
    const text = JSON.stringify(result, null, 2) + '\n'
    if (args.out) fs.writeFileSync(path.resolve(args.out), text)
    process.stdout.write(text)
  } else {
    console.log(`dsh-ready ${VERSION}`)
    console.log(`target: ${result.target}`)
    for (const c of result.static.checks) console.log(`${c.id} ${c.status.toUpperCase()} ${c.detail}`)
    console.log(`\nstatic: ${result.static.status} (${result.static.passed} pass, ${result.static.warnings} warn, ${result.static.failed} fail)`)
    console.log(`host: ${result.host.status}${result.host.reason ? ` (${result.host.reason})` : ''}`)
    console.log('host X is a contract check, not C3; use test-drive for a real install')
    console.log('not claimed: host install / security audit / performance / certification')
    if (args.out) fs.writeFileSync(path.resolve(args.out), JSON.stringify(result, null, 2) + '\n')
  }
  return exit
}
