---
'@mj-biz-apps/accounting-core-entities-server': patch
---

A new Accounting Company Profile whose company has no ID yet skips the check for active GL accounts instead of failing on the missing ID; that company is new and owns nothing.
