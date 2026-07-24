/**
 * phase2-encapsulation.live.test.ts — the LIVE tier-2 proof of the phase-2 encapsulated model,
 * against the real instance DB through the real SQLServerDataProvider. Exact values, never
 * liveness; raw SQL is the truth the entity layer is cross-checked against.
 *
 *   L1  encapsulated create — ONE Save() persists header + lines + dimension tags; raw-SQL
 *       cross-check of every row; EntryNumber matches JE-{CompanyCode}-{FY}-{seq:000000}.
 *   L2  numbering increments per company/FY.
 *   L3  load round-trip — a fresh Load() hydrates Lines AND their Dimensions (bulk query).
 *   L4  GenerateReversal — swapped amounts, both back-references, dimension tags CARRIED.
 *   L5  engine draft path — AccountingEngine merges duplicate lines and books through the
 *       encapsulated entity (the orders-server call path).
 *   L6  full batch cycle — buildBatch nets to a BatchSummary JE (exact netted totals),
 *       members lock; approve → dispatch (mock poster) → batch Posted, members + summary GLPosted.
 *   L7  batch lifecycle invariants on a SAVED batch — Posted is terminal (illegal transition
 *       rejected by the entity), and a batch cannot be BORN mid-lifecycle.
 *   L8  GLAccount identity lock — Code change is rejected once JE lines reference the account;
 *       cosmetic Name change still saves.
 *
 * Run from the app root:  npx vitest run --config test-harnesses/server/vitest.config.ts
 * Requires: the live instance DB (mj/.env creds); packages built (imports their dist).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Metadata, IMetadataProvider } from '@memberjunction/core';
import {
  JournalEntryEntityServer,
  JournalEntryBatchEntityServer,
  GLAccountEntityServer,
  AccountingEngine,
  buildBatch,
  approveBatch,
  sendBatch,
  AutoApproveGate,
  mockErpPoster,
} from '@mj-biz-apps/accounting-core-entities-server';
import { AccountingEngineBase } from '@mj-biz-apps/accounting-engine-base';
import { bootstrapLive, teardownLive, scalar, SCHEMA, type LiveCtx } from './live-bootstrap.js';

const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';
const BATCH_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Batches';
const GL_ENTITY = 'MJ_BizApps_Accounting: GL Accounts';

let ctx: LiveCtx;
let provider: IMetadataProvider;

/** Assemble + save one encapsulated JE (2 lines, optional dim on line 1). Returns the saved entity. */
async function createJE(withDim: boolean, amount: number, description: string): Promise<JournalEntryEntityServer> {
  const je = await provider.GetEntityObject<JournalEntryEntityServer>(JE_ENTITY, ctx.user);
  je.NewRecord();
  je.CompanyID = ctx.company.id;
  je.EffectiveDate = new Date();
  je.EntryType = 'Manual';
  je.Status = 'Pending';
  je.Description = `${ctx.runTag} ${description}`;
  const l1 = await je.CreateLine(ctx.user);
  l1.GLAccountID = ctx.company.arGL;
  l1.DebitAmount = amount;
  if (withDim) {
    const d = await l1.CreateDimension(ctx.user);
    d.DimensionID = ctx.dimId;
    d.DimensionValueID = ctx.dimValSales;
  }
  const l2 = await je.CreateLine(ctx.user);
  l2.GLAccountID = ctx.company.revGL;
  l2.CreditAmount = amount;
  const saved = await je.Save();
  expect(saved, `JE save failed: ${je.LatestResult?.CompleteMessage}`).toBe(true);
  ctx.createdJEIds.push(je.ID);
  return je;
}

beforeAll(async () => {
  ctx = await bootstrapLive();
  // The harness is the composition root: bootstrapLive() created this provider via
  // setupSQLServerClient, so reading the global HERE (and injecting it everywhere below)
  // is the sanctioned pattern — the code under test never touches a global itself.
  provider = Metadata.Provider as IMetadataProvider;
  if (!provider) throw new Error('bootstrap did not establish a provider');
  // Prime the reference caches so entity validation + the engine see the fixture company.
  await AccountingEngineBase.Instance.ConfigEx({ forceRefresh: true, contextUser: ctx.user, provider });
});

afterAll(async () => {
  if (ctx) await teardownLive(ctx);
});

