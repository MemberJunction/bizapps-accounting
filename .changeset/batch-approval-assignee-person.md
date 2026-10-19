---
"@mj-biz-apps/accounting-core-entities-server": minor
---

A journal entry batch's approval task is assigned to the Person linked to the company's Approval CFO, not to the CFO's user record, so it appears in the CFO's My Tasks and Approvals in the Tasks app. The Person is found by the user's own People link first, then `People.LinkedUserID`, and must be Active. Building a batch is refused, before anything is written, when the CFO has no such Person. A migration moves open approval tasks already assigned to a user to that user's Person and lists any it cannot move.
