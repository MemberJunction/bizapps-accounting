/**
 * Tier-3 API harness — the batch Remote Operations over the GENERIC GraphQL transport
 * (`ExecuteRemoteOperation`) — the S-A port proof: the five batch actions that used to ride the
 * hand-written BatchDispatchResolver now travel MJ's remote-op stack, and this exercises them the
 * way the UI does (pure HTTP + X-API-Key), end to end against the live MJAPI + DB.
 *
 * Integration-style (mirrors the orders headless E2E pattern + MJ's client-first transport
 * doctrine): one continuous business flow with EXACT-value asserts, not per-op smoke checks.
 *
 *   1. Accounting.BuildJournalEntryBatch (explicit CompanyID) — the fixture's 3 JEs net 6 lines → 3 summary
 *      lines, NETTED totals 600 (not the gross 800); approvalTaskId returned (one-transaction
 *      build, D10 rev. 2026-07-29).
 *   2. The ApprovalTaskID/RaisedAt stamp is on the batch row (verified over the wire).
 *   3. GetBatchApprovalState → not approved (with a reason).
 *   4. RecordBatchDecision Approved → approval state flips true.
 *   5. DispatchBatch → Posted + MOCK external ref.
 *   6. Reject path: a new wire-created JE builds a second batch; RecordBatchDecision Rejected →
 *      batch Cancelled, the JE returns to the candidate pool (Pending, JournalEntryBatchID NULL).
 *   7. EmptyJournalEntryBatchError on the wire: an explicit build for a company with nothing to batch is a
 *      loud failure, not a silent no-op.
 *
 * (The no-CompanyID SWEEP form is deliberately NOT exercised here: on a shared instance it would
 * batch other companies' Pending JEs. Its loop is per-company buildBatch + pendingCompanies, both
 * covered — the sweep composition is exercised by the seeded GUI tier instead.)
 *
 * Run from the INSTANCE WORKTREE ROOT:
 *   npx tsx packages/dev-apps/bizapps-accounting/test-harnesses/api/batch-ops-api.ts
 * Env overrides: MJ_API_URL (default http://localhost:4180) · MJ_API_KEY · MJDEV_SLUG.
 * Exit codes: 0 all passed · 1 assertion failures · 2 bootstrap/connection error.
 */
import { execFileSync, execSync } from 'node:child_process';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { CreateJournalEntryOutput, JournalEntryDraft } from '@mj-biz-apps/accounting-engine-base';

const API_URL = (process.env.MJ_API_URL ?? 'http://localhost:4180').replace(/\/+$/, '');
const GRAPHQL_URL = `${API_URL}/`;
const MJDEV_LAUNCHER = '/Users/marcelotorres/MJDev/bin/mjdev';
const INSTANCE_SLUG = process.env.MJDEV_SLUG ?? 'accounting-revamp';
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
function opOutput<T>(res: WireResult): T {
  return JSON.parse(res.outputJSON ?? '{}') as T;
}

/** Entity read over the wire (RunDynamicView) — the same transport the UI uses. */
async function wireRows<T>(apiKey: string, entityName: string, extraFilter: string, fields: string[]): Promise<T[]> {
  const query = `query Run($input: RunDynamicViewInput!) { RunDynamicView(input: $input) { Results { Data } RowCount } }`;
  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
    body: JSON.stringify({ query, variables: { input: { EntityName: entityName, ExtraFilter: extraFilter, Fields: fields } } }),
  });
  const json = (await res.json()) as { data?: { RunDynamicView: { Results: { Data: string }[] } }; errors?: unknown[] };
  if (json.errors?.length || !json.data?.RunDynamicView) throw new Error(`wire read failed: ${JSON.stringify(json.errors ?? json).slice(0, 300)}`);
  return json.data.RunDynamicView.Results.map(r => JSON.parse(r.Data) as T);
}

