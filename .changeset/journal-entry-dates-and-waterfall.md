---
"@mj-biz-apps/accounting-entities": minor
"@mj-biz-apps/accounting-core-entities-server": minor
"@mj-biz-apps/accounting-ng": minor
---

Journal entry dates and the deferred-revenue waterfall:

- `vwJournalEntries` computes `EffectiveDayOfWeek` and `IsWeekend` the same way whatever the session's `DATEFIRST` (#395). Values on a `DATEFIRST 7` (US English) host are unchanged: 1 is Sunday, 7 is Saturday, and only Saturday and Sunday are the weekend. The PostgreSQL view reads the weekday from the date itself (`ISODOW`), so its values do not depend on the session time zone.
- `Accounting.CreateJournalEntry` / `CreateJournalEntries` store a draft's `EffectiveDate` as the business day it names (#427). A date-time with an offset is filed on the business day it falls on, not its UTC day; a `YYYY-MM-DD` day or a UTC-midnight string is that day. A date-time with no offset, or a day that does not exist, is refused with `MALFORMED_DRAFT`.
- The waterfall shows "Partly released" for a month only part of which is recognized, and "Released" only once all of it is (#429).
- The waterfall keeps counting a reversed entry until its reversal's day arrives, loading the reversal's date when the caller did not pass the reversal in (#430).
