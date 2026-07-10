/**
 * Chart of Accounts — reference-engine wiring (AccountingEngineBase).
 *
 * The page loads GL Accounts + Company Profiles from the shared reactive engine (AccountingEngineBase), not a
 * per-page RunView, and re-hydrates from the engine's ObserveProperty subscription (no manual reload). This test
 * validates the engine-backed READ path + the view/create dialogs (non-mutating, so it's permission-independent
 * and safe to run repeatedly). The reactive-on-save behaviour is the BaseEngine framework contract; a full
 * write-driven check is gated on GL-account Update permission for the test user (see Task 17).
 * Fails on any console/pageerror.
 */
import { test, expect } from '@playwright/test';
import { loginViaMagicLink } from '../lib/auth';
import { captureConsoleErrors, expectNoConsoleErrors, openAccountingApp, openNavItem } from '../lib/explorer';

test('Chart of Accounts — GL accounts + companies load from the reference engine', async ({ page }) => {
  await loginViaMagicLink(page);
  const sink = captureConsoleErrors(page);

  await openAccountingApp(page);
  await openNavItem(page, 'Chart of Accounts');
  await expect(page.getByRole('button', { name: 'New Account' }).first()).toBeVisible({ timeout: 30_000 });

  // Company selector is populated from the engine's CompanyProfiles (All + ≥1 company).
  const companySelect = page.locator('select.coa-companyselect').first();
  await expect(companySelect).toBeVisible();
  expect(await companySelect.locator('option').count(), 'companies from the engine').toBeGreaterThan(1);

  // GL accounts load from the engine → the tree populates (All companies).
  await companySelect.selectOption('All');
  const rows = page.locator('.coa-row');
  await expect(rows.first(), 'account rows from the engine').toBeVisible({ timeout: 15_000 });
  expect(await rows.count(), 'engine returned GL accounts').toBeGreaterThan(0);

  // Create dialog opens (curated form), then cancel — no write.
  await page.getByRole('button', { name: 'New Account' }).first().click();
  await expect(page.getByText('New GL Account').first()).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: 'Cancel', exact: true }).first().click();

  // Opening an account shows the clean read-only view (a pure read — no permission needed).
  await rows.first().click();
  await expect(page.locator('.coa-view').first(), 'clean account view dialog').toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('button', { name: 'Edit' }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).first().click();

  expectNoConsoleErrors(sink, 'Chart of Accounts reference-engine read path');
});
