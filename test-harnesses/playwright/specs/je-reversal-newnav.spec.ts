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
import { openAccountingApp, openNavItem, captureConsoleErrors, expectNoConsoleErrors, resetCompanyScopeToAll, scopeToCompany } from '../lib/explorer';
import { HARNESS_DIR } from '../lib/env';

const WORKTREE_ROOT = path.resolve(HARNESS_DIR, '..', '..', '..', '..', '..');
const TSX = path.resolve(WORKTREE_ROOT, 'node_modules', '.bin', 'tsx');
const FIXTURE = path.resolve(HARNESS_DIR, 'lib', 'batching-fixture.ts');
let fx: { companyId: string; companyName: string; cfoPersonId: string; runTag: string; jeEntryNumber: string } | null = null;

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

test('Build→approve→dispatch, then Reverse the GLPosted JE from All journal entries (new nav)', async ({ page }) => {
  const sink = captureConsoleErrors(page);
  await loginViaMagicLink(page);
  await openAccountingApp(page);
  // Scope + deferred-query sequence, same as the batch specs: reset the persisted company scope
  // (a prior session/spec may have narrowed it to a company that no longer exists) and Load the
  // workspace's deferred candidate query (e38fdda) — Build stays disabled until entries load.
  await resetCompanyScopeToAll(page);
  // Scope to the FIXTURE company only: builds sweep every company in scope (and require each
  // company's CFO), so All would drag demo/other data into this spec's batch.
  await scopeToCompany(page, fx!.companyName);

  // 1. Build → approve → dispatch, so the fixture's JEs become GLPosted (reversible).
  await railItem(page, 'Journal Entry Batches', 'JE batch workspace');
  const loadBtn = page.getByRole('button', { name: /Load entries/i }).first();
  await expect(loadBtn, 'the deferred-query Load-entries button').toBeVisible({ timeout: 30_000 });
  await loadBtn.click();
  const buildBtn = page.getByRole('button', { name: /Build batch/i }).first();
  await expect(buildBtn, 'Build batch enables once candidates load').toBeEnabled({ timeout: 30_000 });
  await buildBtn.click();
  await page.waitForTimeout(2000);
  const confirmBuild = page.getByRole('button', { name: /Build batch \(\d+\)/i }).first();
  if (await confirmBuild.isVisible().catch(() => false)) { await confirmBuild.click(); }
  await page.waitForTimeout(7000);

  await railItem(page, 'Journal Entry Batches', 'JE batch approvals');
  const pendingCard = page.locator('.bd-card').filter({ has: page.getByRole('button', { name: /Approve/i }) }).first();
  await expect(pendingCard).toBeVisible({ timeout: 30_000 });
  await pendingCard.getByRole('button', { name: /Approve/i }).first().click();
  await page.waitForTimeout(5000);
  const approvedCard = page.locator('.bd-card').filter({ has: page.locator('mj-stat-badge').filter({ hasText: /^Approved$/ }) }).first();
  await expect(approvedCard).toBeVisible({ timeout: 20_000 });
  await approvedCard.getByRole('button', { name: /Dispatch/i }).first().click();
  await expect(page.getByText(/Dispatched batch .+→ Posted/i).first(), 'batch reached Posted (JEs now GLPosted)').toBeVisible({ timeout: 20_000 });

  // 2. Open All journal entries and select THIS fixture's JE by its UNIQUE EntryNumber (prefix JE-PW…,
  //    never a demo JE-DEMOORD…). This is safe BY CONSTRUCTION: filtering .ag-row on the exact EntryNumber
  //    can only ever match the fixture JE or nothing — it can NEVER open a lived-in/demo entry. (An earlier
  //    "click the first GLPosted row" version wrongly reversed demo data; never reach outside the fixture.)
  //    The reversal it creates lands in the fixture company, so the afterAll teardown cleans it.
  await railItem(page, 'Journal Entries', 'All journal entries');
  const search = page.getByRole('searchbox', { name: /Search journal entries/i }).first();
  // Unconditional: the old visibility guard silently skipped the search when the label didn't
  // resolve — a hidden liveness skip. A missing search box is a failure.
  await expect(search, 'the list-toolbar search renders').toBeVisible({ timeout: 15_000 });
  await search.fill(fx!.jeEntryNumber);
  await page.waitForTimeout(3000);
  const fixtureRow = page.locator('.ag-row').filter({ hasText: fx!.jeEntryNumber }).first();
  await expect(fixtureRow, `the fixture JE ${fx!.jeEntryNumber} (GLPosted after dispatch) should be present`).toBeVisible({ timeout: 30_000 });
  await fixtureRow.click();
  await page.waitForTimeout(2500);

  // 3. Reverse the GLPosted fixture JE — the app confirms "Reversed <N> → new entry <M>".
  const reverseBtn = page.getByRole('button', { name: /^Reverse/i }).first();
  await expect(reverseBtn, 'the detail panel offers Reverse for a GLPosted, not-yet-reversed JE').toBeVisible({ timeout: 15_000 });
  await reverseBtn.click();
  await expect(
    page.getByText(/Reversed .+→ new entry/i).first(),
    'reversing a GLPosted JE generates a new reversing entry and the UI confirms it',
  ).toBeVisible({ timeout: 20_000 });

  expectNoConsoleErrors(sink, 'the JE reversal drill on the new nav');
});
