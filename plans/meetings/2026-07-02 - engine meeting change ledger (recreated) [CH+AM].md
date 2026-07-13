> 📥 **IMPORTED 2026-07-13** from `~/MJDev/reports/accounting-engine-meeting-changes/CHANGES.md` so Robert can review Amith's 2026-07-02 rulings in-branch (his ask, 2026-07-13 meeting). ⚠ The RAW transcript this ledger's ¶ references point at (`meeting-with-marcelo-t-amith-n-and-ian-z.md`) was LOST with the deleted accounting-engine-work instance and never re-supplied — this ledger (verbatim-capture quotes incl. CH-1's "the concept of accounting period is just irrelevant to us… kill that") + Amith's 07-03 response rulings (AM-1..7, also summarized here) are the surviving record. Amith's 07-03 response doc was lost too.

# Changeset — 2026-07-02 Engine Meeting (Marcelo T · Amith N · Ian Z)

> **⚠ 2026-07-06 — instance loss + recovery note.** The `accounting-engine-work` instance was deleted; the
> plan docs and both meeting source docs referenced below died with it (uncommitted). Recreated (v1.2) in
> the NEW `develop-accounting-engine` instance / `repos/apps/bizapps-orders/plans/`:
> `accounting-engine-plan.md`, `erd-accounting-target.md`, `2026-07-02-engine-meeting-amendment.md`,
> `erd-orders-target.md`, + the instance-root interface/full-system ERDs (verbatim). **Still lost — Marcelo
> to re-supply:** `meeting-with-marcelo-t-amith-n-and-ian-z.md` (07-02 transcript; its ¶ refs below cite
> that file) and `26-7-3-Post-meeting-update-midifications.md` (Amith's 07-03 response). Until re-supplied,
> THIS file is the closest surviving record of both.

> ## ⚠️ ADDENDUM 2026-07-03 — Amith responded to this changeset; his response now OUTRANKS the transcript
> Response doc: `…/bizapps-accounting/plans/26-7-3-Post-meeting-update-midifications.md` (copy in orders
> plans). Rulings (AM-1..7), integrated into both apps' plans + the ERDs
> (`erd-accounting-target.md` / `erd-orders-target.md`):
> - **AM-1** — `AccountBalance` + `AccountBalanceByDimension`: **remove** ("Claude-isms"; balance tracking is
>   the accounting system's job). → resolves OQ-A (with TaxLiability.AccountingPeriodID dropped too).
> - **AM-2** — NEW **`GLAccountRole`** lookup (`ID, Name, Description, Status Active/Inactive, Sequence`);
>   seed: Cash, Accounts Receivable, Inventory, Cost of Goods Sold, Sales, Sales Discounts, Sales Returns and
>   Allowances. → resolves OQ-C (lookup table, not CHECK). ⚠ NEW OQ-H: Deferred Revenue missing from the
>   list despite the meeting's own deferred-revenue example — assumed added, confirm.
> - **AM-3** — `GLAccount.AccountType` = 5-value enum `NVARCHAR(15)`: Asset, Liability, Equity, Revenue,
>   Expense (replaces the 10-value Contra*/Statistical CHECK).
> - **AM-4** — ERP wire format = **account number** (BC knows nothing of our IDs) → refines OQ-B (internal =
>   GLAccountID; number is the batch→ERP boundary). Batches group by Company+GLAccount+Dimension and split by
>   company; **balance must hold for the full batch AND per company — and for every JE's lines overall AND
>   per company** (new engine validation rule).
> - **AM-5** — the three `*GLAccount` mapping tables are REPLACED by ONE polymorphic **`GLAccountLink`**
>   (`ID, GLAccountID, EntityID/RecordID` TaggedItem-style, `Status Pending/Active/Disabled,
>   StartedAt/EndedAt, Comments`) + **`GLAccountLinkDimension`** (`ID, GLAccountLinkID, DimensionID,
>   Sequence`), with one reusable Angular picker for the Company/Category/Product forms. → resolves OQ-D.
>   ⚠ NEW OQ-G: Amith's field list has NO role column — `GLAccountRoleID` assumed (required to tell a
>   record's Revenue link from its AR link), confirm. ⚠ NEW OQ-I: link dimensions carry DimensionID only —
>   where do VALUES come from at JE-build time (order context assumed)? — Robert.
> - **AM-6** — SJE materialization: **not needed** — domain entity servers (e.g. SubscriptionEntityServer)
>   generate scheduled JEs; Robert to walk through next week. → resolves OQ-E; don't get hung up on it.
> - **AM-7** — build order restated: **1. fix schema → 2. clean DB + CodeGen → 3. update Batching → 4. build
>   AccountingEngineBase/AccountingEngine → 5. basic Order-entry UI + object-layer JE generation flowing into
>   a batch.** Hyperfocus per task; use Amith + Robert as resources.
> - Still open: OQ-F (multi-company batch shape — Robert) + new OQ-G/H/I above.

**Purpose:** the complete old→new change list from the 2026-07-02 meeting, per Amith's instruction
(transcript ¶168: *"take the transcript… give me a summary of the changes we want to make, shoot that over to
me in a group thread"* — audience: Marcelo, Amith, Ian, Robert). ¶-references cite line numbers in the
transcript (`instances/accounting-engine-work/mj/packages/dev-apps/bizapps-accounting/plans/meeting-with-marcelo-t-amith-n-and-ian-z.md`,
verbatim copy in the orders plans folder).

**Precedence:** this meeting is the highest-priority design authority. Where it contradicts the 2026-07-01
first meeting, the older master plans, the orders build plan v0.1, or prior in-session decisions, the meeting
wins. Documents updated to match: `bizapps-accounting/plans/accounting-engine-plan.md` (new),
`bizapps-orders/plans/2026-07-02-engine-meeting-amendment.md` (new), supersession notices prepended to both
master plans, priority header prepended to the transcript itself.

---

## A. Schema changes — accounting (`__mj_BizAppsAccounting`, baseline edit + CodeGen rerun on clean DB, ¶169)

| # | Change | Detail | Source |
|---|---|---|---|
| CH-1 | **Remove `AccountingPeriod` entirely** | JEs are multi-company; periods are company-specific; period assignment happens in the ERP when a batch posts. *"The concept of accounting period is just irrelevant to us… kill that."* Retires: period-close trigger, W4 adjusting-entry routing, period seeding in the ACP hook, `AccountingPeriodEntityServer`. | ¶5-7, ¶14-21, ¶65-67 |
| CH-2 | **`JournalEntry` loses `CompanyID`, `AccountingPeriodID`, `OriginalAccountingPeriodID`** | One JE spans companies (Izzy AR + Sidecar AR in one order, ¶22-33). Company association is per **line**, implicit via `GLAccount.CompanyID` (¶55). Header keeps EffectiveDate/EntryType/Status/lineage; JE status flow Pending→Batched→GLPosted unchanged. | ¶14-25, ¶53-58 |
| CH-3 | **`JournalEntryBatch`: status list becomes `Pending, Approved, Sent, Posted, Failed, Cancelled`** (was Pending/Sent/Acknowledged/Failed) | Pending = mutable/deletable · Approved = locked (new internal approval state before send) · Sent · Posted (renames Acknowledged — ERP posted it) · Failed = ERP post failed (rare; wants a retry loop + escalating notifications) · Cancelled = terminal, allowed from Pending or Approved-not-yet-sent. Drop `AccountingPeriodID` (CH-1). | ¶67-74 |
| CH-4 | **Batch is multi-company; splits by company at ERP send** | An order belongs to exactly ONE batch (¶44). At send, the batch partitions by company → **one summary JE per company**, grouped by GL account + dimensions (¶34-36, ¶49-51). ERP send is **all-or-nothing per batch** — any failure rolls the whole batch back; no partial sends (¶151-153). Header `CompanyID`/ACP link needs rework to per-company grouping — Amith believes existing keys (company + batch number) suffice; **review with Robert** (¶63-64). | ¶34-64, ¶151-153 |
| CH-5 | **NEW `AccountingCompanyProfileGLAccount`** | Company-level **default account per role**: `ID, AccountingCompanyProfileID, GLAccountID, Role, Comments, Status ('Pending'/'Active'/'Disabled'), StartAt NULL, EndAt NULL`. Date-effective mappings ("new CoA effective Aug 1" pre-entered; new JEs auto-flip; old JEs never modified). Roles named so far: AccountsReceivable, Revenue, DeferredRevenue, Discounts, Returns, Inventory, COGS. | ¶100-113 |

## B. Schema changes — orders (`__mj_BizAppsOrders`)

| # | Change | Detail | Source |
|---|---|---|---|
| CH-6 | **Kill `Product.RevenueGLAccountID` / `DeferredRevenueGLAccountID` / `COGSGLAccountID`** | *"Those fields go away"* (RevenueRecognitionType stays). Replaced by CH-7. | ¶91-92 |
| CH-7 | **NEW `ProductGLAccount`** | Multi-value product→account mapping: `ID, ProductID, GLAccountID, Role, Comments, Status, StartAt, EndAt` (same pattern as CH-5). Per-mapping dimensions in a **separate FK-enforced table** (NOT JSONType — FK enforcement on dimension deletes was the decider, ¶96-100). | ¶92-100 |
| CH-8 | **NEW `ProductCategoryGLAccount`** | Same pattern at the (hierarchical) category level — Marcelo's suggestion, approved: *"That's a nice improvement."* Resolution can override at category between company default and product. | ¶114-118 |
| CH-9 | **Order ↔ Batch: one order belongs to exactly one batch** | | ¶44 |

## C. Engine & code changes

| # | Change | Detail | Source |
|---|---|---|---|
| CH-10 | **AccountingEngineBase + AccountingEngine, modeled on AIEngineBase/AIEngine** | Base = universal, metadata-cache-only. Engine = server-only `BaseSingleton` derivative with `CreateJournalEntry`. Exposed via **remotable ops** ("Accounting.CreateJournalEntry") so it's invokable from any surface — replaces custom GraphQL resolvers. The thin stateless `AccountingService` (accounting AD-14 / orders C8/A1 / issue #9) **will not exist**. | ¶11-12, ¶170, ¶174-178 |
| CH-11 | **Engine contract: dumb but strict, atomic** | Takes RAW journal entry line items; validates: ≥2 lines, ≥1 debit + ≥1 credit, one side per line, accounts exist + active, Σdebits = Σcredits; **auto-groups** duplicate (account, dimensions) lines and **reorders debits before credits**; writes header+lines+dimensions in ONE DB transaction, full rollback on any failure; returns the created JE (number) or typed errors. No business meaning, no FX, no tax. | ¶53-58, ¶139, ¶149-153, ¶158-163 |
| CH-12 | **Dimensions: validate-only — NO auto-create** | *"You have no concept of dimensions that aren't already defined for you. Dimensions come from the accounting system like GL accounts do."* Unknown dimension/value = typed rejection. M:M with JE line items AND batch line items (tables already exist). | ¶75-79 |
| CH-13 | **NEW `OrdersEngine` + account resolver** | Orders-side `BaseEngine` metadata cache (product catalog + GL-account mapping tables). Resolver walks **product → product category (up the tree) → company default**, filtered by Status='Active' + StartAt/EndAt as of the order date. One source of truth, cached, "essentially instant." | ¶119-121, ¶145-147 |
| CH-14 | **JEs generated when Order flips to `Confirmed`** | First transition to Confirmed only. Draft/Quoted = no financial meaning; Voided only from Draft/Quoted; post-Confirmed cancellation = cancelling order with reverting JEs. The `Order` entity extended server subclass detects the transition, builds raw debits/credits via OrdersEngine, calls the engine op. | ¶130-150 |

## D. Supersessions of earlier decisions (what this kills)

| Old ruling | Killed/changed by |
|---|---|
| First meeting (2026-07-01): engine verifies "timestamp is not inside a locked [period]"; locked-period open question (reject vs auto-roll vs caller flag — 2026-07-02 Q3) | **Moot** — periods removed (CH-1). Callers never think about periods; the ERP settles them (¶5-7, ¶65-66). |
| First meeting: "always use the account number, not the account ID… won't use the primary key"; session Q2 answer "Code only (strict Amith)" | **Superseded** — the new catalog tables store `GLAccountID` UUID FKs and the ORDERS resolver hands the engine resolved accounts (¶93-100). Draft carries `GLAccountID`. ⚠ CONFIRM (OQ-B below) — the wire format wasn't re-litigated explicitly. |
| First meeting "dimensions… we need to bring them over the engine"; session Q4 answer "auto-create values" | **Reversed** — validate-only (CH-12). |
| Accounting AD-14 + orders build-plan C8/A1: plug = thin stateless `AccountingService`, "explicitly NOT an engine" | **Dead** — engine + remotable op (CH-10). |
| Orders build-plan C6/BP-D5: `Order.ReceivingCompanyID` required | **Dead** — orders + JEs are multi-company by definition (¶19-25); company is per-line via GL account. |
| Orders build-plan BP-D3/C2: plug resolves semantic roles / (CompanyID+Code) | **Moved** — role resolution is ORDERS' job via the catalog tables + OrdersEngine resolver (CH-13); accounting only stores the company-default table (CH-5). |
| Orders build-plan Blocks B–E gating + Block C FX + Block G tax sequencing | **Frozen** — scope fence (§E). FX + tax + subscriptions + intercompany + approvals all out until re-planned. |
| Master plan / prior batch design: statuses Pending/Sent/Acknowledged, per-company batch header | CH-3, CH-4. |
| "JE fires at order lock/Post" wording | **Confirmed = the trigger** (CH-14). |

## E. Scope fence + build order (¶164-175, ¶202-206)

**Build ONLY:** (1) plans updated (this changeset) → group-thread sign-off; (2) migration edits + migrate +
CodeGen on a **clean DB**; (3) `AccountingEngineBase` + `AccountingEngine` + `CreateJournalEntry` remotable
op; (4) orders: `Product`/`ProductGLAccount`(+dims)/`ProductCategoryGLAccount`, `Order`/`OrderLine`,
OrdersEngine + resolver, Confirmed-hook → engine call. **Explicitly NOT now:** FX, tax, subscriptions/rev-rec,
intercompany, approvals/workflow (later = MJ Tasks task types + Flow Agent, e.g. "Batch Review" tasks,
¶193-201), inventory/COGS. *"Tell Claude to F off about everything else — just build this."* (¶173)

## F. Open questions (the meeting does NOT answer these — for Marcelo/Amith/Robert)

| # | Question | Why it blocks |
|---|---|---|
| OQ-A | **Period-removal ripple:** `AccountBalance` + `AccountBalanceByDimension` key on `AccountingPeriodID`; `TaxLiability.AccountingPeriodID`; `ScheduledJournalEntry.TargetAccountingPeriodID`. Dropping the table forces a call even though these tables are outside the fence: drop the columns for now? Re-key by date range or ERP-period string? | The baseline migration can't compile with dangling FKs. |
| OQ-B | **Wire format of account refs:** first meeting said account NUMBER; new catalog stores `GLAccountID` FKs. Plans now say the draft carries `GLAccountID` (resolver output). Confirm — or should the op ALSO accept company-scoped Code for future external callers? | Freezes the draft type. |
| OQ-C | **Role value list:** fixed CHECK enum (AccountsReceivable, Revenue, DeferredRevenue, Discounts, Returns, Inventory, COGS, …) vs. lookup table? Plans assume CHECK (additive later). | Migration design. |
| OQ-D | **Per-mapping dimensions** were specified for `ProductGLAccount` (¶96-100) — do `ProductCategoryGLAccount` and `AccountingCompanyProfileGLAccount` get the same sibling dimension tables? | Migration design. |
| OQ-E | **ScheduledJournalEntry materialization trigger:** "materialize at period close" died with periods. What invokes it now (scheduled action? batch cycle?)? Out of fence, but the built materializer is currently wired to a dead concept. | Needed before rev-rec resumes. |
| OQ-F | **Multi-company batch shape:** Amith thinks existing keys (company + batch number) suffice (¶63-64) — Robert to confirm whether a batch-group element is needed. | CH-4 migration detail. |

## G. Files changed in this pass (documentation only — no code, no migrations yet)

- `…/bizapps-accounting/plans/meeting-with-marcelo-t-amith-n-and-ian-z.md` — priority header added (highest-priority document), + verbatim copy placed at `…/bizapps-orders/plans/`
- `…/bizapps-accounting/plans/accounting-engine-plan.md` — **NEW** (engine pair + op + contract + schema deps + build order)
- `…/bizapps-orders/plans/2026-07-02-engine-meeting-amendment.md` — **NEW** (S1–S11 supersessions + new schema/behavior + build order)
- `…/bizapps-accounting/plans/bizapps-accounting-master-plan-v2.md` + `…/bizapps-orders/plans/bizapps-orders-master.md` — supersession notice prepended
- This folder: `reports/accounting-engine-meeting-changes/CHANGES.md`

*(paths relative to `~/MJDev/instances/accounting-engine-work/mj/packages/dev-apps/`)*
