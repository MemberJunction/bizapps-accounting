# BACKLOG — bizapps-accounting (plans-level)

Repo-level wanted-but-not-started work + decision-needed items. Holding pen only — promote an entry into
an `action-plans/ActionPlan - *.md` when picked up and mark it promoted. Entry: what · source · status.
Convention: `~/MJDev/shared-plans/repo-planning-system.md` §5.1. (The instance-level
`instances/<slug>/BACKLOG.md` tracks agent working items; this file tracks repo/plan-level items.)

## Tasks

- [ ] **`IntercompanyRelationship` migration** — the Amith-specified per-pair Due-To/Due-From wiring table
      (MOD-5; schema in `supporting-documents/bizapps-accounting-master-plan-v2.md` Preface OQ-A). Eager
      provisioning hook + account-ownership trigger.
- [ ] **View-driven batch builder** — arbitrary batches from an MJ User View, validated unbatched-only
      (MOD-8; Robert 2026-07-09 D2).
- [ ] **Role seeding + RLS** — Accounting User/Admin roles seeded in migrations, entity permissions + RLS
      by company, setup/settings screen + install doc (MOD-9; Robert 2026-07-09 D1; co-design role tree
      with Marcelo).
- [ ] **Jeremy reporting pack** — the §10 read-model reports (AR aging, DefRev rollforward first) toward
      Power BI parity; reporting is cutover-gating (meetings/2026-07-10-decisions.md §I).
- [ ] **Batch dimension strategy for customer detail to BC** — which dimensions batches split by
      (customer, product, renewal-vs-new, event); ask Jeremy for his definitive list
      (2026-07-10 Jeremy meeting). `[decision needed: Jeremy]`

## Decisions needed

- [ ] **Periods reconciliation** — closed-period guard vs periods-removed (CA-1) + ScheduledJournalEntry
      materialization trigger (CA-2). `[decision needed: Amith/Robert + Jeremy exception rules]` (Q18/D-Q2)
- [ ] **Tax first iteration: order-line-type vs separate tables** — pick one (Robert offered the quick
      path; accounting tax tables exist either way). `[decision needed: Robert]`
