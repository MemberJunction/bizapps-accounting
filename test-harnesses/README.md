# test-harnesses

This README is the entry point for testing bizapps-accounting. It defines the test tiers, says which
of them CI runs, and lists what each tier needs and the command that runs it.

Most of the app's **kept, maintained** test harnesses live here, one folder per tier; the table
below says where the others live. These are living regression assets — they are committed and
re-run on every substantive change (unlike `logs/`, which is throwaway). The pure-logic **Vitest**
unit suites are NOT here; they live with their packages (`packages/*/src/__tests__/*.test.ts`, no
DB) per MJ convention.

## Coverage bar — each tier fully validates its layer to a *shippable* level

The tiers are **horizontal swatches**, not a smoke ladder. The governing rule:

- **Each tier validates its layer to a shippable bar.** Green at tier N means everything that tier
  depends on (the contract it consumes from the layer below), everything it tested, and all of its
  own layer's code is trustworthy — so the **next tier up can assume any failure is in *its own*
  block, not below it.** After the whole pyramid is green you can ship; after a *single* tier is
  green you can trust *that layer* and what it sits on. (e.g. tier 3 green ⇒ "I could ship MJAPI".)
- **Overlap is intentional and useful** (it localizes failures). It does NOT mean re-testing the
  lower layer's internals: each tier validates **(a)** its own layer's behavior **+ (b)** that the
  contract it consumes from below actually holds — driven by expected behavior, use cases, and
  documented/planned functionality.
- **Liveness ≠ testing.** "The query returned an array" / "the page rendered" is NOT coverage.
  Assert **real expected values** (the trial balance foots to 3920; AR-open = 1000/1000/300 = 2300;
  tax outstanding = 1150). Where a value is inherently date-relative (AR aging buckets age with the
  calendar), assert the **drift-proof invariant** (buckets sum to TotalOpen), never a value that
  rots — but never fall back to liveness.
- **Test against the SPEC of what should exist, not just observed behavior.** A green suite cannot
  catch the absence of a thing it never checks. (Lesson: the GUI "registration" was validated by
  what the tests happened to click — nav rendered, so it looked done — while a *separate* concern
  went unasserted because nothing checked it. Validate each layer against a checklist of what
  *complete* means, not just against the paths you happened to exercise.)
- **Tier-1's boundary = the EXTRACTED pure seams.** Services deliberately extract their pure logic
  into sync exported helpers (`netLines`, `pickActiveLinkIndex`, `outOfOrderSkipCount`,
  `classifyViewEntries`, `perCompanySubtotals`, the seed constants) so it's unit-testable in isolation
  and **edge-complete** (penny-rounding, balance tolerance, zero-net drop, foots, throws) — while the
  DB orchestration around them stays at tier-2. A service that is all-async/DB correctly has **0**
  tier-1 tests; that's the layer boundary, not a gap. (The JE/batch numbering *format* lives in SQL
  sprocs → proven at tier-2 `block0`, not tier-1.)

## Tiers

These numbers are the ones [`testing.md`](testing.md), the other READMEs in this folder and the spec headers use.

| Tier | Where | Runner | Touches | What it proves | In CI |
|---|---|---|---|---|---|
| 1 | `packages/*/src/__tests__/*.test.ts` (beside each package) | Vitest; `test:types` type-checks the specs (`tsc --noEmit -p tsconfig.spec.json`) | nothing — pure logic, no DB | the extracted pure seams, edge-complete | yes |
| — | `packages/Angular/src/**/*.dom.test.ts` (beside each component) | Vitest + TestBed + jsdom (`vitest.dom.config.ts`, `test:dom`) | nothing — data access is faked per spec | a component renders and reacts correctly against controlled data, with no backend | yes |
| 2 | `server/` | `tsx` scripts, plus one Vitest suite (`server/vitest.config.ts`) | a **live instance DB** through the real MJ data provider (the exact path MJAPI runs) | W*/lifecycle hooks, DB-level invariant triggers (raw-SQL **bypass** proofs), numbering sprocs, RecordChange audit, the accounting engine, the full batch cycle, the intercompany account lookup | no |
| 3 | `api/` | `tsx` scripts | the running **MJAPI** over HTTP/GraphQL with a user API key (`X-API-Key`), the transport the UI and external clients use | Remote Operations over `ExecuteRemoteOperation` with exact values and typed errors (create, reverse, preview, build, regenerate, approve, reject, dispatch) and the demo journey on a fresh company — i.e. "could I ship MJAPI" | no |
| 3 | `packages/IntegrationTests`, run by `integration.mjs` | MJ's integration-check registry (`@memberjunction/testing-integration`) | the running **MJAPI** through MJ's GraphQL client, with MJAPI's system API key | shipped metadata and the orders integration world are readable over GraphQL; every active company gets a CFO approver; a batch preview finds candidates | no |
| 4 | `packages/Angular/test-harnesses/gui/` | Vitest + TestBed + jsdom (`vitest.gui.config.ts`, mjdev-managed; `test:gui`) | the running **MJAPI** through the real GraphQL client (port and key from `mjdev`) | components render real API data at value level, without a browser | no |
| 5 | `playwright/` | Playwright + **system Chrome** (`channel: 'chrome'`, headless) | the **instance's** MJExplorer and MJAPI (this repo bundles no host apps) | UI presence **and** behavior — the dual-layer protocol (a control renders AND clicking it drives the real engine and reflects state) | no |
| support | `test-auth/` (**gitignored**) | — | local auth artifacts only | holds the magic-link URL the Playwright tier writes each run; see [`test-auth/test-auth.md`](test-auth/test-auth.md) | — |

