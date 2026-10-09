---
"@mj-biz-apps/accounting-core-entities-server": patch
---

The Tasks approval gate and journal entry batch decisions find the current user's Person through the user's own People link first: `LinkedEntityRecordID`, when the user's `LinkedEntityID` is People or an IS-A subtype of it. `People.LinkedUserID`, which bizapps-common deprecated and a platform that binds users through a People subtype leaves empty, is the fallback for users without that link. Before, such a user could not cancel an approved batch ("has no linked Person"), and their batch decisions recorded no Person.
