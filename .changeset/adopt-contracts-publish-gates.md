---
'@mj-biz-apps/accounting-integration-tests': patch
---

Adopt bizapps-contracts' more evolved publish gates: `validate-package-repository.sh` derives the
expected URL from the root package.json instead of hardcoding it, both existing gates narrow their
glob to this app's own packages, and a new `validate-package-files.sh` requires every publishable
package to declare a non-empty `files` and `publishConfig.access: "public"`.
