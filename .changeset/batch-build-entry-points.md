---
"@mj-biz-apps/accounting-ng": minor
"@mj-biz-apps/accounting-core-entities-server": minor
---

Make the journal entry batch build reachable, selective and the only way to create a batch.

The Batches page's Build Batch dialog now carries an Include checkbox per candidate entry, so an
operator can hold specific entries back and batch the rest. Ticking re-previews, so the netted
totals, the covered date range and the out-of-order warning always describe the ticked set; the
build sends exactly that selection. The server contract for this already existed and was unused.

The preview operation now distinguishes an empty `IncludedJournalEntryIDs` array ("nothing is
ticked") from an omitted one ("no selection filter"); collapsing the two netted the whole pool
behind a header that said nothing was included.

An unbatched journal entry no longer says only "Assigned when the next batch is built" — it links
to the Batches page. Creating a batch through Explorer's generic New form is now refused by
`JournalEntryBatchEntityServer`, and a new batch record opens on an explainer that points at the
build flow instead of a blank form with control totals to type.
