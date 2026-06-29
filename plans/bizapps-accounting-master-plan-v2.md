# BizApps Accounting — Design & Build Roadmap (v2)

> **Status:** Design / pre-implementation roadmap 
> **authoritative design docs for the build.**: `bizapps-accounting-master.md` and `Transcript of Amith's Explanation.docx`
> **Primary input:** `Transcript of Amith's Explanation.md` (Amith Nagarajan, 2026-06-05) + analysis of the current repo, `bizapps-common` open-app patterns, and MJ Open-App standards.
> **Supersedes for design authority:** Transcripts and master plan were used as input for this doc, but this doc is the primary devlopemnt driver. Direct conflicts will be resolved in the conflict resolution section below or through edits before developemnt begins. If a conflict is recognized between this doc and the authoritative sources, or between the sources, notify the user so it can be added here.
> **Locked decisions:** branching `next → main`; PR #8 = cherry-pick after codegen regen; intercompany = N single-company JEs + flow link, **generation upstream (Orders/Payments) + per-company-pair Due-To/Due-From accounts — NO centralized intercompany account, NO Accounting-side generation (see Preface §C1)**; balance snapshots deferred; minimal seed COA; no AI agents in v1; rev-rec computed upstream (Accounting persists+materializes); batch summary granularity **OPEN — per-company vs per-account vs account×dimension (OQ-B)**; PostgreSQL conversion is the **last** block.

---

## Preface: Conflict Resolution

> **Status (2026-06-28):** Resolutions below come from Marcelo's conversations with Amith Nagarajan, recorded against the conflicts flagged between this v2 doc and the authoritative sources (the transcript + `bizapps-accounting-master.md`). **Where a resolution overrides the master plan, the transcript / Amith is authoritative** — the master predates the 2026-06-05 call. Two items remain **OPEN** pending Amith (OQ-A, OQ-B).

### Guiding principle (resolves ambiguity in favor of real accounting)
This app must **mirror real-world accounting practice and structure as closely as possible**, so that professional accountants and auditors find it approachable and auditable. When a design choice is between "technically convenient" and "what a real ledger does," choose what a real ledger does. Framing: this is an **AR subledger (subsidiary ledger of record)** — it ingests the output of the Orders + Payments apps, **batches and locks** it, and posts **summaries** up to the general ledger (Business Central). It is **not** the GL. We deliberately do **not** use a truly-immutable store (e.g. blockchain) — too slow at scale; instead we enforce the strictest practical DB-level controls and **trust a CFO-level human not to bypass them**, and we correct mistakes with **adjusting / corrective entries (pen, not pencil)**, never by editing locked history.

### C1 — Intercompany handling & where JE generation lives — RESOLVED (corrects AD-5; AD-4 stands)
- **JE generation does NOT happen in bizapps-accounting.** Two **upstream** systems generate journal entries and post them *into* Accounting via the service API: the **Orders app** (revenue side) and the **Payments app** (cash side). Accounting **receives → batches → locks → posts to the GL**. This matches the transcript ("we're going to generate them automatically **in the payment system**") and master **BA-D17**. → **AD-5's "Accounting auto-generates the balancing legs" is REVERSED.**
- **No centralized Due-To / Due-From account — VETOED by Amith.** Replace the single generic intercompany accounts with **per-company-pair** accounts: each company's chart carries a `Due To <Counterparty>` + `Due From <Counterparty>` account for each counterparty it transacts with → **4 GL accounts per company-pair** (scales ≈ 2·N·(N−1)). This mirrors standard intercompany books and keeps the trail auditable.
- **Routing is upstream.** Orders/Payments own the product-catalog → company/account mapping and emit **split entries per account**, each stamped with a **source entity ID** that Accounting uses as the **linking key** to reassemble a logical multi-company transaction. The split happens upstream, so Accounting never decomposes a lump entry — which is *why* no centralized due-to/from is needed.
- **Internal follow-on (Block 3 cleanup):** the v2-proposed `AccountingService.recordCrossCompanySettlement()` and the new `JournalEntryLine.CounterpartyCompanyID` migration were predicated on Accounting doing the generation — **revisit / likely drop**: the counterparty is encoded by the chosen per-pair account, and linking is via the source-entity ref.

### C2 — Seeded COA size — RESOLVED (AD-8 stands; intercompany rows removed per C1)
Keep the ~12-account trim. Amith confirmed the *specific* seeded accounts don't matter — the master's 23 were illustrative. We will **generate our own test data** and validate changes against it (his explicit recommendation). The two **centralized** intercompany accounts drop out of the seed (per C1); intercompany accounts are per-pair.

### C3 — Account-balance snapshot tables — RESOLVED: DEFER (AD-12 stands)
The `AccountBalance*` materialization tables are deferred to post-v1; balances are computed on demand. This is a deliberate **transcript override of master BA-D22 / §4.10 / Phase E** (Amith: "I might kill this for the first version"). The master is superseded here.

### C4 — Branching model — RESOLVED: `next → main` (§10 stands)
Confirmed correct. `handoff-next-steps.md §5` ("feature → main") is **stale** and should be corrected.

### C5 — Batch summary granularity — OPEN (OQ-B)
Decided: batching **aggregates + locks** JE detail into a **summary** that posts to the GL, and Accounting stays the source of truth for the detail the GL no longer holds. **Undecided:** whether the summary groups **per-company** vs **per-account** (vs the account × dimension of AD-10). Pending Amith.

### New requirement surfaced — CFO batch approval via the Tasks app
A batch must be **approved before dispatch** to BC, via a **task created in the open-apps Tasks app** (`bizapps-tasks`, now dev-linked into this instance). The batch cannot move to `Sent` until the approval task is completed. Affects **Block 2 (batching)**. *TODO: read the `bizapps-tasks` docs in this instance and spec the integration before building Block 2.*

