---
"@mj-biz-apps/accounting-core-entities-server": patch
---

Journal entry and batch numbering now run on PostgreSQL. `SequenceService` picks the numbering SQL by the provider's `PlatformKey`: the SQL Server procedure call as before, or a `SELECT` of the PostgreSQL function of the same name, called as `__mj_bizappsaccounting."spAssignNext…"`: the migrations create the schema unquoted, so PostgreSQL folds it to lowercase, and the function names quoted. Parameters are positional on both platforms. A platform with no numbering SQL fails before anything runs.
