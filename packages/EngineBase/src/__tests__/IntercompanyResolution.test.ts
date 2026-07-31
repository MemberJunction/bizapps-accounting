/**
 * Unit tests for ResolveIntercompanyAccounts (BA-D26) — the Due To / Due From lookup for an
 * ORDERED company pair.
 *
 * These drive the real method rather than a extracted helper, because the behaviour worth
 * protecting is not the window arithmetic (pickActiveLinkIndex already has its own tests) but the
 * ORIENTATION: which account lands on which company's books, and that reversing the arguments is a
 * genuinely different question. A backwards pair still produces a balanced journal entry, so no
 * downstream assertion would ever catch it — these tests are the only thing that will.
 *
 * The cached collections are stubbed by shadowing the two getters on an instance, so no DB, no
 * BaseEngine.Config, no provider.
 *
 * CONNECTS TO:
 *   TESTS: ../AccountingEngineBase.ts (ResolveIntercompanyAccounts)
 *   DB:    trg_IAM_AccountIntegrity enforces the same orientation server-side (50024-50026)
 */
import { describe, it, expect } from 'vitest';
import { AccountingEngineBase } from '../AccountingEngineBase.js';

const COMPANY_A = 'AAAAAAAA-0000-0000-0000-000000000001';
const COMPANY_B = 'BBBBBBBB-0000-0000-0000-000000000002';
const COMPANY_C = 'CCCCCCCC-0000-0000-0000-000000000003';
const A_DUE_TO_B = '11111111-0000-0000-0000-00000000000A';
const B_DUE_FROM_A = '22222222-0000-0000-0000-00000000000B';
const MATCH_1 = 'DDDDDDDD-0000-0000-0000-000000000001';
const DIM_DEPT = 'EEEEEEEE-0000-0000-0000-00000000000D';
const DIM_REGION = 'EEEEEEEE-0000-0000-0000-00000000000E';
const VALUE_FINANCE = 'FFFFFFFF-0000-0000-0000-00000000000F';

const d = (iso: string): Date => new Date(iso);

interface MatchRow {
  ID: string;
  SourceCompanyID: string;
  TargetCompanyID: string;
  DueToGLAccountID: string;
  DueFromGLAccountID: string;
  Status: string;
  StartedAt: Date | null;
  EndedAt: Date | null;
}

interface DimRow {
  IntercompanyAccountMatchID: string;
  Side: string;
  DimensionID: string;
  DimensionValueID: string | null;
  Sequence: number;
}

const match = (over: Partial<MatchRow> = {}): MatchRow => ({
  ID: MATCH_1,
  SourceCompanyID: COMPANY_A,
  TargetCompanyID: COMPANY_B,
  DueToGLAccountID: A_DUE_TO_B,
  DueFromGLAccountID: B_DUE_FROM_A,
  Status: 'Active',
  StartedAt: null,
  EndedAt: null,
  ...over,
});

/** An engine whose two cached collections are the given rows. Getters are shadowed on the instance. */
function engineWith(matches: MatchRow[], dimensions: DimRow[] = []): AccountingEngineBase {
  const engine = Object.create(AccountingEngineBase.prototype) as AccountingEngineBase;
  Object.defineProperty(engine, 'IntercompanyAccountMatches', { get: () => matches });
  Object.defineProperty(engine, 'IntercompanyAccountMatchDimensions', { get: () => dimensions });
  return engine;
}

