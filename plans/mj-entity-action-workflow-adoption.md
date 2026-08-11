# Adopting MJ's Entity Action workflow extensions

> **Status:** **Partly shipped.** MJ [#3408](https://github.com/MemberJunction/MJ/pull/3408) merged
> 2026-08-04 and its scope/sequencing work is in the installed
> `@memberjunction/core-entities@6.1.0-edge.1` (`EntityAction.ScopeEntityID` / `ScopeRecordID` /
> `Sequence`) and `@memberjunction/actions-base@6.1.0-edge.1` (`EntityActionScopeResolver`).
> **This PR authors two of the four §3 bindings** as metadata in `metadata/entity-actions/` —
> pure metadata, no migration, no app code.
> **Two of the four are not buildable and are struck through in §3** — they bind `AccountingPeriod`,
> which this repo does not have. See §3a.
> **Both shipped bindings are `Pending`, not `Active`,** and §3b says exactly what has to be true
> before anyone turns them on.

---

## 0. What shipped in this PR

| | |
|---|---|
| `metadata/entity-actions/.mj-sync.json` | Directory config: entity `MJ: Entity Actions`, with `pull.relatedEntities` for Invocations / Filters / Params (all keyed `EntityActionID`) |
| `metadata/entity-actions/.entity-actions.json` | The two buildable bindings, with their invocation and param children |
| `metadata/.mj-sync.json` | `entity-actions` appended to `directoryOrder` — it depends on entities and actions already existing |
| `packages/CoreEntitiesServer/src/__tests__/EntityActionBindings.test.ts` | Shape tests for the rules in §4 that are checkable without a database |

Nothing here is wired into app code, and nothing was pushed to a database — authoring and `mj sync push`
are separate steps by design.

---

## 1. What is changing in MJ core

`EntityAction` — MJ's generalized hook for running an Action off an entity's
create / update / delete / validate — is becoming the **workflow-hook substrate for every app on
the platform**, so no app needs to invent its own.

It already does more than its schema suggests, and this is worth knowing regardless of this PR:

| Invocation | Where it fires | Semantics |
|---|---|---|
| `Validate` | `OnValidateBeforeSave` | **A real blocking gate** — a non-`Success` result fails the save |
| `Before*` | `OnBeforeSaveExecute` | Awaited, result discarded (cannot veto) |
| `After*` | `OnAfterSaveExecute` | Fire-and-forget |

And because **`Execute Agent` is just an Action**, any binding can already run an agent — a
deterministic **flow agent** (visual editor, `Action`/`Prompt`/`Sub-Agent`/`ForEach`/`While` steps,
per-step retry and error behaviour) or a **loop agent** where judgement is genuinely needed. The
house shape is a flow agent with a `Sub-Agent` step calling a loop agent.

**What #3408 adds:**

- **`EntityAction.ScopeEntityID` + `ScopeRecordID`** — bind a workflow to *one configuration record*
  rather than to every record of an entity. This is the important one: it means **no app ever grows
  a column per type per event**, and a configuration record can surface "the workflows bound to me"
  as a real relationship instead of something buried in filter code.
- **`EntityAction.Sequence`** — deterministic ordering when several bindings share an event.
- **`EntityActionParam.ValueType = 'Entity Object Data'`** — passes `entity.GetAll()` instead of the
  live `BaseEntity`. Use it for anything that serializes, above all `Execute Agent`'s `Data` payload:
  a `BaseEntity` serializes to `{}` because its fields are getters, so the agent silently receives
  an empty payload with no error anywhere.
- ~~Two seeded reusable `ActionFilter`s — **"field changed"** and **"field changed *to* value"**.~~
  **This did not ship** — see §3b. The reasoning still holds and is the reason both bindings here are
  `Pending`: without a transition filter `AfterUpdate` fires on *every* update, and "status *is* X"
  instead of "status *changed to* X" re-fires on every later save.
- `After*` routed through `QueueManager` so failures are durable and retryable rather than logged
  and swallowed.

**Authoring is pure metadata** — `metadata/entity-actions/`, with `relatedEntities` for invocations,
filters and params. No schema and no code in the consuming app.

---

## 2. What this means for BizApps Accounting

Accounting is the most conservative consumer, and should stay that way. The ledger is not
configurable workflow, and nothing about this change should make posted data mutable by an
operator-authored binding.

Where it *is* useful: **notification and control around period boundaries and batching** — the
places where a human currently has to remember something.

## 3. Suggested bindings

| Entity + invocation | Scope | Work | Purpose | Status |
|---|---|---|---|---|
| ~~`AccountingPeriod` · `AfterUpdate` (status changed to a closed value)~~ | ~~a `Company`~~ | ~~Flow agent~~ | ~~Close checklist, notify controllers, kick off reporting~~ | **Void — no such entity (§3a)** |
| ~~`AccountingPeriod` · `Validate`~~ | ~~a `Company`~~ | ~~Action~~ | ~~Refuse close while unbatched or unbalanced entries exist~~ | **Void — no such entity (§3a)** |
| `JournalEntryBatch` · `AfterUpdate` (status changed to a dispatched value) | a `Company` | Action | ERP handoff confirmation, exception alerting | **Authored, `Pending`** |
| `JournalEntry` · `AfterCreate` | a `Company` | Action | Threshold alerting on unusually large or manual entries | **Authored, `Pending`** |

### 3a. Why the two `AccountingPeriod` bindings are void

**This repo has no `AccountingPeriod` entity, and has not had one since 2026-07-06.** The baseline
migration's own revision note is explicit:

> `* REMOVED: AccountingPeriod, AccountBalance, AccountBalanceByDimension`
> `  (+ every period FK/trigger; the ERP owns periods + balances).`

That is consistent with the app's purpose — accounting here is the AR subledger and JE primitives;
period close is a general-ledger concern that stayed in the ERP. The §3 rows were written against a
schema that no longer exists, so *"refuse close while unbatched entries exist"* has nothing to bind
to and no close event to gate. If period semantics ever return, these two rows are still the right
design — `Validate` really is the correct invocation for a blocking close gate — but they cannot be
authored today.

The practical loss is that **the one genuinely blocking `Validate` binding in the plan was one of the
two void rows.** Everything shipped here is `After*` alerting. Nothing in this PR can refuse a save.

### 3b. Why both shipped bindings are `Pending`

MJ's `GenericDatabaseProvider` dispatches only bindings whose `EntityAction.Status` **and**
`EntityActionInvocation.Status` are `Active`, so a `Pending` row is inert. Three things must be true
before either is switched on:

1. **A transition filter must exist.** §1 claimed #3408 seeded reusable "field changed" / "field
   changed *to* value" `ActionFilter`s. **It did not** — that is plan text in MJ's own
   `plans/entity-action-workflow-extensions.md`, and MJ's `ActionFilter` table has no `Name` column,
   so a reusable named filter is not expressible. What actually exists (MJ commit `df76df876d`,
   2026-08-08, *after* #3408) is a filter row **generated per trigger**, whose `Code` bakes the field
   and value in as literal arguments — `DidFieldChangeToValue('Status', 'Sent')` — against an
   `ActionFilterContext` that the installed `actions-base@6.1.0-edge.1` **does not ship**. Until that
   engine lands, `AfterUpdate` fires on *every* save, which is precisely the re-firing failure §1
   warns about. No filter row is authored here rather than fabricate one against a runtime that
   cannot honour it.
2. **A recipient must be configured.** `To` / `From` / `Provider` on `Send Single Message` are
   deployment configuration, deliberately left unset rather than filled with placeholders.
3. **The company scope must be set.** See §3c.

### 3c. Scope is authored unset, and why

`CK_EntityAction_Scope` requires `ScopeEntityID` and `ScopeRecordID` to be **both** NULL or **both**
set, and `ScopeRecordID` must be a concrete `Company` UUID. An app repo that ships to many tenants
cannot seed one, so both are NULL — which means "applies to every record", correct for an inert
template and wrong the moment it goes Active.

The good news is that scoping is **verified to work** for both entities. `EntityActionScopeResolver`'s
default rule walks foreign keys and requires **exactly one** field on the subject entity pointing at
`MJ: Companies` — zero, or two or more, and the binding silently never fires. `JournalEntry` and
`JournalEntryBatch` each have exactly one (`CompanyID`). To narrow a binding, set `ScopeEntityID` to
the `MJ: Companies` entity and `ScopeRecordID` to the company's **bare** UUID — not MJ's
`ID|<guid>` `CompositeKey` form, which is what `ActionExecutionLog.TargetRecordID` uses; the
resolver compares `String(fieldValue)` directly.

## 4. Notes specific to this repo

**Hooks must never mutate posted data.** The JE immutability trigger (`Status ∈ {Batched, GLPosted}`
allows only `GLPostedAt` / `GLReferenceID` / `Status`) is a database-level invariant and will refuse
a misbehaving binding. That is the right outcome, but the failure would surface as a confusing
trigger error inside an agent run — so document the boundary rather than discovering it.

**The balanced-JE and period-close triggers are DEFERRABLE constraint triggers.** A `Before*` or
`Validate` binding runs inside the same transaction and will interact with them. Prefer `After*`
for anything non-trivial.

**`JournalEntryBatch` has its own lock trigger, and it is easy to miss.** Once a batch reaches
`Approved` / `Sent` / `Posted`, error 50009 allows only `Status`, `ApprovedAt`, `ApprovedByUserID`,
`SentAt`, `PostedAt`, `ExternalJournalEntryBatchRef` and `ErrorMessage` to change — `CompanyID`,
`PostingDate`, `SummaryJournalEntryID` and the approval-task pointer freeze at approval. A binding on
the batch is as constrained as one on a posted JE.

**`Company` is the natural scope record here**, since accounting is company-scoped throughout and
`AccountingCompanyProfile` is an IsA child of `__mj.Company`. "The close workflow for this company"
belongs on that profile.

**A `JournalEntry` header carries no amount.** Debits and credits live on `JournalEntryLine`, so
"unusually large" cannot be decided from the record an `AfterCreate` binding receives — a real
threshold has to sum the `Lines` collection, which is work for a purpose-built Action rather than a
`Script` param. `EntryType = 'Manual'` *is* decidable from the header.

---

## 5. What to do next

§3's two `JournalEntry*` bindings are authored and inert. In rough order:

1. **Wait for the transition-filter engine** (`ActionFilterContext` with `DidFieldChange` /
   `DidFieldChangeToValue`) to reach a published `actions-base`, then author the per-binding
   `ActionFilter` row for the batch binding — `DidFieldChangeToValue('Status', 'Sent')`. Without it
   neither binding should go `Active`.
2. **Decide the alerting target properly.** Both bindings point at MJ core's `Send Single Message`
   because it is the only seeded, generic notification action. If accounting grows its own Action
   (one that can sum JE lines and apply a real threshold), rebind to it — that is also the natural
   home for `EntityActionParam.ValueType = 'Entity Object Data'`, which nothing here uses yet
   because `Send Single Message` takes no record-shaped parameter.
3. **Set scope per deployment** (§3c) and flip `Status` to `Active` — both on the `EntityAction` and
   on its `EntityActionInvocation`.
4. **Revisit §3a** only if period semantics ever come back into this repo.
5. Fold this file into `plans/bizapps-accounting-master.md` once the bindings are live.

## 6. Two rules to carry into the design

- **Synchronous bindings should be Actions, never agents.** `Validate` and `Before*` run inside the
  caller's transaction. A loop agent's duration is unbounded and holding a transaction open for it
  is not acceptable. Agents belong on `After*`, which is async.
- **A flow agent should create human work and finish** — it should not hold a run open waiting for
  a person. Use `MJ: AI Agent Requests` when the answer resumes the same run (minutes to hours), and
  a **bizapps-tasks** Task when it is durable, assignable work someone owns (days to weeks).

---
_Generated by [Claude Code](https://claude.ai/code)_
