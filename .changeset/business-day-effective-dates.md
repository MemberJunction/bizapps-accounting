---
"@mj-biz-apps/accounting-ng": minor
"@mj-biz-apps/accounting-actions": patch
"@mj-biz-apps/accounting-core-entities-server": patch
---

Effective dates, posting dates and batch cutoffs are judged on the business day (bc-aidp-next-golive#168).

A journal entry drafted at 9 PM Eastern on 31 August defaulted to 1 September, because the default
was the UTC calendar day; the prior-day batch run at 1 AM UTC on the 1st judged "yesterday" in UTC
too and skipped it. The draft now defaults to today in the instance's business time zone
(`BusinessTimeZoneEngine` from bizapps-common), the picker writes UTC midnight of the chosen day and
the draft reads it back from UTC parts, so the two never disagree by a browser offset. The batch
engine's posting date and `resolveCutoff`'s prior-day and prior-month arithmetic take the business
zone as an argument. The dashboards' month window, the batch-build modal's default cutoff and the
"last N days" list windows on Dispatch status, All batches and All journal entries all anchor on the
same day. CLAUDE.md's "display/zone is a presentation concern" line is replaced with the
calendar-day doctrine; `AccountingCompanyProfile.OperatingTimeZone` is superseded and no longer read
as a fallback in the company profile panel.
`timeWindowFilter`, exported from this package's public API, now takes `now` and `zone` as required
arguments rather than defaulting them. It had no callers inside this repo, but the change is
source-breaking for anyone outside it: a silent `'UTC'` default would have let a caller believe it
had the business-day fix when it did not, so the argument is now forced. `timeWindowRange` keeps its
optional parameters and its existing behaviour.

Requires `@mj-biz-apps/common-entities` 5.43.0.
