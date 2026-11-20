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
import { describe, it, expect, vi } from 'vitest';
import { BaseEngine, BaseEnginePropertyConfig } from '@memberjunction/core';
import type {
  mjBizAppsAccountingAccountingCompanyProfileEntity,
  mjBizAppsAccountingGLAccountEntity,
  mjBizAppsAccountingGLAccountLinkDimensionEntity,
  mjBizAppsAccountingGLAccountLinkEntity,
  mjBizAppsAccountingGLAccountRoleEntity,
  mjBizAppsAccountingIntercompanyAccountMatchDimensionEntity,
  mjBizAppsAccountingIntercompanyAccountMatchEntity,
  mjBizAppsAccountingJournalEntryTypeEntity,
} from '@mj-biz-apps/accounting-entities';
import {
  AccountingEngineBase,
  coveringActiveLinkIndexes,
  pickActiveLinkIndex,
  type LinkCandidate,
} from '../AccountingEngineBase.js';

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

describe('AccountingEngineBase indexing, caching, and lifecycle', () => {
  class TestableAccountingEngine extends AccountingEngineBase {
    public static create(): TestableAccountingEngine {
      return new TestableAccountingEngine();
    }

    public triggerNotifyDataChange(propertyName: string): void {
      const config = new BaseEnginePropertyConfig({ PropertyName: propertyName, EntityName: 'test-entity' });
      this.NotifyDataChange(config, [], 'refresh');
    }
  }

  const gl1 = {
    ID: '11111111-0000-0000-0000-000000000001',
    CompanyID: '22222222-0000-0000-0000-000000000001',
    Code: '1000',
    Name: 'Cash',
    IsActive: true,
  } as mjBizAppsAccountingGLAccountEntity;

  const gl2 = {
    ID: '11111111-0000-0000-0000-000000000002',
    CompanyID: '22222222-0000-0000-0000-000000000001',
    Code: '2000',
    Name: 'Accounts Payable',
    IsActive: true,
  } as mjBizAppsAccountingGLAccountEntity;

  const role1 = {
    ID: '33333333-0000-0000-0000-000000000001',
    Name: 'CashAccount',
    Cardinality: 'One' as const,
    Sequence: 1,
  } as mjBizAppsAccountingGLAccountRoleEntity;

  const profile1 = {
    ID: '22222222-0000-0000-0000-000000000001',
    EntityType: 'LegalEntity',
    ParentAccountingCompanyID: null,
    FiscalYearStartMonth: 7,
    FiscalYearStartDay: 1,
    BooksClosedThroughDate: new Date('2026-06-30T00:00:00Z'),
  } as mjBizAppsAccountingAccountingCompanyProfileEntity;

  const link1 = {
    ID: '44444444-0000-0000-0000-000000000001',
    EntityID: '55555555-0000-0000-0000-000000000001',
    RecordID: 'rec-1',
    GLAccountRoleID: role1.ID,
    GLAccountID: gl1.ID,
    Status: 'Active' as const,
    StartedAt: null,
    EndedAt: null,
  } as mjBizAppsAccountingGLAccountLinkEntity;

  const linkDim1 = {
    ID: '66666666-0000-0000-0000-000000000001',
    GLAccountLinkID: link1.ID,
    DimensionID: 'dim-1',
    Sequence: 2,
  } as mjBizAppsAccountingGLAccountLinkDimensionEntity;

  const linkDim2 = {
    ID: '66666666-0000-0000-0000-000000000002',
    GLAccountLinkID: link1.ID,
    DimensionID: 'dim-2',
    Sequence: 1,
  } as mjBizAppsAccountingGLAccountLinkDimensionEntity;

  const match1 = {
    ID: '77777777-0000-0000-0000-000000000001',
    SourceCompanyID: '22222222-0000-0000-0000-000000000001',
    TargetCompanyID: '22222222-0000-0000-0000-000000000002',
    DueToGLAccountID: gl2.ID,
    DueFromGLAccountID: gl1.ID,
    Status: 'Active' as const,
    StartedAt: null,
    EndedAt: null,
  } as mjBizAppsAccountingIntercompanyAccountMatchEntity;

  const matchDim1 = {
    ID: '88888888-0000-0000-0000-000000000001',
    IntercompanyAccountMatchID: match1.ID,
    DimensionID: 'dim-1',
    DimensionValueID: 'val-1',
    Sequence: 1,
    Side: 'DueTo' as const,
  } as mjBizAppsAccountingIntercompanyAccountMatchDimensionEntity;

  const jet1 = {
    ID: '99999999-0000-0000-0000-000000000001',
    Code: 'OrderBooking',
    Name: 'Order Booking',
    IsActive: true,
    IsJournalEntryBatchSummary: false,
  } as mjBizAppsAccountingJournalEntryTypeEntity;

  const jetSummary = {
    ID: '99999999-0000-0000-0000-000000000002',
    Code: 'JournalEntryBatchSummary',
    Name: 'Batch Summary',
    IsActive: true,
    IsJournalEntryBatchSummary: true,
  } as mjBizAppsAccountingJournalEntryTypeEntity;

  it('preserves BaseEngine.prototype.AdditionalLoading so canUseImmediateMutation remains true', () => {
    expect(Reflect.get(AccountingEngineBase.prototype, 'AdditionalLoading')).toBe(
      Reflect.get(BaseEngine.prototype, 'AdditionalLoading'),
    );
  });

  it('resolves items in O(1) through cached Maps across all collections', () => {
    const engine = TestableAccountingEngine.create();
    vi.spyOn(engine, 'GLAccounts', 'get').mockReturnValue([gl1, gl2]);
    vi.spyOn(engine, 'GLAccountRoles', 'get').mockReturnValue([role1]);
    vi.spyOn(engine, 'CompanyProfiles', 'get').mockReturnValue([profile1]);
    vi.spyOn(engine, 'GLAccountLinks', 'get').mockReturnValue([link1]);
    vi.spyOn(engine, 'GLAccountLinkDimensions', 'get').mockReturnValue([linkDim1, linkDim2]);
    vi.spyOn(engine, 'IntercompanyAccountMatches', 'get').mockReturnValue([match1]);
    vi.spyOn(engine, 'IntercompanyAccountMatchDimensions', 'get').mockReturnValue([matchDim1]);
    vi.spyOn(engine, 'JournalEntryTypes', 'get').mockReturnValue([jet1, jetSummary]);

    // GL Accounts lookups
    expect(engine.GLAccountByID(gl1.ID)).toBe(gl1);
    expect(engine.GLAccountByID(gl1.ID.toUpperCase())).toBe(gl1);
    expect(engine.GLAccountByID('00000000-0000-0000-0000-000000000000')).toBeUndefined();
    expect(engine.GLAccountByCompanyAndCode(gl1.CompanyID, '1000')).toBe(gl1);
    expect(engine.GLAccountByCompanyAndCode(gl1.CompanyID, ' 1000 ')).toBe(gl1);
    expect(engine.GLAccountByCompanyAndCode(gl1.CompanyID, '9999')).toBeUndefined();

    // Roles lookups
    expect(engine.GLAccountRoleByName('cashaccount')).toBe(role1);
    expect(engine.GLAccountRoleByName('CASHACCOUNT')).toBe(role1);
    expect(engine.GLAccountRoleByName('UnknownRole')).toBeUndefined();

    // Profiles lookups
    expect(engine.FiscalYearStartFor(profile1.ID)).toEqual({ Month: 7, Day: 1 });
    expect(engine.FiscalYearStartFor('missing-id')).toEqual({ Month: 1, Day: 1 });
    expect(engine.BooksClosedThroughFor(profile1.ID)).toEqual(profile1.BooksClosedThroughDate);
    expect(engine.BooksClosedThroughFor('missing-id')).toBeNull();
    expect(engine.LegalEntityFor(profile1.ID)).toBe(profile1.ID);

    // Link resolution with ordered dimensions
    const resolvedLink = engine.ResolveLinkedAccount(link1.EntityID, link1.RecordID, role1.Name, new Date('2026-07-01'));
    expect(resolvedLink).not.toBeNull();
    expect(resolvedLink?.Link).toBe(link1);
    expect(resolvedLink?.Dimensions).toEqual([linkDim2, linkDim1]); // pre-sorted Sequence 1, then 2

    // Intercompany resolution
    const resolvedMatch = engine.ResolveIntercompanyAccounts(match1.SourceCompanyID, match1.TargetCompanyID, new Date('2026-07-01'));
    expect(resolvedMatch).not.toBeNull();
    expect(resolvedMatch?.Match).toBe(match1);
    expect(resolvedMatch?.DueTo.Dimensions).toEqual([
      { DimensionID: matchDim1.DimensionID, DimensionValueID: matchDim1.DimensionValueID, Sequence: matchDim1.Sequence },
    ]);
    expect(engine.ResolveIntercompanyAccounts(match1.SourceCompanyID, match1.SourceCompanyID, new Date('2026-07-01'))).toBeNull();

    // Journal entry type lookups
    expect(engine.JournalEntryTypeByCode('orderbooking')).toBe(jet1);
    expect(engine.JournalEntryBatchSummaryEntryType).toBe(jetSummary);
  });

  it('invalidates lazy Map indexes when NotifyDataChange fires', () => {
    const engine = TestableAccountingEngine.create();
    let accountsList = [gl1];
    vi.spyOn(engine, 'GLAccounts', 'get').mockImplementation(() => accountsList);

    expect(engine.GLAccountByID(gl1.ID)).toBe(gl1);
    expect(engine.GLAccountByID(gl2.ID)).toBeUndefined();

    // Update list and trigger NotifyDataChange
    accountsList = [gl1, gl2];
    engine.triggerNotifyDataChange('_glAccounts');

    expect(engine.GLAccountByID(gl2.ID)).toBe(gl2);
  });

  it('preserves PermissionConstrainedError on collection access and evaluates lazily', () => {
    const engine = TestableAccountingEngine.create();
    const permError = new Error('Permission denied on _glAccounts');
    permError.name = 'PermissionConstrainedError';

    vi.spyOn(engine, 'GLAccounts', 'get').mockImplementation(() => {
      throw permError;
    });
    vi.spyOn(engine, 'GLAccountRoles', 'get').mockReturnValue([role1]);

    // Lookup on GLAccounts throws PermissionConstrainedError
    expect(() => engine.GLAccountByID(gl1.ID)).toThrow(permError);

    // But lookup on GLAccountRoles succeeds without touching GLAccounts
    expect(engine.GLAccountRoleByName(role1.Name)).toBe(role1);
  });
});
