---
"@mj-biz-apps/accounting-engine-base": patch
"@mj-biz-apps/accounting-core-entities-server": patch
"@mj-biz-apps/accounting-ng": patch
---

Perf Wave 3: upgrade `AccountingEngineBase` with remaining bounded reference/config entities (`Accounting Engine Extensions`, `Finance Exception Types`, `Tax Authorities`, `Tax Jurisdictions`, `Tax Rates`, `Company Tax Nexus`), `CacheLocal: true`, O(1) indexed lookup helpers, multi-provider `ProviderToUse`, client-side user-change eviction, `InvalidateCache()`, and `IsConfiguredForUser()`; collapse unbatched `RunView` waterfalls and replace repeated taxonomy `RunView`s with `AccountingEngineBase` reads and single-request `RunViews` batches across Angular dashboards/panels and server entities.
