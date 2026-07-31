/**
 * shell-smoke.ts — standalone light smoke for the category-shell UI (ported 2026-07-29).
 *
 * Walks the 5 category nav items (Journal Entries / Batches / Accounts / Reports / Configuration),
 * asserts each renders + its shell mounts an <mj-left-nav>, with the URL-aware keystone (fail on
 * any console.error/pageerror; static-asset 404s + the 2 known-benign patterns suppressed).
 *
 * Standalone tsx (same pattern as lib/batching-fixture.ts) — run from the INSTANCE WORKTREE ROOT
 * with a magic-link URL:
 *   npx tsx packages/dev-apps/bizapps-accounting/test-harnesses/playwright/shell-smoke.ts \
 *     "$(~/MJDev/bin/mjdev explorer-url accounting-revamp | grep -oE 'http://[^ ]+' | tail -1)"
 * Exit: 0 all passed · 1 failures. The deeper per-page behavior specs are the *-newnav Playwright
 * specs (rides the per-category UI hardening pass).
 */
import { chromium } from 'playwright';

const url = process.argv[2];
const CATEGORIES = ['Journal Entries', 'Batches', 'Accounts', 'Reports', 'Configuration'];

let failed = 0;
const check = (label: string, ok: boolean, detail?: string) => {
  console.log(`  ${ok ? '✓' : '✗'} ${label}${!ok && detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

const BENIGN: RegExp[] = [
  /MISSING FIELDS.*SetMany/i,
  /NG0100: ExpressionChangedAfterItHasBeenCheckedError[\s\S]*DataExplorerDashboardComponent/,
];

async function main(): Promise<void> {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const text = m.text();
    const loc = m.location()?.url ?? '';
    const assetNoise = /status of 404/i.test(text) && /(favicon\.ico|\.(?:ico|png|svg|gif|map))(?:\?|$)/i.test(loc);
    if (!BENIGN.some((re) => re.test(text)) && !assetNoise) errors.push(`console.error: ${text.slice(0, 280)}`);
  });
  page.on('pageerror', (e) => {
    if (!BENIGN.some((re) => re.test(e.message))) errors.push(`pageerror: ${e.message.slice(0, 280)}`);
  });

  console.log('Logging in via magic link…');
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.waitForURL(/\/app\//i, { timeout: 120_000 });
  await page.waitForTimeout(10_000); // metadata + user bootstrap settle

  console.log('Opening the Accounting app via the app switcher…');
  await page.locator('.app-switcher-button, [aria-label="Switch application"]').first().click({ timeout: 20_000 });
  const item = page.locator('.app-switcher-item', { hasText: /^Accounting/ }).first();
  await item.scrollIntoViewIfNeeded({ timeout: 15_000 });
  await item.click();
  await page.waitForURL(/\/app\/accounting\//i, { timeout: 30_000 });
  await page.waitForTimeout(5000);

  for (const cat of CATEGORIES) {
    const nav = page.getByText(cat, { exact: true }).first();
    const visible = await nav.isVisible().catch(() => false);
    check(`nav item '${cat}' renders`, visible);
    if (!visible) continue;
    await nav.click().catch(() => undefined);
    await page.waitForTimeout(5000);
    const rails = await page.locator('mj-left-nav').count().catch(() => 0);
    check(`'${cat}' category shell mounts (mj-left-nav present)`, rails > 0, `rails=${rails}`);
  }

  const unique = [...new Set(errors)];
  check('keystone: zero console/page errors across the walk', unique.length === 0, `\n      ${unique.slice(0, 10).join('\n      ')}`);

  await browser.close();
  console.log(`\nShell smoke: ${failed === 0 ? 'ALL PASSED' : `${failed} FAILED`}`);
  process.exit(failed === 0 ? 0 : 1);
}
void main();
