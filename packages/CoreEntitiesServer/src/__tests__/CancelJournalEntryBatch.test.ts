/**
 * #183 / #233 — who may cancel a batch, and where that is enforced.
 *
 *   · cancelJournalEntryBatch (engine) resolves its gate and ERP lookup through
 *     JournalEntryBatchDispatchServices (#233); a caller cannot pass them. These tests register a
 *     fake at a higher priority and point it at each test's gate and lookup.
 *   · a Pending cancel needs a rejection recorded on the approval Task; an Approved or Failed one
 *     must pass the gate's authorization, and records itself on the approval Task inside Cancel's
 *     transaction (onCancelled).
 *   · a Failed cancel looks the batch number up in the ERP first (#207): a posting it holds refuses
 *     the cancel outright, nothing found lets it through, and anything else needs the operator.
 *   The remote operation is covered in CancelJournalEntryBatchOperation.test.ts.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import type { IMetadataProvider, UserInfo } from '@memberjunction/core';
import { MJGlobal } from '@memberjunction/global';

import {
  cancelJournalEntryBatch,
  ErpPostingUnconfirmedError,
  type ErpJournalLookup,
  type ErpJournalLookupResult,
  type JournalEntryBatchCancelGate,
} from '../JournalEntryBatchEngine.js';
import { JournalEntryBatchDispatchServices } from '../JournalEntryBatchDispatchServices.js';
import { TasksAppApprovalGate } from '../TasksAppApprovalGate.js';
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
    // In the entity's order: the batch is saved Cancelled (markCancelled), THEN the hook runs inside
    // the transaction — so a hook that re-reads batch.Status sees Cancelled, as it would for real.
    Cancel: vi.fn(async (_user: UserInfo | undefined, options: JournalEntryBatchCancelOptions) => {
      batch.Status = 'Cancelled';
      if (options.onCancelled) await options.onCancelled();
      return true;
    }),
  };
  const provider = { GetEntityObject: async () => batch } as unknown as IMetadataProvider;
  return { batch, provider };
}

type FakeGate = JournalEntryBatchCancelGate & {
  assertRejected: ReturnType<typeof vi.fn>;
  assertMayCancelApproved: ReturnType<typeof vi.fn>;
  recordCancellation: ReturnType<typeof vi.fn>;
};

function gate(opts: { allowed: boolean; rejected?: boolean }): FakeGate {
  return {
    assertRejected: vi.fn(async () => {
      if (!opts.rejected) throw new Error('is not rejected — no terminal rejection decision on its approval Task');
    }),
    assertMayCancelApproved: vi.fn(async () => {
      if (!opts.allowed) throw new Error('only the company\'s configured approver or the user who approved this batch may cancel it');
    }),
    recordCancellation: vi.fn(async () => undefined),
  };
}

/** What the registered fake hands the engine for the current test. Unset outside a test. */
let registered: { gate: FakeGate; lookup: ErpJournalLookup } | null = null;

/** Point the fake services at this test's gate and lookup. The lookup defaults to an ERP with none. */
function use(g: FakeGate, lookup: ErpJournalLookup = lookupOf({ status: 'Unavailable' })): FakeGate {
  registered = { gate: g, lookup };
  return g;
}

class FakeDispatchServices extends JournalEntryBatchDispatchServices {
  public override CreateCancelGate(): JournalEntryBatchCancelGate {
    if (!registered) throw new Error('FakeDispatchServices: no gate set up for this test');
    return registered.gate;
  }
  public override CreateLookup(): ErpJournalLookup {
    if (!registered) throw new Error('FakeDispatchServices: no lookup set up for this test');
    return registered.lookup;
  }
}

beforeAll(() => {
  MJGlobal.Instance.ClassFactory.Register(JournalEntryBatchDispatchServices, FakeDispatchServices, null, 1000, true);
});
beforeEach(() => { registered = null; });
afterEach(() => { registered = null; });

describe('cancelJournalEntryBatch — the engine resolves its own gate and lookup (#233)', () => {
  it('uses the registered services, not anything the caller passes', async () => {
    const { batch, provider } = world('Approved');
    const g = use(gate({ allowed: true }));
    // A caller that still passes a gate: not part of the options any more, so it is ignored.
    const permissive = { assertRejected: vi.fn(), assertMayCancelApproved: vi.fn(), recordCancellation: vi.fn() };
    await cancelJournalEntryBatch(BATCH_ID, USER, provider, { reason: 'Wrong period', gate: permissive } as never);

    expect(g.assertMayCancelApproved).toHaveBeenCalledWith(BATCH_ID, USER);
    expect(permissive.assertMayCancelApproved).not.toHaveBeenCalled();
    expect(batch.Status).toBe('Cancelled');
  });

  it('resolves the tasks-backed gate and the AccountingERPEngine lookup when nothing replaced them', () => {
    const real = new JournalEntryBatchDispatchServices();
    const provider = {} as IMetadataProvider;
    expect(real.CreateCancelGate(provider)).toBeInstanceOf(TasksAppApprovalGate);
    expect(typeof real.CreateLookup(provider)).toBe('function');
  });
});

