# test-harnesses

All of bizapps-accounting's **kept, maintained** test harnesses live here, one folder per tier.
These are living regression assets — they are committed and re-run on every substantive change
(unlike `logs/`, which is throwaway). The pure-logic **Vitest** unit suites are NOT here; they
live with their packages (`packages/*/src/__tests__/*.test.ts`, no DB) per MJ convention.

## Tiers

| Folder | Tier | Runner | Touches | What it proves |
|---|---|---|---|---|
| `server/` | Server-side integration | `tsx` scripts | a **live instance DB** through the real MJ data provider (the exact path MJAPI runs) | W*/lifecycle hooks, DB-level invariant triggers (incl. raw-SQL **bypass** proofs), numbering sprocs, RecordChange audit, batching/scheduled-JE/COA-mapping/intercompany engines |
| `playwright/` | GUI end-to-end | Playwright + **system Chrome** (`channel: 'chrome'`, headless) | the **instance's** MJExplorer (the one shipped with the instance worktree — NOT the app's relic `apps/MJExplorer`) | UI presence **and** behavior — the dual-layer protocol (a control renders AND clicking it drives the real engine and reflects state) |
| `test-auth/` | (support, **gitignored**) | — | local auth secrets only | holds the persisted browser auth profile + any persona keys the Playwright tier needs. **Contents are gitignored**; see `test-auth/test-auth.md` for what to put here. |

## Running

### server/ (live-DB integration)
Reads DB settings from the instance `.env`, so run from the **instance worktree root**
(`~/MJDev/instances/<slug>/mj`):
```bash
cd ~/MJDev/instances/<slug>/mj
npx tsx packages/dev-apps/bizapps-accounting/test-harnesses/server/block0-runtime.ts
```
Exit code: `0` all passed · `1` test failures · `2` bootstrap error. Each script self-bootstraps
(creates a throwaway company → W1 seeds COA + periods) and tears down by `CompanyID`, so runs are
idempotent. A shared `server/trigger-preflight.ts` fails fast (naming the missing/disabled trigger)
if the financial-invariant triggers aren't present + enabled — so a "bypass" test can never pass
vacuously. See `server/README.md` for the per-script matrix.

### playwright/ (GUI e2e)
Drives the **instance** Explorer (launched via `mjdev run <slug> explorer` / a magic-link session
from `mjdev explorer-url <slug>`). Uses system Chrome in headless mode and a persisted auth profile
under `test-auth/` (gitignored). See `playwright/README.md` for setup + the auth bootstrap.

> **Generated artifacts stay uncommitted.** CodeGen output (generated TS/SQL, Angular forms,
> `SQL Scripts/generated/`, `migrations/codegen/`, synced `metadata/`) is left uncommitted for the
> user's single "generated commit." Hand-written harness code here IS committed.
