import crypto from 'node:crypto'
import { makeEvidence } from './evidence.js'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

function hash(text) {
  return crypto.createHash('sha256').update(text ?? '').digest('hex')
}

function has(command) {
  const which = process.platform === 'win32' ? 'where' : 'which'
  return spawnSync(which, [command], { encoding: 'utf8', timeout: 3000 }).status === 0
}

function run(command, args, env, timeout = 120_000) {
  const r = spawnSync(command, args, { encoding: 'utf8', timeout, env })
  return {
    command: [command, ...args].join(' '),
    exit: r.status,
    stdoutHash: hash(r.stdout),
    stderrHash: hash(r.stderr),
    timedOut: r.error?.code === 'ETIMEDOUT',
  }
}

export function testDrive(dir, options = {}) {
  const target = path.resolve(dir || '.')
  const pkgFile = path.join(target, 'package.json')
  if (!fs.existsSync(pkgFile)) {
    return { schema: 'dsh-dev-test/1', status: 'blocked', reason: 'package.json not found', target, commands: [] }
  }
  let pkg
  try { pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8')) } catch (error) {
    return { schema: 'dsh-dev-test/1', status: 'blocked', reason: `invalid package.json: ${error.message}`, target, commands: [] }
  }
  for (const command of ['dsh', 'pnpm']) {
    if (!has(command)) {
      return {
        schema: 'dsh-dev-test/1',
        status: 'blocked',
        reason: `${command} is not available; this is not a pass`,
        target,
        package: pkg.name,
        commands: [],
      }
    }
  }
  const real = path.join(os.homedir(), '.dsh')
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-dev-test-'))
  const home = path.join(temp, 'home')
  const profile = 'test'
  if (path.resolve(home) === path.resolve(real)) {
    fs.rmSync(temp, { recursive: true, force: true })
    return { schema: 'dsh-dev-test/1', status: 'blocked', reason: 'refusing to use the real DSH_HOME', target, commands: [] }
  }
  const env = { ...process.env, DSH_HOME: home }
  const commands = []
  let status = 'pass'
  let boot = null
  try {
    const add = run('dsh', ['plugin', '--profile', profile, 'add', target], env, 180_000)
    commands.push(add)
    if (add.exit !== 0) status = 'fail'
    if (status === 'pass') {
      const dump = run('dsh', ['--profile', profile, '--dump-config'], env, 60_000)
      commands.push(dump)
      if (dump.exit !== 0) status = 'fail'
    }
    if (options.boot) {
      const bootRun = spawnSync('dsh', ['--profile', profile, '--no-open', '--port', '0'], { encoding: 'utf8', timeout: 30_000, env })
      const url = (bootRun.stdout || '').match(/https?:\/\/127\.0\.0\.1:\d+[^\s]*/)?.[0] ?? null
      boot = {
        command: 'dsh --profile ' + profile + ' --no-open --port 0',
        exit: bootRun.status,
        timedOut: bootRun.error?.code === 'ETIMEDOUT',
        url,
        status: url ? 'pass' : 'blocked',
      }
      commands.push({ ...boot, stdoutHash: hash(bootRun.stdout), stderrHash: hash(bootRun.stderr) })
      if (!url && status === 'pass') status = 'pass-with-warnings'
    }
    const remove = run('dsh', ['plugin', '--profile', profile, 'remove', pkg.name], env, 120_000)
    commands.push(remove)
    if (remove.exit !== 0 && status === 'pass') status = 'pass-with-warnings'
  } finally {
    fs.rmSync(temp, { recursive: true, force: true })
  }
  const evidence = makeEvidence({
    kind: 'host-install',
    subject: { repo: target, version: pkg.version ?? null, commit: null },
    host: 'dsh (version not captured by this probe)',
    command: commands.map(c => c.command).join(' ; '),
    status: status === 'pass-with-warnings' ? 'pass' : status,
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    artifacts: commands,
    limitations: ['install + dump-config + remove; not a full UI/boot test', 'not C3 certification'],
  })
  return {
    schema: 'dsh-dev-test/1',
    tool: 'dsh-dev',
    status,
    target,
    package: pkg.name,
    profile,
    realProfile: real,
    tempHome: home,
    commands,
    boot,
    evidence,
    notClaimed: [
      'install + dump-config + remove, not a full UI/boot test',
      'not C3 certification',
      'not a security audit',
    ],
  }
}
