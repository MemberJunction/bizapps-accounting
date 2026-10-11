---
'@mj-biz-apps/accounting-core-entities-server': patch
'@mj-biz-apps/accounting-ng': patch
---

Batch posting date: a prior or future month is confirmed, not refused (golive #315).

- **Engine.** A future `PostingDate` is no longer refused. The candidate pool still ends at the earlier of the cutoff and the posting date, and a selection holding an entry dated after the posting date is still refused.
- **UI.** The batch workspace and the Batches page's build modal offer any date. When the posting date is outside the current month, they show an "are you sure?" warning naming the month the ERP books the batch in, and Build stays disabled until the user ticks the confirmation. Changing the date asks again.
