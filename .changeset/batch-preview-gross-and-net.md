---
"@mj-biz-apps/accounting-core-entities-server": patch
"@mj-biz-apps/accounting-ng": patch
---

The batch preview returns `GrossDebits` and `GrossCredits`, the ticked entries' line totals before netting, beside
the netted `TotalDebits` and `TotalCredits` the batch carries. The Build Batch modal shows both as "Entry Totals" and
"Net to Post", with a note when netting reduces the total, and the batch workspace's summary strip shows both. A
recognition entry's Dr Deferred Revenue nets against its booking's Cr Deferred Revenue, so the netted pair alone read
as if recognition entries were left out. The modal's ordering warning now says the count is of excluded entries older
than an included one; it described them as included entries.
