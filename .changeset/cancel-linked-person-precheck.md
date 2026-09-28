---
"@mj-biz-apps/accounting-core-entities-server": patch
---

Cancelling a journal entry batch past approval now refuses a user with no linked Person before any work starts (#212). The cancel is recorded on the approval Task as a comment, which requires the canceller's Person; that was checked only inside the cancel's transaction, after the authorization, the ERP lookup and the member release, so the whole cancel rolled back. `TasksAppApprovalGate.assertMayCancelApproved` now makes the check when the batch has an approval Task, after authorization, and the refusal says an administrator must link the user to a Person.