interface Fixture { companyId: string; runTag: string; jeId: string; expected: { jeCount: number; summaryLineCount: number; totalDebits: number; totalCredits: number } }
function fixtureSetup(): Fixture {
  const out = execFileSync(TSX, [FIXTURE, 'setup'], { cwd: WORKTREE_ROOT, encoding: 'utf8', timeout: 180_000 });
  const line = out.split('\n').find((l) => l.startsWith('FIXTURE_JSON '));
  if (!line) failBootstrap(`batching-fixture setup did not emit FIXTURE_JSON. Output:\n${out.slice(-600)}`);
  return JSON.parse(line.slice('FIXTURE_JSON '.length));
}
function fixtureTeardown(companyId: string): void {
  try {
    execFileSync(TSX, [FIXTURE, 'teardown', companyId], { cwd: WORKTREE_ROOT, encoding: 'utf8', timeout: 180_000 });
    console.log('  (fixture torn down)');
  } catch (e) {
    console.log(`  [teardown warning] ${e instanceof Error ? e.message.split('\n')[0] : String(e)}`);
  }
}

// Wire shapes of the op outputs (server package is not importable here — keep local).
interface BuildResultWire { batchId: string; summaryJournalEntryId: string; summaryLineCount: number; totalDebits: number; totalCredits: number; jeCount: number; approvalTaskId: string | null }
interface BuildOutputWire { Batches: BuildResultWire[]; NothingToBatch: boolean }
interface ApprovalStateWire { Approved: boolean; Reason?: string }
interface DispatchWire { Status: string; ExternalJournalEntryBatchRef: string | null }
interface BatchRow { ID: string; Status: string; ApprovalTaskID: string | null; ApprovalTaskRaisedAt: string | null; ExternalJournalEntryBatchRef: string | null }
interface JERow { ID: string; Status: string; JournalEntryBatchID: string | null }

