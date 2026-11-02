import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { check as readyCheck } from 'dsh-plugin-ready'

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return null }
}

export function findStandards(explicit) {
  if (explicit) {
    const direct = path.resolve(explicit)
    if (fs.existsSync(direct) && fs.statSync(direct).isFile()) return direct
    const nested = path.join(direct, '40-checker', 'scripts', 'entry-validate.mjs')
    return fs.existsSync(nested) ? nested : null
  }
  if (process.env.DSH_STANDARDS_DIR) {
    const nested = path.join(process.env.DSH_STANDARDS_DIR, '40-checker', 'scripts', 'entry-validate.mjs')
    if (fs.existsSync(nested)) return nested
  }
  const candidates = [
    'dsh-plugin-spec', 'dsh-standard', 'dsh-standards',
    '../dsh-plugin-spec', '../dsh-standard', '../dsh-standards',
    '../../dsh-plugin-spec', '../../dsh-standard', '../../dsh-standards',
    '../../../dsh-plugin-spec', '../../../dsh-standard', '../../../dsh-standards',
  ]
  for (const candidate of candidates) {
    const nested = path.join(process.cwd(), candidate, '40-checker', 'scripts', 'entry-validate.mjs')
    if (fs.existsSync(nested)) return nested
  }
  return null
}

function statusOf(checks) {
  if (checks.some(c => c.status === 'fail')) return 'fail'
  if (checks.some(c => c.status === 'not-run' || c.status === 'blocked')) return 'incomplete'
  if (checks.some(c => c.status === 'warn')) return 'pass-with-warnings'
  return 'pass'
}

function compat(dir, meta, hostEvidence) {
  const ready = readyCheck(dir)
  const checks = []
  const add = (id, status, detail) => checks.push({ id, status, detail })
  if (meta?.repo && Array.isArray(meta.topics)) {
    const ok = meta.topics.includes('dsh-plugin') && meta.archived !== true
    add('C1', ok ? 'pass' : 'fail', `repo=${meta.repo}, topic=${meta.topics.includes('dsh-plugin')}, archived=${meta.archived === true}`)
  } else add('C1', 'not-run', 'no --meta repo/topics')
  const r7 = ready.static.checks.find(c => c.id === 'R7')
  const r8 = ready.static.checks.find(c => c.id === 'R8')
  add('C2', [r7, r8].some(c => c.status === 'fail') ? 'fail' : [r7, r8].some(c => c.status === 'warn') ? 'warn' : 'pass', 'dsh.bundle/patch (compat)')
  if (hostEvidence) {
    const s = ['pass', 'fail', 'blocked', 'not-run'].includes(hostEvidence.status) ? hostEvidence.status : 'blocked'
    add('C3', s, `host evidence: ${hostEvidence.status}`)
  } else add('C3', 'not-applicable', 'C3 is FLOW-only; run dsh-dev test/J1 or pass --host-evidence')
  const pkgFile = path.join(path.resolve(dir || '.'), 'package.json')
  let pkg = null
  try { pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8')) } catch {}
  const peer = pkg?.peerDependencies?.['@deepseek-ai/dsh']
  const engine = pkg?.engines?.dsh
  if (typeof peer === 'string' && peer.trim()) add('C4', 'pass', `peerDependencies["@deepseek-ai/dsh"] = ${peer}`)
  else if (typeof engine === 'string' && engine.trim()) add('C4', 'warn', `engines.dsh = ${engine} only; host reads peerDependencies`)
  else add('C4', 'warn', 'no engines.dsh or @deepseek-ai/dsh peer range')
  const r9 = ready.static.checks.find(c => c.id === 'R9')
  if (r9?.detail === 'no dsh.client declared') add('C5', 'not-applicable', 'no dsh.client; client export not required')
  else add('C5', r9?.status === 'pass' ? 'pass' : r9?.status === 'warn' ? 'warn' : 'fail', r9?.detail ?? 'client export')
  const c6 = [ready.static.checks.find(c => c.id === 'R4'), ready.static.checks.find(c => c.id === 'R5'), ready.static.checks.find(c => c.id === 'R6')]
  add('C6', c6.some(c => c?.status === 'fail') ? 'fail' : c6.some(c => c?.status === 'warn') ? 'warn' : 'pass', 'entry/license/description (compat)')
  const r3 = ready.static.checks.find(c => c.id === 'R3')
  add('C7', r3?.status === 'pass' ? 'pass' : 'fail', r3?.detail ?? 'version')
  const r16 = ready.static.checks.find(c => c.id === 'R16')
  add('C8', r16?.status === 'pass' ? 'pass' : 'fail', r16?.detail ?? 'grade/rank field')
  const status = statusOf(checks)
  return {
    schema: 'dsh-dev-submit/1',
    tool: 'dsh-dev',
    mode: 'compat',
    status,
    target: ready.target,
    checks,
    host: ready.host,
    notClaimed: ['compat subset, not full entry-validate', 'not a host install', 'not a certification'],
  }
}

export function submit({ dir, standards, meta: metaFile, hostEvidence: hostFile, json }) {
  const target = path.resolve(dir || '.')
  const script = findStandards(standards)
  if (script) {
    const args = [script, target]
    const meta = metaFile ? path.resolve(metaFile) : null
    const host = hostFile ? path.resolve(hostFile) : null
    if (meta) args.push('--meta', meta)
    if (host) args.push('--host-evidence', host)
    const r = spawnSync(process.execPath, args, { stdio: 'inherit' })
    return r.status ?? 1
  }
  const meta = metaFile ? readJson(path.resolve(metaFile)) : null
  const host = hostFile ? readJson(path.resolve(hostFile)) : null
  const result = compat(target, meta, host)
  if (json) process.stdout.write(JSON.stringify(result, null, 2) + '\n')
  else {
    console.log(`dsh-dev submit (compat) ${result.status}`)
    for (const c of result.checks) console.log(`${c.id} ${c.status.toUpperCase()} ${c.detail}`)
    console.log('no dsh-standards checkout found; this is a compat subset, not full entry-validate.')
  }
  return result.status === 'fail' ? 2 : result.status === 'incomplete' ? 3 : 0
}
