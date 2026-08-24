# Concurrency: batching and posting journal entries

**Status:** OPEN — analysis complete, fix deferred. Parked 2026-08-21 so the BC integration could land first.
**Priority:** not urgent, but the posting race is a real money bug and should not sit indefinitely.

## TL;DR

Neither concurrent **batching** of the same JEs nor concurrent **posting** of the same batch is
protected. Both are the same defect: a read-then-write with no atomic guard. The intended eventual
fix is a **write-intent lock on the candidate read** (`UPDLOCK, HOLDLOCK` / `FOR UPDATE`), plus a
**compare-and-swap** on the single-row status transition for posting.

## The two races

### 1. Batching — `buildJournalEntryBatch` → `lockJournalEntries`

`JournalEntryBatchEngine.ts:631-639` is a plain read-modify-write:

```ts
await je.Load(jeId);
je.JournalEntryBatchID = batchId;
je.Status = 'Batched';
await je.Save();          // blind write — no "AND Status='Pending'" predicate
```

`validateCandidates` does check `Status === 'Pending'` first, but that is a *separate read*.

**Race:** A and B both read JE X as `Pending`, both pass validation, both write. B's write blocks on
A's row lock, then overwrites → X belongs to batch **B**.

**Consequence — worse than a duplicate:** batch A's *netted summary JE was already computed including
X's amounts* and persists. Post both and X's amounts reach the general ledger **twice**. No error, no
constraint violation, and each batch looks internally consistent. The summary is the corruption, not
the ownership — the `JournalEntryBatchID` column already guarantees X has exactly one batch, so no
uniqueness constraint can catch this.

### 2. Posting — `sendJournalEntryBatch`

`JournalEntryBatchEngine.ts:761-780`, and note this one is **not in a transaction at all** (the only
`BeginTransaction` is phase 3, after the post confirms):

```ts
if (batch.Status !== 'Approved') throw ...   // read
...
batch.Status = 'Sent'; await batch.Save();   // blind write
```

**Race:** both sessions see `Approved`, both set `Sent`, **both call the adapter** → the batch posts
to BC twice. Duplicate GL entries, irreversible, correctable only by reversing entries.

The `Sent` marker does its intended job (crash recovery — "someone started"). It is **advisory, not
enforced**: a marker only excludes a second actor if the transition is atomic.

## Why the obvious answers don't work

**A transaction is not the missing ingredient.** It gives atomicity and rollback across statements;
it does not turn read-then-write into a conditional write. Under READ COMMITTED both sessions still
read the same value and proceed.

**Isolation level would work but is a bad trade** (rejected 2026-08-21). `SERIALIZABLE`/
`REPEATABLE READ` does prevent the lost update, but: MJ's provider exposes no isolation setting
(`transaction.begin()` is called with no argument; no `isolationLevel` anywhere in
SQLServerDataProvider), so it needs an MJ-core change; it escalates locking across everything in the
build transaction (which reads views, creates the summary JE, writes many rows), inviting deadlocks;
and the loser gets a serialization failure rather than a clean "someone else took it".

**RunView / RunQuery cannot enforce this.** They are reads, and the read already exists — it is
precisely what fails. Any number of additional reads leaves the same window open, because the race
lives *between* the read and the write. **Reads don't exclude; only writes and locks exclude.**

**No entity-layer primitive exists.** `BaseEntity` has no rowversion / concurrency token, so
`Save()` cannot fail on a concurrent modification. This is an MJ-core gap (see below).

## Where we landed

Different shapes for the two cases:

| | Fix | Why |
|---|---|---|
| **Posting** | compare-and-swap: `SET Status='Sent' WHERE ID=@id AND Status='Approved'`, rowcount 0 ⇒ someone beat you, abort **before** calling the adapter | single row, no existing transaction, clean loser detection, portable SQL |
| **Batching** | write-intent lock on the existing candidate read — `WITH (UPDLOCK, HOLDLOCK)` (SQL Server) / `FOR UPDATE` (Postgres) | multi-row, already inside a transaction, and it leaves the existing entity logic and validation intact — the DB does the work, and the validation you already have then genuinely enforces |

Marcelo's call (2026-08-21): **the write-intent lock is the right approach** — it is the SQL-supported
way to do this, and it is where we should eventually land.

Encapsulate both on the entity server class (`JournalEntryBatchEntityServer.Cancel()` already
establishes that pattern), so callers get e.g. `batch.MarkSent(user)` returning false rather than
seeing SQL.

## Constraints the fix must satisfy

1. **All-or-nothing for batching.** A bare `UPDATE ... WHERE Status='Pending'` could claim some JEs
   and skip others. That is only safe *inside* the build's existing transaction (`BeginTransaction`
   at :223, `lockJournalEntries` at :228) with a rowcount check that throws → rolls back → nothing
   applied. Partial application would leave a summary computed over JEs the batch no longer owns.
2. **Reject the whole set, and say which JEs were taken (Marcelo, 2026-08-21).** This is a UX
   requirement, not just correctness: *"the user needs to know what they are approving."* So the
   failure must name the conflicting JEs, not just fail. A write-intent lock supports this naturally
   — lock all candidates, validate all, reject with the full list.

## Open question — parked

A **preliminary/claimed status** (a marker set before processing, to stop other instances picking up
the same JEs) would work, but risks **stranded JEs**: a process that dies mid-flight leaves rows
claimed with nothing to release them. Any such marker needs a defined recovery path (timeout,
takeover rule, or an operator action) before it is safe. Unresolved — decide alongside the lock work.

## Related MJ-core gap (worth filing separately)

**Optimistic concurrency on `BaseEntity.Save()`.** The standard pattern: each row carries a version
token (rowversion / timestamp); `Save()` includes it in the `WHERE` clause and fails if the row
changed since it was read, so the caller learns about the conflict instead of silently overwriting.
MJ has none, which is why this class of bug is reachable from ordinary entity code in *any* MJ app,
not just accounting. Fixing it in core would make this a property of every entity rather than a
bespoke thing accounting does. Not filed yet.

## Provenance

Analysis 2026-08-21 during the Business Central JE-export work. Verified against
`JournalEntryBatchEngine.ts`, `SQLServerDataProvider.ts` (no isolation level set),
`databaseProviderBase.ts:129` (`ExecuteSQL` is available), and `BaseEntity` (no concurrency token).
Ruling to defer: BC integration first.
