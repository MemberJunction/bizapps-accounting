/**
 * Pure-logic tests for the S-D batch-workspace machinery (2026-07-29 port):
 * out-of-order detection, view classification, and per-company subtotals.
 * The DB-touching halves (pendingCandidateFilter, previewBatch, the builds) are
 * covered live by the tier-2 suite + the tier-3 batch-ops harness.
 */
import { describe, it, expect } from 'vitest';
import { classifyViewEntries, netLines, outOfOrderSkipCount, perCompanySubtotals, type NettableLine } from '../BatchingEngine.js';

const A = 'aaaaaaaa-0000-0000-0000-000000000001';
const B = 'bbbbbbbb-0000-0000-0000-000000000002';
const GL1 = '11111111-0000-0000-0000-000000000001';
const GL2 = '22222222-0000-0000-0000-000000000002';

describe('outOfOrderSkipCount (out-of-order visibility)', () => {
  const pool = [{ ID: 'je1' }, { ID: 'je2' }, { ID: 'je3' }, { ID: 'je4' }];

  it('0 when everything is included', () => {
    expect(outOfOrderSkipCount(pool, new Set(['je1', 'je2', 'je3', 'je4']))).toBe(0);
  });

  it('0 when exclusions are only at the END of the pool (batching less far forward)', () => {
    expect(outOfOrderSkipCount(pool, new Set(['je1', 'je2']))).toBe(0);
  });

  it('counts OLDER entries left behind while a newer one batches', () => {
    expect(outOfOrderSkipCount(pool, new Set(['je1', 'je4']))).toBe(2); // je2 + je3 jumped
    expect(outOfOrderSkipCount(pool, new Set(['je3']))).toBe(2);       // je1 + je2 jumped
  });

  it('0 when nothing is included — nothing jumps the queue', () => {
    expect(outOfOrderSkipCount(pool, new Set())).toBe(0);
  });
});

describe('classifyViewEntries (view snapshot → batchable / excluded / rejected)', () => {
  const rows = [
    { ID: 'p1', Status: 'Pending' },
    { ID: 'g1', Status: 'GLPosted' },
    { ID: 'b1', Status: 'Batched' },
  ];

  it('default-on filters EXCLUDE posted/locked (overlap-safe), pending is batchable', () => {
    const out = classifyViewEntries(rows);
    expect(out.pending).toEqual(['p1']);
    expect(out.rejected).toEqual([]);
    expect(out.excluded).toEqual(['g1 (posted)', 'b1 (locked)']);
  });

  it('a toggled-OFF filter turns the matching entry into a LOUD reject, never a silent drop', () => {
    const out = classifyViewEntries(rows, { excludePosted: false, excludeLocked: false });
    expect(out.pending).toEqual(['p1']);
    expect(out.rejected).toEqual(['g1 (posted)', 'b1 (locked)']);
    expect(out.excluded).toEqual([]);
  });

  it('an unknown status is ALWAYS a reject regardless of filters', () => {
    const out = classifyViewEntries([{ ID: 'x1', Status: 'Cancelled' }]);
    expect(out.rejected).toEqual(['x1 (Cancelled)']);
  });
});

describe('perCompanySubtotals (workspace footer)', () => {
  it('splits netted Dr/Cr by company with cent rounding', () => {
    const lines: NettableLine[] = [
      { companyId: A, glAccountId: GL1, debit: 100, credit: 0, dims: [] },
      { companyId: A, glAccountId: GL2, debit: 0, credit: 100, dims: [] },
      { companyId: B, glAccountId: GL1, debit: 40.005, credit: 0, dims: [] },
      { companyId: B, glAccountId: GL2, debit: 0, credit: 40.005, dims: [] },
    ];
    const rows = perCompanySubtotals(netLines(lines));
    const a = rows.find(r => r.CompanyID === A);
    const b = rows.find(r => r.CompanyID === B);
    expect(a).toMatchObject({ Debit: 100, Credit: 100 });
    expect(b?.Debit).toBeCloseTo(40.01, 2);
    expect(b?.Credit).toBeCloseTo(40.01, 2);
  });
});
