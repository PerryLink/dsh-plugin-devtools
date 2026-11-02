# dsh-plugin-ready

Static preflight for a DeepSeek Harness plugin package.

```sh
npx dsh-plugin-ready .
npx dsh-plugin-ready . --json --out ready-report.json
npx dsh-plugin-ready . --strict
```

It checks the static ENTRY surface: package metadata, entry, `dsh.bundle`/patch,
`dsh.client`/`./client`, `engines`, `manifestVersion`, README/LICENSE, and
forbidden grade/rank fields.

**It does not install the plugin or start a host.** `host` is reported as
`not-run`; use `dsh-test-drive` for C3 and feed the result to
`entry-validate --host-evidence`. A static pass is not an audit or certification.

Exit codes: `0` pass/pass-with-warnings; `2` fail. `--strict` also fails on warnings.

Non-official; no score, ranking, or endorsement.
