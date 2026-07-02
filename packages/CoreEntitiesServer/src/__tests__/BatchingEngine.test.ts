/**
 * Block 2 unit tests — the PURE netting core of the batching engine (no DB).
 *
 * netLines() is the heart of §C5 batch summarization: collapse many JE lines into one consolidated
 * summary line per (GLAccount × dimension-combo), netting Dr against Cr to a single side. These tests
 * pin the behavior the live harness then proves end-to-end against the real triggers.
 */
import { describe, it, expect } from 'vitest';
import { netLines, type NettableLine } from '../BatchingEngine.js';

const GL_A = 'aaaaaaaa-0000-0000-0000-000000000001';
const GL_B = 'bbbbbbbb-0000-0000-0000-000000000002';
const DIM_DEPT = 'dddddddd-0000-0000-0000-00000000000d';
const SALES = 'eeeeeeee-0000-0000-0000-0000000000e1';
const MKTG = 'eeeeeeee-0000-0000-0000-0000000000e2';

const line = (glAccountId: string, debit: number, credit: number, dims: NettableLine['dims'] = []): NettableLine =>
  ({ glAccountId, debit, credit, dims });

describe('netLines (pure batch summarization)', () => {
  it('collapses many lines on one account+combo into a single netted summary line', () => {
    const groups = netLines([line(GL_A, 100, 0), line(GL_A, 50, 0), line(GL_A, 0, 30)]);
    expect(groups).toHaveLength(1);
    expect(groups[0].glAccountId).toBe(GL_A);
    expect(groups[0].net).toBe(120); // 150 debit − 30 credit
    expect(groups[0].side).toBe('Debit');
    expect(groups[0].sourceLineCount).toBe(3);
  });

  it('nets a credit-heavy account to the credit side (negative net)', () => {
    const groups = netLines([line(GL_A, 20, 0), line(GL_A, 0, 95)]);
    expect(groups).toHaveLength(1);
    expect(groups[0].net).toBe(-75);
    expect(groups[0].side).toBe('Credit');
  });

  it('drops a group that nets to ~zero (no summary line emitted)', () => {
    const groups = netLines([line(GL_A, 100, 0), line(GL_A, 0, 100)]);
    expect(groups).toHaveLength(0);
  });

  it('separates the SAME account into distinct groups by dimension combo', () => {
    const groups = netLines([
      line(GL_A, 100, 0, [{ DimensionID: DIM_DEPT, DimensionValueID: SALES }]),
      line(GL_A, 60, 0, [{ DimensionID: DIM_DEPT, DimensionValueID: MKTG }]),
    ]);
    expect(groups).toHaveLength(2);
    const byVal = Object.fromEntries(groups.map(g => [g.dims[0].DimensionValueID, g.net]));
    expect(byVal[SALES]).toBe(100);
    expect(byVal[MKTG]).toBe(60);
  });

  it('keeps different GL accounts in separate groups', () => {
    const groups = netLines([line(GL_A, 100, 0), line(GL_B, 0, 100)]);
    expect(groups).toHaveLength(2);
    expect(groups.find(g => g.glAccountId === GL_A)!.side).toBe('Debit');
    expect(groups.find(g => g.glAccountId === GL_B)!.side).toBe('Credit');
  });

  it('builds a dimension-order-independent key (same combo groups together regardless of input order)', () => {
    const d1 = { DimensionID: 'a', DimensionValueID: 'x' };
    const d2 = { DimensionID: 'b', DimensionValueID: 'y' };
    const groups = netLines([line(GL_A, 100, 0, [d1, d2]), line(GL_A, 50, 0, [d2, d1])]);
    expect(groups).toHaveLength(1);
    expect(groups[0].net).toBe(150);
  });

  it('produces a balanced summary set when the source JEs balance (Σdebit-side === Σcredit-side)', () => {
    // Two balanced JEs: Dr A 100 / Cr B 100, and Dr A 40 / Cr B 40.
    const groups = netLines([line(GL_A, 100, 0), line(GL_B, 0, 100), line(GL_A, 40, 0), line(GL_B, 0, 40)]);
    const debitTotal = groups.filter(g => g.side === 'Debit').reduce((s, g) => s + g.net, 0);
    const creditTotal = groups.filter(g => g.side === 'Credit').reduce((s, g) => s - g.net, 0);
    expect(debitTotal).toBe(140);
    expect(creditTotal).toBe(140);
    expect(debitTotal).toBe(creditTotal); // foots → trg_JEBatch_SummaryReconciles (50014) will pass
  });
});
