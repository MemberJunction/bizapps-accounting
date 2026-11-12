/**
 * archive-gate.live.test.ts — archiving a journal entry batch through the REAL TasksAppApprovalGate,
 * against the live instance DB (golive #214, #325, #448).
 *
 * The unit suites cover Archive() against stubs. This file is the live counterpart of
 * pending-cancel-gate.live.test.ts: it registers nothing over the dispatch services, so the archive
 * resolves the shipped TasksAppApprovalGate, and the DB's constraints and triggers see every write.
 *
 *   A1  a builder without the Finance role is refused archiving a Pending batch; nothing changes.
 *   A2  the CFO with a blank reason is refused, after authorization; nothing changes.
 *   A3  the CFO archives a Pending batch: Archived with the audit triple, the entry stays Batched in
 *       it, the summary stays, the Task is commented as the CFO's Person and set Cancelled.
 *   A4  a Finance-role user who is neither CFO nor builder archives a Pending batch: the same outcome.
 *   A5  an Archived batch is terminal: Archive and Cancel refuse it, and raw SQL cannot edit, delete
 *       or release it, nor unlock its entry.
 *   A6  past approval only the CFO or the approver may archive: the builder is refused; the CFO
 *       archives, and the Task keeps its status and gets an "archived after approval" comment.
 *
 * Four run-tagged users stand in for the CFO, the builder, a Finance-role operator and nobody. Each is
 * given the harness owner's roles (entity permissions come from roles) and a linked Person; the
 * operator also gets the Finance role, which holds the batch-operate Authorization.
 *
 * Run from the app root:  npx vitest run --config test-harnesses/server/vitest.config.ts archive-gate
 * Requires: the live instance DB with bizapps-tasks metadata pushed (the approval Task Type) and the
 * Finance role holding MJ.BizApps.Accounting.JournalEntryBatches.Operate.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Metadata, IMetadataProvider, UserInfo } from '@memberjunction/core';
import { UserCache } from '@memberjunction/sqlserver-dataprovider';
import {
  JournalEntryEntityServer,
  JournalEntryBatchEntityServer,
  TasksAppApprovalGate,
  buildJournalEntryBatch,
  approveJournalEntryBatch,
  cancelJournalEntryBatch,
} from '@mj-biz-apps/accounting-core-entities-server';
import type { mjBizAppsAccountingAccountingCompanyProfileEntity } from '@mj-biz-apps/accounting-entities';
import { AccountingEngineBase } from '@mj-biz-apps/accounting-engine-base';
import { bootstrapLive, teardownLive, scalar, SCHEMA, type LiveCtx } from './live-bootstrap.js';

const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';
const BATCH_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Batches';
const ACP_ENTITY = 'MJ_BizApps_Accounting: Accounting Company Profiles';
const TASKS = '__mj_BizAppsTasks';
const COMMON = '__mj_BizAppsCommon';
const REASON = 'Imported history that must never post';

let ctx: LiveCtx;
let provider: IMetadataProvider;

interface HarnessUser { info: UserInfo; personId: string }
let cfo: HarnessUser;
let builder: HarnessUser;
let operator: HarnessUser;

async function sqlExec(q: string): Promise<void> {
  await ctx.pool.request().query(q);
}

/** Insert a user with the owner's roles (plus `extraRole`) and a linked Person. */
async function insertUser(label: string, extraRole?: string): Promise<{ userId: string; personId: string }> {
  const userId = randomUUID();
  const personId = randomUUID();
  const email = `${ctx.runTag.toLowerCase()}-${label}@example.invalid`;
  await sqlExec(
    `INSERT INTO __mj.[User] (ID, Name, FirstName, LastName, Email, Type, IsActive, LinkedRecordType) ` +
    `VALUES ('${userId}', '${ctx.runTag} ${label}', '${label}', '${ctx.runTag}', '${email}', 'User', 1, 'None')`);
  await sqlExec(
    `INSERT INTO __mj.UserRole (ID, UserID, RoleID) SELECT NEWID(), '${userId}', RoleID FROM __mj.UserRole WHERE UserID='${ctx.user.ID}'`);
  if (extraRole) {
    await sqlExec(
      `INSERT INTO __mj.UserRole (ID, UserID, RoleID) SELECT NEWID(), '${userId}', r.ID FROM __mj.[Role] r ` +
      `WHERE r.Name='${extraRole}' AND NOT EXISTS (SELECT 1 FROM __mj.UserRole x WHERE x.UserID='${userId}' AND x.RoleID=r.ID)`);
  }
  await sqlExec(
    `INSERT INTO ${COMMON}.Person (ID, FirstName, LastName, LinkedUserID) VALUES ('${personId}', '${label}', '${ctx.runTag}', '${userId}')`);
  return { userId, personId };
}

