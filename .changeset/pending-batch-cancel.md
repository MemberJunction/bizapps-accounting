---
"@mj-biz-apps/accounting-core-entities-server": minor
"@mj-biz-apps/accounting-ng": minor
---

A Pending journal entry batch can be cancelled with a reason by the company's configured approver or by the user who built it. Its journal entries return to the candidate pool, and its approval Task gets a comment and is closed as Cancelled. `Accounting.CancelJournalEntryBatch` now accepts a Pending batch. A CFO rejection still cancels a Pending batch through `Accounting.RecordJournalEntryBatchDecision`, and its notes become the batch's `CancelReason`.

The Batches screen and JE batch approvals offer Cancel on a Pending batch, and Reject asks for a reason.

Breaking change to `JournalEntryBatchCancelGate`: `assertRejected` is replaced by `isRejected`, which returns a boolean, and `assertMayCancelPending` is added.
