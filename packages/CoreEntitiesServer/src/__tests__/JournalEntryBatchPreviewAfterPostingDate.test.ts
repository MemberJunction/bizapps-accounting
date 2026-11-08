/**
 * golive #448: an entry dated after the batch's posting date is never a candidate (golive #315), and
 * the preview now says so, counting and listing those entries with the reason, next to the posting
 * start and approval exclusions. Only what the posting date alone holds back is reported: an entry a
 * tighter cutoff leaves out, one before its posting start date, or one awaiting approval is not.
 */
import { describe, it, expect } from 'vitest';
import { AfterPostingDateReason, previewBatch } from '../JournalEntryBatchEngine.js';
import { inMemoryProvider, journal, profile, testUser, type JournalRow } from './helpers/in-memory-journal-provider.js';

const CO_A = 'aaaaaaaa-0000-0000-0000-000000000001';
const CO_B = 'bbbbbbbb-0000-0000-0000-000000000002';

/** Oldest first, as the preview's read orders them. */
const JOURNALS: JournalRow[] = [
  journal('oct-15', CO_A, '2026-10-15'),
  journal('oct-30', CO_A, '2026-10-30'),
  journal('nov-01-payment', CO_A, '2026-11-01', { Description: 'Wire received 10/30' }),
  journal('nov-01-awaiting', CO_A, '2026-11-01', { ApprovalLevel: 'Standard' }),
  journal('nov-05-other-co', CO_B, '2026-11-05'),
  journal('dec-31-revrec', CO_A, '2026-12-31'),
];

async function preview(options: Parameters<typeof previewBatch>[0], journals: JournalRow[] = JOURNALS) {
  const { provider } = inMemoryProvider({ journals, profiles: [profile(CO_B, '2026-11-10')] });
  return previewBatch(options, testUser, provider);
}

describe('previewBatch — entries dated after the posting date', () => {
  it('counts and lists them oldest first with the reason, leaving them out of the candidates', async () => {
    const result = await preview({ postingDate: '2026-10-30' });
    expect(result.Candidates.map(c => c.ID)).toEqual(['oct-15', 'oct-30']);
    // nov-01-awaiting is held back by approval, nov-05-other-co by its company's posting start date.
    expect(result.AfterPostingDateCount).toBe(2);
    expect(result.AfterPostingDateEntries.map(e => e.ID)).toEqual(['nov-01-payment', 'dec-31-revrec']);
    expect(result.AfterPostingDateEntries[0]).toMatchObject({
      EntryNumber: 'JE-nov-01-payment',
      Description: 'Wire received 10/30',
      EntryTypeCode: 'Manual',
      Reason: 'Dated 2026-11-01, after the posting date 2026-10-30: it waits for a batch posted on or after 2026-11-01.',
    });
  });

  it('stops at a cutoff later than the posting date', async () => {
    const result = await preview({ postingDate: '2026-10-30', cutoff: '2026-11-30' });
    expect(result.AfterPostingDateEntries.map(e => e.ID)).toEqual(['nov-01-payment']);
  });

  it('reports nothing when a cutoff on or before the posting date is the tighter bound', async () => {
    const result = await preview({ postingDate: '2026-10-30', cutoff: '2026-10-20' });
    expect(result.Candidates.map(c => c.ID)).toEqual(['oct-15']);
    expect(result.AfterPostingDateCount).toBe(0);
    expect(result.AfterPostingDateEntries).toEqual([]);
  });

  it('keeps to the company scope', async () => {
    const result = await preview({ postingDate: '2026-10-30', companyIds: [CO_B] });
    expect(result.AfterPostingDateCount).toBe(0);
  });

  it('lists at most 50 but counts them all', async () => {
    const many = Array.from({ length: 60 }, (_, i) => journal(`late-${String(i).padStart(2, '0')}`, CO_A, '2026-11-02'));
    const result = await preview({ postingDate: '2026-10-30' }, many);
    expect(result.AfterPostingDateCount).toBe(60);
    expect(result.AfterPostingDateEntries).toHaveLength(50);
  });
});

describe('AfterPostingDateReason — pure', () => {
  it('names both days and the day a batch could take the entry', () => {
    expect(AfterPostingDateReason('2026-11-01', '2026-10-30')).toBe('Dated 2026-11-01, after the posting date 2026-10-30: it waits for a batch posted on or after 2026-11-01.');
  });
});
