---
'@mj-biz-apps/accounting-integration-tests': patch
---

Pin `changesets/action` to v1 with its v1 input names. Action v2 hard-requires Changesets CLI v3
and refuses to run against this repo's CLI v2; moving to v2 means upgrading the CLI first.
