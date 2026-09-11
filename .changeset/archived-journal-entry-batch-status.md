---
"@mj-biz-apps/accounting-core-entities-server": minor
"@mj-biz-apps/accounting-entities": minor
"@mj-biz-apps/accounting-server": minor
"@mj-biz-apps/accounting-ng": minor
---

A terminal `Archived` status for journal entry batches that must never post to the ERP (golive #214). Until now the only two terminal states were `Posted`, reachable only through a successful ERP send, and `Cancelled`, which releases the member entries back to the candidate pool — so "close this batch, it must never go to Business Central" had no expression. `Archived` is reachable from `Pending`, `Approved` and `Failed` (not from `Sent`, which may still be posting), makes no ERP call, and leaves the member entries locked at `Batched`: they stay invisible to the nightly and monthly builds, and `trg_JournalEntry_Immutability` refuses to unlock them once the owning batch is no longer `Pending`. A required `ArchiveReason` plus `ArchivedAt` / `ArchivedByUserID` are enforced by the entity and by a new `CK_JournalEntryBatch_ArchiveAudit` CHECK, and `trg_JournalEntryBatch_Immutability` now freezes an `Archived` batch alongside `Approved` / `Sent` / `Posted` so its status cannot be edited back to `Pending` by direct SQL. Exposed as `JournalEntryBatchEntityServer.Archive(reason)`, the `Accounting.ArchiveJournalEntryBatch` remote operation, and an Archive action on the Batch Dispatch dashboard.
