# @mj-biz-apps/accounting-integration-tests

## 0.6.1

### Patch Changes

- Updated dependencies [553ee29]
  - @mj-biz-apps/accounting-entities@0.6.1

## 0.6.0

### Patch Changes

- Updated dependencies [434df96]
- Updated dependencies [71fc375]
  - @mj-biz-apps/accounting-entities@0.6.0

## 0.5.0

### Patch Changes

- Updated dependencies [9966206]
- Updated dependencies [51012f5]
- Updated dependencies [fa6ae13]
  - @mj-biz-apps/accounting-entities@0.5.0

## 0.4.0

### Patch Changes

- Updated dependencies [15c31a7]
  - @mj-biz-apps/accounting-entities@0.4.0

## 0.3.0

### Patch Changes

- 71227e7: Adopt bizapps-contracts' more evolved publish gates: `validate-package-repository.sh` derives the
  expected URL from the root package.json instead of hardcoding it, both existing gates narrow their
  glob to this app's own packages, and a new `validate-package-files.sh` requires every publishable
  package to declare a non-empty `files` and `publishConfig.access: "public"`.
- Updated dependencies [cb7aae2]
- Updated dependencies [6a247d6]
- Updated dependencies [804f67e]
- Updated dependencies [e2e867c]
  - @mj-biz-apps/accounting-entities@0.3.0

## 0.2.0

### Patch Changes

- 57ca660: Pin `changesets/action` to v2.1.1 and use its input names. The first Version Packages PR came
  out missing the lockfile refresh and the mj-app.json sync because v2 input names were passed to
  a `@v1` pin, and Actions ignores unknown inputs silently rather than failing.
- 256ae22: Pin `changesets/action` to v1 with its v1 input names. Action v2 hard-requires Changesets CLI v3
  and refuses to run against this repo's CLI v2; moving to v2 means upgrading the CLI first.
- 729c793: Split the release into a version step and a publish step, so neither writes to a protected branch.

  `version.yml` (new, on `next`) turns pending changesets into a reviewable "Version Packages" PR —
  bumps, CHANGELOGs, the mj-app.json version, and a refreshed lockfile. `publish.yml` keeps only the
  publish half and now refuses to run while changesets are pending on `main`.

  Fixes the 0.2.0 failure mode: the old workflow computed the version at publish time and pushed the
  result to `main` and then `next`, both of which the `main-next-protect` ruleset guards, and
  `github-actions[bot]` cannot be granted a bypass. 0.2.0 reached npm and the repo kept 0.1.1.

- Updated dependencies [fb2899b]
  - @mj-biz-apps/accounting-entities@0.2.0

## 0.1.1

### Patch Changes

- Updated dependencies [7e00cbd]
- Updated dependencies [4ecb890]
- Updated dependencies [7d8d115]
- Updated dependencies [87079db]
- Updated dependencies [84b0629]
- Updated dependencies [808f172]
- Updated dependencies [e91285e]
- Updated dependencies [b014af6]
- Updated dependencies [04ae8cf]
- Updated dependencies [d098f63]
- Updated dependencies [6ab6f78]
- Updated dependencies [dca6970]
- Updated dependencies [0458a71]
- Updated dependencies [77b79d0]
  - @mj-biz-apps/accounting-entities@0.1.1
