# BACKLOG — bizapps-accounting (plans-level)

Repo-level wanted-but-not-started work + decision-needed items. Holding pen only — promote an entry into
an `action-plans/ActionPlan - *.md` when picked up and mark it promoted. Entry: what · source · status.
Convention: `~/MJDev/shared-plans/repo-planning-system.md` §5.1. (The instance-level
`instances/<slug>/BACKLOG.md` tracks agent working items; this file tracks repo/plan-level items.)

## Tasks

- [x] ~~**`IntercompanyRelationship` migration**~~ — **STRUCK 2026-07-13 (mis-promoted):** verification
      (Marcelo's catch) found the table was created-then-DROPPED and deliberately omitted from the
      baseline (2026-07-06 fold ruling: Payments owns due-to/due-from). Not accounting work — wiring
      lands with Payments/O2 (orders repo); reference schema kept in MOD-5. Action plan A1 re-scoped to
      disposition/documentation only.
- [x] ~~**View-driven batch builder** (MOD-8)~~ — PROMOTED 2026-07-11 →
      `action-plans/ActionPlan - Feature build (batching, reporting, materialization).md` B1.
- [x] ~~**Role seeding + RLS** (MOD-9)~~ — PROMOTED 2026-07-11 → Schema action plan A2 (co-design
      checkpoint with Marcelo before executing).
- [x] ~~**Jeremy reporting pack**~~ — PROMOTED 2026-07-11 → Feature action plan B2.
- [ ] **Batch dimension strategy for customer detail to BC** — which dimensions batches split by
      (customer, product, renewal-vs-new, event); ask Jeremy for his definitive list
      (2026-07-10 Jeremy meeting). `[decision needed: Jeremy]` (Execution slot reserved: feature action
      plan B1.5 — seeds + upstream tagging once decided.)

- [ ] **Consolidate hand-authored docs/ into design-docs/** — move `docs/ARCHITECTURE.md`,
      `docs/bizapps-accounting-erd.md`, `docs/lifecycle-hooks.md` → `design-docs/` and update the
      CLAUDE.md path references in the same change, completing the 2026-07-15 ruling (`design-docs/`
      = hand-authored home; `docs/` reserved for generated output per the MJ template). Do at the
      Task 65b window (feature agent's WIP committed first — these files are DoD-coupled to schema
      work). (2026-07-15 UI-planning session, Marcelo + orchestrator.)

- [ ] **Precomputed-stats backend (stats endpoint / snapshot tables)** — a scheduled server-side
      stats layer so dashboards read precomputed numbers instead of running aggregates on demand.
      Definite need per Marcelo (2026-07-17): "that's a definite thing we need to have, a stats
      endpoint or back end" — but not developable yet; v1 dashboards ship on cheap stored-Query
      aggregates + `TotalRowCount` per the §8.0 stats rule. Note: MJ has NO platform facility for
      this (no snapshot tables, no stats resolver — verified 2026-07-17 survey), so this is ours to
      build (candidate for bizapps-common or an MJ-base contribution). Revisit trigger: an
      aggregate query measurably slow on real data volumes, or the dashboards phase (§8.6 step 6)
      surfacing a stat that can't be served cheaply.

- [ ] **Multi-company GL accounts (shared account across companies) — consider** — today every
      `GLAccount` belongs to exactly one company (`CompanyID NOT NULL`) and the whole pipeline
      (JE company derivation, MOD-15 batching, RLS scoping) keys off it. Consider whether a
      single account definition shared by multiple companies is ever needed (e.g. a common
      intercompany or clearing account shape) vs the current model of per-company account rows
      + `ChartOfAccountsMapping` for ERP alignment. (Marcelo, 2026-07-17.) Revisit trigger: the
      Q36 COA-model sitting, or a real multi-entity config where duplicating accounts per company
      demonstrably hurts.

- [ ] **Multi-company batches (LATER — after single-company is stable)** — Amith's 2026-07-17 demo
      feedback leans toward eventually supporting batches that span companies, aggregated
      **per-company-sections inside the batch**, still pushing one journal per company to the GL
      ("we probably will need to support batches spanning multiple-companies… properly aggregate
      by company within the batch"); he explicitly asked Robert + Jeremy to weigh in. MOD-15
      (single-company batches) stands for v1 — this is the sanctioned evolution path, not a
      contradiction: the batch header becomes a grouping envelope; per-company aggregation +
      per-company dispatch already exist under MOD-15/16. (Marcelo, 2026-07-17: "later once the
      system is stable for one company.") Revisit trigger: single-company batching validated
      end-to-end (roadmap V1.3 green) + the Robert/Jeremy response to Amith's ask.

- [ ] **Tax EXTENSION on the master plan (candidate)** — MOD-18 re-postures §9 (delegate
      calculation, snapshot recording); when real tax work schedules (engine selection + LH4I
      launch-tax call, orders Q22), the accumulated tax scope may warrant a proper master-plan
      **Extension** (new-scope vehicle) rather than more MOD overlay on §9. (Marcelo, 2026-07-17.)

- [ ] **Cross-app frontend cache for journal entries (idea)** — JEs get read in many places across
      accounting AND orders (lists, workspaces, order-lineage slide-ins, dashboards); consider one
      shared client-side cache/engine layer instead of per-page fetches. MJ prior art: the
      `BaseEngine` cached-array pattern (fits reference data, NOT unbounded JE sets — a JE layer
      would need windowed/keyset-aware caching, closer to LiveDashboardBase's paged feed) + the
      platform's IndexedDB RunView cache already underneath. Candidate home: bizapps-common
      (cross-app by definition). Explicitly LATER per Marcelo 2026-07-17 — revisit trigger: the
      Live Page System build (natural substrate) or observed duplicate-fetch pain across the two
      apps' UIs.

- [ ] **Scheduled-entry approval-before-materialization (idea)** — extend the C.8 manual-JE
      approval gate to optionally cover scheduled entries before they materialize. Not in the
      current plan chain; parked as an idea from the 2026-07-15 mockup review (Marcelo). Revisit
      when C.8 builds.

## Decisions needed

- [x] ~~**Periods reconciliation**~~ — **RESOLVED-for-now 2026-07-13 (Marcelo, Amith-doc confirmation):
      follow the removal — NO local period guard/machinery; batches land in the ERP's active period**
      (full verbatim in MOD-1; CA-1 resolved-for-now; CA-2 resolved by MOD-11). Robert is still
      researching his guard requirement — reopens ONLY if he overturns. Jeremy's correcting-entry
      exception rules still collect via Q19.
- [x] ~~**Tax first iteration: order-line-type vs separate tables**~~ — **ANSWERED 2026-07-16 (Robert,
      orders Q21): Option B's durable shape, SKIP the order-line-type path entirely; calculation
      delegated to a third-party engine (MOD-18).** Launch-tax yes/no = Jeremy/John (orders Q22).
- [x] ~~**IntercompanyRelationship wiring ownership**~~ — **RESOLVED 2026-07-13 (verified from the
      baseline):** the 2026-07-06 squash ruling already answered it — wiring is Payments-side; Accounting
      does no intercompany balancing. Residual (Q20): at O2 design, sanity-check with Amith where the
      wiring table lives + how per-pair accounts provision into the COA. `[residual: Amith, at O2]`
- [x] ~~**Open-AR cutover**~~ — **RULED 2026-07-16 (Robert, OQD; orders UPD-10):** transfer open
      invoices ONLY where no GL JEs exist yet (they flow through the normal Orders pipeline);
      already-journalized open invoices = Jeremy's companion call (stay in legacy vs JE-suppressed
      import). Jeremy identifies the no-GL-JE set. Timing rides aidp Stage 4.
- [x] ~~**Manual-JE approval gate**~~ — **ANSWERED 2026-07-16 (Robert, Q6.3): CONFIRMED YES** — CFO
      approval before a Manual JE can batch; C.8's inbox + review-modal UI shape blessed.

## UI wave §8 — remaining build (recorded 2026-07-16, UI-build agent handoff)

The §8.6 build order got through step 1 (shell foundation) and a PARTIAL step 2. What remains, in
order, with the notes a next agent needs:

- **§8.1 All journal entries → parity, then retire the JE Console.** The page is built and
  nav-wired, but as **"Journal Entries (new)" ALONGSIDE** the console — deliberately, because it
  lacks the console's **expandable lines · reversal · source-order cross-app deep link · balance
  indicator**. Swapping before parity is a feature regression. Add those + the C.8 approval chip +
  the reserved void/attachment slots, THEN flip the nav item and delete the console (that retirement
  IS the §6 sweep for this screen).
- **§8.0 remaining shells:** Batches, Accounts, Reports, Configuration categories. Copy
  `journal-entries-category.component.ts` — the base class carries rail/scope/page-switch; each
  shell supplies `RailSections` + `DefaultPageId` + an `@switch`. **Use `<mj-left-nav>`** (the
  bespoke rail was deleted — see TRANSFER-BACKLOG).
- **§8.2 Batches · §8.1b JE workspace + approvals · §8.3 Accounts · dashboards · §8.5 Reports ·
  §8.4 Configuration (LAST, A2/C.8-gated, stubs OK)** — all unbuilt.
- **Approval inbox + report-page scaffold** — unbuilt; still parked items in TRANSFER-BACKLOG.

**Two rulings this build established (apply them, don't re-litigate):**
1. **Check MJ before building any "shared component."** Two of the parked components evaporated on
   inspection: the nav rail (→ `<mj-left-nav>`) and most of the list scaffold (→
   `<mj-entity-data-grid>`, which already does AG Grid + RunView + infinite server-side paging +
   server sorting + export + per-user grid state). Search `ng-ui-components` / `ng-entity-viewer` /
   `ng-shared*` FIRST. Sub-pages of a left-nav shell use `<mj-page-header-interior>`, never
   `<mj-page-header>` (that doubles the header).
2. **Derive value lists from metadata, not by hand.** `JournalEntry.EntryType` is a 16-value CodeGen
   union from the column CHECK — a hand-written `['System','Manual']` was wrong on both count and
   content. Read `EntityFieldValues` off entity metadata (see all-journal-entries.page.ts).

**Testing debt (be honest about it):** tier 1 (64) + tier 4 (14) are green for what was built. Tier
4's **real-DB binding is not wired yet** and there is **no tier-2/3/5 coverage for any new UI**.
See test-harnesses/testing.md and the instance TASKS.md.

## Batch build — a graceful no-CFO experience (not just a hard-fail)

- **Source:** Marcelo, 2026-07-16 — *"lets add the precheck as our working default... I think a more
  graceful solution can be built later."* Working default is BUILT (Q28 / MOD-14).
- **Today:** a missing CFO is a **precondition** — `BatchApprovalGate.assertCanRaise(companyIds)`
  throws BEFORE the transaction opens, so nothing is written (strictly better than the old
  build-then-cancel). But the operator only learns at the moment they hit **Build**, as an error.
- **The graceful version:** surface it in the §8.2 Batch workspace BEFORE the click —
  - the preview already resolves the candidates' companies, so it can flag *"2 of the 3 companies in
    this selection have no CFO configured"* as a warning chip on the criteria panel;
  - name the offending companies and deep-link to Configuration → Companies to set the approver
    (the same deep-link pattern as orders' Confirm-failure → Account links);
  - disable **Build** with that reason as its tooltip, rather than letting it throw.
- **Why not now:** it needs `previewBatch` to return per-company approver readiness (a small
  additive field) and the Configuration → Companies screen to exist as a deep-link target
  (§8.4 — currently gated/last). Cheap once both land.
- **Trigger:** when §8.4 Companies ships, or the first time someone hits the hard-fail in real use.

---

## Batch coverage dates — denormalize `CoversFromDate` / `CoversToDate` onto `JournalEntryBatch`
- **Added:** 2026-07-16 · **Source:** Marcelo, GUI review — *"give me the ability to put in, like, actual
  calendar dates for a span of time. And if the batch covers a journal entry that's in that time, it should
  show up... but that could be a really complex and expensive query. So let me know what's the case with
  that, and maybe we need to have some more features in the batch... entries in the schema that cover, like,
  start and end of a batch. That's actually based on the journal entries that are in there, so we're not
  coring through those journal entries every time we wanna know what's the earliest and latest entry."*
- **The answer to his question:** he is right, and he named the fix himself.
  - **Today there are NO coverage columns on `JournalEntryBatch`** (verified 2026-07-16 against the generated
    entity — the batch has `BatchedAt`/`ApprovedAt`/`SentAt`/`PostedAt`, all *lifecycle instants*, and nothing
    describing the span of the JEs inside it).
  - So a date-span filter today means, per batch, a join/subquery into `JournalEntry` to find MIN/MAX
    `EffectiveDate`. That is O(batches × entries) on every filter keystroke and cannot use an index on the
    thing being filtered. The Batch approvals page currently infers the span in memory from an already-loaded
    set — fine for an inbox of tens, wrong as a filter predicate at scale.
- **The fix, and why it is not a new idea:** stamp `CoversFromDate` / `CoversToDate` (DATE, nullable) at
  batch-build time, exactly as `TotalEntries` / `TotalDebits` / `TotalCredits` already are — those columns'
  own descriptions say *"denormalized for fast batch dashboards."* Same precedent, same write point, same
  invariant. The filter then becomes a plain indexed overlap test:
  `CoversFromDate <= @to AND CoversToDate >= @from` — which also answers his "is it *any* entry in the span,
  or the *whole* batch?" question: overlap semantics = *any* entry falls in the window, which is what an
  accountant means.
- **Scope:** migration (2 columns + index) · stamp them in the batch-build path · backfill existing rows ·
  CodeGen · then the UI filter is trivial on Batch approvals, All batches and Dispatch status.
- **Trigger:** when we do the batches feature slice, or the first time someone needs to find a batch by period.

## Batch approvals — who is *required* to approve (routing + visibility)
- **Added:** 2026-07-16 · **Source:** Marcelo, GUI review — *"We need to file a backlog item on the batch
  approval to know who needs to approve it because that's going to decide who gets to see it. We likely are
  going to track whoever created it and who needs to approve it. That's gonna come in the roles changes."*
- **Correction to what was reported to him in-session:** a required approver **does exist today**, at the
  COMPANY level — `AccountingCompanyProfile.ApprovalCFOUserID` — and `JournalEntryBatch.ApprovedByUserID`'s
  own field description points at it. An agent reported "no such field" and that was relayed to Marcelo
  before being checked; it was wrong. What genuinely does NOT exist is **per-batch approver routing** and any
  notion of approver-driven **visibility**.
- **What's missing:** the batch records who approved *after the fact* (`ApprovedByUserID`/`ApprovedAt`) and
  who built it (`BatchedByUserID`), but nothing says *who must act* on THIS batch, and nothing scopes the
  inbox to the person who must act. Today the approvals page shows every pending batch to everyone.
- **Depends on:** the roles/visibility work (A2 — see Q22/Q24 on company-visibility mechanism). Marcelo
  explicitly sequenced it there: *"That's gonna come in the roles changes, though. So, yeah, that's okay.
  You can leave that for now."*
- **Trigger:** the A2 roles/visibility slice.

## Batch approvals — a denser view for large inboxes
- **Added:** 2026-07-16 · **Source:** Marcelo, GUI review — *"we're getting to the point where it's like that
  page is gonna need a better viewing mechanism because those cards take up so much space. And if someone has
  even a hundred batches, it's a lot scrolling to see them all in there."*
- The information-rich card is the right default for an inbox of tens (it is what makes a batch reviewable
  without opening it). At ~100 batches it stops working. Wanted: a compact/table mode toggle, or virtual
  scrolling, keeping the expandable per-account detail.
- **Trigger:** when a real inbox exceeds ~30 batches, or the batches feature slice.

---

## GL routing: links should carry a ROLE, and the company should come from the SALE (not the account)
- **Added:** 2026-07-16 · **Source:** Marcelo, GUI review · **Question:** [Q31](QUESTIONS.md#q31) (⏸ HOLD — needs Robert/Amith)
- **The defect in one line:** `buildDraftsForOrder` does `CompanyID: account.CompanyID` — the JE's company is
  **derived from the resolved account**. Cause is inferred from effect. Marcelo: *"You shouldn't be deriving
  the company based on the accounts."*
- **Why it is a real defect, not a preference:** `AccountingCompanyProfile.ParentAccountingCompanyID` already
  models *"this company uses that company's books."* Two such companies resolve to the SAME account and
  therefore collapse to the SAME CompanyID on the JE — **the derivation destroys the distinction that field
  exists to preserve.** Same for a "company" used as a brand. Both are cases the plan already intends to
  support.
- **Second-order effect (the UX complaint):** because `GLAccountLink` names a concrete ACCOUNT, overriding a
  product's routing from the **orders** app requires choosing an account out of some company's **accounting**
  chart — a sales user doing a ledger job, possibly without permission to see the chart. There is no account
  picker because there *shouldn't* be one in orders.
- **The shape of the fix (reuses what exists — not a rewrite):**
  1. **Company comes from the sale.** Candidate: `Product.OwningCompanyID` (exists, nullable) or an explicit
     line-level company. Needs Q31's answer.
  2. **Role comes from the hierarchy.** product → category chain → default, carrying a **role**, not an account.
  3. **(company, role) → account** is the company's chart mapping — **`ResolveCompanyAccount(companyID, role,
     asOf)` is ALREADY exactly this function.** No new lookup needed.
  - Then "Deferred Revenue — Physical" is a **new GLAccountRole**, and every company points it at its own
    account. Marcelo's lever, with no shared accounts and no commingling.
  - UI falls out: orders picks roles (business vocabulary, no chart access); accounting maps roles→accounts per
    company (chart access). Product workshop + Categories both get role pickers instead of account pickers.
- **Migration impact:** `GLAccountLink` would need to permit a role-only link (nullable `GLAccountID`), or a
  sibling "role assignment" concept. Existing account-carrying links stay valid as company-pinning overrides.
- **Two outright bugs from the same area — FIXED 2026-07-16, independent of the design question:**
  - The company tier was **dead in booking** (`ResolveAccount` called with 3 of 4 args) → the seeded company
    defaults were never consulted. Now passes `product.OwningCompanyID`.
  - The **Catalog disagreed with booking** (it passed the fallback; booking didn't), so the "will it book?"
    tripwire was optimistic and could show a product as resolved that fails at Confirm.
- **Also unresolved in this area (smaller, same root):** `AccountingCompanyProfile.AROpenGLAccountID` /
  `DeferredRevenueGLAccountID` / … are **columns the seed populates**, but booking reads **`GLAccountLink`
  rows** and never those columns. Two parallel wirings that do not agree — all 4 companies have the columns
  set; only 1 has an AR link. Pick one mechanism.
- **Trigger:** Q31 answered by Robert/Amith.

## Batches: single-company vs multi-company (plan says single; code says multi)
- **Added:** 2026-07-16 · **Source:** Marcelo, GUI review · **Question:** [Q30](QUESTIONS.md#q30) (⏸ HOLD — needs Robert)
- **DECIDED (Marcelo, 2026-07-16): ONE COMPANY PER BATCH.** *"Our marching orders as my decision are going to
  be one company per batch."* BA-D16 (the plan of record) already agrees; `D-SEQ` (a comment in the baseline
  migration, never recorded as a MOD) went the other way; `BatchingEngine`'s `OQ-F` left the question open.
  Q30 carries the full context for Amith — including that **MOD-4's netting key implies Amith assumed
  multi-company**, which is the one thing that could reverse this.
- **Why it is safe to build toward:** `JournalEntryBatch.TargetSystem` is a single column, so a batch already
  cannot address two ERPs; and no per-company endpoint exists anywhere, so two companies on two BC tenants are
  unrepresentable regardless. Single-company removes a problem the schema has no model for.
- **If the answer is single-company:** batch build groups by company (one batch per company × TargetSystem),
  `spAssignNextBatchNumber` returns to a per-company sequence, `BuildBatchOperation.CompanyIDs` collapses to
  one, and the "split at send" path disappears. Migration + engine + UI (the build criteria panel currently
  offers multi-select companies).
- **If the answer is multi-company:** BA-D16 must be superseded by a real **MOD** (it currently is not), and
  the per-company split at dispatch needs verifying — a batch carries ONE `TargetSystem` but N companies, and
  BA-D16 requires "one consolidated JE per Company".
- **Already safe either way:** MOD-4 nets per (Company × GLAccount × Dimension-combo), so money never nets
  across companies. Marcelo's netting worry is handled.
- **Trigger:** Q30 answered.

## Planning-system hygiene: decisions are being made in code comments, not the plan chain
- **Added:** 2026-07-16 · **Source:** fallout from Q30 · **Type:** process, not code
- Two plan-changing decisions were found recorded ONLY in source comments: **`D-SEQ` 2026-07-06** ("batches are
  multi-company", in the baseline migration) and **`OQ-F`** (the open question that shape depends on, in
  `BatchingEngine.ts`). Neither is a MOD/UPD/Extension. The planning system's rule is explicit — *"nothing is
  silently superseded"* and *"if it isn't in MASTER-PLAN(-MODIFICATIONS/-UPDATES), it isn't the plan"* — so
  **BA-D16 still reads as the plan of record and contradicts the shipped schema.**
- This is not pedantry: it is exactly why Marcelo read the plan, concluded single-company, and was contradicted
  by the code. A reader cannot tell which is current.
- **Action:** sweep the migrations + engines for `D-*` / `OQ-*` / "decided" comments that alter the plan, and
  land each as a MOD/UPD with its reciprocal inline marker — or withdraw it.
- **Trigger:** next planning pass; do it before the batches slice, since Q30 depends on it.

---

## ★ HIGH — The account/ERP/routing model: consolidate, de-duplicate, and stop deriving company from account
- **Added:** 2026-07-16 · **Source:** extended design discussion with Marcelo (GUI review) · **Question:** [Q31](QUESTIONS.md#q31)
- **Marcelo, 2026-07-16:** *"all of the information about the accounts here, everything you've output to me,
  everything I'm saying, it needs to be filed as a backlog item, and we're gonna pick it back up tomorrow as
  one of our high priority ones. But it's just that it can't be done right now... I'm beginning to understand
  what your issue was, and it's basically that our system isn't designed to support this level of flexibility."*

### The good news, discovered while writing this up: MOST OF THE MODEL ALREADY EXISTS
Marcelo asked for *"an entity that models the ERP account... because we're gonna need to store ERP credentials
at some point anyway"*. **It is already built.** The layering as-shipped:

| Layer | Entity | Job |
|---|---|---|
| The account | `GLAccount` | a row in exactly ONE company's chart (`CompanyID` NOT NULL, `UNIQUE(CompanyID, Code)`) |
| **ERP identity** | **`ChartOfAccountsMapping`** | `CompanyID` + `ExternalSystem` + `ExternalAccountID` + `ExternalAccountName` ("snapshot for audit") → `InternalGLAccountID`, **date-effective** (`EffectiveFrom`/`EffectiveTo`) + **approved** (`ApprovedByUserID`/`ApprovedAt`/`ChangeNote`) |
| The wiring | `GLAccountLink` | polymorphic `(EntityID, RecordID, RoleID)` → `GLAccountID`, date-effective |

**Two of Marcelo's premises are factually wrong, and correcting them shrinks the work:**
1. *"a GL account link seems to only link a company"* — **no.** It is polymorphic; the live data contains
   **Products→Sales** and **Products→Deferred Revenue** links. It links any record of any entity.
2. *"we need free floating accounts that can be linked to a company, but not necessarily take up one of the
   default roles"* — **that is just a `GLAccount`.** Accounts exist independently of links; nothing forces an
   account into a role. The only thing missing was a page to create one — **shipped 2026-07-16** (All accounts,
   `gl-accounts.page.ts`).

**His product-type→role model is also ~80% built.** `OrdersEngineBase.RevenueRoleFor()` is literally
`product.RevenueRecognitionType === 'Deferred' ? 'Deferred Revenue' : 'Sales'`, and `ProductType` already
carries `DefaultRevenueRecognitionType`, `IsBillableRecurring`, `DefaultSubscriptionType`,
`RequiresFulfillment`, `BehaviorClass`. Marcelo: *"in the product type itself, you're gonna select which role
it goes to... how we handle the revenue of that product is gonna be specified by the type of that product."*
**The gap:** `Product.RevenueRecognitionType` is a COPY on the product, not read from its type at resolve time,
so changing a type does not re-route its products.

### The REAL defects (this is the actual work)
1. **Company is derived FROM the account.** `buildDraftsForOrder` does `CompanyID: account.CompanyID`. Cause
   inferred from effect. Marcelo: *"deriving a company from account is not a good system."* It also **breaks
   `ParentAccountingCompanyID`** (shared books): two companies sharing books resolve to the SAME account and
   collapse to the SAME CompanyID — the derivation destroys the distinction that field exists to preserve.
   **Agreed direction (Marcelo):** *"company comes from the product, role comes from the hierarchy, and then
   company and role together can determine account, and that is the goal. We don't want someone picking the
   account at the configure the product."*
2. **THREE duplicated wirings, none agreeing:**
   - `GLAccount.ExternalSystem`/`ExternalAccountID` (columns) **vs** `ChartOfAccountsMapping` (entity). Both
     model account→ERP. Marcelo: *"an account should be an entity that handles the linking to an ERP."* The
     mapping entity is strictly better (dated + approved + audit snapshot). Pick one.
   - `AccountingCompanyProfile.AROpenGLAccountID`/`DeferredRevenueGLAccountID`/… (columns, **populated by the
     seed for all 4 companies**) **vs** `GLAccountLink(Companies, X, role)` (rows, **present for only 1**).
     **Booking reads ONLY the rows.** Marcelo: *"this is the exact example of why we need standalone accounts."*
   - `Product.RevenueRecognitionType` (copy) **vs** `ProductType.DefaultRevenueRecognitionType` (source).
3. **Company is overloaded as an ERP identity.** Marcelo: *"we are treating companies as ERP identities... we're
   assuming that each company is going to send to one ERP system and that different companies, even though they
   could use the same system integration, they aren't gonna use the same ERP identity."* `ChartOfAccountsMapping`
   is keyed `(CompanyID, ExternalSystem)`, which bakes that assumption in. A separate **ERP Connection/Account**
   entity (the natural home for credentials too) would let Company go back to meaning a company. **Note this is
   ALSO what Q30 (single-company batches) collides with** — a batch has one `TargetSystem` and no endpoint.

### The shape of the fix
- Stamp the resolved **triple (CompanyID, GLAccountID, GLAccountRoleID) on the ORDER LINE at booking time.**
  Marcelo: *"each line should have company and account that gets the resolved account, and it should also have
  the role because all three of those features are very important at that level."*
  **Store, do not derive — and the reason is not efficiency, it is immutability.** A JE booked to company A must
  not silently become company B because someone re-pointed the product later. Config resolves live; the booked
  fact is history and must be frozen. Precedent in this schema: `OrderLine.LineTotalNet` is stored rather than
  re-derived; `JournalEntryBatch.TotalEntries/TotalDebits` are denormalized *"for fast batch dashboards."*
- Resolution becomes: **company** ← the product (or its type) · **role** ← the product TYPE, overridable up the
  category chain · **account** ← `ResolveCompanyAccount(company, role)` — which **already exists** and is
  exactly `(company, role) → account`.
- Then the UI Marcelo wants falls out: product/category configure a **role** (business vocabulary, no chart
  hunting); accounting maps **role → account per company** (chart access); ERP mapping stays where it already
  is (`ChartOfAccountsMapping`). Nobody hunts ERP numbers in orders. Marcelo's correction, recorded:
  *"orders is really meant to be used by the accounting team... orders is basically invoices under the hood"* —
  so orders MAY name accounts; it just shouldn't require hunting ERP identifiers to do it.
- **Already fixed 2026-07-16 (independent of the above):** the company tier was DEAD in booking
  (`ResolveAccount` called with 3 of 4 args), and the Catalog ran a more optimistic resolution than booking.

### Sequencing
Marcelo, 2026-07-16: *"it can't be done right now. It's too complicated, and it's late at night. What I need to
do is kind of get the GUI set up so I can get a basic demo out."* **Picked up tomorrow as a high priority.**
- **Trigger:** tomorrow's session. Q31 carries the discussion; this carries the work.

---

## ★ HIGH — Product/Category "own chart of accounts": make the ROLE data, not a hardcoded ternary
- **Added:** 2026-07-16 · **Source:** Marcelo, extended account discussion · **Question:** [Q31](QUESTIONS.md#q31)
- **His crucial finding, verbatim:** *"we aren't really supporting the case where product wants to link to an
  account that isn't in a company's chart, where a category wants to link to an account that isn't in a
  company's chart. What I'm thinking has to happen here is that the product and the category also have to have
  their own chart of accounts. Okay. That is the crucial finding here. That is key. That is important... What
  that does is it lets us have a set chart of known types of accounts, but we can set it at different levels in
  the hierarchy."*
- **Assessment: he has re-derived `GLAccountLink`, and it already does this.** A product carrying several links
  (one per role) IS a per-product chart; same for a category. The link is polymorphic and can point at ANY
  `GLAccountID`, including one outside the product's own company's chart. **So the capability exists.** The
  reason it feels impossible is the derivation bug: because `buildDraftsForOrder` does
  `CompanyID: account.CompanyID`, linking a product to an account outside its company SILENTLY re-books the
  revenue to that account's company. Fix the derivation and his design works with **zero new schema**.
- **The genuinely missing piece — and he named it exactly:** *"the revenue for role thing being like a big if
  statement, that sounds like maybe it's not gonna work... We should have product roles or product types stored
  in the database and some default ones loadable from metadata. **They should not be based on the results of a
  function.** Remember, we want our GUI to be a thin wrapper over the metadata and the database."*
  - **Today:** `OrdersEngineBase.RevenueRoleFor()` is
    `product.RevenueRecognitionType === 'Deferred' ? ROLE_DEFERRED_REVENUE : ROLE_SALES` — a hardcoded ternary
    over two string constants.
  - **The cost, measured:** there are **8 GLAccountRoles in the database** (Cash, Accounts Receivable,
    Inventory, Cost of Goods Sold, Sales, Sales Discounts, Sales Returns and Allowances, Deferred Revenue).
    **Six are unreachable from a product**, because a ternary can only ever return two. Marcelo's own use case
    ("a certain deferred revenue account for one category of products") is un-expressible for the same reason.
  - **The fix: `ProductType.GLAccountRoleID` (FK → GLAccountRole).** Then role is DATA. New roles work the day
    they are seeded; no code change. This is also exactly his product-type→role model:
    *"in the product type itself, you're gonna select which role it goes to. So you might say, okay. This
    product goes to the deferred revenue role because it's a physical product, and it needs to still be
    shipped, or it goes to the deferred revenue role because it's a subscription. Or we could say this goes to
    revenue because it's already sold. How we handle the revenue of that product is gonna be specified by the
    type of that product."*
  - Default roles seeded from **metadata**, not a migration constant, per the thin-wrapper rule.
- **`Product.RevenueRecognitionType` is NOT a bug — it is an override, and it is named so.** The type's column is
  `**Default**RevenueRecognitionType`; the product's value overrides it. **What IS missing:** nothing seeds the
  product's value from its type at create time, and there is no way to express *"inherit from my type"*
  (the column is NOT NULL, so there is no null-means-inherit). Decide: nullable-means-inherit, or an explicit
  `InheritsRevenueFromType` flag.
- **Where the editing UI lives — his ruling, and it is right:** *"thinking about where that chart of accounts
  needs to go, I'm kind of thinking that it needs to go in the product and category sections just because
  having it in accounting doesn't make sense. Products and categories don't exist in the accounting app.
  They're just not known things in that app. And we shouldn't have dependencies that point down the dependency
  tree. Orders depends on accounting. It should be using the elements in accounting if it needs to. The other
  way around doesn't make sense."*
  Confirmed by today's search sweep: `account-links.page.ts` (accounting) **cannot name** a Products or
  Product-Categories link target — it renders *"Not named here"* — precisely because accounting must not import
  orders. So the product/category account UI belongs in ORDERS. Already true of the Product workshop's GL tab.
- **Scope:** migration (`ProductType.GLAccountRoleID`; the inherit decision) · replace `RevenueRoleFor` with a
  lookup · seed default roles from metadata · Product workshop + Category workshop expose the role.
- **Trigger:** tomorrow (Marcelo: *"we'll pick it back up tomorrow as one of our high priority ones"*).

## Point-in-time facts: audit the accounting system for references that should be stored values
- **Added:** 2026-07-16 · **Source:** Marcelo — *"that's a really good point out you made that we have to have
  real history. So, yes, things need to be stored on the order line, not referenced, unfortunately. As
  point-in-time facts. File a backlog item to think more about the kind of point-in-time fact thing. I think
  we're gonna find a lot of cases throughout the accounting system where references might need to be something
  different."*
- **The principle:** accounting records are history and must be immutable. A live FK to config means history
  MUTATES when config changes — a JE booked to company A silently becomes company B when someone re-points the
  product. **Config resolves live; the booked fact is frozen at the moment of booking.**
- **The precedent is already in this schema** (so this is consistency, not novelty): `OrderLine.LineTotalNet` is
  stored rather than re-derived from qty×price×discount; `JournalEntryBatch.TotalEntries/TotalDebits/TotalCredits`
  are denormalized *"for fast batch dashboards"*; `ChartOfAccountsMapping.ExternalAccountName` is explicitly a
  *"snapshot for audit"*. The pattern is established; it is just applied unevenly.
- **First concrete case:** stamp the resolved **(CompanyID, GLAccountID, GLAccountRoleID)** on the ORDER LINE at
  booking time. Marcelo: *"each line should have company and account that gets the resolved account, and it
  should also have the role because all three of those features are very important at that level."*
- **The audit:** sweep every accounting/orders entity for a live reference whose value is part of a historical
  record — prices, tax rates, FX rates, customer names/addresses on an invoice, payment-method descriptors,
  approver identity. For each: is it config (resolve live) or history (freeze)? Where it is history, is there a
  stored column, and does anything actually write it?
- **Trigger:** tomorrow, alongside the account-model item — the order-line triple is the shared first step.

## Payment providers: `IsActive` exists but nothing appears to honour it
- **Added:** 2026-07-16 · **Source:** Marcelo — *"we at least need a backlog item for being able to mark
  providers as active or inactive, and we'll have to wire that through the system as well."*
- **Correction:** `PaymentProvider.IsActive` (bit, default 1) **already exists**, and the new Payment providers
  page (2026-07-16) edits it. The field is not the gap.
- **The gap is the wiring**, which is his actual ask: nothing has been verified to RESPECT it. An inactive
  provider should not be selectable on payment entry, should not be dispatched to, and should not be picked by
  any default-provider resolution — but an unhonoured flag is worse than no flag, because the UI implies a
  control that does nothing. Same shape as `AccountingCompanyProfile`'s default-account columns, which the seed
  populates and booking ignores.
- **Do:** find every provider selection/resolution path and gate it on `IsActive`; decide what happens to
  in-flight payments on a provider that goes inactive (they must still settle — deactivation is not deletion).
- **Trigger:** the payments slice.

## Shared books (`ParentAccountingCompanyID`) — allow a child company to override within the shared chart
- **Added:** 2026-07-16 · **Source:** Marcelo — *"I wasn't really aware of that parent accounting company ID,
  but that actually seems like a really good system, so I'm glad we have that. We should probably have that work
  like the hierarchy. So basically it's required that those two are under the same chart of accounts mapping,
  but you might be able to override at the secondary company level. Like, if a company that has a parent company
  wants to have its products go to a different account within the same chart of accounts mapping, it should be
  able to."*
- I.e. shared books should behave like the product→category→company resolution hierarchy: the parent supplies
  the chart + the defaults; a child may override its own role→account mapping **within** that chart, and must not
  be able to point outside it.
- **Blocked by the same defect:** while the company is derived FROM the account, a child overriding to a
  different account changes which company the JE belongs to — the exact opposite of the intent. `ParentAccountingCompanyID`
  cannot work correctly until the derivation is fixed (see the ★HIGH item above).
- **Trigger:** after the account-model fix.

---

## ★ Audit every MJ override: what intended behaviour is each one silently opting us out of?
- **Added:** 2026-07-17 · **Source:** Marcelo — *"go look for places where you've overwritten stuff in MJ
  and determine if that's removing what was intended and well designed behavior that was underlying,
  and then we're gonna have to have a conversation about which one of those overrides is worth it and
  which is not."*
- **Why this is not paranoia — TWO real cases surfaced in a single day, both by accident:**
  1. **`.mj-btn` height override** — added to satisfy "uniform vertical sizing" in the header. It forced
     `height: 100%` + 30px onto MJ's button. MJ's own `.mj-btn--sm` is `min-height: 32px`, so we forked
     MJ's styling for **2px** — and MJ grows that button to **`min-height: 44px` under a small-screen
     media query**, the **WCAG touch-target minimum**. Our override would have squashed it back to 30px
     on a phone, silently undoing an accessibility accommodation nobody knew was there. **Caught by MJ's
     own CI gate**, not by us.
  2. **`.mj-page-header-title` font-size override** — forced `--mj-text-lg`. MJ's title is
     `--mj-text-xl` and MJ **already** drops it to `lg` under a `<=768px` media query. So the override
     **pinned MJ's small-screen size onto desktop permanently**, defeating a responsive decision MJ had
     already made. **Nothing caught this but Marcelo's eye** — and he read the symptom backwards ("the
     capsule is almost larger than the title"), because the badge was innocent: the title had shrunk.
- **The generalised lesson, which is the point of the audit:** **an override does not merely restyle a
  component — it opts you out of decisions the component already made, including ones you do not know
  about.** Responsive breakpoints, touch targets, focus rings, reduced-motion, RTL, dark-mode
  adjustments, aria wiring. Every `::ng-deep` into MJ chrome is a silent opt-out of an unknown set.
- **THE AUDIT — do this:**
  1. Enumerate every `::ng-deep` / descendant selector reaching into an `mj-*` component across both
     apps: `grep -rn "::ng-deep" packages/dev-apps/*/packages/Angular/src --include=*.css`
  2. For EACH, open the MJ component's own stylesheet and read **what else** that selector's target
     participates in — **specifically look for `@media` blocks, `:focus-visible`, `prefers-reduced-motion`,
     `prefers-color-scheme`, `[dir=rtl]`, and `aria-*`-driven rules**. That is where the invisible
     decisions live, and it is exactly where both known cases hid.
  3. Classify: **(a) delete** — MJ already does it, or does it better (both known cases were this);
     **(b) keep, narrowed** — the override is real but is reaching wider than it needs;
     **(c) keep + ask upstream** — a genuine gap; file a question to Matt (Q27/Q33 are the pattern).
  4. Bring the (b)/(c) list to Marcelo: *"we're gonna have to have a conversation about which one of
     those overrides is worth it and which is not."*
- **Known survivors to start from** (as of 2026-07-17, after both fixes):
  - `category-shell.css` — header row padding (density). The ONLY remaining chrome override; type scale
    and icon size were reverted to MJ. Asked upstream as `Dense` (**QUESTIONS.md#q33**) — and that
    question is **already flagged possibly-obsolete**, since moving the stat chips to `[meta]` may remove
    its reason for existing entirely.
  - `category-shell.css` — uniform control height in `[actions]` (scope chip + refresh). Deliberately
    does NOT touch `.mj-btn` any more; the chip matches MJ's button rather than the reverse.
  - `workspace-tab-strip.component.css` — `overflow-y: hidden` + `:host{display:block}`. This one is a
    **bug fix, not a preference** (**QUESTIONS.md#q32**, and filed to `MJ-UPSTREAM.md`) — it should leave
    us entirely by going upstream.
- **Already retired by this pattern — evidence the audit pays:** the bespoke disclosure sections
  (**`mj-accordion-panel [Bare]` already existed** and does it better, with aria we never wrote) and the
  bespoke nav rail (deleted in favour of `mj-left-nav` during the §8 build).
- **Do it in the same pass:** finish the **deviations register** Marcelo asked for — a durable document
  of every non-MJ element and every override, with its justification and its reversal condition. The
  audit produces exactly that list, so the two are one job.
- **Trigger:** next UI session. Cheap (it is a grep + a read per hit) and it directly answers the boss's
  note about following MJ's UI/UX guidelines and controls.

---

## ★★ IMPERATIVE (Marcelo, 2026-07-17) — creation goes through ENGINES + REMOTE OPS. The front end is a wrapper.
- **Needs a MOD.** This is an architectural ruling, not a backlog item — it belongs in the plan chain, not
  here. Filed here only because it landed at the end of a session; **promote it to MASTER-PLAN-MODIFICATIONS
  on the next planning pass** or it will be a decision living outside the plan, which is the exact failure
  D-SEQ/OQ-F already caused (see the planning-hygiene item above).
- **His words, verbatim — treat as authority:** *"Orders should be created in a remote operation every time.
  Let me just set down a groundwork rule here, which is that we should always be using remote operations to
  create journal entries, create orders, create products, create anything, basically. We shouldn't be doing
  it on the client side. We should be doing it on the server side. We should mostly be doing it in
  transactions because a lot of these things link together, and this is an accounting system. So we can't
  have broken data in it. We should be using engines and remote ops for all of this stuff and for its
  validation. Let me make sure this is an imperative. **The front end is just supposed to be a wrapper that
  helps format the input and tells the user what they need to do and presents the information in a useful
  way. That's it. That's the whole front end. It's not supposed to be doing creation logic and interacting
  with the server. We're supposed to use engines for that.**"*
- **Why he is right, demonstrated the same day:** the order-create FK failure. `order-editor.page.ts` composes
  an order + its lines in a client-side `CreateTransactionGroup()`. TransactionGroups do not cross the
  GraphQL boundary — so a unit of work assembled in the browser is a unit of work the server never sees as
  one. It failed on `FK_OrderLine_Order` and (on our stale base) took MJAPI down with it.

### ✅ RESOLVED 2026-07-17 — the refinement is RATIFIED, and it is MJ's documented rule
Marcelo: *"I understand your idea. It's not never save. It's just, yeah, never orchestrate, never derive on
the front end. Yeah. Let's go with that instead."* — and he told the agent to verify against MJ's standards
rather than take its own word. **Verified. All three sources agree:**

1. **MJ's Transport-Layer Architecture Guide, line 5 (verbatim):** *"**This is NOT for plain CRUD.** Every
   entity already gets a generated, secured, typed API (views + spCreate/spUpdate/spDelete + GraphQL types)
   via CodeGen, consumed in the UI through `RunView` / `GetEntityObject` / **`BaseEntity.Save()`**. Do **not**
   hand-write a resolver or a GraphQL client for ordinary record reads/writes — use the generated entity
   layer. This guide is for **custom operations** that aren't a single-entity CRUD call: cross-entity logic,
   compute-heavy work, third-party calls, **orchestration**, anything with real business logic."* Its decision
   table: *"Plain single-entity CRUD — use generated entity layer (RunView/BaseEntity)."*
2. **MJ's Remote Operations Guide** decision table: *"Table-backed record **CRUD** → **`BaseEntity`**
   (already generated)."*
3. **Amith (via Marcelo, 2026-07-17):** *"we should make sure that we are using Remotable Operation for
   **larger chunks of logical work** if we want a simple encapsulated unit of work for something big. **It is
   also fine to use BaseEntity sub-classes to create Order and OrderLine type records one at a time.**"*

**So: there is NO MJ rule against `BaseEntity.Save()` — the rule is the opposite.** MJ explicitly says do not
wrap plain CRUD in a resolver. Putting a 5-field roster behind a remote op would CONTRADICT MJ's guidance.
(Marcelo suspected a prohibition existed — *"I think there might be something that tells us not to use base
entity save... but I'm not really sure"* — searched: no such rule exists anywhere in `guides/`.)

**THE RATIFIED LINE — "never ORCHESTRATE, never DERIVE" on the front end.** The client may ask the server to
create ONE row through the generated entity layer. The client must never: (1) orchestrate a multi-record unit
of work (TGs do not cross GraphQL), (2) compute a derived value (totals, balances, GL/company resolution),
(3) enforce an invariant (a second client bypasses it).

### AMITH'S ADDITIONAL DIRECTION (2026-07-17) — and note it is ALREADY BUILT
- *"Make sure that all logic stays encapsulated in BaseEntity subclasses for the whole system and the UX is
  just a thin/dumb wrapper."*
- *"It is critical that the Journal Entry/Journal Entry Line Items are created through a singular call to an
  **AccountingEngine.CreateJournalEntry** type of method so that we have a proper transaction wrapper."*
  → **exists**: `CreateJournalEntryOperation` / `Accounting.CreateJournalEntry`.
- *"The logic for the journal entry creation belongs in the **OrdersEngine** because that order engine is where
  we will know to look at the Product definition to look up its accounting rules (rev rec type per RK comment)
  as well as looking up its **ProductGLAccount** rows. We should be using **metadata caching** for the
  Product/GLAccount type info in the **OrdersEngineBase** (which we can wrap for easy access in the server-only
  **OrdersEngine** class that simply wraps the base class for convenience like the **AIEngineBase/AIEngine**
  pattern)."*
  → **This is verbatim what `OrdersEngineBase`'s file header already says it does.** The engine is RIGHT. The
  problem is that `order-editor.page.ts` BYPASSES it — hand-rolling the transaction in the browser instead of
  calling the engine. **So this is not a build, it is a re-route.**
- ⚠ **"ProductGLAccount rows"** — Amith names a product→account concept directly. **Put this in front of him
  alongside [Q31](QUESTIONS.md#q31)**: today that relationship is the polymorphic `GLAccountLink`, and Q31 asks
  whether product/category links should carry a ROLE instead of an account. His phrasing suggests he pictures
  something more specific. That is a real signal for tomorrow's account-model session.

### ORIGINAL PROPOSAL (retained for the record)
**`BaseEntity.Save()` is ALREADY a server-side operation.** The client writes no SQL: `GetEntityObject` →
`Save()` marshals over GraphQL, runs the server's `BaseEntity` subclass (its `Validate()`, its hooks — e.g.
`OrderEntityServer` books the JE there), and calls `spCreate*`. So a single-row create through the entity
layer is not "creation logic on the client" — it is the client *asking the server to create a row*.

**Proposed line: "never ORCHESTRATE, never DERIVE"** rather than "never `Save()`". The client must not:
  1. **Orchestrate a multi-record unit of work** — TGs do not cross GraphQL (tonight's bug).
  2. **Compute derived values** — totals, balances, GL/company resolution.
  3. **Enforce invariants** — it cannot; a second client bypasses them.
Under Marcelo's rule as literally stated, a 5-field Product Category roster needs a remote op. Under the
refinement it does not — while **Order, Payment, JE, and product+GL-links still do**, because every one is
multi-record or derived. **Same outcome where it matters, far less ceremony where it does not.**
**If Marcelo rejects the refinement, the literal rule stands and the sweep below widens to every roster.**

### Blast radius (audited 2026-07-17) — what violates the rule TODAY
**Definitely violating (multi-record orchestration in the browser):**
- `order-editor.page.ts` — `CreateTransactionGroup()` composing order + lines. **This is the one that broke.**
  → `Orders.CreateOrder` remote op. (`Orders.ConfirmOrder` already exists and is the model.)
- `payment-entry.page.ts` — same client-side TG for payment + its lines.
- `payment-capture.page.ts` — saves each Payment Line individually; **already states on screen that the write
  is not atomic** because no apply-payment op exists. → `Orders.ApplyPayment`.
- `product-workshop.page.ts` — product + its GLAccountLink rows, saved separately.
- Category workshop (planned, GUI-26) — bulk-reassigning N products' `ProductCategoryID` is N saves.
**COMPLIANT under the ratified rule — leave them alone:** `categories`, `product-types`,
`payment-terms-types`, `payment-providers`, `subscription-plans`, `gl-accounts`. Each creates ONE row through
the generated entity layer, which is precisely what MJ's Transport-Layer guide says to do and what Amith
explicitly blessed ("fine to use BaseEntity sub-classes... one at a time"). **Wrapping these in remote ops
would violate MJ's documented guidance, not satisfy it.** The one caveat: if a roster ever grows a derived
value or a second-record write, it crosses the line and needs an op.
**Already compliant:** `Orders.ConfirmOrder`, `Orders.CapturePayment`, `Orders.CreateReversalOrder`,
`Accounting.CreateJournalEntry`, `BuildBatchOperation`.

### Sequencing
Pairs with the ★HIGH account-model item: `Orders.CreateOrder` is where the (CompanyID, GLAccountID,
GLAccountRoleID) point-in-time triple gets stamped on the order line — so build the op once, correctly,
rather than patching the client path first and rewriting it a day later.
**Do NOT fix the order-create FK on this base:** the instance predates PR #3097 (the TG crash fix, which
touched this exact Save()/TG-notification path). Upgrade first (`mjdev merge accounting-engine-dev`), re-test,
then build the op.
- **Trigger:** tomorrow, with the account model.


## Engine operations needed — one per orchestrating page (from the ★★ imperative above)
- **Added:** 2026-07-17 · **Source:** Marcelo — *"then we're gonna need backlog items for all of those
  workspace pages because we're gonna need engine operations for them is my guess."* He is right; scoped below.
- **The rule they all satisfy:** each composes MULTIPLE records and/or DERIVES values, so per the ratified
  line (and MJ's Transport-Layer guide, and Amith) each needs one encapsulated server-side unit of work.
  **Logic in the engine; the op is a thin transactional wrapper; the page becomes a dumb form.**

| Op | Page it replaces | Why it must be an op | Notes |
|---|---|---|---|
| **`Orders.CreateOrder`** | `order-editor.page.ts` | order + N lines + N journal entries (one per company — MOD-11), derives GL/company resolution | ★ FIRST. Amith: JE creation logic belongs in **OrdersEngine**, calling **`AccountingEngine.CreateJournalEntry`** as a *singular call* for the transaction wrapper. **Both already exist** — the editor just bypasses them. Also stamps the point-in-time (CompanyID, GLAccountID, GLAccountRoleID) triple on each line. |
| **`Orders.CreatePayment`** | `payment-entry.page.ts` | payment + N payment lines, in one client-side TG today | Same defect class as the order editor. |
| **`Orders.ApplyPayment`** | `payment-capture.page.ts` | N payment-line writes + recompute of each order's AmountPaid/Balance/PaymentStatus | The page **already tells the user on screen it is not atomic** — that notice comes out when this lands. |
| **`Orders.SaveProduct`** | `product-workshop.page.ts` | product + its GLAccountLink rows | The product alone is a single-row save (fine); it is the LINKS that make it a unit of work. |
| **`Orders.AssignProductsToCategory`** | category workshop (GUI-26) | bulk `ProductCategoryID` update across N products | Do NOT ship a multi-select that half-applies. |

- **Sequencing — do NOT start on this base.** The instance predates PR #3097 (Marcelo's own TransactionGroup
  crash fix), which touched the exact `Save()`/TG-notification path these pages fail through. **Upgrade
  (`mjdev merge accounting-engine-dev` + `mjdev setup`), re-test, then build.**
- **Build `Orders.CreateOrder` FIRST and together with the ★HIGH account-model item** — it is where the
  point-in-time triple gets stamped, so building it before that decision means writing it twice.
- **Reference:** `ConfirmOrderOperation` / `Orders.ConfirmOrder` is the working model — typed client in
  `order-editor.client.ts`, op server-side, TG composed where TGs actually work.

## Batch findability — add `JournalEntryBatch.Memo` (schema)
- Source: Marcelo 2026-07-17. "We at least need to have a memo with batches if we don't already have that." Confirmed: JournalEntryBatch has BatchNumber/TargetSystem/Status/ExternalBatchRef/ErrorMessage — NO memo/name/description.
- Keep `BatchNumber` as the agreed ID (D-SEQ). Add optional `Memo NVARCHAR(500) NULL` purely for findability — so a user can label "why this batch" and search it. NOT a rename of the ID scheme.
- Proposed: migration adds Memo; surface it in All Batches + Batch workspace (editable pre-build), searchable (task 41/47). Marcelo leaning "naming batches maybe not, but a memo yes" — so memo, not a Name field.
- Note: JournalEntry already HAS a Memo — for JEs no schema change is needed, just show the memo in JE tables + drive the tab caption (task 47).

### ⚠ DECIDED 2026-07-17 — the naming/memo model (ratified by Marcelo)
Accounting-norm model: **transactions = number + memo/description; master data = names.**
- **Journal entries:** Memo ALREADY exists — no schema. Surface it in JE tables + drive the tab caption; include in search.
- **Batches:** keep `BatchNumber` (agreed D-SEQ id) + **ADD `JournalEntryBatch.Memo NVARCHAR(500) NULL`** — the ONLY migration in this feature. Surface + search it; editable pre-build in the workspace.
- **GL accounts / dimensions:** already named — ensure name+ID search. No schema.
- **Migration instruction (Marcelo 2026-07-17):** we are NOT doing version migrations yet — **edit the BASELINE migration directly** to add the batch Memo column (do not add a new V* file). Applying it needs a drop-schema + re-migrate (destructive) — sequence it with the test-data reset (#37), not mid-dev.
- **Perf tripwire (task 41):** name/memo search uses indexed columns + `LIKE` contains, fine to ~100k rows. If any searchable list realistically exceeds ~100k, move THAT list's search from `LIKE '%…%'` to MJ full-text search (guides/FULL_TEXT_SEARCH_GUIDE). Don't pre-optimize.
