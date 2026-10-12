/**
 * #193 — Accounting.GetJournalEntryStates. Reports each entry's status, effective date, batch and the
 * batch's status in two reads; an unknown id is `Found: false`; a malformed id refuses the whole call
 * before any filter is built.
 */
import { describe, it, expect } from 'vitest';
import type { IMetadataProvider, RemoteOpServerContext, RunViewParams, UserInfo } from '@memberjunction/core';

import { GetJournalEntryStatesOperation, MAX_JOURNAL_ENTRY_STATE_IDS } from '../GetJournalEntryStatesOperation.js';

const USER = { ID: 'USER-1' } as UserInfo;
const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';
const BATCH_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Batches';

const UNBATCHED = 'aaaaaaaa-0000-4000-8000-000000000001';
const IN_PENDING_BATCH = 'aaaaaaaa-0000-4000-8000-000000000002';
const POSTED = 'aaaaaaaa-0000-4000-8000-000000000003';
const UNKNOWN = 'aaaaaaaa-0000-4000-8000-0000000000ff';
const PENDING_BATCH = 'BBBBBBBB-0000-4000-8000-000000000001';
const POSTED_BATCH = 'BBBBBBBB-0000-4000-8000-000000000002';

// SQL Server hands ids back uppercase; callers usually send randomUUID() lowercase.
const ENTRIES = [
  { ID: UNBATCHED.toUpperCase(), Status: 'Pending', EffectiveDate: new Date('2026-10-31T00:00:00Z'), JournalEntryBatchID: null },
  { ID: IN_PENDING_BATCH.toUpperCase(), Status: 'Batched', EffectiveDate: new Date('2026-09-30T00:00:00Z'), JournalEntryBatchID: PENDING_BATCH },
  { ID: POSTED.toUpperCase(), Status: 'GLPosted', EffectiveDate: new Date('2026-08-31T00:00:00Z'), JournalEntryBatchID: POSTED_BATCH },
];
const BATCHES = [
  { ID: PENDING_BATCH, Status: 'Pending' },
  { ID: POSTED_BATCH, Status: 'Posted' },
];

/** A provider that answers `ID IN (...)` reads from the fixtures above and records every read. */
function fakeProvider() {
  const reads: RunViewParams[] = [];
  const idsIn = (filter: string) => (filter.match(/'([^']+)'/g) ?? []).map(s => s.slice(1, -1).toLowerCase());
  const provider = {
    RunView: async (params: RunViewParams) => {
      reads.push(params);
      const wanted = idsIn(typeof params.ExtraFilter === 'string' ? params.ExtraFilter : '');
      const rows = params.EntityName === JE_ENTITY ? ENTRIES : params.EntityName === BATCH_ENTITY ? BATCHES : [];
      return { Success: true, Results: rows.filter(r => wanted.includes(r.ID.toLowerCase())) };
    },
  } as unknown as IMetadataProvider;
  return { provider, reads };
}

function run(ids: unknown, provider: IMetadataProvider) {
  return new GetJournalEntryStatesOperation().ExecuteServer(
    { JournalEntryIDs: ids } as never,
    { provider, user: USER } as unknown as RemoteOpServerContext,
  );
}

