import { describe, it, expect } from 'vitest';
import { pendingCandidateFilter, computeControlTotals } from '../BatchingEngine';
import type { NetGroup } from '../BatchingEngine';

/**
 * TIER 1 — the batch candidate filter + control totals (§8.2 criteria panel, MOD-14).
 *
 * `pendingCandidateFilter` decides WHICH journal entries end up in a batch. A mistake here does not
 * throw — it silently batches the wrong entries, which is the worst failure mode this app has. It is
 * pure and exported precisely so it can be pinned exhaustively here rather than through a DB.
 */

const GUID_A = '11111111-1111-1111-1111-111111111111';
const GUID_B = '22222222-2222-2222-2222-222222222222';

describe('pendingCandidateFilter', () => {
  describe('the always-on floor', () => {
    it('always constrains to Pending (the candidate pool IS the Pending pool)', () => {
      // This is what inherently excludes GLPosted + already-batched entries. If it ever went
      // missing, a build would re-batch settled history.
      expect(pendingCandidateFilter({})).toBe(`Status='Pending'`);
    });
  });

  describe('date window (B1.1 / MOD-8)', () => {
    it('treats a DATE-only cutoff as INCLUSIVE of that whole day', () => {
      // "batch everything up to the end of the month" must include entries stamped ON the 31st.
      // A naive `<= '2026-07-31'` would drop any datetime later than midnight that day.
      expect(pendingCandidateFilter({ cutoff: new Date('2026-07-31T00:00:00.000Z') })).toBe(
        `Status='Pending' AND EffectiveDate < '2026-08-01'`,
      );
    });

    it('treats a DATETIME cutoff as exact', () => {
      expect(pendingCandidateFilter({ cutoff: new Date('2026-07-31T14:30:00.000Z') })).toBe(
        `Status='Pending' AND EffectiveDate <= '2026-07-31T14:30:00.000Z'`,
      );
    });

    it('rolls a month-end date-only cutoff into the next MONTH correctly', () => {
      expect(pendingCandidateFilter({ cutoff: new Date('2026-02-28T00:00:00.000Z') })).toContain(`< '2026-03-01'`);
    });

    it('rolls a year-end date-only cutoff into the next YEAR correctly', () => {
      expect(pendingCandidateFilter({ cutoff: new Date('2026-12-31T00:00:00.000Z') })).toContain(`< '2027-01-01'`);
    });

    it('handles a leap day', () => {
      expect(pendingCandidateFilter({ cutoff: new Date('2024-02-29T00:00:00.000Z') })).toContain(`< '2024-03-01'`);
    });

    it('applies a startDate lower bound', () => {
      expect(pendingCandidateFilter({ startDate: new Date('2026-07-01T00:00:00.000Z') })).toBe(
        `Status='Pending' AND EffectiveDate >= '2026-07-01'`,
      );
    });

    it('combines both bounds', () => {
      const f = pendingCandidateFilter({
        startDate: new Date('2026-07-01T00:00:00.000Z'),
        cutoff: new Date('2026-07-31T00:00:00.000Z'),
      });
      expect(f).toBe(`Status='Pending' AND EffectiveDate >= '2026-07-01' AND EffectiveDate < '2026-08-01'`);
    });
  });

  describe('company scope (§8.2)', () => {
    it('adds no clause when omitted — omitted means ALL companies (the CH-4 global sweep)', () => {
      expect(pendingCandidateFilter({})).not.toContain('CompanyID');
    });

    it('adds NO clause for an EMPTY array — empty means all, never `IN ()`', () => {
      // The bug this pins: emitting `CompanyID IN ()` would be a SQL syntax error at best, and
      // semantically "nothing" at worst — a build that silently batches zero entries.
      const f = pendingCandidateFilter({ companyIds: [] });
      expect(f).toBe(`Status='Pending'`);
      expect(f).not.toContain('IN ()');
    });

    it('scopes to one company', () => {
      expect(pendingCandidateFilter({ companyIds: [GUID_A] })).toBe(`Status='Pending' AND CompanyID IN ('${GUID_A}')`);
    });

    it('scopes to several companies', () => {
      expect(pendingCandidateFilter({ companyIds: [GUID_A, GUID_B] })).toBe(
        `Status='Pending' AND CompanyID IN ('${GUID_A}','${GUID_B}')`,
      );
    });

    it('REJECTS a non-GUID company id rather than quoting it', () => {
      // These ids arrive from a UI filter and are concatenated into SQL. No legitimate company id
      // needs escaping, so anything that is not a UUID is refused outright.
      expect(() => pendingCandidateFilter({ companyIds: [`x' OR '1'='1`] })).toThrow(/invalid company id/i);
    });

    it('rejects an injection attempt disguised as a GUID-ish string', () => {
      expect(() => pendingCandidateFilter({ companyIds: [`${GUID_A}'); DROP TABLE JournalEntry--`] })).toThrow(
        /invalid company id/i,
      );
    });
  });

  describe('entry-type scope (§8.2)', () => {
    it('adds no clause when omitted or empty', () => {
      expect(pendingCandidateFilter({ entryTypes: [] })).toBe(`Status='Pending'`);
      expect(pendingCandidateFilter({})).not.toContain('EntryType');
    });

    it('scopes to one type', () => {
      expect(pendingCandidateFilter({ entryTypes: ['Manual'] })).toBe(`Status='Pending' AND EntryType IN ('Manual')`);
    });

    it('scopes to several types', () => {
      expect(pendingCandidateFilter({ entryTypes: ['Manual', 'OrderBooking'] })).toBe(
        `Status='Pending' AND EntryType IN ('Manual','OrderBooking')`,
      );
    });

    it('escapes a quote in an entry type rather than breaking out of the literal', () => {
      const f = pendingCandidateFilter({ entryTypes: [`O'Booking`] });
      expect(f).toContain(`'O''Booking'`);
      expect(f.match(/'/g)!.length % 2).toBe(0);
    });
  });

  describe('everything composed', () => {
    it('ANDs the floor + window + company + type in a stable order', () => {
      const f = pendingCandidateFilter({
        startDate: new Date('2026-07-01T00:00:00.000Z'),
        cutoff: new Date('2026-07-31T00:00:00.000Z'),
        companyIds: [GUID_A],
        entryTypes: ['Manual'],
      });
      expect(f).toBe(
        `Status='Pending' AND EffectiveDate >= '2026-07-01' AND EffectiveDate < '2026-08-01' ` +
          `AND CompanyID IN ('${GUID_A}') AND EntryType IN ('Manual')`,
      );
    });
  });
});

describe('computeControlTotals', () => {
  const group = (side: 'Debit' | 'Credit', net: number): NetGroup => ({
    companyId: GUID_A,
    glAccountId: GUID_B,
    dims: [],
    dimKey: '',
    net: side === 'Debit' ? net : -net,
    side,
    sourceLineCount: 1,
  });

  it('is zero for no groups', () => {
    expect(computeControlTotals([])).toEqual({ totalDebits: 0, totalCredits: 0 });
  });

  it('sums each side independently', () => {
    expect(computeControlTotals([group('Debit', 100), group('Debit', 50), group('Credit', 150)])).toEqual({
      totalDebits: 150,
      totalCredits: 150,
    });
  });

  it('reports credits as a POSITIVE total (the net is stored signed)', () => {
    // A credit group carries net < 0; the control total must be the positive magnitude, because
    // that is what the DB reconcile trigger (50014/50023) compares the summary against.
    expect(computeControlTotals([group('Credit', 42)])).toEqual({ totalDebits: 0, totalCredits: 42 });
  });

  it('rounds to cents so float drift cannot break the foots-check', () => {
    // 0.1 + 0.2 = 0.30000000000000004; unrounded, the trigger would see an unbalanced batch.
    expect(computeControlTotals([group('Debit', 0.1), group('Debit', 0.2), group('Credit', 0.3)])).toEqual({
      totalDebits: 0.3,
      totalCredits: 0.3,
    });
  });

  it('produces a balanced pair for a balanced group set (the invariant the trigger enforces)', () => {
    const totals = computeControlTotals([group('Debit', 1000), group('Credit', 400), group('Credit', 600)]);
    expect(totals.totalDebits).toBe(totals.totalCredits);
  });
});
