---
"@mj-biz-apps/accounting-actions": minor
"@mj-biz-apps/accounting-core-entities-server": minor
---

Scheduled posting of journal entry batches. `Accounting.BuildJournalEntryBatches` gains a relative `CutoffMode` (`PriorDay` / `PriorMonth`, resolved in TypeScript because scheduled-job params have no relative-date type) and an `AutoPost` mode that waives the CFO approval Task, stamps the context user as approver, and dispatches each built batch to the ERP in the same run — include-list only, so an entry type never auto-posts unless named. Ships the nightly Order/Payment and monthly RevenueRecognition scheduled-job rows. `recordDispatchFailure` is exported to triage a dispatch that threw: `Failed` is reachable only from `Sent`, so a batch left `Pending`, `Approved` or `Posted` is reported as what it actually is rather than mislabelled — a `Posted` batch in particular is left alone, because calling it `Failed` would invite a re-post and a duplicate ERP journal.