async function main(): Promise<void> {
  console.log('=== Tier-3 API harness: batch Remote Operations over ExecuteRemoteOperation ===');
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
  const BATCH_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Batches';
  const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';

  try {
    // 0. Preview FIRST (read-only, S-D): same filter/order/netting as the build — exact values.
    console.log('\n0. Accounting.PreviewJournalEntryBatch (read-only, before any build):');
    const prevRes = await executeOp(apiKey, 'Accounting.PreviewJournalEntryBatch', { CompanyIDs: [fx.companyId] });
    check('preview transport success', prevRes.success === true, `${prevRes.resultCode} ${prevRes.errorMessage ?? ''}`);
    const prev = opOutput<{ Candidates: { ID: string; EntryTypeCode: string; Amount: number }[]; TotalDebits: number; TotalCredits: number; PerCompany: { CompanyID: string; Debit: number; Credit: number }[]; OutOfOrderSkipCount: number }>(prevRes);
    check('3 candidates, oldest-first', prev.Candidates?.length === 3, `got ${prev.Candidates?.length}`);
    check('preview totals are the NETTED 600/600 (not the gross 800)', prev.TotalDebits === 600 && prev.TotalCredits === 600, JSON.stringify({ d: prev.TotalDebits, c: prev.TotalCredits }));
    check('one per-company footer row (600/600)', prev.PerCompany?.length === 1 && prev.PerCompany[0].Debit === 600 && prev.PerCompany[0].Credit === 600, JSON.stringify(prev.PerCompany));
    check('no out-of-order skips when everything is included', prev.OutOfOrderSkipCount === 0, `got ${prev.OutOfOrderSkipCount}`);
    check("candidates carry the type CODE ('Manual')", prev.Candidates?.every(c => c.EntryTypeCode === 'Manual') === true, JSON.stringify(prev.Candidates?.map(c => c.EntryTypeCode)));
    // Excluding the two NEWER entries is not out-of-order; excluding the OLDEST while keeping a newer one is.
    const [oldest, , newest] = prev.Candidates.map(c => c.ID);
    const inclOldest = opOutput<{ OutOfOrderSkipCount: number; TotalDebits: number }>(
      await executeOp(apiKey, 'Accounting.PreviewJournalEntryBatch', { CompanyIDs: [fx.companyId], IncludedJournalEntryIDs: [oldest] }));
    check('keeping only the oldest → 0 skips, totals reflect the selection (500)', inclOldest.OutOfOrderSkipCount === 0 && inclOldest.TotalDebits === 500, JSON.stringify(inclOldest).slice(0, 120));
    const inclNewest = opOutput<{ OutOfOrderSkipCount: number }>(
      await executeOp(apiKey, 'Accounting.PreviewJournalEntryBatch', { CompanyIDs: [fx.companyId], IncludedJournalEntryIDs: [newest] }));
    check('keeping only the NEWEST → 2 older entries flagged as skipped', inclNewest.OutOfOrderSkipCount === 2, JSON.stringify(inclNewest).slice(0, 120));

    // 1. Build — exact netted values (600, not the gross 800) + the stamped task id.
    console.log('\n1. Accounting.BuildJournalEntryBatch (explicit CompanyID):');
    const buildRes = await executeOp(apiKey, 'Accounting.BuildJournalEntryBatch', { TargetSystem: 'BusinessCentral', CompanyID: fx.companyId });
    check('transport success', buildRes.success === true, `${buildRes.resultCode} ${buildRes.errorMessage ?? ''}`);
    const build = opOutput<BuildOutputWire>(buildRes);
    check('ONE batch built for the company', build.Batches?.length === 1 && build.NothingToBatch === false, JSON.stringify(build).slice(0, 200));
    const b = build.Batches[0];
    check(`jeCount === ${fx.expected.jeCount}`, b.jeCount === fx.expected.jeCount, `got ${b.jeCount}`);
    check(`summaryLineCount === ${fx.expected.summaryLineCount} (netting consolidated 6 lines)`, b.summaryLineCount === fx.expected.summaryLineCount, `got ${b.summaryLineCount}`);
    check(`totalDebits === ${fx.expected.totalDebits} (NETTED, not gross)`, b.totalDebits === fx.expected.totalDebits, `got ${b.totalDebits}`);
    check(`totalCredits === ${fx.expected.totalCredits}`, b.totalCredits === fx.expected.totalCredits, `got ${b.totalCredits}`);
    check('approvalTaskId returned (task raised in the build transaction)', !!b.approvalTaskId, JSON.stringify(b));

    // 2. The stamp is on the batch row — read over the wire.
    console.log('\n2. ApprovalTaskID stamp on the batch row:');
    const rows = await wireRows<BatchRow>(apiKey, BATCH_ENTITY, `ID='${b.batchId}'`, ['ID', 'Status', 'ApprovalTaskID', 'ApprovalTaskRaisedAt', 'ExternalJournalEntryBatchRef']);
    check('batch row readable over the wire', rows.length === 1, `got ${rows.length}`);
    check('ApprovalTaskID matches the returned task id', (rows[0]?.ApprovalTaskID ?? '').toLowerCase() === (b.approvalTaskId ?? 'x').toLowerCase(), JSON.stringify(rows[0]));
    check('ApprovalTaskRaisedAt stamped', !!rows[0]?.ApprovalTaskRaisedAt, JSON.stringify(rows[0]));

    // 3-4. Approval state flips with the recorded decision.
    console.log('\n3. GetBatchApprovalState before approval:');
    const pre = opOutput<ApprovalStateWire>(await executeOp(apiKey, 'Accounting.GetJournalEntryBatchApprovalState', { JournalEntryBatchID: b.batchId }));
    check('not approved yet, with a reason', pre.Approved === false && !!pre.Reason, JSON.stringify(pre));

    console.log('\n4. RecordBatchDecision → Approved:');
    const dec = await executeOp(apiKey, 'Accounting.RecordJournalEntryBatchDecision', { JournalEntryBatchID: b.batchId, Decision: 'Approved', Notes: `${fx.runTag} tier-3 approval` });
    check('decision recorded', dec.success === true, `${dec.resultCode} ${dec.errorMessage ?? ''}`);
    const post = opOutput<ApprovalStateWire>(await executeOp(apiKey, 'Accounting.GetJournalEntryBatchApprovalState', { JournalEntryBatchID: b.batchId }));
    check('approval state now TRUE', post.Approved === true, JSON.stringify(post));

    // 5. Dispatch — Approved → Sent → Posted via the mock poster.
    console.log('\n5. DispatchBatch:');
    const dispRes = await executeOp(apiKey, 'Accounting.DispatchJournalEntryBatch', { JournalEntryBatchID: b.batchId });
    check('dispatch transport success', dispRes.success === true, `${dispRes.resultCode} ${dispRes.errorMessage ?? ''}`);
    const disp = opOutput<DispatchWire>(dispRes);
    check("Status === 'Posted'", disp.Status === 'Posted', JSON.stringify(disp));
    check('mock external ref recorded', (disp.ExternalJournalEntryBatchRef ?? '').startsWith('MOCK-'), JSON.stringify(disp));

    // 6. Reject path — a fresh wire-created JE, second batch, rejection reverses the lock.
    console.log('\n6. Reject path (new JE → build → reject):');
    const gl = await wireRows<{ ID: string; Code: string }>(apiKey, 'MJ_BizApps_Accounting: GL Accounts', `CompanyID='${fx.companyId}' AND Code IN ('11201','40100')`, ['ID', 'Code']);
    const arGL = gl.find(g => g.Code === '11201')?.ID; const revGL = gl.find(g => g.Code === '40100')?.ID;
    check('fixture GL accounts resolvable over the wire', !!arGL && !!revGL, JSON.stringify(gl));
    const draft: JournalEntryDraft = {
      EffectiveDate: new Date().toISOString(), EntryType: 'Manual', Description: `${fx.runTag} reject-path JE`,
      Lines: [{ GLAccountID: arGL as string, DebitAmount: 50 }, { GLAccountID: revGL as string, CreditAmount: 50 }],
    };
    const jeOut = opOutput<CreateJournalEntryOutput>(await executeOp(apiKey, 'Accounting.CreateJournalEntry', draft));
    check('reject-path JE booked over the wire', jeOut.Success === true, JSON.stringify(jeOut.Errors));
    // Build it via Source='Explicit' — the workspace's include/exclude path (S-D), over the wire.
    const build2 = opOutput<BuildOutputWire>(await executeOp(apiKey, 'Accounting.BuildJournalEntryBatch',
      { TargetSystem: 'BusinessCentral', Source: 'Explicit', JournalEntryIDs: [jeOut.JournalEntryID] }));
    const b2 = build2.Batches?.[0];
    check('explicit-ID build made one batch with exactly the selected JE', build2.Batches?.length === 1 && b2?.jeCount === 1 && b2?.totalDebits === 50, JSON.stringify(build2).slice(0, 200));
    // A stale selection is a LOUD refusal (the JE is now Batched).
    const stale = await executeOp(apiKey, 'Accounting.BuildJournalEntryBatch',
      { TargetSystem: 'BusinessCentral', Source: 'Explicit', JournalEntryIDs: [jeOut.JournalEntryID] });
    check('re-building the same (now locked) selection refused with refresh guidance', stale.success === false && /no longer Pending/.test(stale.errorMessage ?? ''), JSON.stringify(stale).slice(0, 200));
    const rej = await executeOp(apiKey, 'Accounting.RecordJournalEntryBatchDecision', { JournalEntryBatchID: b2.batchId, Decision: 'Rejected', Notes: `${fx.runTag} tier-3 reject` });
    check('rejection recorded', rej.success === true, `${rej.resultCode} ${rej.errorMessage ?? ''}`);
    const b2row = (await wireRows<BatchRow>(apiKey, BATCH_ENTITY, `ID='${b2.batchId}'`, ['ID', 'Status', 'ApprovalTaskID', 'ApprovalTaskRaisedAt', 'ExternalJournalEntryBatchRef']))[0];
    check("rejected batch is 'Cancelled'", b2row?.Status === 'Cancelled', JSON.stringify(b2row));
    const jeRow = (await wireRows<JERow>(apiKey, JE_ENTITY, `ID='${jeOut.JournalEntryID}'`, ['ID', 'Status', 'JournalEntryBatchID']))[0];
    check('rejected JE returned to the candidate pool (Pending, JournalEntryBatchID NULL)', jeRow?.Status === 'Pending' && jeRow?.JournalEntryBatchID === null, JSON.stringify(jeRow));

    // 8. REGENERATE over the wire (added 2026-07-30 — was tier-5-only): re-gather a Pending
    // batch in place after a late candidate lands. Exact values: 50 → 161 (50 + 111), 1 → 2 JEs.
    console.log('\n8. Accounting.RegenerateJournalEntryBatch (late candidate re-gathered, exact totals):');
    const build3 = opOutput<BuildOutputWire>(await executeOp(apiKey, 'Accounting.BuildJournalEntryBatch',
      { TargetSystem: 'BusinessCentral', Source: 'Explicit', JournalEntryIDs: [jeOut.JournalEntryID] }));
    const b3 = build3.Batches?.[0];
    check('regen setup: rebuilt the pool JE into a fresh Pending batch', b3?.jeCount === 1 && b3?.totalDebits === 50, JSON.stringify(build3).slice(0, 200));
    const lateDraft: JournalEntryDraft = {
      EffectiveDate: new Date().toISOString(), EntryType: 'Manual', Description: `${fx.runTag} late candidate for regenerate`,
      Lines: [{ GLAccountID: arGL as string, DebitAmount: 111 }, { GLAccountID: revGL as string, CreditAmount: 111 }],
    };
    const lateOut = opOutput<CreateJournalEntryOutput>(await executeOp(apiKey, 'Accounting.CreateJournalEntry', lateDraft));
    check('late candidate booked over the wire', lateOut.Success === true, JSON.stringify(lateOut.Errors));
    // regenerateBatch returns a FLAT single-batch result (it rebuilds ONE batch in place),
    // unlike BuildBatch's per-company Batches[] envelope.
    const rb = opOutput<{ batchId: string; jeCount: number; totalDebits: number; totalCredits: number; summaryLineCount: number }>(
      await executeOp(apiKey, 'Accounting.RegenerateJournalEntryBatch', { JournalEntryBatchID: b3?.batchId, TargetSystem: 'BusinessCentral' }));
    check('regenerate re-gathered BOTH JEs in the SAME batch with the exact netted total (161 = 50 + 111)',
      String(rb?.batchId ?? '').toLowerCase() === String(b3?.batchId ?? '').toLowerCase() && rb?.jeCount === 2 && rb?.totalDebits === 161 && rb?.totalCredits === 161,
      JSON.stringify(rb).slice(0, 250));
    const lateRow = (await wireRows<JERow>(apiKey, JE_ENTITY, `ID='${lateOut.JournalEntryID}'`, ['ID', 'Status', 'JournalEntryBatchID']))[0];
    check('the late JE is now a locked member of the SAME batch',
      lateRow?.Status === 'Batched' && String(lateRow?.JournalEntryBatchID ?? '').toLowerCase() === String(b3?.batchId ?? '').toLowerCase(), JSON.stringify(lateRow));
    const rej3 = await executeOp(apiKey, 'Accounting.RecordJournalEntryBatchDecision', { JournalEntryBatchID: b3?.batchId, Decision: 'Rejected', Notes: `${fx.runTag} tier-3 regen cleanup` });
    check('regen batch rejected (pool restored for teardown)', rej3.success === true, `${rej3.resultCode} ${rej3.errorMessage ?? ''}`);

    // 7→9. Empty build is LOUD on the wire (EmptyJournalEntryBatchError → failed op, never a silent no-op batch).
    console.log('\n9. Empty explicit build fails loudly:');
    const emptyRes = await executeOp(apiKey, 'Accounting.BuildJournalEntryBatch', { TargetSystem: 'BusinessCentral', CompanyID: randomUUID() });
    check('op failed with the Nothing-to-batch message', emptyRes.success === false && /nothing to batch/i.test(emptyRes.errorMessage ?? ''), JSON.stringify(emptyRes).slice(0, 250));
  } catch (e) {
    check('wire flow completed without throwing', false, e instanceof Error ? e.message : String(e));
  } finally {
    console.log('\nTearing down the fixture company…');
    fixtureTeardown(fx.companyId);
  }

  const total = passed + failed;
  console.log(`\nAPI batch-ops harness: ${passed}/${total} passed`);
  process.exit(failed === 0 ? 0 : 1);
}
main().catch((e) => failBootstrap(e instanceof Error ? e.message : String(e)));
