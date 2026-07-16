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

## ISSUE — Batch workspace (§8.2) criteria panel exceeds current server capability
- **Raised:** 2026-07-16 by the UI-build agent, at the start of the §8.2 Batch workspace build.
- **Status:** OPEN — **needs Marcelo's scope call before the workspace can be built as specced.**
- **Why it matters:** §8.2 specs the Batch workspace's **criteria panel as the ONLY filter surface**
  on the page, and the whole screen is built around it. Three of its five criteria have no server
  behind them, so the panel cannot be honestly wired — a control that silently doesn't filter is
  worse than no control.

### What actually exists (verified in the code, not assumed)

| §8.2 criterion | Engine (`BatchingEngine.ts`) | GraphQL resolver | Verdict |
|---|---|---|---|
| **Include-unbatched-through datetime** (cutoff, default now) | ✅ `BuildBatchOptions.cutoff` (+ `startDate`), MOD-8 inclusive-date semantics, tier-2 tested (B1.1) | ❌ `BuildJEBatch(targetSystem)` drops it | **Thin resolver add** |
| **Source: from a saved MJ User View** | ✅ `buildBatchFromView(viewId, …)` with `excludePosted`/`excludeLocked`, loud-reject semantics, tier-2 tested (B1.2) | ❌ **no mutation exists at all** | **Thin resolver add** |
| **Target system select** | ✅ | ✅ | Done |
| **Companies multi-select** | ❌ not in `BuildBatchOptions` | ❌ | **Engine work** |
| **Entry types** (All approved-only / System / Manual) | ❌ not in `BuildBatchOptions` | ❌ | **Engine work** |
| **Per-entry include/exclude checkboxes** + the MOD-8 out-of-order warning they trigger | ❌ `buildBatch` sweeps the whole Pending pool via `loadPendingJEIds`; there is no exclude-set param. `buildBatchFromIds` exists as the shared core and takes an explicit ID list — **that is the natural seam** for an include/exclude preview. | ❌ | **Engine work** (small — `buildBatchFromIds` already takes IDs) |

### The scope call for Marcelo (pick one)

1. **Build the server side first** — extend `BuildJEBatch` with `cutoff`, add `BuildJEBatchFromView`,
   add company/entryType options + an explicit-ID build over the existing `buildBatchFromIds` seam.
   Full §8.2 workspace, with tier 2/3 covering the new surface. Biggest scope; matches the approved
   mockup exactly.
2. **Descope the panel to what the engine has today** — cutoff + source(standard/from-view) + target
   system, still needing the two thin resolver adds. Drop companies/entry-types/include-exclude (and
   with them the MOD-8 out-of-order warning, which only has meaning if exclusions exist). Ships the
   workspace shape; the panel is smaller than the mockup.
3. **Defer the workspace**, keep building the rest of the UI (JE workspace, Accounts, dashboards,
   Configuration), return when the server side is planned.

**Recommendation: (2) then (1).** It gets a real, honest workspace in front of you fastest — and the
two resolver adds are thin wrappers over engine functions that are already written AND tier-2 tested,
so they are cheap and low-risk. The company/entry-type/exclusion work is genuine new engine behaviour
with invariant implications (the balanced-JE + per-company netting rules), which deserves its own
plan rather than being improvised inside a UI wave.

**Do NOT** wire the missing criteria to a client-side filter over the preview: `buildBatch` would
still sweep the whole Pending pool server-side, so the batch would silently NOT match what the panel
showed. That is a correctness trap, not a shortcut.
