/**
 * Tier-3 API harness — the JE-batch DISPATCH mutation flow over GraphQL.
 *
 * Companion to readmodels-api.ts (which covers the 7 read-model QUERIES). This covers the WRITE
 * side of the API contract — the build→approve→dispatch state machine — at the GraphQL/MJAPI layer
 * (the exact transport the Explorer Batch Dispatch dashboard calls), so a green run means the
 * mutation resolvers are shippable, not just the reads. It mirrors the tier-5 batching GUI spec but
 * with NO browser: pure HTTP + X-API-Key.
 *
 * It reuses the tsx batching fixture (../playwright/lib/batching-fixture.ts) to provision an
 * ISOLATED throwaway company with a CFO + one balanced Pending JE, runs the flow, then tears it down
 * (always, in finally) — so it never touches the persistent demo companies.
 *
 * Flow asserted:
 *   1. BuildJEBatch(company, period, BusinessCentral) → Success, a BatchID, JECount ≥ 1, not "nothing to batch".
 *   2. JEBatchApprovalState(batch)                    → Approved == false (CFO gate engaged, awaiting decision).
 *   3. RecordJEBatchDecision(batch, 'Approved')       → Success.
 *   4. JEBatchApprovalState(batch)                    → Approved == true.
 *   5. DispatchJEBatch(batch)                         → Success, Status ∈ {Sent, Acknowledged}.
 *
 * Run from the INSTANCE WORKTREE ROOT (so .env + the fixture resolve):
 *   cd ~/MJDev/instances/<slug>/mj
 *   npx tsx packages/dev-apps/bizapps-accounting/test-harnesses/api/batch-dispatch-api.ts
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
const FIXTURE = path.resolve(WORKTREE_ROOT, 'packages/dev-apps/bizapps-accounting/test-harnesses/playwright/lib/batching-fixture.ts');
const TARGET_SYSTEM = 'BusinessCentral';

let passed = 0;
let failed = 0;
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
  if (!key) failBootstrap(`launcher produced no mj_sk_ key`);
  return key;
}

async function gql<T>(apiKey: string, query: string): Promise<T> {
  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
    body: JSON.stringify({ query }),
  });
  if (res.status !== 200) throw new Error(`HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 300)}`);
  const json = (await res.json()) as { data?: T; errors?: unknown[] };
  if (json.errors?.length) throw new Error(`GraphQL errors: ${JSON.stringify(json.errors).slice(0, 500)}`);
  if (json.data == null) throw new Error(`missing data: ${JSON.stringify(json).slice(0, 300)}`);
  return (json as { data: T }).data;
}

interface Fixture { companyId: string; periodId: string; cfoPersonId: string; runTag: string; jeId: string; expected: { jeCount: number; summaryLineCount: number; totalDebits: number; totalCredits: number; grossDebits: number } }

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

async function main(): Promise<void> {
  console.log('=== Tier-3 API harness: JE-batch dispatch mutation flow ===');
  // preflight
  try {
    const res = await fetch(GRAPHQL_URL, { method: 'GET' });
    if (!(res.status >= 200 && res.status < 500)) failBootstrap(`MJAPI at ${API_URL} returned HTTP ${res.status}`);
    console.log(`Preflight: MJAPI serving at ${API_URL} (HTTP ${res.status}).`);
  } catch (e) { failBootstrap(`MJAPI not reachable at ${API_URL} (${e instanceof Error ? e.message : String(e)})`); }

  const apiKey = resolveApiKey();
  console.log(`Auth: X-API-Key ${apiKey.slice(0, 10)}… (resolved)`);

  console.log('Provisioning isolated CFO company via the batching fixture…');
  const fx = fixtureSetup();
  console.log(`  fixture company ${fx.companyId} (${fx.runTag}), period ${fx.periodId}`);

  try {
    // 1. Build the batch.
    console.log('\n1. BuildJEBatch (real multi-JE netting + canceling — EXACT values):');
    const build = await gql<{ BuildJEBatch: { Success: boolean; BatchID?: string; JECount: number; SummaryLineCount: number; TotalDebits: number; TotalCredits: number; NothingToBatch: boolean; ErrorMessage?: string } }>(
      apiKey,
      `mutation { BuildJEBatch(companyID:"${fx.companyId}", accountingPeriodID:"${fx.periodId}", targetSystem:"${TARGET_SYSTEM}") { Success BatchID JECount SummaryLineCount TotalDebits TotalCredits NothingToBatch ErrorMessage } }`,
    );
    const b = build.BuildJEBatch;
    const ex = fx.expected;
    check('BuildJEBatch Success', b.Success === true, b.ErrorMessage);
    check('a BatchID was returned', !!b.BatchID, JSON.stringify(b));
    check('not NothingToBatch', b.NothingToBatch === false, `got ${b.NothingToBatch}`);
    check(`JECount === ${ex.jeCount} (the multi-JE batch)`, b.JECount === ex.jeCount, `got ${b.JECount}`);
    check(`SummaryLineCount === ${ex.summaryLineCount} (6 JE lines consolidated → 3 summary lines)`, b.SummaryLineCount === ex.summaryLineCount, `got ${b.SummaryLineCount}`);
    check(`TotalDebits === ${ex.totalDebits} (EXACT netted total)`, b.TotalDebits === ex.totalDebits, `got ${b.TotalDebits}`);
    check(`TotalCredits === ${ex.totalCredits} (EXACT netted total)`, b.TotalCredits === ex.totalCredits, `got ${b.TotalCredits}`);
    check('batch FOOTS (TotalDebits === TotalCredits)', b.TotalDebits === b.TotalCredits, `${b.TotalDebits} vs ${b.TotalCredits}`);
    check(`CANCELING happened (netted ${b.TotalDebits} < gross ${ex.grossDebits} — AR debit/credit netted down)`, b.TotalDebits < ex.grossDebits, `netted ${b.TotalDebits} not < gross ${ex.grossDebits}`);
    const batchID = b.BatchID;
    if (!batchID) throw new Error('no BatchID — cannot continue the flow');

    // 2. Approval state BEFORE the decision → awaiting CFO.
    console.log('\n2. JEBatchApprovalState (before approval):');
    const before = await gql<{ JEBatchApprovalState: { Success: boolean; Approved: boolean; Reason?: string } }>(
      apiKey, `query { JEBatchApprovalState(batchID:"${batchID}") { Success Approved Reason } }`,
    );
    check('approval-state query Success', before.JEBatchApprovalState.Success === true);
    check('Approved == false (CFO gate engaged, awaiting decision)', before.JEBatchApprovalState.Approved === false, `Approved=${before.JEBatchApprovalState.Approved}`);

    // 3. Record the CFO Approved decision.
    console.log('\n3. RecordJEBatchDecision(Approved):');
    const decision = await gql<{ RecordJEBatchDecision: { Success: boolean; ErrorMessage?: string } }>(
      apiKey, `mutation { RecordJEBatchDecision(batchID:"${batchID}", decision:"Approved", notes:"tier-3 api harness") { Success ErrorMessage } }`,
    );
    check('RecordJEBatchDecision Success', decision.RecordJEBatchDecision.Success === true, decision.RecordJEBatchDecision.ErrorMessage);

    // 4. Approval state AFTER the decision → approved.
    console.log('\n4. JEBatchApprovalState (after approval):');
    const after = await gql<{ JEBatchApprovalState: { Success: boolean; Approved: boolean } }>(
      apiKey, `query { JEBatchApprovalState(batchID:"${batchID}") { Success Approved } }`,
    );
    check('Approved == true after the decision', after.JEBatchApprovalState.Approved === true, `Approved=${after.JEBatchApprovalState.Approved}`);

    // 5. Dispatch → Sent/Acknowledged.
    console.log('\n5. DispatchJEBatch:');
    const dispatch = await gql<{ DispatchJEBatch: { Success: boolean; Status?: string; ExternalBatchRef?: string; ErrorMessage?: string } }>(
      apiKey, `mutation { DispatchJEBatch(batchID:"${batchID}") { Success Status ExternalBatchRef ErrorMessage } }`,
    );
    const d = dispatch.DispatchJEBatch;
    check('DispatchJEBatch Success', d.Success === true, d.ErrorMessage);
    check('Status ∈ {Sent, Acknowledged}', d.Status === 'Sent' || d.Status === 'Acknowledged', `Status=${d.Status}`);

    // 6. Reverse the now-GLPosted JE (W6) via the API → a NEW Pending reversal JE (Dr/Cr swapped).
    //    (The engine behavior is proven at tier 2/block1; this closes the API-CONTRACT coverage.)
    console.log('\n6. GenerateJournalEntryReversal:');
    const rev = await gql<{ GenerateJournalEntryReversal: { Success: boolean; ReversalJournalEntryID?: string; ReversalEntryNumber?: string; ErrorMessage?: string } }>(
      apiKey,
      `mutation { GenerateJournalEntryReversal(journalEntryID:"${fx.jeId}", reason:"tier-3 api harness reversal") { Success ReversalJournalEntryID ReversalEntryNumber ErrorMessage } }`,
    );
    const r = rev.GenerateJournalEntryReversal;
    check('GenerateJournalEntryReversal Success', r.Success === true, r.ErrorMessage);
    check('a reversal JE id + EntryNumber were returned', !!r.ReversalJournalEntryID && !!r.ReversalEntryNumber, JSON.stringify(r));
  } catch (e) {
    check('mutation flow completed without throwing', false, e instanceof Error ? e.message : String(e));
  } finally {
    console.log('\nTearing down the fixture company…');
    fixtureTeardown(fx.companyId, fx.cfoPersonId);
  }

  const total = passed + failed;
  console.log(`\nAPI dispatch-flow harness: ${passed}/${total} passed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => failBootstrap(e instanceof Error ? e.message : String(e)));
