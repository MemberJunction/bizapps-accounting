---
"@mj-biz-apps/accounting-ng": patch
---

On a Pending journal entry batch, the Cancel button (Batch Dispatch and the Journal Entry Batches page) shows only to the users the server lets cancel it: the company's configured approver, or the user who built the batch. Batches the nightly job built show it to the approver only. The server check is unchanged and still decides (#308).
