/**
 * Explorer driving helpers for the bizapps-accounting GUI harness.
 *
 *  - `captureConsoleErrors(page)` — the KEYSTONE. Wires console.error + pageerror capture; the
 *    spec asserts the collected list is empty so silent UI bugs become test failures.
 *  - `openAccountingApp(page)` — open the app-switcher and activate the Accounting app.
 *  - `openNavItem(page, label)` — click a left-rail nav item by its label.
 *  - small DOM readers used by the assertions (company select, ag-grid rows, etc.).
 *
 * Selectors were validated against the live instance (recon). The shell uses PathLocationStrategy;
 * deep-link `goto` is unreliable on a fresh shell, so we navigate by CLICK (what a user does) which
 * the shell fully supports.
 */
import { expect, type Page, type Locator } from '@playwright/test';
import { ACCOUNTING_APP_NAME } from './env';

/** Benign console.error substrings that are known framework noise, not app bugs. Keep this TIGHT. */
const IGNORED_CONSOLE_PATTERNS: RegExp[] = [
  // The provider logs this when loading an entity that carries virtual/extra fields — documented
  // non-fatal noise (see test-harnesses/harness-notes.md lesson #9). Matches server + client.
  /MISSING FIELDS.*SetMany/i,
  // NOTE: 404s are NOT blanket-ignored anymore — they're handled url-aware in the console handler
  // below, so a 404 on a STATIC ASSET is benign noise but a 404 on an API/GraphQL/data request
  // stays a REAL signal. A blanket 404 filter would mask genuine backend failures.
];

export interface ErrorSink {
  /** Every captured console.error / pageerror message (after filtering known-benign noise). */
  errors: string[];
}

/**
 * Wire console.error + pageerror capture. The returned sink accumulates messages for the life of
 * the page. Assert `sink.errors` is empty at the end of each navigation to fail on silent UI bugs.
 */
export function captureConsoleErrors(page: Page): ErrorSink {
  const sink: ErrorSink = { errors: [] };
  const benign = (msg: string) => IGNORED_CONSOLE_PATTERNS.some((re) => re.test(msg));
  page.on('console', (m) => {
    if (m.type() === 'error') {
      const text = m.text();
      const url = m.location()?.url ?? '';
      // A 404 on a STATIC/optional asset (favicon, icon, sourcemap) is benign noise; a 404 on any
      // OTHER url — an API / GraphQL / data request — is a REAL signal and must NOT be suppressed.
      const assetNoise = /status of 404/i.test(text) && /(favicon\.ico|\.(?:ico|png|svg|gif|map))(?:\?|$)/i.test(url);
      if (!benign(text) && !assetNoise) sink.errors.push(`console.error: ${text}${url ? ` [${url}]` : ''}`);
    }
  });
  page.on('pageerror', (e) => {
    const text = e.message;
    if (!benign(text)) sink.errors.push(`pageerror: ${text}`);
  });
  return sink;
}

/** Assert no UI errors were captured; on failure the message lists them all. */
export function expectNoConsoleErrors(sink: ErrorSink, context: string): void {
  expect(sink.errors, `Console/page errors captured while ${context}:\n  - ${sink.errors.join('\n  - ')}`).toEqual([]);
}

/** Open the top-left app-switcher and activate the Accounting app. */
export async function openAccountingApp(page: Page): Promise<void> {
  await page.locator('.app-switcher-button, [aria-label="Switch application"]').first().click();
  const item = page.locator('.app-switcher-item', { hasText: new RegExp(`^${ACCOUNTING_APP_NAME}`) }).first();
  await expect(item, 'Accounting app must appear in the app-switcher (else MJAPI metadata is stale — restart it)').toBeVisible({ timeout: 15_000 });
  await item.scrollIntoViewIfNeeded();
  await item.click();
  // The app activates and opens its default nav item (Batches). Wait for the rail to render.
  await expect(page).toHaveURL(/\/app\/accounting\//i, { timeout: 30_000 });
  await page.waitForTimeout(3000);
}

/** Click a left-rail nav item by its exact label and let the dashboard render. */
export async function openNavItem(page: Page, label: string): Promise<void> {
  const item = page.getByText(label, { exact: true }).first();
  await item.scrollIntoViewIfNeeded().catch(() => undefined);
  await item.click();
  await page.waitForTimeout(4500);
}

/** The company <select> options (excludes disabled placeholders). */
export async function companyOptions(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll('select option')]
      .filter((o) => !(o as HTMLOptionElement).disabled)
      .map((o) => (o.textContent || '').trim())
      .filter((t) => t.length > 0),
  );
}

/** Select a company by its (partial) visible label in the first company <select> on the page. */
export async function selectCompany(page: Page, labelContains: string): Promise<void> {
  const select = page.locator('select').first();
  await select.selectOption({ label: (await select.locator('option', { hasText: labelContains }).first().textContent())?.trim() || labelContains });
  await page.waitForTimeout(3500);
}

/**
 * Rendered ag-grid data rows in the custom dashboards (they use `<ag-grid-angular>` whose data
 * rows live in `.ag-center-cols-container .ag-row`).
 */
export function agGridRows(page: Page): Locator {
  return page.locator('.ag-center-cols-container .ag-row');
}

/**
 * Data rows of the MJ entity grid (the User-Views nav items — GL Accounts / Journal Entries).
 * That grid is AG-Grid-based but exposes ARIA roles, so we read by role which is theme/DOM-robust:
 * every data row is an ARIA `row` containing `gridcell`s (header rows contain `columnheader`).
 *
 * NOTE: AG Grid VIRTUALIZES + absolutely-positions rows, so `.first().toBeVisible()` is unreliable
 * (the DOM-first row can be transformed off the rendered band). Use this for COUNT assertions; for
 * a presence assertion prefer a specific `getByRole('gridcell', { name })` which is in the viewport.
 */
export function entityGridRows(page: Page): Locator {
  return page.getByRole('row').filter({ has: page.getByRole('gridcell') });
}

/** A specific entity-grid cell by its (regex) text — viewport-rendered, so robust for presence. */
export function entityGridCell(page: Page, name: RegExp): Locator {
  return page.getByRole('gridcell', { name }).first();
}

/** The dashboard page body (present once a dashboard, not Home, is rendered). */
export function pageBody(page: Page): Locator {
  return page.locator('mj-page-body');
}
