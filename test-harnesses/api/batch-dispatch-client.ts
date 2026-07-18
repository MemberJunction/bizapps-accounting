/**
 * Tier-3 API harness — the JE-batch DISPATCH mutation flow, driven through the app's REAL clients
 * (`BatchDispatchClient` + `JournalEntryClient`) → GraphQL → MJAPI → DB. The write-side counterpart
 * to readmodels-client.ts. Replaces the hand-rolled-`fetch` batch-dispatch-api.ts: the mutation
 * documents tested here are the exact ones the Batch Dispatch dashboard ships.
 *
 * The clients surface resolver errors in their RESULT shape (Success:false + ErrorMessage), not
 * swallowed to [], so the "dispatch-before-approval refused" negative is asserted via the client too.
 *
 * Isolation: reuses the tsx batching fixture as a SUBPROCESS (it needs the direct-SQL provider, which
 * can't coexist with the GraphQL client in one process), provisioning a throwaway CFO company + a
 * balanced multi-JE Pending set, then tearing it down in `finally` — never touches the demo companies.
 *
 * Run from the INSTANCE WORKTREE ROOT:
 *   npx tsx packages/dev-apps/bizapps-accounting/test-harnesses/api/batch-dispatch-client.ts
 * Exit: 0 all passed · 1 assertion failures · 2 bootstrap error.
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { bootstrapClientProvider, makeChecker, failBootstrap } from './_client-bootstrap.js';
import { BatchDispatchClient } from '../../packages/Angular/src/lib/custom/BatchDispatch/batch-dispatch.client.js';
import { JournalEntryClient } from '../../packages/Angular/src/lib/custom/JournalEntry/journal-entry.client.js';

const WORKTREE_ROOT = process.cwd();
const TSX = path.resolve(WORKTREE_ROOT, 'node_modules', '.bin', 'tsx');
const FIXTURE = path.resolve(WORKTREE_ROOT, 'packages/dev-apps/bizapps-accounting/test-harnesses/playwright/lib/batching-fixture.ts');
const TARGET_SYSTEM = 'BusinessCentral';

interface Fixture {
  companyId: string; cfoPersonId: string; runTag: string; jeId: string;
  expected: { jeCount: number; summaryLineCount: number; totalDebits: number; totalCredits: number; grossDebits: number; companyCount: number };
}

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
  console.log('=== Tier-3 API harness: batch dispatch flow via REAL BatchDispatchClient/JournalEntryClient ===');
  const { check, summary } = makeChecker();

  // Provision the fixture FIRST (a multi-second direct-SQL subprocess), THEN bootstrap the GraphQL
  // client right before the mutations — otherwise the keep-alive connection opened at bootstrap goes
  // stale across the subprocess gap and MJAPI resets the first POST (ECONNRESET; undici won't retry a
  // non-idempotent mutation).
  console.log('Provisioning isolated CFO company via the batching fixture…');
  const fx = fixtureSetup();
  const ex = fx.expected;
  console.log(`  fixture company ${fx.companyId} (${fx.runTag})`);

  const provider = await bootstrapClientProvider();
  const batch = new BatchDispatchClient(provider);
  const je = new JournalEntryClient(provider);

  try {
    // 1. Build the batch — EXACT netted/canceled values.
    console.log('\n1. BuildBatch (multi-JE netting + canceling — EXACT values):');
    const b = await batch.BuildBatch(TARGET_SYSTEM);
    check('BuildBatch Success', b.Success === true, b.ErrorMessage);
    check('a BatchID was returned', !!b.BatchID, JSON.stringify(b));
    check('not NothingToBatch', b.NothingToBatch === false, `got ${b.NothingToBatch}`);
    check(`JECount === ${ex.jeCount}`, b.JECount === ex.jeCount, `got ${b.JECount}`);
    check(`SummaryLineCount === ${ex.summaryLineCount} (consolidated)`, b.SummaryLineCount === ex.summaryLineCount, `got ${b.SummaryLineCount}`);
    check(`TotalDebits === ${ex.totalDebits} (EXACT netted)`, b.TotalDebits === ex.totalDebits, `got ${b.TotalDebits}`);
    check(`TotalCredits === ${ex.totalCredits} (EXACT netted)`, b.TotalCredits === ex.totalCredits, `got ${b.TotalCredits}`);
    check('batch FOOTS (Debits === Credits)', b.TotalDebits === b.TotalCredits, `${b.TotalDebits} vs ${b.TotalCredits}`);
    check(`CANCELING happened (netted ${b.TotalDebits} < gross ${ex.grossDebits})`, b.TotalDebits < ex.grossDebits, `netted ${b.TotalDebits} not < gross ${ex.grossDebits}`);
    check(`CompanyCount === ${ex.companyCount} (CH-4 shape)`, b.CompanyCount === ex.companyCount, `got ${b.CompanyCount}`);
    const batchID = b.BatchID;
    if (!batchID) throw new Error('no BatchID — cannot continue the flow');

    // 2. Approval state before decision → awaiting CFO.
    console.log('\n2. GetApprovalState (before decision):');
    const before = await batch.GetApprovalState(batchID);
    check('approval-state Success', before.Success === true, before.Reason);
    check('Approved == false (CFO gate engaged)', before.Approved === false, `Approved=${before.Approved}`);

    // 2b. Dispatch BEFORE approval → REFUSED (client surfaces the error in-result).
    console.log('\n2b. DispatchBatch before approval (must be refused):');
    const early = await batch.DispatchBatch(batchID);
    check('early dispatch REFUSED (batch not Approved)', early.Success === false, JSON.stringify(early));
    check('refusal names the Approved requirement', /approved/i.test(early.ErrorMessage ?? ''), `ErrorMessage='${early.ErrorMessage ?? ''}'`);

    // 3. Record the CFO Approved decision.
    console.log('\n3. RecordDecision(Approved):');
    const decision = await batch.RecordDecision(batchID, 'Approved', 'tier-3 real-client harness');
    check('RecordDecision Success', decision.Success === true, decision.ErrorMessage);

    // 4. Approval state after decision → approved.
    console.log('\n4. GetApprovalState (after decision):');
    const after = await batch.GetApprovalState(batchID);
    check('Approved == true after decision', after.Approved === true, `Approved=${after.Approved}`);

    // 5. Dispatch → Posted.
    console.log('\n5. DispatchBatch:');
    const d = await batch.DispatchBatch(batchID);
    check('DispatchBatch Success', d.Success === true, d.ErrorMessage);
    check("Status == 'Posted' (Approved → Sent → Posted)", d.Status === 'Posted', `Status=${d.Status}`);

    // 6. Reverse the now-GLPosted JE via the JournalEntryClient → new Pending reversal JE.
    console.log('\n6. JournalEntryClient.GenerateReversal:');
    const r = await je.GenerateReversal(fx.jeId, 'tier-3 real-client harness reversal');
    check('GenerateReversal Success', r.Success === true, r.ErrorMessage);
    check('a reversal JE id + EntryNumber were returned', !!r.ReversalJournalEntryID && !!r.ReversalEntryNumber, JSON.stringify(r));
  } catch (e) {
    check('mutation flow completed without throwing', false, e instanceof Error ? e.message : String(e));
  } finally {
    console.log('\nTearing down the fixture company…');
    fixtureTeardown(fx.companyId, fx.cfoPersonId);
  }

  process.exit(summary('BatchDispatch tier-3 (real client)') === 0 ? 0 : 1);
}

main().catch((e) => failBootstrap(e instanceof Error ? e.message : String(e)));
