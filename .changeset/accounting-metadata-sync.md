---
'@mj-biz-apps/accounting-entities': minor
---

`Metadata_Sync` for the ERP release, and the `.mj-sync.json` files that made it possible.

Release seed coverage flagged 15 metadata primaryKeys in no migration: the `Accounting` action
category, 2 Actions with their 11 Action Params (`Build Journal Entry Batches`, `Run ERP Sync`), and
the ERP daily-sync Scheduled Job. So `0.5.0` shipped `AccountingERPEngine` and
`Accounting.RunERPSync` without the Action rows that expose them.

They were unshippable for a specific reason: `metadata/action-categories/` and `metadata/actions/` had
**no `.mj-sync.json`**. MetadataSync only walks directories that declare their entity, so it skipped
both silently — the push reported success across 8 of 10 directories and never mentioned the other
two. bizapps-orders and bizapps-common have one in every directory; this repo was missing exactly the
two holding its Actions.

Adds both configs, names all ten directories in `directoryOrder` with categories ahead of what
references them, and adds `V202609020600__v0.1.x__Metadata_Sync.sql` (122 records — 15 created,
2 updated, 0 errors) generated against a database built from migrations only.

Minor, not patch: this release carries a migration.
