# @mj-biz-apps/accounting-actions

## 0.11.0

### Minor Changes

- 8ae3395: Effective dates, posting dates and batch cutoffs are judged on the business day (bc-aidp-next-golive#168).

  A journal entry drafted at 9 PM Eastern on 31 August defaulted to 1 September, because the default
  was the UTC calendar day; the prior-day batch run at 1 AM UTC on the 1st judged "yesterday" in UTC
  too and skipped it. The draft now defaults to today in the instance's business time zone
  (`BusinessTimeZoneEngine` from bizapps-common), the picker writes UTC midnight of the chosen day and
  the draft reads it back from UTC parts, so the two never disagree by a browser offset. The batch
  engine's posting date and `resolveCutoff`'s prior-day and prior-month arithmetic take the business
  zone as an argument. The dashboards' month window, the batch-build modal's default cutoff and the
  "last N days" list windows on Dispatch status, All batches and All journal entries all anchor on the
  same day. CLAUDE.md's "display/zone is a presentation concern" line is replaced with the
  calendar-day doctrine.

  `AccountingCompanyProfile.OperatingTimeZone` is unchanged as the per-company OVERRIDE: the company
  profile panel still prefers it and falls back to `BusinessTimeZoneEngine.Instance.Zone` when it is
  blank, replacing a hardcoded `'America/New_York'`. It migrates into MJ Companies at 6.2, at which
  point the override/fallback split goes away. Note that new profiles are stamped with a non-blank
  `'UTC'`, so the fallback rarely fires in practice — tracked separately.

  **The two posting jobs now schedule on the business clock.** `Timezone` on
  `accounting-post-orders-payments-nightly` and `accounting-post-subscriptions-monthly` moves from
  `UTC` to `America/Chicago`, because the cutoff is resolved from the BUSINESS day at the firing
  instant and a job that fires before that day has rolled over resolves a day early. With the cron on
  UTC and the business zone on Central, the nightly run fired at 20:00 Central the previous evening —
  so PriorDay excluded that whole day's entries, and PriorMonth closed JULY on the 1 September run,
  leaving all of August to wait for October. **A host in another zone must set these two rows to their
  own business zone.** A test reads the committed job metadata and fails if the two stop agreeing on a
  zone or name one the runtime cannot resolve.

  Two window filters compared an instant against a calendar day and are corrected: Dispatch status
  bounds `BatchedAt` (a `datetimeoffset`) on the instants the business day actually starts and ends
  via `DayStartUtc`, rather than pasting `YYYY-MM-DD` into the SQL — which hid the 01:00 UTC nightly
  run's own batches from the page that exists to triage them; and the batch-status dashboard's span
  filter parses both ends as UTC midnight, where the upper end had been parsed in the browser's zone.
  The journal-entry posting-date picker no longer throws on an out-of-range date: `<input type="date">` accepts
  years beyond four digits, and `FromCalendarDay` raises a `RangeError` on anything that is
  not a calendar day, so the handler now leaves the draft's date alone instead.

  `timeWindowFilter`, exported from this package's public API, now takes `now` and `zone` as required
  arguments rather than defaulting them. It had no callers inside this repo, but the change is
  source-breaking for anyone outside it: a silent `'UTC'` default would have let a caller believe it
  had the business-day fix when it did not, so the argument is now forced. `timeWindowRange` keeps its
  optional parameters and its existing behaviour.

  `resolveCutoff`, exported from `@mj-biz-apps/accounting-actions`'s public API (`export *` in
  `packages/Actions/src/index.ts`), gained a required 4th parameter, `zone: string` — callers now pass
  `resolveCutoff(explicitCutoff, mode, now, zone)` instead of the old 3-argument form. Same reasoning
  as `timeWindowFilter`: an optional/defaulted zone would have let a caller believe prior-day/prior-month
  cutoffs were business-zone-aware when they were not, so the argument is required rather than
  defaulted. This is source-breaking for anyone outside this repo calling `resolveCutoff` directly.

  Requires `@mj-biz-apps/common-entities` >= 5.43.0.

### Patch Changes

- Updated dependencies [dc4235d]
- Updated dependencies [8ae3395]
  - @mj-biz-apps/accounting-core-entities-server@0.11.0

## 0.10.0

### Patch Changes

- 74b1ee0: Posting a journal entry batch to Business Central dropped every dimension tag on the lines.

  The batch engine already groups summary lines by GL account **plus dimension combination** and
  writes the tags onto the summary journal entry, so the values exist at post time. They were lost
  at the last two steps: `CreateERPJournalInput.Lines` had no dimension field, and MJ's Business
  Central `CreateJournalEntry` plugin never reads `line.dimensions` at all — its QuickBooks sibling
  already does. A fully tagged batch landed in Business Central bare, so the consolidated chart
  could not report by venture, product, new-vs-renewal, event or counterparty.

  `resolveExternalDimensions` now resolves a line's tags into ERP wire codes the same way
  `resolveExternalAccount` resolves the account number, and `PostJournalBatch` attaches them per
  line in one batched lookup. Unlike GL accounts — which carry `ExternalSystem` /
  `ExternalAccountID` and so can hold a per-ERP override — `Dimension` and `DimensionValue` have
  only `Code`, which the pull sync fills with the ERP's own code. A tag whose dimension or value
  has no code fails the post instead of posting an untagged line.

  `CreateBusinessCentralJournalEntryWithDimensionsAction` writes them. It registers for the
  `CreateJournalEntry:Microsoft Dynamics 365 Business Central` plugin key, which the ClassFactory's
  priority auto-increment resolves to ahead of the platform's own registration. **Known, accepted
  footprint:** that overrides Business Central journal posting for every app in the instance, not
  just Accounting — the predictable cost of keeping the fix in the app repo rather than editing the
  platform.

  Note on the wire format: the Business Central standard API v2.0 `journalLine` resource has **no**
  `shortcutDimension1Code` / `shortcutDimension2Code` properties. Its only dimension surface is the
  `dimensionSetLines` child collection, which accepts POST with `journalLine` as a parent. So every
  dimension travels the same way and Business Central derives Shortcut Dimension 1 and 2 on the
  posted G/L entry from the dimension set — the two global dimensions land in their slots on their
  own, provided they are configured as global dimensions in that Business Central company.

