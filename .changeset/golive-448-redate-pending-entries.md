---
"@mj-biz-apps/accounting-core-entities-server": minor
"@mj-biz-apps/accounting-server": minor
"@mj-biz-apps/accounting-ng": minor
---

New remote operation `Accounting.RedatePendingJournalEntries` (bc-aidp-next-golive#448) moves Pending, unbatched journal entries to a corrected day in place, all or nothing, named by their source record (LinkedEntity + LinkedRecordIDs) or by ID. It needs the batch-operator Authorization (the Finance role) and refuses a batched or posted entry, a reversed entry, a day on or before the books-closed-through date or before the posting start date, and a move across fiscal years. `JournalEntryEntityServer.SaveRedatedEffectiveDate` is the one save that may change a saved entry's date, and `EffectiveDateChangeAllowed` tells a date-immutability rule to let it through.

The batch preview now reports entries dated after the posting date: `AfterPostingDateCount`, and the oldest 50 in `AfterPostingDateEntries` with the reason each is held back. The Build Batch dialog and the batch workspace show them next to the posting start date notice.
