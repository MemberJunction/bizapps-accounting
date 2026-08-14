---
"@mj-biz-apps/accounting-engine-base": patch
"@mj-biz-apps/accounting-core-entities-server": patch
---

Promote the pure JE rollup to `NetLines` on accounting-engine-base (browser + server) and emit groups in journal order: per company, every debit, then every credit.
