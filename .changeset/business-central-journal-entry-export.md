---
'@mj-biz-apps/accounting-entities': minor
---

Business Central journal-entry export: a new `ExternalAccountingSystem` catalog entity and the
adapter that posts an approved Journal Entry Batch to a live general ledger.

One migration, `V202608260800__v1.0.x__ExternalAccountingSystem.sql`, stamped `2026-08-26` so it
lands after everything already on `next`. It adds the catalog table plus its `Mock` and
`BusinessCentral` rows; account-driven routing (D13) resolves a batch to exactly one external system
through it, so a batch straddling two systems fails loudly instead of half-posting.

Also changes `ExternalJournalEntryBatchRef` to store the **document number** rather than the journal
code. The journal code was correct only while journals were per-batch; under per-channel journals
`AIDP_MAN` is shared by every manual batch, so the ref identified the channel rather than the post —
and `VerifyPosted` looks entries up by document number, so it would report a genuinely-posted batch
as unposted.
