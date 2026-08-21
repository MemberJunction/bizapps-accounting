---
"@mj-biz-apps/accounting-entities": patch
"@mj-biz-apps/accounting-server": patch
"@mj-biz-apps/accounting-ng": patch
---

Recapture the codegen baseline from a from-zero database, restoring the guarded `__mj.Application`
producer and its three `ApplicationRole` grants that the 2026-08-06 recapture silently dropped
(taken from a lived-in DB where the Application row had survived a drop-schema cycle) — clean
deploys no longer fail on `FK_ApplicationEntity_Application`. Also: V202608062100 trimmed to the
form-layout override only (MJ#3651 landed, so the recapture bakes the correct name field); the
`metadata/schema-info` record removed (three writers fought over one row, causing the recurring
sync checksum misalignment); and the `Accounting` app is now visible to new users by default
instead of only the codegen bucket app. Regenerated entity/server/Angular packages included.
