---
"@mj-biz-apps/accounting-core-entities-server": patch
---

Security: resolve the CFO approval gate from the batch's stamped ApprovalTaskID instead of the newest Task Link, closing an approval-forgery path where a user who can create a Task Link could point a self-approved task at a batch and dispatch journal entries to the ERP.
