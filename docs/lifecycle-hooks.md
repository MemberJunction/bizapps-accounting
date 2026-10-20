# BizApps Accounting — Lifecycle Hooks (W1–W9) + the Engine

> **What this is:** the per-entity **`BaseEntity.Save()` lifecycle hooks** — the server-side logic that runs
> when an accounting record is created/changed. They live in `packages/CoreEntitiesServer/` and route every
> mutation through `BaseEntity` so `__mj.RecordChange` audits it (P1: *audit by construction*).
> **Updated 2026-07-06** for the engine-meeting rulings (AM-1..7): **AccountingPeriod is GONE** (the ERP owns
> periods — CH-1), the SJE **materializer is retired** (AM-6), and the **accounting engine** (`AccountingEngine` +
> `Accounting.CreateJournalEntry`) is the front door for external callers. Those rulings also made JEs/batches
> multi-company (CH-2/CH-4) with global numbering (D-SEQ); the 2026-07-22 baseline rewrite reversed that: JEs
> and batches are **single-company** (D3, D7), JE numbers are **per company, per fiscal year** (D19, BA-D31),
> and batch numbers stay **global**.

**Division of labor (P2):** *DB triggers* enforce un-bypassable invariants (balance, every line in the
JE's company — D3, immutability); *hooks* orchestrate (seed, number, reverse, validate). A hook makes the
friendly thing happen; the trigger is the floor that catches anything — even raw SQL.

**How a hook "fires" — two kinds:**
- **Auto (in `Save()`):** the hook is an override of the entity's `Save()`. It runs **every time that entity
  is saved**, then a guard condition decides whether it acts.
- **Explicit call:** not wired into `Save()` — it runs only when code **calls the method by name** (W6, and
  W1's `SeedDefaultChartOfAccounts()`).

**Status legend:** ✅ built + tested · 🚫 retired.

| # | Hook | Entity | What causes it to fire | How | Status |
|---|---|---|---|---|---|
| **W1** | Profile init (TZ default removed, #158; COA seed = explicit only, 2026-07-30) | `AccountingCompanyProfile` | a saved profile's **`EntityType`** changes, or **`BooksClosedThroughDate`** changes | check auto · `ValidateAsync()`; seed via explicit `SeedDefaultChartOfAccounts()` | ✅ |
| **W2** | JE numbering (per company, per FY) | `JournalEntry` | a **new** JE is saved with **no `EntryNumber`** | auto · `Save()` | ✅ |
| **W3** | Batch numbering (GLOBAL) | `JournalEntryBatch` | a **new** batch is saved with **no `JournalEntryBatchNumber`** | auto · `Save()` | ✅ |
| **W4** | Adjusting-entry routing | — | — | — | 🚫 retired 2026-07-06 (periods removed, CH-1) |
| **W5** | Realized FX auto-emit | — | — | — | 🚫 retired (Payments-side, §C1) |
| **W6** | Reversal generation | `JournalEntry` | code **calls `GenerateReversal(reason)`** | explicit call | ✅ |
| **W7** | Period-close orchestration | — | — | — | 🚫 retired 2026-07-06 (periods removed, CH-1) |
| **W8** | Period reopen | — | — | — | 🚫 retired 2026-07-06 (periods removed, CH-1) |
| **W9** | Attachment validation | `JournalEntry` | a JE is saved with a non-null **`FileID`** | auto · `Save()` | ✅ |
| **F1** | Routine JE validator | — | — | — | 🚫 retired 2026-07-24 (its rules run on every save — see F1 below) |

---

## 1. The hooks in detail

### W1 — Profile init *(✅ `AccountingCompanyProfileEntityServer.ts` — auto-seed RETIRED 2026-07-30)*
**Fires:** nothing on a new profile's first save. The **`OperatingTimeZone = 'UTC'`** default was
removed (#158): the field is an optional per-company display override, and blank inherits
`BizApps.BusinessTimeZone`. **The COA auto-seed no longer fires on create** (ruling 2026-07-30): a new company starts with an **EMPTY chart** — auto-seeding collided with the
**L8 immediate identity lock**, forcing ten locked-identity accounts on every company.
**Explicit capability instead:** `SeedDefaultChartOfAccounts()` (public, idempotent — existing codes
skipped, every row via `BaseEntity.Save()` so it stays audit-by-construction) seeds the 10-account
AR-subledger set (AD-8 + §C1) **when deliberately invoked** — fixtures, demo seeds, or a future
"seed standard chart" UI affordance.
**Validates (bc-aidp-next-golive#313):** changing `EntityType` to Division, Department or Branch is
refused while the company owns an active GL account. Those types keep no books: their entries resolve
their legal entity's accounts (`AccountingEngineBase.LegalEntityFor`). `GLAccountEntityServer`
refuses the same state from the account side: creating or reactivating an active account on such a
company.
**Validates (bc-aidp-next-golive#316):** setting, moving or clearing `BooksClosedThroughDate` is
refused unless the saving user holds `MJ.BizApps.Accounting.BooksClosedThroughDate.Set` (the Finance
role). An authorization missing from the catalog is held by nobody. Other edits are not checked.
- *(The profile's 5 default GL-account refs were RETIRED 2026-07-23 — role/link model replaces them.)*
- *(Period generation was REMOVED 2026-07-06 — no `AccountingPeriod` rows exist to create.)*

### W2 — JE numbering *(✅ `JournalEntryEntityServer.ts` + `SequenceService.ts`)*
**Fires:** on a brand-new JournalEntry with no number.
**Does:** calls the atomic sproc `spAssignNextJournalEntryNumber(@CompanyID, @FiscalYear)` (HOLDLOCK/UPDLOCK — gap-free
under concurrency) and sets **`EntryNumber = JE-{CompanyCode}-{FY}-{seq:000000}`** before `super.Save()`. On PostgreSQL it
calls the function of the same name (row-locked `INSERT … ON CONFLICT DO UPDATE`, same format, same gap-free rule);
`SequenceService` picks the SQL by the provider's `PlatformKey`. FY is the
fiscal year `EffectiveDate` falls in, from the company's fiscal-year start on its profile (`FiscalYearOf`).
**The sequence is per company, per fiscal year** (D19, BA-D31; the 2026-07-06 global sequence, D-SEQ, is retired
for JEs).

### W3 — Batch numbering *(✅ `JournalEntryBatchEntityServer.ts` + `SequenceService.ts`)*
**Fires:** on a brand-new batch with no number.
**Does:** `spAssignNextJournalEntryBatchNumber()` → **`JournalEntryBatchNumber = BATCH-{seq:000000}`** — a single **GLOBAL** counter
(D19: batch numbering stays global, though each batch belongs to one company, D7). On PostgreSQL, the function of the same name.

### W6 — Reversal generation *(✅ `JournalEntryEntityServer.GenerateReversal(reason)`)*
**Fires:** only when code explicitly calls it on a saved JE.
**Does:** creates a **new Pending JE** of type `Reversal` (`EntryTypeID` → the `Reversal` `JournalEntryType` row,
required by `trg_JE_ReversalConsistency` 50012), every line's **Dr/Cr swapped**, `ReversesJournalEntryID =` the original — then back-references the
original's `ReversedByJournalEntryID` (the one field the immutability trigger lets change on a locked JE).
The reversal's `EffectiveDate` is the later of today's business day (`BusinessTimeZoneEngine`) and the
original's `EffectiveDate`, so a reversal never lands in a period before the entry it reverses (#266).

### W9 — JE attachment validation *(✅ `JournalEntryEntityServer.ts`)*
**Fires:** whenever a JE is saved with a non-null `FileID`.
**Does:** verifies the `FileID` references an existing `__mj.File` (the DB FK is the hard guarantee).

### F1 — Routine JE validator *(🚫 retired 2026-07-24 — `JournalEntryValidation.ts` deleted)*
Nothing called it. Its rules run on **every save** of a JournalEntry instead:
- `JournalEntryEntity.Validate()` (`packages/Entities`, browser and server): **≥2 lines**, **balanced** (±0.005).
- `JournalEntryEntityServer.Validate()`: born `Pending`, legal status transitions, no blank lines.
- `JournalEntryEntityServer.ValidateAsync()`: every line's GL account **exists**, is **active** and belongs to the
  JE's company (D3; trigger 50019 is the floor), plus the reversal-type pairing, W9 and the `GLPosted` transition check.

---

## 2. The accounting ENGINE (the front door — plan §2)

**`AccountingEngineBase`** (`packages/EngineBase`, browser-safe) caches the reference tables (GL accounts,
**roles**, **links** + link dimensions, dimensions/values, company profiles, currencies) with BaseEngine
auto-refresh, and exposes:
- **`ResolveLinkedAccount(entityId, recordId, role, asOfDate)`** — the per-record `GLAccountLink` primitive
  (Active links, StartedAt/EndedAt windows, latest-start wins, ordered `GLAccountLinkDimension` list).
  Cardinality=Many roles throw `ROLE_NOT_SINGULAR` (BA-D34).
- **`ResolveLinkedAccounts(...)`** — every covering Active link for a Many role (`BankAccount`).
  One roles return the same 0-or-1 winner as `ResolveLinkedAccount`.
- the **pure draft pipeline** (`runDraftPipeline`) + the typed contract (`JournalEntryDraft`,
  `CreateJournalEntryResult`, the 10 error codes) — importable by Orders' client code with zero server deps.

**`AccountingEngine`** (`packages/CoreEntitiesServer`) adds the server write path —
**`CreateJournalEntry(draft, user, provider)`**: stages 1-5 pure validation (shape → entry type → accounts →
dimensions → merge/order → one company + balance), then stage 6 writes header + lines + line-dimensions in
**one TransactionGroup** (all rows or none; numbering rides W2). Logical failures never throw — typed
`Errors[]` (`MALFORMED_DRAFT · ENTRY_TYPE_UNKNOWN · ENTRY_TYPE_INACTIVE · ACCOUNT_UNKNOWN · ACCOUNT_INACTIVE ·
DIMENSION_UNKNOWN · DIMENSION_VALUE_UNKNOWN · UNBALANCED · MULTI_COMPANY_DRAFT · INTERNAL_ERROR`). A bounded **cache-miss retry** (one forced refresh)
heals cross-process reference writes.

**`CreateJournalEntryOperation`** — `@RegisterClass(BaseRemotableOperation, 'Accounting.CreateJournalEntry')`,
code-only. Orders-server calls `op.Execute(input, {provider, user})` in-process; browsers/scripts invoke the
identical op over GraphQL `ExecuteRemoteOperation`.

## 2b. Status-graph + approval hardening (2026-09-05 security sweep)

Save-path validation added in `packages/CoreEntitiesServer/` (these fire on EVERY save of the entity):

- **`JournalEntryEntityServer.Validate/ValidateAsync` — JE status graph.** A JE is **born Pending**;
  the only legal saved-record transitions are `Pending→Batched`, `Batched→GLPosted`, and the
  reversible `Batched→Pending` unlock (with `JournalEntryBatchID` cleared — the owning-batch-still-
  Pending half stays DB-enforced, 50004/50005). A transition **to GLPosted** additionally requires
  the owning batch to be `Sent`/`Posted` (ValidateAsync, DB read) — so a direct client save can no
  longer jump `Pending→GLPosted` with forged `GLPostedAt`/`GLReferenceID`, and only the batch
  dispatch flow (`markJournalEntriesGLPosted`, which runs after the batch is Posted) can GL-post.
- **`JournalEntryBatchEntityServer.Validate` — build is the create verb (golive #193).** A NEW batch
  is refused unless the batching process claimed the instance via `MarkBuiltByBatchingProcess()`,
  which only `JournalEntryBatchEngine.createBatchHeader` does. A batch header exists to point at a
  netted summary entry and a set of locked member entries; a row saved without them carries control
  totals that foot against nothing and is indistinguishable from a real batch until dispatch.
  Explorer's generic New form offered exactly that, so the guard is what makes "batches are built,
  not typed" true rather than a convention. The transient flag is instance state, never a field.
- **`JournalEntryBatchEntityServer.Validate` — `Sent` and `Posted` are the dispatch engine's.** A
  saved batch moves to `Sent` or `Posted` only through `SaveDispatchTransition()`, which raises a
  transient flag for its one save, as `Cancel()` does for `Cancelled`. The engine's `→Sent` (send,
  retry, `recordFailedBatchPosted`) and `→Posted` (`markBatchPosted`) saves are its only callers, so a
  generic-form or GraphQL save cannot mark a batch Sent and then Posted without the ERP being called.
  `Sent → Failed` stays a plain save: recording a failure calls no ERP.
- **`JournalEntryBatchEntityServer.CheckControlTotalCoherence()`** — the Pending→Approved footing +
  member-count check is now a public method shared with the engine: `sendJournalEntryBatch` re-runs
  it **before** every `→Sent` (`Approved→Sent`, and `Failed→Sent` on a retry), so a batch whose member
  set / totals drifted after approval is refused at dispatch instead of shipping under a stale
  signature. It also checks that the summary entry carries the batch's date and company, and (#183)
  compares the content with **`ApprovedContentHash`**, the SHA-256 seal `Save()` writes on
  Pending→Approved over the batch header, summary entry and lines (with dimension tags) and member
  set — so it now means "unchanged since approval", not only "coherent right now". A batch approved
  before the seal existed has no hash and gets the other checks. The immutability trigger freezes
  `Failed` content as well as `Approved`, so the seal is the second line of defence.
  `CheckApprovedContent()` returns the same checks split into `CoherenceProblems` and
  `SealProblems` (#216): dispatch refuses incoherent content, and a broken seal on an `Approved`
  send, before the ERP lookup; on a `Failed` retry it runs the lookup first, and when the ERP
  already holds the batch it records it `Posted` with no second post and sets
  `SealMismatchDetectedAt` in that same `Sent`→`Posted` save. Every other lookup outcome still
  refuses a retry with a broken seal. `trg_JournalEntryBatch_Immutability` (50034) allows the flag
  only in a retry's `Sent`→`Posted` update and freezes it after, so when that save fails
  `failAcceptedBatch` drops the flag before the `Sent`→`Failed` save (the failed save persisted
  nothing); the next retry sets it again.
  **A `Failed` batch carrying `ExternalJournalEntryBatchRef` was accepted by the ERP** (only its
  `Posted` save failed, and `failAcceptedBatch` kept the reference). Its retry records it `Posted`
  under that reference with no lookup and no ERP call, ignoring `confirmNotAlreadyPostedInERP`, and
  flags a broken seal as above; `Cancel()` refuses it. When the `Sent`→`Failed` save itself fails,
  the send reloads the batch and throws `JournalEntryBatchFailureNotRecordedError` (the status it
  reads, and the ERP reference when the ERP had accepted it) instead of reporting a `Failed` the
  database does not hold. The scheduled run's triage passes that reference to
  `recordDispatchFailure`, which keeps it on the batch it marks `Failed`.
- **`JournalEntryBatchEntityServer.Cancel(contextUser, { reason, confirmNotAlreadyPostedInERP })`**
  (#183) — legal from `Pending`, `Approved` and `Failed`, and the way a batch reaches `Cancelled`
  (#213): a transient flag set by `Cancel()` is what lets `Validate()` pass that edge, so the generic
  form or GraphQL update cannot take it. The one other path is regenerate's empty cancel,
  `CancelAfterTeardown()`, which sets the same flag for a Pending batch that `TearDownSummaryAndUnlock`
  has already emptied, and refuses one whose summary pointer is still set. It saves `Cancelled` with the summary
  pointer cleared and the cancel audit triple in ONE update, then releases the members, deletes the
  summary and records the cancel on the approval Task, in one transaction; the triggers key on that order (a member
  unlocks only while its batch is `Pending` or `Cancelled`; a batch becomes Cancelled only with its
  pointer cleared). From `Approved`/`Failed`, and from a `Pending` batch nobody rejected (golive #302), a
  reason is required. A rolled-back cancel reloads the
  instance. `Save()` stamps `CancelledAt` / `CancelledByUserID` on the transition, as it does for the
  approval and archive pairs.
  **`Cancel()` authorizes itself (#214)**, before anything is written, so a server caller that loads the
  entity and calls it directly meets the same rules as the engine. It requires a context user and
  resolves its gate and ERP lookup through `JournalEntryBatchDispatchServices` (below). The options
  carry no ERP basis and no hook: `ERPNotPostedBasis` comes only from the lookup's result, and
  `confirmNotAlreadyPostedInERP` counts only when the lookup cannot settle it.
- **`cancelJournalEntryBatch` + `TasksAppApprovalGate`** (#183) — the engine loads the batch and calls
  `Cancel()`; the rules below run inside it. A cancel past approval must pass
  `assertMayCancelApproved` (the company's `ApprovalCFOUserID` or the batch's `ApprovedByUserID`) and
  records itself on the approval Task as a comment (`recordCancellation`, run inside `Cancel()`'s
  transaction, so it commits or rolls back with the cancel; it refuses when the user has no linked
  Person). `Cancel()` passes the status the batch was cancelled FROM, because when the comment is written the batch
  already reads Cancelled. Before approval (golive #302) the company's CFO or the batch's builder may cancel
  through `Accounting.CancelJournalEntryBatch` with a reason; the approval Task gets the comment and is closed. A CFO
  rejecting a Pending batch uses `RecordJournalEntryBatchDecision` instead, so the decision is recorded.
  **From `Failed` it looks the batch number up in the ERP first (#207)**, after authorizing and
  before writing anything. A cancel releases the entries to be batched again under a NEW number that
  no later lookup can connect to this journal, so this is the last point a posted batch is caught:
  a matching posting refuses the cancel with no override (a retry records it `Posted` instead);
  nothing found cancels, the lookup standing as the ERP check the attestation columns record
  (`ERPNotPostedBasis = 'ERPLookup'`); a mismatch, a failed lookup or no lookup refuses with
  `ErpPostingUnconfirmedError` unless the operator confirmed (`'UserAttested'`). The operation returns
  that refusal as `ConfirmationRequired` / `ConfirmationKind`; which way "not posted" was established is
  persisted as `ERPNotPostedBasis` and repeated in the approval Task comment.
  **And again before it commits (#215).** "Nothing posted" means nothing has posted yet: the ERP can
  still be processing a post it received before the failure was recorded. So once the cancel has
  written everything (status, released entries, deleted summary, Task comment) and before it commits,
  `Cancel()` runs the same lookup again, on the summary lines the first one read. If it finds this
  batch's posting, the cancel does not stand: the transaction rolls back, so no entry is released,
  and the batch is recorded `Posted` the way a retry records one the ERP holds (`Failed → Sent →
  Posted`, no ERP call, `recordFailedBatchPosted`). `JournalEntryBatchPostedDuringCancelError` says
  so, with the status the batch now reads (`Failed` if recording it Posted failed, for a retry to
  finish). If it finds a posting under the number that does not match the batch, and the first lookup
  had not reported one, the cancel is refused: the transaction rolls back, the batch stays `Failed`
  and is not recorded `Posted` (the ERP's content does not match it), and
  `JournalEntryBatchMismatchDuringCancelError` says the operator must investigate that posting before
  cancelling or retrying. `confirmNotAlreadyPostedInERP` does not override it: the confirmation covered
  the first lookup's answer. A second `Mismatch` the first lookup already reported, and confirmed past,
  lets the cancel commit. Any other answer lets the cancel commit. The second lookup runs inside the transaction,
  so the released entries cannot be batched again before it answers, and the batch and its entries
  stay locked while the ERP answers. This narrows the window but does not close it: a post that lands
  after the second lookup still posts the entries twice.
  **The gate and the ERP lookup are resolved, never passed (#233)**, through
  `JournalEntryBatchDispatchServices` (MJ ClassFactory; the defaults are `TasksAppApprovalGate` and
  the AccountingERPEngine lookup). A caller cannot pass them, so it cannot swap in a gate that allows
  everything or leave the lookup out. A higher-priority ClassFactory registration in the same process
  does replace them; unit tests rely on that, and it is the one way around the check.
  A **Pending** cancel needs either a terminal rejection on the approval Task (`isRejected`), which
  `RecordJournalEntryBatchDecision` records before cancelling, or (golive #302) a reason from the company's
  CFO or the user who built the batch (`assertMayCancelPending`); that cancel comments on the approval Task
  and closes it. A Pending batch with **no** approval Task (built with `AutoApproveGate`, e.g. an auto-post
  whose approve step failed) has no Task to update; the CFO or its builder cancels it with a reason. `regenerateJournalEntryBatch`'s empty-cancel
  (`CancelAfterTeardown()`) needs no rejection: it is limited to a Pending batch whose teardown has run.
- **`TasksAppApprovalGate.recordDecision`** — now requires `contextUser` to BE the batch company's
  `AccountingCompanyProfile.ApprovalCFOUserID` (no CFO configured ⇒ hard-fail). Previously any
  authenticated user could approve any batch, including their own. The decision is recorded on the
  batch's stamped `ApprovalTaskID`, as `assertApproved`, `isRejected` and the cancel paths read it, never
  the newest Task Link, which is writable through the tasks app; a batch with no stamp is refused (#313).
- **`JournalEntryBatchEntityServer.Validate` — the approval Task is set once (#313).** A saved batch whose
  loaded `ApprovalTaskID` is set refuses any other value, so a Pending batch cannot be pointed at another
  batch's approved Task. Setting it on a batch with none (the build's stamp) passes. The database enforces
  the same rule for `ApprovalTaskID` and `ApprovalTaskRaisedAt` on raw SQL
  (`trg_JournalEntryBatch_ApprovalTaskSetOnce`, 50035), and a filtered unique index keeps one batch per Task.
- **SQL-predicate id validation (`SqlGuards.ts`)** — `isSqlGuid`/`requireSqlGuid`/`sqlGuidLiteral`
  (extracted from the engine's private `sqlGuid`) now guard every client-supplied id that is
  interpolated into an `ExtraFilter`: the batch remote ops, the gate's Task-Link lookups, W9's
  `FileID`, JE line `GLAccountID`s, `GLAccountLink` / `IntercompanyAccountMatch` FK checks.

## 2c. Finance exception status guard (golive #279)

- **`FinanceExceptionEntityServer`** — a new row is `Open` with no review; on a saved row `Status`,
  `ReviewedByUserID`, `ReviewedAt` and `ReviewNote` change only inside `SaveFinanceExceptionClearance`,
  which `Accounting.ClearFinanceException` calls after its checks (authorization, not the source
  record's creator, creator resolved, still Open, note given). A sanctioned save moves `Open` to
  `Reviewed` or `Corrected` only; a terminal row cannot change; `Delete()` always throws, because
  deleting an Open exception would unblock its month without a review.
- **`Accounting.RaiseFinanceExceptions`** writes as the system user and joins the caller's transaction
  when one is open (same rule as `CreateJournalEntries`), so a raise made during a save commits or
  rolls back with it. A repeat raise of a row that is still Open refreshes its creator fields and summary (an
  ordinary save: they are not guarded), so a creator identified later unlocks a row raised as
  unresolved; a terminal row is never touched. It is marked `RequiresSystemUser`, so through the API
  only the system user may raise; the consuming apps' detectors call it in-process, where that gate
  does not apply. It reads existing rows with `UPDLOCK, HOLDLOCK` on SQL Server; on PostgreSQL it
  first takes a transaction-scoped advisory lock per (type, DedupeKey), then reads with `FOR UPDATE`.
  Either way a concurrent raise of the same item waits and returns the first one's row.
- **`Accounting.ClearFinanceException`** locks the row (`UPDLOCK` on SQL Server, `FOR UPDATE` on
  PostgreSQL) in its transaction before reading it, so of two concurrent clears the second finds the
  row no longer Open (`NOT_OPEN`).
- **Who may clear which exception (golive #320 §4)** is decided per row by
  `FinanceExceptionClearPolicy.ts`, after the checks that always apply (still Open, not the source
  record's creator, a note). The first rule that applies names the authorization the reviewer must
  hold: (1) an unattributed creator — `CreatorUnresolved`, or the MJ system user — needs
  `FinanceExceptions.ClearUnattributed`; (2) a creator holding the `FinanceExceptions.EscalatedCreator`
  marker needs `FinanceExceptions.ClearEscalated`; (3) otherwise the type's
  `FinanceExceptions.ClearType.<CODE>`; (4) otherwise `FinanceExceptions.Clear`. (2) precedes (3) so
  that when the creator is the only holder of a type's right, their peers in `ClearEscalated` can
  still clear it: grant `EscalatedCreator` and `ClearEscalated` to the same senior roles. A rule is on only
  while its authorization is active and granted (Allow, read as MJ reads it: trimmed, any case) to some role; the package grants none of
  them, so by default (4) decides every row, (1) refuses an unresolved creator as before
  (`CREATOR_UNRESOLVED`), and a system-created row follows its type. The rule rights are direct
  grants with no parent, so holding `Clear` never confers them. Before any read the operation still
  refuses a caller who holds no clearing right at all (`NOT_AUTHORIZED`); a holder of the wrong one
  gets `UNATTRIBUTED_NOT_AUTHORIZED`, `ESCALATED_NOT_AUTHORIZED` or `TYPE_NOT_AUTHORIZED`, naming the
  authorization and the roles granted it. Exceptions do not close themselves when their condition is
  fixed (an open question, §4 rule 2); the `FinanceExceptions.ts` header says where that would go.

## 3. Related (not `Save()` hooks)

- **S1 batch dispatch — ✅** (`JournalEntryBatchEngine.ts`): `buildJournalEntryBatch(companyId, targetSystem, …)` nets one
  company's Pending JEs into ONE single-company batch (D7; netting keys on company × account × dims; the
  ERP receives **account numbers**); `approveJournalEntryBatch` flips Pending→Approved with
  audit stamps; `sendJournalEntryBatch` requires Approved (or Failed, for a retry) + the CFO gate
  (`TasksAppApprovalGate` — one Task assigned to the Person linked to the batch company's CFO, `ApprovalCFOUserID`;
  a CFO with no active linked Person refuses the build, #387) → Sent →
  **Posted** + JEs→GLPosted. A send the ERP rejects, or whose poster throws, returns normally with the batch `Failed`,
  and so does one the ERP accepted whose `Sent → Posted` save failed: that batch keeps the ERP
  reference and its `ErrorMessage` says the journal posted, so the retry's lookup records it `Posted`;
  the summary lines load before the `→Sent` save, so a failed load leaves the batch where it was.
  **The gate, the ERP poster and the ERP lookup are resolved by the engine (#233)** through
  `JournalEntryBatchDispatchServices`; `SendJournalEntryBatchOptions` carries only the provider and
  `confirmNotAlreadyPostedInERP`. The one send without an approval Task is
  `autoPostJournalEntryBatch`, the scheduled-posting waiver: it refuses any context user but the MJ
  system user (`assertAutoPostCaller`, #269; also refused when the user cache does not hold it),
  enforces the include-list policy (`assertAutoPostPolicy`), builds with `AutoApproveGate`, approves
  as the context user and sends;
  `Accounting.BuildJournalEntryBatches` with `AutoPost` calls it per company. A failure after the build
  throws `AutoPostDispatchError`, carrying the build so the caller can report the batch's real state.
  Lifecycle (`LEGAL_TRANSITIONS`): `Pending → Approved | Cancelled | Archived`, `Approved → Sent | Cancelled | Archived`,
  `Sent → Posted | Failed`, `Failed → Sent | Cancelled | Archived`; `Posted`, `Cancelled` and `Archived` are terminal.
  The database enforces the same graph on raw SQL: `trg_JournalEntryBatch_Immutability` (50031) and, for `→ Sent`,
  `trg_JournalEntryBatch_SendOnce` (50030).
- **Batch recovery (#145).** *Retry* — `sendJournalEntryBatch` on a `Failed` batch reuses its approval.
  `Failed` does not prove the ERP rejected the journal: the post can succeed with the response lost, or
  succeed and then fail to save `Posted`. So every send, first or retry, looks the batch number up in
  the ERP first (#182; `AccountingERPEngine.FindPostedJournalBatch`, both ERPs via `GetGLEntries`:
  Business Central by document number on any date, QuickBooks Online by the batch number among the
  posting date's journal entries, since its verb cannot filter by number).
  Every line the batch sends carries its token, `[JEB <batch ID>]`, after the line's description
  (#206): batch numbers restart at `BATCH-000001` in every database, so another environment's journal
  can sit under the same number in the same ERP company, and the batch ID is what tells them apart.
  A Business Central journal batch with a Posting No. Series gives the posting a number of its own
  (#205). When nothing has posted under the batch number, the lookup searches the posting date's
  entries on the batch's first account for the token, and reads the posting under BC's number; a
  post reads itself back the same way and records BC's number as the batch's reference. That search
  covers the posting date only. On a `Failed` retry, a posting whose every line carries the token and matches the batch line for
  line (account, debit, credit, posting date) is recorded `Posted` with no second send. On a first
  send such a match means the database was copied from one that sent the batch: the send is refused
  and the batch stays `Approved`. A posting whose lines carry only other batches' tokens is another
  environment's journal: the send or retry is refused with no override and the batch stays where it
  was, to be archived (`Approved`) or cancelled (`Failed`) so its entries rebatch under a new number;
  a `Failed` cancel treats it as not posted. A posting with no tokens (sent before tagging, or from an
  environment that does not tag) or only some is a mismatch. A posting that differs, or a failed lookup, refuses the send unless
  `confirmNotAlreadyPostedInERP` (`ConfirmNotAlreadyPostedInERP` on `Accounting.DispatchJournalEntryBatch`),
  which also stays required on a `Failed` retry to an ERP with no lookup. A
  refused retry stays `Failed` and the op answers `ConfirmationRequired` with the reason and its kind
  (`Unavailable`, `Error` or `Mismatch`; the Dispatch status page gives `Mismatch` a stronger dialog,
  since it is often this very batch); any other refused first send goes `Sent → Failed`. The lookup
  reads posted G/L entries only, so Business Central posting refuses to write into a journal that
  already holds unposted lines, which `Microsoft.NAV.post` would otherwise post along with the batch.
  QuickBooks Online posts each account by its QBO id (`ExternalAccountID`); a line whose GL account
  has none is refused before the call, since QBO would read the `Code` as an id.
  An `afterPost` extension hook that throws never overturns a post the ERP accepted. *Resume* —
  `resumeJournalEntryBatchPosting` (`Accounting.ResumeJournalEntryBatchPosting`) finishes a `Posted`
  batch's member `Batched → GLPosted` flip with no ERP call. *Visibility* — `findStrandedJournalEntries`
  (`Accounting.GetStrandedJournalEntries`) reports entries held at `Batched` by either state; the
  scheduled `Accounting.BuildJournalEntryBatches` appends the count to every run. Scheduled runs never retry.
- **Send audit and send-once (#184).** `JournalEntryBatchEntityServer.Save` stamps `SentAt`, `SentByUserID` and
  `SendAttemptCount` (the loaded count plus one) on every transition into `Sent`. `trg_JournalEntryBatch_SendOnce`
  (50030) treats the count as a version token: a send must start from `Approved` or `Failed` and advance it by
  exactly one, no update may keep a batch `Sent`, and the stamp changes at no other time. Of two sends that loaded
  the same batch, the second save fails whether the first is still `Sent`, has `Posted` or has `Failed` again, and
  `sendJournalEntryBatch` throws `JournalEntryBatchSendRefusedError` before its ERP call. The scheduled
  `Accounting.BuildJournalEntryBatches` does not mark a batch `Failed` on that error: the batch belongs to the
  dispatch that won. The count includes a retry adopted from the ERP and a first send the pre-flight refuses
  (both enter `Sent` without an ERP call); a retry refused before `Sent` is not counted.
  A successful retry still clears `ErrorMessage`; the earlier value, and every overwritten `SentAt` and sender, are
  in `__mj.RecordChange` (the entity tracks record changes).
- **S3 scheduled-JE schedules — 🚫 retired** (D15): the 2026-07-22 baseline dropped the `ScheduledJournalEntry`
  tables and `ScheduledJournalEntryService` was deleted 2026-07-23. Deferred revenue is booked as real
  forward-dated JEs at booking time; the central materializer had already been retired (AM-6).

## Build status at a glance
Hook status is the table at the top of this doc; test coverage and run commands are in `test-harnesses/testing.md`.
