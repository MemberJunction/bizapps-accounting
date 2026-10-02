---
"@mj-biz-apps/accounting-core-entities-server": patch
---

Cancelling a Failed batch now looks its number up in the ERP a second time, after the cancel's writes and before they commit (#215). The first lookup's "nothing posted" means nothing has posted yet; a post the ERP was still processing can land after it. If the second lookup finds this batch's posting, the cancel is rolled back, so its entries are never released, the batch is recorded Posted the way a retry records it (no second ERP post), and `Cancel()` throws the new `JournalEntryBatchPostedDuringCancelError`. Any other answer lets the cancel commit.
