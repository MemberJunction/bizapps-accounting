---
"@mj-biz-apps/accounting-core-entities-server": patch
---

Reject values too long for Business Central instead of letting the post fail at BC. A dimension or dimension value code longer than BC's `code` field is refused on save when any company posts to BC. Before a batch is sent, every account number, batch number, line description and dimension code is checked against BC's journal-line limits, and the batch is not sent if any is over. The message names the field and the limit. Limits are read from the Business Central connector's integration metadata; nothing is truncated.
