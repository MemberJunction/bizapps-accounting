---
"@mj-biz-apps/accounting-entities": patch
---

`ArchivedJournalEntryBatchStatus` could not apply on a host whose Journal Entry Batches
entity has more fields than the authoring database did.

The migration parked every existing field into the 100000 band, inserted its new fields at
literal sequences 23/24/25/31, then called `spUpdateExistingEntityFieldsFromSchema` **in the
same batch**. That proc re-derives every field from the physical schema and puts the parked
ones back — onto the sequences the migration had just taken:

    Violation of UNIQUE KEY constraint 'UQ_EntityField_EntityID_Sequence'.
    The duplicate key value is (87ad37e9-62f9-4f0e-a15b-f64adf009112, 23).

On AIDP stage sequence 23 is the virtual `Company` field; the authoring database had fewer
fields on that entity, so 23 was free there and the literals looked fine.

Both park-shifts are removed and each new field's `Sequence` is computed per host as
`MAX(Sequence) + 1`, so new fields append above whatever the host already has and nothing
needs moving out of the way. Each INSERT is its own statement, so successive ones see the
previous row.

Worth noting for this repo: bizapps-orders carries a CI gate for exactly this
(`check-migration-entityfield-sequence.mjs`, "EntityField Sequence must not be a literal
placeholder"). accounting has no equivalent, which is why this reached a release.
