# ActionPlan - UI: Unified view-edit primitives, forms boundary, scope model

> **Status:** Active (2026-07-21 — Marcelo delegated the P0 rulings to technical determination,
> then same-day discussion CORRECTED the plan: form = simple edits + detail viewing, workspace =
> creation + advanced edits; NO invented edit-gating (MJ research verified no state-conditional
> lock exists — we ride EditMode + metadata + triggers); §7 scope model WITHDRAWN pending his
> dedicated scope planning message. UPD-7/UPD-14 amended in place the same day. P3's mockup
> round remains Marcelo-involved; the criteria form-idiom restyle is his mockup call.)
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

**The split (Marcelo-refined 2026-07-21):**

- **The MJ entity form** (full-page, dialog, or slide-in — always through `openBizDetail`; never
  raw `MJFormPresenterService` calls in pages) is the home of **detail VIEWING + simple edits on
  one record**. Children are *visible* through the form's related grids — which natively
  navigate, not edit (research-verified: generated related-entity grids are navigation grids;
  inline child editing is custom wiring we are NOT committing to). The form that renders is the
  entity's `*Extended` form, so depth (lines view, timelines, trees) comes from the form family
  (§4), not from bespoke panels.
- **The workspace is the home of CREATION and advanced edits** (anything multi-record,
  line-level, or process-shaped). Process surfaces (criteria → preview → commit,
  remote-op-backed) are always workspaces — the form host has no record to bind mid-flow: JE
  workspace (`Accounting.CreateJournalEntry`), batch workspace (`PreviewBatch`/`BuildBatch`),
  payment capture, product/category workshops.
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

**How gating works — MJ's shipped machinery only, nothing invented (Marcelo ruling + research,
2026-07-21).** The 2026-07-21 MJ research verified: MJ ships per-field static ReadOnly
(metadata `AllowUpdateAPI`/PK/special — a ReadOnly field never renders editable), a form-wide
`EditMode` (+ `StartInEditMode`), a permission-gated Edit button, and layered validation
(`Validate()` incl. CHECK-derived rules → server `ValidateAsync` → DB constraints/triggers) —
and **no record-state-conditional lock anywhere**. So:

- **The DB immutability triggers are the sole enforcement authority** (already true — that's
  their design: sa-level writes can't violate them). The UI never becomes an enforcement layer.
- **The only UI addition is a few lines inside the `*Extended` forms we already own:** derive
  the form's `EditMode`/Edit-button visibility from the record's status (JE: Pending →
  editable, Batched+ → read-only; batch: Pending → editable, Approved+ → read-only; order/
  payment mirror their triggers), and render the state's REAL verbs (Generate reversal /
  Cancel / Refund) instead of a disabled Save. This is standard custom-form code (override
  `StartEditMode`/set `EditMode`), not a system.
- **Explicitly NOT built:** no `EditabilityPolicy` primitive, no new entities, no metadata
  invention, no per-field state whitelists (MJ's EditMode is form-wide; a partial-lock field
  matrix isn't worth custom machinery — the server rejects what the trigger forbids, and the
  form surfaces the error). If MJ ever ships state-conditional editability upstream, we adopt it.

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
- **Footer verbs derive from tab kind + record state:** Draft → Confirm/Keep-as-draft/Discard
  (as today). Record, editable state → Save / Discard-changes. Record, locked state → no save;
  the state's real verbs render instead. One card, one action bar, labels vary — exactly the
  standardization the card was built for.
- **Where "open in workspace" comes from (Marcelo-confirmed):** list rows get "peek" (slide-in
  via `openBizDetail`, unchanged) and a **pop-out that opens the existing JE / order / batch in
  its workspace** as a record tab — the workspace being the advanced-edit home, the form the
  simple one.
- Order editor is the pilot (UPD-11.3 + Matt's tab-completeness concern lands here); JE
  workspace follows (a record tab on a Pending JE = edit; on a Batched JE = locked view w/
  Generate reversal). The exact composition (how much of the tab body is the hosted entity form
  vs the workspace's own editors, e.g. the line grid) is a P3/P4 design decision with Marcelo —
  he flagged real convergence potential BOTH ways (elements of the extended JE form into the
  workspace, workspace elements as the standard).

## 6. "Batch using a form" — pinned definition (Q43, proceeding)

The batch workspace does NOT map to "edit a JournalEntryBatch record" — it's criteria → preview →
build over remote ops, and the element doctrine already ruled it a workspace. Proposed reading
(Marcelo confirms via [Q43](../QUESTIONS.md#q43)):

- **(a) MAYBE — the criteria panel adopts the form idiom:** Marcelo judges the mockup
  (`form-look-strip` artifact, 2026-07-21); explicitly skippable with zero downstream cost —
  it's a restyle, nothing depends on it.
- **(b) YES — the BUILT/existing batch is form territory:** a new `JournalEntryBatch`
  `*Extended` form (per-company summary, line items VIEW, approval timeline, dispatch state)
  renders everywhere a batch is viewed or simply edited — list detail, post-build receipt tab,
  approval context — with §3 gating (Pending = editable, Approved+ = locked + status verbs).
  **Child-JE SELECTION inside the batch form is an AUDIBLE** (Marcelo 2026-07-21) — not
  committed; if called, it's custom `*Extended` wiring, and the workspace remains the primary
  membership-editing home.
- **(c) NO — the build orchestration itself is never re-modeled as an entity form.**

## 7. Company scope — WITHDRAWN from this plan (2026-07-21)

The scope model originally drafted here (global-scope-vs-local-filter authority per surface) was
**wrong per Marcelo**: the global scope is not query filtering — *"selecting two companies should
make the frontend work as if the other companies don't exist — no filter options, no dropdowns,
nothing."* That is a pervasive frontend-existence model, and he will define it in a **dedicated
scope planning message**. Until that pass: no scope doctrine, no scope code changes from this
plan. (The as-built survey's per-screen scope table remains useful raw material for that pass —
it lives in the 2026-07-21 survey results referenced in the header.) UPD-7 item 3 / UPD-14 item 3
carry the same withdrawal.

## 8. Execution phases

| # | What | Where | Gate |
|---|---|---|---|
| P0 | ✅ DONE 2026-07-21 — Marcelo delegated to technical determination; §2+§7 promoted to acct UPD-7 / orders UPD-14 + design record; plan Active; Q43 answered on the same basis | both repos' plans | — |
| P1 | State→`EditMode` wiring inside the existing `*Extended` forms (JE, GLAccount; batch/order/payment as their Extended forms are born in P5) + real state verbs + export `mj-workspace-card`/`mjTip` from public-api. NO new primitive (2026-07-21 rework). | both apps | none — mechanical |
| P2 | ~~Scope cleanup~~ **WITHDRAWN** — awaits Marcelo's dedicated scope planning pass (§7) | — | his scope message |
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
