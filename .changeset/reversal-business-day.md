---
'@mj-biz-apps/accounting-core-entities-server': patch
---

`GenerateReversal` now dates the reversal's `EffectiveDate` with today's business day (`BusinessTimeZoneEngine`) instead of the server clock, so a reversal created near midnight no longer lands on the wrong calendar day, month or period (#230). The business-day helper `JournalEntryBatchEngine` used for `PostingDate` moved to a shared `BusinessDay` module that both now use.
