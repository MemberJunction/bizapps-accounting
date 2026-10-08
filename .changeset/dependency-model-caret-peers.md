---
"@mj-biz-apps/accounting-actions": patch
"@mj-biz-apps/accounting-core-entities-server": patch
"@mj-biz-apps/accounting-engine-base": patch
"@mj-biz-apps/accounting-entities": patch
"@mj-biz-apps/accounting-ng": patch
"@mj-biz-apps/accounting-server": patch
---

MemberJunction and other BizApps packages are peer dependencies with caret ranges (`^6.1.5`,
`^5.50.2` for common, `^1.4.1` for tasks; no `~`, nothing in `dependencies`), so a 6.2 host keeps
one copy of each instead of installing a second 6.1 tree. MemberJunction
devDependencies and the root `pnpm.overrides` use the same `^6.1.5` floor. Adds `check-dependency-model` to CI.
