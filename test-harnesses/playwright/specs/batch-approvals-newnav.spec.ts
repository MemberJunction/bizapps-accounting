/**
 * TIER 5 (new nav) — the two-user CFO batch BEHAVIOR flow on the Batches page (#440, #459):
 * User 1 builds a batch on the Batches page; User 2 (the company's CFO) signs in, approves the
 * Pending batch, and dispatches it to Posted.
 */
import { test, expect, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { loginViaMagicLink, loginAsEmailViaMagicLink } from '../lib/auth';
import { openAccountingApp, openNavItem, captureConsoleErrors, expectNoConsoleErrors, resetCompanyScopeToAll, scopeToCompany } from '../lib/explorer';
import { HARNESS_DIR } from '../lib/env';
import { REPO_ROOT, TSX_BIN } from '../../harness-paths.mjs';

const FIXTURE = path.resolve(HARNESS_DIR, 'lib', 'batching-fixture.ts');
let fx: { companyId: string; companyName: string; cfoPersonId: string; cfoEmail: string } | null = null;

test.beforeAll(() => {
  const out = execFileSync(TSX_BIN, [FIXTURE, 'setup'], { cwd: REPO_ROOT, encoding: 'utf8', timeout: 180_000 });
  const line = out.split('\n').find((l) => l.startsWith('FIXTURE_JSON '));
  if (!line) throw new Error(`batching-fixture setup emitted no FIXTURE_JSON:\n${out.slice(-500)}`);
  fx = JSON.parse(line.slice('FIXTURE_JSON '.length));
});
test.afterAll(() => {
  if (fx) { try { execFileSync(TSX_BIN, [FIXTURE, 'teardown', fx.companyId, fx.cfoPersonId], { cwd: REPO_ROOT, encoding: 'utf8', timeout: 180_000 }); } catch { /* best-effort */ } }
});

async function buildBatchOnBatchesPage(page: Page, companyName: string): Promise<void> {
  await resetCompanyScopeToAll(page);
  await scopeToCompany(page, companyName);
  await openNavItem(page, 'Batches');

  const openModalBtn = page.getByRole('button', { name: /Build (First )?Batch/i }).first();
  await expect(openModalBtn, 'the Batches page offers Build Batch').toBeVisible({ timeout: 30_000 });
  await openModalBtn.click();

  const confirmBtn = page.getByRole('button', { name: /Build Batch \(\d+\)/i }).first();
  await expect(confirmBtn, 'Build Batch (N) enables once candidate entries load').toBeEnabled({ timeout: 30_000 });
  await confirmBtn.click();
  await page.waitForTimeout(6000);
}

test('Batches → User 1 builds → User 2 (CFO) Approves → Dispatches to Posted', async ({ page, browser }) => {
  const sink = captureConsoleErrors(page);
  await loginViaMagicLink(page);
  await openAccountingApp(page);

  // 1. User 1 builds the batch on the Batches page.
  await buildBatchOnBatchesPage(page, fx!.companyName);

  // 2. User 2 (the company CFO, distinct from the builder) logs in and opens Batches.
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
    await expect(pendingRow, 'a Pending batch row with an Approve action is visible to the CFO').toBeVisible({ timeout: 30_000 });

    // 3. CFO clicks Approve; row status advances to Approved and offers Dispatch.
    await pendingRow.getByRole('button', { name: /^Approve$/i }).first().click();
    await cfoPage.waitForTimeout(5000);

    const approvedRow = cfoPage.locator('tr').filter({ hasText: fx!.companyName }).filter({ has: cfoPage.getByRole('button', { name: /^Dispatch$/i }) }).first();
    await expect(approvedRow, 'approving flips the batch row to Approved and offers Dispatch').toBeVisible({ timeout: 20_000 });

    // 4. Dispatch posts the batch to the (mock) ERP.
    await approvedRow.getByRole('button', { name: /^Dispatch$/i }).first().click();
    await expect(
      cfoPage.getByText(/Dispatched batch .+→ Posted/i).first(),
      'dispatching posts the batch and the UI confirms it reached Posted',
    ).toBeVisible({ timeout: 20_000 });

    expectNoConsoleErrors(cfoSink, 'the CFO approve→dispatch flow on Batches');
  } finally {
    await cfoContext.close();
  }

  expectNoConsoleErrors(sink, 'the builder build flow on Batches');
});
