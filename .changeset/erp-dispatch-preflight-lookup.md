---
"@mj-biz-apps/accounting-core-entities-server": patch
"@mj-biz-apps/accounting-actions": patch
"@mj-biz-apps/accounting-ng": patch
---

Journal entry batch dispatch no longer posts a journal the ERP already holds (#182).

- Every send first looks up the batch number in the ERP. A posting that matches the batch line for
  line, on account, amounts and posting date, is recorded as Posted without a second send. That
  recovers a batch whose post succeeded but was recorded Failed. A posting that differs, or a
  lookup that fails, refuses the send unless the operator confirms the batch has not posted.
  Business Central is looked up through `GetGLEntries`. QuickBooks Online has no lookup yet and
  keeps the confirmation on Failed retries.
- An `afterPost` extension hook that throws no longer turns a post the ERP accepted into a failure.
- A Business Central post is recorded under its document number. The previous reference was the id
  of the general journal, the same for every batch.
- The Dispatch status page's Retry sends straight away, and asks for the ERP check only when the
  server says the lookup could not settle it, showing why.
