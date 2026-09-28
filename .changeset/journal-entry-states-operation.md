---
"@mj-biz-apps/accounting-core-entities-server": patch
"@mj-biz-apps/accounting-server": patch
---

New read-only remote operation `Accounting.GetJournalEntryStates { JournalEntryIDs }` (#193). For each id it returns `Found`, `Status`, `EffectiveDate` (a `YYYY-MM-DD` calendar day), `JournalEntryBatchID` and the owning batch's `JournalEntryBatchStatus` (null when unbatched), in request order, from two reads: the entries, then their batches. An unknown id is reported `Found: false`. Every id is validated as a UUID before it reaches a filter, and one malformed id refuses the whole call; at most 500 ids per call.
