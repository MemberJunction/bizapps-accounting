---
'@mj-biz-apps/accounting-core-entities-server': patch
'@mj-biz-apps/accounting-ng': patch
---

A journal-entry batch cutoff is now always a whole business day (golive #168). `EffectiveDate` is a `DATE` column, but the batch workspace sent its cutoff as a UTC instant ("now"), and the engine compared it directly, so from about 7 PM Central the preview included journal entries dated tomorrow and the build batched them. The workspace's cutoff is now a date input that defaults to today's business day.

The SHAPE of a cutoff or start date decides what it means: `YYYY-MM-DD` is that day; an ISO date-time with an offset is the business day it falls on (`BusinessTimeZoneEngine`), so `2026-09-30T19:00:00-05:00` — exactly UTC midnight — is 30 September, not 1 October. `StartDate` follows the same rule as `Cutoff`, so a start and cutoff at the same evening instant no longer select an empty window. `BuildJournalEntryBatchOptions.cutoff`/`startDate` accept these strings as well as a `Date`; a `Date` at UTC midnight is still read as a day (the in-process shape `FromCalendarDay` produces), any other `Date` as an instant.

A malformed `Cutoff` or `StartDate` — `garbage`, `2026-02-30`, a date-time with no offset — is now refused at the boundary with an error naming the field, instead of a bare `RangeError` or a silent roll-over into March. New public export: `requireDateBound(value, context)`. The batch `PostingDate` now looks up the business day for the batch's company, the same lookup the cutoff makes.