async function createUsers(): Promise<void> {
  const rows = {
    cfo: await insertUser('cfo'),
    builder: await insertUser('builder'),
    operator: await insertUser('operator', 'Finance'),
  };
  await UserCache.Instance.Refresh(ctx.sqlProvider);
  const find = (id: string): UserInfo => {
    const info = UserCache.Users.find(u => u.ID.toLowerCase() === id.toLowerCase());
    if (!info) throw new Error(`harness user ${id} is not in UserCache after refresh`);
    return info;
  };
  cfo = { info: find(rows.cfo.userId), personId: rows.cfo.personId };
  builder = { info: find(rows.builder.userId), personId: rows.builder.personId };
  operator = { info: find(rows.operator.userId), personId: rows.operator.personId };
}

async function setCompanyCFO(userId: string): Promise<void> {
  const acp = await provider.GetEntityObject<mjBizAppsAccountingAccountingCompanyProfileEntity>(ACP_ENTITY, ctx.user);
  expect(await acp.Load(ctx.company.id)).toBe(true);
  acp.ApprovalCFOUserID = userId;
  expect(await acp.Save(), `CFO config save: ${acp.LatestResult?.CompleteMessage}`).toBe(true);
}

async function createEntry(amount: number, label: string): Promise<string> {
  const je = await provider.GetEntityObject<JournalEntryEntityServer>(JE_ENTITY, ctx.user);
  je.NewRecord();
  je.CompanyID = ctx.company.id;
  je.EffectiveDate = new Date();
  je.EntryTypeID = ctx.entryTypes.get('Manual')!;
  je.Status = 'Pending';
  je.Description = `${ctx.runTag} ${label}`;
  const debit = await je.CreateLine(ctx.user);
  debit.GLAccountID = ctx.company.arGL;
  debit.DebitAmount = amount;
  const credit = await je.CreateLine(ctx.user);
  credit.GLAccountID = ctx.company.revGL;
  credit.CreditAmount = amount;
  expect(await je.Save(), `JE save failed: ${je.LatestResult?.CompleteMessage}`).toBe(true);
  ctx.createdJEIds.push(je.ID);
  return je.ID;
}

interface BuiltBatch { batchId: string; taskId: string; summaryId: string; entryId: string }

async function buildPendingBatch(label: string): Promise<BuiltBatch> {
  const entryId = await createEntry(125, label);
  const result = await buildJournalEntryBatch(
    ctx.company.id, 'BusinessCentral', builder.info.ID, builder.info, provider, new TasksAppApprovalGate(provider));
  ctx.createdBatchIds.push(result.batchId);
  expect(result.approvalTaskId, 'the real gate raises an approval Task on build').toBeTruthy();
  return { batchId: result.batchId, taskId: String(result.approvalTaskId), summaryId: result.summaryJournalEntryId, entryId };
}

/** Archive the batch as `user`, through the entity verb the Accounting.ArchiveJournalEntryBatch operation calls. */
async function archive(batchId: string, user: UserInfo, reason: string): Promise<void> {
  const batch = await provider.GetEntityObject<JournalEntryBatchEntityServer>(BATCH_ENTITY, user);
  expect(await batch.Load(batchId)).toBe(true);
  await batch.Archive(reason, user);
}

interface BatchRow {
  Status: string; ArchiveReason: string | null; ArchivedByUserID: string | null; ArchivedAt: Date | null;
  SummaryJournalEntryID: string | null;
}

async function batchRow(batchId: string): Promise<BatchRow> {
  return (await ctx.pool.request().query(
    `SELECT Status, ArchiveReason, ArchivedByUserID, ArchivedAt, SummaryJournalEntryID FROM ${SCHEMA}.JournalEntryBatch WHERE ID='${batchId}'`,
  )).recordset[0] as BatchRow;
}

async function entryRow(entryId: string): Promise<{ Status: string; JournalEntryBatchID: string | null }> {
  return (await ctx.pool.request().query(
    `SELECT Status, JournalEntryBatchID FROM ${SCHEMA}.JournalEntry WHERE ID='${entryId}'`)).recordset[0];
}

