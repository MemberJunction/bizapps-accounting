# ISSUES — bizapps-accounting (plans-level)

Known problems and open questions about the plan or the built system that must not be lost.
Entry: `### [OPEN|RESOLVED] <title> — <date>` with source + status. Convention:
`~/MJDev/shared-plans/repo-planning-system.md` §5.1. (Suspected mjdev-tool bugs go to
`~/MJDev/MJDEV-ISSUES.md`; MJ-core bugs to `~/MJDev/MJ-UPSTREAM.md`.)

---

### [OPEN] FX + intercompany-leg generation are currently UNOWNED — 2026-07-10
- MOD-5/MOD-6 moved intercompany balancing legs and all FX computation upstream to the Payments
  subsystem (Amith) — but Payments does not exist yet, so these responsibilities live nowhere.
  Tracked so they land with the Payments build (orders repo). Source: v2 C1/C1b + the 2026-07-10
  schema-gap analysis (`~/MJDev/reports/schema-functionality-gap-analysis/REPORT.md`).

### [OPEN] ScheduledJournalEntry materialization trigger undefined after periods removal — 2026-07-10
- BA-D25 defined materialization as a period-close action; MOD-1 removed periods. Needs a
  calendar/schedule-driven trigger or the CA-1 resolution. (= CA-2 in MASTER-PLAN.md.)
