/**
 * A company's PostingStartDate keeps journal entries dated before it out of every posting batch:
 * every build, preview and sweep selects through `pendingCandidateFilter`, and the explicit-ID and
 * view builds check the same floor. NULL (or no profile row) means no floor. The floor composes
 * with the per-call `startDate`: the later of the two wins.
 *
 * The reads run against an in-memory provider that evaluates the emitted filter, so these assert
 * which entries are admitted, not how the SQL reads.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  pendingCandidateFilter,
  pendingCompanies,
  previewBatch,
  postingStartClauses,
  partitionByPostingStart,
  buildJournalEntryBatch,
  buildJournalEntryBatchFromExplicitIds,
  buildJournalEntryBatchFromView,
  EmptyJournalEntryBatchError,
  JournalEntryBatchFromViewError,
} from '../JournalEntryBatchEngine.js';
import { inMemoryProvider, journal, profile, testUser, JEL_ENTITY, type JournalRow, type ProfileRow } from './helpers/in-memory-journal-provider.js';
import type { IRunViewProvider } from '@memberjunction/core';

const CO_A = 'aaaaaaaa-0000-0000-0000-000000000001';
const CO_B = 'bbbbbbbb-0000-0000-0000-000000000002';
const CO_C = 'cccccccc-0000-0000-0000-000000000003'; // no profile row at all

/** Two companies with different floors, one with none, and entries either side of each. */
const JOURNALS: JournalRow[] = [
  journal('a-history', CO_A, '2026-05-31'),
  journal('a-first', CO_A, '2026-06-01'),
  journal('a-later', CO_A, '2026-08-15'),
  journal('b-history', CO_B, '2026-07-31'),
  journal('b-first', CO_B, '2026-08-01'),
  journal('c-old', CO_C, '2025-01-10'),
];
const PROFILES: ProfileRow[] = [profile(CO_A, '2026-06-01'), profile(CO_B, '2026-08-01')];

function providers(profiles: ProfileRow[] = PROFILES, journals: JournalRow[] = JOURNALS, viewRows?: object[]) {
  const { provider, calls } = inMemoryProvider({ journals, profiles, viewRows });
  return { provider, calls, p: { md: provider, rv: provider as unknown as IRunViewProvider } };
}

async function admittedIds(options: Parameters<typeof pendingCandidateFilter>[0], profiles: ProfileRow[] = PROFILES): Promise<string[]> {
  const { provider } = providers(profiles);
  const preview = await previewBatch(options, testUser, provider);
  return preview.Candidates.map(c => c.ID).sort();
}

describe('pendingCandidateFilter — the per-company PostingStartDate floor', () => {
  it('with no floor set anywhere the filter is unchanged and every Pending entry is a candidate', async () => {
    const { p } = providers([profile(CO_A, null)]);
    // The only date clause is the posting-date bound every pool carries; no floor clause is added.
    expect(await pendingCandidateFilter({ postingDate: '2026-09-30' }, testUser, p))
      .toBe(`Status='Pending' AND EntryTypeID<>'e9521aa3-f4ef-4ec5-a899-d9dd59f320b7' AND EffectiveDate < '2026-10-01'`);
    expect(await admittedIds({}, [profile(CO_A, null)])).toEqual(JOURNALS.map(j => j.ID).sort());
  });

  it("excludes each company's entries dated before its OWN posting start date", async () => {
    expect(await admittedIds({})).toEqual(['a-first', 'a-later', 'b-first', 'c-old']);
  });

  it('a company with no profile row has no floor', async () => {
    expect(await admittedIds({})).toContain('c-old');
  });

  it('a per-call startDate EARLIER than a floor does not let history back in', async () => {
    expect(await admittedIds({ startDate: new Date('2026-01-01T00:00:00.000Z') })).toEqual(['a-first', 'a-later', 'b-first']);
  });

  it('a per-call startDate LATER than a floor wins for that company', async () => {
    // Later than A's floor, earlier than B's: A is bounded by the startDate, B by its own floor.
    expect(await admittedIds({ startDate: new Date('2026-07-01T00:00:00.000Z') })).toEqual(['a-later', 'b-first']);
  });

  it('the floor is inclusive: an entry dated ON the posting start date is a candidate', async () => {
    expect(await admittedIds({})).toEqual(expect.arrayContaining(['a-first', 'b-first']));
  });
});

describe('postingStartClauses — pure', () => {
  it('emits no clause for a floor on or before the per-call startDate', () => {
    const floors = [{ CompanyID: CO_A, PostingStartDate: '2026-06-01' }, { CompanyID: CO_B, PostingStartDate: '2026-08-01' }];
    expect(postingStartClauses(floors, '2026-06-01')).toEqual([`(CompanyID<>'${CO_B}' OR EffectiveDate >= '2026-08-01')`]);
    expect(postingStartClauses(floors, null)).toHaveLength(2);
    expect(postingStartClauses([], null)).toEqual([]);
  });

  it('rejects a company id that is not a GUID rather than concatenating it into SQL', () => {
    expect(() => postingStartClauses([{ CompanyID: "x' OR 1=1 --", PostingStartDate: '2026-06-01' }], null)).toThrow();
  });
});