async function taskStatus(taskId: string): Promise<string> {
  return String(await scalar(ctx.pool, `SELECT Status FROM ${TASKS}.Task WHERE ID='${taskId}'`));
}

async function taskComments(taskId: string): Promise<Array<{ PersonID: string; Content: string }>> {
  return (await ctx.pool.request().query(
    `SELECT PersonID, Content FROM ${TASKS}.TaskComment WHERE TaskID='${taskId}'`)).recordset;
}

async function expectUntouched(b: BuiltBatch, statusBefore: string, taskStatusBefore: string): Promise<void> {
  const row = await batchRow(b.batchId);
  expect(row.Status).toBe(statusBefore);
  expect(row.ArchivedByUserID).toBeNull();
  expect(row.ArchiveReason).toBeNull();
  expect((await entryRow(b.entryId)).Status).toBe('Batched');
  expect(await taskStatus(b.taskId)).toBe(taskStatusBefore);
  expect(await taskComments(b.taskId)).toHaveLength(0);
}

/** The archive landed, and unlike a cancel left the entry locked in the batch and the summary in place. */
async function expectArchivedBy(b: BuiltBatch, by: HarnessUser): Promise<void> {
  const row = await batchRow(b.batchId);
  expect(row.Status).toBe('Archived');
  expect(row.ArchiveReason).toBe(REASON);
  expect(row.ArchivedByUserID?.toLowerCase()).toBe(by.info.ID.toLowerCase());
  expect(row.ArchivedAt).toBeTruthy();
  expect(row.SummaryJournalEntryID?.toLowerCase()).toBe(b.summaryId.toLowerCase());
  const entry = await entryRow(b.entryId);
  expect(entry.Status).toBe('Batched');
  expect(entry.JournalEntryBatchID?.toLowerCase()).toBe(b.batchId.toLowerCase());
  expect(Number(await scalar(ctx.pool, `SELECT COUNT(*) FROM ${SCHEMA}.JournalEntry WHERE ID='${b.summaryId}'`))).toBe(1);
}

async function expectPendingArchiveRecorded(b: BuiltBatch, by: HarnessUser): Promise<void> {
  expect(await taskStatus(b.taskId)).toBe('Cancelled');
  const comments = await taskComments(b.taskId);
  expect(comments).toHaveLength(1);
  expect(comments[0].PersonID.toLowerCase()).toBe(by.personId.toLowerCase());
  expect(comments[0].Content).toContain('was archived before approval');
  expect(comments[0].Content).toContain(`Reason: ${REASON}`);
}

async function removeUsers(): Promise<void> {
  const warn = (e: unknown) => console.warn(`teardown warn: ${String(e).split('\n')[0]}`);
  for (const u of [cfo, builder, operator].filter((x): x is HarnessUser => !!x)) {
    await sqlExec(`DELETE FROM ${COMMON}.Person WHERE ID='${u.personId}'`).catch(warn);
    await sqlExec(`DELETE FROM __mj.RecordChange WHERE UserID='${u.info.ID}'`).catch(warn);
    await sqlExec(`DELETE FROM __mj.UserRole WHERE UserID='${u.info.ID}'`).catch(warn);
    await sqlExec(`DELETE FROM __mj.[User] WHERE ID='${u.info.ID}'`).catch(warn);
  }
}

beforeAll(async () => {
  ctx = await bootstrapLive();
  provider = Metadata.Provider as IMetadataProvider;
  if (!provider) throw new Error('bootstrap did not establish a provider');
  await AccountingEngineBase.Instance.ConfigEx({ forceRefresh: true, contextUser: ctx.user, provider });
  await createUsers();
  await setCompanyCFO(cfo.info.ID);
});

afterAll(async () => {
  if (!ctx) return;
  await teardownLive(ctx, removeUsers);
});

