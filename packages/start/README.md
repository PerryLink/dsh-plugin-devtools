# dsh-plugin-start

**Start here.** Create a minimal, correct DeepSeek Harness plugin skeleton.

```sh
npx dsh-plugin-start new my-plugin
# or after global install:
dsh-start new my-plugin --client
```

## What you get

- `package.json` with `dsh.manifestVersion`, `dsh.bundle.patch`, `engines.dsh`;
- `cordis.patch.yml` that inserts `./index.js`;
- `index.js` with a `ctx.effect` dispose shape;
- optional `client.js` + `./client` export with `--client`;
- README, LICENSE, `.gitignore`.

It does **not** install dependencies, run a host, publish, or claim your plugin is ready.
Next: `dsh-dev check .` → `dsh-dev test .` → `dsh-dev submit .`.

## Standards

- ENTRY: creates the C1/C2/C6/C7 shape (the public repo/topic is still your job).
- FLOW: an installable J1 skeleton.
- BOOST: a B1-friendly `ctx.effect` seed, not a measurement.

Non-official; not a certification, audit, or endorsement.
