/**
 * PRIORITY 1 — Batch Status page (enhanced 2026-07-08): filter bar + sortable table + expandable JE detail.
 *
 * Presence AND behavior (TEST-PROTOCOL.md), over the batches already in the instance DB:
 *   - the status toggle bar (All + per-status), Company / Target-ERP / From / To filters, and Build Batch render;
 *   - the batch table renders rows with the new date-range columns (Start/End replace Batch#);
 *   - clicking a batch row EXPANDS an indented journal-entry detail table (its Dr/Cr lines);
 *   - a status toggle filters the table;
 *   - no console/pageerror the whole time.
 * A screenshot of the expanded state is saved for evidence.
 */
import { test, expect } from '@playwright/test';
import { loginViaMagicLink } from '../lib/auth';
import { captureConsoleErrors, expectNoConsoleErrors, openAccountingApp, openNavItem } from '../lib/explorer';

const SHOTS = '/Users/marcelotorres/MJDev/reports/batch-status-enh/shots';

test('Batch Status — filters + sortable table + expandable JE detail render and work', async ({ page }) => {
  await loginViaMagicLink(page);
  const sink = captureConsoleErrors(page);

  await openAccountingApp(page);
  await openNavItem(page, 'Batch Status');

  // Header + the new filter controls are present.
  await expect(page.getByText('Batch Status', { exact: true }).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('button', { name: 'All', exact: true }).first(), 'status "All" toggle').toBeVisible();
  await expect(page.getByRole('button', { name: /Posted/i }).first(), 'a per-status toggle').toBeVisible();
  await expect(page.getByRole('button', { name: /Build Batch/i }).first(), 'in-page Build Batch').toBeVisible();
  await expect(page.locator('input[type="date"]').first(), 'time-span From/To date inputs').toBeVisible();

  // The batch table renders rows (the instance already has batches), with the Start/End date-range headers.
  await expect(page.locator('.bs-table').first(), 'the batch table').toBeVisible({ timeout: 20_000 });
  await expect(page.locator('.bs-table thead th', { hasText: 'Start' }).first(), 'Start date column').toBeVisible();
  await expect(page.locator('.bs-table thead th', { hasText: 'End' }).first(), 'End date column').toBeVisible();
  const rows = page.locator('tr.bs-row');
  await expect(rows.first(), 'at least one batch row').toBeVisible({ timeout: 20_000 });

  // Expand the first batch → its indented journal-entry detail appears.
  await rows.first().click();
  await expect(page.locator('.bs-detail').first(), 'the expanded, indented JE detail block').toBeVisible({ timeout: 20_000 });
  // Either the detail table (batch has entries) or the "no journal entries" note — both are valid; wait for one.
  await expect(
    page.locator('.bs-detail-table, .bs-detail__empty').first(),
    'the detail shows an entry table or an empty note',
  ).toBeVisible({ timeout: 20_000 });
  await page.screenshot({ path: `${SHOTS}/batch-status-expanded.png`, fullPage: true });

  // A status toggle filters the table (click "Posted" → every visible row is Posted).
  await page.getByRole('button', { name: /^\s*Posted\s*$/i }).first().click();
  await page.waitForTimeout(800);
  const pills = page.locator('tr.bs-row .bs-pill');
  const n = await pills.count();
  for (let i = 0; i < Math.min(n, 8); i++) {
    await expect(pills.nth(i)).toHaveText(/Posted/i);
  }

  expectNoConsoleErrors(sink, 'exercising the Batch Status filters + expand');
});
