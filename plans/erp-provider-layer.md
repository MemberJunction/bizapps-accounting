# Accounting ERP provider layer

**Status:** Draft for inline edit — Amith 2026-08-29  
**This PR:** plan only. No code.  
**Related (leave open):** [accounting#74](https://github.com/MemberJunction/bizapps-accounting/pull/74) (BC → GL Accounts pull), [accounting#112](https://github.com/MemberJunction/bizapps-accounting/pull/112) (BC → Dimensions / DimensionValues). Exploratory prototypes. We will close them later with a kind note and links here once this work has a code PR.  
**Companion (FP&A):** cash position import lands on `CashBalance` / `CashBalanceLine`; live rollup stays `FPNA.GetCashPosition` (never persisted).

---

## 1. What we are solving

Accounting is a **subledger**, not the GL. Three jobs talk to an external accounting system (Business Central today, QuickBooks / NetSuite later):

| Job | Direction | Unit of work | Writes |
|---|---|---|---|
| Master data | **Pull** | Chart of accounts, dimensions, dimension values | `GLAccount`, `Dimension`, `DimensionValue` |
| Journal dispatch | **Push** | One approved **Journal Entry Batch** (summary JE), all-or-nothing | Stamp `JournalEntryBatch` + member JEs `GLPosted` + external id |
| Downstream facts | **Pull** | Account balances, later budget / opex | FP&A `CashBalance` (+ lines), later `BudgetLine` |

Those jobs share **credentials, company, scheduling, run audit**. They do **not** share a record-sync loop. Posting a batch is not “sync the Journal Entry table.”

---

## 2. What already exists (do not reinvent)

### 2.1 MJ Integration Engine — data sync

`packages/Integration` in the MJ repo.

- `Integration` → `CompanyIntegration` (per company + credential) → `EntityMap` / `FieldMap` / `Watermark` / `RecordMap` / `Run`.
- `IntegrationEngine.RunSync(companyIntegrationID, …)` with object-name / entity-map narrowing.
- Scheduled via MJ Action **`Run Integration Sync`**.
- Connectors implement `FetchChanges` (pull) and CRUD (`CreateRecord`, …) for generic object I/O.
- Generated **Integration Actions** (`IntegrationActionExecutor`) are CRUD+Search+List **per external object**, not domain verbs. CRM already moved generic HubSpot CRUD there and kept only custom actions (merge contacts, associate, log activity).

**Use this for:** scheduling, credentials, Company Integration, pull of master-data tables, run logs, record maps (external id ↔ our id).

**Do not use this for:** “dump every Journal Entry to BC” as an outbound entity map. The batch is the unit of work.

### 2.2 Actions/BizApps/Accounting — higher-order verbs (already built)

`@memberjunction/actions-bizapps-accounting` in the MJ repo (`packages/Actions/BizApps/Accounting`).

Three-tier: `BaseAccountingAction` → provider base (QBO / BC) → per-verb actions.

Already there:

| Verb-ish | QBO | BC |
|---|---|---|
| Get chart of accounts | `GetQuickBooksGLCodesAction` | `GetBusinessCentralGLAccountsAction` |
| Get account balances | `GetQuickBooksAccountBalancesAction` | (via GL entries) |
| Get GL entries | — | `GetBusinessCentralGeneralLedgerEntriesAction` |
| **Create journal entry** | `CreateQuickBooksJournalEntryAction` | **missing** |
| Customers / invoices | — | Get customers, get sales invoices |

It already:

- Resolves `CompanyIntegration` by company + integration name.
- Validates a JE **balances** (`validateJournalEntryBalance`) — provider-agnostic.
- Maps account types to Asset / Liability / Equity / Revenue / Expense.

What it is **not**:

- It does **not** write into this app’s entities (`GLAccount`, `JournalEntryBatch`).
- Verbs are **per-provider class names** (`CreateQuickBooksJournalEntryAction`) instead of one generic `CreateJournalEntry` with a plugin.
- BC has no create-journal action yet (QBO does).
- It does not participate in **batch atomicity** (`Approved → Sent → Posted`, stamp external id, flip member JEs).
- README says this family is “progressively migrating” to generic Integration Actions. **Do not migrate these verbs away.** Generic CRUD is the wrong grain. This package is the seed of the meta-layer.

### 2.3 This app today

- `ErpPoster` on `sendJournalEntryBatch` — the production hook. Still `mockErpPoster`.
- `GLAccount.ExternalSystem` + `ExternalAccountID` — ERP identity on the account (D13). No mapping table.
- Dispatch posts **by account number**, split per company (AM-4).

### 2.4 Exploratory prototypes (#74 / #112)

Keep the **ideas**; treat the code as a prototype.

Worth stealing later:

- Entity/field maps for BC `accounts` → `GL Accounts` (number → Code, category → AccountType, blocked → IsActive, id → ExternalAccountID).
- Same Company Integration, extra maps for `dimensions` / `dimensionValues`, Priority order.
- Stamping `MJCompanyID` / `MJDimensionID` in fetch because field-map `lookup` is a static map, not a DB lookup.
- Fan-out: every active credentialed Company Integration, per-company failure isolation.
- Manual trigger as a **remote op** over a server engine, not a page (`BusinessCentralSyncEngine` + `Accounting.RunBusinessCentralSync` in #112).

Leave behind:

- Subclassing the platform `BusinessCentralConnector` at high ClassFactory priority (wins **every** BC integration on the host; #74 and #82 already collide).
- Fan-out inside `gl-accounts.page.ts`.
- A second copy of that fan-out in `BizAppsAccountingBCFanOutSyncDriver`.
- A parallel “Accounting Integrations” engine next to MJ’s.

---

## 3. Proposed shape

Three layers. Accounting owns the middle one. MJ Integrations owns the bottom. Plugins are thin.

```
┌─────────────────────────────────────────────────────────────┐
│  Callers                                                     │
│  sendJournalEntryBatch · Explorer buttons · nightly job      │
│  FPNA.GetCashPosition (reads imported CashBalance)           │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│  Accounting ERP meta-layer  (THIS APP, provider-agnostic)    │
│  AccountingErpEngine                                         │
│                                                              │
│  SyncMasterData({ objects: accounts|dimensions|values })     │
│  PostJournalBatch(batch)     — atomic, stamps external id    │
│  GetAccountBalances(company, asOf, glAccountIDs?)            │
│                                                              │
│  Knows: GLAccount, Dimension, DimensionValue,                │
│         JournalEntryBatch lifecycle, AM-4 account numbers    │
└──────────────────────────────┬──────────────────────────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                                 ▼
┌─────────────────────────┐      ┌──────────────────────────────┐
│  MJ Integration Engine  │      │  IAccountingErpProvider      │
│  CompanyIntegration     │      │  (plugin)                    │
│  EntityMap / FieldMap   │      │                              │
│  Watermark / RecordMap  │      │  CreateJournalEntry(...)     │
│  RunSync (PULL)         │      │  GetChartOfAccounts(...)     │
│  Run Integration Sync   │      │  GetDimensions(...)          │
│                         │      │  GetAccountBalances(...)     │
└─────────────────────────┘      └──────────────┬───────────────┘
                                                │
                                     ┌──────────┴──────────┐
                                     ▼                     ▼
                              Business Central         QuickBooks
                              (OData, journals)        (QBO JE API)
```

### 3.1 Meta-layer (`AccountingErpEngine`)

Lives in this repo (`EngineBase` types + `CoreEntitiesServer` implementation). **No BC imports.**

Responsibilities:

- Resolve the company’s `CompanyIntegration` (reuse the same record Integration Engine uses).
- **Pull master data:** call `IntegrationEngine.RunSync` narrowed by **object name** (`accounts`, `dimensions`, `dimensionValues`). Fan-out across companies is here (one engine, two triggers: remote op + scheduled job). UI is a thin RouteOperation.
- **Post a batch:** load the summary JE lines, resolve each line to an ERP account number (`ExternalAccountID` / `Code`), ask the **plugin** for `CreateJournalEntry`, then:
  - success → `Sent → Posted`, stamp external id on the batch / summary JE, flip member JEs to `GLPosted`;
  - failure → do not invent Posted; keep Sent (or fail the send) with the error. **Never** mark Posted without an external id.
- **Get balances:** plugin verb; optional write into FP&A `CashBalance` / `CashBalanceLine` (`Source='ERP'`) for the BankAccount set. Accounting itself does **not** grow an AccountBalance table.

This replaces `ErpPoster` / `mockErpPoster` as the production seam. Tests keep a mock **plugin**.

### 3.2 Plugin (`IAccountingErpProvider`)

One implementation per ERP. Registered with `@RegisterClass` keyed by Integration name / ClassName.

Higher-order verbs (names open for edit):

| Verb | In | Out |
|---|---|---|
| `CreateJournalEntry` | date, description, balanced lines `{ accountNumber, debit?, credit?, dimensions? }` | `{ externalId, documentNumber? }` |
| `GetChartOfAccounts` | optional filters | accounts `{ number, name, type, blocked, externalId }` |
| `GetDimensions` / `GetDimensionValues` | — | codes + values |
| `GetAccountBalances` | asOf, optional account numbers | `{ accountNumber, amount }` |

BC’s `CreateJournalEntry` is the missing twin of QBO’s existing action. **Port** QBO’s action and add BC here, behind the interface, instead of leaving `CreateQuickBooksJournalEntryAction` as a one-off.

Generic Integration Actions stay for “list BC customers.” They are not how we post a batch.

### 3.3 How pull vs plugin verbs split

| Need | Path |
|---|---|
| Nightly / incremental **upsert** of COA and dimensions into **our tables** | Integration Engine entity maps + `RunSync`. Meta-layer only fans out and names objects. |
| **One** balanced journal to the GL, then **our** batch state machine | Plugin `CreateJournalEntry` called from `PostJournalBatch`. |
| Balances for cash position | Plugin `GetAccountBalances` (or a pull map onto `CashBalanceLine` if we want watermarks). Prefer the verb first — balances are a point-in-time snapshot, not a slowly changing dimension. |

### 3.4 Downstream apps (FP&A)

Same `CompanyIntegration` (same BC credential). FP&A does **not** subclass the BC connector.

- Cash import: `AccountingErpEngine.GetAccountBalances` filtered to Active `BankAccount` links, write `CashBalance` + lines. `GetCashPosition` stays a compute over that.
- Later budget/opex: more maps or verbs, same plugin.
- Shared fan-out can live in **common** once a second app needs it; until then it lives in this engine and FP&A calls `Accounting.RunErpSync({ ObjectNames: ['…'] })` or a dedicated `ImportCashBalances` op that uses the plugin.

---

## 4. What we will not do

- A parallel Accounting Integrations engine.
- An app-owned `BusinessCentralConnector` that wins ClassFactory for the whole host.
- Fan-out or `RunSync` loops in Angular pages.
- Outbound entity-map of every Journal Entry.
- Persist `GetCashPosition`.
- Pull “all GL balances” into accounting — accounting is not the GL.

---

## 5. Suggested build order

1. **This plan** (this PR) — edit in line, comments in git.
2. **Interface + mock plugin** in this repo; wire `sendJournalEntryBatch` to `AccountingErpEngine.PostJournalBatch` (mock still, tests green).
3. **QBO plugin** wrapping existing `CreateQuickBooksJournalEntryAction` / GL / balances — proves the interface on a verb that already works.
4. **BC plugin** — `CreateJournalEntry` (new) + get COA / dimensions / balances. Reuse OData helpers from Actions/BizApps/Accounting and mapping notes from #74/#112. **Do not** fork the MJ BC connector.
5. **Pull maps** as metadata on the Company Integration (`accounts`, `dimensions`, `dimensionValues`) + `Accounting.RunErpSync` remote op (collapse #74 UI onto it).
6. **FP&A cash import** on the same integration.
7. Then close #74 / #112 with links to the code PRs and thanks for the prototype (maps, stamp pattern, object-name fan-out).

MJ repo PRs only if the platform connector must stamp company id or expose a write that plugins cannot reach without a fork. Prefer keeping that out of MJ until a plugin is blocked.

---

## 6. Open questions (edit in line)

1. **Where does `IAccountingErpProvider` live?** This repo (Open App owns domain verbs) vs MJ `Actions/BizApps/Accounting` (already has QBO/BC HTTP). Proposal: **interface + engine in this repo**; plugins may **call** the existing Actions package so we do not duplicate OAuth/OData. Alternative: lift the interface into `actions-bizapps-accounting` and have this app depend on it.

2. **Pull maps vs GetChartOfAccounts verb for COA.** Maps give watermarks and RecordMap for free. Verbs are simpler for a first BC bring-up. Proposal: **maps for COA/dimensions** (nightly), **verbs for JE post and balances**.

3. **Balances as a pull map onto `CashBalanceLine`?** Point-in-time; a watermark is awkward (every AsOf is a new photo). Proposal: verb `GetAccountBalances(asOf)` writing a new `CashBalance` row, not an incremental sync.

4. **One Integration named `business-central` shared by Accounting and FP&A**, or two Company Integrations sharing a credential? Proposal: **one**, many entity maps, object-name narrowing.

5. **Scheduled job:** keep app-owned job type, or only `Run Integration Sync` per company plus a tiny fan-out job that calls the meta-layer? Proposal: **one scheduled job → `AccountingErpEngine.SyncMasterData`**, not N jobs.

---

## 7. Kind close of the prototypes (later, not now)

When a code PR exists, comment on #74 and #112 roughly:

> Thank you — the maps, company stamp, object-name narrowing, and “same Company Integration, additive maps” are the design we’re keeping. We’re folding that into the MJ Integration Engine plus an accounting-owned provider-agnostic layer (plan: `plans/erp-provider-layer.md`, PR …) instead of an app-owned BC connector and page-level fan-out. Closing this PR as a prototype; ideas land there.

Do **not** close them from this plan PR.
