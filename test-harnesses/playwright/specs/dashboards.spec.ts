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
 * GLPosted JEs; one Acknowledged batch per demo company. Assertions reflect THAT state — they do
 * not assume rows that aren't seeded (e.g. the deferred-revenue tab is legitimately empty).
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
  entityGridRows,
  entityGridCell,
  pageBody,
  type ErrorSink,
} from '../lib/explorer';
import { NAV } from '../lib/env';

// Each test re-authenticates its own fresh context (the magic-link session can't be storageState'd;
// the token is reused across contexts within its validity window — see lib/auth.ts).
test.beforeEach(async ({ page }) => {
  await loginViaMagicLink(page);
});

test('Accounting app activates and shows all 9 nav items (no console errors)', async ({ page }) => {
  const sink = captureConsoleErrors(page);
  await openAccountingApp(page);

  for (const label of Object.values(NAV)) {
    await expect(page.getByText(label, { exact: true }).first(), `nav item "${label}" present in the left rail`).toBeVisible();
  }
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

test('Batch Dispatch — batch card + status/approval badges render over demo data', async ({ page }) => {
  const sink = await gotoDashboard(page, NAV.batches);

  // Company + period selectors populated from the 3 demo companies.
  const companies = await companyOptions(page);
  expect(companies.some((c) => /Assoc Demo/i.test(c)), `company selector should list the demo companies (got ${JSON.stringify(companies)})`).toBeTruthy();

  // Default company (Cascadia) has one Acknowledged demo batch → exactly one batch card with a status badge.
  const cards = page.locator('.bd-card');
  await expect(cards.first(), 'at least one batch card should render for the default demo company').toBeVisible();
  await expect(page.locator('.bd-card mj-stat-badge').first(), 'a batch card should show a status badge').toBeVisible();
  // Real-value (not just presence): the default demo company's seeded batch was dispatched, so the
  // status must actually read Acknowledged — proving the value travelled API → client → DOM.
  await expect(page.getByText(/Acknowledged/i).first(), 'the demo batch card should show the Acknowledged status').toBeVisible({ timeout: 15_000 });

  expectNoConsoleErrors(sink, 'viewing the Batch Dispatch dashboard');
});

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

test('Batch Status — summary cards + batch grid render over demo batches', async ({ page }) => {
  const sink = await gotoDashboard(page, NAV.batchStatus);

  const companies = await companyOptions(page);
  expect(companies.some((c) => /Assoc Demo/i.test(c))).toBeTruthy();

  // The status roll-up shows 4 summary cards (Pending/Sent/Acknowledged/Failed) + a grid of batches.
  await expect(page.locator('.rm-card').first(), 'Batch Status should render its summary cards').toBeVisible();
  expect(await page.locator('.rm-card').count(), 'expected the 4 status summary cards').toBeGreaterThanOrEqual(4);
  await expect(agGridRows(page).first(), 'Batch Status grid should have at least one batch row').toBeVisible({ timeout: 30_000 });
  // Real-value: the demo batches are dispatched, so an Acknowledged status must appear in the roll-up.
  await expect(page.getByText(/Acknowledged/i).first(), 'Batch Status should show an Acknowledged batch').toBeVisible({ timeout: 15_000 });

  expectNoConsoleErrors(sink, 'viewing the Batch Status dashboard');
});

test('Intercompany Flow — leg grid renders rows over the demo intercompany flow', async ({ page }) => {
  const sink = await gotoDashboard(page, NAV.intercompany);

  const companies = await companyOptions(page);
  expect(companies.some((c) => /Assoc Demo/i.test(c))).toBeTruthy();

  await expect(agGridRows(page).first(), 'Intercompany Flow grid should have at least one leg row').toBeVisible({ timeout: 30_000 });
  expect(await agGridRows(page).count()).toBeGreaterThan(0);

  expectNoConsoleErrors(sink, 'viewing the Intercompany Flow dashboard');
});

test('GL Accounts — entity grid renders the seeded chart of accounts', async ({ page }) => {
  // GL Accounts is a User-Views nav item → the MJ entity grid. It does NOT use the custom-dashboard
  // <mj-page-body> chrome, so we open the nav item directly (not via gotoDashboard).
  const sink = captureConsoleErrors(page);
  await openAccountingApp(page);
  await openNavItem(page, NAV.glAccounts);

  // The grid (AG-Grid with ARIA roles) renders the seeded accounts. Assert a recognizable account
  // name cell (viewport-rendered → robust against AG-Grid row virtualization) + a positive row count.
  await expect(
    entityGridCell(page, /Accounts Receiv|Deferred Revenue|Operating Cash|Sales Revenue/),
    'a recognizable seeded GL account name should be visible in the grid',
  ).toBeVisible({ timeout: 30_000 });
  expect(await entityGridRows(page).count(), 'expected the seeded chart of accounts to have rows').toBeGreaterThan(0);

  expectNoConsoleErrors(sink, 'viewing the GL Accounts list');
});

test('GL Account form — opening a GL account row renders the custom detail form', async ({ page }) => {
  const sink = captureConsoleErrors(page);
  await openAccountingApp(page);
  await openNavItem(page, NAV.glAccounts);
  await expect(entityGridCell(page, /Operating Cash|Sales Revenue|Deferred Revenue/)).toBeVisible({ timeout: 30_000 });

  // Open a GL account by DOUBLE-clicking its name cell (single click only selects the row in the MJ
  // entity grid) → the custom GL Account form (record-form container).
  await entityGridCell(page, /Operating Cash|Sales Revenue|Deferred Revenue/).dblclick();
  await page.waitForTimeout(6000);

  await expect(
    page.locator('mj-record-form-container').first(),
    'the GL Account detail form (record-form container) should render',
  ).toBeVisible({ timeout: 30_000 });

  expectNoConsoleErrors(sink, 'opening a GL Account detail form');
});

test('Journal Entry form — opening a JE row renders the JE detail form with its fields', async ({ page }) => {
  const sink = captureConsoleErrors(page);
  await openAccountingApp(page);
  await openNavItem(page, NAV.journalEntries);
  // The JE entity grid shows GLPosted demo JEs; assert a recognizable cell (status) renders.
  await expect(entityGridCell(page, /GLPosted|Pending|Batched/), 'Journal Entries grid should render rows').toBeVisible({ timeout: 30_000 });

  // Open a JE by DOUBLE-clicking a description cell (single click only selects) → the JE detail form.
  await entityGridCell(page, /Association dem|JE-/).dblclick();
  await page.waitForTimeout(6000);

  // The record-form container renders with the JE's fields (Entry Number / Status panel).
  // NOTE: this path opens the JE in the standard record-form host (Details panel), which is the
  // correct "form renders" presence check. The custom JE status-timeline form (`.je-timeline`) is
  // a separate surface that did NOT render from this entity-grid open path on this build, so we do
  // not assert it here (it would be claiming a UI we didn't observe).
  await expect(
    page.locator('mj-record-form-container').first(),
    'the JE detail form (record-form container) should render',
  ).toBeVisible({ timeout: 30_000 });
  await expect(
    page.getByText('Entry Number', { exact: false }).first(),
    'the JE detail form should show JE fields (Entry Number)',
  ).toBeVisible({ timeout: 15_000 });

  expectNoConsoleErrors(sink, 'opening a Journal Entry detail form');
});
