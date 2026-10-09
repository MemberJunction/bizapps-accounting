---
"@mj-biz-apps/accounting-entities": minor
"@mj-biz-apps/accounting-server": minor
---

A journal entry batch's cancel reason holds 1,000 characters, up from 500 (`JournalEntryBatch.CancelReason` is `NVARCHAR(1000)`). Migration `V202610091400` widens the column and regenerates the batch's base view and create/update/delete procedures, whose `@CancelReason` parameter was `nvarchar(500)` (#307).
