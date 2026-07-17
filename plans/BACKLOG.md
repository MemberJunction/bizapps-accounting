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
- [ ] **Tax first iteration: order-line-type vs separate tables** — pick one (Robert offered the quick
      path; accounting tax tables exist either way). `[decision needed: Robert]`
- [x] ~~**IntercompanyRelationship wiring ownership**~~ — **RESOLVED 2026-07-13 (verified from the
      baseline):** the 2026-07-06 squash ruling already answered it — wiring is Payments-side; Accounting
      does no intercompany balancing. Residual (Q20): at O2 design, sanity-check with Amith where the
      wiring table lives + how per-pair accounts provision into the COA. `[residual: Amith, at O2]`
- [ ] **Open-AR cutover** — import open BC invoices pre-go-live (payments apply in the new system) vs
      let pre-cutover AR close out in BC. Matters for the ≥2026-08-17 cutover.
      `[decision needed: Robert/Jeremy]` — 2026-06 rescope rulings §12.
- [ ] **Manual-JE approval gate** — require approval before a `Manual` JE can be batched? Folds into the
      MOD-9 role/status-rule design (action-plan A2). `[decision needed: Robert]` — 2026-06 rescope
      rulings §12.

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
