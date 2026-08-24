---
"@mj-biz-apps/accounting-entities": minor
"@mj-biz-apps/accounting-core-entities-server": minor
"@mj-biz-apps/accounting-server": minor
"@mj-biz-apps/accounting-ng": minor
"@mj-biz-apps/accounting-actions": minor
"@mj-biz-apps/accounting-engine-base": minor
---

Ship the release-time metadata migration, and realign the release plumbing that 0.1.1 exposed.

**The metadata migration.** Everything under `metadata/` reached a host only by
someone running `mj sync push` against it; nothing carried it into a database built
from migrations alone. A clean deploy therefore came up with the schema but without
the seeded currencies, journal entry types, GL account roles, the application
record, the entity/field metadata, the entity actions, or the
`RelatedRecordCollection` declarations that CodeGen reads to emit the typed `Lines`,
`Dimensions` and `Members` accessors. This adds that state as a versioned migration,
captured by pushing into a database built purely from migrations and keeping the
emitted SQL.

**Migration filenames realigned to the published version.** The two existing files
said `v1.0.x` while every package, `mj-app.json`, and npm say `0.1.x`. That segment
is Flyway/Skyway *description* text — `ParseMigrationFilename` takes the version from
the leading digits only, `ComputeChecksum` hashes file content and never the
filename, and `validate()` compares version and checksum while using the description
purely in message text — so the rename cannot re-run or invalidate anything on a
database that already applied them. Renamed with `git mv` (zero content change), plus
the three places that referenced the baseline by name: the ERD, the migrations doc,
and `scripts/append-codegen.sh`, where it was the default argument.

**`pnpm-lock.yaml` refreshed.** The 0.1.1 bump rewrote every internal
`@mj-biz-apps/accounting-*` dependency to `0.1.1` without updating the lockfile, so
`pnpm install --frozen-lockfile` failed on `next`, on PRs to `main`, and on every
feature branch — `ERR_PNPM_OUTDATED_LOCKFILE`. The publish workflow's own
`mergemain:update-lock` step exists to prevent exactly this; a hand-run bump skips it.
