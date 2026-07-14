/**
 * Tier-3 API harness — 'Accounting.CreateJournalEntry' over the GENERIC GraphQL transport
 * (`ExecuteRemoteOperation`) — the A5 "runs on local" proof (plan §6): the SAME typed op the
 * server executes in-process is invocable from a browser/script over pure HTTP + X-API-Key,
 * with the typed contract intact on the wire.
 *
 *   1. success — a mergeable draft books; outputJSON carries {Success, JournalEntryID,
 *      EntryNumber JE-{CompanyCode}-{FY}-{seq} (A4.4/MOD-12), LineCount} (exact values).
 *   2. typed failure ON THE WIRE — an unbalanced draft returns transport success=true with
 *      Output.Success=false + UNBALANCED (logical failures live INSIDE the output).
 *   3. unknown operation key → UNKNOWN_OPERATION (the registry gate works over the wire).
 *
 * Reuses the batching fixture for an isolated company. Run from the INSTANCE WORKTREE ROOT:
 *   npx tsx packages/dev-apps/bizapps-accounting/test-harnesses/api/engine-op-api.ts
 * Env overrides: MJ_API_URL (default http://localhost:4070) · MJ_API_KEY · MJDEV_SLUG.
 * Exit codes: 0 all passed · 1 assertion failures · 2 bootstrap/connection error.
 */
import { execFileSync, execSync } from 'node:child_process';
import path from 'node:path';
import type { CreateJournalEntryOutput, JournalEntryDraft } from '@mj-biz-apps/accounting-engine-base';

const API_URL = (process.env.MJ_API_URL ?? 'http://localhost:4070').replace(/\/+$/, '');
const GRAPHQL_URL = `${API_URL}/`;
const MJDEV_LAUNCHER = '/Users/marcelotorres/MJDev/bin/mjdev';
const INSTANCE_SLUG = process.env.MJDEV_SLUG ?? 'bizapps-accounting-dev';
const WORKTREE_ROOT = process.cwd();
const TSX = path.resolve(WORKTREE_ROOT, 'node_modules', '.bin', 'tsx');
const FIXTURE = path.resolve(WORKTREE_ROOT, 'packages/dev-apps/bizapps-accounting/test-harnesses/playwright/lib/batching-fixture.ts');

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

interface WireResult { success: boolean; resultCode?: string; outputJSON?: string; errorMessage?: string }
async function executeOp(apiKey: string, operationKey: string, input: unknown): Promise<WireResult> {
  const query = `mutation Exec($input: ExecuteRemoteOperationInput!) { ExecuteRemoteOperation(input: $input) { success resultCode outputJSON errorMessage } }`;
  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
    body: JSON.stringify({ query, variables: { input: { operationKey, inputJSON: JSON.stringify(input), invokeMode: 'attached' } } }),
  });
  if (res.status !== 200) throw new Error(`HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 300)}`);
  const json = (await res.json()) as { data?: { ExecuteRemoteOperation: WireResult }; errors?: unknown[] };
  if (json.errors?.length) throw new Error(`GraphQL errors: ${JSON.stringify(json.errors).slice(0, 400)}`);
  if (!json.data?.ExecuteRemoteOperation) throw new Error(`missing data: ${JSON.stringify(json).slice(0, 300)}`);
  return json.data.ExecuteRemoteOperation;
}

interface Fixture { companyId: string; cfoPersonId: string; runTag: string; jeId: string; expected: { grossDebits: number } }
interface GLRow { ID: string; Code: string }

function fixtureSetup(): Fixture {
  const out = execFileSync(TSX, [FIXTURE, 'setup'], { cwd: WORKTREE_ROOT, encoding: 'utf8', timeout: 180_000 });
  const line = out.split('\n').find((l) => l.startsWith('FIXTURE_JSON '));
  if (!line) failBootstrap(`batching-fixture setup did not emit FIXTURE_JSON. Output:\n${out.slice(-600)}`);
  return JSON.parse(line.slice('FIXTURE_JSON '.length));
}
function fixtureTeardown(companyId: string, cfoPersonId: string): void {
  try {
    execFileSync(TSX, [FIXTURE, 'teardown', companyId, cfoPersonId], { cwd: WORKTREE_ROOT, encoding: 'utf8', timeout: 180_000 });
    console.log('  (fixture torn down)');
  } catch (e) {
    console.log(`  [teardown warning] ${e instanceof Error ? e.message.split('\n')[0] : String(e)}`);
  }
}

