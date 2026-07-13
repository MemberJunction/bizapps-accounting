# MASTER-PLAN-UPDATES — bizapps-accounting

A **living collection** (overlay) of **small refinements/additions** to existing `MASTER-PLAN.md`
sections — changes that keep a section's intent (new field, clarified behavior). Edit entries in place as
decisions evolve; never self-contradictory (git is the history); IDs stable/never reused; reciprocal ➕
inline markers kept in sync. Reversals/supersessions go to `MASTER-PLAN-MODIFICATIONS.md` (MOD-*);
meaningful scope expansion is an Extension. **Precedence: Modification > Update > Extension > original
text.** Convention: `~/MJDev/shared-plans/repo-planning-system.md` §3.1.

---

## UPD-1 — Guiding principle: mirror real-world accounting practice (2026-06, formalized 2026-07-11)
- **Amends:** MASTER-PLAN.md §1 (Context and positioning) — makes Amith's design ethos explicit; intent
  unchanged.
- **Change:** the app must **mirror real-world accounting practice and structure** so professional
  accountants/auditors find it approachable and auditable — between "technically convenient" and "what a
  real ledger does," do what a real ledger does. Framing: an **AR subledger of record** — ingest upstream
  output, batch + lock, post summaries to the GL. Integrity via the **strictest practical DB-level
  controls (triggers)** — no blockchain-style store; trust a CFO-level human not to bypass them; correct
  mistakes with **adjusting/corrective entries (pen, not pencil)**, never by editing locked history.
  Corollary: generate our own deterministic test data and validate changes against it.
- **Why / source:** Amith 2026-06-05 transcript + 2026-06-28 rulings —
  `meetings/2026-06 - Amith rescope rulings (extracted from retired v2 plan).md`. Formalized when the
  parallel "v2 plan" doc was retired (Marcelo directive 2026-07-11).
- **Status:** Accepted (already the as-built philosophy — the triggers doctrine + invariant test matrix).
