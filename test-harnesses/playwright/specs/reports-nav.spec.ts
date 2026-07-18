/**
 * TIER 5 (new nav) — a read-model dashboard reached through the UI-wave category rail, authenticated
 * via magic-link. Tier 4 owns EXACT VALUES; tier 5 proves the BROWSER-UNIQUE layer: real routing +
 * a clean render (keystone). Template for reconciling the retired-flat-label specs.
 *
 * Selector note: rail items are VISIBLE `button`s (`getByRole('button', {name})`); the shell also has
 * a HIDDEN `.mj-left-nav__switcher-label` span with the same text, so a bare `getByText().first()`
 * grabs the invisible one and the click times out. Use the role. The interior category pages do NOT
 * wrap in `mj-page-body` — assert the dashboard's own content instead.
 */
import { test, expect } from '@playwright/test';
import { loginViaMagicLink } from '../lib/auth';
import { openAccountingApp, openNavItem, captureConsoleErrors, expectNoConsoleErrors } from '../lib/explorer';

test.beforeEach(async ({ page }) => {
  await loginViaMagicLink(page); // magic-link session can't be storageState'd — re-auth per test
});

test('Reports → Trial balance (AR) renders cleanly (new category rail)', async ({ page }) => {
  const sink = captureConsoleErrors(page);
  await openAccountingApp(page);
  await openNavItem(page, 'Reports'); // top-level category (a visible link) → opens its rail
  await page.getByRole('button', { name: 'Trial balance (AR)' }).first().click(); // visible rail button
  await page.waitForTimeout(4000);
  // the dashboard rendered — assert its own content (interior page, no mj-page-body wrapper)
  await expect(page.getByText('AR subledger trial balance', { exact: false }).first(),
    'Trial Balance dashboard content must render').toBeVisible({ timeout: 15_000 });
  expectNoConsoleErrors(sink, 'navigating Reports → Trial balance (AR)');
});
