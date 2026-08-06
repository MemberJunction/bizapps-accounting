/**
 * TIER 5 (new nav) — the CFO REJECT decision on the UI-wave category rails: build a batch, then Reject
 * it. Rejection reverses the preliminary lock — the batch is Cancelled and its journal entries return to
 * the candidate pool. The ENGINE behavior is exact-value-proven at tier 3 (batch-dispatch-client
 * RecordDecision('Rejected') unlocks); tier 5's unique add is the real browser flow.
 */
import { test, expect, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { loginViaMagicLink } from '../lib/auth';
import { openAccountingApp, openNavItem, captureConsoleErrors, expectNoConsoleErrors, resetCompanyScopeToAll, scopeToCompany } from '../lib/explorer';
import { HARNESS_DIR } from '../lib/env';

const WORKTREE_ROOT = path.resolve(HARNESS_DIR, '..', '..', '..', '..', '..');
const TSX = path.resolve(WORKTREE_ROOT, 'node_modules', '.bin', 'tsx');
const FIXTURE = path.resolve(HARNESS_DIR, 'lib', 'batching-fixture.ts');
let fx: { companyId: string; companyName: string; cfoPersonId: string } | null = null;

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
  // EXACT name: substring matching made { name: 'Companies' } hit the scope chip's
  // "Scope: All companies" accessible name (earlier in DOM) and open its menu over the page.
  // Anchored regex, not exact:true (2026-07-30): rail badges fold their count into the button's
  // accessible name ("Batch approvals 2"), so exact broke once a count rendered; the anchors
  // still block the substring collision exact was guarding (the scope chip name).
  await page.getByRole('button', { name: new RegExp('^' + item + '( \\d+)?$') }).first().click();
  await page.mouse.move(820, 480); // park away from the rail so its hover-peek overlay retracts
  await page.waitForTimeout(3500);
}

test('Batches → build → Batch approvals → Reject cancels the batch (new nav)', async ({ page }) => {
  const sink = captureConsoleErrors(page);
  await loginViaMagicLink(page);
  await openAccountingApp(page);
  // The batch workspace inherits the global company scope into its build criteria; reset it to All so
  // the fixture's isolated company is in scope (an ambient narrow scope otherwise empties the preview).
  await resetCompanyScopeToAll(page);
  // Scope to the FIXTURE company only: builds sweep every company in scope (and require each
  // company's CFO), so All would drag demo/other data into this spec's batch.
  await scopeToCompany(page, fx!.companyName);

  // 1. Build a batch on the Batch workspace.
  await railItem(page, 'Journal Entry Batches', 'JE batch workspace');
  // The workspace DEFERS its query (e38fdda): a fresh tab shows no candidates until you Load them, so
  // Build stays disabled ("Nothing matches these criteria") until then. Load the entries first.
  const loadBtn = page.getByRole('button', { name: /Load entries/i }).first();
  await expect(loadBtn, 'the deferred-query Load-entries button').toBeVisible({ timeout: 30_000 });
  await loadBtn.click();
  const buildBtn = page.getByRole('button', { name: /Build JE batch/i }).first();
  await expect(buildBtn, 'Build JE batch enables once candidates load').toBeEnabled({ timeout: 30_000 });
  await buildBtn.click();
  await page.waitForTimeout(2000);
  const confirm = page.getByRole('button', { name: /Build JE batch \(\d+\)/i }).first();
  if (await confirm.isVisible().catch(() => false)) { await confirm.click(); }
  await page.waitForTimeout(7000);

  // 2. Open the Batch approvals inbox — a Pending card with a Reject action.
  await railItem(page, 'Journal Entry Batches', 'JE batch approvals');
  const pendingCard = page.locator('.bd-card').filter({ has: page.getByRole('button', { name: /Reject/i }) }).first();
  await expect(pendingCard, 'a Pending batch card with a Reject action should be present').toBeVisible({ timeout: 30_000 });

  // 3. Reject drives the engine — the batch is Cancelled and its JEs return to the candidate pool.
  //    The app confirms with "Rejected batch <N> — cancelled; its journal entries returned to the candidate pool."
  await pendingCard.getByRole('button', { name: /Reject/i }).first().click();
  await expect(
    page.getByText(/Rejected batch .+cancelled; its journal entries returned to the candidate pool/i).first(),
    'rejecting cancels the batch and returns its JEs to the pool',
  ).toBeVisible({ timeout: 20_000 });

  expectNoConsoleErrors(sink, 'the CFO build→reject flow on the new nav');
});
