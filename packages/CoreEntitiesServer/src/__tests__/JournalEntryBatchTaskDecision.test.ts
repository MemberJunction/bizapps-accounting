/**
 * Carrying a decision on a batch's approval Task through to the batch (#468).
 *
 * The gate and the engine's approve/cancel are stubbed: their own rules are tested in
 * TasksAppApprovalGate.test.ts and the engine tests. What is under test here is the shared step:
 * which batch a Task's decision reaches, that it acts only on a Pending batch with a terminal
 * decision, that a refused decision reopens the Task instead of moving the batch, and that the
 * Accounting decision and the hook it sets off never act on one batch at the same time.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IMetadataProvider, UserInfo } from '@memberjunction/core';

const gate = vi.hoisted(() => ({
  recordDecision: vi.fn(),
  assertMayDecide: vi.fn(),
  latestTerminalDecision: vi.fn(),
  reopenAfterRefusedDecision: vi.fn(),
}));
const engine = vi.hoisted(() => ({ approve: vi.fn(), cancel: vi.fn() }));

vi.mock('../TasksAppApprovalGate.js', () => ({
  TasksAppApprovalGate: class {
    recordDecision = gate.recordDecision;
    assertMayDecide = gate.assertMayDecide;
    latestTerminalDecision = gate.latestTerminalDecision;
    reopenAfterRefusedDecision = gate.reopenAfterRefusedDecision;
  },
}));
vi.mock('../JournalEntryBatchEngine.js', () => ({
  approveJournalEntryBatch: engine.approve,
  cancelJournalEntryBatch: engine.cancel,
}));

import { applyApprovalTaskDecision, recordJournalEntryBatchDecision, withBatchDecisionLock } from '../JournalEntryBatchTaskDecision.js';

const TASK_ID = '7d1f6a1e-2f0c-4a57-9a4e-0b8f6b1c2d3e';
const BATCH_ID = 'e9521aa3-f4ef-4ec5-a899-d9dd59f320b7';
const cfo = { ID: '48d60bcc-044b-4cc2-9675-0d3b57bcdcba' } as UserInfo;

/** A provider whose batch lookup by ApprovalTaskID finds `batchId` (or nothing), in `status`. */
function stubProvider(batchId: string | null, status = 'Pending'): IMetadataProvider {
  return {
    RunView: async () => ({ Success: true, Results: batchId ? [{ ID: batchId }] : [] }),
    GetEntityObject: async () => ({ Load: async () => true, ID: batchId, JournalEntryBatchNumber: 'BATCH-0007', Status: status }),
  } as unknown as IMetadataProvider;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('applyApprovalTaskDecision — a decision recorded in the Tasks app', () => {
  it('approves the batch on an approving decision, as the user who decided', async () => {
    gate.latestTerminalDecision.mockResolvedValue({ outcome: 'Approved', notes: null });
    const provider = stubProvider(BATCH_ID);
    const result = await applyApprovalTaskDecision(TASK_ID, cfo, provider);
    expect(result).toEqual({ Kind: 'Approved', JournalEntryBatchID: BATCH_ID });
    expect(engine.approve).toHaveBeenCalledWith(BATCH_ID, cfo.ID, cfo, provider);
    expect(engine.cancel).not.toHaveBeenCalled();
  });

  it('treats Approved with conditions as an approval', async () => {
    gate.latestTerminalDecision.mockResolvedValue({ outcome: 'ApprovedWithConditions', notes: 'ok' });
    const result = await applyApprovalTaskDecision(TASK_ID, cfo, stubProvider(BATCH_ID));
    expect(result.Kind).toBe('Approved');
    expect(engine.approve).toHaveBeenCalled();
  });

  it('cancels the batch on a rejection, with the decision\'s notes as the reason', async () => {
    gate.latestTerminalDecision.mockResolvedValue({ outcome: 'Rejected', notes: 'Wrong posting date' });
    const provider = stubProvider(BATCH_ID);
    const result = await applyApprovalTaskDecision(TASK_ID, cfo, provider);
    expect(result).toEqual({ Kind: 'Cancelled', JournalEntryBatchID: BATCH_ID });
    expect(engine.cancel).toHaveBeenCalledWith(BATCH_ID, cfo, provider, { reason: 'Wrong posting date' });
  });

  it('checks the decider against the decision it applies', async () => {
    gate.latestTerminalDecision.mockResolvedValue({ outcome: 'Rejected', notes: 'No' });
    await applyApprovalTaskDecision(TASK_ID, cfo, stubProvider(BATCH_ID));
    expect(gate.assertMayDecide).toHaveBeenCalledWith(expect.objectContaining({ ID: BATCH_ID }), 'Rejected', 'No', cfo);
  });

  it('refuses a decision the user may not make: the batch stays Pending and the Task is reopened', async () => {
    gate.latestTerminalDecision.mockResolvedValue({ outcome: 'Approved', notes: null });
    gate.assertMayDecide.mockRejectedValue(new Error('only the configured approver can approve or reject it'));
    const result = await applyApprovalTaskDecision(TASK_ID, { ID: 'someone-else' } as UserInfo, stubProvider(BATCH_ID));
    expect(result).toEqual({ Kind: 'Refused', JournalEntryBatchID: BATCH_ID, Reason: 'only the configured approver can approve or reject it' });
    expect(gate.reopenAfterRefusedDecision).toHaveBeenCalledWith(
      expect.objectContaining({ ID: BATCH_ID }), 'only the configured approver can approve or reject it', { ID: 'someone-else' },
    );
    expect(engine.approve).not.toHaveBeenCalled();
    expect(engine.cancel).not.toHaveBeenCalled();
  });

  it.each(['Approved', 'Cancelled', 'Archived', 'Posted'])('does nothing on a %s batch', async (status) => {
    const result = await applyApprovalTaskDecision(TASK_ID, cfo, stubProvider(BATCH_ID, status));
    expect(result).toEqual({ Kind: 'NotPending', JournalEntryBatchID: BATCH_ID });
    expect(gate.latestTerminalDecision).not.toHaveBeenCalled();
    expect(gate.reopenAfterRefusedDecision).not.toHaveBeenCalled();
  });

  it('does nothing when the Task closed without a decision', async () => {
    gate.latestTerminalDecision.mockResolvedValue(null);
    const result = await applyApprovalTaskDecision(TASK_ID, cfo, stubProvider(BATCH_ID));
    expect(result).toEqual({ Kind: 'NoDecision', JournalEntryBatchID: BATCH_ID });
    expect(gate.reopenAfterRefusedDecision).not.toHaveBeenCalled();
    expect(engine.approve).not.toHaveBeenCalled();
  });

  it('does nothing for a Task that is no batch\'s stamped approval Task', async () => {
    const result = await applyApprovalTaskDecision(TASK_ID, cfo, stubProvider(null));
    expect(result).toEqual({ Kind: 'NotABatchTask', JournalEntryBatchID: null });
    expect(gate.latestTerminalDecision).not.toHaveBeenCalled();
  });

  it('refuses a Task ID that is not a UUID before querying', async () => {
    await expect(applyApprovalTaskDecision("x' OR 1=1 --", cfo, stubProvider(BATCH_ID))).rejects.toThrow();
  });
});

describe('recordJournalEntryBatchDecision — the Accounting app\'s decision', () => {
  it('records the decision, then approves the batch', async () => {
    const provider = stubProvider(BATCH_ID);
    await recordJournalEntryBatchDecision(BATCH_ID, 'Approved', 'person-1', undefined, cfo, provider);
    expect(gate.recordDecision).toHaveBeenCalledWith(BATCH_ID, 'Approved', 'person-1', undefined, cfo);
    expect(engine.approve).toHaveBeenCalledWith(BATCH_ID, cfo.ID, cfo, provider);
    expect(gate.recordDecision.mock.invocationCallOrder[0]).toBeLessThan(engine.approve.mock.invocationCallOrder[0]);
  });

  it('cancels the batch on a rejection, with the notes as the reason', async () => {
    const provider = stubProvider(BATCH_ID);
    await recordJournalEntryBatchDecision(BATCH_ID, 'Rejected', undefined, 'Duplicate', cfo, provider);
    expect(engine.cancel).toHaveBeenCalledWith(BATCH_ID, cfo, provider, { reason: 'Duplicate' });
  });

  it('changes nothing when the decision is refused', async () => {
    gate.recordDecision.mockRejectedValue(new Error('not that approver'));
    await expect(recordJournalEntryBatchDecision(BATCH_ID, 'Approved', undefined, undefined, cfo, stubProvider(BATCH_ID))).rejects.toThrow('not that approver');
    expect(engine.approve).not.toHaveBeenCalled();
  });

  it('holds the hook the decision sets off until the batch is decided, so the hook finds it no longer Pending', async () => {
    let batchStatus = 'Pending';
    const provider = {
      RunView: async () => ({ Success: true, Results: [{ ID: BATCH_ID }] }),
      GetEntityObject: async () => ({ Load: async () => true, ID: BATCH_ID, Status: batchStatus }),
    } as unknown as IMetadataProvider;
    let hook: Promise<unknown> = Promise.resolve();
    // Closing the Task inside recordDecision sets off the hook, which the tasks app does not await.
    gate.recordDecision.mockImplementation(async () => { hook = applyApprovalTaskDecision(TASK_ID, cfo, provider); });
    engine.approve.mockImplementation(async () => { batchStatus = 'Approved'; });
    gate.latestTerminalDecision.mockResolvedValue({ outcome: 'Approved', notes: null });

    await recordJournalEntryBatchDecision(BATCH_ID, 'Approved', undefined, undefined, cfo, provider);
    await expect(hook).resolves.toEqual({ Kind: 'NotPending', JournalEntryBatchID: BATCH_ID });
    expect(engine.approve).toHaveBeenCalledTimes(1);
  });
});

describe('withBatchDecisionLock', () => {
  it('runs work on one batch one at a time, in order, and keeps going after a failure', async () => {
    const order: string[] = [];
    let releaseFirst: () => void = () => undefined;
    const first = withBatchDecisionLock(BATCH_ID, async () => {
      order.push('first:start');
      await new Promise<void>((r) => { releaseFirst = r; });
      order.push('first:end');
      throw new Error('first failed');
    });
    const second = withBatchDecisionLock(BATCH_ID.toUpperCase(), async () => { order.push('second'); });
    await Promise.resolve();
    expect(order).toEqual(['first:start']);
    releaseFirst();
    await expect(first).rejects.toThrow('first failed');
    await second;
    expect(order).toEqual(['first:start', 'first:end', 'second']);
  });

  it('does not hold work on another batch', async () => {
    let releaseFirst: () => void = () => undefined;
    const first = withBatchDecisionLock(BATCH_ID, () => new Promise<void>((r) => { releaseFirst = r; }));
    await expect(withBatchDecisionLock('another-batch', async () => 'done')).resolves.toBe('done');
    releaseFirst();
    await first;
  });
});
