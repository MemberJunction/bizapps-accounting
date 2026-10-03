---
"@mj-biz-apps/accounting-core-entities-server": patch
---

GenerateReversal dates a reversal on the later of today's business day and the original entry's EffectiveDate, so reversing a future-dated entry no longer lands the reversal in an earlier period (#266).
