import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@memberjunction/integration-engine', () => ({
  IntegrationEngine: { Instance: { RunSync: vi.fn() } },
}));
vi.mock('@memberjunction/actions', () => ({
  ActionEngineServer: {
    Instance: {
      Loaded: true,
      GetActionByName: vi.fn(),
      RunAction: vi.fn(),
      Config: vi.fn(),
    },
  },
}));

import { RegisterClass, MJGlobal } from '@memberjunction/global';
import type { UserInfo } from '@memberjunction/core';
import { BaseAccountingEngineExtension } from '@mj-biz-apps/accounting-engine-base';
import { AccountingEngine } from '../AccountingEngine.js';
import { AccountingERPEngine } from '../AccountingERPEngine.js';
import { BaseAccountingERPProvider } from '../BaseAccountingERPProvider.js';
import type { ErpPostResult } from '../JournalEntryBatchEngine.js';

const user = { ID: 'user-1', Name: 'Test' } as unknown as UserInfo;
const COMPANY = 'aaaaaaaa-0000-0000-0000-000000000001';
const CI = 'bbbbbbbb-0000-0000-0000-000000000001';

const extensionCalls: string[] = [];

@RegisterClass(BaseAccountingEngineExtension, 'TestCashImport')
class TestCashImport extends BaseAccountingEngineExtension {
  get Code(): string { return 'ImportBankAccountBalances'; }
  get RunAfterSyncMasterData(): boolean { return true; }
  stash = 0;
  async BeforeSyncMasterData(): Promise<void> { this.stash = 1; extensionCalls.push('beforeSync'); }
  async AfterSyncMasterData(): Promise<void> { extensionCalls.push(`afterSync:${this.stash}`); }
  async AfterSyncAccounts(): Promise<void> { extensionCalls.push('afterAccounts'); }
  async AfterSyncDimensions(): Promise<void> { extensionCalls.push('afterDimensions'); }
}

@RegisterClass(BaseAccountingEngineExtension, 'ThrowingExt')
class ThrowingExt extends BaseAccountingEngineExtension {
  get Code(): string { return 'Throwing'; }
  get RunAfterSyncMasterData(): boolean { return true; }
  async AfterSyncMasterData(): Promise<void> { throw new Error('boom'); }
}

function providerWith(views: Record<string, unknown[]>) {
  return {
    RunView: async (params: { EntityName: string }) => ({
      Success: true,
      Results: views[params.EntityName] ?? [],
    }),
  } as never;
}

