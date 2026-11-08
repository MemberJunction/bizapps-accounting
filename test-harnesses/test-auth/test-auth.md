# test-auth/ — local auth artifacts for the Playwright tier (GITIGNORED)

This folder holds the **local, throwaway** authentication artifacts the `playwright/` GUI harness
needs to drive the instance's MJExplorer without logging in by hand every run. **Everything in
this folder is gitignored except this doc** (`.gitignore`: `test-harnesses/test-auth/*` +
`!test-harnesses/test-auth/test-auth.md`). Never commit secrets, tokens, or session state here.

It is intentionally empty in git. Each developer/agent (re)creates the contents locally; this doc
is the contract for what goes here and how to regenerate it.

## What goes here

| Path | What | How to (re)create |
|---|---|---|
| `magic-link.txt` | A logged-in Explorer URL with a magic-link token (`http://localhost:<explorer-port>/#token=<JWT>`), valid for about 8 hours. | Written automatically: `playwright/lib/global-setup.ts` runs `mjdev explorer-url <slug>` at the start of every `npx playwright test` run (needs MJAPI running). |

Nothing else is read or written here. `playwright/lib/env.ts` defines a `storage-state.json` path in
this folder, but no code uses it.

## How the harness consumes it
- `global-setup` creates this folder if it is missing, mints the magic link once per run and writes
  it to `magic-link.txt` (`playwright/lib/auth.ts`).
- Every spec calls `loginViaMagicLink(page)`, which opens that URL to authenticate its own fresh
  browser context. The config sets no `userDataDir` or `storageState`: the magic-link session lives
  in sessionStorage / memory, which `storageState` does not capture.
- The Explorer and MJAPI ports are not fixed. `playwright/lib/env.ts` reads them from
  `mjdev ps <slug> --json` (process labels `MJExplorer` and `MJAPI`), unless `MJEXPLORER_PORT` /
  `MJAPI_PORT` are set; it falls back to 4200 / 4000.

## Regenerating from scratch
1. `mjdev run <slug> api` and `mjdev run <slug> explorer`.
2. Run the suite (`npx playwright test` in `test-harnesses/playwright`); `global-setup` writes a fresh
   `magic-link.txt`.
3. No persona file is needed: the batching fixture creates its throwaway company at runtime and makes
   the instance's Owner user its CFO.

If auth fails mid-suite (an expired token), re-run; `global-setup` re-mints the link every run.
