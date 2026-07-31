---
"@mj-biz-apps/accounting-entities": minor
"@mj-biz-apps/accounting-engine-base": minor
"@mj-biz-apps/accounting-core-entities-server": minor
"@mj-biz-apps/accounting-server": minor
"@mj-biz-apps/accounting-ng": minor
---

Schema realignment (issues #22 + #24, BA-D29/BA-D30): the closed JournalEntry.EntryType CHECK enum is replaced by the extensible JournalEntryType lookup (EntryTypeID FK; accounting seeds only its 8 IsSystem ledger-mechanics rows via metadata, consuming apps seed their own domain types; IsBatchSummary flag replaces the 'BatchSummary' magic string in triggers 50012/50023 and all batch queries; system rows are identity-locked at the entity layer). AccountingCompanyProfile.DefaultPaymentTermsTypeID is DROPPED — accounting never references its dependents, hard or soft (per-company default terms move to orders). The draft contract now carries the type CODE, validated against live reference data (ENTRY_TYPE_UNKNOWN / ENTRY_TYPE_INACTIVE). mj-app.json's mj-bizapps-common range is fixed to the published 5.x line (installer was hard-blocked). Baseline edited in place and re-proven from zero; ERD/ARCHITECTURE refreshed; stale plans/handoff-next-steps.md removed.
