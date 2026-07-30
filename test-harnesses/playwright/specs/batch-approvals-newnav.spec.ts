/**
 * TIER 5 (new nav) — the CFO batch BEHAVIOR flow on the UI-wave category rails: build a batch, then
 * Approve → Dispatch it to Posted. The ENGINE behavior is exact-value-proven at tier 3
 * (batch-dispatch-client 20/20); tier 5's unique add is the real browser flow — the buttons drive the
 * engine and the UI reflects it. Nav is category → rail button; the dashboard selectors (.bd-card,
 * Approve/Dispatch) are unchanged from the pre-UI-wave spec.
 */
import { test, expect, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { loginViaMagicLink } from '../lib/auth';
import { openAccountingApp, openNavItem, captureConsoleErrors, expectNoConsoleErrors, resetCompanyScopeToAll, scopeToCompany } from '../lib/explorer';
import { HARNESS_DIR } from '../lib/env';

// Seed a Pending JE (+ running user as CFO) so there's something to build/approve. Uses the proven
// tsx batching-fixture as a subprocess (direct SQL); torn down after. The lived-in instance otherwise
// has no Pending JEs, so the approvals inbox is empty and there's nothing to exercise.
// HARNESS_DIR = the playwright dir (ESM-safe, from lib/env). WORKTREE_ROOT is the instance MJ worktree.
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
  await page.getByRole('button', { name: item, exact: true }).first().click();
  await page.mouse.move(820, 480); // park away from the rail so its hover-peek overlay retracts
  await page.waitForTimeout(3500);
}

test('Batches → build → Batch approvals → Approve → Dispatch advances to Posted (new nav)', async ({ page }) => {
  const sink = captureConsoleErrors(page);
  await loginViaMagicLink(page);
  await openAccountingApp(page);
  // The batch workspace inherits the global company scope into its build criteria; reset it to All so
  // the fixture's isolated company is in scope (an ambient narrow scope otherwise empties the preview).
  await resetCompanyScopeToAll(page);
  // Scope to the FIXTURE company only: builds sweep every company in scope (and require each
  // company's CFO), so All would drag demo/other data into this spec's batch.
  await scopeToCompany(page, fx!.companyName);

  // 1. Build a batch — the Build affordance lives on the Batch workspace rail page.
  await railItem(page, 'Batches', 'Batch workspace');
  // The workspace DEFERS its query (e38fdda): a fresh tab shows no candidates until you Load them, so
  // Build stays disabled ("Nothing matches these criteria") until then. Load the entries first.
  const loadBtn = page.getByRole('button', { name: /Load entries/i }).first();
  await expect(loadBtn, 'the deferred-query Load-entries button').toBeVisible({ timeout: 30_000 });
  await loadBtn.click();
  const buildBtn = page.getByRole('button', { name: /Build batch/i }).first();
  await expect(buildBtn, 'Build batch enables once candidates load').toBeEnabled({ timeout: 30_000 });
  await buildBtn.click();
  await page.waitForTimeout(2000);
  // A preview/confirm may appear ("Build batch (N)"); confirm it if present, else the build was direct.
  const confirm = page.getByRole('button', { name: /Build batch \(\d+\)/i }).first();
  if (await confirm.isVisible().catch(() => false)) { await confirm.click(); }
  await page.waitForTimeout(7000);

  // 2. Open the Batch approvals inbox — the built batch is a Pending, awaiting-approval card.
  await railItem(page, 'Batches', 'Batch approvals');
  const pendingCard = page.locator('.bd-card').filter({ has: page.getByRole('button', { name: /Approve/i }) }).first();
  await expect(pendingCard, 'a Pending batch card with an Approve action should be present').toBeVisible({ timeout: 30_000 });

  // 3. Approve drives the engine; the card reactively flips to Approved and offers Dispatch.
  await pendingCard.getByRole('button', { name: /Approve/i }).first().click();
  await page.waitForTimeout(5000);
  const approvedCard = page.locator('.bd-card').filter({ has: page.locator('mj-stat-badge').filter({ hasText: /^Approved$/ }) }).first();
  await expect(approvedCard, 'approving flips the batch status badge to Approved').toBeVisible({ timeout: 20_000 });
  const dispatchBtn = approvedCard.getByRole('button', { name: /Dispatch/i }).first();
  await expect(dispatchBtn, 'an Approved batch offers Dispatch (approval gate opened dispatch)').toBeVisible({ timeout: 15_000 });

  // 4. Dispatch → the batch posts to the (mock) ERP. Posted batches LEAVE the approvals inbox by design
  //    ("Cancelled, sent, and posted batches are never shown here"), so the dispatch-success confirmation
  //    ("Dispatched batch <N> → Posted") is the correct signal that it reached Posted — not a Posted card here.
  await dispatchBtn.click();
  await expect(
    page.getByText(/Dispatched batch .+→ Posted/i).first(),
    'dispatching posts the batch and the UI confirms it reached Posted',
  ).toBeVisible({ timeout: 20_000 });

  expectNoConsoleErrors(sink, 'the CFO build→approve→dispatch flow on the new nav');
});
