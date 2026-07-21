# ActionPlan — S2 · Single-company batches + batch PostingDate + approver enforcement (roadmap V1.3 + V1.4 + V1.6 rider)

> **Status:** Draft · **Created:** 2026-07-20 · **Slice:** S2 (orders ROADMAP-lxp-launch.md board)
> **Implements:** MOD-15 (single-company batches) · MOD-16 as reworked (singular accountant-set
> `PostingDate`; one aggregated JE per batch; closed-period HOLD-and-flag) · MOD-4 (netting key;
> Company degenerate under the header) · MOD-8 + MOD-17 filter default (cutoff = today, never
> forward unless explicit) · V1.6 rider: Q6/Q22-answer approver enforcement + Q24 audit columns ·
> FEATURE-LIST: ACC-D.1, D.3 (enforcement half), D.7 (numbering revisit), D.8, D.9, K.2 (minimal
> grant table ONLY)
> **Sources:** the roadmap; Robert P3 (`meetings/2026-07-14 - je-single-company-batching-proposal.md`);
> the 2026-07-17 posting-date thread (`meetings/2026-07-17 - User Feedabck over the week 07-12.md`);
> Robert's Q6/Q22/Q24 answers. **Cite, don't re-narrate.**
> **Repo note:** this slice is ~all-accounting; orders participates only as consumer (its
> order-to-je harness re-runs at P3).
> **Entry gate:** S0's accounting-spine (batching) vertical closed.
> **Exit gate:** cheap tiers green pre-AND-post + demo artifacts. NO GUI here (S4) — but the batch
> UI pages are BLOCKED on this slice (UI plan §8 warning block), so close-out must notify the UI
> agent's brief.

## Scope (one paragraph)

Rework the batch model to the ruled shape: a batch belongs to one company, carries one
accountant-set posting date, nets per (Company × GLAccount × Dimension-combo) with Company
degenerate, dispatches as one aggregated JE, and holds/flags closed-period collisions instead of
auto-rolling. Enforce WHO may approve: only a holder of the Accounting Approver role for the
batch's company, via the minimal `UserCompanyRole` grant table with audit columns. Jeremy's two
MOD-15 conditions surface as config/rec notes, not machinery.

## Phases (vertical: schema → engine → proof)

**P1 — Schema (migration + app codegen).**
`JournalEntryBatch.CompanyID` (backfill existing batches from their JEs' company — single-company
data expected post-MOD-12; flag any mixed legacy batch rather than guessing) + `PostingDate` ·
drop `JournalEntryBatchLineItem.CompanyID` (MOD-15b — header carries it) · fold per-company
footing trigger 50023 into 50014 (same assertion now) · closed-period HOLD state on the batch/JE
(flag + reason, per MOD-16 item 5 — v1 is dispatch-rejection-driven, no BC feedback loop) · new
`UserCompanyRole` (UserID, CompanyID, RoleID, IsActive, GrantedBy/At, RevokedBy/At; unique
triple; revoke = deactivate never delete — Q24). *Demo artifact:* "what you can now record" note +
preflight green.

**P2 — Engine.**
`buildBatch(companyId, dateFilter)` — that company's Pending JEs only · filter default: empty
start + cutoff TODAY inclusive; future-reaching requires explicit intent (MOD-8/17) · netting per
MOD-4; batch numbering left global (D.7 note — revisit rides this rework's review) · PostingDate
default from the window cutoff, accountant-settable · cancel/reject/regenerate paths preserved on
the per-company shape (block2 semantics) · `recordDecision` accepts ONLY a user holding Accounting
Approver for the batch's company in `UserCompanyRole` (the sole authority source; typed error
otherwise); `ApprovalCFOUserID` stays assignment-default only · MOD-14 task-pointer behavior
unchanged. *Demo artifact:* two companies' JEs batched separately, each approved by its own
Approver; a wrong-company approver rejected — live run with real numbers.

**P3 — Proof (cheap tiers).**
Re-run block0–block2 + the orders order-to-je harness on the new shape + new tests: per-company
gather, cross-company exclusion, PostingDate stamping, filter-default (no forward sweep), footing
fold, hold-state transitions, approver enforcement (positive/negative/raw-SQL floor). *Demo
artifact:* test-matrix delta in testing.md.

## Decisions taken (micro-decisions only — one line each)

- **Zero-net batches: ALLOW but REQUIRE CONTENT (≥1 JE)** (Marcelo 2026-07-21). Block truly-empty (0 JEs);
  a non-empty set that nets to zero is valid — marking JEs posted at net-zero is legitimate. Check is
  BACKEND/engine only, never frontend. (The current `EmptyBatchError` on zero-net groups was an
  over-reach in commit 3c0f10f — narrow it to "throw only when jeIds is empty"; derive approval
  companies from the JEs, not the netted groups, for a zero-summary batch; add a build→approve→send→
  Posted lifecycle test with zero summary lines.)
- **MOD-4 netting: KEEP the per-company netting key + per-company footing trigger 50023 for SAFETY**
  (Marcelo 2026-07-21) — do NOT collapse 50023 into 50014 as MOD-15 item (c) states. Degenerate under
  single-company but retained as a defense-in-depth guardrail (Amith/Robert specified it).
- **MOD-16 (singular batch PostingDate + one aggregated JE per batch + closed-period HOLD): HELD** —
  it's a schema+engine change; this slice is single-company ONLY (Marcelo 2026-07-21).
- **Line-item `CompanyID`: KEEP it** (don't drop per MOD-15 item b) — safety, per the MOD-4 keep-for-safety call.
- **Single-company go-now confirmed inline with Robert + Amith** (MOD-15 Accepted by all; no re-open needed).
- Batch workspace **company select is already single-select** (commit 3389d40); the S2 UI step is to
  drop the "All companies" option + require exactly one company.
- The **Remote-Ops consolidation carries forward** (build/regenerate/approve/reject/dispatch are now
  `Accounting.*` remote ops, `BatchDispatchResolver` retired, commit 3c0f10f) — only the multi-company
  ENGINE internals change in S2; the op surface stays (add required `companyId` to the build input).

## Out of scope (do not drift)

Forward-dated rev-rec entries themselves (S3) · BC dispatch/API + real closed-period feedback
loop (V3) · full RLS/role screens (V4; A2 co-design) · multi-company batches (BACKLOG — Amith's
evolution path) · batch UI pages (S4; unblock notice at close-out) · Jeremy's cadence-alignment +
rec-item-type conditions (config/H.3 — note, don't build).
