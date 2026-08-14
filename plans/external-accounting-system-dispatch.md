# ExternalAccountingSystem — metadata-driven ERP dispatch (execution plan)

**Status:** APPROVED for execution · planned 2026-08-14 (Marcelo + planning agent, orders-mj6-ws session)
**Executor:** a separate implementation session works this plan slice by slice; the planning session
supervises (reviews commits + stage-test evidence, reports to Marcelo).
**Branch:** continue on `feature/bc-export-spike` (cut from `chore/metadata-sync-writebacks`).
**Instance:** `orders-mj6-ws` (parent-workspace/pnpm, MJ 6.1.0-edge.2). Never `git push`; commit
early and often; per-commit messages carry what was validated. Do NOT weaken/skip a failing test.

## 1 · Goal

Journal Entry Batch dispatch must select its destination ERP from **metadata, not code**: a new
accounting-schema entity `ExternalAccountingSystem` maps the selected system to a driver class
(MJ's house DriverClass pattern — ~30 core entities do this, e.g. `Integration.ClassName` →
`ConnectorFactory`, `AIModel.DriverClass` → `AIEngine`). The Business Central path rides the
dev-linked `connector-business-central` open app (NO hand-rolled REST). Sandbox credentials do not
exist yet — everything must be provable without them (capture-mode tests); creds later = one
`CompanyIntegration` + Credential record, zero code changes.

## 2 · Locked decisions (do not relitigate; ask Marcelo to change any)

| # | Decision |
|---|----------|
| D1 | Entity name **`ExternalAccountingSystem`**, accounting schema (`__mj_BizAppsAccounting`). Single entity — NO capability link-entity for now. |
| D2 | Single **`DriverClass`** column; one adapter class per system; capabilities are methods on the base (`PostJournalEntryBatch` now, `VerifyPosted` now, `PullGLAccounts` later). Each adapter selects + drives its own integration entirely under the hood; where it needs transport below the connector's public CRUD surface, it EXTENDS the vendor connector via a private inner subclass (single inheritance: the adapter's top-level parent is our base — required for ClassFactory keying; the vendor-connector extension is its internal transport). Connector copies are never edited for this. |
| D3 | ClassFactory keys are the adapter class's OWN name (`@RegisterClass(BaseExternalAccountingSystemAdapter, 'BusinessCentralAccountingSystem')`) — never a domain enum. The catalog row holds the mapping. |
| D4 | `JournalEntryBatch.TargetSystem` (string + CK enum) becomes **`ExternalAccountingSystemID` FK**. Old column dropped. |
| D5 | Seed exactly two rows: `BusinessCentral` and `Mock`. |
| D6 | Missing row / missing DriverClass registration / missing CompanyIntegration ⇒ **loud fail** (batch Sent→Failed with the reason). Mock is a real selectable row (`MockAdapter`) — testing it is an explicit selection, never a fallback. |
| D7 | Catalog links to the Integration record by **`IntegrationName` string** (`'business-central'`; NULL for Mock) — not an ID FK across app-owned migrations. Resolve at runtime, loud error if absent. |
| D8 | Adapters live in **`packages/CoreEntitiesServer/src/external-accounting-systems/`** (precedent: `TasksAppApprovalGate` lives engine-adjacent). Package split per system is a later, mechanical refactor if needed. |
| D9 | Connector is a **required dependency**: `mj-app.json` `dependencies` gains `connector-business-central` AND the package dep is required (NOT an optional peer — codegen/migrations need it present before runtime). Static imports, no lazy guards. |
| D10x | Dispatch is **three-phase**: (1) small `Sent` marker write BEFORE the ERP call; (2) ONE OData `$batch` changeset carrying all journal lines (+ `Microsoft.NAV.post` bound action) — rely on BC's changeset atomicity, adapter maps statuses carefully; (3) ONE local transaction for ALL post-confirmation writes (batch→Posted + ref, every member JE→GLPosted). |
| D11 | Phase-3 transaction uses the **provider transaction** (`dbProvider.BeginTransaction()/Commit/Rollback`) — matching the engine's own D10 build-transaction convention (`JournalEntryBatchEngine.ts:251-270`), NOT TransactionGroup. (Marcelo said "batch save"; the engine-side equivalent with identical guarantees is the provider transaction; TransactionGroup is the client-side vehicle. Flagged + accepted in planning.) No per-entity save loops outside the transaction. |
| D12 | `VerifyPosted(documentNumber)` on the base contract — the Sent-limbo recovery probe (crash between phases 2 and 3). Expected to evolve. |

