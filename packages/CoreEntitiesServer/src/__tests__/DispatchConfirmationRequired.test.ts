/**
 * The dispatch op's answer when a Failed retry needs the operator (#182).
 *
 * The engine refuses a Failed retry whose ERP lookup cannot settle whether the batch already posted,
 * by throwing ErpPostingUnconfirmedError. Over the wire that must arrive as an answer the Dispatch
 * page can act on — `ConfirmationRequired` with the reason — not as a failed call, so the page asks
 * for the confirmation only then instead of sending it with every retry.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IMetadataProvider, UserInfo } from '@memberjunction/core';
import { DispatchJournalEntryBatchOperation, type DispatchJournalEntryBatchInput as DispatchInput } from '../JournalEntryBatchOperations.js';
import { ErpPostingUnconfirmedError, sendJournalEntryBatch } from '../JournalEntryBatchEngine.js';

vi.mock('../JournalEntryBatchEngine.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../JournalEntryBatchEngine.js')>();
  return { ...actual, sendJournalEntryBatch: vi.fn() };
});

const sendSpy = vi.mocked(sendJournalEntryBatch);

/** Exposes the protected entry point; the op's own Execute wrapper is not what is under test. */
class ProbeOperation extends DispatchJournalEntryBatchOperation {
  public Run(input: DispatchInput, provider: IMetadataProvider, user: UserInfo) {
    return this.InternalExecute(input, provider, user);
  }
}

const provider = {} as unknown as IMetadataProvider;
const user = { ID: 'U1' } as unknown as UserInfo;
const BATCH_ID = 'bbbbbbbb-0000-0000-0000-000000000001';

describe('DispatchJournalEntryBatchOperation — a retry the lookup could not settle', () => {
  beforeEach(() => {
    sendSpy.mockReset();
  });

  it.each(['Unavailable', 'Error', 'Mismatch'] as const)('answers ConfirmationRequired with the %s kind and reason, leaving the batch Failed', async (kind) => {
    sendSpy.mockRejectedValue(new ErpPostingUnconfirmedError(kind, 'could not check the ERP for document JEB-0001.'));

    const out = await new ProbeOperation().Run({ JournalEntryBatchID: BATCH_ID }, provider, user);

    expect(out).toEqual({
      Status: 'Failed',
      ExternalJournalEntryBatchRef: null,
      ConfirmationRequired: 'could not check the ERP for document JEB-0001.',
      ConfirmationKind: kind,
    });
  });

  it('still fails the call on any other refusal', async () => {
    sendSpy.mockRejectedValue(new Error('sendJournalEntryBatch: batch JEB-0001 no longer matches its approved content'));

    await expect(new ProbeOperation().Run({ JournalEntryBatchID: BATCH_ID }, provider, user))
      .rejects.toThrow(/no longer matches its approved content/);
  });

  it('passes the lookup to the engine alongside the poster', async () => {
    sendSpy.mockResolvedValue({ Status: 'Posted', ExternalJournalEntryBatchRef: 'JEB-0001' } as never);

    const out = await new ProbeOperation().Run({ JournalEntryBatchID: BATCH_ID, ConfirmNotAlreadyPostedInERP: true }, provider, user);

    expect(out).toEqual({ Status: 'Posted', ExternalJournalEntryBatchRef: 'JEB-0001' });
    const options = sendSpy.mock.calls[0][2] as { lookup?: unknown; poster?: unknown; confirmNotAlreadyPostedInERP?: boolean };
    expect(typeof options.lookup).toBe('function');
    expect(typeof options.poster).toBe('function');
    expect(options.confirmNotAlreadyPostedInERP).toBe(true);
  });
});
