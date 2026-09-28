---
"@mj-biz-apps/accounting-core-entities-server": patch
---

Security: record a cancel past approval on the batch's stamped ApprovalTaskID instead of the newest Task Link, so a forged Task Link can no longer redirect or suppress the cancel's comment on the approval Task. A stamped Task that fails to load now rolls the cancel back rather than letting it commit unrecorded.
