# Plan — Batch approval lock redesign (reject-unlock + regenerate)

> **Status:** APPROVED — implementing (Marcelo greenlit 2026-07-08). Scope of THIS build = fix the reject issue (#12)
> via the lock redesign below. Cherry-pick/filters/PG/out-of-order/backdating are explicitly deferred (§13); the four
> GAAP confirmations are logged as high-priority QUESTIONS (Q12–Q15) for Robert but do NOT block this build.
> **Drives:** task #12 (batch Reject). **Decision source:** `plans/2026-07-08-robert-meeting-decisions.md` (D1/D2),
> transcript `plans/meetings/Accounting Meeting-20260708_120251-Meeting Recording.md`, + Marcelo's 2026-07-08
> plan-review feedback (locking = **Option A**, filters/PG deferred, regenerate-takes-all-for-now). **Supersedes**
> the current "`Batched` = permanent immutable lock" behavior.

## 1. Problem
Today a journal entry is **permanently** locked the instant it's batched (`trg_JournalEntry_Immutability`:
once `Status='Batched'`, only `Batched→GLPosted` / `GLPostedAt` / `GLReferenceID` / `ReversedByJournalEntryID`
may change). So **rejecting** a built batch can't return its entries to the pool — the reject records the
decision but leaves the batch `Pending` and the entries `Batched` forever (task #12: "reject does nothing").
And `buildBatch` locks entries **before** the approval gate runs, so a gate failure orphans a task-less batch.

## 2. The decision (Robert 2026-07-08 + Marcelo plan-review)
- **Levels of locking.** A batch that is **not yet approved** is a work-in-progress: its entries are
  **preliminarily locked** (so they can't be double-batched) but the lock is **reversible**. **Approval makes
  the lock permanent** (GL summary must tie back to unchanged details); no reversal after that.
- **The preliminary lock must look EXACTLY like a permanent lock to any external viewer** — same `Status='Batched'`,
  no extra "is it reversible?" surface — **but be reversible** by the reject/regenerate paths. (Marcelo.) This is
  precisely what **Option A** (below) gives for free: the JE row is identical; only the batch's approval state,
  read at mutation time, decides whether an unlock is allowed.
- **Reject removes the locks** — entries go back to the **unbatched candidate pool**. An unapproved batch
  "effectively doesn't exist financially."
- **Regenerate an open batch:** throw out its current entries, re-gather candidates, regenerate the summary.
  Same batch record. **For now (fast-prototype): regenerate takes ALL new candidate JEs** (no filter) — filters
  come later (see §11 backlog). We lean toward **regenerate-by-filter** as the eventual shape (per Robert).
- **Candidate rule (KEEP — confirmed).** An entry is a candidate iff it is not currently in a batch; once in an
  **approved** batch it is never a candidate again.
- **Batching model for now: simple all-or-nothing — NO cherry-picking at all (Marcelo, final).** Neither additive nor
  subtractive selection in this build: a batch takes *all* candidate JEs in its scope, period. (Additive reversal-pairing
  was judged safe but we're not offering it now — see Q12; subtractive stays permanently banned.) "Batches = filters +
  manually-selected records" is the right eventual direction (Robert + Marcelo agree) but gets **its own plan** — not this one.

## 3. Scope — defined (was the fuzzy part)
A batch dispatches **one company's summary entries to one external target GL system**, so:

> **Scope = (Company, TargetSystem).** One batch belongs to exactly one scope; its candidates are the unbatched
> JEs for that company destined for that target system.

The "one open batch per scope" idea is **NOT enforced as a hard rule** (see GAAP advice §4-B). With today's
all-or-nothing regenerate — which consumes the whole candidate pool — one open batch per scope simply *emerges*;
no constraint needed. Revisit only when filters land and concurrent scoped batches become meaningful (the candidate
rule keeps them disjoint regardless).

## 4. GAAP advice (Marcelo asked; here's the reasoning + recommendations)
These are the accountant-judgment calls. My recommendations below; the ones marked **→ Amith** need an accountant's
sign-off before we commit code (they'll become QUESTIONS.md entries after we rediscuss).

- **A. Cherry-picking records into a batch → the SAFE direction is ADDITIVE-only; subtractive is the danger. → Amith to bless.**
  Principles at stake: **completeness, cutoff, consistency**, and anti-manipulation controls. The dangerous kind is
  **subtractive** — hand-*dropping* an eligible entry so it posts in a later period (the classic earnings-management
  lever: defer the unfavorable, post the favorable). We **never** allow that; the base set stays **objective criteria**
  (today: "all pending"; later: "all pending through cutoff X").
  **Marcelo's use case is the ADDITIVE kind and is inherently safe:** pull in a *reversing* entry to pair with its
  initial entry so earnings never silently vanish from the GL. Adding entries can only make the picture *more* complete,
  never hide earnings — so additive cherry-pick can't be the manipulation vector. Matches Robert's "filter + manual
  additions" exactly.
  **The narrower open question for Amith** is not "additive vs subtractive" (additive wins) but *treatment*: **should a
  reversal be pulled into the SAME batch/period as its original at all**, or should it always **forward-date into its own
  (current) period** — which is what the system already does automatically (§4-D)? Pairing a reversal into the original's
  period nets that period to zero and arguably *hides* that the event happened; forward-dating preserves a faithful
  period-by-period history. So the system's automatic behavior may already be the GAAP-correct answer, making the
  cherry-pick-to-pair an *override* we might not want. Confirm with Amith. For now, all-or-nothing needs no decision.

- **B. One-open-batch-per-scope → recommend DON'T hard-enforce; the candidate rule already does the real work.**
  The invariant that prevents double-posting is the candidate rule (an entry in ≤1 batch) — already present. GAAP does
  **not** forbid multiple batches awaiting approval in one scope. So no enforcement rule; with all-or-nothing it's moot
  (one open batch emerges). Revisit with filters. **BUT see §4-F for the out-of-order-approval wrinkle Marcelo raised.**

- **F. Out-of-order batch approval (Marcelo) → a real GAAP concern; recommend chronological posting (enforce or warn). → Amith to bless.**
  Once multiple batches *can* coexist in a scope (filter era), you could approve/send a **Sat-Sun** batch **before** the
  earlier **Fri-Sat** one. GAAP's sequential/continuous-ledger expectation says a later period generally shouldn't post
  ahead of an earlier one — it risks a discontinuous GL history and cutoff confusion (the earlier period's numbers move
  *after* the later period is already closed on the GL side). My lean: **post batches in chronological cutoff order** —
  either hard-enforce "can't approve a batch whose cutoff is later than an un-posted earlier batch in the same scope," or
  at minimum **warn**. This only bites in the filter era (today's all-or-nothing has one batch, so it's moot); note it now
  so the filter plan inherits it. Confirm the exact rule with Amith.

- **C. Oldest-forward (cutoff) vs arbitrary spans → recommend OLDEST-FORWARD with a cutoff, not arbitrary windows. → Amith to bless.**
  GAAP favors **sequential, gap-free** period posting. An arbitrary window (post Mar 10-15 while Mar 1-9 sits unposted)
  creates gaps → understatement + ambiguity about "GL current through when." Right model: **start = earliest unbatched
  entry, end = chosen cutoff date.** The candidate rule makes this automatic — candidates always include the oldest
  unbatched entries, so the next batch sweeps them forward; no permanent gaps. Today (all-or-nothing) a batch takes
  *everything pending* = implicitly "oldest through now," the correct degenerate case. When filters land, constrain them
  to a **cutoff (upper bound)**, never an arbitrary start.

- **D. Reversals & the "continuous history" worry → CONFIRMED IN CODE: they don't conflict.**
  Marcelo asked whether reversals are automatically forward-dated. **Yes — verified.** `generateReversal`
  (`packages/CoreEntitiesServer/src/JournalEntryEntityServer.ts:87-89`) sets the reversing entry's
  `EffectiveDate = new Date()` (today — **forward-dated**, NOT the original's date), `EntryType='Reversal'`, and
  `Status='Pending'`. So a reversal is a **new, forward-dated, Pending JE** — it re-enters the candidate pool and flows
  into the *current* period's batch as an ordinary candidate; it is **never** retro-inserted into an approved/posted
  batch. Approved batches stay permanently locked; corrections go forward. **This is exactly why the batching model is
  self-consistent** (Marcelo's read is correct). Minor nuance: `new Date()` dates the reversal to *today* unconditionally
  — correct as long as today's period is open; reversing into a *specific* prior-but-open period isn't supported (edge
  case, safe default). Standard practice (reversing/correcting entries booked in the current open period).

- **E. Backdating an order → already live implicitly; needs a closed-period guard. → Amith to bless the date rule.**
  `OrdersEngine` already sets `asOfDate = order.OrderDate ?? new Date()` → flows into `JournalEntry.EffectiveDate`
  (and the GL-account-link as-of date). So backdating an order **already backdates its JE** — schema-intended (the
  `OrderDate` column description literally says "used as the journal entry EffectiveDate"), not in any plan doc as a
  named feature. **Risk:** there is **no period guard** — backdating into a range an approved/posted batch already
  covered posts a "new old" entry that batch didn't include, breaking the completeness it represented.
  **Recommended date rule:** use the order's effective date **when it lands in an open period** (after the company's
  latest approved cutoff); if it lands in a **closed/posted period, clamp the JE `EffectiveDate` to the current date**
  (post forward) and keep `OrderDate` as an informational reference — the standard "can't post to a closed period" rule.
  Implementing the guard needs a **"posted-through date per company"** concept (derivable from the max `EffectiveDate`
  of the latest approved batch); that's its own follow-up tied to the cutoff work — **don't build now.**

## 5. Current state (what exists)
- `JournalEntry.Status`: `Pending | Batched | GLPosted` (+ others); `BatchID` FK; `EffectiveDate DATE NOT NULL`.
  Immutability trigger `trg_JournalEntry_Immutability` (migration B202605281200, ~line 1243).
- `JournalEntryBatch.Status`: `Pending | Approved | Sent | Posted | Failed | Cancelled`; scoped to (Company, TargetSystem).
- `BatchingEngine`: `buildBatch` (lock JEs Pending→Batched, then `gate.onBatchBuilt`), `approveBatch`
  (Pending→Approved), `sendBatch` (Approved→Sent→Posted; JEs Batched→GLPosted). **No** `cancelBatch`,
  `regenerateBatch`, or reject-unlock.
- `TasksAppApprovalGate`: raises/records the CFO approval task; reject records the decision (task→Cancelled) but
  does nothing to the batch.

## 6. Target model
`Pending` (in pool) → **`Batched` while batch is unapproved = PRELIMINARY lock (reversible, externally identical)**
→ batch `Approved` = **PERMANENT lock** → `GLPosted`. Reject/cancel of an unapproved batch: JEs `Batched→Pending`,
`BatchID→null`.

## 7. Design — how to represent the two lock levels — **DECISION: Option A**

Marcelo blessed **Option A**. The lock level is a **function of the JE's batch approval state** (single source of
truth), which is exactly the "externally-identical but reversible" property he required.

- **Option A — batch-status-aware trigger (CHOSEN, no new column).** `trg_JournalEntry_Immutability` also
  permits `Batched→Pending` + `BatchID→null` **when the JE's current batch is still `Pending`** (unapproved). It looks
  up `JournalEntryBatch.Status` for the row's `OLD.BatchID`. Approve/reject change only the batch; the JE lock level
  follows automatically. The JE row is byte-for-byte identical whether prelim- or permanently-locked → satisfies
  "looks like a regular lock to any external viewer."
  - Trade-off to watch: the trigger must join `deleted`/`inserted`→`JournalEntryBatch` (more complex; watch bulk-update
    perf). PG parity of the reworked trigger is **deferred to the PG cutover** (§9) — we're SQL-Server-only while prototyping.
- **Option B — explicit JE lock flag (REJECTED, documented as fallback).** A `JournalEntry.LockLevel` /
  `IsPermanentlyLocked` column the trigger keys off. Simpler trigger (no join) but a **second source of truth** that
  approve/send/cancel must keep in sync — more sync-bug surface, and a visible column subtly breaks the
  "externally-identical" requirement. Keep only as a fallback if Option A's trigger-join proves problematic at PG-cutover time.

## 8. Engine changes
- **`cancelBatch(batchId)` / reject path** — only for a `Pending` (unapproved) batch: unlock its JEs
  (`Batched→Pending`, `BatchID=null`), set batch `Status='Cancelled'`. Wire into `RecordJEBatchDecision` for a
  `Rejected` decision (mirrors how `Approved` calls `approveBatch`). With Option A, order the JE-unlock **before** the
  batch flips out of `Pending` (or the trigger will refuse the unlock).
- **`regenerateBatch(batchId)`** — for a `Pending` batch: unlock its current JEs → re-gather candidates
  (all `Status='Pending'` unbatched JEs in the batch's scope — **no filter yet**) → re-lock them into the batch →
  recompute summary line items + control totals. Effectively `cancelBatch`'s unlock + `buildBatch`'s build, in place
  on the same batch record. (Filter param added later — §11.)
- **`buildBatch` — atomicity fix.** Keep "all pending in scope" candidate selection (no filter yet). Fix the atomicity
  so a gate failure can't strand a batch — with reversible preliminary locks this is far less severe (an orphan is now
  cancellable/regenerable), but still raise the approval task in the same unit of work as the lock, or after it with a
  compensating cancel on gate failure.
- **Guard:** `approveBatch`/`sendBatch` unchanged except they now rely on the lock level becoming permanent at approve
  (Option A: automatic — once the batch is `Approved`, the trigger stops permitting `Batched→Pending`).

## 9. Schema / migration
- New `V*` migration (SQL Server T-SQL): rework `trg_JournalEntry_Immutability` to permit the reversible
  `Batched→Pending` unlock when the owning batch is still `Pending`.
- **PG parity DEFERRED to the PG cutover (backlog).** Per Marcelo: we're fast-prototyping; PostgreSQL conversion of
  the whole app is done **at the end of the process (delivery ≈ end of next week)**, not per-migration now. So this
  migration ships SQL-Server-only for now; the reworked trigger gets converted (and CI PG-parity re-greened) as part of
  the batched PG-cutover pass. **Note this explicitly so it isn't mistaken for "PG parity done."**
- Update `docs/bizapps-accounting-erd.md` + `docs/lifecycle-hooks.md` (immutability rule change) per the repo's
  "docs are part of Done" convention.

## 10. Data cleanup (existing orphans) + demo test data
- **Orphan cleanup (fine — Marcelo).** Existing orphaned task-less demo batches (`BATCH-000054/055/058/060`, `Pending`,
  entries `Batched`) predate this model. Once `cancelBatch` exists, run a one-time cleanup: cancel them + unlock entries.
- **Demo test data (Marcelo: "follow your initial reasoning").** To give the redesigned flow something real to act on,
  seed a spread of batch states rather than only orphaned `Pending` ones: advance a couple of demo batches to
  **Approved** (proves the permanent-lock path — an unlock attempt must THROW) and one to **Sent/Posted** (proves the
  terminal path), while leaving one **Pending** (proves reject-unlock + regenerate). That way every lock level and every
  reject/regenerate branch has a live fixture. Do this via the existing demo-seed harness, not hand-SQL.

## 11. Testing (dual-layer — the full harness suite, per Marcelo)
Follow the **full 5-tier (really 4) harness suite** already set up in both apps (`test-harnesses/` + `testing.md`
ledger) — don't shortcut to an ad-hoc script.
- **Tier 1-2 unit / server harness:** reject → JEs back to `Pending` + `BatchID` null + batch `Cancelled`; approve →
  entries permanently locked (a `Batched→Pending` attempt now THROWS); regenerate → contents refreshed, summary
  re-netted, a since-added credit entry included; immutability still blocks any post-approval mutation; the full cycle
  (`order-to-glposted.ts`) still green.
- **Tier 3-4 GUI/api:** reject visibly cancels the batch (no dead buttons); regenerate button on an open batch;
  Playwright walk asserting presence + behavior, fail on any `console.error`/`pageerror`.
- **Downstream re-run discipline:** re-run every harness that touches JE lock/batch state (order-to-je, order-to-glposted,
  batching unit tests) before declaring done.

## 12. Phasing (Marcelo: "phasing is good")
1. **Lock-level mechanism** — Option A trigger rework + SQL-Server migration + `cancelBatch` + reject-unlock wiring.
   (PG parity NOT here — deferred to cutover, §9.)
2. **`regenerateBatch` (all-new-JEs, no filter)** + `buildBatch` atomicity fix.
3. **UI:** reject cancels visibly; "Regenerate batch" control; hide dead Approve/Reject on any legacy orphan.
4. **Data:** one-time orphan cleanup + seed the multi-state demo batches (§10). Tests + docs at each step.

## 13. Backlog (explicitly deferred — each its own plan/pass)
- **Candidate FILTERS** (time-bound cutoff, company/target dimensions) + **regenerate-by-filter** — good feature, needs
  its own plan (Robert + Marcelo). We lean regenerate-by-filter as the eventual shape. **The FILTER PLAN also owns the
  out-of-order-approval rule (§4-F / Q14)** — Marcelo: "add it to the filter plan" (it only bites once filters exist).
- **"Batches = filters + manually-selected records"** model — the richer batching model; separate plan.
- **PostgreSQL cutover** — convert this migration's trigger (+ the whole app) at delivery (≈ end of next week).
- **Closed-period backdating guard** (§4-E) — needs a "posted-through date per company" concept; own follow-up.

## 14. Open questions for Amith (GAAP sign-off — file to QUESTIONS.md after we rediscuss)
These are accountant-judgment calls my §4 recommendations answer provisionally but that need a real accountant to bless:
- **§4-A** cherry-picking: subtractive is out (agreed); the live question is *reversal treatment* — is pulling a reversal
  into the SAME batch/period as its original ever correct, or should reversals always forward-date into their own period
  (which the system already does)? Confirm the automatic forward-date is the GAAP-preferred behavior.
- **§4-C** cutoff: confirm oldest-forward-with-cutoff, no arbitrary-start windows.
- **§4-F** out-of-order approval: confirm whether a later-cutoff batch may be approved/posted before an earlier one in the
  same scope — enforce chronological order, warn, or allow? (Bites only in the filter era.)
- **§4-E** backdating: confirm the closed-period date rule (order date in open period; clamp to entry date if the
  target period is closed) — and whether "posted-through per company" is the right close primitive.
