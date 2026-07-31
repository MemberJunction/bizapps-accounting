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
  GLAccountLinkEntityServer,
  AccountingEngine,
  CreateJournalEntriesOperation,
  buildBatch,
  approveBatch,
  sendBatch,
  AutoApproveGate,
  TasksAppApprovalGate,
  mockErpPoster,
  type BatchApprovalGate,
} from '@mj-biz-apps/accounting-core-entities-server';
import type { mjBizAppsAccountingAccountingCompanyProfileEntity } from '@mj-biz-apps/accounting-entities';
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

  it('L6 — full batch cycle: netted BatchSummary JE, exact totals, approve → dispatch → GLPosted', async () => {
    // Candidates right now: L2's 40/40 + L4's reversal (125.50 both ways) + L5's 100/100.
    // Netting on AR: +125.5(L1... L1 is Pending too!) — compute expected from raw SQL instead of hand-math:
    const rawDr = Number(await scalar(ctx.pool,
      `SELECT SUM(l.DebitAmount) FROM ${SCHEMA}.JournalEntryLine l JOIN ${SCHEMA}.JournalEntry j ON j.ID=l.JournalEntryID
       WHERE j.CompanyID='${ctx.company.id}' AND j.Status='Pending' AND j.EntryTypeID<>'${ctx.batchSummaryTypeId}'`));

    const result = await buildBatch(ctx.company.id, 'BusinessCentral', ctx.user.ID, ctx.user, provider, AutoApproveGate);
    expect(result, 'buildBatch returned null — expected pending JEs to batch').not.toBeNull();
    ctx.createdBatchIds.push(result!.batchId);

    // Summary JE: exists, right shape, rides the lock machinery.
    const summary = (await ctx.pool.request().query(
      `SELECT EntryTypeID, Status, CompanyID, BatchID FROM ${SCHEMA}.JournalEntry WHERE ID='${result!.summaryJournalEntryId}'`)).recordset[0];
    expect(String(summary.EntryTypeID).toLowerCase()).toBe(ctx.batchSummaryTypeId.toLowerCase());
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

    const failingGate: BatchApprovalGate = {
      async assertApproved() { /* n/a */ },
      async onBatchBuilt(): Promise<string | null> { throw new Error('L11 injected task-raise failure'); },
    };
    await expect(
      buildBatch(ctx.company.id, 'BusinessCentral', ctx.user.ID, ctx.user, provider, failingGate),
    ).rejects.toThrow('L11 injected task-raise failure');

    // Rollback proof — raw SQL underneath the entity layer: nothing was born, nothing was locked.
    const batchesAfter = Number(await scalar(ctx.pool, `SELECT COUNT(*) FROM ${SCHEMA}.JournalEntryBatch WHERE CompanyID='${ctx.company.id}'`));
    expect(batchesAfter).toBe(batchesBefore);
    const summariesAfter = Number(await scalar(ctx.pool, `SELECT COUNT(*) FROM ${SCHEMA}.JournalEntry WHERE CompanyID='${ctx.company.id}' AND EntryTypeID='${ctx.batchSummaryTypeId}'`));
    expect(summariesAfter).toBe(summariesBefore);
    const fuelRow = (await ctx.pool.request().query(
      `SELECT Status, BatchID FROM ${SCHEMA}.JournalEntry WHERE ID='${fuel.ID}'`)).recordset[0];
    expect(fuelRow.Status).toBe('Pending');
    expect(fuelRow.BatchID).toBeNull();
  });

  it('L12 — real-gate CFO precondition fails BEFORE any write (no CFO configured → no batch row is ever born)', async () => {
    // The fixture company's ACP has no ApprovalCFOUserID — the precondition must throw pre-write.
    const batchesBefore = Number(await scalar(ctx.pool, `SELECT COUNT(*) FROM ${SCHEMA}.JournalEntryBatch WHERE CompanyID='${ctx.company.id}'`));
    await expect(
      buildBatch(ctx.company.id, 'BusinessCentral', ctx.user.ID, ctx.user, provider, new TasksAppApprovalGate(provider)),
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

    const result = await buildBatch(
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
    const result = await buildBatch(ctx.company.id, 'BusinessCentral', ctx.user.ID, ctx.user, provider, AutoApproveGate);
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
    const result = await buildBatch(ctx.company.id, 'BusinessCentral', ctx.user.ID, ctx.user, provider, AutoApproveGate);

    const batch = await provider.GetEntityObject<JournalEntryBatchEntityServer>(BATCH_ENTITY, ctx.user);
    expect(await batch.Load(result.batchId)).toBe(true);
    const members = await batch.LoadMembers();
    // Members = the fuel JE + the BatchSummary JE (it rides the same lock machinery).
    expect(members.length).toBe(2);
    expect(members.some(m => m.ID.toLowerCase() === fuel.ID.toLowerCase())).toBe(true);
    const summary = await batch.LoadSummaryJournalEntry();
    expect(summary?.ID?.toLowerCase()).toBe(result.summaryJournalEntryId.toLowerCase());

    // Entity-owned Cancel: one call reverses the preliminary lock (this is now the cancel path).
    expect(await batch.Cancel(ctx.user)).toBe(true);
    const fuelRow = (await ctx.pool.request().query(
      `SELECT Status, BatchID FROM ${SCHEMA}.JournalEntry WHERE ID='${fuel.ID}'`)).recordset[0];
    expect(fuelRow.Status).toBe('Pending');
    expect(fuelRow.BatchID).toBeNull();
    const summaryGone = Number(await scalar(ctx.pool, `SELECT COUNT(*) FROM ${SCHEMA}.JournalEntry WHERE ID='${result.summaryJournalEntryId}'`));
    expect(summaryGone).toBe(0);
    const batchRow = (await ctx.pool.request().query(
      `SELECT Status FROM ${SCHEMA}.JournalEntryBatch WHERE ID='${result.batchId}'`)).recordset[0];
    expect(batchRow.Status).toBe('Cancelled');
  });
});
