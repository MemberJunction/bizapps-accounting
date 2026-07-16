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
| List-screen scaffold (grid + time-window default + keyset + slide-in + live refresh) | **bizapps-common → MJ base** (Matt) | Live Page System plan's LiveDashboardBase MJ-core PRs; Matt ruling on overlap with MJ's existing `list-detail-grid` / `simple-record-list` | **Design ON LiveDashboardBase** (approved Live Page System plan), not a fresh invention — this scaffold IS that plan's Tier B consumer shape |
| Role-gating directive/guard (over MJ Unified Permissions) | **MJ base** (Matt); common interim if MJ declines | Matt ruling | Zero app imports — reads the permissions engine that is already MJ core |
| Cross-app deep-link helper (navigate to another open app's resource) | **MJ base** (Matt); common interim | Matt ruling | Open-app resource routing is a platform concern; wraps NavigationService |
| Nav rail (collapsible, config-driven groups/items/badges; scope-chip slot) | **bizapps-common → possibly MJ base** (Matt) | Matt ruling (pairs with categories-as-nav-items pattern); orders needs it at its shell build (UI plan §13.0) | Approved in mockup round 2 (2026-07-16); pure config-driven — zero app imports |
| Workspace-tab framework (session-scoped draft tabs; keep/discard verbs; rejected-tab state) | **bizapps-common** | Orders' Order editor consumes it (UI plan §13.0) — transfer or import at that build; revisit if v2 adds DB persistence | Approved in mockup round 2 (2026-07-16); state is in-memory only in v1 — framework-clean by construction |
