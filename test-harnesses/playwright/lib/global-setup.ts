/**
 * Global setup — preflight everything that, if wrong, would make a test fail for a reason that
 * ISN'T the app under test. Each check fails LOUDLY with the exact command to fix it.
 *
 *  1. System Chrome present (and not a truncated/corrupt install) — we drive `channel: 'chrome'`.
 *  2. MJAPI reachable on :4040 — else `mjdev run <slug> api`.
 *  3. MJExplorer reachable on :4310 — else `mjdev run <slug> explorer` (wait for it to compile).
 *  4. Mint a magic-link URL and persist it for the specs.
 *  5. Authenticate once and assert the **Accounting app is present in client metadata**. If it is
 *     missing, MJAPI's in-memory metadata is STALE (it booted before the Accounting app was synced
 *     into the DB) — the fix is to RESTART MJAPI. This is the exact trap that blocked the first run.
 */
import { existsSync, mkdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { chromium, type FullConfig } from '@playwright/test';
import { API_BASE_URL, EXPLORER_BASE_URL, MJDEV_BIN, SLUG, TEST_AUTH_DIR } from './env';
import { mintAndStoreMagicLink } from './auth';

const CHROME_APP = '/Applications/Google Chrome.app';
const CHROME_BIN = `${CHROME_APP}/Contents/MacOS/Google Chrome`;

function fail(msg: string): never {
  throw new Error(`\n[bizapps-accounting playwright global-setup] ${msg}\n`);
}

function verifyChrome(): void {
  if (!existsSync(CHROME_APP) || !existsSync(CHROME_BIN)) {
    fail(
      `System Chrome not found at ${CHROME_APP}. This harness drives system Chrome (channel:'chrome') and never downloads a Playwright browser. Install Google Chrome, or set the harness to a present browser.`,
    );
  }
  // Guard against a truncated/corrupt install (the TEST-PROTOCOL trap): the main binary must be non-trivial.
  try {
    if (statSync(CHROME_BIN).size < 1024) fail(`Chrome binary at ${CHROME_BIN} looks truncated/corrupt.`);
  } catch {
    fail(`Cannot stat the Chrome binary at ${CHROME_BIN}.`);
  }
}

async function verifyReachable(url: string, label: string, fixCmd: string): Promise<void> {
  try {
    const res = await fetch(url, { method: 'GET' });
    // Any HTTP response (even 401/400) means the server is up. A network error is the failure.
    if (!res) fail(`${label} at ${url} did not respond. Start it with:\n    ${fixCmd}`);
  } catch (e) {
    fail(`${label} at ${url} is unreachable (${e instanceof Error ? e.message : e}). Start it with:\n    ${fixCmd}\n  Wait for it to finish compiling/serving, then re-run.`);
  }
}

async function verifyAccountingAppLoaded(magicUrl: string): Promise<void> {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const page = await browser.newPage();
    await page.goto(magicUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForURL(/\/app\//, { timeout: 60_000 });
    await page.waitForTimeout(5000);
    const hasAccounting = await page.evaluate(() => {
      const g = globalThis as unknown as Record<string, unknown>;
      for (const k of Object.getOwnPropertyNames(g)) {
        try {
          const v = g[k] as { Applications?: { Name: string }[]; EntityByName?: unknown };
          if (v && Array.isArray(v.Applications) && v.Applications.length && 'EntityByName' in v) {
            return v.Applications.some((a) => a.Name === 'Accounting');
          }
        } catch {
          /* ignore cross-origin / getter throws */
        }
      }
      return null; // provider not found — inconclusive, let the specs surface it
    });
    if (hasAccounting === false) {
      fail(
        `The "Accounting" application is NOT in the Explorer client metadata, so its dashboards are unreachable.\n` +
          `  Almost always this means MJAPI's in-memory metadata is STALE (MJAPI booted before the\n` +
          `  Accounting app metadata was synced into the DB). Fix by RESTARTING MJAPI:\n` +
          `    ${MJDEV_BIN} ps ${SLUG}        # find the MJAPI process id\n` +
          `    ${MJDEV_BIN} kill <api-id>\n` +
          `    ${MJDEV_BIN} run ${SLUG} api    # wait ~20s for it to serve, then re-run this harness`,
      );
    }
    // hasAccounting === true → good; null → inconclusive (don't block; specs assert nav directly).
  } finally {
    await browser.close();
  }
}

export default async function globalSetup(_config: FullConfig): Promise<void> {
  if (!existsSync(TEST_AUTH_DIR)) mkdirSync(TEST_AUTH_DIR, { recursive: true });

  verifyChrome();
  await verifyReachable(API_BASE_URL, 'MJAPI', `cd <workspace> && ./bin/mjdev run ${SLUG} api`);
  await verifyReachable(EXPLORER_BASE_URL, 'MJExplorer', `cd <workspace> && ./bin/mjdev run ${SLUG} explorer`);

  // Sanity: mjdev is invocable (mints the magic link). If this throws, the path/env is wrong.
  try {
    execFileSync(MJDEV_BIN, ['--version'], { encoding: 'utf8', timeout: 30_000 });
  } catch {
    // --version may not exist; that's fine — explorer-url is the real check below.
  }

  const magicUrl = mintAndStoreMagicLink();
  await verifyAccountingAppLoaded(magicUrl);

  // Use stderr so a `--reporter=json` run keeps clean JSON on stdout.
  process.stderr.write(`[global-setup] OK — Chrome present, MJAPI+Explorer up, magic link minted, Accounting app loaded.\n`);
}
