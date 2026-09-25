/**
 * #183 — who may cancel a batch past approval, and where that is enforced.
 *
 *   · cancelJournalEntryBatch (engine): a Pending cancel needs no gate; an Approved or Failed one must
 *     pass the gate's authorization, and records itself on the approval Task inside Cancel's
 *     transaction (onCancelled).
 *   · a Failed cancel looks the batch number up in the ERP first (#207): a posting it holds refuses
 *     the cancel outright, nothing found lets it through, and anything else needs the operator.
 *   The remote operation is covered in CancelJournalEntryBatchOperation.test.ts.
 */
import { describe, it, expect, vi } from 'vitest';
import type { IMetadataProvider, UserInfo } from '@memberjunction/core';

import {
  cancelJournalEntryBatch,
  ErpPostingUnconfirmedError,
  type ErpJournalLookup,
  type ErpJournalLookupResult,
  type JournalEntryBatchCancelGate,
} from '../JournalEntryBatchEngine.js';
import type { JournalEntryBatchCancelOptions } from '../JournalEntryBatchEntityServer.js';

const USER = { ID: 'USER-1' } as UserInfo;
const BATCH_ID = 'bbbbbbbb-0000-4000-8000-000000000183';

interface FakeBatch {
  ID: string;
  JournalEntryBatchNumber: string;
  Status: string;
  Load: (id: string) => Promise<boolean>;
  Cancel: ReturnType<typeof vi.fn>;
}

function world(status: string): { batch: FakeBatch; provider: IMetadataProvider } {
  const batch: FakeBatch = {
    ID: BATCH_ID,
    JournalEntryBatchNumber: 'JEB-0183',
    Status: status,
    Load: async () => true,
    // Run the hook the way the entity does, so the test sees what executes inside the transaction.
    Cancel: vi.fn(async (_user: UserInfo | undefined, options: JournalEntryBatchCancelOptions) => {
      if (options.onCancelled) await options.onCancelled();
      batch.Status = 'Cancelled';
      return true;
    }),
  };
  const provider = { GetEntityObject: async () => batch } as unknown as IMetadataProvider;
  return { batch, provider };
}

function gate(opts: { allowed: boolean }): JournalEntryBatchCancelGate & { recordCancellation: ReturnType<typeof vi.fn> } {
  return {
    assertMayCancelApproved: vi.fn(async () => {
      if (!opts.allowed) throw new Error('only the company\'s configured approver or the user who approved this batch may cancel it');
    }),
    recordCancellation: vi.fn(async () => undefined),
  };
}

describe('cancelJournalEntryBatch — authorizing a cancel past approval', () => {
  it('cancels a Pending batch without a gate — the rejection was already gated', async () => {
    const { batch, provider } = world('Pending');
    await cancelJournalEntryBatch(BATCH_ID, USER, provider);
    expect(batch.Cancel).toHaveBeenCalledTimes(1);
    expect(batch.Status).toBe('Cancelled');
  });

  it.each(['Approved', 'Failed'])('refuses a %s batch when no gate is supplied', async (status) => {
    const { batch, provider } = world(status);
    await expect(cancelJournalEntryBatch(BATCH_ID, USER, provider, { reason: 'Wrong period', confirmNotAlreadyPostedInERP: true }))
      .rejects.toThrow(/needs the approval gate/);
    expect(batch.Cancel).not.toHaveBeenCalled();
  });

  it('refuses a user the gate does not allow, before anything is written', async () => {
    const { batch, provider } = world('Approved');
    const g = gate({ allowed: false });
    await expect(cancelJournalEntryBatch(BATCH_ID, USER, provider, { reason: 'Wrong period', gate: g })).rejects.toThrow(/configured approver/);
    expect(batch.Cancel).not.toHaveBeenCalled();
    expect(g.recordCancellation).not.toHaveBeenCalled();
  });

  it('cancels for an allowed user and records the cancel on the Task inside the cancel', async () => {
    const { batch, provider } = world('Failed');
    const g = gate({ allowed: true });
    await cancelJournalEntryBatch(BATCH_ID, USER, provider, { reason: 'Wrong period', confirmNotAlreadyPostedInERP: true, gate: g });

    expect(g.assertMayCancelApproved).toHaveBeenCalledWith(BATCH_ID, USER);
    // No lookup supplied counts as an ERP that offers none, so the operator's confirmation stands.
    expect(g.recordCancellation).toHaveBeenCalledWith(
      BATCH_ID,
      { reason: 'Wrong period', fromStatus: 'Failed', erpCheck: expect.stringMatching(/confirmed document JEB-0183 had not posted.*\(Unavailable\)/) },
      USER,
    );
    const [, options] = batch.Cancel.mock.calls[0] as [UserInfo, JournalEntryBatchCancelOptions];
    expect(options.confirmNotAlreadyPostedInERP).toBe(true);
    expect(options.erpNotPostedBasis).toBe('UserAttested');
    expect(batch.Status).toBe('Cancelled');
  });

  it('records the status the batch was cancelled FROM, not what it reads after the cancel', async () => {
    const { batch, provider } = world('Approved');
    const g = gate({ allowed: true });
    await cancelJournalEntryBatch(BATCH_ID, USER, provider, { reason: 'Wrong period', gate: g });

    expect(batch.Status).toBe('Cancelled');
    expect(g.recordCancellation).toHaveBeenCalledWith(BATCH_ID, { reason: 'Wrong period', fromStatus: 'Approved', erpCheck: undefined }, USER);
    const [, options] = batch.Cancel.mock.calls[0] as [UserInfo, JournalEntryBatchCancelOptions];
    expect(options.erpNotPostedBasis).toBeUndefined(); // never sent, so there is no ERP check to record
  });
});

