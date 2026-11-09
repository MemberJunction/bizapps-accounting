# @mj-biz-apps/accounting-integration-tests

GraphQL-wire suite. The checks register with MJ's integration-check registry
(`@memberjunction/testing-integration`) and `packages/IntegrationTests/integration.mjs` runs them against a
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
| `acct-isa` | I1–I8 | MJ's IS-A machinery on `AccountingCompanyProfile` IS-A `MJ: Companies`. |

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
- **Environment files.** `integration.mjs` loads the repo root `.env` if present, then `../MJ/.env`
  if a sibling MJ checkout exists beside this repo; the client also loads `.env` from the working
  directory. A value is never overwritten once set, so the environment wins over the repo `.env`,
  which wins over `../MJ/.env`.
- **The package built**: `integration.mjs` imports `./dist/index.js`.
- **Module resolution.** `integration.mjs` lives inside `packages/IntegrationTests`, which declares
  `dotenv`, `@memberjunction/core` and `@memberjunction/testing-integration`, so it runs in a
  standalone clone after `pnpm install && pnpm run build`.
- **Data**: the ORD-WORLD companies (run the orders suite's `catalog-world.CW1` first) and a Pending
  JE for `BCP` (book an order or post a Pending JE).

The runner sets `MJ_INTEGRATION_TEST=1` and defaults `RUN_MUTATION_TESTS` to `1`. When
`RUN_MUTATION_TESTS=0`, checks marked `RequiresMutation` are skipped and printed as `skip`.

## Run

From the repo root:

`acct-isa` needs no world data, only a shipped currency. Each check creates its own Company and inactive
profile (named `ISA fixture <check> <run>`, coded `ISA-<check>-<run>`) and deletes them when it ends.
It covers promotion (`AttachToParent`), the whole-chain create, child discovery, the joined view, a
Company edit through the profile, the rollback of a failed profile write, and both deletes. I7
records MJ's current rule that deleting a profile deletes its Company. A delete that runs past 30
seconds fails its check instead of hanging the run (MJ#4850).

```bash
pnpm run build                                       # or: pnpm --filter @mj-biz-apps/accounting-integration-tests build, once its dependencies are built
pnpm run test:integration                            # node packages/IntegrationTests/integration.mjs — every bundle
node packages/IntegrationTests/integration.mjs acct-world acct-batch   # chosen bundles
node packages/IntegrationTests/integration.mjs acct-isa         # one bundle; acct-isa.I3 runs one check
node packages/IntegrationTests/integration.mjs acct-world.AW3          # one check
RUN_MUTATION_TESTS=0 pnpm run test:integration       # skip mutating checks
GRAPHQL_PORT=<port> pnpm run test:integration        # MJAPI on another port
```

The run prints one line per check and exits `1` if any check fails.

The `test-harnesses/server/` scripts talk to SQL in-process, through the server data provider, and
cover DB invariants, triggers and engines at depth. This package covers a few checks over the GraphQL
client path.
