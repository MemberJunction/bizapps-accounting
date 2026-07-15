# plans/ — planning system

This folder follows the repo planning system (`~/MJDev/shared-plans/repo-planning-system.md`, adopted
2026-07-10). Read that doc before adding or changing anything here. The short version:

| Path | What it is |
|---|---|
| `MASTER-PLAN.md` | **The central source of truth.** Write-forward-only: closed text is never edited/deleted. New scope = appended Extensions (`Status: OPEN` while drafting → `CLOSED` when work begins). Top of file: Contradictions & Ambiguities ledger (CA-*). |
| `MASTER-PLAN-MODIFICATIONS.md` | MOD-* living collection (overlay) of changes that SUPERSEDE closed master-plan text — edited in place as decisions evolve, never self-contradictory (git = history; IDs never reused). Reciprocal ⚠ inline markers. **Precedence: MOD > Update > Extension > original text.** |
| `MASTER-PLAN-UPDATES.md` | UPD-* living collection of SMALL intent-preserving refinements/additions to existing sections — same editing rules. Reciprocal ➕ inline markers. |
| `BACKLOG.md` | Repo-level wanted-but-not-started work + `[decision needed]` items. Holding pen — promote to an action plan when picked up. |
| `ISSUES.md` | Known problems / open questions about the plan or built system, persisted so they aren't lost. |
| `action-plans/` | `ActionPlan - <Summary of Actions>.md` — the ONLY docs work is executed from. Header cites the §/MOD/EXT they implement. Move to `completed/` when done. |
| `completed/` | Finished (or abandoned) action plans. |
| `meetings/` | Transcripts + distilled per-meeting decision notes. **Meetings are inputs, never authority** — a decision only becomes the plan as a MOD, Update, or Extension. |
| `supporting-documents/` | Reference material that is neither plan nor meeting (ERDs, external-system schema exports, analyses). |
| `FEATURE-LIST.md` | **Derived feature registry** (adopted 2026-07-15): stable outline IDs + statuses, generated from the plan chain; git-pinned derivation header = the staleness check. Never an authority — the plan chain wins. Convention: `~/MJDev/shared-plans/feature-list-amendment.md`. |
| `../docs/ui-design/` | **UI design layer — MOVED to `docs/` 2026-07-15** (standing/present-tense design is documentation, not a plan): `UI-FEATURE-LIST.md` (coverage index over FEATURE-LIST), `style-kit/` (+ provenance pin), `shell/` (the one standing reference mockup), `mockups/` (ephemeral; **empty between cycles**). UI *plans* stay HERE in `action-plans/` (`ActionPlan - UI …`). Convention: `~/MJDev/shared-plans/ui-design-system.md`. |

**Migration map (2026-07-10)** — old paths → new, for stale references in older docs:
- `plans/bizapps-accounting-master.md` → `plans/MASTER-PLAN.md`
- `plans/bizapps-accounting-master-plan-v2.md` → **DELETED 2026-07-11** (a parallel plan, never meant to override the master; live decisions = MOD-1..10 + UPD-1; source rulings preserved in `meetings/2026-06 - Amith rescope rulings (extracted from retired v2 plan).md`; full text in git history)
- `plans/accounting-engine-plan.md` → `plans/action-plans/ActionPlan - Accounting engine + CreateJournalEntry remote op.md`
- `plans/batch-approval-lock-redesign.md` → `plans/action-plans/ActionPlan - Batch approval lock redesign.md`
- `plans/erd-accounting-target.md`, `plans/handoff-next-steps.md` → `plans/supporting-documents/…`
- `plans/Meeting with Amith.pdf` → `plans/meetings/…`
