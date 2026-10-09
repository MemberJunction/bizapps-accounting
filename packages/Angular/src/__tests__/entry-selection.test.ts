import { describe, it, expect } from 'vitest';
import {
  ALL_ENTRIES,
  NO_ENTRIES,
  IncludedCandidateIds,
  IsEntryIncluded,
  SelectionRequestIds,
  ToggleEntrySelection,
} from '../lib/custom/shared/entry-selection';

/** TIER 1 — the batch preview selection model (golive #284): every candidate, or an explicit include set. */
describe('entry selection', () => {
  const POOL = ['a', 'b', 'c'];

  it('every candidate: sends no selection and ticks entries that join the pool later', () => {
    expect(SelectionRequestIds(ALL_ENTRIES)).toBeNull();
    expect(IsEntryIncluded(ALL_ENTRIES, 'later')).toBe(true);
    expect(IncludedCandidateIds(ALL_ENTRIES, POOL)).toEqual(POOL);
  });

  it('nothing ticked: sends an empty set and leaves entries that join the pool later unticked', () => {
    expect(SelectionRequestIds(NO_ENTRIES)).toEqual([]);
    expect(IsEntryIncluded(NO_ENTRIES, 'later')).toBe(false);
    expect(IncludedCandidateIds(NO_ENTRIES, [...POOL, 'later'])).toEqual([]);
  });

  it('unticking from every candidate gives the explicit set of the others', () => {
    expect(ToggleEntrySelection(ALL_ENTRIES, 'b', POOL)).toEqual(['a', 'c']);
  });

  it('ticks and unticks within an explicit set', () => {
    expect(ToggleEntrySelection(['a'], 'c', POOL)).toEqual(['a', 'c']);
    expect(ToggleEntrySelection(['a', 'c'], 'a', POOL)).toEqual(['c']);
  });

  it('keeps an id that left the pool in the request, but not in what is built', () => {
    const selection = ['gone', 'b'];
    expect(SelectionRequestIds(selection)).toEqual(['gone', 'b']);
    expect(IncludedCandidateIds(selection, POOL)).toEqual(['b']);
  });
});
