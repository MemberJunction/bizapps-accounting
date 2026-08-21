---
"@mj-biz-apps/accounting-ng": patch
---

Declare rxjs as a peerDependency of the Angular package. Four files import it (coa-dashboard, company-scope.service, dismissable-dialog.directive, page-refresh.service) but the package never declared it — a phantom dependency that npm's hoisting masks and any isolated linker (pnpm) fails to resolve. Found by cadam11 in the strict-pnpm workspace spike (supersedes the surviving third of PR #26; its other two fixes were overtaken when the donor-line port removed AssociationDemoSeedData.ts and the relic apps/ tree).
