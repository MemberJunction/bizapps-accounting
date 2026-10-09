/**
 * pending-cancel-gate.live.test.ts — cancelling a Pending batch nobody rejected, through the REAL
 * TasksAppApprovalGate, against the live instance DB (#305; the rule is golive #302).
 *
 * phase2-encapsulation.live.test.ts cancels through a stub gate that reads every Pending batch as
 * rejected, so it never reaches assertMayCancelPending or the Pending branch of recordCancellation.
 * This file registers nothing over the dispatch services: the cancel resolves the shipped
 * JournalEntryBatchDispatchServices, whose cancel gate is TasksAppApprovalGate.
 *
 *   C1  another user is refused, and the batch, its entries and its Task are untouched.
 *   C2  the CFO with no reason is refused, after authorization, with nothing written.
 *   C3  the CFO cancels with a reason: batch Cancelled with the audit triple, the entry back to
 *       Pending, the summary gone, the Task commented as the CFO's Person and set Cancelled.
 *   C4  the builder (not the CFO) cancels with a reason: the same outcome, commented as the builder.
 *
 * Three run-tagged users stand in for the CFO, the builder and a third user. Each is given the
 * harness owner's roles (entity permissions come from roles) and a linked Person (the Task comment
 * is written as the canceller's Person). Everything is removed in afterAll.
 *
 * Run from the app root:  npx vitest run --config test-harnesses/server/vitest.config.ts
 * Requires: the live instance DB with bizapps-tasks metadata pushed (the approval Task Type).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Metadata, IMetadataProvider, UserInfo } from '@memberjunction/core';
import { UserCache } from '@memberjunction/sqlserver-dataprovider';
import {
  JournalEntryEntityServer,
  TasksAppApprovalGate,
  buildJournalEntryBatch,
  cancelJournalEntryBatch,
} from '@mj-biz-apps/accounting-core-entities-server';
import type { mjBizAppsAccountingAccountingCompanyProfileEntity } from '@mj-biz-apps/accounting-entities';
import { AccountingEngineBase } from '@mj-biz-apps/accounting-engine-base';
import { bootstrapLive, teardownLive, scalar, SCHEMA, type LiveCtx } from './live-bootstrap.js';

const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';
const ACP_ENTITY = 'MJ_BizApps_Accounting: Accounting Company Profiles';
const TASKS = '__mj_BizAppsTasks';
const COMMON = '__mj_BizAppsCommon';
const REASON = 'Built with the wrong cutoff';

let ctx: LiveCtx;
let provider: IMetadataProvider;

/** A run-tagged user with the owner's roles and a linked Person. */
interface HarnessUser { info: UserInfo; personId: string }
let cfo: HarnessUser;
let builder: HarnessUser;
let other: HarnessUser;

async function sqlExec(q: string): Promise<void> {
  await ctx.pool.request().query(q);
}

/** Insert a user with the owner's roles and a linked Person; returns its id and the Person's. */
async function insertUser(label: string): Promise<{ userId: string; personId: string }> {
  const userId = randomUUID();
  const personId = randomUUID();
  const email = `${ctx.runTag.toLowerCase()}-${label}@example.invalid`;
  await sqlExec(
    `INSERT INTO __mj.[User] (ID, Name, FirstName, LastName, Email, Type, IsActive, LinkedRecordType) ` +
    `VALUES ('${userId}', '${ctx.runTag} ${label}', '${label}', '${ctx.runTag}', '${email}', 'User', 1, 'None')`);
  await sqlExec(
    `INSERT INTO __mj.UserRole (ID, UserID, RoleID) SELECT NEWID(), '${userId}', RoleID FROM __mj.UserRole WHERE UserID='${ctx.user.ID}'`);
  await sqlExec(
    `INSERT INTO ${COMMON}.Person (ID, FirstName, LastName, LinkedUserID) VALUES ('${personId}', '${label}', '${ctx.runTag}', '${userId}')`);
  return { userId, personId };
}

/** Insert the three users, refresh the cache once, and pick up their UserInfo. */
async function createUsers(): Promise<void> {
  const rows = { cfo: await insertUser('cfo'), builder: await insertUser('builder'), other: await insertUser('other') };
  await UserCache.Instance.Refresh(ctx.sqlProvider);
  const find = (id: string): UserInfo => {
    const info = UserCache.Users.find(u => u.ID.toLowerCase() === id.toLowerCase());
    if (!info) throw new Error(`harness user ${id} is not in UserCache after refresh`);
    return info;
  };
  cfo = { info: find(rows.cfo.userId), personId: rows.cfo.personId };
  builder = { info: find(rows.builder.userId), personId: rows.builder.personId };
  other = { info: find(rows.other.userId), personId: rows.other.personId };
}

async function setCompanyCFO(userId: string): Promise<void> {
  const acp = await provider.GetEntityObject<mjBizAppsAccountingAccountingCompanyProfileEntity>(ACP_ENTITY, ctx.user);
  expect(await acp.Load(ctx.company.id)).toBe(true);
  acp.ApprovalCFOUserID = userId;
  expect(await acp.Save(), `CFO config save: ${acp.LatestResult?.CompleteMessage}`).toBe(true);
}

/** One balanced Pending entry on the fixture company, saved as the harness owner. */
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

