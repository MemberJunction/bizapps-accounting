---
"@mj-biz-apps/accounting-core-entities-server": patch
"@mj-biz-apps/accounting-actions": patch
"@mj-biz-apps/accounting-ng": patch
---

Journal entry batch dispatch no longer posts a journal the ERP already holds (#182).

- Every send first looks up the batch number in the ERP. On a Failed retry, a posting that matches
  the batch line for line, on account, amounts and posting date, is recorded as Posted without a
  second send. That recovers a batch whose post succeeded but was recorded Failed. On a first send
  a match is another journal under the same number, so the send is refused and the batch stays
  Approved. A posting that differs, or a lookup that fails, refuses the send unless the operator
  confirms the batch has not posted. Business Central is looked up through `GetGLEntries`.
  QuickBooks Online has no lookup yet and keeps the confirmation on Failed retries.
- The lookup reads posted G/L entries only. Business Central posting now refuses to write into a
  journal that already holds unposted lines, such as lines left by an earlier rejected post, since
  posting the journal would send them to the GL with the batch.
- An `afterPost` extension hook that throws no longer turns a post the ERP accepted into a failure.
- A Business Central post is recorded under its document number. The previous reference was the id
  of the general journal, the same for every batch.
- The Dispatch status page's Retry sends straight away, and asks for the ERP check only when the
  server says the lookup could not settle it, showing why. A mismatch gets its own dialog that
  defaults to Cancel and needs the batch number retyped to post again.
