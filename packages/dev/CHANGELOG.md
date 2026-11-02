# Changelog

## 0.2.4 (2026-11-02)
- Vendor the full `entry-validate` checker (dsh-plugin-spec@70d9007) for offline submits.
- `--boot` now probes `dsh --profile test --no-open --port 0` for a URL; no URL = blocked.
- C4 is engines-first; C3 is FLOW-only (`not-applicable`).

## 0.2.3
- C4 engines-first in the compat fallback.
- Auto-detect `dsh-plugin-spec`; C3 flow-only.

## 0.2.2
- `test` uses a temporary DSH_HOME: add → dump-config → remove.
- `submit` detects a standards checkout or runs a compat subset.

## 0.2.1
- Initial unified dispatcher.
