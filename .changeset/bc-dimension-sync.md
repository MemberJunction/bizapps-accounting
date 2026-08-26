---
"@mj-biz-apps/accounting-server": patch
"@mj-biz-apps/accounting-ng": patch
---

Business Central → Dimension / DimensionValue pull sync.

Two entity maps ride the existing Business Central Company Integration, so the nightly fan-out job
picks up dimensions with no new scheduled job and no driver change. Dedup is `IsKeyField` matching
plus the engine's Record Map (`Dimension.Code`; `DimensionValue.(DimensionID, Code)`), so no
migration and no schema change.

The connector now stamps a synthetic `MJDimensionID` on fetched `dimensionValues` records,
translating BC's own `dimensionId` through MJ's Record Map — a field-map `lookup` transform cannot
do this, and `FetchChanges` is the only point in the pipeline that sees a raw external record.

Adds a server-side `BusinessCentralSyncEngine` exposed as the `Accounting.RunBusinessCentralSync`
Remote Operation: it resolves the integration, fans out across every active + credentialed Company
Integration, narrows by external object name, and composes the run's one-line summary. The
Dimensions page's new "Sync dimensions" button awaits that one call and refreshes — no orchestration
or presentation logic in the UI, and a manual run never re-pulls the chart of accounts.