describe('Accounting.GetJournalEntryStates', () => {
  it('reports an unbatched Pending entry with no batch status', async () => {
    const { provider } = fakeProvider();
    const result = await run([UNBATCHED], provider);
    expect(result.Success).toBe(true);
    expect(result.Output?.States).toEqual([
      { JournalEntryID: UNBATCHED, Found: true, Status: 'Pending', EffectiveDate: '2026-10-31', JournalEntryBatchID: null, JournalEntryBatchStatus: null },
    ]);
  });

  it('reports a batched entry and its Pending batch', async () => {
    const { provider } = fakeProvider();
    const result = await run([IN_PENDING_BATCH], provider);
    expect(result.Output?.States).toEqual([
      { JournalEntryID: IN_PENDING_BATCH, Found: true, Status: 'Batched', EffectiveDate: '2026-09-30', JournalEntryBatchID: PENDING_BATCH, JournalEntryBatchStatus: 'Pending' },
    ]);
  });

  it('reports a GLPosted entry in a Posted batch', async () => {
    const { provider } = fakeProvider();
    const result = await run([POSTED], provider);
    expect(result.Output?.States).toEqual([
      { JournalEntryID: POSTED, Found: true, Status: 'GLPosted', EffectiveDate: '2026-08-31', JournalEntryBatchID: POSTED_BATCH, JournalEntryBatchStatus: 'Posted' },
    ]);
  });

  it('reports an unknown id as not found rather than failing', async () => {
    const { provider } = fakeProvider();
    const result = await run([UNKNOWN], provider);
    expect(result.Success).toBe(true);
    expect(result.Output?.States).toEqual([
      { JournalEntryID: UNKNOWN, Found: false, Status: null, EffectiveDate: null, JournalEntryBatchID: null, JournalEntryBatchStatus: null },
    ]);
  });

  it('answers a mixed request in request order with exactly two reads', async () => {
    const { provider, reads } = fakeProvider();
    const result = await run([POSTED, UNKNOWN, UNBATCHED, IN_PENDING_BATCH], provider);
    expect(result.Output?.States.map(s => [s.JournalEntryID, s.Found, s.JournalEntryBatchStatus])).toEqual([
      [POSTED, true, 'Posted'],
      [UNKNOWN, false, null],
      [UNBATCHED, true, null],
      [IN_PENDING_BATCH, true, 'Pending'],
    ]);
    expect(reads.map(r => r.EntityName)).toEqual([JE_ENTITY, BATCH_ENTITY]);
  });

  it('refuses a malformed id before any read, so it never reaches a filter', async () => {
    const { provider, reads } = fakeProvider();
    const result = await run([UNBATCHED, "x' OR 1=1--"], provider);
    expect(result.Success).toBe(false);
    expect(result.ErrorMessage).toMatch(/not a valid UUID/);
    expect(reads).toHaveLength(0);
  });

  it('returns no states and reads nothing for an empty list', async () => {
    const { provider, reads } = fakeProvider();
    const result = await run([], provider);
    expect(result.Success).toBe(true);
    expect(result.Output?.States).toEqual([]);
    expect(reads).toHaveLength(0);
  });

  it('refuses a missing list', async () => {
    const { provider } = fakeProvider();
    const result = await run(undefined, provider);
    expect(result.Success).toBe(false);
    expect(result.ErrorMessage).toMatch(/JournalEntryIDs is required/);
  });

  it(`refuses more than ${MAX_JOURNAL_ENTRY_STATE_IDS} ids`, async () => {
    const { provider, reads } = fakeProvider();
    const ids = Array.from({ length: MAX_JOURNAL_ENTRY_STATE_IDS + 1 }, () => UNBATCHED);
    const result = await run(ids, provider);
    expect(result.Success).toBe(false);
    expect(result.ErrorMessage).toMatch(/at most 500 per call/);
    expect(reads).toHaveLength(0);
  });

  it('skips the batch read when no requested entry is batched', async () => {
    const { provider, reads } = fakeProvider();
    await run([UNBATCHED, UNKNOWN], provider);
    expect(reads.map(r => r.EntityName)).toEqual([JE_ENTITY]);
  });

  it('fails the call when a read fails', async () => {
    const provider = { RunView: async () => ({ Success: false, ErrorMessage: 'timeout', Results: [] }) } as unknown as IMetadataProvider;
    const result = await run([UNBATCHED], provider);
    expect(result.Success).toBe(false);
    expect(result.ErrorMessage).toMatch(/reading MJ_BizApps_Accounting: Journal Entries failed: timeout/);
  });
});
