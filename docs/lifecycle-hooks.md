# BizApps Accounting — Lifecycle Hooks (W1–W9) + the Engine

> **What this is:** the per-entity **`BaseEntity.Save()` lifecycle hooks** — the server-side logic that runs
> when an accounting record is created/changed. They live in `packages/CoreEntitiesServer/` and route every
> mutation through `BaseEntity` so `__mj.RecordChange` audits it (P1: *audit by construction*).
> **Updated 2026-07-06** for the engine-meeting rulings (AM-1..7): **AccountingPeriod is GONE** (the ERP owns
> periods — CH-1), JEs/batches are **multi-company** (CH-2/CH-4), numbering is **global** (D-SEQ), the SJE
> **materializer is retired** (AM-6), and the **accounting engine** (`AccountingEngine` +
> `Accounting.CreateJournalEntry`) is the front door for external callers.

**Division of labor (P2):** *DB triggers* enforce un-bypassable invariants (balance overall **and per
company** — AM-4, immutability); *hooks* orchestrate (seed, number, reverse, validate). A hook makes the
friendly thing happen; the trigger is the floor that catches anything — even raw SQL.

**How a hook "fires" — two kinds:**
- **Auto (in `Save()`):** the hook is an override of the entity's `Save()`. It runs **every time that entity
  is saved**, then a guard condition decides whether it acts.
- **Explicit call:** not wired into `Save()` — it runs only when code **calls the method by name** (W6, F1).

**Status legend:** ✅ built + tested · 🚫 retired.

| # | Hook | Entity | What causes it to fire | How | Status |
|---|---|---|---|---|---|
| **W1** | Profile init (TZ default; COA seed = explicit only, 2026-07-30) | `AccountingCompanyProfile` | a **new** profile is saved (`!IsSaved`) | TZ auto · seed via explicit `SeedDefaultChartOfAccounts()` | ✅ |
| **W2** | JE numbering (GLOBAL) | `JournalEntry` | a **new** JE is saved with **no `EntryNumber`** | auto · `Save()` | ✅ |
| **W3** | Batch numbering (GLOBAL) | `JournalEntryBatch` | a **new** batch is saved with **no `JournalEntryBatchNumber`** | auto · `Save()` | ✅ |
| **W4** | Adjusting-entry routing | — | — | — | 🚫 retired 2026-07-06 (periods removed, CH-1) |
| **W5** | Realized FX auto-emit | — | — | — | 🚫 retired (Payments-side, §C1) |
| **W6** | Reversal generation | `JournalEntry` | code **calls `generateReversal(reason)`** | explicit call | ✅ |
| **W7** | Period-close orchestration | — | — | — | 🚫 retired 2026-07-06 (periods removed, CH-1) |
| **W8** | Period reopen | — | — | — | 🚫 retired 2026-07-06 (periods removed, CH-1) |
| **W9** | Attachment validation | `JournalEntry` | a JE is saved with a non-null **`FileID`** | auto · `Save()` | ✅ |
| **F1** | Routine JE validator | `JournalEntry` (read-only) | code **calls `validateJournalEntry(id)`** | explicit call | ✅ |

---

## 1. The hooks in detail