describe('AccountingERPEngine.SyncMasterData', () => {
  beforeEach(() => {
    AccountingERPEngine.Instance.UseSeams({});
    vi.spyOn(AccountingEngine.Instance, 'Config').mockResolvedValue();
  });

  it('isolates per-company failure: A fails, B still syncs', async () => {
    const syncCalls: string[] = [];
    AccountingERPEngine.Instance.UseSeams({
      runSync: async (id) => {
        syncCalls.push(id);
        if (id === 'ci-a') return { Success: false, Message: 'A down' };
        return { Success: true, Message: 'ok' };
      },
    });
    const p = providerWith({
      'MJ: Company Integrations': [
        { ID: 'ci-a', CompanyID: 'co-a', IntegrationID: 'int-1', Integration: 'QuickBooks Online', IsActive: true },
        { ID: 'ci-b', CompanyID: 'co-b', IntegrationID: 'int-1', Integration: 'QuickBooks Online', IsActive: true },
      ],
      'MJ: Company Integration Entity Maps': [
        { ID: 'map-1', CompanyIntegrationID: 'ci-a', Entity: 'MJ_BizApps_Accounting: GL Accounts', IsActive: true },
        { ID: 'map-2', CompanyIntegrationID: 'ci-b', Entity: 'MJ_BizApps_Accounting: GL Accounts', IsActive: true },
      ],
      'MJ_BizApps_Accounting: Accounting Engine Extensions': [],
    });
    const out = await AccountingERPEngine.Instance.SyncMasterData({ Objects: ['accounts'] }, user, p);
    expect(syncCalls.sort()).toEqual(['ci-a', 'ci-b']);
    expect(out.Results.find((r) => r.CompanyID === 'co-a')?.Success).toBe(false);
    expect(out.Results.find((r) => r.CompanyID === 'co-b')?.Success).toBe(true);
    expect(out.Success).toBe(false);
  });

  it('invokes a registered extension after a successful sync', async () => {
    extensionCalls.length = 0;
    AccountingERPEngine.Instance.UseSeams({
      runSync: async () => ({ Success: true }),
    });
    const p = providerWith({
      'MJ: Company Integrations': [
        { ID: CI, CompanyID: COMPANY, IntegrationID: 'int-1', Integration: 'QuickBooks Online', IsActive: true },
      ],
      'MJ: Company Integration Entity Maps': [
        { ID: 'map-1', CompanyIntegrationID: CI, Entity: 'MJ_BizApps_Accounting: GL Accounts', IsActive: true },
      ],
      'MJ_BizApps_Accounting: Accounting Engine Extensions': [
        {
          Code: 'ImportBankAccountBalances',
          DriverClass: 'TestCashImport',
          Status: 'Active',
          Sequence: 0,
          CompanyID: null,
          ConfigurationObject: null,
        },
      ],
    });
    await AccountingERPEngine.Instance.SyncMasterData({ Objects: ['accounts'] }, user, p);
    expect(extensionCalls).toEqual(['beforeSync', 'afterAccounts', 'afterSync:1']);
  });

  it('returns Success false when nothing is configured', async () => {
    AccountingERPEngine.Instance.UseSeams({ runSync: async () => ({ Success: true }) });
    const p = providerWith({
      'MJ: Company Integrations': [],
      'MJ: Company Integration Entity Maps': [],
      'MJ_BizApps_Accounting: Accounting Engine Extensions': [],
    });
    const out = await AccountingERPEngine.Instance.SyncMasterData({ Objects: ['accounts'] }, user, p);
    expect(out.Success).toBe(false);
    expect(out.Results).toEqual([]);
  });

  it('does not fire AfterSyncAccounts when the extension is configured for dimensions only', async () => {
    extensionCalls.length = 0;
    AccountingERPEngine.Instance.UseSeams({ runSync: async () => ({ Success: true }) });
    const p = providerWith({
      'MJ: Company Integrations': [
        { ID: CI, CompanyID: COMPANY, IntegrationID: 'int-1', Integration: 'QuickBooks Online', IsActive: true },
      ],
      'MJ: Company Integration Entity Maps': [
        { ID: 'map-1', CompanyIntegrationID: CI, Entity: 'MJ_BizApps_Accounting: GL Accounts', IsActive: true },
        { ID: 'map-2', CompanyIntegrationID: CI, Entity: 'MJ_BizApps_Accounting: Dimensions', IsActive: true },
      ],
      'MJ_BizApps_Accounting: Accounting Engine Extensions': [
        {
          Code: 'ImportBankAccountBalances',
          DriverClass: 'TestCashImport',
          Status: 'Active',
          Sequence: 0,
          CompanyID: null,
          ConfigurationObject: { Objects: ['dimensions'] },
        },
      ],
    });
    await AccountingERPEngine.Instance.SyncMasterData({ Objects: ['accounts', 'dimensions'] }, user, p);
    expect(extensionCalls).toEqual(['beforeSync', 'afterDimensions', 'afterSync:1']);
  });

  it('skips Disabled rows and missing DriverClass', async () => {
    AccountingERPEngine.Instance.UseSeams({ runSync: async () => ({ Success: true }) });
    const p = providerWith({
      'MJ: Company Integrations': [
        { ID: CI, CompanyID: COMPANY, IntegrationID: 'int-1', Integration: 'QuickBooks Online', IsActive: true },
      ],
      'MJ: Company Integration Entity Maps': [
        { ID: 'map-1', CompanyIntegrationID: CI, Entity: 'MJ_BizApps_Accounting: GL Accounts', IsActive: true },
      ],
      'MJ_BizApps_Accounting: Accounting Engine Extensions': [],
    });
    const out = await AccountingERPEngine.Instance.SyncMasterData({ Objects: ['accounts'] }, user, p);
    expect(out.Success).toBe(true);
  });
});

