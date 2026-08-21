---
"@mj-biz-apps/accounting-core-entities-server": patch
---

Ask bizapps-tasks what a decision outcome means instead of keeping four copies of the answer.

The approve/reject knowledge was spelled out in four places here: `JournalEntryBatchDecisionOutcome`
(an independently-declared union), `VALID_DECISIONS` (a `Set` of the same literals),
`APPROVED_OUTCOME_CODES` (the approving subset), and an inline
`=== 'Approved' || === 'ApprovedWithConditions'`. All four typechecked cleanly against a widened
`TaskDecisionOutcomeCode`, so an outcome added in bizapps-tasks would have been rejected as invalid
by the operation and classified as not-approved by the gate — with no error anywhere.

All four now derive from tasks-core's outcome table via `IsTaskDecisionOutcomeCode` and
`IsApprovalOutcome`. `JournalEntryBatchDecisionOutcome` is kept as an alias so the operation's public
input type is unchanged. The blind `input.Decision as TaskDecisionOutcomeCode` cast is gone — the
guard narrows it.

No behaviour change for the three outcomes that exist today; verified by rebuilding the chain and
re-running the accounting and orders suites.