- Updated dependencies [74b1ee0]
- Updated dependencies [2919ad0]
  - @mj-biz-apps/accounting-core-entities-server@0.10.0

## 0.9.0

### Patch Changes

- @mj-biz-apps/accounting-core-entities-server@0.9.0

## 0.8.0

### Patch Changes

- Updated dependencies [21accf9]
  - @mj-biz-apps/accounting-core-entities-server@0.8.0

## 0.7.0

### Minor Changes

- ea01c8e: Scheduled posting of journal entry batches. `Accounting.BuildJournalEntryBatches` gains a relative `CutoffMode` (`PriorDay` / `PriorMonth`, resolved in TypeScript because scheduled-job params have no relative-date type) and an `AutoPost` mode that waives the CFO approval Task, stamps the context user as approver, and dispatches each built batch to the ERP in the same run — include-list only, so an entry type never auto-posts unless named. Ships the nightly Order/Payment and monthly RevenueRecognition scheduled-job rows. `recordDispatchFailure` is exported to triage a dispatch that threw: `Failed` is reachable only from `Sent`, so a batch left `Pending`, `Approved` or `Posted` is reported as what it actually is rather than mislabelled — a `Posted` batch in particular is left alone, because calling it `Failed` would invite a re-post and a duplicate ERP journal.

### Patch Changes

- Updated dependencies [28550c3]
- Updated dependencies [db9c8bb]
- Updated dependencies [ea01c8e]
  - @mj-biz-apps/accounting-core-entities-server@0.7.0

## 0.6.1

### Patch Changes

- 553ee29: License declarations now agree on BUSL-1.1 everywhere.

  The README badge was the last thing in the repo still advertising ISC — `LICENSE`,
  `package.json`, `mj-app.json` and every workspace package already declare BUSL-1.1.
  A green ISC badge at the top of the README is the first thing a reader sees, so it
  outranked all of them in practice. The badge now reads BUSL-1.1 and links to `LICENSE`.

- Updated dependencies [553ee29]
- Updated dependencies [b6d3dda]
  - @mj-biz-apps/accounting-core-entities-server@0.6.1

## 0.6.0

### Patch Changes

- @mj-biz-apps/accounting-core-entities-server@0.6.0

## 0.5.0

### Minor Changes

- 9966206: Accounting engine extension registry (`AccountingEngineExtension`) — host-visible
  enable/disable, run order, optional company scope, and a JSON `Configuration` bag
  typed as `IAccountingEngineExtensionConfiguration`.

  Hook participation is not columns: `BaseAccountingEngineExtension` getters and
  Before/After overrides (later in this PR). Empty seed — consumers such as FP&A
  insert their own row. Schema change, so `minor`.

- 51012f5: AccountingERPEngine: Integration Engine pull for COA/dimensions, MJ CreateJournalEntry for batch post, BaseAccountingEngineExtension seam, Accounting.RunERPSync, daily job metadata, and Configuration > ERP sync UI (reusable widgets + Explorer page).
- fa6ae13: BA-D34: `GLAccountRole.Cardinality` (`One` | `Many`) and the `BankAccount` role.

  Separates "where does a receipt post?" (role `Cash`, One, unchanged) from "what
  is cash, for a position?" (role `BankAccount`, Many). Existing roles are
  backfilled to `One`, so payment routing and the BA-D32 tie guard are unaffected.
  Enables FP&A to build `CashBalance` as the sum of a company's Active
  `BankAccount` links. Schema change, so `minor`.

### Patch Changes

- Updated dependencies [9966206]
- Updated dependencies [51012f5]
- Updated dependencies [fa6ae13]
  - @mj-biz-apps/accounting-core-entities-server@0.5.0

## 0.4.0

### Patch Changes

- @mj-biz-apps/accounting-core-entities-server@0.4.0

## 0.3.0

### Patch Changes

- 6a247d6: Raise the platform floor to MJ 6.1.0-edge.4 and the app dependency floors to the
  versions actually exercised together: bizapps-common >=5.35.1, bizapps-tasks
  > =1.3.0. All @memberjunction/\* dependencies now pin ^6.1.0-edge.4 (caret, never
  > exact — an exact edge pin in a published package forces two MJ copies into a
  > consumer's tree and splits the ClassFactory registry).
- Updated dependencies [6a247d6]
  - @mj-biz-apps/accounting-core-entities-server@0.3.0

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
