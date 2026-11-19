/**
 * TIER 5 (new nav) — batch REGENERATE + two-user Reject in the real browser (#440, #459):
 *   1. User 1 builds a batch on the Batches page from the fixture's 3 JEs (Entries = 3, Total Debits = 600.00).
 *   2. A LATE candidate lands out-of-band (fixture add-je: AR 111 Dr / Revenue 111 Cr).
 *   3. User 1 regenerates on JE batch approvals → Entries = 4, netted debits = 711.00.
 *   4. User 2 (the company's CFO) rejects the batch on the Batches page → JEs return to the candidate pool.
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

async function railItem(page: Page, category: string, item: string): Promise<void> {
  await openNavItem(page, category);
  await page.getByRole('button', { name: new RegExp('^' + item + '( \\d+)?$') }).first().click();
  await page.mouse.move(820, 480);
  await page.waitForTimeout(3500);
}

test('Build on Batches → late candidate → Regenerate re-gathers (3→4 entries, 600→711 netted) → CFO Reject returns the pool', async ({ page, browser }) => {
  const sink = captureConsoleErrors(page);
  await loginViaMagicLink(page);
  await openAccountingApp(page);
  await resetCompanyScopeToAll(page);
  await scopeToCompany(page, fx!.companyName);

  // ── 1. User 1 builds on the Batches page ───────────────────────────────────
  await openNavItem(page, 'Batches');
  const openModalBtn = page.getByRole('button', { name: /Build (First )?Batch/i }).first();
  await expect(openModalBtn).toBeVisible({ timeout: 30_000 });
  await openModalBtn.click();
  const buildBtn = page.getByRole('button', { name: /Build Batch \(\d+\)/i }).first();
  await expect(buildBtn, 'Build Batch (N) enables once candidates load').toBeEnabled({ timeout: 30_000 });
  await buildBtn.click();
  await page.waitForTimeout(6000);

  // ── 2. The pending card shows the EXACT netted pre-state: 3 entries, 600.00 ─
  await railItem(page, 'Journal Entry Batches', 'JE batch approvals');
  const card = page.locator('.bd-card').filter({ has: page.getByRole('button', { name: /Regenerate/i }) }).first();
  await expect(card, 'a Pending batch card with Regenerate').toBeVisible({ timeout: 30_000 });
  await expect(card.getByText('3', { exact: true }).first(), 'Entries = 3 member JEs before regenerate').toBeVisible();
  await expect(card.getByText('600.00').first(), 'netted debits 600.00 before regenerate').toBeVisible();

  // ── 3. A late candidate lands out-of-band ───────────────────────────────────
  const out = execFileSync(TSX_BIN, [FIXTURE, 'add-je', fx!.companyId], { cwd: REPO_ROOT, encoding: 'utf8', timeout: 180_000 });
  if (!out.includes('FIXTURE_JSON')) throw new Error(`add-je emitted no FIXTURE_JSON:\n${out.slice(-400)}`);

  // ── 4. Regenerate → 4 members, netted 711.00, and the toast states the netting ─
  await card.getByRole('button', { name: /Regenerate/i }).click();
  await expect(card.getByText('711.00').first(), 'netted debits 711.00 = 600 + the late 111').toBeVisible({ timeout: 30_000 });
  await expect(card.getByText('4', { exact: true }).first(), 'Entries = 4 members after re-gather').toBeVisible();
  await expect(page.getByText(/Regenerated batch .*4 JE\(s\) across 1 company\(ies\) → 3 summary line\(s\); Dr 711 \/ Cr 711/).first(),
    'the toast states the exact re-netting').toBeVisible();

  // ── 5. User 2 (CFO) rejects on the Batches page → entries return to the pool ─
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
    await expect(pendingRow).toBeVisible({ timeout: 30_000 });
    await pendingRow.getByRole('button', { name: /^Reject$/i }).first().click();
    const confirmReject = cfoPage.getByRole('button', { name: /^Reject batch$/i }).first();
    if (await confirmReject.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await confirmReject.click();
    }
    await expect(
      cfoPage.getByText(/Rejected batch .+cancelled; its journal entries returned to the candidate pool/i).first(),
    ).toBeVisible({ timeout: 20_000 });
    expectNoConsoleErrors(cfoSink, 'CFO reject in regenerate flow');
  } finally {
    await cfoContext.close();
  }

  // ── 6. User 1 sees all 4 JEs back in the Build Batch candidate pool ─────────
  await openNavItem(page, 'Batches');
  const openModalBtn2 = page.getByRole('button', { name: /Build (First )?Batch/i }).first();
  await expect(openModalBtn2).toBeVisible({ timeout: 30_000 });
  await openModalBtn2.click();
  const buildBtn2 = page.getByRole('button', { name: /Build Batch \(4\)/i }).first();
  await expect(buildBtn2, 'all 4 JEs are back in the pool (buildable again)').toBeEnabled({ timeout: 30_000 });

  expectNoConsoleErrors(sink, 'batch regenerate flow');
});
