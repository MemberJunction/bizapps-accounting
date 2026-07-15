/**
 * batchFromView.test — the PURE B1.2 view-entry classification (Marcelo Q-d): Pending → batchable,
 * posted/locked → excluded (default) or loud-reject (filter off), other → always reject.
 */
import { describe, it, expect } from 'vitest';
import { classifyViewEntries, pendingCandidateFilter } from '../BatchingEngine.js';

describe('pendingCandidateFilter — oldest-forward cutoff (B1.1)', () => {
  it('no options → Pending only', () => {
    expect(pendingCandidateFilter({})).toBe(`Status='Pending'`);
  });
  it('a DATE-only cutoff is inclusive of the whole day (< cutoff + 1 day)', () => {
    const f = pendingCandidateFilter({ cutoff: new Date('2026-07-31T00:00:00.000Z') });
    expect(f).toContain(`Status='Pending'`);
    expect(f).toContain(`EffectiveDate < '2026-08-01'`);
  });
  it('a DATETIME cutoff is exact (<=)', () => {
    const f = pendingCandidateFilter({ cutoff: new Date('2026-07-31T14:30:00.000Z') });
    expect(f).toContain(`EffectiveDate <= '2026-07-31T14:30:00.000Z'`);
  });
  it('a start date adds a lower bound', () => {
    const f = pendingCandidateFilter({ startDate: new Date('2026-07-01T00:00:00.000Z'), cutoff: new Date('2026-07-31T00:00:00.000Z') });
    expect(f).toContain(`EffectiveDate >= '2026-07-01'`);
    expect(f).toContain(`EffectiveDate < '2026-08-01'`);
  });
});

const rows = [
  { ID: 'p1', Status: 'Pending' },
  { ID: 'p2', Status: 'Pending' },
  { ID: 'g1', Status: 'GLPosted' },
  { ID: 'b1', Status: 'Batched' },
];

describe('classifyViewEntries', () => {
  it('by default (filters ON) excludes posted + locked, keeps Pending, rejects nothing', () => {
    const r = classifyViewEntries(rows);
    expect(r.pending).toEqual(['p1', 'p2']);
    expect(r.rejected).toEqual([]);
    expect(r.excluded).toEqual(['g1 (posted)', 'b1 (locked)']);
  });

  it('with exclude-posted OFF, a posted entry is a LOUD REJECT (named)', () => {
    const r = classifyViewEntries(rows, { excludePosted: false });
    expect(r.rejected).toContain('g1 (posted)');
    expect(r.excluded).toEqual(['b1 (locked)']); // locked still excluded (its filter is on)
    expect(r.pending).toEqual(['p1', 'p2']);
  });

  it('with exclude-locked OFF, a locked entry is a LOUD REJECT', () => {
    const r = classifyViewEntries(rows, { excludeLocked: false });
    expect(r.rejected).toContain('b1 (locked)');
  });

  it('an unknown/other status is ALWAYS a reject', () => {
    const r = classifyViewEntries([{ ID: 'x', Status: 'Draft' }]);
    expect(r.rejected).toEqual(['x (Draft)']);
    expect(r.pending).toEqual([]);
  });

  it('an all-Pending view has no exclusions or rejects', () => {
    const r = classifyViewEntries([{ ID: 'p1', Status: 'Pending' }, { ID: 'p2', Status: 'Pending' }]);
    expect(r.pending).toEqual(['p1', 'p2']);
    expect(r.rejected).toEqual([]);
    expect(r.excluded).toEqual([]);
  });
});
