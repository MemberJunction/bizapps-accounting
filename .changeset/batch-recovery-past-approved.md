---
"@mj-biz-apps/accounting-core-entities-server": minor
"@mj-biz-apps/accounting-actions": minor
"@mj-biz-apps/accounting-ng": minor
---

Give a journal entry batch that fails after approval a way back (#145).

A `Failed` batch can now be retried: `sendJournalEntryBatch` (and `Accounting.DispatchJournalEntryBatch`)
accepts `Failed` as well as `Approved`, taking the `Failed → Sent` edge the status graph already
allowed. The retry reuses the batch's existing approval, re-running the approval gate and the
coherence check before it sends. Because a `Failed` batch may already be in the ERP, a retry
requires `ConfirmNotAlreadyPostedInERP: true`; the Dispatch status page's Retry dispatch button,
which the server previously refused, now asks the operator to check the ERP for the batch number
first, and reports a retry the ERP rejects as a failure. A successful retry clears the earlier
attempt's `ErrorMessage`. A poster that throws now marks the batch `Failed` instead of leaving it
at `Sent`, and the summary lines load before the `→Sent` save.

A `Posted` batch whose member `Batched → GLPosted` flip stopped partway is finished by the new
`resumeJournalEntryBatchPosting` / `Accounting.ResumeJournalEntryBatchPosting`, which makes no ERP
call. Entries it finishes carry the batch's `PostedAt` and ERP reference.

`findStrandedJournalEntries` / `Accounting.GetStrandedJournalEntries` report the entries held by
either state. `Accounting.BuildJournalEntryBatches` appends that count to every run's message, and
the Dispatch status page shows it with a Finish GL posting action for Posted batches. Scheduled
runs do not retry failed batches themselves.
