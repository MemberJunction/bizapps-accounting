---
"@mj-biz-apps/accounting-core-entities-server": minor
---

A `Pending` journal entry batch can no longer be set to `Cancelled` by an ordinary save (#213). The generic form or the GraphQL update could take that edge and skip `Cancel()`'s teardown, leaving the summary journal entry in place and the member entries `Batched` under a `Cancelled` batch, where any journal entry save could release them. Every `→ Cancelled` edge now goes through `JournalEntryBatchEntityServer.Cancel()`, as `Approved` and `Failed` already did; regenerate's empty cancel uses the new `CancelAfterTeardown()`, which refuses a batch whose summary pointer is still set. `trg_JournalEntryBatch_Immutability` (50031) now refuses a move to `Cancelled` from any status while `SummaryJournalEntryID` is set.
