# @mj-biz-apps/accounting-actions

## 0.2.0

### Minor Changes

- fb2899b: Ship the release-time metadata migration, and realign the release plumbing that 0.1.1 exposed.

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
  is Flyway/Skyway _description_ text — `ParseMigrationFilename` takes the version from
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

  **Three cross-schema form-chrome entries removed.** `metadata/entity-relationships/.form-chrome.json`
  configured `inclusion` for relationships whose related entity lives in **bizapps-orders** — Journal
  Entries → Order Lines and → Payment Headers, and Dimensions → Order Line Dimensions. Those
  relationship rows exist only because orders' tables carry the FKs, so CodeGen creates them when
  orders installs: on a database with accounting and no orders there are none, the `@lookup:` resolved
  nothing, and `mj sync push` aborted with a full transaction rollback. Accounting's metadata could not
  be applied on any host that installs it without orders — every standalone install. Removed here and
  re-homed in orders, which may legally reference accounting's entities (MemberJunction/bizapps-orders#92).
  No behaviour is lost: `inclusion` is layer 1 of the runtime chrome stack, not a CodeGen input.

## 0.1.1

### Patch Changes

- 77b79d0: Initial BizApps Accounting build — AR subledger + journal-entry primitives (Blocks 0–6):GL accounts, AccountingCompanyProfile (IsA child of Company), accounting periods, balanced/immutableJEs, dimensions, tax, scheduled/recurring JEs, ChartOfAccountsMapping, and read-model views; batchingengine with the bizapps-tasks CFO approval gate. Clean-deploy hardening: IS-A Entity.ParentID is nowserialized into the migration (GAP-1), numbering-sproc EXECUTE grants added (GAP-2), and codegen scopedto the accounting schema (excludes bizapps-tasks/common). Validated end-to-end on a migrations-onlyclean deploy (full harness green).
