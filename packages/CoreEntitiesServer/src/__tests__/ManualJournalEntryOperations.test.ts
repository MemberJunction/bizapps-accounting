/**
 * golive #353 — Accounting.RecordManualJournalEntryDecision. The operation only validates its input
 * and hands off to ManualJournalEntryApprovalService (tested in ManualJournalEntryApproval.test.ts),
 * so these cover the refusals at the boundary and the hand-off.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IMetadataProvider, RemoteOpServerContext, UserInfo } from '@memberjunction/core';

const service = vi.hoisted(() => ({ recordDecision: vi.fn() }));
vi.mock('../ManualJournalEntryApproval.js', () => ({
  ManualJournalEntryApprovalService: class {
    RecordDecision = service.recordDecision;
  },
}));

import { RecordManualJournalEntryDecisionOperation } from '../ManualJournalEntryOperations.js';

const JE_ID = '77777777-7777-4777-8777-777777777777';
const APPROVER = { ID: '44444444-4444-4444-8444-444444444444' } as UserInfo;
const context = { provider: {} as IMetadataProvider, user: APPROVER } as unknown as RemoteOpServerContext;
const run = (input: Record<string, unknown>) =>
  new RecordManualJournalEntryDecisionOperation().ExecuteServer(input as never, context);

describe('Accounting.RecordManualJournalEntryDecision', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    ['no journal entry', { Decision: 'Approved' }, /no journal entry was given/],
    ['an id that is not a GUID', { JournalEntryID: "x' OR 1=1 --", Decision: 'Approved' }, /./],
    ['an unknown decision', { JournalEntryID: JE_ID, Decision: 'Maybe' }, /'Maybe' is not a valid decision/],
    ['a rejection without a reason', { JournalEntryID: JE_ID, Decision: 'Rejected', Notes: '   ' }, /a rejection needs a reason/],
  ])('refuses %s without reaching the service', async (_label, input, message) => {
    const result = await run(input);
    expect(result.Success).toBe(false);
    expect(result.ErrorMessage).toMatch(message);
    expect(service.recordDecision).not.toHaveBeenCalled();
  });

  it('hands an approval to the service and returns its timestamp', async () => {
    const approvedAt = new Date('2026-10-18T12:00:00.000Z');
    service.recordDecision.mockResolvedValue({ Approved: true, ApprovedAt: approvedAt });
    const result = await run({ JournalEntryID: JE_ID, Decision: 'Approved' });
    expect(result.Success).toBe(true);
    expect(result.Output).toEqual({ Approved: true, ApprovedAt: approvedAt.toISOString() });
    expect(service.recordDecision).toHaveBeenCalledWith(JE_ID, 'Approved', undefined, APPROVER);
  });

  it('hands a rejection with its reason to the service', async () => {
    service.recordDecision.mockResolvedValue({ Approved: false, ApprovedAt: null });
    const result = await run({ JournalEntryID: JE_ID, Decision: 'Rejected', Notes: 'Wrong account' });
    expect(result.Output).toEqual({ Approved: false, ApprovedAt: null });
    expect(service.recordDecision).toHaveBeenCalledWith(JE_ID, 'Rejected', 'Wrong account', APPROVER);
  });

  it("surfaces the service's refusal as a failed operation", async () => {
    service.recordDecision.mockRejectedValue(new Error('Journal entry JE-1: you raised this approval request'));
    const result = await run({ JournalEntryID: JE_ID, Decision: 'Approved' });
    expect(result.Success).toBe(false);
    expect(result.ErrorMessage).toMatch(/you raised this approval request/);
  });
});
