import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MJGlobal } from '@memberjunction/global';
import { BaseAction } from '@memberjunction/actions';
import { RunActionParams } from '@memberjunction/actions-base';
import { Metadata } from '@memberjunction/core';
import * as serverEngine from '@mj-biz-apps/accounting-core-entities-server';
import { ApplyJournalEntryBatchTaskDecisionAction } from '../ApplyJournalEntryBatchTaskDecisionAction';

/**
 * Applying a decision to the batch is `applyApprovalTaskDecision` in accounting-core-entities-server,
 * tested there (JournalEntryBatchTaskDecision.test.ts). What is under test here is the action's part:
 * the Task ID it passes, the user it runs as, the result it reports, and the metadata that makes the
 * batch approval task type run it (#468).
 */
const TASK_ID = '7d1f6a1e-2f0c-4a57-9a4e-0b8f6b1c2d3e';
const BATCH_ID = 'e9521aa3-f4ef-4ec5-a899-d9dd59f320b7';

const runParams = (taskId: unknown = TASK_ID): RunActionParams => {
  const params = new RunActionParams();
  params.ContextUser = { ID: 'CFO-USER' } as never;
  params.Params = [
    { Name: 'TaskID', Type: 'Input', Value: taskId },
    { Name: 'Outcome', Type: 'Output', Value: '' },
  ];
  return params;
};

const mockApply = (result: serverEngine.ApprovalTaskDecisionResult) =>
  vi.spyOn(serverEngine, 'applyApprovalTaskDecision').mockResolvedValue(result);

describe('ApplyJournalEntryBatchTaskDecisionAction', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Metadata.Provider = { Config: { ActiveStatusAssertions: false } } as never;
  });

  it('is registered in MJGlobal ClassFactory as Accounting.ApplyJournalEntryBatchTaskDecision', () => {
    const instance = MJGlobal.Instance.ClassFactory.CreateInstance<BaseAction>(BaseAction, 'Accounting.ApplyJournalEntryBatchTaskDecision');
    expect(instance).toBeInstanceOf(ApplyJournalEntryBatchTaskDecisionAction);
  });

  it('applies the Task\'s decision as the user who decided, with the server provider', async () => {
    const apply = mockApply({ Kind: 'Approved', JournalEntryBatchID: BATCH_ID });
    const params = runParams();
    const result = await new ApplyJournalEntryBatchTaskDecisionAction().Run(params);
    expect(apply).toHaveBeenCalledWith(TASK_ID, params.ContextUser, Metadata.Provider);
    expect(result).toMatchObject({ Success: true, ResultCode: 'APPROVED' });
    expect(params.Params.find(p => p.Name === 'Outcome')?.Value).toBe('Approved');
  });

  it('reports a cancel on a rejection', async () => {
    mockApply({ Kind: 'Cancelled', JournalEntryBatchID: BATCH_ID });
    await expect(new ApplyJournalEntryBatchTaskDecisionAction().Run(runParams())).resolves.toMatchObject({ Success: true, ResultCode: 'CANCELLED' });
  });

  it('fails, so the hook logs it, when the decision was refused', async () => {
    mockApply({ Kind: 'Refused', JournalEntryBatchID: BATCH_ID, Reason: 'not that approver' });
    const result = await new ApplyJournalEntryBatchTaskDecisionAction().Run(runParams());
    expect(result).toMatchObject({ Success: false, ResultCode: 'REFUSED' });
    expect(result.Message).toContain('not that approver');
  });

  it.each([
    [{ Kind: 'NotPending', JournalEntryBatchID: BATCH_ID }, 'NOT_PENDING'],
    [{ Kind: 'NoDecision', JournalEntryBatchID: BATCH_ID }, 'NO_DECISION'],
    [{ Kind: 'NotABatchTask', JournalEntryBatchID: null }, 'NOT_A_BATCH_TASK'],
  ] as const)('succeeds without change for %o', async (outcome, code) => {
    mockApply(outcome);
    await expect(new ApplyJournalEntryBatchTaskDecisionAction().Run(runParams())).resolves.toMatchObject({ Success: true, ResultCode: code });
  });

  it('applies nothing without a Task ID', async () => {
    const apply = mockApply({ Kind: 'Approved', JournalEntryBatchID: BATCH_ID });
    const result = await new ApplyJournalEntryBatchTaskDecisionAction().Run(runParams(''));
    expect(result).toMatchObject({ Success: false, ResultCode: 'MISSING_TASK' });
    expect(apply).not.toHaveBeenCalled();
  });
});

describe('the batch approval task type runs the action (metadata)', () => {
  const root = resolve(__dirname, '../../../../metadata');
  type Record = { fields: { [k: string]: unknown }; primaryKey: { ID: string } };
  const actions = JSON.parse(readFileSync(resolve(root, 'actions/.accounting-actions.json'), 'utf8')) as Record[];
  const types = JSON.parse(readFileSync(resolve(root, 'task-types/.accounting-task-types.json'), 'utf8')) as Record[];
  const action = actions.find(a => a.fields.DriverClass === 'Accounting.ApplyJournalEntryBatchTaskDecision');
  const type = types.find(t => t.fields.Name === 'Journal Entry Batch Approval');

  it('defines the action, active, with the TaskID input the tasks app passes', () => {
    expect(action?.fields).toMatchObject({ Type: 'Custom', Status: 'Active' });
    const params = (action as unknown as { relatedEntities: { 'MJ: Action Params': Record[] } }).relatedEntities['MJ: Action Params'];
    expect(params.find(p => p.fields.Name === 'TaskID')?.fields).toMatchObject({ Type: 'Input', IsRequired: true });
  });

  it('defines an active approval task type whose complete and reject hooks are the action', () => {
    expect(type?.fields).toMatchObject({ IsApproval: true, IsActive: true });
    const hook = `@lookup:MJ: Actions.ID=${action?.primaryKey.ID}`;
    expect(type?.fields.OnCompleteActionID).toBe(hook);
    expect(type?.fields.OnRejectActionID).toBe(hook);
    // A rejection closes the Task as Cancelled, which fires OnCancel as well; one hook is enough.
    expect(type?.fields.OnCancelActionID).toBeUndefined();
  });

  it('syncs task types after actions, so the hook lookup resolves', () => {
    const order = (JSON.parse(readFileSync(resolve(root, '.mj-sync.json'), 'utf8')) as { directoryOrder: string[] }).directoryOrder;
    expect(order.indexOf('task-types')).toBeGreaterThan(order.indexOf('actions'));
  });
});
