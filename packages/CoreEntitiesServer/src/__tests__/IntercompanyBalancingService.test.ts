/**
 * Block 3 unit tests — the PURE intercompany netting core + canonical pair ordering (no DB).
 *
 * netIntercompanyPositions() implements §C1 "gross preserved, net shipped": fold each company-pair's
 * gross Due-To/Due-From net-groups into a single bilateral net group, balance-preservingly. These tests
 * pin the math the live block3 harness then proves end-to-end against the real trg_ICR (50015).
 */
import { describe, it, expect } from 'vitest';
import {
  netIntercompanyPositions,
  canonicalPair,
  compareSqlServerGuid,
  type IntercompanyPair,
} from '../IntercompanyBalancingService.js';
import type { NetGroup } from '../BatchingEngine.js';

// Per-pair intercompany accounts (this company's view of the counterparty).
const DUE_FROM = 'ffffffff-0000-0000-0000-00000000df01'; // Asset
const DUE_TO = 'ffffffff-0000-0000-0000-00000000dt01';   // Liability
// A second, independent pair.
const DUE_FROM2 = 'ffffffff-0000-0000-0000-00000000df02';
const DUE_TO2 = 'ffffffff-0000-0000-0000-00000000dt02';
// A non-intercompany account (revenue) — must pass through untouched.
const REV = 'cccccccc-0000-0000-0000-0000000000c1';

const pair = (dueToAccountId: string, dueFromAccountId: string): IntercompanyPair => ({ dueToAccountId, dueFromAccountId });

/** Build a NetGroup the way netLines would (signed net: Debit>0, Credit<0). */
const group = (glAccountId: string, net: number, sourceLineCount = 1): NetGroup => ({
  glAccountId,
  dims: [],
  dimKey: '',
  net,
  side: net > 0 ? 'Debit' : 'Credit',
  sourceLineCount,
});

/** Σ(signed net) over groups = total-Dr − total-Cr (each group contributes exactly its signed net). */
const signedTotal = (groups: NetGroup[]): number => groups.reduce((s, g) => s + g.net, 0);

describe('netIntercompanyPositions (pure bilateral netting)', () => {
  it('nets due-to 100 (credit) + due-from 150 (debit) → a single net Due-From 50 (debit), gross dropped', () => {
    // Due-From group is a +150 debit (counterparty owes us 150); Due-To group is a −100 credit (we owe 100).
    const result = netIntercompanyPositions(
      [group(DUE_FROM, 150), group(DUE_TO, -100)],
      [pair(DUE_TO, DUE_FROM)],
    );
    expect(result).toHaveLength(1);
    expect(result[0].glAccountId).toBe(DUE_FROM); // net-owed → on the Due-From (asset) account
    expect(result[0].net).toBe(50);
    expect(result[0].side).toBe('Debit');
    // gross groups are gone
    expect(result.find(g => g.net === 150 || g.net === -100)).toBeUndefined();
  });

  it('nets to the Due-To (credit) side when the company is net-owing', () => {
    // Due-From +40 (owed to us), Due-To −100 (we owe) → net −60 → we owe 60 → credit on Due-To.
    const result = netIntercompanyPositions(
      [group(DUE_FROM, 40), group(DUE_TO, -100)],
      [pair(DUE_TO, DUE_FROM)],
    );
    expect(result).toHaveLength(1);
    expect(result[0].glAccountId).toBe(DUE_TO);
    expect(result[0].net).toBe(-60);
    expect(result[0].side).toBe('Credit');
  });

  it('drops BOTH sides when the pair nets to ~zero (equal amounts)', () => {
    const result = netIntercompanyPositions(
      [group(DUE_FROM, 100), group(DUE_TO, -100)],
      [pair(DUE_TO, DUE_FROM)],
    );
    expect(result).toHaveLength(0);
  });

  it('handles a one-sided position (only a Due-From group present)', () => {
    const result = netIntercompanyPositions([group(DUE_FROM, 75)], [pair(DUE_TO, DUE_FROM)]);
    expect(result).toHaveLength(1);
    expect(result[0].glAccountId).toBe(DUE_FROM);
    expect(result[0].net).toBe(75);
    expect(result[0].side).toBe('Debit');
  });

  it('nets multiple pairs INDEPENDENTLY', () => {
    const result = netIntercompanyPositions(
      [group(DUE_FROM, 150), group(DUE_TO, -100), group(DUE_FROM2, 30), group(DUE_TO2, -80)],
      [pair(DUE_TO, DUE_FROM), pair(DUE_TO2, DUE_FROM2)],
    );
    expect(result).toHaveLength(2);
    const byAcct = Object.fromEntries(result.map(g => [g.glAccountId, g]));
    expect(byAcct[DUE_FROM].net).toBe(50);   // pair 1: net-owed 50
    expect(byAcct[DUE_TO2].net).toBe(-50);   // pair 2: 30 − 80 = net-owing 50 → credit
  });

  it('passes non-intercompany groups through UNTOUCHED', () => {
    const result = netIntercompanyPositions(
      [group(REV, -100), group(DUE_FROM, 150), group(DUE_TO, -100)],
      [pair(DUE_TO, DUE_FROM)],
    );
    // revenue group + the single net group
    expect(result).toHaveLength(2);
    const rev = result.find(g => g.glAccountId === REV);
    expect(rev).toBeDefined();
    expect(rev!.net).toBe(-100);
  });

  it('is BALANCE-PRESERVING: Σ(signed net) is unchanged by netting', () => {
    // Balanced source: Dr Due-From 150, Cr Due-To 100, plus Cr Revenue 50 → signed total = 150−100−50 = 0.
    const before = [group(DUE_FROM, 150), group(DUE_TO, -100), group(REV, -50)];
    expect(signedTotal(before)).toBe(0);
    const after = netIntercompanyPositions(before, [pair(DUE_TO, DUE_FROM)]);
    expect(signedTotal(after)).toBe(0); // net Due-From 50 + Rev −50 = 0, identical to before
  });

  it('returns groups unchanged when there are no pairs', () => {
    const before = [group(REV, -100), group(DUE_FROM, 150)];
    const after = netIntercompanyPositions(before, []);
    expect(after).toBe(before);
  });

  it('matches account ids CASE-INSENSITIVELY (SQL Server uppercase vs lowercase)', () => {
    // Groups carry UPPERCASE ids (as SQL Server returns); the pair carries lowercase ids.
    const result = netIntercompanyPositions(
      [group(DUE_FROM.toUpperCase(), 150), group(DUE_TO.toUpperCase(), -100)],
      [pair(DUE_TO.toLowerCase(), DUE_FROM.toLowerCase())],
    );
    expect(result).toHaveLength(1); // still folds despite the case skew
    expect(result[0].net).toBe(50);
  });
});

