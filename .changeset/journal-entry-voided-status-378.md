---
"@mj-biz-apps/accounting-entities": minor
"@mj-biz-apps/accounting-core-entities-server": minor
"@mj-biz-apps/accounting-server": minor
"@mj-biz-apps/accounting-ng": minor
---

A journal entry that has not left the subledger can be voided instead of offset (golive #378).

- **`Voided` status.** `JournalEntry.Status` gains `Voided`, reached only from Pending in no batch, with `VoidReason`, `VoidedAt` and `VoidedByUserID` required on it and empty everywhere else. A voided entry, its lines and their dimensions never change again, and it cannot be deleted (CHECK constraints and triggers 50040–50044).
- **`Accounting.VoidPendingJournalEntries`.** Voids the entries it names, all or nothing, in the caller's transaction; refuses anything batched, posted, voided, part of a reversal pair, a batch summary, or awaiting manual-entry approval.
- **Readers.** Batch builds and the ERP send never take a voided entry (a view-based build excludes it); the deferred revenue waterfall leaves it out; the JE dashboard counts it; the journal entry form shows who voided it, when and why.
- D15 now says a staged entry still Pending in no batch is voided rather than offset.
- The migration also carries CodeGen output from MJ 6.2.1 that the repo had not regenerated yet (hierarchy functions and fields for self-referencing keys, contract fingerprints, form layout).
