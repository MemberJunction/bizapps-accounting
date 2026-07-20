# MASTER-PLAN-UPDATES — bizapps-accounting

A **living collection** (overlay) of **small refinements/additions** to existing `MASTER-PLAN.md`
sections — changes that keep a section's intent (new field, clarified behavior). Edit entries in place as
decisions evolve; never self-contradictory (git is the history); IDs stable/never reused; reciprocal ➕
inline markers kept in sync. Reversals/supersessions go to `MASTER-PLAN-MODIFICATIONS.md` (MOD-*);
meaningful scope expansion is an Extension. **Precedence: Modification > Update > Extension > original
text.** Convention: `~/MJDev/shared-plans/repo-planning-system.md` §3.1.

---

## UPD-1 — Guiding principle: mirror real-world accounting practice (2026-06, formalized 2026-07-11)
- **Amends:** MASTER-PLAN.md §1 (Context and positioning) — makes Amith's design ethos explicit; intent
  unchanged.
- **Change:** the app must **mirror real-world accounting practice and structure** so professional
  accountants/auditors find it approachable and auditable — between "technically convenient" and "what a
  real ledger does," do what a real ledger does. Framing: an **AR subledger of record** — ingest upstream
  output, batch + lock, post summaries to the GL. Integrity via the **strictest practical DB-level
  controls (triggers)** — no blockchain-style store; trust a CFO-level human not to bypass them; correct
  mistakes with **adjusting/corrective entries (pen, not pencil)**, never by editing locked history.
  Corollary: generate our own deterministic test data and validate changes against it.
- **Why / source:** Amith 2026-06-05 transcript + 2026-06-28 rulings —
  `meetings/2026-06 - Amith rescope rulings (extracted from retired v2 plan).md`. Formalized when the
  parallel "v2 plan" doc was retired (Marcelo directive 2026-07-11).
- **Status:** Accepted (already the as-built philosophy — the triggers doctrine + invariant test matrix).

## UPD-2 — BC dispatch goes straight to the API (no CSV step); write-scoped app registration; BC company-config standardization (2026-07-17)
- **Amends:** MASTER-PLAN.md §8.4 (batch dispatch) — mechanism refinement, intent unchanged (the
  batch boundary was always the ERP wire format: account numbers, not internal IDs).
