/**
 * The preview op's selection contract (golive #193).
 *
 * `IncludedJournalEntryIDs` has three meanings and the adapter must keep them apart:
 *   omitted / null  → no selection filter; net the whole candidate pool.
 *   []              → the operator unticked everything; net NOTHING.
 *   [ids]           → net exactly those.
 *
 * Collapsing the middle case into the first is the bug this pins: the dialog said "Including 0 of
 * N" while the totals underneath were the whole pool's, so the numbers contradicted the header.
 * The engine already handles an empty set correctly (`outOfOrderSkipCount` returns 0 when nothing
 * is included, and the netting runs over an empty row set), so the distinction only ever had to
 * survive the wire.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IMetadataProvider, UserInfo } from '@memberjunction/core';

const previewBatchSpy = vi.fn();

vi.mock('../JournalEntryBatchEngine.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../JournalEntryBatchEngine.js')>();
  return { ...actual, previewBatch: previewBatchSpy };
});

const { PreviewJournalEntryBatchOperation } = await import('../JournalEntryBatchOperations.js');
type PreviewInput = import('../JournalEntryBatchOperations.js').PreviewJournalEntryBatchInput;

/** Exposes the protected entry point; the op's own Execute wrapper is not what is under test. */
class ProbeOperation extends PreviewJournalEntryBatchOperation {
  public Run(input: PreviewInput, provider: IMetadataProvider, user: UserInfo) {
    return this.InternalExecute(input, provider, user);
  }
}

const provider = {} as unknown as IMetadataProvider;
const user = { ID: 'U1' } as unknown as UserInfo;

/** The 4th argument previewBatch received — the selection, as a set or undefined. */
async function selectionPassedFor(input: PreviewInput): Promise<ReadonlySet<string> | undefined> {
  await new ProbeOperation().Run(input, provider, user);
  return previewBatchSpy.mock.calls[0][3] as ReadonlySet<string> | undefined;
}

describe('PreviewJournalEntryBatchOperation — the selection on the wire', () => {
  beforeEach(() => {
    previewBatchSpy.mockReset();
    previewBatchSpy.mockResolvedValue({
      Candidates: [], AffectedAccounts: [], TotalDebits: 0, TotalCredits: 0, PerCompany: [], OutOfOrderSkipCount: 0,
    });
  });

  it('omitting the field means no selection filter', async () => {
    expect(await selectionPassedFor({})).toBeUndefined();
  });

  it('null means no selection filter', async () => {
    expect(await selectionPassedFor({ IncludedJournalEntryIDs: null })).toBeUndefined();
  });

  it('an EMPTY array means nothing is ticked — not "no filter"', async () => {
    const selection = await selectionPassedFor({ IncludedJournalEntryIDs: [] });
    expect(selection).toBeInstanceOf(Set);
    expect(selection?.size).toBe(0);
  });

  it('a populated array is passed through as the ticked set', async () => {
    const selection = await selectionPassedFor({ IncludedJournalEntryIDs: ['a', 'b'] });
    expect(selection).toBeInstanceOf(Set);
    expect([...(selection ?? [])].sort()).toEqual(['a', 'b']);
  });
});
