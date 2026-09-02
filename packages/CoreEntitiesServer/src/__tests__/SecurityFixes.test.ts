/**
 * Security regressions:
 *  - sqlGuidLiteral: strict UUID validation that closes the second-order SQL-injection class in
 *    RunView ExtraFilter concatenation (GLAccountLink tie guard, JournalEntry attachment check,
 *    Standard batch build).
 *  - approveJournalEntryBatch: separation-of-duties — the batch creator may not approve their own
 *    batch, even as the configured CFO.
 */
import { describe, it, expect } from 'vitest';
import type { IMetadataProvider, UserInfo } from '@memberjunction/core';
import { sqlGuidLiteral, sqlTextLiteral } from '../sqlLiteral.js';
import { approveJournalEntryBatch } from '../JournalEntryBatchEngine.js';

describe('sqlGuidLiteral — strict UUID SQL literal', () => {
  const CTX = 'test';

  it('quotes a valid UUID', () => {
    expect(sqlGuidLiteral('11111111-2222-3333-4444-555555555555', CTX)).toBe(
      `'11111111-2222-3333-4444-555555555555'`,
    );
  });

  it('rejects a value carrying a single quote (injection attempt)', () => {
    expect(() => sqlGuidLiteral(`x' OR '1'='1`, CTX)).toThrow(/expected a UUID/);
  });

  it('rejects a value with a space / SQL keyword', () => {
    expect(() => sqlGuidLiteral(`1 OR 1=1`, CTX)).toThrow(/expected a UUID/);
    expect(() => sqlGuidLiteral(`'; DROP TABLE x;--`, CTX)).toThrow(/expected a UUID/);
  });

  it('rejects the empty string and wrong-length values', () => {
    expect(() => sqlGuidLiteral('', CTX)).toThrow();
    expect(() => sqlGuidLiteral('too-short', CTX)).toThrow();
  });
});

describe('sqlTextLiteral — safe string literal for polymorphic values', () => {
  it('doubles embedded single quotes', () => {
    expect(sqlTextLiteral(`O'Brien`)).toBe(`'O''Brien'`);
    expect(sqlTextLiteral(`x' OR '1'='1`)).toBe(`'x'' OR ''1''=''1'`);
  });
});

// ─── SoD: batch creator cannot approve their own batch ───────────────────────

interface FakeBatchState {
  Status: string;
  BatchedByUserID: string;
  ApprovedAt: Date | null;
  ApprovedByUserID: string | null;
  saved: boolean;
}

/** A minimal JournalEntryBatch stand-in that satisfies the fields approveJournalEntryBatch touches. */
function makeFakeBatch(state: FakeBatchState) {
  return {
    async Load(): Promise<boolean> { return true; },
    async Save(): Promise<boolean> { state.saved = true; return true; },
    LatestResult: null,
    get Status(): string { return state.Status; },
    set Status(v: string) { state.Status = v; },
    get BatchedByUserID(): string { return state.BatchedByUserID; },
    get ApprovedAt(): Date | null { return state.ApprovedAt; },
    set ApprovedAt(v: Date | null) { state.ApprovedAt = v; },
    get ApprovedByUserID(): string | null { return state.ApprovedByUserID; },
    set ApprovedByUserID(v: string | null) { state.ApprovedByUserID = v; },
  };
}

function makeProvider(state: FakeBatchState): IMetadataProvider {
  return { GetEntityObject: async () => makeFakeBatch(state) } as unknown as IMetadataProvider;
}

const CREATOR = '11111111-1111-1111-1111-111111111111';
const OTHER = '22222222-2222-2222-2222-222222222222';
const user = (id: string): UserInfo => ({ ID: id }) as unknown as UserInfo;

describe('approveJournalEntryBatch — separation of duties', () => {
  const freshState = (): FakeBatchState => ({
    Status: 'Pending', BatchedByUserID: CREATOR, ApprovedAt: null, ApprovedByUserID: null, saved: false,
  });

  it('rejects approval by the batch creator (self-approval)', async () => {
    const state = freshState();
    await expect(
      approveJournalEntryBatch('batch-1', CREATOR, user(CREATOR), makeProvider(state)),
    ).rejects.toThrow(/separation-of-duties/i);
    expect(state.saved).toBe(false); // never written
  });

  it('allows a different approver to approve', async () => {
    const state = freshState();
    const batch = await approveJournalEntryBatch('batch-1', OTHER, user(OTHER), makeProvider(state));
    expect(batch.Status).toBe('Approved');
    expect(state.saved).toBe(true);
  });
});
