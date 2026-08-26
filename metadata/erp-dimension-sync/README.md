# ERP dimension sync — Business Central → Dimensions

This directory holds the **MemberJunction integration-engine configuration** that pulls analytical
dimensions from Microsoft Dynamics 365 **Business Central** and populates the `Dimension`
(`MJ_BizApps_Accounting: Dimensions`) and `DimensionValue`
(`MJ_BizApps_Accounting: Dimension Values`) entities. Like `../erp-account-sync/`, it is
**configuration, not code** — the mapping runs through `@memberjunction/integration-engine`.

It is deliberately an **extension of the account sync, not a parallel system**: both entity maps
attach to the **same** `MJ: Company Integrations` record, so the existing nightly fan-out job picks
them up with **no new scheduled job and no driver change**.

## What this authors

Two `MJ: Company Integration Entity Maps` records with nested field maps
(`.business-central-dimensions.json`), attached to the account sync's Company Integration by
`@lookup`. No transforms — every field is a direct copy.

**`dimensions` → `Dimension`** (Priority 10)

| BC field | → | `Dimension` field | notes |
|---|---|---|---|
| `code` | → | `Code` | **key field** — `UQ_Dimension_Code` is the natural key |
| `displayName` | → | `Name` | `SourceWins`, so BC is authoritative for the label |

**`dimensionValues` → `DimensionValue`** (Priority 20)

| BC field | → | `DimensionValue` field | notes |
|---|---|---|---|
| `MJDimensionID` *(synthetic)* | → | `DimensionID` | **key field** — stamped by the connector, see below |
| `code` | → | `Code` | **key field** (with `DimensionID`) |
| `displayName` | → | `Name` | |

Everything else on both tables (`ID`, `DisplayOrder`, `IsActive`, timestamps) carries a database
default, so nothing further needs mapping.

## No migration, no schema change

Dedup is the `IsKeyField` maps plus the engine's Record Map: `Dimension` matches on `Code`
(`UQ_Dimension_Code`) and `DimensionValue` on `(DimensionID, Code)`
(`UQ_DimensionValue_DimensionID_Code`), so a re-sync **upserts** rather than colliding.

Unlike `GLAccount` — which carries ERP identity directly (`ExternalSystem` + `ExternalAccountID`,
decision **D13**) — these two tables have **no external-system columns**, and none are added. They
stay system-agnostic; external↔internal identity lives in MJ's
`MJ: Company Integration Record Maps`, which is what the engine already uses for dedup.

## The one thing config cannot do: resolving a value's parent

BC sends its own `dimensionId` GUID on each dimension value. That identifier is **meaningless
locally**, and no accounting column holds it, so it cannot be matched to a `Dimension.ID`.

A field-map transform cannot bridge it either: the `lookup` transform's `LookupConfig` is a
**static value map** (`Map: Record<string, unknown>`), not a database lookup.

So `BizAppsAccountingBusinessCentralConnector.FetchChanges` stamps a synthetic **`MJDimensionID`**
onto every fetched `dimensionValues` record, translating BC's GUID through the engine's own Record
Map for the Dimensions entity map — one local query, **no extra Business Central API call**. This
follows the `MJCompanyID` stamp precedent already in that connector, and for the same structural
reason: `FetchChanges` is the only point in the pipeline that sees a raw external record.
(`RunSync` exposes only `onProgress`/`onNotification`, and `IntegrationSyncOptions` carries no
record-level hook.)

**A value whose parent has no map entry is left unstamped on purpose.** `DimensionID` is a required
field map, so the engine records a per-record failure rather than inventing a parent.

### Why Priority order is load-bearing

Entity maps execute **`Priority ASC`**, and the stamp reads the Record Map rows the `dimensions`
pass writes. `dimensions` (10) must therefore run before `dimensionValues` (20). If that order ever
inverts, every dimension value fails its required `DimensionID` on a from-zero sync. This is pinned
by a test — `packages/EngineBase/src/__tests__/erp-dimension-sync-config.test.ts`.

## Multi-company: dimensions are shared

`Dimension` has no `CompanyID` and `Code` is globally unique, so the same dimension code synced from
two BC companies resolves to **one shared row** — dimensions are treated as shared reference data
(ruling 2026-08-25). The first company to sync a code creates it; later companies update its `Name`
(`ConflictResolution: SourceWins`).

This differs from `GLAccount`, which *is* company-scoped and keys on `(Code, CompanyID)`. If
dimensions ever need per-company scoping, that is a schema change (add `CompanyID`, change the
unique key), not a config change.

## Running the sync

**Nightly** — nothing to configure. The `MJ: Scheduled Jobs` record in
`../erp-account-sync-schedule/` runs the app-owned `BizAppsAccountingBCFanOutSyncDriver` across
every active, credentialed Business Central Company Integration. Because these maps ride that same
Company Integration and the job does not narrow by `EntityMapIDs`, they are included automatically,
in Priority order (`accounts` → `dimensions` → `dimensionValues`).

**On demand** — the Dimensions page's **"Sync dimensions"** button, which calls the
`Accounting.RunBusinessCentralSync` Remote Operation (→ `BusinessCentralSyncEngine`). It passes the
object names `['dimensions','dimensionValues']`, and the server resolves them to entity map IDs, so
a manual run pulls **only** dimensions and never re-pulls the chart of accounts. All fetching,
mapping and upserting happens server-side; the page awaits the summary and refreshes.

## Prerequisites

Same as the account sync — see `../erp-account-sync/README.md`. The Business Central `Integration`
row, its `dimensions` / `dimensionValues` objects, and the `business-central-oauth2` credential type
all arrive with the `connector-business-central` Open App dependency; no separate metadata push is
needed. Credentials remain the one manual, per-environment step.

## Caveats

- **`dimensions` and `dimensionValues` are read-only in BC's API v2.0** — this is a pull-only sync
  (`SyncDirection: Pull`, `DeleteBehavior: DoNothing`). Nothing is ever written back to BC, and a
  dimension deleted in BC is left in place here.
- **BC's `dimensionValues` payload has no parent `code`** — only `dimensionId`. That is why parent
  resolution goes through the Record Map rather than matching on a code.
- **`dimensionSetLines` and `defaultDimensions` are not synced.** Both are declared by the connector
  and available; wiring them is a separate slice (they are per-transaction / per-account tags, not
  master data).
- **Unproven against real data.** The BC sandbox tenant used during development holds **0
  dimensions and 0 dimensionValues** (confirmed by a direct authenticated API probe). The pipeline
  runs clean and reports success, but no record has yet traversed the field maps, the upsert, or the
  `MJDimensionID` stamp. Config correctness is pinned by unit tests; the round trip needs either
  sandbox data or a tier-2 harness against controlled fixtures.
