---
"@mj-biz-apps/accounting-core-entities-server": minor
---

A company's `PostingStartDate` keeps journal entries dated before it out of every posting batch, for example history brought in at cutover that the ERP already holds.

- `pendingCandidateFilter` excludes an entry whose `EffectiveDate` is before its own company's `PostingStartDate` on every build, preview and scheduled sweep. NULL, or a company with no profile row, means no floor. It composes with the per-call `startDate`: the later of the two wins.
- `buildJournalEntryBatchFromExplicitIds` refuses a selection holding such an entry, naming it; `buildJournalEntryBatchFromView` drops them with a warning.
- `previewBatch` reports `BeforePostingStartCount`: how many entries the other criteria matched that a posting start date held back.
