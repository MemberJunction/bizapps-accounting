---
"@mj-biz-apps/accounting-entities": minor
---

Dependency floors to the actual latest releases: bizapps-common >=5.36.0,
bizapps-tasks >=1.4.0. Both shipped hours before 0.3.0 was cut and its floors
were set from a stale audit (5.35.1 / 1.3.0). The 0.3.0 ranges admit them, so
no installation is broken; this makes the declared floor match the policy —
lower bound = latest of every app this one relies on.
