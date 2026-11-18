---
"@mj-biz-apps/accounting-core-entities-server": patch
"@mj-biz-apps/accounting-ng": patch
---

Security: the company's Approval CFO may approve a journal entry batch the CFO built (bc-aidp-next-golive#450). The builder-is-not-approver rule still applies to everyone else. Before, a batch the CFO built could never be approved or sent, because the CFO is the company's only approver. The exception is one rule, `IsRefusedSelfApproval`, applied when a decision is recorded (`recordDecision`) and when a batch is sent (`assertApproved`: the decision check and the recorded-approver check). The Batch Dispatch screen shows Approve and Reject to the CFO on a batch the CFO built.
