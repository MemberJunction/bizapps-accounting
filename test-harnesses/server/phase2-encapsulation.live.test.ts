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
 *   L6  full batch cycle — buildJournalEntryBatch nets to a JournalEntryBatchSummary JE (exact netted totals),
 *       members lock; approve → dispatch (mock poster) → batch Posted, members + summary GLPosted.
 *   L7  batch lifecycle invariants on a SAVED batch — Posted is terminal (illegal transition
 *       rejected by the entity), a batch cannot be BORN mid-lifecycle, and a batch the batching
 *       process did not build is refused outright (#193).
 *   L8  GLAccount identity lock — Code change is rejected once JE lines reference the account;
 *       cosmetic Name change still saves.
 *   L20 concurrent retry (#184) — two retries of one Failed batch race; the ERP is called once,
 *       the loser is refused by trg_JournalEntryBatch_SendOnce, and the row and __mj.RecordChange
 *       together record both sends, who made them, and the failure a later success cleared.
 *   L21 the send-once trigger against raw SQL: every refusal, every edge it still allows, and the
 *       send stamp frozen on a Posted row.
 *   L22 the stale retry that lands AFTER the winner left Sent — winner Posted, or winner Failed
 *       again — is refused too, and the ERP is still called once.
 *   L23 dimension tags on a locked line (#216) — trg_JELD_Immutability refuses raw insert, update
 *       and delete of a tag on a Batched member or summary line.
 *
 * Run from the app root:  npx vitest run --config test-harnesses/server/vitest.config.ts
 * Requires: the live instance DB (mj/.env creds); packages built (imports their dist).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Metadata, IMetadataProvider } from '@memberjunction/core';
import { MJGlobal } from '@memberjunction/global';
import {
  JournalEntryEntityServer,
  JournalEntryBatchEntityServer,
  GLAccountEntityServer,
  GLAccountLinkEntityServer,
  AccountingEngine,
  CreateJournalEntriesOperation,
  buildJournalEntryBatch,
  approveJournalEntryBatch,
  sendJournalEntryBatch,
  AutoApproveGate,
  TasksAppApprovalGate,
  mockErpPoster,
  unavailableErpLookup,
  JournalEntryBatchDispatchServices,
  JournalEntryBatchSendRefusedError,
  type ErpJournalLookup,
  type ErpPoster,
  type JournalEntryBatchApprovalGate,
  type JournalEntryBatchCancelGate,
} from '@mj-biz-apps/accounting-core-entities-server';
import type { mjBizAppsAccountingAccountingCompanyProfileEntity } from '@mj-biz-apps/accounting-entities';
import { AccountingEngineBase } from '@mj-biz-apps/accounting-engine-base';
import { bootstrapLive, teardownLive, scalar, SCHEMA, type LiveCtx } from './live-bootstrap.js';
import { RegisterHarnessDispatchServices } from './harness-dispatch-services.js';

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
  je.EntryTypeID = ctx.entryTypes.get('Manual')!;
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

/** The gate and poster one send uses, for the races below that need a different pair per send. */
interface SendServices { gate: JournalEntryBatchApprovalGate; poster: ErpPoster }

/** Queued by {@link sendWith}; each send's services instance takes the next one when it is created. */
const queuedSendServices: SendServices[] = [];

/**
 * The engine resolves its dispatch services once per send, synchronously as the send starts (#233).
 * This subclass takes that send's gate and poster from the queue; with nothing queued it behaves
 * like the harness services (approved, mock ERP, no lookup).
 */
class PerSendDispatchServices extends JournalEntryBatchDispatchServices {
  private readonly services: SendServices = queuedSendServices.shift() ?? { gate: AutoApproveGate, poster: mockErpPoster };
  public override CreateApprovalGate(): JournalEntryBatchApprovalGate { return this.services.gate; }
  public override CreatePoster(): ErpPoster { return this.services.poster; }
  public override CreateLookup(): ErpJournalLookup { return unavailableErpLookup; }
  public override CreateCancelGate(): JournalEntryBatchCancelGate { return PendingRejectedCancelGate; }
}

/** The batch IDs the cancel gate was asked to confirm a Pending rejection for (L19). */
const rejectionChecks: string[] = [];

/**
 * The cancel gate for this file. Batches here are built with AutoApproveGate, so they have no approval
 * Task to record a rejection on; Cancel() authorizes itself through this gate (#214), which counts a
 * Pending batch as rejected. Nothing here cancels past approval.
 */
const PendingRejectedCancelGate: JournalEntryBatchCancelGate = {
  async assertRejected(batchId) { rejectionChecks.push(batchId.toLowerCase()); },
  async assertMayCancelApproved() { throw new Error('phase2 harness: no test cancels past approval'); },
  async recordCancellation() { throw new Error('phase2 harness: no test cancels past approval'); },
};

/** Send a batch with this gate and poster. The queue push and the send's resolve happen in one tick. */
function sendWith(batchId: string, services: Partial<SendServices>, confirmNotAlreadyPostedInERP = false) {
  queuedSendServices.push({ gate: services.gate ?? AutoApproveGate, poster: services.poster ?? mockErpPoster });
  return sendJournalEntryBatch(batchId, ctx.user, { provider, confirmNotAlreadyPostedInERP });
}

beforeAll(async () => {
  ctx = await bootstrapLive();
  RegisterHarnessDispatchServices(); // the send's gate and poster: always approved, mock ERP (#233)
  MJGlobal.Instance.ClassFactory.Register(JournalEntryBatchDispatchServices, PerSendDispatchServices, null, 1001, true);
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
    // Lines and each line's Dimensions are RelatedRecordCollections — read them through Items.
    expect(reloaded.Lines.Items).toHaveLength(2);
    const taggedLine = reloaded.Lines.Items.find(l => (l.DebitAmount ?? 0) > 0);
    expect(taggedLine?.Dimensions.Items).toHaveLength(1);
    expect(taggedLine?.Dimensions.Items[0].DimensionValueID.toLowerCase()).toBe(ctx.dimValSales.toLowerCase());
  });

  it('L4 — GenerateReversal swaps amounts, back-references both ways, and CARRIES dimension tags', async () => {
    const reloaded = await provider.GetEntityObject<JournalEntryEntityServer>(JE_ENTITY, ctx.user);
    expect(await reloaded.Load(firstJE.ID)).toBe(true);
    const reversal = await reloaded.GenerateReversal('live-harness L4', ctx.user);
    ctx.createdJEIds.push(reversal.ID);

    expect(reversal.EntryTypeID.toLowerCase()).toBe(ctx.entryTypes.get('Reversal')!.toLowerCase());
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

  it('L6 — full batch cycle: netted JournalEntryBatchSummary JE, exact totals, approve → dispatch → GLPosted', async () => {
    // Candidates right now: L2's 40/40 + L4's reversal (125.50 both ways) + L5's 100/100.
    // Netting on AR: +125.5(L1... L1 is Pending too!) — compute expected from raw SQL instead of hand-math:
    const rawDr = Number(await scalar(ctx.pool,
      `SELECT SUM(l.DebitAmount) FROM ${SCHEMA}.JournalEntryLine l JOIN ${SCHEMA}.JournalEntry j ON j.ID=l.JournalEntryID
       WHERE j.CompanyID='${ctx.company.id}' AND j.Status='Pending' AND j.EntryTypeID<>'${ctx.batchSummaryTypeId}'`));

    const result = await buildJournalEntryBatch(ctx.company.id, 'BusinessCentral', ctx.user.ID, ctx.user, provider, AutoApproveGate);
    expect(result, 'buildJournalEntryBatch returned null — expected pending JEs to batch').not.toBeNull();
    ctx.createdBatchIds.push(result!.batchId);

    // Summary JE: exists, right shape, rides the lock machinery.
    const summary = (await ctx.pool.request().query(
      `SELECT EntryTypeID, Status, CompanyID, JournalEntryBatchID FROM ${SCHEMA}.JournalEntry WHERE ID='${result!.summaryJournalEntryId}'`)).recordset[0];
    expect(String(summary.EntryTypeID).toLowerCase()).toBe(ctx.batchSummaryTypeId.toLowerCase());
    expect(summary.Status).toBe('Batched');
    expect(String(summary.JournalEntryBatchID).toLowerCase()).toBe(result!.batchId.toLowerCase());

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

    // Approve → dispatch (mock poster, via the harness dispatch services) → Posted; members + summary GLPosted.
    await approveJournalEntryBatch(result!.batchId, ctx.user.ID, ctx.user, provider);
    const batch = await sendJournalEntryBatch(result!.batchId, ctx.user, { provider });
    expect(batch.Status).toBe('Posted');
    const notPosted = Number(await scalar(ctx.pool, `SELECT COUNT(*) FROM ${SCHEMA}.JournalEntry WHERE JournalEntryBatchID='${result!.batchId}' AND Status<>'GLPosted'`));
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
    // Claim the create the way the engine does. Without this the create guard (#193) refuses the
    // save first and the assertion below passes for the wrong reason — this case is about the
    // BORN-PENDING rule, so it has to get past the guard to reach it.
    born.MarkBuiltByBatchingProcess();
    born.CompanyID = ctx.company.id;
    born.PostingDate = new Date();
    born.TargetSystem = 'BusinessCentral';
    born.BatchedByUserID = ctx.user.ID;
    born.Status = 'Sent'; // illegal: a batch is born Pending
    const bornSaved = await born.Save();
    expect(bornSaved).toBe(false);
    expect(born.LatestResult?.CompleteMessage ?? '').toContain("must start at Status='Pending'");

    // ...and the guard itself: an unclaimed create is refused even when everything else is legal.
    const handTyped = await provider.GetEntityObject<JournalEntryBatchEntityServer>(BATCH_ENTITY, ctx.user);
    handTyped.NewRecord();
    handTyped.CompanyID = ctx.company.id;
    handTyped.PostingDate = new Date();
    handTyped.TargetSystem = 'BusinessCentral';
    handTyped.BatchedByUserID = ctx.user.ID;
    handTyped.Status = 'Pending';
    expect(await handTyped.Save()).toBe(false);
    expect(handTyped.LatestResult?.CompleteMessage ?? '').toContain('cannot be created directly');
  });

  it('L9 — SET op (the Orders call shape): N drafts book atomically in ONE call, sequential numbering', async () => {
    // The exact call site orders-server will use: op.Execute over the injected provider.
    const op = new CreateJournalEntriesOperation();
    const result = await op.Execute({
      Drafts: [
        {
          EffectiveDate: new Date().toISOString(), EntryType: 'OrderBooking', Description: `${ctx.runTag} L9 line-1`,
          Lines: [
            { GLAccountID: ctx.company.arGL, DebitAmount: 10 },
            { GLAccountID: ctx.company.revGL, CreditAmount: 10 },
          ],
        },
        {
          EffectiveDate: new Date().toISOString(), EntryType: 'OrderBooking', Description: `${ctx.runTag} L9 line-2`,
          Lines: [
            { GLAccountID: ctx.company.arGL, DebitAmount: 20 },
            { GLAccountID: ctx.company.revGL, CreditAmount: 20, Dimensions: [{ DimensionID: ctx.dimId, DimensionValueID: ctx.dimValSales }] },
          ],
        },
      ],
    }, { provider, user: ctx.user });
    const out = result.Output;
    expect(out?.Success, JSON.stringify(out?.Errors ?? result.ErrorMessage)).toBe(true);
    expect(out!.Results).toHaveLength(2);
    for (const r of out!.Results!) ctx.createdJEIds.push(r.JournalEntryID!);

    // Both persisted; numbering consecutive across the set.
    const seqOf = (n?: string) => Number((n ?? '').split('-').pop());
    expect(seqOf(out!.Results![1].EntryNumber)).toBe(seqOf(out!.Results![0].EntryNumber) + 1);
    const persisted = Number(await scalar(ctx.pool,
      `SELECT COUNT(*) FROM ${SCHEMA}.JournalEntry WHERE ID IN ('${out!.Results![0].JournalEntryID}','${out!.Results![1].JournalEntryID}')`));
    expect(persisted).toBe(2);
    const dims = Number(await scalar(ctx.pool,
      `SELECT COUNT(*) FROM ${SCHEMA}.JournalEntryLineDimension d JOIN ${SCHEMA}.JournalEntryLine l ON l.ID=d.JournalEntryLineID WHERE l.JournalEntryID='${out!.Results![1].JournalEntryID}'`));
    expect(dims).toBe(1);
  });

  it('L10 — SET op is ALL-OR-NOTHING: a write-time failure on draft 2 rolls back draft 1', async () => {
    const before = Number(await scalar(ctx.pool, `SELECT COUNT(*) FROM ${SCHEMA}.JournalEntry WHERE CompanyID='${ctx.company.id}'`));
    const out = await AccountingEngine.Instance.CreateJournalEntries({
      Drafts: [
        { // valid — would book on its own
          EffectiveDate: new Date().toISOString(), EntryType: 'OrderBooking', Description: `${ctx.runTag} L10 good`,
          Lines: [
            { GLAccountID: ctx.company.arGL, DebitAmount: 33 },
            { GLAccountID: ctx.company.revGL, CreditAmount: 33 },
          ],
        },
        { // passes the pure pipeline (accounts exist+active, balanced) but MIXES companies —
          // the single-company rule fails at WRITE time, after draft 1 already wrote.
          EffectiveDate: new Date().toISOString(), EntryType: 'OrderBooking', Description: `${ctx.runTag} L10 mixed`,
          Lines: [
            { GLAccountID: ctx.company.arGL, DebitAmount: 44 },
            { GLAccountID: ctx.companyB.revGL, CreditAmount: 44 },
          ],
        },
      ],
    }, ctx.user, provider);

    expect(out.Success).toBe(false);
    expect(out.Errors?.some(e => e.DraftIndex === 1)).toBe(true);
    // The rollback proof: draft 1's rows are GONE — nothing partial persisted.
    const after = Number(await scalar(ctx.pool, `SELECT COUNT(*) FROM ${SCHEMA}.JournalEntry WHERE CompanyID='${ctx.company.id}'`));
    expect(after).toBe(before);
  });

  it('L8 — GLAccount identity lock is IMMEDIATE + UNCONDITIONAL (Amith 2026-07-29): identity frozen from creation; cosmetic rename still saves', async () => {
    // Referenced account: identity change rejected (as before).
    const gl = await provider.GetEntityObject<GLAccountEntityServer>(GL_ENTITY, ctx.user);
    expect(await gl.Load(ctx.company.arGL)).toBe(true);
    gl.Code = '99999';
    expect(await gl.Save()).toBe(false);

    // THE DELTA: a brand-new account with ZERO references is just as locked — no JE-line gate.
    const fresh = await provider.GetEntityObject<GLAccountEntityServer>(GL_ENTITY, ctx.user);
    fresh.NewRecord();
    fresh.CompanyID = ctx.company.id;
    fresh.Code = '19999';
    fresh.Name = `${ctx.runTag} L8 fresh account`;
    fresh.AccountType = 'Asset';
    expect(await fresh.Save(), `fresh account save: ${fresh.LatestResult?.CompleteMessage}`).toBe(true);
    fresh.Code = '19998'; // never referenced by anything — still refused
    expect(await fresh.Save()).toBe(false);
    expect(fresh.LatestResult?.CompleteMessage ?? '').toMatch(/immutable from creation/);

    // Cosmetic fields stay editable on both.
    const gl2 = await provider.GetEntityObject<GLAccountEntityServer>(GL_ENTITY, ctx.user);
    expect(await gl2.Load(ctx.company.arGL)).toBe(true);
    gl2.Name = `${gl2.Name} (renamed by live harness)`;
    expect(await gl2.Save(), `cosmetic rename should save: ${gl2.LatestResult?.CompleteMessage}`).toBe(true);
  });

  // ─── One-transaction batch build (D10 rev. 2026-07-29) ─────────────────────

  it('L11 — one-transaction build: a task-raise failure rolls back the ENTIRE build (no batch, no summary, JEs untouched)', async () => {
    const fuel = await createJE(false, 55, 'L11 fuel');
    const batchesBefore = Number(await scalar(ctx.pool, `SELECT COUNT(*) FROM ${SCHEMA}.JournalEntryBatch WHERE CompanyID='${ctx.company.id}'`));
    const summariesBefore = Number(await scalar(ctx.pool, `SELECT COUNT(*) FROM ${SCHEMA}.JournalEntry WHERE CompanyID='${ctx.company.id}' AND EntryTypeID='${ctx.batchSummaryTypeId}'`));

    const failingGate: JournalEntryBatchApprovalGate = {
      async assertApproved() { /* n/a */ },
      async onBatchBuilt(): Promise<string | null> { throw new Error('L11 injected task-raise failure'); },
    };
    await expect(
      buildJournalEntryBatch(ctx.company.id, 'BusinessCentral', ctx.user.ID, ctx.user, provider, failingGate),
    ).rejects.toThrow('L11 injected task-raise failure');

    // Rollback proof — raw SQL underneath the entity layer: nothing was born, nothing was locked.
    const batchesAfter = Number(await scalar(ctx.pool, `SELECT COUNT(*) FROM ${SCHEMA}.JournalEntryBatch WHERE CompanyID='${ctx.company.id}'`));
    expect(batchesAfter).toBe(batchesBefore);
    const summariesAfter = Number(await scalar(ctx.pool, `SELECT COUNT(*) FROM ${SCHEMA}.JournalEntry WHERE CompanyID='${ctx.company.id}' AND EntryTypeID='${ctx.batchSummaryTypeId}'`));
    expect(summariesAfter).toBe(summariesBefore);
    const fuelRow = (await ctx.pool.request().query(
      `SELECT Status, JournalEntryBatchID FROM ${SCHEMA}.JournalEntry WHERE ID='${fuel.ID}'`)).recordset[0];
    expect(fuelRow.Status).toBe('Pending');
    expect(fuelRow.JournalEntryBatchID).toBeNull();
  });

  it('L12 — real-gate CFO precondition fails BEFORE any write (no CFO configured → no batch row is ever born)', async () => {
    // The fixture company's ACP has no ApprovalCFOUserID — the precondition must throw pre-write.
    const batchesBefore = Number(await scalar(ctx.pool, `SELECT COUNT(*) FROM ${SCHEMA}.JournalEntryBatch WHERE CompanyID='${ctx.company.id}'`));
    await expect(
      buildJournalEntryBatch(ctx.company.id, 'BusinessCentral', ctx.user.ID, ctx.user, provider, new TasksAppApprovalGate(provider)),
    ).rejects.toThrow(/No CFO configured/);
    const batchesAfter = Number(await scalar(ctx.pool, `SELECT COUNT(*) FROM ${SCHEMA}.JournalEntryBatch WHERE CompanyID='${ctx.company.id}'`));
    expect(batchesAfter).toBe(batchesBefore);
  });

  it('L13 — real gate: approval Task raised + ApprovalTaskID/RaisedAt stamped in the SAME build transaction', async () => {
    // Configure the CFO on the fixture company (the harness user doubles as the approver).
    const acp = await provider.GetEntityObject<mjBizAppsAccountingAccountingCompanyProfileEntity>(
      'MJ_BizApps_Accounting: Accounting Company Profiles', ctx.user);
    expect(await acp.Load(ctx.company.id)).toBe(true);
    acp.ApprovalCFOUserID = ctx.user.ID;
    expect(await acp.Save(), `CFO config save: ${acp.LatestResult?.CompleteMessage}`).toBe(true);

    const result = await buildJournalEntryBatch(
      ctx.company.id, 'BusinessCentral', ctx.user.ID, ctx.user, provider, new TasksAppApprovalGate(provider));
    ctx.createdBatchIds.push(result.batchId);
    try {
      expect(result.approvalTaskId).toBeTruthy();

      // The stamp is on the batch row (raw SQL), matching the raised Task, with RaisedAt set.
      const row = (await ctx.pool.request().query(
        `SELECT ApprovalTaskID, ApprovalTaskRaisedAt FROM ${SCHEMA}.JournalEntryBatch WHERE ID='${result.batchId}'`)).recordset[0];
      expect(String(row.ApprovalTaskID).toLowerCase()).toBe(String(result.approvalTaskId).toLowerCase());
      expect(row.ApprovalTaskRaisedAt).toBeTruthy();

      // The Task genuinely exists in the tasks schema (committed with the batch — one transaction).
      const taskCount = Number(await scalar(ctx.pool,
        `SELECT COUNT(*) FROM __mj_BizAppsTasks.Task WHERE ID='${result.approvalTaskId}'`));
      expect(taskCount).toBe(1);
    } finally {
      // Tasks-side rows are not company-rooted — clean them here (FK-aware order), best-effort.
      const tid = result.approvalTaskId;
      if (tid) {
        await ctx.pool.request().query(`DELETE FROM __mj_BizAppsTasks.TaskActivity WHERE TaskID='${tid}'`).catch(() => undefined);
        await ctx.pool.request().query(`DELETE FROM __mj_BizAppsTasks.TaskAssignment WHERE TaskID='${tid}'`).catch(() => undefined);
        await ctx.pool.request().query(`DELETE FROM __mj_BizAppsTasks.TaskLink WHERE TaskID='${tid}'`).catch(() => undefined);
        await ctx.pool.request().query(`DELETE FROM __mj_BizAppsTasks.TaskDecision WHERE TaskID='${tid}'`).catch(() => undefined);
        await ctx.pool.request().query(`DELETE FROM __mj_BizAppsTasks.Task WHERE ID='${tid}'`).catch(() => undefined);
      }
    }
  });

  // ─── S-C: reversal guards (P-3; the counterparty column was killed 2026-07-29, Amith) ──

  it('L14 — reversal guards: no double-reverse; a reversal cannot itself be reversed', async () => {
    // L4 already reversed firstJE — a second reversal must be refused.
    const je = await provider.GetEntityObject<JournalEntryEntityServer>(JE_ENTITY, ctx.user);
    expect(await je.Load(firstJE.ID)).toBe(true);
    expect(je.ReversedByJournalEntryID).toBeTruthy();
    await expect(je.GenerateReversal('L14 double-reverse attempt', ctx.user)).rejects.toThrow(/already been reversed/);

    // And the reversal entry itself (type Reversal) can never be reversed.
    const reversal = await provider.GetEntityObject<JournalEntryEntityServer>(JE_ENTITY, ctx.user);
    expect(await reversal.Load(je.ReversedByJournalEntryID as string)).toBe(true);
    await expect(reversal.GenerateReversal('L14 reverse-a-reversal attempt', ctx.user)).rejects.toThrow(/cannot itself be reversed/);
  });


  // ─── GLAccountLink tie guard + forCompanyID (BA-D32 rev. 2026-07-29) ────────

  it('L16 — link tie guard: same (record, role, company) + same StartedAt refused; DIFFERENT company shares the window; forCompanyID resolves per company', async () => {
    // Fixture: link the same polymorphic record + role to company A's AR account AND
    // company B's AR account, both Active with StartedAt = NULL. That is the supported
    // multi-company shape; only a SECOND company-A link on the same start is an ambiguous tie.
    const roleRow = (await ctx.pool.request().query(
      `SELECT TOP 1 ID FROM ${SCHEMA}.GLAccountRole ORDER BY Sequence`)).recordset[0];
    expect(roleRow?.ID).toBeTruthy();
    const linkEntityInfo = provider.EntityByName('MJ_BizApps_Accounting: GL Accounts');
    expect(linkEntityInfo).toBeTruthy();
    const entityId = linkEntityInfo?.ID ?? '';
    const recordId = `${ctx.runTag}-L16-record`;

    const makeLink = async (glAccountId: string): Promise<GLAccountLinkEntityServer> => {
      const link = await provider.GetEntityObject<GLAccountLinkEntityServer>('MJ_BizApps_Accounting: GL Account Links', ctx.user);
      link.NewRecord();
      link.GLAccountID = glAccountId;
      link.GLAccountRoleID = roleRow.ID;
      link.EntityID = entityId;
      link.RecordID = recordId;
      link.Status = 'Active';
      return link;
    };

    // Company A link saves.
    const linkA = await makeLink(ctx.company.arGL);
    expect(await linkA.Save(), `link A save: ${linkA.LatestResult?.CompleteMessage}`).toBe(true);

    // Company B link on the SAME record/role/window saves — different company, no tie.
    const linkB = await makeLink(ctx.companyB.arGL);
    expect(await linkB.Save(), `link B save: ${linkB.LatestResult?.CompleteMessage}`).toBe(true);

    // A SECOND company-A link on the same StartedAt is the ambiguous tie — refused, with guidance.
    const dupe = await makeLink(ctx.company.cashGL); // cash is also company A's book
    expect(await dupe.Save()).toBe(false);
    expect(dupe.LatestResult?.CompleteMessage ?? '').toMatch(/same StartedAt/);

    // forCompanyID disambiguates resolution per company over the SAME record + role.
    await AccountingEngineBase.Instance.ConfigEx({ forceRefresh: true, contextUser: ctx.user, provider });
    const eng = AccountingEngineBase.Instance;
    const forA = eng.ResolveLinkedAccount(entityId, recordId, roleRow.ID, new Date(), ctx.company.id);
    const forB = eng.ResolveLinkedAccount(entityId, recordId, roleRow.ID, new Date(), ctx.companyB.id);
    expect(forA?.Link?.GLAccountID?.toLowerCase()).toBe(ctx.company.arGL.toLowerCase());
    expect(forB?.Link?.GLAccountID?.toLowerCase()).toBe(ctx.companyB.arGL.toLowerCase());
    // Unscoped resolution still returns SOME active link (back-compat for single-company callers).
    expect(eng.ResolveLinkedAccount(entityId, recordId, roleRow.ID, new Date())).toBeTruthy();
  });

  // ─── Batch entity encapsulation (Marcelo review round, 2026-07-29) ──────────

  it('L17 — approval coherence guard: tampered control totals on a Pending batch refuse to approve', async () => {
    // Fresh JE → build → tamper TotalDebits by raw SQL (legal while Pending — exactly the hole
    // the guard closes) → approve must refuse with the footing message.
    const fuel = await createJE(false, 75, 'L17 fuel');
    void fuel;
    const result = await buildJournalEntryBatch(ctx.company.id, 'BusinessCentral', ctx.user.ID, ctx.user, provider, AutoApproveGate);
    ctx.createdBatchIds.push(result.batchId);
    await ctx.pool.request().query(`UPDATE ${SCHEMA}.JournalEntryBatch SET TotalDebits = TotalDebits + 999 WHERE ID='${result.batchId}'`);

    const batch = await provider.GetEntityObject<JournalEntryBatchEntityServer>(BATCH_ENTITY, ctx.user);
    expect(await batch.Load(result.batchId)).toBe(true);
    batch.Status = 'Approved';
    expect(await batch.Save()).toBe(false);
    expect(batch.LatestResult?.CompleteMessage ?? '').toMatch(/do not foot/);

    // Un-tamper → approval proceeds, and the auto-stamp fills the audit pair from context (L18 rolled in).
    await ctx.pool.request().query(`UPDATE ${SCHEMA}.JournalEntryBatch SET TotalDebits = TotalDebits - 999 WHERE ID='${result.batchId}'`);
    const batch2 = await provider.GetEntityObject<JournalEntryBatchEntityServer>(BATCH_ENTITY, ctx.user);
    expect(await batch2.Load(result.batchId)).toBe(true);
    batch2.Status = 'Approved'; // note: NOT setting ApprovedAt/ApprovedByUserID — the Save hook must
    expect(await batch2.Save(), `approve after un-tamper: ${batch2.LatestResult?.CompleteMessage}`).toBe(true);
    const row = (await ctx.pool.request().query(
      `SELECT ApprovedAt, ApprovedByUserID FROM ${SCHEMA}.JournalEntryBatch WHERE ID='${result.batchId}'`)).recordset[0];
    expect(row.ApprovedAt).toBeTruthy();
    expect(String(row.ApprovedByUserID).toLowerCase()).toBe(ctx.user.ID.toLowerCase());
  });

  it('L19 — owned collections: LoadMembers + LoadSummaryJournalEntry hydrate what the batch owns; entity Cancel() reverses the lock', async () => {
    const fuel = await createJE(true, 85, 'L19 fuel');
    const result = await buildJournalEntryBatch(ctx.company.id, 'BusinessCentral', ctx.user.ID, ctx.user, provider, AutoApproveGate);

    const batch = await provider.GetEntityObject<JournalEntryBatchEntityServer>(BATCH_ENTITY, ctx.user);
    expect(await batch.Load(result.batchId)).toBe(true);
    const members = await batch.LoadMembers();
    // Members = the fuel JE + the JournalEntryBatchSummary JE (it rides the same lock machinery).
    expect(members.length).toBe(2);
    expect(members.some(m => m.ID.toLowerCase() === fuel.ID.toLowerCase())).toBe(true);
    const summary = await batch.LoadSummaryJournalEntry();
    expect(summary?.ID?.toLowerCase()).toBe(result.summaryJournalEntryId.toLowerCase());

    // Entity-owned Cancel: one call reverses the preliminary lock, after authorizing itself (#214).
    expect(await batch.Cancel(ctx.user)).toBe(true);
    expect(rejectionChecks).toContain(result.batchId.toLowerCase());
    const fuelRow = (await ctx.pool.request().query(
      `SELECT Status, JournalEntryBatchID FROM ${SCHEMA}.JournalEntry WHERE ID='${fuel.ID}'`)).recordset[0];
    expect(fuelRow.Status).toBe('Pending');
    expect(fuelRow.JournalEntryBatchID).toBeNull();
    const summaryGone = Number(await scalar(ctx.pool, `SELECT COUNT(*) FROM ${SCHEMA}.JournalEntry WHERE ID='${result.summaryJournalEntryId}'`));
    expect(summaryGone).toBe(0);
    const batchRow = (await ctx.pool.request().query(
      `SELECT Status FROM ${SCHEMA}.JournalEntryBatch WHERE ID='${result.batchId}'`)).recordset[0];
    expect(batchRow.Status).toBe('Cancelled');
  });

  it('L20 — two concurrent retries of one Failed batch: one ERP call, the loser refused, both sends on record', async () => {
    await createJE(false, 60, 'L20');
    const built = await buildJournalEntryBatch(ctx.company.id, 'BusinessCentral', ctx.user.ID, ctx.user, provider, AutoApproveGate);
    ctx.createdBatchIds.push(built.batchId);
    await approveJournalEntryBatch(built.batchId, ctx.user.ID, ctx.user, provider);

    const rejection = `${ctx.runTag} L20 simulated ERP rejection`;
    const rejectingPoster: ErpPoster = async () => ({ success: false, error: rejection });
    const failed = await sendWith(built.batchId, { poster: rejectingPoster });
    expect(failed.Status).toBe('Failed');

    // Hold both retries at the gate until both have loaded the batch as Failed — the race the
    // issue describes, made deterministic instead of left to timing.
    let arrived = 0;
    let releaseBoth!: () => void;
    const bothLoaded = new Promise<void>((resolve) => { releaseBoth = resolve; });
    const barrierGate: JournalEntryBatchApprovalGate = {
      async assertApproved() { if (++arrived === 2) releaseBoth(); await bothLoaded; },
    };
    let erpCalls = 0;
    const countingPoster: ErpPoster = async (b) => { erpCalls++; return { success: true, externalJournalEntryBatchRef: `MOCK-${b.JournalEntryBatchNumber}` }; };
    const retry = () => sendWith(built.batchId, { gate: barrierGate, poster: countingPoster }, true);

    const outcomes = await Promise.allSettled([retry(), retry()]);

    expect(erpCalls).toBe(1);
    expect(outcomes.filter((o) => o.status === 'fulfilled')).toHaveLength(1);
    const losers = outcomes.filter((o): o is PromiseRejectedResult => o.status === 'rejected');
    expect(losers).toHaveLength(1);
    // Refused whether it landed while the winner was still Sent or after it posted.
    expect(losers[0].reason).toBeInstanceOf(JournalEntryBatchSendRefusedError);

    // The row: Posted, the second send, by this user, with the failure cleared.
    const row = (await ctx.pool.request().query(
      `SELECT Status, SendAttemptCount, SentByUserID, ErrorMessage FROM ${SCHEMA}.JournalEntryBatch WHERE ID='${built.batchId}'`)).recordset[0];
    expect(row.Status).toBe('Posted');
    expect(row.SendAttemptCount).toBe(2);
    expect(String(row.SentByUserID).toLowerCase()).toBe(ctx.user.ID.toLowerCase());
    expect(row.ErrorMessage).toBeNull();

    // __mj.RecordChange: the failure the success cleared, and one Sent snapshot per send.
    const changes = (await ctx.pool.request().query(
      `SELECT rc.FullRecordJSON, rc.UserID FROM __mj.RecordChange rc
       JOIN __mj.Entity e ON e.ID = rc.EntityID
       WHERE e.Name='${BATCH_ENTITY}' AND LOWER(rc.RecordID)=LOWER('ID|${built.batchId}')`)).recordset as Array<{ FullRecordJSON: string; UserID: string }>;
    const snapshots = changes.map((c) => JSON.parse(c.FullRecordJSON) as { Status: string; ErrorMessage: string | null; SendAttemptCount: number });
    expect(snapshots.some((s) => s.Status === 'Failed' && s.ErrorMessage === rejection)).toBe(true);
    expect(snapshots.filter((s) => s.Status === 'Sent').map((s) => s.SendAttemptCount).sort()).toEqual([1, 2]);
    expect(changes.every((c) => c.UserID.toLowerCase() === ctx.user.ID.toLowerCase())).toBe(true);
  });

  /** Build, approve and fail a first send: a Failed batch at SendAttemptCount 1, ready to retry. */
  async function failedBatch(tag: string): Promise<string> {
    await createJE(false, 30, tag);
    const built = await buildJournalEntryBatch(ctx.company.id, 'BusinessCentral', ctx.user.ID, ctx.user, provider, AutoApproveGate);
    ctx.createdBatchIds.push(built.batchId);
    await approveJournalEntryBatch(built.batchId, ctx.user.ID, ctx.user, provider);
    const rejectingPoster: ErpPoster = async () => ({ success: false, error: `${ctx.runTag} ${tag} first send rejected` });
    const failed = await sendWith(built.batchId, { poster: rejectingPoster });
    expect(failed.Status).toBe('Failed');
    return built.batchId;
  }

  const batchRow = async (id: string) => (await ctx.pool.request().query(
    `SELECT Status, SendAttemptCount, SentByUserID, SentAt, ErrorMessage FROM ${SCHEMA}.JournalEntryBatch WHERE ID='${id}'`)).recordset[0];

  it('L21 — the send-once trigger against raw SQL: refusals, the edges it allows, and a frozen stamp', async () => {
    await createJE(false, 45, 'L21');
    const built = await buildJournalEntryBatch(ctx.company.id, 'BusinessCentral', ctx.user.ID, ctx.user, provider, AutoApproveGate);
    ctx.createdBatchIds.push(built.batchId);
    await approveJournalEntryBatch(built.batchId, ctx.user.ID, ctx.user, provider);
    const id = built.batchId;
    const run = (set: string) => ctx.pool.request().query(`UPDATE ${SCHEMA}.JournalEntryBatch SET ${set} WHERE ID='${id}'`);
    const notTheNextCount = /advance SendAttemptCount by one/;
    const stillSent = /already Sent/;
    const frozenStamp = /change only when the batch is sent/;

    // Entering Sent must advance the count by exactly one.
    await expect(run(`Status='Sent', SentAt=SYSDATETIMEOFFSET()`)).rejects.toThrow(notTheNextCount);
    await run(`Status='Sent', SentAt=SYSDATETIMEOFFSET(), SendAttemptCount=1`);

    // Nothing keeps a batch Sent: a stamp that changes nothing is refused as surely as a new one.
    await expect(run(`ErrorMessage='L21 annotate'`)).rejects.toThrow(stillSent);
    await expect(run(`SentAt=DATEADD(second, 1, SentAt)`)).rejects.toThrow(stillSent);
    await expect(run(`SendAttemptCount=2`)).rejects.toThrow(stillSent);

    // Leaving Sent is allowed; a stale retry that reuses the count it already has is not.
    await run(`Status='Failed', ErrorMessage='L21 failed'`);
    await expect(run(`Status='Sent', SentAt=SYSDATETIMEOFFSET(), SendAttemptCount=1`)).rejects.toThrow(notTheNextCount);
    await run(`Status='Sent', SentAt=SYSDATETIMEOFFSET(), SendAttemptCount=2`);
    await run(`Status='Posted', PostedAt=SYSDATETIMEOFFSET(), ErrorMessage=NULL`);

    // A Posted batch cannot be sent again, and its stamp cannot be edited afterwards.
    await expect(run(`Status='Sent', SentAt=SYSDATETIMEOFFSET(), SendAttemptCount=3`)).rejects.toThrow(notTheNextCount);
    await expect(run(`SendAttemptCount=5`)).rejects.toThrow(frozenStamp);
    await expect(run(`SentByUserID='${ctx.user.ID}'`)).rejects.toThrow(frozenStamp);
    await expect(run(`SentAt=DATEADD(second, 1, SentAt)`)).rejects.toThrow(frozenStamp);
    await expect(run(`SentAt=NULL`)).rejects.toThrow(frozenStamp);

    // Precision only to the millisecond: a sub-ms difference is not an edit.
    await run(`SentAt=DATEADD(microsecond, 400, SentAt)`);
    const row = await batchRow(id);
    expect(row.Status).toBe('Posted');
    expect(row.SendAttemptCount).toBe(2);
  });

  /**
   * A retry that loaded the batch as Failed, held at the gate until the winning send has finished,
   * then released: the ordering where its UPDATE lands after the winner has already left Sent.
   */
  async function staleRetryAfterWinner(batchId: string, winnerPoster: ErpPoster) {
    let signalLoaded!: () => void;
    const loaded = new Promise<void>((resolve) => { signalLoaded = resolve; });
    let release!: () => void;
    const released = new Promise<void>((resolve) => { release = resolve; });
    const heldGate: JournalEntryBatchApprovalGate = { async assertApproved() { signalLoaded(); await released; } };
    let loserErpCalls = 0;
    const loserPoster: ErpPoster = async (b) => { loserErpCalls++; return { success: true, externalJournalEntryBatchRef: `MOCK-${b.JournalEntryBatchNumber}` }; };

    const loserOutcome = sendWith(batchId, { gate: heldGate, poster: loserPoster }, true)
      .then(() => null, (e: unknown) => e);
    await loaded;
    const winner = await sendWith(batchId, { poster: winnerPoster }, true);
    release();
    return { winner, loser: await loserOutcome, loserErpCalls: () => loserErpCalls };
  }

  it('L22a — a stale retry landing after the winner POSTED is refused, and the ERP is called once', async () => {
    const id = await failedBatch('L22a');
    let winnerErpCalls = 0;
    const winnerPoster: ErpPoster = async (b) => { winnerErpCalls++; return { success: true, externalJournalEntryBatchRef: `MOCK-${b.JournalEntryBatchNumber}` }; };

    const { winner, loser, loserErpCalls } = await staleRetryAfterWinner(id, winnerPoster);

    expect(winner.Status).toBe('Posted');
    expect(loser).toBeInstanceOf(JournalEntryBatchSendRefusedError);
    expect((loser as JournalEntryBatchSendRefusedError).Status).toBe('Posted');
    expect(winnerErpCalls + loserErpCalls()).toBe(1);
    const row = await batchRow(id);
    expect(row.Status).toBe('Posted');
    expect(row.SendAttemptCount).toBe(2);
  });

  it('L22b — a stale retry landing after the winner FAILED AGAIN is refused, and keeps the winner\'s record', async () => {
    const id = await failedBatch('L22b');
    const winnerFailure = `${ctx.runTag} L22b winner rejected`;
    const winnerPoster: ErpPoster = async () => ({ success: false, error: winnerFailure });

    const { winner, loser, loserErpCalls } = await staleRetryAfterWinner(id, winnerPoster);

    expect(winner.Status).toBe('Failed');
    expect(loser).toBeInstanceOf(JournalEntryBatchSendRefusedError);
    expect((loser as JournalEntryBatchSendRefusedError).Status).toBe('Failed');
    expect(loserErpCalls()).toBe(0);
    const row = await batchRow(id);
    expect(row.Status).toBe('Failed');
    expect(row.SendAttemptCount).toBe(2);
    expect(row.ErrorMessage).toBe(winnerFailure);
  });

  it('L23 — a dimension tag on a locked line cannot be inserted, changed or deleted (#216)', async () => {
    const member = await createJE(true, 30, 'L23');
    const built = await buildJournalEntryBatch(ctx.company.id, 'BusinessCentral', ctx.user.ID, ctx.user, provider, AutoApproveGate);
    ctx.createdBatchIds.push(built.batchId);
    const locked = /JournalEntryLineDimension on a locked JournalEntry/;
    const tagsOf = (jeId: string) =>
      `FROM ${SCHEMA}.JournalEntryLineDimension d JOIN ${SCHEMA}.JournalEntryLine l ON l.ID=d.JournalEntryLineID WHERE l.JournalEntryID='${jeId}'`;
    const before = Number(await scalar(ctx.pool, `SELECT COUNT(*) ${tagsOf(built.summaryJournalEntryId)}`));
    expect(before).toBeGreaterThan(0);

    for (const jeId of [member.ID, built.summaryJournalEntryId]) {
      await expect(ctx.pool.request().query(`UPDATE d SET DimensionValueID=DimensionValueID ${tagsOf(jeId)}`)).rejects.toThrow(locked);
      await expect(ctx.pool.request().query(`DELETE d ${tagsOf(jeId)}`)).rejects.toThrow(locked);
    }
    const untaggedLine = await scalar(ctx.pool,
      `SELECT TOP 1 l.ID FROM ${SCHEMA}.JournalEntryLine l WHERE l.JournalEntryID='${built.summaryJournalEntryId}' ` +
      `AND NOT EXISTS (SELECT 1 FROM ${SCHEMA}.JournalEntryLineDimension d WHERE d.JournalEntryLineID=l.ID)`);
    expect(untaggedLine).toBeTruthy();
    await expect(ctx.pool.request().query(
      `INSERT INTO ${SCHEMA}.JournalEntryLineDimension (JournalEntryLineID, DimensionID, DimensionValueID) VALUES ('${untaggedLine}', '${ctx.dimId}', '${ctx.dimValSales}')`,
    )).rejects.toThrow(locked);

    expect(Number(await scalar(ctx.pool, `SELECT COUNT(*) ${tagsOf(built.summaryJournalEntryId)}`))).toBe(before);
  });
});
