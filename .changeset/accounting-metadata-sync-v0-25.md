---
'@mj-biz-apps/accounting-entities': minor
---

Release seed for 0.25: `V202610231900__v0.25.x__Metadata_Sync.sql` and its PostgreSQL counterpart create the Dispatch Approved Journal Entry Batches action with its four params, and set `EntityIDFieldName` on the three polymorphic record-ID fields (Finance Exceptions, GL Account Links, Journal Entries), for hosts, which install by migration and never read `metadata/`. As in earlier releases, `metadata/scheduled-jobs` is not seeded, so the new hourly dispatch job is not created on hosts.
