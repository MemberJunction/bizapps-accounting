# HANDOFF — UI build dispatch (accounting), 2026-07-16

> **To:** the UI build agent (instance `accounting-engine-dev`, branch `feature/je-entry-engine`).
> **Mission:** execute **`plans/action-plans/ActionPlan - UI layout and workflows (accounting).md`
> §8** — the per-screen implementation spec converted from the approved mockup set — in the §8.6
> build order. §8 (including its **Dispatch rulings** block) is the authoritative spec; this brief
> is the pointer + working rules, and adds nothing normative beyond it.

## Read before writing any code (in this order)

1. The UI action plan, **§8 first** (Dispatch rulings → 8.0 shell → your current phase's screens),
   then §§0–7 for the feature-level intent behind each screen.
2. `design-docs/ui-design/README.md` — the standing design record: navigation map, **element
   doctrine** (encapsulation test, pop-out rule, one-filter-system rule), component inventory.
3. `design-docs/ui-design/mockups/` — the approved visual reference (open `nav-shell-je-dashboard.html`
   and click through; every page links). **Directionally binding, not pixel-binding**; the
   `.mjm-*`/`.x-*` classes never ship (MJ-wins rule, §8).
4. MJ's own `CLAUDE.md` (worktree root — the highest MJ authority) + the guides it points to:
   explorer-chrome-conventions, DASHBOARD_BEST_PRACTICES, FORMS_ARCHITECTURE_GUIDE,
   KEYSET_PAGINATION_GUIDE, LAZY_LOADING_GUIDE. Design tokens only; `@if/@for`; `inject()`;
   PascalCase publics.

## Working rules (non-negotiable)

- **Git:** you work on `feature/je-entry-engine`. Another agent has uncommitted WIP in this repo —
  **never sweep files you didn't edit into a commit**. **Commits require Marcelo's explicit,
  directly-given approval — commit authority is NOT delegated through this document. Never push.**
- **Testing is first-class** (TEST-PROTOCOL + TEST-ARCHITECTURE, instance docs): every screen gets
  dual-layer validation — engine/API assertions AND GUI presence+behavior. Specs are **committed
  to `test-harnesses/`** (Playwright for GUI, tsx/api for server tiers) — never write-then-delete.
  Keep `test-harnesses/testing.md` (coverage matrix + ledger) current. Report results exactly as
  they happened; label any partial check a half-test.
- **Playwright:** system Chrome (`channel: 'chrome'`), headless; drive the live Explorer via
  `mjdev explorer-url` / `mjdev e2e`. Services via `mjdev run/restart/kill` only — never `ng serve`
  or hand-started processes.
- **Parking discipline:** framework-clean shared components (nav rail, workspace-tab framework,
  list scaffold, approval inbox, role directive, deep-link helper) live in
  `packages/Angular/src/lib/transfer-pending/` and import **zero accounting entities/engine types**
  (`plans/TRANSFER-BACKLOG.md`). Extraction must stay a file move.
- **Refresh policy** (§8 Dispatch rulings): existing grid system; refetch-on-mutating-action +
  one header refresh control per list/dashboard; no polling; no LiveDashboardBase precondition.
- **Order:** §8.6. **Users & roles + Approvals settings LAST** (A2/C.8-gated; stubs fine).
- **Escalation while Marcelo is away:** blocked-on-a-human → `plans/QUESTIONS.md` (Q22/Q24
  template, next free Qn, update both indexes); MJ/app bugs → repo `BUGS.md` / instance BUGS.md;
  suspected mjdev-tool bugs → `~/MJDev/MJDEV-ISSUES.md`. Log and keep moving — don't stall.
- **Compute:** heavy tasks (full builds, e2e runs) respect the workspace heavy-slot budget; stop
  and surface status at any usage/credit wall rather than grinding.

## Done means

Each screen: matches its §8 spec block · passes the element doctrine · both test layers green and
committed · `design-docs/ui-design/UI-FEATURE-LIST.md` row updated · component inventory updated if
a new deliberate component was added. At build close (not before): delete `mockups/`, fold frame
improvements into `shell/`, update the standing design record — the normal cycle close.
