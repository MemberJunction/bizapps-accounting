# ActionPlan - UI: Unified view-edit primitives, forms boundary, scope model

> **Status:** Draft (design pass — Marcelo-involved; flips Active on his review)
> **Created:** 2026-07-21
> **Scope:** CROSS-APP — bizapps-accounting + bizapps-orders (plan homed here because the shared
> primitives live in this repo's Angular lib; orders consumes via `@mj-biz-apps/accounting-ng`)
> **Implements:** acct UPD-3 (forms-first, incl. the UPD-3.5 design-pass requirement) · UPD-4/UPD-6
> (list idiom, Matt rulings) · UPD-5.5 (route-management surface joins this pass) · orders UPD-11
> (forms-first + order-editor pilot + convert-on-touch) · UPD-12/UPD-13 · element doctrine
> (design-docs/ui-design/README.md, ratified 2026-07-16)
> **Sources:** MJ `guides/FORMS_ARCHITECTURE_GUIDE.md` · as-built surveys 2026-07-21 (this plan's
> §1 inventory + §3 editability tables are their distillate) · `meetings/2026-07-17 - Amith Demo
> Feedback.md` · `meetings/2026-07-20 - Accounting UI Review - Matt and.md`
> **Open question:** [Q43](../QUESTIONS.md#q43) — "batch using a form" intent (proceeding on the
> proposed reading below)

**Why this plan exists.** Every complex entity needs (a) a detail view off its list page and (b) a
good create/edit surface in a workspace — and today those are served by FOUR parallel idioms
(bespoke detail panels, `openBizDetail` form-host overlays, workspace-card workshops, legacy
inline/scrim editors). This plan defines the small primitive set that powers all of them, the rule
for when MJ forms are the tool vs. a bespoke workspace, and the one-authority company-scope model —
so we stop building bespoke detail/edit UI per entity.

---

## 1. As-built inventory (what we're unifying — survey 2026-07-21)

**Foundations already shared** (accounting `transfer-pending/`, purity-enforced, orders imports):
- `mj-workspace-card` — slotted card: browser-style draggable session tabs (`mj-workspace-tab-strip`
  + pure `WorkspaceTabStore<TState>`), `[workspaceHeader]` identity band, one scroll body,
  standardized footer (primary confirm w/ per-use label + `Keep as draft` + `Discard`). ⚠ the card
  component itself is NOT yet exported from `public-api.ts` (strip/store/types are) — close that.
- `shell-table.css` (sticky-header table stylesheet, ~21 pages, duplicated per app), `mjTip`
  truncation tooltip (not yet exported).
- `openBizDetail(forms, opts)` (`custom/shared/biz-detail-form.ts`) — the sanctioned entry into
  MJ's form host: slide-in (560px) or dialog (760px) over `MJFormPresenterService.Open` with the
  curated `BIZ_DETAIL_CONFIG` (`Toolbar:null`, no related entities, links inert). Cross-app.
- `CompanyScopeService` + `<mj-company-scope-chip>` (rail-top, per-user via UserInfoEngine;
  empty = ALL; `FilterFor`/`ComposeFilter` own the predicate). Cross-app.

**The four detail/edit idioms in the wild:**
| Idiom | Where | Fate under this plan |
|---|---|---|
| Bespoke `*-detail-panel` slide-ins | JE (list + approvals), Order (list + status board) | Converge onto widget-composed `*Extended` forms (§4); panels become thin form-host mounts |
| `openBizDetail` form-host overlay | everything else + all pop-outs | KEEP — the standard record-detail surface |
| `mj-workspace-card` workshops | JE workspace, batch workspace, order editor, product/category workshops, payment capture | KEEP for orchestration; gain the view/edit-record mode (§5) |
| Legacy inline/scrim editors | gl-accounts + ~8 orders config pages | Migrate convert-on-touch (UPD-11 rule, already in force) |

MJ forms machinery in use: two `*Extended` custom forms exist (JournalEntry — status timeline,
lines w/ dimension chips, generate-reversal; GLAccount — COA tree). Orders has none yet. No
`BaseFormPanel` slots, no `EntityFormOverride`s, no direct shell/host template usage — everything
imperative via the presenter. That concentration is a strength: one seam to extend.

## 2. The MJ-forms adoption boundary (the rule)

**The decision test (one question):** *is the surface's subject a single entity record whose
fields the user reads or writes?*

- **YES → the MJ form host renders it.** Full-page, dialog, or slide-in — always through
  `openBizDetail` (never raw `MJFormPresenterService` calls in pages; keep the one seam). The
  form that renders is the entity's `*Extended` form, so depth (lines, timelines, trees) comes
  from the form family (§4), not from bespoke panels.
- **NO — it's a PROCESS (criteria → preview → commit, multi-record, remote-op-backed) → a
  workspace-card surface.** The form host has no record to bind mid-flow; forcing it would be
  form cosplay. This is the existing element-doctrine ruling ("Batch building: no → workspace")
  generalized: JE workspace (creates via `Accounting.CreateJournalEntry`), batch workspace
  (`PreviewBatch`/`BuildBatch`), payment capture, product/category workshops.
- **Workflow visualizations** (kanban/status board, worklists, fulfillment queue) are neither —
  they're browse surfaces with verbs; their row-detail opens via the form host (already the
  UPD-11 exemption).

