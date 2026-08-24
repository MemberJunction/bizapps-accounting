---
'@mj-biz-apps/accounting-core-entities-server': minor
---

Approving a journal entry batch is now ONE transaction. `JournalEntryBatchEntityServer.Approve()`
records the terminal decision against the batch's approval Task (through the injected gate) and
flips the batch's own `Status` to `Approved` together, so the two half-approved states that were
previously reachable — Approved with no decision (dispatch clears its status check, then the gate
throws) and decision-recorded-while-Pending (the gate is satisfied, then dispatch throws on the
status) — no longer exist. `Accounting.RecordJournalEntryBatchDecision`'s approve path routes
through it.

`JournalEntryBatchApprovalGate` gains a required `recordDecision` member (`AutoApproveGate`
implements it as a no-op), and the standalone `approveJournalEntryBatch` is deprecated for any flow
behind a real gate.
