---
'@mj-biz-apps/accounting-core-entities-server': patch
'@mj-biz-apps/accounting-actions': patch
---

Auto-posting is restricted to the MJ system user (#269). `autoPostJournalEntryBatch` approves the batch as its context user with no approval Task, so until now any signed-in user who ran `Accounting.BuildJournalEntryBatches` with `AutoPost: true` could build, approve and post a batch without CFO approval. The new `assertAutoPostCaller` refuses any context user other than the system user the scheduled posting jobs run as, and refuses when the user cache does not hold the system user. `autoPostJournalEntryBatch` checks it before the build, and the action checks it before any company is read. A run without `AutoPost` is unchanged: it builds behind the approval gate for any user.
