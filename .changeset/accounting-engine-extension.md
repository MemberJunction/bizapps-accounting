---
"@mj-biz-apps/accounting-entities": minor
"@mj-biz-apps/accounting-actions": minor
"@mj-biz-apps/accounting-server": minor
"@mj-biz-apps/accounting-core-entities-server": minor
"@mj-biz-apps/accounting-engine-base": minor
"@mj-biz-apps/accounting-ng": minor
---

Accounting engine extension registry (`AccountingEngineExtension`) — host-visible
enable/disable, run order, optional company scope, and a JSON `Configuration` bag
typed as `IAccountingEngineExtensionConfiguration`.

Hook participation is not columns: `BaseAccountingEngineExtension` getters and
Before/After overrides (later in this PR). Empty seed — consumers such as FP&A
insert their own row. Schema change, so `minor`.
