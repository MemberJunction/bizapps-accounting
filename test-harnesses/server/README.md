# test-harnesses/server — Tier 2 (live DB)

Kept, maintained **server-side integration harness** for bizapps-accounting. These scripts
exercise the real server entity subclasses (the W*/lifecycle hooks) and engines against a
**real instance database**, through the real MJ data provider — the exact path MJAPI runs.

This is deliberately separate from the per-package **Vitest** suites (e.g.
`packages/CoreEntitiesServer/src/__tests__`), which are **isolated, no-DB, pure-logic**
unit tests per MJ convention. Hooks that only have meaning against a live DB (seeding,
DB-level numbering sprocs, triggers, RecordChange audit) are validated **here**.

## Running

Prerequisites, commands and exit codes are in
[the tier 2 section of `test-harnesses/README.md`](../README.md#tier-2-server-live-db). Every
test harness cleans up the rows it creates, so runs are idempotent.

## Scripts

Each harness asserts **real, correct results** (not just "no error") against a live DB, and the
DB-invariant cases each include a **raw-SQL bypass** that the trigger still rejects (so a guard can't
pass vacuously). Block numbering follows the master plan. Only block0 and block1 remain: block2 (the
old batch-line-item model), block4 (scheduled JEs, retired by D15), block5 (`ChartOfAccountsMapping`,
retired by D13) and block6 (the retired `vw_*` read-model views) were removed in the 2026-07-29
harness modernization (`../testing.md`), and the full batch cycle is now covered by
`phase2-encapsulation.live.test.ts`. **block3 is intentionally absent**: its intercompany balancing
engine was removed because accounting generates no intercompany legs and does no netting — the
emitter (Payments, in bizapps-orders) owns that (D18). The lookup accounting does own,
`IntercompanyAccountMatch` (BA-D26/27), is covered by `intercompany-runtime.ts`.

| Script | Validates |
|---|---|
| `block0-runtime.ts` | **Block-0 foundation hooks.** R1 the 12 seeded GL account roles, in order. W1 company profile create: the chart is EMPTY on create and `SeedDefaultChartOfAccounts()` seeds the 10 accounts; the retired default-GL-account refs stay unwired; `OperatingTimeZone` left blank (#158); RecordChange audit. W2 JE numbering `JE-{CompanyCode}-{FY}-{seq:000000}`, per company (BA-D31). W3 batch numbering `BATCH-{seq:000000}` (global sproc). |
| `block1-runtime.ts` | **JE and batch DB invariants**, each with a raw-SQL bypass case and an allowed counter-case: balanced-on-lock **50001**, single-company line **50019**, header company change **50022**, JE immutability **50003/50004**, line immutability on a locked JE **50006**, reversal typing **50012**, batch immutability **50009**, the cancel-audit and cancel-ERP-check constraints, batch status transitions **50030/50031**, the seal-mismatch flag **50034**, the cancel attestation **50032**, a frozen cancelled batch **50008**. Entity side: W6 `GenerateReversal` (new Reversal-typed JE, Dr/Cr swapped, back-referenced) and double-entry validation on save. |
| `engine-runtime.ts` | **The accounting ENGINE (AM-7 step 4).** The 'Accounting.CreateJournalEntry' op end-to-end in-process: E1 success (merge/order/number, dimension lands), E2 7 of the 10 typed error codes live (not `ENTRY_TYPE_UNKNOWN`, `ENTRY_TYPE_INACTIVE` or `INTERNAL_ERROR`), E3 the ATOMIC ROLLBACK proof (stale-cache FK failure mid-write → zero partial rows, raw-SQL verified; carries a guard for an MJ-core crash when a TransactionGroup fails, explained in the E3 comment), E4 `ResolveLinkedAccount` over real GLAccountLink windows + ordered dimensions, E5 Cash vs BankAccount links (BA-D34). |
| `intercompany-runtime.ts` | **The intercompany Due To / Due From pair (BA-D26/27).** I1–I7 the DB floor by raw SQL (orientation **50024/50025**, account type **50026**, dimension value **50027**, CHECKs); I8–I12 `IntercompanyAccountMatchEntityServer` (readable refusals, the ambiguous-tie rule, a superseding pair); I13–I17 `AccountingEngineBase.ResolveIntercompanyAccounts` against real rows (ordered pairs, the superseding window, DueTo dimensions). Runs from the repo root (see its header). |
| `phase2-encapsulation.live.test.ts` | **The phase-2 encapsulated model, as a Vitest suite** (`vitest.config.ts`: serial, one worker). L1–L5 encapsulated JE save/load/reversal, per-company numbering, the engine draft path; L6 the full batch cycle (build nets to a summary JE, approve → dispatch → batch Posted, members GLPosted); L7 batch lifecycle invariants; L8 the GLAccount identity lock; L9–L10 the set operation (N drafts in one all-or-nothing call); L11–L13 the one-transaction build with the real approval gate (no CFO configured → no batch row; the approval Task raised and stamped in the same transaction); L14 reversal guards; L16 the link tie guard; L17 approval coherence; L19 owned collections and entity `Cancel()`; L20–L22 send-once under concurrent and stale retries (#184); L23 dimension tags on locked lines (#216). |
| `pending-cancel-gate.live.test.ts` | **Cancelling a Pending batch through the real `TasksAppApprovalGate`** (#305). The CFO and the builder may cancel with a reason; another user and a missing reason are refused; the approval Task gets the comment and is closed as Cancelled. |
| `seed-demo.ts` | **Not a test** — runs the deterministic, idempotent Association **demo seeder** (`seedAssociationDemo` in `AssociationDemoSeedData.ts`) that the API + Playwright tiers run against, then checks the seeded rows read back (company profiles, the CO1 chart and JEs, balanced lines, dimensions, intercompany legs). Persists by design (no teardown). |

Shared helpers: `trigger-preflight.ts` (`assertInvariantTriggers` — fail-fast if any invariant trigger is missing/disabled, so bypass tests can't pass vacuously), `harness-exit.ts` (`finishAndExit` — non-blocking pool close + force-exit, because the MJ provider pool's `close()` can hang), `harness-dispatch-services.ts` (`RegisterHarnessDispatchServices` — registers an always-approve gate, the mock ERP poster and no ERP lookup above the real dispatch services; dev and test databases only), `live-bootstrap.ts` (bootstrap and teardown for the Vitest suite: app pool plus a db_owner teardown pool, the trigger preflight, a run-tagged company). `AssociationDemoSeedData.ts` is the demo seed module; it sits outside every package build so demo data never ships.

## Maintenance scripts (not tests)

One-off and diagnostic scripts. Run them like the `tsx` harnesses, from the instance worktree root;
they read the `.env` there. The ones marked *writes* change data.

| Script | What it does |
|---|---|
| `_maint-cache-candidate-counts.ts` | Read-only: row counts for the engine-cache candidate tables, to size caching decisions. Still queries `ChartOfAccountsMapping`, which no migration creates (D13). |
| `_maint-check-fieldvalues.ts` | Read-only: prints the value lists for batch `Status`, batch `TargetSystem` and GL account `AccountType`. |
| `_maint-clean-batches.ts` | *Writes*: demo cleanup — cancels stuck Pending batches that have no approval Task, sweeps the remaining Pending JEs to Posted (auto-approve gate, mock ERP), deletes empty Cancelled batches. Its cancel step now fails for those batches, because the engine refuses to cancel a Pending batch with no approval Task (#233); its header says to archive them instead. |
| `_maint-clean-orphan-company-parents.ts` | *Writes* with `--yes` (reports otherwise): deletes `__mj.Company` IS-A parents in the demo UUID block whose `AccountingCompanyProfile` child is gone after a drop-schema. |
| `_maint-clean-test-residue.ts` | *Writes*: removes the `IT-ORD*` companies the orders integration suite leaked, plus JEs, lines and batches whose company no longer exists (db_owner login). |
| `_maint-clean-test-residue2.ts` | *Writes*: second pass — removes the leftover `IT-ORD*` `__mj.Company` rows and every bizapps row pinning them, FK-driven, then re-enables the FKs `WITH CHECK` (db_owner login). |
| `_maint-erd-drift.ts` | Read-only: compares the tables and columns in `docs/bizapps-accounting-erd.md`'s Mermaid blocks with the live schema. |
| `_maint-list-batches.ts` | Read-only: lists every JE batch with its status, member JE count and whether it has an approval Task Link. |
| `_maint-make-pending.ts` | *Writes*: creates N balanced Pending JEs (default 2) on the first company with accounts 11201 and 40100, for a reject/regenerate demo. |
| `_maint-metadata-snapshot.ts` | Read-only: `snapshot <out.json>` or `diff <before.json> <after.json>` of the app's entity, field and relationship metadata, keyed by name rather than ID. |
| `_maint-post-stray.ts` | *Writes*: sweeps every Pending JE into one batch and runs it to Posted (auto-approve gate, mock ERP). |
| `_maint-unblock-dropschema.ts` | *Writes* with `--yes` (reports otherwise): deletes the bizapps-tasks Task Links (and their tasks) that point at accounting entities and block `mjdev app drop-schema`. |

## Note on permissions
No permission setup is needed. CodeGen creates the `__mj.EntityPermission` rows for all
`__mj_BizAppsAccounting` entities at provisioning, and the harness passes without any grant. An
earlier draft carried a defensive grant copied from the IS-A validation harness (a different instance
that genuinely lacked perms); it was a redundant no-op here and was removed.
