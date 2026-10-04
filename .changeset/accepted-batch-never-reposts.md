---
"@mj-biz-apps/accounting-core-entities-server": patch
"@mj-biz-apps/accounting-actions": patch
"@mj-biz-apps/accounting-ng": patch
---

A batch the ERP accepted can no longer be posted a second time. A `Failed` batch that carries the ERP's reference (the ERP accepted it and only its `Posted` save failed) is recorded `Posted` by a retry under that reference, with no lookup and no post, whatever the lookup would answer and whether or not the operator confirmed. `Cancel()` refuses it, and Dispatch status no longer offers Cancel for it. When the ERP returns no reference, the batch number is kept in its place.

When the `Sent → Failed` save itself fails, the send reloads the batch and throws `JournalEntryBatchFailureNotRecordedError`, carrying the status the database holds and any ERP reference, instead of reporting a `Failed` the database does not hold. The scheduled run's triage writes that reference with `Failed`.

A batch moves to `Sent` or `Posted` only through `JournalEntryBatchEntityServer.SaveDispatchTransition()`, which the dispatch engine calls; a plain save to either is refused, so a batch cannot be marked `Sent` and then `Posted` without the ERP being called.

A lookup that finds nothing is not trusted while the `ERP_POSTING_NOT_READ_BACK` finance exception type is missing or inactive, since a post that could not be read back would then raise no exception. An over-long account number names the account and points at its External Account ID instead of saying to shorten it. Both batch previews show how many entries a company's posting start date holds back.
