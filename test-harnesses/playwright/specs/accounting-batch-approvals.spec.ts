/**
 * TIER-5 — Batch Approvals inbox (BatchDispatchDashboardComponent, nav label "Batch Approvals").
 *
 * Closes the testing.md coverage gap for the Batch Approvals inbox: the pending-approval list + the
 * CFO Approve / Reject controls. Complements specs/batching-reject.spec.ts (which proves the REJECT
 * path) by proving the APPROVE path end-to-end at the GUI layer, per TEST-PROTOCOL.md (presence AND
 * behavior):
 *   1. A Pending batch appears in the inbox with its status + "Awaiting approval" badges and its
 *      control-total metrics (Entries / Total Debits / Total Credits — real values reach the DOM).
 *   2. The CFO Approve + Reject actions are present on a still-Pending batch (canDecide gate).
 *   3. Clicking Approve drives the real engine: the batch flips Pending → Approved and the "Dispatch to
 *      <ERP>" action becomes available (the approval gate opening dispatch).
 *
 * The Batch Approvals inbox has no Build control (batches are built from the Batch Status page — see its
 * empty-state), so this spec first builds a batch through the real Batch Status → Build preview flow,
 * which is the only in-app path to get a Pending batch into the inbox.
 *
 * Reuses lib/batching-fixture.ts (same as batching-reject.spec.ts): a throwaway company with a configured
 * CFO + three balanced Pending JEs, and a stray-Pending-free DB (buildBatch is a GLOBAL sweep). afterAll
 * tears the fixture down. Selectors read from batch-dispatch-dashboard.component.html (`.bd-card`,
 * `.bd-card__number`, `.bd-metric`, mj-stat-badge, Approve/Reject/Dispatch buttons) and
 * batch-status-dashboard.component.html (the "Build Batch" action + the "Build batch (N)" preview confirm).
 */
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loginViaMagicLink } from '../lib/auth';
import { captureConsoleErrors, expectNoConsoleErrors, openAccountingApp, openNavItem, pageBody } from '../lib/explorer';
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
    console.warn(`[batch-approvals afterAll] teardown warning: ${e instanceof Error ? e.message : e}`);
  }
});

