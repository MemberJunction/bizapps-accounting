<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://github.com/MemberJunction/MJ/raw/main/MJ_logo_dark.png">
    <source media="(prefers-color-scheme: light)" srcset="https://github.com/MemberJunction/MJ/raw/main/MJ_logo.webp">
    <img alt="MemberJunction" src="https://github.com/MemberJunction/MJ/raw/main/MJ_logo.webp" width="220">
  </picture>
</p>

<h1 align="center">BizApps Accounting</h1>

<p align="center">
  <strong>AR subsidiary ledger of record and journal-entry primitives for the <a href="https://github.com/MemberJunction/MJ">MemberJunction</a> platform</strong>
</p>

<p align="center">
  <a href="#what-this-is--and-is-not">What this is</a> &middot;
  <a href="#installation">Install</a> &middot;
  <a href="#entity-model">Entity Model</a> &middot;
  <a href="#using-bizapps-accounting-from-another-app">Code</a> &middot;
  <a href="plans/bizapps-accounting-master.md">Design Doc</a>
</p>

<p align="center">
  <img alt="MJ Version" src="https://img.shields.io/badge/MemberJunction-6.1.6%2B-blue?style=flat-square" />
  <img alt="Angular" src="https://img.shields.io/badge/Angular-21-DD0031?style=flat-square&logo=angular&logoColor=white" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript&logoColor=white" />
  <img alt="SQL Server" src="https://img.shields.io/badge/SQL%20Server-2019%2B-CC2927?style=flat-square&logo=microsoftsqlserver&logoColor=white" />
  <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-17-336791?style=flat-square&logo=postgresql&logoColor=white" />
  <a href="./LICENSE"><img alt="License: BUSL-1.1" src="https://img.shields.io/badge/License-BUSL--1.1-green?style=flat-square" /></a>
</p>

---