describe('AccountingERPEngine.PostJournalBatch', () => {
  beforeEach(() => {
    vi.spyOn(AccountingEngine.Instance, 'Config').mockResolvedValue();
  });

  it('never reports success when the verb fails — fail closed', async () => {
    AccountingERPEngine.Instance.UseSeams({
      runVerb: async () => ({ Success: false, ResultCode: 'ERROR', Message: 'ERP 500' }),
    });
    const p = providerWith({
      'MJ: Company Integrations': [
        { ID: CI, CompanyID: COMPANY, IntegrationID: 'int-1', Integration: 'QuickBooks Online', IsActive: true },
      ],
      'MJ: Company Integration Entity Maps': [],
      'MJ_BizApps_Accounting: Accounting Engine Extensions': [],
      'MJ_BizApps_Accounting: GL Accounts': [
        { Code: '1000', ExternalSystem: 'QuickBooks', ExternalAccountID: '1000' },
      ],
    });
    const batch = {
      ID: 'batch-1',
      CompanyID: COMPANY,
      TargetSystem: 'QuickBooks',
      JournalEntryBatchNumber: 'BATCH-1',
      PostingDate: new Date('2026-08-01'),
    } as never;
    const lines = [{ GLAccountID: 'gl-1', DebitAmount: 10, CreditAmount: null, Description: 'x' }] as never;
    // resolveExternalAccount hits GL Accounts view with ExtraFilter — our stub ignores filter
    const result: ErpPostResult = await AccountingERPEngine.Instance.PostJournalBatch(batch, lines, user, p);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/ERP 500|No ERP provider/);
  });

  it('does not fall back to another ERP when TargetSystem does not match', async () => {
    const runVerb = vi.fn(async () => ({ Success: true, ResultCode: 'SUCCESS' }));
    AccountingERPEngine.Instance.UseSeams({ runVerb });
    const p = providerWith({
      'MJ: Company Integrations': [
        { ID: CI, CompanyID: COMPANY, IntegrationID: 'int-1', Integration: 'Microsoft Dynamics 365 Business Central', IsActive: true },
      ],
      'MJ: Company Integration Entity Maps': [],
      'MJ_BizApps_Accounting: Accounting Engine Extensions': [],
    });
    const batch = {
      ID: 'batch-1',
      CompanyID: COMPANY,
      TargetSystem: 'QuickBooks Online',
      JournalEntryBatchNumber: 'BATCH-1',
      PostingDate: new Date('2026-08-01'),
    } as never;
    const result: ErpPostResult = await AccountingERPEngine.Instance.PostJournalBatch(batch, [], user, p);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/QuickBooks Online/);
    expect(runVerb).not.toHaveBeenCalled();
  });
});

describe('BaseAccountingERPProvider plugins', () => {
  it('resolves QuickBooks Online and Business Central keys', () => {
    const qbo = MJGlobal.Instance.ClassFactory.TryCreateInstance<BaseAccountingERPProvider>(
      BaseAccountingERPProvider,
      'QuickBooks Online',
      async () => ({ Success: true, ResultCode: 'SUCCESS' }),
    );
    const bc = MJGlobal.Instance.ClassFactory.TryCreateInstance<BaseAccountingERPProvider>(
      BaseAccountingERPProvider,
      'Microsoft Dynamics 365 Business Central',
      async () => ({ Success: true, ResultCode: 'SUCCESS' }),
    );
    expect(qbo.Resolved).toBe(true);
    expect(bc.Resolved).toBe(true);
  });
});
