---
"@mj-biz-apps/accounting-ng": minor
"@mj-biz-apps/accounting-actions": minor
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
calendar-day doctrine.

`AccountingCompanyProfile.OperatingTimeZone` is unchanged as the per-company OVERRIDE: the company
profile panel still prefers it and falls back to `BusinessTimeZoneEngine.Instance.Zone` when it is
blank, replacing a hardcoded `'America/New_York'`. It migrates into MJ Companies at 6.2, at which
point the override/fallback split goes away. Note that new profiles are stamped with a non-blank
`'UTC'`, so the fallback rarely fires in practice — tracked separately.

**The two posting jobs now schedule on the business clock.** `Timezone` on
`accounting-post-orders-payments-nightly` and `accounting-post-subscriptions-monthly` moves from
`UTC` to `America/Chicago`, because the cutoff is resolved from the BUSINESS day at the firing
instant and a job that fires before that day has rolled over resolves a day early. With the cron on
UTC and the business zone on Central, the nightly run fired at 20:00 Central the previous evening —
so PriorDay excluded that whole day's entries, and PriorMonth closed JULY on the 1 September run,
leaving all of August to wait for October. **A host in another zone must set these two rows to their
own business zone.** A test reads the committed job metadata and fails if the two stop agreeing on a
zone or name one the runtime cannot resolve.

Two window filters compared an instant against a calendar day and are corrected: Dispatch status
bounds `BatchedAt` (a `datetimeoffset`) on the instants the business day actually starts and ends
via `DayStartUtc`, rather than pasting `YYYY-MM-DD` into the SQL — which hid the 01:00 UTC nightly
run's own batches from the page that exists to triage them; and the batch-status dashboard's span
filter parses both ends as UTC midnight, where the upper end had been parsed in the browser's zone.
The journal-entry posting-date picker no longer throws on an out-of-range date: `<input type="date">` accepts
years beyond four digits, and `FromCalendarDay` raises a `RangeError` on anything that is
not a calendar day, so the handler now leaves the draft's date alone instead.

`timeWindowFilter`, exported from this package's public API, now takes `now` and `zone` as required
arguments rather than defaulting them. It had no callers inside this repo, but the change is
source-breaking for anyone outside it: a silent `'UTC'` default would have let a caller believe it
had the business-day fix when it did not, so the argument is now forced. `timeWindowRange` keeps its
optional parameters and its existing behaviour.

`resolveCutoff`, exported from `@mj-biz-apps/accounting-actions`'s public API (`export *` in
`packages/Actions/src/index.ts`), gained a required 4th parameter, `zone: string` — callers now pass
`resolveCutoff(explicitCutoff, mode, now, zone)` instead of the old 3-argument form. Same reasoning
as `timeWindowFilter`: an optional/defaulted zone would have let a caller believe prior-day/prior-month
cutoffs were business-zone-aware when they were not, so the argument is required rather than
defaulted. This is source-breaking for anyone outside this repo calling `resolveCutoff` directly.

Requires `@mj-biz-apps/common-entities` >= 5.43.0.
