# test-harness

Kept, maintained **server-side integration harness** for bizapps-accounting. These tsx
scripts exercise the real server entity subclasses (the W*/lifecycle hooks) against a
**real instance database**, through the real MJ data provider — the exact path MJAPI runs.

This is deliberately separate from the per-package **Vitest** suites (e.g.
`packages/CoreEntitiesServer/src/__tests__`), which are **isolated, no-DB, pure-logic**
unit tests per MJ convention. Hooks that only have meaning against a live DB (seeding,
DB-level numbering sprocs, triggers, RecordChange audit) are validated **here**.

## Running

The scripts need a database built from migrations (MJ core, bizapps-common, bizapps-tasks, then this
repo) with each app's `metadata/` pushed, this repo's packages built (they import `dist/`), and an
`.env` with `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD` and the db_owner
`CODEGEN_DB_USERNAME` / `CODEGEN_DB_PASSWORD` that teardown uses.

The tsx scripts read `.env` from the **current working directory**. The Vitest specs read it from the
current working directory too, and fall back to the MJ Dev Manager instance root (`mj/.env`, five
directories above this folder).

**In an MJ Dev Manager instance** (`~/MJDev/instances/<slug>/mj`), everything they import is
installed:

```bash
cd ~/MJDev/instances/<slug>/mj
npx tsx packages/dev-apps/bizapps-accounting/test-harnesses/server/block0-runtime.ts
cd packages/dev-apps/bizapps-accounting
npx vitest run --config test-harnesses/server/vitest.config.ts
```

**In a plain clone**, the root `node_modules` holds only the repo's own tooling. The scripts also
import `mssql`, `dotenv`, `@memberjunction/sqlserver-dataprovider`,
`@memberjunction/server-bootstrap-lite`, `@mj-biz-apps/common-entities` and
`@mj-biz-apps/tasks-entities`, and run under `tsx`; none of these are root dependencies, so install
them into a scratch copy of the clone (not a branch you will push), then run from its root.

Exit code of the tsx scripts: `0` all passed · `1` test failures · `2` bootstrap error. Every script
cleans up the rows it creates (teardown by CompanyID), so runs are repeatable.

## Scripts

Each harness asserts **real, correct results** (not just "no error") against a live DB, and the
DB-invariant cases each include a **raw-SQL bypass** that the trigger still rejects (so a guard can't
pass vacuously).

| Script | Validates |
|---|---|
| `block0-runtime.ts` | **Block-0 foundation hooks.** GL account role reference data, explicit chart-of-accounts seeding on a new company profile, JE and batch numbering. |
| `block1-runtime.ts` | **JE lifecycle DB invariants**, each with a raw-SQL bypass case and an allowed counter-case: balanced-on-lock, single-company lines, JE and line immutability, reversal typing, batch status, cancel audit and the cancel ERP check. |
| `engine-runtime.ts` | **The accounting engine.** The `Accounting.CreateJournalEntry` operation end to end in-process (success path, typed error codes, atomic rollback) and `ResolveLinkedAccount` over real GLAccountLink rows. |
| `intercompany-runtime.ts` | **The intercompany Due To / Due From pair.** The DB floor through raw SQL, the entity refusals, and `ResolveIntercompanyAccounts` against real rows. |
| `phase2-encapsulation.live.test.ts` (Vitest) | **The encapsulated JournalEntry and the batch cycle.** One-save create, numbering, reversal, the draft path, build → approve → dispatch, lifecycle invariants, the real gate's CFO precondition and approval Task, concurrent retries and the send-once trigger. Cancels here go through a stub gate. |
| `pending-cancel-gate.live.test.ts` (Vitest) | **Cancelling a Pending batch through the real `TasksAppApprovalGate`** (#305). The CFO and the builder may cancel with a reason; another user and a missing reason are refused; the approval Task gets the comment and is closed as Cancelled. |
| `seed-demo.ts` | **Not a test.** The deterministic Association demo seeder the API and Playwright tiers run against. Persists by design (no teardown). |

Shared helpers: `live-bootstrap.ts` (Vitest fixtures and teardown), `trigger-preflight.ts`
(`assertInvariantTriggers`: fail fast if an invariant trigger is missing or disabled, so bypass tests
can't pass vacuously), `harness-dispatch-services.ts` (approve-everything gate and mock ERP for
sends) and `harness-exit.ts` (`finishAndExit`: non-blocking pool close + force-exit, because the MJ
provider pool's `close()` can hang). `AssociationDemoSeedData.ts` is the seeder's data.

The `_maint-*.ts` scripts are one-off maintenance tools for a dev database (residue sweeps, batch
listings, metadata snapshots), not tests. Read each one's header before running it.

## Note on permissions
No permission setup is needed. CodeGen creates the `__mj.EntityPermission` rows for all
`__mj_BizAppsAccounting` entities at provisioning — verified on this instance (all 28 entities
have their perm rows from the codegen run), and the harness passes without any grant. An earlier
draft carried a defensive grant copied from the IS-A validation harness (a different instance that
genuinely lacked perms); it was a redundant no-op here and was removed.
