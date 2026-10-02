/**
 * #183 / #233 / #214 — who may cancel a batch, and where that is enforced.
 *
 *   · JournalEntryBatchEntityServer.Cancel authorizes itself (#214): it resolves its gate and ERP
 *     lookup through JournalEntryBatchDispatchServices (#233), so neither cancelJournalEntryBatch's
 *     caller nor a direct caller of Cancel() can pass them or skip them. These tests run the real
 *     entity against a fake registered at a higher priority, pointed at each test's gate and lookup.
 *   · a Pending cancel needs a rejection recorded on the approval Task; an Approved or Failed one
 *     must pass the gate's authorization, and records itself on the approval Task inside Cancel's
 *     transaction.
 *   · a Failed cancel looks the batch number up in the ERP first (#207): a posting it holds refuses
 *     the cancel outright, nothing found lets it through, and anything else needs the operator.
 *   The remote operation is covered in CancelJournalEntryBatchOperation.test.ts; the cancel's
 *   mechanics (order, rollback) in JournalEntryBatchInvariants.test.ts.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach, type Mock } from 'vitest';
import { BaseEntity, EntityInfo, Metadata, type IMetadataProvider, type UserInfo } from '@memberjunction/core';
import { MJGlobal } from '@memberjunction/global';

import {
  cancelJournalEntryBatch,
  ErpPostingUnconfirmedError,
  type ErpJournalLookup,
  type ErpJournalLookupResult,
  type JournalEntryBatchCancelGate,
} from '../JournalEntryBatchEngine.js';
import { JournalEntryBatchDispatchServices } from '../JournalEntryBatchDispatchServices.js';
import { JournalEntryBatchEntityServer } from '../JournalEntryBatchEntityServer.js';
import { TasksAppApprovalGate } from '../TasksAppApprovalGate.js';

const USER = { ID: 'USER-1' } as UserInfo;
const BATCH_ID = 'bbbbbbbb-0000-4000-8000-000000000183';
const BATCH_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Batches';
const SENT_AT = new Date('2026-09-30T12:00:00Z');

const BATCH_FIELDS = [
  'ID', 'JournalEntryBatchNumber', 'CompanyID', 'PostingDate', 'SummaryJournalEntryID', 'TargetSystem',
  'BatchedAt', 'BatchedByUserID', 'Status', 'TotalEntries', 'TotalDebits', 'TotalCredits',
  'ApprovedAt', 'ApprovedByUserID', 'ArchiveReason', 'ArchivedAt', 'ArchivedByUserID',
  'CancelReason', 'CancelledAt', 'CancelledByUserID', 'ApprovedContentHash',
  'ERPNotPostedConfirmedAt', 'ERPNotPostedConfirmedByUserID', 'ERPNotPostedBasis',
  'SentAt', 'SentByUserID', 'SendAttemptCount', 'ErrorMessage',
];

/** EntityInfo for the batch, enough for a real entity to read and write its fields with no database. */
function batchEntityInfo(): EntityInfo {
  const info = Object.create(EntityInfo.prototype) as EntityInfo & Record<string, unknown>;
  Object.assign(info, { ID: 'id-batch', Name: BATCH_ENTITY, Status: 'Active', AllowDirectSQL: true });
  const fields = BATCH_FIELDS.map(name => ({
    Name: name, CodeName: name, TSType: 'string', AutoIncrement: false, ReadOnly: false, AllowsNull: true,
    Type: name.endsWith('ID') ? 'uniqueidentifier' : 'nvarchar', IsPrimaryKey: name === 'ID',
    ValueIsPermittedByValueList: () => true,
  }));
  Object.defineProperty(info, 'Fields', { get: () => fields, configurable: true });
  Object.defineProperty(info, 'PrimaryKeys', { get: () => fields.filter(f => f.IsPrimaryKey), configurable: true });
  Object.defineProperty(info, 'HasInactiveFields', { get: () => false, configurable: true });
  return info;
}

