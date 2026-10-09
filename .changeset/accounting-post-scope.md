---
"@mj-biz-apps/accounting-core-entities-server": patch
---

Add the `accounting:post` API scope with an MJAPI ceiling, and require it on the three operations that act on the ERP: `Accounting.DispatchJournalEntryBatch`, `Accounting.ResumeJournalEntryBatchPosting` and `Accounting.RunERPSync` (#329). A key that only creates journal entries or raises finance exceptions can no longer send batches to the ERP. **Upgrade note:** an API key that calls any of these three operations with `accounting:write` is refused after upgrading until it is granted `accounting:post` (or `full_access`). Scopes match exactly: `accounting:post` does not include `accounting:write`, and the reverse. Interactive users and the system key are not affected.
