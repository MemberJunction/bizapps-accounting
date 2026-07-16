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
