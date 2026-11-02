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
| `dsh-dev test` | isolated temp `DSH_HOME`: add → dump-config → remove; `--boot` is a help probe |
| `dsh-dev submit` | detected `entry-validate` checkout, or a built-in compat subset |
| `dsh-dev upgrade` | guidance for `dsh-plugin-upgrade` (not bundled) |

`test` uses `dsh plugin add` + `dsh --dump-config` + `dsh plugin remove` in a
temporary `DSH_HOME`; it is install/dump/remove, not a full UI/boot test.
`submit` auto-detects a `dsh-plugin-spec` checkout (legacy `dsh-standards` also works), or runs a compat subset. C3 is FLOW-only: without host evidence it is `not-applicable`, not an incomplete ENTRY check. No score, ranking, or certification.

## Why `dsh-dev`

The package is `dsh-plugin-dev`; the command is `dsh-dev` to avoid colliding
with the existing `dsh-plugin-dev` bin from `dsh-primer`. The family:
`dsh-start` (begin), `dsh-ready` (preflight), `dsh-tools` (toolchain), `dsh-dev`
(dispatcher).