interface World {
  batch: JournalEntryBatchEntityServer;
  provider: IMetadataProvider;
  /** The summary teardown Cancel runs after its save. Never called means nothing was released. */
  teardown: Mock<JournalEntryBatchEntityServer['ReleaseMembersAndDeleteSummary']>;
}

/**
 * A real batch loaded at `status`. Saves pass when the batch's own Validate() passes, so a cancel
 * missing its audit or ERP attestation fails here as it would against the database.
 */
function world(status: string): World {
  const info = batchEntityInfo();
  Metadata.Provider = { Entities: [info], FindEntityByName: () => info, Config: { ActiveStatusAssertions: false } } as unknown as typeof Metadata.Provider;
  const batch = new JournalEntryBatchEntityServer(info);
  batch.NewRecord();
  const sent = status === 'Failed' ? { SentAt: SENT_AT, SendAttemptCount: 1 } : {};
  const approved = status === 'Pending' ? {} : { ApprovedAt: new Date('2026-09-29T12:00:00Z'), ApprovedByUserID: 'U-APPROVER' };
  batch.SetMany({ ID: BATCH_ID, JournalEntryBatchNumber: 'JEB-0183', Status: status, SummaryJournalEntryID: 'SUM1', ...approved, ...sent }, true, true);
  batch.Load = vi.fn(async () => true) as never;
  const teardown = vi.fn<JournalEntryBatchEntityServer['ReleaseMembersAndDeleteSummary']>().mockResolvedValue(undefined);
  batch.ReleaseMembersAndDeleteSummary = teardown;
  const provider = {
    GetEntityObject: async () => batch,
    RunView: vi.fn().mockResolvedValue({ Success: true, Results: [] }),
    BeginTransaction: vi.fn().mockResolvedValue(undefined),
    CommitTransaction: vi.fn().mockResolvedValue(undefined),
    RollbackTransaction: vi.fn().mockResolvedValue(undefined),
  } as unknown as IMetadataProvider;
  Object.defineProperty(batch, 'ProviderToUse', { configurable: true, get: () => provider });
  return { batch, provider, teardown };
}

let save: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  save = vi.spyOn(BaseEntity.prototype, 'Save').mockImplementation(function (this: BaseEntity) {
    return Promise.resolve(this.Validate().Success);
  });
});
afterEach(() => save.mockRestore());

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

/** What the registered fake hands the entity for the current test. Unset outside a test. */
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

/** Nothing written: no save, no release, no Task record, and the batch still reads `status`. */
function expectUntouched({ batch, teardown }: World, status: string, g?: FakeGate): void {
  expect(save).not.toHaveBeenCalled();
  expect(teardown).not.toHaveBeenCalled();
  if (g) expect(g.recordCancellation).not.toHaveBeenCalled();
  expect(batch.Status).toBe(status);
}

describe('cancelJournalEntryBatch — the gate and lookup are resolved, never passed (#233)', () => {
  it('uses the registered services, not anything the caller passes', async () => {
    const w = world('Approved');
    const g = use(gate({ allowed: true }));
    // A caller that still passes a gate: not part of the options any more, so it is ignored.
    const permissive = { assertRejected: vi.fn(), assertMayCancelApproved: vi.fn(), recordCancellation: vi.fn() };
    await cancelJournalEntryBatch(BATCH_ID, USER, w.provider, { reason: 'Wrong period', gate: permissive } as never);

    expect(g.assertMayCancelApproved).toHaveBeenCalledWith(BATCH_ID, USER);
    expect(permissive.assertMayCancelApproved).not.toHaveBeenCalled();
    expect(w.batch.Status).toBe('Cancelled');
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
    const w = world('Pending');
    const g = use(gate({ allowed: false, rejected: true }));
    await cancelJournalEntryBatch(BATCH_ID, USER, w.provider);

    expect(g.assertRejected).toHaveBeenCalledWith(BATCH_ID, USER);
    expect(g.assertMayCancelApproved).not.toHaveBeenCalled();
    expect(g.recordCancellation).not.toHaveBeenCalled(); // the rejection is the record
    expect(w.teardown).toHaveBeenCalledWith('SUM1', USER);
    expect(w.batch.Status).toBe('Cancelled');
  });

  it('refuses a Pending batch nobody rejected, before anything is written', async () => {
    const w = world('Pending');
    use(gate({ allowed: true, rejected: false }));
    await expect(cancelJournalEntryBatch(BATCH_ID, USER, w.provider)).rejects.toThrow(/is not rejected/);
    expectUntouched(w, 'Pending');
  });
});

