---
"@mj-biz-apps/accounting-actions": minor
"@mj-biz-apps/accounting-core-entities-server": minor
---

Scheduled posting of journal entry batches. `Accounting.BuildJournalEntryBatches` gains a relative `CutoffMode` (`PriorDay` / `PriorMonth`, resolved in TypeScript because scheduled-job params have no relative-date type) and an `AutoPost` mode that waives the CFO approval Task, stamps the context user as approver, and dispatches each built batch to the ERP in the same run — include-list only, so an entry type never auto-posts unless named. Ships the nightly Order/Payment and monthly RevenueRecognition scheduled-job rows. `failJournalEntryBatch` is now exported so an unattended dispatch that throws still lands the batch `Failed` with the cause.