describe('cancelJournalEntryBatch — a Pending cancel is a recorded rejection (#233)', () => {
  it('cancels a Pending batch once its approval Task records the rejection', async () => {
    const { batch, provider } = world('Pending');
    const g = use(gate({ allowed: false, rejected: true }));
    await cancelJournalEntryBatch(BATCH_ID, USER, provider);

    expect(g.assertRejected).toHaveBeenCalledWith(BATCH_ID, USER);
    expect(g.assertMayCancelApproved).not.toHaveBeenCalled();
    expect(batch.Cancel).toHaveBeenCalledTimes(1);
    expect(batch.Status).toBe('Cancelled');
  });

  it('refuses a Pending batch nobody rejected, before anything is written', async () => {
    const { batch, provider } = world('Pending');
    use(gate({ allowed: true, rejected: false }));
    await expect(cancelJournalEntryBatch(BATCH_ID, USER, provider)).rejects.toThrow(/is not rejected/);
    expect(batch.Cancel).not.toHaveBeenCalled();
    expect(batch.Status).toBe('Pending');
  });
});

describe('cancelJournalEntryBatch — authorizing a cancel past approval', () => {
  it('refuses a user the gate does not allow, before anything is written', async () => {
    const { batch, provider } = world('Approved');
    const g = use(gate({ allowed: false }));
    await expect(cancelJournalEntryBatch(BATCH_ID, USER, provider, { reason: 'Wrong period' })).rejects.toThrow(/configured approver/);
    expect(g.assertRejected).not.toHaveBeenCalled();
    expect(batch.Cancel).not.toHaveBeenCalled();
    expect(g.recordCancellation).not.toHaveBeenCalled();
  });

  // The gate's refusals include a canceller with no linked Person to record the cancel (#212).
  it('refuses a Failed batch the gate does not allow before the ERP lookup runs', async () => {
    const { batch, provider } = world('Failed');
    const lookup = lookupOf({ status: 'NotFound' });
    use(gate({ allowed: false }), lookup);
    await expect(cancelJournalEntryBatch(BATCH_ID, USER, provider, { reason: 'Wrong period' })).rejects.toThrow(/configured approver/);
    expect(lookup).not.toHaveBeenCalled();
    expect(batch.Cancel).not.toHaveBeenCalled();
  });

  it('cancels for an allowed user and records the cancel on the Task inside the cancel', async () => {
    const { batch, provider } = world('Failed');
    const g = use(gate({ allowed: true }));
    await cancelJournalEntryBatch(BATCH_ID, USER, provider, { reason: 'Wrong period', confirmNotAlreadyPostedInERP: true });

    expect(g.assertMayCancelApproved).toHaveBeenCalledWith(BATCH_ID, USER);
    // An ERP that offers no lookup, so the operator's confirmation stands.
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
    const g = use(gate({ allowed: true }));
    await cancelJournalEntryBatch(BATCH_ID, USER, provider, { reason: 'Wrong period' });

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
    const g = use(gate({ allowed: true }), lookupOf({ status: 'Found', externalJournalEntryBatchRef: 'JEB-0183' }));

    await expect(cancelJournalEntryBatch(BATCH_ID, USER, provider, { reason: 'Wrong period', confirmNotAlreadyPostedInERP: confirm }))
      .rejects.toThrow(/matches this batch, so the batch posted.*Retry it from Dispatch status/);
    expect(batch.Cancel).not.toHaveBeenCalled();
    expect(g.recordCancellation).not.toHaveBeenCalled();
    expect(batch.Status).toBe('Failed');
  });

  it('cancels without the operator\'s word when the ERP holds nothing under the number, and says so on the Task', async () => {
    const { batch, provider } = world('Failed');
    const g = use(gate({ allowed: true }), lookupOf({ status: 'NotFound' }));

    await cancelJournalEntryBatch(BATCH_ID, USER, provider, { reason: 'Wrong period' });

    const [, options] = batch.Cancel.mock.calls[0] as [UserInfo, JournalEntryBatchCancelOptions];
    expect(options.confirmNotAlreadyPostedInERP).toBe(true); // the lookup is the check; the entity persists it
    expect(options.erpNotPostedBasis).toBe('ERPLookup');
    expect(g.recordCancellation).toHaveBeenCalledWith(
      BATCH_ID, { reason: 'Wrong period', fromStatus: 'Failed', erpCheck: 'The ERP lookup found nothing posted under document JEB-0183.' }, USER);
    expect(batch.Status).toBe('Cancelled');
  });

  // #206: the only journal under the number is another batch's, so this batch did not post.
  it('cancels without the operator\'s word when the ERP holds only another batch\'s journal under the number', async () => {
    const { batch, provider } = world('Failed');
    const g = use(gate({ allowed: true }), lookupOf({ status: 'Foreign', detail: 'its lines carry the token of batch other-batch.' }));

    await cancelJournalEntryBatch(BATCH_ID, USER, provider, { reason: 'Wrong period' });

    const [, options] = batch.Cancel.mock.calls[0] as [UserInfo, JournalEntryBatchCancelOptions];
    expect(options.erpNotPostedBasis).toBe('ERPLookup');
    expect(g.recordCancellation).toHaveBeenCalledWith(BATCH_ID, {
      reason: 'Wrong period', fromStatus: 'Failed',
      erpCheck: 'The ERP lookup found only another batch\'s journal under document JEB-0183: its lines carry the token of batch other-batch.',
    }, USER);
    expect(batch.Status).toBe('Cancelled');
  });

  const unsettled: ErpJournalLookupResult[] = [
    { status: 'Mismatch', detail: 'BC holds 3 lines, the batch has 2.' },
    { status: 'Error', error: 'BC timed out.' },
    { status: 'Unavailable' },
  ];

  it.each(unsettled)('refuses a $status lookup without the operator\'s confirmation, writing nothing', async (result) => {
    const { batch, provider } = world('Failed');
    const g = use(gate({ allowed: true }), lookupOf(result));

    const error = await cancelJournalEntryBatch(BATCH_ID, USER, provider, { reason: 'Wrong period' })
      .then(() => null, (e: unknown) => e);
    expect(error).toBeInstanceOf(ErpPostingUnconfirmedError);
    expect((error as ErpPostingUnconfirmedError).Kind).toBe(result.status);
    expect((error as ErpPostingUnconfirmedError).message).toMatch(/^cancelJournalEntryBatch: /);
    expect(batch.Cancel).not.toHaveBeenCalled();
    expect(g.recordCancellation).not.toHaveBeenCalled();
  });

  it.each(unsettled)('cancels a $status lookup once the operator confirms, and records why on the Task', async (result) => {
    const { batch, provider } = world('Failed');
    const g = use(gate({ allowed: true }), lookupOf(result));

    await cancelJournalEntryBatch(BATCH_ID, USER, provider, { reason: 'Wrong period', confirmNotAlreadyPostedInERP: true });

    expect(batch.Status).toBe('Cancelled');
    expect(g.recordCancellation).toHaveBeenCalledWith(
      BATCH_ID, { reason: 'Wrong period', fromStatus: 'Failed', erpCheck: expect.stringContaining(`(${result.status})`) }, USER);
    const [, options] = batch.Cancel.mock.calls[0] as [UserInfo, JournalEntryBatchCancelOptions];
    expect(options.erpNotPostedBasis).toBe('UserAttested');
  });

  it('treats a lookup that throws as unable to answer — the operator must confirm', async () => {
    const { batch, provider } = world('Failed');
    use(gate({ allowed: true }), vi.fn<ErpJournalLookup>(async () => { throw new Error('socket hang up'); }));

    await expect(cancelJournalEntryBatch(BATCH_ID, USER, provider, { reason: 'Wrong period' }))
      .rejects.toThrow(/could not check the ERP for document JEB-0183 before cancelling: socket hang up/);
    expect(batch.Cancel).not.toHaveBeenCalled();
  });

  it('never looks up an Approved batch — it has not been sent', async () => {
    const { batch, provider } = world('Approved');
    const lookup = lookupOf({ status: 'Found', externalJournalEntryBatchRef: 'X' });
    use(gate({ allowed: true }), lookup);

    await cancelJournalEntryBatch(BATCH_ID, USER, provider, { reason: 'Wrong period' });

    expect(lookup).not.toHaveBeenCalled();
    expect(batch.Status).toBe('Cancelled');
  });

  it('authorizes before asking the ERP anything', async () => {
    const { provider } = world('Failed');
    const lookup = lookupOf({ status: 'NotFound' });
    use(gate({ allowed: false }), lookup);

    await expect(cancelJournalEntryBatch(BATCH_ID, USER, provider, { reason: 'Wrong period' }))
      .rejects.toThrow(/configured approver/);
    expect(lookup).not.toHaveBeenCalled();
  });
});
