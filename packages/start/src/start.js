import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const NAME_RE = /^[a-z0-9][a-z0-9-]*$/
const VERSION = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version

export function usage() {
  return `dsh-start ${VERSION} — create a minimal DeepSeek Harness plugin

Usage:
  dsh-start new <name> [--dir <dir>] [--client] [--yes]

Options:
  --dir <dir>   target directory (default: ./<name>)
  --client      add a browser client entry and ./client export
  --yes         non-interactive (this tool never prompts)
  -h, --help    show this help
  -v, --version show the version

What it writes:
  package.json, cordis.patch.yml, index.js, README.md, LICENSE, .gitignore
  plus client.js when --client is used.

It does not install dependencies or publish anything.
`
}

export function parse(argv) {
  const out = { name: null, dir: null, client: false, yes: false, help: false, version: false }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === 'new') continue
    if (arg === '--dir' || arg === '-d') out.dir = argv[++i]
    else if (arg === '--client') out.client = true
    else if (arg === '--yes' || arg === '-y') out.yes = true
    else if (arg === '--help' || arg === '-h') out.help = true
    else if (arg === '--version' || arg === '-v') out.version = true
    else if (arg.startsWith('-')) throw new Error(`unknown option: ${arg}`)
    else if (!out.name) out.name = arg
    else throw new Error(`unexpected argument: ${arg}`)
  }
  return out
}

function pkgJson(name, client) {
  const pkg = {
    name,
    version: '0.1.0',
    description: 'A DeepSeek Harness plugin.',
    license: 'Apache-2.0',
    type: 'module',
    main: './index.js',
    exports: { '.': './index.js' },
    files: ['index.js', 'cordis.patch.yml', 'README.md', 'LICENSE'],
    engines: { node: '>=20', dsh: '>=0.2.0 <0.3.0' },
    peerDependencies: { '@deepseek-ai/dsh': '>=0.2.0 <0.3.0' },
    dsh: {
      manifestVersion: 1,
      bundle: { patch: './cordis.patch.yml' },
    },
  }
  if (client) {
    pkg.exports['./client'] = './client.js'
    pkg.files.push('client.js')
    pkg.dsh.client = { platform: 'web' }
  }
  return JSON.stringify(pkg, null, 2) + '\n'
}

function patchYml(name) {
  return `- insert:
    - id: ${name}
      name: ./index.js
`
}

function indexJs(name) {
  return `export const name = '${name}'

export const inject = []

export function apply(ctx) {
  // Keep every resource inside ctx.effect so dispose is clean.
  ctx.effect(() => {
    return () => {}
  })
}
`
}

function clientJs(name) {
  return `export const name = '${name}-client'

export function apply() {}
`
}

function readme(name, client) {
  return `# ${name}

A DeepSeek Harness plugin created with \`dsh-start\`.

## Install (local checkout)

\`\`\`sh
dsh plugin --profile web add ${name}
\`\`\`

## Next

\`\`\`sh
dsh-dev check .
${client ? '# check the client export and platform\n' : ''}dsh-dev test .
dsh-dev submit .
\`\`\`

## Publish

1. Add a \`repository\`, \`homepage\`, and a \`dsh-plugin\` GitHub topic.
2. Run \`dsh-ready .\` and fix every fail.
3. Feed a real host install to \`entry-validate --host-evidence\`.
4. Publish with npm and submit to the market you use.

This skeleton is a start, not a certification or a host-install result.
`
}

function gitignore() {
  return `node_modules/
dist/
*.log
.DS_Store
`
}

export function create(name, target, { client = false } = {}) {
  if (!NAME_RE.test(name)) throw new Error(`invalid package name: ${name} (use lowercase letters, digits, hyphens)`)
  const resolved = path.resolve(target)
  if (fs.existsSync(resolved)) {
    const entries = fs.readdirSync(resolved)
    if (entries.length > 0) throw new Error(`target directory is not empty: ${resolved}`)
  }
  fs.mkdirSync(resolved, { recursive: true })
  const files = {
    'package.json': pkgJson(name, client),
    'cordis.patch.yml': patchYml(name),
    'index.js': indexJs(name),
    'README.md': readme(name, client),
    '.gitignore': gitignore(),
  }
  if (client) files['client.js'] = clientJs(name)
  for (const [file, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(resolved, file), content)
  }
  const license = fileURLToPath(new URL('../LICENSE', import.meta.url))
  fs.copyFileSync(license, path.join(resolved, 'LICENSE'))
  return { dir: resolved, files: Object.keys(files).concat('LICENSE') }
}

export async function main(argv, options = {}) {
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
  if (!args.name) {
    console.error('missing plugin name')
    console.error(usage())
    return 1
  }
  const target = args.dir || args.name
  try {
    const result = create(args.name, target, { client: args.client })
    console.log(`created ${result.dir}`)
    for (const file of result.files) console.log(`  ${file}`)
    console.log('\nNext:')
    console.log(`  cd ${path.relative(process.cwd(), result.dir) || '.'}`)
    console.log('  dsh-dev check .')
    console.log('  dsh-dev test .')
    console.log('  dsh-dev submit .')
    return 0
  } catch (error) {
    console.error(error.message)
    return 1
  }
}
