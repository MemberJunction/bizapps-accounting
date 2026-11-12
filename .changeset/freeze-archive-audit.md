---
"@mj-biz-apps/accounting-core-entities-server": minor
---

An Archived journal entry batch's archive audit (ArchiveReason, ArchivedAt, ArchivedByUserID) can no longer be rewritten. The entity refuses a plain save that changes ArchiveReason, as it already did for ArchivedAt and ArchivedByUserID, and trg_JournalEntryBatch_Immutability (50032) lets the three change only in the update that archives the batch.
