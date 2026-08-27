# @mj-biz-apps/accounting-entities

## 0.4.0

### Minor Changes

- 15c31a7: Dependency floors to the actual latest releases: bizapps-common >=5.36.0,
  bizapps-tasks >=1.4.0. Both shipped hours before 0.3.0 was cut and its floors
  were set from a stale audit (5.35.1 / 1.3.0). The 0.3.0 ranges admit them, so
  no installation is broken; this makes the declared floor match the policy —
  lower bound = latest of every app this one relies on.

## 0.3.0

### Minor Changes

- cb7aae2: Raise this release to a minor: it carries schema migrations.

  Two migrations have landed on `next` since `v0.2.0` and both arrived with no changeset of
  their own, so the release was resolving to a patch:

  - `V202608241445__v0.1.x__ApprovalTask_FK.sql` — adds the foreign key
    `FK_JournalEntryBatch_ApprovalTask` on
    `__mj_BizAppsAccounting.JournalEntryBatch.ApprovalTaskID` → `__mj_BizAppsTasks.Task.ID`.
    A new referential constraint: an existing row whose `ApprovalTaskID` does not resolve to a
    Task now fails to insert or update where it used to succeed.
  - `V202608252220__v0.1.x__CodeGen_Scoped_SQL_Objects.sql` — folds the scoped CodeGen emit for
    the accounting schema (hierarchy views/SPs, 16 hierarchy `EntityField` rows).

  A consumer upgrading on a patch would not expect a schema change to run, which is exactly what
  `ci/check-bump-level.sh` asserts on the release. Both packages move together under the
  `fixed` group, so this takes the whole release `0.2.0 -> 0.3.0`.

- 804f67e: Scope CodeGen heal EXECs with authored excludeSchemas plus `@IncludedSchemaNames` for the Accounting schema, instead of photographing sibling Open Apps. Drop maint-script queries that imported Orders.
- e2e867c: Own the Task form's "Journal Entry Batches this task approved" chrome (counterpart to bizapps-tasks#54, which removes it there — Tasks metadata must not name Accounting). The form-chrome record pins `inclusion: More` and `DisplayName: Journal Entry Batches`; `mj sync push` resolves it by natural key on every install.

### Patch Changes

