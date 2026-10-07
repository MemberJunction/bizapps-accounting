---
'@mj-biz-apps/accounting-ng': patch
---

Company Setup selects a newly created company again. On MJ 6.1.x a new Accounting Company Profile (IsA MJ: Companies) comes back from its save with `.ID` holding the browser's key, which was never written, so the dashboard selected nothing after the reload. It now reads the key from `PrimaryKey`, which carries the written value.
