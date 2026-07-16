# UI-FEATURE-LIST — bizapps-accounting

> Derived view over `plans/FEATURE-LIST.md` (same IDs — never its own numbering). Convention:
> `~/MJDev/shared-plans/ui-design-system.md` §2. Statuses:
> `Not started → Mockups-in-review → Mockup-selected → In build → Implemented` · `N/A — no UI`.
> `Implemented` requires DUAL-LAYER validation (GUI presence+behavior per TEST-PROTOCOL), cited.
>
> Baseline surface note: every entity has **generated MJ entity forms** (CRUD) — not tracked per-row;
> rows track deliberate UI beyond it. Existing custom dashboards (`packages/Angular/src/lib/custom/`):
> BatchDispatch, BatchStatus, ChartOfAccounts, CompanySetup, GLAccount, Intercompany, JournalEntry(+
> Console), RevenueTax, TrialBalanceAR. The active
> `action-plans/ActionPlan - UI layout and workflows (accounting).md` (§1–§6) is the current cycle's
> selected design; ◇ = claimed from working tree / plans, pending the Task 65b sign-off review.
> ws5's uncommitted Angular WIP (JE console, batch dispatch, Playwright specs) is part of that review.
> The 2026-07-15 gap analysis is folded INTO the UI action plan (labeled "added 2026-07-15" §s/bullets);
> "UI plan §x" refs below are that plan.

| ID | Feature | UI status | Surface | Mockup | Action plan |
|---|---|---|---|---|---|
| A.1–A.2 | Chart of accounts browsing/admin | In build ◇ | ChartOfAccounts + GLAccount dashboards | — | UI plan §6 sweep |
| A.3–A.4 | Company setup (ACP, fiscal year, default accounts, CFO approver) | In build ◇ | CompanySetup dashboard | — | UI plan §5 (with A2 settings) |
| B.1–B.2 | GL account mapping admin (roles/links) | Not started | Settings screen — GLAccountLink manager | — | UI plan §5 |
| B.3 | CoA↔ERP mapping approval flow | Not started | Settings screen — mapping approval grid | — | UI plan §5 |
| C.1–C.7 | JE browsing, detail, lines+dimensions, reversal affordance | In build ◇ · nav-shell redesign: Mockups-in-review | JournalEntry + JournalEntryConsole dashboards | mockups/nav-shell-je-dashboard.html | UI plan §3 |
| C.8 | Manual-JE approval surfacing | Not started (feature Planned) | approval inbox (shared) + JE detail affordances | — | UI plan §1 |
| C.9 | Pending-JE void affordance | Not started — decision-gated (§14 Q1); detail slot reserved | JE detail | — | UI plan §3 |
| C.10 | JE attachments panel | Not started — decision-gated (§14 Q9); detail slot reserved | JE detail slide-in | — | UI plan §3 |
| D.1–D.4, D.6–D.7 | Batch build/dispatch/status workflow | In build ◇ · nav-shell redesign: Mockups-in-review | BatchDispatch + BatchStatus dashboards | mockups/nav-shell-batches-dashboard.html | UI plan §1/§2 |
| D.3 | Batch approvals page (rebuild to house style — "I'm not a lover") | In build ◇ · nav-shell redesign: Mockups-in-review | Batch approvals page (reuses tasks approval-inbox pattern) | mockups/nav-shell-batches-dashboard.html | UI plan §1 |
| D.5 | View-driven batch builder UI | Not started (feature Planned) | Batch builder | — | UI plan §2 |
| E.1–E.5 | Scheduled-JE schedule visibility + materialization ops | Not started | Scheduled-JE browser + materialize action | — | UI plan §5 (op) · §7 (browser) |
| F.1–F.2 | Currency display (ISO set, original-currency line fields) | In build ◇ | generated forms + JE detail | — | — |
| F.3–F.4 | FX surfaces | N/A — no UI (deferred features) | — | — | — |
| G.1 | Tax data admin (authorities/jurisdictions/rates) | In build ◇ (no plan § — house-style true-up owed) | RevenueTax dashboard | — | UI plan §6 sweep |
| G.2 | Tax provider config | N/A — no UI (deferred feature) | — | — | — |
| H.1, H.3 | Read-model reporting surfaces (trial balance AR, aging, rollforward, recon) | In build ◇ | TrialBalanceAR dashboard (+ B2 reporting wave) | — | UI plan §4 |
| H.2 | Skip report gallery | N/A — no UI here (deferred, separate app) | — | — | — |
| I.1–I.2 | Periods/timing | N/A — no UI (removed/deferred) | — | — | — |
| J.1 | Balance materialization | N/A — no UI (deferred) | — | — | — |
| K.1–K.3 | Roles/permissions setup + role-management screens | Not started — R2 folds into UI wave; §5 settings screen is the home | Setup/settings screen | — | UI plan §5 |
| L.1–L.5 | Engine/API | N/A — no UI | — | — | — |
| M.1–M.2 | Intercompany visibility | In build ◇ (existing Intercompany dashboard — verify its role at 65b: accounting is receive-only) | Intercompany dashboard | — | UI plan §6 sweep |
| N.1–N.2 | Demo/test substrate | N/A — no UI | — | — | — |
