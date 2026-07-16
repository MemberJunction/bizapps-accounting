/**
 * TIER-5 — Journal Entries Console dashboard (JournalEntryConsoleDashboardComponent).
 *
 * Closes the testing.md coverage gap for the JE Console (previously only ad-hoc headed walks). Drives
 * the dashboard the way a user does — activate the Accounting app, open the "Journal Entries" nav item
 * — and asserts BOTH presence AND behavior per TEST-PROTOCOL.md:
 *   1. Status filter chips (Pending / Batched / GLPosted) — present, and clicking one actually filters
 *      the list (every visible row's status pill matches the chosen status).
 *   2. Expand a row → its balanced Dr/Cr line table renders with real debit/credit values + footed totals;
 *      the source-order drill opens the Order form dialog when the entry was booked from an order.
 *   3. Generate reversal — the reversal action drives the real engine and reports the new reversing entry.
 *
 * Selectors were read from the component template (je-console-dashboard.component.html) + class
 * (je-console-dashboard.component.ts): `.je-chip` filter chips, `.je-row`/`.je-row__head` rows,
 * `.je-pill` status pill, `.je-detail`/`.je-table` expanded lines, `.je-actions` buttons.
 *
 * Every test wires the console/pageerror keystone (captureConsoleErrors) and asserts it is clean.
 *
 * Demo data (seed-demo.ts): 3 companies with GLPosted JEs — so GLPosted-status rows are guaranteed.
 * Assertions reflect that state (they do not assume Pending/Batched rows exist).
 */
import { test, expect, type Page } from '@playwright/test';
import { loginViaMagicLink } from '../lib/auth';
import { captureConsoleErrors, expectNoConsoleErrors, openAccountingApp, openNavItem, pageBody, type ErrorSink } from '../lib/explorer';
import { NAV } from '../lib/env';

test.beforeEach(async ({ page }) => {
  await loginViaMagicLink(page);
});

/** Open the app + the Journal Entries (JE Console) dashboard; return the error sink. */
async function gotoJEConsole(page: Page): Promise<ErrorSink> {
  const sink = captureConsoleErrors(page);
  await openAccountingApp(page);
  await openNavItem(page, NAV.journalEntries);
  await expect(pageBody(page), 'JE Console dashboard body should render').toBeVisible({ timeout: 30_000 });
  return sink;
}

test('JE Console — status filter chips render and actually filter the ledger to GLPosted', async ({ page }) => {
  const sink = await gotoJEConsole(page);

  // PRESENCE — the filter toolbar: search box + the All / Pending / Batched / GLPosted chips.
  await expect(page.locator('.je-searchbox input'), 'JE Console should show the search box').toBeVisible();
  await expect(page.locator('.je-chip', { hasText: /^All$/ }).first(), 'the "All" filter chip should render').toBeVisible();
  for (const s of ['Pending', 'Batched', 'GLPosted']) {
    await expect(page.locator('.je-chip').filter({ hasText: new RegExp(`^${s}$`) }).first(), `the "${s}" status chip should render`).toBeVisible();
  }

  // The seed leaves GLPosted JEs → a GLPosted row must be present under the default "All" filter.
  await expect(page.locator('.je-row').first(), 'at least one journal-entry row should render over the demo JEs').toBeVisible({ timeout: 20_000 });
  await expect(page.locator('.je-pill', { hasText: /GLPosted/ }).first(), 'a GLPosted status pill should render (value reached the DOM)').toBeVisible({ timeout: 15_000 });

  // BEHAVIOR — click the GLPosted chip; the chip becomes active AND every visible row is GLPosted.
  const glChip = page.locator('.je-chip').filter({ hasText: /^GLPosted$/ }).first();
  await glChip.click();
  await page.waitForTimeout(1500);
  await expect(glChip, 'the GLPosted chip should be marked active after clicking').toHaveClass(/je-chip--on/);
  const pills = page.locator('.je-row .je-pill');
  const pillCount = await pills.count();
  expect(pillCount, 'filtering to GLPosted should leave at least one matching row').toBeGreaterThan(0);
  for (let i = 0; i < pillCount; i++) {
    await expect(pills.nth(i), 'every visible row after filtering must be GLPosted').toHaveText(/GLPosted/);
  }

  expectNoConsoleErrors(sink, 'filtering the JE Console by status chip');
});

