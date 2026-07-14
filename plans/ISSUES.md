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

### [RESOLVED] ScheduledJournalEntry materialization trigger undefined after periods removal — 2026-07-10 → 2026-07-13
- BA-D25 defined materialization as a period-close action; MOD-1 removed periods. **RESOLVED by MOD-11
  (Robert 2026-07-13): DATE-driven** — scheduled entries created up-front at booking with their own
  recognition dates; materialize when due; batches pick up by date window. CA-2 closed; CA-1 (periods
  guard) remains open independently.

### [DEFERRED] Timing/period restrictions — a real GAP, deferred (see plans/DEFERRALS.md) — 2026-07-14
- Periods are removed (MOD-1 final; MOD-13 withdrawn). Marcelo: the lack of a timing/close mechanism IS
  a gap — it is **DEFERRED, not accepted**: restriction features aren't needed for the baseline test
  sets (which run unrestricted), so the basic model builds first and the timing system is added later.
  Canonical entry + revisit trigger: `plans/DEFERRALS.md`. Executor: build no period/close machinery now;
  any future timing rule detects by DATE, never a period FK.
