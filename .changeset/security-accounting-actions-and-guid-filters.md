---
"@mj-biz-apps/accounting-actions": patch
"@mj-biz-apps/accounting-core-entities-server": patch
---

Restrict the `Accounting.BuildJournalEntryBatches` (attended path) and `Accounting.RunERPSync` scheduled actions to the MJ system user (failing closed when the user cache does not hold the system user), and route the remaining batch/GL-account `ExtraFilter` UUID interpolations in `JournalEntryBatchEngine` and `JournalEntryBatchEntityServer` through `sqlGuidLiteral`.
