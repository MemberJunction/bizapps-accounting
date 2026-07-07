/**
 * Tier-3 API harness — JE-batch SCENARIOS over GraphQL (fills the coverage-matrix gaps).
 *
 * 2026-07-06 rework (engine-meeting rulings, CH-4): buildBatch is GLOBAL — one BuildJEBatch call
 * sweeps every company's Pending JEs into ONE multi-company batch. Scenarios are therefore staged
 * in WAVES (the fixture seeds each wave's JEs right before its build):
 *
 *   A. Multi-company SWEEP — wave1 (CoA 2 JEs + CoB 1 JE) → one batch, JECount 3, CompanyCount 2.
 *   B. Due-to/from PRESERVED — approve + dispatch wave1 → Posted; the intercompany-tagged JE shows
 *      in AccountingIntercompanyFlow for ITS company; NO balancing legs appear anywhere else.
 *   C. REJECT path — wave2 (CoB 1 JE) → build → Rejected decision → un-approved + dispatch refused.
 *   D. NO-CFO hard-fail — wave3 (CoC 1 JE, company without a CFO) → build fails with a clear error.
 *
 * Run from the INSTANCE WORKTREE ROOT:
 *   npx tsx packages/dev-apps/bizapps-accounting/test-harnesses/api/batching-scenarios-api.ts
 * Env overrides: MJ_API_URL (default http://localhost:4070) · MJ_API_KEY · MJDEV_SLUG.
 * Exit codes: 0 all passed · 1 assertion failures · 2 bootstrap/connection error.
 */
import { execFileSync, execSync } from 'node:child_process';
import path from 'node:path';

const API_URL = (process.env.MJ_API_URL ?? 'http://localhost:4070').replace(/\/+$/, '');
const GRAPHQL_URL = `${API_URL}/`;
const MJDEV_LAUNCHER = '/Users/marcelotorres/MJDev/bin/mjdev';
const INSTANCE_SLUG = process.env.MJDEV_SLUG ?? 'bizapps-accounting-dev';
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

interface Co { companyId: string; cfoPersonId: string | null }
interface Scenarios { runTag: string; counterpartyId: string; flowId: string; coA: Co; coB: Co; coC: Co }