## 3 · Architecture (resolution chain)

```
JournalEntryBatch.ExternalAccountingSystemID   (FK, was TargetSystem string)
      ▼
__mj_BizAppsAccounting.ExternalAccountingSystem row     (Name, DriverClass, IntegrationName, IsActive)
      │ ClassFactory.CreateInstance<BaseExternalAccountingSystemAdapter>(base, row.DriverClass)
      ▼
BusinessCentralAdapter | MockAdapter            (CoreEntitiesServer/src/external-accounting-systems/)
      │ row.IntegrationName → __mj.Integration ('business-central', seeded by connector app)
      │ batch.CompanyID + IntegrationID → __mj.CompanyIntegration (Configuration JSON + Credential — creds plug in HERE later)
      ▼
BusinessCentralConnector (dev-linked app `connector-business-central`, loaded by MJAPI — verified)
```

## 4 · Slices (each has a verification gate; do not start N+1 before N's gate is green)

### S1 — Schema + metadata (one migration + codegen)

New migration `bizapps-accounting/migrations/V<real-UTC-timestamp>__v1.0.x__ExternalAccountingSystem.sql`:

1. `CREATE TABLE __mj_BizAppsAccounting.ExternalAccountingSystem`
   — `ID` uniqueidentifier PK default newsequentialid · `Name` NVARCHAR(50) NOT NULL UNIQUE ·
   `DisplayName` NVARCHAR(100) NOT NULL · `Description` NVARCHAR(MAX) NULL ·
   `DriverClass` NVARCHAR(255) NOT NULL · `IntegrationName` NVARCHAR(100) NULL ·
   `IsActive` BIT NOT NULL DEFAULT 1. Extended properties (MS_Description) on table + columns
   (match the style of the existing base migration).
2. Seed (hardcoded UUIDs, uuidgen-minted — house rule, see orders baseline: ALL seed UUIDs hardcoded):
   `BusinessCentral` (DriverClass `BusinessCentralAccountingSystem`, IntegrationName `business-central`) ·
   `Mock` (DriverClass `MockAccountingSystem`, IntegrationName NULL).
3. FK swap on `JournalEntryBatch`: add `ExternalAccountingSystemID` uniqueidentifier NULL + FK →
   data-migrate `UPDATE ... SET ExternalAccountingSystemID = (row matching TargetSystem Name)` →
   **THROW if any row remains unmapped** (only BC/Mock are seeded; a dev DB with e.g. 'Xero'
   batches must fail loudly, not guess) → `ALTER ... NOT NULL` → drop `CK_JournalEntryBatch_TargetSystem`
   → drop column `TargetSystem`.
4. Trigger edit: the batch immutability trigger (base migration ~line 1370-1392) compares
   `i.TargetSystem <> d.TargetSystem` in its frozen-fields set and names the mutable set in its
   50009 message — replace with `ExternalAccountingSystemID` compare (ISNULL-guid style like its
   neighbors), keep the message accurate.
5. Sweep for other references: `grep -rn "TargetSystem" migrations/ metadata/` — views, indexes,
   captured EntityField blocks. Every hit is either updated by this migration or regenerated by codegen.

