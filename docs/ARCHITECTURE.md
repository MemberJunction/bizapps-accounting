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

## 2. Layered architecture
```
UI (MJExplorer, Angular)            GL tree · JE list/detail · batch review/dispatch · COA mapping
Integration edge (Actions)          BC COA-sync (reuse) · BC batch-post (new) · QBO (reuse)
Service façade (CoreEntitiesServer) AccountingService — thin, stateless, contextUser per call   [later block]
Lifecycle hooks (CoreEntitiesServer) W1–W9 BaseEntity.Save() overrides
DB invariants (migrations)          14 triggers + 2 atomic numbering sprocs  ◄── the un-bypassable floor
```
How a write travels: upstream app → `BaseEntity.Save()` (hook) → DB (triggers enforce
invariants; `__mj.RecordChange` captures audit) → later batched → summary posted to BC.
_(Expand with the full data-flow diagram as Block 1–2 land.)_

## 3. Design patterns used
- **Audit by construction (AD-2):** every ledger mutation goes through `BaseEntity.Save()`
  so `__mj.RecordChange` records it — no bare T-SQL INSERT, even for seeds.
- **Triggers enforce invariants; BaseEntity orchestrates (AD-2):** triggers can't be bypassed
  even by elevated DB privilege; sprocs can.
- **Soft-refs / `JournalEntryLink` lineage (AD-15):** plain UUIDs to downstream apps, no hard FKs.
- **Single-company JEs + flow link (AD-4):** a multi-company transaction is N single-company
  JEs reassembled by `IntercompanyFlowID`. **Intercompany balancing legs are generated
  UPSTREAM (Orders/Payments), not here**, and use **per-company-pair Due-To/Due-From
  accounts** — see Conflict-Resolution §C1.
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
| Company profile init / starter COA / periods | `CoreEntitiesServer/AccountingCompanyProfileEntityServer.ts` (W1) + `SeedData.ts` |
| JE numbering | `JournalEntryEntityServer.ts` (W2) + `SequenceService.ts` + `spAssignNextJournalEntryNumber` |
| Batch numbering | `JournalEntryBatchEntityServer.ts` (W3) + `spAssignNextBatchNumber` |
| The minimal seeded chart | `CoreEntitiesServer/SeedData.ts` (`DEFAULT_CHART_OF_ACCOUNTS`, `DEFAULT_GL_ACCOUNT_REFS`) |
| Batching → summary → BC | _Block 2 (not built): `BatchDispatchAction` + `trg_JEBatch_*` + `JournalEntryBatchLineItem`_ |

<a id="company-profile-init"></a>
### 5.1 Company profile initialization (W1)
On first save of an `AccountingCompanyProfile`, `AccountingCompanyProfileEntityServer.Save()`
runs a per-company, idempotent init: seed the **10-account minimal COA** (AD-8 + §C1) with
`IsSystemSeeded=1`, generate **17 periods** (12 month + 4 quarter + 1 year) for the current FY,
default **`OperatingTimeZone='UTC'`** (AD-16), and wire the **5 default GL-account refs**
(AR / Deferred Revenue / Sales Tax / Realized FX / Unrealized FX). All via `BaseEntity.Save()`
(audit-by-construction). The COA is **per-company runtime seed via the hook — not metadata**
(metadata sync is for global reference data like Currency; a per-company COA can't be static).

<a id="je-lifecycle"></a>
### 5.2 JE lifecycle (Pending → Batched → GLPosted)
Numbering wired (W2/W3). **Block 1 added the hook-side lifecycle + the DB-invariant test suites:**
- **W4** adjusting-entry routing — a JE targeting a **Closed** period errors unless `OriginalAccountingPeriodID`
  is set, in which case it routes to the next open period (the period-close trigger 50007 rejects ANY Closed
  `AccountingPeriodID`; `OriginalAccountingPeriodID` is the audit reference). No silent re-route.
- **W6** `generateReversal(reason)` — new Pending JE (`EntryType='Reversal'`, required by trg 50012), Dr/Cr
  swapped on every line, back-referenced both ways (`ReversedByJournalEntryID` is the one field the
  immutability trigger lets change on a locked JE).
- **W9** attachment validation — a non-null `FileID` must reference an existing `__mj.File`.
- **F1** `validateJournalEntry()` — read-only guard: balance, two-line minimum, period-open, GL-active.
- **DB invariants (triggers)** validated by `test-harness/block1-runtime.ts` (**12/12**), each with a raw-SQL
  bypass case: balanced-on-lock (50001), JE immutability (50003/50004), JE-line immutability (50006),
  period-close (50007). Status-coherence CHECKs also confirmed: `CK_JournalEntry_BatchedHasBatch`
  (Batched ⇒ `BatchID` set), `CK_JournalEntry_GLPostedHasRef`, `CK_AccountingPeriod_ClosedCoherence`
  (Closed ⇒ `ClosedAt`/`ClosedByUserID`).
- **Still open — W5** realized-FX auto-emit: **deferred** pending a design decision. It appears to contradict
  the resolved §C1 (JE/line generation — including the FX balancing line — lives **upstream** in
  Orders/Payments; Accounting receives balanced JEs). Recommend: Accounting owns the FX *mechanics* (the ACP
  `RealizedFXGainLossGLAccountID` ref) but the Payments app computes + posts the FX line.

## 6. Connection map
Hand-written, cross-layer files carry a top-of-file `CONNECTS TO:` block (CALLED BY / CALLS /
DB TRIGGERS / SIBLINGS / WRITES / ENTITY / DOC) so a behavior can be traced DB ↔ hook ↔ service
↔ action ↔ UI without reverse-engineering. Established in Block 0; required on every new/changed
hand-written file going forward (v2 plan §8.1).
