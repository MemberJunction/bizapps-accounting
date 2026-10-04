---
"@mj-biz-apps/accounting-core-entities-server": patch
---

Security: record a cancel past approval on the batch's stamped ApprovalTaskID instead of the newest Task Link, so a forged Task Link can no longer redirect or suppress the cancel's comment on the approval Task. A stamped Task that fails to load now rolls the cancel back rather than letting it commit unrecorded.

`assertRejected`, which a Pending cancel requires, also resolves the approval Task from the stamped ApprovalTaskID, so a newer Task Link to a self-rejected Task can no longer let a Pending batch be cancelled.
