---
"@mj-biz-apps/accounting-core-entities-server": patch
"@mj-biz-apps/accounting-ng": patch
---

A journal entry batch approval decision is refused before it is written to the approval Task when the batch can no longer carry it out, so the Task and the batch cannot disagree. A decision on a batch that is no longer Pending is refused (#306): before, approving a batch its builder had cancelled marked the Task Approved. Rejection notes longer than the batch's cancel reason holds are refused (#307): before, the Task recorded the rejection and the batch stayed Pending. The limit is read from `JournalEntryBatch.CancelReason`'s field metadata. The Reject and Cancel prompts on JE batch approvals ask again, with the text kept, when a reason is too long, and the Batches screen's Cancel dialog limits the reason to the same length.
