/**
 * Unit tests for the pure link picker behind ResolveLinkedAccount (plan §2.1):
 * Active-status gating, StartedAt/EndedAt window coverage (null bounds open),
 * latest-StartedAt-wins (One), and the covering set (Many). Isolated, no DB.
 *
 * CONNECTS TO:
 *   TESTS: ../AccountingEngineBase.ts (pickActiveLinkIndex, coveringActiveLinkIndexes)
 *   LIVE:  cache-backed ResolveLinkedAccount / ResolveLinkedAccounts is exercised by
 *          test-harnesses/server/engine-runtime.ts against real GLAccountLink rows
 */
import { describe, it, expect } from 'vitest';
import { coveringActiveLinkIndexes, pickActiveLinkIndex, type LinkCandidate } from '../AccountingEngineBase.js';

const d = (iso: string): Date => new Date(iso);
const link = (over: Partial<LinkCandidate> = {}): LinkCandidate => ({
  Status: 'Active',
  StartedAt: null,
  EndedAt: null,
  ...over,
});

describe('pickActiveLinkIndex (window + status + tie-break)', () => {
  it('picks an open-ended Active link (null bounds cover any date)', () => {
    expect(pickActiveLinkIndex([link()], d('2026-07-06'))).toBe(0);
  });

  it('ignores non-Active links regardless of window', () => {
    expect(pickActiveLinkIndex([
      link({ Status: 'Pending' }),
      link({ Status: 'Disabled' }),
    ], d('2026-07-06'))).toBe(-1);
  });

  it('excludes a link whose window has not started', () => {
    expect(pickActiveLinkIndex([link({ StartedAt: d('2026-08-01') })], d('2026-07-06'))).toBe(-1);
  });

  it('excludes a link whose window has ended', () => {
    expect(pickActiveLinkIndex([link({ EndedAt: d('2026-06-30') })], d('2026-07-06'))).toBe(-1);
  });

  it('includes the window boundaries (StartedAt and EndedAt are inclusive)', () => {
    const c = [link({ StartedAt: d('2026-07-01'), EndedAt: d('2026-07-31') })];
    expect(pickActiveLinkIndex(c, d('2026-07-01'))).toBe(0);
    expect(pickActiveLinkIndex(c, d('2026-07-31'))).toBe(0);
  });

  it('prefers the LATEST StartedAt when several windows cover the date (most specific wins)', () => {
    const idx = pickActiveLinkIndex([
      link({ StartedAt: d('2026-01-01') }),
      link({ StartedAt: d('2026-06-01') }),
      link({ StartedAt: d('2026-03-01') }),
    ], d('2026-07-06'));
    expect(idx).toBe(1);
  });

  it('a dated window beats an open (null StartedAt) one', () => {
    const idx = pickActiveLinkIndex([
      link(), // open-ended default
      link({ StartedAt: d('2026-06-01') }),
    ], d('2026-07-06'));
    expect(idx).toBe(1);
  });

  it('falls back to the open link when the dated one has expired', () => {
    const idx = pickActiveLinkIndex([
      link(), // open-ended default
      link({ StartedAt: d('2026-01-01'), EndedAt: d('2026-02-01') }),
    ], d('2026-07-06'));
    expect(idx).toBe(0);
  });

  it('returns -1 for an empty candidate list', () => {
    expect(pickActiveLinkIndex([], d('2026-07-06'))).toBe(-1);
  });
});

describe('coveringActiveLinkIndexes (Many-role set, no winner)', () => {
  it('returns every covering Active link in input order, including overlapping windows', () => {
    expect(coveringActiveLinkIndexes([
      link({ StartedAt: d('2026-01-01') }),
      link({ Status: 'Pending' }),
      link({ StartedAt: d('2026-06-01') }),
      link({ EndedAt: d('2026-06-30') }),
    ], d('2026-07-06'))).toEqual([0, 2]);
  });

  it('returns empty when nothing covers', () => {
    expect(coveringActiveLinkIndexes([
      link({ StartedAt: d('2026-08-01') }),
      link({ Status: 'Disabled' }),
    ], d('2026-07-06'))).toEqual([]);
  });
});
