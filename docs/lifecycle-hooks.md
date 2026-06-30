# BizApps Accounting — Lifecycle Hooks (W1–W9)

> **What this is:** the per-entity **`BaseEntity.Save()` lifecycle hooks** — the server-side logic that runs
> when an accounting record is created/changed. They live in `packages/CoreEntitiesServer/` and route every
> mutation through `BaseEntity` so `__mj.RecordChange` audits it (P1: *audit by construction*).
> **Source:** `plans/workflows-and-agents.plan.md` §2.1, **reconciled here with what's actually built + the
> current decisions** (parts of that plan predate §C1 and BA-D18, noted inline). **Updated 2026-06-29.**

**Division of labor (P2):** *DB triggers* enforce un-bypassable invariants (balance, immutability,
period-close); *hooks* orchestrate (seed, number, route, reverse, validate). A hook makes the friendly thing
happen; the trigger is the floor that catches anything — even raw SQL.

**How a hook "fires" — two kinds:**
- **Auto (in `Save()`):** the hook is an override of the entity's `Save()`. It runs **every time that entity
  is saved**, then a guard condition decides whether it acts. So the *cause* is "someone saved this entity"
  (via `Metadata.GetEntityObject(...).Save()` — UI, API, service, agent, or another hook) **and** the
  condition holds. Nothing fires it on a schedule or from the DB.
- **Explicit call:** not wired into `Save()` — it runs only when code **calls the method by name** (W6, F1).

**Status legend:** ✅ built + tested · ⚠ escalated (decision needed) · ⏳ planned (later block).

| # | Hook | Entity | What causes it to fire | How | Status |
|---|---|---|---|---|---|
| **W1** | Profile init (seed) | `AccountingCompanyProfile` | a **new** profile is saved (`!IsSaved`) | auto · `Save()` | ✅ Block 0 |
| **W2** | JE numbering | `JournalEntry` | a **new** JE is saved with **no `EntryNumber`** | auto · `Save()` | ✅ Block 0 |
| **W3** | Batch numbering | `JournalEntryBatch` | a **new** batch is saved with **no `BatchNumber`** | auto · `Save()` | ✅ Block 0 |
| **W4** | Adjusting-entry routing | `JournalEntry` | a **new** JE is saved whose target `AccountingPeriod.Status='Closed'` | auto · `Save()` | ✅ Block 1 |
| **W5** | Realized FX auto-emit | `JournalEntryLine` | n/a — generation is upstream (Orders/Payments) | — | 🚫 retired (Payments-side) |
| **W6** | Reversal generation | `JournalEntry` | code **calls `generateReversal(reason)`** | explicit call | ✅ Block 1 |
| **W7** | Period-close orchestration | `AccountingPeriod` | a save changes `Status` **`Open → Closing`** | auto · `Save()` | ⏳ Block 2 |
| **W8** | Period reopen | `AccountingPeriod` | a save changes `Status` **`Closed → Reopened`** | auto · `Save()` | ⏳ Block 2 |
| **W9** | Attachment validation | `JournalEntry` | a JE is saved with a non-null **`FileID`** | auto · `Save()` | ✅ Block 1 |
| **F1** | Routine JE validator | `JournalEntry` (read-only) | code **calls `validateJournalEntry(id)`** | explicit call | ✅ Block 1 |

---

## 1. The hooks in detail

### W1 — Profile init *(✅ `AccountingCompanyProfileEntityServer.ts`)*
**Fires:** automatically inside `AccountingCompanyProfileEntityServer.Save()`, **only on the first save of a
new profile** (the override checks `isNew = !this.IsSaved`; later saves skip it — idempotent). The cause is
"a new `AccountingCompanyProfile` was created and saved."
**Does:** the per-company setup that used to live in a stored proc — all via `BaseEntity.Save()` so every
seeded row is audited:
- Seeds the **minimal starter chart of accounts** (the **10**-account AR-subledger set — trimmed from 23 in
  Block 0, per AD-8 + §C1; the centralized intercompany accounts were removed).
