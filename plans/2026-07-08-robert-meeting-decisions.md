# Decisions — 2026-07-08 Robert meeting (Accounting)

Source: `plans/meetings/Accounting Meeting-20260708_120251-Meeting Recording.md` (Robert Kihm, Marcelo Torres,
Ian Zygmunt). Distilled, accounting-relevant decisions. Precedence: **this doc > accounting master plan** on the
points below. The orders-side companion is `bizapps-orders/plans/2026-07-08-robert-meeting-decisions.md`.

## D1 — Batches have LEVELS of locking; reject UNLOCKS the entries (immutability model rework)
This changes the current design (where `Batched` is an always-permanent lock via `trg_JournalEntry_Immutability`).

- **Pre-approval batch = PRELIMINARY lock (reversible).** When a batch is built, its journal entries are locked so
  they can't be double-batched, **but the lock is reversible until the batch is approved or rejected.**
- **Approval = PERMANENT lock.** Once a batch is **Approved** (and on through Sent/GLPosted), the lock is
  permanent — no reversal — because the GL summary must tie back to unchanged details.
- **Reject = REMOVE the locks.** On rejection, the batch's entries are **unlocked and returned to the unbatched
  candidate pool** (Status → Pending, freed from the batch). "Without being approved, that batch effectively
  doesn't exist financially." This is the answer to the reject bug (task #12 / QUESTIONS Q4): reject must unlock.
- **Consequence — schema/trigger change required:** `trg_JournalEntry_Immutability` currently forbids
  `Batched → Pending` and treats `Batched` as permanent. The model must distinguish **preliminary (unapproved)**
  from **permanent (approved/sent/posted)** so a preliminary-locked entry is reversible. Options to design: a
  batch-approval-state gate on the trigger, or a separate "preliminary lock" flag distinct from the permanent lock.
  **Do not implement un-batching until the trigger model is redesigned** (the current invariant is deliberate).

## D2 — "Regenerate batch" for an open (unapproved) batch
- An **open/unapproved** batch is a work-in-progress you can **regenerate**: **throw out everything currently in
  it, re-gather candidates, and regenerate the summary entries.** Same batch record, refreshed contents.
- **Candidate set = every entry NOT already in a batch** (once in an approved batch, an entry is never a
  candidate again). A batch build/regenerate applies a **filter** — typically time-bound ("everything through
  Sunday night"), or "everything up to the minute."
- Use case: reviewer finds a missing credit (a credit-memo order for Widget Co), gets that order in dated
  yesterday, then **regenerates** the batch so it picks up the new entry and re-nets the summary. There should NOT
  be multiple open batches for the same scope at once.

## D3 — Terminology anchor
- **Batched = the GL lock** (gone to the GL; absolute). Everything **before** batched lives in the accounting
  **subledger**. `Pending` is the first, still-tweakable state. (Orders' `Posted` = "the JEs are in the
  subledger" — see the orders companion doc.)

## D4 — buildBatch atomicity (QUESTIONS Q5) folds into D1/D2
- The orphaned **task-less batch** problem (batch + entry-lock persist before the approval gate runs) is subsumed
  by the D1/D2 redesign: with preliminary-reversible locks + regenerate, an unapproved batch is fully reversible,
  so a gate failure no longer strands anything. Address it as part of the batch-lock rework, not a standalone
  reorder. (Existing orphaned demo batches still need one-time cleanup.)

## Build implication
This is a **significant redesign** of the batching lock/approval flow + the immutability trigger — not a small
fix. It supersedes the current "Batched = permanent" behavior. Sequence it deliberately (schema migration + trigger
change + engine `buildBatch`/`regenerateBatch`/reject-unlock + tests) rather than patching the reject path alone.
