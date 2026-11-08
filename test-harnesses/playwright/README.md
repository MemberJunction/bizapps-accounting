# playwright/ — kept GUI end-to-end harness (bizapps-accounting)

Tier 5 (tiers are defined in [`../README.md`](../README.md#tiers)). Drives the **instance's**
MJExplorer (this repo bundles no host apps) with **system Chrome**, headless, via Playwright. It
validates the Explorer UI **presence AND behavior** for the Accounting app — the dual-layer protocol:
a control renders AND clicking it drives the real engine and reflects state. This is a living
regression asset: committed and re-run on every substantive UI change. It is **self-exiting**
(Playwright closes the browser and exits; nothing lingers) and **re-runnable** (idempotent — the
specs provision + tear down their own throwaway company).

## What it covers

Every spec logs in through the magic link, navigates by clicking the real app switcher and rails
(the way a user does), and **fails on any captured `console.error` / `pageerror`** — the keystone
that catches silent UI bugs (`captureConsoleErrors` / `expectNoConsoleErrors` in `lib/explorer.ts`).
Specs that create data run `lib/batching-fixture.ts` in `beforeAll` (a throwaway company with a CFO
and three balanced Pending JEs) and tear it down in `afterAll`.

| Spec | Flow |
|---|---|
| `specs/accounts-manage-newnav.spec.ts` | All accounts: create → rename → identity-lock rejection through the real editor, on the fixture company. Dimensions + Chart of accounts pages render the demo reference data (read-only; needs `server/seed-demo.ts`). |
| `specs/batch-approvals-newnav.spec.ts` | Build in the JE batch workspace → JE batch approvals → **Approve** → **Dispatch** → the UI confirms the batch reached **Posted** (mock ERP poster). |
| `specs/batch-reject-newnav.spec.ts` | Build → **Reject** → the UI confirms the batch was cancelled and its JEs returned to the candidate pool. |
| `specs/batch-regenerate-newnav.spec.ts` | Build → a late JE lands (`batching-fixture.ts add-je`) → **Regenerate** re-gathers it (600 → 711 netted) → Reject returns the pool. |
| `specs/company-create-newnav.spec.ts` | New company opens MJ's generated company-profile form with its required fields; Cancel closes it and leaves the roster unchanged. The save itself is not exercised (a waived gap, see `../testing.md`). |
| `specs/je-create-newnav.spec.ts` | JE workspace: a balanced 2-line draft → Create entry → the Pending JE is confirmed and listed. |
| `specs/je-reversal-newnav.spec.ts` | Build → approve → dispatch, then **Reverse** a GLPosted JE from All journal entries. |
| `specs/je-effective-date-business-day.spec.ts` | A JE workspace opened just after midnight Eastern on 1 September defaults its posting date to 31 August (the business zone, Central). Its header says it has never been run. |

`shell-smoke.ts` is a standalone `tsx` smoke, not a Playwright spec (`testDir` is `./specs`): it walks
the five category nav items with the same keystone, and takes a magic-link URL as its argument.

> **Gate semantics.** The CFO gate (`TasksAppApprovalGate`) hard-fails the **build** when the
> company has no `AccountingCompanyProfile.ApprovalCFOUserID`; lets only that user record an approval
> decision; refuses the user who built the batch (separation of duties); and blocks the **dispatch**
> until a terminal Approved decision exists on the batch's approval Task. The batching fixture makes
> the instance's Owner user the CFO. The batch specs build and decide as the one browser user the
> magic link signs in. The "no CFO configured → build hard-fails" guard is covered at tier 2
> (`test-harnesses/server/phase2-encapsulation.live.test.ts`, L12).

## Prerequisites (start the services out-of-band)

The harness does **not** start servers; `lib/global-setup.ts` asserts they're up and fails with the
exact fix command if not. It needs:

- **An mjdev instance.** The specs run the fixture with the nearest `node_modules/.bin/tsx` above the
  repo, and `lib/env.ts` gets the launcher from `MJDEV_BIN`, else the nearest `bin/mjdev` above the
  repo, else `mjdev` on `PATH` (`../harness-paths.mts`).
- **MJAPI and MJExplorer running** for the instance:

  ```bash
  mjdev run <slug> api        # MJAPI       (mjdev-assigned port)
  mjdev run <slug> explorer   # MJExplorer  (mjdev-assigned port — wait for it to compile/serve)
  ```

- **Google Chrome** at `/Applications/Google Chrome.app` — the macOS path `global-setup` checks. The
  harness never downloads a Playwright browser.
- **The demo seed** (`server/seed-demo.ts`) for the accounts spec's read-only checks.

`lib/env.ts` reads the live MJAPI/MJExplorer ports from `mjdev ps <slug> --json` by process label, so
it drives **this instance's** services. Environment overrides:

| Variable | Default |
|---|---|
| `MJDEV_SLUG` | `bizapps-accounting-dev` |
| `MJAPI_PORT` | the port `mjdev ps` reports for MJAPI, else `4000` |
| `MJEXPLORER_PORT` | the port `mjdev ps` reports for MJExplorer, else `4200` |
| `MJDEV_BIN` | the nearest `bin/mjdev` above the repo, else `mjdev` on `PATH` |

> ⚠ **Known mjdev bug (the fix belongs on the mjdev side, not here):**
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
> `mjdev ps <slug>` → `mjdev kill <api-id>` → `mjdev run <slug> api`.

## Run it

From this folder (inside the instance, `test-harnesses/playwright` under
`packages/dev-apps/bizapps-accounting`):

```bash
npx playwright test                                      # all specs, serial, 1 worker
npx playwright test specs/batch-reject-newnav.spec.ts    # one spec
npx playwright show-report                               # open the HTML report after a run
```

Playwright and tsx resolve from the instance's hoisted `node_modules`. This folder is not a pnpm
workspace package (`pnpm-workspace.yaml` lists only `packages/*`), so `pnpm install` does not install
them. If `npx playwright` can't find the binary from here, run the instance worktree root's
`node_modules/.bin/playwright test` from this folder.

**Do not run this concurrently** with another harness or a build against the same instance — these
are heavy live-instance e2e tests sharing ONE Explorer + ONE instance DB, and the batch specs
mutate batch/JE state (the config pins `workers: 1`; keep cross-harness runs serial too).

## Auth (how the harness logs in)

`mjdev explorer-url <slug>` mints an MJ **magic-link** URL
(`http://localhost:<explorer-port>/#token=<JWT>`). `global-setup` mints it ONCE per run and writes it
to `../test-auth/magic-link.txt` (gitignored); every spec opens that URL first to authenticate its own
fresh browser context. The magic-link session is **not** capturable via Playwright `storageState`
(it lives in sessionStorage / in-memory), but the **same token is reusable across contexts** within
its ~8h validity (`lib/auth.ts`). The session belongs to whichever user mjdev mints the link for.

If a run fails at auth with an expired token, just re-run — `global-setup` re-mints each run.

## Auth artifacts (gitignored)

Everything the harness writes for auth lives under `../test-auth/` and is **gitignored** (the
`.gitignore` covers `test-harnesses/test-auth/*` and the playwright run-output dirs). See
`../test-auth/test-auth.md` for the contract. The harness only needs `magic-link.txt`; the batching
fixture creates its throwaway company at runtime, makes the instance's Owner user its CFO, and
removes the company in `afterAll`, so no persisted persona file is required.

## Files

| Path | Role |
|---|---|
| `playwright.config.ts` | System Chrome (`channel:'chrome'`), serial (1 worker), generous timeouts, HTML+list report. |
| `lib/global-setup.ts` | Preflight: verify the Chrome binary, MJAPI+Explorer reachable, mint the magic link, assert the Accounting app is in client metadata (catches the stale-MJAPI trap). |
| `lib/env.ts` | Slug/ports/paths/nav-labels/demo-company IDs (env-overridable). |
| `lib/auth.ts` | Mint + reuse the magic link; `loginViaMagicLink(page)`. |
| `lib/explorer.ts` | The **keystone** console-error capture + app/nav navigation + grid readers. |
| `lib/batching-fixture.ts` | tsx server-side fixture: `setup` (throwaway company, CFO, three Pending JEs), `add-je <companyId>`, `teardown <companyId>`. |
| `lib/company-teardown.ts` | Removes a `PWCO-*` company the company-create spec created. |
| `lib/find-stale-fixtures.ts` | Lists leftover `PWBATCH-*` fixture companies from killed runs, for `batching-fixture.ts teardown`. |
| `lib/batching-scenarios-fixture.ts` | Multi-company fixture for the removed `batching-scenarios-api.ts`; nothing uses it now. |
| `specs/*.spec.ts` | The specs in the table above. |
| `shell-smoke.ts` | Standalone category-shell smoke (tsx, takes a magic-link URL). |

## Output

- `playwright-report/` — HTML report (gitignored).
- `test-results/` — traces/screenshots on failure (gitignored).