/** A Pending batch built by `builder` through the real gate, so it carries a stamped approval Task. */
async function buildPendingBatch(label: string): Promise<BuiltBatch> {
  const entryId = await createEntry(125, label);
  const result = await buildJournalEntryBatch(
    ctx.company.id, 'BusinessCentral', builder.info.ID, builder.info, provider, new TasksAppApprovalGate(provider));
  ctx.createdBatchIds.push(result.batchId);
  expect(result.approvalTaskId, 'the real gate raises an approval Task on build').toBeTruthy();
  return { batchId: result.batchId, taskId: String(result.approvalTaskId), summaryId: result.summaryJournalEntryId, entryId };
}

interface BatchRow { Status: string; CancelReason: string | null; CancelledByUserID: string | null; CancelledAt: Date | null; SummaryJournalEntryID: string | null }

async function batchRow(batchId: string): Promise<BatchRow> {
  return (await ctx.pool.request().query(
    `SELECT Status, CancelReason, CancelledByUserID, CancelledAt, SummaryJournalEntryID FROM ${SCHEMA}.JournalEntryBatch WHERE ID='${batchId}'`,
  )).recordset[0] as BatchRow;
}

async function entryStatus(entryId: string): Promise<{ Status: string; JournalEntryBatchID: string | null }> {
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

/** Nothing about the batch moved: still Pending, entry still in it, Task open with no comment. */
async function expectUntouched(b: BuiltBatch, taskStatusBefore: string): Promise<void> {
  const row = await batchRow(b.batchId);
  expect(row.Status).toBe('Pending');
  expect(row.CancelledByUserID).toBeNull();
  expect(row.SummaryJournalEntryID?.toLowerCase()).toBe(b.summaryId.toLowerCase());
  expect((await entryStatus(b.entryId)).Status).toBe('Batched');
  expect(await taskStatus(b.taskId)).toBe(taskStatusBefore);
  expect(await taskComments(b.taskId)).toHaveLength(0);
}

/** The cancel landed: audit triple, entry released, summary gone, Task commented by `by` and Cancelled. */
async function expectCancelledBy(b: BuiltBatch, by: HarnessUser): Promise<void> {
  const row = await batchRow(b.batchId);
  expect(row.Status).toBe('Cancelled');
  expect(row.CancelReason).toBe(REASON);
  expect(row.CancelledByUserID?.toLowerCase()).toBe(by.info.ID.toLowerCase());
  expect(row.CancelledAt).toBeTruthy();
  expect(row.SummaryJournalEntryID).toBeNull();
  const entry = await entryStatus(b.entryId);
  expect(entry.Status).toBe('Pending');
  expect(entry.JournalEntryBatchID).toBeNull();
  expect(Number(await scalar(ctx.pool, `SELECT COUNT(*) FROM ${SCHEMA}.JournalEntry WHERE ID='${b.summaryId}'`))).toBe(0);
  expect(await taskStatus(b.taskId)).toBe('Cancelled');
  const comments = await taskComments(b.taskId);
  expect(comments).toHaveLength(1);
  expect(comments[0].PersonID.toLowerCase()).toBe(by.personId.toLowerCase());
  expect(comments[0].Content).toContain('was cancelled before approval');
  expect(comments[0].Content).toContain(`Reason: ${REASON}`);
}

/** The users and their Persons, roles and change-log rows. Runs after the companies, whose rows reference them. */
async function removeUsers(): Promise<void> {
  const warn = (e: unknown) => console.warn(`teardown warn: ${String(e).split('\n')[0]}`);
  for (const u of [cfo, builder, other].filter((x): x is HarnessUser => !!x)) {
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
  // teardownLive removes the batches, their approval Tasks and the profile; the users go after, since all name them.
  await teardownLive(ctx, removeUsers);
});

describe('cancelling a Pending batch through the real TasksAppApprovalGate (#305)', () => {
  it('C1 — another user is refused and nothing changes', async () => {
    const b = await buildPendingBatch('C1');
    const before = await taskStatus(b.taskId);
    await expect(cancelJournalEntryBatch(b.batchId, other.info, provider, { reason: REASON }))
      .rejects.toThrow(/only the company's configured approver .* or the user who built this batch may cancel it before approval/);
    await expectUntouched(b, before);
    // Leave no open batch behind for C2: the builder cancels it (C4 proves that path in full).
    await cancelJournalEntryBatch(b.batchId, builder.info, provider, { reason: REASON });
  });

  it('C2 — the CFO without a reason is refused and nothing changes', async () => {
    const b = await buildPendingBatch('C2');
    const before = await taskStatus(b.taskId);
    await expect(cancelJournalEntryBatch(b.batchId, cfo.info, provider, {}))
      .rejects.toThrow(/is Pending and was not rejected; a reason is required/);
    await expect(cancelJournalEntryBatch(b.batchId, cfo.info, provider, { reason: '   ' }))
      .rejects.toThrow(/a reason is required/);
    await expectUntouched(b, before);
    await cancelJournalEntryBatch(b.batchId, cfo.info, provider, { reason: REASON });
  });

  it('C3 — the CFO cancels with a reason: batch Cancelled, entry released, Task commented and Cancelled', async () => {
    const b = await buildPendingBatch('C3');
    expect(await taskStatus(b.taskId)).not.toBe('Cancelled');
    await cancelJournalEntryBatch(b.batchId, cfo.info, provider, { reason: REASON });
    await expectCancelledBy(b, cfo);
  });

  it('C4 — the builder, who is not the CFO, cancels with a reason: the same outcome, commented as the builder', async () => {
    const b = await buildPendingBatch('C4');
    await cancelJournalEntryBatch(b.batchId, builder.info, provider, { reason: REASON });
    await expectCancelledBy(b, builder);
  });
});
