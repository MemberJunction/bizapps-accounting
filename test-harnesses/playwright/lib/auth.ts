/**
 * Auth helpers — mint a logged-in Explorer session via mjdev's magic-link, and reuse it.
 *
 * `mjdev explorer-url <slug>` mints an MJ-issued RS256 magic-link URL of the form
 *   http://localhost:<port>/#token=<JWT>
 * Loading it authenticates the session (the SPA consumes #token, then routes to /app/home/Home).
 *
 * IMPORTANT — why we re-navigate the magic link per test (verified, not assumed):
 *   The magic-link session does NOT survive in Playwright `storageState` (it lives in
 *   sessionStorage / in-memory, which storageState does not capture — a saved state reopens to a
 *   login prompt). BUT the SAME magic-link token can be consumed by multiple fresh browser
 *   contexts within its validity window (~8h). So we mint the URL ONCE per run (global-setup),
 *   persist the URL string to test-auth/magic-link.txt (gitignored), and every test opens it first
 *   to authenticate its own context. This is reliable and matches how the live recon proved it out.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { MJDEV_BIN, SLUG, TEST_AUTH_DIR } from './env';

export const MAGIC_LINK_FILE = path.join(TEST_AUTH_DIR, 'magic-link.txt');

/** Run `mjdev explorer-url <slug>` and return the magic-link URL (last http line of stdout). */
export function mintMagicLinkUrl(): string {
  const out = execFileSync(MJDEV_BIN, ['explorer-url', SLUG], { encoding: 'utf8', timeout: 90_000 });
  const url = out
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('http'))
    .pop();
  if (!url) throw new Error(`Could not parse a magic-link URL from \`mjdev explorer-url ${SLUG}\`:\n${out}`);
  return url;
}

/** Mint a fresh magic-link URL and persist it for the run. */
export function mintAndStoreMagicLink(): string {
  const url = mintMagicLinkUrl();
  writeFileSync(MAGIC_LINK_FILE, url, 'utf8');
  return url;
}

/** Read the magic-link URL persisted by global-setup. */
export function readMagicLinkUrl(): string {
  if (!existsSync(MAGIC_LINK_FILE)) {
    throw new Error(`No magic-link file at ${MAGIC_LINK_FILE} — global-setup should have created it. Run via \`npx playwright test\`.`);
  }
  return readFileSync(MAGIC_LINK_FILE, 'utf8').trim();
}

/**
 * Authenticate the given page via the persisted magic link and wait until the app shell loads.
 * Call this at the start of every test (each fresh context needs its own magic-link consumption).
 */
export async function loginViaMagicLink(page: Page): Promise<void> {
  const url = readMagicLinkUrl();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForURL(/\/app\//, { timeout: 60_000 });
  // Let metadata + user bootstrap settle so the Accounting app is loaded before we navigate to it.
  await page.waitForTimeout(3500);
}
