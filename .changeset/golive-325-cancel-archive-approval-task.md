---
"@mj-biz-apps/accounting-core-entities-server": patch
"@mj-biz-apps/accounting-ng": patch
---

A Pending journal entry batch can be cancelled by its builder or approver even when that user has no linked Person: its approval Task is closed, and the cancel comment is written only when there is a Person to sign it. A cancel past approval still needs one. Archiving a batch now records the archive on its approval Task the same way, in the same transaction: a Pending batch's Task is closed, and an Approved or Failed batch's Task gets a comment. The batch screens reload their list after a cancel or archive that answers with an error, so a call that went through on the server but timed out on the way back shows the batch's real status.
