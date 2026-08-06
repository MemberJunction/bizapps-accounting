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
  // UPSTREAM MJ-core bug (NOT this app): the Explorer home Data Explorer widget's relative-time
  // binding ("12m ago") ticks across a change-detection pass → dev-mode NG0100. Timing-dependent
  // (fires when a CD cycle spans a minute boundary), component is MJ core's
  // DataExplorerDashboardComponent. Logged in the instance BUGS.md 2026-07-06 for upstream MJ.
  // Scoped to THAT component only so a real NG0100 in the accounting UI still fails the keystone.
  /NG0100: ExpressionChangedAfterItHasBeenCheckedError[\s\S]*DataExplorerDashboardComponent/,
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
  await page.locator('.app-switcher-button, [aria-label*="Switch application"]').first().click();
  // MJ 5.51 replaced the old `.app-switcher-item` list with an "Application launcher" dialog whose
  // entries are LINKS (accessible name = the app name). Target by role, old class as fallback.
  const item = page
    .getByRole('link', { name: ACCOUNTING_APP_NAME, exact: true })
    .or(page.locator('.app-switcher-item', { hasText: new RegExp(`^${ACCOUNTING_APP_NAME}`) }))
    .first();
  await expect(item, 'Accounting app must appear in the app-switcher (else MJAPI metadata is stale — restart it)').toBeVisible({ timeout: 15_000 });
  await item.scrollIntoViewIfNeeded();
  await item.click();
  // The app activates and opens its default nav item (Batches). Wait for the rail to render.
  await expect(page).toHaveURL(/\/app\/accounting\//i, { timeout: 30_000 });
  await page.waitForTimeout(3000);
}

/** Click a left-rail nav item by its exact label and let the dashboard render. */
export async function openNavItem(page: Page, label: string): Promise<void> {
  let item = page.getByText(label, { exact: true }).first();
  // MJ 5.51 top-nav folds categories that don't fit the viewport into a "More navigation items"
  // overflow. If the label isn't visible inline, open the overflow and re-resolve.
  if (!(await item.isVisible().catch(() => false))) {
    const more = page.getByRole('button', { name: /More navigation items/i }).first();
    if (await more.isVisible().catch(() => false)) {
      await more.click();
      await page.waitForTimeout(400);
      item = page.getByText(label, { exact: true }).first();
    }
  }
  await item.scrollIntoViewIfNeeded().catch(() => undefined);
  await item.click();
  await page.waitForTimeout(4500);
}

/**
 * Reset the header company-scope chip to "All companies" (idempotent). The scope persists
 * per user, so a previous session's narrowing (e.g. a human clicking around) would otherwise
 * hide the fixture company's rows from every list page and the spec would fail on an empty
 * grid. SelectAll() does NOT close the menu (it closes on outside click), so we click the
 * page body afterwards.
 */
export async function resetCompanyScopeToAll(page: Page): Promise<void> {
  const chip = page.locator('.scope-chip__btn').first();
  await chip.waitFor({ state: 'visible', timeout: 20_000 });
  if (/all companies/i.test((await chip.textContent()) ?? '')) return;
  await chip.click();
  const all = page.locator('.scope-chip__all').first();
  await all.waitFor({ state: 'visible', timeout: 10_000 });
  await all.click();
  // Close on a NEUTRAL spot (the category title area) — x:4 was over the collapsed rail and
  // triggered its hover-peek overlay, which then intercepted the next content click.
  await page.locator('body').click({ position: { x: 500, y: 70 } });
  await page.waitForTimeout(3000); // pages re-query on scope change
}

/**
 * Narrow the header company scope to EXACTLY the named company (from All). Batch builds sweep
 * every company in scope and the CFO precondition must hold for each — so batch specs scope to
 * their fixture company: true isolation from demo/other data, and the fixture's CFO satisfies
 * the gate. Assumes the scope is currently All (call resetCompanyScopeToAll first).
 */
export async function scopeToCompany(page: Page, nameContains: string): Promise<void> {
  const chip = page.locator('.scope-chip__btn').first();
  await chip.waitFor({ state: 'visible', timeout: 20_000 });
  await chip.click();
  const item = page.locator('.scope-chip__item', { hasText: nameContains }).first();
  await item.waitFor({ state: 'visible', timeout: 10_000 });
  await item.click(); // Toggle from All(empty) → exactly this company
  await page.locator('body').click({ position: { x: 500, y: 70 } }); // neutral close (see above)
  await page.waitForTimeout(3000); // pages re-query on scope change
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
