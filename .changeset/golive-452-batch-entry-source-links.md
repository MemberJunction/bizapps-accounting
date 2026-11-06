---
"@mj-biz-apps/accounting-ng": minor
"@mj-biz-apps/accounting-core-entities-server": patch
---

The batch detail panel and the batch workspace list each entry's source record in a new Source column, which opens that record (the payment line or order line that created the entry). The record is named by its entity's name field when it has one, otherwise by the entity; names load in one batched read. The batch preview now returns each candidate's LinkedEntity and LinkedRecordID. What is sent to the ERP is unchanged.
