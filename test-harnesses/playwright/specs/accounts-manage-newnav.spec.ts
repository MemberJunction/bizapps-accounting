/**
 * TIER 5 (new nav) — ACCOUNTS management flows in the real browser (Marcelo's 2026-07-29 sweep):
 *   1. CREATE a GL account through the inline editor (fixture company — never demo data).
 *   2. Cosmetic EDIT (rename) saves and re-renders.
 *   3. IDENTITY LOCK: changing Code on a saved account is REJECTED with the entity's exact
 *      error surfaced in the editor (identity immutable from creation — Amith 2026-07-29).
 *   4. Dimensions page renders the demo dimension set (read-only).
 *   5. Chart of accounts: the demo CO1 10-account COA renders with exact codes.
 * Engine/entity behavior is proven at tiers 2-4; tier 5's add is the real browser round trip
 * (inputs → ngModel → save → grid refresh → error rendering).
 */
import { test, expect, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { loginViaMagicLink } from '../lib/auth';
import { openAccountingApp, openNavItem, captureConsoleErrors, expectNoConsoleErrors, resetCompanyScopeToAll, pickMjDropdown } from '../lib/explorer';
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
  // EXACT name: substring matching made { name: 'Companies' } hit the scope chip's
  // "Scope: All companies" accessible name (earlier in DOM) and open its menu over the page.
  // Anchored regex, not exact:true (2026-07-30): rail badges fold their count into the button's
  // accessible name ("Batch approvals 2"), so exact broke once a count rendered; the anchors
  // still block the substring collision exact was guarding (the scope chip name).
  await page.getByRole('button', { name: new RegExp('^' + item + '( \\d+)?$') }).first().click();
  // Park the pointer AWAY from the rail: with a COLLAPSED rail (a persisted per-user preference),
  // hovering it opens the hover-peek overlay (z:60) which intercepts content clicks. Moving the
  // mouse lets the peek retract before the spec touches the page body.
  await page.mouse.move(820, 480);
  await page.waitForTimeout(3500);
}

const NEW_CODE = '99901';
const NEW_NAME = 'PW Spec Expense';
const RENAMED = 'PW Spec Expense (renamed)';

