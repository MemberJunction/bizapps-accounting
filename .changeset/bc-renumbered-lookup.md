---
"@mj-biz-apps/accounting-core-entities-server": patch
---

The ERP lookup finds a Business Central posting that BC renumbered (#205). A BC journal batch with a Posting No. Series gives the posting a document number of its own, so the lookup by batch number found nothing and a Failed retry sent the batch again. When nothing has posted under the batch number, the lookup now searches the posting date's G/L entries on the batch's first account for the batch token, and reads the posting under BC's number. After a post, the provider reads the journal back the same way and records BC's number as the batch's reference instead of the batch number. A readback that fails leaves the post a success under the batch number, and logs why. A renumbered posting on a date other than the batch's posting date is not found.
