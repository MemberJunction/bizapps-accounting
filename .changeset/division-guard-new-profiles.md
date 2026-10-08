---
"@mj-biz-apps/accounting-core-entities-server": patch
---

A new Accounting Company Profile saved as a Division, Department or Branch is refused when its company already owns an active GL account (#304). GL accounts reference `__mj.Company`, so a company can own accounts before its profile exists; the owner check ran only when a saved profile's EntityType changed. It now runs on create as well. Deactivate the company's accounts first, or create the profile as a type that keeps books.