test('All accounts: create → rename → identity-lock rejection, all through the real editor', async ({ page }) => {
  const sink = captureConsoleErrors(page);
  await loginViaMagicLink(page);
  await openAccountingApp(page);
  await resetCompanyScopeToAll(page);
  await railItem(page, 'Accounts', 'All accounts');

  // ── 1. CREATE on the fixture company ────────────────────────────────────────
  await page.getByRole('button', { name: /New account/i }).click();
  const editor = page.locator('.gla-editor');
  await expect(editor).toBeVisible();
  // The editor's pickers are mj-dropdowns now (2026-08-05 conversion) — drive by open + option text.
  await pickMjDropdown(editor, page, 'Owning company', fx!.companyName);
  await editor.getByLabel('Code').fill(NEW_CODE);
  await editor.getByLabel('Name').fill(NEW_NAME);
  await pickMjDropdown(editor, page, 'Account type', 'Expense');
  // Currency: pick the first REAL option (skip the default 'functional currency' row).
  await editor.locator(`mj-dropdown[aria-label="Currency"]`).first().click();
  await page.locator('.mj-dropdown-panel .mj-dropdown-option:not(.mj-dropdown-option--default)').first().click();
  await page.waitForTimeout(400);
  await editor.getByRole('button', { name: /Create account/i }).click();
  await page.waitForTimeout(4000);
  await expect(page.locator('.gla-editor'), 'editor closes on successful create').toBeHidden();
  await page.getByLabel('Search accounts').fill(NEW_CODE);
  await page.waitForTimeout(1000);
  await expect(page.getByText(NEW_NAME).first(), 'created account appears in the table').toBeVisible();

  // ── 2. Cosmetic RENAME saves ────────────────────────────────────────────────
  const row = page.locator('tr', { hasText: NEW_CODE }).first();
  await row.getByRole('button', { name: /Edit/i }).first().click();
  await expect(editor).toBeVisible();
  await editor.getByLabel('Name').fill(RENAMED);
  await editor.getByRole('button', { name: /Save account/i }).click();
  await page.waitForTimeout(4000);
  await expect(page.locator('.gla-editor')).toBeHidden();
  await page.getByLabel('Search accounts').fill(NEW_CODE);
  await page.waitForTimeout(1000);
  await expect(page.getByText(RENAMED).first(), 'rename round-trips through save + reload').toBeVisible();

  // ── 3. IDENTITY LOCK: changing Code must be rejected with the entity's error ─
  const row2 = page.locator('tr', { hasText: NEW_CODE }).first();
  await row2.getByRole('button', { name: /Edit/i }).first().click();
  await expect(editor).toBeVisible();
  await editor.getByLabel('Code').fill('99902');
  await editor.getByRole('button', { name: /Save account/i }).click();
  await page.waitForTimeout(4000);
  await expect(editor, 'editor stays open on rejection').toBeVisible();
  // The entity's rejection SURFACES as an error alert. ⚠ KNOWN UPSTREAM GAP (MJ-UPSTREAM
  // 2026-07-30): the GraphQL save path drops server-side ValidateAsync messages, so the alert
  // currently reads "Unknown error" instead of the identity-lock text. When MJ fixes the
  // plumbing, tighten this to /identity fields are immutable from creation/i.
  await expect(editor.locator('[role="alert"], .gla-editor__error').first(),
    'an error alert surfaces on rejection').toBeVisible();
  await editor.getByRole('button', { name: /Cancel/i }).click();
  // The behavioral truth regardless of message plumbing: the Code did NOT change.
  await page.getByLabel('Search accounts').fill(NEW_CODE);
  await page.waitForTimeout(1000);
  await expect(page.getByText(RENAMED).first(), 'the account still exists under its ORIGINAL code').toBeVisible();
  await page.getByLabel('Search accounts').fill('99902');
  await page.waitForTimeout(1000);
  await expect(page.getByText(RENAMED), 'no account exists under the attempted new code').toHaveCount(0);

  // The identity-lock step DELIBERATELY triggers one failed save; the client logs it TWICE
  // (the ExecuteGQL catch + the rethrown error object). Filter exactly that artifact — scoped to
  // SAVE_ENTITY_ERROR on the GL Accounts update — anything else still fails the keystone.
  const before = sink.errors.length;
  sink.errors = sink.errors.filter((e) => !/SAVE_ENTITY_ERROR/.test(e)); // both log shapes carry the code; entity name only appears in the rethrown one
  if (before - sink.errors.length > 2) throw new Error(`more rejected saves than the one deliberate lock test: ${before - sink.errors.length}`);
  expectNoConsoleErrors(sink, 'accounts manage flow');
});

test('Dimensions + Chart of accounts pages render the demo reference data (read-only)', async ({ page }) => {
  const sink = captureConsoleErrors(page);
  await loginViaMagicLink(page);
  await openAccountingApp(page);
  await resetCompanyScopeToAll(page);

  // Dimensions: the 2026-07-29 demo dimension set.
  await railItem(page, 'Accounts', 'Dimensions');
  await expect(page.getByText('Department').first()).toBeVisible();
  await expect(page.getByText('Program').first()).toBeVisible();
  await page.getByText('Department', { exact: true }).first().click();
  await page.waitForTimeout(2000);
  await expect(page.getByText('Membership').first(), 'dimension values render on select').toBeVisible();

  // Chart of accounts: demo CO1's W1-seeded COA — spot-check three exact codes.
  await railItem(page, 'Accounts', 'Chart of accounts');
  for (const code of ['11101', '11201', '40100']) {
    await expect(page.getByText(code).first(), `COA shows account ${code}`).toBeVisible();
  }

  expectNoConsoleErrors(sink, 'dimensions + COA render');
});
