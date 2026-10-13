---
"@mj-biz-apps/accounting-ng": patch
---

Approve and Reject (Batch Dispatch) show only to the company's configured approver, and not on a batch that user built. Cancel on an Approved or Failed batch (Batch Dispatch, the Journal Entry Batches page and Dispatch status) shows only to the company's approver or the user who approved the batch. The server checks are unchanged and still decide (#339).
