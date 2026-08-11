---
"@mj-biz-apps/accounting-entities": patch
---

Migrate the workspace from npm to pnpm, mirroring bizapps-tasks' migration. No published
package's code, types, metadata or migrations change — build tooling only, hence a patch.

`packageManager` moves to `pnpm@10.33.0`, `package-lock.json` is replaced by
`pnpm-lock.yaml`, and CI installs with `pnpm install --frozen-lockfile`. Two workspace
settings are load-bearing and mirror MJ core: `linkWorkspacePackages: true` and the
`onlyBuiltDependencies` allowlist. The npm `overrides` block moves to pnpm-workspace.yaml
`overrides` (pnpm ignores npm's). `mj:migrate` gains `--schema __mj_BizAppsAccounting
--dir ./migrations` — bare `mj migrate` silently applied nothing (same fix as tasks).

Also declares `@mj-biz-apps/accounting-core-entities-server` in mj-app.json's server
packages: it carries @RegisterClass classes the host must load; npm hoisting resolved the
generated manifest import by accident, pnpm does not.

Honest validation status: `pnpm install` is green where npm ci on next is red (ERESOLVE on
stale @memberjunction/actions@5.50.0 pins), and 4 of 5 packages build;
accounting-core-entities-server still fails on the @mj-biz-apps/tasks-core decision-outcomes
API, which is not yet published or on tasks `next` (pre-existing breakage, tracked
separately). Verified green as a workspace member against MJ next once that tasks commit is
present.
