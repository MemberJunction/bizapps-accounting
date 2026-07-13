# BizApps Accounting — Architecture

> **Status:** living document. This is the single place that explains the system to someone
> who wasn't in the build. **Decisions live in `plans/MASTER-PLAN.md` as overlaid by
> `plans/MASTER-PLAN-MODIFICATIONS.md` (MOD-*) + `plans/MASTER-PLAN-UPDATES.md` (UPD-*)** —
> this doc explains the _shape_ and the _why_. (The former "master plan v2" doc was retired
> 2026-07-11; its Amith/Robert rulings live in `plans/meetings/2026-06 - Amith rescope rulings
> (extracted from retired v2 plan).md`, and its AD-* labels referenced below map to those
> rulings + the MOD ledger.)

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
UI (MJExplorer, Angular)             GL tree · JE list/detail · batch review/dispatch · COA mapping
Integration edge (Actions)           BC COA-sync (reuse) · BC batch-post (new) · QBO (reuse)
THE ENGINE (EngineBase + CoreEntitiesServer)
   AccountingEngineBase              browser-safe caches (GL/roles/links/dims/profiles) + ResolveLinkedAccount
                                     + the PURE draft pipeline + the typed contract
   AccountingEngine                  CreateJournalEntry — validate (7 typed error codes, per-company balance)
                                     → ONE-TransactionGroup atomic write
   'Accounting.CreateJournalEntry'   the remotable op — same call in-process (orders-server) and over GraphQL
Lifecycle hooks (CoreEntitiesServer) W1/W2/W3/W6/W9 BaseEntity.Save() overrides (W4/W7/W8 retired with periods)
Batching (CoreEntitiesServer)        GLOBAL multi-company buildBatch → approveBatch → sendBatch → Posted
DB invariants (migrations)           12 triggers (incl. AM-4 per-company balance 50019/50023/50022)
                                     + 2 GLOBAL numbering sprocs  ◄── the un-bypassable floor