**Corollaries (bind the build):**
1. New create/edit surface for an entity ⇒ `*Extended` form + `openBizDetail`. A new bespoke
   editor page requires naming which test-branch it falls under, in the PR.
2. Workspaces may EMBED form widgets (§4's shared widgets) but never re-implement a record editor
   that the entity form already is. Where a workspace's per-tab state IS an entity record (order
   editor pilot), the tab body hosts the entity form (§5), not a parallel editor.
3. `openBizDetail` stays the only caller of the presenter in app code; extensions to overlay
   behavior land there once, both apps inherit.

## 3. Editability model — state-derived, trigger-mirroring (the "view = edit, gated" primitive)

The DB triggers are the authoritative truth for what's mutable per state (survey distillate):

| Entity | State | Editability |
|---|---|---|
| JournalEntry | Pending | FULL (lines add/edit/delete; may be temporarily unbalanced) |
| JournalEntry | Batched, batch still Pending | LOCKED except `GLPostedAt/GLReferenceID/ReversedByJournalEntryID/Status`; sanctioned unlock = Batched→Pending + BatchID→NULL (trigger 50004) |
| JournalEntry | Batched (batch Approved+) / GLPosted | PERMANENT LOCK; correct via reversal JE (50003/50004/50006) |
| JournalEntryBatch | Pending | FULL (mutable + deletable) |
| JournalEntryBatch | Approved/Sent/Posted | Content frozen; only status-flow fields evolve (50008/50009) |
| Order | Draft/Quoted | FULL (totals recompute; Void allowed) |
| Order | Confirmed+ | Line financials + totals frozen (51002/51003); descriptive fields + `OrderLine.FulfillmentStatus` editable; status forward-only |
| Payment | Pending/Failed | FULL (deletable) |
| Payment | Captured+ | Financial fields frozen (51004/51005); status may advance |
| ScheduledJournalEntry | Scheduled → Generated | FULL → financials frozen (50016-50018) *(entity retires with MOD-17/S3 — do not invest)* |

**Answer to the brief's example question:** JEs are NOT read-only once created — fully editable
while `Pending`; the lock begins at `Batched` (reversible while the batch is Pending, permanent
after batch approval). There is no `Approved`/`Reversed` JE status — approval is a batch concept;
a reversal is a new Pending JE.

**The primitive: `EditabilityPolicy` (per entity, pure, tier-1-tested).**
```ts
// transfer-pending/editability/ — framework-free, like WorkspaceTabStore
type Editability =
  | { Mode: 'full' }
  | { Mode: 'partial'; EditableFields: string[]; Reason: string }   // whitelist mirrors the trigger
  | { Mode: 'locked'; Reason: string; Actions?: StateAction[] };    // e.g. Generate reversal, Cancel batch
type EditabilityFn<E> = (record: E) => Editability;
```
- One policy per stateful entity, colocated with the app (accounting: JE, batch; orders: order,
  line, payment). The whitelist literally transcribes the trigger's allowed-column list, with a
  comment citing the trigger + THROW code — when a migration changes a trigger, the policy is part
  of the same change's Definition of Done (same muscle as the ERD rule).
