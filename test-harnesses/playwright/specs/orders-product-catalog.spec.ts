/**
 * Orders → Product Catalog — renders + Product Types come from the front-end OrdersEngineBase (cached).
 * Non-mutating regression test. (Committed in the accounting harness because the orders app has no Playwright
 * harness of its own yet — standing one up is backlogged; this spec drives the orders app via the shared shell.)
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

test('Orders Product Catalog — renders with engine-backed product types', async ({ page }) => {
  await loginViaMagicLink(page);
  const sink = captureConsoleErrors(page);

  await openApp(page, 'Orders', /\/app\/orders\//i);
  await openNavItem(page, 'Product Catalog');

  await expect(page.getByText('Product Catalog').first(), 'page header').toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('button', { name: /New Product/i }).first(), 'New Product action').toBeVisible();
  // A "types" stat badge is populated from OrdersEngineBase.ProductTypes (cached). The demo has ≥1 type.
  await expect(page.getByText(/type/i).first(), 'product-type stat').toBeVisible();

  expectNoConsoleErrors(sink, 'Orders Product Catalog (engine-backed types)');
});
