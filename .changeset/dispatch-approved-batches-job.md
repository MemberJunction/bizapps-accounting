---
"@mj-biz-apps/accounting-actions": minor
---

Add `Accounting.DispatchApprovedJournalEntryBatches` and an hourly scheduled job that runs it. The job sends every Approved journal entry batch to its ERP through the same send as the Dispatch button, so each send passes the CFO approval gate, the approved-content check and the ERP lookup. It approves nothing and never retries a Failed batch. Only the MJ system user may run it.
