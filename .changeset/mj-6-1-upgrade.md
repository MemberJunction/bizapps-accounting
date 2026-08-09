---
"@mj-biz-apps/accounting-entities": minor
"@mj-biz-apps/accounting-engine-base": minor
"@mj-biz-apps/accounting-core-entities-server": minor
"@mj-biz-apps/accounting-server": minor
"@mj-biz-apps/accounting-actions": minor
"@mj-biz-apps/accounting-ng": minor
---

Upgrade MemberJunction from 5.x to 6.1.0-edge.1.

The whole workspace moves together because `BaseEntity` became generic in 6.x (`BaseEntity<unknown>`),
so a package on 5.x consuming an entity class built against 6.x fails to compile.
