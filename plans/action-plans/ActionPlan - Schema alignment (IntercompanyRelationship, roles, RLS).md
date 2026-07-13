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

The accounting schema is broadly plan-aligned (28 tables, invariant triggers, read-model views). Three
targeted work items — **no broad rework, and (post-correction) NO new accounting migration**:

- **A1** — intercompany wiring **disposition** (verified OUT of accounting; document + carry forward).
- **A2** — roles + entity permissions + RLS seeding (MOD-9; master plan was silent on permissions).
- **A3** — enforcement/trigger alignment audit (verify what's built matches the overlaid plan; explicitly
  build NOTHING period-related while CA-1 is open).

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
   (**RESOLVED — Marcelo 2026-07-13: approver IS a role**, and **only Admin may assign it**). The as-built
   `AccountingCompanyProfile.ApprovalCFOPersonID` + bizapps-tasks gate stay as the designated-approver
   point pending R3.
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
| 5.4 period-close trigger | **MUST NOT EXIST** (MOD-1; CA-1 open) | verify absent; add a CA-1 note to the ERD doc so nobody "helpfully" rebuilds it |
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

## Execution order

A3 audit first (cheap, and it just proved its worth) → A1 documentation rides the A3 ERD update →
A2 (needs the Marcelo co-design session).

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
  role**; whether the company half can move off the DB-designated link (`ApprovalCFOPersonID`) depends
  on **R3** (is person→company linkage securable, or informational-only?). Do NOT change the approver
  mechanism before R3 answers that. Employee-vs-User (Q17) still with Robert.
- **Amith/Robert (CA-1/Q18):** periods — *Marcelo is talking to Robert TODAY (2026-07-13); answer +
  plan updates to follow.* A3 deliberately builds nothing period-shaped meanwhile. MOD-1 now carries
  Amith's original removal rationale as framing for that conversation.
- **Jeremy (Q-C):** batch dimension list — data seeds (Dimension rows), no schema; lands with the batching
  feature work. *(Clarified for Marcelo 2026-07-13: the ask is — which analytical splits must batch
  summary lines break out by so the detail Jeremy needs reaches BC. Candidates heard so far: Customer,
  Product, Renewal-vs-New, Event. Each added dimension multiplies summary-line granularity, so we want
  his definitive list rather than guessing.)*