### Open questions to confirm with Amith
- **OQ-A — intercompany account provisioning.** How are the per-pair `Due To` / `Due From` accounts created and tracked? Amith indicated they must exist for every transacting company pair and be represented in **a table associated with `AccountingCompanyProfile`**. Confirm (a) the table / shape, and (b) **eager** provisioning (pre-create for all pairs) vs **lazy** (create on first intercompany entry) — leaning **eager**, since the DB-level invariants likely require the account to exist before a line can reference it.
- **OQ-B — batch summary granularity (C5).** Per-company, per-account, or account × dimension?

---

## 1. Context

`bizapps-accounting` is a MemberJunction Open App: the **AR subsidiary ledger of record + journal-entry primitives** for the Blue Cypress / MJ stack. It is **not a general ledger** — it summarizes and batches entries to an external ERP (Business Central is the live target). Upstream apps (BizAppsOrders, BizAppsContracts — not yet built) emit balanced JEs by calling into this app.

Amith's framing on the call drives everything: the core JE/batching engine is "the simplest part of the whole stack" but "needs to be really, really strong" because "constraints and rules have to be enforced all the way down at the database level." The headline business process is **batching** — group JEs, summarize them by account, lock them at the DB level, and post the summaries to BC while the subledger keeps the full provable detail. "This type of accounting system is really good if you want to have things buttoned up… it's the only one that's provable, because you can go back to the source transaction."

**Goal of v1:** a hardened, trigger-enforced AR subledger that BC consumes — JEs flow in, get batched and locked, post as account×dimension summaries to BC, with deferred-revenue rev-rec, multi-currency + intercompany, dimensions, and on-demand reporting. Good UIs for GL accounts, journal entries, and batching.

**What changed from the prior plan:** rebuilt from the transcript rather than deferring to the old master plan; PostgreSQL conversion moved to the final block; two new documentation conventions added (§8); intercompany, COA-seed, balance-materialization, rev-rec-boundary, agent-scope, and batch-granularity decisions re-derived from direct answers (§2).

---

## 2. Design decisions (AD-*) — the build's decision record

