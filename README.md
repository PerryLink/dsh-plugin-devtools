> **Index / archive.** Active development has moved to four repos:
> [start](https://github.com/PerryLink/dsh-plugin-start) ·
> [ready](https://github.com/PerryLink/dsh-plugin-ready) ·
> [tools](https://github.com/PerryLink/dsh-plugin-tools) ·
> [dev](https://github.com/PerryLink/dsh-plugin-dev).
> This repo keeps the history, design, and the four-package archive.

# dsh-plugin-devtools

Four small CLIs for the DeepSeek Harness plugin developer journey. One command
family, no runtime plugin, no `dsh-plugin-kit`, no score/ranking/certification.

| Package | Command | Question | Role |
|---|---|---|---|
| [`dsh-plugin-start`](packages/start) | `dsh-start` | How do I begin? | create a minimal, correct plugin skeleton |
| [`dsh-plugin-ready`](packages/ready) | `dsh-ready` | Is the static surface ready? | static preflight (ENTRY subset) |
| [`dsh-plugin-tools`](packages/tools) | `dsh-tools` | Which tools do I have? | list/doctor/install guidance |
| [`dsh-plugin-dev`](packages/dev) | `dsh-dev` | What is the whole workflow? | thin dispatcher |

```sh
npx dsh-plugin-dev new my-plugin
cd my-plugin
npx dsh-plugin-dev check .
npx dsh-plugin-dev test .
```

`dsh-dev` is the advertised front door; the other three work standalone.

## Mirrors

- GitHub is canonical: issues, pull requests, releases.
- Gitee and GitCode are read-only code mirrors; no issues or pull requests there.
- `node scripts/sync-mirrors.mjs` syncs code only; the manual `sync-mirrors` workflow uses `GITEE_TOKEN` / `GITCODE_TOKEN` secrets. It never touches issues/PRs.

## Position under ENTRY / FLOW / BOOST

- `start`: creates the ENTRY C1/C2/C6/C7 shape, an installable FLOW J1 skeleton,
  and a B1-friendly `ctx.effect` seed. The public repo/topic is still the author's job.
- `ready`: static ENTRY subset; C3 is **not-run**, never faked; J3/J7 static
  preflight; BOOST is **not-measured**.
- `tools`: toolchain/version support; no standard gate.
- `dev`: dispatches start/ready/tools and points at test-drive/submit/upgrade.

A static pass is not a host install, an audit, a performance result, or a
certification. Use `dsh-test-drive` for C3 and `entry-validate --host-evidence`
for market-facing evidence.

## Develop

```sh
npm install --ignore-scripts
npm test
```

## Non-goals

- no `dsh-plugin-kit` requirement;
- no score, grade, rank, certification, or official claim;
- no host install inside `dsh-ready`;
- no automatic install/update in `dsh-tools`.

Apache-2.0. See [`DESIGN.md`](DESIGN.md).
