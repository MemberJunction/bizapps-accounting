# Amith rescope rulings — June 2026 (extracted from the retired "master plan v2" doc)

> **Provenance (2026-07-11):** the former `supporting-documents/bizapps-accounting-master-plan-v2.md`
> was **retired and deleted** on Marcelo's directive — it had grown into a parallel plan that did not
> align with (and was never meant to override) the anointed MASTER-PLAN.md. This file preserves the
> **source material** it contained: Amith's and Robert's actual rulings from the 2026-06 rescope
> conversations, which are formalized as **MOD-1..10 (+ UPD-1) in the overlay ledgers — the ledgers are
> the authority; this file is a meeting-grade source only.** The deleted doc's roadmap/architecture
> content was superseded by the 2026-07-11 action plans; full text in git history.
> Underlying primary source: `supporting-documents/Transcript of Amith's Explanation.md` (2026-06-05).

## Guiding principle (Amith) → now UPD-1

Mirror **real-world accounting practice and structure** so professional accountants and auditors find
the system approachable and auditable — when choosing between "technically convenient" and "what a real
ledger does," do what a real ledger does. Framing: an **AR subledger (subsidiary ledger of record)** —
ingest Orders/Payments output, **batch + lock**, post **summaries** to the GL (Business Central). Not
the GL. No blockchain-style immutable store — strictest practical **DB-level controls** (triggers),
trust a CFO-level human not to bypass them, correct mistakes with **adjusting/corrective entries (pen,
not pencil)**, never by editing locked history. Also: generate our own test data and validate changes
against it (Amith's explicit recommendation).

## The C-rulings (conflict resolutions, 2026-06-28/29/30) → formalized as MODs

- **C1 — JE generation lives UPSTREAM; per-pair intercompany accounts (Amith veto of centralized);
  2026-06-30: Payments generates the Due-To/Due-From balancing legs, Accounting receives → batches →
  locks → posts (NO accounting-side generation or netting).** → **MOD-5**. Routing is upstream (split
  entries per account, stamped with source-entity IDs as the reassembly linking key). The
  `CounterpartyCompanyID` JE-line column idea was predicated on accounting-side generation — dropped
  (the per-pair account encodes the counterparty).
- **C1b — ALL FX (realized + unrealized) computed + posted upstream** ("FX is handled in
  Orders/Payments", Amith 2026-06-30); accounting keeps only GL-account refs + balance validation +
  `vw_FxExposure`. → **MOD-6**.
- **C2 — minimal seeded COA (~10-12)**; specific accounts don't matter; centralized intercompany rows
  removed. → **MOD-7**.
- **C3 — AccountBalance materialization deferred** ("might kill this for the first version"). → **MOD-2**.
- **C4 — branching `next → main`** confirmed. (Repo convention, CLAUDE.md.)
- **C5 — batch summary granularity: NETTED per (Company × GLAccount × Dimension-combo)**, null-dimension
  entries aggregate within their group (2026-06-28). → **MOD-4**.
- **CFO batch approval via the Tasks app (new requirement, 2026-06-28):** a batch must be approved
  before dispatch to BC, via a task in `bizapps-tasks`; the batch cannot move to `Sent` until the
  approval task completes. → folded into **MOD-3**.

## OQ-A — per-pair intercompany account wiring (Amith, 2026-06-28) → MOD-5(c)

Amith's answer: a sub-table joining two `AccountingCompanyProfile` records with **all four**
Due-To/Due-From accounts, **pre-created (eager) for every company pairing**. Proposed schema (name
`IntercompanyRelationship`; Amith suggested the longer `AccountingCompanyProfileIntercompanyRelationship`)
is reproduced in full in **MOD-5** and in the schema-alignment action plan A1. Design notes: one row per
unordered pair (canonical order), account-ownership invariant needs a trigger, eager provisioning hook on
new-ACP creation, account-code scheme open.

> ✅ **Sub-question RESOLVED (verified 2026-07-13, Marcelo's prompt):** the 2026-06-30 open question
> ("does Accounting still own the wiring?") was answered by the **2026-07-06 baseline squash**: the
> `IntercompanyRelationship` table had been created then DROPPED (net-zero) and was deliberately
> OMITTED — *"Accounting does no intercompany balancing; the Payments component owns due-to/due-from"*
> (baseline `B202605281200` fold header). So the wiring lands **Payments-side** when O2 is built; the
> OQ-A schema above is the reference shape for it there. MOD-5(c) corrected accordingly. Residual
> Payments-design item = QUESTIONS Q20.

## Still-live open questions from the retired doc's §12 (status-checked 2026-07-11)

1. **Open-AR cutover** — import open BC invoices pre-go-live (so payments apply in the new system) vs
   let pre-cutover AR close out in BC? **LIVE** — matters for the ≥2026-08-17 cutover. → BACKLOG
   `[decision needed: Robert/Jeremy]`.
2. **Manual-JE approval** — require approval before a `Manual` JE can be batched? **LIVE-ish** — folds
   into the MOD-9 role/status-rule design. → BACKLOG `[decision needed: Robert]`.
3. Intercompany allocation contract + counterparty tracking → **moot** for accounting per C1 (upstream
   owns generation) **and per the 2026-07-06 baseline ruling** (wiring dropped from accounting);
   resurfaces as a Payments-design question (orders repo, O2).
4. BC version skew (5.38 vs 5.41) → **stale**; environment has moved on.
5. Minimal COA contents → **resolved**, MOD-7 implemented (Commission Payable + Partner Rev Share
   Payable kept per Amith's in-scope accruals).

## Testing doctrine worth keeping (AD-17 practice — implemented in the invariant harness)

Every DB invariant gets three automated cases: (1) **raw-SQL bypass** (elevated-privilege threat model —
assert the trigger raises), (2) **app path** (clean error before the DB fires), (3) **allowed
counter-case** (the legitimate operation still succeeds). The balanced-JE check fires **on lock**, not
per-line (JEs assemble incrementally) — its test builds lines then flips status. This doctrine governs
the new triggers planned in action plans A1 (ICR) and the orders schema plan §6.1.
