/**
 * Tier-3 API harness — 'Accounting.CreateJournalEntry' via the REAL client mechanism the app uses:
 * `provider.RouteOperation(operationKey, input)` (an `IRemoteOperationProvider` call), NOT a
 * hand-rolled `ExecuteRemoteOperation` GraphQL envelope (which the old engine-op-api.ts builds).
 * RouteOperation is exactly how the browser invokes a remote op — same as the orders clients.
 *
 * Same three proofs as engine-op-api: (1) success + merge + EntryNumber format, (2) typed logical
 * failure (UNBALANCED) inside the output with transport still green, (3) unknown key refused.
 *
 * Fixture: the batching-fixture subprocess (isolated CFO company + GL). Run from the worktree root:
 *   npx tsx packages/dev-apps/bizapps-accounting/test-harnesses/api/engine-op-client.ts
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { RunView, UserInfo } from '@memberjunction/core';
import { bootstrapClientProvider, makeChecker, failBootstrap } from './_client-bootstrap.js';

const WORKTREE_ROOT = process.cwd();
const TSX = path.resolve(WORKTREE_ROOT, 'node_modules', '.bin', 'tsx');
const FIXTURE = path.resolve(WORKTREE_ROOT, 'packages/dev-apps/bizapps-accounting/test-harnesses/playwright/lib/batching-fixture.ts');
const GL_ENTITY = 'MJ_BizApps_Accounting: GL Accounts';

interface Fixture { companyId: string; cfoPersonId: string; runTag: string; }
interface OpEnvelope<T> { Success: boolean; Output?: T; ErrorMessage?: string; ResultCode?: string; }
interface CreateJEOutput { Success: boolean; JournalEntryID?: string; EntryNumber?: string; LineCount?: number; Errors?: Array<{ Code: string }>; }

function fixtureSetup(): Fixture {
  const out = execFileSync(TSX, [FIXTURE, 'setup'], { cwd: WORKTREE_ROOT, encoding: 'utf8', timeout: 180_000 });
  const line = out.split('\n').find((l) => l.startsWith('FIXTURE_JSON '));
  if (!line) failBootstrap(`batching-fixture emitted no FIXTURE_JSON:\n${out.slice(-500)}`);
  return JSON.parse(line.slice('FIXTURE_JSON '.length));
}
function fixtureTeardown(fx: Fixture): void {
  try { execFileSync(TSX, [FIXTURE, 'teardown', fx.companyId, fx.cfoPersonId], { cwd: WORKTREE_ROOT, encoding: 'utf8', timeout: 180_000 }); console.log('  (fixture torn down)'); }
  catch (e) { console.log(`  [teardown warning] ${e instanceof Error ? e.message.split('\n')[0] : String(e)}`); }
}

async function resolveGL(user: UserInfo, companyId: string): Promise<{ arGL: string; revGL: string }> {
  const r = await new RunView().RunView<{ ID: string; Code: string }>({ EntityName: GL_ENTITY, ExtraFilter: `CompanyID='${companyId}' AND Code IN ('11201','40100')`, Fields: ['ID', 'Code'], ResultType: 'simple' }, user);
  const arGL = (r.Results ?? []).find((x) => x.Code === '11201')?.ID ?? '';
  const revGL = (r.Results ?? []).find((x) => x.Code === '40100')?.ID ?? '';
  if (!arGL || !revGL) throw new Error('could not resolve seeded GL accounts 11201/40100');
  return { arGL, revGL };
}

async function main(): Promise<void> {
  console.log('=== Tier-3 API harness: Accounting.CreateJournalEntry via REAL provider.RouteOperation ===');
  const { check, summary } = makeChecker();
  console.log('Provisioning isolated company via the batching fixture…');
  const fx = fixtureSetup();
  console.log(`  fixture company ${fx.companyId} (${fx.runTag})`);

  // provider AFTER the fixture subprocess (stale keep-alive rule)
  const provider = await bootstrapClientProvider();
  const user = provider.CurrentUser;
  // RouteOperation is the IRemoteOperationProvider call the app makes; typed loosely here.
  const route = <T>(key: string, input: unknown) => (provider as unknown as { RouteOperation: (k: string, i: unknown) => Promise<OpEnvelope<T>> }).RouteOperation(key, input);

  try {
    const { arGL, revGL } = await resolveGL(user, fx.companyId);

    // 1. Success — merge duplicate debit lines, EntryNumber format, JournalEntryID.
    console.log('\n1. CreateJournalEntry via RouteOperation (success):');
    const draft = { EffectiveDate: new Date().toISOString(), EntryType: 'OrderBooking', Description: `${fx.runTag} engine-op-client`, Lines: [ { GLAccountID: arGL, DebitAmount: 70 }, { GLAccountID: arGL, DebitAmount: 30 }, { GLAccountID: revGL, CreditAmount: 100 } ] };
    const ok = await route<CreateJEOutput>('Accounting.CreateJournalEntry', draft);
    check('transport success (RouteOperation.Success)', ok.Success === true, `${ok.ResultCode ?? ''} ${ok.ErrorMessage ?? ''}`);
    check('Output.Success === true', ok.Output?.Success === true, JSON.stringify(ok.Output?.Errors));
    check('EntryNumber matches JE-{CompanyCode}-{FY}-{seq:000000}', /^JE-[A-Z0-9_-]{2,20}-\d{4}-\d{6}$/.test(ok.Output?.EntryNumber ?? ''), `got '${ok.Output?.EntryNumber}'`);
    check('LineCount === 2 (duplicate debit lines merged over the real client too)', ok.Output?.LineCount === 2, `got ${ok.Output?.LineCount}`);
    check('a JournalEntryID came back', !!ok.Output?.JournalEntryID, JSON.stringify(ok.Output));

    // 2. Unbalanced → typed logical failure INSIDE the output, transport still green.
    console.log('\n2. Unbalanced draft (typed failure, transport green):');
    const bad = await route<CreateJEOutput>('Accounting.CreateJournalEntry', { ...draft, Description: `${fx.runTag} unbalanced`, Lines: [ { GLAccountID: arGL, DebitAmount: 100 }, { GLAccountID: revGL, CreditAmount: 60 } ] });
    check('transport success (logical failures do not fail the transport)', bad.Success === true, `${bad.ResultCode ?? ''} ${bad.ErrorMessage ?? ''}`);
    check('Output.Success === false with UNBALANCED', bad.Output?.Success === false && (bad.Output?.Errors ?? []).some((e) => e.Code === 'UNBALANCED'), JSON.stringify(bad.Output));

    // 3. Unknown key → the registry gate over the real client.
    console.log('\n3. Unknown operation key:');
    const unknown = await route<unknown>('Accounting.NoSuchOperation', {});
    check('unknown key refused (Success false)', unknown.Success === false, JSON.stringify(unknown));
  } catch (e) {
    check('wire flow completed without throwing', false, e instanceof Error ? (e.stack ?? e.message) : String(e));
  } finally {
    console.log('\nTearing down the fixture company…');
    fixtureTeardown(fx);
  }
  process.exit(summary('engine-op tier-3 (real client)') === 0 ? 0 : 1);
}
main().catch((e) => failBootstrap(e instanceof Error ? (e.stack ?? e.message) : String(e)));