/** A lookup that answers `result`, recording that it was asked. */
function lookupOf(result: ErpJournalLookupResult) {
  return vi.fn<ErpJournalLookup>(async () => result);
}

// Cancel releases a Failed batch's entries to be batched again under a NEW number, so no later lookup
// can connect them to this batch's journal: the cancel is the last point a posted batch can be caught.
describe('cancelJournalEntryBatch — the ERP check before cancelling a Failed batch (#207)', () => {
  it.each([undefined, true])('refuses when the ERP holds the batch, with no override (confirmation: %s)', async (confirm) => {
    const { batch, provider } = world('Failed');
    const g = gate({ allowed: true });
    const lookup = lookupOf({ status: 'Found', externalJournalEntryBatchRef: 'JEB-0183' });

    await expect(cancelJournalEntryBatch(BATCH_ID, USER, provider, { reason: 'Wrong period', confirmNotAlreadyPostedInERP: confirm, gate: g, lookup }))
      .rejects.toThrow(/matches this batch, so the batch posted.*Retry it from Dispatch status/);
    expect(batch.Cancel).not.toHaveBeenCalled();
    expect(g.recordCancellation).not.toHaveBeenCalled();
    expect(batch.Status).toBe('Failed');
  });

  it('cancels without the operator\'s word when the ERP holds nothing under the number, and says so on the Task', async () => {
    const { batch, provider } = world('Failed');
    const g = gate({ allowed: true });

    await cancelJournalEntryBatch(BATCH_ID, USER, provider, { reason: 'Wrong period', gate: g, lookup: lookupOf({ status: 'NotFound' }) });

    const [, options] = batch.Cancel.mock.calls[0] as [UserInfo, JournalEntryBatchCancelOptions];
    expect(options.confirmNotAlreadyPostedInERP).toBe(true); // the lookup is the check; the entity persists it
    expect(options.erpNotPostedBasis).toBe('ERPLookup');
    expect(g.recordCancellation).toHaveBeenCalledWith(
      BATCH_ID, { reason: 'Wrong period', fromStatus: 'Failed', erpCheck: 'The ERP lookup found nothing posted under document JEB-0183.' }, USER);
    expect(batch.Status).toBe('Cancelled');
  });

  const unsettled: ErpJournalLookupResult[] = [
    { status: 'Mismatch', detail: 'BC holds 3 lines, the batch has 2.' },
    { status: 'Error', error: 'BC timed out.' },
    { status: 'Unavailable' },
  ];

  it.each(unsettled)('refuses a $status lookup without the operator\'s confirmation, writing nothing', async (result) => {
    const { batch, provider } = world('Failed');
    const g = gate({ allowed: true });

    const error = await cancelJournalEntryBatch(BATCH_ID, USER, provider, { reason: 'Wrong period', gate: g, lookup: lookupOf(result) })
      .then(() => null, (e: unknown) => e);
    expect(error).toBeInstanceOf(ErpPostingUnconfirmedError);
    expect((error as ErpPostingUnconfirmedError).Kind).toBe(result.status);
    expect((error as ErpPostingUnconfirmedError).message).toMatch(/^cancelJournalEntryBatch: /);
    expect(batch.Cancel).not.toHaveBeenCalled();
    expect(g.recordCancellation).not.toHaveBeenCalled();
  });

  it.each(unsettled)('cancels a $status lookup once the operator confirms, and records why on the Task', async (result) => {
    const { batch, provider } = world('Failed');
    const g = gate({ allowed: true });

    await cancelJournalEntryBatch(BATCH_ID, USER, provider, { reason: 'Wrong period', confirmNotAlreadyPostedInERP: true, gate: g, lookup: lookupOf(result) });

    expect(batch.Status).toBe('Cancelled');
    expect(g.recordCancellation).toHaveBeenCalledWith(
      BATCH_ID, { reason: 'Wrong period', fromStatus: 'Failed', erpCheck: expect.stringContaining(`(${result.status})`) }, USER);
    const [, options] = batch.Cancel.mock.calls[0] as [UserInfo, JournalEntryBatchCancelOptions];
    expect(options.erpNotPostedBasis).toBe('UserAttested');
  });

  it('treats a lookup that throws as unable to answer — the operator must confirm', async () => {
    const { batch, provider } = world('Failed');
    const lookup = vi.fn<ErpJournalLookup>(async () => { throw new Error('socket hang up'); });

    await expect(cancelJournalEntryBatch(BATCH_ID, USER, provider, { reason: 'Wrong period', gate: gate({ allowed: true }), lookup }))
      .rejects.toThrow(/could not check the ERP for document JEB-0183 before cancelling: socket hang up/);
    expect(batch.Cancel).not.toHaveBeenCalled();
  });

  it('never looks up an Approved batch — it has not been sent', async () => {
    const { batch, provider } = world('Approved');
    const lookup = lookupOf({ status: 'Found', externalJournalEntryBatchRef: 'X' });

    await cancelJournalEntryBatch(BATCH_ID, USER, provider, { reason: 'Wrong period', gate: gate({ allowed: true }), lookup });

    expect(lookup).not.toHaveBeenCalled();
    expect(batch.Status).toBe('Cancelled');
  });

  it('authorizes before asking the ERP anything', async () => {
    const { provider } = world('Failed');
    const lookup = lookupOf({ status: 'NotFound' });

    await expect(cancelJournalEntryBatch(BATCH_ID, USER, provider, { reason: 'Wrong period', gate: gate({ allowed: false }), lookup }))
      .rejects.toThrow(/configured approver/);
    expect(lookup).not.toHaveBeenCalled();
  });
});
