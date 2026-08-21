/**
 * Tier-3 API harness — the FULL DEMO JOURNEY on one fresh company, entirely over the wire
 * (GraphQL + X-API-Key): the exact calls the UI buttons make, with the same parameters.
 *
 * Amith's demo flow (2026-07-30), as one continuous chain:
 *   A. Company profile setup — the "New company" dialog's save: ONE ACP create over the
 *      generated mutation (IS-A creates the __mj.Company parent). Since 2026-07-30 (Marcelo
 *      ruling) the chart starts EMPTY — asserted — and the journey then creates its AR/Revenue
 *      accounts over the wire (the accounts-editor path), matching the demo narrative.
 *   B. JE + Lines — 'Accounting.CreateJournalEntry' (the JE workspace's Create-entry op),
 *      three balanced JEs incl. the merge shape (70+30→100, LineCount 2).
 *   C. Batching — Preview → Build (netted 600/600) → approval state flip → Approve →
 *      Dispatch (mock poster → Posted) → JEs read back GLPosted through the same dynamic
 *      views the dashboards consume.
 *   D. Teardown — the shared batching-fixture teardown (FK-aware, company-rooted).
 *
 * NOTE: coverage for negatives/variations lives in engine-op-api.ts + batch-ops-api.ts;
 * this harness proves the composed end-to-end path (the demo script) on a fresh company.
 * The browser layer for each step is covered by the tier-5 specs; company-create SAVE at
 * tier-5 is a waived gap (5x — generated-form locators; dialog to be rebuilt).
 *
 * Run from the INSTANCE WORKTREE ROOT:
 *   npx tsx packages/dev-apps/bizapps-accounting/test-harnesses/api/full-flow-api.ts
 * Env overrides: MJ_API_URL (default http://localhost:4180) · MJ_API_KEY · MJDEV_SLUG.
 * Exit codes: 0 all passed · 1 assertion failures · 2 bootstrap/connection error.
 */
import { execFileSync, execSync } from 'node:child_process';
import path from 'node:path';
import type { CreateJournalEntryOutput, JournalEntryDraft } from '@mj-biz-apps/accounting-engine-base';

const API_URL = (process.env.MJ_API_URL ?? 'http://localhost:4180').replace(/\/+$/, '');
const GRAPHQL_URL = `${API_URL}/`;
const MJDEV_LAUNCHER = '/Users/marcelotorres/MJDev/bin/mjdev';
const INSTANCE_SLUG = process.env.MJDEV_SLUG ?? 'accounting-revamp';
const WORKTREE_ROOT = process.cwd();
const TSX = path.resolve(WORKTREE_ROOT, 'node_modules', '.bin', 'tsx');
const FIXTURE = path.resolve(WORKTREE_ROOT, 'packages/dev-apps/bizapps-accounting/test-harnesses/playwright/lib/batching-fixture.ts');

const RUN_TAG = `FULLFLOW-${Date.now().toString(36).toUpperCase()}`;

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

async function gql<T>(apiKey: string, query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
    body: JSON.stringify({ query, variables }),
  });
  if (res.status !== 200) throw new Error(`HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 300)}`);
  const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) throw new Error(`GraphQL errors: ${JSON.stringify(json.errors).slice(0, 400)}`);
  if (!json.data) throw new Error('missing data in GraphQL response');
  return json.data;
}

interface WireResult { success: boolean; resultCode?: string; outputJSON?: string; errorMessage?: string }
async function executeOp(apiKey: string, operationKey: string, input: unknown): Promise<WireResult> {
  const query = `mutation Exec($input: ExecuteRemoteOperationInput!) { ExecuteRemoteOperation(input: $input) { success resultCode outputJSON errorMessage } }`;
  const data = await gql<{ ExecuteRemoteOperation: WireResult }>(apiKey, query, { input: { operationKey, inputJSON: JSON.stringify(input), invokeMode: 'attached' } });
  return data.ExecuteRemoteOperation;
}
function opOutput<T>(res: WireResult): T {
  return JSON.parse(res.outputJSON ?? '{}') as T;
}

async function wireRows<T>(apiKey: string, entityName: string, extraFilter: string, fields: string[]): Promise<T[]> {
  const query = `query Run($input: RunDynamicViewInput!) { RunDynamicView(input: $input) { Results { Data } RowCount } }`;
  const data = await gql<{ RunDynamicView: { Results: { Data: string }[] } }>(apiKey, query, { input: { EntityName: entityName, ExtraFilter: extraFilter, Fields: fields } });
  return data.RunDynamicView.Results.map((r) => JSON.parse(r.Data) as T);
}

