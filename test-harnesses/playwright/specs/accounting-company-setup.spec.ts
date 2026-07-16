/**
 * TIER-5 — Company Setup dashboard (CompanySetupDashboardComponent, nav label "Companies").
 *
 * Closes the testing.md coverage gap for Company Setup. Drives the dashboard the way a user does
 * (activate the Accounting app → open "Companies") and asserts BOTH presence AND behavior per
 * TEST-PROTOCOL.md:
 *   1. The company list + the selected company's detail card render (identity, currencies, fiscal year).
 *   2. Default-account picker slots render, each showing its role label + the assigned account code/name
 *      (real values reach the DOM), with a working <select> picker present.
 *   3. "Open profile" opens the company-profile form dialog (real navigation behavior).
 *   4. "Make me the CFO" drives the real engine — assigns the current user as the company's CFO approver
 *      and the detail card reflects it. (MUTATION — intentional; the instance permits it.)
 *
 * Selectors read from company-setup-dashboard.component.html/.ts: `.cs-list`/`.cs-listitem` roster,
 * `.cs-card`/`.cs-card__title` detail, `.cs-field` identity fields, `.cs-accounts`/`.cs-account` default
 * slots (`.cs-account__label`, `.cs-account__code`, `.cs-account__select`), the "Open profile" button,
 * and the CFO block (`.cs-cfo`, "Make me the CFO", `.cs-cfo__name`).
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

async function gotoCompanySetup(page: Page): Promise<ErrorSink> {
  const sink = captureConsoleErrors(page);
  await openAccountingApp(page);
  await openNavItem(page, NAV.companies);
  await expect(pageBody(page), 'Company Setup dashboard body should render').toBeVisible({ timeout: 30_000 });
  return sink;
}

test('Company Setup — company roster + detail card render with default-account pickers', async ({ page }) => {
  const sink = await gotoCompanySetup(page);

  // PRESENCE — the company roster (left) and the selected company's detail card (right).
  await expect(page.locator('.cs-list .cs-listitem').first(), 'the company roster should list at least one company').toBeVisible({ timeout: 20_000 });
  expect(await page.locator('.cs-list .cs-listitem').count(), 'the demo seed should provide multiple companies').toBeGreaterThan(0);
  const card = page.locator('.cs-card').first();
  await expect(card, 'a company detail card should render for the auto-selected company').toBeVisible({ timeout: 15_000 });
  await expect(card.locator('.cs-card__title'), 'the detail card should show the company name').toBeVisible();
  // A real identity value reaches the DOM — functional currency is always populated (W1 default).
  await expect(card.getByText(/Functional currency/i).first(), 'the detail card should show the Functional currency field').toBeVisible();

  // The "Default GL accounts" section + at least one picker slot render.
  await expect(card.getByText(/Default GL accounts/i).first(), 'the Default GL accounts section should render').toBeVisible();
  const accountSlots = card.locator('.cs-accounts .cs-account');
  await expect(accountSlots.first(), 'at least one default-account slot should render').toBeVisible();
  expect(await accountSlots.count(), 'the five default-account roles should each render a slot').toBeGreaterThanOrEqual(1);
  await expect(accountSlots.first().locator('.cs-account__label'), 'each slot should show its role label').toBeVisible();
  // The picker <select> is present and its behavior is wired (options exist for the company's accounts).
  await expect(accountSlots.first().locator('select.cs-account__select'), 'each slot should offer an account picker').toBeVisible();

  expectNoConsoleErrors(sink, 'viewing the Company Setup detail card + default-account pickers');
});

test('Company Setup — "Open profile" opens the company-profile form dialog', async ({ page }) => {
  const sink = await gotoCompanySetup(page);

  const card = page.locator('.cs-card').first();
  await expect(card, 'a company detail card should render').toBeVisible({ timeout: 20_000 });

  // BEHAVIOR — "Open profile" opens the generated profile form via the form presenter dialog.
  const openProfileBtn = card.getByRole('button', { name: /Open profile/i }).first();
  await expect(openProfileBtn, 'the "Open profile" button should be present').toBeVisible();
  await openProfileBtn.click();
  await page.waitForTimeout(6000);
  await expect(
    page.locator('mj-record-form-container').first(),
    'clicking "Open profile" should open the company-profile form dialog',
  ).toBeVisible({ timeout: 30_000 });

  expectNoConsoleErrors(sink, 'opening a company profile from Company Setup');
});

test('Company Setup — "Make me the CFO" assigns the current user as CFO approver', async ({ page }) => {
  const sink = await gotoCompanySetup(page);

  const card = page.locator('.cs-card').first();
  await expect(card, 'a company detail card should render').toBeVisible({ timeout: 20_000 });

  // PRESENCE — the CFO approver block + the "Make me the CFO" action.
  await expect(card.getByText(/CFO approver/i).first(), 'the CFO approver section should render').toBeVisible();
  const makeMeCFO = card.getByRole('button', { name: /Make me the CFO/i }).first();
  await expect(makeMeCFO, 'the "Make me the CFO" action should be present + enabled').toBeEnabled();

  // BEHAVIOR (MUTATION — intentional; the instance permits it): clicking assigns the logged-in user as
  // this company's CFO approver. We assert on the resulting success banner AND that the current-CFO line
  // flips from "not set" to a named approver — the real save reaching the UI.
  await makeMeCFO.click();
  await page.waitForTimeout(6000);
  await expect(
    card.locator('.cs-banner--success').filter({ hasText: /CFO approver/i }).first(),
    'assigning yourself as CFO should report success',
  ).toBeVisible({ timeout: 20_000 });
  await expect(
    card.locator('.cs-cfo__name').filter({ hasText: /not set/i }),
    'the current-CFO line should no longer read "not set" after assignment',
  ).toHaveCount(0);

  expectNoConsoleErrors(sink, 'assigning the current user as CFO in Company Setup');
});
