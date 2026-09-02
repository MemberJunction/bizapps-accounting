---
'@mj-biz-apps/accounting-entities': patch
---

Move to MJ `6.1.0-edge.5` and raise the cross-repo floors.

44 `@memberjunction/*` pins move `^6.1.0-edge.4` → `^6.1.0-edge.5`.

Floors now match what is published — `@mj-biz-apps/common-*` `^5.34.0` → `>=5.37.0`, and
`@mj-biz-apps/tasks-*` `^1.2.3` → `>=1.4.1`. Stale floors are not harmless here: bizapps-orders
declared `accounting-* >=0.1.0` and pnpm resolved the *lowest* satisfying version as a peer, pulling
`accounting-server@0.1.0` and 48 MJ packages at edge.2/3/4 into an otherwise-edge.5 tree.

Verified after a clean install: a single `@memberjunction/core` at edge.5 and build passing.
