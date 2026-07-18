/**
 * TIER 5 (new nav) — the JE REVERSAL drill on the UI-wave category rails. A GLPosted JE is reversible
 * (generates a balanced reversing entry). Getting a GLPosted JE requires the full dispatch chain, so
 * this spec builds→approves→dispatches a batch (its JEs become GLPosted), then opens one from
 * "All journal entries" and reverses it. Engine behavior (GenerateReversal → balanced Pending reversal)
 * is exact-value-proven at tiers 2 & 3; tier 5's unique add is the real browser Reverse button.
 */
import { test, expect, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { loginViaMagicLink } from '../lib/auth';
import { openAccountingApp, openNavItem, captureConsoleErrors, expectNoConsoleErrors } from '../lib/explorer';
import { HARNESS_DIR } from '../lib/env';

const WORKTREE_ROOT = path.resolve(HARNESS_DIR, '..', '..', '..', '..', '..');
const TSX = path.resolve(WORKTREE_ROOT, 'node_modules', '.bin', 'tsx');
const FIXTURE = path.resolve(HARNESS_DIR, 'lib', 'batching-fixture.ts');
let fx: { companyId: string; cfoPersonId: string } | null = null;

test.beforeAll(() => {
  const out = execFileSync(TSX, [FIXTURE, 'setup'], { cwd: WORKTREE_ROOT, encoding: 'utf8', timeout: 180_000 });
  const line = out.split('\n').find((l) => l.startsWith('FIXTURE_JSON '));
  if (!line) throw new Error(`batching-fixture setup emitted no FIXTURE_JSON:\n${out.slice(-500)}`);
  fx = JSON.parse(line.slice('FIXTURE_JSON '.length));
});
test.afterAll(() => {
  if (fx) { try { execFileSync(TSX, [FIXTURE, 'teardown', fx.companyId, fx.cfoPersonId], { cwd: WORKTREE_ROOT, encoding: 'utf8', timeout: 180_000 }); } catch { /* best-effort */ } }
});

async function railItem(page: Page, category: string, item: string): Promise<void> {
  await openNavItem(page, category);
  await page.getByRole('button', { name: item }).first().click();
  await page.waitForTimeout(3500);
}

test('Build→approve→dispatch, then Reverse the GLPosted JE from All journal entries (new nav)', async ({ page }) => {
  const sink = captureConsoleErrors(page);
  await loginViaMagicLink(page);
  await openAccountingApp(page);

  // 1. Build → approve → dispatch, so the fixture's JEs become GLPosted (reversible).
  await railItem(page, 'Batches', 'Batch workspace');
  const buildBtn = page.getByRole('button', { name: /Build batch/i }).first();
  await expect(buildBtn).toBeVisible({ timeout: 30_000 });
  await buildBtn.click();
  await page.waitForTimeout(2000);
  const confirmBuild = page.getByRole('button', { name: /Build batch \(\d+\)/i }).first();
  if (await confirmBuild.isVisible().catch(() => false)) { await confirmBuild.click(); }
  await page.waitForTimeout(7000);

  await railItem(page, 'Batches', 'Batch approvals');
  const pendingCard = page.locator('.bd-card').filter({ has: page.getByRole('button', { name: /Approve/i }) }).first();
  await expect(pendingCard).toBeVisible({ timeout: 30_000 });
  await pendingCard.getByRole('button', { name: /Approve/i }).first().click();
  await page.waitForTimeout(5000);
  const approvedCard = page.locator('.bd-card').filter({ has: page.locator('mj-stat-badge').filter({ hasText: /^Approved$/ }) }).first();
  await expect(approvedCard).toBeVisible({ timeout: 20_000 });
  await approvedCard.getByRole('button', { name: /Dispatch/i }).first().click();
  await expect(page.getByText(/Dispatched batch .+→ Posted/i).first(), 'batch reached Posted (JEs now GLPosted)').toBeVisible({ timeout: 20_000 });

  // 2. Open All journal entries and select a GLPosted entry → the detail panel opens.
  await railItem(page, 'Journal Entries', 'All journal entries');
  const glRow = page.locator('.ag-row').filter({ hasText: /GLPosted/ }).first();
  await expect(glRow, 'a GLPosted JE row should be present after dispatch').toBeVisible({ timeout: 30_000 });
  await glRow.click();
  await page.waitForTimeout(2500);

  // 3. Reverse the GLPosted JE — the app confirms "Reversed <N> → new entry <M>".
  const reverseBtn = page.getByRole('button', { name: /^Reverse/i }).first();
  await expect(reverseBtn, 'the detail panel offers Reverse for a GLPosted, not-yet-reversed JE').toBeVisible({ timeout: 15_000 });
  await reverseBtn.click();
  await expect(
    page.getByText(/Reversed .+→ new entry/i).first(),
    'reversing a GLPosted JE generates a new reversing entry and the UI confirms it',
  ).toBeVisible({ timeout: 20_000 });

  expectNoConsoleErrors(sink, 'the JE reversal drill on the new nav');
});
