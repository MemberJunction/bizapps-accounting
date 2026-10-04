---
"@mj-biz-apps/accounting-entities": minor
---

A journal entry batch becomes `Posted` or `Failed` only from `Sent`, at the database as well as in the entity (#221). `trg_JournalEntryBatch_Immutability` (50031) let a raw `UPDATE` record a `Pending` or `Approved` batch as `Posted` or `Failed` without it being sent, or a `Failed` batch as `Posted` without a retry; it now refuses these. With `trg_JournalEntryBatch_SendOnce` (50030), which refuses `→ Sent` from anything but `Approved` or `Failed`, the database enforces the whole of `JournalEntryBatchEntityServer`'s transition graph. No engine path changes: every send already saves `Sent` before recording its outcome.
