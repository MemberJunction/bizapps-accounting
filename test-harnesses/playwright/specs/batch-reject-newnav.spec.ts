/**
 * TIER 5 (new nav) — the two-user CFO REJECT decision on the Batches page (#440, #459):
 * User 1 builds a batch on the Batches page; User 2 (the company's CFO) rejects it, cancelling the
 * batch and returning its journal entries to the candidate pool.
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

test('Batches → User 1 builds → User 2 (CFO) Rejects and cancels the batch', async ({ page, browser }) => {
  const sink = captureConsoleErrors(page);
  await loginViaMagicLink(page);
  await openAccountingApp(page);

  // 1. User 1 builds a batch on the Batches page.
  await buildBatchOnBatchesPage(page, fx!.companyName);

  // 2. User 2 (the company CFO) opens the Batches page and rejects the Pending batch.
  const cfoContext = await browser.newContext();
  const cfoPage = await cfoContext.newPage();
  const cfoSink = captureConsoleErrors(cfoPage);
  try {
    await loginAsEmailViaMagicLink(cfoPage, fx!.cfoEmail);
    await openAccountingApp(cfoPage);
    await resetCompanyScopeToAll(cfoPage);
    await scopeToCompany(cfoPage, fx!.companyName);
    await openNavItem(cfoPage, 'Batches');

    const pendingRow = cfoPage.locator('tr').filter({ hasText: fx!.companyName }).filter({ has: cfoPage.getByRole('button', { name: /^Reject$/i }) }).first();
    await expect(pendingRow, 'a Pending batch row with a Reject action is visible to the CFO').toBeVisible({ timeout: 30_000 });

    // 3. Reject opens the confirmation dialog; confirming cancels the batch and returns its JEs to the pool.
    await pendingRow.getByRole('button', { name: /^Reject$/i }).first().click();
    const confirmReject = cfoPage.getByRole('button', { name: /^Reject batch$/i }).first();
    if (await confirmReject.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await confirmReject.click();
    }
    await expect(
      cfoPage.getByText(/Rejected batch .+cancelled; its journal entries returned to the candidate pool/i).first(),
      'rejecting cancels the batch and returns its JEs to the pool',
    ).toBeVisible({ timeout: 20_000 });

    expectNoConsoleErrors(cfoSink, 'the CFO reject flow on Batches');
  } finally {
    await cfoContext.close();
  }

  expectNoConsoleErrors(sink, 'the builder build flow on Batches');
});
