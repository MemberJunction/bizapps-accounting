# plans/ — planning system

This folder follows the repo planning system (`~/MJDev/shared-plans/repo-planning-system.md`, adopted
2026-07-10). Read that doc before adding or changing anything here. The short version:

| Path | What it is |
|---|---|
| `MASTER-PLAN.md` | **The central source of truth.** Write-forward-only: closed text is never edited/deleted. New scope = appended Extensions (`Status: OPEN` while drafting → `CLOSED` when work begins). Top of file: Contradictions & Ambiguities ledger (CA-*). |
| `MASTER-PLAN-MODIFICATIONS.md` | Append-only MOD-* ledger of changes to closed master-plan text. Each MOD has a reciprocal ⚠ inline marker at the superseded section. **Precedence: MOD > Extension > original text.** |
| `action-plans/` | `ActionPlan - <Summary of Actions>.md` — the ONLY docs work is executed from. Header cites the §/MOD/EXT they implement. Move to `completed/` when done. |
| `completed/` | Finished (or abandoned) action plans. |
| `meetings/` | Transcripts + distilled per-meeting decision notes. **Meetings are inputs, never authority** — a decision only becomes the plan as a MOD or Extension. |
| `supporting-documents/` | Reference material that is neither plan nor meeting (ERDs, the legacy v2 roadmap, external-system schema exports, analyses). |

**Migration map (2026-07-10)** — old paths → new, for stale references in older docs:
- `plans/bizapps-accounting-master.md` → `plans/MASTER-PLAN.md`
- `plans/bizapps-accounting-master-plan-v2.md` → `plans/supporting-documents/…` (reclassified; live decisions = MOD-1..10)
- `plans/accounting-engine-plan.md` → `plans/action-plans/ActionPlan - Accounting engine + CreateJournalEntry remote op.md`
- `plans/batch-approval-lock-redesign.md` → `plans/action-plans/ActionPlan - Batch approval lock redesign.md`
- `plans/erd-accounting-target.md`, `plans/handoff-next-steps.md` → `plans/supporting-documents/…`
- `plans/Meeting with Amith.pdf` → `plans/meetings/…`
