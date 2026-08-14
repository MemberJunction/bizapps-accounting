# ERP account sync — Business Central → GL Accounts

This directory holds the **MemberJunction integration-engine configuration** that pulls
general-ledger accounts from Microsoft Dynamics 365 **Business Central** and populates the
`GLAccount` entity (`MJ_BizApps_Accounting: GL Accounts`). It is **configuration, not code** — the
mapping runs through `@memberjunction/integration-engine`; the accounting app ships no bespoke sync
logic.

Design basis: the master plan seeds a minimal chart of accounts and *"the rest sync from the ERP"*
(`plans/bizapps-accounting-master.md` §5.1), and decision **D13** puts ERP account identity directly
on `GLAccount` (`ExternalSystem` + `ExternalAccountID`) — no separate mapping table.

## What this authors

A single `MJ: Company Integrations` record with a nested entity map and field maps
(`.business-central-gl-accounts.json`):

| BC `accounts` field | → | `GLAccount` field | transform |
|---|---|---|---|
| `id` (SystemId GUID) | → | `ExternalAccountID` | direct · **key field** (dedup) |
| `number` | → | `Code` | direct |
| `displayName` | → | `Name` | direct |
| `category` | → | `AccountType` | `lookup` (Assets→Asset, Liabilities→Liability, Equity→Equity, Income→Revenue, Cost of Goods Sold→Expense, Expense→Expense) |
| `blocked` | → | `IsActive` | `custom` `!value` |
| — (constant) | → | `ExternalSystem` | `custom` `'BusinessCentral'` |
| — (constant) | → | `CompanyID` | `custom` literal — **wiring-time placeholder** |

Re-sync dedups on `ExternalAccountID` (the `IsKeyField` map) plus the engine's Record Map, so it
**upserts** GL accounts rather than duplicating them. Writes go through `GLAccount.Save()`, so the
`GLAccountEntityServer` hooks and DB invariants still apply.

## Prerequisites — carried by the branch (replicable)

The Business Central connector is itself an MJ **Open App** (`connector-business-central`), so instead
of hand-wiring it per host, this app **declares it as a dependency** in `mj-app.json`:

```jsonc
"dependencies": {
  "connector-business-central": {
    "version": ">=1.0.0 <2.0.0",
    "repository": "https://github.com/MemberJunction/Integrations",
    "subpath": "Finance/BusinessCentral"
  }
}
```

Because of that one declaration, installing this accounting app anywhere (`mj app install`) reproducibly:

1. pulls + installs `@memberjunction/connector-business-central` **from the registry** — no local
   workspace link, no sibling clone, so it replicates off any checkout of this branch;
2. runs the connector app's migrations, which **seed the BC `Integration` + `accounts` object rows**
   into the core `__mj` schema — this is what makes `@lookup:MJ: Integrations.Name=business-central`
   resolve; and
3. wires the connector into the host's `dynamicPackages.server` (`StartupExport: registerConnector`),
   so `BusinessCentralConnector` registers with the class factory at boot.

No host-specific setup and no manual `mj sync push` of the connector's metadata is required — the
dependency handles all three.

## Wiring-time values (set these when creds are ready, then enable)

**Why this part is per-environment, not auto-seeded.** The connector (above) replicates automatically
because it is environment-independent. The mapping records here (`Company Integration` → entity map →
field maps) are **not** seeded by install, by design: a `Company Integration` binds to a specific
`__mj.Company` and a specific `MJ: Credentials` record, both of which only exist per deployment.
Baking a placeholder company/credential into a seed migration would create broken rows on every
install. So this directory is the **dev-time source of truth** for the mapping; each environment sets
its company + credentials and pushes it once (steps below). The mapping *logic* (field maps,
transforms) is identical everywhere — only the company/credential binding differs.

This config is authored **inert**. Before it can run:

1. **Company** — set env var `BIZAPPS_ACCOUNTING_COMPANY_ID` to the target `__mj.Company` UUID
   (resolved at push into `CompanyIntegration.CompanyID`), **and** replace the placeholder UUID
   `00000000-0000-0000-0000-000000000000` in the `CompanyID` field map's `TransformPipeline` with the
   same value (env vars cannot resolve inside the transform JSON). The two must match.
2. **Credentials** — create/attach a `MJ: Credentials` record holding the BC OAuth2 client-credentials
   (client id/secret, tenant, environment) and set `CompanyIntegration.CredentialID` to it.
3. **Enable** — set `CompanyIntegration.IsActive` to `true`.
4. **Un-gate the push** — this directory is listed in `metadata/.mj-sync.json` → `ignoreDirectories`,
   so a routine `mj sync push` skips it (it would otherwise fail on the unresolved company/credential).
   Remove `"erp-account-sync"` from `ignoreDirectories`, then `mj sync push` to create the
   CompanyIntegration + entity map + field maps.

## Running the sync

Once wired, run the **"Run Integration Sync"** action against this Company Integration (manually,
on a schedule via `ScheduleType`/`ScheduleEnabled`, or from a UI trigger). Pass `FullSync='true'` on
the first run to ignore watermarks and pull the whole chart. The engine fetches the `accounts` object,
maps + upserts `GLAccount` rows, and records watermarks + an audit run (`MJ: Company Integration Runs`).
The Chart of Accounts pages display the results immediately.

## Caveats

- BC `accounts` includes **heading/total rows** whose `category` is blank; those fall to the lookup's
  `Default=null` and fail the `AccountType` NOT NULL insert **loudly** (they are not postable
  accounts). If you want them silently skipped instead, add a source-side filter on the entity map or
  change the transform's `OnError`.
- `ExternalAccountID` matching assumes this integration targets a **single company**; account identity
  is unique within a company.