- Generates the **current fiscal year's 17 periods** (12 month + 4 quarter + 1 year).
- Wires the profile's **5 default GL-account refs** (AR / Deferred Revenue / Sales Tax / Realized FX / Unrealized FX).
- Defaults **`OperatingTimeZone = 'UTC'`** (added Block 0).
- *(The old plan's "seed 4 recurring-JE templates" step is **gone** — BA-D18 dropped the `Recurring*` tables.)*

### W2 — JE numbering *(✅ `JournalEntryEntityServer.ts` + `SequenceService.ts`)*
**Fires:** automatically in `JournalEntryEntityServer.Save()` when **`isNew && !EntryNumber`** — i.e. a brand-new
JournalEntry that doesn't already carry a number. (Re-saves of an existing JE don't re-number.)
**Does:** calls the atomic DB sproc `spAssignNextJournalEntryNumber(CompanyID, FiscalYear)` (HOLDLOCK/UPDLOCK
— gap-free under concurrency) and sets `EntryNumber = JE-{CompanyCode}-{FY}-{seq:000000}` before `super.Save()`.
FY is derived from `EffectiveDate`. *(Block-0 fix: pass the sproc params to `ExecuteSQL` as a named object, not an array.)*

### W3 — Batch numbering *(✅ `JournalEntryBatchEntityServer.ts` + `SequenceService.ts`)*
**Fires:** in `JournalEntryBatchEntityServer.Save()` when **`isNew && !BatchNumber`**.
**Does:** `spAssignNextBatchNumber(CompanyID)` → `BatchNumber = BATCH-{CompanyCode}-{seq:000000}`.

### W4 — Adjusting-entry routing *(✅ `JournalEntryEntityServer.ts`)*
**Fires:** in `JournalEntryEntityServer.Save()` on a **new** JE, **only when the target `AccountingPeriodID`
points at a `Closed` period** (the hook loads the period and checks `Status='Closed'`; for open periods it does
nothing). The cause is "someone tried to post a new JE into a closed period."
**Does:** the DB trigger `trg_JournalEntry_PeriodClose` (50007) rejects **any** Closed-period JE, so W4 handles
the legitimate adjustment case:
- Closed **+ `OriginalAccountingPeriodID` not set** → **error** (must explicitly flag the adjusting-entry pattern; no silent re-route — §6/§7.5).
- Closed **+ `OriginalAccountingPeriodID` set** → **routes** `AccountingPeriodID` to the **next open period** of the same type, keeping `OriginalAccountingPeriodID` as the audit reference.

