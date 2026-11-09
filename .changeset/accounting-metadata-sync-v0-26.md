---
'@mj-biz-apps/accounting-entities': minor
---

The 0.26 Metadata_Sync ships the PostingStartDate.Set authorization and its Finance grant, the Accounting application's navigation, and the JournalEntryBatches.Operate description, so a host that upgrades by migration gets the same metadata as one that ran `mj sync push`. It has a Postgres counterpart. Scheduled jobs stay out of the seed, as in earlier releases.
