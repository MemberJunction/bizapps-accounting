/**
 * PRIORITY 2 — JE-batch approval + dispatch BEHAVIOR (Amith's priority).
 *
 * Drives the real engine through the Batch Dispatch GUI on a DEDICATED throwaway company that
 * `lib/batching-fixture.ts` provisions in `beforeAll` (a company with a CFO configured + one
 * balanced Pending JE) and tears down in `afterAll`. The seeded demo companies can't be used here:
 * they only carry already-dispatched batches and have no CFO, so there is nothing to approve.
 *
 * The flow proven end-to-end (presence AND behavior, per TEST-PROTOCOL.md):
 *   1. Build Batch         → a Pending batch appears; it shows "Awaiting approval" (the CFO gate
 *                            raised an approval Task because ApprovalCFOPersonID is set).
 *   2. Approve (CFO)       → RecordJEBatchDecision('Approved') → the approval badge flips to
 *                            "Approved" and the Dispatch button becomes enabled.
 *   3. Dispatch to BC      → DispatchJEBatch (gate.assertApproved passes → mock ERP poster) → the
 *                            batch status advances to Sent/Acknowledged.
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

interface Fixture { companyId: string; companyName: string; runTag: string; periodLabel: string; periodId: string; cfoPersonId: string }
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

test('Batch Dispatch — Build → CFO Approve → Dispatch advances the batch to Sent/Acknowledged', async ({ page }) => {
  await loginViaMagicLink(page);
  const sink = captureConsoleErrors(page);

  await openAccountingApp(page);
  await openNavItem(page, NAV.batches);

  // ── Select the fixture company ────────────────────────────────────────────
  const companySelect = page.locator('select').first();
  const companyOptionLabels = await companySelect.locator('option').allTextContents();
  const companyLabel = companyOptionLabels.find((o) => o.includes(fixture.runTag));
  expect(companyLabel, `fixture company "${fixture.runTag}" must be selectable (got ${JSON.stringify(companyOptionLabels)})`).toBeTruthy();
  await companySelect.selectOption({ label: companyLabel! });
  await page.waitForTimeout(3500);

  // ── Select the EXACT open period the fixture put the pending JE in ─────────
  // All 12 Month periods share the label "Month · FY<year>", so we must select by the option's
  // value (the period ID), not by label — otherwise Build runs against an empty period.
  const periodSelect = page.locator('select').nth(1);
  await periodSelect.selectOption({ value: fixture.periodId });
  await page.waitForTimeout(1500);

  // ── 1. Build Batch ────────────────────────────────────────────────────────
  const buildBtn = page.getByRole('button', { name: /Build Batch/i }).first();
  await expect(buildBtn, 'Build Batch enabled once company + period are selected').toBeEnabled();
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

  // The approval badge flips to "Approved".
  await expect(
    page.getByText('Approved', { exact: false }).first(),
    'after approving, the batch should display an "Approved" badge',
  ).toBeVisible({ timeout: 15_000 });

  // ── 3. Dispatch to BusinessCentral ────────────────────────────────────────
  const dispatchBtn = page.getByRole('button', { name: /Dispatch to/i }).first();
  await expect(dispatchBtn, 'the Dispatch button should appear once the batch is approved').toBeVisible({ timeout: 15_000 });
  await expect(dispatchBtn, 'the Dispatch button should be enabled once approved').toBeEnabled();
  await dispatchBtn.click();
  await page.waitForTimeout(8000);

  // The action banner reports a successful dispatch, and the batch status advances to Sent/Acknowledged.
  await expect(
    page.getByText(/Dispatched batch .* (Sent|Acknowledged)/i).first(),
    'dispatch should report the batch advanced to Sent/Acknowledged (mock ERP poster)',
  ).toBeVisible({ timeout: 20_000 });
  await expect(
    page.locator('.bd-card mj-stat-badge').filter({ hasText: /Sent|Acknowledged/i }).first(),
    'the batch card status badge should read Sent or Acknowledged after dispatch',
  ).toBeVisible({ timeout: 15_000 });

  expectNoConsoleErrors(sink, 'driving the Build → Approve → Dispatch batch flow');
});
