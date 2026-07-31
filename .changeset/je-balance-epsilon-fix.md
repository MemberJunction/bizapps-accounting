---
"@mj-biz-apps/accounting-core-entities-server": patch
---

Fix (PR #29): a perfectly balanced journal entry could be rejected as unbalanced. Rule 2 in JournalEntryEntityServer.Validate compared accumulated float sums with strict inequality, so a four-line entry whose credits sum to 302.59000000000003 in IEEE-754 failed while the error printed both sides as the same number. Balance is now compared at penny precision (half-penny tolerance against DECIMAL(18,2) storage — no real imbalance can hide inside it); a one-penny imbalance is still rejected.
