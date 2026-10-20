---
"@mj-biz-apps/accounting-entities": minor
---

A journal entry batch's approval Task pointer is now set once (#313). Once `ApprovalTaskID` is set, neither it nor `ApprovalTaskRaisedAt` can change or clear, in any status (trigger error 50035), and a filtered unique index stops two batches from carrying the same approval Task. **Upgrade note:** the index fails to build if two batches already share an `ApprovalTaskID`, which only a hand-edited stamp can produce. The migration header has the query that finds them.