- **Change:**
  1. **Skip the CSV validation step** (P4's interim idea) — build directly against BC's REST API:
     standard **API v2.0 `companies({id})/journals({journalId})/journalLines`** (or
     `generalJournalLines`), authenticated via **Azure AD OAuth client-credentials** — the only
     supported path (BC SaaS allows no direct DB writes). Jeremy shares the existing tenant/app
     registration setup so we don't start from scratch. Posting date is API-settable to any date
     (per Jeremy — verify with a test post).
  2. **Separate, purpose-built app registration for journal WRITE** — Jeremy's recommendation:
     don't widen the existing read-only reporting registration (Clara's); stand up a registration
     scoped just to journal posting. (Robert's call to confirm.)
  3. **BC company-config standardization precedes integration wiring** — 9+ BC companies with
     inconsistent posting groups / number series / dimensions / journal templates would turn into
     per-company API special cases. **Jeremy owns** researching + standardizing. Tracked as an
     external dependency of D.6 dispatch; Robert + Marcelo aligned ("simple and consistent is
     better").
- **Why / source:** Jeremy + Robert, `meetings/2026-07-17 - User Feedabck over the week 07-12.md`
  (P4 thread); REST-over-MCP preference in `meetings/2026-07-14 - Accounting Meeting.md`.
- **Status:** Accepted.

## UPD-3 — Forms-first UX: MJ Entity Forms are the basis of the UI; widgets shared with dashboards (2026-07-17, Amith)
- **Amends:** the app's UX approach (the master plan is schema/engine-focused; this records the
  binding UI-architecture direction the action plans execute). Refines — does not replace — the
  element doctrine (modal = quick action, slide-in = quick view, page = depth).
- **Change:**
  1. **Every core entity gets a first-class MJ Entity Form** (extend the generated form via
     `@RegisterClass(BaseFormComponent, …)`; MJ's Forms Architecture guide is the recipe;
     **reference implementation per Amith: the agents app's forms** — the custom AI-Agent forms
     in MJ core-entity-forms), composed of **reusable widgets that dashboards embed directly** —
     the drill-in form and the dashboard panel are the same components ("truly one UX").
  2. **No bespoke pop-ups:** modal/slide-in surfaces render the entity form through MJ's form
     host (`forms.open()` / `<mj-form-dialog>` / `<mj-form-slide-in>` + `EntityFormConfig`) —
     never one-off popup components.
  3. **Reuse `ng-entity-viewer` + User Views** for entity browse surfaces (e.g. Chart of
     Accounts) instead of rebuilding grid UX.
  4. **Manual JEs (C.8) carry three hard requirements:** provenance unmistakable on every JE
     surface (origin lineage loud — Orders/Payments/app vs Manual); creating/approving is
     authorization-gated (the Q6 Accounting-Approver enforcement); manual-ness visually
     prominent, never a subtle field.
  5. **Forms design pass required before the family builds out (Marcelo):** the current forms
     are a "medium to medium-low start" — run a mockup + discussion round (ui-dev-loop) to
     design the entity-form FAMILY: similar data structures handled the same way (familiarity)
     without over-standardizing; start from a base form pattern and specialize.
- **Why / source:** `meetings/2026-07-17 - Amith Demo Feedback.md`; Marcelo rulings 2026-07-17
  (record in the plan chain — action plans are ephemeral by design; forms design pass; agents-app
  pointer). Orders counterpart: orders UPD-11.
- **Status:** Accepted.

## UPD-4 — List idiom refinement: column-header filters + opt-in column sort; header card = time-span + presets only (2026-07-17)
- **Amends:** the UI plans' §0 house grid idiom — refinement, intent unchanged. Mirror of orders
  UPD-12 (one look across both apps).
- **Change:** per-column filtering lives in the column headers (filter icon per column;
  click-to-sort with per-column opt-in — AG Grid native config, and `ng-entity-viewer`/User Views
  already carry column filtering where that surface is used); the filter card above each list
  shrinks to the **time-span control + high-value preset chips**. Accounting preset suggestions
  (design-pass inputs): JE lists — Unbatched/Pending · Manual awaiting approval · Batched · this
  month; Batches — Open · Awaiting approval · Dispatch failed · closed-period held (the MOD-16
  exceptions state); Accounts — Active only. Reference: the CDP/ATS grid
  (github.com/BlueCypress/CDP) — review at the list/forms design pass.
- **Why / source:** Marcelo 2026-07-17. Orders counterpart: UPD-12.
- **Status:** Accepted — lands with the list screens + the design pass.

## UPD-5 — GL mapping is COMPANY-SCOPED: shared taxonomy, per-company routes; same-company invariant + enforcement tiers (2026-07-17, LOCKED)
- **Amends:** MOD-10 (role-based polymorphic mapping) — structural constraints added; the
  role/link design's intent stands. Marcelo: "that's what we're gonna go for… lock that structure
  into the mods and updates."
- **Change (the locked structure):**
  1. **Categories are COMPANY-OWNED (revised 2026-07-20, Robert — supersedes this entry's
     original shared-taxonomy-with-per-company-routes shape):** "Products need to be owned by a
     company. Product categories need to be owned by a company… your product catalog is at the
     company level" (inheritance possible later). Each company has its own category tree;
     a category's account links are therefore same-company by construction — the per-company
     route machinery collapses to simple same-company links. Schema impact:
     `ProductCategory.CompanyID` (orders S1 slice).
  2. **Company is the resolver's INPUT** (`Product.CompanyID`, required NOT NULL — the product's
     company is the source of truth; derivation-from-connected-account struck). Walk: product
     link → the product-company's OWN category tree → product-company default → loud tripwire.
     A fallback may reduce specificity, never change company. **Refinement (Robert 2026-07-20,
     reconciling his Q2 answer):** the product-company anchor governs the REVENUE side
     (revenue/DefRev/COGS/product accounts); the **AR + cash + Due-To/Due-From side anchors to
     the ORDER-owning company** (seller-of-record — see MOD-5 revision / orders MOD-14).
  3. **Enforcement tiers (creation-time; invalid data impossible):**
     **HARD-BLOCK** — product-level link to another company's account · category link to another
     company's account (category is company-owned, 2026-07-20) · **two accounts on one category
     for the same role** (no-ambiguity rule — simplifies from role×company now that categories
     are single-company) · product without a CompanyID · product assigned to another company's
     category. Enforced in the **engine** (typed errors, primary) **+ a DB validation trigger as
     the raw-SQL floor**.
     **WARN (incomplete, not invalid)** — assigning a product to a category with no route for
     its company: legal; falls through to the company default; assignment-time warning **with a
     pop-out link to the category workspace** (workspace tabs let the user fix the route and
     return to the product). No eager per-product fall-through scanning in lists — resolution
     display stays on-demand (cost).
  4. **Cross-company revenue flows are intercompany TRANSACTIONS** (due-to/due-from machinery),
     never mapping routes — the mapping layer refuses cross-company entirely.
  5. **UI attention flagged:** the per-company route-management surface (category × role ×
     company grid) needs real design — joins the forms/list design pass (UPD-3.5).
