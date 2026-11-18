---
"@mj-biz-apps/accounting-core-entities-server": minor
"@mj-biz-apps/accounting-actions": minor
---

Approving or rejecting a journal entry batch's approval task in the Tasks app now approves or cancels the batch (#468). Before, the task recorded the decision and the batch stayed Pending. New batches get a `Journal Entry Batch Approval` task type (metadata) whose complete and reject hooks run the new `Accounting.ApplyJournalEntryBatchTaskDecision` action. It applies the decision through the step the Accounting app's own decision now shares, with the same approver and separation-of-duties checks, under a per-batch lock so the two never act on one batch at once. A decision from someone who may not make it leaves the batch Pending and reopens the task with a comment. The approval task's description no longer sends approvers to the Accounting app. Batches built before this change keep the generic Approval Request type, and their decision is still made in the Accounting app.