describe('cancelJournalEntryBatch — authorizing a cancel past approval', () => {
  it('refuses a user the gate does not allow, before anything is written', async () => {
    const w = world('Approved');
    const g = use(gate({ allowed: false }));
    await expect(cancelJournalEntryBatch(BATCH_ID, USER, w.provider, { reason: 'Wrong period' })).rejects.toThrow(/configured approver/);
    expect(g.assertRejected).not.toHaveBeenCalled();
    expectUntouched(w, 'Approved', g);
  });

  // The gate's refusals include a canceller with no linked Person to record the cancel (#212).
  it('refuses a Failed batch the gate does not allow before the ERP lookup runs', async () => {
    const w = world('Failed');
    const lookup = lookupOf({ status: 'NotFound' });
    use(gate({ allowed: false }), lookup);
    await expect(cancelJournalEntryBatch(BATCH_ID, USER, w.provider, { reason: 'Wrong period' })).rejects.toThrow(/configured approver/);
    expect(lookup).not.toHaveBeenCalled();
    expectUntouched(w, 'Failed');
  });

  it('cancels for an allowed user and records the cancel on the Task inside the cancel', async () => {
    const w = world('Failed');
    const g = use(gate({ allowed: true }));
    await cancelJournalEntryBatch(BATCH_ID, USER, w.provider, { reason: 'Wrong period', confirmNotAlreadyPostedInERP: true });

    expect(g.assertMayCancelApproved).toHaveBeenCalledWith(BATCH_ID, USER);
    // An ERP that offers no lookup, so the operator's confirmation stands.
    expect(g.recordCancellation).toHaveBeenCalledWith(
      BATCH_ID,
      { reason: 'Wrong period', fromStatus: 'Failed', erpCheck: expect.stringMatching(/confirmed document JEB-0183 had not posted.*\(Unavailable\)/) },
      USER,
    );
    expect(w.batch.ERPNotPostedBasis).toBe('UserAttested');
    expect(w.batch.ERPNotPostedConfirmedByUserID).toBe(USER.ID);
    expect(w.batch.Status).toBe('Cancelled');
  });

  it('records the status the batch was cancelled FROM, not what it reads after the cancel', async () => {
    const w = world('Approved');
    const g = use(gate({ allowed: true }));
    await cancelJournalEntryBatch(BATCH_ID, USER, w.provider, { reason: 'Wrong period' });

    expect(w.batch.Status).toBe('Cancelled');
    expect(g.recordCancellation).toHaveBeenCalledWith(BATCH_ID, { reason: 'Wrong period', fromStatus: 'Approved', erpCheck: undefined }, USER);
    expect(w.batch.ERPNotPostedBasis).toBeNull(); // never sent, so there is no ERP check to record
  });

  it('rolls the cancel back when recording it on the Task fails', async () => {
    const w = world('Approved');
    const g = use(gate({ allowed: true }));
    g.recordCancellation.mockRejectedValue(new Error('Task comment save failed'));
    await expect(cancelJournalEntryBatch(BATCH_ID, USER, w.provider, { reason: 'Wrong period' })).rejects.toThrow('Task comment save failed');

    const db = w.provider as unknown as { RollbackTransaction: Mock; CommitTransaction: Mock };
    expect(db.RollbackTransaction).toHaveBeenCalledTimes(1);
    expect(db.CommitTransaction).not.toHaveBeenCalled();
    expect(w.batch.Load).toHaveBeenCalledWith(BATCH_ID);
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
    const w = world('Failed');
    const g = use(gate({ allowed: true }), lookupOf({ status: 'Found', externalJournalEntryBatchRef: 'JEB-0183' }));

    await expect(cancelJournalEntryBatch(BATCH_ID, USER, w.provider, { reason: 'Wrong period', confirmNotAlreadyPostedInERP: confirm }))
      .rejects.toThrow(/matches this batch, so the batch posted.*Retry it from Dispatch status/);
    expectUntouched(w, 'Failed', g);
  });

  it('cancels without the operator\'s word when the ERP holds nothing under the number, and says so on the Task', async () => {
    const w = world('Failed');
    const g = use(gate({ allowed: true }), lookupOf({ status: 'NotFound' }));

    await cancelJournalEntryBatch(BATCH_ID, USER, w.provider, { reason: 'Wrong period' });

    expect(w.batch.ERPNotPostedBasis).toBe('ERPLookup'); // the lookup is the check; the entity persists it
    expect(w.batch.ERPNotPostedConfirmedAt).toBeInstanceOf(Date);
    expect(g.recordCancellation).toHaveBeenCalledWith(
      BATCH_ID, { reason: 'Wrong period', fromStatus: 'Failed', erpCheck: 'The ERP lookup found nothing posted under document JEB-0183.' }, USER);
    expect(w.batch.Status).toBe('Cancelled');
  });

  // #206: the only journal under the number is another batch's, so this batch did not post.
  it('cancels without the operator\'s word when the ERP holds only another batch\'s journal under the number', async () => {
    const w = world('Failed');
    const g = use(gate({ allowed: true }), lookupOf({ status: 'Foreign', detail: 'its lines carry the token of batch other-batch.' }));

    await cancelJournalEntryBatch(BATCH_ID, USER, w.provider, { reason: 'Wrong period' });

    expect(w.batch.ERPNotPostedBasis).toBe('ERPLookup');
    expect(g.recordCancellation).toHaveBeenCalledWith(BATCH_ID, {
      reason: 'Wrong period', fromStatus: 'Failed',
      erpCheck: 'The ERP lookup found only another batch\'s journal under document JEB-0183: its lines carry the token of batch other-batch.',
    }, USER);
    expect(w.batch.Status).toBe('Cancelled');
  });

  const unsettled: ErpJournalLookupResult[] = [
    { status: 'Mismatch', detail: 'BC holds 3 lines, the batch has 2.' },
    { status: 'Error', error: 'BC timed out.' },
    { status: 'Unavailable' },
  ];

  it.each(unsettled)('refuses a $status lookup without the operator\'s confirmation, writing nothing', async (result) => {
    const w = world('Failed');
    const g = use(gate({ allowed: true }), lookupOf(result));

    const error = await cancelJournalEntryBatch(BATCH_ID, USER, w.provider, { reason: 'Wrong period' })
      .then(() => null, (e: unknown) => e);
    expect(error).toBeInstanceOf(ErpPostingUnconfirmedError);
    expect((error as ErpPostingUnconfirmedError).Kind).toBe(result.status);
    expect((error as ErpPostingUnconfirmedError).message).toMatch(/^cancelJournalEntryBatch: /);
    expectUntouched(w, 'Failed', g);
  });

  it('says why a lookup that cannot be trusted refuses the cancel (#205)', async () => {
    const w = world('Failed');
    use(gate({ allowed: true }), lookupOf({ status: 'Unavailable', reason: 'the ERP accepted 1 batch(es) in this company that could not then be read back (batch-earlier).' }));

    await expect(cancelJournalEntryBatch(BATCH_ID, USER, w.provider, { reason: 'Wrong period' }))
      .rejects.toThrow(/the ERP lookup cannot be trusted to find it: the ERP accepted 1 batch\(es\)/);
    expectUntouched(w, 'Failed');
  });

  it.each(unsettled)('cancels a $status lookup once the operator confirms, and records why on the Task', async (result) => {
    const w = world('Failed');
    const g = use(gate({ allowed: true }), lookupOf(result));

    await cancelJournalEntryBatch(BATCH_ID, USER, w.provider, { reason: 'Wrong period', confirmNotAlreadyPostedInERP: true });

    expect(w.batch.Status).toBe('Cancelled');
    expect(g.recordCancellation).toHaveBeenCalledWith(
      BATCH_ID, { reason: 'Wrong period', fromStatus: 'Failed', erpCheck: expect.stringContaining(`(${result.status})`) }, USER);
    expect(w.batch.ERPNotPostedBasis).toBe('UserAttested');
  });

  it('treats a lookup that throws as unable to answer — the operator must confirm', async () => {
    const w = world('Failed');
    use(gate({ allowed: true }), vi.fn<ErpJournalLookup>(async () => { throw new Error('socket hang up'); }));

    await expect(cancelJournalEntryBatch(BATCH_ID, USER, w.provider, { reason: 'Wrong period' }))
      .rejects.toThrow(/could not check the ERP for document JEB-0183 before cancelling: socket hang up/);
    expectUntouched(w, 'Failed');
  });

  it('never looks up an Approved batch — it has not been sent', async () => {
    const w = world('Approved');
    const lookup = lookupOf({ status: 'Found', externalJournalEntryBatchRef: 'X' });
    use(gate({ allowed: true }), lookup);

    await cancelJournalEntryBatch(BATCH_ID, USER, w.provider, { reason: 'Wrong period' });

    expect(lookup).not.toHaveBeenCalled();
    expect(w.batch.Status).toBe('Cancelled');
  });
});

