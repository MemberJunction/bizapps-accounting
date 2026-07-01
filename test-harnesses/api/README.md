# test-harnesses/api — Tier-3 (GraphQL → MJAPI)

The **thinnest, most production-like** tier: pure HTTP/GraphQL to a running **MJAPI** with
`X-API-Key` auth — the exact transport the Explorer dashboards and any external client use. No DB
pool, no triggers, no browser. The bar is **shippable MJAPI**: it asserts the resolvers return the
**correct values + auth + scoping**, and that the **write flow** works — not just that queries are
alive.

Two harnesses cover all **12** API operations:

| Harness | Covers | Asserts |
|---|---|---|
| `readmodels-api.ts` | the **7 read-model queries** | REAL values over the demo seed (see below) — **28 assertions** |
| `batch-dispatch-api.ts` | the **4 mutations + the approval-state query** | the build→approve→dispatch→**reverse** state machine — **12 assertions** |

Complements the sibling tiers (`../README.md`): `server/` proves the engine/hooks/triggers against a
live DB; `playwright/` drives the Explorer UI. This tier proves the **resolver → GraphQL contract**.

## Auth

User **API-key** path: the request carries an **`X-API-Key: mj_sk_…`** header (the path MJServer's
`context.ts` resolves a user from). The harness resolves the key from `MJ_API_KEY`, or — if unset —
mints one (idempotently) via the mjdev launcher:

```bash
/Users/marcelotorres/MJDev/bin/mjdev key bizapps-accounting-dev   # prints a single mj_sk_… line
```

## Prerequisites

- **MJAPI up** for `bizapps-accounting-dev` (default `:4070`). Both harnesses do a GET readiness
  preflight and exit `2` with the fix command if MJAPI is unreachable — they never start servers.
  (The **orchestrator currently owns** the readiness check; mjdev may fold in a managed gate later.)
- `readmodels-api.ts` reads the persistent **demo seed** (company **CO1**
  `a55c0de1-0001-…0001`), populated by `server/seed-demo.ts`.
- `batch-dispatch-api.ts` is **self-provisioning** — it runs the `playwright/lib/batching-fixture.ts`
  tsx fixture to create an ISOLATED throwaway company (CFO + one balanced Pending JE), drives the
  flow, then tears it down (always, in `finally`). It never touches the demo companies.

## Run

From the **instance worktree root** (so the instance `.env` / launcher resolve):

```bash
cd ~/MJDev/instances/bizapps-accounting-dev/mj
npx tsx packages/dev-apps/bizapps-accounting/test-harnesses/api/readmodels-api.ts      # reads (28/28)
npx tsx packages/dev-apps/bizapps-accounting/test-harnesses/api/batch-dispatch-api.ts  # mutations (12/12)
```

Override the endpoint or key via env: `MJ_API_URL` (default `http://localhost:4070`),
`MJ_API_KEY` (default: minted via the launcher).

## What it asserts (REAL values, not liveness)

**`readmodels-api.ts`** — over the deterministic demo seed:
- **`AccountingTrialBalance`** foots: 4 rows, `sum(Debits) === sum(Credits) === 3920`, `sum(NetBalance) === 0`, AR net `=== 2300`.
- **`AccountingAROpenByCustomer`** — Globex 1000, Umbrella 1000, Acme 300 (sum 2300); Initech (settled) excluded.
- **`AccountingARAging`** — drift-proof invariant: each customer's buckets sum to `TotalOpen`; totals match AR-open (the exact buckets age with the calendar, so they're intentionally NOT asserted).
- **`AccountingDefRevRollforward`** — `sum(Additions) === 300`, `sum(Releases) === 120`, a period closes at 180.
- **`AccountingSalesTaxLiability`** — accrued 1500 / remitted 350 / outstanding 1150; PartiallyPaid row = 1000/650.
- **`AccountingBatchDispatchStatus`** — 4 batches, all Acknowledged.
- **`AccountingIntercompanyFlow`** — scoping: CO1 = 0 rows, CO2 = the seeded leg (EntryType `IntercompanyFlow`).

**`batch-dispatch-api.ts`** — the write flow, end to end:
`BuildJEBatch` (Success, BatchID, JECount≥1) → `JEBatchApprovalState` (Approved=false) →
`RecordJEBatchDecision('Approved')` → `JEBatchApprovalState` (Approved=true) → `DispatchJEBatch`
(Status ∈ {Sent, Acknowledged}) → `GenerateJournalEntryReversal` (a new Pending reversal JE).

## Exit codes

`0` all passed · `1` assertion failures · `2` bootstrap/connection error. Pure HTTP, so the process
exits on its own — no DB-pool-close machinery (that exists in `server/` only because the MJ pool can
hang on close; irrelevant here).
