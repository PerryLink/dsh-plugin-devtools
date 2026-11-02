# dsh-plugin-dev

The advertised front door for the DSH plugin developer workflow.

```sh
npx dsh-plugin-dev new my-plugin
npx dsh-plugin-dev check .
npx dsh-plugin-dev tools list
```

It is a thin dispatcher:

| Command | Delegates to |
|---|---|
| `dsh-dev new` / `start` | `dsh-plugin-start` |
| `dsh-dev check` / `ready` | `dsh-plugin-ready` |
| `dsh-dev tools` | `dsh-plugin-tools` |
| `dsh-dev test` | guidance for `dsh-test-drive` (not bundled) |
| `dsh-dev submit` | `entry-validate` in a dsh-standards checkout, with `--standards` |
| `dsh-dev upgrade` | guidance for `dsh-plugin-upgrade` (not bundled) |

No host install, no score, no ranking, no certification; `test`/`submit` return
`3` (not-run) until a real underlying tool is supplied.

## Why `dsh-dev`

The package is `dsh-plugin-dev`; the command is `dsh-dev` to avoid colliding
with the existing `dsh-plugin-dev` bin from `dsh-primer`. The family:
`dsh-start` (begin), `dsh-ready` (preflight), `dsh-tools` (toolchain), `dsh-dev`
(dispatcher).
