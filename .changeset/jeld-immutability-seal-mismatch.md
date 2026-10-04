---
"@mj-biz-apps/accounting-entities": minor
"@mj-biz-apps/accounting-server": minor
"@mj-biz-apps/accounting-ng": minor
---

Dimension tags on a locked journal entry line are frozen, and a batch can record that a retry adopted the ERP's posting over a broken approved-content seal (#216).

- New trigger `trg_JELD_Immutability` (error 50033) refuses insert, update and delete of a `JournalEntryLineDimension` row whose journal entry is `Batched` or `GLPosted`, as `trg_JEL_Immutability` does for the line. The PostgreSQL twin ships as a PG-only migration, since the converter does not convert triggers.
- New nullable column `JournalEntryBatch.SealMismatchDetectedAt`: when a Failed batch's retry finds its journal already in the ERP although the batch no longer matches its seal, this records when it was recorded Posted, so the batch can be listed and its local tags reviewed. Existing batches read NULL.
- `SealMismatchDetectedAt` is frozen. `trg_JournalEntryBatch_Immutability` (error 50034) lets it be set only by the update that records a retried batch `Posted` (`Sent` → `Posted` with `SendAttemptCount` above 1), and refuses any later change or clear and any insert that carries it. The trigger now also fires on insert. Its PostgreSQL twin is `trg_JournalEntryBatch_SealMismatchFreeze` in the same PG-only migration.
