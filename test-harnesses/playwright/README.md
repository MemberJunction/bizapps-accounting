# playwright/ — kept GUI end-to-end harness (bizapps-accounting)

Drives the **instance's** MJExplorer (the one shipped in this instance worktree — NOT the relic
`apps/MJExplorer`) with **system Chrome**, headless, via Playwright. It validates the Explorer UI
**presence AND behavior** for the Accounting app — the dual-layer protocol from
`.mjdev-docs/TEST-PROTOCOL.md`. This is a living regression asset: committed and re-run on every
substantive UI change. It is **self-exiting** (Playwright closes the browser and exits; nothing
lingers) and **re-runnable** (idempotent — the behavior spec provisions + tears down its own
throwaway company).

## What it covers

### `specs/dashboards.spec.ts` — PRIORITY 1: presence + the keystone
For the Accounting app and each surface it exposes, navigate there (by clicking the real
app-switcher + left-rail, the way a user does), assert the key element renders over the seeded
demo data, and **fail on any captured `console.error` / `pageerror`** (the keystone that catches
silent UI bugs — wired per page in `lib/explorer.ts`):

- App activates + all 9 nav items present.
- **Batch Dispatch** — a batch card with a status/approval badge.
- **Trial Balance & AR** — the trial-balance ag-grid has rows.
- **Revenue & Tax** — renders a grid or a legitimate empty-state (deferred-revenue is empty for the
  demo set by design; the keystone proves the component is healthy), plus the Sales Tax tab.
