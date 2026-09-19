---
"@mj-biz-apps/accounting-core-entities-server": patch
"@mj-biz-apps/accounting-actions": patch
"@mj-biz-apps/accounting-server": patch
---

Posting a journal entry batch to Business Central dropped every dimension tag on the lines.

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
