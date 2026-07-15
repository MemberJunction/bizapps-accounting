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
| `mockups/` | Ephemeral working area for mockup cycles. **Empty (or absent) between cycles** — that is the health check. A selected mockup is superseded by its action plan and deleted; frame improvements fold into `shell/` first. |

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

## Standing design record

Screen inventory, navigation map, and app-specific chrome decisions get recorded in this file as
the UI wave lands them — present-tense, updated as part of each UI change's Definition of Done
(same convention as the ERD in `docs/`). Until the first ui-dev-loop cycle closes, the current
custom surfaces are: BatchDispatch, BatchStatus, ChartOfAccounts, CompanySetup, GLAccount,
Intercompany, JournalEntry(+Console), RevenueTax, TrialBalanceAR dashboards
(`packages/Angular/src/lib/custom/`) plus generated MJ entity forms for every entity.
