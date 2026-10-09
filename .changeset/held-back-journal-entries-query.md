---
"@mj-biz-apps/accounting-core-entities-server": patch
---

Add the saved query "Journal Entries Held Back By Posting Start Date" (Accounting category): every Pending journal entry dated before its company's PostingStartDate, one row per line, with company, entry number, effective date, entry type, GL account and amount, exportable from the query grid (#292). These entries never enter a batch, so finance reconciles them against what was booked directly in the ERP. It ships with the next Metadata_Sync migration.
