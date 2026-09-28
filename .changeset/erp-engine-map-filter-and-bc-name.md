---
"@mj-biz-apps/accounting-core-entities-server": patch
---

`AccountingERPEngine` could never sync ERP master data and could not post to a Business Central connection named the way the MJ connector names it. Three fixes:

- `SyncMasterData` looked up a connection's entity maps with `IsActive = 1`, but `MJ: Company Integration Entity Maps` has no `IsActive` column (it has `Status` and `SyncEnabled`). The RunView failed, the lookup returned nothing, and every run reported "No entity maps for accounts, dimensions, dimensionValues" however the maps were configured. It now filters on `Status = 'Active' AND SyncEnabled = 1`.
- `namesMatch` compared names with only whitespace removed, so the MJ connector's `business-central` Integration never matched a `BusinessCentral` / `BC` TargetSystem. It now compares letters and digits only.
- `providerFor` resolved the ERP provider by the Integration's exact name, so `business-central` found no provider (they register as `Microsoft Dynamics 365 Business Central` and `QuickBooks Online`). It now falls back to the registered provider key the name matches under the same rule.
