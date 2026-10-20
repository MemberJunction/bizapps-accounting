---
"@mj-biz-apps/accounting-ng": patch
---

Batch screen fixes:

- The batch workspace's date chip ends at the posting date when that comes before the cutoff, since the batch takes nothing dated after it (#401).
- The Batch Status dashboard's Build JE batch preview has a cutoff that defaults to today's business day, sends it with the build, leaves entries after it out of the preview, and says so when it is cleared (#426).
- A failed save on the company setup, chart of accounts and GL accounts screens shows a sentence for the constraints a user can reach and a "not saved, try again" message for any other database error, never the database's own text (#383).
- Styles use MemberJunction's token names (`--mj-border-strong`, `--mj-status-*-text`, `--mj-font-family-mono`, `--mj-shadow-sm`, `--mj-text-base`) instead of names MJ does not define; a test now fails on any `--mj-*` name that neither MJ nor this package defines (#390).
- The Dispatch status page's Mismatch retry dialog puts "It is not this batch — post again" on the left and Cancel on the right; Cancel stays the default (#398).
- Reject, Archive and Cancel on Batch approvals ask for their reason in a dialog instead of the browser prompt, which the desktop Explorer does not support. Batch approvals, Dispatch status and the Batches overview now share that one dialog: the same wording, the ERP check for a Failed batch ("It has not posted — cancel batch" replaces the overview's checkbox), the batch number retyped past a Mismatch, each reason held to its column's length (Archive's included), and the confirm action on the left with Keep batch on the right (#405).
- The All batches page has an Archived status chip and count (#407).
