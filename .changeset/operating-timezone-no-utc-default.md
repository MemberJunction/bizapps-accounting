---
"@mj-biz-apps/accounting-core-entities-server": minor
---

Stop defaulting `AccountingCompanyProfile.OperatingTimeZone` to `'UTC'` on create (#158).

The field is an optional per-company display override; blank inherits the instance's
`BizApps.BusinessTimeZone`. The first-save default stamped `'UTC'` on every new profile, so the
company header's fallback to the business zone never fired and new companies showed UTC. A new
profile now keeps whatever the caller supplied, including blank.

**Data change:** the migration clears `OperatingTimeZone` on every profile that holds `'UTC'`, so
existing companies show the business zone too. The stamp was written before the first save, so a
chosen UTC cannot be told apart from the default. The field is display only, so no calculation
changes; a company that genuinely operates in UTC shows the business zone until the value is
entered again.
