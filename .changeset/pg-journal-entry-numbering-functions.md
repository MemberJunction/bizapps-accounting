---
"@mj-biz-apps/accounting-core-entities-server": minor
---

PostgreSQL migration (`.pg-only.sql`) adding `spAssignNextJournalEntryNumber` and `spAssignNextJournalEntryBatchNumber` as PL/pgSQL functions: the same names, number formats and gap-free counters as the SQL Server procedures, which the SQL converter cannot translate. Runs after the PostgreSQL counterpart of the baseline.
