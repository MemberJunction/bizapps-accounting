# test-harnesses/api — Tier-3 (GraphQL → MJAPI)

The **thinnest, most production-like** tier: pure HTTP/GraphQL to a running **MJAPI** with
`X-API-Key` auth — the transport the Explorer UI and any external client use. The harness process
opens no DB pool and drives no browser (setup and teardown run the batching fixture as a
subprocess). The bar is **shippable MJAPI**: the harnesses assert **exact values, typed errors and
the write flow** — not just that queries are alive. Tier numbers are defined in
[`../README.md`](../README.md#tiers).

Three harnesses. All call Remote Operations through the generic `ExecuteRemoteOperation` mutation;
`full-flow-api.ts` also uses the generated create mutations, and all three read rows through
`RunDynamicView`, the read path the UI uses.

| Harness | Covers | Asserts |
|---|---|---|
| `engine-op-api.ts` | `Accounting.CreateJournalEntry` and `Accounting.GenerateJournalEntryReversal` | the success contract (EntryNumber `JE-{CompanyCode}-{FY}-{seq:000000}`, duplicate lines merged to LineCount 2); a typed logical failure INSIDE the output (UNBALANCED, while the transport succeeds); an unknown key → `UNKNOWN_OPERATION`; a reversal JE, then a second reversal refused |
| `batch-ops-api.ts` | the batch operations: `PreviewJournalEntryBatch`, `BuildJournalEntryBatch` (by company and by explicit JE IDs), `GetJournalEntryBatchApprovalState`, `RecordJournalEntryBatchDecision` (approve and reject), `DispatchJournalEntryBatch`, `RegenerateJournalEntryBatch` (all `Accounting.*`) | preview totals netted to 600/600 and out-of-order skips; build netted to 600 (not the gross 800) with the approval Task stamped on the batch; approve → dispatch → Posted with a `MOCK-` ref; reject → Cancelled and the JE back in the pool; a stale selection refused; regenerate re-gathers a late JE in the same batch (161 = 50 + 111); an empty build fails loudly |
| `full-flow-api.ts` | the demo journey on one fresh company | company create (IS-A parent with the same UUID, chart EMPTY on create), AR + Revenue accounts created, three JEs (merge shape), preview → build (600/600) → approve → dispatch → JEs read back GLPosted, then dimension-split consolidation on the persisted summary JE (AR×SALES 140, AR×MKTG 60, Revenue 200, exactly 3 lines) |

Complements the sibling tiers (`../README.md`): `server/` proves the engine/hooks/triggers against a
live DB; `playwright/` drives the Explorer UI. This tier proves the **operation → GraphQL contract**.

## Auth

User **API-key** path: the request carries an **`X-API-Key: mj_sk_…`** header (the path MJServer's
`context.ts` resolves a user from). The harness takes the key from `MJ_API_KEY`; if that is unset it
runs `mjdev key <slug>` and keeps the last `mj_sk_` line. That fallback calls the mjdev launcher at
an absolute path fixed in each harness (`MJDEV_LAUNCHER`), so on any other machine set `MJ_API_KEY`.

This is a user key, not MJAPI's system key. `packages/IntegrationTests` uses the same variable name
for the system key.

| Variable | Default | Used for |
|---|---|---|
| `MJ_API_URL` | `http://localhost:4180` | MJAPI's base URL; GraphQL is posted to `/` |
| `MJ_API_KEY` | minted with `mjdev key <slug>` | the user API key |
| `MJDEV_SLUG` | `accounting-revamp` | the slug passed to `mjdev key`, and named in the fix hint a bootstrap error prints |

## Prerequisites

- **An mjdev instance.** Each harness runs `node_modules/.bin/tsx` and the batching fixture at
  `packages/dev-apps/bizapps-accounting/test-harnesses/playwright/lib/batching-fixture.ts`, both
  relative to the working directory, so run it from the instance's MJ worktree root.
- **MJAPI up.** Each harness does a GET readiness preflight and exits `2` if MJAPI is unreachable —
  it never starts servers.
- `engine-op-api.ts` and `batch-ops-api.ts` run the batching fixture to create an ISOLATED throwaway
  company (CFO + three balanced Pending JEs), drive the flow, then tear it down (always, in
  `finally`). `full-flow-api.ts` creates its company over the wire and tears it down with the same
  fixture. None of them changes the demo companies.
- `full-flow-api.ts` needs an existing dimension with at least two values; `server/seed-demo.ts`
  seeds them.

## Run

From the instance's MJ worktree root:

```bash
export MJ_API_KEY=<user key>    # `mjdev key <slug>` prints one (the mj_sk_ line)
npx tsx packages/dev-apps/bizapps-accounting/test-harnesses/api/engine-op-api.ts
npx tsx packages/dev-apps/bizapps-accounting/test-harnesses/api/batch-ops-api.ts
npx tsx packages/dev-apps/bizapps-accounting/test-harnesses/api/full-flow-api.ts
```

Prerequisites for every tier: [`../README.md`](../README.md#prerequisites-and-credentials).

## Exit codes

`0` all passed · `1` assertion failures · `2` bootstrap/connection error. Pure HTTP, so the process
exits on its own — no DB-pool-close machinery (that exists in `server/` only because the MJ pool can
hang on close; irrelevant here).

## engine-op-api.ts — 'Accounting.CreateJournalEntry' over `ExecuteRemoteOperation`

The A5 "runs on local" proof: the SAME typed op the server runs in-process is invoked over pure
HTTP/GraphQL (`mutation ExecuteRemoteOperation(operationKey, inputJSON, invokeMode)`) with an
X-API-Key. Asserts the exact success contract (EntryNumber `JE-{CompanyCode}-{FY}-{seq}`, merged
LineCount), a typed logical failure INSIDE the output (UNBALANCED — transport stays green), the
registry gate (unknown key → UNKNOWN_OPERATION), and `Accounting.GenerateJournalEntryReversal`
(a reversal JE comes back; a second reversal is refused). Uses the batching fixture for an isolated
company.
