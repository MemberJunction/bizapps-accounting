---
"@mj-biz-apps/accounting-core-entities-server": patch
---

Security: record a cancel past approval on the batch's stamped ApprovalTaskID instead of the newest Task Link, so a forged Task Link can no longer redirect or suppress the cancel's comment on the approval Task. A stamped Task that fails to load now rolls the cancel back rather than letting it commit unrecorded.

A Pending cancel also reads the stamped ApprovalTaskID: whether the batch was rejected, whether the canceller needs a linked Person, and which Task is closed as Cancelled. A newer Task Link to a self-rejected Task no longer counts as the CFO's rejection.
