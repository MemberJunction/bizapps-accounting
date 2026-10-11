# Changesets

This repo versions and publishes its packages with [Changesets](https://github.com/changesets/changesets). Every `@mj-biz-apps/*` package is in one fixed group (`config.json`), so they always share a version.

## Adding a changeset

Run `pnpm change` on your feature branch and commit the file it writes with your PR.

Choose the bump level by what the change ships:

- A PR that adds a migration needs a `minor` or `major` changeset. The `migration changeset` check (`.github/scripts/check-migration-changeset.sh`) fails the PR otherwise.
- A release that changes `migrations/` or shipped `metadata/` must be at least a minor. `ci/check-bump-level.sh` checks this on the release PR (`rr: minor bump`).

No other check requires a changeset. A merged PR without one does not cause a release by itself.

## Releasing

`version.yml` keeps one "Version Packages" PR open against `main` that applies the pending changesets. Merging that PR publishes the packages. The full flow is in [CLAUDE.md](../CLAUDE.md), under "Branching Model".