```
How a write travels: caller (Orders, browser, script) → **`Accounting.CreateJournalEntry`** →
engine pipeline → `BaseEntity.Save()` in one TransactionGroup (hooks number; triggers enforce;
`__mj.RecordChange` audits) → later swept into a multi-company batch → CFO-approved → posted to
the ERP **by account number, split per company** (AM-4). Periods/close live in the ERP (CH-1).

## 3. Design patterns used
- **Audit by construction (AD-2):** every ledger mutation goes through `BaseEntity.Save()`
  so `__mj.RecordChange` records it — no bare T-SQL INSERT, even for seeds.
- **Triggers enforce invariants; BaseEntity orchestrates (AD-2):** triggers can't be bypassed
  even by elevated DB privilege; sprocs can.
- **Soft-refs / `JournalEntryLink` lineage (AD-15):** plain UUIDs to downstream apps, no hard FKs.
- **MULTI-COMPANY JEs (CH-2, supersedes AD-4's single-company rule):** a JE has NO header
  CompanyID — each line's company derives from its `GLAccount.CompanyID`, and the entry must
  balance overall AND within each company (AM-4, triggers 50019/50022). `IntercompanyFlowID`
  still reassembles related legs; **intercompany balancing legs are generated UPSTREAM
  (Orders/Payments), not here** (§C1) — Accounting batches tagged legs as-is, no netting.
- **Role-based account resolution (AM-2/AM-5):** `GLAccountRole` (Cash, AR, Sales, …) +
  polymorphic date-windowed `GLAccountLink` rows (+ ordered `GLAccountLinkDimension`) let any
  record (product, category, company default) carry account links; the engine's
  `ResolveLinkedAccount` is the per-record lookup — the WALK order (product → category →
  default) is the caller's.
- **Pluggable providers:** currency (AD-7) and tax (AD-19) via `@RegisterClass`.
- _(More as blocks land.)_

## 4. Key decisions
See **`plans/MASTER-PLAN.md`** (BA-D1..BA-D27) as overlaid by **`plans/MASTER-PLAN-MODIFICATIONS.md`
(MOD-1..10)** and **`plans/MASTER-PLAN-UPDATES.md`** — the ledgers are authoritative
(precedence: MOD > UPD > original). The June-2026 rescope rulings (C1–C5, OQ-A) behind
MOD-2/4/5/6/7 are preserved in `plans/meetings/2026-06 - Amith rescope rulings (extracted
from retired v2 plan).md`.

## 5. Key code sections (capability → where to look)
| To change… | Look at |
|---|---|
| Company profile init / starter COA | `CoreEntitiesServer/AccountingCompanyProfileEntityServer.ts` (W1) + `SeedData.ts` |
| JE numbering (GLOBAL per FY) | `JournalEntryEntityServer.ts` (W2) + `SequenceService.ts` + `spAssignNextJournalEntryNumber` |
| Batch numbering (GLOBAL) | `JournalEntryBatchEntityServer.ts` (W3) + `spAssignNextBatchNumber` |
| The minimal seeded chart | `CoreEntitiesServer/SeedData.ts` (`DEFAULT_CHART_OF_ACCOUNTS`, `DEFAULT_GL_ACCOUNT_REFS`) |
| **The engine contract / pure pipeline / caches / ResolveLinkedAccount** | `packages/EngineBase/src/{contract,pipeline,AccountingEngineBase}.ts` |
| **CreateJournalEntry write path + the remotable op** | `CoreEntitiesServer/AccountingEngine.ts` + `CreateJournalEntryOperation.ts` |
| Batching → approval → ERP post | `CoreEntitiesServer/BatchingEngine.ts` (buildBatch/approveBatch/sendBatch) + `TasksAppApprovalGate.ts` + `trg_JEBatch_*` |
| Read-model views (12) | baseline migration §"read-model views" + `Server/resolvers/ReadModelsResolver.ts` |

<a id="company-profile-init"></a>
### 5.1 Company profile initialization (W1)
On first save of an `AccountingCompanyProfile`, `AccountingCompanyProfileEntityServer.Save()`
runs a per-company, idempotent init: seed the **10-account minimal COA** (AD-8 + §C1) with
`IsSystemSeeded=1`, default **`OperatingTimeZone='UTC'`** (AD-16), and wire the **5 default
GL-account refs** (AR / Deferred Revenue / Sales Tax / Realized FX / Unrealized FX). All via
`BaseEntity.Save()` (audit-by-construction). *(Period generation was REMOVED 2026-07-06 —
periods live in the ERP, CH-1.)* The COA is **per-company runtime seed via the hook — not
metadata**; global reference data (Currency, **GLAccountRole**) seeds via metadata sync.

<a id="je-lifecycle"></a>
### 5.2 JE lifecycle (Pending → Batched → GLPosted) — updated 2026-07-06
JEs are **multi-company** (no header CompanyID; per-line company via `GLAccount.CompanyID`).
The front door for external callers is **`Accounting.CreateJournalEntry`** (§2) — its pipeline
validates shape/accounts/dimensions, merges duplicate lines (debits ordered first), checks
balance **overall and per company** (AM-4), and writes atomically. Hooks on the entity path:
- **W6** `generateReversal(reason)` — new Pending JE (`EntryType='Reversal'`, trg 50012), Dr/Cr
  swapped, back-referenced both ways.
- **W9** attachment validation — a non-null `FileID` must reference an existing `__mj.File`.
- **F1** `validateJournalEntry()` — read-only guard: balance overall + per company, two-line
  minimum, GL-active.
- **DB invariants (triggers)** validated by `test-harnesses/server/block1-runtime.ts`, each with
  a raw-SQL bypass case: balanced-on-lock overall (50001) **and per company (50019/50022 —
  AM-4)**, JE immutability (50003/50004), JE-line immutability (50006). Batch side: summary
  foots overall (50014) **and per company (50023)**, batch immutability (50008/50009).
  *(The period-close trigger + W4 routing were retired with the period tables.)*
- **Batch lifecycle (CH-3):** `Pending → Approved → Sent → Posted | Failed | Cancelled` — see
  `BatchingEngine.ts`; the ERP wire is **account numbers, split per company** (AM-4).
- **W5** realized-FX auto-emit: retired — Orders/Payments computes + posts the FX line (§C1).

## 6. Connection map
Hand-written, cross-layer files carry a top-of-file `CONNECTS TO:` block (CALLED BY / CALLS /
DB TRIGGERS / SIBLINGS / WRITES / ENTITY / DOC) so a behavior can be traced DB ↔ hook ↔ service
↔ action ↔ UI without reverse-engineering. Established in Block 0; required on every new/changed
hand-written file going forward (v2 plan §8.1).
