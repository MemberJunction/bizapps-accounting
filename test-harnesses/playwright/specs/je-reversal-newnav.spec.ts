/**
 * TIER 5 (new nav) — the JE REVERSAL drill on the UI-wave category rails (#440, #459).
 * User 1 builds a batch on the Batches page; User 2 (the CFO) approves and dispatches it so its JEs
 * become GLPosted; User 1 then opens one from "All journal entries" and reverses it.
 */
import { test, expect, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { loginViaMagicLink, loginAsEmailViaMagicLink } from '../lib/auth';
import { openAccountingApp, openNavItem, captureConsoleErrors, expectNoConsoleErrors, resetCompanyScopeToAll, scopeToCompany } from '../lib/explorer';
import { HARNESS_DIR } from '../lib/env';
import { REPO_ROOT, TSX_BIN } from '../../harness-paths.mjs';

const FIXTURE = path.resolve(HARNESS_DIR, 'lib', 'batching-fixture.ts');
let fx: { companyId: string; companyName: string; cfoPersonId: string; cfoEmail: string; runTag: string; jeEntryNumber: string } | null = null;

test.beforeAll(() => {
  const out = execFileSync(TSX_BIN, [FIXTURE, 'setup'], { cwd: REPO_ROOT, encoding: 'utf8', timeout: 180_000 });
  const line = out.split('\n').find((l) => l.startsWith('FIXTURE_JSON '));
  if (!line) throw new Error(`batching-fixture setup emitted no FIXTURE_JSON:\n${out.slice(-500)}`);
  fx = JSON.parse(line.slice('FIXTURE_JSON '.length));
});
test.afterAll(() => {
  if (fx) { try { execFileSync(TSX_BIN, [FIXTURE, 'teardown', fx.companyId, fx.cfoPersonId], { cwd: REPO_ROOT, encoding: 'utf8', timeout: 180_000 }); } catch { /* best-effort */ } }
});

async function railItem(page: Page, category: string, item: string): Promise<void> {
  await openNavItem(page, category);
  await page.getByRole('button', { name: new RegExp('^' + item + '( \\d+)?$') }).first().click();
  await page.mouse.move(820, 480);
  await page.waitForTimeout(3500);
}

test('Build→approve→dispatch, then Reverse the GLPosted JE from All journal entries (new nav)', async ({ page, browser }) => {
  const sink = captureConsoleErrors(page);
  await loginViaMagicLink(page);
  await openAccountingApp(page);
  await resetCompanyScopeToAll(page);
  await scopeToCompany(page, fx!.companyName);

  // 1. User 1 builds the batch on the Batches page.
  await openNavItem(page, 'Batches');
  const openModalBtn = page.getByRole('button', { name: /Build (First )?Batch/i }).first();
  await expect(openModalBtn).toBeVisible({ timeout: 30_000 });
  await openModalBtn.click();
  const buildBtn = page.getByRole('button', { name: /Build Batch \(\d+\)/i }).first();
  await expect(buildBtn, 'Build Batch (N) enables once candidates load').toBeEnabled({ timeout: 30_000 });
  await buildBtn.click();
  await page.waitForTimeout(6000);

  // 2. User 2 (CFO) approves and dispatches the batch so its JEs reach GLPosted.
  const cfoContext = await browser.newContext();
  const cfoPage = await cfoContext.newPage();
  const cfoSink = captureConsoleErrors(cfoPage);
  try {
    await loginAsEmailViaMagicLink(cfoPage, fx!.cfoEmail);
    await openAccountingApp(cfoPage);
    await resetCompanyScopeToAll(cfoPage);
    await scopeToCompany(cfoPage, fx!.companyName);
    await openNavItem(cfoPage, 'Batches');

    const pendingRow = cfoPage.locator('tr').filter({ hasText: fx!.companyName }).filter({ has: cfoPage.getByRole('button', { name: /^Approve$/i }) }).first();
    await expect(pendingRow).toBeVisible({ timeout: 30_000 });
    await pendingRow.getByRole('button', { name: /^Approve$/i }).first().click();
    await cfoPage.waitForTimeout(5000);

    const approvedRow = cfoPage.locator('tr').filter({ hasText: fx!.companyName }).filter({ has: cfoPage.getByRole('button', { name: /^Dispatch$/i }) }).first();
    await expect(approvedRow).toBeVisible({ timeout: 20_000 });
    await approvedRow.getByRole('button', { name: /^Dispatch$/i }).first().click();
    await expect(cfoPage.getByText(/Dispatched batch .+→ Posted/i).first(), 'batch reached Posted (JEs now GLPosted)').toBeVisible({ timeout: 20_000 });
    expectNoConsoleErrors(cfoSink, 'CFO approve→dispatch in JE reversal flow');
  } finally {
    await cfoContext.close();
  }

  // 3. Open All journal entries and select THIS fixture's JE by its UNIQUE EntryNumber.
  await railItem(page, 'Journal Entries', 'All journal entries');
  const search = page.getByRole('searchbox', { name: /Search journal entries/i }).first();
  await expect(search, 'the list-toolbar search renders').toBeVisible({ timeout: 15_000 });
  await search.fill(fx!.jeEntryNumber);
  await page.waitForTimeout(3000);
  const fixtureRow = page.locator('.ag-row').filter({ hasText: fx!.jeEntryNumber }).first();
  await expect(fixtureRow, `the fixture JE ${fx!.jeEntryNumber} (GLPosted after dispatch) should be present`).toBeVisible({ timeout: 30_000 });
  await fixtureRow.click();
  await page.waitForTimeout(2500);

  // 4. Reverse the GLPosted fixture JE — the app confirms "Reversed <N> → new entry <M>".
  const reverseBtn = page.getByRole('button', { name: /^Reverse/i }).first();
  await expect(reverseBtn, 'the detail panel offers Reverse for a GLPosted, not-yet-reversed JE').toBeVisible({ timeout: 15_000 });
  await reverseBtn.click();
  await expect(
    page.getByText(/Reversed .+→ new entry/i).first(),
    'reversing a GLPosted JE generates a new reversing entry and the UI confirms it',
  ).toBeVisible({ timeout: 20_000 });

  expectNoConsoleErrors(sink, 'the JE reversal drill on the new nav');
});
