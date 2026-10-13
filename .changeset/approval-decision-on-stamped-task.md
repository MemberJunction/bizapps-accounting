---
"@mj-biz-apps/accounting-core-entities-server": patch
---

A batch's approval Task can no longer be changed through the entity once it is set, and the approval decision is recorded on that stamped Task (#313). `JournalEntryBatchEntityServer.Validate` refuses a new `ApprovalTaskID` on a batch that already has one, and `TasksAppApprovalGate.recordDecision` records on the batch's stamped `ApprovalTaskID` instead of the newest Task Link, which a forged link could redirect. A batch with no stamped approval Task is refused a decision; it could not be sent anyway.
