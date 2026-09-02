# Cash position accounts (N bank GL accounts per company)

**Status:** Schema landed in [bizapps-accounting#115](https://github.com/MemberJunction/bizapps-accounting/pull/115). Engine follow-up (tie-guard skip, `ROLE_NOT_SINGULAR`, `ResolveLinkedAccounts`) is this PR.  
**Decision:** BA-D34  
**Does not change:** payment posting or the meaning of role **Cash**. `ResolveLinkedAccount` now *refuses* Many roles rather than picking a bank.

FP&A opening cash is a **rollup of every bank / cash GL account the company holds**, not the single account Orders posts a receipt into. Accounting already almost has this (`GLAccountRole` + company-level `GLAccountLink`). The missing piece is **cardinality**.

---

## The problem

`GLAccountRole` **Cash** (ID `C00A0D5B-C267-4D38-A384-20BE6FB813E4`) is documented as:

> Cash / bank account the money lands in (payment-time entries).

`GLAccountLinkEntityServer` (BA-D32) refuses two Active links for the same `(EntityID, RecordID, GLAccountRoleID, company, StartedAt)`. That is correct for **resolution**: `ResolveLinkedAccount` returns **one** account, and a tie would still balance.

A company with operating, payroll, and money-market accounts cannot hang all three on **Cash** without either:

- breaking the tie guard, or
- making payment capture pick an arbitrary bank.

Those are two different questions:

| Question | Role | Cardinality | Consumer |
|---|---|---|---|
| Where does a receipt **post**? | `Cash` | **One** | Orders / payments (`ResolveLinkedAccount`) |
| What **is** cash for a position / forecast? | `BankAccount` (new) | **Many** | FP&A `CashBalance`, later treasury views |

---

## Proposed shape

### 1. Cardinality on the role

```text
GLAccountRole
  …existing columns…
  Cardinality NVARCHAR(10) NOT NULL DEFAULT 'One'   -- One | Many
  CHECK (Cardinality IN ('One', 'Many'))
```

- **`One`** (default, all existing roles including **Cash**): tie guard stays. `ResolveLinkedAccount` stays. Latest `StartedAt` wins among overlapping One-links.
- **`Many`**: tie guard **does not apply**. `ResolveLinkedAccount` **refuses** this role (it cannot honestly return one account). A new `ResolveLinkedAccounts(role, record, asOf, forCompanyID) → GLAccount[]` returns every Active link whose window covers `asOf`.

Existing roles seed `Cardinality = 'One'`. No behavior change for Orders.

### 2. New role `BankAccount`

```text
Name:        BankAccount
Description: Cash / bank GL account that counts in the company's cash position.
             Many per company; date-effective. Not used for payment posting.
Status:      Active
Sequence:    15          -- next to Cash (10)
Cardinality: Many
```

Company-level links: `EntityID` = `__mj.Company` (or `AccountingCompanyProfile` — same UUID), `RecordID` = the company ID, `GLAccountID` = that bank account. N Active rows, possibly overlapping windows (a new account added mid-year).

Accounts linked here must belong to the same company (existing cross-company hard-block still applies).

### 3. What FP&A reads

At `AsOf`:

```text
CashBalance.Amount
  = SUM(GLAccount balance or ERP feed)
    for each Active BankAccount link on the company
    whose [StartedAt, EndedAt] covers AsOf
```

Phase 1 FPNA stores the **rollup** on `CashBalance`. Drill-by-account is a later `CashBalanceLine`. World-000 may seed the total directly so the FPNA suite does not block on this PR landing.

### 4. What we will not do

- Will **not** allow N **Cash** links. Payment routing stays One.
- Will **not** invent a parallel “cash accounts” table in accounting. Links are the mapping; `GLAccount` is the account.
- Will **not** use `BankAccount` from `ResolveLinkedAccount`. A guessed single bank still balances — the same invisibility BA-D27/D28 exist to prevent.

---

## Implementation notes

1. ~~Migration: `Cardinality` column + CHECK + default `'One'`.~~ #115
2. ~~Metadata: existing roles unchanged except the new column; add `BankAccount` row.~~ #115
3. `GLAccountLinkEntityServer.checkNoAmbiguousTie`: return early when the role’s `Cardinality = 'Many'`.
4. `AccountingEngineBase.ResolveLinkedAccount`: if role is Many, typed error (`ROLE_NOT_SINGULAR`), never an arbitrary row.
5. New `ResolveLinkedAccounts` on the engine cache (same cache citizens as links today).
6. One integration check: company with two `BankAccount` links + one `Cash` link; resolve Cash → the settlement account; resolve BankAccount set → both; posting still uses Cash.

---

## What FP&A actually consumes from accounting

Confirmed against the locked FPNA schema (`bizapps-fpna` PR #3, spec Rev 4).
Three items; only the first asks anything new of this repo.

| # | Item | Asks anything of accounting? |
|---|---|---|
| **A-1** | **`GLAccountRole` = `BankAccount`, cardinality Many** — this PR. FPNA sums Active `BankAccount` links on the company as of `AsOf` to populate `CashBalance.Amount`. | **Yes — this PR.** Not an MVP blocker (see below), but production `CashBalance` is wrong without it |
| **A-2** | **`AccountingCompanyProfile.FunctionalCurrencyCode`** as the single source of a company's currency. FPNA resolves every line's `CurrencyCode` from it and refuses a line that disagrees. | **No** — already `CHAR(3) NOT NULL`, FK to `Currency(Code)` |
| **A-3** | **`Currency(Code)` as a seeded, stable lookup.** All ten FPNA tables carrying money now hard-FK to it, joining the six accounting columns that already do. | **No** — recorded so accounting knows FPNA is now a consumer |

**Explicitly NOT requested, now or in Phase 1:** spot-rate tracking over time,
hedging, mark-to-market, revaluation, reporting-currency translation. FPNA
carries no `FunctionalAmount` and no `FXRate`; a mixed-currency line set is
refused rather than converted, because accounting **D16** defers all FX
computation upstream to Orders/Payments and orders **MOD-4** defers its
currency columns entirely — so nothing upstream can supply a rate today.
`CurrencySpotRate` exists here, has no FPNA reader, and should not grow one
on FP&A's account. Per-entity functional currency (A-2) is the whole of the
currency surface Phase 1 wants.

### Answering this PR's test plan

- **"Confirm we are not allowing N `Cash` links."** Confirmed, and FPNA
  depends on it staying that way. FPNA never reads role `Cash`; it sums
  `BankAccount`. Orders' payment routing needs `Cash` singular, and the
  BA-D32 tie guard is what keeps it so.
- **"Confirm FPNA can seed `CashBalance` totals in world-000 without this
  PR having landed."** Confirmed. `CashBalance` carries `Source`
  (`ERP | Manual | World | SubledgerRollup`); world-000 seeds `Source='World'`
  with the total directly, and `CashBalanceLine` (the per-GL-account drill)
  stays empty in the MVP. So the FPNA suite does not block on this PR, and
  this PR does not block the FPNA baseline. Production is the case that
  needs A-1 — `Source='SubledgerRollup'` has no correct answer without it.

**The FPNA schema is now locked** (Rev 4), which clears the "once the FPNA
schema is locked" precondition this PR's summary set for its own
implementation phase.

---

## Provenance

Amith 2026-08-27, from FP&A cash-schema review: opening cash is N bank accounts rolled up; payment Cash role must stay singular (BA-D32 tie guard). Companion: `bizapps-fpna` `plans/schema-cash.md` §6.
