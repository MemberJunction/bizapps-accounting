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

## Recommended co-design agenda (30 min)

1. Bless `UserCompanyAccess` (columns above) as A2's schema deliverable vs. role-per-company.
2. Role tree (Accounting User / Admin / Approver) × which entities get which RLS filter IDs, per CRUD.
3. Batch visibility semantics under multi-company batches (CH-4).
4. Line-level enforcement: needed, or header-scoping sufficient?
5. Rollout: filters authored but detached → single flip (off-then-on, already ruled).
6. Ethan (LXP) input: what the integrating user's service identity needs to READ (their poll path) —
   likely a narrow role with no RLS exemption.