describe('ResolveIntercompanyAccounts — orientation', () => {
  it('puts the Due To liability on the SOURCE company and the Due From receivable on the TARGET', () => {
    const engine = engineWith([match()]);
    const resolved = engine.ResolveIntercompanyAccounts(COMPANY_A, COMPANY_B, d('2026-07-26'));

    expect(resolved).not.toBeNull();
    expect(resolved!.DueTo.GLAccountID).toBe(A_DUE_TO_B);
    expect(resolved!.DueTo.CompanyID).toBe(COMPANY_A);
    expect(resolved!.DueFrom.GLAccountID).toBe(B_DUE_FROM_A);
    expect(resolved!.DueFrom.CompanyID).toBe(COMPANY_B);
  });

  it('does NOT resolve the reverse direction from a one-way row — the pair is ordered', () => {
    // The whole reason the table stores ordered pairs. If this ever returned the same row with the
    // legs swapped, A collecting for B and B collecting for A would post to identical accounts.
    const engine = engineWith([match()]);
    expect(engine.ResolveIntercompanyAccounts(COMPANY_B, COMPANY_A, d('2026-07-26'))).toBeNull();
  });

  it('resolves each direction to its own row when both are configured', () => {
    const reverse = match({
      ID: 'DDDDDDDD-0000-0000-0000-000000000002',
      SourceCompanyID: COMPANY_B,
      TargetCompanyID: COMPANY_A,
      DueToGLAccountID: 'B-DUE-TO-A',
      DueFromGLAccountID: 'A-DUE-FROM-B',
    });
    const engine = engineWith([match(), reverse]);

    const aCollects = engine.ResolveIntercompanyAccounts(COMPANY_A, COMPANY_B, d('2026-07-26'));
    const bCollects = engine.ResolveIntercompanyAccounts(COMPANY_B, COMPANY_A, d('2026-07-26'));

    expect(aCollects!.DueTo.GLAccountID).toBe(A_DUE_TO_B);
    expect(bCollects!.DueTo.GLAccountID).toBe('B-DUE-TO-A');
    expect(aCollects!.Match.ID).not.toBe(bCollects!.Match.ID);
  });

  it('matches company IDs case-insensitively (SQL Server upper vs randomUUID lower)', () => {
    const engine = engineWith([match({ SourceCompanyID: COMPANY_A.toUpperCase(), TargetCompanyID: COMPANY_B.toUpperCase() })]);
    const resolved = engine.ResolveIntercompanyAccounts(COMPANY_A.toLowerCase(), COMPANY_B.toLowerCase(), d('2026-07-26'));
    expect(resolved).not.toBeNull();
  });
});

describe('ResolveIntercompanyAccounts — when it must return null', () => {
  it('returns null when no pair is configured for those companies', () => {
    const engine = engineWith([match()]);
    expect(engine.ResolveIntercompanyAccounts(COMPANY_A, COMPANY_C, d('2026-07-26'))).toBeNull();
  });

  it('returns null for a company paired with itself', () => {
    // Not an error: the caller skipping same-company legs is the common case (a single-company
    // order), and the DB CHECK already makes such a row unstorable.
    const engine = engineWith([match()]);
    expect(engine.ResolveIntercompanyAccounts(COMPANY_A, COMPANY_A, d('2026-07-26'))).toBeNull();
  });

  it('returns null for empty or missing company IDs rather than matching a blank row', () => {
    const engine = engineWith([match()]);
    expect(engine.ResolveIntercompanyAccounts('', COMPANY_B, d('2026-07-26'))).toBeNull();
    expect(engine.ResolveIntercompanyAccounts(COMPANY_A, '', d('2026-07-26'))).toBeNull();
  });

  it('ignores Pending and Disabled pairs', () => {
    expect(engineWith([match({ Status: 'Pending' })]).ResolveIntercompanyAccounts(COMPANY_A, COMPANY_B, d('2026-07-26'))).toBeNull();
    expect(engineWith([match({ Status: 'Disabled' })]).ResolveIntercompanyAccounts(COMPANY_A, COMPANY_B, d('2026-07-26'))).toBeNull();
  });

  it('returns null when the effective window does not cover the date', () => {
    const notYet = engineWith([match({ StartedAt: d('2026-08-01') })]);
    const expired = engineWith([match({ EndedAt: d('2026-06-30') })]);
    expect(notYet.ResolveIntercompanyAccounts(COMPANY_A, COMPANY_B, d('2026-07-26'))).toBeNull();
    expect(expired.ResolveIntercompanyAccounts(COMPANY_A, COMPANY_B, d('2026-07-26'))).toBeNull();
  });
});