describe('canonicalPair / compareSqlServerGuid (SQL Server uniqueidentifier ordering)', () => {
  it('orders a pair so A < B under SQL Server comparison (and is orientation-independent)', () => {
    const x = '00000000-0000-0000-0000-000000000001';
    const y = '00000000-0000-0000-0000-0000000000ff';
    const p1 = canonicalPair(x, y);
    const p2 = canonicalPair(y, x);
    expect(p1).toEqual(p2); // same canonical result regardless of input order
    expect(compareSqlServerGuid(p1.aId, p1.bId)).toBeLessThan(0); // A < B holds
  });

  it('uses the LAST 6 bytes as most-significant (SQL Server quirk, not lexicographic)', () => {
    // Differ only in byte[0] (the most significant lexicographically) vs byte[15] (the SQL Server MSB).
    const lowByte0 = '01000000-0000-0000-0000-000000000000';
    const highByte0 = 'ff000000-0000-0000-0000-000000000000';
    // Lexicographically lowByte0 < highByte0, but in SQL Server order byte[0] is the LEAST significant,
    // so with all other bytes equal the comparison still follows byte[0] — and lowByte0 < highByte0.
    expect(compareSqlServerGuid(lowByte0, highByte0)).toBeLessThan(0);

    // Now make byte[15] (SQL MSB) dominate: lexicographically a < b, but SQL order flips it.
    const lexLow_sqlHigh = '00000000-0000-0000-0000-0000000000ff'; // lexicographically larger tail-byte
    const lexHigh_sqlLow = 'ff000000-0000-0000-0000-000000000001';
    // Lexicographic: lexHigh_sqlLow ('ff...') > lexLow_sqlHigh ('00...').
    expect(lexHigh_sqlLow > lexLow_sqlHigh).toBe(true);
    // SQL Server: byte[15]=0xff (lexLow_sqlHigh) is most-significant and beats byte[15]=0x01.
    expect(compareSqlServerGuid(lexLow_sqlHigh, lexHigh_sqlLow)).toBeGreaterThan(0);
  });

  it('reports equality for identical GUIDs', () => {
    const g = 'abcdef01-2345-6789-abcd-ef0123456789';
    expect(compareSqlServerGuid(g, g)).toBe(0);
  });
});
