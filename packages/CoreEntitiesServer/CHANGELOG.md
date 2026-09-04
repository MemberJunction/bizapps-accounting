# @mj-biz-apps/accounting-core-entities-server

## 0.6.1

### Patch Changes

- 553ee29: License declarations now agree on BUSL-1.1 everywhere.

  The README badge was the last thing in the repo still advertising ISC — `LICENSE`,
  `package.json`, `mj-app.json` and every workspace package already declare BUSL-1.1.
  A green ISC badge at the top of the README is the first thing a reader sees, so it
  outranked all of them in practice. The badge now reads BUSL-1.1 and links to `LICENSE`.

- b6d3dda: CreateJournalEntries joins a caller-owned provider transaction instead of wrapping a second one. Journal entry numbering failures throw with the SQL error instead of returning false with an unknown message.
- Updated dependencies [553ee29]
  - @mj-biz-apps/accounting-engine-base@0.6.1
  - @mj-biz-apps/accounting-entities@0.6.1

## 0.6.0

### Patch Changes

- Updated dependencies [434df96]
- Updated dependencies [71fc375]
  - @mj-biz-apps/accounting-entities@0.6.0
  - @mj-biz-apps/accounting-engine-base@0.6.0

## 0.5.0

### Minor Changes

- 9966206: Accounting engine extension registry (`AccountingEngineExtension`) — host-visible
  enable/disable, run order, optional company scope, and a JSON `Configuration` bag
  typed as `IAccountingEngineExtensionConfiguration`.

  Hook participation is not columns: `BaseAccountingEngineExtension` getters and
  Before/After overrides (later in this PR). Empty seed — consumers such as FP&A
  insert their own row. Schema change, so `minor`.

- 51012f5: AccountingERPEngine: Integration Engine pull for COA/dimensions, MJ CreateJournalEntry for batch post, BaseAccountingEngineExtension seam, Accounting.RunERPSync, daily job metadata, and Configuration > ERP sync UI (reusable widgets + Explorer page).
- fa6ae13: BA-D34: `GLAccountRole.Cardinality` (`One` | `Many`) and the `BankAccount` role.

  Separates "where does a receipt post?" (role `Cash`, One, unchanged) from "what
  is cash, for a position?" (role `BankAccount`, Many). Existing roles are
  backfilled to `One`, so payment routing and the BA-D32 tie guard are unaffected.
  Enables FP&A to build `CashBalance` as the sum of a company's Active
  `BankAccount` links. Schema change, so `minor`.

### Patch Changes

- Updated dependencies [9966206]
- Updated dependencies [51012f5]
- Updated dependencies [fa6ae13]
  - @mj-biz-apps/accounting-entities@0.5.0
  - @mj-biz-apps/accounting-engine-base@0.5.0

## 0.4.0

### Patch Changes

- Updated dependencies [15c31a7]
  - @mj-biz-apps/accounting-entities@0.4.0
  - @mj-biz-apps/accounting-engine-base@0.4.0

## 0.3.0

### Patch Changes

