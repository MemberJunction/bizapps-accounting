# BizApps Accounting — Architecture

> **Status:** living document, seeded in Block 0. Each section is filled in as its block
> lands (see `plans/bizapps-accounting-master-plan-v2.md` §9). This is the single place that
> explains the system to someone who wasn't in the build. **Decisions live in the v2 plan's
> AD-\* table + Conflict-Resolution preface; this doc explains the _shape_ and the _why_.**

## 1. System overview & boundaries
BizApps Accounting is the **AR subledger (subsidiary ledger of record)** for the MJ stack —
**not a general ledger** (AD-1). It ingests balanced journal entries emitted by upstream
apps (Orders → revenue side, Payments → cash side), **batches and locks** them, and posts
**account-level summaries** up to the GL (Business Central). The subledger keeps the full
provable detail; the GL keeps the summary + a link back (provability).

What it is NOT: a GL, a financial-statement generator, a year-end close engine, expense
management, or inventory/COGS (master plan §15).

**Guiding principle:** mirror real-world accounting practice/structure as closely as
possible, so accountants and auditors find it approachable and auditable. Corrections are
**adjusting/corrective entries (pen, not pencil)** — never edits to locked history.

## 2. Layered architecture (updated 2026-07-06 — engine-meeting rulings)
```
UI (MJExplorer, Angular)             GL tree · JE list/detail · batch review/dispatch · COA mapping · ERP sync
Integration edge (MJ verbs)          GetChartOfAccounts · CreateJournalEntry · GetAccountBalances · GetDimensions
Integration Engine                   Pull-only maps for COA / dimensions / dimension values (RunSync)
THE ENGINE (EngineBase + CoreEntitiesServer)
   AccountingEngineBase              browser-safe caches (GL/roles/links/dims/profiles) + ResolveLinkedAccount
                                     + the PURE draft pipeline + the typed contract
   AccountingEngine                  CreateJournalEntry — validate (7 typed error codes, per-company balance)
                                     → ONE-TransactionGroup atomic write
   'Accounting.CreateJournalEntry'   the remotable op — same call in-process (orders-server) and over GraphQL
Lifecycle hooks (CoreEntitiesServer) W1/W2/W3/W6/W9 BaseEntity.Save() overrides (W4/W7/W8 retired with periods)
Batching (CoreEntitiesServer)        GLOBAL multi-company buildJournalEntryBatch → approveJournalEntryBatch → sendJournalEntryBatch → Posted
DB invariants (migrations)           12 triggers (incl. AM-4 per-company balance 50019/50023/50022)
                                     + 2 GLOBAL numbering sprocs  ◄── the un-bypassable floor
```
ERP master data travels: Explorer / nightly job → **`Accounting.RunERPSync`** → `AccountingERPEngine.SyncMasterData` → `IntegrationEngine.RunSync` (entity maps, per-company isolation) → registered `BaseAccountingEngineExtension` subclasses (FP&A cash import first). Only ERP connections (Business Central, QuickBooks Online) are synced; one with no entity maps, such as a posting-only connection, is reported skipped, not failed (#256). Journal dispatch: approved batch → `PostJournalBatch` → MJ verb `CreateJournalEntry` (account **numbers**, AM-4). The pre-flight lookup and the post choose the same connection: the batch company's one active connection for the target, or among several the one whose Configuration has `"postJournalEntries": true`, else refuse. Its `CompanyIntegrationID` is sent to the verb (#256, MJ#4867). Accounting never writes `CashBalance`.

How a write travels: caller (Orders, browser, script) → **`Accounting.CreateJournalEntry`** →
engine pipeline → `BaseEntity.Save()` in one TransactionGroup (hooks number; triggers enforce;
`__mj.RecordChange` audits) → later swept into a multi-company batch → CFO-approved → posted to
the ERP **by account number, split per company** (AM-4). Periods/close live in the ERP (CH-1).

<a id="erp-master-data-contract"></a>
### 2.1 ERP master-data mapping contract (#268)
How an ERP's chart of accounts and dimensions land in this app's tables. It holds for every ERP;
each Company Integration's entity maps and field maps implement it.

| Target | Identity | Scope | A re-sync |
|---|---|---|---|
| `GL Accounts` | `CompanyID` + `Code`; `ExternalSystem` / `ExternalAccountID` carry the ERP's id | per company | updates the company's row |
| `Dimensions` | `Code` | **shared by every company** | merges onto the existing row; never inserts a second |
| `Dimension Values` | `DimensionID` + `Code` | shared, through its Dimension | merges onto the existing row |

- **Code is the identity of a Dimension and a Dimension Value.** They have no external-id columns,
  and multi-ERP sync is out of scope. An ERP's dimension ids are per company, so a shared row has no
  single external id to hold. Journal posting already sends dimension tags by `Code`
  (`resolveExternalDimensions`).
- **Dimensions are instance-wide shared master data.** Two companies that both use `DEPT` mean the
  same Dimension. The Integration Engine matches an incoming record on the field maps marked
  `IsKeyField`, so the Dimensions map marks exactly `Code`, and the Dimension Values map exactly
  `DimensionID` and `Code`. `SyncMasterData` checks this before it pulls, and fails a connection
  whose maps key on anything else. A map without the key matches only through its own connection's
  record maps, so a second company's sync would insert and collide on `UQ_Dimension_Code`. Company
  scoping, if it is ever needed, revisits this together with the identity rule.
- **`AccountType` is translated per integration**, by a `lookup` step in the `TransformPipeline` of
  the field map onto `AccountType` (a child of the GL Accounts entity map). Cost of Goods Sold maps to
  `Expense`. Give the lookup no `Default`: an ERP value it does not list then yields null, the
  `NOT NULL` column refuses the row, and the gap shows as an errored record instead of a guessed
  type. A generic example, for an ERP whose account category field is `category`:

  ```json
  [{ "Type": "lookup", "Config": { "Map": {
      "Assets": "Asset", "Liabilities": "Liability", "Equity": "Equity",
      "Income": "Revenue", "Cost of Goods Sold": "Expense", "Expense": "Expense"
  } } }]
  ```
- **Non-postable ERP rows are skipped, not forced into the enum.** Heading, total and begin/end-total
  rows are presentation structure, not accounts. The Integration Engine has no record-level filter
  yet, so today this is the connector's or the integrator's job; it must not be done by giving the
  `AccountType` lookup a `Default`.

## 3. Design patterns used
- **Audit by construction (AD-2):** every ledger mutation goes through `BaseEntity.Save()`
  so `__mj.RecordChange` records it — no bare T-SQL INSERT, even for seeds.
- **Triggers enforce invariants; BaseEntity orchestrates (AD-2):** triggers can't be bypassed
  even by elevated DB privilege; sprocs can.
- **Cross-app references point UP the dependency graph only (supersedes AD-15 — issue #22):**
  references into installed dependency schemas (`__mj`, `__mj_BizAppsCommon`) are REAL FK
  constraints (apps install in dependency order, so targets always exist). Accounting holds
  **no references to its own dependents, hard or soft** — the old AD-15 "soft UUID to
  downstream apps" pattern (and the retired `JournalEntryLink` table) is gone. Downstream
  lineage is the polymorphic D25 origin pair: `LinkedEntityID` (hard FK to `__mj.Entity`) +
  `LinkedRecordID` (soft by nature — the record lives in a schema this repo can't know).
- **MULTI-COMPANY JEs (CH-2, supersedes AD-4's single-company rule):** a JE has NO header
  CompanyID — each line's company derives from its `GLAccount.CompanyID`, and the entry must
  balance overall AND within each company (AM-4, triggers 50019/50022). `IntercompanyFlowID`
  still reassembles related legs; **intercompany balancing legs are generated UPSTREAM
  (Orders/Payments), not here** (§C1) — Accounting batches tagged legs as-is, no netting.
- **Role-based account resolution (AM-2/AM-5):** `GLAccountRole` (Cash, AR, Sales, …) +
  polymorphic date-windowed `GLAccountLink` rows (+ ordered `GLAccountLinkDimension`) let any
  record (product, category, company default) carry account links; the engine's
  `ResolveLinkedAccount` is the per-record lookup — the WALK order (product → category →
  default) is the caller's. Cardinality=Many roles (`BankAccount`) refuse singular resolve
  (`ROLE_NOT_SINGULAR`) and use `ResolveLinkedAccounts` instead (BA-D34).
- **Pluggable providers:** currency (AD-7) and tax (AD-19) via `@RegisterClass`.
- _(More as blocks land.)_

## 4. Key decisions
See `plans/bizapps-accounting-master-plan-v2.md` — the **AD-1..AD-17 table** (the build's
decision record) and the **Conflict-Resolution preface** (C1–C5 + open questions OQ-A/OQ-B).
Master `BA-D1..BA-D27` is the older source; where the v2 plan/transcript supersede it, the v2
plan is authoritative.

## 5. Key code sections (capability → where to look)
| To change… | Look at |
|---|---|
| Company profile init / starter COA | `CoreEntitiesServer/AccountingCompanyProfileEntityServer.ts` (W1) + `SeedData.ts` |
| JE numbering (GLOBAL per FY) | `JournalEntryEntityServer.ts` (W2) + `SequenceService.ts` + `spAssignNextJournalEntryNumber` |
| Batch numbering (GLOBAL) | `JournalEntryBatchEntityServer.ts` (W3) + `spAssignNextJournalEntryBatchNumber` |
| The minimal seeded chart | `CoreEntitiesServer/SeedData.ts` (`DEFAULT_CHART_OF_ACCOUNTS`, `DEFAULT_GL_ACCOUNT_REFS`) |
| **The engine contract / pure pipeline / caches / ResolveLinkedAccount** | `packages/EngineBase/src/{contract,pipeline,AccountingEngineBase}.ts` |
| **CreateJournalEntry write path + the remotable op** | `CoreEntitiesServer/AccountingEngine.ts` + `CreateJournalEntryOperation.ts` |
| Batching → approval → ERP post | `CoreEntitiesServer/JournalEntryBatchEngine.ts` (buildJournalEntryBatch/approveJournalEntryBatch/sendJournalEntryBatch) + `TasksAppApprovalGate.ts` + `trg_JournalEntryBatch_*` |
| Read-model views (12) | baseline migration §"read-model views" + `Server/resolvers/ReadModelsResolver.ts` |

<a id="company-profile-init"></a>
### 5.1 Company profile initialization (W1)
Saving a new `AccountingCompanyProfile` does nothing beyond the insert: `AccountingCompanyProfileEntityServer`
has no `Save()` override. Three first-save behaviors were retired:
- **COA auto-seed** (retired 2026-07-30): a new company starts with an empty chart, because GL accounts
  identity-lock immediately (L8). Seeding the **10-account minimal COA** (AD-8 + §C1, `IsSystemSeeded=1`)
  is an explicit call to `SeedDefaultChartOfAccounts()` — idempotent, every row via `BaseEntity.Save()`
  (audit-by-construction). The COA is a **per-company runtime seed, not metadata**; global reference
  data (Currency, **GLAccountRole**) seeds via metadata sync.
- **Default GL-account refs** (D12): the five profile FK columns were dropped; a company's default
  accounts are company-level `GLAccountLink` rows.
- **`OperatingTimeZone='UTC'` default** (AD-16, removed in #158): the field is an optional per-company
  display override, and blank inherits `BizApps.BusinessTimeZone`.

*(Period generation was REMOVED 2026-07-06 — periods live in the ERP, CH-1.)*

<a id="je-lifecycle"></a>
### 5.2 JE lifecycle (Pending → Batched → GLPosted) — updated 2026-07-06
JEs are **multi-company** (no header CompanyID; per-line company via `GLAccount.CompanyID`).
The front door for external callers is **`Accounting.CreateJournalEntry`** (§2) — its pipeline
validates shape/accounts/dimensions, merges duplicate lines (debits ordered first), checks
balance **overall and per company** (AM-4), and writes atomically. Hooks on the entity path:
- **W6** `generateReversal(reason)` — new Pending JE (`EntryType='Reversal'`, trg 50012), Dr/Cr
  swapped, back-referenced both ways, dated the later of today's business day and the original's
  `EffectiveDate`.
- **W9** attachment validation — a non-null `FileID` must reference an existing `__mj.File`.
- **F1** `validateJournalEntry()` — read-only guard: balance overall + per company, two-line
  minimum, GL-active.
- **DB invariants (triggers)** validated by `test-harnesses/server/block1-runtime.ts`, each with
  a raw-SQL bypass case: balanced-on-lock overall (50001) **and per company (50019/50022 —
  AM-4)**, JE immutability (50003/50004), JE-line immutability (50006). Batch side: summary
  foots overall (50014) **and per company (50023)**, batch immutability (50008/50009, `Failed`
  included since #183), the cancel-after-approval release and `CK_JournalEntryBatch_CancelAudit`.
  Send-once (50030, #184) is validated by L21 and L22 in `test-harnesses/server/phase2-encapsulation.live.test.ts`:
  a send must start from `Approved` or `Failed` and advance `SendAttemptCount` by one, no update keeps a
  batch `Sent`, and the send stamp changes at no other time. Of two dispatches that loaded the same batch,
  only one reaches the ERP, whether the loser's save lands while the winner is `Sent` or after it has left.
  *(The period-close trigger + W4 routing were retired with the period tables.)*
- **Batch lifecycle (CH-3):** `Pending → Approved → Sent → Posted | Failed | Cancelled` — see
  `JournalEntryBatchEngine.ts`; the ERP wire is **account numbers, split per company** (AM-4).
- **Posting start date:** `AccountingCompanyProfile.PostingStartDate` is a per-company floor on the
  batch candidate pool. Entries dated before it (e.g. history brought in at cutover) never enter a
  batch: `pendingCandidateFilter` applies it to every build, preview and scheduled sweep, and the
  explicit-ID and view builds check it too. NULL, or no profile row, means no floor.
- **Recovery past Approved (#145):** a `Failed` batch is retried by dispatching it again
  (`Failed → Sent`; the gate and the coherence check re-run, the original approval is reused). A
  `Failed` batch may already be in the ERP, so every send first looks the batch number up there
  (#182): a Failed batch the ERP holds line for line is recorded `Posted` without a second send; a
  first send whose number is already there is refused. The operator's confirmation that the number
  has not posted is needed only when the lookup cannot settle it: a mismatch, a failed lookup, or an
  ERP with no lookup. A `Failed` batch that carries the ERP's reference was accepted and only its
  `Posted` save failed: its retry records it `Posted` under that reference with no lookup, and it
  cannot be cancelled. `Sent` and `Posted` are written only by the dispatch engine. Business Central is looked up by document number on any date; QuickBooks
  Online, whose verb cannot filter by number, among the posting date's journal entries. Business
  Central posting also refuses a journal that already holds unposted lines, and QuickBooks Online
  posting refuses a GL account with no QBO account id. Its content is frozen like an Approved batch's, and the dispatch check compares it with the
  `ApprovedContentHash` seal written at approval (#183). A `Failed` or `Approved` batch whose content
  is wrong is cancelled instead (`Accounting.CancelJournalEntryBatch`: the company's CFO or the
  batch's approver only, reason required and written to the approval Task), which releases its
  entries to the next build. From `Failed` the ERP is looked up first (#207), because the released
  entries get a new number no later lookup can connect: a posting it holds refuses the cancel, nothing
  found lets it through, and the operator confirms, persisted, only when the lookup cannot settle it.
  Nothing found means nothing posted yet, so the cancel looks again after its writes and before it
  commits (#215): a posting found then rolls the cancel back and records the batch `Posted`; a new posting that does not
  match rolls it back and leaves the batch `Failed` for investigation.
  A
  `Posted` batch whose member `Batched → GLPosted` flip stopped partway is finished by
  `resumeJournalEntryBatchPosting` (`Accounting.ResumeJournalEntryBatchPosting`), which makes no
  ERP call. `findStrandedJournalEntries` reports the entries both states hold; the scheduled
  action and the Dispatch status page surface it. Scheduled runs never retry on their own.
  Each send stamps `SentAt`, `SentByUserID` and `SendAttemptCount` on the batch; `__mj.RecordChange`
  keeps every earlier attempt, including the `ErrorMessage` a successful retry clears (#184).
- **W5** realized-FX auto-emit: retired — Orders/Payments computes + posts the FX line (§C1).
- **Finance exceptions (golive #279):** `FinanceExceptions.ts` holds the logic behind
  `Accounting.GetFinanceExceptionTypes` / `RaiseFinanceExceptions` / `ClearFinanceException`
  (`FinanceExceptionOperations.ts`, over the CodeGen-emitted bases in `accounting-entities`);
  `FinanceExceptionEntityServer.ts` makes the clear operation the only way a status changes. Orders
  and sales resolve the operations by key through the ClassFactory, with no build-time dependency.

## 6. Connection map
Hand-written, cross-layer files carry a top-of-file `CONNECTS TO:` block (CALLED BY / CALLS /
DB TRIGGERS / SIBLINGS / WRITES / ENTITY / DOC) so a behavior can be traced DB ↔ hook ↔ service
↔ action ↔ UI without reverse-engineering. Established in Block 0; required on every new/changed
hand-written file going forward (v2 plan §8.1).