## CI and local runs

`.github/workflows/build.yml` is the only workflow that runs the app's tests. It runs on every
non-draft pull request to `next` or `main`, and on pushes to `next` that touch `packages/**` or
`pnpm-lock.yaml`:

```bash
pnpm install --frozen-lockfile
pnpm run build:packages
pnpm run test
```

`pnpm run test` runs tier 1, the component DOM suite and the spec type-check for every
`@mj-biz-apps/accounting-*` package except `@mj-biz-apps/accounting-integration-tests`, which the
root script filters out. A package whose `test` script only echoes a stub passes. The same job also
runs the CI guard tests in `.github/scripts/__tests__/`.

No workflow runs tiers 2–5 or `pnpm run test:integration`. They need a live database, a running
MJAPI or a browser, so they run locally.

## Prerequisites and credentials

| Tier | Needs |
|---|---|
| 1 and DOM | Node (CI uses 24; `engines` asks for 18 or later) and pnpm 10 (`packageManager`); `pnpm install` at the repo root. No database, no MJAPI. |
| 2 | an mjdev instance (below) whose database was built from migrations (MJ core, the apps this one depends on, then this app); DB credentials in the instance `.env`; packages built (the harnesses import their `dist/`) |
| 3, `api/` | an mjdev instance; MJAPI running; a user API key |
| 3, IntegrationTests | MJAPI running; MJAPI's system API key; the package built; the bizapps-orders integration world loaded; `dotenv`, `@memberjunction/core` and `@memberjunction/testing-integration` resolvable from `test-harnesses/` (details in [`packages/IntegrationTests/README.md`](../packages/IntegrationTests/README.md)) |
| 4 | an mjdev instance; MJAPI running |
| 5 | an mjdev instance; MJAPI and MJExplorer running; Google Chrome at `/Applications/Google Chrome.app` (the macOS path `playwright/lib/global-setup.ts` checks); the demo seed (`server/seed-demo.ts`) for the accounts spec |

### mjdev instance layout

Tiers 2, 3 (`api/`), 4 and 5 expect this repo checked out inside an mjdev (MJ Dev Manager)
instance, at `packages/dev-apps/bizapps-accounting` under the instance's MJ worktree root; mjdev
bugs go to `MemberJunction/MJDev`. That root holds the instance `.env` and the hoisted
`node_modules`; `bin/mjdev` sits above it. The code depends on this layout:

- the `api/` harnesses run `node_modules/.bin/tsx` and
  `packages/dev-apps/bizapps-accounting/test-harnesses/playwright/lib/batching-fixture.ts`,
  both relative to the working directory;
- `server/live-bootstrap.ts` reads the `.env` five directories above `server/`, and the Playwright
  specs run `tsx` from five directories above `playwright/`;
- `playwright/lib/env.ts` walks up from the harness to find `bin/mjdev`.

In a plain clone the harness imports (`mssql`, `@memberjunction/sqlserver-dataprovider`,
`@memberjunction/server-bootstrap-lite`, `@playwright/test` and others) are not root dependencies,
so they do not resolve from `test-harnesses/`.

The harness code calls these `mjdev` subcommands: `run <slug> api`, `run <slug> explorer`,
`ps <slug> [--json]`, `kill <id>`, `key <slug>` and `explorer-url <slug>`. Set `MJDEV_SLUG`
explicitly: it defaults to `accounting-revamp` in `api/` and tier 4, and to
`bizapps-accounting-dev` in `playwright/`.

### Credentials

Nothing in the repo holds a secret. Each credential comes from a gitignored file or from mjdev at
run time.