### W1 — Profile init *(✅ `AccountingCompanyProfileEntityServer.ts` — auto-seed RETIRED 2026-07-30)*
**Fires:** the only remaining automatic behavior on a new profile's first save is the
**`OperatingTimeZone = 'UTC'`** default. **The COA auto-seed no longer fires on create** (Marcelo
ruling 2026-07-30): a new company starts with an **EMPTY chart** — auto-seeding collided with the
**L8 immediate identity lock**, forcing ten locked-identity accounts on every company.
**Explicit capability instead:** `SeedDefaultChartOfAccounts()` (public, idempotent — existing codes
skipped, every row via `BaseEntity.Save()` so it stays audit-by-construction) seeds the 10-account
AR-subledger set (AD-8 + §C1) **when deliberately invoked** — fixtures, demo seeds, or a future
"seed standard chart" UI affordance.
- *(The profile's 5 default GL-account refs were RETIRED 2026-07-23 — role/link model replaces them.)*
- *(Period generation was REMOVED 2026-07-06 — no `AccountingPeriod` rows exist to create.)*

### W2 — JE numbering *(✅ `JournalEntryEntityServer.ts` + `SequenceService.ts`)*
**Fires:** on a brand-new JournalEntry with no number.
**Does:** calls the atomic sproc `spAssignNextJournalEntryNumber(@FiscalYear)` (HOLDLOCK/UPDLOCK — gap-free
under concurrency) and sets **`EntryNumber = JE-{FY}-{seq:000000}`** before `super.Save()`. FY derives from
`EffectiveDate` (UTC). **The sequence is GLOBAL per fiscal year** (D-SEQ 2026-07-06 — JEs are multi-company;
there is no company segment in the number anymore).

### W3 — Batch numbering *(✅ `JournalEntryBatchEntityServer.ts` + `SequenceService.ts`)*
**Fires:** on a brand-new batch with no number.
**Does:** `spAssignNextJournalEntryBatchNumber()` → **`JournalEntryBatchNumber = BATCH-{seq:000000}`** — a single **GLOBAL** counter
(batches are multi-company, CH-4).

### W6 — Reversal generation *(✅ `JournalEntryEntityServer.generateReversal(reason)`)*
**Fires:** only when code explicitly calls it on a saved JE.
**Does:** creates a **new Pending JE** — `EntryType='Reversal'` (required by `trg_JE_ReversalConsistency`
50012), every line's **Dr/Cr swapped**, `ReversesJournalEntryID =` the original — then back-references the
original's `ReversedByJournalEntryID` (the one field the immutability trigger lets change on a locked JE).

### W9 — JE attachment validation *(✅ `JournalEntryEntityServer.ts`)*
**Fires:** whenever a JE is saved with a non-null `FileID`.
**Does:** verifies the `FileID` references an existing `__mj.File` (the DB FK is the hard guarantee).

### F1 — Routine JE validator *(✅ `JournalEntryValidation.ts` → `validateJournalEntry()`)*
**Fires:** only when called explicitly (the batching engine / callers before locking).
**Does:** read-only guard — checks **balanced overall** (±0.005), **balanced WITHIN EACH company** (AM-4 —
company = the line's `GLAccount.CompanyID`; mirrors trigger 50019), **≥2 lines**, **GL accounts active**;
returns an aggregated error list. *(The period-open check was retired with the period tables.)*
Pure parts (`checkBalance`, `checkPerCompanyBalance`) are exported + unit-tested.

---

## 2. The accounting ENGINE (the front door — plan §2)

**`AccountingEngineBase`** (`packages/EngineBase`, browser-safe) caches the reference tables (GL accounts,
**roles**, **links** + link dimensions, dimensions/values, company profiles, currencies) with BaseEngine
auto-refresh, and exposes:
- **`ResolveLinkedAccount(entityId, recordId, role, asOfDate)`** — the per-record `GLAccountLink` primitive
  (Active links, StartedAt/EndedAt windows, latest-start wins, ordered `GLAccountLinkDimension` list).
- the **pure draft pipeline** (`runDraftPipeline`) + the typed contract (`JournalEntryDraft`,
  `CreateJournalEntryResult`, the 7 error codes) — importable by Orders' client code with zero server deps.

**`AccountingEngine`** (`packages/CoreEntitiesServer`) adds the server write path —
**`CreateJournalEntry(draft, user, provider)`**: stages 1-5 pure validation (shape → accounts → dimensions →
merge/order → balance overall AND per company), then stage 6 writes header + lines + line-dimensions in
**one TransactionGroup** (all rows or none; numbering rides W2). Logical failures never throw — typed
`Errors[]` (`MALFORMED_DRAFT · ACCOUNT_UNKNOWN · ACCOUNT_INACTIVE · DIMENSION_UNKNOWN ·
DIMENSION_VALUE_UNKNOWN · UNBALANCED · INTERNAL_ERROR`). A bounded **cache-miss retry** (one forced refresh)
heals cross-process reference writes.

**`CreateJournalEntryOperation`** — `@RegisterClass(BaseRemotableOperation, 'Accounting.CreateJournalEntry')`,
code-only. Orders-server calls `op.Execute(input, {provider, user})` in-process; browsers/scripts invoke the
identical op over GraphQL `ExecuteRemoteOperation`.

## 3. Related (not `Save()` hooks)

- **S1 batch dispatch — ✅** (`BatchingEngine.ts`): `buildBatch(targetSystem, …)` is **GLOBAL** — nets ALL
  Pending JEs (every company) into ONE multi-company batch (netting keys on company × account × dims; the
  ERP-post seam splits by company, by **account number** — AM-4); `approveBatch` flips Pending→Approved with
  audit stamps; `sendBatch` requires Approved + the CFO gate (`TasksAppApprovalGate` — per-company CFO
  **union**: one Task assigned to every involved company's CFO) → Sent → **Posted** (mock ERP poster for
  now) + JEs→GLPosted. Lifecycle: `Pending → Approved → Sent → Posted | Failed | Cancelled`.
- **S3 scheduled-JE schedules — ✅ creation only** (`ScheduledJournalEntryService.createScheduledEntries`:
  straight-line schedules with exact cent-remainder spread). **The central materializer is RETIRED (AM-6)**
  — *domain entity servers* (e.g. a future SubscriptionEntityServer) generate the real Pending JE when a row
  comes due and flip the SJE to Generated (schema-supported: `CK_SJE_GeneratedCoherence` + locks 50016-18).

## Build status at a glance
- ✅ W1, W2, W3, W6, W9, F1 · S1 batching (6-status, multi-company) · S3 creation · Block 5 COA-mapping
  approval · Block 6 read models (12 views) · **the engine + `Accounting.CreateJournalEntry`**.
- 🧪 **Live-proven (2026-07-06):** T1 76/76 · T2 76/76 blocks + engine 12/12 + seed 6/6 · T3 64/64 + engine-op
  8/8 · T5 10/10 — see `test-harnesses/testing.md` for the coverage matrix.
- 🚫 **Retired:** W4/W7/W8 (periods — CH-1), W5 (FX generation is Payments'), the S3 materializer (AM-6).
