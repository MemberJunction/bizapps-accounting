/**
 * Tier-3 API harness — JE-batch SCENARIOS over GraphQL (fills the coverage-matrix gaps).
 *
 * Drives the real MJAPI mutations/queries against the multi-company fixture
 * (../playwright/lib/batching-scenarios-fixture.ts) to validate, at the API contract:
 *   A. Multi-company INDEPENDENCE — each company builds ONLY its own JEs (no cross-company bleed).
 *   B. Due-to/from PRESERVED — an intercompany-tagged JE survives batching → GLPosted → shows in
 *      AccountingIntercompanyFlow for ITS company, and NOT for the counterparty (no balancing).
 *   C. REJECT path — a Rejected decision keeps the batch un-approved and refuses dispatch.
 *   D. NO-CFO hard-fail — building for a company without a configured CFO fails with a clear error.
 *
 * Run from the INSTANCE WORKTREE ROOT:
 *   npx tsx packages/dev-apps/bizapps-accounting/test-harnesses/api/batching-scenarios-api.ts
 * Exit codes: 0 all passed · 1 assertion failures · 2 bootstrap/connection error.
 */
import { execFileSync, execSync } from 'node:child_process';
import path from 'node:path';

const API_URL = (process.env.MJ_API_URL ?? 'http://localhost:4070').replace(/\/+$/, '');
const GRAPHQL_URL = `${API_URL}/`;
const MJDEV_LAUNCHER = '/Users/marcelotorres/MJDev/bin/mjdev';
const INSTANCE_SLUG = 'bizapps-accounting-dev';
const WORKTREE_ROOT = process.cwd();
const TSX = path.resolve(WORKTREE_ROOT, 'node_modules', '.bin', 'tsx');
const FIXTURE = path.resolve(WORKTREE_ROOT, 'packages/dev-apps/bizapps-accounting/test-harnesses/playwright/lib/batching-scenarios-fixture.ts');
const TARGET_SYSTEM = 'BusinessCentral';

