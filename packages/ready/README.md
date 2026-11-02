# dsh-plugin-ready

Static preflight for a DeepSeek Harness plugin package.

```sh
npx dsh-plugin-ready .
npx dsh-plugin-ready . --json --out ready-report.json
npx dsh-plugin-ready . --strict
npx dsh-plugin-ready . --host   # dsh-clinic X; not C3
```

It checks the static ENTRY surface: package metadata, entry, `dsh.bundle`/patch,
`dsh.client`/`./client`, `engines`, `manifestVersion`, README/LICENSE, and
forbidden grade/rank fields.

**It does not install the plugin or start a host.** By default `host` is
`not-run`. `--host` runs `dsh-clinic --only X` if clinic is installed; a
`blocked` host is not a pass. C3 still requires a real install (use
`dsh-dev test` / test-drive) and `entry-validate --host-evidence`.
A static pass is not an audit or certification.

Exit codes: `0` pass/pass-with-warnings; `2` fail. `--strict` also fails on warnings.

Non-official; no score, ranking, or endorsement.
