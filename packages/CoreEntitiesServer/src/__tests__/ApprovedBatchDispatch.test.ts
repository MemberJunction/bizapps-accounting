/**
 * Sending every Approved batch (bc-aidp-next-golive#451): the shared selection and send behind the
 * hourly dispatch action and the Batches page's Send approved batches operation. The engine's send is
 * mocked: what is under test is which batches reach it, in what order, and what each one reports.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AuthorizationInfo, IMetadataProvider, RunViewParams, UserInfo } from '@memberjunction/core';
import { JOURNAL_ENTRY_BATCH_OPERATE_AUTH } from '@mj-biz-apps/accounting-engine-base';
import { approvedBatchFilter, dispatchApprovedJournalEntryBatches } from '../ApprovedBatchDispatch.js';
import {
  DispatchApprovedJournalEntryBatchesOperation,
  type DispatchApprovedJournalEntryBatchesInput,
} from '../JournalEntryBatchOperations.js';
import { JournalEntryBatchSendRefusedError, sendJournalEntryBatch } from '../JournalEntryBatchEngine.js';

vi.mock('../JournalEntryBatchEngine.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../JournalEntryBatchEngine.js')>();
  return { ...actual, sendJournalEntryBatch: vi.fn() };
});

const sendSpy = vi.mocked(sendJournalEntryBatch);

const CO_1 = '11111111-1111-4111-8111-111111111111';
const CO_2 = '22222222-2222-4222-8222-222222222222';
const FINANCE_USER = { ID: 'U-FINANCE' } as UserInfo;
const OTHER_USER = { ID: 'U-OTHER' } as UserInfo;

const row = (n: number, companyId = CO_1) => ({ ID: `B-${n}`, JournalEntryBatchNumber: `BATCH-00000${n}`, CompanyID: companyId, Company: `Company ${companyId.slice(0, 1)}` });

/** A batch as sendJournalEntryBatch returns it. */
const sentBatch = (status: string, errorMessage: string | null = null) =>
  ({ Status: status, ErrorMessage: errorMessage }) as unknown as Awaited<ReturnType<typeof sendJournalEntryBatch>>;

/** A provider whose view read answers `rows` and whose catalog grants the batch-operator Authorization to FINANCE_USER only. */
function providerWith(rows: Array<ReturnType<typeof row>>, readOk = true) {
  const auth = { ID: 'AUTH-OPERATE', Name: JOURNAL_ENTRY_BATCH_OPERATE_AUTH, ParentID: null, UserCanExecute: (u: UserInfo) => u.ID === FINANCE_USER.ID };
  const runView = vi.fn(async (_params: RunViewParams, _user?: UserInfo) => (readOk ? { Success: true, Results: rows } : { Success: false, ErrorMessage: 'timeout' }));
  const provider = { Authorizations: [auth] as unknown as AuthorizationInfo[], RunView: runView } as unknown as IMetadataProvider;
  return { provider, runView };
}

/** Exposes the protected entry point; the op's own Execute wrapper is not what is under test. */
class ProbeOperation extends DispatchApprovedJournalEntryBatchesOperation {
  public Run(input: DispatchApprovedJournalEntryBatchesInput, provider: IMetadataProvider, user: UserInfo) {
    return this.InternalExecute(input, provider, user);
  }
}

describe('dispatchApprovedJournalEntryBatches', () => {
  beforeEach(() => sendSpy.mockReset());

  it('sends every Approved batch, oldest approval first, through the per-batch send, with no ERP confirmation', async () => {
    const { provider, runView } = providerWith([row(1), row(2, CO_2)]);
    sendSpy.mockResolvedValue(sentBatch('Posted'));

    const outcomes = await dispatchApprovedJournalEntryBatches({ targetSystem: null, companyIds: null }, FINANCE_USER, provider);

    expect(runView.mock.calls[0][0]).toMatchObject({ ExtraFilter: `Status='Approved'`, OrderBy: 'ApprovedAt ASC', BypassCache: true });
    expect(sendSpy.mock.calls.map(c => c[0])).toEqual(['B-1', 'B-2']);
    expect(sendSpy.mock.calls[0][2]).toEqual({ provider });
    expect(outcomes.map(o => o.status)).toEqual(['Posted', 'Posted']);
    expect(outcomes[1]).toMatchObject({ companyId: CO_2, company: 'Company 2', needsAttention: false });
  });

  it('keeps going after a batch fails and reports each one', async () => {
    const { provider } = providerWith([row(1), row(2), row(3), row(4)]);
    sendSpy
      .mockResolvedValueOnce(sentBatch('Failed', 'The ERP rejected the journal: posting date is closed.'))
      .mockRejectedValueOnce(new Error('The batch was not sent: batch BATCH-000002 no longer matches its approved content.'))
      .mockRejectedValueOnce(new JournalEntryBatchSendRefusedError('B-3', 'Sent', 'refused'))
      .mockResolvedValueOnce(sentBatch('Posted'));

    const outcomes = await dispatchApprovedJournalEntryBatches({ targetSystem: null, companyIds: null }, FINANCE_USER, provider);

    expect(outcomes.map(o => [o.status, o.needsAttention, o.takenByAnotherSend])).toEqual([
      ['Failed', true, false],
      ['Approved', true, false],
      ['Sent', false, true],
      ['Posted', false, false],
    ]);
    expect(outcomes[0].error).toContain('posting date is closed');
    expect(outcomes[1].error).toContain('no longer matches its approved content');
  });

  it('throws, sending nothing, when the batches cannot be read', async () => {
    const { provider } = providerWith([], false);

    await expect(dispatchApprovedJournalEntryBatches({ targetSystem: null, companyIds: null }, FINANCE_USER, provider))
      .rejects.toThrow(/could not be read: timeout/);
    expect(sendSpy).not.toHaveBeenCalled();
  });
});

