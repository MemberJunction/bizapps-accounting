/**
 * Tier-3 API harness — JE-batch SCENARIOS (multi-company sweep · due-to/from · reject · no-CFO),
 * driven through the app's REAL clients (`BatchDispatchClient` + `ReadModelsClient`), replacing the
 * hand-rolled `fetch` of `batching-scenarios-api.ts`. Same waves, same assertions, real client path.
 *
 * Fixture: `batching-scenarios-fixture` subprocess (direct SQL) — provisions 3 companies, seeds each
 * wave's JEs right before its build. After every seed subprocess we do a cheap warmup read so the
 * next client mutation doesn't hit a keep-alive connection the subprocess gap left stale (ECONNRESET).
 *
 * Run from the worktree root:
 *   npx tsx packages/dev-apps/bizapps-accounting/test-harnesses/api/batching-scenarios-client.ts
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { RunView } from '@memberjunction/core';
import { bootstrapClientProvider, makeChecker, failBootstrap } from './_client-bootstrap.js';
import { BatchDispatchClient } from '../../packages/Angular/src/lib/custom/BatchDispatch/batch-dispatch.client.js';
import { ReadModelsClient } from '../../packages/Angular/src/lib/custom/shared/read-models.client.js';

const WORKTREE_ROOT = process.cwd();
const TSX = path.resolve(WORKTREE_ROOT, 'node_modules', '.bin', 'tsx');
const FIXTURE = path.resolve(WORKTREE_ROOT, 'packages/dev-apps/bizapps-accounting/test-harnesses/playwright/lib/batching-scenarios-fixture.ts');
const TARGET = 'BusinessCentral';
const ROLE_ENTITY = 'MJ_BizApps_Accounting: GL Account Roles';

interface Scenarios { runTag: string; coA: { companyId: string }; coB: { companyId: string }; coC: { companyId: string }; }

function runFixture(args: string[], expect: string): string | null {
  const out = execFileSync(TSX, [FIXTURE, ...args], { cwd: WORKTREE_ROOT, encoding: 'utf8', timeout: 240_000 });
  return out.split('\n').find((l) => l.startsWith(expect)) ?? null;
}
function setupFixture(): Scenarios {
  const line = runFixture(['setup'], 'SCENARIOS_JSON ');
  if (!line) failBootstrap('scenarios fixture did not emit SCENARIOS_JSON');
  return JSON.parse(line.slice('SCENARIOS_JSON '.length));
}
function seedWave(sc: Scenarios, wave: string): void {
  if (!runFixture(['seed', JSON.stringify(sc), wave], 'SEEDED ')) throw new Error(`fixture did not confirm seeding ${wave}`);
}
function teardownFixture(sc: Scenarios): void {
  try { execFileSync(TSX, [FIXTURE, 'teardown', JSON.stringify(sc)], { cwd: WORKTREE_ROOT, encoding: 'utf8', timeout: 240_000 }); console.log('  (scenarios fixture torn down)'); }
  catch (e) { console.log(`  [teardown warning] ${e instanceof Error ? e.message.split('\n')[0] : String(e)}`); }
}

async function main(): Promise<void> {
  console.log('=== Tier-3 API harness: batch SCENARIOS via REAL BatchDispatchClient + ReadModelsClient ===');
  const { check, summary } = makeChecker();
  console.log('Provisioning 3-company scenarios fixture (waves seed per scenario)…');
  const sc = setupFixture();
  console.log(`  ${sc.runTag}: CoA ${sc.coA.companyId} · CoB ${sc.coB.companyId} · CoC ${sc.coC.companyId}`);

  const provider = await bootstrapClientProvider(); // AFTER the fixture subprocess
  const user = provider.CurrentUser;
  const batch = new BatchDispatchClient(provider);
  const readModels = new ReadModelsClient(provider);
  // re-establish the pooled connection after a seed subprocess (else the next POST can ECONNRESET)
  const warmup = () => new RunView().RunView({ EntityName: ROLE_ENTITY, Fields: ['Name'], MaxRows: 1, ResultType: 'simple' }, user);

  try {
    // A. Multi-company sweep (wave1: CoA 2 JEs + CoB 1 JE → ONE global batch).
    console.log('\nA. Multi-company sweep:');
    seedWave(sc, 'wave1'); await warmup();
    const a = await batch.BuildBatch(TARGET);
    check('global build succeeds', a.Success === true, a.ErrorMessage);
    check('JECount === 3 (both companies swept into one batch)', a.JECount === 3, `got ${a.JECount}`);
    check('CompanyCount === 2 (CH-4 multi-company batch)', a.CompanyCount === 2, `got ${a.CompanyCount}`);
    check('batch foots 1000/1000 across companies', a.TotalDebits === 1000 && a.TotalCredits === 1000, `${a.TotalDebits}/${a.TotalCredits}`);
    if (!a.BatchID) throw new Error('wave1 batch missing');

    // B. Due-to/from preserved through batching (no cross-company balancing).
    console.log('\nB. Due-to/from preserved:');
    check('wave1 approve recorded', (await batch.RecordDecision(a.BatchID, 'Approved', 'scenarios-client')).Success === true);
    const disA = await batch.DispatchBatch(a.BatchID);
    check("wave1 dispatch → Status 'Posted'", disA.Success === true && disA.Status === 'Posted', JSON.stringify(disA));
    const icA = await readModels.IntercompanyFlow(sc.coA.companyId);
    check('CoA shows its intercompany leg after batching (tag preserved)', icA.length >= 1 && icA.every((r) => r.EntryType === 'IntercompanyFlow'), `rows=${icA.length}`);
    const icB = await readModels.IntercompanyFlow(sc.coB.companyId);
    check('CoB shows NO intercompany leg (no cross-company balancing generated)', icB.length === 0, `got ${icB.length}`);

    // C. Reject path.
    console.log('\nC. Reject path:');
    seedWave(sc, 'wave2'); await warmup();
    const b = await batch.BuildBatch(TARGET);
    check('wave2 build succeeds (1 JE)', b.Success === true && b.JECount === 1, `JECount=${b.JECount} (${b.ErrorMessage ?? ''})`);
    if (!b.BatchID) throw new Error('wave2 batch missing');
    check('wave2 reject recorded', (await batch.RecordDecision(b.BatchID, 'Rejected', 'scenarios-client')).Success === true);
    check('wave2 NOT approved after rejection', (await batch.GetApprovalState(b.BatchID)).Approved === false);
    const disB = await batch.DispatchBatch(b.BatchID);
    check('wave2 dispatch REFUSED (rejected cannot dispatch)', disB.Success === false, `Success=${disB.Success}`);
    check('refusal names the Approved requirement', /approved/i.test(disB.ErrorMessage ?? ''), `ErrorMessage='${disB.ErrorMessage ?? ''}'`);

    // D. No-CFO hard-fail (wave3: CoC has no configured CFO).
    console.log('\nD. No-CFO hard-fail:');
    seedWave(sc, 'wave3'); await warmup();
    const c = await batch.BuildBatch(TARGET);
    check('wave3 build FAILS (no CFO configured)', c.Success === false, `Success=${c.Success}`);
    check('error names the CFO requirement', /cfo/i.test(c.ErrorMessage ?? ''), `ErrorMessage='${c.ErrorMessage ?? ''}'`);
  } catch (e) {
    check('scenarios completed without throwing', false, e instanceof Error ? (e.stack ?? e.message) : String(e));
  } finally {
    console.log('\nTearing down the scenarios fixture…');
    teardownFixture(sc);
  }
  process.exit(summary('batching-scenarios tier-3 (real client)') === 0 ? 0 : 1);
}
main().catch((e) => failBootstrap(e instanceof Error ? (e.stack ?? e.message) : String(e)));
