---
'@mj-biz-apps/accounting-integration-tests': patch
---

Split the release into a version step and a publish step, so neither writes to a protected branch.

`version.yml` (new, on `next`) turns pending changesets into a reviewable "Version Packages" PR —
bumps, CHANGELOGs, the mj-app.json version, and a refreshed lockfile. `publish.yml` keeps only the
publish half and now refuses to run while changesets are pending on `main`.

Fixes the 0.2.0 failure mode: the old workflow computed the version at publish time and pushed the
result to `main` and then `next`, both of which the `main-next-protect` ruleset guards, and
`github-actions[bot]` cannot be granted a bypass. 0.2.0 reached npm and the repo kept 0.1.1.
