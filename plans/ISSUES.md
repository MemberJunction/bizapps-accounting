# ISSUES — bizapps-accounting (plans-level)

Known problems and open questions about the plan or the built system that must not be lost.
Entry: `### [OPEN|RESOLVED] <title> — <date>` with source + status. Convention:
`~/MJDev/shared-plans/repo-planning-system.md` §5.1. (Suspected mjdev-tool bugs go to
`~/MJDev/MJDEV-ISSUES.md`; MJ-core bugs to `~/MJDev/MJ-UPSTREAM.md`.)

---

### [OPEN] FX + intercompany-leg generation AND per-pair wiring are currently UNOWNED — 2026-07-10 (upd. 2026-07-13)
- MOD-5/MOD-6 moved intercompany balancing legs and all FX computation upstream to the Payments
  subsystem (Amith) — but Payments does not exist yet, so these responsibilities live nowhere.
  **2026-07-13 addition:** the per-pair Due-To/Due-From WIRING is also Payments' (the 2026-07-06
  baseline squash dropped `IntercompanyRelationship` from accounting — "the Payments component owns
  due-to/due-from"), so wiring + legs + FX all land with the Payments build (orders repo, O2; Amith's
  OQ-A reference schema kept in MOD-5). Source: 2026-06 rescope rulings C1/C1b + the baseline fold
  header + the 2026-07-10 gap analysis.

### [OPEN] ScheduledJournalEntry materialization trigger undefined after periods removal — 2026-07-10
- BA-D25 defined materialization as a period-close action; MOD-1 removed periods. Needs a
  calendar/schedule-driven trigger or the CA-1 resolution. (= CA-2 in MASTER-PLAN.md.)
