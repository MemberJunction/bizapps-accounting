/**
 * bc-aidp-next-golive#168 acceptance: a manual journal entry created just after midnight Eastern
 * on 1 September has a posting date of 31 August after the workspace renders its default, because
 * the BUSINESS zone (Central) has not yet crossed into September.
 *
 * The instant is chosen so the browser zone and the business zone genuinely DISAGREE on the day,
 * which is the only way this spec can tell "reads the business zone" from "reads the browser's
 * zone." An earlier version of this spec pinned 2026-09-01T01:00:00.000Z, at which New York (21:00
 * on the 31st) and Chicago (20:00 on the 31st) both still read 31 August — so a browser-local
 * default (the pre-#168 behavior) would ALSO have landed on the 31st and the spec would have
 * passed for the wrong reason. This instant is 2026-09-01T04:30:00.000Z: 00:30 EDT on 1 September
 * in the browser's zone (America/New_York, `test.use({ timezoneId })` below) but still 23:30 CDT
 * on 31 August in the business zone (America/Chicago) — UTC is already the 1st in both. Only a
 * default computed in the business zone lands on the 31st; a browser-local (or UTC) default would
 * show 1 September.
 *
 * Modelled on `je-create-newnav.spec.ts`'s fixture setup/teardown and nav helpers.
 *
 * NOT RUN. Written and never executed: no seeded database and no running app instance were
 * reachable from this environment. See task-C4-report.md for what "PASS" would require and how to
 * run it once one is.
 */
import { test, expect, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { loginViaMagicLink } from '../lib/auth';
import { openAccountingApp, openNavItem, captureConsoleErrors, expectNoConsoleErrors, resetCompanyScopeToAll, scopeToCompany } from '../lib/explorer';
import { HARNESS_DIR } from '../lib/env';

test.use({ timezoneId: 'America/New_York' });

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

// Same rail helper as je-create-newnav.spec.ts: anchored regex (not exact:true) because rail
// badges fold their count into the button's accessible name ("Batch approvals 2").
async function railItem(page: Page, category: string, item: string): Promise<void> {
  await openNavItem(page, category);
  await page.getByRole('button', { name: new RegExp('^' + item + '( \\d+)?$') }).first().click();
  await page.mouse.move(820, 480); // hover-peek retract
  await page.waitForTimeout(3500);
}

test('a JE workspace opened just after midnight Eastern on 1 September defaults its posting date to 31 August', async ({ page }) => {
  // 2026-09-01T04:30:00.000Z = 00:30 EDT on 1 September in the browser's zone (America/New_York)
  // but 23:30 CDT on 31 August in the instance's business zone (America/Chicago) — the browser and
  // the business zone DISAGREE on the day here (New York has already crossed midnight, Chicago has
  // not), which is what makes this instant discriminate the fix. UTC is already the 1st in both.
  // Only a default computed in the business zone lands on the 31st; a browser-local default would
  // show 1 September.
  await page.clock.setFixedTime(new Date('2026-09-01T04:30:00.000Z'));
  const sink = captureConsoleErrors(page);
  await loginViaMagicLink(page);
  await openAccountingApp(page);
  await resetCompanyScopeToAll(page);
  await scopeToCompany(page, fx!.companyName);

  // Enter the workspace through the All-journal-entries "New journal entry" header button, same
  // entry path je-create-newnav.spec.ts proves works.
  await railItem(page, 'Journal Entries', 'All journal entries');
  const newJe = page.getByRole('button', { name: /New journal entry/i }).first();
  await expect(newJe, 'All journal entries carries the New-journal-entry verb').toBeVisible({ timeout: 30_000 });
  await newJe.click();
  await expect(page.getByRole('button', { name: /Create entry/i }).first(), 'create verb landed on the JE workspace').toBeVisible({ timeout: 30_000 });

  // Posting date: `<label><span>Posting date</span><input type="date" ...></label>` in
  // je-workspace.page.html — implicit label association, so getByLabel resolves it.
  const postingDate = page.getByLabel(/posting date/i);
  await expect(postingDate, 'the workspace defaults the posting date to the business day, not the UTC day').toHaveValue('2026-08-31');

  expectNoConsoleErrors(sink, 'JE workspace posting-date default at 9 PM Eastern on 31 August');
});