describe('archiving a batch through the real TasksAppApprovalGate (#214, #325, #448)', () => {
  let archived: BuiltBatch;

  it('A1 — a builder without the Finance role is refused archiving a Pending batch', async () => {
    const b = await buildPendingBatch('A1');
    const before = await taskStatus(b.taskId);
    await expect(archive(b.batchId, builder.info, REASON))
      .rejects.toThrow(/may archive it before approval; its builder may cancel it instead/);
    await expectUntouched(b, 'Pending', before);
    await cancelJournalEntryBatch(b.batchId, builder.info, provider, { reason: 'A1 cleanup' });
  });

  it('A2 — the CFO with a blank reason is refused and nothing changes', async () => {
    const b = await buildPendingBatch('A2');
    const before = await taskStatus(b.taskId);
    await expect(archive(b.batchId, cfo.info, '   ')).rejects.toThrow(/a reason is required/);
    await expectUntouched(b, 'Pending', before);
    await cancelJournalEntryBatch(b.batchId, cfo.info, provider, { reason: 'A2 cleanup' });
  });

  it('A3 — the CFO archives a Pending batch: entry stays locked, Task commented and Cancelled', async () => {
    const b = await buildPendingBatch('A3');
    await archive(b.batchId, cfo.info, REASON);
    await expectArchivedBy(b, cfo);
    await expectPendingArchiveRecorded(b, cfo);
    archived = b;
  });

  it('A4 — a Finance-role user, not CFO nor builder, archives a Pending batch', async () => {
    const b = await buildPendingBatch('A4');
    await archive(b.batchId, operator.info, REASON);
    await expectArchivedBy(b, operator);
    await expectPendingArchiveRecorded(b, operator);
  });

  it('A5 — an Archived batch is terminal: the verbs refuse it and raw SQL cannot change it', async () => {
    const b = archived;
    expect(b, 'A3 must have archived a batch').toBeTruthy();
    await expect(archive(b.batchId, cfo.info, REASON)).rejects.toThrow(/is Archived, and only a .* batch can be archived/);
    await expect(cancelJournalEntryBatch(b.batchId, cfo.info, provider, { reason: 'undo' })).rejects.toThrow();
    await expect(sqlExec(`UPDATE ${SCHEMA}.JournalEntryBatch SET Status='Pending', ArchiveReason=NULL, ArchivedAt=NULL, ArchivedByUserID=NULL WHERE ID='${b.batchId}'`))
      .rejects.toThrow();
    await expect(sqlExec(`DELETE FROM ${SCHEMA}.JournalEntryBatch WHERE ID='${b.batchId}'`))
      .rejects.toThrow(/cannot be deleted|conflicted with the REFERENCE constraint/);
    await expect(sqlExec(`UPDATE ${SCHEMA}.JournalEntry SET Status='Pending', JournalEntryBatchID=NULL WHERE ID='${b.entryId}'`))
      .rejects.toThrow();
    await expectArchivedBy(b, cfo);
  });

  it('A5b — the archive audit cannot be rewritten through the entity', async () => {
    const batch = await provider.GetEntityObject<JournalEntryBatchEntityServer>(BATCH_ENTITY, cfo.info);
    expect(await batch.Load(archived.batchId)).toBe(true);
    batch.ArchiveReason = 'rewritten';
    expect(await batch.Save()).toBe(false);
    await expectArchivedBy(archived, cfo);
  });

  it('A5c — the archive audit cannot be rewritten by raw SQL once Archived (50032)', async () => {
    const b = archived;
    const attempts = [
      `SET ArchiveReason='rewritten'`,
      `SET ArchivedByUserID='${builder.info.ID}'`,
      `SET ArchivedAt=DATEADD(day, -30, ArchivedAt)`,
    ];
    const accepted: string[] = [];
    for (const set of attempts) {
      try {
        await sqlExec(`UPDATE ${SCHEMA}.JournalEntryBatch ${set} WHERE ID='${b.batchId}'`);
        accepted.push(set);
      } catch { /* refused, as it should be */ }
    }
    expect(accepted, 'raw updates the trigger accepted on an Archived batch').toEqual([]);
  });

  it('A6 — past approval the builder is refused; the CFO archives and the Task keeps its decision', async () => {
    const b = await buildPendingBatch('A6');
    await approveJournalEntryBatch(b.batchId, cfo.info.ID, cfo.info, provider);
    expect((await batchRow(b.batchId)).Status).toBe('Approved');
    const before = await taskStatus(b.taskId);
    await expect(archive(b.batchId, builder.info, REASON))
      .rejects.toThrow(/may archive it after approval/);
    await expectUntouched(b, 'Approved', before);
    await archive(b.batchId, cfo.info, REASON);
    await expectArchivedBy(b, cfo);
    expect(await taskStatus(b.taskId)).toBe(before);
    const comments = await taskComments(b.taskId);
    expect(comments).toHaveLength(1);
    expect(comments[0].PersonID.toLowerCase()).toBe(cfo.personId.toLowerCase());
    expect(comments[0].Content).toContain('was archived after approval (it was Approved)');
  });
});