| # | Decision | Rationale (from transcript / analysis) |
|---|---|---|
| **AD-1** | **Subledger, not a GL.** We own AR / deferred revenue / sales-tax / FX subledger detail and batch summaries to BC. No trial balance / P&L / balance-sheet generation here. | "Your general ledger doesn't have all the details… it has the link back to the subledger." BC stays the GL ("a very important file cabinet"). |
| **AD-2** | **DB triggers enforce invariants; BaseEntity orchestrates; audit by construction.** Balanced-JE, post-batch immutability, period-close, batch-summary reconciliation enforced by triggers (un-bypassable even by elevated DB privilege). All app writes go through `BaseEntity.Save()` so `__mj.RecordChange` captures every mutation — no bare T-SQL INSERT, even seeds. | Amith: triggers over sprocs because "if someone has elevated privilege… they can bypass [a sproc], but if you do the trigger you can throw an exception." |
| **AD-3** | **JE lifecycle: `Pending → Batched → GLPosted`. Batching is the lock event.** Once batched/exported, the JE and its lines are immutable; related upstream systems must lock their source records too. | "Once we send that batch over to Business Central, we lock the data… and then the related systems have to be responsible for locking themselves down." Pen, not pencil. |
| **AD-4** | **Single-company JEs; intercompany = N JEs linked by `IntercompanyFlowID`.** Each company's legs are a separate balanced, per-company-numbered, per-company-batched JE. The "one multi-company transaction" is a read-model reassembly, not a single record. | Per-company JE numbering (`JE-{CompanyCode}-{FY}-{seq}`) and per-company batching (BC needs "one entity and book" per company) both require one company per JE. Keeps the core engine simple and strong. |
| **AD-5** | **⚠ SUPERSEDED — see Preface §C1.** Amith reversed this: balancing-leg generation lives **upstream** (Orders/Payments); Accounting only **receives + batches**. Centralized Due-To/Due-From is **vetoed** → **per-company-pair** accounts (4 per pair). _(Original v2 text retained below for history:)_ **Accounting auto-generates the intercompany balancing legs (Due-To / Due-From).** Upstream supplies the per-company *allocation*; Accounting owns the *mechanics* of emitting the paired balancing JEs (Dr Due-From on the owed company, Cr Due-To on the collecting company), linked by `IntercompanyFlowID`. Requires a `CounterpartyCompanyID` on `JournalEntryLine` (new migration). | "Intercompany balancing entries — we're going to generate them automatically." The allocation ("how much… if this is 100% one company") comes from the order/payment system; the balancing-entry generation lives here. |
| **AD-6** | **Functional-currency posting per company; realized FX auto-emitted on payment-vs-booking rate mismatch.** JE header has no currency; lines carry `OriginalCurrency/Amount/Rate`. Unrealized FX revaluation is a later period-close action (pairs with deferred balances). | Standard subledger multi-currency; Amith treats multi-currency/multi-company as the central complexity. |
| **AD-7** | **Currency is owned by `__mj_BizAppsAccounting`** (seeded ISO-4217), not Common. | "We decide currency going in accounting… it now lives in accounting" — it's a free OSS app, consumers depend on it. |
| **AD-8** | **Seed a MINIMAL starter COA (~12 accounts) + sync the rest from BC; lean on dimensions.** W1 seeds only the essential subledger accounts — including the **Commission Payable + Partner Rev Share Payable** accruals Amith's design names as in-scope; departmental/segment breakdown comes from dimensions, not COA explosion. The matching *expense* legs and AP / Bad-Debt / VAT / Refunds are **not** seeded — those are GL/P&L accounts that sync from BC. | Amith: "a radical simplification… lean on the GL more for really high-level stuff… use dimensions more"; full COA can be "sucked over" from BC. But his own scope (master ¶47 "commission accruals, partner rev share"), BA-D22 ("Commission Payable by Salesperson"), and OQ#7 name those two payables as AR-subledger accruals — so they stay. He flagged the chart as unsettled (OQ#6) and floated the minimal cut himself. |
| **AD-9** | **Dimensions are first-class but optional**, tagged at every stage (`JournalEntryLineDimension`, `ScheduledJournalEntryLineDimension`, `JournalEntryBatchLineDimension`) so analytical breakdown survives to BC. | "We do support dimensions… if we want departmental P&Ls then we need dimensions for that." Customer-segment-type analytics stay on the MJ side, not in the GL. |
| **AD-10** | **Batch summary granularity = GLAccount × dimension-combo × side.** One summary line per account×dimension; the `JournalEntryLine` detail stays for drill-through. | Aggregating by account alone ("10 debits to one account become one") but keeping dimension so BC can still produce departmental P&Ls. |
| **AD-11** | **Rev-rec is computed UPSTREAM; Accounting strictly persists + materializes.** `AccountingService.createScheduledJournalEntries()` accepts a fully pre-computed waterfall (count, front-loaded rounding, uneven-start/gap rules). The materializer turns due `ScheduledJournalEntry` rows into Pending JEs (Dr Deferred Revenue / Cr Revenue) at period close. Single-date deferral (event tickets) = `ScheduleCount 1`. | The subscription system (BizAppsOrders) owns rev-rec methodology; Accounting owns storage + materialization + the lockable audit trail. |
| **AD-12** | **Account-balance snapshot tables are DEFERRED to post-v1.** Balances computed on demand from `JournalEntryLine` via read-model views. The `AccountBalance*` tables exist in the schema but stay unused in v1. | Amith: "I actually think I might kill this for the first version." Keeps v1 lean; add materialization only if read performance demands it. |
| **AD-13** | **Hard period close.** Close = validate prerequisites (no Pending JEs, all batches Acknowledged) + lock. No balance materialization in v1 (AD-12). Reopen requires admin role + reason + audit entry. Adjusting entries post to the next open period with `OriginalAccountingPeriodID`. | Standard discipline; "adjusting entries, right?… you want to trace everything back." |
| **AD-14** | **ERP integration via MJ Actions; `AccountingService` is a thin direct-import façade; NO AI agents in v1.** Reuse MJ's BC inbound actions; build a new BC outbound JE-post action. `AccountingService` (in `CoreEntitiesServer`) is stateless, per-call `contextUser` — not a singleton/engine. | Actions are for integration edges, not internal calls. Transcript is entirely about the deterministic hardened core; agents come later. |
| **AD-15** | **Soft-refs only to downstream apps.** `JournalEntry.OrderID/PaymentID/SubscriptionID/…` and `JournalEntryLink` (polymorphic `EntityID` + `RecordID`) are plain UUIDs Accounting stores blindly — no hard FKs into BizAppsOrders/Contracts. | "It comes from multiple different sources… could be any system." Lineage without coupling; this is how provability is achieved. |
| **AD-16** | **`OperatingTimeZone` on `AccountingCompanyProfile`** (already in the schema). All storage is UTC/Zulu; period & rev-rec boundaries are evaluated in the company's zone. | "Everything's in Zulu, but it translates [to] the company['s zone]… track the company's operating time zone." |
| **AD-17** | **DB invariants get automated regression tests (Vitest), not just demos.** Each invariant (the 14 triggers + the 2 numbering sprocs) has a test that *attempts the violation* — including via **raw SQL that bypasses all app validation** (the elevated-privilege threat model) — and asserts the DB rejects it, plus the legitimate counter-case that must still succeed. Runner is **Vitest** (the repo standard); DB-level cases run against a fresh-migrated test DB. See §11.1. | The system's entire value is un-bypassable invariants (AD-2); a trigger that silently breaks is a financial-integrity hole. `validate-hooks.ts` only checks `@RegisterClass` name resolution — it does **not** prove the triggers fire. |

---

## 3. Required features from the transcript → status

| Feature (transcript) | In v1? | Current state |
|---|---|---|
| GL accounts (minimal seed + BC sync, dimension-led) | ✅ Block 0/5 | Schema ✅; trim seed 23 → ~12 (AD-8); keep Commission/Partner-Rev-Share Payable accruals |
| Journal Entry / Line / Line-Dimension, double-entry balanced | ✅ Block 1 | Schema ✅ + balanced trigger ✅ |
| JE lifecycle + DB-level immutability after batch | ✅ Block 1/2 | Triggers ✅; W4–W6/W9 hooks ⏳ |
| Batching → account×dimension summary lines → lock | ✅ Block 2 | Schema ✅; dispatch engine ⏳ |
| Provenance / drill-back (subledger detail ↔ GL summary) | ✅ Block 2/7 | `JournalEntryLink` ✅; views/UI ⏳ |
| Business Central integration (export batch, sync COA, OAuth) | ✅ Block 2 | Reuse MJ inbound actions; BC outbound greenfield |
| Multi-currency + realized FX on payment | ✅ Block 1/3 | Schema ✅; W5 ⏳ |
| Intercompany: per-company JEs + auto Due-To/Due-From | ✅ Block 3 | Needs `CounterpartyCompanyID` migration + engine |
| Deferred revenue / rev-rec waterfall (persist + materialize) | ✅ Block 4 | `ScheduledJournalEntry*` schema ✅; materializer ⏳ |
| Operating timezone on company | ✅ Block 0 | Already in schema (AD-16) |
| Dimensions for departmental P&L | ✅ Block 5 | Schema ✅; analytics ⏳ |
| Chart-of-accounts mapping (non-1:1 via dimensions) | ✅ Block 2/5 | Schema ✅; enforcement ⏳ |
| Good UIs (GL accounts, JEs, lines, batching) | ✅ Block 1/2/4 | Only generated forms exist |
| Sample/seed data (deterministic UUIDs, Assoc-Demo-V2 stack) | ✅ Block 4 | ⏳ |
| Tax (pluggable, opt-in) | ➖ Block 6 (tail) | Schema ✅; provider ⏳ |
| Open-AR cutover import from BC | ➖ Block 8 (tail) | ⏳ |
| Account-balance snapshots | ❌ deferred (AD-12) | Tables exist, unused |
| AI agents | ❌ deferred (AD-14) | — |
| PostgreSQL migrations | ⏳ Block 9 (LAST) | Only README exists |

---

## 4. Target architecture (layered)

```
┌─ UI (apps/MJExplorer) ── standalone Angular: GL tree, JE list/detail, Batch review/dispatch, COA-mapping
├─ Integration edge (packages/Actions) ── MJ Actions: BC COA-sync (reuse), BC batch-post (new), QBO (reuse)
├─ Service façade (packages/CoreEntitiesServer/AccountingService.ts) ── thin, stateless, contextUser-per-call
│     postJournalEntry(s) · reverseJournalEntry · getPeriodStatus · getMappedGLAccount
│     createScheduledJournalEntries (AD-11) · recordCrossCompanySettlement (AD-5)
├─ Lifecycle hooks (packages/CoreEntitiesServer/*EntityServer.ts) ── W1–W9 BaseEntity.Save() overrides
├─ Scheduled Actions (packages/CoreEntitiesServer or Actions) ── S1 batch dispatch · S3 rev-rec materializer · (later) FX reval, ack poller
├─ Entities (packages/Entities, generated) ── one BaseEntity subclass + Zod per schema table (verify count after codegen)
└─ DB invariants (migrations) ── 14 triggers + 2 atomic numbering sprocs  ◄── the un-bypassable floor
```

**Core entity set (built, schema correct):** `GLAccount`, `AccountingCompanyProfile` (IS-A child of `__mj.Company`), `AccountingPeriod`, `JournalEntry`/`JournalEntryLine`/`JournalEntryLineDimension`, `JournalEntryBatch`/`JournalEntryBatchLineItem`/`JournalEntryBatchLineDimension`, `JournalEntryLink`, `ScheduledJournalEntry`(+Line+LineDimension), `Dimension`/`DimensionValue`, `ChartOfAccountsMapping`, `Currency`/`CurrencySpotRate`, Tax suite, `AccountBalance`/`AccountBalanceByDimension` (unused in v1 per AD-12), 2 numbering sequences.

**Schema deltas this plan introduces (new migrations only — baseline is frozen):**
1. **`JournalEntryLine.CounterpartyCompanyID UUID NULL`** — for the intercompany balancing engine (AD-5). Block 3.
2. **W1 seed change** is code-only (`SeedData.ts`), not schema (AD-8).
3. No other schema changes anticipated for v1.

---

## 5. Current state inventory

| Layer | State |
|---|---|
| **Schema** (`migrations/B202605281200__v0.1.0…`) | ✅ Complete & correct (28 tables, 14 triggers, 2 sprocs). **Frozen.** Includes `OperatingTimeZone` (line 201). |
| **Generated code** (Entities/resolvers/forms) | ⚠️ **STALE** — still emits dropped `Recurring*`; missing `ScheduledJournalEntry*`/`JournalEntryBatchLineItem*`. Needs `mj codegen`. |
| **Baseline self-containment** | ⚠️ Folded codegen SQL stripped in PR #5 → `mj migrate` yields tables but no `vw*`/metadata. Re-fold after clean codegen. |
| **W1/W2/W3 hooks** (`CoreEntitiesServer`) | 🚧 Implemented, **untested**. W1 currently seeds 23 accounts → trim to minimal per AD-8. |
| Actions / `AccountingService` / W4–W9 / S1–S7 / `vw_*` / custom UI / PG migrations | ❌ Not built (PR #8 has stale drafts of some). |

---

## 6. PR #8 disposition — cherry-pick after codegen regen

Keep `feat/handoff-parts` as a reference; **do not fix in-branch, do not merge.** It was written against the stale generated entities, so once codegen drops `Recurring*` its imports break — fixing it in place means re-fixing every compile break. After Block 0 regenerates codegen, cut fresh branches from `next` and port the good parts against correct types, then close PR #8.

- **Salvage:** `AccountingService.CreateJournalEntry()` via `TransactionGroup`; W7 prerequisite-check structure; `scripts/validate-hooks.ts` (extend to assert every `@RegisterClass` entity-name resolves to a `__mj.Entity` row — run in CI).
- **Fix while porting:** `any` → typed interfaces; `console.log` → `LogStatus`; W4 must *error* when `OriginalAccountingPeriodID` is null (not silently re-route); W5 belongs on the `JournalEntryLine` save path inside the header's transaction group (so the deferred balanced-JE trigger doesn't fire mid-build); W6 must save reversal lines; replace hardcoded `'USD'` with ACP `FunctionalCurrencyCode`; move `AccountingService` to `CoreEntitiesServer`.
- **Discard:** the two placeholder AI agents (AD-14), the ack-poller stub, and the `package-lock.json` churn.

---

## 7. MJ Open-App standards (mirror `bizapps-common`)

- **5-package layout:** `Entities` / `Actions` / `Server` (bootstrap + generated resolvers) / `Angular` / **`CoreEntitiesServer`** (hand-written server hooks + `AccountingService`). All five already exist.
- **Generated vs hand-written:** never edit `**/generated/`; CodeGen overwrites. Hand-written lives in `custom/`, `components/`, `*EntityServer.ts`, `config.ts`, `index.ts`.
- **`@RegisterClass` + import order:** generated entities register first, server subclasses after (higher auto-priority wins). Entity-name strings are inlined and must exactly equal `__mj.Entity.Name` (`MJ_BizApps_Accounting: <Name>`) — a typo is a silent runtime no-op (guard via the validate-hooks script).
- **Data access:** `Metadata.GetEntityObject<T>(name, contextUser)` (never `new`); `RunView`/`RunViews` (check `.Success`); `{...e.GetAll()}` (never spread a BaseEntity); `TransactionGroup` for atomic header+lines.
- **Actions only at integration edges**; internal calls use direct imports. No `any`. Functional decomposition (~30–40 line fns). PascalCase public / camelCase private.
- **Angular:** standalone + `@if`/`@for` + `inject()`; `<mj-loading>`; confirm-left/cancel-right.
- **Migrations:** T-SQL source of truth; new schema = new migration (baseline frozen); CodeGen owns `__mj_CreatedAt/UpdatedAt` + FK indexes + views + CRUD sprocs.

---

## 8. Documentation conventions (NEW — required deliverables)

Both are part of every block's **Definition of Done**, not an afterthought.

### 8.1 Connection tags (in-code, per file/section)
Every new or substantially-changed hand-written file gets a top-of-file `CONNECTS TO` block so a debugger can trace a behavior across layers (DB ↔ hook ↔ service ↔ action ↔ UI) without reverse-engineering it. Greppable, fixed labels:

```typescript
/**
 * JournalEntryEntityServer — pre-save lifecycle hooks for Journal Entries (W2/W4/W6/W9).
 *
 * CONNECTS TO:
 *   CALLED BY:   AccountingService.postJournalEntry · BatchDispatchAction · S3 materializer
 *   CALLS:       SequenceService.getNextJournalEntryNumber → spAssignNextJournalEntryNumber (DB sproc)
 *   DB TRIGGERS: trg_JournalEntry_BalancedOnLock · trg_JournalEntry_Immutability · trg_JournalEntry_PeriodClose
 *   SIBLINGS:    JournalEntryLineEntityServer (W5 FX) · AccountingPeriodEntityServer (period status)
 *   WRITES:      __mj.RecordChange (audit-by-construction)
 *   ENTITY:      'MJ_BizApps_Accounting: Journal Entries'
 *   DOC:         docs/ARCHITECTURE.md#je-lifecycle
 */
```
For non-trivial methods, a one-line inline tag (`// CONNECTS: → trg_JournalEntry_BalancedOnLock; balance must hold before Status flips to Batched`) at the connection point. SQL trigger/sproc headers get the same block in `--` comments. Angular components list the service(s) and entity(ies) they bind to.

### 8.2 Central architecture doc (`docs/ARCHITECTURE.md` — new `docs/` folder)
One living document explaining the system to someone who wasn't in the build. Sections, each updated as a block lands:
1. **System overview & boundaries** — what we are / aren't (AD-1), the dependency stack, the data-flow (upstream emits → batch → BC; subledger keeps detail).
2. **Layered architecture** — the §4 diagram + how a write travels DB-trigger ↔ hook ↔ service ↔ action ↔ UI.
3. **Design patterns used** — audit-by-construction (AD-2), trigger-enforced invariants vs orchestration, `@RegisterClass` override ordering, soft-ref/`JournalEntryLink` lineage (AD-15), single-company-JE + flow-link (AD-4), pluggable providers (currency/tax), thin façade (AD-14).
4. **Key decisions** — the AD-* table (§2) with rationale, so future devs know *why*.
5. **Key code sections** — a map: "to change batching, see `BatchDispatchAction` + `trg_JEBatch_SummaryReconciles` + `JournalEntryBatchLineItem`"; one row per capability.
6. **Connection map** — a high-level diagram of which modules touch which, mirroring the in-code tags.

---

## 9. Phased build roadmap (transcript-driven; PG conversion is LAST)

Each block ≈ a 2-week sprint shipping a demoable increment. Owners: **M** = Marcelo (server/hooks/engine), **MH** = Madhav (UI + BC). **Definition of Done for every block:** code compiles (`npm run build` in the touched package) · §8.1 connection tags on new/changed files · relevant `docs/ARCHITECTURE.md` section updated · **every DB-invariant / hook / service behavior in the block's acceptance gate is an automated Vitest test (AD-17, §11.1) — including a raw-SQL bypass case per invariant — not a manual demo; UI and external-integration (BC sandbox) gates may stay demo where automation isn't feasible** · acceptance gate met · feature PR → `next`.

### Block 0 — Foundation hardening (PREREQUISITE GATE)
1. Sync `origin/next` with `main` (it's behind) so feature branches cut from a current `next`.
2. Clean setup in the exact order in §11 (re-assert `entityPackageName` *string* after `mj app install`; fix `schema-info` sync before first codegen).
3. `mj codegen` → regenerate the full entity set (drops the 3 `Recurring*`; adds `ScheduledJournalEntry*` + `JournalEntryBatchLineItem*`). Verify `entity_subclasses.ts` is non-empty and emits one `@RegisterClass` per current-schema table — **reconcile the actual count against the schema; don't force a magic number** (the handoff cited 27 pre-rev-rec; the post-redesign count will differ — the gate is "the right entities for the current schema").
4. **Trim W1 seed to the minimal COA (AD-8)** in `SeedData.ts` (~12 accounts, see below) and default `OperatingTimeZone='UTC'`.
5. Verify W1/W2/W3 fire (seed counts, numbering formats, `RecordChange` rows). Fix any `@RegisterClass` name mismatches.
6. Fold generated SQL into a new migration (`B<ts>__v0.1.1__folded_codegen.sql`) so `mj migrate` is self-contained.
7. Seed `docs/ARCHITECTURE.md` skeleton (§8.2) + establish the connection-tag convention.
- **Minimal COA (AD-8) — 12 accounts:** 11101 Operating Cash · 11201 Accounts Receivable · 11211 AR-Intercompany (Due-From) · 21201 Sales Tax Payable · 21301 Deferred Revenue · **21401 Commission Payable** · **21402 Partner Rev Share Payable** · 21501 Intercompany Payable (Due-To) · 40100 Sales Revenue · 40200 Subscription Revenue · 50400 Realized FX Gain/Loss · 50500 Unrealized FX Gain/Loss. (Wires the 5 default ACP GL refs.)
  - **⚠ 2026-06-28 update — see Preface §C1:** the two **centralized** intercompany accounts above (`11211 AR-Intercompany (Due-From)`, `21501 Intercompany Payable (Due-To)`) are **removed** — intercompany uses **per-company-pair** Due-To/Due-From accounts (4 per pair, provisioned per OQ-A), with the legs generated **upstream** (Orders/Payments), not by Accounting. A single-company test seed needs no intercompany account (base ≈ 10).
  - **Why these 12:** Commission Payable + Partner Rev Share Payable are kept because Amith's design treats commission & partner-rev-share accruals as AR-subledger-origin JEs (master ¶47, BA-D22, OQ#7) — don't re-trim them. The matching *expense* legs (50100/50200), plus AP (21101), Bad Debt (50300), VAT (21202), and Refunds (90100), are intentionally dropped per AD-1 (not a GL) — their JE legs resolve to BC-synced accounts.
  - **Heads-up:** no v1 transaction actually posts to Commission/Partner-Rev-Share Payable — the JEs that use them originate upstream in BizAppsOrders (not yet built). Seeding them now is correct, harmless, and matches the design; just expect them to sit unused until Orders exists.
- **Demo:** create a profile in Explorer → minimal COA + periods seeded → post a balanced JE → numbering works.

### Block 1 — JE lifecycle hooks + core read UIs
- **M (`CoreEntitiesServer/`):** W4 adjusting-entry routing (error if `OriginalAccountingPeriodID` null on a closed period; else route to next open period); W5 realized-FX auto-emit (on `JournalEntryLine` save, in the header's transaction group → ACP `RealizedFXGainLossGLAccountID`); W6 `generateReversal(reason, ctx)` (swap Dr/Cr, back-reference, **save lines**); W9 attachment validation; F1 `validateJournalEntry()` guard (balance, GL active, period open).
- **M (tests):** **stand up the invariant test harness (§11.1)** here, with the first behavior — first suites: balanced-JE-on-lock, JE/line immutability, period-close. This is where AD-17 becomes real; every later block extends the matrix.
- **MH (`apps/MJExplorer/`):** GL Account tree (parent/child, type filter, status, company selector); JE list (number/date/type/status chip, totals, linked entity via `JournalEntryLink`; read-only for Batched/GLPosted).
- **Demo + tests:** W4 blocks a closed-period post; W6 produces a back-referenced reversal; multi-currency payment auto-adds an FX line; UIs render correct states. Invariant suites for balanced-JE, immutability, and period-close pass (DB-bypass + app-path + allowed counter-case).

### Block 2 — Batching + Business Central integration (HEADLINE)
- **M:** S1 batch-dispatch Scheduled Action — group Pending JEs by `(Company, Period, TargetSystem)` → create `JournalEntryBatch` → build `JournalEntryBatchLineItem` summary lines at **account × dimension × side** (AD-10) → flip JEs to Batched (triggers reconcile + freeze). W7 period-close = validate prerequisites + lock (no materialization, AD-12/AD-13); W8 reopen (admin + reason + audit). `AccountingService` skeleton in `CoreEntitiesServer` (`postJournalEntry(s)`, `reverseJournalEntry`, `getPeriodStatus`, `getMappedGLAccount`; calls F1).
- **MH:** resolve MJ version skew (actions `5.41.0` vs app `5.38.0`) first; **reuse** MJ `actions-bizapps-accounting` BC inbound for COA sync → `GLAccount`; build a **new BC outbound JE-post Action** (shape from QBO `create-journal-entry`, auth from `business-central-base.action.ts`); batch review/dispatch UI; `ChartOfAccountsMapping` UI with admin Approve (unmapped GL = hard-fail at batch time).
- **Demo:** Pending JEs → batch → summaries foot to control totals → POST to BC sandbox → Acknowledged flips JEs to GLPosted; editing a Batched JE is trigger-blocked.

### Block 3 — Intercompany balancing engine + multi-currency core (AD-4/AD-5)
- **M:** new migration adding `JournalEntryLine.CounterpartyCompanyID`; `AccountingService.recordCrossCompanySettlement(allocation, ctx)` — given the collecting company's payment JE + the per-company allocation, auto-generate the paired Due-To / Due-From single-company JEs linked by `IntercompanyFlowID`; finalize realized-FX interplay with intercompany legs.
- **Demo:** a $120K payment to Blue Cypress settling $100K Izzy + $20K Sidecar → Accounting emits the Due-To Sidecar / Due-From Blue Cypress legs automatically; later settlement washes them out; all reassemble by `IntercompanyFlowID`.

### Block 4 — Scheduled rev-rec (persist + materialize) + sample data
- **M:** `AccountingService.createScheduledJournalEntries(prebuiltWaterfall, ctx)` — strictly persist an upstream-computed schedule (AD-11), `ScheduleCount 1` = single-date deferral; S3 materializer Scheduled Action — due `Scheduled` rows → Pending JEs (Dr Deferred Revenue / Cr Revenue), copy lines+dimensions, set `GeneratedJournalEntryID`, flip to Generated (trigger locks).
- **MH:** `AssociationDemoSeedData.ts` — 3–5 companies w/ ACPs (triggers W1), sample JEs across periods, a deferred-revenue waterfall, **deterministic static UUID constants**, idempotent; JE detail UI (header, lines w/ dimension chips, status timeline, "Generate Reversal" only for GLPosted).
- **Demo:** persist a 12-month waterfall (rounding front-loaded in entry 1) → close successive periods → each scheduled row materializes into a Dr DefRev / Cr Revenue JE; seed data loads idempotently.

### Block 5 — Dimensions analytics + COA-mapping polish
- Dimension management UI; tag JE lines; dimension filters; finalize the cash-allocation-by-dimension story (the `11101` multi-use case is dimensions, not extra COA rows). COA-mapping approval workflow hardening.

### Block 6 — Read-model views + reporting
- All `vw_*` views (on-demand balances since snapshots are deferred): `vw_TrialBalance_AR`, `vw_AROpenByCustomer`, `vw_ARAging`, `vw_DefRevRollforward`, `vw_SalesTaxLiability`, `vw_ARtoGLRecon`, `vw_DimensionPL`, `vw_FxExposure`, `vw_JEAuditTrail`, **`vw_IntercompanyFlow`** (reassemble legs by `IntercompanyFlowID`). Skip-generated interactive reports.
- **This is the v1-for-BC line.** Blocks 0–6 deliver the consumable subledger.

### Block 7 — Tax (pluggable, opt-in) *(tail)*
- `TaxCalculationProvider` abstract + `LocalTaxCalculationProvider` default; Avalara/TaxJar adapters; S5 rate sync; tax JE patterns. Calculation itself runs upstream calling the provider.

### Block 8 — Orders integration surface + open-AR cutover *(tail)*
- Document/finish the `AccountingService` contract for BizAppsOrders (Order Post, Payment Capture, Subscription rollover, Reversal, intercompany legs). Open-AR cutover import from BC (apply new-system payments to pre-cutover invoices). Optionally revisit balance snapshots / unrealized-FX reval if reporting performance demands (AD-12).

### Block 9 (FINAL) — PostgreSQL conversion
Done **after** the schema and codegen-folded migrations are finalized for the release PR, so we convert once against stable SQL.
- Convert every `migrations/*.sql` to `migrations-pg/` via `mj sql-convert … --schema __mj_BizAppsAccounting`; add the pg-migrate stub that points at the MJ repo's pg-migrate command; wire `.github/workflows/pg-migrations.yml` to validate the PG output applies cleanly to a fresh PG 17 DB. Never hand-edit converted files — fix the converter rule and re-convert.

---

## 10. Branching & workflow

`next → main` two-tier (locked):
- **First** sync `origin/next` with `main` (behind) — no feature branch is valid until then.
- Cut feature branches from `next`; push `-u origin/<same-name>`; one PR per block/work-item → `next`.
- Single coordinating release PR `next → main` triggers publish.
- Retarget PR #8's ported work to `next`.
- **Update the stale docs:** `handoff-next-steps.md §5` and `sprint-plan-v1.md` say `feature → main` and call CLAUDE.md stale — correct them to `next → main`.

---

## 11. Verification

**Clean local setup (exact order — gotchas bite if reordered):**
```bash
mj migrate -t v5.38.0                                          # 1. MJ core
mj app install https://github.com/MemberJunction/bizapps-common \
    --dangerously-ignore-dbl-underscore-schema-rule            # 2. common
#   → RE-ASSERT entityPackageName: '@mj-biz-apps/accounting-entities' (STRING) in mj.config.cjs
#   → push metadata/schema-info BEFORE first codegen (or align the file's hardcoded ID)
mj migrate --schema __mj_BizAppsAccounting --dir migrations    # 3. app schema
mj codegen                                                     # 4. entities + views (verify 28 entities, non-empty)
mj sync push --dir metadata                                    # 5. Currency seed
npm run build && npm start                                     # 6. all packages → :4102 API + :4302 Explorer
```

### 11.1 Invariant test harness (AD-17)
Runner: **Vitest** (repo standard — `apps/MJAPI` already uses it; the per-package `"test": "echo …"` placeholders get replaced as suites land). Add a root `test:invariants` script and run it in CI. **Establish the harness in Block 1** (first real write behavior); grow it one invariant per block as behavior is added.

DB-level triggers need a live SQL Server, so these are **integration tests** against a fresh-migrated test DB (dedicated DB name via env; CI migrates clean and drops after; locally, transaction-wrap where the trigger fires per-statement). **Timing differs per invariant:** most immutability / period-close triggers fire per-statement, but the **balanced-JE check fires on lock (the `Status → Batched` flip), not per-line — deliberately, so a multi-line JE can be assembled incrementally**. Its test must build all lines first, then flip status, and assert the rejection at *that* transition (a Block 1 detail, not Block 0). Each invariant gets **three** cases:
1. **DB bypass (the critical one):** raw SQL via `SQLServerDataProvider.ExecuteSQL` that skips all app validation — the elevated-privilege threat model — and asserts the trigger raises. This is what `validate-hooks.ts` cannot prove.
2. **App path:** `Metadata.GetEntityObject` + `.Save()` asserts the hook/validator surfaces a clean error *before* the DB fires.
3. **Allowed counter-case:** the legitimate operation still succeeds (e.g., GL-roundtrip fields *are* updatable on a Batched JE; an adjusting entry *with* `OriginalAccountingPeriodID` posts).

**Invariant matrix (one suite per row):** balanced-JE-on-lock · JE-line recheck-balance-on-locked-parent · JE immutability (UPDATE/DELETE + status-regression, allowing only GL-roundtrip fields) · JE-line immutability · period-close (block insert into a Closed period without `OriginalAccountingPeriodID`) · batch immutability after Sent/Acknowledged · batch-summary reconciles-to-control-totals at dispatch · batch-line + batch-line-dimension immutability · scheduled-JE + scheduled-line immutability-once-Generated · ACP no-chains · period no-overlap · reversal consistency · gap-free numbering sprocs (concurrent assignment → no gaps/dupes). Tests live in `packages/CoreEntitiesServer/src/__tests__/` (hook/service) + a DB-integration suite.

**Per-block acceptance gates** (key ones — implemented as §11.1 tests where they assert an invariant/behavior):
- **Block 0:** generated entity set matches the current schema (no `Recurring*`; has `ScheduledJournalEntry*`/`JournalEntryBatchLineItem*`) — **count reconciled to the schema, not forced to a number**; W1 seeds the ~12-account minimal COA (incl. Commission Payable + Partner Rev Share Payable) + 17 periods + 5 GL refs + `OperatingTimeZone`; numbering formats correct; `RecordChange` present; a fresh `mj migrate` (post-fold) yields a working schema with no separate codegen step.
- **Block 2:** batch summaries foot to control totals (trigger passes); batch POSTs to BC sandbox; Acknowledged flips JEs to GLPosted; Batched JE edit is trigger-blocked.
- **Block 3:** cross-company settlement auto-emits balanced Due-To/Due-From legs; legs reassemble by `IntercompanyFlowID`.
- **Block 4:** materializer turns due scheduled rows into Pending JEs; 12-month waterfall persists with front-loaded rounding.
- **Cross-cutting:** the invariant suite (§11.1) + extended `scripts/validate-hooks.ts` (asserts every `@RegisterClass` entity-name resolves to a `__mj.Entity` row) both run in CI. Every PR includes connection tags (§8.1) + the relevant `docs/ARCHITECTURE.md` update (§8.2) + the automated tests for any invariant/behavior it touches (AD-17).

---

## 12. Open questions for Amith

1. **Intercompany allocation contract** — what exactly does the upstream caller hand `recordCrossCompanySettlement`? (per-company amounts only, or the settled-AR-line references?) Drives the AccountingService signature (Block 3).
2. **Counterparty tracking** — (a) a `CounterpartyCompanyID` column (recommended) vs a "Counterparty Company" dimension; and (b) **line-level vs header-level placement** — header is simpler when a JE settles a single counterparty, but line-level is required if one JE mixes counterparties (lean line-level for generality). (Block 3 migration)
3. **BC version target** — bump app to MJ 5.41.x to match `actions-bizapps-accounting`, or pin a 5.38-compatible actions build? (Block 2 blocker)
4. **Minimal COA contents** — your master-plan OQ#6 flagged the seeded chart as unsettled (you leaned full); v2 trims to a minimal AR-subledger set (~12). We're aligned dropping AP / Bad Debt / VAT / Refunds and the commission/partner *expense* legs per the not-a-GL scope, and we **kept** Commission Payable + Partner Rev Share Payable since your design (master ¶47, BA-D22, OQ#7) names them as in-scope accruals. Confirm: keep those two seeded — and is seeding Cash / Subscription Revenue right vs syncing them from BC?
5. **Open-AR cutover** — import open BC invoices pre-go-live (so payments apply in the new system) vs let pre-cutover AR close out in BC? (Block 8 scope)
6. **Manual-JE approval** — require approval before a `Manual` JE can be Batched (MJ `ApprovalRequest`)? (affects Block 1/2)

---

## 13. Critical files

| Purpose | Path |
|---|---|
| Frozen baseline schema (28 tables, 14 triggers, 2 sprocs) | `migrations/B202605281200__v0.1.0__Schema_and_Tables.sql` |
| Server hooks + `AccountingService` (W1–W3 done; W4–W9 + façade + engines here) | `packages/CoreEntitiesServer/src/` |
| Invariant + hook tests (Vitest, AD-17 / §11.1) | `packages/CoreEntitiesServer/src/__tests__/` + DB-integration suite; root `test:invariants` script |
| Minimal-COA seed (AD-8) | `packages/CoreEntitiesServer/src/SeedData.ts` |
| Generated (regenerate, never hand-edit) | `packages/{Entities,Server,Angular}/src/**/generated/` |
| CodeGen + open-app config (`entityPackageName` string!) | `mj.config.cjs`, `mj-app.json`, `codegen-schema-info.json` |
| MJ BC/QBO integration actions (reuse inbound; model BC outbound on QBO) | `…/MJ/packages/Actions/BizApps/Accounting/` |
| **NEW central design doc** | `docs/ARCHITECTURE.md` |
| New Angular UIs | `apps/MJExplorer/src/app/<feature>/` (standalone) |
| New migrations (incl. `CounterpartyCompanyID`); PG conversion LAST | `migrations/B<ts>__v0.1.<n>__<desc>.sql`; `migrations-pg/` (Block 9) |