test('Batch Approvals — build → inbox card → Approve (reactive) → Dispatch advances the batch to Posted', async ({ page }) => {
  await loginViaMagicLink(page);
  const sink = captureConsoleErrors(page);

  await openAccountingApp(page);

  // ── 1. Build a batch on the Batch Status page (its Build → preview → confirm flow) ──
  // The fixture's 3 Pending JEs are the only candidates (stray-Pending-free DB), and its company has a CFO.
  await openNavItem(page, NAV.batchStatus);
  await expect(pageBody(page), 'Batch Status dashboard should render').toBeVisible({ timeout: 30_000 });
  // Match the proven locator from batch-status.spec.ts: UNANCHORED name (the button label carries a
  // leading icon) + wait on visibility (the header action renders as the dashboard's loadData resolves).
  const buildBtn = page.getByRole('button', { name: /Build Batch/i }).first();
  await expect(buildBtn, 'Batch Status should offer a "Build Batch" action').toBeVisible({ timeout: 30_000 });
  await buildBtn.click();
  await page.waitForTimeout(3000);
  // The preview dialog opens and its confirm button reads "Build batch (N)" with the candidate count.
  const confirmBuild = page.getByRole('button', { name: /Build batch \(\d+\)/i }).first();
  await expect(confirmBuild, 'the Build preview should show a confirm button with the candidate count').toBeEnabled({ timeout: 15_000 });
  await confirmBuild.click();
  await page.waitForTimeout(7000);

  // ── 2. Open the Batch Approvals inbox — the built batch appears as a Pending, awaiting-approval card ──
  await openNavItem(page, NAV.batchApprovals);
  await expect(pageBody(page), 'Batch Approvals dashboard should render').toBeVisible({ timeout: 30_000 });

  // The only awaiting-approval (Pending + not-yet-approved) card is the one we just built.
  const pendingCard = page
    .locator('.bd-card')
    .filter({ has: page.locator('mj-stat-badge').filter({ hasText: /Awaiting approval/i }) })
    .first();
  await expect(pendingCard, 'the built batch should appear as an awaiting-approval card').toBeVisible({ timeout: 20_000 });
  const batchNumber = (await pendingCard.locator('.bd-card__number').first().innerText()).trim();
  expect(batchNumber.length, 'the pending batch card should show its batch number').toBeGreaterThan(0);

  // PRESENCE + real values — the Pending status badge + the control-total metrics.
  await expect(
    pendingCard.locator('mj-stat-badge').filter({ hasText: /^Pending$/ }).first(),
    'the built batch should carry a Pending status badge',
  ).toBeVisible();
  const entriesMetric = pendingCard.locator('.bd-metric').filter({ has: page.locator('.bd-metric__label', { hasText: /Entries/i }) }).first();
  await expect(entriesMetric, 'the card should show an Entries metric').toBeVisible();
  await expect(entriesMetric.locator('.bd-metric__value'), 'the Entries metric should show a real count').toHaveText(/\d+/);
  await expect(pendingCard.locator('.bd-metric__label', { hasText: /Total Debits/i }).first(), 'the card should show a Total Debits metric').toBeVisible();
  await expect(pendingCard.locator('.bd-metric__label', { hasText: /Total Credits/i }).first(), 'the card should show a Total Credits metric').toBeVisible();

  // PRESENCE — the CFO Approve + Reject controls (canDecide: Pending & not yet approved).
  const approveBtn = pendingCard.getByRole('button', { name: /Approve/i }).first();
  await expect(approveBtn, 'Approve should be present on a Pending batch').toBeVisible();
  await expect(pendingCard.getByRole('button', { name: /Reject/i }).first(), 'Reject should be present on a Pending batch').toBeVisible();

  // ── 3. BEHAVIOR — Approve drives the engine AND the card REACTIVELY reflects it (no manual refresh) ──
  // OnRecordDecision reloads the batch list (via a BypassCache RunView) after the approval resolves, so
  // the just-approved card must flip to Approved on its own. (A prior version needed a manual Refresh —
  // that was a stale-cache bug, now fixed with BypassCache in loadBatches.)
  await approveBtn.click();
  const approvedCard = page
    .locator('.bd-card', { has: page.locator('.bd-card__number', { hasText: batchNumber }) })
    .first();
  await expect(
    approvedCard.locator('mj-stat-badge').filter({ hasText: /^Approved$/ }).first(),
    'approving should flip the batch status badge to Approved',
  ).toBeVisible({ timeout: 20_000 });
  const dispatchBtn = approvedCard.getByRole('button', { name: /Dispatch to/i }).first();
  await expect(
    dispatchBtn,
    'an Approved batch should now offer the Dispatch action (approval gate opened dispatch)',
  ).toBeVisible({ timeout: 15_000 });

  // ── 4. BEHAVIOR — Dispatch drives the mock ERP poster: the batch advances Approved → Posted ──
  // Completes the full batch spine (Build → Approve → Dispatch → Posted) in ONE spec, superseding the
  // old batching.spec (which navigated the removed "Batches" nav). Card update is reactive (BypassCache).
  await dispatchBtn.click();
  const postedCard = page
    .locator('.bd-card', { has: page.locator('.bd-card__number', { hasText: batchNumber }) })
    .first();
  await expect(
    postedCard.locator('mj-stat-badge').filter({ hasText: /^Posted$/ }).first(),
    'dispatching should advance the batch to Posted (mock ERP poster)',
  ).toBeVisible({ timeout: 20_000 });

  expectNoConsoleErrors(sink, 'building → approving → dispatching a batch in the Batch Approvals inbox');
});
