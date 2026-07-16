# TRANSFER-BACKLOG — components parked in this app, owed to other homes

> Created 2026-07-15 (Marcelo ruling): during the UI wave we **minimize dev-linked apps and feature
> branches** — framework-clean shared components are PARKED in accounting for iteration speed and
> transferred to their real homes at the named trigger. This doc is the ledger that guarantees the
> "we never moved it" risk stays managed: it is **reviewed at every team-question consolidation**
> (`plans/QUESTIONS.md#q25` carries the who-receives-what asks), and a row is removed only when
> the item ships in its target (note the PR).
>
> **Parking discipline (non-negotiable):** parked framework-clean components live in a bounded
> folder — `packages/Angular/src/lib/transfer-pending/` — and import **NO accounting entities or
> engine types**. Extraction must stay a file move + import rename, never a refactor. (The
> accounting-DOMAIN components — waterfall viewer, GL-resolution preview, A/R base view — are NOT
> in this doc; they are permanently accounting-homed, per the component inventory in
> `design-docs/ui-design/README.md`.)

| Item | Target home | Trigger / blocker | Notes |
|---|---|---|---|
| Approval inbox (tasks-backed approve/reject list + context slide-in) | **bizapps-tasks** | Ian back next week — ask who owns tasks' Angular surface + whether tasks ships an ng package | Accounting already integrates `TasksAppApprovalGate`; build the inbox against task entities generically so it lifts clean |
| List-screen scaffold (grid + time-window default + keyset + slide-in + live refresh) | **bizapps-common → MJ base** (Matt) | Live Page System plan's LiveDashboardBase MJ-core PRs; Matt ruling on overlap with MJ's existing `list-detail-grid` / `simple-record-list` | **v1 ships on the EXISTING grid system** (ruled 2026-07-16 — UI plan §8 dispatch rulings: refetch-on-action + one header refresh control, no polling); LiveDashboardBase swaps in behind the scaffold seam when the Live Page System spike lands — it remains the target shape, not the precondition |
| Role-gating directive/guard (over MJ Unified Permissions) | **MJ base** (Matt); common interim if MJ declines | Matt ruling | Zero app imports — reads the permissions engine that is already MJ core |
| Cross-app deep-link helper (navigate to another open app's resource) | **MJ base** (Matt); common interim | Matt ruling | Open-app resource routing is a platform concern; wraps NavigationService |
| ~~Nav rail (collapsible, config-driven groups/items/badges; scope-chip slot)~~ | ~~bizapps-common → possibly MJ base~~ | **ROW RETIRED 2026-07-16 — nothing to transfer** | **MJ already ships it.** At the §8.0 shell build we found `<mj-left-nav>` (`@memberjunction/ng-ui-components`) is the canonical Explorer left rail and already covers labelled sections, badges, active state, `[header]`/`[footer]` slots (scope chip → `[header]`), tree items, and a responsive drawer. Per the UI plan §8 **MJ-wins rule** we adopted it and deleted the bespoke rail — so there is no parked component owing a home. Sole delta: no desktop icons-only collapse → raised upstream as [Q27](QUESTIONS.md#q27) instead of forking. Orders' shell (UI plan §13.0) consumes `<mj-left-nav>` directly too. |
| Workspace-tab framework (session-scoped draft tabs; keep/discard verbs; rejected-tab state) | **bizapps-common** | Orders' Order editor consumes it (UI plan §13.0) — transfer or import at that build; revisit if v2 adds DB persistence | Approved in mockup round 2 (2026-07-16); state is in-memory only in v1 — framework-clean by construction |