interface BuildResult { Success: boolean; BatchID?: string; JECount: number; CompanyCount: number; TotalDebits: number; TotalCredits: number; NothingToBatch: boolean; ErrorMessage?: string }
async function buildBatch(apiKey: string): Promise<BuildResult> {
  const d = await gql<{ BuildJEBatch: BuildResult }>(apiKey, `mutation { BuildJEBatch(targetSystem:"${TARGET_SYSTEM}") { Success BatchID JECount CompanyCount TotalDebits TotalCredits NothingToBatch ErrorMessage } }`);
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
async function dispatch(apiKey: string, batchID: string): Promise<{ Success: boolean; Status?: string; ErrorMessage?: string }> {
  const d = await gql<{ DispatchJEBatch: { Success: boolean; Status?: string; ErrorMessage?: string } }>(apiKey, `mutation { DispatchJEBatch(batchID:"${batchID}") { Success Status ErrorMessage } }`);
  return d.DispatchJEBatch;
}
async function intercompanyRows(apiKey: string, companyID: string): Promise<{ EntryType: string }[]> {
  const d = await gql<{ AccountingIntercompanyFlow: { EntryType: string }[] }>(apiKey, `query { AccountingIntercompanyFlow(companyID:"${companyID}") { EntryType GLAccountCode } }`);
  return d.AccountingIntercompanyFlow;
}

function runFixture(args: string[], expectLine: string): string | null {
  const out = execFileSync(TSX, [FIXTURE, ...args], { cwd: WORKTREE_ROOT, encoding: 'utf8', timeout: 240_000 });
  return out.split('\n').find((l) => l.startsWith(expectLine)) ?? null;
}
function setupFixture(): Scenarios {
  const line = runFixture(['setup'], 'SCENARIOS_JSON ');
  if (!line) failBootstrap('scenarios fixture did not emit SCENARIOS_JSON');
  return JSON.parse(line.slice('SCENARIOS_JSON '.length));
}
function seedWave(sc: Scenarios, wave: string): void {
  const line = runFixture(['seed', JSON.stringify(sc), wave], 'SEEDED ');
  if (!line) throw new Error(`fixture did not confirm seeding ${wave}`);
}
function teardownFixture(json: string): void {
  try { execFileSync(TSX, [FIXTURE, 'teardown', json], { cwd: WORKTREE_ROOT, encoding: 'utf8', timeout: 240_000 }); console.log('  (scenarios fixture torn down)'); }
  catch (e) { console.log(`  [teardown warning] ${e instanceof Error ? e.message.split('\n')[0] : String(e)}`); }
}

async function main(): Promise<void> {
  console.log('=== Tier-3 API harness: JE-batch SCENARIOS (multi-company sweep · due-to/from · reject · no-CFO) ===');
  try {
    const res = await fetch(GRAPHQL_URL, { method: 'GET' });
    if (!(res.status >= 200 && res.status < 500)) failBootstrap(`MJAPI at ${API_URL} returned HTTP ${res.status}`);
    console.log(`Preflight: MJAPI serving at ${API_URL} (HTTP ${res.status}).`);
  } catch (e) { failBootstrap(`MJAPI not reachable at ${API_URL} (${e instanceof Error ? e.message : String(e)})`); }
  const apiKey = resolveApiKey();
  console.log(`Auth: X-API-Key ${apiKey.slice(0, 10)}… (resolved)`);

  console.log('Provisioning 3-company scenarios fixture (no JEs yet — waves seed per scenario)…');
  const sc = setupFixture();
  console.log(`  ${sc.runTag}: CoA ${sc.coA.companyId} · CoB ${sc.coB.companyId} · CoC ${sc.coC.companyId}`);

  try {
    // ── A. Multi-company SWEEP (CH-4: one global batch spans companies) ──────
    console.log('\nA. Multi-company sweep (wave1: CoA 2 JEs + CoB 1 JE → ONE batch):');
    seedWave(sc, 'wave1');
    const buildA = await buildBatch(apiKey);
    check('global build succeeds', buildA.Success === true, buildA.ErrorMessage);
    check('JECount === 3 (both companies swept into one batch)', buildA.JECount === 3, `got ${buildA.JECount}`);
    check('CompanyCount === 2 (CH-4 multi-company batch)', buildA.CompanyCount === 2, `got ${buildA.CompanyCount}`);
    check('batch foots (1000/1000 across companies)', buildA.TotalDebits === 1000 && buildA.TotalCredits === 1000, `${buildA.TotalDebits}/${buildA.TotalCredits}`);
    if (!buildA.BatchID) throw new Error('wave1 batch missing — cannot continue');

    // ── B. Due-to/from PRESERVED through batching (no balancing) ────────────
    console.log('\nB. Due-to/from preserved (intercompany tag survives batch → GLPosted → view):');
    check('wave1 approve decision recorded', await decide(apiKey, buildA.BatchID, 'Approved'));
    const disA = await dispatch(apiKey, buildA.BatchID);
    check("wave1 dispatch succeeds → Status 'Posted'", disA.Success === true && disA.Status === 'Posted', JSON.stringify(disA));
    const icA = await intercompanyRows(apiKey, sc.coA.companyId);
    check('CoA shows its intercompany leg after batching (tag preserved)', icA.length >= 1 && icA.every((r) => r.EntryType === 'IntercompanyFlow'), `rows=${icA.length} types=${icA.map((r) => r.EntryType).join(',')}`);
    const icB = await intercompanyRows(apiKey, sc.coB.companyId);
    check('CoB shows NO intercompany leg (no cross-company balancing was generated)', icB.length === 0, `got ${icB.length}`);

    // ── C. REJECT path ──────────────────────────────────────────────────────
    console.log('\nC. Reject path (wave2 → Rejected decision → un-approved → dispatch refused):');
    seedWave(sc, 'wave2');
    const buildB = await buildBatch(apiKey);
    check('wave2 build succeeds (1 JE)', buildB.Success === true && buildB.JECount === 1, `JECount=${buildB.JECount} (${buildB.ErrorMessage ?? ''})`);
    if (!buildB.BatchID) throw new Error('wave2 batch missing — cannot continue');
    check('wave2 reject decision recorded', await decide(apiKey, buildB.BatchID, 'Rejected'));
    check('wave2 batch is NOT approved after rejection', (await approvalState(apiKey, buildB.BatchID)) === false);
    const disB = await dispatch(apiKey, buildB.BatchID);
    check('wave2 dispatch is REFUSED (rejected batch cannot dispatch)', disB.Success === false, `Success=${disB.Success} Status=${disB.Status}`);
    check('refusal names the Approved requirement', /approved/i.test(disB.ErrorMessage ?? ''), `ErrorMessage='${disB.ErrorMessage ?? ''}'`);

    // ── D. NO-CFO hard-fail ──────────────────────────────────────────────────
    console.log('\nD. No-CFO hard-fail (wave3: CoC has no configured CFO):');
    seedWave(sc, 'wave3');
    const buildC = await buildBatch(apiKey);
    check('wave3 build FAILS (no CFO configured)', buildC.Success === false, `Success=${buildC.Success}`);
    check('error names the CFO requirement', /cfo/i.test(buildC.ErrorMessage ?? ''), `ErrorMessage='${buildC.ErrorMessage ?? ''}'`);
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
