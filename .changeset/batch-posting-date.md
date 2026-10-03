---
'@mj-biz-apps/accounting-core-entities-server': minor
'@mj-biz-apps/accounting-actions': patch
'@mj-biz-apps/accounting-ng': minor
---

A journal entry batch's `PostingDate` — the journal date the ERP receives — can now be chosen (golive #315), and scheduled batches are dated the last day of their sweep window instead of the run date (golive #314).

- **Engine.** `BuildJournalEntryBatchOptions.postingDate` (and `PostingDate` on `Accounting.BuildJournalEntryBatch` / `Accounting.PreviewJournalEntryBatch`) sets it, read by the same shape rules as a cutoff. Omitted, it is today's business day, as before. A future date is refused, and so is a selection holding an entry dated after the posting date (`JournalEntryBatchPostingDateError`, naming the entries). `buildJournalEntryBatchFromExplicitIds` takes it as a new trailing parameter.
- **The posting date bounds the candidate pool.** Candidates end at the earlier of the cutoff and the posting date, in preview and build alike. A build with no cutoff no longer sweeps forward-dated entries (e.g. future revenue recognition); they wait for a batch dated on or after them. `regenerateJournalEntryBatch` re-gathers only through the batch's own posting date.
- **Approval.** The approval Task's name and description carry the posting date. A posting date cannot change after approval (the batch is frozen); cancel the batch and rebuild it, which raises a new approval.
- **Scheduled runs.** `Accounting.BuildJournalEntryBatches` dates each batch its cutoff day, or today when the cutoff is later: the nightly run on 1 September (cutoff 31 August) posts on 31 August. New export `postingDateForCutoff`.
- **UI.** The batch workspace and the Batches page's build modal have a Posting date input (default today, no later than today); the workspace blocks the build while the date is empty, in the future or earlier than an included entry. The no-cutoff hint now says the pool runs through the posting date.