### W5 — Realized FX gain/loss *(🚫 RETIRED — handled upstream, NOT an Accounting hook)*
**Would fire:** on a `JournalEntryLine` save where the payment-currency rate differs from the original AR
booking rate.
**Would do:** auto-add the FX gain/loss line so the payment JE balances (posting to
`AccountingCompanyProfile.RealizedFXGainLossGLAccountID`).
**Why parked:** the plan put this *generation* in Accounting, but the resolved **§C1** moved all JE/line
generation **upstream** (Orders/Payments emit balanced JEs; Accounting receives them) — the same reversal
AD-5 got. **Recommendation:** the **Payments app computes + posts** the FX line; Accounting keeps the GL-ref
mechanics + validates balance (F1 / the balanced-on-lock trigger reject anything that doesn't foot).
**✅ DECIDED (2026-06-29):** Orders/Payments **computes + posts** the realized-FX line; Accounting owns only
the `RealizedFXGainLossGLAccountID` mechanics + balance validation (F1 / balanced-on-lock trigger reject
anything that doesn't foot). **W5-as-an-Accounting-hook is retired** — no Accounting-side FX generation
(consistent with §C1 + BA-D27 + Amith's keep-accounting-separate principle). Worth a one-line Amith confirm.

### W6 — Reversal generation *(✅ `JournalEntryEntityServer.generateReversal(reason)`)*
**Fires:** **only when code explicitly calls `generateReversal(reason)`** on a saved JE (e.g. from
`AccountingService.reverseJournalEntry` or the UI's "Generate Reversal"). It is **not** wired into `Save()` —
nothing auto-reverses.
**Does:** creates a **new Pending JE** — `EntryType='Reversal'` (required by `trg_JE_ReversalConsistency`
50012), every line's **Dr/Cr swapped**, `ReversesJournalEntryID =` the original — then back-references the
original's `ReversedByJournalEntryID` (the one field the immutability trigger lets change on a locked JE). The
original stays put; the audit chain is preserved (pen, not pencil).

### W7 — Period-close orchestration *(⏳ Block 2 — `AccountingPeriodEntityServer.ts`, not built)*
**Will fire:** in `AccountingPeriodEntityServer.Save()` when the save **transitions `Status` `Open → Closing`**
(i.e. an admin initiating a close).
**Will do:** validate prerequisites — no Pending JEs, all batches Acknowledged, TaxLiabilities resolved, all
due `ScheduledJournalEntry` rows materialized — then flip to `Closed`. **No balance materialization in v1**
(`AccountBalance*` deferred — AD-12); close = validate + lock only.

### W8 — Period reopen *(⏳ Block 2 — not built)*
**Will fire:** on a save that transitions `Status` **`Closed → Reopened`**.
**Will do:** require an admin role + a non-empty `ReopenReason`, write an audit entry; the period must be
re-closed after any new activity.

### W9 — JE attachment validation *(✅ `JournalEntryEntityServer.ts`)*
**Fires:** in `JournalEntryEntityServer.Save()` whenever the JE has a **non-null `FileID`** (new or update).
**Does:** verifies the `FileID` references an existing `__mj.File` (degrades gracefully if the File entity
isn't reachable in context — the DB FK is the hard guarantee).

### F1 — Routine JE validator *(✅ `JournalEntryValidation.ts` → `validateJournalEntry()`)*
**Fires:** **only when called explicitly** — `validateJournalEntry(journalEntryId, ctx)` — by an upstream
caller (the future `AccountingService`) before locking/batching. Not a `Save()` hook.
**Does:** read-only guard — checks **balanced** (±0.005), **≥2 lines**, **period open**, **GL accounts active**;
returns an aggregated error list. Hard guarantees still live in the triggers; F1 just surfaces a clean error
earlier. (`checkBalance` is exported + unit-tested.)

---

## 2. Related (not `Save()` hooks)

**Scheduled actions (S1–S7)** fire on a **cron cadence or at period close**, not on entity save — e.g. **S1
Batch dispatch** (daily; groups Pending JEs → batch → post to BC, with §C5 netting + the Tasks-app CFO
approval), **S3 Scheduled-JE materializer** (turns due `ScheduledJournalEntry` rows into Pending JEs).
*(Note: the old plan's S3/S6/S7 are framed around the dropped `Recurring*` templates — superseded by
`ScheduledJournalEntry`, BA-D18.)* All ⏳ planned (Block 2+).

**`AccountingService` façade** — the public TypeScript API downstream apps call (`postJournalEntry`,
`reverseJournalEntry` → wraps W6, `createScheduledJournalEntries`, …). Each method goes through `BaseEntity`,
so saving through it is exactly what fires W2/W4/W9 etc. ⏳ Block 2/8.

---

## Build status at a glance
- ✅ **Done (Block 0):** W1, W2, W3 · **(Block 1):** W4, W6, W9, F1 — Vitest 11/11 + live harness 12/12.
- ⚠ **Escalated:** W5 (needs the §C1 decision).
- ⏳ **Next:** W7/W8 + S1 (batching) in **Block 2**; S3 materializer in **Block 4**.

> AI agents (A1–A9, F2–F8) from the workflows plan are **out of v1 scope** (AD-14); this is the deterministic
> hook layer only.
