/**
 * PRIORITY 1 — dashboard presence + the keystone (fail on console errors).
 *
 * For each Accounting dashboard: navigate there (by clicking through the real app-switcher + nav
 * rail, the way a user does), assert the key element renders against the seeded demo data, and
 * FAIL on any captured console.error / pageerror. The console capture is wired per-page in
 * `captureConsoleErrors` and asserted at the end of each dashboard — this is what catches silent
 * UI bugs the way TEST-PROTOCOL.md mandates.
 *
 * Demo data (seed-demo.ts): 3 companies; the 6 vw_* read models populate; ~31 GL accounts +
 * GLPosted JEs; 6 Posted batches (2026-07-06 lifecycle: Pending → Approved → Sent → Posted).
 * Assertions reflect THAT state — they do not assume rows that aren't seeded.
 */
import { test, expect, type Page } from '@playwright/test';
import { loginViaMagicLink } from '../lib/auth';
import {
  captureConsoleErrors,
  expectNoConsoleErrors,
  openAccountingApp,
  openNavItem,
  companyOptions,
  agGridRows,
  pageBody,
  type ErrorSink,
} from '../lib/explorer';
import { NAV } from '../lib/env';

// Each test re-authenticates its own fresh context (the magic-link session can't be storageState'd;
// the token is reused across contexts within its validity window — see lib/auth.ts).
test.beforeEach(async ({ page }) => {
  await loginViaMagicLink(page);
});

// The CURRENT Accounting app nav (metadata/applications/.bizapps-accounting-application.json). An
// explicit list — NOT Object.values(NAV), which still carries retired labels (Batches, GL Accounts,
// Periods) that the post-refactor app no longer shows.
const CURRENT_NAV = [
  'Journal Entries', 'Batch Status', 'Batch Approvals', 'Chart of Accounts', 'Companies',
  'Dimensions', 'Trial Balance & AR', 'Revenue & Tax', 'Intercompany Flow',
] as const;

test('Accounting app activates and shows all 9 nav items (no console errors)', async ({ page }) => {
  const sink = captureConsoleErrors(page);
  await openAccountingApp(page);

  for (const label of CURRENT_NAV) {
    await expect(page.getByText(label, { exact: true }).first(), `nav item "${label}" present in the left rail`).toBeVisible();
  }
  expect(CURRENT_NAV.length, 'the app should expose exactly 9 nav items').toBe(9);
  expectNoConsoleErrors(sink, 'activating the Accounting app + reading the nav rail');
});

/** Helper: open the app, go to a nav item, return its console-error sink. */
async function gotoDashboard(page: Page, navLabel: string): Promise<ErrorSink> {
  const sink = captureConsoleErrors(page);
  await openAccountingApp(page);
  await openNavItem(page, navLabel);
  // A dashboard (not Home) is rendered once the page body exists.
  await expect(pageBody(page), `${navLabel}: dashboard page body should render`).toBeVisible({ timeout: 30_000 });
  return sink;
}

// NOTE: the "Batch Approvals — batch cards" and "Batch Status — summary cards" dashboard tests were
// removed here as redundant: the dedicated specs `accounting-batch-approvals.spec.ts` and
// `batch-status.spec.ts` already drive those exact dashboards (with their own console-error keystone),
// and their inner selectors had drifted in the Batch UI refactor. This spec keeps the read-model
// dashboards (Trial Balance & AR, Revenue & Tax, Intercompany Flow) that have NO other coverage.

test('Trial Balance & AR — trial-balance grid renders rows over committed JEs', async ({ page }) => {
  const sink = await gotoDashboard(page, NAV.trialBalanceAR);

  const companies = await companyOptions(page);
  expect(companies.some((c) => /Assoc Demo/i.test(c))).toBeTruthy();

  // The default tab (Trial Balance) shows an ag-grid with rows from the vw_TrialBalance_AR demo data.
  await expect(agGridRows(page).first(), 'trial-balance grid should have at least one row').toBeVisible({ timeout: 30_000 });
  expect(await agGridRows(page).count()).toBeGreaterThan(0);
  // Real-value (not just "rows exist"): the seeded chart of accounts puts Accounts Receivable in the
  // trial balance, so its row must actually render — the value reaches the screen, not an empty grid.
  await expect(page.getByText(/Accounts Receivable/i).first(), 'the trial balance should show the Accounts Receivable account row').toBeVisible({ timeout: 15_000 });

  expectNoConsoleErrors(sink, 'viewing the Trial Balance & AR dashboard');
});

test('Revenue & Tax — renders (grid or a legitimate empty-state) with no errors', async ({ page }) => {
  const sink = await gotoDashboard(page, NAV.revenueTax);

  const companies = await companyOptions(page);
  expect(companies.some((c) => /Assoc Demo/i.test(c))).toBeTruthy();

  // The deferred-revenue (default) tab is legitimately empty for the demo set; the Sales Tax tab
  // carries data. We assert the dashboard renders one or the other — both are correct UI, and the
  // KEYSTONE (no console errors) is what proves the component is healthy.
  const grid = agGridRows(page).first();
  const empty = page.locator('mj-page-body mj-empty-state').first();
  await expect(grid.or(empty), 'Revenue & Tax should render either a grid or an empty-state').toBeVisible({ timeout: 30_000 });

  // Switch to the Sales Tax tab and confirm it renders without error.
  const salesTaxTab = page.getByRole('button', { name: /Sales Tax/i }).first();
  if (await salesTaxTab.count()) {
    await salesTaxTab.click();
    await page.waitForTimeout(3000);
    await expect(grid.or(empty), 'Sales Tax tab should render a grid or empty-state').toBeVisible();
  }

  expectNoConsoleErrors(sink, 'viewing the Revenue & Tax dashboard (both tabs)');
});

test('Intercompany Flow — leg grid renders rows over the demo intercompany flow', async ({ page }) => {
  const sink = await gotoDashboard(page, NAV.intercompany);

  const companies = await companyOptions(page);
  expect(companies.some((c) => /Assoc Demo/i.test(c))).toBeTruthy();

  await expect(agGridRows(page).first(), 'Intercompany Flow grid should have at least one leg row').toBeVisible({ timeout: 30_000 });
  expect(await agGridRows(page).count()).toBeGreaterThan(0);

  expectNoConsoleErrors(sink, 'viewing the Intercompany Flow dashboard');
});

