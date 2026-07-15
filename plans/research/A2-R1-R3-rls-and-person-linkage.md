# A2 research — R1 (MJ RLS for company scoping) + R3 (person→company securability)

> Pre-work for the A2 roles/RLS co-design session with Marcelo (schema plan A2; R2 — the existing
> role-management surface — not yet run). Researched 2026-07-14 directly in this instance's MJ source.
> **Findings feed the co-design; nothing here is implemented.**

## R1 — Is MJ RLS efficient/workable for company scoping? **YES, with three specifics.**

### How MJ RLS actually works (verified in source)

- **The unit is a `RowLevelSecurityFilter` metadata row**: a raw SQL WHERE template (`FilterText`)
  with `{{UserX}}` token substitution (any scalar `UserInfo` field — `{{UserID}}`, `{{UserEmail}}` …)
  and per-platform variants (`PlatformVariants`, SS/PG). `securityInfo.ts:332-424`.
- **Attachment is per ROLE per CRUD type** on `EntityPermission`: `ReadRLSFilterID` /
  `CreateRLSFilterID` / `UpdateRLSFilterID` / `DeleteRLSFilterID` (`entityInfo.ts:319-322`) — so
  Read-scoping and write-scoping are independent decisions per role.
- **Semantics:** if ANY of the user's roles grants the permission WITHOUT a filter, the user is
  **exempt** (no clause — `UserExemptFromRowLevelSecurity`, `entityInfo.ts:2219`); otherwise all
  applicable filters **OR together** (`GetUserRowLevelSecurityWhereClause`, `entityInfo.ts:2297`).
  Admin exemption is therefore free: give Accounting Admin the permission with no filter.
- **Enforcement is server-side and central**: `ProviderBase` folds the marked-up clause into every
  RunView (`ComputeRunViewRLSWhereClause`, `providerBase.ts:1898`) and — important for correctness —
  **into the cache fingerprint**, so RLS-scoped users can never be served an unscoped cached result,
  while exempt users keep byte-identical fingerprints (no cache-sharing loss for the common case).
  `ResolverBase.getRowLevelSecurityWhereClause` (`MJServer:960`) applies the same at the GraphQL layer.

### Efficiency verdict for company scoping

The clause is a plain SQL predicate appended to the base-view query — cost = the predicate's cost,
per read, for non-exempt users only. Company scoping would look like:

```sql
CompanyID IN (SELECT CompanyID FROM <membership> WHERE UserID = '{{UserID}}' AND IsActive = 1)
```

