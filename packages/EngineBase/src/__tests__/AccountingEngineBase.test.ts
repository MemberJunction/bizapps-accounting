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
import { BaseEngine, BaseEnginePropertyConfig, IMetadataProvider, Metadata, ProviderType, UserInfo } from '@memberjunction/core';
import type {
  mjBizAppsAccountingAccountingCompanyProfileEntity,
  mjBizAppsAccountingAccountingEngineExtensionEntity,
  mjBizAppsAccountingCompanyTaxNexusEntity,
  mjBizAppsAccountingCurrencyEntity,
  mjBizAppsAccountingDimensionEntity,
  mjBizAppsAccountingFinanceExceptionTypeEntity,
  mjBizAppsAccountingGLAccountEntity,
  mjBizAppsAccountingGLAccountLinkDimensionEntity,
  mjBizAppsAccountingGLAccountLinkEntity,
  mjBizAppsAccountingGLAccountRoleEntity,
  mjBizAppsAccountingIntercompanyAccountMatchDimensionEntity,
  mjBizAppsAccountingIntercompanyAccountMatchEntity,
  mjBizAppsAccountingJournalEntryTypeEntity,
  mjBizAppsAccountingTaxAuthorityEntity,
  mjBizAppsAccountingTaxJurisdictionEntity,
  mjBizAppsAccountingTaxRateEntity,
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

  it('resolves new O(1) indexed helpers for profiles, currencies, dimensions, extensions, exception types, and tax metadata', () => {
    const engine = TestableAccountingEngine.create();
    const currencyUsd = { ID: 'curr-1', Code: 'USD', Name: 'US Dollar' } as mjBizAppsAccountingCurrencyEntity;
    const dimDept = { ID: 'dddd0000-0000-0000-0000-000000000001', Code: 'DEPT', Name: 'Department' } as mjBizAppsAccountingDimensionEntity;
    const ext = { ID: 'ext-1', Code: 'ImportBankBalances', Name: 'Import Bank Balances', Sequence: 1 } as mjBizAppsAccountingAccountingEngineExtensionEntity;
    const excType = { ID: 'exc-1', Code: 'ERP_POSTING_REJECTED', Name: 'ERP Posting Rejected', IsActive: true } as mjBizAppsAccountingFinanceExceptionTypeEntity;
    const taxAuth = { ID: 'aaaa0000-0000-0000-0000-000000000001', Code: 'US-IRS', Name: 'IRS' } as mjBizAppsAccountingTaxAuthorityEntity;
    const taxJur = { ID: 'bbbb0000-0000-0000-0000-000000000001', TaxAuthorityID: taxAuth.ID, Code: 'US-CA', Name: 'California' } as mjBizAppsAccountingTaxJurisdictionEntity;
    const taxRate = { ID: 'cccc0000-0000-0000-0000-000000000001', TaxJurisdictionID: taxJur.ID, TaxCategory: 'Standard', Rate: 0.0725 } as mjBizAppsAccountingTaxRateEntity;
    const nexus = { ID: 'eeee0000-0000-0000-0000-000000000001', CompanyID: profile1.ID, TaxJurisdictionID: taxJur.ID } as mjBizAppsAccountingCompanyTaxNexusEntity;

    vi.spyOn(engine, 'CompanyProfiles', 'get').mockReturnValue([profile1]);
    vi.spyOn(engine, 'Currencies', 'get').mockReturnValue([currencyUsd]);
    vi.spyOn(engine, 'Dimensions', 'get').mockReturnValue([dimDept]);
    vi.spyOn(engine, 'AccountingEngineExtensions', 'get').mockReturnValue([ext]);
    vi.spyOn(engine, 'FinanceExceptionTypes', 'get').mockReturnValue([excType]);
    vi.spyOn(engine, 'TaxAuthorities', 'get').mockReturnValue([taxAuth]);
    vi.spyOn(engine, 'TaxJurisdictions', 'get').mockReturnValue([taxJur]);
    vi.spyOn(engine, 'TaxRates', 'get').mockReturnValue([taxRate]);
    vi.spyOn(engine, 'CompanyTaxNexus', 'get').mockReturnValue([nexus]);

    expect(engine.CompanyProfileByID(profile1.ID.toUpperCase())).toBe(profile1);
    expect(engine.CompanyProfileByID(null)).toBeUndefined();
    expect(engine.CurrencyByCode('usd')).toBe(currencyUsd);
    expect(engine.CurrencyByCode(' USD ')).toBe(currencyUsd);
    expect(engine.CurrencyByCode('EUR')).toBeUndefined();
    expect(engine.DimensionByID(dimDept.ID.toUpperCase())).toBe(dimDept);
    expect(engine.DimensionByCode('dept')).toBe(dimDept);
    expect(engine.AccountingEngineExtensionByCode('importbankbalances')).toBe(ext);
    expect(engine.FinanceExceptionTypeByCode('erp_posting_rejected')).toBe(excType);
    expect(engine.TaxAuthorityByID(taxAuth.ID.toUpperCase())).toBe(taxAuth);
    expect(engine.TaxAuthorityByCode('us-irs')).toBe(taxAuth);
    expect(engine.TaxJurisdictionByID(taxJur.ID.toUpperCase())).toBe(taxJur);
    expect(engine.TaxJurisdictionByCode('us-ca')).toBe(taxJur);
    expect(engine.TaxRatesForJurisdiction(taxJur.ID.toUpperCase())).toEqual([taxRate]);
    expect(engine.TaxRatesForJurisdiction('missing')).toEqual([]);
    expect(engine.CompanyTaxNexusForCompany(profile1.ID.toUpperCase())).toEqual([nexus]);
    expect(engine.CompanyTaxNexusForCompany('missing')).toEqual([]);
  });

  it('tracks ProviderToUse, enables CacheLocal on bounded reference tables, and evicts cache on client user change or InvalidateCache', async () => {
    const engine = TestableAccountingEngine.create();
    const userA = { ID: 'aaaa0000-0000-0000-0000-00000000000a' } as UserInfo;
    const userB = { ID: 'bbbb0000-0000-0000-0000-00000000000b' } as UserInfo;
    const networkProvider = { ProviderType: ProviderType.Network, CurrentUser: userA } as unknown as IMetadataProvider;
    const fallbackProvider = { ProviderType: ProviderType.Network, CurrentUser: userB } as unknown as IMetadataProvider;

    const mdSpy = vi.spyOn(Metadata, 'Provider', 'get').mockReturnValue(fallbackProvider);
    let isLoaded = false;
    vi.spyOn(engine, 'Loaded', 'get').mockImplementation(() => isLoaded);
    const loadSpy = vi.spyOn(engine as unknown as { Load: (...args: unknown[]) => Promise<void> }, 'Load').mockImplementation(async () => {
      isLoaded = true;
    });

    try {
      // Falls back to Metadata.Provider before an explicit provider is passed
      expect(engine.ProviderToUse).toBe(fallbackProvider);
      expect(engine.IsConfiguredForUser(userA.ID)).toBe(false);

      // Initial client load for User A
      await engine.Config(false, userA, networkProvider);
      expect(engine.ProviderToUse).toBe(networkProvider);
      expect(loadSpy).toHaveBeenCalledTimes(1);
      const [loadedParams, loadedProvider, firstForceRefresh] = loadSpy.mock.calls[0] as [
        Array<Partial<BaseEnginePropertyConfig>>,
        IMetadataProvider,
        boolean,
      ];
      expect(loadedProvider).toBe(networkProvider);
      expect(firstForceRefresh).toBe(false);
      expect(loadedParams.every((p) => p.CacheLocal === true)).toBe(true);
      const entityNames = loadedParams.map((p) => p.EntityName);
      expect(entityNames).toContain('MJ_BizApps_Accounting: Finance Exception Types');
      expect(entityNames).toContain('MJ_BizApps_Accounting: Accounting Engine Extensions');
      expect(entityNames).toContain('MJ_BizApps_Accounting: Tax Authorities');
      expect(entityNames).toContain('MJ_BizApps_Accounting: Tax Jurisdictions');
      expect(entityNames).toContain('MJ_BizApps_Accounting: Tax Rates');
      expect(entityNames).toContain('MJ_BizApps_Accounting: Company Tax Nexus');
      expect(entityNames).not.toContain('MJ_BizApps_Accounting: Journal Entries');
      expect(entityNames).not.toContain('MJ_BizApps_Accounting: Tax Liabilities');

      expect(engine.IsConfiguredForUser(userA.ID)).toBe(true);
      expect(engine.IsConfiguredForUser(userA.ID.toUpperCase())).toBe(true);
      expect(engine.IsConfiguredForUser(userB.ID)).toBe(false);

      // Same client user does NOT force refresh
      await engine.Config(false, userA, networkProvider);
      expect(loadSpy.mock.calls[1][2]).toBe(false);

      // Client user changes (impersonation) -> forces refresh and updates tracked user
      await engine.Config(false, userB, networkProvider);
      expect(loadSpy.mock.calls[2][2]).toBe(true);
      expect(engine.IsConfiguredForUser(userB.ID)).toBe(true);
      expect(engine.IsConfiguredForUser(userA.ID)).toBe(false);

      // InvalidateCache marks engine stale and forces next Config() reload
      engine.InvalidateCache();
      expect(engine.IsConfiguredForUser(userB.ID)).toBe(false);
      await engine.Config(false, userB, networkProvider);
      expect(loadSpy.mock.calls[3][2]).toBe(true);
      expect(engine.IsConfiguredForUser(userB.ID)).toBe(true);
    } finally {
      mdSpy.mockRestore();
    }
  });

  it('does NOT force reload on server (ProviderType.Database) when contextUser varies per request', async () => {
    const engine = TestableAccountingEngine.create();
    const userA = { ID: 'aaaa0000-0000-0000-0000-00000000000a' } as UserInfo;
    const userB = { ID: 'bbbb0000-0000-0000-0000-00000000000b' } as UserInfo;
    const dbProvider = { ProviderType: ProviderType.Database } as unknown as IMetadataProvider;

    let isLoaded = false;
    vi.spyOn(engine, 'Loaded', 'get').mockImplementation(() => isLoaded);
    const loadSpy = vi.spyOn(engine as unknown as { Load: (...args: unknown[]) => Promise<void> }, 'Load').mockImplementation(async () => {
      isLoaded = true;
    });

    await engine.Config(false, userA, dbProvider);
    expect(loadSpy.mock.calls[0][2]).toBe(false);
    expect(engine.IsConfiguredForUser(userA.ID)).toBe(true);
    expect(engine.IsConfiguredForUser(userB.ID)).toBe(true);

    // Per-request user change on server keeps shared cache without forcing reload
    await engine.Config(false, userB, dbProvider);
    expect(loadSpy.mock.calls[1][2]).toBe(false);

    // Explicit InvalidateCache still forces reload on server
    engine.InvalidateCache();
    expect(engine.IsConfiguredForUser(userB.ID)).toBe(false);
    await engine.Config(false, userB, dbProvider);
    expect(loadSpy.mock.calls[2][2]).toBe(true);
  });
});
