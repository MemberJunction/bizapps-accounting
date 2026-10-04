---
"@mj-biz-apps/accounting-core-entities-server": minor
---

`JournalEntryBatchEntityServer.Cancel()` now authorizes itself (#214). It resolves the cancel gate and the ERP lookup through `JournalEntryBatchDispatchServices` and runs them before writing anything: a Pending cancel needs the rejection recorded on the approval Task, a cancel past approval needs the gate to allow the user and is recorded on the approval Task inside the cancel's transaction, and a Failed batch is looked up in the ERP first. A server caller that loads the entity and calls `Cancel()` directly can no longer skip any of these. `cancelJournalEntryBatch` now loads the batch and calls `Cancel()`.

Breaking change to `JournalEntryBatchCancelOptions` (and `CancelJournalEntryBatchOptions`): `erpNotPostedBasis` and `onCancelled` are removed. `ERPNotPostedBasis` comes only from the lookup's result, and `confirmNotAlreadyPostedInERP` counts only when the lookup cannot settle whether the batch posted. `Cancel()` also requires a context user.
