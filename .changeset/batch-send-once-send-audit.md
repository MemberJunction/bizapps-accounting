---
"@mj-biz-apps/accounting-entities": minor
"@mj-biz-apps/accounting-core-entities-server": minor
"@mj-biz-apps/accounting-actions": minor
"@mj-biz-apps/accounting-server": minor
"@mj-biz-apps/accounting-ng": minor
---

A journal entry batch can no longer be sent to the ERP twice, and every send is recorded (#184).

- New trigger `trg_JournalEntryBatch_SendOnce` (error 50030). A send must start from `Approved` or `Failed`
  and advance `SendAttemptCount` by exactly one; no update may keep a batch `Sent`; and `SentAt`,
  `SentByUserID` and `SendAttemptCount` change at no other time. When two operators, two browser tabs, or a
  scheduled run and an operator send the same batch, the second save fails and its ERP call never runs,
  whether the first send is still `Sent`, has `Posted`, or has `Failed` again.
- `sendJournalEntryBatch` throws `JournalEntryBatchSendRefusedError` for that refusal, naming the status the
  batch reads now. `Accounting.BuildJournalEntryBatches` does not mark the batch `Failed` on it.
- New columns `SentByUserID` and `SendAttemptCount` on `JournalEntryBatch`. Every transition into `Sent`
  stamps them, with `SentAt`, from the context user and the loaded count. The count is dispatch attempts that
  entered `Sent`, including a retry adopted from the ERP and a first send the pre-flight lookup refuses.
  Batches sent before this release read `SendAttemptCount = 1`, with no sender.
- The batch detail panel and the Dispatch status page show who sent a batch and how many attempts it took.
- A successful retry still clears `ErrorMessage`. The earlier value, and each overwritten `SentAt` and
  sender, remain in `__mj.RecordChange`.
