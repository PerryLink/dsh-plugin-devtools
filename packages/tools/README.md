# dsh-plugin-tools

List, diagnose, and get install commands for the DeepSeek Harness plugin
developer tools.

```sh
npx dsh-plugin-tools list
npx dsh-plugin-tools doctor
npx dsh-plugin-tools install dsh-plugin-ready
npx dsh-plugin-tools update
```

`dsh-tools` **does not install or update anything by itself**; it prints the
exact `npm install -g` command. There is no `dsh-plugin-kit` requirement.

## What it knows

`dsh-plugin-start`, `dsh-plugin-ready`, `dsh-plugin-dev`, `dsh-plugin-tools`,
`dsh-primer`, `dsh-clinic`, `dsh-test-drive`, `dsh-plugin-upgrade`, and the
standards repository.

## Non-goals

No package audit, no host install, no security audit, no score/ranking.
