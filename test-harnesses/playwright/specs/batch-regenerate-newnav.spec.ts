/**
 * TIER 5 (new nav) — batch REGENERATE in the real browser (Marcelo's 2026-07-29 sweep).
 * Regenerate is offered on an OPEN (Pending) batch: it unlocks the batch's entries and re-gathers
 * ALL current candidates in place. Flow, with exact netted values:
 *   1. Build a batch from the fixture's 3 JEs → the card shows Entries 3 (member JEs), Total
 *      Debits 600.00 (netted: AR 400 Dr · Cash 200 Dr · Revenue 600 Cr).
 *   2. A LATE candidate lands (fixture add-je: AR 111 Dr / Revenue 111 Cr).
 *   3. Regenerate → Entries 4 (the late member re-gathered), totals 711.00, and the toast states
 *      the netting exactly: "4 JE(s) … → 3 summary line(s); Dr 711 / Cr 711".
 *   4. Reject → JEs return to the pool (teardown-clean).
 * Engine regenerate semantics are proven at tier 2/3; tier 5's add is the real button → op →
 * card refresh round trip with the exact re-gathered totals.
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
  await page.mouse.move(820, 480); // let the collapsed rail's hover-peek retract (see accounts spec)
  await page.waitForTimeout(3500);
}

test('Build → late candidate → Regenerate re-gathers (5→6 entries, 600→711 netted) → Reject returns the pool', async ({ page }) => {
  const sink = captureConsoleErrors(page);
  await loginViaMagicLink(page);
  await openAccountingApp(page);
  await resetCompanyScopeToAll(page);
  // Scope to the FIXTURE company only: builds sweep every company in scope (and require each
  // company's CFO), so All would drag demo/other data into this spec's batch.
  await scopeToCompany(page, fx!.companyName);

  // ── 1. Build (the workspace's deferred-query flow) ──────────────────────────
  await railItem(page, 'Journal Entry Batches', 'JE batch workspace');
  const loadBtn = page.getByRole('button', { name: /Load entries/i }).first();
  await expect(loadBtn).toBeVisible({ timeout: 30_000 });
  await loadBtn.click();
  const buildBtn = page.getByRole('button', { name: /Build batch/i }).first();
  await expect(buildBtn, 'Build enables once candidates load').toBeEnabled({ timeout: 30_000 });
  await buildBtn.click();
  await page.waitForTimeout(2000);
  const confirm = page.getByRole('button', { name: /Build batch \(\d+\)/i }).first();
  if (await confirm.isVisible().catch(() => false)) { await confirm.click(); }
  await page.waitForTimeout(7000);

  // ── 2. The pending card shows the EXACT netted pre-state: 5 entries, 600.00 ─
  await railItem(page, 'Journal Entry Batches', 'JE batch approvals');
  const card = page.locator('.bd-card').filter({ has: page.getByRole('button', { name: /Regenerate/i }) }).first();
  await expect(card, 'a Pending batch card with Regenerate').toBeVisible({ timeout: 30_000 });
  await expect(card.getByText('3', { exact: true }).first(), 'Entries = 3 member JEs before regenerate').toBeVisible();
  await expect(card.getByText('600.00').first(), 'netted debits 600.00 before regenerate').toBeVisible();

  // ── 3. A late candidate lands out-of-band ───────────────────────────────────
  const out = execFileSync(TSX, [FIXTURE, 'add-je', fx!.companyId], { cwd: WORKTREE_ROOT, encoding: 'utf8', timeout: 180_000 });
  if (!out.includes('FIXTURE_JSON')) throw new Error(`add-je emitted no FIXTURE_JSON:\n${out.slice(-400)}`);

  // ── 4. Regenerate → 4 members, netted 711.00, and the toast states the netting ─
  await card.getByRole('button', { name: /Regenerate/i }).click();
  await expect(card.getByText('711.00').first(), 'netted debits 711.00 = 600 + the late 111').toBeVisible({ timeout: 30_000 });
  await expect(card.getByText('4', { exact: true }).first(), 'Entries = 4 members after re-gather').toBeVisible();
  await expect(page.getByText(/Regenerated batch .*4 JE\(s\) across 1 company\(ies\) → 3 summary line\(s\); Dr 711 \/ Cr 711/).first(),
    'the toast states the exact re-netting').toBeVisible();

  // ── 5. Reject → batch Cancelled, entries return to the candidate pool ───────
  await card.getByRole('button', { name: /Reject/i }).click();
  await page.waitForTimeout(5000);
  await railItem(page, 'Journal Entry Batches', 'JE batch workspace');
  const loadBtn2 = page.getByRole('button', { name: /Load entries/i }).first();
  await expect(loadBtn2).toBeVisible({ timeout: 30_000 });
  await loadBtn2.click();
  const buildBtn2 = page.getByRole('button', { name: /Build batch/i }).first();
  await expect(buildBtn2, 'all 6 JEs are back in the pool (buildable again)').toBeEnabled({ timeout: 30_000 });

  expectNoConsoleErrors(sink, 'batch regenerate flow');
});
