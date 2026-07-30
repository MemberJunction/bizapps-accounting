/**
 * TIER 5 (new nav) — CREATE a journal entry through the JE WORKSPACE (the last of Marcelo's
 * 2026-07-29 flow sweep). Real browser round trip: pick the fixture company, fill a balanced
 * 2-line draft (Dr 77 / Cr 77), Create entry → the confirmation names the new JE-… number and
 * the entry lands Pending in All journal entries. Engine/entity behavior is tiers 1-4 proven;
 * tier 5's add is the workspace's form → engine op → confirmation loop.
 * Fixture company + teardown (never demo data).
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
  if (!line) throw new Error(`fixture setup emitted no FIXTURE_JSON:\n${out.slice(-400)}`);
  fx = JSON.parse(line.slice('FIXTURE_JSON '.length));
});
test.afterAll(() => {
  if (fx) { try { execFileSync(TSX, [FIXTURE, 'teardown', fx.companyId, fx.cfoPersonId], { cwd: WORKTREE_ROOT, encoding: 'utf8', timeout: 180_000 }); } catch { /* best-effort */ } }
});

async function railItem(page: Page, category: string, item: string): Promise<void> {
  await openNavItem(page, category);
  await page.getByRole('button', { name: item, exact: true }).first().click();
  await page.mouse.move(820, 480); // hover-peek retract
  await page.waitForTimeout(3500);
}

test('JE workspace: balanced 2-line draft → Create entry → Pending JE confirmed and listed', async ({ page }) => {
  const sink = captureConsoleErrors(page);
  await loginViaMagicLink(page);
  await openAccountingApp(page);
  await resetCompanyScopeToAll(page);
  await scopeToCompany(page, fx!.companyName);

  await railItem(page, 'Journal Entries', 'JE workspace');

  // Header: pick the fixture company (label-wrapped select → getByLabel works).
  const company = page.getByLabel(/Company/i).first();
  await company.selectOption({ label: fx!.companyName });
  await page.waitForTimeout(2500); // accounts load for the picker

  // Two line rows: GL select is each row's first select; Debit/Credit are the .num inputs.
  const rows = page.locator('tr', { has: page.locator('select.mj-input') });
  const row = (i: number) => rows.nth(i);
  const fillLine = async (i: number, glCode: string, side: 'debit' | 'credit', amount: string) => {
    const gl = row(i).locator('select').first();
    const opt = gl.locator('option', { hasText: glCode }).first();
    await gl.selectOption({ label: (await opt.textContent())?.trim() ?? glCode });
    const nums = row(i).locator('input.num');
    await nums.nth(side === 'debit' ? 0 : 1).fill(amount);
  };
  await fillLine(0, '11201', 'debit', '77');
  await fillLine(1, '40100', 'credit', '77');
  await page.waitForTimeout(800);

  const create = page.getByRole('button', { name: /Create entry/i }).first();
  await expect(create, 'a balanced draft enables Create entry').toBeEnabled({ timeout: 15_000 });
  await create.click();
  await page.waitForTimeout(6000);

  // The confirmation names the minted entry number.
  await expect(page.getByText(/JE-[A-Z0-9]+-\d{4}-\d{6}/).first(), 'the created JE number is shown').toBeVisible({ timeout: 20_000 });

  // And it exists as a Pending row in All journal entries.
  await railItem(page, 'Journal Entries', 'All journal entries');
  const search = page.getByRole('searchbox', { name: /Search entries/i }).first();
  if (await search.isVisible().catch(() => false)) { await search.fill('77'); await page.waitForTimeout(2500); }
  await expect(page.locator('.ag-row', { hasText: 'Pending' }).first(), 'the new entry lists as Pending').toBeVisible({ timeout: 30_000 });

  expectNoConsoleErrors(sink, 'JE creation via the workspace');
});
