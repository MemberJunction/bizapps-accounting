# Plan — Schema alignment: IntercompanyRelationship, roles/RLS, trigger audit

> **Status:** Draft (awaiting Marcelo review) · **Created:** 2026-07-11
> **Implements:** MASTER-PLAN-MODIFICATIONS MOD-5(c) (IntercompanyRelationship — Amith-specified, unmigrated),
> MOD-9 (roles + RLS), and a trigger/enforcement alignment audit against MASTER-PLAN §5 as overlaid by
> MOD-1/MOD-3. Promotes the BACKLOG items "`IntercompanyRelationship` migration" and "Role seeding + RLS".
> **Sources:** supporting-documents/bizapps-accounting-master-plan-v2.md (Preface OQ-A — the Amith schema),
> MASTER-PLAN §5 (DB enforcement), baseline `migrations/B202605281200`, `V202607081600` (lock rework),
> meetings/2026-07-09-robert-meeting-decisions.md (D1), the 2026-07-10 gap analysis §3.
> **Companions:** orders repo `ActionPlan - Schema alignment with master plan (O1-O5).md` (the O-side);
> `ActionPlan - Feature build (batching, reporting, materialization).md` (consumes A2's provisioning hook).

## 0. Scope

The accounting schema is broadly plan-aligned (28 tables, invariant triggers, read-model views). Three
targeted work items close the remaining gaps — **no broad rework**:

- **A1** — the `IntercompanyRelationship` table (the ONE missing Amith-specified table).
- **A2** — roles + entity permissions + RLS seeding (MOD-9; master plan was silent on permissions).
- **A3** — enforcement/trigger alignment audit (verify what's built matches the overlaid plan; add the two
  small triggers A1 needs; explicitly build NOTHING period-related while CA-1 is open).

Ground rules identical to the orders schema plan (new V* file, T-SQL source of truth + PG conversion, no
CodeGen-owned artifacts, extended properties, migrate → codegen → build → commit together, **update
`docs/bizapps-accounting-erd.md` in the same change** — repo convention).

---

## A1 — `IntercompanyRelationship` migration

Migration: `V<TS>__v1.0.x__IntercompanyRelationship.sql`. The Amith-specified schema (v2 Preface OQ-A),
adopted verbatim with the two design notes resolved:

```sql
__mj_BizAppsAccounting.IntercompanyRelationship
  ID UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
  CompanyAID UNIQUEIDENTIFIER NOT NULL,   -- FK → AccountingCompanyProfile; ONE row per UNORDERED pair
  CompanyBID UNIQUEIDENTIFIER NOT NULL,   -- FK → AccountingCompanyProfile
  ADueToBGLAccountID   UNIQUEIDENTIFIER NOT NULL,  -- A's Liability "Due To B"   (must own: GLAccount.CompanyID=CompanyAID)
  ADueFromBGLAccountID UNIQUEIDENTIFIER NOT NULL,  -- A's Asset    "Due From B"  (CompanyAID)
  BDueToAGLAccountID   UNIQUEIDENTIFIER NOT NULL,  -- B's Liability "Due To A"   (CompanyBID)
  BDueFromAGLAccountID UNIQUEIDENTIFIER NOT NULL,  -- B's Asset    "Due From A"  (CompanyBID)
  IsActive BIT NOT NULL DEFAULT 1,
  PK(ID); FKs per OQ-A; CHECK (CompanyAID <> CompanyBID); UNIQUE (CompanyAID, CompanyBID)
```

Resolved design notes:
1. **Canonical pair order enforced by trigger** (`trg_ICR_CanonicalPair`): on insert/update, reject a row
   whose `(CompanyBID, CompanyAID)` reversal already exists, and require `CompanyAID < CompanyBID` by the
   canonical comparator. **Comparator = the profile's `__mj.Company` Name (tiebreak UUID)** rather than
   `CompanyCode` — see Q2. Enforcing in-trigger (not just in the provisioning hook) keeps raw-SQL inserts
   honest, matching this app's DB-invariant philosophy.
2. **Account-ownership + side trigger** (`trg_ICR_AccountOwnership`): each of the four accounts must
   (a) belong to the right company (`GLAccount.CompanyID` matches the A/B side) and (b) be the right type
   (Due-To → Liability, Due-From → Asset, per `GLAccount.AccountType`). FKs can't express this; the trigger
   joins the §11.1-style invariant test matrix.

**Eager provisioning hook** (`AccountingCompanyProfileEntityServer.Save()` — code, ships with this
migration's wave): on new ACP creation, for every existing active ACP create the pair row **and the 4 GL
accounts**. Account-code scheme (OQ-A open point) — proposal: `<baseDueToCode>-<counterpartyCode>` /
`<baseDueFromCode>-<counterpartyCode>` derived from two new seed base accounts (`Due To Intercompany` /
`Due From Intercompany` role accounts added to the minimal COA — MOD-7's seed removed the centralized rows;
these are TEMPLATE rows for per-pair minting, not postable centralized accounts). **Q3 flags this for
review** — it slightly grows the MOD-7 minimal seed.

**Backfill:** the same hook logic run once over existing ACP pairs in the dev instance (post-migration
script or an admin action — NOT in the migration itself, since account minting is engine logic).

**What A1 does NOT do (overlay compliance):** no leg *generation* (that's Payments, upstream — accounting
MOD-5(b); tracked as UNOWNED in ISSUES until orders S2 matures); no `CounterpartyCompanyID` on JE lines
(moot — the per-pair account itself encodes the counterparty; gap analysis §3).

**Validation gate:** migrate/codegen/build clean; trigger unit tests via raw-SQL attempts (wrong-company
account rejected, reversed-pair rejected, self-pair rejected); provisioning harness (create 3rd ACP → 2 new
pair rows + 8 accounts, idempotent re-run creates nothing).

---

## A2 — Roles, entity permissions, RLS (MOD-9)

**Co-design checkpoint with Marcelo before executing** (MOD-9 instruction). Deliverables:

1. **Roles** (seeded via metadata folder, not SQL INSERTs — MJ convention): **Accounting User** (JE browse,
   create manual Pending JEs if allowed, view batches/reports), **Accounting Admin** (COA, company profiles,
   dimensions, GLAccountLink mapping, batch build/regenerate, remittance), and the **batch-approver**
   capability — proposal: a third role **Accounting Approver** rather than a flag, so the CFO-approver link
   (D-Q1, Employee-vs-User open with Robert) can start as role membership and tighten later.
2. **Entity CRUD permission rows** per role across the 28 entities (read-mostly for User; the invariant
   triggers remain the hard floor under everyone — permissions gate intent, triggers gate integrity).
3. **RLS by company:** scope JE/batch/GLAccount visibility by `CompanyID` for company-scoped users, using MJ
   entity-permission RLS (`getRowLevelSecurityWhereClause` layer). First iteration: Admin/Approver unscoped;
   User optionally scoped per deployment. Keep the predicate simple (CompanyID IN granted set); dimensions/
   customer-level RLS is NOT in scope.
4. **Field/status rules** (MOD-9 "layer on top"): transition gates (who may approve/reject a batch, who may
   void a Pending JE) enforced in entity servers consulting roles — specified with the batching feature plan.
5. **Setup/settings screen + install doc** — the UI plan carries the screen; the install doc lands here
   (which roles exist, what they grant, how to map real users).

**Validation gate:** permission matrix test at tier 2 — for each role, attempt the representative allowed +
denied ops via the API as a persona with that role; RLS probe (company-scoped user sees only their JEs).

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
| new | `trg_ICR_CanonicalPair`, `trg_ICR_AccountOwnership` | A1 above |
| §4.9 SJE materialization trigger | **undefined by design** (CA-2 open — ISSUES) | no schema action; the engine seam is the feature plan's |

Also verify: JE/batch sequences intact; `AccountingCompanyProfile.DefaultPaymentTermsTypeID` stays a soft ref
(target `PaymentTermsType` arrives with orders S1 — no FK across apps); the stale references to
`AccountingPeriod` in this repo's `CLAUDE.md`/docs get corrected to reflect MOD-1 (doc fix, not schema).

**Implementation-status verification (Marcelo 2026-07-11: "I think the v2 master plan and the batch lock
plans are mostly implemented, but I am not sure"):** as part of this audit, verify item-by-item —
(a) the v2 plan's accepted decisions (AD-*/C-* in `supporting-documents/bizapps-accounting-master-plan-v2.md`,
now formalized as MOD-1..10) against the built schema/engine, and (b) every checklist item in
`action-plans/ActionPlan - Batch approval lock redesign.md` (Status: Active) against the code + test
matrix. Anything fully done → mark the plan Completed and move it to `plans/completed/` per the planning
system; anything NOT done → list it explicitly (no silent "mostly done").

**Deliverable:** a short audit report appended to `docs/bizapps-accounting-erd.md` + the implementation-status
verdict above + any micro-migrations the audit surfaces (expected: none beyond A1).

---

## Execution order

A1 (self-contained, unblocks intercompany work downstream) → A3 audit (cheap, mostly reading + tests) →
A2 (needs the Marcelo co-design session).

## Questions for Marcelo

1. **A2 role tree:** User / Admin / **Approver-as-role** (my proposal) — or approver as a flag/designated-user
   link from day one? Role is simpler and D-Q1-proof; flag is finer-grained.
2. **A1 canonical-pair comparator:** Company **Name** (readable, my lean) vs `CompanyCode` (Amith's example
   used codes; stable against renames). If codes, confirm every ACP has one (baseline makes CompanyCode
   NOT NULL? — verify during build).
3. **A1 seed growth:** adding `Due To Intercompany` / `Due From Intercompany` TEMPLATE base accounts slightly
   grows the MOD-7 minimal COA. OK, or should the account-code scheme be parameterized in ACP settings
   instead (no new seed rows)?
4. **A1 provisioning eagerness:** Amith said eager-for-every-pair. With N companies that's N·(N−1)/2 rows ×4
   accounts — fine at BC's scale (~10 companies → 45 pairs/180 accounts). Confirm eager (vs on-first-use)
   stands at that volume.
5. **RLS first iteration (A2.3):** ship company-scoping ON for the User role by default, or OFF (all roles
   unscoped) until a real multi-company tenant needs it? I lean **OFF by default, mechanism tested** — RLS
   bugs are silent data-hiding bugs; enable per deployment.

## Routed questions (do not block A1/A3)

- **Robert (D-Q1/Q-F):** Employee entity for CFO-approver — shapes A2.1's approver link, not the role seed.
- **Amith/Robert (CA-1/Q18):** periods — A3 deliberately builds nothing period-shaped.
- **Jeremy (Q-C):** batch dimension list — data seeds (Dimension rows), no schema; lands with the batching
  feature work.
