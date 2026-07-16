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
| 1 | [Q19](#q19) | Jeremy — golden path + exceptions (absorbs Q12/Q15) | OPEN ★HIGH |
| 2 | [Q22](#q22) | Robert — company-visibility mechanism (roles/RLS, A2) | OPEN |
| 3 | [Q24](#q24) | Robert — securable company-access grants + governance | OPEN |
| 4 | [Q25](#q25) | Ian/Matt/team — shared-UI component routing (transfer backlog) | OPEN |
| 5 | [Q6](#q6) | Robert — batch-approval workflow shape (+ manual-JE gate) | OPEN |
| 6 | [Q7](#q7) | Robert — batches/approvals visibility (confirm at A2) | OPEN |
| 7 | [Q3](#q3) | Robert — JE-draft account contract (bless-as-built) | OPEN |
| 8 | [Q9](#q9) | Amith — GLAccountLink role FK (bless-as-built) | OPEN |
| 9 | [Q26](#q26) | Matt — Explorer header widget slot (feature ask) | OPEN |
| 10 | [Q27](#q27) | Matt — `mj-left-nav` desktop icons-only collapse (feature ask) | OPEN |
| 4b | [Q28](#q28) | Marcelo — batch/task transaction split + batch task pointer (MOD-14) | OPEN ★HIGH |
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
- **Context to share:** the live demo (interface intentionally rough — features matter for the internal
  LXP demo); Robert is re-reading the old Aptify batching capabilities in parallel.
- **Additional context (for a verifying agent):** `plans/2026-07-09-robert-meeting-decisions.md` D2/D3;
  `Accounting Meeting-20260709_121044-Meeting Recording.md`; BACKLOG `[decision needed: Jeremy]` row.
- **Answer:** _(pending)_

<a id="q22"></a>
### Q22 · Company-visibility mechanism (roles/RLS) — ask Robert — added 2026-07-14 (Task 50a; context expanded Task 54a)
- **Status:** OPEN
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
- **Answer:** _(pending)_

<a id="q24"></a>
### Q24 · Securable company-membership grants (vs informational person data) — ask Robert — added 2026-07-14 (Task 51a; context expanded Task 54a)
- **Status:** OPEN
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
- **Answer:** _(pending)_

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
- **Status:** OPEN
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
- **Answer:** _(pending)_

<a id="q7"></a>
### Q7 · Batches/approvals visibility — ask Robert — 2026-07-08 (reformatted 2026-07-16)
- **Status:** OPEN — largely absorbed by MOD-9 (roles + RLS) + action plan A2; confirm at the A2 co-design
- **Who to ask:** Robert
- **Features:** ACC-D.3, ACC-K.1
- **Background (self-contained):** No permission gating exists today (dev): every user who can open
  the app sees the Batches/Approvals surfaces and all controls. (Original ref: task #17.)
- **The question for Robert:** who can SEE the Batches/Approvals surfaces, and who can see/use
  Approve/Reject? Needed before exposing the management UI beyond dev.
- **Context to share:** the proposed role set (Admin / User / CFO Approver) in the users-&-roles mockup.
- **Additional context (for a verifying agent):** MJ `guides/UNIFIED_PERMISSIONS_GUIDE.md`.
- **Answer:** _(pending)_

<a id="q3"></a>
### Q3 · JE-draft account contract: resolved ID vs account number — ask Robert — 2026-07-08 (reformatted 2026-07-16)
- **Status:** OPEN (bless-the-as-built; low risk)
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
- **Answer:** _(pending)_

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
- **The question for Matt:** would MJ accept a `[Collapsible]` / `[Collapsed]` input on
  `<mj-left-nav>` (hamburger → icons-only, labels/badges hidden, tooltips carry the label,
  state persisted by the consumer via `UserInfoEngine`)? If yes we contribute it upstream; if no,
  the always-expanded rail becomes the permanent accounting/orders answer and the mockup's
  hamburger is struck from the design record.
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
