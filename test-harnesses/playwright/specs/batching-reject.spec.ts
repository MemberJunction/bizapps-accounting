/**
 * PRIORITY 2 — JE-batch REJECT + REGENERATE behavior (task #12, batch-lock redesign 2026-07-08).
 *
 * Proves, at the GUI layer (presence AND behavior, per TEST-PROTOCOL.md), the two controls added by the
 * "levels of locking" redesign (plan plans/batch-approval-lock-redesign.md, Option A):
 *   - REJECT reverses the (still-preliminary) lock: the batch visibly becomes Cancelled and its journal
 *     entries return to the candidate pool — this is the #12 bug fix ("reject did nothing" before).
 *   - The freed entries are candidates again → a fresh Build re-batches them.
 *   - REGENERATE rebuilds an open (Pending) batch in place (re-gathers all current candidates).
 *
 * Reuses lib/batching-fixture.ts: a dedicated throwaway company with a CFO + three balanced Pending JEs
 * (Build's real gate needs a configured CFO). Global build sweeps ALL pending JEs, so the fixture asserts
 * a stray-Pending-free DB at setup. afterAll tears the company down (FK-aware, mirrors block2-runtime).
 */
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loginViaMagicLink } from '../lib/auth';
import { captureConsoleErrors, expectNoConsoleErrors, openAccountingApp, openNavItem } from '../lib/explorer';
import { NAV } from '../lib/env';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.resolve(__dirname, '..', 'lib', 'batching-fixture.ts');
const WORKTREE_ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..', '..');
const TSX = path.resolve(WORKTREE_ROOT, 'node_modules', '.bin', 'tsx');

interface Fixture { companyId: string; companyName: string; runTag: string; cfoPersonId: string }
let fixture: Fixture;

test.beforeAll(() => {
  const out = execFileSync(TSX, [FIXTURE, 'setup'], { cwd: WORKTREE_ROOT, encoding: 'utf8', timeout: 180_000 });
  const line = out.split('\n').find((l) => l.startsWith('FIXTURE_JSON '));
  if (!line) throw new Error(`batching-fixture setup did not emit FIXTURE_JSON. Output:\n${out}`);
  fixture = JSON.parse(line.slice('FIXTURE_JSON '.length));
});

test.afterAll(() => {
  if (!fixture?.companyId) return;
  try {
    execFileSync(TSX, [FIXTURE, 'teardown', fixture.companyId, fixture.cfoPersonId], { cwd: WORKTREE_ROOT, encoding: 'utf8', timeout: 180_000 });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn(`[batching-reject afterAll] teardown warning: ${e instanceof Error ? e.message : e}`);
  }
});

test('Batch Dispatch — Reject cancels the batch + frees its entries; Regenerate rebuilds an open batch (#12)', async ({ page }) => {
  await loginViaMagicLink(page);
  const sink = captureConsoleErrors(page);

  await openAccountingApp(page);
  await openNavItem(page, NAV.batches);

  // ── 1. Build a batch (sweeps the fixture's 3 pending JEs; its company has a CFO → the gate passes) ──
  const buildBtn = page.getByRole('button', { name: /Build Batch/i }).first();
  await expect(buildBtn, 'Build Batch should be enabled').toBeEnabled();
  await buildBtn.click();
  await page.waitForTimeout(7000);

  const firstCard = page.locator('.bd-card').first();
  await expect(firstCard, 'a batch card should render after Build').toBeVisible({ timeout: 20_000 });
  const batchNumber = (await firstCard.locator('.bd-card__number').first().innerText()).trim();

  // Both new controls must be present on the Pending batch (button PRESENCE).
  const rejectBtn = firstCard.getByRole('button', { name: /reject/i }).first();
  await expect(rejectBtn, 'Reject should be present on a Pending batch').toBeVisible();
  await expect(
    firstCard.getByRole('button', { name: /regenerate/i }).first(),
    'Regenerate should be present on a Pending batch',
  ).toBeVisible();

  // ── 2. REJECT (#12 fix) — the batch must VISIBLY become Cancelled + its entries return to the pool ──
  await rejectBtn.click();
  await page.waitForTimeout(6000);
  await expect(
    page.getByText(/Rejected batch .* cancelled/i).first(),
    'reject should report the batch cancelled + entries returned to the candidate pool',
  ).toBeVisible({ timeout: 15_000 });
  const cancelledCard = page.locator('.bd-card', { has: page.locator('.bd-card__number', { hasText: batchNumber }) }).first();
  await expect(
    cancelledCard.locator('mj-stat-badge').filter({ hasText: /Cancelled/i }).first(),
    'the rejected batch card should show a Cancelled status badge (was the #12 bug: reject did nothing)',
  ).toBeVisible({ timeout: 15_000 });

  // ── 3. The freed entries are candidates again → a fresh Build re-batches them into a new Pending batch ──
  await page.getByRole('button', { name: /Build Batch/i }).first().click();
  await page.waitForTimeout(7000);
  const rebuilt = page.locator('.bd-card').first();
  await expect(
    rebuilt.locator('mj-stat-badge').filter({ hasText: /Pending/i }).first(),
    'the freed entries should re-batch into a new Pending batch',
  ).toBeVisible({ timeout: 15_000 });

  // ── 4. REGENERATE — click it on the open batch; it re-gathers candidates in place (stays Pending) ──
  const regenBtn = rebuilt.getByRole('button', { name: /regenerate/i }).first();
  await expect(regenBtn, 'Regenerate should be present on the rebuilt Pending batch').toBeVisible();
  await regenBtn.click();
  await page.waitForTimeout(6000);
  await expect(
    page.getByText(/Regenerated batch/i).first(),
    'regenerate should report the batch was rebuilt from current candidates',
  ).toBeVisible({ timeout: 15_000 });

  expectNoConsoleErrors(sink, 'driving the Build → Reject → Build → Regenerate batch flow');
});