- **Consumed identically by all surfaces:** `openBizDetail` gains `policy?: EditabilityFn` — it
  computes `EditMode` (`locked` → read; else edit) and passes the field whitelist through to the
  form; `*Extended` forms + shared widgets disable non-whitelisted fields in `partial` mode
  (MJ's `EditMode` is form-wide, so per-field gating is the Extended form's job — this is a known
  design point, not a gap in MJ); workspace record-tabs (§5) drive their footer from the same
  policy. The UI mirrors, the trigger enforces — a drifted mirror degrades to a server error, never
  silent corruption.
- `locked` renders the form read-only **plus the state's real verbs** as actions (JE: Generate
  reversal; batch: Cancel; payment: Refund) — never a disabled Save.

## 4. The form family (what the UPD-3.5 mockup round designs)

The design pass proper — mockup + discussion round (ui-dev-loop §3.3) with Marcelo — covers the
FAMILY shape, not this plan's mechanics: base pattern + specialization, "similar data structures
handled the same way without over-standardizing" (UPD-3.5), reference = the agents-app forms
(Amith) + CDP/ATS grid for list idiom (UPD-4/12).

- **Roster:** acct — JournalEntry (exists, uplift), JournalEntryBatch (new Extended), GLAccount
  (exists), route-management surface (category × role × company — UPD-5.5); orders — Order (the
  PILOT: tab set Details · Lines · Bill-To/Ship-To · Payments · Accounting, per UPD-11.3),
  Payment, Product, Subscription.
- **Widget-composed (UPD-3.1):** the drill-in form and the dashboard panel are the same
  components. Extract the JE detail panel's internals (lines grid w/ dimension chips, status
  timeline, provenance band) into widgets the `*Extended` form composes; the bespoke panels then
  become thin form-host mounts and die as a parallel idiom.
- **House rules that bind every family member:** provenance loud on every JE surface + manual-ness
  prominent (UPD-3.4) · required-state red-dot per editor tab + gated save (UPD-6.3) · container
  queries not media queries; sticky interior chrome; content scrolls (UPD-6.1/6.2) · column-header
  filters + rest-state sort arrows ride Matt's Q40 (UPD-4).

## 5. Workspaces gain "open a record" (view/edit in the workspace)

Today a workspace tab's `State` is a draft POJO and the only read-only mode is the post-commit
receipt. The unification:

- **Tab state becomes a discriminated union:** `DraftTab` (as today — process state, remote-op
  commit) | `RecordTab` (an existing entity record opened to view/edit). A `RecordTab`'s body is
  the SAME entity form (via an embedded `<mj-entity-form-host>` mount inside the card body — the
  host is presentation-agnostic by design), with editability from §3's policy.
- **Footer verbs derive from tab kind + policy:** Draft → Confirm/Keep-as-draft/Discard (as
  today). Record+full/partial → Save / Discard-changes. Record+locked → no save; the policy's
  `Actions` render instead. One card, one action bar, labels vary — exactly the standardization
  the card was built for.
