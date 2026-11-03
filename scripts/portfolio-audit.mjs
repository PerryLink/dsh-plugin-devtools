#!/usr/bin/env node
/**
 * Portfolio audit: static ENTRY + optional J1 + C5 check for PerryLink runtime plugins.
 * Read-only: clones missing repos to a temp dir, uses a temp DSH_HOME for J1.
 * Internal report; not a ranking, not verified.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { makeEvidence } from '../packages/dev/src/evidence.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const arg = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback }
const invPath = path.resolve(arg('--inventory', '/mnt/d/Projects/dsh/deepseek-community-hub/00-live/study-2026-11-02/portfolio-2026-11-03/inventory.json'))
const outDir = path.resolve(arg('--out', '/mnt/d/Projects/dsh/deepseek-community-hub/00-live/study-2026-11-02/portfolio-2026-11-03'))
const doJ1 = args.includes('--j1')
const doClone = args.includes('--clone')
const limit = Number(arg('--limit', '0')) || 0
const checkout = path.join(os.tmpdir(), 'dsh-portfolio-repos')
const hostVersion = arg('--host-version', '0.2.1-rc.5')
const localRoot = process.env.DSH_LOCAL_PLUGINS || '/mnt/d/Projects/dsh/plugins'
const inv = JSON.parse(fs.readFileSync(invPath, 'utf8'))
const vendor = path.join(ROOT, 'packages/dev/src/vendor/entry-validate.mjs')
const dshDev = path.join(ROOT, 'packages/dev/bin/dsh-dev.js')
const headers = { Authorization: `Bearer ${process.env.GH_TOKEN}`, Accept: 'application/vnd.github+json', 'User-Agent': 'dsh-portfolio-audit' }

function list(items, n) { return limit ? items.slice(0, n) : items }
function readJson(file, fb = null) { try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return fb } }
function run(command, argv, timeout = 180_000) {
  const r = spawnSync(command, argv, { encoding: 'utf8', timeout, env: { ...process.env } })
  let json = null; try { json = JSON.parse(r.stdout) } catch {}
  return { exit: r.status, json, stdout: r.stdout ?? '', stderr: r.stderr ?? '', timedOut: r.error?.code === 'ETIMEDOUT' }
}
function suggestions(checks) {
  const out = []
  const get = id => checks?.find(c => c.id === id)
  const c1 = get('C1'), c2 = get('C2'), c4 = get('C4'), c5 = get('C5'), c6 = get('C6'), c7 = get('C7'), c8 = get('C8')
  if (c1?.status === 'fail') out.push('C1: make the repo public and add the `dsh-plugin` topic; archived repos are not entry candidates')
  if (c2?.status === 'fail') out.push('C2: add `dsh.bundle.patch` and commit every referenced patch file')
  if (c4?.status === 'warn') out.push('C4: add `engines.dsh` (and optional peer range); missing carrier is a warning, not a fail')
  if (c4?.status === 'fail') out.push('C4: fix the compatibility range; do not use `*` or a malformed range')
  if (c5?.status === 'fail') out.push('C5: declare `exports["./client"]` and commit the client entry')
  if (c5?.status === 'warn') out.push('C5: client export is declared but the built file is not committed; build before publish')
  if (c6?.status === 'fail') out.push('C6: add the entry file and package description/license metadata')
  if (c7?.status === 'fail') out.push('C7: add a semver `version`; commit/freshness is a warning')
  if (c8?.status === 'fail') out.push('C8: remove grade/rank/official fields from the plugin manifest')
  return out
}

const all = inv.rows.filter(r => r.kind === 'runtime_plugin' && !['pointer', 'frozen', 'retired'].includes(r.effective_status))
const rows = list(all, limit)
fs.mkdirSync(outDir, { recursive: true })
fs.mkdirSync(checkout, { recursive: true })
const results = []
for (const r of rows) {
  let dir = path.join(localRoot, r.name)
  let source = 'local'
  if (!fs.existsSync(path.join(dir, 'package.json')) && doClone) {
    dir = path.join(checkout, r.name)
    if (!fs.existsSync(path.join(dir, 'package.json'))) {
      const clone = spawnSync('git', ['clone', '--depth', '1', `https://github.com/${r.repo}.git`, dir], { encoding: 'utf8', timeout: 120_000 })
      if (clone.status !== 0) { results.push({ name: r.name, repo: r.repo, status: 'clone-failed', reason: clone.stderr.slice(0, 200) }); console.log(r.name, 'clone-failed'); continue }
    }
    source = 'clone'
  }
  if (!fs.existsSync(path.join(dir, 'package.json'))) { results.push({ name: r.name, repo: r.repo, status: 'blocked', reason: 'no local package.json; rerun with --clone' }); console.log(r.name, 'blocked'); continue }
  let meta = null
  try { const res = await fetch(`https://api.github.com/repos/${r.repo}`, { headers }); if (res.ok) meta = await res.json() } catch {}
  const commit = spawnSync('git', ['-C', dir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim() || null
  const metaFile = path.join(outDir, `audit-meta-${r.name}.json`)
  fs.writeFileSync(metaFile, JSON.stringify({ repo: r.repo, topics: meta?.topics ?? r.topics ?? [], archived: meta?.archived ?? r.archived, commit, pushedAt: meta?.pushed_at ? String(meta.pushed_at).slice(0, 10) : (r.pushed_at ? String(r.pushed_at).slice(0, 10) : null), claimLevel: 'reference' }, null, 2) + '\n')
  const staticRun = run(process.execPath, [vendor, dir, '--meta', metaFile, '--host-version', hostVersion, '--format', 'json'], 60_000)
  const staticJson = staticRun.json
  let j1 = null
  if (doJ1) {
    const test = run(process.execPath, [dshDev, 'test', dir, '--json'], 180_000)
    j1 = test.json ?? { status: test.timedOut ? 'blocked' : 'fail', reason: test.timedOut ? 'timeout' : test.stderr.slice(0, 300) }
  }
  let pkg = null
  try { pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')) } catch {}
  const clientExport = pkg?.exports?.['./client'] ?? null
  const c5 = staticJson?.checks?.find(c => c.id === 'C5')
  const suggestionsList = suggestions(staticJson?.checks)
  if (j1?.status === 'fail' || j1?.status === 'blocked') suggestionsList.push(`J1: ${j1.status}${j1.reason ? ` — ${j1.reason}` : ''}; fix install/build or record blocked`)
  const evidence = j1?.evidence ?? null
  results.push({
    name: r.name, repo: r.repo, kind: r.kind, effective_status: r.effective_status, source, dir,
    static: staticJson ? { status: staticJson.conclusion?.status, checks: staticJson.checks?.map(c => ({ id: c.id, status: c.status, detail: c.detail })) } : { status: 'error', error: staticRun.stderr.slice(0, 300) },
    j1: j1 ? { status: j1.status, reason: j1.reason ?? null, evidence } : { status: doJ1 ? 'error' : 'not-run' },
    c5: { status: c5?.status ?? 'not-run', clientDeclared: !!pkg?.dsh?.client, clientExport },
    suggestions: suggestionsList,
  })
  console.log(r.name, results.at(-1).static.status, j1?.status ?? '')
  fs.writeFileSync(path.join(outDir, 'PORTFOLIO-AUDIT.json'), JSON.stringify({ schema: 'dsh-portfolio-audit/1', generatedAt: new Date().toISOString(), total: results.length, rows: results }, null, 2) + '\n')
}
const summary = {
  schema: 'dsh-portfolio-audit/1', generatedAt: new Date().toISOString(), total: results.length,
  static: Object.fromEntries(['pass', 'pass-with-warnings', 'incomplete', 'fail', 'error'].map(s => [s, results.filter(x => x.static?.status === s).length])),
  j1: Object.fromEntries(['pass', 'fail', 'blocked', 'not-run', 'error'].map(s => [s, results.filter(x => x.j1?.status === s).length])),
  suggestions: results.reduce((n, x) => n + (x.suggestions?.length ?? 0), 0),
}
fs.writeFileSync(path.join(outDir, 'PORTFOLIO-AUDIT.json'), JSON.stringify({ ...summary, rows: results }, null, 2) + '\n')
const lines = ['# Portfolio audit', '', '> Internal. Static ENTRY + optional J1. Not a ranking, not verified.', '', `- total: ${summary.total}`, `- static: ${JSON.stringify(summary.static)}`, `- J1: ${JSON.stringify(summary.j1)}`, '', '| plugin | static | J1 | suggestions |', '|---|---|---|---|', ...results.map(r => `| ${r.repo} | ${r.static?.status ?? 'error'} | ${r.j1?.status ?? 'not-run'} | ${r.suggestions.length} |`)]
fs.writeFileSync(path.join(outDir, 'PORTFOLIO-AUDIT.md'), lines.join('\n') + '\n')
console.log(JSON.stringify(summary, null, 2))
