---
"@mj-biz-apps/accounting-ng": patch
---

The deferred-revenue waterfall buckets each journal entry into the month of its `EffectiveDate` as a
calendar day, and measures "recognized to date" against the business month. It read the stored UTC
midnight with browser-local getters, so for any viewer west of Greenwich every month shifted back one
period. An entry with no `EffectiveDate` falls back to its creation instant, placed on the business
zone's calendar.