describe('ResolveIntercompanyAccounts — supersession', () => {
  it('picks the later StartedAt when an open-ended row is superseded by a dated one', () => {
    // "New intercompany agreement effective Aug 1", pre-entered while the old mapping still runs.
    const engine = engineWith([
      match({ ID: 'OLD', DueToGLAccountID: 'OLD-DUE-TO' }),
      match({ ID: 'NEW', DueToGLAccountID: 'NEW-DUE-TO', StartedAt: d('2026-08-01') }),
    ]);

    expect(engine.ResolveIntercompanyAccounts(COMPANY_A, COMPANY_B, d('2026-07-26'))!.DueTo.GLAccountID).toBe('OLD-DUE-TO');
    expect(engine.ResolveIntercompanyAccounts(COMPANY_A, COMPANY_B, d('2026-08-15'))!.DueTo.GLAccountID).toBe('NEW-DUE-TO');
  });

  it('is unaffected by pairs belonging to other company combinations', () => {
    const engine = engineWith([
      match({ ID: 'OTHER', TargetCompanyID: COMPANY_C, DueToGLAccountID: 'A-DUE-TO-C' }),
      match(),
    ]);
    expect(engine.ResolveIntercompanyAccounts(COMPANY_A, COMPANY_B, d('2026-07-26'))!.DueTo.GLAccountID).toBe(A_DUE_TO_B);
  });
});

describe('ResolveIntercompanyAccounts — dimensions', () => {
  const dims: DimRow[] = [
    { IntercompanyAccountMatchID: MATCH_1, Side: 'DueFrom', DimensionID: DIM_REGION, DimensionValueID: null, Sequence: 5 },
    { IntercompanyAccountMatchID: MATCH_1, Side: 'DueTo', DimensionID: DIM_REGION, DimensionValueID: null, Sequence: 20 },
    { IntercompanyAccountMatchID: MATCH_1, Side: 'DueTo', DimensionID: DIM_DEPT, DimensionValueID: VALUE_FINANCE, Sequence: 10 },
  ];

  it('gives each leg only its own side of the dimensions', () => {
    const resolved = engineWith([match()], dims).ResolveIntercompanyAccounts(COMPANY_A, COMPANY_B, d('2026-07-26'))!;
    expect(resolved.DueTo.Dimensions.map((x) => x.DimensionID)).toEqual([DIM_DEPT, DIM_REGION]);
    expect(resolved.DueFrom.Dimensions.map((x) => x.DimensionID)).toEqual([DIM_REGION]);
  });

  it('orders each side by Sequence', () => {
    const resolved = engineWith([match()], dims).ResolveIntercompanyAccounts(COMPANY_A, COMPANY_B, d('2026-07-26'))!;
    expect(resolved.DueTo.Dimensions.map((x) => x.Sequence)).toEqual([10, 20]);
  });

  it('preserves a pinned DimensionValueID and keeps null meaning "from context"', () => {
    const resolved = engineWith([match()], dims).ResolveIntercompanyAccounts(COMPANY_A, COMPANY_B, d('2026-07-26'))!;
    expect(resolved.DueTo.Dimensions.find((x) => x.DimensionID === DIM_DEPT)!.DimensionValueID).toBe(VALUE_FINANCE);
    expect(resolved.DueTo.Dimensions.find((x) => x.DimensionID === DIM_REGION)!.DimensionValueID).toBeNull();
  });

  it('does not leak dimensions from a different match', () => {
    const foreign: DimRow[] = [
      ...dims,
      { IntercompanyAccountMatchID: 'SOME-OTHER-MATCH', Side: 'DueTo', DimensionID: 'FOREIGN-DIM', DimensionValueID: null, Sequence: 1 },
    ];
    const resolved = engineWith([match()], foreign).ResolveIntercompanyAccounts(COMPANY_A, COMPANY_B, d('2026-07-26'))!;
    expect(resolved.DueTo.Dimensions.map((x) => x.DimensionID)).not.toContain('FOREIGN-DIM');
  });

  it('returns empty dimension lists when none are configured', () => {
    const resolved = engineWith([match()], []).ResolveIntercompanyAccounts(COMPANY_A, COMPANY_B, d('2026-07-26'))!;
    expect(resolved.DueTo.Dimensions).toEqual([]);
    expect(resolved.DueFrom.Dimensions).toEqual([]);
  });
});
