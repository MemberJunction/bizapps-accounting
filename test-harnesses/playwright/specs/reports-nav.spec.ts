/**
 * TIER 5 (new nav) — the core accounting dashboards reached through the UI-wave CATEGORY RAILS,
 * authenticated via magic-link. Replaces the pre-UI-wave flat-label navigation the committed specs
 * (dashboards/batch-approvals/je-console/coa/company-setup) were built on. Tier 4 owns the exact
 * VALUES of these dashboards; tier 5 proves the BROWSER-UNIQUE layer — real routing across categories
 * + each dashboard renders with zero console/page errors (the keystone).
 *
 * Selector rules (proven): a category is a visible left-rail LINK; a rail item is a visible
 * `getByRole('button', {name})` — a hidden `.mj-left-nav__switcher-label` span shares the text, so a
 * bare `getByText().first()` grabs the invisible one and times out. Interior category pages render
 * `mj-page-header-interior` (not `mj-page-body`), so assert either.
 */
import { test, expect, type Page } from '@playwright/test';
import { loginViaMagicLink } from '../lib/auth';
import { openAccountingApp, openNavItem, captureConsoleErrors, expectNoConsoleErrors } from '../lib/explorer';

// [category link, rail item button] across the new shell (accounts/batches/journal-entries/reports/config)
const ROUTES: Array<[string, string]> = [
  ['Reports', 'Trial balance (AR)'],
  ['Reports', 'DefRev Rollforward'],
  ['Reports', 'Sales tax liability'],
  ['Batches', 'Batch approvals'],
  ['Batches', 'Dispatch status'],
  ['Journal Entries', 'All journal entries'],
  ['Accounts', 'Chart of accounts'],
  ['Configuration', 'Companies'],
];

async function gotoRail(page: Page, category: string, item: string): Promise<void> {
  await openNavItem(page, category); // visible category link → opens its rail
  await page.getByRole('button', { name: item }).first().click(); // visible rail button
  await page.waitForTimeout(3500);
  await expect(
    page.locator('mj-page-body, mj-page-header-interior').first(),
    `${category} → ${item} must render a dashboard body`,
  ).toBeVisible({ timeout: 15_000 });
}

test.beforeEach(async ({ page }) => {
  await loginViaMagicLink(page);
});

test('core accounting dashboards route + render cleanly across the new category rails', async ({ page }) => {
  const sink = captureConsoleErrors(page);
  await openAccountingApp(page);
  for (const [cat, item] of ROUTES) {
    await gotoRail(page, cat, item);
  }
  expectNoConsoleErrors(sink, `navigating the new category rails (${ROUTES.length} dashboards)`);
});
