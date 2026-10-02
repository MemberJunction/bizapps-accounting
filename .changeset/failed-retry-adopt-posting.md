---
"@mj-biz-apps/accounting-core-entities-server": minor
"@mj-biz-apps/accounting-ng": patch
---

A Failed batch that did post, but whose summary-line dimension tags changed locally, can be recorded Posted again (#216). Its retry was refused by the approved-content seal before the ERP lookup could find the posting, and its cancel was refused because the lookup did find it, so archiving was the only way out.

- `sendJournalEntryBatch` now judges a broken seal on a `Failed` retry after the ERP lookup. When the ERP already holds the batch, it is recorded `Posted` with no second post and `SealMismatchDetectedAt` is set; the local tags are left as they are. A lookup that finds nothing, a mismatch, another batch's journal, a failed lookup or no lookup still refuses the retry. A first send from `Approved`, and any retry whose footing, member count or summary header is off, are refused before the lookup as before.
- New `JournalEntryBatchEntityServer.CheckApprovedContent()` returns the dispatch checks split into `CoherenceProblems` and `SealProblems`; `CheckControlTotalCoherence()` is unchanged.
- The batch detail panel shows a warning and the time when a batch carries `SealMismatchDetectedAt`.