// #214: the entity is exported, so a server caller can load it and call Cancel() itself. The rules
// above live in Cancel(), so that caller meets every one of them.
describe('JournalEntryBatchEntityServer.Cancel() called directly runs the same checks (#214)', () => {
  it('still looks the batch up in the ERP when the caller confirms, and refuses a posting it holds', async () => {
    const w = world('Failed');
    const lookup = lookupOf({ status: 'Found', externalJournalEntryBatchRef: 'JEB-0183' });
    const g = use(gate({ allowed: true }), lookup);

    await expect(w.batch.Cancel(USER, { reason: 'Wrong period', confirmNotAlreadyPostedInERP: true }))
      .rejects.toThrow(/so the batch posted/);
    expect(g.assertMayCancelApproved).toHaveBeenCalledWith(BATCH_ID, USER);
    expect(lookup).toHaveBeenCalledTimes(1);
    expectUntouched(w, 'Failed', g);
  });

  it('still asks the gate when the caller confirms, and refuses a user it does not allow', async () => {
    const w = world('Failed');
    const lookup = lookupOf({ status: 'NotFound' });
    use(gate({ allowed: false }), lookup);

    await expect(w.batch.Cancel(USER, { reason: 'Wrong period', confirmNotAlreadyPostedInERP: true })).rejects.toThrow(/configured approver/);
    expect(lookup).not.toHaveBeenCalled();
    expectUntouched(w, 'Failed');
  });

  it('refuses a Pending batch nobody rejected', async () => {
    const w = world('Pending');
    use(gate({ allowed: true, rejected: false }));
    await expect(w.batch.Cancel(USER)).rejects.toThrow(/is not rejected/);
    expectUntouched(w, 'Pending');
  });

  it('records the cancel on the approval Task without being asked', async () => {
    const w = world('Approved');
    const g = use(gate({ allowed: true }));
    await w.batch.Cancel(USER, { reason: 'Wrong period' });
    expect(g.recordCancellation).toHaveBeenCalledWith(BATCH_ID, { reason: 'Wrong period', fromStatus: 'Approved', erpCheck: undefined }, USER);
    expect(w.batch.Status).toBe('Cancelled');
  });

  it('takes the ERP basis from its own lookup, not from the caller', async () => {
    const w = world('Failed');
    use(gate({ allowed: true }), lookupOf({ status: 'Error', error: 'BC timed out.' }));
    // The options no longer carry a basis or a hook; a caller that still passes them changes nothing.
    const onCancelled = vi.fn();
    await w.batch.Cancel(USER, { reason: 'Wrong period', confirmNotAlreadyPostedInERP: true, erpNotPostedBasis: 'ERPLookup', onCancelled } as never);

    expect(w.batch.ERPNotPostedBasis).toBe('UserAttested');
    expect(onCancelled).not.toHaveBeenCalled();
  });
});
