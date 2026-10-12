---
"@mj-biz-apps/accounting-entities": minor
"@mj-biz-apps/accounting-server": minor
"@mj-biz-apps/accounting-ng": patch
---

Three column descriptions now say what the code does (#352): `JournalEntryBatchNumber` gives the global `BATCH-{seq:000000}` format with no company segment; `FinanceException.DedupeKey` says a repeat raise refreshes an Open row's creator fields and summary; `GLAccount.IsSystemSeeded` names `AccountingCompanyProfileEntityServer.SeedDefaultChartOfAccounts()` instead of the removed procedure. A new migration updates the extended properties and, through its CodeGen block, the entity field metadata. The GL Accounts page's system-seeded tooltip names the same seeding method.
