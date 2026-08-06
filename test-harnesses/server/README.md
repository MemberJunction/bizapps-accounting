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

Each block harness asserts **real, correct results** (not just "no error") against a live DB, and the
DB-invariant cases each include a **raw-SQL bypass** that the trigger still rejects (so a guard can't
pass vacuously). Block numbering follows the master plan; **block3 is intentionally absent** (the
intercompany balancing engine was removed per Amith — Payments owns intercompany).

| Script | Validates |
|---|---|
| `block0-runtime.ts` | **Block-0 foundation hooks.** W1 profile-init seeding (10-account COA, 17 periods, 5 default GL refs, `OperatingTimeZone='UTC'`, RecordChange audit), W2 JE numbering (`JE-{Code}-{FY}-{seq}`), W3 batch numbering (`BATCH-{Code}-{seq}`). |
| `block1-runtime.ts` | **Block-1 JE lifecycle + invariants** (2026-07-06: periods retired; JEs are multi-company). W6 `generateReversal` (new Pending `Reversal`, Dr/Cr swapped, back-referenced), F1 `validateJournalEntry` (balanced overall + per company / GL-active). DB triggers w/ bypass proofs: balanced-on-lock **50001**, per-company balance **50019 (AM-4)**, JE immutability **50003/50004**, JE-line immutability **50006**. |
| `block2-runtime.ts` | **Block-2 batching engine + invariants** (2026-07-06, CH-4: batches are MULTI-COMPANY; `buildJournalEntryBatch` is GLOBAL — sweeps every Pending JE; lifecycle Pending→Approved→Sent→Posted). S1 `buildJournalEntryBatch` (netting keys on company×account×dims; companyCount reported), §5.5 GL resolution (mapping override beats inline; unmapped falls back to the account **Code** — AM-4, never hard-fails), B5 dimension-through-batch, `approveJournalEntryBatch` (audit stamps; only-Pending guard), `sendJournalEntryBatch` (requires Approved + CFO gate → mock ERP post → Posted, JEs→GLPosted; deny-gate refuses), real TasksAppApprovalGate (per-company CFO union — one Task, all CFOs; approve/reject; no-CFO hard-fail). Trigger bypass proofs: summary-foots **50014**, per-company foot **50023 (AM-4)**, batch immutability **50009/50008**. |
| `block4-runtime.ts` | **Block-4 scheduled-JE schedule (S3)** (2026-07-06, AM-6: the central materializer is RETIRED — domain entity servers generate the JE when a row comes due). `createScheduledEntries` (straight-line schedule + balanced line pairs, exact cent-remainder spread), the AM-6 domain-generation flow (entity-path flip to Generated w/ JE back-ref), and bypass proofs: Generated-coherence CK, SJE delete/field/line locks **50016/50017/50018**. |
| `block5-runtime.ts` | **Block-5 COA-mapping approval workflow.** propose → UNapproved mapping is invisible to §5.5 resolution; approve → it resolves (override beats inline); strict 1:1 (approving a second mapping for a local GL supersedes the prior, `EffectiveTo` closed); idempotent re-approve. INV: `CK_COAMapping_ApprovalCoherence` raw-SQL bypass (ApprovedBy without ApprovedAt → rejected). |
| `block6-runtime.ts` | **Block-6 read-model views (real values)** (2026-07-06: month-grain on EffectiveDate — periods gone). All 12 views: `vw_TrialBalance_AR` foots to zero, `vw_JEAuditTrail`, `vw_ARtoGLRecon` (month-grain status counts), `vw_DimensionPL`, `vw_BatchDispatchStatus` (Posted batch + CompanyCount + audit stamps), `vw_ScheduledJESummary`, `vw_FxExposure`, `vw_AROpenByCustomer`, `vw_ARAging`, `vw_DefRevRollforward` (PeriodMonth), `vw_SalesTaxLiability`, `vw_IntercompanyFlow`. |
| `engine-runtime.ts` | **The accounting ENGINE (AM-7 step 4).** The 'Accounting.CreateJournalEntry' op end-to-end in-process: success path (merge/order/number, dimension lands, global EntryNumber), all 7 typed error codes live, the ATOMIC ROLLBACK proof (stale-cache FK failure mid-write → zero partial rows, raw-SQL verified; carries the MJ-core TG-crash guard — see the instance BUGS.md), and `ResolveLinkedAccount` over real GLAccountLink windows + ordered dimensions. |
| `seed-demo.ts` | **Not a test** — the deterministic, idempotent Association **demo seeder** (`seedAssociationDemo`) that the API + Playwright tiers run against; verifies each Block-6 view populates. Persists by design (no teardown). |

Shared helpers: `trigger-preflight.ts` (`assertInvariantTriggers` — fail-fast if any invariant trigger is missing/disabled, so bypass tests can't pass vacuously) and `harness-exit.ts` (`finishAndExit` — non-blocking pool close + force-exit, because the MJ provider pool's `close()` can hang).

## Note on permissions
No permission setup is needed. CodeGen creates the `__mj.EntityPermission` rows for all
`__mj_BizAppsAccounting` entities at provisioning — verified on this instance (all 28 entities
have their perm rows from the codegen run), and the harness passes without any grant. An earlier
draft carried a defensive grant copied from the IS-A validation harness (a different instance that
genuinely lacked perms); it was a redundant no-op here and was removed.
