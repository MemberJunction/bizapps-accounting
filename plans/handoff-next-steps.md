# BizApps Accounting — Developer Handoff & Next Steps

> **Status:** Bootstrapping complete; ready for feature build-out.
> **Audience:** The two developers taking over implementation.
> **Companion docs:** [`bizapps-accounting-master.md`](./bizapps-accounting-master.md) (full design + `BA-D*` decisions), [`../workflows-and-agents.plan.md`](../workflows-and-agents.plan.md) (W1–W9 hooks, S1–S7 scheduled actions, agents, phasing), [`../CLAUDE.md`](../CLAUDE.md) (repo rules).

This doc is the bridge from "the app is scaffolded and runs locally" to "build the AR subledger features." Read §1–§2 to get oriented and running, then start at §3.

---

## 1. Where things stand (what's landed)

A working local dev environment and the core schema foundations are in `main` (PRs #3 → #4).

**Platform / deps**
- **SQL Server** is the dev dialect (DB `bizapps_accounting`, local). PostgreSQL is a release-time conversion, not maintained day-to-day (revised **BA-D2**).
- Targets **MemberJunction 5.38.0** across all manifests.
- Depends on **bizapps-common** (consumed from published npm `5.30.1`, installed as an MJ Open App). Provides `Organization` (used by tax profiles).

**Schema** — 26 entities in `__mj_BizAppsAccounting`, all named `MJ_BizApps_Accounting: <Name>`:
- Core JE primitives: `JournalEntry`, `JournalEntryLine`, `JournalEntryBatch` (+ `JournalEntrySequence`, `JournalEntryBatchSequence`).
- `GLAccount`, `AccountingPeriod`, `AccountingCompanyProfile` (**IS-A child of `MJ: Companies`** — shares the Company PK; saving cascades to the Company row).
- `Currency` (**owned here**, revised **BA-D11** — common never shipped it) + `CurrencySpotRate` (spot FX, follow-on FX feature).
- `JournalEntryLink` — polymorphic `EntityID` + `RecordID NVARCHAR(400)` link from a JE to **any** record; this is how BizAppsOrders (the future source of invoices/payments) records order/payment lineage onto JEs without hard FKs.
- Dimensions (`Dimension`, `DimensionValue`, `JournalEntryLineDimension`), tax suite (`TaxAuthority/Jurisdiction/Rate/Liability/Remittance`, `CustomerTaxProfile`), `ChartOfAccountsMapping`, balance materialization (`AccountBalance`, `AccountBalanceByDimension`).
- **Rev-rec waterfall** (revised 2026-06, BA-D18/BA-D25): `ScheduledJournalEntry` (+ `ScheduledJournalEntryLineItem` + `ScheduledJournalEntryLineDimension`) — replaces the dropped `Recurring*` trio. Plus **batch summary lines** `JournalEntryBatchLineItem` (+ `JournalEntryBatchLineDimension`, account × dimension — BA-D26).
- DB-level invariants enforced by **14 triggers** (balanced-JE-on-lock, post-batch immutability, batch-summary reconciliation, batch-line + batch-dimension immutability, scheduled-JE + scheduled-line immutability-once-generated, period-close, ACP no-chains, period no-overlap, reversal consistency) + **2 atomic numbering sprocs**.

**Server-side hooks** (`packages/CoreEntitiesServer/`) — **implemented but NOT yet behaviorally tested** (see §3):
- **W1** `AccountingCompanyProfileEntityServer.Save()` — on first save, seeds the 23-account default COA and 17 current-FY periods (12 month + 4 qtr + 1 year), and wires the profile's default GL-account refs — all via `BaseEntity.Save()` so Record Changes audits each row. (The recurring-template seed was removed — BA-D18 revision.)
- **W2/W3** — `JournalEntry` / `JournalEntryBatch` numbering via the atomic sprocs.

**Migration** — `migrations/B202605281200__v0.1.0__Schema_and_Tables.sql` is **self-contained**: hand-authored schema, then (below a big banner) the full verbatim `mj codegen` output (entity/field metadata, `vw*` views, CRUD sprocs, AI-generated validators + descriptions). A single `mj migrate` reproduces the complete DB state.

---

## 2. Get running locally

Prereqs: a local SQL Server, the repo `.env` (DB creds + auth + AI keys — ask the team; it is git-ignored), and the global MJ CLI: `npm install -g @memberjunction/cli`.

From the repo root, in order:
```bash
mj migrate -t v5.38.0                                   # 1. MJ core (__mj) into the DB (reads .env)
mj app install https://github.com/MemberJunction/bizapps-common \
    --dangerously-ignore-dbl-underscore-schema-rule     # 2. bizapps-common (__mj_BizAppsCommon)
mj migrate --schema __mj_BizAppsAccounting --dir migrations   # 3. this app's baseline
mj codegen                                              # 4. entities/resolvers/forms (+ DB objects)
mj sync push --dir metadata                             # 5. seed Currency rows (see gotcha below)
npm run build                                           # 6. build all 7 packages
npm start                                               # 7. API :4102 + Explorer :4302
```
Browser: **http://localhost:4302/**. GraphQL API: **http://localhost:4102/** (401 unauth = healthy).

**Gotchas (these will bite you — see §5 for detail):**
- `mj.config.cjs` `entityPackageName` must stay a **string**, not the map `mj app install` writes.
- `mj sync push` currently fails on the `schema-info` folder — temporarily move `metadata/schema-info/.mj-sync.json` aside, push, restore.
- A valid **Gemini key** in `.env` enables codegen's AI features; it degrades gracefully without one.

---

## 3. ▶ START HERE — validate the W1/W2/W3 hooks fire

We fixed a latent bug where the server hooks' `@RegisterClass` keys didn't match the real entity names (so they never registered), but **we never tested that they actually fire**. Prove the foundation works before building on it.

**Task:** Create a `Company` (in `__mj`) and an `AccountingCompanyProfile` (same UUID) and confirm the lifecycle behavior. Do it via a small script using `Metadata.GetEntityObject` (server context, pass `contextUser`), or through the Explorer UI.

**Acceptance criteria:**
- Saving a new `AccountingCompanyProfile` seeds **23 `GLAccount`** rows and **17 `AccountingPeriod`** rows for that company, and populates the profile's `AROpenGLAccountID` / `DeferredRevenueGLAccountID` / `SalesTaxPayableGLAccountID` / `RealizedFXGainLossGLAccountID` / `UnrealizedFXGainLossGLAccountID`. (The recurring-template seed was removed — BA-D18 revision; rev-rec is now `ScheduledJournalEntry`.)
- The IS-A cascade works: the Company row and Profile row persist together; reading the profile exposes Company fields (`Name`, `Description`, …) as virtual fields.
- A new balanced `JournalEntry` gets a gap-free `EntryNumber` (`JE-<CompanyCode>-<FY>-<seq>`); a `JournalEntryBatch` gets its `BatchNumber`.
- `__mj.RecordChange` rows exist for the seeded records (audit-by-construction).

If any of this doesn't fire, check that the entity name in the `@RegisterClass` decorator exactly matches the row in `__mj.Entity` (`MJ_BizApps_Accounting: <Name>`).

---

## 4. Build-out roadmap

Follow the phasing in [`bizapps-accounting-master.md` §13](./bizapps-accounting-master.md) and the hook/agent catalog in [`workflows-and-agents.plan.md`](../workflows-and-agents.plan.md). Suggested order:

1. **W4–W9 JE lifecycle hooks** (the heart of the subledger), in `packages/CoreEntitiesServer/`:
   - W4 adjusting-entry routing (post to next open period when target period is Closed, set `OriginalAccountingPeriodID`)
   - W5 realized FX gain/loss auto-emit on payment-vs-booking rate mismatch
   - W6 reversal generation (`GenerateReversal(reason)` → new Pending JE, debits/credits swapped, back-references)
   - W7 period-close orchestration (prerequisite checks → materialize balances → `Closed`) and W8 reopen (role + reason + audit)
   - W9 JE attachment validation
2. **`AccountingService` façade** — the public TypeScript API downstream apps call: `postJournalEntry(s)`, `getAccountBalance`, `getPeriodStatus`, `getMappedGLAccount`, `reverseJournalEntry`, `createScheduledJournalEntries` (persist an upstream-computed rev-rec waterfall — BA-D25). This is the integration contract for **BizAppsOrders** (the orders system that will be built on top — it is the source of invoices/payments and will use `JournalEntryLink` for lineage). Define it early even if some methods are thin.
3. **Scheduled Actions** S1 (batch dispatch) / S2 (ERP ack poller) / S3 (scheduled-JE materializer — turns due `ScheduledJournalEntry` rows into Pending JEs at period close) / S4 (FX mark-to-market action — BA-D27), then the rest.
4. **Read-model views** (`vw_TrialBalance_AR`, `vw_AROpenByCustomer`, `vw_ARAging`, `vw_DefRevRollforward`, …) for reporting.
5. **Agents** (A1–A9, F1–F8) once the data layer + service are solid — start with F1 (Routine JE Validator) and A2 (COA Mapping Suggester).

Per-feature loop: edit `packages/CoreEntitiesServer/` (or wherever) → `npm run build` in that package → test. For schema changes: add a **new** migration (never edit the published baseline), run `mj migrate` + `mj codegen`, then fold the fresh codegen SQL into that new migration.

---

## 5. Known issues / gotchas (read before you build)

- **`entityPackageName` must be a string.** `mj.config.cjs` keeps it as `'@mj-biz-apps/accounting-entities'` and excludes `__mj_BizAppsCommon` from codegen (this repo generates its own entities and consumes common from npm). `mj app install`/`upgrade` re-writes it into a schema→package **map**, which makes codegen treat our own schema as "external" and emit an **empty** entity file. **Re-assert the string after any `mj app` command.**
- **`schema-info` metadata sync is broken.** `metadata/schema-info/.schema-info.json` has a hardcoded ID that drifts from the codegen-created `__mj.SchemaInfo` row → unique-key violation on push. Workaround: move its `.mj-sync.json` aside during `mj sync push`. **Proper fix (do this):** push schema-info *before* the first codegen so it creates the row with the file's ID, or align the file's ID to the row. The entity-name prefix does **not** depend on it (it comes from the config rule below).
- **Entity-name prefix** `MJ_BizApps_Accounting: ` comes from `mj.config.cjs` `newEntityDefaults.NameRulesBySchema` (matches the bizapps-common family convention). It's applied only at entity **creation**, so changing it requires recreating entities (a clean codegen on a fresh schema). There is intentionally **no `EntityNames.ts`** — entity-name strings are inlined in the server subclasses and must match the generated `@RegisterClass` names exactly.
- **Gemini key.** Codegen's AI passes (field validators, descriptions, form layouts) need a valid `AI_VENDOR_API_KEY__GeminiLLM`; without it codegen still succeeds but skips those enhancements.
- **Migrations are immutable once published.** New schema work = a **new** migration + fresh codegen folded into it. Never edit `B202605281200…`.
- **Branching:** feature branch → PR → **`main`**. (The `next → main` flow described in `CLAUDE.md`'s "Branching Model" is **not** in use — that section is stale and should be updated.)

---

## 6. Map of key files

| Path | What |
|---|---|
| `plans/bizapps-accounting-master.md` | Full design, entity model, `BA-D1..BA-D24` decisions, §13 phasing, scope boundaries |
| `workflows-and-agents.plan.md` | W1–W9 hooks, S1–S7 scheduled actions, A/F agents, implementation status table |
| `migrations/B202605281200__v0.1.0__Schema_and_Tables.sql` | Baseline: hand-schema + (below banner) folded codegen output |
| `packages/CoreEntitiesServer/src/` | Server-side `BaseEntity` subclasses (W1/W2/W3 done; W4–W9 go here) |
| `packages/Entities/`, `packages/Server/`, `packages/Angular/` | CodeGen-generated entities / resolvers / forms (don't hand-edit `generated/`) |
| `mj.config.cjs` | CodeGen + Open-App config (see gotchas) |
| `codegen-schema-info.json` | `additionalSchemaInfo` — declares the ACP IS-A Company relationship |
| `metadata/currencies/` | Currency seed data (synced via `mj sync push`) |

---

## 7. Conventions (from `CLAUDE.md`)

- TypeScript strict, **no `any`**, functional decomposition (~30–40 line functions).
- **Audit by construction:** ledger mutations go through a `BaseEntity.Save()` so Record Changes captures them — no bare `INSERT` from app code.
- DB-level for invariants (the triggers/sprocs), `BaseEntity` for orchestration.
- **Soft refs** to downstream apps — no hard FKs into BizAppsOrders/Contracts; use `JournalEntryLink` for lineage (polymorphic `EntityID` + `RecordID`).
- Server-side data access always passes `contextUser`; use `RunViews` (plural) for batched reads; `RunView` returns `Success` (it doesn't throw).
</content>
