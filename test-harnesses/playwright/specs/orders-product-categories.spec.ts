/**
 * Orders → "Product Categories" nav item (ProductCategoryTreeDashboard) — the category tree +
 * per-category product-membership panel. NOT covered by the existing orders specs
 * (orders-product-catalog covers the Product CATALOG page; this is the separate Categories tree).
 *
 * Committed in the accounting harness because bizapps-orders has no Playwright harness of its own yet.
 * Presence + behavior, non-mutating.
 *
 * NOTE on data: the demo catalog seed (seed-demo-catalog.ts) seeds Product TYPES + Products but NOT
 * Product Categories, so the tree may be empty on a fresh instance. The primary behavior assertion
 * here (opening the "New Category" create dialog) is therefore seed-INDEPENDENT; the node-drill
 * assertion is guarded on whether category nodes actually render.
 *
 * Fails on any console/pageerror.
 */
import { test, expect, Page } from '@playwright/test';
import { loginViaMagicLink } from '../lib/auth';
import { captureConsoleErrors, expectNoConsoleErrors, openNavItem } from '../lib/explorer';

async function openApp(page: Page, namePrefix: string, urlFragment: RegExp): Promise<void> {
  await page.locator('.app-switcher-button, [aria-label="Switch application"]').first().click();
  const item = page.locator('.app-switcher-item', { hasText: new RegExp(`^${namePrefix}`, 'i') }).first();
  await expect(item, `${namePrefix} app in the switcher`).toBeVisible({ timeout: 15_000 });
  await item.scrollIntoViewIfNeeded();
  await item.click();
  await expect(page).toHaveURL(urlFragment, { timeout: 30_000 });
  await page.waitForTimeout(3000);
}

// PRESENCE + BEHAVIOR (seed-independent) — the page renders and "New Category" opens the create dialog.
test('Product Categories — page renders and "New Category" opens the create dialog', async ({ page }) => {
  await loginViaMagicLink(page);
  const sink = captureConsoleErrors(page);

  await openApp(page, 'Orders', /\/app\/orders\//i);
  await openNavItem(page, 'Product Categories');

  // Presence — header subtitle + the "categories" stat badge + the primary "New Category" action.
  await expect(page.getByText('The category hierarchy', { exact: false }).first(), 'Product Categories subtitle').toBeVisible({ timeout: 30_000 });
  await expect(page.locator('mj-stat-badge', { hasText: /categories/i }).first(), 'categories stat badge').toBeVisible();
  const newBtn = page.getByRole('button', { name: /New Category/i }).first();
  await expect(newBtn, 'New Category action present').toBeVisible();

  // BEHAVIOR — clicking "New Category" opens the entity-form create dialog (drives MJFormPresenterService).
  await newBtn.click();
  const dialog = page.locator('mj-form-dialog, .mj-dialog, [role="dialog"]').filter({ hasText: /Categor/i }).first();
  await expect(dialog, 'create-category dialog opens').toBeVisible({ timeout: 20_000 });

  // Non-mutating — dismiss the dialog without saving (prefer an explicit Cancel/Close, fall back to Escape).
  const cancel = page.getByRole('button', { name: /^(Cancel|Close)$/i }).first();
  if (await cancel.count()) {
    await cancel.click();
  } else {
    await page.keyboard.press('Escape');
  }
  await expect(dialog, 'dialog closes without saving').toBeHidden({ timeout: 15_000 });

  expectNoConsoleErrors(sink, 'Product Categories page + New Category dialog');
});

// BEHAVIOR (data-dependent, guarded) — selecting a category node opens its product-membership panel.
test('Product Categories — selecting a node opens the product-membership panel', async ({ page }) => {
  await loginViaMagicLink(page);
  const sink = captureConsoleErrors(page);

  await openApp(page, 'Orders', /\/app\/orders\//i);
  await openNavItem(page, 'Product Categories');
  await expect(page.getByText('The category hierarchy', { exact: false }).first(), 'Product Categories subtitle').toBeVisible({ timeout: 30_000 });

  const nodes = page.locator('.ct-node');
  const nodeCount = await nodes.count();

  if (nodeCount === 0) {
    // No seeded categories on this instance → the tree shows the empty-state. Assert it (real presence
    // check) and skip the node-drill. NOTE for the run agent: the demo catalog seed does not create
    // categories, so create one via "New Category" (or extend the seed) to exercise this path.
    await expect(page.locator('mj-empty-state', { hasText: /No categories/i }).first(), 'empty-state when no categories').toBeVisible();
    test.info().annotations.push({ type: 'note', description: 'No category nodes present — node-drill assertion skipped; seed/create categories to cover it.' });
    expectNoConsoleErrors(sink, 'Product Categories (empty tree)');
    return;
  }

  // Drill: click the first node → the product-membership side panel opens for that category.
  const firstNode = nodes.first();
  const nodeName = (await firstNode.locator('.ct-name').first().textContent())?.trim() ?? '';
  await firstNode.click();

  const panel = page.locator('.ct-panel').first();
  await expect(panel, 'product-membership panel opens on node select').toBeVisible({ timeout: 15_000 });
  await expect(panel.getByText(/Products in/i).first(), 'panel header names the category').toBeVisible();
  // The panel either lists product checkboxes or shows its own "no products yet" empty message —
  // both are valid states; assert the panel body rendered one of them (behavior, not liveness).
  const hasProducts = await panel.locator('.ct-product').count();
  const hasEmpty = await panel.locator('.ct-panel__empty').count();
  expect(hasProducts + hasEmpty, 'panel renders either product rows or its empty message').toBeGreaterThan(0);

  // Close the panel — non-mutating; selection clears.
  await panel.locator('button[title="Close"]').first().click();
  await expect(panel, 'panel closes').toBeHidden({ timeout: 10_000 });

  test.info().annotations.push({ type: 'note', description: `Selected category node "${nodeName}".` });
  expectNoConsoleErrors(sink, 'Product Categories node drill');
});