- 6a247d6: Raise the platform floor to MJ 6.1.0-edge.4 and the app dependency floors to the
  versions actually exercised together: bizapps-common >=5.35.1, bizapps-tasks
  > =1.3.0. All @memberjunction/\* dependencies now pin ^6.1.0-edge.4 (caret, never
  > exact — an exact edge pin in a published package forces two MJ copies into a
  > consumer's tree and splits the ClassFactory registry).
- Updated dependencies [cb7aae2]
- Updated dependencies [6a247d6]
- Updated dependencies [804f67e]
- Updated dependencies [e2e867c]
  - @mj-biz-apps/accounting-entities@0.3.0
  - @mj-biz-apps/accounting-engine-base@0.3.0

## 0.2.0

### Minor Changes

- fb2899b: Ship the release-time metadata migration, and realign the release plumbing that 0.1.1 exposed.

  **The metadata migration.** Everything under `metadata/` reached a host only by
  someone running `mj sync push` against it; nothing carried it into a database built
  from migrations alone. A clean deploy therefore came up with the schema but without
  the seeded currencies, journal entry types, GL account roles, the application
  record, the entity/field metadata, the entity actions, or the
  `RelatedRecordCollection` declarations that CodeGen reads to emit the typed `Lines`,
  `Dimensions` and `Members` accessors. This adds that state as a versioned migration,
  captured by pushing into a database built purely from migrations and keeping the
  emitted SQL.

  **Migration filenames realigned to the published version.** The two existing files
  said `v1.0.x` while every package, `mj-app.json`, and npm say `0.1.x`. That segment
  is Flyway/Skyway _description_ text — `ParseMigrationFilename` takes the version from
  the leading digits only, `ComputeChecksum` hashes file content and never the
  filename, and `validate()` compares version and checksum while using the description
  purely in message text — so the rename cannot re-run or invalidate anything on a
  database that already applied them. Renamed with `git mv` (zero content change), plus
  the three places that referenced the baseline by name: the ERD, the migrations doc,
  and `scripts/append-codegen.sh`, where it was the default argument.

  **`pnpm-lock.yaml` refreshed.** The 0.1.1 bump rewrote every internal
  `@mj-biz-apps/accounting-*` dependency to `0.1.1` without updating the lockfile, so
  `pnpm install --frozen-lockfile` failed on `next`, on PRs to `main`, and on every
  feature branch — `ERR_PNPM_OUTDATED_LOCKFILE`. The publish workflow's own
  `mergemain:update-lock` step exists to prevent exactly this; a hand-run bump skips it.

  **Three cross-schema form-chrome entries removed.** `metadata/entity-relationships/.form-chrome.json`
  configured `inclusion` for relationships whose related entity lives in **bizapps-orders** — Journal
  Entries → Order Lines and → Payment Headers, and Dimensions → Order Line Dimensions. Those
  relationship rows exist only because orders' tables carry the FKs, so CodeGen creates them when
  orders installs: on a database with accounting and no orders there are none, the `@lookup:` resolved
  nothing, and `mj sync push` aborted with a full transaction rollback. Accounting's metadata could not
  be applied on any host that installs it without orders — every standalone install. Removed here and
  re-homed in orders, which may legally reference accounting's entities (MemberJunction/bizapps-orders#92).
  No behaviour is lost: `inclusion` is layer 1 of the runtime chrome stack, not a CodeGen input.

### Patch Changes

- Updated dependencies [fb2899b]
  - @mj-biz-apps/accounting-entities@0.2.0
  - @mj-biz-apps/accounting-engine-base@0.2.0

## 0.1.1

### Patch Changes

- 7e00cbd: The last hand-rolled child collections become related-record collections. `JournalEntryLine.Dimensions` replaces `_dimensions` / `_deletedDimensions` plus their save and delete ordering, and is now available on BOTH tiers rather than server-only. `JournalEntryBatch.Members` replaces `_members`, a lazy cache with its own forceRefresh flag, and is declared `ReadOnly: true` / `OnRemove: 'refuse'` — the code already said "read-only by convention" in a comment, and a convention in a comment is enforced by whoever reads it. The GL accounts editor binds the `GLAccount` entity instead of an `AccountDraft` mirror of eleven columns filled by hand in two places and copied back by a third.
- 7d8d115: Cross-app FK discipline, final piece (#22 item 1): JournalEntryBatch.ApprovalTaskID is now a REAL nullable FK to **mj_BizAppsTasks.Task — bizapps-tasks is a declared dependency that installs before this app, so the target always exists; the both-or-neither CHECK with ApprovalTaskRaisedAt is unchanged (D10 retryable task-raise semantics). rebuild-db.sh gains a bizapps-tasks step, applies bizapps-common via `mj migrate --schema **mj_BizAppsCommon`(its old sqlcmd loop mapped ${flyway:defaultSchema} to __mj AND swallowed SQL errors without`-b`, silently skipping common's V migrations — including the Person.DisplayName computed column that tasks' generated views join on), and defaults MJ core to v5.50.0. Baseline re-baked from zero (codegen tail regenerated; ApprovalTaskID's entity metadata now relates to MJ_BizApps_Tasks: Tasks).
- 87079db: Donor-line port onto the realigned baseline (2026-07-28 rulings). Data access moves to the four-surface doctrine: all three custom resolvers are deleted and the UI drives 7 typed Remote Operations (batch preview/build/build-from-view/cancel/regenerate, CreateJournalEntry, GenerateReversal) via RouteOperation. Batch build is ONE provider transaction — netting, summary JE, member locking, and the CFO approval-task raise (ApprovalTaskID stamped in-transaction; soft FK until CodeGen cross-app FKs land) commit or roll back together, with a pre-write assertCanRaise precondition and a never-persist-empty guard. JournalEntryBatch is a real encapsulated entity: transition-graph Validate, approval-coherence ValidateAsync (summary foots vs members at Pending→Approved), cached LoadMembers/LoadSummaryJournalEntry hydration, and a one-transaction Cancel() that returns member JEs to Pending. GLAccount identity (CompanyID/Code/AccountType/CurrencyCode) is locked unconditionally from creation; GLAccountLink gains a per-(record, role, company, window) tie guard and derives company through the account FK; ResolveLinkedAccount takes forCompanyID. Pipeline stage 5 rejects multi-company drafts with typed MULTI_COMPANY_DRAFT. TaxRemittance (remit-to-authority is an ERP concern) and JournalEntryLine.CounterpartyOrganizationID (handled at the orders biz-logic level) are REMOVED from the schema. Donor category-shell UI ported (transfer-pending workspace, shared components, RouteOperation clients). Test scaffolding no longer ships: CoreEntitiesServer excludes src/**tests** from its build (dist previously carried compiled test files) and pure engine-internal specs move to test-harnesses/.
- 22c66cf: New companies start with an EMPTY chart of accounts: the W1 auto-seed on AccountingCompanyProfile
  first-save is retired (auto-seeding collided with the immediate GL-account identity lock, forcing
  ten locked-identity accounts on every company). The starter chart remains available as the explicit,
  idempotent, audited `AccountingCompanyProfileEntityServer.SeedDefaultChartOfAccounts()`. UI line:
  All-journal-entries gains a "New journal entry" verb routed to the JE workspace; batch drill-downs
  no longer double-count by including the batch's own summary JE; company/account pickers dedupe by
  normalized UUID and self-heal stale caches (reactive scope roster, one-shot workspace re-check);
  GL editor shows human save errors instead of raw SQL; COA editor currency is a searchable
  code-or-name combobox; nav-rail hover-peek is off by default, the collapse toggle highlights only
  its own chip, and count badges no longer shift layout (row-edge pill expanded / icon-corner
  count collapsed).
- 6435f26: Author the first Entity Action bindings as metadata: `JournalEntryBatch · AfterUpdate` and
  `JournalEntry · AfterCreate`, in a new `metadata/entity-actions/`. Both ship `Pending` rather than
  `Active` — MJ dispatches only `Active` bindings, so they are inert until an administrator sets a
  recipient and a company scope. Two of the four bindings the adoption plan proposed were dropped:
  they bind `AccountingPeriod`, which this repo removed on 2026-07-06 when the ERP took ownership of
  periods. No transition `ActionFilter` is authored either — MJ #3408 did not seed the reusable
  "field changed to value" filters the plan assumed, and the generated-filter runtime that replaced
  them is not in the installed `actions-base@6.1.0-edge.1`, so `AfterUpdate` would still fire on every
  save. Shape tests cover the rules that are checkable without a database: nothing `Active`, no
  `Before*`/`Validate` invocation (they would run inside the same transaction as the deferrable
  balanced-JE and batch-lock constraint triggers), scope columns set together or not at all, and every
  `Script` param actually compiling.
- 1cdcf7c: Fix (PR #29): a perfectly balanced journal entry could be rejected as unbalanced. Rule 2 in JournalEntryEntityServer.Validate compared accumulated float sums with strict inequality, so a four-line entry whose credits sum to 302.59000000000003 in IEEE-754 failed while the error printed both sides as the same number. Balance is now compared at penny precision (half-penny tolerance against DECIMAL(18,2) storage — no real imbalance can hide inside it); a one-penny imbalance is still rejected.
- b014af6: The JE workspace composes a real `JournalEntryEntity` with its `Lines` collection instead of a hand-maintained `JEDraftState`/`JEDraftLine` mirror, so the screen and the ledger run the same `Validate()`. New shared `JournalEntryLineEntity` carries the per-line rules that need nothing but the line — an account, exactly one side, neither side negative — which were server-only and restated by hand in the editor. `JournalEntryEntityServer.Validate()` loses the three rules it duplicated from the shared subclass (every unbalanced entry was reporting itself twice) and gains the one that is genuinely its own: a blank line reaching a save is named by number rather than failing at a NOT NULL constraint. The double-entry line count now counts lines somebody actually typed in, so an untouched two-row draft can no longer satisfy it.
- 04ae8cf: Refactor (Amith ruling 2026-08-04): every bare `Batch`-prefixed identifier referring to the JournalEntryBatch entity is renamed to carry the full entity name. Columns: `JournalEntry.BatchID → JournalEntryBatchID`, `JournalEntryBatch.BatchNumber → JournalEntryBatchNumber`, `JournalEntryBatch.ExternalBatchRef → ExternalJournalEntryBatchRef`, `JournalEntryType.IsBatchSummary → IsJournalEntryBatchSummary`. Named off them: `spAssignNextBatchNumber → spAssignNextJournalEntryBatchNumber`, triggers `trg_JEBatch_* → trg_JournalEntryBatch_*`, constraints/indexes `FK_JE_Batch → FK_JE_JournalEntryBatch`, `FK_JEBatch_* → FK_JournalEntryBatch_*`, `CK_JournalEntry_BatchedHasBatch → …HasJournalEntryBatch`, `UX_JournalEntryType_BatchSummary → …_JournalEntryBatchSummary` — plus the full generated + hand-written code, harness, metadata, and ERD surface. Deliberately unchanged: the verb-form lifecycle columns `BatchedAt`/`BatchedByUserID`, the `Status` value `'Batched'` (they name the action, not the entity), the `BATCH-…` number format string, and user-facing DisplayNames ("Batch ID", "Batch Number" stay compact). Applied by editing the consolidated baseline in place (pre-prod, house convention) — clean deploys re-create the schema under the new names; existing instances re-apply via drop-schema + migrate.

  Round 2 (Marcelo rulings 2026-08-05): **DisplayNames** now carry the full name too ("Journal Entry Batch ID", "Journal Entry Batch Number", "External Journal Entry Batch Ref", "Is Journal Entry Batch Summary") — updated in the baseline seed and reflected in generated code. **Files/classes align:** `BatchingEngine.ts → JournalEntryBatchEngine.ts`, `BatchOperations.ts → JournalEntryBatchOperations.ts` (+ test file), and every exported bare-`Batch` identifier renamed (`BuildBatchOperation → BuildJournalEntryBatchOperation`, `BatchApprovalGate → JournalEntryBatchApprovalGate`, `BatchTargetSystem → JournalEntryBatchTargetSystem`, all Input/Output/Result/Options types, error classes, `LoadJournalEntryBatchOperations`). The remotable-op WIRE KEYS (`Accounting.BuildBatch` etc.) are deliberately unchanged pending an explicit ruling — they are a cross-app contract (bizapps-orders drives them). Angular FILE renames (`BatchDispatch/`, `batch-workspace.page.*`) deferred to the UI line to avoid rename-vs-delete conflicts with in-flight PRs #43/#44.

  Round 3 (Marcelo rulings 2026-08-05): **remotable-op wire keys renamed** — `Accounting.{Preview,Build,Regenerate,Dispatch}Batch → …JournalEntryBatch`, `Accounting.RecordBatchDecision → …RecordJournalEntryBatchDecision`, `Accounting.GetBatchApprovalState → …GetJournalEntryBatchApprovalState` — safe because bizapps-orders' current tip has ZERO references (verified; heads-up filed as bizapps-orders#37). **Angular files/classes renamed too:** `BatchDispatch/ → JournalEntryBatchDispatch/`, `BatchStatus/ → JournalEntryBatchStatus/`, `batch-workspace.page/client → journal-entry-batch-workspace.*`, `batches-dashboard.page → journal-entry-batches-dashboard.page` (+ the gui dom spec), with all 9 component/client/module classes, wire types, and tree-shake loaders carrying the full prefix. Kept: component selectors and `@RegisterClass` resource keys (metadata-bound), and `batches-category.*` (named for the visible "Batches" nav category, not the entity).

- d098f63: Move journal entry lines onto an MJ 6.1 related-record collection.

  `Lines` is declared as `EntityRelationship.RelatedRecordCollection` metadata, so CodeGen emits a
  typed accessor onto the generated entity class and both tiers have it. That replaces `_lines`,
  `_deletedLines`, and the hand-written save sequence on `JournalEntryEntityServer`.

  Adds `JournalEntryEntity`, a shared client+server subclass carrying the double-entry invariants —
  at least two lines, and debits equal to credits at penny precision — so the browser refuses an
  unbalanced entry before a round trip rather than after one.

  Also fixes two defects that made the baseline uninstallable on a fresh database: the `Application`
  row its generated half references was never created, and `V202608062100` threw when CodeGen metadata
  was absent, which made `scripts/rebuild-db.sh` impossible to complete.

- 06eed73: Promote the pure JE rollup to `NetLines` on accounting-engine-base (browser + server) and emit groups in journal order: per company, every debit, then every credit.
- 19e6ebe: Ask bizapps-tasks what a decision outcome means instead of keeping four copies of the answer.

  The approve/reject knowledge was spelled out in four places here: `JournalEntryBatchDecisionOutcome`
  (an independently-declared union), `VALID_DECISIONS` (a `Set` of the same literals),
  `APPROVED_OUTCOME_CODES` (the approving subset), and an inline
  `=== 'Approved' || === 'ApprovedWithConditions'`. All four typechecked cleanly against a widened
  `TaskDecisionOutcomeCode`, so an outcome added in bizapps-tasks would have been rejected as invalid
  by the operation and classified as not-approved by the gate — with no error anywhere.

  All four now derive from tasks-core's outcome table via `IsTaskDecisionOutcomeCode` and
  `IsApprovalOutcome`. `JournalEntryBatchDecisionOutcome` is kept as an alias so the operation's public
  input type is unchanged. The blind `input.Decision as TaskDecisionOutcomeCode` cast is gone — the
  guard narrows it.

  No behaviour change for the three outcomes that exist today; verified by rebuilding the chain and
  re-running the accounting and orders suites.

- dca6970: Schema realignment (issues #22 + #24, BA-D29/BA-D30): the closed JournalEntry.EntryType CHECK enum is replaced by the extensible JournalEntryType lookup (EntryTypeID FK; accounting seeds only its 8 IsSystem ledger-mechanics rows via metadata, consuming apps seed their own domain types; IsBatchSummary flag replaces the 'BatchSummary' magic string in triggers 50012/50023 and all batch queries; system rows are identity-locked at the entity layer). AccountingCompanyProfile.DefaultPaymentTermsTypeID is DROPPED — accounting never references its dependents, hard or soft (per-company default terms move to orders). The draft contract now carries the type CODE, validated against live reference data (ENTRY_TYPE_UNKNOWN / ENTRY_TYPE_INACTIVE). mj-app.json's mj-bizapps-common range is fixed to the published 5.x line (installer was hard-blocked). Baseline edited in place and re-proven from zero; ERD/ARCHITECTURE refreshed; stale plans/handoff-next-steps.md removed.
- 0458a71: Tax model rework (PR #28): CustomerTaxProfile is DROPPED — it asked "is this CUSTOMER exempt", a customer-shaped concern that now lives in bizapps-orders as CustomerTaxExemption (accounting is the general JE/ERP engine; customer attributes start at the orders layer). CompanyTaxNexus replaces it with the opposite, accounting-shaped question: where OUR legal entity must collect — NexusType (Economic/Physical/Marketplace/Voluntary), RegisteredFrom/RegisteredTo separate from ObligationEndsAt (the duty to collect routinely outlasts the registration activity), FK to \_\_mj.Company. TaxRate.Rate widens DECIMAL(7,4) → DECIMAL(9,6): four decimal places cannot store real US rates (San Mateo 9.375%, California's 0.125% district increments), and orders' OrderCharge.Rate was already DECIMAL(9,6) so orders could record a rate accounting could not hold. CK_TaxRate_Source is dropped so a new rate source (e.g. the Streamlined Sales Tax state files) is data, not a schema migration. Baseline edited in place per the pre-1.0 convention and re-proven from zero.
- 77b79d0: Initial BizApps Accounting build — AR subledger + journal-entry primitives (Blocks 0–6):GL accounts, AccountingCompanyProfile (IsA child of Company), accounting periods, balanced/immutableJEs, dimensions, tax, scheduled/recurring JEs, ChartOfAccountsMapping, and read-model views; batchingengine with the bizapps-tasks CFO approval gate. Clean-deploy hardening: IS-A Entity.ParentID is nowserialized into the migration (GAP-1), numbering-sproc EXECUTE grants added (GAP-2), and codegen scopedto the accounting schema (excludes bizapps-tasks/common). Validated end-to-end on a migrations-onlyclean deploy (full harness green).
- Updated dependencies [7e00cbd]
- Updated dependencies [4ecb890]
- Updated dependencies [7d8d115]
- Updated dependencies [87079db]
- Updated dependencies [84b0629]
- Updated dependencies [808f172]
- Updated dependencies [e91285e]
- Updated dependencies [b014af6]
- Updated dependencies [04ae8cf]
- Updated dependencies [d098f63]
- Updated dependencies [06eed73]
- Updated dependencies [6ab6f78]
- Updated dependencies [dca6970]
- Updated dependencies [0458a71]
- Updated dependencies [77b79d0]
  - @mj-biz-apps/accounting-entities@0.1.1
  - @mj-biz-apps/accounting-engine-base@0.1.1
