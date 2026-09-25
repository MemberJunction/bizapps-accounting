---
"@mj-biz-apps/accounting-entities": minor
"@mj-biz-apps/accounting-core-entities-server": minor
"@mj-biz-apps/accounting-server": minor
"@mj-biz-apps/accounting-ng": minor
---

A journal entry batch can no longer be sent to the ERP twice at once, and every send is recorded (#184).

- New trigger `trg_JournalEntryBatch_SendOnce` (error 50030) refuses a new send on a batch that is already
  `Sent`. When two operators, or two browser tabs, retry the same Failed batch together, the second save
  fails and its ERP call never runs.
- New columns `SentByUserID` and `SendAttemptCount` on `JournalEntryBatch`. Every transition into `Sent`
  stamps them, with `SentAt`, from the context user and the loaded count. Batches sent before this
  release read `SendAttemptCount = 1`, with no sender.
- The batch detail panel and the Dispatch status page show who sent a batch and how many sends it took.
- A successful retry still clears `ErrorMessage`. The earlier value, and each overwritten `SentAt` and
  sender, remain in `__mj.RecordChange`.