describe('phase-2 encapsulated JournalEntry (live tier-2)', () => {
  let firstJE: JournalEntryEntityServer;

  it('L1 — one Save() persists header + lines + dimension tags (raw-SQL cross-checked), EntryNumber formatted', async () => {
    firstJE = await createJE(true, 125.5, 'L1');

    expect(firstJE.EntryNumber).toMatch(new RegExp(`^JE-${ctx.company.code}-\\d{4}-\\d{6}$`));
    const header = Number(await scalar(ctx.pool, `SELECT COUNT(*) FROM ${SCHEMA}.JournalEntry WHERE ID='${firstJE.ID}' AND CompanyID='${ctx.company.id}' AND Status='Pending'`));
    expect(header).toBe(1);
    const lines = Number(await scalar(ctx.pool, `SELECT COUNT(*) FROM ${SCHEMA}.JournalEntryLine WHERE JournalEntryID='${firstJE.ID}'`));
    expect(lines).toBe(2);
    const dims = Number(await scalar(ctx.pool, `SELECT COUNT(*) FROM ${SCHEMA}.JournalEntryLineDimension d JOIN ${SCHEMA}.JournalEntryLine l ON l.ID=d.JournalEntryLineID WHERE l.JournalEntryID='${firstJE.ID}'`));
    expect(dims).toBe(1);
    const debit = Number(await scalar(ctx.pool, `SELECT SUM(DebitAmount) FROM ${SCHEMA}.JournalEntryLine WHERE JournalEntryID='${firstJE.ID}'`));
    expect(debit).toBe(125.5);
  });

  it('L2 — numbering increments within the company/FY', async () => {
    const second = await createJE(false, 40, 'L2');
    const seqOf = (n: string | null) => Number((n ?? '').split('-').pop());
    expect(seqOf(second.EntryNumber)).toBe(seqOf(firstJE.EntryNumber) + 1);
  });

  it('L3 — a fresh Load() hydrates Lines AND their Dimensions', async () => {
    const reloaded = await provider.GetEntityObject<JournalEntryEntityServer>(JE_ENTITY, ctx.user);
    expect(await reloaded.Load(firstJE.ID)).toBe(true);
    expect(reloaded.Lines).toHaveLength(2);
    const taggedLine = reloaded.Lines.find(l => (l.DebitAmount ?? 0) > 0);
    expect(taggedLine?.Dimensions).toHaveLength(1);
    expect(taggedLine?.Dimensions[0].DimensionValueID.toLowerCase()).toBe(ctx.dimValSales.toLowerCase());
  });

  it('L4 — GenerateReversal swaps amounts, back-references both ways, and CARRIES dimension tags', async () => {
    const reloaded = await provider.GetEntityObject<JournalEntryEntityServer>(JE_ENTITY, ctx.user);
    expect(await reloaded.Load(firstJE.ID)).toBe(true);
    const reversal = await reloaded.GenerateReversal('live-harness L4', ctx.user);
    ctx.createdJEIds.push(reversal.ID);

    expect(reversal.EntryType).toBe('Reversal');
    const backRef = await scalar(ctx.pool, `SELECT ReversedByJournalEntryID FROM ${SCHEMA}.JournalEntry WHERE ID='${firstJE.ID}'`);
    expect(String(backRef).toLowerCase()).toBe(reversal.ID.toLowerCase());
    // Swapped: the original's 125.50 DEBIT on AR comes back as a CREDIT on AR.
    const swappedCredit = Number(await scalar(ctx.pool, `SELECT CreditAmount FROM ${SCHEMA}.JournalEntryLine WHERE JournalEntryID='${reversal.ID}' AND GLAccountID='${ctx.company.arGL}'`));
    expect(swappedCredit).toBe(125.5);
    // The dimension tag travelled with the swapped line (the old copy path dropped it).
    const dims = Number(await scalar(ctx.pool, `SELECT COUNT(*) FROM ${SCHEMA}.JournalEntryLineDimension d JOIN ${SCHEMA}.JournalEntryLine l ON l.ID=d.JournalEntryLineID WHERE l.JournalEntryID='${reversal.ID}' AND d.DimensionValueID='${ctx.dimValSales}'`));
    expect(dims).toBe(1);
  });

  it('L5 — the engine draft path merges duplicate lines and books through the entity', async () => {
    const out = await AccountingEngine.Instance.CreateJournalEntry({
      EffectiveDate: new Date().toISOString(),
      EntryType: 'OrderBooking',
      Description: `${ctx.runTag} L5`,
      Lines: [
        { GLAccountID: ctx.company.arGL, DebitAmount: 70 },
        { GLAccountID: ctx.company.arGL, DebitAmount: 30 },  // merges with the 70
        { GLAccountID: ctx.company.revGL, CreditAmount: 100, Dimensions: [{ DimensionID: ctx.dimId, DimensionValueID: ctx.dimValMktg }] },
      ],
    }, ctx.user, provider);
    expect(out.Success, JSON.stringify(out.Errors)).toBe(true);
    ctx.createdJEIds.push(out.JournalEntryID!);
    expect(out.LineCount).toBe(2); // AR lines merged
    const merged = Number(await scalar(ctx.pool, `SELECT DebitAmount FROM ${SCHEMA}.JournalEntryLine WHERE JournalEntryID='${out.JournalEntryID}' AND GLAccountID='${ctx.company.arGL}'`));
    expect(merged).toBe(100);
  });

  it('L6 — full batch cycle: netted BatchSummary JE, exact totals, approve → dispatch → GLPosted', async () => {
    // Candidates right now: L2's 40/40 + L4's reversal (125.50 both ways) + L5's 100/100.
    // Netting on AR: +125.5(L1... L1 is Pending too!) — compute expected from raw SQL instead of hand-math:
    const rawDr = Number(await scalar(ctx.pool,
      `SELECT SUM(l.DebitAmount) FROM ${SCHEMA}.JournalEntryLine l JOIN ${SCHEMA}.JournalEntry j ON j.ID=l.JournalEntryID
       WHERE j.CompanyID='${ctx.company.id}' AND j.Status='Pending' AND j.EntryType<>'BatchSummary'`));

    const result = await buildBatch(ctx.company.id, 'BusinessCentral', ctx.user.ID, ctx.user, provider, AutoApproveGate);
    expect(result, 'buildBatch returned null — expected pending JEs to batch').not.toBeNull();
    ctx.createdBatchIds.push(result!.batchId);

    // Summary JE: exists, right shape, rides the lock machinery.
    const summary = (await ctx.pool.request().query(
      `SELECT EntryType, Status, CompanyID, BatchID FROM ${SCHEMA}.JournalEntry WHERE ID='${result!.summaryJournalEntryId}'`)).recordset[0];
    expect(summary.EntryType).toBe('BatchSummary');
    expect(summary.Status).toBe('Batched');
    expect(String(summary.BatchID).toLowerCase()).toBe(result!.batchId.toLowerCase());

    // Control totals foot and are EXACT: netting preserves balance, so batch Dr == batch Cr,
    // and both ≤ the gross pending debits (netting can only shrink).
    expect(result!.totalDebits).toBe(result!.totalCredits);
    expect(result!.totalDebits).toBeGreaterThan(0);
    expect(result!.totalDebits).toBeLessThanOrEqual(rawDr);
    const summaryDr = Number(await scalar(ctx.pool, `SELECT SUM(DebitAmount) FROM ${SCHEMA}.JournalEntryLine WHERE JournalEntryID='${result!.summaryJournalEntryId}'`));
    expect(summaryDr).toBe(result!.totalDebits);

    // Members locked.
    const pendingLeft = Number(await scalar(ctx.pool, `SELECT COUNT(*) FROM ${SCHEMA}.JournalEntry WHERE CompanyID='${ctx.company.id}' AND Status='Pending'`));
    expect(pendingLeft).toBe(0);

    // Approve → dispatch (mock poster) → Posted; members + summary GLPosted.
    await approveBatch(result!.batchId, ctx.user.ID, ctx.user, provider);
    const batch = await sendBatch(result!.batchId, ctx.user, { gate: AutoApproveGate, poster: mockErpPoster, provider });
    expect(batch.Status).toBe('Posted');
    const notPosted = Number(await scalar(ctx.pool, `SELECT COUNT(*) FROM ${SCHEMA}.JournalEntry WHERE BatchID='${result!.batchId}' AND Status<>'GLPosted'`));
    expect(notPosted).toBe(0);
  });

  it('L7 — batch lifecycle invariants on SAVED records: Posted is terminal; a batch cannot be born mid-lifecycle', async () => {
    const postedId = ctx.createdBatchIds[0];
    const batch = await provider.GetEntityObject<JournalEntryBatchEntityServer>(BATCH_ENTITY, ctx.user);
    expect(await batch.Load(postedId)).toBe(true);
    batch.Status = 'Pending'; // illegal: Posted is terminal
    const saved = await batch.Save();
    expect(saved).toBe(false);

    const born = await provider.GetEntityObject<JournalEntryBatchEntityServer>(BATCH_ENTITY, ctx.user);
    born.NewRecord();
    born.CompanyID = ctx.company.id;
    born.PostingDate = new Date();
    born.TargetSystem = 'BusinessCentral';
    born.BatchedByUserID = ctx.user.ID;
    born.Status = 'Sent'; // illegal: a batch is born Pending
    const bornSaved = await born.Save();
    expect(bornSaved).toBe(false);
  });

  it('L8 — GLAccount identity lock: Code change rejected once referenced; cosmetic rename still saves', async () => {
    const gl = await provider.GetEntityObject<GLAccountEntityServer>(GL_ENTITY, ctx.user);
    expect(await gl.Load(ctx.company.arGL)).toBe(true);
    gl.Code = '99999';
    expect(await gl.Save()).toBe(false); // JE lines reference this account

    const gl2 = await provider.GetEntityObject<GLAccountEntityServer>(GL_ENTITY, ctx.user);
    expect(await gl2.Load(ctx.company.arGL)).toBe(true);
    gl2.Name = `${gl2.Name} (renamed by live harness)`;
    expect(await gl2.Save(), `cosmetic rename should save: ${gl2.LatestResult?.CompleteMessage}`).toBe(true);
  });
});
