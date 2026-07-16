/**
 * TIER-5 — Chart of Accounts dashboard (ChartOfAccountsDashboardComponent).
 *
 * Closes the testing.md coverage gap for the Chart of Accounts tree. Drives the dashboard the way a
 * user does (activate the Accounting app → open "Chart of Accounts") and asserts BOTH presence AND
 * behavior per TEST-PROTOCOL.md:
 *   1. Company selector + account-type filter chips — present, and clicking a type chip actually
 *      filters the tree (every visible node matches the chosen account type).
 *   2. The account tree renders the seeded chart of accounts (real code + name values reach the DOM).
 *   3. Drill into an account → opens the in-app account panel dialog (`mj-dialog`) in VIEW mode
 *      showing that account's real Code / Name / Type.
 *
 * Selectors read from coa-dashboard.component.html/.ts: `.coa-companyselect`, `.coa-chip` type chips,
 * `.coa-searchbox`, `.coa-tree`/`.coa-row` nodes, `.coa-code`/`.coa-name`/`.coa-pill`, and the account
 * panel `mj-dialog` with `.coa-dlg` / `.coa-view` (view mode).
 *
 * Every test wires the console/pageerror keystone and asserts it is clean.
 */
import { test, expect, type Page } from '@playwright/test';
import { loginViaMagicLink } from '../lib/auth';
import { captureConsoleErrors, expectNoConsoleErrors, openAccountingApp, openNavItem, pageBody, type ErrorSink } from '../lib/explorer';
import { NAV } from '../lib/env';

test.beforeEach(async ({ page }) => {
  await loginViaMagicLink(page);
});

async function gotoCoA(page: Page): Promise<ErrorSink> {
  const sink = captureConsoleErrors(page);
  await openAccountingApp(page);
  await openNavItem(page, NAV.chartOfAccounts);
  await expect(pageBody(page), 'Chart of Accounts dashboard body should render').toBeVisible({ timeout: 30_000 });
  return sink;
}

test('Chart of Accounts — company selector + tree render the seeded accounts', async ({ page }) => {
  const sink = await gotoCoA(page);

  // PRESENCE — the company selector, the type-filter chips, and the search box.
  await expect(page.locator('.coa-companyselect'), 'the company selector should render').toBeVisible();
  await expect(page.locator('.coa-chip', { hasText: /^All types$/ }).first(), 'the "All types" chip should render').toBeVisible();
  await expect(page.locator('.coa-searchbox input'), 'the account search box should render').toBeVisible();

  // The tree renders the seeded chart of accounts — assert rows + a recognizable seeded account name/code.
  await expect(page.locator('.coa-tree .coa-row').first(), 'the account tree should have at least one node').toBeVisible({ timeout: 20_000 });
  expect(await page.locator('.coa-tree .coa-row').count(), 'the seeded chart of accounts should have multiple nodes').toBeGreaterThan(0);
  await expect(
    page.locator('.coa-name').filter({ hasText: /Accounts Receivable|Deferred Revenue|Operating Cash|Sales Revenue/ }).first(),
    'a recognizable seeded GL account name should render in the tree',
  ).toBeVisible({ timeout: 15_000 });
  // A code value must reach the DOM too (proves the code column renders, not just names).
  await expect(page.locator('.coa-row .coa-code').first(), 'each node should show its account code').toBeVisible();

  expectNoConsoleErrors(sink, 'viewing the Chart of Accounts tree');
});

test('Chart of Accounts — account-type filter chip actually filters the tree', async ({ page }) => {
  const sink = await gotoCoA(page);
  await expect(page.locator('.coa-tree .coa-row').first(), 'the account tree should render').toBeVisible({ timeout: 20_000 });

  // Read the account type of the first node, then click that type's chip and assert the tree narrows to it.
  const firstType = (await page.locator('.coa-row .coa-pill').first().innerText()).trim();
  expect(firstType.length, 'the first node should expose an account-type pill').toBeGreaterThan(0);

  const typeChip = page.locator('.coa-chip').filter({ hasText: new RegExp(`^${firstType}$`) }).first();
  await expect(typeChip, `a filter chip for account type "${firstType}" should exist`).toBeVisible();
  await typeChip.click();
  await page.waitForTimeout(1500);

  // BEHAVIOR — the chip is active AND every remaining node is of the chosen type.
  await expect(typeChip, 'the chosen type chip should be marked active').toHaveClass(/coa-chip--on/);
  const pills = page.locator('.coa-row .coa-pill');
  const count = await pills.count();
  expect(count, 'filtering by type should leave at least the matching nodes').toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    await expect(pills.nth(i), `every visible node after filtering must be of type "${firstType}"`).toHaveText(new RegExp(firstType));
  }

  expectNoConsoleErrors(sink, 'filtering the Chart of Accounts by account type');
});

test('Chart of Accounts — drilling into an account opens the account panel dialog in view mode', async ({ page }) => {
  const sink = await gotoCoA(page);

  const firstNode = page.locator('.coa-tree .coa-row').first();
  await expect(firstNode, 'an account node should render').toBeVisible({ timeout: 20_000 });
  const expectedCode = (await firstNode.locator('.coa-code').first().innerText()).trim();
  const expectedName = (await firstNode.locator('.coa-name').first().innerText()).trim();

  // BEHAVIOR — click the node → the in-app account dialog opens in VIEW mode showing that account.
  await firstNode.click();
  await page.waitForTimeout(1500);

  const dialogBody = page.locator('.coa-dlg').first();
  await expect(dialogBody, 'the account panel dialog should open').toBeVisible({ timeout: 15_000 });
  const viewPane = dialogBody.locator('.coa-view');
  await expect(viewPane, 'the dialog should open in read-only VIEW mode (Code/Name/Type rows)').toBeVisible();
  // The drilled account's real Code + Name reach the dialog (value round-trips row → dialog).
  await expect(viewPane.getByText(expectedCode, { exact: false }).first(), `the dialog should show the drilled account's code "${expectedCode}"`).toBeVisible();
  await expect(viewPane.getByText(expectedName, { exact: false }).first(), `the dialog should show the drilled account's name "${expectedName}"`).toBeVisible();
  // The view offers an Edit action (proves it's the account panel, not a raw generated form). The
  // action buttons live in <mj-dialog-actions>, which mj-dialog PROJECTS into its overlay — so they
  // are NOT a DOM descendant of the <mj-dialog> host element; scope the lookup to the page (the dialog
  // is already proven open above), not to the host element.
  // Substring/regex name match (NOT exact) — the button carries a leading FontAwesome <i> whose ::before
  // glyph gets folded into the computed accessible name (→ "<glyph> Edit"), so an exact "Edit" never
  // matches. This mirrors the proven locator style in batch-status.spec.ts (/Build Batch/i).
  await expect(page.getByRole('button', { name: /Edit/ }).first(), 'the view dialog should offer an Edit action').toBeVisible();

  expectNoConsoleErrors(sink, 'drilling into a Chart of Accounts account');
});
