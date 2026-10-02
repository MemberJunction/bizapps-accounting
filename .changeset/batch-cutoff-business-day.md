---
'@mj-biz-apps/accounting-core-entities-server': patch
'@mj-biz-apps/accounting-ng': patch
---

A journal-entry batch cutoff is now always a whole business day (golive #168). `EffectiveDate` is a `DATE` column, but the batch workspace sent its cutoff as a UTC instant ("now"), and the engine compared it directly, so from about 7 PM Central the preview included journal entries dated tomorrow and the build batched them. `pendingCandidateFilter` now resolves any non-midnight cutoff to the business day it falls on (`BusinessTimeZoneEngine`) and includes that whole day. Midnight-UTC cutoffs (date inputs, `resolveCutoff`'s PriorDay/PriorMonth) behave as before. The workspace's cutoff is now a date input that defaults to today's business day.
