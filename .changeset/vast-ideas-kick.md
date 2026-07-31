---
"@mj-biz-apps/accounting-core-entities-server": minor
"@mj-biz-apps/accounting-entities": minor
"@mj-biz-apps/accounting-actions": minor
"@mj-biz-apps/accounting-ng": minor
"@mj-biz-apps/accounting-server": minor
---

Initial BizApps Accounting build — AR subledger + journal-entry primitives (Blocks 0–6):GL accounts, AccountingCompanyProfile (IsA child of Company), accounting periods, balanced/immutableJEs, dimensions, tax, scheduled/recurring JEs, ChartOfAccountsMapping, and read-model views; batchingengine with the bizapps-tasks CFO approval gate. Clean-deploy hardening: IS-A Entity.ParentID is nowserialized into the migration (GAP-1), numbering-sproc EXECUTE grants added (GAP-2), and codegen scopedto the accounting schema (excludes bizapps-tasks/common). Validated end-to-end on a migrations-onlyclean deploy (full harness green).
