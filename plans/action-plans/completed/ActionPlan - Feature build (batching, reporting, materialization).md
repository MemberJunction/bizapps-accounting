# Plan — Feature build: batching UX-model, reporting pack, scheduled-JE seam

> **AUDIT 2026-07-18 (orchestrator): COMPLETED — archived.** B1 batching done AND AHEAD of ledger
> (view-driven builder B1.2 is BUILT — FEATURE-LIST D.5 corrected 2026-07-18); B2 = views green,
> the 7 report pages DEFERRED (DEFERRALS row); B3 built-then-SUPERSEDED by MOD-17 (SJE op +
> materializer are dead code pending the retirement migration — roadmap V1.5; their green tests
> cover superseded code); B4 dormant by design (DEFERRALS). B1.5 dimension seeds await Jeremy
> (BACKLOG row + Q19(7)). No orphaned work.

> **Status:** ACTIVE (approved for execution — Marcelo review completed 2026-07-14) · **Created:** 2026-07-11
> **Implements:** MOD-8 (view-driven batching + oldest-forward default), the BACKLOG "Jeremy reporting pack"
> + "Batch dimension strategy", MASTER-PLAN §10 as overlaid, and the CA-2-gated materialization seam (§4.9 /
> BA-D25 as overlaid by MOD-1). Also the orders-side bridge counterpart:
> the `Accounting.CreateScheduledJournalEntries` remote operation (orders MOD-5 pattern).
> **Sources:** meetings/2026-07-09-robert-meeting-decisions.md (D2), meetings/2026-07-10-decisions.md (§I
> reporting is cutover-gating), MASTER-PLAN §8.4/§10, baseline views, gap analysis §3/§4 row 6–7,
> `ActionPlan - Batch approval lock redesign.md` (completed groundwork this builds on).
> **Depends on:** A1/A2 from the schema plan where noted; orders S3/F4 for the bridge's producer side.

## B1 — Batch building per MOD-8 (view-driven + oldest-forward)

Extends the completed lock-redesign work (reject-unlock + regenerate are DONE — this adds the selection
model):

1. **Oldest-forward default (semantics per Robert 2026-07-14):** the standard filter is **NO start date
   + a populated end date/time** — candidates = EVERY unbatched entry with `EffectiveDate` ≤ cutoff,
   **sorted date ascending**. **Inclusive end date:** a date-only cutoff means `EffectiveDate < cutoff
   + 1 day` (picks up everything ON that date); a datetime cutoff is exact. The existing buildBatch
   gains the cutoff parameter; UI exposes it (date picker defaults date-only/inclusive; boundary test:
   entry stamped 23:59:59 on the cutoff date IS included).
2. **Batch-from-View (Robert's preferred working model — SEQUENCED as the FIRST post-wave-1 batching
   item, Marcelo 2026-07-14):** accept an MJ User View (of Journal Entries) as the candidate source;
   engine re-resolves the view server-side and **validates every resolved entry is unbatched — reject
   LOUDLY otherwise** (name the offending JEs; no silent filtering). Out-of-order batching is allowed
   while open; the reversal workflow remains regenerate-the-open-batch (MOD-8). Deliberately NOT built
   during wave 1: the per-company JE rework (MOD-12/A4) churns the batching substrate, baseline tests
   only need the B1.1 cutoff flow, and B-Q1 (snapshot vs re-resolve) needs Marcelo's answer first.
3. **No hard batch-by-type restriction** — grouping via the view's own filters.
4. **Netted summaries** (MOD-4) — verify the existing summary builder nets per (Company × GLAccount ×
   Dimension-combo) with null-dimension aggregation; add the golden tests if missing.
5. **Batch dimensions for customer detail (Q-C, Jeremy):** when Jeremy's definitive list lands, this is seed
   data (`Dimension`/`DimensionValue` rows, e.g. Customer / Product / Renewal-vs-New / Event) + upstream
   tagging (orders booking draft populates line dimensions) + the summary's dimension-combo grouping already
   handling the rest. **Design note:** Customer-as-dimension is the current lean for AR detail reaching BC
   without per-customer JE splitting — confirm with Jeremy + Robert before seeding.

**Tests:** unbatched-only validation harness (view containing a batched JE → loud reject); cutoff boundary;
regenerate-after-view-edit; netting goldens.

## B2 — Jeremy reporting pack (cutover-gating)

Target: reproduce the reports Jeremy runs off Power BI/SQL today, from our read models — **AR Aging** and
**DefRev Rollforward** FIRST (his two anchors), then the rest of §10.2.

1. **View audit vs §10.1:** baseline ships 12 views but not an exact §10.1 match — e.g. `vw_GLDetail_Subledger`
   absent (nearest: `vw_JEAuditTrail`), `vw_SalesTaxLiabilityByAuthority` → built as `vw_SalesTaxLiability`.
   Deliverable: reconcile list, add/rename-by-new-view where a report needs it (views are additive-safe).
2. **Report surfaces:** MJ Explorer dashboards/reports over the views (house patterns; Skip-generated
   interactive reports where useful per §10.2): AR Aging Detail (by customer, buckets, drill to orders),
   DefRev Rollforward (beginning + additions + recognitions + ending), AR-to-GL Recon, Subledger Trial
   Balance, Revenue by Dimension, JE Audit Trail, FX Exposure (dormant until FX activates). Period-close
   status report: **NOT built** (CA-1).