describe('partitionByPostingStart — pure', () => {
  it("splits by each row's own company floor, ignoring companies without one", () => {
    const floors = [{ CompanyID: CO_A.toUpperCase(), PostingStartDate: '2026-06-01' }];
    const { onOrAfter, before } = partitionByPostingStart(JOURNALS, floors);
    expect(before.map(r => r.ID)).toEqual(['a-history']);
    expect(onOrAfter.map(r => r.ID)).toContain('b-history');
  });
});

describe('previewBatch — counts what the floor held back', () => {
  it('reports BeforePostingStartCount for entries the other criteria would have admitted', async () => {
    const { provider } = providers();
    const preview = await previewBatch({}, testUser, provider);
    expect(preview.BeforePostingStartCount).toBe(2); // a-history, b-history
  });

  it('counts only entries inside the other criteria (a company scope narrows it)', async () => {
    const { provider } = providers();
    const preview = await previewBatch({ companyIds: [CO_B] }, testUser, provider);
    expect(preview.Candidates.map(c => c.ID)).toEqual(['b-first']);
    expect(preview.BeforePostingStartCount).toBe(1);
  });

  it('is 0, with no extra read, when no company has a floor', async () => {
    const { provider, calls } = providers([]);
    const preview = await previewBatch({}, testUser, provider);
    expect(preview.BeforePostingStartCount).toBe(0);
    expect(calls.some(c => c.ResultType === 'count_only')).toBe(false);
  });
});

describe('sweeps and builds', () => {
  it('pendingCompanies skips a company whose only Pending entries predate its floor', async () => {
    const journals = [journal('a-history', CO_A, '2026-05-31'), journal('b-first', CO_B, '2026-08-01')];
    const { provider } = providers(PROFILES, journals);
    expect(await pendingCompanies(testUser, provider)).toEqual([CO_B]);
  });

  it('buildJournalEntryBatch for a company with only pre-floor entries has nothing to batch', async () => {
    const journals = [journal('a-history', CO_A, '2026-05-31')];
    const { provider } = providers(PROFILES, journals);
    await expect(buildJournalEntryBatch(CO_A, 'BusinessCentral', 'USER-1', testUser, provider))
      .rejects.toThrow(/no unbatched Pending journal entries matching the criteria/);
  });

  it('buildJournalEntryBatch nets only the entries on or after the floor', async () => {
    // GUID ids: the build checks its members' dates against the posting date by id.
    const { provider, calls } = providers(PROFILES, guidJournals());
    // No lines in the fake, so the build stops at "nets to zero" — after choosing its entries.
    await expect(buildJournalEntryBatch(CO_A, 'BusinessCentral', 'USER-1', testUser, provider)).rejects.toThrow(EmptyJournalEntryBatchError);
    expect(lineLoadFilter(calls)).toContain(idOf('a-first'));
    expect(lineLoadFilter(calls)).not.toContain(idOf('a-history'));
  });

  it('an explicit selection holding a pre-floor entry is refused, naming it', async () => {
    const { provider, calls } = providers(PROFILES, guidJournals());
    const build = buildJournalEntryBatchFromExplicitIds([idOf('a-history'), idOf('a-first')], 'BusinessCentral', 'USER-1', testUser, provider);
    await expect(build).rejects.toThrow(JournalEntryBatchFromViewError);
    await expect(build).rejects.toThrow(new RegExp(`dated before.*posting start date.*${idOf('a-history')}`));
    expect(lineLoadFilter(calls)).toBe(''); // refused before anything was netted
  });

  it('an explicit selection entirely on or after the floor proceeds to the build', async () => {
    const { provider, calls } = providers(PROFILES, guidJournals());
    await expect(buildJournalEntryBatchFromExplicitIds([idOf('a-first'), idOf('c-old')], 'BusinessCentral', 'USER-1', testUser, provider))
      .rejects.toThrow(/net to zero/);
    expect(lineLoadFilter(calls)).toContain(idOf('a-first'));
  });

  it('a view build drops pre-floor entries with a warning and batches the rest', async () => {
    const viewRows = JOURNALS.filter(j => j.CompanyID === CO_A).map(j => ({ ID: idOf(j.ID), Status: j.Status, CompanyID: j.CompanyID, EffectiveDate: j.EffectiveDate }));
    const { provider, calls } = providers(PROFILES, guidJournals(), viewRows);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await expect(buildJournalEntryBatchFromView('11111111-0000-0000-0000-00000000000f', 'BusinessCentral', 'USER-1', testUser, provider))
      .rejects.toThrow(/net to zero/);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('posting start date'));
    expect(lineLoadFilter(calls)).not.toContain(idOf('a-history'));
    expect(lineLoadFilter(calls)).toContain(idOf('a-first'));
    warn.mockRestore();
  });
});

/** The explicit and view builds take GUIDs; map the readable fixture ids onto stable ones. */
function idOf(name: string): string {
  const index = JOURNALS.findIndex(j => j.ID === name);
  return `dddddddd-0000-0000-0000-${String(index + 1).padStart(12, '0')}`;
}

function guidJournals(): JournalRow[] {
  return JOURNALS.map(j => ({ ...j, ID: idOf(j.ID) }));
}

/** The ExtraFilter of the build's member-line read: the ids it chose to net. */
function lineLoadFilter(calls: Array<{ EntityName?: string; ExtraFilter?: string }>): string {
  return calls.filter(c => c.EntityName === JEL_ENTITY).map(c => c.ExtraFilter ?? '').join(' ');
}
