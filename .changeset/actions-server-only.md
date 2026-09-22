---
"@mj-biz-apps/accounting-actions": patch
---

Declare `@mj-biz-apps/accounting-actions` under `packages.server` in `mj-app.json` instead of
`packages.shared`.

The Open App engine imports every `shared` package into the Explorer client bundle. Every
action in this package extends `BaseAction` from `@memberjunction/actions`, and two of them run
engines from `@mj-biz-apps/accounting-core-entities-server`; both chains reach Node built-ins, so
`ng serve` failed on `node:*` imports after installing the app. The package is only used by
`@mj-biz-apps/accounting-server`, which still imports and registers it. Upgrading an existing
install prunes the stale client entry.