Then the standard app loop on the instance (from `~/MJDev` root):
`./bin/mjdev app migrate orders-mj6-ws bizapps-accounting` → `./bin/mjdev app codegen orders-mj6-ws bizapps-accounting`
(AI enrichment runs if a key is configured — fine) → commit the generated code (new entity class,
updated batch entity, forms) — committed codegen tail is authoritative; from-zero regen re-mints
UUIDs, so capture what codegen emits via `./bin/mjdev app capture orders-mj6-ws bizapps-accounting`
into the migration (check `--check` first; see DEV-LOOPS.md).

**Gate S1:** `./bin/mjdev app stage-test orders-mj6-ws bizapps-accounting` green from zero
(schema + seeds + FK + trigger present; old column gone) · codegen convergence clean
(`--no-ai` second run = no diff) · unit suite still green · commit.

### S2 — The adapter folder

`packages/CoreEntitiesServer/src/external-accounting-systems/`:

- `BaseExternalAccountingSystemAdapter.ts` — abstract base. Contract:
  ```ts
  interface PostBatchContext { batch; summaryLines; system /* catalog row entity */; contextUser; provider }
  interface PostBatchResult { success: boolean; externalRef?: string; error?: string }
  abstract PostJournalEntryBatch(ctx: PostBatchContext): Promise<PostBatchResult>
  abstract VerifyPosted(documentNumber: string, ctx): Promise<'posted' | 'absent' | 'unknown'>
  ```
  Shared helper here: resolve Integration by `system.IntegrationName` + the company's
  CompanyIntegration (loud errors: none / more than one). Reuse the engine's existing
  `resolveExternalAccount` for account numbers (its `targetSystem` param becomes the system Name —
  `GLAccount.ExternalSystem` stays a string matched against Name for now; FK-ing it is a later slice).
- `MockAccountingSystem.ts` — `@RegisterClass(base, 'MockAccountingSystem')`; always succeeds,
  ref `MOCK-<batchNumber>` (replaces `mockErpPoster`).