let passed = 0, failed = 0;
function check(label: string, ok: boolean, detail?: string): void {
  if (ok) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`); }
}
function failBootstrap(reason: string): never {
  console.error(`\nBOOTSTRAP ERROR: ${reason}`);
  console.error(`Fix: ${MJDEV_LAUNCHER} run ${INSTANCE_SLUG} api  (and run from the instance worktree root)`);
  process.exit(2);
}
function resolveApiKey(): string {
  const fromEnv = process.env.MJ_API_KEY?.trim();
  if (fromEnv) return fromEnv;
  const out = execSync(`${MJDEV_LAUNCHER} key ${INSTANCE_SLUG}`, { encoding: 'utf8' });
  const key = out.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.startsWith('mj_sk_')).pop();
  if (!key) failBootstrap('launcher produced no mj_sk_ key');
  return key;
}
async function gql<T>(apiKey: string, query: string): Promise<T> {
  const res = await fetch(GRAPHQL_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey }, body: JSON.stringify({ query }) });
  if (res.status !== 200) throw new Error(`HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 300)}`);
  const json = (await res.json()) as { data?: T; errors?: unknown[] };
  if (json.errors?.length) throw new Error(`GraphQL errors: ${JSON.stringify(json.errors).slice(0, 400)}`);
  if (json.data == null) throw new Error(`missing data: ${JSON.stringify(json).slice(0, 300)}`);
  return (json as { data: T }).data;
}

interface Co { companyId: string; periodId: string; cfoPersonId: string | null; jeCount: number }
interface Scenarios { runTag: string; counterpartyId: string; flowId: string; coA: Co; coB: Co; coC: Co }

interface BuildResult { Success: boolean; BatchID?: string; JECount: number; NothingToBatch: boolean; ErrorMessage?: string }
async function buildBatch(apiKey: string, co: Co): Promise<BuildResult> {
  const d = await gql<{ BuildJEBatch: BuildResult }>(apiKey, `mutation { BuildJEBatch(companyID:"${co.companyId}", accountingPeriodID:"${co.periodId}", targetSystem:"${TARGET_SYSTEM}") { Success BatchID JECount NothingToBatch ErrorMessage } }`);
  return d.BuildJEBatch;
}
async function decide(apiKey: string, batchID: string, decision: string): Promise<boolean> {
  const d = await gql<{ RecordJEBatchDecision: { Success: boolean } }>(apiKey, `mutation { RecordJEBatchDecision(batchID:"${batchID}", decision:"${decision}", notes:"scenarios harness") { Success } }`);
  return d.RecordJEBatchDecision.Success;
}
async function approvalState(apiKey: string, batchID: string): Promise<boolean> {
  const d = await gql<{ JEBatchApprovalState: { Approved: boolean } }>(apiKey, `query { JEBatchApprovalState(batchID:"${batchID}") { Approved } }`);
  return d.JEBatchApprovalState.Approved;
}
async function dispatch(apiKey: string, batchID: string): Promise<{ Success: boolean; Status?: string }> {
  const d = await gql<{ DispatchJEBatch: { Success: boolean; Status?: string } }>(apiKey, `mutation { DispatchJEBatch(batchID:"${batchID}") { Success Status } }`);
  return d.DispatchJEBatch;
}
async function intercompanyRows(apiKey: string, companyID: string): Promise<{ EntryType: string }[]> {
  const d = await gql<{ AccountingIntercompanyFlow: { EntryType: string }[] }>(apiKey, `query { AccountingIntercompanyFlow(companyID:"${companyID}") { EntryType GLAccountCode } }`);
  return d.AccountingIntercompanyFlow;
}

function setupFixture(): Scenarios {
  const out = execFileSync(TSX, [FIXTURE, 'setup'], { cwd: WORKTREE_ROOT, encoding: 'utf8', timeout: 240_000 });
  const line = out.split('\n').find((l) => l.startsWith('SCENARIOS_JSON '));
  if (!line) failBootstrap(`scenarios fixture did not emit SCENARIOS_JSON. Output:\n${out.slice(-700)}`);
  return JSON.parse(line.slice('SCENARIOS_JSON '.length));
}
function teardownFixture(json: string): void {
  try { execFileSync(TSX, [FIXTURE, 'teardown', json], { cwd: WORKTREE_ROOT, encoding: 'utf8', timeout: 240_000 }); console.log('  (scenarios fixture torn down)'); }
  catch (e) { console.log(`  [teardown warning] ${e instanceof Error ? e.message.split('\n')[0] : String(e)}`); }
}

async function main(): Promise<void> {
  console.log('=== Tier-3 API harness: JE-batch SCENARIOS (multi-company · due-to/from · reject · no-CFO) ===');
  try {
    const res = await fetch(GRAPHQL_URL, { method: 'GET' });
    if (!(res.status >= 200 && res.status < 500)) failBootstrap(`MJAPI at ${API_URL} returned HTTP ${res.status}`);
    console.log(`Preflight: MJAPI serving at ${API_URL} (HTTP ${res.status}).`);
  } catch (e) { failBootstrap(`MJAPI not reachable at ${API_URL} (${e instanceof Error ? e.message : String(e)})`); }
  const apiKey = resolveApiKey();
  console.log(`Auth: X-API-Key ${apiKey.slice(0, 10)}… (resolved)`);

  console.log('Provisioning 3-company scenarios fixture…');
  const sc = setupFixture();
  console.log(`  ${sc.runTag}: CoA ${sc.coA.companyId} · CoB ${sc.coB.companyId} · CoC ${sc.coC.companyId}`);

  try {
    // ── A. Multi-company INDEPENDENCE ───────────────────────────────────────
    console.log('\nA. Multi-company independence (each builds ONLY its own JEs):');
    const buildA = await buildBatch(apiKey, sc.coA);
    const buildB = await buildBatch(apiKey, sc.coB);
    check(`CoA batch JECount === ${sc.coA.jeCount} (its own JEs only)`, buildA.Success && buildA.JECount === sc.coA.jeCount, `got ${buildA.JECount} (${buildA.ErrorMessage ?? ''})`);
    check(`CoB batch JECount === ${sc.coB.jeCount} (its own JEs only)`, buildB.Success && buildB.JECount === sc.coB.jeCount, `got ${buildB.JECount} (${buildB.ErrorMessage ?? ''})`);
    check('no cross-company bleed (CoA did not absorb CoB\'s JE)', buildA.JECount === sc.coA.jeCount && buildA.JECount !== sc.coA.jeCount + sc.coB.jeCount, `CoA=${buildA.JECount}`);

    // ── B. Due-to/from PRESERVED through batching (no balancing) ────────────
    console.log('\nB. Due-to/from preserved (intercompany tag survives batch → GLPosted → view):');
    if (!buildA.BatchID) throw new Error('CoA batch missing — cannot continue scenario B');
    check('CoA approve decision recorded', await decide(apiKey, buildA.BatchID, 'Approved'));
    const disA = await dispatch(apiKey, buildA.BatchID);
    check('CoA dispatch succeeds', disA.Success, JSON.stringify(disA));
    const icA = await intercompanyRows(apiKey, sc.coA.companyId);
    check('CoA shows its intercompany leg after batching (tag preserved)', icA.length >= 1 && icA.every((r) => r.EntryType === 'IntercompanyFlow'), `rows=${icA.length} types=${icA.map((r) => r.EntryType).join(',')}`);
    const icCp = await intercompanyRows(apiKey, sc.counterpartyId);
    check('counterparty company shows NO leg from CoA (no cross-company balancing)', icCp.length === 0, `got ${icCp.length}`);

    // ── C. REJECT path ──────────────────────────────────────────────────────
    console.log('\nC. Reject path (Rejected decision → un-approved → dispatch refused):');
    if (!buildB.BatchID) throw new Error('CoB batch missing — cannot continue scenario C');
    check('CoB reject decision recorded', await decide(apiKey, buildB.BatchID, 'Rejected'));
    check('CoB batch is NOT approved after rejection', (await approvalState(apiKey, buildB.BatchID)) === false);
    const disB = await dispatch(apiKey, buildB.BatchID);
    check('CoB dispatch is REFUSED (rejected batch cannot dispatch)', disB.Success === false, `Success=${disB.Success} Status=${disB.Status}`);

    // ── D. NO-CFO hard-fail ──────────────────────────────────────────────────
    console.log('\nD. No-CFO hard-fail (building for a company without a configured CFO):');
    const buildC = await buildBatch(apiKey, sc.coC);
    check('CoC build FAILS (no CFO configured)', buildC.Success === false, `Success=${buildC.Success}`);
    check('CoC error mentions the CFO', /cfo/i.test(buildC.ErrorMessage ?? ''), `ErrorMessage='${buildC.ErrorMessage ?? ''}'`);
  } catch (e) {
    check('scenarios completed without throwing', false, e instanceof Error ? e.message : String(e));
  } finally {
    console.log('\nTearing down the scenarios fixture…');
    teardownFixture(JSON.stringify(sc));
  }

  const total = passed + failed;
  console.log(`\nAPI scenarios harness: ${passed}/${total} passed`);
  process.exit(failed === 0 ? 0 : 1);
}
main().catch((e) => failBootstrap(e instanceof Error ? e.message : String(e)));
