---
'@mj-biz-apps/accounting-core-entities-server': patch
---

`SyncMasterData` now checks, before it pulls, that the Dimensions entity map matches on exactly `Code` and the Dimension Values map on exactly `DimensionID` and `Code` (#268). Dimensions are shared by every company, so these keys make a second company's sync merge onto the existing row instead of colliding on `UQ_Dimension_Code`. A connection whose maps key on anything else fails with a message naming the map and the fix. `docs/ARCHITECTURE.md` §2.1 documents the full ERP master-data mapping contract, including the `AccountType` lookup transform.