- 6a247d6: Raise the platform floor to MJ 6.1.0-edge.4 and the app dependency floors to the
  versions actually exercised together: bizapps-common >=5.35.1, bizapps-tasks
  > =1.3.0. All @memberjunction/\* dependencies now pin ^6.1.0-edge.4 (caret, never
  > exact — an exact edge pin in a published package forces two MJ copies into a
  > consumer's tree and splits the ClassFactory registry).

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

## 0.1.1

### Patch Changes

- 7e00cbd: The last hand-rolled child collections become related-record collections. `JournalEntryLine.Dimensions` replaces `_dimensions` / `_deletedDimensions` plus their save and delete ordering, and is now available on BOTH tiers rather than server-only. `JournalEntryBatch.Members` replaces `_members`, a lazy cache with its own forceRefresh flag, and is declared `ReadOnly: true` / `OnRemove: 'refuse'` — the code already said "read-only by convention" in a comment, and a convention in a comment is enforced by whoever reads it. The GL accounts editor binds the `GLAccount` entity instead of an `AccountDraft` mirror of eleven columns filled by hand in two places and copied back by a third.
- 4ecb890: Rebuilds the baseline's generated half with CodeGen's AI advanced-generation enabled, so the shipped metadata carries semantic form layouts and sensible view defaults instead of bare structural ones. Every field gains a semantic Category (291/291), driving real grouped forms rather than one flat list; `DefaultInView` goes from 9 fields to 106 and search flags are set across the searchable text fields, so a newly-created User View is useful without hand-configuration; four entities that had no name field gain the right one (Journal Entries → `EntryNumber`, Journal Entry Batches → `JournalEntryBatchNumber`, plus Currency Spot Rates and Tax Rates); `Validate()` bodies are generated from CHECK constraints; and field DisplayNames read better (the mirrored parent `Name` on the accounting company profile is now "Company Name", which also stops it colliding with the currency picker's own "Name" column). Entity descriptions are deliberately left as the hand-authored 23/23 — `EntityDescriptions` stays off, since those were written and reviewed rather than generated. No entity or field IDs change: metadata IDs come from the baseline's own INSERTs, so a from-zero deploy reproduces them exactly, verified name-wise and order-independently at zero differences.

  Adds `V202608062100`, a migration that corrects two things the AI got wrong on `AccountingCompanyProfile` — the IS-A child of `__mj.Company` whose parent columns are mirrored as virtual fields and therefore sequenced last. `Name` and `Description` are both NOT NULL but were grouped into a section rendering fifth, so the create dialog hid two required fields; they now sit in the leading section. And `IsNameField` had been cleared on `Name` with nothing nominated, leaving the entity with no name field at all, so anything resolving its display value fell back to a raw UUID; that is restored. Both are pinned with MJ's `AutoUpdate*` opt-outs so a later enrichment run cannot revert them. The corrections live in a V migration rather than the baseline because the baseline's generated half is replaced wholesale on every regeneration — a V migration runs after it on every deploy and therefore survives. Filed upstream as MemberJunction/MJ#3551.

  Removes the Orders Product Catalog Playwright spec from this app's harness. It drove the Orders app from accounting's test suite because Orders had no harness of its own, which inverts the dependency — Orders depends on accounting, never the reverse.

- 7d8d115: Cross-app FK discipline, final piece (#22 item 1): JournalEntryBatch.ApprovalTaskID is now a REAL nullable FK to **mj_BizAppsTasks.Task — bizapps-tasks is a declared dependency that installs before this app, so the target always exists; the both-or-neither CHECK with ApprovalTaskRaisedAt is unchanged (D10 retryable task-raise semantics). rebuild-db.sh gains a bizapps-tasks step, applies bizapps-common via `mj migrate --schema **mj_BizAppsCommon`(its old sqlcmd loop mapped ${flyway:defaultSchema} to __mj AND swallowed SQL errors without`-b`, silently skipping common's V migrations — including the Person.DisplayName computed column that tasks' generated views join on), and defaults MJ core to v5.50.0. Baseline re-baked from zero (codegen tail regenerated; ApprovalTaskID's entity metadata now relates to MJ_BizApps_Tasks: Tasks).
- 87079db: Donor-line port onto the realigned baseline (2026-07-28 rulings). Data access moves to the four-surface doctrine: all three custom resolvers are deleted and the UI drives 7 typed Remote Operations (batch preview/build/build-from-view/cancel/regenerate, CreateJournalEntry, GenerateReversal) via RouteOperation. Batch build is ONE provider transaction — netting, summary JE, member locking, and the CFO approval-task raise (ApprovalTaskID stamped in-transaction; soft FK until CodeGen cross-app FKs land) commit or roll back together, with a pre-write assertCanRaise precondition and a never-persist-empty guard. JournalEntryBatch is a real encapsulated entity: transition-graph Validate, approval-coherence ValidateAsync (summary foots vs members at Pending→Approved), cached LoadMembers/LoadSummaryJournalEntry hydration, and a one-transaction Cancel() that returns member JEs to Pending. GLAccount identity (CompanyID/Code/AccountType/CurrencyCode) is locked unconditionally from creation; GLAccountLink gains a per-(record, role, company, window) tie guard and derives company through the account FK; ResolveLinkedAccount takes forCompanyID. Pipeline stage 5 rejects multi-company drafts with typed MULTI_COMPANY_DRAFT. TaxRemittance (remit-to-authority is an ERP concern) and JournalEntryLine.CounterpartyOrganizationID (handled at the orders biz-logic level) are REMOVED from the schema. Donor category-shell UI ported (transfer-pending workspace, shared components, RouteOperation clients). Test scaffolding no longer ships: CoreEntitiesServer excludes src/**tests** from its build (dist previously carried compiled test files) and pure engine-internal specs move to test-harnesses/.
- 84b0629: Journal Entry, GL Account, Dimension, Currency, and Tax Jurisdiction related grids use L1 inclusion so working forms stay on lines/children and posted-source hang-ons stay off the rail.
- 808f172: Keep Journal Entry forms on RelatedRolePolicy keep-all-primary (a working form, not a hub). Accounting grids hanging off People/Organizations stay Auto so the ranker can park them in More.
- e91285e: Recapture the codegen baseline from a from-zero database, restoring the guarded `__mj.Application`
  producer and its three `ApplicationRole` grants that the 2026-08-06 recapture silently dropped
  (taken from a lived-in DB where the Application row had survived a drop-schema cycle) — clean
  deploys no longer fail on `FK_ApplicationEntity_Application`. Also: V202608062100 trimmed to the
  form-layout override only (MJ#3651 landed, so the recapture bakes the correct name field); the
  `metadata/schema-info` record removed (three writers fought over one row, causing the recurring
  sync checksum misalignment); and the `Accounting` app is now visible to new users by default
  instead of only the codegen bucket app. Regenerated entity/server/Angular packages included.
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

- 6ab6f78: Migrate the workspace from npm to pnpm, mirroring bizapps-tasks' migration. No published
  package's code, types, metadata or migrations change — build tooling only, hence a patch.

  `packageManager` moves to `pnpm@10.33.0`, `package-lock.json` is replaced by
  `pnpm-lock.yaml`, and CI installs with `pnpm install --frozen-lockfile`. Two workspace
  settings are load-bearing and mirror MJ core: `linkWorkspacePackages: true` and the
  `onlyBuiltDependencies` allowlist. The npm `overrides` block moves to `pnpm.overrides`
  in package.json (matching bizapps-common) — pnpm reads neither npm's top-level field
  nor vice versa, so the pins live in the pnpm location and npm installs are unpinned.
  `mj:migrate` gains `--schema __mj_BizAppsAccounting
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

- dca6970: Schema realignment (issues #22 + #24, BA-D29/BA-D30): the closed JournalEntry.EntryType CHECK enum is replaced by the extensible JournalEntryType lookup (EntryTypeID FK; accounting seeds only its 8 IsSystem ledger-mechanics rows via metadata, consuming apps seed their own domain types; IsBatchSummary flag replaces the 'BatchSummary' magic string in triggers 50012/50023 and all batch queries; system rows are identity-locked at the entity layer). AccountingCompanyProfile.DefaultPaymentTermsTypeID is DROPPED — accounting never references its dependents, hard or soft (per-company default terms move to orders). The draft contract now carries the type CODE, validated against live reference data (ENTRY_TYPE_UNKNOWN / ENTRY_TYPE_INACTIVE). mj-app.json's mj-bizapps-common range is fixed to the published 5.x line (installer was hard-blocked). Baseline edited in place and re-proven from zero; ERD/ARCHITECTURE refreshed; stale plans/handoff-next-steps.md removed.
- 0458a71: Tax model rework (PR #28): CustomerTaxProfile is DROPPED — it asked "is this CUSTOMER exempt", a customer-shaped concern that now lives in bizapps-orders as CustomerTaxExemption (accounting is the general JE/ERP engine; customer attributes start at the orders layer). CompanyTaxNexus replaces it with the opposite, accounting-shaped question: where OUR legal entity must collect — NexusType (Economic/Physical/Marketplace/Voluntary), RegisteredFrom/RegisteredTo separate from ObligationEndsAt (the duty to collect routinely outlasts the registration activity), FK to \_\_mj.Company. TaxRate.Rate widens DECIMAL(7,4) → DECIMAL(9,6): four decimal places cannot store real US rates (San Mateo 9.375%, California's 0.125% district increments), and orders' OrderCharge.Rate was already DECIMAL(9,6) so orders could record a rate accounting could not hold. CK_TaxRate_Source is dropped so a new rate source (e.g. the Streamlined Sales Tax state files) is data, not a schema migration. Baseline edited in place per the pre-1.0 convention and re-proven from zero.
- 77b79d0: Initial BizApps Accounting build — AR subledger + journal-entry primitives (Blocks 0–6):GL accounts, AccountingCompanyProfile (IsA child of Company), accounting periods, balanced/immutableJEs, dimensions, tax, scheduled/recurring JEs, ChartOfAccountsMapping, and read-model views; batchingengine with the bizapps-tasks CFO approval gate. Clean-deploy hardening: IS-A Entity.ParentID is nowserialized into the migration (GAP-1), numbering-sproc EXECUTE grants added (GAP-2), and codegen scopedto the accounting schema (excludes bizapps-tasks/common). Validated end-to-end on a migrations-onlyclean deploy (full harness green).
