# BACKLOG — bizapps-accounting (plans-level)

Repo-level wanted-but-not-started work + decision-needed items. Holding pen only — promote an entry into
an `action-plans/ActionPlan - *.md` when picked up and mark it promoted. Entry: what · source · status.
Convention: `~/MJDev/shared-plans/repo-planning-system.md` §5.1. (The instance-level
`instances/<slug>/BACKLOG.md` tracks agent working items; this file tracks repo/plan-level items.)

## Tasks

- [x] ~~**`IntercompanyRelationship` migration**~~ — PROMOTED 2026-07-11 →
      `action-plans/ActionPlan - Schema alignment (IntercompanyRelationship, roles, RLS).md` A1.
- [x] ~~**View-driven batch builder** (MOD-8)~~ — PROMOTED 2026-07-11 →
      `action-plans/ActionPlan - Feature build (batching, reporting, materialization).md` B1.
- [x] ~~**Role seeding + RLS** (MOD-9)~~ — PROMOTED 2026-07-11 → Schema action plan A2 (co-design
      checkpoint with Marcelo before executing).
- [x] ~~**Jeremy reporting pack**~~ — PROMOTED 2026-07-11 → Feature action plan B2.
- [ ] **Batch dimension strategy for customer detail to BC** — which dimensions batches split by
      (customer, product, renewal-vs-new, event); ask Jeremy for his definitive list
      (2026-07-10 Jeremy meeting). `[decision needed: Jeremy]` (Execution slot reserved: feature action
      plan B1.5 — seeds + upstream tagging once decided.)

## Decisions needed

- [ ] **Periods reconciliation** — closed-period guard vs periods-removed (CA-1) + ScheduledJournalEntry
      materialization trigger (CA-2). `[decision needed: Amith/Robert + Jeremy exception rules]` (Q18/D-Q2)
- [ ] **Tax first iteration: order-line-type vs separate tables** — pick one (Robert offered the quick
      path; accounting tax tables exist either way). `[decision needed: Robert]`