- **Where "open in workspace" comes from:** list rows get "peek" (slide-in via `openBizDetail`,
  unchanged) and "open in workspace" (new tab in the entity's workshop) — the slide-in's pop-out
  (↗) targets the workspace tab rather than a bare dialog, honoring the doctrine's "full-depth
  home".
- Order editor is the pilot (UPD-11.3 + Matt's tab-completeness concern lands here); JE workspace
  follows (a `RecordTab` on a Pending JE = edit; on a Batched JE = locked view w/ Generate
  reversal).

## 6. "Batch using a form" — pinned definition (Q43, proceeding)

The batch workspace does NOT map to "edit a JournalEntryBatch record" — it's criteria → preview →
build over remote ops, and the element doctrine already ruled it a workspace. Proposed reading
(Marcelo confirms via [Q43](../QUESTIONS.md#q43)):

- **(a) YES — the criteria panel adopts the form idiom:** shared form-field primitives/styling so
  it reads as a structured form (familiarity), while remaining process state, not an entity bind.
- **(b) YES — the BUILT/existing batch is form-host territory:** a new `JournalEntryBatch`
  `*Extended` form (per-company summary, line items, approval timeline, dispatch state) renders
  everywhere a batch is VIEWED — list detail, post-build receipt tab (as a `RecordTab`), approval
  inbox context — with §3 editability (Pending = full, Approved+ = locked + status verbs).
- **(c) NO — the orchestration itself is never re-modeled as an entity form.**

## 7. Company scope vs local filters — one authority per surface (app-wide)

Extends the ratified doctrine line ("never two filter systems on one page") to company scope:

| Surface type | Authority | Rule |
|---|---|---|
| **Browse** (lists, dashboards, worklists, boards) | **GLOBAL scope** | Query through `Scope.ComposeFilter`/`FilterFor` ONLY. **No local company control.** The rail chip is the one place company is chosen. |
| **Operational workspace** (own criteria: JE workspace, batch workspace, workshops) | **LOCAL criteria** | Scope SEEDS the default once at tab open (as-built behavior — correct); after that the criteria panel is the only company authority on the page. Criteria chips display it; the surface never ANDs the live global scope into its queries. |
| **Record detail** (form host / record tabs) | **NONE** | A record is a record; no company filtering applies. |

- **Violations to fix (the only two):** `all-journal-entries.page` (local `CompanyID` select ANDed
  over the scope filter) and `gl-accounts.page` (local `FilterCompanyID` + scope both applied) —
  remove the local selects; users narrow via the chip.
- Compliant today (keep): JE dashboard, approvals, batches dashboard, all-payments (global-only);
  JE workspace + batch workspace (seed-then-local); catalog's `OwningCompanyID` select is a DATA
  filter on a nullable ownership column, not a scope duplicate — allowed, but label it "Owner".
- `all-orders` is unscoped only because `Order.CompanyID` doesn't exist yet — S1 adds it; the
  global-scope rule applies there the moment S1 lands (S1 plan gains this as a checklist row).
- On ratification this table is promoted to the element doctrine (design record) + a small UPD
  (mirrored acct/orders) — it's app-wide standing doctrine, not plan-local.

## 8. Execution phases

| # | What | Where | Gate |
|---|---|---|---|
| P0 | Marcelo review: this plan + Q43 + §7 table → promote §2 rule + §7 table to UPDs + design record; flip plan Active | both repos' plans | his review |
| P1 | `EditabilityPolicy` primitive + policies (JE, batch, order, payment) + `openBizDetail` policy param + export `mj-workspace-card`/`mjTip` from public-api | acct `transfer-pending/` + both apps | none — mechanical |
| P2 | Scope cleanup: remove the two double filters; "Owner" relabel; doctrine text | acct pages | P0 |
| P3 | Forms-family mockup round (ui-dev-loop) — §4 roster, base pattern + specialization; Marcelo in the loop | design-docs/ui-design/mockups/ | P0; slots before the family build-out (roadmap slice-ordering note) |
| P4 | Order-editor pilot: `RecordTab` + embedded form host + policy-driven footer (+ red-dot tabs) | orders | P3 selection |
| P5 | JE/Batch Extended-form uplift from the selected family pattern; detail panels → thin form-host mounts; batch receipt → `RecordTab` | acct | P3/P4 |
| P6 | Convert-on-touch continues for legacy editors (standing UPD-11 rule — not a scheduled slice) | both | rolling |

**Coordination:** the UI build agent is mid-flight on the UI plans — P1/P2 are safe now
(primitives + two page edits); P4/P5 sequence behind the mockup selection so the build agent
never implements against a moving family spec. Validation per TEST-PROTOCOL (tier-1 for policies
+ store; tier-4/5 presence+behavior for the surfaces), UI-FEATURE-LIST rows flip at close.

## Decisions taken (plan-local)
- `ScheduledJournalEntry` gets NO editability/policy investment (retires with MOD-17/S3).
- `shell-table.css` duplication (one copy per app) is tolerated until the transfer-pending
  extraction lands — not worth a third mechanism now.
- Bespoke detail panels are not deleted up front; they die by replacement in P5 (convert, don't
  big-bang).
