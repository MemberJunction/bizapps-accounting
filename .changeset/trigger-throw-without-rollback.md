---
"@mj-biz-apps/accounting-entities": patch
---

A save or delete refused by an accounting trigger now reports the trigger's own error (for example 50009, "JournalEntryBatch is locked …") instead of SQL Server error 3915, "Cannot use the ROLLBACK statement within an INSERT-EXEC statement" (#211). The entity layer runs each write inside `INSERT … EXEC`, where the `ROLLBACK TRANSACTION` every trigger ran before its `THROW` is itself an error, so the reason for the refusal never reached the caller. Migration `V202609281400` re-creates all twelve triggers with their current conditions, error numbers and messages, minus the `ROLLBACK`: a trigger runs with `XACT_ABORT` on, so `THROW` alone still rolls the write back. Which writes are refused has not changed.