3. **Reproducibility requirement (Jeremy's hard constraint):** every report parameterized by as-of date and
   deterministic — re-running yesterday's report yields yesterday's numbers (views are JE-sourced, so this
   holds by construction once data is immutable-after-lock; document it).
4. **Data reality check:** the views are starving until orders S1/S2 feed them (gap analysis headline). The
   pack's *acceptance* test uses the orders F3 harness data (payment applied → aging bucket moves).

**Tests:** golden-dataset fixtures per view (known JE set → known aging buckets/rollforward rows); parity
spot-check against Jeremy's Power BI numbers on real data at cutover rehearsal.

## B3 — Scheduled-JE bridge + DATE-driven materialization (CA-2 RESOLVED by MOD-11, 2026-07-13)

Producer side lives in orders F4; accounting owns:

1. **`Accounting.CreateScheduledJournalEntries` remote operation** (mirrors `CreateJournalEntry` — MOD-5's
   stated pattern): atomic persist of a schedule's SJE rows + line items, validation (balanced pairs, company
   resolvable, amounts sum to schedule total), supersede support (`Status='Superseded'` +
   `SupersededByScheduledJournalEntryID` on recompute — §4.9 semantics). **Amith 2026-07-11 (demo
   feedback):** entry + line items MUST be created through a singular engine call for a proper transaction
   wrapper — the same requirement he confirmed for `CreateJournalEntry` applies to this op, and larger
   units of logical work use Remotable Operations generally. Per MOD-11, the producer calls this **at
   booking-lock time** with every entry carrying its recognition DATE (12 dated entries for an annual
   sub; one dated entry for an event).
2. **Materialization engine — now fully specified (MOD-11):** `MaterializeDueScheduledEntries(asOf)` —
   every SJE whose recognition date ≤ asOf → Pending JE + freeze, idempotent (already shaped by the
   baseline's SJE trio). **Trigger = a daily scheduled action** (MJ Scheduled Actions) + the manual
   admin action ("Materialize due through [date]", B-Q3) as the operator override. Batches then pick
   the materialized JEs up by their date window like any other Pending entry — no period-close coupling.
   CA-1 (periods guard) does not block any of this.
3. **Cadence note:** Robert's dated-entry model effectively answers the batch-monthly-vs-continuous
   question for the LEDGER side (continuous dated entries; batching windows them). Amith's cadence
   decision (orders BACKLOG) now only shapes the PRODUCER's date granularity (monthly anniversary dates
   per Robert's 7/13-8/13-… example) — confirm with Amith at F4 build, low stakes.

**Tests:** remote-op round trip from orders (the F4 bridge harness); materialize idempotency (run twice →
one JE per SJE); supersede path (recompute → old SJE superseded, materialized ones untouched).

## B4 — Intercompany receiving-side contract (re-scoped 2026-07-13)

~~Provisioning hook/admin action~~ — **struck**: the wiring table does NOT live in accounting (2026-07-06
baseline ruling; MOD-5(c) corrected — Payments owns due-to/due-from end-to-end, wiring included). What
remains accounting-side is the RECEIVING contract only: when Payments (orders O2) starts posting
intercompany legs, add a contract test that the already-balanced per-company JEs batch/net correctly per
MOD-4 and reassemble by source-entity linkage. Nothing to build until Payments exists (ISSUES: UNOWNED).

## Execution order

B1 (extends fresh lock-redesign context) → B3.1 remote op (unblocks orders F4 in parallel) → B2 (as orders
data starts flowing; view audit can start immediately) → B3.2 engine → B4 (dormant until Payments/O2).

## Questions for Marcelo

1. **B1.2 view resolution semantics:** snapshot the view's result set at build time (my lean — deterministic,
   auditable) or re-resolve at approve time (fresher but the batch can mutate under review)?
2. **B2 report tech:** MJ dashboards hand-built vs Skip-generated interactive reports (§10.2's stated
   direction) — which do you want for the first two (AR Aging, DefRev Rollforward)? I lean hand-built
   dashboards for the cutover-gating pair (deterministic, reviewable), Skip for the long tail.
3. **B3.2 manual materialization action** exposed to Accounting Admin in the UI now (pre-CA-2), or keep it
   dev/CLI-only until the trigger decision lands? I lean Admin-visible with a confirm dialog — Jeremy can
   run month-end manually, which is literally his current mental model, and it derisks CA-2 by making the
   decision observable.
4. **B2.1:** where §10.1 names a view the baseline lacks, add the missing view under the §10.1 name, or fold
   into the nearest existing view? I lean add-under-plan-name (reports cite plan names).

---
## ⓘ Status annotation — 2026-07-17 (pre-testing filing)
UNTOUCHED this session — the 2026-07-16/17 work was the UI wave + the naming/memo feature only. This plan's
status stands as its header states; feature/schema execution resumes after test-harness validation. Any
design decisions from this session live in the app BACKLOG "UI TASKS" section + the Q-stock (Q27–Q40); the
UI-design-decision doc gap was filed to `~/MJDev/MJDEV-REQUESTS.md`.