An indexed semi-join (seek on `membership(UserID, CompanyID)` + the target's CompanyID) — cheap at
our scale and standard practice. Three specifics the co-design must settle:

1. **The membership source does not exist yet.** Tokens only substitute scalar user fields, so
   company membership MUST come from a table — and **no securable User↔Company table exists today**
   (see R3). **A2's real schema deliverable is a `UserCompanyAccess`-style link table**
   (UserID FK → `__mj.User`, CompanyID FK → `__mj.Company`, IsActive, granted-by/at), admin-managed,
   seeded via metadata. (Alternative — one MJ Role per company — works with zero new tables but
   explodes role count and makes the settings screen awkward; recommend the link table.)
2. **Scope HEADER entities; decide line/batch semantics deliberately.** `JournalEntry.CompanyID`
   exists now (A4) → direct predicate, ideal. `GLAccount`/`ACP` have CompanyID → same.
   `JournalEntryLine` has NO CompanyID — line-level scoping needs
   `EXISTS (SELECT 1 FROM JournalEntry je WHERE je.ID = JournalEntryID AND je.CompanyID IN (…))`
   (indexed, fine, but decide whether line-level enforcement is needed or header-scoping suffices for
   the UI's access paths). **Batches are MULTI-company (CH-4)** — "which companies' users see a batch"
   is a semantics question, not an implementation one → co-design agenda item.
3. **RLS applies only through MJ paths** (MJAPI/RunView/resolvers) — raw SQL bypasses it. Fine for
   the apps (everything goes through MJ), but the DB triggers remain the only raw-SQL floor; RLS is
   access control, not a financial invariant.

Also verified: Marcelo's off-then-on rollout is trivially supported — build the filters + permissions
but attach the RLSFilterIDs last (or grant a temporary no-filter role), then flip in one metadata change.

## R3 — Is person→company linkage SECURABLE, or informational? **INFORMATIONAL — do not hang security on it.**

Inventory of every person↔company-ish link that exists (verified in schema/source):

| Link | Shape | Securable? |
|---|---|---|
| `common Person.LinkedUserID` → `__mj.User` | hard FK, **no uniqueness constraint** (several Persons may claim one User), admin/data-entry writable under ordinary Person update permission, no verification workflow | **Bridge only.** Fine for *attribution* (who a User "is" in CRM terms — the tasks-app decision recording uses it); NOT an access-control primitive by itself |
| `common Relationship` (Person↔Organization) | CRM-grade affiliation rows; targets **`Organization` (customers)**, not `__mj.Company` (our subsidiaries); freely writable CRM data | **Informational.** Wrong target entity AND wrong trust level for company scoping |
| `__mj.Employee` | core table with `CompanyID` FK → Company, but **no User FK** — only an `Email` string (name-match convention); unused by the bizapps suite | **Not securable** (email-string linkage), and adopting it would contradict Q17's ruling |

**Conclusions for the approver mechanism (the question R3 gates):**
- The as-built A4.6 design — **`ApprovalCFOUserID` as a direct, per-company, admin-designated
  `__mj.User` link** — is the right and only securable shape today. Do NOT move the approver onto
  person→company data; there is no authoritative path from a Person to a `__mj.Company`.
- The "approver by company AND role" direction (Marcelo 2026-07-13) composes cleanly on top: the
  **Approver ROLE** gates *capability* (may approve at all; Admin-assigned per A2), while
  **`ApprovalCFOUserID`** designates *which* user approves *this company's* batches. The same new
  `UserCompanyAccess` table from R1 can later back a role-based variant ("any Approver-role user with
  access to company X") **if** Robert/Marcelo want to loosen the single-designee model — that becomes
  a pure metadata/engine switch, no schema rework.
- The settings screen's "scope visible people by company" requirement therefore ALSO keys off
  `UserCompanyAccess` (the securable axis), with `Person.LinkedUserID` used only to *display* the
  person behind a user.

## Marcelo's rulings on R1 (2026-07-14 review) — now DESIGN INPUTS, not open questions

1. **Multi-company batches are allowed ONLY when the user has access to EVERY company in the batch.**
2. **A user may only batch JEs they have access to** (the candidate pool is company-scoped per user).
3. **A user may only SEE JEs of companies they have access to** (Read scoping confirmed required).
4. Marcelo is **routing the visibility-mechanism question to Robert** (concern: a DB access-table
   feels complex) → QUESTIONS.md **Q22**. Until Robert weighs in, `UserCompanyAccess` remains the
   recommended candidate, with role-per-company as the no-new-table alternative.

## Security analysis (Marcelo's spoofing / direct-SQL question — source-verified 2026-07-14)

**Q: are filters robust to spoofing or direct SQL access?** Three distinct surfaces, three answers:

1. **Identity spoofing over the API: NO viable path.** The `{{UserID}}` token is substituted
   server-side from the AUTHENTICATED request identity (`ResolverBase.getRowLevelSecurityWhereClause`
   uses the session payload user — "the authoritative per-request identity"; `MJServer:960`), never
   from client input. A client cannot supply a different user. Client-supplied `ExtraFilter` is ANDed
   with the separately-appended RLS clause — a malicious filter cannot OR itself around the scope.
2. **READ scoping is robust across MJ paths.** The Read RLS clause is applied in the generated
   single-record GET resolvers, list resolvers, related-entity traversals, AND the RunView pipeline —
   and is folded into the server cache fingerprint (no stale-cache leak). Verified in
   `graphql_server_codegen.ts:409/422/650/699` + `providerBase.ts:1898`.
3. **⚠ WRITE-path RLS is a REAL GAP in MJ core today.** `UpdateRLSFilterID`/`DeleteRLSFilterID`
   exist in the metadata model, but I found **no enforcement site**: `CheckPermissions(Update/Delete)`
   checks only the CanUpdate/CanDelete booleans (`baseEntity.ts:2706+`); the mutation flow
   (`ResolverBase.UpdateRecord` → `InnerLoad(pk)` → `Save()` → spUpdate) never applies an RLS
   predicate; every generated RLS call site uses `EntityPermissionType.Read`. Consequence: a user
   whose role grants JE-Update (Read-scoped only) could, if they learn a foreign row's ID, mutate it.
   **Exactly Marcelo's scenario — and it means READ-RLS alone does not satisfy his requirement.**
   → Filed as an MJ-UPSTREAM question (design-intent vs bug) AND, independently of MJ's answer, A2
   enforces writes **app-side**: entity-server `Save()/Delete()` overrides on the JE family (+ batch
   ops in `BatchingEngine`) that verify the acting user's company access against `CompanyID` — this
   runs on EVERY MJ path (in-process and GraphQL both resolve the registered entity-server class),
   and it is where rulings 1–2 (batch membership/candidate scoping) get enforced regardless of the
   RLS mechanism chosen for reads.
4. **Direct SQL access: MJ RLS does not apply — by architecture, nobody has it.** App users never
   hold DB credentials; the only SQL principals are the MJAPI service login and admin logins, and a
   user's identity exists only in the app layer (the DB cannot even tell users apart). So
   "direct-SQL spoofing" requires infrastructure-credential compromise, not an app privilege. The
   un-bypassable raw-SQL floor remains the FINANCIAL-invariant trigger set (50001–50025), which is
   deliberately user-agnostic. Per-user enforcement at the DB layer (native SQL Server RLS +
   SESSION_CONTEXT) was considered and deliberately NOT pursued — see the design note below
   (Q23 withdrawn).

### Marcelo's follow-on review (2026-07-14, second pass)

- **Write-path RLS gap:** handed to the bug-fix agent (MJ-side). Interim posture: testing proceeds on
  READ visibility; A2 assumes write-RLS works by the time it lands (the app-side entity-server checks
  stay in the design as belt-and-suspenders + the home of the batch rulings).
- **Blast radius** (surface 4, the service credential): briefly elevated to a Robert question (Q23),
  then **WITHDRAWN (Marcelo, 2026-07-14)** — see the design note below.
- **R3 corollary:** the membership-grant source must itself be securable — **Q24** for Robert
  (explicit admin-managed grants, never derived from informational person→company data; HR-driven
  membership, if ever wanted, syncs INTO the grant table under governance).

### Design note — native DB-level RLS deliberately NOT pursued (Q23 withdrawn, Marcelo 2026-07-14)

The blast-radius question was withdrawn from Robert's queue: omitting a native SQL Server RLS /
SESSION_CONTEXT layer is accepted as the design decision (consistent with MJ's own architecture,
which places per-user enforcement in the API layer). This section stands as the durable record:

- **Stolen USER credential** → bounded by the Q22/Q24 grant model (roles + RLS + app-side write
  checks); Admin stays the crown-jewel role (small + audited).
- **Stolen SERVICE credential** → full app-data reach is architectural (one shared login serves all
  users; the DB cannot distinguish them). The operative mitigations are operational, already adopted:
  DB reachable only from API hosts; the runtime login holds CRUD/execute but **no DDL** (the
  financial-invariant triggers 50001–50025 cannot be disabled by a credential thief); rotation +
  out-of-pattern detection.
- **Native DB RLS + SESSION_CONTEXT** would harden only against application-layer bugs — never
  against credential theft (the connection holder sets its own context). If defense-in-depth demand
  ever changes (e.g. a compliance requirement), this is the section to reopen.

## R2 (Marcelo 2026-07-14): deferred to the UI-updates wave — role-management screens fold into it.

## Recommended co-design agenda (30 min)

1. Bless `UserCompanyAccess` (columns above) as A2's schema deliverable vs. role-per-company.
2. Role tree (Accounting User / Admin / Approver) × which entities get which RLS filter IDs, per CRUD.
3. ~~Batch visibility semantics~~ — RULED (Marcelo 2026-07-14): multi-company batch requires access
   to ALL its companies; batching restricted to accessible JEs; visibility company-scoped. Remaining:
   mechanism only (Q22, Robert).
4. Line-level enforcement: needed, or header-scoping sufficient?
5. Rollout: filters authored but detached → single flip (off-then-on, already ruled).
6. Ethan (LXP) input: what the integrating user's service identity needs to READ (their poll path) —
   likely a narrow role with no RLS exemption.
