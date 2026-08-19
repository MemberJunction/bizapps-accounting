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
| `id` (SystemId GUID) | → | `ExternalAccountID` | direct · stored for traceability, **not** a match key |
| `number` | → | `Code` | direct · **key field** (with `CompanyID`) |
| `displayName` | → | `Name` | direct |
| `category` | → | `AccountType` | decode BC's OData option-set encoding (`_x0020_` → space, …), then `lookup` (Assets→Asset, Liabilities→Liability, Equity→Equity, Income→Revenue, **Cost of Goods Sold→Expense**, Expense→Expense); blank/uncategorized → `Default=null` → fails loudly |
| `blocked` | → | `IsActive` | `custom` `!value` |
| — (constant) | → | `ExternalSystem` | `custom` `'BusinessCentral'` |
| — (constant) | → | `CompanyID` | `custom` literal · **key field** · wiring-time placeholder |

Re-sync matches on **(`Code`, `CompanyID`)** so BC accounts **upsert** onto the pre-seeded chart —
whose rows have no `ExternalAccountID` — instead of colliding on `UQ_GLAccount_CompanyID_Code`; the
first sync adopts each seeded row and writes `ExternalAccountID` onto it. (`ExternalAccountID` is
deliberately *not* a key field: key fields are AND-ed, and the seeded rows have it null, so keying on
it would exclude them and re-introduce the insert collision.) Writes go through `GLAccount.Save()`, so
the `GLAccountEntityServer` hooks and DB invariants still apply.

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

## Ships active — credentials are the one manual step

This config is authored **active**: `mj sync push` creates the CompanyIntegration, its entity/field
maps, and the nightly job (`../erp-account-sync-schedule/`), and they stand up live — `IsActive: true`,
job `Status: "Active"`, and neither directory gated in `metadata/.mj-sync.json`. Two bindings are
per-environment:

### Company

Set env var `BIZAPPS_ACCOUNTING_COMPANY_ID` to the target `__mj.Company` UUID (resolved at push into
`CompanyIntegration.CompanyID`), **and** replace the placeholder UUID
`00000000-0000-0000-0000-000000000000` in the `CompanyID` field map's `TransformPipeline` with the same
value (env vars cannot resolve inside the transform JSON). The two must match.

### Credentials — created manually, per environment, and NEVER in this metadata

> ⚠️ **Do not add an `MJ: Credentials` record, or a `CredentialID` value, to these files.** A Business
> Central OAuth2 credential is a per-environment secret and deliberately lives **outside** metadata sync.

Two reasons this cannot be shipped in metadata:

- **`mj sync push` would clobber it.** Push manages every record it ships — it re-applies the committed
  field values on every run. A credential committed here (even an *empty* stub meant to be "filled in
  later") would be overwritten back to its committed state on the very next push, silently wiping the
  real secret an operator entered. This is why the otherwise-appealing "ship an empty, self-documenting
  credential slot" pattern does **not** work.
- **Secrets don't belong in git.** The real client id / secret / tenant would be committed.

So in **each** environment, wire the credential by hand:

1. **Create it** — Explorer → **MJ: Credentials**, `CredentialType` **`business-central-oauth2`**,
   supplying `azureClientId`, `azureClientSecret`, `azureTenantId`, `companyId`, `environmentName`. MJ
   stores these as an encrypted blob in `Credential.Values`, so the environment must have field-level
   encryption configured (an `EncryptionKey` + a key source such as AWS KMS) or the save fails.
2. **Attach it** — set this CompanyIntegration's **`CredentialID`** to that record, on the pushed
   CompanyIntegration (in Explorer).

**Why the manual attachment survives re-pushes.** `mj sync push` writes only the fields **present** in
each metadata record; fields omitted from the JSON are left untouched on existing rows.
`.business-central-gl-accounts.json` deliberately **omits `CredentialID`**, so re-pushing the mapping
never resets your attachment, and the credential record itself is never in metadata so it is never
touched. **This omission is load-bearing — do not add `CredentialID` to the file.**

**Until the credential is created and attached, the nightly run does not error — it completes quietly.**
With no credential, `FetchChanges` throws at OAuth setup on the first page, which the integration engine
records as a first-page **Warning**, not a failure: the run finishes **`Status = Success` with 0 records**,
nothing is written to `GLAccount`, and — because the run is not marked failed — **`NotifyOnFailure` does not
fire**. The missing-credential error is captured only in that run's **`ErrorLog` as a Warning**
(`ErrorCode: CONNECTOR_ERROR`), visible in `MJ: Company Integration Runs` history but not surfaced
proactively. The watermark is held, so once the credential is attached the next run back-fills the full
chart. (If you want an active alert instead of a quiet 0-record run, add a pre-flight credential check or
monitor for `TotalRecords = 0` / `ErrorLog` warnings — not wired here.)

## Nightly schedule

Nightly syncing is a committed `MJ: Scheduled Jobs` record in `../erp-account-sync-schedule/`, run by
the scheduling-engine's `IntegrationSyncScheduledJobDriver` (which reads `Configuration.CompanyIntegrationID`
and calls `IntegrationEngine.RunSync`). It is set to `0 2 * * *` (02:00 UTC daily, `FullSync=true`) and
authored `Status: "Active"`. The engine computes `NextRunAt` from the cron on its first poll. The
Company Integration's own `ScheduleType`/`CronExpression`/`ScheduleEnabled` fields mirror this job for
display only — the scheduled job is the actual trigger. (Alternatively, the `IntegrationCreateSchedule`
GraphQL mutation / integration client creates the equivalent job at runtime.)

## Running the sync

Besides the nightly job, you can run the **"Run Integration Sync"** action against this Company
Integration on demand (manually or from a UI trigger). Pass `FullSync='true'` on the first run to
ignore watermarks and pull the whole chart. The engine fetches the `accounts` object, maps + upserts
`GLAccount` rows, and records watermarks + an audit run (`MJ: Company Integration Runs`). The Chart of
Accounts pages display the results immediately.

## Caveats

- BC `accounts` includes **heading/total rows** whose `category` is blank. There is **no source
  filter** excluding them — the BC connector's `FetchChanges` pulls the whole `accounts` collection
  and ignores entity-map query params — so they are fetched, fall to the lookup's `Default=null`, and
  fail the `AccountType` NOT NULL insert **per-record**. The failure is contained to that one row —
  the rest of the sync commits, but the run is reported `Failed` and each offending account is listed
  in the run's error log, so once credentials are wired the nightly run reports `Failed` even when
  every postable account synced fine. This **cannot** be fixed by entity-map config: a source-side
  filter is ignored, and the lookup returns `Default=null` *without erroring* so the transform's
  `OnError` never triggers. To actually skip heading/total rows you'd filter `accountType='Posting'`
  in the connector itself.
- `(Code, CompanyID)` matching assumes this integration targets a **single company**; account `Code` is
  unique within a company (`UQ_GLAccount_CompanyID_Code`).
