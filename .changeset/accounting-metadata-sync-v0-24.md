---
'@mj-biz-apps/accounting-entities': minor
---

The 0.24 Metadata_Sync ships what metadata/ gained since 0.23, so hosts receive it through migrations: five finance exception types, the Gift Card Liability GL account role, the accounting API scopes and their MJAPI application scopes, eleven authorizations with two Finance grants, the Finance Exceptions Cleared and Journal Entries Held Back By Posting Start Date queries, form categories on 60 entity fields, and updated descriptions and action categories. A PostgreSQL counterpart carries the same records. The seed is idempotent and safe on a host that already ran `mj sync push`. As before, the Active posting scheduled jobs are not included.
