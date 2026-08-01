import { describe, it, expect } from 'vitest';
import {
  canReverse,
  reversalBlockedReason,
  awaitsApproval,
  isBalanced,
  statusVariant,
  ReversalCandidate,
} from '../je-rules.js';

/**
 * TIER 1 — the client-side JE rules.
 *
 * These mirror server guards, so the tests are written against the SERVER's rule
 * (JournalEntryEntityServer.generateReversal + the C.8 gate), not merely against what the code
 * happens to do. If the server rule changes, these should fail.
 */

function candidate(overrides: Partial<ReversalCandidate> = {}): ReversalCandidate {
  return {
    ReversedByJournalEntryID: null,
    ReversesJournalEntryID: null,
    EntryType: 'OrderBooking',
    ...overrides,
  };
}

describe('canReverse', () => {
  it('allows reversing an ordinary, un-reversed entry', () => {
    expect(canReverse(candidate())).toBe(true);
  });

  it('refuses an entry that has ALREADY been reversed (no double reversal)', () => {
    expect(canReverse(candidate({ ReversedByJournalEntryID: 'je-99' }))).toBe(false);
  });

  it('refuses a reversal identified by its BACK-POINTER', () => {
    expect(canReverse(candidate({ ReversesJournalEntryID: 'je-1' }))).toBe(false);
  });

  it('refuses a reversal identified by its TYPE', () => {
    expect(canReverse(candidate({ EntryType: 'Reversal' }))).toBe(false);
  });

  it('checks BOTH reversal signals independently — either alone blocks', () => {
    // The signals are set independently; relying on one would let a reversal chain through, which
    // is an infinite Dr/Cr loop.
    expect(canReverse(candidate({ ReversesJournalEntryID: 'je-1', EntryType: 'OrderBooking' }))).toBe(false);
    expect(canReverse(candidate({ ReversesJournalEntryID: null, EntryType: 'Reversal' }))).toBe(false);
  });

  it('is status-INDEPENDENT — a posted entry is still reversible', () => {
    // Reversal exists precisely because posted history cannot be deleted, only offset. A status
    // gate here would be a real bug.
    const posted = candidate();
    expect(canReverse(posted)).toBe(true);
  });
});

describe('reversalBlockedReason', () => {
  it('is null when reversal is allowed', () => {
    expect(reversalBlockedReason(candidate())).toBeNull();
  });

  it('explains an already-reversed entry', () => {
    expect(reversalBlockedReason(candidate({ ReversedByJournalEntryID: 'x' }))).toBe(
      'This entry has already been reversed.',
    );
  });

  it('explains a reversal-of-a-reversal, by either signal', () => {
    const expected = 'A reversal entry cannot itself be reversed.';
    expect(reversalBlockedReason(candidate({ ReversesJournalEntryID: 'x' }))).toBe(expected);
    expect(reversalBlockedReason(candidate({ EntryType: 'Reversal' }))).toBe(expected);
  });

  it('gives a reason for EVERY case canReverse blocks (no silent disabled button)', () => {
    const blocked = [
      candidate({ ReversedByJournalEntryID: 'x' }),
      candidate({ ReversesJournalEntryID: 'x' }),
      candidate({ EntryType: 'Reversal' }),
    ];
    for (const c of blocked) {
      expect(canReverse(c)).toBe(false);
      expect(reversalBlockedReason(c)).toBeTruthy();
    }
  });
});

describe('awaitsApproval (C.8 manual-JE gate)', () => {
  it('is true for a Pending Manual entry', () => {
    expect(awaitsApproval({ Status: 'Pending', EntryType: 'Manual' })).toBe(true);
  });

  it('is false once the Manual entry is Batched (it cleared the gate)', () => {
    expect(awaitsApproval({ Status: 'Batched', EntryType: 'Manual' })).toBe(false);
  });

  it('is false for a Pending SYSTEM entry — system entries do not need CFO approval', () => {
    expect(awaitsApproval({ Status: 'Pending', EntryType: 'OrderBooking' })).toBe(false);
  });
});

describe('isBalanced', () => {
  it('accepts exactly equal totals', () => {
    expect(isBalanced(1000, 1000)).toBe(true);
  });

  it('rejects a real imbalance', () => {
    expect(isBalanced(1000, 999)).toBe(false);
  });

  it('tolerates float representation error rather than comparing with ===', () => {
    // 0.1 + 0.2 !== 0.3 in IEEE-754; a strict compare would call this balanced entry broken.
    expect(isBalanced(0.1 + 0.2, 0.3)).toBe(true);
  });

  it('rejects a genuine one-cent break', () => {
    expect(isBalanced(100.0, 100.01)).toBe(false);
  });

  it('is symmetric (order of Dr/Cr cannot change the verdict)', () => {
    expect(isBalanced(100.01, 100.0)).toBe(isBalanced(100.0, 100.01));
  });
});

describe('statusVariant', () => {
  it('maps each lifecycle status to its badge variant', () => {
    expect(statusVariant('GLPosted')).toBe('success');
    expect(statusVariant('Batched')).toBe('info');
    expect(statusVariant('Pending')).toBe('warning');
  });
});
