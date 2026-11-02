# dsh-plugin-* devtools family

## Why four names

| Package | Command | Question | Role |
|---|---|---|---|
| `dsh-plugin-start` | `dsh-start` | How do I begin? | scaffold a correct plugin skeleton |
| `dsh-plugin-ready` | `dsh-ready` | Is the static surface ready? | preflight static checks |
| `dsh-plugin-tools` | `dsh-tools` | Which tools do I have? | toolchain list/doctor/install guidance |
| `dsh-plugin-dev` | `dsh-dev` | What is the whole workflow? | thin dispatcher over the others |

`dsh-dev` is the advertised front door. The other three stay useful on their own
and are also subcommands of `dsh-dev`. No package duplicates another package's logic.

## Position under the three standards

| Tool | ENTRY | FLOW | BOOST |
|---|---|---|---|
| `dsh-plugin-start` | creates C1/C2/C6/C7 shape (public repo is still the author's job) | installable J1 skeleton | B1 dispose/effect skeleton |
| `dsh-plugin-ready` | C1–C8 static subset; C3 is **not-run**, never faked | J3/J7 static preflight | **not-measured** |
| `dsh-plugin-tools` | version/compatibility support | tool availability | benchmark tool discovery |
| `dsh-plugin-dev` | dispatches start/ready | dispatches test/upgrade | dispatches future bench |

C3 is FLOW-only in the current spec. `dsh-plugin-ready` does not fake it; use
`dsh-dev test` / test-drive for J1 and `entry-validate --host-evidence` when you
need FLOW evidence. A static pass is not a
host install, an audit, or a certification.

## Composition

```text
dsh-primer (learn/plan/scaffold knowledge)
      │
dsh-plugin-start ── creates ──> plugin skeleton
      │
dsh-plugin-ready ── static C1–C8 subset ──> ready-report.json
      │
dsh-test-drive ──── real install/smoke ───> host evidence
      │
entry-validate/label ── market-facing evidence
      │
dsh-plugin-upgrade ─ version migration

dsh-plugin-tools = optional toolchain manager (list/doctor/install guidance)
dsh-plugin-dev   = dispatcher: new | check | test | submit | upgrade | tools
```

`dsh-plugin-kit` is internal to PerryLink and is intentionally **not** part of
this family. `dsh-score` / `dsh-plugin-certification` are discovery/evidence
signals, not preflight gates.

## Command contract

```text
dsh-start new <name> [--dir <dir>] [--client] [--yes]
dsh-ready [<dir>] [--json] [--out <file>] [--strict]
dsh-tools list [--json]
dsh-tools doctor [--json]
dsh-tools install <tool> [--json]
dsh-tools update [--json]
dsh-dev new|check|test|submit|upgrade|tools [args]
```

Exit codes: `0` pass/pass-with-warnings; `2` fail; `3` not-run/blocked;
`1` usage/internal error. `dsh-ready` never returns `0` for a failed check.

## Non-goals

- No runtime plugin in this family; these are CLIs.
- No `dsh-plugin-kit` requirement.
- No score, grade, rank, certification, or official claim.
- No host install in `dsh-ready`; no security audit.
