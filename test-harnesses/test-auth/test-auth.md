# test-auth/ — local auth artifacts for the Playwright tier (GITIGNORED)

This folder holds the **local, throwaway** authentication artifacts the `playwright/` GUI harness
needs to drive the instance's MJExplorer without logging in by hand every run. **Everything in
this folder is gitignored except this doc** (`.gitignore`: `test-harnesses/test-auth/*` +
`!test-harnesses/test-auth/test-auth.md`). Never commit secrets, tokens, or session state here.

It is intentionally empty in git. Each developer/agent (re)creates the contents locally; this doc
is the contract for what goes here and how to regenerate it.

## What to put here

| Path | What | How to (re)create |
|---|---|---|
| `chrome-profile/` | Persisted system-Chrome user-data dir (MSAL/session cookies, localStorage) so auth survives between Playwright runs. | First headed run authenticates once; the profile dir is written here and reused on later headless runs. See `playwright/README.md`. |
| `session.json` | A logged-in Explorer session URL + magic-link token for a chosen persona (so a run can deep-link straight in). | `mjdev explorer-url <slug>` (mints a magic-link session; needs MJAPI running). Re-mint when it expires. |
| `personas.json` | The two persona identities the approval-gate tests need: a **CFO-role** identity (decision authority) and a **non-CFO** identity (to prove the gate *blocks*). Just IDs/emails + which is CFO — no secrets. | Provision via `mjdev persona add` / pick from `mjdev persona list`; record their IDs here. |

## How the harness consumes it
- The Playwright config points its `userDataDir` / `storageState` at `test-auth/chrome-profile`
  (or `session.json`), falling back to a one-time interactive login if absent.
- The instance Explorer URL/port is **:4310** (API **:4010**) for `bizapps-accounting-dev`; confirm
  with `mjdev runs <slug>`. Launch the services with `mjdev run <slug> explorer` / `... api`.

## Regenerating from scratch
1. `mjdev run bizapps-accounting-dev api` and `mjdev run bizapps-accounting-dev explorer`.
2. `mjdev explorer-url bizapps-accounting-dev` → paste the logged-in URL into `session.json`, OR do
   one headed Playwright login to populate `chrome-profile/`.
3. Ensure both personas exist (`mjdev persona list`); record them in `personas.json`.

If auth fails mid-suite, delete the stale `chrome-profile/` / `session.json` and redo step 2.
