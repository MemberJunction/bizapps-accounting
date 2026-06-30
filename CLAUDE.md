# GENERAL RULE
Don't say "You're absolutely right" each time I correct you. Mix it up, that's so boring!

# BizApps Accounting Development Guide

This is a **MemberJunction Open App** built on top of the [MemberJunction](https://github.com/MemberJunction/MJ) platform. It provides the AR subsidiary ledger of record and journal-entry primitives (GL accounts, accounting periods, balanced JEs with multi-currency, dimensions, tax) for the MJ ecosystem. It is **not a general ledger** — entries are batched to the ERP (Business Central, QuickBooks, NetSuite, etc.).

This repo depends on [bizapps-common](https://github.com/MemberJunction/bizapps-common) for shared entities (Currency, Organization, Address) and extends `__mj.Company` with an `AccountingCompanyProfile` (IsA Disjoint child).

See `plans/bizapps-accounting-master.md` for the full design and `BA-D1`..`BA-D24` decision log.

## Repository Structure

```
bizapps-accounting/
  mj-app.json          - MJ Open App manifest
  apps/
    MJAPI/             - GraphQL API server (port 4102)
    MJExplorer/        - Angular UI application (port 4302)
  packages/
    Entities/          - @mj-biz-apps/accounting-entities (CodeGen-generated entity subclasses)
    Actions/           - @mj-biz-apps/accounting-actions (CodeGen-generated action subclasses)
    Server/            - @mj-biz-apps/accounting-server (server bootstrap + GraphQL resolvers)
    Angular/           - @mj-biz-apps/accounting-ng (Angular bootstrap + form components)
```

---

## CRITICAL RULES - VIOLATIONS ARE UNACCEPTABLE

### 1. NO COMMITS WITHOUT EXPLICIT APPROVAL
- **NEVER run `git commit` without the user explicitly asking you to**
- **Each commit requires ONE-TIME explicit approval** - don't assume ongoing permission
- **NEVER ask to commit** - wait for the user to request it
- **ONLY commit what is staged** - never modify or add to staged changes
- **NEVER commit work-in-progress** that isn't staged by the user

### 2. NO `any` TYPES - EVER
- **NEVER use `any` types in TypeScript code**
- **ALWAYS ask the user** if you think you need to use `any`
- This includes: No `as any`, No `: any`, No `<any>`, No `unknown` as a lazy alternative
- **Why**: MemberJunction has strong typing throughout - there's always a proper type available

### 3. NO MODIFICATIONS TO MERGED PRs
- **NEVER update title/description of merged PRs** without explicit approval each time

### 4. ANGULAR COMPONENT & MODULE STRATEGY
MemberJunction supports both standalone and NgModule-declared components. Choose the right approach for each situation:

#### When to Use Standalone Components (Preferred for New Components)
- **New leaf components** (dialogs, panels, small widgets) that don't need to share a module
- **Lazy-loaded route components** - standalone enables direct `loadComponent()` without wrapper modules
- **Simple, self-contained components** with clear dependency lists

#### When to Use NgModules
- **Feature modules** grouping many related components
- **Shared modules** providing common functionality to multiple consumers
- **Existing module-declared components** - don't migrate just for the sake of it

#### Rules for Both Approaches
- **Standalone components**: declare all dependencies in the component's `imports` array
- **NgModule components**: must use `standalone: false` explicitly (Angular 21 defaults to standalone)
- **Never mix within a single component** - a component is either standalone or module-declared
- When adding to an existing package, **follow the pattern already used in that package**

#### Modern Template Syntax (Required for New Code)
- **Use `@if`/`@for`/`@switch`** block syntax instead of `*ngIf`/`*ngFor`/`*ngSwitch`
- **Use `inject()` function** instead of constructor injection for new components

### 5. NO RE-EXPORTS BETWEEN PACKAGES
- **NEVER re-export types, classes, or interfaces from other packages**
- **ALWAYS** import directly from the source package that defines them

### 6. USE BaseSingleton FOR ALL SINGLETONS
- **NEVER use manual `static _instance` singleton patterns** - always extend `BaseSingleton<T>` from `@memberjunction/global`
- See MJ documentation for the pattern

---

## IMPORTANT
- Before starting a new line of work always check the local branch we're on. Feature branches should be cut from `next` (the integration branch), not from `main` (the release branch). If we aren't already in an appropriately-named, empty feature branch tracking `origin/<same-name>`, ask before creating a new one. See "Branching Model" below for the full release flow.

**VERY IMPORTANT** We want you to be a high performance agent. Therefore whenever you need to spin up tasks - if they do not require interaction with the user and if they are not interdependent in any way, ALWAYS spin up multiple parallel tasks to work together for faster responses. **NEVER** process tasks sequentially if they are candidates for parallelization

## Git Branch Tracking Rules

### Feature Branches MUST Track Same-Named Remote Branches
When creating or working with feature branches, **ALWAYS** ensure the local branch tracks a remote branch **with the same name**. Never track `main` or other permanent branches.

```bash
# CORRECT
git checkout -b my-feature-branch
git push -u origin my-feature-branch

# WRONG - Branch created from main will track origin/main by default!
git checkout main
git checkout -b my-feature-branch
# Now my-feature-branch tracks origin/main - DANGEROUS!
```

### Before Every Push
1. Run `git branch -vv` to verify tracking
2. Ensure your branch tracks `origin/<same-branch-name>`
3. If tracking is wrong, fix it before pushing

### Branching Model: `next` → `main` Release Flow
BAC uses a two-tier branching model (matching BCSaaS and MJ):

- **`next`** — integration branch. All feature work merges here.
- **`main`** — release branch. Only updated by a single coordinating PR from `next`. Pushes to `main` trigger the publish workflow.

**Feature work flow:**
1. Cut feature branch from `next` (not from `main`): `git checkout next && git pull && git checkout -b <feature-name>`
2. Make changes, commit, push, open PR → `next`
3. `changes.yml` + `build.yml` run validation on the PR
4. Merge to `next`

**Release flow:**
1. Open a single PR from `next` → `main` ("Release vX.Y.Z" coordinating PR)
2. Merge to `main` triggers `publish.yml`:
   - Validates, builds, runs `changeset version`, publishes to npm, tags the release, commits the version bump back to `main`
   - Then automatically: checks out `next`, merges main into it, runs `npm install --package-lock-only`, commits the updated lockfile as `chore: Update package-lock.json with vX.Y.Z dependencies`, and pushes to `next`
3. `next` is now ready for the next round of feature work, with a lockfile matching the just-published versions

**Rules:**
- **Never commit directly to `main`.** Always go through `next` first (except for the release coordinating PR itself).
- **Never hand-author the `chore: Update package-lock.json with vX.Y.Z dependencies` commit on `next`.** That commit is created automatically by the publish workflow. If you find yourself wanting to write one manually, something is wrong upstream.
- **Hotfixes that genuinely must bypass `next`** still go through a PR to `main`, but the next release-coordinating PR from `next` will need to merge main's hotfix commit back into next before merging next → main again. The publish workflow's automated merge-back handles this for you; you should rarely need to do it manually.

---

## Build Commands
- Build all packages: `npm run build` (from repo root, uses Turborepo)
- Build generated packages: `npm run build:generated`
- Build API only: `npm run build:api`
- Build Explorer only: `npm run build:explorer`
- Start API server: `npm run start:api` (port 4102)
- Start Explorer UI: `npm run start:explorer` (port 4302)
- Build specific package: `cd packages/PackageName && npm run build`
- **IMPORTANT**: When building individual packages for testing/compilation, always use `npm run build` in the specific package directory

### Build Pipeline
- MJExplorer uses the Angular `application` builder powered by ESBuild and Vite
- Dev server uses Vite with HMR for fast iteration
- Source maps are configured for full debugging support including local packages

### NPM Workspace Management
- This is an NPM workspace monorepo
- **IMPORTANT**: To add dependencies to a specific package:
  - Define dependencies in the individual package's package.json
  - Run `npm install` at the repository root (NOT within the package directory)
  - Never run `npm install` inside individual package directories

## Development Workflow
- **CRITICAL**: After making code changes, always compile the affected package by running `npm run build` in that package's directory to check for TypeScript errors
- Fix all compilation errors before proceeding with additional changes
- **Tasks**: whenever you need to spin up tasks - if they do not require interaction with the user and if they are not interdependent in any way, ALWAYS spin up multiple parallel tasks to work together for faster responses

## Ports
- MJAPI GraphQL server: **4102** (configured via `GRAPHQL_PORT` in `.env`)
- MJExplorer Angular app: **4302** (configured in MJExplorer start script)
- These avoid conflicts with other MJ dev environments (MJ uses 4001/4201, BizAppsCommon uses 4101/4301)

## Environment Configuration
- The repo root `.env` file contains all configuration (DB, auth, AI keys, etc.)
- `apps/MJAPI/.env` is a **symlink** to `../../.env` - do not create a separate file there
- Angular environment files are in `apps/MJExplorer/src/environments/`

---

## Code Style Guide
- Use TypeScript strict mode and explicit typing
- Always use MemberJunction generated `BaseEntity` sub-classes for all data work for strong typing
- No explicit `any` types - see CRITICAL RULES section above
- Prefer union types over enums for better package exports
- Prefer object shorthand syntax
- Follow existing naming conventions:
  - PascalCase for classes and interfaces
  - **PascalCase for public class members** (properties, methods, `@Input()`, `@Output()`)
  - **camelCase for private/protected class members**
  - camelCase for local variables and function parameters
  - Use descriptive names and avoid abbreviations
- Imports: group imports by type (external, internal, relative)
- Error handling: use try/catch blocks and provide meaningful error messages
- Keep functions focused and concise
- **NEVER use dynamic require() or import() statements** - always use static imports at the top of files unless explicitly requested

### Functional Decomposition Is Mandatory
- **NEVER** write long, monolithic functions that do multiple things
- **ALWAYS** decompose complex operations into smaller, well-named helper functions
- **MAXIMUM** function length should be ~30-40 lines (excluding comments)
- If a function is getting long, STOP and refactor it immediately

---

## MemberJunction Entity and Data Access Patterns

### Entity Object Creation
**Never directly instantiate BaseEntity subclasses** - always use the Metadata system:

```typescript
// WRONG - bypasses MJ class system
const entity = new PersonEntity();

// CORRECT - uses MJ metadata system
const md = new Metadata();
const entity = await md.GetEntityObject<PersonEntity>('Person');
```

### BaseEntity Spread Operator Limitation
**CRITICAL**: Never use the spread operator (`...`) directly on BaseEntity-derived classes. Use `GetAll()` instead:

```typescript
// WRONG
const data = { ...myEntity, extraField: 'value' };

// CORRECT
const data = { ...myEntity.GetAll(), extraField: 'value' };
```

### Server-Side Context User Requirements
When working on server-side code, **ALWAYS** pass `contextUser` to `GetEntityObject` and `RunView` methods:

```typescript
// WRONG - missing contextUser on server
const entity = await md.GetEntityObject<SomeEntity>('Entity Name');

// CORRECT - includes contextUser for server-side operations
const entity = await md.GetEntityObject<SomeEntity>('Entity Name', contextUser);
```

### Loading Records with RunView
```typescript
const rv = new RunView();
const results = await rv.RunView<PersonEntity>({
    EntityName: 'Person',
    ExtraFilter: `LastName='Smith'`,
    OrderBy: 'FirstName ASC',
    ResultType: 'entity_object'  // Returns actual entity objects
});
```

### RunView Error Handling
**Important**: RunView does NOT throw exceptions. Check `Success` property:

```typescript
const result = await rv.RunView<SomeEntity>({...});
if (result.Success) {
    const items = result.Results || [];
} else {
    console.error('Failed:', result.ErrorMessage);
}
```

### ResultType: entity_object vs simple
- Use `entity_object` when you need to **mutate and save** records
- Use `simple` with `Fields` parameter when you only need to **read/display** data
- **DO NOT** use `Fields` parameter with `entity_object` - it is automatically ignored

### Batch Queries with RunViews
Use `RunViews` (plural) for multiple independent queries:

```typescript
const rv = new RunView();
const [people, orgs] = await rv.RunViews([
    { EntityName: 'Person', ExtraFilter: '', ResultType: 'entity_object' },
    { EntityName: 'Organization', ExtraFilter: '', ResultType: 'entity_object' }
]);
```

---

## Angular Development Best Practices

### Change Detection
- Add `ChangeDetectorRef` and use `cdr.detectChanges()` after programmatic changes
- Replace `setTimeout` with `Promise.resolve().then()` for microtask timing

### Input Properties - Use Getter/Setters
```typescript
// GOOD - Precise control with getter/setter
private _myInput: string | null = null;

@Input()
set myInput(value: string | null) {
    const prev = this._myInput;
    this._myInput = value;
    if (value && value !== prev) this.onMyInputChanged(value);
}
get myInput(): string | null { return this._myInput; }
```

### Loading Indicators
- **ALWAYS** use the `<mj-loading>` component from `@memberjunction/ng-shared-generic`
- **NEVER** create custom spinners

### Dialog Button Placement
- **Confirm/Submit buttons go on the LEFT**, Cancel buttons on the RIGHT

### Icon Libraries
- **Primary**: Font Awesome (already included)

---

## CodeGen

This repo uses MemberJunction's CodeGen system to generate entity and action subclasses. The generated code lives in:
- `packages/Entities/` - Entity TypeScript classes with Zod schemas
- `packages/Actions/` - Action TypeScript classes
- `packages/Server/src/generated/` - GraphQL resolvers and class registrations
- `packages/Angular/src/lib/generated/` - Angular form components and module

**Key rules:**
- Never manually edit files in generated directories - CodeGen will overwrite them
- Always run CodeGen after database schema changes
- Run `npm run mj:codegen` from repo root to regenerate

## Database Migrations
- Run `npm run mj:migrate` from repo root
- See MJ documentation for migration file format and conventions
- Never include `__mj_CreatedAt`/`__mj_UpdatedAt` columns in CREATE TABLE - CodeGen handles them
- Never create indexes for foreign key columns - CodeGen creates them automatically

### Keep the ERD + docs current (convention)
- **After any schema change** (new/edited migration, new entity, new column) **update `docs/bizapps-accounting-erd.md` in the same change** — the ERD is the at-a-glance schema reference and must not drift from the migrations.
- Likewise update `docs/lifecycle-hooks.md` when a `BaseEntity.Save()` hook changes, and `docs/ARCHITECTURE.md` as each build block lands. Treat these three docs as part of every change's Definition of Done.

### SQL Server is the source of truth; PostgreSQL is converted
- Write all migrations as **T-SQL** in `migrations/` (`V<TS>__v<X.Y.x>__<description>.sql`).
- The PostgreSQL counterparts in `migrations-pg/` are produced by the MJ converter (`@memberjunction/sql-converter`) via `npx mj sql-convert <file> --from tsql --to postgres --output migrations-pg/<file>.pg.sql --schema __mj_BizAppsAccounting`. PG-only patches use the `.pg-only.sql` extension.
- **Never hand-edit `migrations-pg/*.pg.sql`** — fix the converter rule and re-convert. PG-only patches are the exception, and live next to the converted files.
- CI runs `.github/workflows/pg-migrations.yml` on PRs that touch migrations or the converter to validate the PG output still applies cleanly to a fresh PG 17 database.
- See `migrations-pg/README.md` for the conversion workflow and the MJ repo's `/pg-migrate` slash command for the deeper toolchain.

### Accounting-specific schema invariants (see `plans/bizapps-accounting-master.md` §5)
- Balanced-JE invariant enforced via DEFERRABLE constraint trigger — never UPDATE/DELETE around it.
- JE immutability after `Status ∈ {Batched, GLPosted}` enforced by trigger — only `GLPostedAt`/`GLReferenceID`/`Status` may change after lock.
- Period-close trigger blocks JE inserts into a closed `AccountingPeriod` unless `OriginalAccountingPeriodID` is set (adjusting entry pattern).
- `AccountingCompanyProfile` is an IsA Disjoint child of `__mj.Company` — same UUID as the parent row, never INSERT a Profile without a matching Company.

### Time is ALWAYS stored in UTC (convention)
Every timestamp this app persists is **UTC** — no exceptions, no local-time storage.
- **Code writes UTC instants:** use `new Date()` (a JS Date is a UTC instant; the mssql driver persists it to `DATETIMEOFFSET` as `+00:00`), `new Date().toISOString().slice(0,10)` for `DATE` values, and `getUTC*()` for any date-part math (e.g. fiscal year). **Never** use local-time getters (`getFullYear()`, `getMonth()`, `toLocaleString()`, `toDateString()`) for a value that gets stored or compared — they introduce the runner's local zone.
- **DB defaults are UTC:** the SQL Server container runs at `+00:00`, so `SYSDATETIMEOFFSET()` / `GETUTCDATE()` defaults (and CodeGen's `__mj_CreatedAt`/`__mj_UpdatedAt`) are UTC. Verify with `SELECT DATENAME(TZOFFSET, SYSDATETIMEOFFSET())` → must be `+00:00`. If a deployment's server is NOT UTC, fix the server/container TZ — do not paper over it in code.
- **Display/zone is a presentation concern:** `AccountingCompanyProfile.OperatingTimeZone` (defaults `'UTC'`, W1) is for *rendering* dates to a company's users; storage stays UTC regardless.

---

## Debugging

### VSCode Launch Configurations
- **MJAPI**: Node.js debugger with source maps for local packages
- **MJExplorer**: Chrome debugger (port 4302) with source maps
- **MJExplorer (attach)**: Attach to existing Chrome on port 9222
- **Full Stack**: Compound configuration running both MJAPI + MJExplorer

### Source Map Scoping
Source maps are scoped to local packages only (`apps/MJAPI/**`, `packages/Entities/**`, `packages/Actions/**`, `packages/Server/**`, `packages/Angular/**`). Third-party packages and node_modules are excluded to avoid noise.

---

## Performance Best Practices

### Batch Database Operations
- Use `RunViews` (plural) instead of multiple `RunView` calls
- Group related queries together in a single batch operation

### Avoid Per-Item Queries in Loops
- **NEVER** make RunView calls inside loops
- Load all data once, then process client-side

### Use View Fields Instead of Lookups
- Most MJ views include denormalized fields from related entities
- Use the denormalized field directly instead of a separate lookup query

---

## GitHub Repository
- Repository: https://github.com/MemberJunction/bizapps-accounting
- Default branch: `main` (release branch — publishes on push)
- Integration branch: `next` (where feature PRs land)
- Feature PRs target `next`. Release PRs target `main`.
- See "Branching Model" section above for the full flow.

## Purpose

This repository provides the **AR subsidiary ledger of record + journal-entry primitives** for the MemberJunction ecosystem. Downstream apps (BizAppsOrders, future BizAppsPayroll/ExpenseManagement/FixedAssets) emit balanced journal entries by calling into this app's `AccountingService`. Entries batch to an external ERP (Business Central, QuickBooks, NetSuite, Sage) for the full general-ledger close.

**What lives here** (per `plans/bizapps-accounting-master.md`):
1. `GLAccount` + seeded default chart of accounts
2. `AccountingCompanyProfile` — IsA Disjoint child of `__mj.Company` (functional currency, fiscal year, default GL accounts, business-profile fields)
3. `AccountingPeriod` with hard-close semantics
4. `JournalEntry` / `JournalEntryLine` / `JournalEntryBatch` with balanced-JE + immutability invariants enforced at the DB level
5. `Dimension` / `DimensionValue` / `JournalEntryLineDimension` for analytical tagging
6. `ChartOfAccountsMapping` for ERP roundtrip
7. Tax entities (`TaxAuthority`, `TaxJurisdiction`, `TaxRate`, `TaxLiability`, `TaxRemittance`, `CustomerTaxProfile`) + pluggable `TaxCalculationProvider`
8. Recurring JE templates (FX revaluation, depreciation, prepaid amortization, sales-tax snapshot)
9. Account balance materialization for closed periods
10. Read-model views (`vw_TrialBalance_AR`, `vw_AROpenByCustomer`, `vw_DefRevRollforward`, etc.) for Skip-generated reports

**What does NOT live here**: trial balance / P&L / balance sheet generation, year-end closing, statistical accounts, fixed-asset depreciation as first-class, inventory/COGS, expense management. Those stay in the ERP or future BizApps* siblings.

**Dependencies**: `__mj` (MJ core) → `bizapps-common` (Currency, CurrencyExchangeRate, Organization, Address) → **this repo** → `bizapps-orders` → `bizapps-contracts` → `aidp`.