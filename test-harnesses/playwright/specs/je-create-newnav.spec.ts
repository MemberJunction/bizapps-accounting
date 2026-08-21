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
import { openAccountingApp, openNavItem, captureConsoleErrors, expectNoConsoleErrors, resetCompanyScopeToAll, scopeToCompany, pickMjDropdown } from '../lib/explorer';
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
  // Anchored regex, not exact:true (2026-07-30): rail badges fold their count into the button's
  // accessible name ("Batch approvals 2"), so exact broke once a count rendered; the anchors
  // still block the substring collision exact was guarding (the scope chip name).
  await page.getByRole('button', { name: new RegExp('^' + item + '( \\d+)?$') }).first().click();
  await page.mouse.move(820, 480); // hover-peek retract
  await page.waitForTimeout(3500);
}

test('JE workspace: balanced 2-line draft → Create entry → Pending JE confirmed and listed', async ({ page }) => {
  const sink = captureConsoleErrors(page);
  await loginViaMagicLink(page);
  await openAccountingApp(page);
  await resetCompanyScopeToAll(page);
  await scopeToCompany(page, fx!.companyName);

  // Enter the workspace THROUGH the All-journal-entries "New journal entry" header button
  // (Marcelo 2026-07-30) — proves the list page's create verb is present AND lands on the
  // workspace, then the rest of the flow proves the workspace works from that entry path.
  await railItem(page, 'Journal Entries', 'All journal entries');
  const newJe = page.getByRole('button', { name: /New journal entry/i }).first();
  await expect(newJe, 'All journal entries carries the New-journal-entry verb').toBeVisible({ timeout: 30_000 });
  await newJe.click();
  await expect(page.getByRole('button', { name: /Create entry/i }).first(), 'create verb landed on the JE workspace').toBeVisible({ timeout: 30_000 });

  // Header: pick the fixture company (label-wrapped select → getByLabel works).
  // The header company picker is an mj-dropdown now (2026-08-05 conversion).
  await pickMjDropdown(page, page, 'Company', fx!.companyName);
  await page.waitForTimeout(2500); // accounts load for the picker

  // Two line rows: the GL picker is each row's first mj-dropdown; Debit/Credit are the .num inputs.
  const rows = page.locator('tr', { has: page.locator('mj-dropdown') });
  const row = (i: number) => rows.nth(i);
  const fillLine = async (i: number, glCode: string, side: 'debit' | 'credit', amount: string) => {
    await row(i).locator('mj-dropdown').first().click();
    await page.locator('.mj-dropdown-panel .mj-dropdown-option', { hasText: glCode }).first().click();
    await page.waitForTimeout(300);
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

  // The confirmation names the minted entry number — capture it for the listing check below.
  const confirm = page.getByText(/JE-[A-Z0-9]+-\d{4}-\d{6}/).first();
  await expect(confirm, 'the created JE number is shown').toBeVisible({ timeout: 20_000 });
  const jeNumber = ((await confirm.textContent()) ?? '').match(/JE-[A-Z0-9]+-\d{4}-\d{6}/)?.[0];
  if (!jeNumber) throw new Error('could not extract the minted JE number from the confirmation text');

  // And it exists as a Pending row in All journal entries — searched by its ENTRY NUMBER (the
  // search contract is "Memo, entry № or ID"; an amount was never searchable). Unconditional:
  // a missing search box is a failure, never a silent skip.
  await railItem(page, 'Journal Entries', 'All journal entries');
  const search = page.getByRole('searchbox', { name: /Search journal entries/i }).first();
  await expect(search, 'the list-toolbar search renders').toBeVisible({ timeout: 15_000 });
  await search.fill(jeNumber);
  await page.waitForTimeout(2500);
  const createdRow = page.locator('.ag-row').filter({ hasText: jeNumber }).first();
  await expect(createdRow, `the created ${jeNumber} lists in All journal entries`).toBeVisible({ timeout: 30_000 });
  await expect(createdRow, 'and it is Pending').toContainText('Pending');

  expectNoConsoleErrors(sink, 'JE creation via the workspace');
});
