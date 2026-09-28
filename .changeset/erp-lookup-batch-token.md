---
"@mj-biz-apps/accounting-core-entities-server": patch
---

The pre-send ERP lookup no longer takes another environment's journal for this batch (#206). Batch numbers restart at `BATCH-000001` in every database, and the lookup matched on document number, account, amounts and posting date only, so a Failed retry could record another environment's matching journal as `Posted` without sending the batch. Every line the batch sends now carries its token, `[JEB <batch ID>]`, after the line's description, and Business Central's G/L entries carry it back. A posting counts as this batch only when every line carries the token. A posting whose lines carry only other batches' tokens is a new `Foreign` lookup result: the send or retry is refused with no override, and a Failed cancel treats the batch as not posted. A posting with no tokens, including one this batch made before tagging, is a `Mismatch` the operator settles.
