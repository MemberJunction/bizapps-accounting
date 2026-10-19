/**
 * #183 / golive #302 — Accounting.CancelJournalEntryBatch. It hands the engine the reason and the ERP
 * confirmation for a batch in any status; the engine decides who may cancel and resolves the gate and
 * the ERP lookup itself (#233). The engine is mocked: its own rules are covered in
 * CancelJournalEntryBatch.test.ts.
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

const USER = { ID: 'USER-1' } as UserInfo;
const BATCH_ID = 'bbbbbbbb-0000-4000-8000-000000000183';

function run(input: Record<string, unknown>) {
  const provider = {} as IMetadataProvider;
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

  it('hands a Pending batch to the engine with its reason — the engine decides who may cancel it', async () => {
    const result = await run({ Reason: 'Built with the wrong entries' });
    expect(result.Success).toBe(true);
    expect(engineCancel.mock.calls[0][0]).toBe(BATCH_ID);
    expect(engineCancel.mock.calls[0][3]).toEqual({ reason: 'Built with the wrong entries', confirmNotAlreadyPostedInERP: false });
  });

  // #233: the engine resolves the gate and the ERP lookup itself; the operation passes neither.
  it('passes the reason and the ERP confirmation to the engine, and no gate or lookup', async () => {
    const result = await run({ Reason: 'Wrong period', ConfirmNotAlreadyPostedInERP: true });
    expect(result.Success).toBe(true);
    expect(engineCancel.mock.calls[0][3]).toEqual({ reason: 'Wrong period', confirmNotAlreadyPostedInERP: true });
  });

  it('answers with the confirmation the operator must give when the lookup cannot settle it', async () => {
    engineCancel.mockRejectedValue(new ErpPostingUnconfirmedError('Mismatch', 'the ERP already holds document JEB-0183, and it does not match this batch', 'cancelJournalEntryBatch'));
    const result = await run({ Reason: 'Wrong period' });
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
    const result = await run({ Reason: 'Wrong period', ConfirmNotAlreadyPostedInERP: true });
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
