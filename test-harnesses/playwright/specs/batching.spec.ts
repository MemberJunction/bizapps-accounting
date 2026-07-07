/**
 * PRIORITY 2 — JE-batch approval + dispatch BEHAVIOR (Amith's priority).
 *
 * Drives the real engine through the Batch Dispatch GUI on a DEDICATED throwaway company that
 * `lib/batching-fixture.ts` provisions in `beforeAll` (a company with a CFO configured + three
 * balanced Pending JEs) and tears down in `afterAll`. The seeded demo companies can't be used here:
 * they only carry already-dispatched batches and have no CFO, so there is nothing to approve.
 *
 * 2026-07-06 rework (CH-4): batches are MULTI-COMPANY and Build is GLOBAL — the dashboard has NO
 * company/period pickers (Build nets ALL pending JEs); the lifecycle is Pending → Approved →
 * Sent → Posted. The fixture asserts a stray-Pending-free DB, so Build sweeps exactly its JEs.
 *
 * The flow proven end-to-end (presence AND behavior, per TEST-PROTOCOL.md):
 *   1. Build Batch (header) → a Pending batch card appears with "Awaiting approval" (the CFO gate
 *                             raised an approval Task because ApprovalCFOPersonID is set).
 *   2. Approve (CFO)        → RecordJEBatchDecision('Approved') (also flips Pending→Approved) →
 *                             the Dispatch button appears.
 *   3. Dispatch to BC       → DispatchJEBatch (gate passes → mock ERP poster) → status 'Posted'.
 *
 * Honesty note: the in-app "Approve" records a terminal Approved decision via the gate; the gate
 * does NOT verify the decider IS the CFO (it only requires the CFO to be CONFIGURED at build time),
 * so this exercises the approve→enable→dispatch state machine faithfully. A strict "a non-CFO is
 * rejected at decision time" assertion is therefore NOT something the current engine enforces (it
 * gates the BUILD on CFO config, not the DECISION on decider identity) — we do not assert it, to
 * avoid claiming a guard that does not exist. See the README for the exact gate semantics.
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
// tsx + the instance worktree root (cwd for .env). The harness sits 6 dirs under the worktree root.
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
    // Teardown is best-effort; surface but don't fail the suite on cleanup error.
    // eslint-disable-next-line no-console
    console.warn(`[batching afterAll] teardown warning: ${e instanceof Error ? e.message : e}`);
  }
});

test('Batch Dispatch — Build → CFO Approve → Dispatch advances the batch to Posted', async ({ page }) => {
  await loginViaMagicLink(page);
  const sink = captureConsoleErrors(page);

  await openAccountingApp(page);
  await openNavItem(page, NAV.batches);

  // ── The dashboard has NO company/period pickers (CH-4 global build) — only the Target ERP
  //    selector in the toolbar. Verify it's present and defaulted to Business Central.
  const targetSelect = page.locator('select').first();
  await expect(targetSelect, 'the Target ERP selector should render in the toolbar').toBeVisible();
  await expect(targetSelect).toHaveValue('BusinessCentral');

  // ── 1. Build Batch (header action — sweeps ALL pending JEs) ───────────────
  const buildBtn = page.getByRole('button', { name: /Build Batch/i }).first();
  await expect(buildBtn, 'Build Batch should be enabled (global build needs no selection)').toBeEnabled();
  await buildBtn.click();
  await page.waitForTimeout(7000);

  // A Pending batch card must now exist, showing it is awaiting approval (the CFO gate raised a task).
  const card = page.locator('.bd-card').first();
  await expect(card, 'a batch card should render after Build').toBeVisible({ timeout: 20_000 });
  await expect(
    page.getByText(/Awaiting approval/i).first(),
    'the freshly-built batch should show the "Awaiting approval" badge (CFO gate engaged)',
  ).toBeVisible({ timeout: 15_000 });

  // ── 2. Approve (CFO) ──────────────────────────────────────────────────────
  // The button label is "Approve" but carries a thumbs-up icon, so its accessible name has
  // surrounding whitespace — match tolerantly (and `Reject`/`Dispatch` don't contain "approve").
  const approveBtn = page.getByRole('button', { name: /approve/i }).first();
  await expect(approveBtn, 'an Approve control should be present on the Pending batch').toBeVisible();
  await approveBtn.click();
  await page.waitForTimeout(6000);

  // The batch status flips to Approved (the decision also moves the batch Pending→Approved).
  await expect(
    page.getByText('Approved', { exact: false }).first(),
    'after approving, the batch should display an "Approved" status badge',
  ).toBeVisible({ timeout: 15_000 });

  // ── 3. Dispatch to BusinessCentral ────────────────────────────────────────
  const dispatchBtn = page.getByRole('button', { name: /Dispatch to/i }).first();
  await expect(dispatchBtn, 'the Dispatch button should appear once the batch is approved').toBeVisible({ timeout: 15_000 });
  await expect(dispatchBtn, 'the Dispatch button should be enabled once approved').toBeEnabled();
  await dispatchBtn.click();
  await page.waitForTimeout(8000);

  // The action banner reports a successful dispatch, and the batch status advances to Posted.
  await expect(
    page.getByText(/Dispatched batch .* (Posted|Sent)/i).first(),
    'dispatch should report the batch advanced to Posted (mock ERP poster)',
  ).toBeVisible({ timeout: 20_000 });
  await expect(
    page.locator('.bd-card mj-stat-badge').filter({ hasText: /Posted/i }).first(),
    'the batch card status badge should read Posted after dispatch',
  ).toBeVisible({ timeout: 15_000 });

  expectNoConsoleErrors(sink, 'driving the Build → Approve → Dispatch batch flow');
});
