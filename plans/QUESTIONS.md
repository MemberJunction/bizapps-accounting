# QUESTIONS — bizapps-accounting (plans-level question stock)

> Structured per the questions convention (`~/MJDev/shared-plans/questions-convention.md`): stable
> append-only body + ONE derived priority index. **ANSWER-FIRST (restructured 2026-07-16, Marcelo
> ruling):** new entries LEAD with a **Proposed solution** (the action we are implementing) and
> PROCEED with it by default — the question is supporting info for the **Requested reviewer**;
> mark **⏸ HOLD** only where proceeding is expensive to reverse. Field order for NEW entries:
> Status · Requested reviewer · Features · Proposed solution · The question · Context to share ·
> What motivates this now (opt) · Fixed constraints (opt) · Additional context · Answer. Existing
> OPEN entries adopt the new shape when next touched; frozen entries are never edited. Trivially
> reversible micro-decisions do NOT get entries — they go in the active action plan's "Decisions
> taken" list. **Migrated 2026-07-16 from the instance stock** — original IDs + anchors preserved
> (never renumber); new questions append with the next free Qn.
> Distribution copies for the team: `~/MJDev/reports/team-questions-2026-07-16/`.

## Index — by priority (open only)

| Ask order | Q | Ask | Status |
|---|---|---|---|
| — | [Q37](#q37) | posting-date model — ANSWERED same-day (Amith's singular batch PostingDate; Jeremy 100%; OQ-1 hold-and-flag) | ANSWERED |
| 1 | [Q19](#q19) | Jeremy — golden path + exceptions (absorbs Q12/Q15) | OPEN ★HIGH |
| — | [Q22](#q22) | company-visibility mechanism — ANSWERED (UserCompanyRole grant table) | ANSWERED |
| — | [Q24](#q24) | grants + governance — ANSWERED (audit cols now, workflow deferred) | ANSWERED |
| 4 | [Q25](#q25) | Ian/Matt/team — shared-UI component routing (transfer backlog) | OPEN |
| — | [Q6](#q6) | batch-approval shape — ANSWERED (per-company task; enforce Approver; manual-JE gate YES) | ANSWERED |
| — | [Q7](#q7) | batches/approvals visibility — ANSWERED (see=role+grant; act=Approver-for-company) | ANSWERED |
| — | [Q3](#q3) | JE-draft contract — ANSWERED (bless as-built IDs; FYI to Amith owed) | ANSWERED |
| 8 | [Q9](#q9) | Amith — GLAccountLink role FK (bless-as-built) | OPEN |
| 9 | [Q26](#q26) | Matt — Explorer header widget slot (feature ask) | OPEN |
| 10 | [Q36](#q36) | Marcelo — no global GL-account pool; is the COA model as-built right? | OPEN — was dup-numbered Q29, renumbered 2026-07-17 |
| — | [Q30](#q30) | batches single-company — ANSWERED 2026-07-17 (yes; MOD-15/16) | ANSWERED |
| 12 | [Q31](#q31) | Robert/Amith — should product/category links carry a ROLE? (premise updated: company now derives from PRODUCT) | OPEN ★HIGH |
| 12b | [Q38](#q38) | Robert/Amith — cross-company mapping REFUSED; company-scoped resolution + per-company category routes (posting-group model) | OPEN — proceeding ★HIGH |
| 12c | [Q39](#q39) | Jeremy (+Robert) — multi-company AR: MODEL (b) seller-of-record RULED (one invoice, owner holds AR); confirm + booking-time legs + tax edges | OPEN — proceeding ★HIGH |
| 13 | [Q32](#q32) | Matt — tab strip's overflow-x silently enables overflow-y (real bug + fix) | OPEN |
| 14 | [Q33](#q33) | Matt — dense/inline [meta] on mj-page-header (⚠ may be obsolete — check) | OPEN |
| 15 | [Q34](#q34) | Matt — we duplicated mj-accordion-panel; is there a component catalogue? | OPEN |
| 16 | [Q35](#q35) | Matt — [Bare] accordion: divider, square hover, chevron side (one root cause) | OPEN |
| 10 | [Q27](#q27) | Matt — `mj-left-nav` desktop icons-only collapse (feature ask) | OPEN |
| 4b | [Q28](#q28) | Marcelo — batch/task transaction split + batch task pointer (MOD-14) | OPEN (no-CFO precheck RULED+built) |
| 4c | [Q29](#q29) | Marcelo/Ian — regenerate: reset the existing task vs void+replace (principle ruled) | OPEN |
| 11 | [T36](#t36) | Marcelo — deterministic test data (internal) | OPEN |

*(Feature index removed 2026-07-16 per convention — each entry's **Features** field is the
queryable surface for "which questions touch feature X".)*

## Questions (append-only body)

<a id="q19"></a>
### Q19 · Golden path + exceptions collection — ask Jeremy — 2026-07-09 (reformatted 2026-07-16)
- **Status:** OPEN ★HIGH (unblocks Q12/Q15 detail; reporting is cutover-gating)
- **Who to ask:** Jeremy (BC/accounting SME) — Marcelo to demo the flow + gather the list (also from Ethan)
- **Features:** ACC-D (batch defaults), ACC-C.5 (reversals), ACC-H (reporting)
- **Background (self-contained):** Robert routed the GAAP-judgment calls to Jeremy. The golden path
  is built (orders book JEs at Confirm; JEs batch to Business Central; reversals auto-forward-date;
  backdating is allowed and the JE bears the order date). Needed from Jeremy: how his REAL workflow
  bends that path — the defaults and the exceptions. Frame: "here's the golden path — now the exceptions."
- **The questions for Jeremy:** (1) **default batch filters** — window + status (Robert's guess:
  Pending; +Approved last week); (2) **payments vs orders in batches** — does he separate them; do we
  need type grouping at all (Robert: no hard restriction); (3) **reversal continuity** (absorbs Q12) —
  same-period pairing vs the built auto forward-date (we lean keep forward-date, no pairing); (4)
  **backdating frequency + exception rules** (absorbs Q15's remainder) — handling for items that
  "should have been" in an already-batched stretch; (5) the **invoices flow** (invoices ≈ posted
  orders); (6) **validate the no-subledger-lock stance** — "we don't lock anything in the AR subledger
  and leave it up to the GL" (Robert 2026-07-13; Marcelo's rationale: batch summaries lose date info;
  accountants batch entries into the right periods) — any concerns?; (7) his definitive **batch
  DIMENSION list** (customer, product, renewal-vs-new, event?) — gates the netted-summary shape
  (feature plan B1.5 slot reserved).
- **Robert's 2026-07-16 amendments to the sitting (draft-answers doc):** (1) default batch date
  window **cuts off at today and never reaches forward** (P5/MOD-17 constraint — else batches sweep
  forward-dated rev-rec JEs); Jeremy picks defaults within that. (2) Under MOD-15, **company drops
  out of the dimension list** — the batch IS the company group; dimensions slot into the
  (GLAccount × dims × EffectiveDate) netting key. (3) 2026-07-17 UPDATE: several items Robert
  wanted bundled here are now ANSWERED in the week's feedback thread — OQ-1 closed-period rule
  (HOLD-and-flag, MOD-16), the P3 trade-offs (accepted w/ two conditions, MOD-15), and P4 BC API
  (endpoints confirmed, UPD-2) — do NOT re-ask; the remaining items (1)-(7) stand.
- **Context to share:** the live demo (interface intentionally rough — features matter for the internal
  LXP demo); Robert is re-reading the old Aptify batching capabilities in parallel.
- **Additional context (for a verifying agent):** `plans/2026-07-09-robert-meeting-decisions.md` D2/D3;
  `Accounting Meeting-20260709_121044-Meeting Recording.md`; BACKLOG `[decision needed: Jeremy]` row.
- **Answer:** _(pending)_

<a id="q22"></a>
### Q22 · Company-visibility mechanism (roles/RLS) — ask Robert — added 2026-07-14 (Task 50a; context expanded Task 54a)
- **Status:** OPEN — **Robert now OWNS the path** (2026-07-16/17): Marcelo's `UserCompanyAccess`
  proposal was posted to the team channel (recorded in `meetings/2026-07-17 - User Feedabck over
  the week 07-12.md`); Robert's initial response: the core Users→Employee→Company chain exists but
  is informational-grade (agrees "we're a little too open in the default setting"), MJ's **Access
  Control Rules** layer may fit ("I need to dig deeper"), and he'll study how **Izzy** does
  org-level roles + propose a path. Marcelo: **v1 is NON-BLOCKING** — first release proceeds
  without it (UI builds the gated screens LAST). Expect Robert's proposal doc; also expect his
  answers doc keyed to these Q IDs.
- **Who to ask:** Robert (mechanism feedback); the policy decisions themselves are already made by Marcelo.
- **Background (self-contained):** The accounting app manages MANY companies (our own legal entities/
  subsidiaries) in one database; every journal entry now belongs to exactly one company
  (`JournalEntry.CompanyID`). Not every accounting user should see every company's books, so we need
  "user U works only companies X and Y" enforced by the platform — not by UI convention.
  MemberJunction's built-in row-level security is how that's done: a role's entity permission can carry
  a SQL filter that the API server appends to EVERY query that role's users run (e.g. on reading
  Journal Entries: `CompanyID IN (the companies this user can access)`); the user identity in the
  filter comes from the authenticated session, so it can't be spoofed from the client; a role with no
  filter (e.g. Accounting Admin) sees everything. All of that machinery exists today. The ONE missing
  piece is the data source the filter reads — some record of which user has access to which companies.
  That mechanism is this question.
- **FIXED rulings (Marcelo — not up for debate, they hold under any mechanism):** (1) a multi-company
  batch is permitted only when the user has access to EVERY company in it; (2) users can only batch
  JEs they have access to; (3) users can only SEE JEs of companies they have access to.
- **The question for Robert:** what should hold the user↔company access facts?
  (A) a small dedicated link table (`UserCompanyAccess`: UserID, CompanyID, IsActive, granted-by/at) —
  admin-managed rows, one per grant; the RLS filter does an indexed subquery against it, and the same
  table feeds the cross-record batch rules above. Recommended in our research —
  but Marcelo's concern is that a DB table for visibility feels like a complex system to own, so he
  wants Robert's read. (B) one MJ Role per company ("Accounting — Company X") — zero new tables, uses
  pure role machinery, but the role list grows with every company and multi-company users need stacks
  of roles (awkward admin at scale). (C) a different shape Robert prefers — the RLS filter is plain
  SQL, so any queryable source works.
- **Context to share:** accounting `plans/research/A2-R1-R3-rls-and-person-linkage.md` — the verified
  MJ RLS mechanics + efficiency analysis (writes are RLS-enforced too — verified in MJ core
  2026-07-14, so one filter mechanism covers read AND write), and the threat model (app users hold no
  DB credentials; the DB triggers are the raw-SQL floor). Q24 covers how grants are governed.
- **Answer:** **Option A, UPGRADED — a `UserCompanyRole` grant table** (UserID, CompanyID, RoleID,
  IsActive + Q24 audit columns; unique on the triple): per-company ROLES, not just visibility — a
  user can be Accounting User in Company X and Accounting Approver in Company Y. Role semantics
  are SIBLINGS not a ladder: Approver = User + approval authority; Admin = User + company setup —
  **Admin does NOT inherit approval** (maker-checker). MJ role layer stays minimal: ONE
  `Accounting` role carrying entity CRUD permissions with RLS filters on all four operations
  (`CompanyID IN (SELECT CompanyID FROM UserCompanyRole WHERE UserID='{{UserID}}' AND IsActive=1)`)
  + an optional unscoped `Accounting Global Admin` (no approval authority anywhere; break-glass =
  self-grant Approver, which audits). Precedent verified: Izzy `OrganizationPersonRole`, Skip-Brain
  `OrganizationContact`, CDP's ATS company-scoped login. Employee-chain derivation rejected
  (cardinality, employment≠book-access, no role fit). Deployment rule: audit that NO other role
  grants unfiltered access to company-scoped accounting entities (MJ RLS exemption footgun).
  **Routed onward:** amends action plan A2's first-iteration scoping (per Robert's process flag 0);
  FEATURE-LIST K.2 updated. Source: `meetings/2026-07-16 - marcelo-questions-draft-answers.md` §Q22.

<a id="q24"></a>
### Q24 · Securable company-membership grants (vs informational person data) — ask Robert — added 2026-07-14 (Task 51a; context expanded Task 54a)
- **Status:** ANSWERED (Robert, 2026-07-16 draft-answers doc) — frozen.
- **Who to ask:** Robert (pairs with Q22 — same sitting; Q22 asks WHERE the user↔company facts live,
  this asks HOW they're established and governed).
- **Background (self-contained):** The accounting app is getting company-scoped visibility: each user
  sees/works only the companies (our own legal entities — the ones with a Chart of Accounts and
  journal entries) they've been granted. Whatever mechanism Q22 lands on, the platform needs a data
  source answering "which companies may user X access" — and that source becomes a SECURITY control:
  whoever can edit it controls who can see and change financial records.
- **The finding that motivates the question:** The platform already has several places where a person
  and a company look connected, and it's tempting to derive access from them. We audited all of them
  and none are security-grade: (1) `Person.LinkedUserID` connects a CRM contact record to a login
  account, but it's an ordinary editable field — no uniqueness, no verification, re-pointable by
  anyone with contact-edit rights; (2) CRM `Relationship` rows connect Persons to customer
  Organizations (clients we sell to), not to our own accounting companies; (3) the core `Employee`
  table has a CompanyID but no link to a login at all (only an email string). Consequence: if
  financial visibility keyed off any of these, an ordinary CRM data edit would silently change who
  can read/write company books.
- **The question for Robert:** (1) Confirm the principle — company-access grants are EXPLICIT,
  admin-managed security records (editable only by the Admin role, like role assignments themselves),
  never derived or auto-synced from person/CRM/HR data. (2) Does he want governance around grants —
  approval workflow, audit trail of who granted what when, expiry/review? (3) If the org later wants
  HR-driven membership (an employee roster feeding access), our stance is that becomes a governed sync
  INTO the grant store — access control never reads HR/CRM data directly. Does he agree?
- **Context to share:** research doc R3 section (the securable-vs-informational table) + Marcelo's
  fixed rulings (multi-company batch requires access to ALL companies; batch/see only accessible JEs).
- **Answer:** (1) **Principle CONFIRMED** — grants are explicit, admin-managed security records,
  editable ONLY by Accounting Global Admin (per-company Admins cannot edit grants even for their
  own company — else a company Admin could self-grant Approver and defeat maker-checker); never
  derived/auto-synced from Person/CRM/HR data. (2) **Audit trail NOW, workflow DEFERRED:** ship
  `GrantedByUserID/GrantedAt/RevokedByUserID/RevokedAt/IsActive` (revoke = deactivate, never
  delete; optional `ExpiresAt` if cheap); approval workflow + periodic review = later
  (tasks-substrate shape when wanted). (3) **HR-driven membership: AGREED** — a governed sync INTO
  the grant store, same audit columns; access control never reads HR/CRM directly.
  Source: `meetings/2026-07-16 - marcelo-questions-draft-answers.md` §Q24.

<a id="q25"></a>
### Q25 · Transfer-backlog routing — who receives the UI components parked in accounting? — added 2026-07-15 (Task 73a)
- **Status:** OPEN
- **Ask:** Ian (bizapps-tasks) · Matt (MJ base) · team (bizapps-common ownership)
- **Question(s):**
  1. **Approval inbox** (tasks-backed approve/reject list + context slide-in, used by accounting batch
     + manual-JE approvals and orders sales-rule approvals): does bizapps-tasks ship (or want) an
     Angular package to home it? Who owns that surface? (Ian is out until ~2026-07-21.)
  2. **List-screen scaffold** (grid + time-window default + keyset paging + slide-in + live refresh):
     Matt — does this overlap MJ's existing `list-detail-grid` / `simple-record-list`, and should it
     land as part of / alongside the Live Page System plan's **LiveDashboardBase** (approved,
     `~/MJDev/shared-plans/live-page-system-accounting-orders.md`) rather than as a bizapps component?
  3. **Role-gating directive/guard** (over MJ Unified Permissions) + **cross-app deep-link helper**
     (open-app resource routing): Matt — MJ-base candidates; take them upstream, or should
     bizapps-common carry them?
- **Context to share:** during the UI wave these are PARKED in bizapps-accounting for iteration speed
  (Marcelo ruling: minimize dev-linked apps/feature branches — agents struggle keeping feature
  branches current with next, MJDEV-ISSUES filed 2026-07-15). Parking discipline: bounded folder,
  zero accounting-entity imports, extraction = file move. Ledger with per-item target + trigger:
  accounting `plans/TRANSFER-BACKLOG.md`; candidacy tracking: each repo's
  `design-docs/ui-design/README.md` component inventory.
- **Additional context for a verifier:** accounting UI plan §0 (shared-components block), roadmap
  D23 (`~/MJDev/shared-plans/planning-system-family-roadmap.md`).
- **Answer:** —

<a id="q6"></a>
### Q6 · Batch-approval workflow shape — ask Robert — 2026-07-08 (reformatted 2026-07-16)
- **Status:** ANSWERED (Robert, 2026-07-16 draft-answers doc) — frozen. Premise updated first:
  batches are SINGLE-COMPANY (P2+P3 RULED — see MOD-15/Q30), which dissolves sub-question (1).
- **Who to ask:** Robert
- **Features:** ACC-D.3 (batch approval), ACC-C.8 (manual-JE gate)
- **Background (self-contained):** When a batch is built, an approval Task is created via the
  bizapps-tasks substrate and assigned to the union of the involved companies' designated CFO
  approvers (interim). Today ANY linked person can record the decision — the assignment is
  informational, not enforced. (Original ref: OQ-F.)
- **The question for Robert:** (1) one approval task per batch, or one per company in the batch?
  (2) must the decider be strictly the designated CFO approver, or may any permitted user record
  the decision? (3) same sitting: confirm the manual-JE approval gate (CFO approval before a manual
  entry can batch) — held as "lean yes" (§14 Q10), UI designed.
- **Context to share:** the batch-approvals + manual-JE approvals mockup pages.
- **Additional context (for a verifying agent):** `TasksAppApprovalGate` (`onBatchBuilt`,
  `recordDecision`, `resolveCurrentPersonId` = Person.LinkedUserID == user.ID).
- **Answer:** (1) **One approval task per batch — which IS one per company** under MOD-15
  single-company batches; assigned to that company's designated CFO by default. (2) **Enforce the
  decider before anything beyond dev, via ONE path:** `recordDecision` accepts only a user holding
  **Accounting Approver for that batch's company** in the Q22 `UserCompanyRole` table (the sole
  source of approval authority); `ApprovalCFOPersonID` remains only the task-ASSIGNMENT default.
  Admin/Global Admin do NOT inherit approval. Current any-linked-person behavior = dev scaffolding
  only — this is a security control on financial postings. (3) **Manual-JE gate: CONFIRMED YES**
  (lean-yes becomes a ruling; C.8's approval-inbox + review-modal UI shape is right).
  Source: `meetings/2026-07-16 - marcelo-questions-draft-answers.md` §Q6.

<a id="q7"></a>
### Q7 · Batches/approvals visibility — ask Robert — 2026-07-08 (reformatted 2026-07-16)
- **Status:** ANSWERED (Robert, 2026-07-16 draft-answers doc; final confirm rides the A2 co-design
  sitting) — frozen.
- **Who to ask:** Robert
- **Features:** ACC-D.3, ACC-K.1
- **Background (self-contained):** No permission gating exists today (dev): every user who can open
  the app sees the Batches/Approvals surfaces and all controls. (Original ref: task #17.)
- **The question for Robert:** who can SEE the Batches/Approvals surfaces, and who can see/use
  Approve/Reject? Needed before exposing the management UI beyond dev.
- **Context to share:** the proposed role set (Admin / User / CFO Approver) in the users-&-roles mockup.
- **Additional context (for a verifying agent):** MJ `guides/UNIFIED_PERMISSIONS_GUIDE.md`.
- **Answer:** **SEE** = any user with an accounting role in the Q22 grant table (Admin / User /
  Approver — the mockup's "CFO Approver" renames to Accounting Approver), rows RLS-scoped to
  granted companies; Accounting Global Admin unscoped. **ACT** (Approve/Reject) = ONLY Accounting
  Approver for THAT company (roles are per-company — same person can be User in one, Approver in
  another). Users can build batches within their grants but never decide approvals. Nothing
  visible without an accounting role. Source: `meetings/2026-07-16 - marcelo-questions-draft-answers.md` §Q7.

<a id="q3"></a>
### Q3 · JE-draft account contract: resolved ID vs account number — ask Robert — 2026-07-08 (reformatted 2026-07-16)
- **Status:** ANSWERED (Robert, 2026-07-16 draft-answers doc) — frozen. ⚠ FYI-to-Amith owed: this
  formally revises his early meeting-note "always use the account number" instruction.
- **Who to ask:** Robert
- **Features:** ACC-L.2 (JE draft contract)
- **Background (self-contained):** As built, `JournalEntryDraft` passes resolved **GLAccount ID
  UUIDs** (orders resolves accounts via `GLAccountLink` before submitting); account **numbers**
  appear only as the ERP wire format at the batch boundary. A meeting note said "code/number."
- **The question for Robert:** bless the as-built ID choice and record it, or switch the draft
  contract to account numbers?
- **Context to share:** as-built = ID; numbers only at ERP dispatch.
- **Additional context (for a verifying agent):** amendment S2 (documents the as-built choice);
  `AccountingEngineBase.ResolveLinkedAccount`.
- **Answer:** **Bless the as-built resolved-ID contract.** Two boundaries, two identifiers:
  internal Orders→Accounting `JournalEntryDraft` = resolved GLAccount **ID UUIDs** (GLAccountLink
  stores the FK; a number round-trip would be lossy + per-company-ambiguous for zero benefit);
  external batch→BC = **GL Account Numbers, never our IDs** (AM-4, unchanged). Amith's underlying
  intent (engine independently validates account exists/company/active) is preserved and stays.
  Source: `meetings/2026-07-16 - marcelo-questions-draft-answers.md` §Q3.

<a id="q9"></a>
### Q9 · `GLAccountLink.GLAccountRoleID` confirmation — ask Amith — 2026-07-08 (reformatted 2026-07-16)
- **Status:** OPEN (bless-the-as-built; low risk)
- **Who to ask:** Amith
- **Features:** ACC-B.1 (GL account mapping)
- **Background (self-contained):** As built, `GLAccountLink` carries a `GLAccountRoleID` FK — the
  role-based polymorphic mapping (a link points a ROLE like Revenue/DefRev/A-R at a product,
  category, or company). The role FK was absent from Amith's original field list and assumed added.
  (Original ref: OQ-G.)
- **The question for Amith:** confirm the role FK is part of the intended model, plus any remaining
  amendment open item (OQ-H).
- **Context to share:** migration `B202605281200` (GLAccountLink line 682, GLAccountRole 658).
- **Additional context (for a verifying agent):** accounting FEATURE-LIST B.1 (MOD-10).
- **Answer:** _(pending)_

<a id="q12"></a>
### Q12 · Reversal continuity: same-period pairing vs auto forward-date — folded into Q19 — 2026-07-08 (reformatted 2026-07-16)
- **Status:** OPEN — re-routed to Jeremy 2026-07-09; rides [Q19](#q19) item (3)
- **Who to ask:** Jeremy (GAAP continuity call)
- **Features:** ACC-C.5 (reversals), ACC-D (batching)
- **Background (self-contained):** Cherry-picking entries into a batch is banned entirely
  (all-or-nothing — subtractive cherry-picking would let earnings be deferred by hand). Robert
  2026-07-09: the real workflow is "regenerate the OPEN batch" (review → post correcting entries →
  regenerate → post), which the built Regenerate already does. Reversals today AUTO FORWARD-DATE
  into the current period (`generateReversal` sets `EffectiveDate = now`, verified).
- **The question for Jeremy:** should a reversal ever be pulled into the SAME batch/period as its
  original, or is auto forward-date the GAAP-preferred behavior (making same-period pairing an
  override we should NOT offer)? A same-period reversal nets that period to zero and can hide that
  the event occurred; forward-dating preserves faithful period-by-period history. We lean "keep
  auto forward-date, no pairing."
- **Additional context (for a verifying agent):** `JournalEntryEntityServer.generateReversal`;
  plan §4-A/§4-D.
- **Answer:** _(pending via Q19)_

<a id="q15"></a>
### Q15 · Backdated order: which date does the JE bear? — folded into Q19 — 2026-07-08 (reformatted 2026-07-16)
- **Status:** PARTIAL (Robert 2026-07-09) — the remainder rides [Q19](#q19) item (4)
- **Who to ask:** Jeremy (via Q19); originally Robert/Amith
- **Features:** ORD-C.6 (backdating), ACC-C (JE dates)
- **Background (self-contained):** Robert ruled backdating is ALLOWED — the order carries its own
  `OrderDate` and the JE bears the order date (verified: `Order.OrderDate → JournalEntry.EffectiveDate`).
  His only stated constraint was a closed-period guard — which became MOOT when periods were removed
  (MOD-1 FINAL; Q8/Q18 answered): backdating ships unguarded and the ERP's active period absorbs
  dispatched batches.
- **What remains (rides Q19):** backdating FREQUENCY in the real workflow + the correcting-entry
  exception rules for items that "should have been" in an already-batched stretch.
- **Additional context (for a verifying agent):** `OrdersEngine.ts:186`
  (`asOfDate = order.OrderDate ?? new Date()`); plan §4-E/§13; orders CA-3.
- **Answer:** _(partially answered above; remainder pending via Q19)_

<a id="t36"></a>
### T36 · Read-model API test tier: deterministic data on the lived-in demo instance — ask Marcelo — 2026-07-10 (reformatted 2026-07-16)
- **Status:** OPEN (internal test-infra — not for team distribution)
- **Who to ask:** Marcelo
- **Features:** ACC-N.2 (test substrate)
- **Background / the question:** The Tier-3 API harness `test-harnesses/api/readmodels-api.ts` asserts EXACT accounting
  numbers (AR net 2300, trial-balance Dr/Cr 3920, 3 open customers, 4 CO1 batches, etc.) against the
  shared **Association demo company** `CO1 = a55c0de1-…0001`. That company has accumulated extra demo +
  prior-test data, so 7 exact-value checks now fail (e.g. AR net 3100 not 2300, 4 customers not 3). The
  resolvers are PROVEN CORRECT — every drift-proof invariant passes (trial balance foots to zero, aging
  buckets sum to TotalOpen, batch statuses/CompanyCount, intercompany scoping) — it's purely that the
  fixed-UUID company is no longer pristine. How do you want the tier to get deterministic data?
- Options: (a) **Isolate** — have the harness seed + assert against its OWN fresh per-run company (like
  the Tier-2 block harnesses already do); most correct, but `seedAssociationDemo`'s CO1/CO2/CO3 UUIDs are
  baked into the published `@mj-biz-apps/accounting-core-entities-server` fn and are ALSO used by the
  Playwright specs (`lib/env.ts`: northwind/cascadia/sierra) + your GUI demos — so it's a shared-contract
  refactor. (b) **Drift-proof** — convert the exact-value checks to cross-model/base-table reconciliation
  (proves resolver correctness without pristine data); cheaper but weaker than exact-value coverage. (c)
  **Guarded clean+reseed** of CO1/CO2/CO3 before the run — restores determinism but DELETES data on those
  three companies, which you may be demoing on in the GUI (destructive; needs your explicit OK on those
  companies).
- What I did NOT do: I did not loosen the assertions to fake green, and did not wipe your demo companies.
  I DID fix a genuine harness bug (the customer-name lookup crashed on a null CustomerName — now null-safe).
- Files to verify: test-harnesses/api/readmodels-api.ts; test-harnesses/server/seed-demo.ts;
  test-harnesses/playwright/lib/env.ts (COMPANY UUIDs).
- Answer: _(pending)_

<a id="q26"></a>
### Q26 · Explorer header widget slot — ask Matt — added 2026-07-16 (feature ask)
- **Status:** OPEN
- **Who to ask:** Matt (MJ Explorer shell)
- **Features:** cross-cutting (MJ base; component-inventory row)
- **Background (self-contained):** Apps populate Explorer's header nav via nav items (icons +
  badges — works well; the new category navigation uses exactly that mechanism). But there is no
  slot for an app-contributed header WIDGET: nav items render label/icon/badge only, and the
  header actions area is Explorer-owned (verified in the `explorer-core` shell 2026-07-15).
- **What motivates this now:** the accounting/orders UI needs an app-wide **company-scope
  selector** — natural home is the app header, and any app with a scope/context concept
  (environment, tenant, ledger) wants the same. Interim it renders at the top of the in-app nav rail.
- **The question for Matt:** would MJ accept a header widget extension point — an app-provided
  component slot in the shell header? If yes we spec the contract; if no, rail-top becomes permanent.
- **Context to share:** the mockups (scope chip at rail-top with the interim-home tooltip).
- **Additional context (for a verifying agent):** `explorer-core/src/lib/shell/` (app-nav renders
  NavItems; header-actions Explorer-owned); design-docs component inventory row.
- **Answer:** _(pending)_

<a id="q29"></a>
### Q29 · Regenerate must invalidate the approval — but HOW: reset the existing task, or void + replace? — ask Marcelo — added 2026-07-16
- **Status:** OPEN — **the principle is RULED; the mechanism is deferred by Marcelo ("raise it as a
  question for later"). The code currently does the WRONG-LEANING option — see "Built today".**
- **Who to ask:** Marcelo (mechanism) · Ian (owns the tasks app / whether a Task supports re-opening)
- **Features:** D.3 batch approvals · C.8 manual-JE gate (same principle likely applies)

- **The principle (RULED — Marcelo, 2026-07-16):** *"we probably don't want approvals to last past
  task changes."* An approval is consent to a SPECIFIC set of numbers. `regenerateBatch` re-gathers
  the candidate pool and rebuilds the summary on the SAME batch record, so its contents change and
  any prior approval is void. Not in dispute.

- **The open question (Marcelo, 2026-07-16):** *"regenerate should not create a new task, it should
  just mark the existing one as incomplete and maybe update info if needed... unless we void the last
  task and replace it, maybe that makes sense too."* So — which mechanism?
  - **(A) Reuse + reset (Marcelo's lean, "seems straightforward"):** keep the same Task, clear/void
    its decision so it is incomplete again, refresh its Description/amounts to the new contents.
    One Task per batch for its whole life; `ApprovalTaskID` never moves; no orphans; the CFO sees the
    request they already know, updated. Open sub-question: does the tasks app support re-opening a
    decided Task, or is a decision terminal? (**Ian**) — that may decide this outright.
  - **(B) Void + replace:** terminally void the old Task, raise a new one, re-stamp the pointer.
    Cleaner audit trail (each Task is immutable and records exactly one set of numbers), at the cost
    of a Task per regenerate. Marcelo: *"maybe that makes sense too."*
  - **(C) What we must NOT do:** raise a new Task and leave the old one live — two open approval
    requests against one batch, the CFO able to act on stale numbers.

- **Built today (honest status):** `regenerateBatch` calls `raiseApprovalTaskAndStamp`, and
  `TasksAppApprovalGate.onBatchBuilt` → `CreateApprovalRequest` **creates a NEW Task**. The pointer
  re-stamps to it, so the authoritative task is unambiguous — but the OLD task is left live, which is
  option (C), the one we do not want. This is deliberate and deferred, not overlooked: regenerate
  only works on a **Pending** batch (approval flips it to Approved and
  `trg_JEBatch_Immutability` freezes content, 50008/50009), so the blast radius is a batch that is
  awaiting approval while someone regenerates it. Fix with (A) or (B) once ruled.

- **Concrete follow-up regardless of A/B:** `TasksAppApprovalGate.assertApproved` still finds the
  batch's task by **Task-Link lookup**, which is ambiguous the moment more than one Task is linked.
  It should read `JournalEntryBatch.ApprovalTaskID` — the pointer that now names the authoritative
  task. Under (A) this is belt-and-braces; under (B) it is required for correctness.

- **Does the same principle apply to C.8 manual-JE approvals?** If an approved manual JE is edited
  before batching, its approval should presumably be void too. Assumed yes; not yet built.

- **Additional context (for a verifying agent):** `BatchingEngine.regenerateBatch` +
  `raiseApprovalTaskAndStamp`; `TasksAppApprovalGate.onBatchBuilt` (`CreateApprovalRequest`) +
  `assertApproved` + `resolveBatchTask` (the Task-Link lookup); `hasApprovedDecision` (whether a
  decision is terminal — the crux of option A);
  `migrations/V202607161700__v1.0.x__Batch_ApprovalTask_Pointer.sql`. Related: [Q28](#q28) (the
  transaction split), [Q6](#q6) (approval workflow shape).
- **Answer:** _(principle answered 2026-07-16 — approvals must not outlive content changes. Mechanism
  A vs B deferred by Marcelo; do not create-and-orphan.)_

<a id="q28"></a>
### Q28 · Batch build / approval-task split + the batch task pointer (MOD-14) — ask Marcelo — added 2026-07-16
- **Status:** OPEN — **proposed solution, building against it now; confirm the details.**
- **Who to ask:** Marcelo
- **Features:** D batching · D.3 batch approvals
- **Background (self-contained):** Building a batch currently does **12 sequential `.Save()` calls
  with no transaction** (header → summary lines → line dimensions → control totals → one save per JE
  to lock it → approval task). A failure partway leaves a half-built batch with only *some* JEs
  locked. Separately, if the tasks gate throws, `raiseApprovalTaskOrReverse` **cancels the whole
  batch**. Marcelo's ruling (2026-07-16): batch writes go in ONE transaction; the approval task is a
  SEPARATE action in its OWN transaction that also stamps a pointer field on the batch, so batches
  with a task are cheap to validate; batch creation must not be gated on task success; accounting
  owns that transaction because tasks is a dependency of accounting.
- **What we built to it (MOD-14):** `ApprovalTaskID` + `ApprovalTaskRaisedAt` on JournalEntryBatch
  (CHECK: both-null or both-set; filtered index; **no FK** — cross-app coupling), transaction 1 =
  batch atomic, transaction 2 = task-raise + stamp atomic together, exposed as a Remote Operation.
- **⚠ CONFLICT WITH A PRIOR RULING — needs your call (found by tier 2, 2026-07-16):** MOD-14 as built
  **broke a committed test that encodes the Q5 ruling** `S1 real gate — no CFO configured →
  buildBatch hard-fails AND auto-reverses (Q5 atomicity)`. That ruling says a build with **no CFO
  configured** must HARD-FAIL. MOD-14 says a build must never be gated on the task-raise. As
  implemented, MOD-14 swallows BOTH cases, so no-CFO now builds a batch nobody can ever approve.
  **These are arguably different failures and deserve different answers:**
  - a **transient tasks-app outage** → the batch must stand (MOD-14's case — correct as built);
  - **no CFO configured** → a *configuration precondition*, not a task failure. A batch that can
    never be approved is dead on arrival; it should fail FAST.
  **Proposed reconciliation (satisfies both rulings, and is better than the old behaviour):** check
  the precondition BEFORE building — resolve the candidate JEs' companies and assert each has a CFO
  — and if it fails, **build nothing at all**. Then MOD-14's "never destroy a built batch" applies
  only to the task-raise. This is strictly better than the old code, which BUILT the batch and then
  cancelled it (a write + a compensating write, i.e. the half-state MOD-14 exists to kill). Needs a
  gate method (e.g. `assertCanRaise(companyIds)`); the CFO set is already resolvable from the
  candidates before any write. **NOT YET IMPLEMENTED — the tier-2 test is RED and left red on
  purpose, not quietly re-baselined.**
- **The questions (details, not shape):**
  1. **Retry:** a batch with `ApprovalTaskID IS NULL` is the detectable failed-raise state. Should
     retry be **automatic** (a scheduled sweep re-raising missing tasks) or **manual** (an admin
     action / a chip in the Batch approvals inbox)? We default to manual + visible.
  2. **Should a task-less batch be dispatchable?** `assertApproved` still blocks unapproved batches,
     so it cannot reach the ERP — but should the UI surface it as "needs attention" distinctly from
     "awaiting approval"? We assume yes.
  3. **`RegenerateJEBatch`** currently re-runs the same path — should regenerate re-raise the task
     (new Task, re-stamp) or reuse the existing one? We assume re-raise + re-stamp.
  4. **No FK to the tasks table** — confirm that's the right call (our read: yes; accounting must stay
     migratable without the tasks schema).
- **Additional context (for a verifying agent):** `packages/CoreEntitiesServer/src/BatchingEngine.ts`
  (`buildBatchFromIds`, `raiseApprovalTaskOrReverse`, `cancelBatch`), `TasksAppApprovalGate.ts`
  (the TaskLink lookup this pointer replaces), `AccountingEngine.CreateJournalEntries` (the proven
  TransactionGroup pattern), `migrations/V202607161700__v1.0.x__Batch_ApprovalTask_Pointer.sql`.
- **Answer:** _(pending)_

<a id="q27"></a>
### Q27 · `mj-left-nav` — desktop icons-only collapse — ask Matt — added 2026-07-16 (feature ask)
- **Status:** OPEN
- **Who to ask:** Matt (MJ Angular / ng-ui-components)
- **Features:** cross-cutting (MJ base; component-inventory row — pairs with [Q26](#q26))
- **Background (self-contained):** The approved mockup set drew a bespoke, **collapsible** nav rail
  (hamburger → icons-only, 230px → 56px) for each category shell. During the build we found MJ
  **already ships the idiom**: `<mj-left-nav>` (`@memberjunction/ng-ui-components`) — the canonical
  left rail for Explorer dashboards with an internal section-nav. It already covers labelled
  sections, badges, active state, `[header]`/`[footer]` slots, tree items, and a responsive
  ≤700px off-canvas drawer. Per the UI plan §8 **MJ-wins rule** we adopted it and **deleted** the
  bespoke rail rather than shipping a duplicate (which also retires a TRANSFER-BACKLOG row — the
  parked rail no longer needs a home, because MJ already owns one).
- **The delta (the only thing we gave up):** `<mj-left-nav>` has **no desktop icons-only collapse**.
  Its narrow-viewport answer is the mobile drawer; on a laptop the rail is always its full width.
  The mockup's hamburger therefore does not ship. Not a blocker — the rail is 240px and the
  laptop-width tolerance holds — but it is a real deviation from the approved mockup.
- **Proposed solution — PROCEEDING (Marcelo, 2026-07-17): a bottom-anchored ARROW toggle, no hover.**
  He ruled: *"we start with just the toggle... the left nav is designed to work on mobile and on
  desktop, and that's already built in. There's just no toggle right now to have the ability to
  collapse it if you want to... it would go at the BOTTOM. So it'd be out of the way. But it would
  just give someone who wants to see a few more rows the option to see them if they're on a smaller
  screen."*
- **The design reasoning, recorded because it is the interesting part — three icons, three different
  promises:**
  - **Hamburger** promises *"a menu lives here"* — a TRANSIENT overlay that dismisses on selection.
    Our rail is persistent, so a hamburger lies about its own behaviour. Marcelo: *"the hamburger is
    usually a — you click it, it opens, you click something, and then it closes back again."*
  - **Pin** promises *"this would otherwise float away — hold it."* It presupposes a hover/float
    default. With no hover behaviour the pin answers a question nobody asked. Marcelo: *"a pin, I
    think, is used to lock something that would otherwise be floating and come up when you hover it."*
  - **Arrow** promises *direction and reversibility* — symmetric, two-state, no hidden claim. It is
    the only one of the three that describes what actually happens. **Convention: the arrow points
    where the rail will GO, not where it is** (`«` expanded → collapse left; `»` collapsed → expand
    right) — VS Code / Notion / Finder. Pointing at the current state reads backwards to most people.
    Marcelo, converging: *"an arrow is kind of a well-recognized in-and-out type thing... and pointing
    in the direction I'm just gonna go, that also makes sense."*
- **Hover-expand was considered and REJECTED for now** (Marcelo floated a Notion-style
  float-on-hover + pin-to-push; his float/push instinct was right — layout shift on hover would sink
  it alone). Two objections specific to THIS app killed it for v1:
  1. **Our rail items are siblings in one domain**, not categories. Accounts' rail is Chart of
     accounts / Account links / ERP mapping / Dimensions / All accounts → as icons that is
     sitemap/link/plug/tags/list: five near-identical glyphs. Icon rails work when items are
     *categorically* different (Home/Search/Settings) and fail on sibling content — users would hover
     each one to read it, at which point the collapse COST them time.
  2. **Hover-expand overlays misfire when reaching for the left edge of the content** — and in an
     accounting grid the leftmost column is exactly where row chevrons and checkboxes live. The rail
     would fly out over the thing being clicked.
  So: toggle first (~90% of the benefit, none of the misfire risk); revisit hover only if asked.
- **Default EXPANDED, and the unpin sticks per user via `UserInfoEngine`** (MJ's rule — never
  localStorage, or the choice dies on every new browser). Rationale: a first-run user must see the
  nav to learn the app; Marcelo's 30–40% figure is about *sustained* use, not first contact. Features
  that optimise for the expert at the novice's expense are a classic mistake.
- **The question for Matt:** (1) Would MJ take a `[Collapsible]` / `[Collapsed]` input on
  `<mj-left-nav>` upstream — bottom-anchored arrow, icons-only when collapsed, tooltips carrying the
  label, state persisted by the consumer via `UserInfoEngine`? (2) If yes, do you want it as
  described, or is there a house pattern we should match? (3) If no, we keep it local and every other
  MJ app keeps the always-expanded rail — is that divergence acceptable to you?
  **We are proceeding on the local build meanwhile**; it is small and reversible, and it is a strict
  addition (the rail's existing mobile drawer at ≤700px is untouched).
- **Verified against the component (2026-07-17), so the ask is accurate:**
  `mj-left-nav` HAS a ≤700px off-canvas drawer (`MobileNavOpen`, `OpenMobileNav()`, `CloseMobileNav()`,
  a scrim, `aria-expanded`) but **no desktop collapse of any kind**. The drawer is NOT reusable for
  this: a drawer is transient + scrimmed; a collapsed rail is persistent + unscrimmed. Different mode,
  not a variant.
- **Context to share:** the mockup rail (`design-docs/ui-design/mockups/nav-shell-je-dashboard.html`
  — the `.x-rail`/`.collapsed` CSS is the exact intended behavior) + `<mj-left-nav>` as-is.
- **Additional context (for a verifying agent):**
  `packages/Angular/Generic/ui-components/src/lib/left-nav/left-nav.component.ts` (Inputs today:
  `Sections`, `ActiveId`, `Width`, `MobileTitle`, `ExpandedIds`; no collapse). Our consumers:
  `packages/Angular/src/lib/custom/shell/*-category.component.ts`.
- **Answer:** _(pending)_

<a id="q23"></a>
### ~~Q23~~ · Stolen-credential blast radius / native DB-level RLS — WITHDRAWN 2026-07-14 (Task 54a)
- **Status:** WITHDRAWN (Marcelo, 2026-07-14) — do not raise with Robert.
- **Why withdrawn:** Omitting a native SQL-Server RLS layer is accepted as the (MJ-consistent) design
  decision, and the agenda with Robert is already full. The analysis stands as a **design note**, not a
  question: accounting `plans/research/A2-R1-R3-rls-and-person-linkage.md` §"Security analysis".
- **What survives elsewhere (nothing lost):** the stolen-USER-credential blast radius is bounded by the
  Q22/Q24 grant model (that's those questions' job); the stolen-SERVICE-credential posture is
  operational and already adopted — DB reachable only from API hosts, runtime login holds CRUD/execute
  but NO DDL (so the financial-invariant triggers 50001–50025 stand even against a credential thief),
  rotation + detection. Native DB RLS + SESSION_CONTEXT would only harden against application-layer
  bugs (never against credential theft — the connection sets its own context) and is deliberately not
  pursued.

<a id="q8"></a>
### [ANSWERED — for now, with Q18] Q8 — Closed-period JE handling — 2026-07-08 → 2026-07-13
- Status: ANSWERED — FINAL 2026-07-14 (MOD-13 withdrawn): **MOOT** — no local closed periods exist, so
  there is nothing to route around or reject against; W4 auto-routing stays retired; the ERP's active
  period absorbs whatever we dispatch (Amith verbatim in MOD-1).
- Ask: Amith (via Robert or direct)
- Asked by: accounting-engine-dev agent (2026-07-08)
- Where: bizapps-accounting · accounting-engine-dev · feature/je-entry-engine
- Question: When Orders emits a JE dated into a **closed period**, does the engine **auto-route to the next open period** or **reject-and-alert**? Gates accounting's W4 + the engine error contract.
- Context to share: Open question from the 2026-07-02 meeting; needed for the error-code contract.
- Additional context: amendment open items; accounting W4 (adjusting-entry routing).
- Answer: _(pending)_

<a id="q13"></a>
### [ANSWERED] Q13 — Batch cutoff: oldest-forward only, or arbitrary time spans? — 2026-07-08
- Status: ANSWERED (Robert, 2026-07-09)
- Ask: Robert (standing in for Amith, out of town) — 2026-07-08 evening/next day
- Asked by: accounting-engine-dev agent (Task 26a, batch-lock redesign) · feature/je-entry-engine
- Where: bizapps-accounting · accounting-engine-dev · feature/je-entry-engine
- Question: When batches gain candidate **filters** (future), should a batch always run **oldest-unbatched-entry → chosen cutoff date** (sequential, gap-free), or may it cover an **arbitrary window**? We recommend oldest-forward-with-cutoff (arbitrary windows leave older unposted entries = gaps → understatement + "GL current through when?" ambiguity). Bless the rule.
- Context to share: Today's all-or-nothing batch implicitly = "oldest through now," which is the correct degenerate case; the question bites when filters land.
- Additional context: plan §4-C. Feeds the (backlogged) filter plan. See `plans/2026-07-09-robert-meeting-decisions.md` D2.
- Answer: **Robert (2026-07-09): BOTH.** Default = everything unbatched up to a chosen date-time (oldest-forward). Arbitrary batches are allowed but via the **MJ User View system**: the user builds a View of the records to batch (smart filters → arbitrary), then generates a batch from it; the engine validates the view's universe is **only unbatched** entries and yells if it includes already-batched ones. The View is the auditable record of "what went in." → drives the backlogged View-driven batch-builder feature.

<a id="q14"></a>
### [ANSWERED] Q14 — Out-of-order batch approval (later period before earlier)? — 2026-07-08
- Status: ANSWERED (Robert, 2026-07-09)
- Ask: Robert (standing in for Amith, out of town) — 2026-07-08 evening/next day
- Asked by: accounting-engine-dev agent (Task 26a, batch-lock redesign) · feature/je-entry-engine
- Where: bizapps-accounting · accounting-engine-dev · feature/je-entry-engine
- Question: Once multiple batches can coexist in a scope (filter era), may a **later-cutoff** batch (e.g. Sat–Sun) be approved/posted **before** an earlier one (Fri–Sat) in the same (Company, TargetSystem)? We lean **chronological order — enforce or at least warn** (a later period posting ahead of an earlier one risks a discontinuous GL + cutoff confusion). Confirm the rule.
- Context to share: Only bites in the filter era — today's all-or-nothing has one open batch, so it's moot now.
- Additional context: plan §4-F. See `plans/2026-07-09-robert-meeting-decisions.md` D2.
- Answer: **Robert (2026-07-09): ALLOWED while the period is open** — do NOT force "can't batch Thursday before Wednesday." Natural (chronological) progression is the default, but give the user control as long as the period isn't closed. (A soft warning is fine; a hard block is not.) The real guard is the closed period (Q18), not batch ordering.

<a id="q4"></a>
### [ANSWERED] Q4 — Batch reject semantics: what happens to a rejected batch's locked entries? — 2026-07-08
- Status: ANSWERED
- Ask: Robert
- Asked by: accounting-engine-dev agent (2026-07-08)
- Where: bizapps-accounting · accounting-engine-dev · feature/je-entry-engine
- Question: Rejecting a built JE-batch currently records the decision (task → Cancelled) but does nothing visible to the batch (stays `Pending`), so it looks broken vs Approve. The natural fix (cancel batch + return its entries to Pending) is **blocked by the JE immutability invariant** — a `Batched` entry may only go `Batched→GLPosted`, never back to `Pending`, and `BatchID` is immutable. **What should reject do?**
- Context to share: The immutability trigger is a deliberate financial control; we shouldn't violate it or strand entries. Need the intended reject behavior before coding.
- Additional context: trigger `trg_JournalEntry_Immutability` (migration `B202605281200`, ~line 1290); resolver `RecordJEBatchDecision`; `BatchingEngine` has no `cancelBatch`. Task #12.
- Answer: **Robert (2026-07-08 meeting):** Introduce **LEVELS of locking.** A pre-approval batch is **preliminarily locked (reversible)**; approval makes the lock **permanent**. On **reject, REMOVE the locks** — the entries return to the unbatched **candidate pool** (an unapproved batch "effectively doesn't exist financially"). Also add a **"regenerate batch"** for an open batch (throw out its entries, re-gather all unbatched candidates by filter, regenerate the summary). => Requires reworking `trg_JournalEntry_Immutability` so **Batched-but-unapproved is reversible** (only Approved/Sent/GLPosted is permanent) — a significant redesign, NOT the small cancelBatch patch. Recorded in `bizapps-accounting/plans/2026-07-08-robert-meeting-decisions.md` D1/D2.

<a id="q5"></a>
### [ANSWERED] Q5 — buildBatch atomicity: reorder so the approval task is raised before entries are locked? — 2026-07-08
- Status: ANSWERED (folded into Q4)
- Ask: Robert
- Asked by: accounting-engine-dev agent (2026-07-08)
- Where: bizapps-accounting · accounting-engine-dev · feature/je-entry-engine
- Question: `buildBatch` persists the batch **and locks its journal entries** BEFORE the approval gate (`onBatchBuilt`) runs — so if a company lacks a CFO the gate throws but the batch is already created + entries locked, orphaning a **task-less batch** (can't approve or reject). Should we fix this by raising the approval task **before** locking entries (or wrapping buildBatch in a transaction)?
- Context to share: This is why some demo batches show "no approval Task."
- Additional context: `BatchingEngine.buildBatch` (createBatchHeader → writeSummaryLines → lockJournalEntries → `gate.onBatchBuilt`); `TasksAppApprovalGate.resolveCFOPersonIds` throws when a company lacks a CFO.
- Answer: **Folded into Q4's batch-lock redesign.** With preliminary-reversible locks + "regenerate batch," an unapproved batch is fully reversible, so a gate failure no longer strands anything — the orphaned task-less batch problem is solved by the new model, not by a standalone reorder. (Existing orphaned demo batches still need one-time cleanup.) See accounting decisions D4.

<a id="q17"></a>
### [ANSWERED] Q17 — CFO-approver link: join to an Employee entity or to User? — 2026-07-09 → 2026-07-13
- Status: ANSWERED (Marcelo 2026-07-13, with orchestrator concurrence)
- Question (original): Robert leaned the ACP designated-approver should join an **Employee** table; does
  MJ/bizapps-common have one, or do we use **User** + a role?
- Answer: **Link to `__mj.User`.** Basis: (a) NO Employee entity exists in `__mj` or bizapps-common —
  building one for this link would recreate-what-exists (the de-facto employee record is Person +
  `LinkedUserID`); (b) the approver is a SECURITY identity — approval is an ACTION performed by a User,
  and roles/permissions hang off User, so gating the User directly removes the Person→LinkedUserID
  indirection the as-built tasks gate currently does; (c) the master plan indicates User. Robert's
  "always internal" instinct is covered by the Approver role (Admin-assigned) + company scoping (A2/R3).
  **Consequence:** migrate `AccountingCompanyProfile.ApprovalCFOPersonID` (FK Person, as-built) →
  `ApprovalCFOUserID` (FK `__mj.User`) in the A4 migration wave; simplify `TasksAppApprovalGate`'s
  resolver. Display name still reachable via User↔Person linkage where needed.

<a id="q18"></a>
### [ANSWERED — for now] Q18 — Closed-period posting guard vs "periods removed" — 2026-07-09 → 2026-07-13
- Status: **ANSWERED-for-now (Marcelo 2026-07-13):** the definitive Amith verbatim was located ("…the
  concept of accounting period is just irrelevant to us largely because it's going to get settled out
  when the accounting system says it settles out. So when we send a batch over, it's going to go into
  whatever the active accounting period is in the accounting system. That's not our job to worry about…
  just kill that.") — **we follow the removal for now: NO local period guard, no period machinery.**
  Recorded in MOD-1 (full quote) + CA-1. **FINAL 2026-07-14 (after a same-day flip-flop):** Marcelo
  briefly reinstated a manual close guard (MOD-13), then WITHDREW it — batch summaries lose date info
  anyway, the AR subledger doesn't own periods, and accountants are responsible for batching entries into
  the right periods. NO periods, NO close guard; future timing complexities handled when they arise
  (surviving principle: any timing rule detects by DATE, never a period FK).
- Ask: Amith / Robert (architecture) + Jeremy (exception rules)
- Asked by: accounting-engine-dev agent (meeting processing) · feature/je-entry-engine
- Where: bizapps-accounting + bizapps-orders · accounting-engine-dev · both feature branches
- Question: Robert (2026-07-09) wants a **closed-period guard at BOTH the order layer AND the journal-entry layer** ("sorry, June is closed") plus documented correcting-entry rules for extraordinary items. **But our current schema REMOVED `AccountingPeriod`** (migration `B202605281200`: *"AccountingPeriodID removed 2026-07-06 — the ERP owns periods"*), so MJ accounting has no local notion of a closed period to guard against. How do we reconcile? Options: (a) the ERP rejects the batch post-hoc (`Failed`); (b) reintroduce a lightweight per-company "posted-through / close date"; (c) a guard fed by ERP period state. Also define the exception/correcting-entry rules (→ Jeremy).
- Context to share: Backdating orders is wanted (D-O5) and the ONLY constraint Robert cares about is the closed-period guard — so backdating + Q15 + this all hinge on the same reconciliation. Blocks any period-guard code. Also re-anchors the ScheduledJournalEntry materialization trigger (accounting CA-2).
- Additional context: `bizapps-accounting/plans/2026-07-09-robert-meeting-decisions.md` D4; migration `B202605281200` lines 28 + 462; supersedes/overlaps Q8. NO period-guard code until this is answered.
- Answer: _(pending)_

<a id="q20"></a>
### [ANSWERED] Q20 — IntercompanyRelationship wiring ownership: Accounting or Payments/Orders? — 2026-07-13
- Status: ANSWERED (same day — verified from the built schema at Marcelo's prompt)
- Ask: was to be Amith; answered by the record instead
- Asked by: orchestrator agent (v2-plan retirement sweep, Task 24a) · feature/je-entry-engine
- Where: bizapps-accounting (+ bizapps-orders O2 downstream) · accounting-engine-dev
- Question: Amith specified the per-pair Due-To/Due-From wiring (OQ-A, 2026-06-28) and on 2026-06-30 ruled
  Payments generates the legs end-to-end — but who owns the account WIRING table?
- Answer: **The 2026-07-06 baseline squash already ruled it** (Marcelo remembered; verified in
  `B202605281200` fold header, ~lines 2377/2385): `IntercompanyRelationship` was created then DROPPED
  (net-zero, in the former `Intercompany_And_CFOApproval` migration) and deliberately OMITTED —
  *"Accounting does no intercompany balancing; the Payments component owns due-to/due-from."* So:
  wiring is **Payments-side** (orders repo, O2); Amith's OQ-A schema is kept in MOD-5 as the reference
  shape. MOD-5(c)/A1/BACKLOG corrected 2026-07-13. **Residual (non-blocking, at O2 design):** sanity-check
  with Amith where the wiring table lives + how per-pair accounts provision into accounting's COA
  (accounting owns COA storage; Payments defines/drives the accounts).


## Entry template (Q22/Q24 model — ratified 2026-07-16)
```markdown
<a id="qN"></a>
### QN · <title> — ask <person> — added <date>
- **Status:** OPEN
- **Who to ask:** …
- **Features:** <FEATURE-LIST IDs>
- **Background (self-contained):** …
- **What motivates this now:** _(optional)_
- **Fixed constraints (not up for debate):** _(optional)_
- **The question for <person>:** (1) … (2) …
- **Context to share:** …
- **Additional context (for a verifying agent):** …
- **Answer:** _(pending)_
```

<a id="q36"></a>
### Q36 · The chart of accounts has no global account pool — is Marcelo's "cede then hook to companies" model the intended one? — ask Marcelo (then Amith/Robert) — added 2026-07-16
- **Status:** OPEN
- **Requested reviewer:** Marcelo first (he raised it); escalate to Amith/Robert if the model must change
- **Features:** A.1 (GLAccount + hierarchy), B.* (Account links)
- **Proposed solution (PROCEEDING with this):** build the missing "all accounts" management page (GUI-11)
  against the schema **as built** — accounts listed per company, filterable/searchable, with create/edit
  and the ERP mapping (`ExternalSystem` + `ExternalAccountID`) exposed. If the answer is that a global
  pool is genuinely wanted, that is a schema change (drop the NOT NULL on `GLAccount.CompanyID`, or add a
  company-account join), NOT a UI change — so building the page now is not wasted either way.
- **The question for Marcelo:** (1) Your stated model was *"our chart of accounts is backed by a list of
  general ledger accounts that are ceded over from the general ledger, and then we will then use this
  section to connect them into companies... a page where users can see all of the accounts from the
  general ledger, and then they can hook them to the companies they need to hook them to."* The schema does
  NOT work that way — is the schema wrong, or is the mental model? (2) If the schema is right, is a page
  that shows every company's accounts in one searchable list (grouped/filterable by company) what you
  actually wanted, rather than a pool-plus-hookup screen?
- **Context to share (the schema facts, verified 2026-07-16):**
  - `GLAccount.CompanyID` is **NOT NULL**, FK → `MJ: Companies`, with **`UNIQUE (CompanyID, Code)`** and the
    column description *"Company that owns this account. UNIQUE (CompanyID, Code) — each company has its own
    chart."* So an account is **born owned by exactly one company**. There is no unowned pool to hook up.
  - MASTER-PLAN §4.1: *"The chart of accounts mirrors the ERP's COA, but BizAppsAccounting owns its copy so
    JE line items have a stable reference."* — a **copy per company**, not a shared pool.
  - Accounts originate from **`spSeedDefaultChartOfAccounts`** (flagged by `IsSystemSeeded`, which exists
    precisely to *"distinguish platform-shipped accounts from deployment customizations"*) plus deployment
    edits. They are not "ceded over" at runtime from a GL.
  - The ERP direction is **outbound**: `ExternalSystem` (BusinessCentral | QuickBooks | NetSuite | …) +
    `ExternalAccountID` map each MJ account **out** to the ERP's account. MJ's copy is the local record;
    the ERP is the mirror target, not the upstream source of a pool.
  - **`ParentGLAccountID`** (Marcelo: *"I'm not understanding what the parent account option is and where
    those accounts are coming from"*): a self-FK **within the same company's chart** for hierarchical
    rollup — *"Parent account for hierarchical rollup (NULL = top of chart)"*. E.g. `11200 Cash` as parent of
    `11201 Cash — Operating`, so reports roll child balances into the parent. The dropdown's options are that
    company's own existing accounts. It is NOT a cross-company or GL-pool link.
- **Additional context (for a verifying agent):**
  - Schema: `bizapps-accounting/packages/Entities/src/generated/entity_subclasses.ts` → `mjBizAppsAccountingGLAccountSchema`
  - Plan: `plans/MASTER-PLAN.md` §4.1 (~line 188)
  - Related: Q9 (GLAccountLink role FK), Q3 (JE-draft account contract)
- **Answer:** _(pending)_

<a id="q30"></a>
### Q30 · Are batches single-company? The plan says yes; the code says no; the deciding note lives only in a SQL comment — ask Robert/Amith — added 2026-07-16
- **Status:** ANSWERED (2026-07-17) — frozen. **YES: batches are SINGLE-COMPANY.** Robert
  independently proposed exactly this (P3, `meetings/2026-07-14 - je-single-company-batching-
  proposal.md`) before seeing this entry; Jeremy signed off with two conditions (aligned batch
  cadences for active intercompany pairs; the rec process tracks "posted in source, not yet in BC"
  as a reconciling item type); Amith aligned on the 2026-07-17 posting-date thread. Landed as
  **MOD-15** (+ MOD-16 for per-JE posting dates; MOD-4's netting key revised). The TargetSystem
  contradiction this entry flagged dissolves (one company per batch ⇒ one target per batch);
  sub-question (3) D-SEQ rationale is moot (per-company batch numbering detail rides the MOD-15
  rework). Routed onward: MOD-15/16 + FEATURE-LIST D-family + UI plan §8.2 note.
- **Requested reviewer:** Robert (owns OQ-F) · Amith (owns BA-D16's AN-BC rationale)
- **Features:** D.* (batching + dispatch)
- **Proposed solution — PROCEEDING: ONE COMPANY PER BATCH.** Marcelo's decision, 2026-07-16: *"our marching
  orders as my decision are going to be one company per batch."* Rationale: *"then you don't have to deal with
  the ERP problem. When an accountant is using the system, they're probably not going to expect to go to two
  ERP systems off of one batch."* He explicitly invites reversal: *"if you specifically think that in a regular
  accountant's workflow, having a batch with two separate ERP systems and two companies in it makes sense,
  then let me know and we can revert that."*
- **The agent's assessment: AGREE — and there is a structural argument nobody has made yet.**
  **`JournalEntryBatch.TargetSystem` is a SINGLE column.** A batch therefore *cannot* target two ERPs today,
  full stop. Multi-company batching only works when every company in the batch shares one ERP **type** — and
  even then, two companies on two different **Business Central tenants** are *unrepresentable*, because there
  is no per-company endpoint/connection field anywhere in the schema (`ExternalSystem` on `GLAccount` names the
  ERP *kind*, not an instance). So the multi-company design silently depends on routing infrastructure that
  does not exist. Marcelo's simple answer removes a problem we have no model for.
- **⚠ The strongest evidence AGAINST single-company, stated fairly:** **MOD-4** nets batch summary lines per
  **(Company × GLAccount × Dimension-combo)**. If a batch were single-company, Company in that key would be
  redundant — so **Amith evidently expected batches to span companies** when he specified it (2026-06-28).
  Marcelo spotted this himself. Single-company does not *contradict* MOD-4 (the key just becomes a no-op), but
  it does mean we are overturning an assumption Amith held. **This is the specific thing to put in front of
  him.** If Amith confirms multi-company is intended, BA-D16 needs a real MOD and the ERP-endpoint gap above
  becomes a blocking design problem to solve first.
- **The question for Robert/Amith:** (1) Is a batch single-company, or may it span companies and split at
  send? (2) If multi-company: what is the dispatch contract when N companies map to different ERP endpoints
  (or different tenants of the same `TargetSystem`)? (3) Was there a rationale for D-SEQ beyond batch-number
  sequencing?
- **Context to share — the plan and the code disagree, and the change was never recorded:**
  - **The plan says SINGLE-company.** `MASTER-PLAN.md` **BA-D16**: *"Batching aggregates JEs by **(Company**,
    AccountingPeriod, TargetSystem)**, locks them, and ships **one consolidated JE per Company** to the ERP."*
    Company is IN the grouping key. §4.5 even specifies `BatchNumber` as `'BATCH-{Company.Code}-{seq}'`.
  - **The code says MULTI-company.** `migrations/B202605281200__v1.0.x__Schema_and_Tables.sql` §5.2:
    *"Atomically increments the **GLOBAL** singleton batch sequence and returns 'BATCH-{seq:000000}'.
    **(D-SEQ 2026-07-06: batches are multi-company.)**"* — the company code was dropped from the batch number
    as a direct consequence.
  - **"D-SEQ" is not in the plan chain.** It is a comment in a SQL file. It is not a MOD, not an UPD, not an
    Extension. Per the planning system's own rules (*"nothing is silently superseded"*; *"if it isn't in
    MASTER-PLAN(-MODIFICATIONS/-UPDATES), it isn't the plan"*), **BA-D16 remains the plan of record.** Anyone
    reading the plan today concludes single-company and is contradicted by the schema. That is exactly how
    Marcelo hit this.
  - **It is ALSO already an open question in the engine.** `packages/CoreEntitiesServer/src/BatchingEngine.ts`
    (~line 19): *"⚠ **OQ-F (Robert)**: whether the flat per-line CompanyID grouping suffices or a batch-group
    element is needed. Current shape = flat line items carrying CompanyID; **the per-company split happens at
    send**."* So the multi-company shape shipped with its central question unresolved.
- **Marcelo's reasoning (2026-07-16), verbatim:** *"It's my understanding that batches are meant to be single
  company by necessity because journal entries, one, are single company. And, two, if you batch across
  multiple companies, you're gonna be sending to two different ERP endpoints possibly, which is just... that's
  just not a good system... Also, if we wanna do multi company batching, then we have to be really smart about
  how we net the batches out. And I don't think we have logic for that or have plans to do that."*
- **Assessment of his three points (verified):**
  1. **JEs are single-company — CORRECT** (MOD-11/12; a JE's company derives from its resolved accounts).
  2. **Multiple ERP endpoints — UNRESOLVED, and his strongest point.** A batch carries exactly ONE
     `TargetSystem`, but N companies. BA-D16 requires "one consolidated JE **per Company**", so a
     multi-company batch MUST split at dispatch. `BatchingEngine`'s own comment says the split "happens at
     send" — whether that code exists and is correct is NOT verified here. If it does not, a multi-company
     batch is undispatchable.
  3. **Netting across companies — already safe.** **MOD-4** nets per **(Company × GLAccount ×
     Dimension-combo)** — Company is in the netting key, so money never nets across companies. This specific
     worry is handled; worth telling him.
- **Additional context (for a verifying agent):**
  - `plans/MASTER-PLAN.md` BA-D16 (~line 119), §4.5 (~line 426), BA-D26 (~line 129)
  - `plans/MASTER-PLAN-MODIFICATIONS.md` MOD-4 (netting key), MOD-11/12 (JE↔company)
  - `migrations/B202605281200__v1.0.x__Schema_and_Tables.sql` §5.2 (D-SEQ comment, ~line 1708)
  - `packages/CoreEntitiesServer/src/BatchingEngine.ts` (OQ-F comment; `CompanyIDs` plural on BuildBatchOperation)
- **Answer:** (1) **Single-company** — confirmed by Robert (P3), Jeremy (with the two conditions
  above), and the thread Amith joined; Marcelo's ruling stands. (2) Moot — no batch ever spans
  ERP endpoints again. (3) Global batch numbering was a multi-company-era consequence; numbering
  shape revisits with the MOD-15 schema rework. See MOD-15/MOD-16.

<a id="q31"></a>
### Q31 · GL routing derives the COMPANY from the ACCOUNT — should product/category links carry a ROLE instead? — ask Robert/Amith — added 2026-07-16
- **Status:** OPEN — ⚠ premise UPDATED 2026-07-17: Marcelo ruled the line's company now derives
  from the PRODUCT (`Product.CompanyID`), not from the resolved account (orders MOD-3 rev-2), and
  product-account company consistency is its own question ([Q38](#q38), lean: mismatch disallowed).
  The role-on-links ask below still stands — ask both at one sitting.
- **Requested reviewer:** Robert (COA semantics) · Amith (GLAccountLink design, OQ-G)
- **Features:** A.1 (GLAccount), B.* (Account links), ORD product→GL routing
- **Proposed solution:** ⏸ HOLD on the model change (it is a schema + engine change). PROCEEDING
  independently on the two outright bugs below, which are wrong under ANY answer.
- **How it works TODAY (verified 2026-07-16, not from memory):**
  - `GLAccount.CompanyID` is **NOT NULL**, `UNIQUE(CompanyID, Code)` — *"each company has its own chart."*
    There is no global account pool. 10 seeded accounts per company via `spSeedDefaultChartOfAccounts`.
  - `GLAccountRole` — 8 seeded roles (Cash, Accounts Receivable, Inventory, COGS, Sales, Sales Discounts,
    Sales Returns and Allowances, Deferred Revenue). This is the company-agnostic vocabulary.
  - `GLAccountLink` is polymorphic: `(EntityID, RecordID, GLAccountRoleID) -> GLAccountID`, date-effective.
    **It points at a concrete ACCOUNT, never at a role.**
  - `OrdersEngineBase.ResolveAccount` walks **product link -> up the category chain -> company default**.
  - **`buildDraftsForOrder` then does `CompanyID: account.CompanyID`** — i.e. **the company is DERIVED FROM
    THE RESOLVED ACCOUNT** (`accountFromLink` reads `GLAccountByID(id).CompanyID`). An Order has no
    CompanyID by design (MOD-11/12), so the account is the ONLY thing that answers "whose books?".
- **The question for Robert/Amith:** (1) Should a product/category GLAccountLink carry a **ROLE** (abstract,
  resolved against each company's own chart) rather than a concrete **ACCOUNT** (which also pins the company)?
  (2) If links carry roles, **what decides the company** — `Product.OwningCompanyID`, the selling entity, or
  something explicit on the order line? (3) Is deriving the JE's company from the account intended, or an
  accident of MOD-11/12's "no header company" ruling?
- **Marcelo's argument (2026-07-16), verbatim:** *"orders should have lines, and the lines should have a
  product, and that product should be booked to a specific company. And that's how you should determine what
  accounts it's going to hit. **You shouldn't be deriving the company based on the accounts.** First of all,
  you could have multiple companies under the same accounting roof, and that should be supported. Secondly,
  you could have somebody who's using what we call a company as just a brand... they could have multiple
  products that they wanna track as different companies, but they're gonna send their revenue to the same
  place."*
- **Why his argument holds (the strongest form of it):** `AccountingCompanyProfile.ParentAccountingCompanyID`
  ALREADY exists and means *"this profile uses the books (COA, JEs) of the referenced profile."* But if the
  company is derived from the account, two companies sharing books resolve to the SAME account and therefore
  collapse to the SAME CompanyID on the JE. **The derivation destroys the very distinction that field exists
  to preserve.** So the shared-books case is not hypothetical — it is already modelled and already broken by
  the derivation.
- **The UX consequence (his second complaint):** because links name accounts, an ORDERS user overriding a
  product's routing must choose a concrete account out of some company's chart — i.e. a sales person must
  read the accounting chart, which they may not be permitted to see. If links carried roles, orders would say
  *"this is Deferred Revenue — Physical"* (a business statement) and accounting would say *"for company X that
  role is account 24150"* (a ledger statement). Clean separation of duty; no chart access in orders.
- **What the fix would reuse rather than invent:** `ResolveCompanyAccount(companyID, role, asOf)` is ALREADY
  exactly `(company, role) -> account`. The change is to make the product/category tier resolve a **role**,
  then hand (company, role) to that existing function.
- **His "shared accounts across companies?" question — my recommendation: NO.** Reasons: (a) the account is
  currently the only thing answering "whose books?", so sharing collapses the derivation entirely; (b) each
  company's chart mirrors ITS ERP and `ExternalAccountID` is per-account — two companies in two ERPs need two
  rows regardless; (c) commingling two legal entities' balances in one account is consolidation, not a COA
  feature — and consolidation already has `ParentAccountingCompanyID`. What he actually wants ("a deferred
  revenue account for physical goods") is a **new ROLE**, not a shared account.
- **Context to share:** the two outright bugs below (filed to BACKLOG.md), which are worth fixing regardless:
  1. **The company tier was DEAD in booking** — `resolveRevenueLines` called `ResolveAccount(productID, role,
     asOfDate)` with three args; the fallback company is the optional FOURTH. Booking was really
     "product -> category -> fail". **FIXED 2026-07-16** (now passes `product.OwningCompanyID`).
  2. **The Catalog disagreed with booking** — the catalog DID pass the fallback, so its "will it book?"
     tripwire was strictly more optimistic than booking: a product could read as resolved and still fail at
     Confirm. Same engine method, different arguments. Resolved by (1).
- **Data reality (verified):** only **4** GLAccountLink rows exist in the whole DB — 1 Companies/AR,
  2 Products/Sales, 1 Products/Deferred Revenue. **Zero** product categories exist. No company has a Sales
  link. That is why 36 of 39 products fail at Confirm: the 3 that resolve are exactly the 3 with a direct
  product link.
- **Additional context (for a verifying agent):**
  - `bizapps-orders/packages/EngineBase/src/OrdersEngineBase.ts` — `ResolveAccount`, `accountFromLink`,
    `resolveRevenueLines`, `ResolveCompanyAccount`
  - `bizapps-accounting/packages/Entities/src/generated/entity_subclasses.ts` — `GLAccountSchema`,
    `GLAccountLinkSchema`, `GLAccountRoleSchema`, `AccountingCompanyProfileSchema`
  - Related: Q9 (GLAccountLink role FK, Amith OQ-G), Q3 (JE-draft account contract), Q36 (no account pool)
- **Answer:** _(pending)_

<a id="q32"></a>
### Q32 · `mj-workspace-tab-strip`'s CSS makes the tabs vertically scrollable — a real bug, plus how to contribute the fix — ask Matt — added 2026-07-17
- **Status:** OPEN
- **Requested reviewer:** Matt (MJ Angular / ng-ui-components)
- **Features:** cross-cutting (MJ base)
- **Proposed solution — PROCEEDING locally, offered upstream.** Fixed in our copy of the strip; the
  one-line fix is below and is Matt's to take or refuse. Also filed to `~/MJDev/MJ-UPSTREAM.md` so an
  MJ agent can pick it up independently.
- **The bug (found twice, independently, by two agents — which is why we believe it):** the strip sets
  `overflow-x: auto` and leaves `overflow-y` at its `visible` default. **Per the CSS overflow spec, a
  `visible` axis paired with a non-`visible` axis COMPUTES TO `auto`.** So asking for horizontal
  scrolling silently turns on VERTICAL scrolling too — and `.ws-tab`'s `margin-bottom: -1px` (the
  trick that makes an active tab sit on the strip's rule) gives it exactly 1px of overflow to scroll.
  Nobody wrote vertical scrolling; CSS inferred it. Marcelo hit it twice and could not explain it:
  *"why are the tabs scrollable? I'm confused. Having the ability to scroll left and right on them,
  that kind of makes sense because they're tabs, but I don't know why they're vertically scrollable."*
- **The fix (one line):** set `overflow-y: hidden` explicitly on `.ws-tabs`. Horizontal scrolling is
  unaffected; the -1px overhang still renders (it is a negative margin, not overflow the user needs).
  We also added `:host { display: block }` so the strip's bottom rule spans the card it heads rather
  than stopping under the last tab.
- **Why it is worth Matt's time even though it is 1px:** it affects EVERY consumer of the strip (our
  JE workspace, batch workspace, order editor, product workshop), it is invisible in code review, and
  the symptom (a phantom scrollbar on a single row of tabs) reads as "the app is broken" rather than
  "a CSS axis computed to auto".
- **The question for Matt:** (1) Take the `overflow-y: hidden` + `:host { display:block }` fix
  upstream? (2) If yes, what is the contribution path — PR to MJ, or do you want it? (3) Any consumer
  we would break by pinning that axis?
- **Additional context (for a verifying agent):**
  `packages/Angular/Generic/ui-components/src/lib/...` (the shared strip) vs our local copy at
  `bizapps-accounting/packages/Angular/src/lib/transfer-pending/workspace-tabs/workspace-tab-strip.component.css`.
- **Answer:** _(pending)_

<a id="q33"></a>
### Q33 · `mj-page-header` — an inline/dense `[meta]` placement, or are we simply wrong? — ask Matt — added 2026-07-17
- **Status:** OPEN
- **Requested reviewer:** Matt (MJ Angular / ng-ui-components)
- **Features:** cross-cutting (MJ base)
- **⚠ This question may be OBSOLETE before it is asked — check first.** It exists because `[meta]`
  renders BELOW the identity, costing a header line, so we put our stat chips in `[actions]` instead
  and added a density override. **On 2026-07-17 Marcelo asked to try the chips back under the title**
  (*"can you just try shifting it to be under the orders title and see what it looks like instead?
  Maybe I was wrong"*) — i.e. `[meta]` used exactly as MJ designed. **That change is shipped and
  awaiting his look.** If he likes it, this deviation deletes itself, the density override shrinks to
  just the scope-chip/refresh height match, and **there is nothing to ask Matt for.** Do not send this
  until he has judged it.
- **The question for Matt (only if the above still stands):** (1) Would MJ take a `[Dense]` input on
  `mj-page-header` / `mj-page-header-interior` (tighter vertical rhythm for data-forward apps)?
  (2) Would MJ take an inline `[meta]` placement option (chips beside the identity rather than under
  it) for the same reason? (3) Or is the below-identity placement deliberate and we should stop
  fighting it?
- **Context to share:** accounting/orders is a data-forward app where vertical space is the scarce
  resource; Marcelo's driving complaint was *"we don't wanna waste space on our page... no stacking
  in that header."* Also worth telling Matt: our density override originally forked `.mj-btn` and was
  **silently squashing MJ's 44px small-screen touch target** — caught by MJ's own CI gate. That is a
  point IN FAVOUR of the gate and of asking rather than overriding.
- **Answer:** _(pending)_

<a id="q34"></a>
### Q34 · We duplicated `mj-accordion-panel` — retiring ours; anything upstream wants? — ask Matt — added 2026-07-17
- **Status:** OPEN (informational — no decision blocked)
- **Requested reviewer:** Matt (MJ Angular / ng-ui-components)
- **Features:** cross-cutting (MJ base)
- **Proposed solution — DONE, no ask.** We hand-rolled disclosure sections in the Product workshop
  believing MJ had no accordion primitive. **It does** — `mj-accordion-panel`, and its `[Bare]` input
  is precisely the variant we built by hand: *"drop the panel's own border and header background so
  the panel sits cleanly inside a host that already provides chrome... only the box styling is
  removed"* → `border: none` + transparent header + a `border-bottom` rule on the expanded header =
  Marcelo's *"just a drop down section with the text and then the line that goes across."* It also
  ships `mjAccordionTitle` (rich titles), `mjAccordionActions` (header controls, deliberately NOT
  inside the toggle button), `aria-controls`/`aria-labelledby`, and a `[Fill]` mode for
  "section owns the leftover height and scrolls internally". **Ours is being deleted and replaced.**
- **Why this is filed at all:** as a caution, not a request. The deviations register briefly listed
  our sections as an upstream contribution to propose — which would have wasted Matt's time
  proposing a component he had already built, with a variant aimed at our exact case. It was one of
  FOUR absence-assertions this session that turned out false (`Payment.Last4`,
  `AccountingCompanyProfile.ApprovalCFOUserID`, `PaymentLine` as the payment-application concept, and
  this). Every one was the same move: search for the name *we* would have used, fail to find it,
  conclude absence.
- **The only real question for Matt:** is there a discovery surface for ng-ui-components (a catalogue,
  a storybook, a doc index) that would make "does MJ already have X?" cheap to answer? The failure
  mode above is expensive and repeatable, and `ls packages/Angular/Generic/ui-components/src/lib/`
  is what finally answered it.
- **Answer:** _(pending)_

<a id="q35"></a>
### Q35 · `mj-accordion-panel [Bare]` removes the box but keeps three behaviours that assumed it — ask Matt — added 2026-07-17
- **Status:** OPEN
- **Requested reviewer:** Matt (MJ Angular / ng-ui-components)
- **Features:** cross-cutting (MJ base). Supersedes the accordion half of [Q34](#q34).
- **Proposed solution:** we adopted `[Bare]` and DELETED our hand-rolled equivalent (72 lines → 31), so
  we are on MJ's component and want to stay there. **No local override applied** — reporting instead of
  `::ng-deep`-ing, because two overrides this same day turned out to be silently defeating MJ's own
  decisions (the 44px WCAG touch target; the responsive title). These three are Matt's call.
- **The finding — one root cause, three symptoms.** `[Bare]`'s doc says it "drops the panel's own border
  and header background so the panel sits cleanly inside a host that already provides chrome... only the
  box styling is removed." In practice it removes the box but **retains three behaviours that were
  correct only BECAUSE the box was there**:
  1. **The rule only exists while EXPANDED.** `accordion.scss:110` puts `border-bottom` on
     `.mj-accordion-panel--expanded > .mj-accordion-header-row`; `[Bare]` (line 191) only recolours it.
     Collapsed = no line. **Five collapsed bare panels stack with nothing separating them.** MJ's own
     comment explains the intent ("a border on the collapsing body would leave a stray line at 0fr") and
     it is right for a bordered panel — the box already separates. Under Bare, nothing does.
  2. **The hover paints a hard rectangle.** `.mj-accordion-panel` is `border-radius: var(--mj-radius-sm)`
     + `overflow:hidden`, so the full-bleed `.mj-accordion-header-row:hover` is clipped round. `[Bare]`
     sets `border-radius: 0` — so the same full-bleed hover now renders a **square-cornered grey block
     appearing from nowhere**, in an app where every other surface is rounded. Marcelo: *"something that
     is definitely not the standard that I noticed is when you hover the accordion, it shows up as
     rectangular. The corners aren't rounded on it."*
  3. **The chevron sits far right, after the label.** Fine as a *secondary* hint when a box already says
     "I am a container". Under Bare the chevron is the **only** affordance — and it arrives after the
     eye has already read the label and decided the text is not interactive. Marcelo: *"it's really
     confusing to me why the arrow is all the way out on the right on these accordions. The user reads
     the text, and they don't actually know that it's a drop down. They just read the text."*
- **On the chevron specifically — the agent's UI assessment, since Marcelo asked whether right is simply
  the standard:** it is context-dependent, and the deciding rule is *the chevron must enter the eye's
  path BEFORE the label when the label is the scan target.* **Right-side is correct** for wide uniform
  rows where the row itself reads clickable and disclosure is secondary (FAQ lists, settings rows —
  Bootstrap/Material do this). **Left-side is correct** when the label is the primary scan target and
  disclosure IS the point: file trees, IDE outlines, nav trees, Notion toggles, and our own GL-account
  rollup. A boxless section is the second case. So Marcelo's instinct is right, and it is an
  affordance-ordering argument, not taste.
- **⚠ UPDATE 2026-07-17 — questions (1) and (2) are very likely OUR BUG, not MJ's. Read this before
  asking Matt.** Re-read `accordion.scss` end-to-end: `[Bare]` drops the border, radius and header
  background **because it expects the HOST to supply the box** — that is the whole point of the
  variant. We were not supplying one: all five panels sat inside a single bordered `.pw__panel`, so
  no panel had its own surface. That — not `[Bare]` — is why the rows read flat against the
  background, and it is precisely what Marcelo saw: *"maybe my issue is just that the row is the same
  color as the background."* Giving each panel its own card (`--mj-bg-surface` + `--mj-radius-md` +
  `--mj-shadow-sm` + `overflow:hidden`) on a `--mj-bg-page` well **dissolves symptom 1** (the cards
  separate the sections, so no divider rule is needed) **and symptom 2** (`overflow:hidden` on the
  host clips MJ's full-bleed hover to the host's radius, so the hover rounds itself for free). So
  MJ's design was right and our usage was wrong. Do NOT ask Matt (1) or (2) as bugs.
- **The question for Matt (revised — (3) is the only real gap):** (3) Under `[Bare]`, should the
  chevron LEAD the label rather than trail it? Requesting **`[ChevronPosition]: 'start' | 'end'`**
  (default `'end'`, so nothing changes for existing consumers). This one is NOT usage error and NOT
  reachable from a host: `.mj-accordion-chevron` is a **sibling of the header `<button>`** inside
  `.mj-accordion-header-row` and the source comments state it is **always** the rightmost element —
  even `mjAccordionActions` renders *before* it, so no projection slot can get left of it. No input
  affects it (`Bare`/`Size`/`Variant`/`FlushBody`/`Fill` all leave the position fixed).
  (4) Smaller, same family: should `[Bare]` also zero `.mj-accordion-panel`'s `margin-bottom: 8px`?
  That margin is box chrome, and inside a host card it becomes a dead surface strip. We currently
  reset it with a single documented `::ng-deep`; if you agree, that override deletes itself.
  (5) Framed generally: **is `[Bare]` meant to be a boxless variant whose host owns the box?** If yes
  — which the above strongly suggests — the doc should SAY so, because its silence is what let us
  ship it without host chrome and then misread the result as an MJ defect for a full day.
- **Context to share:** we are the case `[Bare]` was seemingly built for — five stacked disclosure
  sections in a data-dense workshop card that already provides chrome. Marcelo's original ask, verbatim:
  *"you don't even need to do accordion dropdowns. You can do, like, just a drop down section with, like,
  the text and then the line that goes across, if you know what I'm talking about. That's, like, a common
  one too that you click and it drops down."* — i.e. a persistent divider, open or closed.
  Also worth telling him: he judged the swap *"fine. It's not nearly as pretty as it was before. It is
  more in line with MJ's styling, though."* We took the consistency trade deliberately.
- **Additional context (for a verifying agent):**
  `packages/Angular/Generic/ui-components/src/lib/accordion/accordion.scss` — lines 11–16 (panel box),
  27–29 (hover), 110 (expanded-only rule), 187–192 (`--bare`). Consumer:
  `bizapps-orders/.../shell/pages/product-workshop.page.html`.
- **Answer:** _(pending)_

<a id="q37"></a>
### Q37 · Posting-date model + closed-period handling (MOD-16) — does per-JE posting survive the one-consolidated-JE-per-company push? — review: Robert (+ Amith) — added 2026-07-17
- **Status:** ANSWERED (2026-07-17, same day — Marcelo: the thread had already answered it) — frozen.
- **Requested reviewer:** Robert (design); Amith (the one-JE-per-company push model is his)
- **Features:** ACC-D.8/D.9 (per-JE posting dates; closed-period exceptions), ACC-D.1 (netting key)
- **Proposed solution (what we are implementing — MOD-16):** Posting Date travels **per Journal
  Entry, equal to its `EffectiveDate`**, and is carried through to BC **per line** — no batch-level
  posting or document date (BatchedAt/SentAt/AcknowledgedAt stay process timestamps). To preserve
  that, batch summary lines net per **(GLAccount × Dimension-combo × EffectiveDate)** — never
  across dates. So the thing we push per company is ONE BC journal whose **lines carry different
  posting dates** (Robert: BC natively supports this; Jeremy: posting date is API-settable to any
  date — verify with a test post). Document date stays informational; posting date drives the
  period (Jeremy's field-mapping warning recorded). **Closed periods:** when a line's posting date
  falls in a closed BC period, we **HOLD that JE — flag it for review in the approvals/in-flight
  inbox and let the rest of the batch proceed; never auto-roll the date** (Jeremy's OQ-1 ruling).
  v1 mechanism: flag on BC rejection at dispatch; a proactive BC period-status feedback loop is a
  later enhancement.
- **The tension this needs review on (why we're asking):** Amith's stated model in the same thread
  is "you get **one journal entry** when a batch is sent across… **a singular Posting Date for a
  Batch** … quite important and should match the date in the GL system." Jeremy's correction (which
  MOD-16 adopts) is that one date across a week-spanning batch misstates periods at month-end. The
  two reconcile ONLY IF the one consolidated per-company journal can carry **per-line posting
  dates** — which collapses "one JE" into "one journal document with N dated lines." (1) Robert:
  confirm that reconciliation is the intended shape (and that BC's journalLines API accepts
  per-line postingDate on one journal). (2) Amith: confirm you're OK losing the singular batch
  posting date — the per-date netting means slightly less consolidation around month boundaries in
  exchange for correct periods. (3) Confirm HOLD-and-flag (never auto-roll) as the default engine
  behavior for closed-period collisions, with the flagged-exceptions inbox as the surfacing.
- **Context to share:** `meetings/2026-07-14 - je-single-company-batching-proposal.md` P1 +
  `meetings/2026-07-17 - User Feedabck over the week 07-12.md` (the posting-date thread — Jeremy's
  correction, Amith's singular-date position, Jeremy's OQ-1 ruling).
- **Fixed constraints (not up for debate):** no period calendar in the subledger (MOD-1 FINAL);
  batches are per-company (MOD-15); document date never drives the period.
- **Additional context (for a verifying agent):** MOD-16 + revised MOD-4 in
  `plans/MASTER-PLAN-MODIFICATIONS.md`; BatchingEngine netting rework (pending).
- **Answer:** **The thread's final consensus answers it — AMITH'S MODEL WINS, not the per-JE
  draft this question proposed.** Chronology: Jeremy's per-JE correction came EARLY in the
  thread; Amith's chime-in came after ("we do have a singular Posting Date for a Batch… you get
  one journal entry when a batch is sent across… the posting date in the source system is quite
  important and should match the date in the GL system"); Jeremy then — after Robert clarified —
  went "100% on board with this approach." So: **singular accountant-set `PostingDate` per
  (single-company) batch; ONE aggregated JE to the GL; detail stays in the subledger.** Jeremy's
  surviving condition = the closed-period exceptions process (feedback loop / flag, HOLD for
  review, never auto-roll — his OQ-1 restatement). Period-boundary discipline is the
  accountant's, aided by batch-window presets. MOD-16 reworked in place; MOD-4's brief
  EffectiveDate key withdrawn. Residual: Robert to sync his P1 doc + OQ-1 status (he said
  changing his model is "fairly straightforward" — EXTERNAL-EXPECTATIONS R2).

<a id="q38"></a>
### Q38 · May a product's linked account (direct or via category) belong to a DIFFERENT company than the product? — review: Robert/Amith — added 2026-07-17
- **Status:** OPEN — proceeding; **structure LOCKED by Marcelo 2026-07-17 as UPD-5** (company-
  scoped mapping, per-company category routes, enforcement tiers — building now). What remains
  for Robert is the EDGES below (his Q2 rung intent · bundles · any genuine cross-company case ·
  line-company materialization), not the structure.
- **Requested reviewer:** Robert (+ Amith — it constrains his GLAccountLink polymorphic-mapping design, MOD-10)
- **Features:** ACC-B.1/B.2 (GL mapping + resolution), ORD-C.1/E.2 (line company derivation), ORD-J.1
- **Proposed solution (sharpened 2026-07-17 after the accounting analysis — COMPANY IS AN INPUT
  TO RESOLUTION, so cross-company results are unrepresentable):** revenue belongs to the legal
  entity that owns the product and its performance obligation — a PRODUCT fact, never a document
  fact. So the resolver's question is "what account does this product resolve to **within
  company X**", X = `Product.CompanyID` (required NOT NULL), known before resolution starts. The
  company-scoped walk:
  1. **Product-level link** — must point at an account in the product's company; the ONE place
     link-save validation is needed (the link names both sides).
  2. **Category level — SHARED taxonomy trees, PER-COMPANY routes:** a category node may carry N
     account links per role, one per company it supports (e.g. a DefRev override = one DefRev
     account link per supported company). Resolution picks the link whose account belongs to the
     product's company; no route for that company at this node → keep climbing. **No schema
     change** — the linked account already implies its company; add a uniqueness rule on
     (target × role × company-of-account) for deterministic routing. A cross-company link is
     thus not an error to police — it's a route that never applies to your product.
  3. **Company default** — the PRODUCT-company's defaults (same-company by construction).
  4. Miss → the loud tripwire (unchanged). A fallback may reduce SPECIFICITY, never change
     COMPANY.
  **Cross-company revenue flows, if ever genuinely wanted (agency/intercompany service
  arrangements), are intercompany TRANSACTIONS** — each entity books its own JE, due-to/due-from
  legs tie them (the Payments machinery, MOD-5) — never mapping-table routes.
  **Side benefit (answers the deep-dive worry in part):** line company comes straight off the
  product row, so JE splitting no longer depends on resolution at all, and resolution becomes a
  cacheable (product × role × company) lookup.
  **Enforcement (Marcelo ruling 2026-07-17): invalid data must be impossible at CREATION time,
  via the engine functions + DB design** — not only refused at resolution. Two tiers:
  **HARD-BLOCK (invalid):** product-level link to another company's account · duplicate
  (target × role × company) route · product without a `CompanyID` (NOT NULL). **WARN
  (incomplete, not invalid):** assigning a Company-A product to a category with no route for A —
  legal data (the category's other-company routes are valid for THEIR products); behavior is the
  well-defined fall-through to A's company default; surface an assignment-time warning ("no
  Revenue route for Company A here — resolution will use A's default") so accountants get the
  signal without making categories unusable as catalog/navigation structure.
  **Category model — the accountant-native frame (2026-07-17 analysis):** shared taxonomy with
  per-company routes IS Business Central's posting-group model (shared product posting groups ×
  per-company posting setup; NetSuite multi-subsidiary likewise) — the shape Jeremy's team
  already lives in, and the one his own J1 config-standardization push points at. Duplicated
  per-company category trees would be the alien alternative (N trees, re-categorization per
  company, taxonomy drift, fragmented catalog UX). Present it to Jeremy as "posting groups."
  
- **The question (the Robert sitting):** (1) Confirm the anchor — your Q2 answer resolved the
  final rung against `Order.CompanyID`; on a multi-company order that books one company's product
  revenue into another company's default account. Did you mean the single-company case, and do
  you agree the anchor is the PRODUCT's company? (2) Confirm the company-scoped-walk model +
  per-company category routes (vs company-specific category trees). (3) **Bundles:** a bundle
  owned by A containing B's components — does fan-out book per COMPONENT's company (our lean:
  yes, same rule one level down)? (4) Any real Aptify/BC case of intentional cross-company
  account borrowing — and if so, does it belong in the intercompany path rather than mapping?
  (5) Materialize line-company as a stored column (RLS/query efficiency — orders Q23 sub-q 3)?
- **Context to share:** MOD-10 (role-based polymorphic mapping) · orders MOD-3 rev-2 (product-
  company derivation) · [Q31](#q31) (the related role-on-links question — same sitting).
- **What motivates this now:** Marcelo flags the resolution path as a coming **performance +
  complexity pain point requiring a deep dive** (orders BACKLOG row); the invariant decides how
  much of that complexity exists at all.
- **Additional context (for a verifying agent):** `AccountingEngineBase.ResolveLinkedAccount`;
  `OrdersEngine.ResolveAccount`; GLAccountLink/GLAccountRole migration (B202605281200).
- **Answer:** _(pending)_

<a id="q39"></a>
### Q39 · Multi-company orders: who is the seller of record, and who holds the customer AR? — review: Jeremy (+ Robert) — added 2026-07-17
- **Status:** OPEN — proceeding (with the working model below; the AR-ownership half is the part
  that most needs his ruling before dunning/statements build)
- **Requested reviewer:** Jeremy (finance policy — invoice presentation, AR, tax); Robert (design
  fit — his Betty/Izzy sketch was the seller-of-record flavor)
- **Features:** ORD-C.1/J.1 (multi-company orders), ORD-D.* (order-as-receivable), ACC-M.1
  (intercompany posture), ORD-F.7 (payment application)
- **Proposed solution (RULED by Marcelo 2026-07-17 — MODEL (b), seller-of-record):** In the Blue
  Cypress ecosystem, companies routinely sell OTHER companies' products in one sales process —
  expected normal, not an edge. **The working model we are implementing:** one company OWNS the
  order (`Order.CompanyID`); lines are owned by their products' companies; **the customer AR is
  owned by the SELLING (order-owning) company** — it presents the ONE invoice, receives the
  payment, and does the collection. Rationale: the current real-world complaint — customers
  buying from three ecosystem companies get three invoices; one seller-of-record fixes it.
  **Revenue** still books to each product's company (MOD-11/MOD-3 rev-2 — fixed constraint).
  **Booking consequence to confirm:** under (b) the intercompany position arises AT BOOKING —
  the owning company books the full customer AR and a Due-To per sibling company (or the sibling
  books Dr Due-from-owner / Cr Revenue) so every JE still balances within its company. ⚠ This
  moves intercompany-leg creation from payment-time to booking-time, revising MOD-5's "Payments
  generates ALL legs" posture — flagged, not yet rewritten (this question's confirmation is the
  trigger).
- **The question for Jeremy (confirm + edges):** (1) Confirm model (b): one invoice from the
  seller of record; customer owes ONE company; siblings settle via due-to/due-from. (2) Confirm
  the booking-time intercompany position (vs as-built payment-time legs) and any preference on
  which side books the leg (owner Due-To vs sibling Due-From — or both, mirrored). (3)
  **Tax/nexus:** who collects/remits sales tax when A sells B's product as seller of record?
  (4) Any policy limits on WHICH companies may sell whose products? (5) Dunning/statements:
  confirm they run entirely in the selling company's name (one balance per customer per selling
  company).
- **Context to share:** Robert's Betty/Izzy example (2026-07-14 meeting — "I posted $150,000 to
  Betty… $50 of that is due to another company"); MOD-5 (Payments generates all legs);
  MOD-11/MOD-12 (one JE per company).
- **What motivates this now:** MOD-3 rev-2 settles the revenue side; the AR/document side has
  undiscussed edges exactly where the ecosystem's cross-selling makes them common. Dunning
  (G.7/G.8) and statements (D.6) build on whichever AR model is chosen.
- **Fixed constraints (not up for debate):** revenue books to the product's company (MOD-3
  rev-2/Q38); JEs and batches are single-company (MOD-12/15); accounting is RECEIVE-only on
  intercompany (MOD-5 — Payments owns leg generation).
- **Additional context (for a verifying agent):** `orderJournalDraft.ts` (as-built per-company
  Dr AR/Cr Revenue); accounting MOD-5; orders MOD-11.
- **Answer:** _(pending)_

<a id="q40"></a>

### Q40 · `mj-entity-data-grid` (AG Grid wrapper) — two small enhancements bundled: wire the existing per-column filter input, and add a rest-state sortable arrow — ask Matt — added 2026-07-17
- **Status:** OPEN
- **Who to ask:** Matt (MJ Angular / `@memberjunction/ng-entity-viewer`)
- **Features:** cross-cutting (MJ base grid). Bundles two AG-Grid asks into one so it's approachable to read.
- **Background (self-contained):** the accounting/orders "All X" lists render on `<mj-entity-data-grid>`.
  We want the accountant-familiar grid pattern: **per-column header filters** + a **visible "this column
  is sortable" arrow at rest**. Marcelo is fixed on this design — it absorbs a lot of filter clutter and
  is instantly legible to an accountant who has seen that grid shape before. Research (code-confirmed):
  1. **Per-column filters — the architecture is already there and merely bypassed.** `AllCommunityModule`
     is registered (`entity-data-grid.component.ts:125`), so AG's Text/Number/Date filters are available;
     the public `@Input() AllowColumnFilters` exists (487-493); and `GridColumnConfig.filterable` exists.
     But `filter: false` is **hardcoded** in both `defaultColDef` (line 1363) and `mapColumnConfigToColDef`
     (line 2337), and `_allowColumnFilters` is never read. So `[AllowColumnFilters]="true"` silently does
     nothing. Un-bypassing looks like ~2-3 lines: honor `col.filterable !== false && this._allowColumnFilters`
     (and optionally `floatingFilter: this._allowColumnFilters`) instead of the hardcoded `false`.
  2. **Rest-state sortable arrow — a native AG option MJ has left off.** AG Grid's `unSortIcon: true`
     shows the sort arrow even when a column isn't actively sorted (so users can tell what's sortable). It
     is simply not set; adding `unSortIcon: true` to `defaultColDef` (line 1361) enables it globally (or
     expose it as an input). Per-column **sorting** and global `FilterText` already work well.
- **What we're intending to do (so you can steer the shape):** turn per-column filters on for our list
  grids + show the rest-state sort arrow, keeping everything else the grid already does. We'd rather NOT
  fork or overlay the grid — both changes look like tiny in-place enhancements to inputs/defaults that
  already exist, fully backward-compatible (defaults unchanged unless a consumer opts in).
- **The question for Matt:** (1) Will you wire `AllowColumnFilters` (+ honor `GridColumnConfig.filterable`)
  to the AG `filter`/`floatingFilter` colDef props — is the hardcoded `filter:false` load-bearing for some
  reason, or just an untidied default? (2) Add `unSortIcon` (as a default-on, or an opt-in input) for the
  rest-state sortable affordance? (3) If you'd rather we do it app-side, is a **subclass/extension** of
  `EntityDataGridComponent` the sanctioned way (it keeps your functionality + UI and stays easy to fold
  back), or is there a cleaner extension seam?
- **Context to share:** `packages/Angular/Generic/entity-viewer/src/lib/entity-data-grid/entity-data-grid.component.ts`
  lines 125, 487-493, 1361-1367, 2329-2360; `models/grid-types.ts` `GridColumnConfig`. Also logged in
  `~/MJDev/MJ-UPSTREAM.md` (the `AllowColumnFilters` dead-input entry).
- **Answer:** _(pending)_
