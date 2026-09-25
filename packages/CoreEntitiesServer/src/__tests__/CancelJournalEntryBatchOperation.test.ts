/**
 * #183 — Accounting.CancelJournalEntryBatch. It refuses a Pending batch (that cancel is a rejection,
 * recorded through the CFO's decision) and hands the engine the reason, the ERP confirmation and the
 * tasks-backed gate that authorizes and records a cancel past approval. The engine is mocked: its
 * own rules are covered in CancelJournalEntryBatch.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IMetadataProvider, RemoteOpServerContext, UserInfo } from '@memberjunction/core';

const engineCancel = vi.fn();
vi.mock('../JournalEntryBatchEngine.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../JournalEntryBatchEngine.js')>()),
  cancelJournalEntryBatch: (...args: unknown[]) => engineCancel(...args),
}));

import { CancelJournalEntryBatchOperation } from '../JournalEntryBatchOperations.js';
import { ErpPostingUnconfirmedError } from '../JournalEntryBatchEngine.js';
import { TasksAppApprovalGate } from '../TasksAppApprovalGate.js';

const USER = { ID: 'USER-1' } as UserInfo;
const BATCH_ID = 'bbbbbbbb-0000-4000-8000-000000000183';

function run(status: string, input: Record<string, unknown>) {
  const provider = {
    GetEntityObject: async () => ({ Load: async () => true, ID: BATCH_ID, JournalEntryBatchNumber: 'JEB-0183', Status: status }),
  } as unknown as IMetadataProvider;
  return new CancelJournalEntryBatchOperation().ExecuteServer(
    { JournalEntryBatchID: BATCH_ID, ...input } as never,
    { provider, user: USER } as unknown as RemoteOpServerContext,
  );
}

describe('Accounting.CancelJournalEntryBatch', () => {
  beforeEach(() => {
    engineCancel.mockReset();
    engineCancel.mockResolvedValue({ Status: 'Cancelled', CancelledAt: new Date('2026-09-25T10:00:00Z') });
  });

  it('refuses a Pending batch — its cancel is a rejection, recorded through the CFO decision', async () => {
    const result = await run('Pending', { Reason: 'x' });
    expect(result.Success).toBe(false);
    expect(result.ErrorMessage).toMatch(/is Pending — reject it from Batch approvals/);
    expect(engineCancel).not.toHaveBeenCalled();
  });

  it('passes the reason, the ERP confirmation and the tasks-backed gate to the engine', async () => {
    const result = await run('Failed', { Reason: 'Wrong period', ConfirmNotAlreadyPostedInERP: true });
    expect(result.Success).toBe(true);
    const options = engineCancel.mock.calls[0][3] as { reason: string; confirmNotAlreadyPostedInERP: boolean; gate: unknown };
    expect(options.reason).toBe('Wrong period');
    expect(options.confirmNotAlreadyPostedInERP).toBe(true);
    expect(options.gate).toBeInstanceOf(TasksAppApprovalGate);
  });

  // #207: a Failed cancel checks the ERP first, so the operation must hand the engine a real lookup.
  it('hands the engine the ERP lookup', async () => {
    await run('Failed', { Reason: 'Wrong period' });
    const options = engineCancel.mock.calls[0][3] as { lookup?: unknown };
    expect(typeof options.lookup).toBe('function');
  });

  it('answers with the confirmation the operator must give when the lookup cannot settle it', async () => {
    engineCancel.mockRejectedValue(new ErpPostingUnconfirmedError('Mismatch', 'the ERP already holds document JEB-0183, and it does not match this batch', 'cancelJournalEntryBatch'));
    const result = await run('Failed', { Reason: 'Wrong period' });
    expect(result.Success).toBe(true);
    expect(result.Output).toEqual({
      Status: 'Failed',
      CancelledAt: null,
      ConfirmationRequired: 'the ERP already holds document JEB-0183, and it does not match this batch',
      ConfirmationKind: 'Mismatch',
    });
  });

  it('fails the call when the ERP holds the batch — that refusal has no override', async () => {
    engineCancel.mockRejectedValue(new Error('cancelJournalEntryBatch: the ERP already holds document JEB-0183 (JEB-0183) and it matches this batch, so the batch posted.'));
    const result = await run('Failed', { Reason: 'Wrong period', ConfirmNotAlreadyPostedInERP: true });
    expect(result.Success).toBe(false);
    expect(result.ErrorMessage).toMatch(/so the batch posted/);
  });

  it('refuses a malformed batch id before reading anything', async () => {
    const result = await new CancelJournalEntryBatchOperation().ExecuteServer(
      { JournalEntryBatchID: "x' OR 1=1 --", Reason: 'x' } as never,
      { provider: {} as IMetadataProvider, user: USER } as unknown as RemoteOpServerContext,
    );
    expect(result.Success).toBe(false);
    expect(engineCancel).not.toHaveBeenCalled();
  });
});
