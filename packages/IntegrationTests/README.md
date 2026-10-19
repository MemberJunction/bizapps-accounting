# @mj-biz-apps/accounting-integration-tests

GraphQL-wire suite. The checks register with MJ's integration-check registry
(`@memberjunction/testing-integration`) and `test-harnesses/integration.mjs` runs them against a
running MJAPI, through MJ's GraphQL client. It is tier 3 in
[the tier list](../../test-harnesses/README.md#tiers), next to the `test-harnesses/api/` harnesses.
CI does not run it: the root `pnpm run test` filters this package out.

Currencies, GL roles, and JE types are **looked up** from shipped metadata. Accounts and companies
come from the committed world of the bizapps-orders integration suite (ORD-WORLD): its
`catalog-world.CW1` check creates the Accounting Company Profiles.

| Bundle | Checks | What it does |
|---|---|---|
| `acct-world` | AW1–AW3 | AW1: shipped currencies and GL roles are visible. AW2: JE types and Accounting Company Profiles are visible, and the GL account read succeeds. AW3: stamps `ApprovalCFOUserID` on every active company (writes). |
| `acct-ledger` | AL1 | RunView of Journal Entries over GraphQL. |
| `acct-batch` | AB1 | Previews batch candidates for the world's `BCP` company. |

`acct-world.AW3` stamps `AccountingCompanyProfile.ApprovalCFOUserID` to the current user on every
active company — or, when the run authenticates as MJ's system user, to an MJ user whose email is
not a system address, so an Explorer login can approve. The batching gate hard-fails without that
field (`No CFO configured for company…`).
`acct-batch.AB1` previews pending JE candidates over `Accounting.PreviewJournalEntryBatch` and does
**not** build batches (that would consume booked order entries). It needs `acct-world` in the same
run, because it reads the companies AW3 stamped, and at least one Pending JE for `BCP`.

## Prerequisites

- **MJAPI running.** The client posts to `MJAPI_URL`, else
  `http://localhost:<GRAPHQL_PORT><GRAPHQL_ROOT_PATH>` (defaults `4000` and `/`); `MJAPI_WS_URL`
  overrides the subscription endpoint. A preflight fails fast if MJAPI does not answer.
- **`MJ_API_KEY` = the running MJAPI's system API key** (MJAPI reads its own `MJ_API_KEY`). The
  client sends it as `x-mj-api-key`, and MJAPI authenticates the run as its system user. This is not
  the user key (`mj_sk_…`) the `test-harnesses/api/` harnesses send under the same variable name.
- **Environment files.** `integration.mjs` loads the repo root `.env`, then `../MJ/.env` (an MJ
  checkout beside this repo); the client also loads `.env` from the working directory. A value is
  never overwritten once set, so the environment wins over the repo `.env`, which wins over
  `../MJ/.env`.
- **The package built**: `integration.mjs` imports `packages/IntegrationTests/dist/index.js`.
- **Module resolution.** `integration.mjs` imports `dotenv`, `@memberjunction/core` and
  `@memberjunction/testing-integration`, which the root `package.json` does not declare. They resolve
  only when a parent folder's `node_modules` provides them, as in the multi-repo layout that
  `../MJ/.env` assumes.
- **Data**: the ORD-WORLD companies (run the orders suite's `catalog-world.CW1` first) and a Pending
  JE for `BCP` (book an order or post a Pending JE).

The runner sets `MJ_INTEGRATION_TEST=1` and defaults `RUN_MUTATION_TESTS` to `1`. It runs every check
in the bundles it is given and does not skip checks marked `RequiresMutation` (all five are), so
setting `RUN_MUTATION_TESTS=0` does not make a run read-only.

## Run

From the repo root:

```bash
pnpm run build                                       # or: pnpm --filter @mj-biz-apps/accounting-integration-tests build, once its dependencies are built
pnpm run test:integration                            # node test-harnesses/integration.mjs — acct-world, acct-ledger, acct-batch
node test-harnesses/integration.mjs acct-world acct-batch   # chosen bundles
node test-harnesses/integration.mjs acct-world.AW3          # one check
GRAPHQL_PORT=<port> pnpm run test:integration        # MJAPI on another port
```

The run prints one line per check and exits `1` if any check fails.

The `test-harnesses/server/` scripts talk to SQL in-process, through the server data provider, and
cover DB invariants, triggers and engines at depth. This package covers a few checks over the GraphQL
client path.
