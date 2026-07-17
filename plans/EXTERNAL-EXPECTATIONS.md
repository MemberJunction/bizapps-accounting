# EXTERNAL-EXPECTATIONS — bizapps-accounting (+ orders program)

> **What this is (prototype, 2026-07-17 — Marcelo):** the record of **what we need FROM other
> people** for the system to work — decided requirements and owed deliverables, NOT questions.
> The questions stock asks; this doc states expectations so their owners can review, confirm, or
> push back. Share it alongside the questions docs + `ROADMAP-lxp-launch.md` for a complete
> picture. One row per expectation: owner · what we need · why/source · status.
> Statuses: `STATED` (we've recorded it; owner may not have seen it) · `COMMUNICATED` (owner has
> it) · `ACCEPTED` (owner confirmed) · `DELIVERED` · `DECLINED/CHANGED` (renegotiated — update the
> plan chain). A convention proposal for this doc type is filed in `~/MJDev/MJDEV-REQUESTS.md`.

## Jeremy (finance / BC)

| # | Expectation | Why / source | Status |
|---|---|---|---|
| J1 | **Standardize BC company configuration** across the 9+ companies (posting groups, number series, dimensions, journal templates/batches) BEFORE we wire the dispatch integration — inconsistency becomes per-company API special cases | Jeremy self-offered ("I can own that but will need to do some research"); Robert + Marcelo aligned — UPD-2 | ACCEPTED (self-owned) — in progress |
| J2 | **Identify the open-invoice transfer set**: which open invoices in the BC Data Platform have NO GL journal entries yet (defines cutover scope); companion call — already-journalized open invoices: stay in legacy for collection vs JE-suppressed import | Robert's OQD cutover rule — orders UPD-10 | STATED |
| J3 | **Share the BC tenant/app-registration setup** (the read-only reporting registration Clara requested) as the starting point for our write path | Jeremy offered — UPD-2 | ACCEPTED (offered) |
| J4 | **Keep batch cadences ALIGNED for company pairs with an active intercompany relationship** (both weekly, not one weekly/one monthly) — an ops/config rule, so the in-transit window stays short | Jeremy's own MOD-15 condition (1) — we surface it in batch-schedule config; he owns living by it | ACCEPTED (his condition) |
| J5 | **Treat "posted in source, not yet in BC" as a reconciling item TYPE** in the intercompany rec process (not a break) | Jeremy's MOD-15 condition (2); lands with ACC-H.3 | ACCEPTED (his condition) |
| J6 | **The Q19 sitting** — golden path + exceptions (batch defaults within the never-forward constraint, reversal continuity, backdating rules, dimension list, invoices flow, no-subledger-lock validation) | Q19 (★HIGH) | STATED |
| J7 | **Launch-tax call (with John):** LH4I launches WITH Stripe Tax pulled forward, or explicitly tax-exempt/manual — a decision, never a default | Robert A4 / orders Q22 | STATED |

## Robert (orders/accounting design)

| # | Expectation | Why / source | Status |
|---|---|---|---|
| R1 | **Stand up (or bless) the separate, purpose-built BC app registration scoped to journal WRITE** — his own recommendation, his call to execute; we treat it as a REQUIREMENT (never widen the read-only reporting registration) | Jeremy recommended, "your call" to Robert — UPD-2; Marcelo 2026-07-17: "separate registration is a requirement" | STATED |
| R2 | **Sync the P1 proposal doc + BatchingEngine model to the thread consensus** — singular batch `PostingDate` (Amith's model, Jeremy 100% on board; Q37 ANSWERED) supersedes P1's per-JE dates; Jeremy also asked him to flip OQ-1's status to answered in that doc | Q37 answer; his own "I'll keep an ear open to future changes" | STATED |
| R3 | **OS7 coupons-schema review** once we share the artifacts (see `~/MJDev/reports/robert-file-share-2026-07-17/`) | UPD-8; his review checklist is recorded | COMMUNICATED (files shared 2026-07-17) |
| R4 | **Ask Sidecar the coupon questions** (surfaces beyond Stripe checkout? shapes in use incl. ASAE config? LXP display/validate needs?) + run the two provider investigations before the recording-schema freeze | His own A2 plan — UPD-8 | ACCEPTED (self-assigned) |
| R5 | **Ask Ethan the A3 entitlement questions** (grant granularity · lifecycle coupling · read contract · team beneficiary semantics) — gates the grant-shape freeze | His own A3 response | ACCEPTED (self-assigned) |
| R6 | **Roles/visibility path detail** — he owns the `UserCompanyRole` direction through the A2 co-design (incl. the Izzy/Access-Control-Rules dig he flagged) | Q22/Q24 answers + 07-16 meeting | ACCEPTED |
| R7 | **BAO-ready date (with Marcelo)** for the minimal LH4I scope — the A7 answer Ethan is waiting on | orders Q22; `ROADMAP-lxp-launch.md` V2 gate | STATED |

## Ethan / LXP team

| # | Expectation | Why / source | Status |
|---|---|---|---|
| E1 | **Answer Robert's A3 entitlement questions** — we cannot freeze the grant read-contract without them | Robert A3 | STATED |
| E2 | **LXP-owned builds:** Auth0 SSO acceptance, buyer provisioning from Orders, LH4T org/admin setup + email-domain association (A5/A6), existing-customer migration | LXP doc §7 | STATED (their doc says the same) |
| E3 | **Accept the Teams-first contingency** if the BAO date slips (their own §8 lean) | MOD-13 | ACCEPTED (their lean) |

## Amith (architecture)

| # | Expectation | Why / source | Status |
|---|---|---|---|
| A1 | **FYI acknowledgments** (no decisions): Q3 ID-contract revision of his early instruction · Q9 GLAccountRoleID formality · CH-2/CH-3 reversal now fully ratified (MOD-12/15) | FYI report `~/MJDev/reports/amith-fyi-2026-07-17/` | COMMUNICATED (report ready) |
| A2 | ~~Q37 confirmation~~ — **DELIVERED**: his posting-date message WAS the answer (singular batch PostingDate adopted, MOD-16 reworked) | Q37 answer | DELIVERED |
| A3 | **Multi-company-batch evolution** — his 2026-07-17 lean is backlogged (per-company sections inside a batch, later); he asked Robert + Jeremy to weigh in | BACKLOG row; MOD-15 stands for v1 | COMMUNICATED (his own ask) |
