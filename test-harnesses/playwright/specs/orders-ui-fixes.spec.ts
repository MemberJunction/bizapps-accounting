/**
 * Orders + Accounting GUI fixes (Marcelo batch 2026-07-10) — presence + behavior, non-mutating.
 * Committed in the accounting harness because the orders app has no Playwright harness of its own yet
 * (standing one up is backlogged). Drives the orders app via the shared shell / app-switcher.
 *
 * Covers:
 *   #42 Order name (Description) surfaces as the order's display name (Order History table).
 *   #43 Orders Console — create-as-Confirmed pops the "books a journal entry, cannot be undone" dialog.
 *   #44 Order History — the Products filter dropdown renders ABOVE the table top bar (z-index fix).
 *   #47 Orders Console — the add-line row no longer has the sunken, differently-colored card.
 *   #46 Accounting nav tabs are in Marcelo's requested order.
 *
 * Fails on any console/pageerror.
 */
import { test, expect, Page } from '@playwright/test';
import { loginViaMagicLink } from '../lib/auth';
import { captureConsoleErrors, expectNoConsoleErrors, openNavItem, openAccountingApp } from '../lib/explorer';

async function openApp(page: Page, namePrefix: string, urlFragment: RegExp): Promise<void> {
  await page.locator('.app-switcher-button, [aria-label="Switch application"]').first().click();
  const item = page.locator('.app-switcher-item', { hasText: new RegExp(`^${namePrefix}`, 'i') }).first();
  await expect(item, `${namePrefix} app in the switcher`).toBeVisible({ timeout: 15_000 });
  await item.scrollIntoViewIfNeeded();
  await item.click();
  await expect(page).toHaveURL(urlFragment, { timeout: 30_000 });
  await page.waitForTimeout(3000);
}

// #47 + #43 — Orders Console
test('Orders Console — add-line row has no sunken card, and create-as-Confirmed pops the JE-warning dialog', async ({ page }) => {
  await loginViaMagicLink(page);
  const sink = captureConsoleErrors(page);

  await openApp(page, 'Orders', /\/app\/orders\//i);
  await openNavItem(page, 'Orders Console');
  await expect(page.getByText('Compose Order').first(), 'compose card').toBeVisible({ timeout: 30_000 });

  // #47 — the add-line row must NOT carry the sunken-surface card look (no tinted bg, no card padding).
  const addlineStyle = await page.locator('.oc-addline').first().evaluate((el) => {
    const s = getComputedStyle(el);
    return { bg: s.backgroundColor, padTop: s.paddingTop, radius: s.borderTopLeftRadius };
  });
  // transparent background => rgba(0, 0, 0, 0); card padding/radius removed.
  expect(addlineStyle.bg, 'add-line background is transparent (no sunken card)').toBe('rgba(0, 0, 0, 0)');
  expect(addlineStyle.padTop, 'add-line has no card padding').toBe('0px');
  expect(addlineStyle.radius, 'add-line has no card corner radius').toBe('0px');

  // #43 — compose a one-line draft, then Confirm & Book must open the irreversible-JE confirm dialog.
  const productSelect = page.locator('.oc-addline select').first();
  await expect(productSelect, 'product dropdown').toBeVisible();
  // pick the first real product option (index 0 is the disabled placeholder).
  const optionValues = await productSelect.locator('option').evaluateAll((opts) =>
    (opts as HTMLOptionElement[]).filter((o) => !o.disabled && o.value).map((o) => o.value),
  );
  expect(optionValues.length, 'at least one product to add').toBeGreaterThan(0);
  await productSelect.selectOption(optionValues[0]);
  await page.locator('.oc-addline input[type="number"]').first().fill('1');       // qty
  await page.locator('.oc-addline input[type="number"]').nth(1).fill('100');      // unit price
  const addBtn = page.locator('.oc-addbtn');                                       // unique add-line button
  await expect(addBtn, 'Add button enabled once a valid line is composed').toBeEnabled({ timeout: 10_000 });
  await addBtn.click();

  // A draft line now exists (proves the line was added).
  await expect(page.locator('.oc-lines tbody tr').first(), 'draft line row').toBeVisible({ timeout: 10_000 });

  // The create stage defaults to Confirmed → the button reads "Confirm & Book".
  const confirmBtn = page.locator('button.oc-confirm');
  await expect(confirmBtn, 'Confirm & Book button after adding a line').toBeVisible({ timeout: 10_000 });
  await confirmBtn.click();

  // The warning dialog must appear (NOT an immediate booking).
  const dialog = page.getByText(/books a balanced journal entry into the accounting/i).first();
  await expect(dialog, 'irreversible-JE warning dialog').toBeVisible({ timeout: 10_000 });

  // Cancel it — this test is non-mutating; nothing must be booked.
  await page.getByRole('button', { name: 'Cancel', exact: true }).first().click();
  await expect(dialog, 'dialog closes on Cancel').toBeHidden({ timeout: 10_000 });

  expectNoConsoleErrors(sink, 'Orders Console (#47 add-line + #43 confirm dialog)');
});

// #42 + #44 — Order History
test('Order History — order Description shows as the name, and the Products filter renders above the table', async ({ page }) => {
  await loginViaMagicLink(page);
  const sink = captureConsoleErrors(page);

  await openApp(page, 'Orders', /\/app\/orders\//i);
  await openNavItem(page, 'Order History');
  await expect(page.getByText('Order History').first(), 'page header').toBeVisible({ timeout: 30_000 });

  // #42 — an order whose Description is "test-order" must show that Description (not its ORD-… number).
  await expect(
    page.locator('td.oh-ordnum', { hasText: /^test-order$/ }).first(),
    'order Description surfaces as display name',
  ).toBeVisible({ timeout: 20_000 });

  // #44 — the Products filter container forms a stacking context above the table (z-index fix).
  const zIndex = await page.locator('.oh-products').first().evaluate((el) => getComputedStyle(el).zIndex);
  expect(zIndex, '.oh-products z-index puts the menu above the table bar').toBe('50');

  // …and the menu actually opens + is visible (behavior, not just CSS).
  await page.locator('.oh-products__btn').first().click();
  await expect(page.locator('.oh-products__menu').first(), 'products dropdown menu opens').toBeVisible({ timeout: 10_000 });

  expectNoConsoleErrors(sink, 'Order History (#42 display name + #44 dropdown z-index)');
});

// #46 — Accounting nav order
test('Accounting nav tabs are in the requested order', async ({ page }) => {
  await loginViaMagicLink(page);
  const sink = captureConsoleErrors(page);

  await openAccountingApp(page);

  const expected = [
    'Journal Entries',
    'Batch Status',
    'Batch Approvals',
    'Chart of Accounts',
    'Companies',
    'Dimensions',
    'Trial Balance & AR',
    'Revenue & Tax',
    'Intercompany Flow',
  ];
  // Assert each expected label appears, and that consecutive pairs are in order in the DOM.
  for (const label of expected) {
    await expect(page.getByText(label, { exact: true }).first(), `${label} nav item`).toBeVisible({ timeout: 20_000 });
  }
  const order = await page.evaluate((labels) => {
    const texts = Array.from(document.querySelectorAll('a, button, li, span'))
      .map((el) => (el.textContent ?? '').trim());
    return labels.map((l) => texts.indexOf(l));
  }, expected);
  const present = order.filter((i) => i >= 0);
  const sorted = [...present].sort((a, b) => a - b);
  expect(present, 'nav labels appear in the requested sequence').toEqual(sorted);

  expectNoConsoleErrors(sink, 'Accounting nav order (#46)');
});