- `BusinessCentralAccountingSystem.ts` — `@RegisterClass(base, 'BusinessCentralAccountingSystem')`; static
  import of the connector; private `BcTransport extends BusinessCentralConnector` inner class. Flow: resolve CompanyIntegration → `ConnectorFactory` instance → build ONE OData
  `$batch` changeset: one POST per summary line to
  `/companies({companyId})/journals({journalId})/journalLines`
  (accountType `G/L Account`, accountNumber, postingDate = batch.PostingDate, documentNumber =
  batch.JournalEntryBatchNumber, amount signed debit+/credit−, description) → on all-created:
  `Microsoft.NAV.post` bound action → `VerifyPosted` via `generalLedgerEntries?$filter=documentNumber eq '…'`
  (object exists in the connector's shipped metadata — verified) → map every response part to a
  clean `PostBatchResult`. Journal resolved by code from CompanyIntegration `Configuration.JournalCode`
  (default `GENERAL`). Status mapping is the critical craft here — no ambiguous success.

Transport access (ruled 2026-08-14, supersedes the earlier fork-edit idea): the connector copy is
NOT modified. The BC adapter declares a PRIVATE transport subclass in its own file —
`class BcTransport extends BusinessCentralConnector` — which is where the two BC-specific requests
live, using the connector's protected `MakeHTTPRequest` (its documented extension seam; token
freshness/retry/backoff inherited):
- `SubmitBatchChangeset(...)` — ONE OData `$batch` multipart request with a single changeset
  (all-or-nothing on BC's side). Parse the multipart response into per-operation results.
- `PostJournalAction(...)` — POST `<journal>/Microsoft.NAV.post` (204 = success).
Adding generic bound-action/$batch support to the base connector upstream is now an OPTIONAL
nice-to-have PR, not a prerequisite.

Dependency wiring (D9): accounting `mj-app.json` `dependencies` += `connector-business-central`;
accounting CoreEntitiesServer `package.json` gains the required dep. Re-run `mjdev app relink` /
`setup deps` as needed so the workspace resolves it.

**Gate S2:** `pnpm --filter` builds green (run filters FROM THE INSTANCE DIR, never inside `mj/`);
unit tests for the base's resolution helpers + Mock; commit(s).

### S3 — Wiring the engine + ops + UI

- `JournalEntryBatchEngine.ts`: remove the `ErpPoster` seam + `mockErpPoster` + the
  `JournalEntryBatchTargetSystem` string-union type. `buildJournalEntryBatch(...)` and friends take
  `externalAccountingSystemId` (FK) instead of the enum. `sendJournalEntryBatch` becomes the
  three-phase flow (D10x): Sent marker → adapter (resolved from the batch's catalog row via
  ClassFactory; unresolvable = fail loudly BEFORE Sent if possible, else Sent→Failed) → phase-3
  provider transaction wrapping markBatchPosted + ALL member-JE GLPosted flips (replaces today's
  save loop at `markJournalEntriesGLPosted`). Rollback ⇒ batch stays Sent; ErrorMessage records why.
- `JournalEntryBatchOperations.ts`: `Accounting.DispatchJournalEntryBatch` drops the hardcoded
  `poster: mockErpPoster` (line ~210); Build/Regenerate op inputs carry the system ID; probe op unchanged.
- Angular (6 files reference TargetSystem — generated batch form + `dispatch-status.page.ts`,
  `batch-detail-panel.component.{ts,html}`, `journal-entry-batch-workspace.page.{ts,html}`):
  selection becomes the FK dropdown (generated form handles the FK natively); custom pages read
  the related row's Name/DisplayName. No dispatch-client changes beyond the input type.

**Gate S3:** full app build + unit + integration suites green · `mjdev restart orders-mj6-ws api`
(restart, NOT `run` — run is a no-op on a live service) · e2e screenshot of the batch workspace
showing the dropdown fed by the table · dispatch a Mock-targeted batch end-to-end in the live
instance: batch Posted, `MOCK-…` ref, all JEs GLPosted · commit.

### S4 — Proof without credentials

- **Capture harness** (server tier, committed under `test-harnesses/server/` per house rules —
  never write-then-delete tests): a test subclass of `BusinessCentralConnector` overriding
  `MakeHTTPRequest` (the connector's own documented test seam) to record outbound requests and
  return canned BC responses. Fake CompanyIntegration + Credential fixture rows (own per-run data,
  torn down; never the shared demo companies). Drive the REAL dispatch path with a real batch:
  - assert the exact `$batch` URL/body: every summary line present, signed amounts, balanced,
    documentNumber = batch number, postingDate correct, account numbers via resolveExternalAccount
    (incl. an `ExternalAccountID` override case);
  - assert `NAV.post` invoked after creates; assert `Posted` + ref + JEs GLPosted (phase-3 committed);
  - failure paths: a line-create failure in the changeset ⇒ no NAV.post, Sent→Failed, JEs stay
    Batched, ErrorMessage carries BC's message; missing CompanyIntegration ⇒ loud fail; unknown
    DriverClass ⇒ loud fail; phase-3 forced save failure ⇒ transaction rolls back (batch stays
    Sent, NO partial GLPosted) — this is the regression guard for the old save-loop bug.
- Update the app's `testing.md` coverage matrix with what S4 covers and what it can't
  (real auth + BC acceptance = sandbox-gated, listed as the explicit remaining gap).

**Gate S4:** all new tests green + downstream re-run (unit + integration + build) green · commit.

## 5 · Research anchors (verified during planning — trust but re-check line numbers)

- Poster seam + mock + send flow + save loop to replace: `packages/CoreEntitiesServer/src/JournalEntryBatchEngine.ts`
  (~119 ErpPoster, ~125 mockErpPoster, ~770 sendJournalEntryBatch, markJournalEntriesGLPosted loop below it).
- D10 provider-transaction precedent: same file ~251-270 (`BeginTransaction`/`CommitTransaction`).
- Dispatch op hardcoding the mock: `packages/CoreEntitiesServer/src/JournalEntryBatchOperations.ts:203-210`.
- Account-number resolution: `resolveExternalAccount`, engine ~645 (`ExternalAccountID` when
  `ExternalSystem` matches; else `GLAccount.Code`).
- Batch immutability trigger: base migration `B202605281200__v1.0.x__Schema_and_Tables.sql` ~1370-1392 (THROW 50009).
- ClassFactory pattern reference: `mj/packages/Integration/engine/src/ConnectorFactory.ts`;
  connector registers as `@RegisterClass(BaseIntegrationConnector, 'BusinessCentralConnector')`.
- Connector: `repos/apps/connector-business-central` (worktree `instances/orders-mj6-ws/connector-business-central`,
  branch `mjdev/orders-mj6-ws/connector-business-central`; 4 local commits document every deviation from
  upstream `MemberJunction/Integrations@21967f1`). Config/credential resolution: `ResolveConfig`
  (CompanyIntegration.Configuration JSON + Credential record; APIKey column = Azure TENANT ID overload;
  ExternalSystemID = BC company GUID; Environment REQUIRED). Integration row `business-central` +
  83 IntegrationObjects seeded by its migration (verified in DB). MJAPI loads it (verified in log).
- Browse/PR clone of upstream: `random-projects/Integrations` (PRs for `SubmitBatchChangeset`/
  `InvokeBoundAction` + the 6.x pin updates originate there when Marcelo asks).

## 6 · Traps (each cost real time already — do not rediscover)

1. pnpm filters run from the INSTANCE dir; inside `mj/` they match nothing silently. Never
   `npm/pnpm install` inside a member — `mjdev setup <slug> deps` at root repairs drift.
2. `mjdev run` on a live service starts nothing (`action: already-running`) — use `mjdev restart`.
3. MJAPI caches API keys + config at boot — restart after re-mint/config changes.
4. Edge-tuple semver: `^6.1.0-edge.x` carets only; a plain `>=6.0.0 <7` range EXCLUDES prereleases.
5. The connector app branch is reused as-is (ADR-039): new commits to the extraction's `main` must
   be merged/ff'd into `mjdev/orders-mj6-ws/connector-business-central` (the instance worktree holds
   that branch — `git merge --ff-only main` inside the worktree works).
6. Migration edits after apply ⇒ checksum drift: fix via `mjdev app drop-schema` (destructive,
   dry-run first) + `app migrate`, or author a new migration — never edit-and-hope.
7. The codegen tripwire on this branch may show the known AI-validator-stripping diff — committed
   code is authoritative; restore, don't commit (TASKS.md 2026-08-11).
8. Honesty rules are absolute: report red as red; a partial check is labeled a half-test.

## 7 · Supervision protocol

- Executor commits at every gate with the validation evidence in the message; updates
  `instances/orders-mj6-ws/TASKS.md` per slice.
- Planning session reviews each gate's commit + stage-test output and reports to Marcelo at
  S1 and S4 gates minimum (or immediately on any gate failure / plan deviation).
- Plan deviations: minor mechanical adjustments are fine (note them in the commit); anything
  touching a D-numbered decision goes back to Marcelo first.

## 8 · Out of scope (explicitly deferred)

- `PullGLAccounts` capability (next chapter; the base-class method slot + catalog row are the
  prepared landing zone). `GLAccount.ExternalSystem` → FK conversion rides that slice.
- Sandbox credentials + live BC validation (blocked on Andrew; capture suite is the proof until then).
- Upstream PRs to MemberJunction/Integrations (pin ranges, tsconfig, optional generic $batch/bound-action
  support on the base connector, monorepo-subpath linking) — on Marcelo's word.
- Package-split of adapters; capability link-entity (AIModelVendor-style) if a system ever needs
  split classes.