- **Batch Status** — the 4 status summary cards + the batch grid.
- **Intercompany Flow** — the leg grid has rows.
- **GL Accounts** — the MJ entity grid renders the seeded chart of accounts.
- **GL Account form** + **Journal Entry form** — double-clicking a grid row opens the record's
  detail form (record-form container with the entity's fields). Note: the JE opens in the standard
  record-form host (Details panel); the custom JE status-timeline surface (`.je-timeline`) did NOT
  render from this entity-grid open path on the current build, so the spec asserts the detail form
  + JE fields (not the timeline) — it does not claim a UI it didn't observe.

### `specs/batching.spec.ts` — PRIORITY 2: approve + dispatch BEHAVIOR (Amith's priority)
Drives the **real engine** through the Batch Dispatch GUI on a dedicated throwaway company that
`lib/batching-fixture.ts` provisions in `beforeAll` (a company with a CFO configured + one balanced
Pending JE) and tears down in `afterAll`:

1. **Build Batch** → a Pending batch appears, "Awaiting approval" (CFO gate raised an approval Task).
2. **Approve (CFO)** → the approval badge flips to **Approved** and the Dispatch button enables.
3. **Dispatch to BusinessCentral** → batch status advances to **Sent/Acknowledged** (mock ERP poster).

> **Gate semantics (honest scope).** The CFO gate (`TasksAppApprovalGate`) gates the **build** on a
> CFO being *configured* (`AccountingCompanyProfile.ApprovalCFOPersonID`), and the **dispatch** on a
> terminal Approved decision existing on the batch's approval Task. It does **not** verify the
> *decider's identity* equals the CFO. So this harness proves the build→approve→enable→dispatch
> state machine; it does **not** assert "a non-CFO is rejected at decision time", because the
> current engine does not enforce that (it would be claiming a guard that doesn't exist). The
> "no CFO configured → build hard-fails" guard IS covered by the server harness
> (`test-harnesses/server/block2-runtime.ts`).

## Prerequisites (start the services out-of-band)

The harness does **not** start servers; `lib/global-setup.ts` asserts they're up and fails with the
exact fix command if not. From the **workspace root** (`~/MJDev`):

```bash
./bin/mjdev run bizapps-accounting-dev api        # MJAPI       (mjdev-assigned port)
./bin/mjdev run bizapps-accounting-dev explorer   # MJExplorer  (mjdev-assigned port — wait for it to compile/serve)
./bin/mjdev ps bizapps-accounting-dev --json      # the harness reads the ACTUAL ports from here
```

The harness is **mjdev-native + port-agnostic**: `lib/env.ts` discovers the live MJAPI/MJExplorer
ports from `mjdev ps <slug> --json` by process label, so there are **no hardcoded ports and no
`MJAPI_PORT=` override** — it drives **this instance's** services (the `next`-based worktree
MJAPI/MJExplorer), never the app's relic `apps/MJAPI` / `apps/MJExplorer`.

> ⚠ **Known mjdev BUG (filed in MJDEV-ISSUES.md — the fix belongs on the mjdev side, not here):**
> on Angular-21 instances, `mjdev run <slug> explorer` fails because it passes `ng serve
> --no-interactive`, which Angular 21 rejects (`Unknown argument: interactive`). **Interim operator
> workaround ONLY** (until mjdev is fixed): start Explorer on the port mjdev assigned it (`mjdev ps
> <slug> --json`) — `cd packages/MJExplorer && NODE_OPTIONS=--max-old-space-size=16384 npx ng serve
> --port <mjdev-explorer-port>`. **Do not bake this into the harness** — the harness only *asserts*
> the services are up and *reads* their ports from mjdev.

> ⚠ **Stale-metadata trap (the one that blocked the first run):** if MJAPI booted **before** the
> "Accounting" app metadata was synced into the DB, MJAPI serves stale metadata and the Accounting
> app is **absent from Explorer** (no switcher entry, deep-links bounce to Home). `global-setup`
> detects this and tells you to **restart MJAPI**:
> `./bin/mjdev ps bizapps-accounting-dev` → `./bin/mjdev kill <api-id>` → `./bin/mjdev run bizapps-accounting-dev api`.

## Run it

From this folder (Playwright + tsx are resolved from the hoisted MJ workspace root, so no install is
needed inside an instance):

```bash
cd packages/dev-apps/bizapps-accounting/test-harnesses/playwright
npx playwright test                       # full suite (dashboards + batching), serial, 1 worker
npx playwright test specs/dashboards.spec.ts   # Priority 1 only
npx playwright test specs/batching.spec.ts     # Priority 2 only
npx playwright show-report                 # open the HTML report after a run
```

If `npx playwright` can't find the binary from here, invoke the hoisted one explicitly:
`../../../../../../node_modules/.bin/playwright test` (or run from the instance worktree root).

**Do not run this concurrently** with another harness or a build against the same instance — these
are heavy live-instance e2e tests sharing ONE Explorer + ONE instance DB, and the batching spec
mutates batch/JE state (the config pins `workers: 1`; keep cross-harness runs serial too).

## Auth (how the harness logs in)

`mjdev explorer-url bizapps-accounting-dev` mints an MJ **magic-link** URL
(`http://localhost:4310/#token=<JWT>`). `global-setup` mints it ONCE per run and writes it to
`../test-auth/magic-link.txt` (gitignored); every spec opens that URL first to authenticate its own
fresh browser context. The magic-link session is **not** capturable via Playwright `storageState`
(it lives in sessionStorage / in-memory), but the **same token is reusable across contexts** within
its ~8h validity — verified, not assumed. Active persona used: **Developer** (`dev@mjdev.local`),
which is an MJ Owner-equivalent full-access session for this instance.

If a run fails at auth with an expired token, just re-run — `global-setup` re-mints each run.

## Auth artifacts + personas (gitignored)

Everything the harness writes for auth lives under `../test-auth/` and is **gitignored** (the
`.gitignore` already covers `test-harnesses/test-auth/*` and the playwright run-output dirs). See
`../test-auth/test-auth.md` for the contract. Today the harness only needs `magic-link.txt`; the
batching spec creates its CFO Person + throwaway company in the DB at runtime and removes them in
`afterAll`, so no persisted persona file is required.

## Files

| Path | Role |
|---|---|
| `playwright.config.ts` | System Chrome (`channel:'chrome'`), serial (1 worker), generous timeouts, HTML+list report. |
| `lib/global-setup.ts` | Preflight: verify Chrome binary, MJAPI+Explorer reachable, mint magic link, assert the Accounting app is in client metadata (catches the stale-MJAPI trap). |
| `lib/env.ts` | Slug/ports/paths/nav-labels/demo-company IDs (all env-overridable). |
| `lib/auth.ts` | Mint + reuse the magic link; `loginViaMagicLink(page)`. |
| `lib/explorer.ts` | The **keystone** console-error capture + app/nav navigation + grid readers. |
| `lib/batching-fixture.ts` | tsx server-side fixture for the Priority-2 company (setup/teardown). |
| `specs/dashboards.spec.ts` | Priority 1 — presence + keystone. |
| `specs/batching.spec.ts` | Priority 2 — Build → Approve → Dispatch behavior. |

## Output

- `playwright-report/` — HTML report (gitignored).
- `test-results/` — traces/screenshots on failure (gitignored).
