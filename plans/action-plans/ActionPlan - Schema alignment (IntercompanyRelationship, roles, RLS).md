# Plan — Schema alignment: intercompany disposition, roles/RLS, trigger audit

> **Status:** Draft (awaiting Marcelo review) · **Created:** 2026-07-11 · **Revised:** 2026-07-13
> (A1 re-scoped — see the ⚠ correction note in A1)
> **Implements:** MASTER-PLAN-MODIFICATIONS MOD-5(c) (intercompany wiring is OUT of accounting — verify +
> document), MOD-9 (roles + RLS), and a trigger/enforcement alignment audit against MASTER-PLAN §5 as
> overlaid by MOD-1/MOD-3.
> **Sources:** MOD-5 (carries the Amith OQ-A reference schema; source rulings in
> `meetings/2026-06 - Amith rescope rulings (extracted from retired v2 plan).md`), the baseline
> `migrations/B202605281200` **fold header** (the 2026-07-06 wiring-drop ruling, ~lines 2377/2385),
> `V202607081600` (lock rework), MASTER-PLAN §5, meetings/2026-07-09-robert-meeting-decisions.md (D1),
> the 2026-07-10 gap analysis §3.
> **Companions:** orders repo `ActionPlan - Schema alignment with master plan (O1-O5).md` (the O-side —
> intercompany wiring lands THERE, with Payments/O2);
> `ActionPlan - Feature build (batching, reporting, materialization).md`.

## 0. Scope

The accounting schema is broadly plan-aligned (28 tables, invariant triggers, read-model views). Four
targeted work items — no broad rework; A4 is (post-MOD-12) the one new accounting migration:

- **A1** — intercompany wiring **disposition** (verified OUT of accounting; document + carry forward).
- **A2** — roles + entity permissions + RLS seeding (MOD-9; master plan was silent on permissions).
- **A3** — enforcement/trigger alignment audit (verify what's built matches the overlaid plan; explicitly
  build NOTHING period-related — CA-1 resolved-for-now, no period machinery).
- **A4** — single-company JE restoration (MOD-12): `JournalEntry.CompanyID` + validation + numbering.
- **A5** — manual period close (MOD-13): close table + date-check trigger + close/reopen actions.

Ground rules identical to the orders schema plan (new V* file if one is ever needed, T-SQL source of
truth + PG conversion, no CodeGen-owned artifacts, extended properties, migrate → codegen → build →
commit together, **update `docs/bizapps-accounting-erd.md` in the same change** — repo convention).

---

## A1 — Intercompany wiring disposition (VERIFIED: not accounting's to build)

> ⚠ **CORRECTION 2026-07-13 (Marcelo caught it):** the original draft planned an
> `IntercompanyRelationship` migration + two triggers + an eager provisioning hook here. That
> **contradicted the 2026-07-06 baseline squash ruling**: the table had been created then DROPPED
> (net-zero) in the former `Intercompany_And_CFOApproval` migration and was deliberately OMITTED from
> the folded baseline — *"Accounting does no intercompany balancing; the Payments component owns
> due-to/due-from"* (`B202605281200` fold header). MOD-5(c) is corrected; this section is re-scoped to
> what remains true.

What A1 now is:

1. **Documentation:** record the disposition in `docs/bizapps-accounting-erd.md` (a "deliberately absent"
   note next to the intercompany section) so nobody re-adds the table accounting-side. The per-pair
   Due-To/Due-From CONCEPT (Amith's veto of centralized accounts) stands; when Payments builds the wiring,
   the per-pair accounts will still materialize as `GLAccount` rows here (accounting owns COA *storage*)
   — but Payments defines and drives them.
2. **Carry-forward:** the Amith OQ-A reference schema lives in MOD-5; the orders schema plan (S2 design
   notes) points at it for the Payments/O2 design. Residual design question = QUESTIONS **Q20 residual**
   (where the wiring table lives + the account-provisioning mechanism into the COA — settle at O2 design,
   with an Amith sanity check).
3. **Nothing else.** No migration, no `trg_ICR_*` triggers, no provisioning hook, no COA seed growth
   accounting-side. (The former Q2/Q3/Q4 questions below are struck accordingly.)

---

## A2 — Roles, entity permissions, RLS (MOD-9) — *Marcelo review feedback applied 2026-07-13*

**Co-design checkpoint with Marcelo before executing** (MOD-9 instruction). The framing rule (Marcelo):
**triggers are invariants that enforce audit integrity; roles are the SECURITY layer that limits who can
edit what** — roles must be secure in design and use MJ's existing formation/structure, never a parallel
system.

**A2.0 — Research pre-steps (Marcelo directive: "go look in MJ" BEFORE designing — don't recreate
existing features):**
- **R1 — Row scoping:** does MJ already have a good/efficient system for company-scoped row visibility?
  Evaluate the entity-permission RLS layer (`getRowLevelSecurityWhereClause`) for efficiency at our
  volumes ("this smells like an inefficient approach" — verify or refute with the guide + code), and
  whether the Unified Permissions / Authorizations model offers a better fit.
- **R2 — Role management + user↔company linkage:** does MJ already ship a role-management screen? Are
  Users/Persons already linkable to companies (bizapps-common `Person`/`Organization`/`__mj.Company`,
  employment relationship?) — and via what mechanism?
- **R3 — Approver security model:** is the person→company linkage a SECURE, gateable action in the
  underlying architecture, or merely informational? This decides the approver design (see A2.4/routed
  D-Q1): Marcelo's concern — with a role+company approach, *which company a person is linked to becomes
  load-bearing for security* (an admin of company A must not be able to link themselves to company B and
  approve its batches). If linkage isn't securable, the invariant must live in a direct schema link we
  control (the as-built `ApprovalCFOPersonID` pattern).

Deliverables (post-research):

1. **Roles** (seeded via metadata folder, not SQL INSERTs — MJ convention): **Accounting User** (JE browse,
   create Pending JEs, view batches/reports), **Accounting Admin** (COA, company profiles, dimensions,
   GLAccountLink mapping, batch build/regenerate, remittance, role assignment), **Accounting Approver**
   (**RESOLVED — Marcelo 2026-07-13: approver IS a role**, and **only Admin may assign it**). The
   designated-approver LINK is **RESOLVED too (Q17): `__mj.User`** — the as-built `ApprovalCFOPersonID`
   (FK Person) migrates to `ApprovalCFOUserID` (A4.6) and the bizapps-tasks gate drops its
   Person→LinkedUserID indirection. R3 still governs the company-scoping half of approver security.
   **Order-creator coverage (Marcelo):** the orders app is effectively invoice management — its users
   need, on the accounting side, only (a) **permission to create journal entries** (satisfied through the
   `Accounting.CreateJournalEntry` remote op their order Confirm invokes) and (b) **browse accounting
   related to their orders**. Design intent: **Accounting User covers this** (it's exactly that grant
   set), assigned alongside the orders-side "Orders User" role (orders schema plan §6.2) — if Accounting
   User's browse scope proves too wide in practice, split out a leaner cross-app role then, not now.
2. **Entity CRUD permission rows** per role across the 28 entities (read-mostly for User; the invariant
   triggers remain the hard floor under everyone — permissions gate intent, triggers gate integrity).
3. **RLS by company — REQUIRED, not optional** (Marcelo: "scoping by company is crucial — I need to be
   able to limit certain employees to see certain things"). Mechanism per R1 (MJ RLS if it holds up).
   **Rollout: ships OFF during debugging** (RESOLVED — Marcelo 2026-07-13: start with company scoping
   OFF so lower layers are validated in isolation — never combine two changes and chase confused bugs),
   then **turned ON as a deliberate, single change**. Keep the predicate simple (CompanyID IN granted
   set); dimensions/customer-level RLS is NOT in scope.
4. **Field/status rules** (MOD-9 "layer on top"): transition gates (who may approve/reject a batch, who may
   void a Pending JE) enforced in entity servers consulting roles — specified with the batching feature
   plan. Approver gating is scoped **by company AND by role** (Marcelo direction, pending R3's verdict on
   where the company half of that invariant can safely live).
5. **Setup/settings screen + install doc** — reuse/extend MJ's existing role-management surface if R2
   finds one. Hard requirement (Marcelo): the screen must **limit which people a user can see/manage by
   company** — an admin must not edit roles of people at other companies. A v1 that lists all people is
   acceptable ONLY as a stopgap with that limitation stated; the company-scoped view is the requirement.
   Filtering users by company in the UI depends on R2's linkage finding. Install doc: which roles exist,
   what they grant, how to map real users.

**Validation gate** (Marcelo: approved as-is): permission matrix test at tier 2 — for each role, attempt
the representative allowed + denied ops via the API as a persona with that role; RLS probe (company-scoped
user sees only their JEs) — run twice: scoping OFF (baseline) and ON (the deliberate flip).

---

## A3 — Enforcement/trigger alignment audit (verify, then close small gaps)

Audit the built DB enforcement against MASTER-PLAN §5 **as overlaid** and record the verdict in the ERD doc:

| §5 item | Expected state after overlays | Action |
|---|---|---|
| 5.1 CHECKs | as-built | verify list vs plan; no change expected |
| 5.2 balanced-JE (deferrable) | built (`trg_JournalEntry_BalancedOnLock` + `trg_JEL_RecheckParentBalance`) | verify semantics vs MOD-3's lock levels — the V202607081600 rework already re-based these; confirm test matrix still green |
| 5.3 immutability triggers | built (JE/JEL/Batch/BLI/BLDim/SJE/SJELI) + MOD-3 reversible-preliminary rework | verify reject-unlock path covered by tests |
| 5.4 period-close trigger | **MUST NOT EXIST** (MOD-1; CA-1 resolved-for-now 2026-07-13 — follow Amith's removal, no period machinery) | verify absent; ERD note so nobody "helpfully" rebuilds it |
| 5.5 CoA-mapping enforcement | check what baseline shipped | verify; gap → small follow-up only if a consumer needs it |
| intercompany wiring (`IntercompanyRelationship`) | **MUST NOT EXIST accounting-side** (2026-07-06 baseline ruling; MOD-5(c)) | verify absent + ERD "deliberately absent" note (A1) |
| §4.9 SJE materialization trigger | **undefined by design** (CA-2 open — ISSUES) | no schema action; the engine seam is the feature plan's |

Also verify: JE/batch sequences intact; `AccountingCompanyProfile.DefaultPaymentTermsTypeID` stays a soft ref
(target `PaymentTermsType` arrives with orders S1 — no FK across apps); the stale references to
`AccountingPeriod` in this repo's `CLAUDE.md`/docs get corrected to reflect MOD-1 (doc fix, not schema).

**Implementation-status verification (Marcelo 2026-07-11: "I think the v2 master plan and the batch lock
plans are mostly implemented, but I am not sure"):** as part of this audit, verify item-by-item —
(a) the June-2026 rescope decisions now formalized as **MOD-1..10** (the retired v2 doc's AD-*/C-* content;
source rulings in `meetings/2026-06 - Amith rescope rulings (extracted from retired v2 plan).md`)
against the built schema/engine, and (b) every checklist item in
`action-plans/ActionPlan - Batch approval lock redesign.md` (Status: Active) against the code + test
matrix. Anything fully done → mark the plan Completed and move it to `plans/completed/` per the planning
system; anything NOT done → list it explicitly (no silent "mostly done"). *(First finding, already logged:
MOD-5(c) itself was stale vs the baseline — corrected 2026-07-13. The audit should look for more of the
same class: ledger entries contradicted by the built schema.)*

**Deliverable:** a short audit report appended to `docs/bizapps-accounting-erd.md` + the implementation-status
verdict above + any micro-migrations the audit surfaces (expected: none).

---

## A4 — Single-company JE restoration (MOD-12, 2026-07-13)

Booking now emits one JE per company (orders MOD-11), reversing CH-2. Accounting-side work:

1. **Migration `V<TS>__v1.0.x__JournalEntry_CompanyID.sql`:** reintroduce `JournalEntry.CompanyID`
   (`UNIQUEIDENTIFIER NULL` initially → backfill from lines → flip NOT NULL in the same migration if the
   data allows; FK → `__mj.Company` mirroring GLAccount's pattern). Extended property; codegen after.
   Existing multi-company JEs in dev data: split or annotate during backfill (dev-only concern — check
   whether any real multi-company JE exists before choosing; the demo/harness data is regenerable).
2. **Engine validation:** `CreateJournalEntry` gains the `MULTI_COMPANY_DRAFT` typed error (every line's
   `GLAccount.CompanyID` identical + equal to header CompanyID); AM-4's per-company balance collapses to
   whole-entry balance. Existing harness suites updated (multi-company draft cases become split-draft
   cases — coordinate with orders F1's split work; the 5/5 order-to-je harness reworks to N-JEs-per-order).
3. **Trigger check:** immutability/balance triggers are company-agnostic — verify none assumes
   multi-company; add CompanyID to the immutability-frozen column set.
4. **Numbering decision:** keep the GLOBAL JE sequence vs per-company `JE-{CompanyCode}-{FY}-{seq}`
   (the v2/AD-4 shape). `[decision needed: Marcelo]` — global is less churn; per-company reads better
   for per-company close. Batch building may now filter per company (feature plan B1 note).
5. **Decision LOCKED (Marcelo 2026-07-13):** no Amith gate on executing A4 — single-company JEs are a
   logical requirement (per-company close independence). Only a later Amith-ordered broad restructure
   would revisit; build now.
6. **Approver-link migration (Q17, same wave):** add `AccountingCompanyProfile.ApprovalCFOUserID`
   (FK `__mj.User`), backfill from `ApprovalCFOPersonID` via `Person.LinkedUserID`, deprecate/drop the
   Person column (it's unpublished-app internal — check the no-break policy stance at execution), and
   simplify `TasksAppApprovalGate` to gate on the User directly.

## A5 — Manual period close (MOD-13, 2026-07-14)

Reinstates ONLY the close guard (MOD-1's removal of period bookkeeping stands; MOD-11 recognition stays
date-driven). **Design constraint (Marcelo): JEs carry NO period FK — only their posted/effective date;
closability is DETECTED by time.**

1. **Migration `V<TS>__v1.0.x__AccountingPeriod_Close.sql`** — design lean (options for the co-design
   pass): **`AccountingPeriod` as a per-company CLOSE ledger** — `ID, CompanyID FK → __mj.Company,
   PeriodStart DATE, PeriodEnd DATE, Status ('Closed'|'Reopened'), ClosedAt, ClosedByUserID FK,
   ReopenedAt NULL, ReopenedByUserID NULL, Reason NVARCHAR` — rows are explicit accountant actions
   (arbitrary spans supported: close "through June 30" = one row; no fiscal-calendar generation, no
   Open-period rows, no month scaffolding). Effective closed test = date falls inside any row with
   `Status='Closed'` for that company. NO new columns on JournalEntry.
2. **Trigger `trg_JournalEntry_ClosedSpan`** (the un-bypassable floor): reject INSERT (and
   EffectiveDate-UPDATE) of a JE whose `EffectiveDate` falls in a closed span for its `CompanyID`
   (per-company JEs, MOD-12, make this exact). Reject = loud error; the correction path is dating the
   entry forward (Robert's model: corrections post to the next period). AD-17 three-case tests.
3. **Close/reopen actions:** engine methods + Remote Ops, role-gated (Admin/Approver per A2); close
   dialog suggests the natural boundary = last approved batch's cutoff (batch-informed default —
   Marcelo's CA-3 note). Reopen requires Admin + reason (audited via RecordChanges as usual).
4. **Downstream checks:** orders' Confirm guard (orders F1.7) calls the same closed-span check per
   resolved company BEFORE booking, so backdated orders fail fast with a clear error instead of a
   trigger bounce. Scheduled-JE materialization (B3) skips/flags due entries dating into closed spans
   (they must forward-date — surface loudly, never silently re-date).
5. **UI:** period-close surface in the settings/admin area (UI plan §5) + close status on dashboards.

## Execution order

A3 audit first (cheap, and it just proved its worth) → A4 (the MOD-12 migration — schema-critical,
orchestrator executes) → **A5 (MOD-13 close mechanism — rides the same migration wave as A4)** →
A1 documentation rides the A3 ERD update → A2 (needs the Marcelo co-design session).

## Questions for Marcelo — all resolved 2026-07-13 (review session)

1. ~~A2 role tree~~ — **RESOLVED: Approver is a ROLE; only Admin may assign it.** `ApprovalCFOPersonID`
   stays pending R3.
2. ~~A1 canonical-pair comparator~~ — **struck** (no accounting-side wiring table). Marcelo's direction
   recorded in MOD-5 for the Payments-side build: comparator must be robust to change, not readable —
   **direct UUID comparison** (his challenge "why can't we use the UUID?" — we can; my Name-based lean
   valued readability, which is not a criterion; UUID adopted).
3. ~~A1 seed growth~~ — **struck** (Payments-side concern now).
4. ~~A1 provisioning eagerness~~ — **struck**; Marcelo re-affirmed: **Amith said eager — eager stands**
   when the wiring is built (recorded in MOD-5 reference notes).
5. ~~RLS first iteration~~ — **RESOLVED: OFF during debugging, then ON as a deliberate single change.**
   Company scoping itself is REQUIRED (see A2.3).

## Routed questions

- **Amith (Q20 residual — at Payments/O2 design time, NOT blocking anything now):** sanity-check the
  Payments-side wiring interpretation of the 2026-07-06 ruling + where the wiring table lives + how
  per-pair accounts provision into accounting's COA.
- **Robert (D-Q1/Q-F) — direction from Marcelo 2026-07-13:** approver gating is **by company AND by
  role**; whether the company half can move off the DB-designated link depends on **R3** (is
  person→company linkage securable, or informational-only?). Do NOT change the approver mechanism
  before R3 answers that. ~~Employee-vs-User (Q17)~~ **RESOLVED: `__mj.User`** (Marcelo 2026-07-13;
  A4.6 migration).
- **Amith/Robert (CA-1/Q18):** periods — *Marcelo is talking to Robert TODAY (2026-07-13); answer +
  plan updates to follow.* A3 deliberately builds nothing period-shaped meanwhile. MOD-1 now carries
  Amith's original removal rationale as framing for that conversation.
- **Jeremy (Q-C):** batch dimension list — data seeds (Dimension rows), no schema; lands with the batching
  feature work. *(Clarified for Marcelo 2026-07-13: the ask is — which analytical splits must batch
  summary lines break out by so the detail Jeremy needs reaches BC. Candidates heard so far: Customer,
  Product, Renewal-vs-New, Event. Each added dimension multiplies summary-line granularity, so we want
  his definitive list rather than guessing.)*

---

## Appendix — Parity coverage matrix (modified master plan → where it lands) — added 2026-07-14

| Master item (as overlaid) | Status / plan |
|---|---|
| GLAccount + minimal COA seed (MOD-7) | BUILT |
| AccountingCompanyProfile (IsA Company) + ApprovalCFO link | BUILT; link → User migration = **A4.6** |
| Manual period close (MOD-13 — replaces §4.4's full period bookkeeping) | **A5** (table + trigger + actions + UI §5) |
| JournalEntry/Line/LineDimension + balanced/immutability triggers | BUILT; single-company restoration = **A4**; closed-span trigger = **A5** |
| JournalEntryBatch + lock levels + netted summaries (MOD-3/4) | BUILT (lock redesign done); view-driven builder = **B1** |
| Batch approval via bizapps-tasks (MOD-3) | BUILT (TasksAppApprovalGate) — verify in A3 |
| ERP (BC) outbound dispatch + ack + CoA-mapping enforcement (§4.6, §8.4) | dispatch engine BUILT (T3-proven); BC-sandbox outbound + CoA-mapping enforcement = **verify in A3**, gap → follow-up item |
| ScheduledJournalEntry trio + date-driven materialization (MOD-11) | schema BUILT; engine + daily action = **B3** |
| CreateJournalEntry remote op + engine pair | BUILT (proven) |
| CreateScheduledJournalEntries remote op | **B3.1** |
| Dimensions (+ Jeremy's batch-dimension seeds) | BUILT; seeds = **B1.6** (Q-C decision) |
| GLAccountRole/Link mapping (MOD-10) | BUILT; manager UI = UI plan §5 |
| Currency + CurrencySpotRate | BUILT (dormant until FX) |
| Tax data tables (§4.8) | BUILT; provider = DEFERRALS |
| Roles + RLS + settings screen (MOD-9) | **A2** (R1-R3 research → build) |
| §10 read-model views + Jeremy reporting pack (incl. period-close status) | 12 views BUILT; audit + pack = **B2** |
| Intercompany wiring/legs | Payments-side (MOD-5) — receiving contract = B4 (DEFERRALS trigger) |
| AccountBalance materialization / FX reval / Report Gallery / tax provider | `plans/DEFERRALS.md` |
