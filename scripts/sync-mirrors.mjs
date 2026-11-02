#!/usr/bin/env node
/**
 * Read-only mirror sync: GitHub packages -> Gitee / GitCode contents API.
 * It never touches issues or pull requests. Tokens come from the environment.
 *
 *   GITEE_TOKEN=... GITCODE_TOKEN=... node scripts/sync-mirrors.mjs
 *   node scripts/sync-mirrors.mjs --only gitee --dry-run
 */
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const ROOT = path.resolve(import.meta.dirname, '..')
const PACKAGES = ['start', 'ready', 'tools', 'dev']
const PLATFORMS = {
  gitee: { base: 'https://gitee.com/api/v5', owner: 'perrylink', token: process.env.GITEE_TOKEN, delay: 1200 },
  gitcode: { base: 'https://api.gitcode.com/api/v5', owner: 'PerryLink', token: process.env.GITCODE_TOKEN, delay: 2600 },
}
const args = process.argv.slice(2)
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null
const dryRun = args.includes('--dry-run')

function walk(dir, base = dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git'].includes(entry.name) || entry.name.endsWith('.tgz')) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, base, out)
    else out.push(path.relative(base, full))
  }
  return out
}

async function api(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { 'User-Agent': 'dsh-plugin-devtools-sync', ...(options.headers ?? {}) } })
  const text = await response.text()
  let json = null
  try { json = JSON.parse(text) } catch { json = { raw: text } }
  return { status: response.status, json, text }
}

async function ensureRepo(platform, name) {
  const cfg = PLATFORMS[platform]
  const repo = `dsh-plugin-${name}`
  const check = await api(`${cfg.base}/repos/${cfg.owner}/${repo}?access_token=${cfg.token}`)
  if (check.status === 200) return repo
  const create = await api(`${cfg.base}/user/repos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      access_token: cfg.token,
      name: repo,
      description: `Mirror of https://github.com/PerryLink/${repo}`,
      private: false,
      has_issues: false,
      has_wiki: false,
      auto_init: false,
    }),
  })
  if (![200, 201].includes(create.status)) throw new Error(`${platform} create ${repo}: ${create.status} ${create.text.slice(0, 300)}`)
  return repo
}

async function putFile(platform, repo, file, content) {
  const cfg = PLATFORMS[platform]
  const url = `${cfg.base}/repos/${cfg.owner}/${repo}/contents/${file.split('/').map(encodeURIComponent).join('/')}`
  const get = await api(`${url}?access_token=${cfg.token}`)
  const existing = get.status === 200 && !Array.isArray(get.json) && get.json.sha ? get.json : null
  const body = {
    access_token: cfg.token,
    content: Buffer.from(content).toString('base64'),
    message: `${existing ? 'mirror: update' : 'mirror: add'} ${file}`,
    branch: 'main',
  }
  if (existing) body.sha = existing.sha
  if (dryRun) return { status: existing ? 'would-update' : 'would-add' }
  const result = await api(url, {
    method: existing ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (![200, 201].includes(result.status)) {
    // An empty Gitee repository may need an initial branch before other files.
    if (result.status === 400 && /sha is missing|sha is empty/.test(result.text) && file !== 'README.md') {
      const init = await api(`${cfg.base}/repos/${cfg.owner}/${repo}/contents/README.md`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: cfg.token, content: Buffer.from(`# ${repo}\n`).toString('base64'), message: 'mirror: init', branch: 'main' }),
      })
      if (![200, 201].includes(init.status)) throw new Error(`${platform} init ${repo}: ${init.status} ${init.text.slice(0, 200)}`)
      return putFile(platform, repo, file, content)
    }
    throw new Error(`${platform} ${repo}/${file}: ${result.status} ${result.text.slice(0, 200)}`)
  }
  return { status: existing ? 'updated' : 'added' }
}

const summary = []
for (const platform of Object.keys(PLATFORMS)) {
  if (only && only !== platform) continue
  const cfg = PLATFORMS[platform]
  if (!cfg.token) {
    console.error(`${platform}: token missing; skip`)
    summary.push({ platform, error: 'token missing' })
    continue
  }
  for (const name of PACKAGES) {
    const repo = await ensureRepo(platform, name)
    const dir = path.join(ROOT, 'packages', name)
    const files = [...walk(dir), 'MIRROR.md']
    let count = 0
    for (const file of files) {
      const content = file === 'MIRROR.md'
        ? `# Mirror\n\nRead-only mirror of https://github.com/PerryLink/${repo}.\nUse GitHub for issues, pull requests, and releases. npm: https://www.npmjs.com/package/${repo}\n`
        : fs.readFileSync(path.join(dir, file), 'utf8')
      const state = await putFile(platform, repo, file, content)
      count++
      console.log(`${platform} ${repo} ${file} ${state.status}`)
      if (!dryRun && cfg.delay) await new Promise(resolve => setTimeout(resolve, cfg.delay))
    }
    summary.push({ platform, repo, files: count })
  }
}
console.log(JSON.stringify({ dryRun, summary }, null, 2))