- **Why / source:** Marcelo rulings 2026-07-17 (this session) + the Q38 accounting analysis
  (posting-group precedent). Robert review rides [Q38](QUESTIONS.md#q38) (proceeding).
  Orders counterpart: MOD-3 rev-2.
- **Status:** Accepted — LOCKED as the working structure; Q38's open items are Robert's edges
  (his Q2 rung intent, bundles, any real cross-company case), not the structure itself.

## UPD-6 — Matt UI-review rulings: container queries, sticky interior chrome, tab indicators, filter variants (2026-07-20)
- **Amends:** the UI plans' cross-cutting direction (§0 house rules) — refinements from the
  2026-07-20 UI review with Matt (MJ's UI owner). Orders counterpart: UPD-13.
- **Change:**
  1. **Container queries, not media queries** (Matt, on the record): Explorer supports
     shift-click → open-in-new-tab + drag-SPLIT panes (already built, undiscoverable) — so app
     layouts must respond to their CONTAINER's width, not the viewport's. All new elements use
     container queries; the left-nav should auto-collapse (hamburger) when its containing pane
     is narrow.
  2. **Sticky interior chrome:** the page header + filters stay pinned; only the content below
     scrolls (Matt's chrome model — never lose the filters). Tab CONTENT scrolls internally so
     workspace tabs stay visible.
  3. **Required-state indicators on editor tabs** (red-dot per incomplete tab; save button
     gated on completeness) — Matt's main editor concern; Marcelo already planned it.
  4. **Filter consolidation:** filters above the table shrink further — Matt open to an
     "advanced filter grid" variant of the MJ filter bar that expands/collapses; column-header
     filter icons confirmed available in AG Grid (Soham has them live in CDP); **sortable AND
     filterable columns must be visually indicated** (and limited to indexed columns — not every
     column sorts/filters at volume). Extends UPD-4.
  5. **Table-to-edge density:** tables may run to the pane edges (drop the card padding below
     the filters) — Matt: fine if radii/hierarchy kept.
- **Why / source:** `meetings/2026-07-20 - Accounting UI Review - Matt and.md`. Feeds the forms/
  list design pass; Marcelo checks back with Matt midweek.
- **Status:** Accepted.
