# BizApps Accounting — Workflows & Agents Plan

> **Status**: Design / partially implemented
> **Companion docs**: `plans/bizapps-accounting-master.md` (entity model + decisions)
> **Repo**: `MemberJunction/bizapps-accounting`
>
> **⚠️ Written before 2026-07-06 — parts of it are void.** This plan predates the engine-meeting
> rulings that removed `AccountingPeriod`, `AccountBalance` / `AccountBalanceByDimension`,
> `ChartOfAccountsMapping` and the `Recurring*` template trio from the schema. Every workflow,
> agent and API below that binds one of them is **struck through and marked Void**, with the reason
> in [§8](#8-what-the-2026-07-06-removals-voided). The rest of the plan stands. See
> `plans/bizapps-accounting-master.md` §4 (no periods), §5.9 (deliberately absent), and D13 / D15 /
> D20; the removal is recorded in the baseline migration's own revision note.

This plan enumerates every workflow and AI agent surface in the accounting app, classifies them by autonomy level, and maps each to MemberJunction infrastructure (BaseEntity subclasses, Scheduled Actions, MCP tools, `BaseAgent` Flow / Loop). It is the source-of-truth for what's "built in" vs "AI does it."

---

## 0. Table of contents

1. [Design principles](#1-design-principles)
2. [Built-in workflows (deterministic, no AI)](#2-built-in-workflows-deterministic-no-ai)
3. [Semi-autonomous agents (AI proposes, human approves)](#3-semi-autonomous-agents-ai-proposes-human-approves)
4. [Fully autonomous agents (act, with safeguards)](#4-fully-autonomous-agents-act-with-safeguards)
5. [Infrastructure mapping](#5-infrastructure-mapping)
6. [Phasing](#6-phasing)
7. [Implementation status](#7-implementation-status)
8. [What the 2026-07-06 removals voided](#8-what-the-2026-07-06-removals-voided)

---

## 1. Design principles

**P1. Audit by construction.** Anything that mutates ledger state must go through a BaseEntity subclass `.Save()` so MJ's Record Changes table captures the before/after. **No bare T-SQL `INSERT` from app code** — even seed data is created via `Metadata.GetEntityObject` + `.Save()`.

**P2. DB-level for invariants, BaseEntity for orchestration.** The 9 triggers and 2 numbering sprocs from the baseline migration stay at DB level — they enforce integrity that no caller (including SA) can bypass. Everything else (seeding, reversal, batching orchestration) moves to TypeScript so it's testable, debuggable, and audited.

**P3. `Pending → Batched → GLPosted` is the authorization boundary.** Agents may freely create and edit `Pending` JEs; humans control the flip to `Batched`. The triggers enforce immutability regardless of who edits — so we can give agents broad write access on Pending without risk to historical entries.

**P4. `RequiresApproval` is the autonomy toggle.** The same workflow can be fully-auto for one Company and human-in-loop for another. Same TaxCalculationProvider can be Avalara-with-review for production and Local-no-review for sandbox. Deployments choose per Company × Workflow.

**P5. Agents emit, they don't decide.** Agents draft JEs, flag anomalies, suggest mappings. Acceptance and lock (transition to Batched) is the human's decision unless an explicit fully-autonomous policy is configured.

**P6. Soft-ref policy enforced.** Agents in this repo MUST NOT introduce hard FKs to downstream apps (BizAppsOrders, etc.). `JournalEntry.OrderID` and friends stay as polymorphic UUIDs that Accounting blindly stores.

---

## 2. Built-in workflows (deterministic, no AI)

These are the "boring infrastructure" pieces every accounting team does manually today. Each is a server-side BaseEntity subclass or a Scheduled Action. No LLM in the path.

### 2.1 Per-entity lifecycle hooks

| # | Hook | Entity | Trigger | Mechanism |
|---|---|---|---|---|
| W1 | **Profile init** | `AccountingCompanyProfile` | First `Save()` (isNew) | `AccountingCompanyProfileEntityServer.Save()` calls helper methods that seed default COA (23 GLAccount rows), then wire the company's default accounts. ~~generate current-FY periods (17 rows)~~ and ~~seed the 4 standard recurring JE templates~~ are **Void (§8)**, and defaults are company-level `GLAccountLink` rows rather than columns on the profile (D12). **All via BaseEntity** → Record Changes captures every create. |
| W2 | **JE numbering** | `JournalEntry` | Pre-`Save()` when `isNew && !EntryNumber` | `JournalEntryEntityServer.Save()` invokes `spAssignNextJournalEntryNumber` (atomic counter) via the data provider, sets `EntryNumber` on the entity before `super.Save()`. |
| W3 | **Batch numbering** | `JournalEntryBatch` | Pre-`Save()` when `isNew && !BatchNumber` | `JournalEntryBatchEntityServer.Save()` invokes `spAssignNextBatchNumber`, sets `BatchNumber` before save. |
| ~~W4~~ | ~~**Adjusting-entry routing**~~ | ~~`JournalEntry`~~ | ~~Pre-`Save()` when target `AccountingPeriod.Status='Closed'`~~ | **Void — no periods, no close guard (§8).** A closed-period collision surfaces as the ERP rejecting the batch; it is held and flagged for review (plan §4), never auto-rolled into an adjusting period. |
| W5 | **Realized FX gain/loss** | `JournalEntry` (EntryType='PaymentReceipt') | Pre-`Save()` when payment-currency rate ≠ AR booking rate | Auto-adds an FX-gain/loss JEL line so the JE balances. Posts to `AccountingCompanyProfile.RealizedFXGainLossGLAccountID`. |
| W6 | **Reversal generation** | `JournalEntry` | `JournalEntryEntityServer.GenerateReversal(reason)` | Creates a new Pending JE with debits/credits swapped, `EntryType='Reversal'`, `ReversesJournalEntryID=this.ID`, and back-references this.`ReversedByJournalEntryID` on save of the reverser. |
| ~~W7~~ | ~~**Period close orchestration**~~ | ~~`AccountingPeriod`~~ | ~~`Save()` on `Open → Closing`~~ | **Void — the ERP owns close (§8).** No `AccountingPeriod` entity to hook, and no `AccountBalance` to materialize (D20: the views compute on demand). |
| ~~W8~~ | ~~**Period reopen**~~ | ~~`AccountingPeriod`~~ | ~~`Save()` on `Closed → Reopened`~~ | **Void — same as W7 (§8).** |
| W9 | **JE attachment validation** | `JournalEntry` | Pre-`Save()` when `FileID` set | Verifies the linked `__mj.File` row exists and isn't deleted. |

### 2.2 Scheduled Actions (cron-driven)

| # | Workflow | Cadence | Owns | Notes |
|---|---|---|---|---|
| S1 | **Batch dispatch** | Daily (default; configurable per Company × TargetSystem) | Selects Pending JEs by (Company, Period, TargetSystem) → creates `JournalEntryBatch` row → server-side hook flips child JEs to Batched | Per BA-D16 (batching is the lock event) |
| S2 | **ERP acknowledgment poller** | Every 5 min | Watches the integration framework's response queue, marks Batch.Status='Acknowledged', flips child JEs to GLPosted with GLReferenceID | Optional — ERP connector may use webhooks instead |
| ~~S3~~ | ~~**Recurring JE emitter**~~ | ~~Every 15 min (sweeper)~~ | ~~Scans `RecurringJournalEntry` … instantiates lines from template~~ | **Void — superseded by D15 (§8).** Rev-rec and other scheduled recognition are **real forward-dated JEs** written at origination, not templates emitted by a sweeper. Nothing to scan. |
| S4 | **Currency rate refresh** | Weekly (default, opt-in) | Calls `CurrencyExchangeRateProvider.fetchRates()`, upserts rows in `__mj_BizAppsCommon.CurrencyExchangeRate` | BA-D11; auto-fetch off by default per the plan |
| S5 | **Tax rate sync** | Monthly (when Avalara/TaxJar configured) | Calls `TaxCalculationProvider.syncRates()`, upserts `TaxRate` rows with `Source='Avalara' \| 'TaxJar'` | BA-D19 |
| S6 | **FX revaluation runner** | ~~Period-close hook~~ → **needs a new trigger** | Reads open foreign-currency balances → looks up spot rate → emits revaluation JE + auto-reversing JE dated the following month | Intent stands (plan §6.4), mechanism does not: there is no period close to hook and no `RecurringJournalEntryTemplate` to seed it from (§8). Retrigger on a date cadence. |
| S7 | **Sales tax snapshot** | Monthly, on a **date** cadence | Rolls forward open `TaxLiability` balances per (Company × Authority × Jurisdiction × **date window**) | Intent stands; the `× Period` key and the "seeded as a recurring template" mechanism are void (§8). Accounting keeps the accrual only — remittance is an ERP/GL concern. |

### 2.3 Service-layer functions (called by upstream apps)

The `AccountingService` TypeScript class in `@mj-biz-apps/accounting-server` is the public-facing API for downstream apps (BizAppsOrders, etc.) to invoke. Each method goes through BaseEntity, so audit is automatic.

```typescript
class AccountingService {
  postJournalEntry(draft: JournalEntryDraft, ctx: UserInfo): Promise<JournalEntry>;
  postJournalEntries(drafts: JournalEntryDraft[], ctx: UserInfo): Promise<JournalEntry[]>; // bulk
  getAccountBalance(companyId: string, glAccountId: string, asOfDate: Date, ctx: UserInfo): Promise<Money>;
  // getPeriodStatus(...)  -- VOID (§8): no AccountingPeriod entity; the ERP owns period state.
  // scheduleRecurring(...) -- VOID (§8): D15 replaced templates with forward-dated real JEs.
  // getMappedGLAccount now resolves against GLAccount.ExternalSystem / .ExternalAccountID
  // rather than a ChartOfAccountsMapping row (D13, §8).
  getMappedGLAccount(companyId: string, externalSystem: string, externalAccountId: string, ctx: UserInfo): Promise<GLAccount>;
  reverseJournalEntry(originalJeId: string, reason: string, ctx: UserInfo): Promise<JournalEntry>;
}
```

> `getAccountBalance` survives the `AccountBalance` removal: D20 keeps the *question* and drops the
> materialized table — it computes on demand from JE lines.

---

## 3. Semi-autonomous agents (AI proposes, human approves)

Built on MJ's `BaseAgent` (Flow or Loop type). Each agent has a system prompt template, an MCP tool surface for taking action, and an approval gate before any ledger-state mutation reaches `Batched`.

| # | Agent | Type | Tool surface | Approval gate | Why human-in-loop |
|---|---|---|---|---|---|
| A1 | **Close Copilot** *(rescope: the close happens in the ERP, §8)* | Loop | `vw_TrialBalance_AR`, `vw_DefRevRollforward`, `vw_FxExposure`, `vw_JEAuditTrail` queries; ability to create Pending adjusting JEs and dunning-style annotations | Drafts adjusting JEs as Pending; human transitions to Batched | Adjusting entries hit the books; CFO must approve |
| A2 | **COA Mapping Suggester** | Flow | Read `vw_GLDetail_Subledger`, similarity search over `GLAccount` rows; ~~create `ChartOfAccountsMapping` rows~~ → **propose `GLAccount.ExternalSystem` / `.ExternalAccountID` values** (D13, §8) | Proposals un-approved until an admin accepts | Plan §4.6 / M16+D27 require explicit admin approval |
| A3 | **Manual JE Reviewer** | Flow | Loads the proposed JE + JEL rows; drafts `Description`, suggests GL accounts based on counterparty history, flags policy violations (round numbers, off-hours posting, unusually large amounts) | Annotates draft; CFO approval before Batched | Manual JEs already require CFO approval (plan §14 Q10) |
| ~~A4~~ | ~~**Recurring Template Inducer**~~ | ~~Loop~~ | ~~offers to convert to `RecurringJournalEntryTemplate` + schedule~~ | **Void — D15 (§8).** | ~~Template creation changes future emit behavior~~ |
| A5 | **Tax Classification Advisor** | Flow | Reads `CustomerTaxProfile`, related sales history, product description; proposes `TaxCategory` + nexus check | Tax-config writes require Finance.Admin role | Tax decisions carry legal liability |
| A6 | **AR-to-GL Recon Resolver** | Loop | Queries `vw_ARtoGLRecon`, traces JE lines through `vw_JEAuditTrail`, identifies the breaking entry, proposes corrective JE | Corrective JE drafted as Pending; human approves to Batched | Corrective JEs are ordinary dated JEs — there is no adjusting period (§8) |
| A7 | **Reversal Composer** | Flow | Given a `ReversesJournalEntryID`, drafts the reversal narrative, dimension tags, cross-references | Reversal as Pending; human approves to Batched | Dispute-driven reversals are high-visibility |
| A8 | **Audit Pack Assembler** | Flow | Gathers JE samples, supporting `__mj.File` attachments, close attestations from `__mj.AuditLog`, balances computed from JE lines (no materialized table, D20/§8) | Read-only output (PDF/zip artifact) | Auditor delivery is high-stakes; human reviews before sending |
| A9 | **AR Collections Agent** | Loop | Queries `vw_AROpenByCustomer` + `vw_ARAging`, drafts dunning emails via Communication framework, schedules escalation | Drafts to outbox; human sends or fully-autonomous via opt-in policy per Customer | Collections emails are customer-facing; some accounts need white-glove |

---

## 4. Fully autonomous agents (act, with safeguards)

Where the cost of a wrong call is small or the safeguard is a downstream human review step.

| # | Agent | Type | Acts on | Safeguard |
|---|---|---|---|---|
| F1 | **Routine JE Validator** | Flow | Every `postJournalEntry()` from upstream apps | Just runs validators (balance, GL exists, dimensions valid — **no period-open check, §8**); rejects → upstream app sees error |
| F2 | **Anomaly Watcher** | Loop | Streaming over Pending JEs | Posts findings to Slack/Teams + writes to audit log; never blocks posts |
| F3 | **Stale Pending Sweeper** | Flow | Pending JEs older than N days (default 7) | Notifies the originating system / channel; doesn't auto-batch stale ones |
| F4 | **FX Rate Freshness Monitor** | Flow | `CurrencyExchangeRate` table | Re-fetches if rates older than tolerance window (default 24h) before they're used in a posting |
| F5 | **Unmapped GL Detector** | Loop | External GL accounts that appear in batch errors | Opens an MJ approval task (COA Mapping Suggester takes over with a draft) — never auto-maps |
| F6 | **Dimension Hygiene Bot** | Loop | JE lines missing dimension tags that "should" have them based on similar past JEs | Adds a "suggested dimensions" annotation visible in MJ Explorer; doesn't mutate the JE |
| F7 | **Close Pre-Flight** *(rescope, §8)* | Loop | Runs subledger-readiness checks ahead of the **ERP's** close date — unbatched JEs, failed batches, stranded entries | Surfaces blockers via notifications; no mutations |
| ~~F8~~ | ~~**Recurring Emitter Watchdog**~~ | ~~Loop~~ | ~~All active `RecurringJournalEntry` schedules~~ | **Void — D15 (§8).** The forward-dated-JE model has nothing to emit late. |

---

## 5. Infrastructure mapping

| MJ infrastructure | Used by |
|---|---|
| **BaseEntity subclass + `Save()` hook** (this repo's `packages/CoreEntitiesServer/`) | W1–W9. Each lifecycle hook IS a `Save()` / `Delete()` override; Record Changes captures audit |
| **Stored proc (DB-level)** | W2 / W3 numbering (atomic counter via HOLDLOCK+UPDLOCK) — called from EntityServer, results stored on the entity which then logs to Record Changes |
| **Trigger (DB-level)** | All 9 triggers in baseline migration; enforces what BaseEntity cannot (audit guarantee even against SA) |
| **Scheduled Action** | S1–S7. MJ's scheduled-action framework picks them up from metadata |
| **`AccountingService` (TypeScript)** | Façade over EntityServer subclasses; consumed by upstream apps (BizAppsOrders future) |
| **`BaseAgent` Flow** | A2, A3, A5, A7, A8 (single-turn structured agents) |
| **`BaseAgent` Loop** | A1, A4, A6, A9 + F2, F5, F6, F7, F8 (iterative agents with tool-use) |
| **MCP server (this repo)** | Exposes `vw_*` views and `AccountingService` methods as MCP tools so external agents (Claude, Skip) can use them |
| **`__mj.AuditLog`** | W8 reopen reason; agents writing notes |
| **`__mj.RecordChange`** | Automatically captured by every BaseEntity `Save()`; covers all of section 2.1 |
| **`__mj.File`** | JE attachments (W9, A8) |
| **`__mj.ApprovalRequest`** | Approval gates for A1–A9; admin Review UI in MJ Explorer |
| **MJ Communication framework** | A9 dunning emails; F2 Slack/Teams notifications |
| **`RegisterClass` / `ClassFactory`** | `TaxCalculationProvider`, `CurrencyExchangeRateProvider`, custom EntityServer subclasses per deployment |

---

## 6. Phasing

Tied to the master plan's Phases A–G (`plans/bizapps-accounting-master.md` §13). Workflows ship alongside the entities they operate on; agents come after the data layer.

| Phase | Workflows | Agents |
|---|---|---|
| **A** (Foundation) | W1 (Profile init via `AccountingCompanyProfileEntityServer`) | — |
| **B** (JE primitives) | W2, W3, W4, W5, W6, S1, S2 | F1 (Routine JE Validator) |
| **C** (Dimensions + COA mapping) | — | A2 (COA Mapping Suggester), F5 (Unmapped GL Detector), F6 (Dimension Hygiene) |
| **D** (Tax) | S5 | A5 (Tax Classification Advisor) |
| **E** (~~Recurring + balance materialization~~ → **scheduled recognition**, §8) | ~~W7, W8, S3~~ (void), S6, S7 | ~~A4~~, ~~F8~~ (void), F4 (FX Freshness), F7 (Close Pre-Flight) |
| **F** (Reports + read-models) | — | A1 (Period Close Copilot), A6 (Recon Resolver), A8 (Audit Pack), F2 (Anomaly Watcher), F3 (Stale Pending Sweeper) |
| **G** (Orders integration) | `AccountingService` public API | A3 (Manual JE Reviewer), A7 (Reversal Composer), A9 (AR Collections) |

---

## 7. Implementation status

| Item | Status | Notes |
|---|---|---|
| Baseline schema migration | ✅ Landed | `migrations/B202605281200__v0.1.0__Schema_and_Tables.sql` |
| DB-level numbering sprocs | ✅ Landed | `spAssignNextJournalEntryNumber`, `spAssignNextBatchNumber` |
| W1 — Profile init via EntityServer | 🚧 In flight | This PR; replaces removed `spSeedDefaultChartOfAccounts` / `spGenerateAccountingPeriods` / `spSeedDefaultRecurringJournalEntryTemplates` / `spInitializeAccountingCompanyProfile` |
| W2 — JE numbering via EntityServer | 🚧 In flight | This PR; calls atomic sproc but routes through BaseEntity for audit |
| W3 — Batch numbering via EntityServer | 🚧 In flight | This PR |
| W5, W6, W9 | ⏳ Planned | Phase B |
| ~~W4, W7, W8~~ | ❌ Void | Removed with the period tables 2026-07-06 (§8) |
| Scheduled Actions S1, S2, S4–S7 | ⏳ Planned | Phase B–E |
| ~~S3~~ | ❌ Void | Superseded by D15's forward-dated JEs (§8) |
| `AccountingService` façade | ⏳ Planned | Phase G |
| Agents A1–A9, F1–F8 | ⏳ Planned | Phase B onward, agent-by-agent per phase table |

---

## 8. What the 2026-07-06 removals voided

This plan was authored in one commit (`1d412b4`) against the pre-rewrite schema. The engine-meeting
rulings of 2026-07-06 and the decisions that followed removed four groups of entities it binds. The
baseline migration's own revision note is explicit:

> `* REMOVED: AccountingPeriod, AccountBalance, AccountBalanceByDimension`
> `  (+ every period FK/trigger; the ERP owns periods + balances).`

| Removed | Ruling | What it voids here |
|---|---|---|
| `AccountingPeriod` + period FKs + close machinery | **D2**, plan §4 | W4, W7, W8; `getPeriodStatus`; the period-open validator in F1; the trigger for S6; the `× Period` key in S7; rescopes A1 and F7 |
| `AccountBalance` / `AccountBalanceByDimension` | **D20** — the views compute on demand | W7's materialization step; A8's "materialized balances". `getAccountBalance` survives: the question stands, the table does not |
| `ChartOfAccountsMapping` | **D13** — ERP identity lives on `GLAccount` (`ExternalSystem` + `ExternalAccountID`) | A2's output shape; `getMappedGLAccount`'s resolution path |
| `Recurring*` template trio | **D15** — rev-rec is real forward-dated JEs | S3, A4, F8; W1's template seeding; S6/S7's "seeded as a template" mechanism |

Two things worth separating, because they are not the same kind of void:

- **Mechanically void** — the entity it hooks does not exist, so there is nothing to build (W4, W7,
  W8, S3, A4, F8). These are struck through.
- **Intent survives, mechanism does not** (S6, S7, A1, A2, A6, A8, F1, F7). FX revaluation is still
  wanted; it just cannot hang off a period-close hook. A close copilot is still useful; it advises
  on a close that happens in the ERP. These are annotated in place rather than struck.

**Period-boundary discipline is the accountant's, aided by the UI** (plan §4): batch windows
shouldn't straddle a boundary that matters, and the batch presets plus the displayed swept date
range are the guardrails — not engine machinery. A closed-period collision is detected by the ERP
rejecting the batch and is **held and flagged**, never auto-rolled. Any future timing rule detects
by **DATE, never a period FK**.

`plans/mj-entity-action-workflow-adoption.md` §3a marks the equivalent Entity Action bindings void
for the same reason; this section is its counterpart for the workflow/agent surface.

---

*Workflows are the floor; agents are the ceiling. Together they're the difference between "subledger that records what happened" and "subledger that actively helps the close."*
