# test-harness

Kept, maintained **server-side integration harness** for bizapps-accounting. These tsx
scripts exercise the real server entity subclasses (the W*/lifecycle hooks) against a
**real instance database**, through the real MJ data provider — the exact path MJAPI runs.

This is deliberately separate from the per-package **Vitest** suites (e.g.
`packages/CoreEntitiesServer/src/__tests__`), which are **isolated, no-DB, pure-logic**
unit tests per MJ convention. Hooks that only have meaning against a live DB (seeding,
DB-level numbering sprocs, triggers, RecordChange audit) are validated **here**.

## Running

The harness reads DB settings from `.env` in the **current working directory**, so run it
from the **instance worktree root** (where the instance's `.env` lives). In an MJ Dev
Manager instance that is `~/MJDev/instances/<slug>/mj`:

```bash
cd ~/MJDev/instances/<slug>/mj
npx tsx packages/dev-apps/bizapps-accounting/test-harnesses/server/block0-runtime.ts
```

Exit code: `0` all passed · `1` test failures · `2` bootstrap error. Every script cleans
up the rows it creates (teardown by CompanyID), so runs are idempotent.

## Scripts

| Script | Validates |
|---|---|
| `block0-runtime.ts` | Block 0 foundation hooks — W1 profile-init seeding (10-account COA, 17 periods, 5 GL refs, `OperatingTimeZone='UTC'`, RecordChange audit), W2 JE numbering, W3 batch numbering |

## Note on permissions
No permission setup is needed. CodeGen creates the `__mj.EntityPermission` rows for all
`__mj_BizAppsAccounting` entities at provisioning — verified on this instance (all 28 entities
have their perm rows from the codegen run), and the harness passes without any grant. An earlier
draft carried a defensive grant copied from the IS-A validation harness (a different instance that
genuinely lacked perms); it was a redundant no-op here and was removed.