| Credential | Used by | Comes from |
|---|---|---|
| DB login (`DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`) | tier 2; the batching fixture that tiers 3 (`api/`) and 5 run | the instance `.env`; `intercompany-runtime.ts` reads the `.env` in its working directory (the repo root) |
| db_owner login (`CODEGEN_DB_USERNAME`, `CODEGEN_DB_PASSWORD`) | tier 2 teardown that toggles triggers or deletes locked rows; the batching fixture | the same `.env` (`harness-notes.md` lesson 4) |
| user API key (`mj_sk_…`) | `api/` (sent as `X-API-Key`) | `MJ_API_KEY`, or minted with `mjdev key <slug>` |
| user API key (`mj_sk_…`) | tier 4 | always minted with `mjdev key <slug>` |
| system API key | `packages/IntegrationTests` (sent as `x-mj-api-key`) | `MJ_API_KEY`, which must equal the running MJAPI's own `MJ_API_KEY`; read from the environment, the repo `.env` or `../MJ/.env` |
| Explorer session | tier 5 | a magic-link URL minted each run by `mjdev explorer-url <slug>` into `test-auth/magic-link.txt` |

`MJ_API_KEY` holds a user key for `api/` and the system key for `packages/IntegrationTests`, so one
value does not serve both.

## Running each tier

### Tier 1: unit, component DOM, spec types

From the repo root, after `pnpm install`:

```bash
pnpm run test                                 # what CI runs; turbo builds each package's dependencies first
cd packages/Angular && pnpm run test:dom      # the component DOM suite on its own
```

### Tier 2: server (live DB)

From the instance's MJ worktree root, where the instance `.env` is:

```bash
npx tsx packages/dev-apps/bizapps-accounting/test-harnesses/server/block0-runtime.ts   # likewise block1-runtime.ts, engine-runtime.ts
```

From the repo root:

```bash
npx tsx test-harnesses/server/intercompany-runtime.ts            # reads the .env in the repo root
npx vitest run --config test-harnesses/server/vitest.config.ts   # phase2-encapsulation.live.test.ts; reads the instance .env
```

Exit code of the `tsx` scripts: `0` all passed · `1` test failures · `2` bootstrap error. Each
harness creates its own throwaway companies and tears down what it created, so runs are
idempotent. `server/trigger-preflight.ts` fails fast, naming the trigger, if a financial-invariant
trigger is missing or disabled, so a "bypass" test can never pass vacuously. Run one harness at a
time against an instance DB ([`harness-notes.md`](harness-notes.md) lesson 2). Per-script matrix:
[`server/README.md`](server/README.md). Authoring notes: [`harness-notes.md`](harness-notes.md).

### Tier 3: API (GraphQL to MJAPI)

`api/` harnesses, from the instance's MJ worktree root with MJAPI running:

```bash
export MJ_API_KEY=<user key>    # `mjdev key <slug>` prints one (the mj_sk_ line)
npx tsx packages/dev-apps/bizapps-accounting/test-harnesses/api/batch-ops-api.ts   # likewise engine-op-api.ts, full-flow-api.ts
```

`MJ_API_URL` defaults to `http://localhost:4180`. Set `MJ_API_KEY`: without it a harness mints a
key through an mjdev launcher path fixed in its code. Exit codes as in tier 2. Details:
[`api/README.md`](api/README.md).

`packages/IntegrationTests`, from the repo root with MJAPI running:

```bash
pnpm run build                  # integration.mjs imports packages/IntegrationTests/dist
pnpm run test:integration       # node test-harnesses/integration.mjs: bundles acct-world, acct-ledger, acct-batch
```

MJAPI's address comes from `MJAPI_URL`, else `GRAPHQL_PORT` (default `4000`) and
`GRAPHQL_ROOT_PATH` (default `/`). The run exits `1` if any check fails. Details:
[`packages/IntegrationTests/README.md`](../packages/IntegrationTests/README.md).

### Tier 4: GUI DOM against MJAPI

With the instance's MJAPI running:

```bash
cd packages/Angular && pnpm run test:gui
```

The bootstrap reads MJAPI's port from `mjdev ps <slug> --json` and mints a user key with
`mjdev key <slug>`. Set `MJDEV_SLUG` and `MJDEV_BIN`: the default launcher path is fixed to one
machine. The suite resolves only inside an mjdev instance, because `@memberjunction/ng-bootstrap-lite`
is not a dependency of `packages/Angular`.

### Tier 5: Playwright

Start the services (`mjdev run <slug> api`, then `mjdev run <slug> explorer`), then from
`test-harnesses/playwright`:

```bash
npx playwright test             # all specs, serial, one worker
npx playwright show-report      # the HTML report after a run
```

`lib/global-setup.ts` checks Chrome, both services and the Accounting app, and mints the magic link;
it never starts servers. Don't run it alongside a tier-2 harness against the same instance. Details:
[`playwright/README.md`](playwright/README.md).

> **Generated artifacts:** hand-written harness code here is committed. CodeGen output is committed
> too, with the migration that produced it; see "CodeGen output must be reproducible from this repo"
> in [`CLAUDE.md`](../CLAUDE.md).
