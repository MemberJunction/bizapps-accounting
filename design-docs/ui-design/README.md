# design-docs/ui-design/ — standing UI design (bizapps-accounting)

The STANDING (present-tense) UI design layer for this app: what the UI is, plus the assets used to
design what it becomes. Convention: `~/MJDev/shared-plans/ui-design-system.md`. Split rules (ruled
2026-07-15): standing design artifacts live in `design-docs/` — the hand-authored documentation
home (`docs/` stays reserved for GENERATED doc output, per the MJ template's `/docs/` ignore); UI
**work** is planned and executed from `plans/action-plans/` (`ActionPlan - UI …`), keyed to
`plans/FEATURE-LIST.md` IDs. (The legacy hand-authored files still in `docs/` — ARCHITECTURE, ERD,
lifecycle-hooks — consolidate into `design-docs/` at the 65b window; see plans/BACKLOG.md.)

| Path | What it is |
|---|---|
| `UI-FEATURE-LIST.md` | UI coverage index over `plans/FEATURE-LIST.md` (same IDs, never its own numbering): which features have a surface, which need one, loop status per row. |
| `style-kit/` | `mj-mock.css` — snapshot of MJ's design tokens + chrome classes — and `PROVENANCE.md`, the git pin to the MJ commit it was synced against (one-command freshness check at each mockup session). |
| `shell/` | The ONE standing reference mockup: the app frame every new mockup clones (into `mockups/`). Kit-derived; to be grounded against live Explorer screenshots at the first mockup session (banner in the file). |
| `mockups/` | Ephemeral working area for mockup cycles. **Empty (or absent) between cycles** — that is the health check. A selected mockup is superseded by its action plan and deleted; frame improvements fold into `shell/` first. **Current state (2026-07-16):** the round-2 set (24 linked pages) is APPROVED and converted to per-screen specs (UI action plan §8); RETAINED as the build agents' visual reference until that build completes, then deleted. |

## Component inventory (sharing / MJ-base tracking)

Every deliberate UI component this app adds (beyond generated forms) gets a row, so sharing and
MJ-base candidacy are decided on record, not memory — updated at each ui-dev-loop close.
Homes: this app · `bizapps-common` (genuinely cross-app UI) · `bizapps-tasks` (approval substrate)
· **MJ base** = flag for Matt (components any MJ app would want — surface flagged rows to him).

| Component | Home | Status | Consumers | MJ-base candidate? |
|---|---|---|---|---|
| Schedule/waterfall viewer (dated lines, materialized-vs-due, supersede chain) | this app (ruled 2026-07-15) | Planned | ACC §7 browser · ORD subscriptions + line affordance | no (accounting-domain) |
| GL-resolution preview ("Revenue → 4000 via category Software") | this app (ruled) | Planned | ACC settings · ORD product panel + confirm-failure UX | no (accounting-domain) |
| Customer A/R base view (identity + balances + aging; read-only — orders wraps it with its verbs) | this app (ruled) | Planned | ORD §5 · ACC links/embeds | no (accounting-domain) |
| Approval inbox (tasks-backed approve/reject + context slide-in) | this app — PARKED (target bizapps-tasks; TRANSFER-BACKLOG) | Planned | ACC batch + manual-JE approvals · ORD sales rules | not yet (tasks-substrate-bound) |
| List-screen scaffold (grid + time window + keyset + slide-in + live refresh; design ON LiveDashboardBase) | this app — PARKED (target common → MJ base; TRANSFER-BACKLOG) | Planned | every list screen, both apps | **YES — flag Matt** (check overlap w/ list-detail-grid / simple-record-list + Live Page System plan) |
| Role-gating directive/guard (over MJ Unified Permissions) | this app — PARKED (target MJ base; TRANSFER-BACKLOG) | Planned | both apps | **YES — flag Matt** |
| Cross-app deep-link helper (navigate to another open app's resource) | this app — PARKED (target MJ base; TRANSFER-BACKLOG) | Planned | ORD §8 ↔ ACC §3 | **YES — flag Matt** |
| Explorer header widget slot (FEATURE ASK, not a component we build): app-contributed control in the shell header — e.g. our company-scope chip | MJ base (Explorer shell) | Ask filed | any app needing a scope/context selector | **YES — flag Matt** (verified 2026-07-15: `mj-app-nav` renders label/icon/badge only; `header-actions` is Explorer-owned) |
| ~~Nav rail~~ → **use MJ's `<mj-left-nav>`** | **MJ base — already ships it** (`@memberjunction/ng-ui-components`) | **Adopted 2026-07-16** (bespoke rail deleted at the §8.0 build — MJ-wins rule) | every category page, both apps | n/a — MJ already owns it. Delta: no desktop icons-only collapse → [Q27](../../plans/QUESTIONS.md#q27) |
| Company scope chip (app-wide company scope, persisted per user) | this app (`custom/shared/`) | Built (§8.0) | every accounting list/dashboard/report | no (binds accounting entities) — but its HOME may move to the Explorer header ([Q26](../../plans/QUESTIONS.md#q26)) |
| Workspace-tab framework (session-scoped draft tabs: keep-state-until-close, NOT DB-persisted v1; "Keep as draft tab"/"Discard" verbs, rejected-tab state) | this app — PARKED (target common; TRANSFER-BACKLOG) | Approved (mockups 2026-07-16) — build pending | ACC JE workspace + Batch workspace · ORD Order editor | not yet (assess after v1; DB persistence is the v2 fork) |
| Report-page scaffold (parameter bar + as-of statement + house grid + export) | this app | Approved — build pending | the 7 report pages (UI plan §8.5) | no (thin composition over the list scaffold) |

## Standing design record

Screen inventory, navigation map, and app-specific chrome decisions get recorded in this file as
the UI wave lands them — present-tense, updated as part of each UI change's Definition of Done
(same convention as the ERD in `docs/`).

**Current built surfaces (pre-wave):** BatchDispatch, BatchStatus, ChartOfAccounts, CompanySetup,
GLAccount, Intercompany, JournalEntry(+Console), RevenueTax, TrialBalanceAR dashboards
(`packages/Angular/src/lib/custom/`) plus generated MJ entity forms for every entity. These migrate
into the approved design below as the wave builds (UI action plan §8.6 order).

### Navigation map (APPROVED 2026-07-16 — mockup round 2; per-screen specs: UI action plan §8)

Top-nav categories are Explorer app nav items (`DefaultNavItems`); each hosts a collapsible **nav
rail** (scope chip at top) over dedicated single-purpose pages:

- **Journal Entries** — Dashboard · All journal entries · JE workspace | VIEWS: Scheduled entries · Awaiting approval (badge)
- **Batches** — Dashboard · All batches · Batch workspace | WORK: Batch approvals (badge) · Dispatch status
- **Accounts** — Chart of accounts · Account links · ERP mapping · Dimensions
- **Reports** — AR Aging · DefRev Rollforward · Trial balance (AR) · AR↔GL recon · GL detail · Dimension P&L · Sales tax liability
- **Configuration** — Companies · Users & roles · Approvals

No FAB (the MJ chat button owns the corner); the rail holds NO creation items — creation is a
consistent top-right page button (or a workspace tab). Company scope chip: rail-top, persisted per
user via UserInfoEngine; moves to the Explorer header if the upstream widget-slot ask lands
(plans/QUESTIONS.md#q26).

### Element doctrine (ratified 2026-07-16)

- **Modal** = focused quick ACTION on a single record, and only when it passes the
  **encapsulation test**: ALL relevant information fits without clutter. (JE review modal: yes.
  Batch building: no → workspace.)
- **Page / workspace** = the default for depth; anything criteria-driven or multi-record.
  Workspaces carry session-scoped draft tabs (state kept until tab close; NOT DB-persisted in v1).
- **Slide-in** = quick VIEW — peek at a related record without leaving the live working context.
- **Every modal and slide-in carries a pop-out (↗)** to the element's full-depth home.
- **Never two filter systems on one page** — where build criteria exist (batch workspace), the
  criteria panel is the ONLY filter surface, and what you see is exactly what the criteria select.
- Dashboards show no on-demand heavy aggregates — expensive stats are precomputed on a schedule or
  don't ship.
