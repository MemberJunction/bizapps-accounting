---
"@mj-biz-apps/accounting-core-entities-server": minor
"@mj-biz-apps/accounting-actions": minor
---

`sendJournalEntryBatch` and `cancelJournalEntryBatch` resolve their approval gate, ERP poster and ERP lookup themselves (#233), so a server caller can no longer pass a gate that allows everything or leave the ERP lookup out. They come from the new `JournalEntryBatchDispatchServices` class through the MJ ClassFactory: the defaults are `TasksAppApprovalGate` and the AccountingERPEngine poster and lookup, and a subclass registered at a higher priority replaces them (unit tests and harnesses do).

**Breaking:** `SendJournalEntryBatchOptions` loses `gate`, `poster` and `lookup`, and `CancelJournalEntryBatchOptions` loses `gate` and `lookup`. `JournalEntryBatchCancelGate` gains `assertRejected`.

The scheduled-posting approval waiver moves into one engine function, `autoPostJournalEntryBatch`: it enforces the include-list policy (`assertAutoPostPolicy`, moved from the action), builds with `AutoApproveGate`, approves as the context user and sends. It is the only send without an approval Task. `Accounting.BuildJournalEntryBatches` with `AutoPost` calls it per company; a failure after the build throws `AutoPostDispatchError`, which carries the build.

Cancelling a `Pending` batch now requires a terminal rejection recorded on its approval Task (`TasksAppApprovalGate.assertRejected`). Rejecting from Batch approvals records it first, so it works as before. A `Pending` batch with no approval Task has nothing to reject and cannot be cancelled; archive it instead.