describe('approvedBatchFilter', () => {
  it('narrows to a target ERP and to companies', () => {
    expect(approvedBatchFilter({ targetSystem: 'BusinessCentral', companyIds: [CO_1, CO_2] }))
      .toBe(`Status='Approved' AND TargetSystem='BusinessCentral' AND CompanyID IN ('${CO_1}','${CO_2}')`);
  });

  it('treats an empty company list as no narrowing', () => {
    expect(approvedBatchFilter({ targetSystem: null, companyIds: [] })).toBe(`Status='Approved'`);
  });

  it('refuses a target ERP outside the known set and a company that is not an ID', () => {
    expect(() => approvedBatchFilter({ targetSystem: "x' OR 1=1 --" as never, companyIds: null })).toThrow(/is not a target ERP/);
    expect(() => approvedBatchFilter({ targetSystem: null, companyIds: ["x' OR 1=1 --"] })).toThrow(/not a valid UUID/);
  });
});

describe('DispatchApprovedJournalEntryBatchesOperation (golive #451)', () => {
  beforeEach(() => sendSpy.mockReset());

  it('carries the key and the ERP scope', () => {
    const op = new DispatchApprovedJournalEntryBatchesOperation();
    expect(op.OperationKey).toBe('Accounting.DispatchApprovedJournalEntryBatches');
    expect(op.RequiredScope).toBe('accounting:post');
  });

  it('refuses a user without the batch-operator Authorization, before reading any batch', async () => {
    const { provider, runView } = providerWith([row(1)]);

    await expect(new ProbeOperation().Run({}, provider, OTHER_USER))
      .rejects.toThrow(`DispatchApprovedJournalEntryBatches: requires the ${JOURNAL_ENTRY_BATCH_OPERATE_AUTH} authorization`);
    expect(runView).not.toHaveBeenCalled();
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it('answers an empty list when no batch is Approved', async () => {
    const { provider } = providerWith([]);

    await expect(new ProbeOperation().Run({}, provider, FINANCE_USER)).resolves.toEqual({ Batches: [], PostedCount: 0 });
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it('reports each batch of a mixed run: posted, rejected by the ERP, refused, and taken by another send', async () => {
    const { provider } = providerWith([row(1), row(2, CO_2), row(3), row(4)]);
    sendSpy
      .mockResolvedValueOnce(sentBatch('Posted'))
      .mockResolvedValueOnce(sentBatch('Failed', 'The ERP rejected the journal: posting date is closed.'))
      .mockRejectedValueOnce(new Error('The batch was not sent: it is not approved.'))
      .mockRejectedValueOnce(new JournalEntryBatchSendRefusedError('B-4', 'Posted', 'refused'));

    const out = await new ProbeOperation().Run({}, provider, FINANCE_USER);

    expect(out.PostedCount).toBe(2);
    expect(out.Batches).toEqual([
      { JournalEntryBatchID: 'B-1', JournalEntryBatchNumber: 'BATCH-000001', CompanyID: CO_1, Company: 'Company 1', Status: 'Posted', Posted: true, Message: null },
      { JournalEntryBatchID: 'B-2', JournalEntryBatchNumber: 'BATCH-000002', CompanyID: CO_2, Company: 'Company 2', Status: 'Failed', Posted: false, Message: 'The ERP rejected the journal: posting date is closed.' },
      { JournalEntryBatchID: 'B-3', JournalEntryBatchNumber: 'BATCH-000003', CompanyID: CO_1, Company: 'Company 1', Status: 'Approved', Posted: false, Message: 'The batch was not sent: it is not approved.' },
      // Another send got there first and posted it: it is Posted, and the message says this run did not send it.
      { JournalEntryBatchID: 'B-4', JournalEntryBatchNumber: 'BATCH-000004', CompanyID: CO_1, Company: 'Company 1', Status: 'Posted', Posted: true, Message: 'Another send took this batch first; it is now Posted.' },
    ]);
  });

  it('narrows to the given companies', async () => {
    const { provider, runView } = providerWith([row(2, CO_2)]);
    sendSpy.mockResolvedValue(sentBatch('Posted'));

    await new ProbeOperation().Run({ CompanyIDs: [CO_2] }, provider, FINANCE_USER);

    expect(runView.mock.calls[0][0]).toMatchObject({ ExtraFilter: `Status='Approved' AND CompanyID IN ('${CO_2}')` });
  });

  it('refuses a company that is not an ID, sending nothing', async () => {
    const { provider } = providerWith([row(1)]);

    await expect(new ProbeOperation().Run({ CompanyIDs: ["x' OR 1=1 --"] }, provider, FINANCE_USER)).rejects.toThrow(/not a valid UUID/);
    expect(sendSpy).not.toHaveBeenCalled();
  });
});
