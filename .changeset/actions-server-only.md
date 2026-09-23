---
"@mj-biz-apps/accounting-actions": patch
---

Declare `@mj-biz-apps/accounting-actions` under `packages.server` in `mj-app.json` instead of
`packages.shared`.

The Open App engine imports every `shared` package into the Explorer client bundle. Every
action in this package extends `BaseAction` from `@memberjunction/actions`, and two of them run
engines from `@mj-biz-apps/accounting-core-entities-server`; both chains reach Node built-ins, so
`ng serve` failed on `node:*` imports after installing the app. The package is only used by
`@mj-biz-apps/accounting-server`, which still imports and registers it. Its manifest role is now
`actions`.

Upgrading an existing install removes the package's `dynamicPackages.client` entry, which is what
put it in the browser bundle. It does not remove the npm dependency from the client workspace
(`MJExplorer/package.json`): upgrade only adds dependencies, and only `mj app remove` removes them.
The dependency is no longer imported, but `pnpm install` still resolves `mssql` and builds
`isolated-vm` for it; remove it by hand if the client workspace must install without native build
tools.
