/**
 * previewBatch's per-candidate Amount (#253).
 *
 * Amount is the entry's own Σ debits whether or not the operator ticked it. The totals, gross
 * totals and per-company subtotals follow the selection; the grid's money column does not. The
 * defect loaded the debit sums for the included rows only, so every unticked candidate read $0.00.
 */
import { describe, it, expect, vi } from 'vitest';
import type { IMetadataProvider, RunViewParams, UserInfo } from '@memberjunction/core';

const SUMMARY_TYPE_ID = 'e9521aa3-f4ef-4ec5-a899-d9dd59f320b7';

vi.mock('../JournalEntryTypes.js', () => ({
  GetJournalEntryBatchSummaryEntryType: async () => ({ ID: SUMMARY_TYPE_ID, Code: 'JournalEntryBatchSummary' }),
}));

const { previewBatch } = await import('../JournalEntryBatchEngine.js');

const COMPANY = '11111111-0000-0000-0000-000000000001';
const TYPE_ID = '22222222-0000-0000-0000-000000000001';
const GL_AR = '33333333-0000-0000-0000-000000000001';
const GL_REV = '33333333-0000-0000-0000-000000000002';
const JE_A = 'aaaaaaaa-0000-0000-0000-000000000001';
const JE_B = 'aaaaaaaa-0000-0000-0000-000000000002';

const entries = [
  { ID: JE_A, EntryNumber: 'JE-1', EffectiveDate: '2026-09-01', EntryTypeID: TYPE_ID, CompanyID: COMPANY, Description: null },
  { ID: JE_B, EntryNumber: 'JE-2', EffectiveDate: '2026-09-02', EntryTypeID: TYPE_ID, CompanyID: COMPANY, Description: null },
];
const lines = [
  { ID: 'l1', JournalEntryID: JE_A, GLAccountID: GL_AR, DebitAmount: 100, CreditAmount: 0 },
  { ID: 'l2', JournalEntryID: JE_A, GLAccountID: GL_REV, DebitAmount: 0, CreditAmount: 100 },
  { ID: 'l3', JournalEntryID: JE_B, GLAccountID: GL_AR, DebitAmount: 250.5, CreditAmount: 0 },
  { ID: 'l4', JournalEntryID: JE_B, GLAccountID: GL_REV, DebitAmount: 0, CreditAmount: 250.5 },
];

/** The ids inside the first `<field> IN (...)` of a filter. */
function idsIn(filter: string, field: string): Set<string> {
  const m = new RegExp(`${field} IN \\(([^)]*)\\)`).exec(filter);
  return new Set((m?.[1] ?? '').split(',').map(s => s.trim().replace(/'/g, '')).filter(Boolean));
}

/** A RunView fake that answers each preview read from the fixtures above, honoring the IN lists. */
function fakeProvider(): IMetadataProvider {
  const RunView = async (params: RunViewParams) => {
    const filter = typeof params.ExtraFilter === 'string' ? params.ExtraFilter : '';
    switch (params.EntityName) {
      case 'MJ_BizApps_Accounting: Journal Entries': {
        const ids = idsIn(filter, 'ID');
        return { Success: true, Results: ids.size > 0 ? entries.filter(e => ids.has(e.ID)) : entries };
      }
      case 'MJ_BizApps_Accounting: Journal Entry Lines': {
        const ids = idsIn(filter, 'JournalEntryID');
        return { Success: true, Results: lines.filter(l => ids.has(l.JournalEntryID)) };
      }
      case 'MJ_BizApps_Accounting: Journal Entry Types':
        return { Success: true, Results: [{ ID: TYPE_ID, Code: 'OrderBooking' }] };
      case 'MJ_BizApps_Accounting: GL Accounts':
        return { Success: true, Results: [{ ID: GL_AR, Code: '1100', Name: 'AR' }, { ID: GL_REV, Code: '4000', Name: 'Revenue' }] };
      default:
        return { Success: true, Results: [] };
    }
  };
  return { RunView } as unknown as IMetadataProvider;
}

const user = { ID: 'U1' } as unknown as UserInfo;

describe('previewBatch — candidate Amount ignores the selection', () => {
  it('an unticked candidate keeps its own Amount; the totals cover only the ticked ones', async () => {
    const result = await previewBatch({}, user, fakeProvider(), new Set([JE_A]));

    const amount = new Map(result.Candidates.map(c => [c.ID, c.Amount]));
    expect(amount.get(JE_A)).toBe(100);
    expect(amount.get(JE_B)).toBe(250.5);
    expect(result.GrossDebits).toBe(100);
    expect(result.GrossCredits).toBe(100);
  });

  it('nothing ticked: every candidate still shows its Amount and the totals are zero', async () => {
    const result = await previewBatch({}, user, fakeProvider(), new Set());

    expect(result.Candidates.map(c => c.Amount)).toEqual([100, 250.5]);
    expect(result.TotalDebits).toBe(0);
    expect(result.GrossDebits).toBe(0);
  });
});
