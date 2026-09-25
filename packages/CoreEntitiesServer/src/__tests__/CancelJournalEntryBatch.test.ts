/**
 * #183 — who may cancel a batch past approval, and where that is enforced.
 *
 *   · cancelJournalEntryBatch (engine): a Pending cancel needs no gate; an Approved or Failed one must
 *     pass the gate's authorization, and records itself on the approval Task inside Cancel's
 *     transaction (onCancelled).
 *   The remote operation is covered in CancelJournalEntryBatchOperation.test.ts.
 */
import { describe, it, expect, vi } from 'vitest';
import type { IMetadataProvider, UserInfo } from '@memberjunction/core';

import { cancelJournalEntryBatch, type JournalEntryBatchCancelGate } from '../JournalEntryBatchEngine.js';
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
    expect(g.recordCancellation).toHaveBeenCalledWith(BATCH_ID, 'Wrong period', USER);
    const [, options] = batch.Cancel.mock.calls[0] as [UserInfo, JournalEntryBatchCancelOptions];
    expect(options.confirmNotAlreadyPostedInERP).toBe(true);
    expect(batch.Status).toBe('Cancelled');
  });
});
