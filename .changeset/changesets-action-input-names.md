---
'@mj-biz-apps/accounting-integration-tests': patch
---

Pin `changesets/action` to v2.1.1 and use its input names. The first Version Packages PR came
out missing the lockfile refresh and the mj-app.json sync because v2 input names were passed to
a `@v1` pin, and Actions ignores unknown inputs silently rather than failing.
