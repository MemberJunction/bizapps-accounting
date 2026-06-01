# BizApps Accounting — Workflows & Agents Plan

> **Status**: Design / partially implemented
> **Companion docs**: `plans/bizapps-accounting-master.md` (entity model + decisions)
> **Repo**: `MemberJunction/bizapps-accounting`

This plan enumerates every workflow and AI agent surface in the accounting app, classifies them by autonomy level, and maps each to MemberJunction infrastructure (BaseEntity subclasses, Scheduled Actions, MCP tools, `BaseAgent` Flow / Loop). It is the source-of-truth for what's "built in" vs "AI does it."

---

## 0. Table of contents

1. [Design principles](#1-design-principles)
2. [Built-in workflows (deterministic, no AI)](#2-built-in-workflows-deterministic-no-ai)
3. [Semi-autonomous agents (AI proposes, human approves)](#3-semi-autonomous-agents-ai-proposes-human-approves)
4. [Fully autonomous agents (act, with safeguards)](#4-fully-autonomous-agents-act-with-safeguards)
5. [Infrastructure mapping](#5-infrastructure-mapping)
6. [Phasing](#6-phasing)

---

## 1. Design principles

**P1. Audit by construction.** Anything that mutates ledger state must go through a BaseEntity subclass `.Save()` so MJ's Record Changes table captures the before/after. **No bare T-SQL `INSERT` from app code** — even seed data is created via `Metadata.GetEntityObject` + `.Save()`.

**P2. DB-level for invariants, BaseEntity for orchestration.** The 9 triggers and 2 numbering sprocs from the baseline migration stay at DB level — they enforce integrity that no caller (including SA) can bypass. Everything else (seeding, period close, reversal, recurring emission) moves to TypeScript so it's testable, debuggable, and audited.

**P3. `Pending → Batched → GLPosted` is the authorization boundary.** Agents may freely create and edit `Pending` JEs; humans control the flip to `Batched`. The triggers enforce immutability regardless of who edits — so we can give agents broad write access on Pending without risk to historical entries.

**P4. `RequiresApproval` is the autonomy toggle.** Same RecurringJournalEntry can be fully-auto for one Company and human-in-loop for another. Same TaxCalculationProvider can be Avalara-with-review for production and Local-no-review for sandbox. Deployments choose per Company × Workflow.

**P5. Agents emit, they don't decide.** Agents draft JEs, flag anomalies, suggest mappings. Acceptance and lock (transition to Batched) is the human's decision unless an explicit fully-autonomous policy is configured.

**P6. Soft-ref policy enforced.** Agents in this repo MUST NOT introduce hard FKs to downstream apps (BizAppsOrders, etc.). `JournalEntry.OrderID` and friends stay as polymorphic UUIDs that Accounting blindly stores.

---

## 2. Built-in workflows (deterministic, no AI)

These are the "boring infrastructure" pieces every accounting team does manually today. Each is a server-side BaseEntity subclass or a Scheduled Action. No LLM in the path.

### 2.1 Per-entity lifecycle hooks

| # | Hook | Entity | Trigger | Mechanism |
|---|---|---|---|---|
| W1 | **Profile init** | `AccountingCompanyProfile` | First `Save()` (isNew) | `AccountingCompanyProfileEntityServer.Save()` calls helper methods that seed default COA (23 GLAccount rows), generate current-FY periods (17 rows: 12 months + 4 quarters + 1 year), seed the 4 standard recurring JE templates, then wires the profile's default-account refs. **All via BaseEntity** → Record Changes captures every create. |
| W2 | **JE numbering** | `JournalEntry` | Pre-`Save()` when `isNew && !EntryNumber` | `JournalEntryEntityServer.Save()` invokes `spAssignNextJournalEntryNumber` (atomic counter) via the data provider, sets `EntryNumber` on the entity before `super.Save()`. |
| W3 | **Batch numbering** | `JournalEntryBatch` | Pre-`Save()` when `isNew && !BatchNumber` | `JournalEntryBatchEntityServer.Save()` invokes `spAssignNextBatchNumber`, sets `BatchNumber` before save. |
| W4 | **Adjusting-entry routing** | `JournalEntry` | Pre-`Save()` when target `AccountingPeriod.Status='Closed'` | If `OriginalAccountingPeriodID` not set: surfaces a `ValidationResult` requiring the caller to confirm the adjusting-entry pattern. Otherwise rewrites `AccountingPeriodID` to the next Open period and keeps `OriginalAccountingPeriodID`. |
| W5 | **Realized FX gain/loss** | `JournalEntry` (EntryType='PaymentReceipt') | Pre-`Save()` when payment-currency rate ≠ AR booking rate | Auto-adds an FX-gain/loss JEL line so the JE balances. Posts to `AccountingCompanyProfile.RealizedFXGainLossGLAccountID`. |
| W6 | **Reversal generation** | `JournalEntry` | `JournalEntryEntityServer.GenerateReversal(reason)` | Creates a new Pending JE with debits/credits swapped, `EntryType='Reversal'`, `ReversesJournalEntryID=this.ID`, and back-references this.`ReversedByJournalEntryID` on save of the reverser. |
| W7 | **Period close orchestration** | `AccountingPeriod` | `Save()` when `Status` transitions `Open → Closing` | `AccountingPeriodEntityServer.Save()` runs prerequisites: no Pending JEs, all Batches Acknowledged, TaxLiabilities resolved, recurring templates emitted. On success flips `Status → Closed`, materializes `AccountBalance` + `AccountBalanceByDimension`, emits a `PeriodClosed` MJ Action event. |
| W8 | **Period reopen** | `AccountingPeriod` | `Save()` when `Status` transitions `Closed → Reopened` | Requires `Finance.Admin` role check and non-empty `ReopenReason`. Writes a `__mj.AuditLog` entry. |
| W9 | **JE attachment validation** | `JournalEntry` | Pre-`Save()` when `FileID` set | Verifies the linked `__mj.File` row exists and isn't deleted. |

### 2.2 Scheduled Actions (cron-driven)

| # | Workflow | Cadence | Owns | Notes |
|---|---|---|---|---|
| S1 | **Batch dispatch** | Daily (default; configurable per Company × TargetSystem) | Selects Pending JEs by (Company, Period, TargetSystem) → creates `JournalEntryBatch` row → server-side hook flips child JEs to Batched | Per BA-D16 (batching is the lock event) |
| S2 | **ERP acknowledgment poller** | Every 5 min | Watches the integration framework's response queue, marks Batch.Status='Acknowledged', flips child JEs to GLPosted with GLReferenceID | Optional — ERP connector may use webhooks instead |
| S3 | **Recurring JE emitter** | Every 15 min (sweeper) | Scans `RecurringJournalEntry WHERE NextScheduledAt <= now AND IsActive=1`, instantiates lines from template, emits Pending JE, advances `NextScheduledAt`, updates `LastEmittedAt` | Per BA-D18; respects `RequiresApproval` flag |
| S4 | **Currency rate refresh** | Weekly (default, opt-in) | Calls `CurrencyExchangeRateProvider.fetchRates()`, upserts rows in `__mj_BizAppsCommon.CurrencyExchangeRate` | BA-D11; auto-fetch off by default per the plan |
| S5 | **Tax rate sync** | Monthly (when Avalara/TaxJar configured) | Calls `TaxCalculationProvider.syncRates()`, upserts `TaxRate` rows with `Source='Avalara' \| 'TaxJar'` | BA-D19 |
| S6 | **FX revaluation runner** | Period-close hook (not cron) | Reads open foreign-currency balances → looks up spot rate → emits revaluation JE in current period + auto-reversing JE dated next period | Per plan §6.4; seeded as a `RecurringJournalEntryTemplate` |
| S7 | **Sales tax snapshot** | Monthly (at period end) | Rolls forward open `TaxLiability` balances per (Company × Authority × Jurisdiction × Period) | Seeded as a recurring template |

### 2.3 Service-layer functions (called by upstream apps)

The `AccountingService` TypeScript class in `@mj-biz-apps/accounting-server` is the public-facing API for downstream apps (BizAppsOrders, etc.) to invoke. Each method goes through BaseEntity, so audit is automatic.

```typescript
class AccountingService {
  postJournalEntry(draft: JournalEntryDraft, ctx: UserInfo): Promise<JournalEntry>;
  postJournalEntries(drafts: JournalEntryDraft[], ctx: UserInfo): Promise<JournalEntry[]>; // bulk
  getAccountBalance(companyId: string, glAccountId: string, asOfDate: Date, ctx: UserInfo): Promise<Money>;
  getPeriodStatus(companyId: string, date: Date, ctx: UserInfo): Promise<AccountingPeriod>;
  getMappedGLAccount(companyId: string, externalSystem: string, externalAccountId: string, ctx: UserInfo): Promise<GLAccount>;
  reverseJournalEntry(originalJeId: string, reason: string, ctx: UserInfo): Promise<JournalEntry>;
  scheduleRecurring(templateId: string, cron: string, ctx: UserInfo): Promise<RecurringJournalEntry>;
}
```

---

## 3. Semi-autonomous agents (AI proposes, human approves)

Built on MJ's `BaseAgent` (Flow or Loop type). Each agent has a system prompt template, an MCP tool surface for taking action, and an approval gate before any ledger-state mutation reaches `Batched`.

| # | Agent | Type | Tool surface | Approval gate | Why human-in-loop |
|---|---|---|---|---|---|
| A1 | **Period Close Copilot** | Loop | `vw_TrialBalance_AR`, `vw_DefRevRollforward`, `vw_FxExposure`, `vw_JEAuditTrail` queries; ability to create Pending adjusting JEs and dunning-style annotations | Drafts adjusting JEs as Pending; human transitions to Batched | Adjusting entries hit the books; CFO must approve |
| A2 | **COA Mapping Suggester** | Flow | Read `vw_GLDetail_Subledger`, similarity search over `GLAccount` rows; create `ChartOfAccountsMapping` rows with `ApprovedByUserID=NULL` | Mapping rows un-approved until admin clicks Approve | Plan §4.6 / M16+D27 require explicit admin approval |
| A3 | **Manual JE Reviewer** | Flow | Loads the proposed JE + JEL rows; drafts `Description`, suggests GL accounts based on counterparty history, flags policy violations (round numbers, off-hours posting, unusually large amounts) | Annotates draft; CFO approval before Batched | Manual JEs already require CFO approval (plan §14 Q10) |
| A4 | **Recurring Template Inducer** | Loop | Scans `JournalEntry` history for repeated patterns; offers to convert to `RecurringJournalEntryTemplate` + `RecurringJournalEntry` schedule | Creates Inactive template + schedule; admin activates | Template creation changes future emit behavior |
| A5 | **Tax Classification Advisor** | Flow | Reads `CustomerTaxProfile`, related sales history, product description; proposes `TaxCategory` + nexus check | Tax-config writes require Finance.Admin role | Tax decisions carry legal liability |
| A6 | **AR-to-GL Recon Resolver** | Loop | Queries `vw_ARtoGLRecon`, traces JE lines through `vw_JEAuditTrail`, identifies the breaking entry, proposes corrective JE | Corrective JE drafted as Pending; human approves to Batched | Corrective JEs typically hit adjusting-period |
| A7 | **Reversal Composer** | Flow | Given a `ReversesJournalEntryID`, drafts the reversal narrative, dimension tags, cross-references | Reversal as Pending; human approves to Batched | Dispute-driven reversals are high-visibility |
| A8 | **Audit Pack Assembler** | Flow | Gathers JE samples, supporting `__mj.File` attachments, period-close attestations from `__mj.AuditLog`, materialized balances | Read-only output (PDF/zip artifact) | Auditor delivery is high-stakes; human reviews before sending |
| A9 | **AR Collections Agent** | Loop | Queries `vw_AROpenByCustomer` + `vw_ARAging`, drafts dunning emails via Communication framework, schedules escalation | Drafts to outbox; human sends or fully-autonomous via opt-in policy per Customer | Collections emails are customer-facing; some accounts need white-glove |

---

## 4. Fully autonomous agents (act, with safeguards)

Where the cost of a wrong call is small or the safeguard is a downstream human review step.

| # | Agent | Type | Acts on | Safeguard |
|---|---|---|---|---|
| F1 | **Routine JE Validator** | Flow | Every `postJournalEntry()` from upstream apps | Just runs validators (balance, GL exists, period open, dimensions valid); rejects → upstream app sees error |
| F2 | **Anomaly Watcher** | Loop | Streaming over Pending JEs | Posts findings to Slack/Teams + writes to audit log; never blocks posts |
| F3 | **Stale Pending Sweeper** | Flow | Pending JEs older than N days (default 7) | Notifies the originating system / channel; doesn't auto-batch stale ones |
| F4 | **FX Rate Freshness Monitor** | Flow | `CurrencyExchangeRate` table | Re-fetches if rates older than tolerance window (default 24h) before they're used in a posting |
| F5 | **Unmapped GL Detector** | Loop | External GL accounts that appear in batch errors | Opens an MJ approval task (COA Mapping Suggester takes over with a draft) — never auto-maps |
| F6 | **Dimension Hygiene Bot** | Loop | JE lines missing dimension tags that "should" have them based on similar past JEs | Adds a "suggested dimensions" annotation visible in MJ Explorer; doesn't mutate the JE |
| F7 | **Period Close Pre-Flight** | Loop | Runs the close validators 7/3/1 days before scheduled close | Surfaces blockers via notifications; no mutations |
| F8 | **Recurring Emitter Watchdog** | Loop | All active `RecurringJournalEntry` schedules | If `NextScheduledAt` is overdue, emits the Pending JE; defers to approval-required handling |

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
| **E** (Recurring + balance materialization) | W7 (Period close), W8 (Reopen), S3, S6, S7 | A4 (Recurring Template Inducer), F4 (FX Freshness), F7 (Close Pre-Flight), F8 (Recurring Watchdog) |
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
| W4–W9 | ⏳ Planned | Phase B |
| Scheduled Actions S1–S7 | ⏳ Planned | Phase B–E |
| `AccountingService` façade | ⏳ Planned | Phase G |
| Agents A1–A9, F1–F8 | ⏳ Planned | Phase B onward, agent-by-agent per phase table |

---

*Workflows are the floor; agents are the ceiling. Together they're the difference between "subledger that records what happened" and "subledger that actively helps the close."*
