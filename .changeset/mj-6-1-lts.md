---
"@mj-biz-apps/accounting-entities": patch
---

Move MemberJunction to the 6.1 LTS line AIDP Next runs (`~6.1.5`) and `@mj-biz-apps/common-*` to `^5.50.2`, leaving one copy of each package. Regenerated from a database built from migrations: `_mj__Latitude` / `_mj__Longitude` are nullable in the GraphQL schema on Accounting Company Profile, Tax Authority and Tax Jurisdiction (#267).
