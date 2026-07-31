/**
 * Shared environment + paths for the bizapps-accounting Playwright harness.
 *
 * Ports are discovered FROM mjdev (`mjdev ps <slug> --json`) by process label, so the harness
 * always drives THIS instance's MJAPI/MJExplorer on whatever ports mjdev assigned — no hardcoded
 * ports, no one-off `MJAPI_PORT=` override, and it survives mjdev's port-conflict auto-moves. It
 * never touches the app's relic `apps/MJAPI` / `apps/MJExplorer`. Everything stays overridable via
 * env for portability:
 *   MJDEV_SLUG          (default: bizapps-accounting-dev)
 *   MJEXPLORER_PORT     (default: resolved from mjdev, else 4200)
 *   MJAPI_PORT          (default: resolved from mjdev, else 4000)
 *   MJDEV_BIN           (default: <workspace>/bin/mjdev — resolved relative to this file)
 */
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** test-harnesses/playwright/ */
export const HARNESS_DIR = path.resolve(__dirname, '..');

/** Walk up from a start dir until we find `bin/mjdev` (the workspace root). */
function findMjdevBin(start: string): string | null {
  let dir = start;
  for (let i = 0; i < 12; i++) {
    const candidate = path.join(dir, 'bin', 'mjdev');
    if (existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}
/** Gitignored local-auth folder (storageState etc.). */
export const TEST_AUTH_DIR = path.resolve(HARNESS_DIR, '..', 'test-auth');
export const STORAGE_STATE = path.join(TEST_AUTH_DIR, 'storage-state.json');

export const SLUG = process.env.MJDEV_SLUG ?? 'bizapps-accounting-dev';

/**
 * The mjdev launcher (`<workspace>/bin/mjdev`). The harness lives several levels under the
 * workspace root; rather than hardcode the count, we walk up looking for `bin/mjdev`. Overridable
 * via MJDEV_BIN.
 */
export const MJDEV_BIN =
  process.env.MJDEV_BIN ?? findMjdevBin(HARNESS_DIR) ?? path.resolve(HARNESS_DIR, '..', '..', '..', '..', '..', '..', '..', '..', 'bin', 'mjdev');

/**
 * Resolve a service's actual serving port FROM mjdev (`mjdev ps <slug> --json`) by process label.
 * This is how the harness stays mjdev-native + port-agnostic: it reads whatever port mjdev assigned
 * THIS instance's MJAPI / MJExplorer (never the app's relic apps/MJAPI|apps/MJExplorer, never a
 * hardcoded value). Env override wins; the documented MJ defaults are only a last resort if mjdev
 * can't be queried.
 */
function portFromMjdev(label: 'MJAPI' | 'MJExplorer'): string | undefined {
  try {
    const out = execFileSync(MJDEV_BIN, ['ps', SLUG, '--json'], { encoding: 'utf8', timeout: 30_000 });
    const parsed: unknown = JSON.parse(out);
    const procs: Array<{ label?: string; port?: number }> = Array.isArray(parsed)
      ? (parsed as Array<{ label?: string; port?: number }>)
      : ((parsed as { processes?: Array<{ label?: string; port?: number }> }).processes ?? []);
    const match = procs.find((p) => p.label === label);
    return match?.port ? String(match.port) : undefined;
  } catch {
    return undefined;
  }
}

export const EXPLORER_PORT = process.env.MJEXPLORER_PORT ?? portFromMjdev('MJExplorer') ?? '4200';
export const API_PORT = process.env.MJAPI_PORT ?? portFromMjdev('MJAPI') ?? '4000';
export const EXPLORER_BASE_URL = `http://localhost:${EXPLORER_PORT}`;
export const API_BASE_URL = `http://localhost:${API_PORT}`;

/** The 3 seeded demo companies (see test-harnesses/server/seed-demo.ts). */
export const DEMO_COMPANIES = {
  northwind: 'a55c0de1-0001-4000-8000-000000000001',
  cascadia: 'a55c0de1-0002-4000-8000-000000000002',
  sierra: 'a55c0de1-0003-4000-8000-000000000003',
} as const;

/** The Explorer application name + path for the Accounting app (see metadata/applications). */
export const ACCOUNTING_APP_NAME = 'Accounting';

/** Nav-item labels in the Accounting app's left rail (must match metadata DefaultNavItems Labels). */
export const NAV = {
  batches: 'Batches',
  trialBalanceAR: 'Trial Balance & AR',
  revenueTax: 'Revenue & Tax',
  batchStatus: 'Batch Status',
  intercompany: 'Intercompany Flow',
  glAccounts: 'GL Accounts',
  journalEntries: 'Journal Entries',
  periods: 'Periods',
  dimensions: 'Dimensions',
} as const;