Every back-office app eventually grows the same accounting primitives — a chart of accounts, balanced journal entries, dimension tags, batching to the ERP. BizApps Accounting ships these as a **MemberJunction Open App** so upstream apps ([BizApps Orders](https://github.com/MemberJunction/bizapps-orders), future Payroll / Expense / Fixed-Asset apps) emit journal entries into one well-tested primitive layer instead of each reinventing it.

The ERP (Business Central, QuickBooks, NetSuite, Sage) remains the **general ledger** and the system of record for periods and the full chart. BizApps Accounting stages subledger JEs and dispatches one summarized JE per approved batch, per company, to the ERP.

> **Single source of truth for design:** [`plans/bizapps-accounting-master.md`](plans/bizapps-accounting-master.md) — the consolidated plan (decisions D1–D25, then BA-D26 onward). This README is the tour; the plan is the law.

---

## What This Is — and Is Not

| ✅ This is | ❌ This is not |
|---|---|
| AR subsidiary ledger of record | A general ledger |
| Journal-entry primitives: balanced, single-company, immutable-once-batched, dimension-tagged | A trial-balance / P&L / balance-sheet generator |
| Role-based GL account resolution (`GLAccountRole` + polymorphic `GLAccountLink`) | A period/close engine — **there are no accounting periods here; the ERP owns periods** (D2) |
| Per-company batch → CFO approval → one summary JE dispatched to the ERP | A tax engine — calculation is **delegated** to a third-party provider; our tax tables are snapshots (D17) |
| The staging ledger for forward-dated revenue-recognition JEs written at booking (D15) | An FX calculator — realized/unrealized FX is computed **upstream**; we store original-currency detail (D16) |

---

## Installation

BizApps Accounting is a [MemberJunction Open App](https://github.com/MemberJunction/MJ/tree/main/packages/OpenApp). Install it into any MJ environment using the [MJ CLI](https://github.com/MemberJunction/MJ/tree/main/packages/MJCLI):

```bash
mj app install https://github.com/MemberJunction/bizapps-accounting
```

The CLI resolves dependencies automatically — installing this app installs [BizApps Common](https://github.com/MemberJunction/bizapps-common) (business time zone, calendar-day and field-limit helpers) and [BizApps Tasks](https://github.com/MemberJunction/bizapps-tasks) (for batch approval tasks) first, and requires an MJ core version supporting the `__mj.Company` IsA pattern. `Currency` is owned by **this** app — BizApps Common does not ship currency entities.

### Managing an installed app

```bash
mj app info mj-bizapps-accounting     # Show details and version
mj app upgrade mj-bizapps-accounting  # Upgrade to latest release
mj app disable mj-bizapps-accounting  # Temporarily disable
mj app enable mj-bizapps-accounting   # Re-enable
mj app remove mj-bizapps-accounting   # Uninstall (--keep-data to preserve schema)
```

---

## What You Get

### Database (`__mj_BizAppsAccounting` schema)

| Area | Tables | Purpose |
|---|---|---|
| **Chart of Accounts** | `GLAccount` | Company-owned COA (hierarchy); ERP account identity lives here (`ExternalSystem` + `ExternalAccountID`) — no separate mapping table (D13) |
| **Account routing** | `GLAccountRole`, `GLAccountLink`, `GLAccountLinkDimension` | The JOB an account plays (AR, Sales, Deferred Revenue, Sales Discounts, Returns & Allowances, …) mapped polymorphically + date-effectively to Company / ProductCategory / Product (D11); company defaults are just company-level link rows (D12) |
| **Company profile** | `AccountingCompanyProfile` | IsA Disjoint child of `__mj.Company` — functional currency, fiscal year settings |
| **Currency** | `Currency`, `CurrencySpotRate` | ISO-4217 seed + spot-rate table; rate providers/auto-fetch deferred until multi-currency activates (D16) |
| **Journal Entries** | `JournalEntry`, `JournalEntryLine`, `JournalEntryLineDimension`, `JournalEntrySequence`, `JournalEntryType` | Balanced single-company JEs, `Pending → Batched → GLPosted`, per-company gap-free numbering (D19); polymorphic origin pair `LinkedEntityID`/`LinkedRecordID` (D25); an extensible type lookup that consuming apps seed their own types into (BA-D29) |
| **Batching** | `JournalEntryBatch`, `JournalEntryBatchSequence` | Single-company batches with accountant-set `PostingDate` (D7/D8); the batch's summary is **one aggregated `JournalEntry`** of type `JournalEntryBatchSummary` via `SummaryJournalEntryID` (D9) |
| **Dimensions** | `Dimension`, `DimensionValue` | First-class analytical tags (Department, CostCenter, Project, …), preserved through batch summarization to the ERP |
| **Tax (snapshot)** | `TaxAuthority`, `TaxJurisdiction`, `TaxRate`, `TaxLiability`, `CompanyTaxNexus` | Records of what the third-party tax engine returned — never a rate authority we author or sync (D17). Remittance is the ERP's job, and buyer-side exemption is not stored here |
| **Intercompany** | `IntercompanyAccountMatch`, `IntercompanyAccountMatchDimension` | Per company pair, the Due To / Due From accounts (and dimensions) that carry an intercompany obligation; the emitting app builds the entries (BA-D26) |
| **Finance exceptions** | `FinanceExceptionType`, `FinanceException` | Records a finance reviewer must clear before a month closes, raised by detectors in consuming apps (golive #279) |
| **Engine extensions** | `AccountingEngineExtension` | Registry of other apps' extensions that run around engine operations: enabled flag, run order, optional company scope, JSON configuration |

Deliberately absent — see plan §5.9: `AccountingPeriod` (ERP owns periods), `ScheduledJournalEntry` (rev-rec = real forward-dated JEs), `AccountBalance` materialization (views on demand), `ChartOfAccountsMapping`, recurring-template machinery, JE origin FK columns per upstream entity (replaced by the D25 pair).

### TypeScript Packages

| Package | NPM Name | Role |
|---|---|---|
| **Entities** | `@mj-biz-apps/accounting-entities` | Strongly-typed entity classes with Zod validation |
| **Actions** | `@mj-biz-apps/accounting-actions` | Server-side action handlers |
| **Server** | `@mj-biz-apps/accounting-server` | GraphQL resolvers and server bootstrap |
| **Angular** | `@mj-biz-apps/accounting-ng` | UI components, form overrides, custom widgets |
| **Engine Base** | `@mj-biz-apps/accounting-engine-base` | Shared engine base (`AccountingEngineBase`): cached lookups and GL account resolution, usable on client and server |
| **Core Entities Server** | `@mj-biz-apps/accounting-core-entities-server` | Server-only entity lifecycle hooks — JE numbering, `JournalEntryEntityServer` (extended entity with a `Lines` collection and properly scoped JE + lines transactions), GL/company alignment validation |

---

## Key Invariants (Enforced at the Database Level)

Critical integrity rules are enforced by **DB-level constraints and triggers**, immune to app-layer bypass — including direct SA access. Full reference: plan §6.

| Invariant | Mechanism |
|---|---|
| **Balanced JEs** — `SUM(Debits) = SUM(Credits)` per JE, checked when the JE locks (enters `Batched`/`GLPosted`); a `Pending` JE may be unbalanced while its lines are built | Lock-event trigger, plus a recheck when a locked JE's line changes |
| **Single-company JEs** — every line's GLAccount belongs to the header's company | Trigger |
| **Levels of locking** — a JE in a *pending* batch is preliminarily locked (releasable by reject/regenerate); batch **approval makes the lock permanent**; after that only GL-roundtrip fields may change | Immutability trigger (UPDATE/DELETE blocked; sanctioned unlock path only) |
| **One side per line** — exactly one of Debit/Credit, positive | CHECK |
| **Origin pair coherence** — `LinkedEntityID`/`LinkedRecordID` set together or not at all (D25) | CHECK |
| **Original-currency coherence** — original amounts, currency code, and rate move together | CHECKs |

The cumulative effect: the audit trail is **correct by construction**. No code path can produce an unbalanced JE or edit locked history — corrections are new reversing JEs (`ReversesJournalEntryID`), pen not pencil.

---

## Entity Model

```
 __mj.Company ──IsA (same UUID)──► AccountingCompanyProfile
      │
      ├──► GLAccount (company-owned COA, hierarchy, ERP identity)
      │        ▲
      │        │ resolved by role, most-specific wins:
      │   GLAccountLink (polymorphic: Product → ProductCategory → Company default)
      │        │              + GLAccountRole (AR, Sales, DefRev, discounts, …)
      │
      ├──► JournalEntry (single-company; EffectiveDate; Pending|Batched|GLPosted;
      │        │          LinkedEntityID/LinkedRecordID = ONE polymorphic origin, D25)
      │        ├──► JournalEntryLine ──► JournalEntryLineDimension ──► Dimension/Value
      │        └──► ReversesJournalEntryID (reversal chain)
      │
      └──► JournalEntryBatch (single-company; accountant-set PostingDate;
               SummaryJournalEntryID → one aggregated BatchSummary JE, D9)
```

### Cross-app references

| Reference | Refers to | Lives in |
|---|---|---|
| `JournalEntryBatch.ApprovalTaskID` | `Task.ID` — the approval task raised for the batch (D10) | `bizapps-tasks` |
| `JournalEntry.LinkedEntityID` + `LinkedRecordID` | The JE's single causal origin record (OrderLine, Payment, …) — `LinkedEntityID` is a hard FK to `__mj.Entity`; the record ref is soft by nature (D25) | upstream apps |
| `OrderLine.JournalEntryID` (inverse direction) | This app's `JournalEntry.ID` — one JE per order line *that has value*; a zero-value line stays NULL, so `IS NOT NULL` is not a "booked" test | `bizapps-orders` |

---

## JE Lifecycle & Batching

```mermaid
stateDiagram-v2
    [*] --> Pending: upstream event books JE (incl. FORWARD-DATED rev-rec entries)
    Pending --> Batched: swept into a single-company batch (date-window filter)
    Batched --> Pending: batch rejected / regenerated (preliminary lock released)
    Batched --> GLPosted: batch approved + dispatched; ERP acknowledges

    note right of Batched
      Preliminary lock while the batch is Pending.
      PERMANENT from batch approval.
    end note
```

- **No periods, no close.** JEs carry only `EffectiveDate`; the ERP settles periods. Timing discipline is the accountant's, aided by batch-window presets and the displayed swept date range (plan §4).
- **Forward-dated JEs are ordinary rows.** A 12-month subscription books 12 future-dated Dr Deferred Revenue / Cr Revenue entries at order lock (D15). Batch sweeps default to a cutoff of *today*; a future-reaching batch requires an explicit filter, and approval displays the min/max `EffectiveDate` being committed. That date-awareness is the only "scheduling" machinery in the system.
- **One summary JE per batch** posts to the GL, netted per GLAccount × dimension-combo, dated the batch's `PostingDate` (D8/D9). Dispatch targets the BC REST API directly (plan §7.5).
- **Approval is a CFO-level gate** raised through [bizapps-tasks](https://github.com/MemberJunction/bizapps-tasks) (D10); reject unlocks members back to the candidate pool.

---

## Multi-Currency

JEs post in the company's **functional** currency. Lines carry the original-currency triple (`OriginalCurrencyCode`, original amounts, `ExchangeRateUsed`) when the source transaction differed. All FX computation — realized and unrealized — happens **upstream** (Orders/Payments, D16); this app stores the detail and validates coherence. Rate providers and auto-fetch are deferred until multi-currency activates.

---

## Using BizApps Accounting from Another App

The integration contract (plan §14): upstream apps create JEs through the **`Accounting.CreateJournalEntry` / `CreateJournalEntries` remote operations** — one transactional server call per atomic unit of business work (a JE plus its lines; N per-line JEs for an order confirm), never client-side multi-save choreography.

Server-side code composing larger transactions (e.g. an order Save-override booking per-line JEs) works directly with the extended entity classes in `@mj-biz-apps/accounting-core-entities-server` — `JournalEntryEntityServer` exposes a `Lines` collection and persists the JE + lines in one properly scoped transaction, with balance and company-alignment validation before the DB triggers ever see it.

GL account selection uses **role-based resolution** (`AccountingEngineBase.ResolveLinkedAccount`): walk the target's `GLAccountLink` rows — product → product-category tree → company default — for the requested role (AR, Sales, Deferred Revenue, …), date-effective, failing loudly if no link resolves. No GL account columns on catalog entities, ever.

Declare the dependency in your `mj-app.json`:

```json
{
  "dependencies": {
    "mj-bizapps-accounting": {
      "version": ">=0.1.0",
      "repository": "https://github.com/MemberJunction/bizapps-accounting"
    }
  }
}
```

Set your JE's origin so drill-through works: `LinkedEntityID` = your entity's MJ Entity ID, `LinkedRecordID` = the source record's PK (D25).

---

## Seeded Defaults

Seed data (GL account roles, default per-company COA scaffolding) is authored as **metadata** (`metadata/`), never hand-written SQL INSERTs — customizable per deployment. It reaches a host through the `…__Metadata_Sync.sql` migration generated at release ([docs/database-migrations.md](docs/database-migrations.md)). There are no system-level default accounts: **GL account defaults start at the company level** as company-scoped `GLAccountLink` rows (D12).

### Who may clear finance exceptions

The package seeds one role, `Finance`, holding `MJ.BizApps.Accounting.FinanceExceptions.Clear`: out of the box any Finance holder who did not create the source record may clear any exception. A host narrows that by granting these authorizations (all shipped, none granted) to its own roles, as `MJ: Authorization Roles` rows in its own metadata:

| Authorization (`MJ.BizApps.Accounting.FinanceExceptions.` …) | Once granted to a role |
|---|---|
| `ClearType.<TYPE CODE>` | only its holders clear that type; holding `Clear` no longer does |
| `ClearUnattributed` | only its holders clear an exception whose creator is unresolved or the system user (otherwise an unresolved creator is refused, and a system creator follows the type) |
| `EscalatedCreator` + `ClearEscalated` | an exception on a record created by an `EscalatedCreator` holder is cleared only by a `ClearEscalated` holder (both must be granted) |

Precedence: an unattributed creator first, then an escalated creator, then the type's right, then `Clear`. The source record's creator can never clear its exception, so the escalated lane is how a senior person's own work reaches their peers: grant `EscalatedCreator` and `ClearEscalated` to the same senior roles (say `CFO` and a senior finance lead role) and an exception on a CFO-created record is cleared by the lead, one on a lead-created record by the CFO or another lead, never by the creator. It comes before the type's right deliberately: when the creator is the only holder of that type's right, the exception would otherwise be clearable by nobody. `ClearEscalated` applies to every type, so grant it only to roles trusted to clear any type. A rule is in force only while it has a grant row; to say "nobody may clear this type", grant its right to a role with no members. For example, to let only a `CFO` role clear `PRICE_BELOW_ENGINE_UNAPPROVED`:

```json
{
  "fields": {
    "AuthorizationID": "@lookup:MJ: Authorizations.Name=MJ.BizApps.Accounting.FinanceExceptions.ClearType.PRICE_BELOW_ENGINE_UNAPPROVED",
    "RoleID": "@lookup:MJ: Roles.Name=CFO",
    "Type": "Allow"
  }
}
```

The rules and refusal codes are in [docs/lifecycle-hooks.md](docs/lifecycle-hooks.md) §2c. Saved query "Finance Exceptions Cleared" lists every clearing decision by month.

---

## Database Support

SQL Server is the **source of truth** for migrations. PostgreSQL is supported via automatic conversion using [`@memberjunction/sql-converter`](https://github.com/MemberJunction/MJ/tree/main/packages/SQLConverter).

**Schema changes are new `V` migrations.** Don't edit the baseline (`B202605281200__…`): databases that already ran it would never see the edit. The rules are in [docs/database-migrations.md](docs/database-migrations.md).

```
migrations/                       ←  T-SQL: the baseline plus incremental V migrations (each with its CodeGen output)
migrations-pg/                    ←  PG, produced by `pnpm exec mj sql-convert`
```

At runtime, `mj migrate` reads `DB_PLATFORM` and picks the right directory. Postgres counterparts are required from the release on: a PR into `next` with a new migration and no `.pg.sql` gets a warning, and the release PR fails (`rr: pg counterparts`) for any migration since the last release without one. Most migrations from before that rule, the baseline included, have none. The PG parity workflow (`pg-migrations.yml`) runs only when started by hand.

---

## Contributing (Developer Setup)

```bash
git clone https://github.com/MemberJunction/bizapps-accounting.git
cd bizapps-accounting
pnpm install
```

### Configure Environment

Create a `.env` file at the repo root:

```env
DB_PLATFORM=sqlserver         # or postgresql
DB_HOST=localhost
DB_PORT=1433
DB_DATABASE=YourDatabase
DB_USERNAME=sa
DB_PASSWORD=yourpassword
GRAPHQL_PORT=4102
MJ_CORE_SCHEMA=__mj
```

### Deploy and Build

```bash
pnpm run mj:migrate                   # Apply migrations (creates __mj_BizAppsAccounting schema)
pnpm run mj sync push --dir metadata  # Load seed metadata into your dev database (hosts get it from the release's Metadata_Sync migration)
pnpm run demo:load                     # Optional: the predictive-scoring bench (demo-data/), never shipped to hosts
pnpm run mj:codegen                   # Generate TypeScript / GraphQL / Angular code
pnpm run build                        # Build all packages (Turborepo)
```

### Run Development Servers

This repo no longer bundles host apps — there is no `apps/MJAPI` or `apps/MJExplorer` to start
here. The packages run inside a MemberJunction host (declared via `mj-app.json`): dev-link or
install the app into an MJ instance and run that host's MJAPI/Explorer.

Ports are chosen to avoid colliding with concurrent MJ dev environments:

| Project | API | Explorer |
|---|---|---|
| MJ core | 4001 | 4201 |
| bizapps-common | 4101 | 4301 |
| **bizapps-accounting** | **4102** | **4302** |
| bizapps-orders | 4103 | 4303 |

### Run Tests

```bash
pnpm run test               # unit tests across packages (what CI runs)
pnpm run test:integration   # live suite against a running MJAPI; writes data (prerequisites: packages/IntegrationTests/README.md)
```

Every test tier, its prerequisites and its command: [test-harnesses/README.md](test-harnesses/README.md).

---

## Repository Structure

```
bizapps-accounting/
├── mj-app.json                    # MJ Open App manifest (schema __mj_BizAppsAccounting)
├── mj.config.cjs                  # CodeGen config + SQL → PG placeholder rules
├── packages/
│   ├── Entities/                  # @mj-biz-apps/accounting-entities
│   ├── Actions/                   # @mj-biz-apps/accounting-actions
│   ├── Server/                    # @mj-biz-apps/accounting-server
│   ├── CoreEntitiesServer/        # @mj-biz-apps/accounting-core-entities-server
│   ├── EngineBase/                # @mj-biz-apps/accounting-engine-base
│   ├── Angular/                   # @mj-biz-apps/accounting-ng
│   └── IntegrationTests/          # @mj-biz-apps/accounting-integration-tests (private)
├── migrations/                    # T-SQL baseline + incremental V migrations (source of truth)
├── migrations-pg/                 # PG migrations (converter output)
├── demo-data/                     # Opt-in records, never shipped (pnpm run demo:load)
├── metadata/                      # Seed data + entity metadata (synced via mj-sync)
├── docs/                          # Architecture, ERD, lifecycle hooks, binding rules, seeding guides
├── plans/
│   └── bizapps-accounting-master.md  # THE design doc & decision log
├── test-harnesses/                # Live test tiers (see test-harnesses/README.md)
├── scripts/                       # rebuild-db.sh (new empty database only)
└── ci/                            # Release scripts
```

---

## Build Sequencing

Ruling of record: **build first, iterate in the system** — plans stay thin; nothing is "done" until tests are green and a demo artifact exists. The build order and the status of each step live in master plan §16.

---

## Documentation

| Document | Description |
|---|---|
| [Master Plan](plans/bizapps-accounting-master.md) | The consolidated design doc & decision log (D1–D25, then BA-D26 onward) — single source of truth |
| [Architecture](docs/ARCHITECTURE.md) | How the system fits together, block by block |
| [ERD](docs/bizapps-accounting-erd.md) | The current schema, sectioned |
| [Lifecycle Hooks](docs/lifecycle-hooks.md) | The server-side `BaseEntity.Save()` hooks and the engine |
| [UI Architecture](docs/ui-architecture.md) | Binding rule for Angular code: no data-access service layer |
| [Database Migrations](docs/database-migrations.md) | Binding rule for schema changes: incremental `V` migrations only |
| [Customer Deposits seeding](docs/customer-deposits-seeding.md) / [Unbilled Receivable seeding](docs/unbilled-receivable-seeding.md) | Per-company `GLAccountLink` rows orders needs before go-live |
| [Testing](test-harnesses/README.md) | Test tiers and how to run each |
| [PG Conversion Workflow](migrations-pg/README.md) | T-SQL ↔ PostgreSQL conversion pipeline |
| [CLAUDE.md](CLAUDE.md) | Development conventions, schema invariants, build commands |

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| **Platform** | [MemberJunction](https://github.com/MemberJunction/MJ) | 6.1.6+ |
| **Runtime** | Node.js | 18+ |
| **Language** | TypeScript | 5.9 (strict) |
| **Database (primary)** | SQL Server / Azure SQL | 2019+ |
| **Database (secondary)** | PostgreSQL | 17 |
| **API** | GraphQL (Apollo Server) | -- |
| **UI Framework** | Angular | 21 |
| **Build** | Turborepo | 2.7 |
| **Validation** | Zod | 3.25 |
| **SQL Conversion** | [`@memberjunction/sql-converter`](https://github.com/MemberJunction/MJ/tree/main/packages/SQLConverter) (through the `mj` CLI) | 6.1.6+ |

---

## License

Business Source License 1.1 — see [LICENSE](./LICENSE) for details.

---

<p align="center">
  Built on <a href="https://github.com/MemberJunction/MJ">MemberJunction</a> — the metadata-driven application platform.
</p>