test('JE Console — expanding a row shows its balanced Dr/Cr lines with footed totals', async ({ page }) => {
  const sink = await gotoJEConsole(page);

  const firstRow = page.locator('.je-row').first();
  await expect(firstRow, 'a journal-entry row should render').toBeVisible({ timeout: 20_000 });

  // BEHAVIOR — expand the row; its balanced line table renders (lazily loaded from JE Lines).
  await firstRow.locator('.je-row__head').click();
  await page.waitForTimeout(2500);

  const detail = firstRow.locator('.je-detail');
  await expect(detail, 'the expanded detail panel should render').toBeVisible({ timeout: 15_000 });
  const table = detail.locator('table.je-table');
  await expect(table, 'the expanded entry should show its Dr/Cr line table').toBeVisible();
  // Column headers prove the Dr/Cr shape reached the DOM.
  await expect(table.locator('thead th', { hasText: /Debit/ }).first(), 'the line table should have a Debit column').toBeVisible();
  await expect(table.locator('thead th', { hasText: /Credit/ }).first(), 'the line table should have a Credit column').toBeVisible();
  // At least one data line + a footed Totals row (real values, not an empty grid).
  await expect(table.locator('tbody tr').first(), 'the expanded entry should have at least one line').toBeVisible();
  await expect(table.locator('tfoot .je-total').first(), 'the line table should show footed totals').toBeVisible();

  // Source-order drill: only entries booked from an Order carry the button. When present, it must open
  // the Order form dialog (real navigation behavior). Conditional because demo JEs may be manually seeded
  // without an OrderID — asserted only when the control is actually rendered.
  const sourceOrderBtn = detail.getByRole('button', { name: /Source order/i }).first();
  if (await sourceOrderBtn.count()) {
    await sourceOrderBtn.click();
    await page.waitForTimeout(6000);
    await expect(
      page.locator('mj-record-form-container').first(),
      'clicking "Source order" should open the source Order form dialog',
    ).toBeVisible({ timeout: 30_000 });
  }

  expectNoConsoleErrors(sink, 'expanding a JE Console row to its Dr/Cr lines (+ optional source-order drill)');
});

test('JE Console — "Generate reversal" drives the engine and reports the new reversing entry', async ({ page }) => {
  const sink = await gotoJEConsole(page);

  // Find a not-yet-reversed entry (its expanded actions offer "Generate reversal"). MUTATION: this posts a
  // balanced reversing JE via the GenerateReversal mutation — intentional; the instance permits it. We assert
  // on the resulting status banner (the real engine result reaching the UI), not on a pre-seeded value.
  // Pick a REVERSIBLE entry — one that is neither already-reversed nor itself a reversal (i.e. no
  // reversal/reversed `.je-tag`). A reversal/reversed entry correctly offers no action now (that's the
  // separate guard test below), so grabbing `.je-row` first() blindly can land on one and see no button.
  const reversibleRow = page.locator('.je-row').filter({ hasNot: page.locator('.je-tag') }).first();
  if (!(await reversibleRow.count())) {
    test.info().annotations.push({ type: 'note', description: 'no reversible (untagged) entry present to exercise the reversal flow' });
    expectNoConsoleErrors(sink, 'generating a JE reversal from the JE Console');
    return;
  }
  await expect(reversibleRow, 'a reversible journal-entry row should render').toBeVisible({ timeout: 20_000 });
  await reversibleRow.locator('.je-row__head').click();
  await page.waitForTimeout(2500);

  // A reversible entry must offer "Generate reversal"; exercise it and assert the engine result reaches the UI.
  const reverseBtn = reversibleRow.locator('.je-detail').getByRole('button', { name: /Generate reversal/i }).first();
  await expect(reverseBtn, 'a reversible entry should offer an enabled "Generate reversal" action').toBeEnabled({ timeout: 15_000 });
  await reverseBtn.click();
  await page.waitForTimeout(7000);
  // BEHAVIOR — the reversal engine result reaches the UI as a success banner naming the new entry.
  await expect(
    page.locator('.je-banner--success').filter({ hasText: /Reversed/i }).first(),
    'reversing should report success + the new reversing entry number',
  ).toBeVisible({ timeout: 20_000 });

  expectNoConsoleErrors(sink, 'generating a JE reversal from the JE Console');
});

test('JE Console — a reversal entry does NOT offer "Generate reversal" (guard: no reversing a reversal)', async ({ page }) => {
  const sink = await gotoJEConsole(page);

  // A reversal entry carries the "reversal" tag (ReversesJournalEntryID set / EntryType 'Reversal').
  // /reversal/ uniquely matches that tag (the other tag reads "reversed", which does not contain "reversal").
  const reversalRow = page.locator('.je-row')
    .filter({ has: page.locator('.je-tag', { hasText: /reversal/i }) })
    .first();

  if (await reversalRow.count()) {
    await reversalRow.locator('.je-row__head').click();
    await page.waitForTimeout(2000);
    // The CanReverse guard must hide "Generate reversal" on a reversal entry (mirrors the server guard).
    await expect(
      reversalRow.locator('.je-detail').getByRole('button', { name: /Generate reversal/i }),
      'a reversal entry must NOT offer a "Generate reversal" action',
    ).toHaveCount(0);
  } else {
    test.info().annotations.push({ type: 'note', description: 'no reversal entry present to assert the guard against (skipped that branch)' });
  }

  expectNoConsoleErrors(sink, 'asserting the reversal-entry guard in the JE Console');
});