/** Resolve the fixture company's AR + Revenue GL account IDs over the entity API (RunDynamicView). */
async function resolveGLAccounts(apiKey: string, companyId: string): Promise<{ arGL: string; revGL: string }> {
  const query = `query Run($input: RunDynamicViewInput!) { RunDynamicView(input: $input) { Results { Data } RowCount } }`;
  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
    body: JSON.stringify({ query, variables: { input: { EntityName: 'MJ_BizApps_Accounting: GL Accounts', ExtraFilter: `CompanyID='${companyId}' AND Code IN ('11201','40100')`, Fields: ['ID', 'Code'] } } }),
  });
  const json = (await res.json()) as { data?: { RunDynamicView: { Results: { Data: string }[] } }; errors?: unknown[] };
  if (json.errors?.length || !json.data?.RunDynamicView) throw new Error(`GL lookup failed: ${JSON.stringify(json.errors ?? json).slice(0, 300)}`);
  const rows = json.data.RunDynamicView.Results.map(r => JSON.parse(r.Data) as GLRow);
  const arGL = rows.find(r => r.Code === '11201')?.ID;
  const revGL = rows.find(r => r.Code === '40100')?.ID;
  if (!arGL || !revGL) throw new Error(`fixture GL accounts not resolvable over the API (got ${JSON.stringify(rows)})`);
  return { arGL, revGL };
}

async function main(): Promise<void> {
  console.log("=== Tier-3 API harness: 'Accounting.CreateJournalEntry' over ExecuteRemoteOperation ===");
  try {
    const res = await fetch(GRAPHQL_URL, { method: 'GET' });
    if (!(res.status >= 200 && res.status < 500)) failBootstrap(`MJAPI at ${API_URL} returned HTTP ${res.status}`);
    console.log(`Preflight: MJAPI serving at ${API_URL} (HTTP ${res.status}).`);
  } catch (e) { failBootstrap(`MJAPI not reachable at ${API_URL} (${e instanceof Error ? e.message : String(e)})`); }
  const apiKey = resolveApiKey();
  console.log(`Auth: X-API-Key ${apiKey.slice(0, 10)}… (resolved)`);

  console.log('Provisioning isolated company via the batching fixture…');
  const fx = fixtureSetup();
  console.log(`  fixture company ${fx.companyId} (${fx.runTag})`);

  try {
    const { arGL, revGL } = await resolveGLAccounts(apiKey, fx.companyId);

    // 1. Success — the same contract the server engine enforces, over the wire.
    console.log('\n1. CreateJournalEntry over the wire (success):');
    const draft: JournalEntryDraft = {
      EffectiveDate: new Date().toISOString(),
      EntryType: 'OrderBooking',
      Description: `${fx.runTag} engine-op-api success`,
      Lines: [
        { GLAccountID: arGL, DebitAmount: 70 },
        { GLAccountID: arGL, DebitAmount: 30 },      // merges with the 70
        { GLAccountID: revGL, CreditAmount: 100 },
      ],
    };
    const ok = await executeOp(apiKey, 'Accounting.CreateJournalEntry', draft);
    check('transport success', ok.success === true, `${ok.resultCode} ${ok.errorMessage ?? ''}`);
    const out = JSON.parse(ok.outputJSON ?? '{}') as CreateJournalEntryOutput;
    check('Output.Success === true', out.Success === true, JSON.stringify(out.Errors));
    check('EntryNumber matches JE-{CompanyCode}-{FY}-{seq:000000} (A4.4)', /^JE-[A-Z0-9_-]{2,20}-\d{4}-\d{6}$/.test(out.EntryNumber ?? ''), `got '${out.EntryNumber}'`);
    check('LineCount === 2 (duplicate debit lines merged on the wire path too)', out.LineCount === 2, `got ${out.LineCount}`);
    check('a JournalEntryID came back', !!out.JournalEntryID, JSON.stringify(out));

    // 2. Typed logical failure — INSIDE the output, transport still green.
    console.log('\n2. Unbalanced draft (typed failure on the wire):');
    const bad = await executeOp(apiKey, 'Accounting.CreateJournalEntry', {
      ...draft, Description: `${fx.runTag} engine-op-api unbalanced`,
      Lines: [{ GLAccountID: arGL, DebitAmount: 100 }, { GLAccountID: revGL, CreditAmount: 60 }],
    });
    check('transport success (logical failures do not fail the transport)', bad.success === true, `${bad.resultCode} ${bad.errorMessage ?? ''}`);
    const badOut = JSON.parse(bad.outputJSON ?? '{}') as CreateJournalEntryOutput;
    check('Output.Success === false with UNBALANCED', badOut.Success === false && (badOut.Errors ?? []).some(e => e.Code === 'UNBALANCED'), JSON.stringify(badOut));

    // 3. Unknown key — the registry gate over the wire.
    console.log('\n3. Unknown operation key:');
    const unknown = await executeOp(apiKey, 'Accounting.NoSuchOperation', {});
    check('unknown key refused with UNKNOWN_OPERATION', unknown.success === false && unknown.resultCode === 'UNKNOWN_OPERATION', JSON.stringify(unknown));
  } catch (e) {
    check('wire flow completed without throwing', false, e instanceof Error ? e.message : String(e));
  } finally {
    console.log('\nTearing down the fixture company…');
    fixtureTeardown(fx.companyId, fx.cfoPersonId);
  }

  const total = passed + failed;
  console.log(`\nAPI engine-op harness: ${passed}/${total} passed`);
  process.exit(failed === 0 ? 0 : 1);
}
main().catch((e) => failBootstrap(e instanceof Error ? e.message : String(e)));