function fixtureTeardown(companyId: string): void {
  try {
    execFileSync(TSX, [FIXTURE, 'teardown', companyId], { cwd: WORKTREE_ROOT, encoding: 'utf8', timeout: 180_000 });
    console.log('  (company torn down via batching-fixture teardown)');
  } catch (e) {
    console.log(`  [teardown warning] ${e instanceof Error ? e.message.split('\n')[0] : String(e)}`);
  }
}

// Wire shapes (server package not importable here — keep local, mirroring batch-ops-api.ts).
interface BuildResultWire { batchId: string; summaryJournalEntryId: string; summaryLineCount: number; totalDebits: number; totalCredits: number; jeCount: number; approvalTaskId: string | null }
interface BuildOutputWire { Batches: BuildResultWire[]; NothingToBatch: boolean }
interface ApprovalStateWire { Approved: boolean; Reason?: string }
interface DispatchWire { Status: string; ExternalJournalEntryBatchRef: string | null }

const ACP_ENTITY_GL = 'MJ_BizApps_Accounting: GL Accounts';
const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';
const BATCH_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Batches';

async function main(): Promise<void> {
  console.log('=== Tier-3 API harness: FULL DEMO JOURNEY (company → COA → JEs → batch → dispatch) ===');
  try {
    const res = await fetch(GRAPHQL_URL, { method: 'GET' });
    if (!(res.status >= 200 && res.status < 500)) failBootstrap(`MJAPI at ${API_URL} returned HTTP ${res.status}`);
    console.log(`Preflight: MJAPI serving at ${API_URL} (HTTP ${res.status}).`);
  } catch (e) { failBootstrap(`MJAPI not reachable at ${API_URL} (${e instanceof Error ? e.message : String(e)})`); }
  const apiKey = resolveApiKey();
  console.log(`Auth: X-API-Key ${apiKey.slice(0, 10)}… (resolved)`);

  let companyId: string | null = null;
  try {
    // ── A. Company profile setup — the "New company" dialog save, over the wire ──────────
    console.log('\nA. Company create (ONE ACP save — the dialog path):');
    const owners = await wireRows<{ ID: string; Name: string }>(apiKey, 'MJ: Users', `Type='Owner'`, ['ID', 'Name']);
    check('an Owner user resolvable over the wire (CFO candidate)', owners.length >= 1, `got ${owners.length}`);
    const cfoUserId = owners[0]?.ID;

    const createMut = `mutation Create($input: CreatemjBizAppsAccountingAccountingCompanyProfileInput!) {
      CreatemjBizAppsAccountingAccountingCompanyProfile(input: $input) { ID Name CompanyCode FunctionalCurrencyCode ApprovalCFOUserID }
    }`;
    const companyCode = `FF${Date.now().toString(36).slice(-6).toUpperCase()}`;
    const created = await gql<{ CreatemjBizAppsAccountingAccountingCompanyProfile: { ID: string; Name: string; CompanyCode: string; FunctionalCurrencyCode: string; ApprovalCFOUserID: string | null } }>(
      apiKey, createMut, {
        input: {
          Name: `${RUN_TAG} Demo Co`,
          Description: `${RUN_TAG} full-flow journey company`,
          CompanyCode: companyCode,
          FunctionalCurrencyCode: 'USD',
          EntityType: 'Subsidiary',
          ApprovalCFOUserID: cfoUserId,
        },
      });
    const acp = created.CreatemjBizAppsAccountingAccountingCompanyProfile;
    companyId = acp?.ID ?? null;
    check('ACP created over the wire with an ID', !!companyId, JSON.stringify(acp));
    check('functional currency + CFO round-tripped', acp?.FunctionalCurrencyCode === 'USD' && !!acp?.ApprovalCFOUserID, JSON.stringify(acp));

    const parents = await wireRows<{ ID: string; Name: string }>(apiKey, 'MJ: Companies', `ID='${companyId}'`, ['ID', 'Name']);
    check('IS-A parent __mj.Company row exists with the SAME UUID', parents.length === 1 && parents[0].Name === `${RUN_TAG} Demo Co`, JSON.stringify(parents));

    // 2026-07-30 (Marcelo ruling): the W1 auto-seed is retired — a new company is born with an
    // EMPTY chart, and the operator creates the accounts (the demo's "through GL accounts" step).
    const gl0 = await wireRows<{ ID: string }>(apiKey, ACP_ENTITY_GL, `CompanyID='${companyId}'`, ['ID']);
    check('new company starts with an EMPTY chart (auto-seed retired)', gl0.length === 0, `got ${gl0.length} accounts`);

    const createGL = `mutation Create($input: CreatemjBizAppsAccountingGLAccountInput!) {
      CreatemjBizAppsAccountingGLAccount(input: $input) { ID Code }
    }`;
    const mkAccount = async (Code: string, Name: string, AccountType: string): Promise<string> => {
      const r = await gql<{ CreatemjBizAppsAccountingGLAccount: { ID: string; Code: string } }>(apiKey, createGL, {
        input: { CompanyID: companyId, Code, Name, AccountType, IsActive: true, IsSystemSeeded: false },
      });
      return r.CreatemjBizAppsAccountingGLAccount?.ID;
    };
    const arGL = await mkAccount('11201', 'Accounts Receivable', 'Asset');
    const revGL = await mkAccount('40100', 'Sales Revenue', 'Revenue');
    check('AR + Revenue accounts created over the wire (the accounts-editor path)', !!arGL && !!revGL, JSON.stringify({ arGL, revGL }));
    console.log(`  company ${companyId} (${companyCode}) · empty chart → 2 accounts created`);

    // ── B. JE + Lines — the workspace's Create-entry op, three balanced drafts ───────────
    console.log('\nB. Journal entries via Accounting.CreateJournalEntry:');
    const mkDraft = (desc: string, lines: JournalEntryDraft['Lines']): JournalEntryDraft => ({
      EffectiveDate: new Date().toISOString(), EntryType: 'Manual', Description: `${RUN_TAG} ${desc}`, Lines: lines,
    });
    const je1 = opOutput<CreateJournalEntryOutput>(await executeOp(apiKey, 'Accounting.CreateJournalEntry', mkDraft('JE1 merge shape', [
      { GLAccountID: arGL as string, DebitAmount: 70 },
      { GLAccountID: arGL as string, DebitAmount: 30 },
      { GLAccountID: revGL as string, CreditAmount: 100 },
    ])));
    check('JE1 booked; duplicate debit lines merged (LineCount 2)', je1.Success === true && je1.LineCount === 2, JSON.stringify(je1));
    check(`JE1 EntryNumber carries the company code (JE-${companyCode}-…)`, (je1.EntryNumber ?? '').startsWith(`JE-${companyCode}-`), `got '${je1.EntryNumber}'`);
    const je2 = opOutput<CreateJournalEntryOutput>(await executeOp(apiKey, 'Accounting.CreateJournalEntry', mkDraft('JE2', [
      { GLAccountID: arGL as string, DebitAmount: 200 }, { GLAccountID: revGL as string, CreditAmount: 200 },
    ])));
    const je3 = opOutput<CreateJournalEntryOutput>(await executeOp(apiKey, 'Accounting.CreateJournalEntry', mkDraft('JE3', [
      { GLAccountID: arGL as string, DebitAmount: 300 }, { GLAccountID: revGL as string, CreditAmount: 300 },
    ])));
    check('JE2 + JE3 booked', je2.Success === true && je3.Success === true, JSON.stringify({ je2, je3 }).slice(0, 200));

    // ── C. Batching — the batch-workspace buttons' ops, exact values ─────────────────────
    console.log('\nC. Batch: preview → build → approve → dispatch → GLPosted:');
    const prev = opOutput<{ Candidates: unknown[]; TotalDebits: number; TotalCredits: number }>(
      await executeOp(apiKey, 'Accounting.PreviewJournalEntryBatch', { CompanyIDs: [companyId] }));
    check('preview: 3 candidates, totals 600/600', prev.Candidates?.length === 3 && prev.TotalDebits === 600 && prev.TotalCredits === 600,
      JSON.stringify({ n: prev.Candidates?.length, d: prev.TotalDebits, c: prev.TotalCredits }));

    const build = opOutput<BuildOutputWire>(await executeOp(apiKey, 'Accounting.BuildJournalEntryBatch', { TargetSystem: 'BusinessCentral', CompanyID: companyId }));
    const b = build.Batches?.[0];
    check('ONE batch built: jeCount 3, totals 600/600', build.Batches?.length === 1 && b?.jeCount === 3 && b?.totalDebits === 600 && b?.totalCredits === 600,
      JSON.stringify(build).slice(0, 200));

    const pre = opOutput<ApprovalStateWire>(await executeOp(apiKey, 'Accounting.GetJournalEntryBatchApprovalState', { JournalEntryBatchID: b?.batchId }));
    check('approval state initially FALSE', pre.Approved === false, JSON.stringify(pre));
    const dec = await executeOp(apiKey, 'Accounting.RecordJournalEntryBatchDecision', { JournalEntryBatchID: b?.batchId, Decision: 'Approved', Notes: `${RUN_TAG} demo approval` });
    const post = opOutput<ApprovalStateWire>(await executeOp(apiKey, 'Accounting.GetJournalEntryBatchApprovalState', { JournalEntryBatchID: b?.batchId }));
    check('decision recorded → approval state TRUE', dec.success === true && post.Approved === true, JSON.stringify({ dec: dec.resultCode, post }));

    const disp = opOutput<DispatchWire>(await executeOp(apiKey, 'Accounting.DispatchJournalEntryBatch', { JournalEntryBatchID: b?.batchId }));
    check("dispatch → Status 'Posted' with mock external ref", disp.Status === 'Posted' && (disp.ExternalJournalEntryBatchRef ?? '').startsWith('MOCK-'), JSON.stringify(disp));

    // The same dynamic views the dashboards consume — the UI's read path.
    const jeRows = await wireRows<{ ID: string; Status: string; JournalEntryBatchID: string | null }>(apiKey, JE_ENTITY,
      `CompanyID='${companyId}' AND Description LIKE '${RUN_TAG}%'`, ['ID', 'Status', 'JournalEntryBatchID']);
    const glPosted = jeRows.filter((r) => r.Status === 'GLPosted' && !!r.JournalEntryBatchID);
    check('all 3 source JEs read back GLPosted + batch-linked (dashboard view path)', jeRows.length === 3 && glPosted.length === 3,
      JSON.stringify(jeRows.map((r) => r.Status)));
    const batchRows = await wireRows<{ ID: string; Status: string; ExternalJournalEntryBatchRef: string | null }>(apiKey, BATCH_ENTITY,
      `ID='${b?.batchId}'`, ['ID', 'Status', 'ExternalJournalEntryBatchRef']);
    check('batch row readable with Posted status + external ref (batch workspace view path)',
      batchRows.length === 1 && batchRows[0].Status === 'Posted' && !!batchRows[0].ExternalJournalEntryBatchRef, JSON.stringify(batchRows));

    // ── C2. Consolidation SPLIT enforcement: company × GLAccount × dimension-combo ────────
    // (Marcelo 2026-07-30: prove the split is enforced on the PERSISTED summary, not just in
    // the tier-1 pure netting test.) Two fresh JEs tag the SAME AR account with different
    // dimension values; the batch-level collapse must net ACROSS JEs per dimension group and
    // re-tag each summary line — same-account-different-dims must NOT merge.
    console.log('\nC2. Dimension-split consolidation (persisted summary JE):');
    const dimVals = await wireRows<{ ID: string; DimensionID: string }>(apiKey, 'MJ_BizApps_Accounting: Dimension Values', '', ['ID', 'DimensionID']);
    const byDim = new Map<string, string[]>();
    for (const v of dimVals) byDim.set(v.DimensionID, [...(byDim.get(v.DimensionID) ?? []), v.ID]);
    const dimEntry = [...byDim.entries()].find(([, vals]) => vals.length >= 2);
    check('a seeded dimension with ≥2 values exists (CH-12: pre-existing only)', !!dimEntry, `dims seen: ${byDim.size}`);
    const [dimId, [valSales, valMktg]] = dimEntry as [string, string[]];

    const je4 = opOutput<CreateJournalEntryOutput>(await executeOp(apiKey, 'Accounting.CreateJournalEntry', mkDraft('JE4 dims', [
      { GLAccountID: arGL as string, DebitAmount: 100, Dimensions: [{ DimensionID: dimId, DimensionValueID: valSales }] },
      { GLAccountID: arGL as string, DebitAmount: 60, Dimensions: [{ DimensionID: dimId, DimensionValueID: valMktg }] },
      { GLAccountID: revGL as string, CreditAmount: 160 },
    ])));
    check('JE4 booked with 3 lines — same account, DIFFERENT dims did NOT merge at creation', je4.Success === true && je4.LineCount === 3, JSON.stringify(je4));
    const je5 = opOutput<CreateJournalEntryOutput>(await executeOp(apiKey, 'Accounting.CreateJournalEntry', mkDraft('JE5 dims', [
      { GLAccountID: arGL as string, DebitAmount: 40, Dimensions: [{ DimensionID: dimId, DimensionValueID: valSales }] },
      { GLAccountID: revGL as string, CreditAmount: 40 },
    ])));
    check('JE5 booked', je5.Success === true, JSON.stringify(je5));

    const build2 = opOutput<BuildOutputWire>(await executeOp(apiKey, 'Accounting.BuildJournalEntryBatch', { TargetSystem: 'BusinessCentral', CompanyID: companyId }));
    const b2 = build2.Batches?.[0];
    check('dims batch built: jeCount 2, totals 200/200, summaryLineCount 3 (SALES+MKTG+REV, split held)',
      build2.Batches?.length === 1 && b2?.jeCount === 2 && b2?.totalDebits === 200 && b2?.totalCredits === 200 && b2?.summaryLineCount === 3,
      JSON.stringify(build2).slice(0, 250));

    const sumLines = await wireRows<{ ID: string; GLAccountID: string; DebitAmount: number; CreditAmount: number }>(
      apiKey, 'MJ_BizApps_Accounting: Journal Entry Lines', `JournalEntryID='${b2?.summaryJournalEntryId}'`,
      ['ID', 'GLAccountID', 'DebitAmount', 'CreditAmount']);
    const tags = await wireRows<{ JournalEntryLineID: string; DimensionID: string; DimensionValueID: string }>(
      apiKey, 'MJ_BizApps_Accounting: Journal Entry Line Dimensions',
      `JournalEntryLineID IN (${sumLines.map((l) => `'${l.ID}'`).join(',') || `'00000000-0000-0000-0000-000000000000'`})`,
      ['JournalEntryLineID', 'DimensionID', 'DimensionValueID']);
    const tagOf = (lineId: string) => tags.filter((t) => t.JournalEntryLineID.toLowerCase() === lineId.toLowerCase());
    const uuidEq = (a: string, b: string) => (a ?? '').toLowerCase() === (b ?? '').toLowerCase();
    const salesLine = sumLines.find((l) => uuidEq(l.GLAccountID, arGL as string) && tagOf(l.ID).some((t) => uuidEq(t.DimensionValueID, valSales)));
    const mktgLine = sumLines.find((l) => uuidEq(l.GLAccountID, arGL as string) && tagOf(l.ID).some((t) => uuidEq(t.DimensionValueID, valMktg)));
    const revLine = sumLines.find((l) => uuidEq(l.GLAccountID, revGL as string));
    check('summary AR×SALES line netted ACROSS JEs to 140, tagged with exactly its combo',
      Number(salesLine?.DebitAmount) === 140 && tagOf(salesLine?.ID ?? '').length === 1, JSON.stringify({ salesLine, tags: tagOf(salesLine?.ID ?? '') }));
    check('summary AR×MKTG line stayed SPLIT at 60, tagged with exactly its combo',
      Number(mktgLine?.DebitAmount) === 60 && tagOf(mktgLine?.ID ?? '').length === 1, JSON.stringify({ mktgLine, tags: tagOf(mktgLine?.ID ?? '') }));
    check('summary Revenue line 200 credit with NO dimension tags',
      Number(revLine?.CreditAmount) === 200 && tagOf(revLine?.ID ?? '').length === 0, JSON.stringify({ revLine }));
    check('summary has EXACTLY 3 persisted lines (no dimension collapse, no extras)', sumLines.length === 3, JSON.stringify(sumLines));
  } catch (e) {
    check('full-flow journey completed without throwing', false, e instanceof Error ? e.message : String(e));
  } finally {
    if (companyId) { console.log('\nD. Teardown:'); fixtureTeardown(companyId); }
  }

  const total = passed + failed;
  console.log(`\nFull-flow journey harness: ${passed}/${total} passed`);
  process.exit(failed === 0 ? 0 : 1);
}
main().catch((e) => failBootstrap(e instanceof Error ? e.message : String(e)));
