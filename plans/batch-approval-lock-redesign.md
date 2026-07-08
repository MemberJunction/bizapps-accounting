# Plan — Batch approval lock redesign (reject-unlock + regenerate)

> **Status:** Design plan — NOT yet implemented. A real backend change; think it through before coding.
> **Drives:** task #12 (batch Reject). **Decision source:** `plans/2026-07-08-robert-meeting-decisions.md` (D1/D2),
> transcript `plans/meetings/Accounting Meeting-20260708_120251-Meeting Recording.md`. **Supersedes** the current
> "`Batched` = permanent immutable lock" behavior.

## 1. Problem
Today a journal entry is **permanently** locked the instant it's batched (`trg_JournalEntry_Immutability`:
once `Status='Batched'`, only `Batched→GLPosted` / `GLPostedAt` / `GLReferenceID` / `ReversedByJournalEntryID`
may change). So **rejecting** a built batch can't return its entries to the pool — the reject records the
decision but leaves the batch `Pending` and the entries `Batched` forever (task #12: "reject does nothing").
And `buildBatch` locks entries **before** the approval gate runs, so a gate failure orphans a task-less batch.

## 2. The decision (Robert, 2026-07-08)
- **Levels of locking.** A batch that is **not yet approved** is a work-in-progress: its entries are
  **preliminarily locked** (so they can't be double-batched) but the lock is **reversible**. **Approval makes
  the lock permanent** (GL summary must tie back to unchanged details); no reversal after that.
- **Reject removes the locks** — entries go back to the **unbatched candidate pool**. An unapproved batch
  "effectively doesn't exist financially."
- **Regenerate an open batch:** throw out its current entries, **re-gather candidates** (everything not already
  in a batch, by a **filter** — typically time-bound), and **regenerate** the summary entries. Same batch record.
  Only one open batch per scope at a time.
- **Candidate rule:** an entry is a candidate iff it is not currently in a batch (once in an *approved* batch it
  is never a candidate again).

## 3. Current state (what exists)
- `JournalEntry.Status`: `Pending | Batched | GLPosted` (+ others); `BatchID` FK. Immutability trigger above.
- `JournalEntryBatch.Status`: `Pending | Approved | Sent | Posted | Failed | Cancelled`.
- `BatchingEngine`: `buildBatch` (lock JEs Pending→Batched, then `gate.onBatchBuilt`), `approveBatch`
  (Pending→Approved), `sendBatch` (Approved→Sent→Posted; JEs Batched→GLPosted). **No** `cancelBatch`,
  `regenerateBatch`, or reject-unlock.
- `TasksAppApprovalGate`: raises/records the CFO approval task; reject records the decision (task→Cancelled) but
  does nothing to the batch.

## 4. Target model
`Pending` (in pool) → **`Batched` while batch is unapproved = PRELIMINARY lock (reversible)** → batch `Approved`
= **PERMANENT lock** → `GLPosted`. Reject/cancel of an unapproved batch: JEs `Batched→Pending`, `BatchID→null`.

## 5. Design — how to represent the two lock levels

**The lock level is a function of the JE's batch approval state.** Two ways to enforce it:

- **Option A — batch-status-aware trigger (no new column, recommended).** `trg_JournalEntry_Immutability` also
  permits `Batched→Pending` + `BatchID→null` **when the JE's current batch is still `Pending`** (unapproved).
  It looks up `JournalEntryBatch.Status` for the row's `OLD.BatchID`. Single source of truth = the batch's
  approval state; approve/reject change only the batch, and the JE lock level follows automatically.
  - Trade-off: the trigger must join `inserted`→`JournalEntryBatch` (more complex; watch bulk-update perf) and
    the SQL→PG converter must handle it (PG parity, per the accounting migration convention).
- **Option B — explicit JE lock flag.** Add `JournalEntry.LockLevel` (`Preliminary|Permanent`) or
  `IsPermanentlyLocked BIT`. `buildBatch` sets Preliminary; `approveBatch` flips every batch JE to Permanent; the
  trigger keys off the flag (simple, no join). Trade-off: a new column that must stay in sync with batch status
  (approve/send/cancel must maintain it) — a second source of truth to keep honest.

**Recommendation:** **Option A** (derive from batch status — fewer moving parts, no sync bug surface), unless the
trigger-join performance or the PG conversion proves problematic, in which case fall back to **Option B**.

## 6. Engine changes
- **`cancelBatch(batchId)` / reject path** — only for a `Pending` (unapproved) batch: unlock its JEs
  (`Batched→Pending`, `BatchID=null`), set batch `Status='Cancelled'`. Wire into `RecordJEBatchDecision` for a
  `Rejected` decision (mirrors how `Approved` calls `approveBatch`). Order the JE-unlock **before** the batch
  flips out of `Pending` (Option A) or clear the flag (Option B).
- **`regenerateBatch(batchId, filter)`** — for a `Pending` batch: unlock its current JEs → re-gather candidates
  (`Status='Pending'` matching the filter) → re-lock them into the batch → recompute summary line items + control
  totals. Effectively `cancelBatch`'s unlock + `buildBatch`'s build, in place on the same batch record.
- **`buildBatch` — candidate filter + atomicity.** Add the candidate **filter** (Robert: time-bound, e.g.
  "through Sunday night"); today it takes *all* `Pending`. Fix the atomicity so a gate failure can't strand a
  batch — with reversible preliminary locks this is far less severe (an orphan is now cancellable/regenerable),
  but still raise the approval task in the same unit of work (transaction) as the lock, or after it with a
  compensating cancel on gate failure.
- **Guard:** `approveBatch`/`sendBatch` unchanged except they now rely on the lock level becoming permanent at
  approve (Option A: automatic; Option B: set the flag in `approveBatch`).

## 7. Schema / migration
- New `V*` migration: rework `trg_JournalEntry_Immutability` (SQL Server T-SQL) + regenerate the PG counterpart
  via the converter (`migrations-pg/`), keep CI PG-parity green. (Option B also adds the column + backfill
  existing `Batched` rows as Permanent if their batch is approved, else Preliminary.)
- Update `docs/bizapps-accounting-erd.md` + `docs/lifecycle-hooks.md` (immutability rule change) per the repo's
  "docs are part of Done" convention.

## 8. Data cleanup (existing orphans)
Existing orphaned task-less demo batches (`BATCH-000054/055/058/060`, `Pending`, entries `Batched`) predate this
model. Once `cancelBatch` exists, run a one-time cleanup: cancel them + unlock their entries. (Until then they're
inert noise in the dev instance.)

## 9. Testing (dual-layer)
- **Unit / server harness:** reject → JEs back to `Pending` + `BatchID` null + batch `Cancelled`; approve →
  entries permanently locked (a `Batched→Pending` attempt now THROWS); regenerate → contents refreshed, summary
  re-netted, a since-added credit entry included; immutability still blocks any post-approval mutation; the
  full cycle (`order-to-glposted.ts`) still green.
- **GUI:** reject visibly cancels the batch (no dead buttons); regenerate button on an open batch.

## 10. Phasing
1. Lock-level mechanism (Option A trigger rework + migration + PG parity) + `cancelBatch` + reject-unlock wiring.
2. `regenerateBatch` + candidate filter + `buildBatch` atomicity.
3. UI: reject cancels visibly; "Regenerate batch" control; hide dead Approve/Reject on any legacy orphan.
4. One-time orphan cleanup. Tests + docs at each step.

## 11. Open sub-questions (confirm before/along the way — add to QUESTIONS.md if blocking)
- **Lock mechanism:** Option A (batch-status-aware trigger) vs Option B (JE flag) — bless one.
- **Regenerate = same batch record** refreshed (Robert leaned this way) vs a new batch? Confirm.
- **Candidate filter dimensions** — time-bound only, or also company/target-system? What's the default?
- **Manual add to an open batch** — supported, or only via regenerate re-gathering by filter? (Robert leaned
  regenerate-by-filter, not ad-hoc add.)
- **One-open-batch-per-scope** enforcement — hard rule? scoped by what (company / target system / global)?
