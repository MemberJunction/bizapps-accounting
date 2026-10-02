---
'@mj-biz-apps/accounting-actions': patch
---

Action dates follow the business day (golive #168). `Accounting.BuildJournalEntryBatches`: an explicit `Cutoff` written as a date-time is the business day it falls on (`2026-09-30T19:00:00-05:00` is 30 September, not 1 October), `StartDate` reaches the engine as written so it resolves by the same rule, and a malformed `Cutoff` or `StartDate` (`garbage`, `2026-02-30`, a date-time with no offset) fails with an error naming the parameter. The Business Central journal-entry action posts with today's business day when no `EntryDate` is given, instead of the UTC day — which from about 7 PM Central is already tomorrow.
