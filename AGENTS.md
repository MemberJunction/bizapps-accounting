# BizApps Accounting Agent Guide

> **Canonical Guide**: See [`CLAUDE.md`](CLAUDE.md) for the complete repository architecture, branching/release flow, CodeGen workflow, schema invariants, UI architecture (`docs/ui-architecture.md`), and database migration rules (`docs/database-migrations.md`). This file summarizes the non-negotiable engineering rules and the 5-Rule BizApps Performance & Caching Standard for all coding agents.

---

## Critical Rules

1. **Git & Branching**:
   - Never commit or push directly to `main`, `next`, or `lts/*` release lines. Cut feature branches from `next` and open PRs targeting `next`.
   - Never squash-merge PRs — preserve commit history with standard merge commits (`gh pr merge --merge`).
   - Never touch `ci/` protected scripts (`ci/protect.mjs`, etc.) or hand-edit generated files under `*/generated/` or `migrations-pg/*.pg.sql`.
   - Add a `.changeset/<name>.md` (`patch` / `minor`) for every modified published `@mj-biz-apps/accounting-*` package.
2. **Strict TypeScript & MJ Entity Typing**:
   - Zero `any` types (`as any`, `: any`, `<any>`) and zero lazy `unknown` workarounds.
   - Never use `BaseEntity.Get()` / `.Set()` as a substitute for generated entity properties.
   - Derive value-list unions from generated entity classes (`Entity['Field']`) — never hand-copy CHECK-constraint unions.
   - Never re-export types or classes from other packages; always import from the defining package.
   - Always extend `BaseSingleton<T>` from `@memberjunction/global` for singletons (never manual `static _instance`).
   - Always use static `import` statements (no dynamic `import()` unless narrowly justified by MJ policy).
3. **Angular Conventions**:
   - Follow [`docs/ui-architecture.md`](docs/ui-architecture.md): no data-access service layer wrapping entities or Remote Operations.
   - Use modern `@if` / `@for` / `@switch` template syntax and `inject()` for new components; specify `standalone: false` explicitly for NgModule-declared components.
   - Persist user preferences via `UserInfoEngine.Instance` (never `localStorage` / `sessionStorage`).
4. **Testing & Verification**:
   - Always run `pnpm run build && pnpm run test` before finishing and report exact pass/fail/skip counts.
   - Keep `docs/bizapps-accounting-erd.md`, `docs/lifecycle-hooks.md`, and `docs/ARCHITECTURE.md` synchronized with schema or lifecycle changes.

---

## 5-Rule BizApps Performance & Caching Standard

1. **`BaseEngine` (`BaseSingleton` + `@RegisterForStartup`) for Bounded Reference/Taxonomy Metadata**
   - Cache bounded reference/config entities in `AccountingEngineBase` (`packages/EngineBase/src/AccountingEngineBase.ts`) with O(1) lazy `Map` lookup helpers (`GLAccountByID`, `CompanyProfileByID`, `CurrencyByCode`, `DimensionByID`, `FinanceExceptionTypeByCode`, `AccountingEngineExtensionByCode`, `TaxAuthorityByCode`, `TaxJurisdictionByCode`, `TaxRatesForJurisdiction`, `CompanyTaxNexusForCompany`).
   - Consume cached metadata via `await AccountingEngineBase.Instance.Config(false, user, provider)` + synchronous reads — never per-page `RunView`s.
   - Preserve `BaseEngine.prototype.AdditionalLoading` so immediate-mutation cache updates stay active.
2. **Multi-Provider & Impersonation Safety**
   - Override `ProviderToUse` (`this._activeProvider ?? Metadata.Provider`) and record the active provider on `Config(...)`.
   - On client (`ProviderType.Network`) providers, detect user changes (`_loadedForUserId !== nextUserId`) or `InvalidateCache()` and force a reload; expose `IsConfiguredForUser(userId)`.
   - On server (`ProviderType.Database`) providers, **do not** force reloads when `contextUser` varies per request (shared multi-user reference metadata).
   - Use `CacheLocal: true` ONLY on global non-RLS entities (`CacheLocal: false` on any RLS-filtered entity).
   - Preserve `GetConfigData(...)` (`PermissionConstrainedError`) on getters and gate optional ad-hoc `RunView`s on `EntityInfo.GetUserPermisions(user)?.CanRead`.
3. **Mandatory `rv.RunViews([...])` Single-Request Batching**
   - Collapse `Promise.all([rv.RunView(...), ...])` and independent sequential `await rv.RunView(...)` calls into a single `rv.RunViews([...], contextUser)` call.
   - Always create `RunView` with `RunView.FromMetadataProvider(this.ProviderToUse)` (never bare `new RunView()` when a provider is in scope).
   - Use `ResultType: 'simple'` with narrow `Fields` whenever entity mutation is not needed; never run `RunView` inside loops.
4. **`ConversationEngine`-Style Bounded Container Caching Only**
   - Never globally cache unbounded transactional tables (`Journal Entries`, `Journal Entry Batches`, `Journal Entry Lines`, `Journal Entry Line Dimensions`, `Finance Exceptions`, `Tax Liabilities`, `Currency Spot Rates`, sequence tables) or arbitrary `ExtraFilter` SQL views.
5. **RLS-Safe Two-Step Entity Reads**
   - Never embed raw SQL subqueries against RLS-filtered `vw*` base views inside `ExtraFilter`. Resolve IDs first via `AccountingEngineBase` or an entity `RunView`, then query the target entity with `FK IN (...)`.
