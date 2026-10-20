/**
 * golive #353 — a manual journal entry awaiting approval (an ApprovalLevel and no ApprovedAt) is in
 * no batch: not in the candidate pool of a build, preview or sweep, refused by name in an explicit
 * selection, and dropped with a warning from a view build. An approved one, and every entry that
 * never needed approval, batches as before.
 *
 * The reads run against the in-memory provider, which evaluates the emitted filter, so these assert
 * which entries are admitted, not how the SQL reads.
 */
import { describe, it, expect, vi } from 'vitest';
import type { IRunViewProvider } from '@memberjunction/core';
import {
  buildJournalEntryBatchFromExplicitIds,
  buildJournalEntryBatchFromView,
  IsAwaitingManualApproval,
  JournalEntryBatchFromViewError,
  pendingCandidateFilter,
  pendingCompanies,
  previewBatch,
} from '../JournalEntryBatchEngine.js';
import { inMemoryProvider, journal, testUser, JEL_ENTITY, type JournalRow } from './helpers/in-memory-journal-provider.js';

const CO_A = 'aaaaaaaa-0000-0000-0000-000000000001';
const CO_B = 'bbbbbbbb-0000-0000-0000-000000000002';

const id = (n: number) => `dddddddd-0000-0000-0000-${String(n).padStart(12, '0')}`;

const ORDINARY = journal(id(1), CO_A, '2026-09-01');
const AWAITING = journal(id(2), CO_A, '2026-09-02', { EntryNumber: 'JE-AWAITING', ApprovalLevel: 'Standard' });
const APPROVED = journal(id(3), CO_A, '2026-09-03', { ApprovalLevel: 'CFO', ApprovedAt: '2026-09-04T10:00:00Z' });
const ONLY_AWAITING_B = journal(id(4), CO_B, '2026-09-05', { EntryNumber: 'JE-B-AWAITING', ApprovalLevel: 'CFO' });
const JOURNALS: JournalRow[] = [ORDINARY, AWAITING, APPROVED, ONLY_AWAITING_B];

function providers(viewRows?: object[]) {
  const { provider, calls } = inMemoryProvider({ journals: JOURNALS, profiles: [], viewRows });
  return { provider, calls, p: { md: provider, rv: provider as unknown as IRunViewProvider } };
}

function lineLoadFilter(calls: Array<{ EntityName?: string; ExtraFilter?: string }>): string {
  return calls.filter(c => c.EntityName === JEL_ENTITY).map(c => c.ExtraFilter ?? '').join(' ');
}

describe('IsAwaitingManualApproval — pure', () => {
  it('is true only with a level and no approval', () => {
    expect(IsAwaitingManualApproval({ ApprovalLevel: 'Standard', ApprovedAt: null })).toBe(true);
    expect(IsAwaitingManualApproval({ ApprovalLevel: 'CFO', ApprovedAt: '2026-09-04T10:00:00Z' })).toBe(false);
    expect(IsAwaitingManualApproval({ ApprovalLevel: null, ApprovedAt: null })).toBe(false);
    expect(IsAwaitingManualApproval({})).toBe(false);
  });
});

describe('the candidate pool leaves out manual entries awaiting approval', () => {
  it('every pool carries the approval clause', async () => {
    const { p } = providers();
    expect(await pendingCandidateFilter({ postingDate: '2026-09-30' }, testUser, p)).toContain('(ApprovalLevel IS NULL OR ApprovedAt IS NOT NULL)');
  });

  it('the preview offers ordinary and approved entries and counts the ones awaiting approval', async () => {
    const { provider } = providers();
    const preview = await previewBatch({ postingDate: '2026-09-30' }, testUser, provider);
    expect(preview.Candidates.map(c => c.ID)).toEqual([ORDINARY.ID, APPROVED.ID]);
    expect(preview.AwaitingApprovalCount).toBe(2);
  });

  it('a sweep skips a company whose only Pending entries await approval', async () => {
    const { provider } = providers();
    expect(await pendingCompanies(testUser, provider, { postingDate: '2026-09-30' })).toEqual([CO_A]);
  });
});

describe('explicit and view builds', () => {
  it('an explicit selection holding an entry awaiting approval is refused by entry number, before anything is netted', async () => {
    const { provider, calls } = providers();
    const build = buildJournalEntryBatchFromExplicitIds([ORDINARY.ID, AWAITING.ID], 'BusinessCentral', 'USER-1', testUser, provider, undefined, '2026-09-30');
    await expect(build).rejects.toThrow(JournalEntryBatchFromViewError);
    await expect(build).rejects.toThrow(/awaiting approval .*JE-AWAITING/);
    expect(lineLoadFilter(calls)).toBe('');
  });

  it('an explicit selection of ordinary and approved entries proceeds to the build', async () => {
    const { provider, calls } = providers();
    await expect(buildJournalEntryBatchFromExplicitIds([ORDINARY.ID, APPROVED.ID], 'BusinessCentral', 'USER-1', testUser, provider, undefined, '2026-09-30'))
      .rejects.toThrow(/net to zero/); // the in-memory world has no lines; reaching the netting is the point
    expect(lineLoadFilter(calls)).toContain(APPROVED.ID);
  });

  it('a view build drops entries awaiting approval with a warning and batches the rest', async () => {
    const viewRows = [ORDINARY, AWAITING, APPROVED].map(j => ({ ID: j.ID, Status: j.Status, CompanyID: j.CompanyID, EffectiveDate: j.EffectiveDate, ApprovalLevel: j.ApprovalLevel, ApprovedAt: j.ApprovedAt }));
    const { provider, calls } = providers(viewRows);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await expect(buildJournalEntryBatchFromView('11111111-0000-0000-0000-00000000000f', 'BusinessCentral', 'USER-1', testUser, provider, undefined, { postingDate: '2026-09-30' }))
      .rejects.toThrow(/net to zero/);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('awaiting approval'));
    expect(lineLoadFilter(calls)).not.toContain(AWAITING.ID);
    expect(lineLoadFilter(calls)).toContain(ORDINARY.ID);
    warn.mockRestore();
  });
});
