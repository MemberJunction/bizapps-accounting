---
"@mj-biz-apps/accounting-core-entities-server": minor
---

Stop defaulting `AccountingCompanyProfile.OperatingTimeZone` to `'UTC'` on create (#158).

The field is an optional per-company display override; blank inherits the instance's
`BizApps.BusinessTimeZone`. The first-save default stamped `'UTC'` on every new profile, so the
company header's fallback to the business zone never fired and new companies showed UTC. A new
profile now keeps whatever the caller supplied, including blank.

Existing profiles are not backfilled: a profile created while the default was live still carries
`'UTC'` and shows UTC until the field is cleared.
