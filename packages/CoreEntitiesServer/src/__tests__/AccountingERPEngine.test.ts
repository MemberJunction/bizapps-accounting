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
import { AccountingERPEngine, namesMatch } from '../AccountingERPEngine.js';
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

@RegisterClass(BaseAccountingEngineExtension, 'BeforeOnlyExt')
class BeforeOnlyExt extends BaseAccountingEngineExtension {
  get Code(): string { return 'BeforeOnly'; }
  get ParticipatesInSyncMasterData(): boolean { return true; }
  get RunAfterSyncMasterData(): boolean { return false; }
  async BeforeSyncMasterData(): Promise<void> { extensionCalls.push('beforeOnly'); }
  async AfterSyncMasterData(): Promise<void> { extensionCalls.push('afterShouldNotFire'); }
}

@RegisterClass(BaseAccountingEngineExtension, 'ThrowingExt')
class ThrowingExt extends BaseAccountingEngineExtension {
  get Code(): string { return 'Throwing'; }
  get RunAfterSyncMasterData(): boolean { return true; }
  async AfterSyncMasterData(): Promise<void> { throw new Error('boom'); }
}

@RegisterClass(BaseAccountingEngineExtension, 'ThrowingAfterPostExt')
class ThrowingAfterPostExt extends BaseAccountingEngineExtension {
  get Code(): string { return 'ThrowingAfterPost'; }
  get RunAfterPostJournalBatch(): boolean { return true; }
  get RunAfterPostJournalBatchFailure(): boolean { return true; }
  async AfterPostJournalBatch(): Promise<void> { extensionCalls.push('afterPost'); throw new Error('afterPost boom'); }
  async AfterPostJournalBatchFailure(): Promise<void> { extensionCalls.push('afterPostFailure'); }
}

// An ERP provider with no lookup, now that QuickBooks Online has one.
@RegisterClass(BaseAccountingERPProvider, 'Xero')
class NoLookupERPProvider extends BaseAccountingERPProvider {
  get IntegrationName(): string { return 'Xero'; }
}

function providerWith(views: Record<string, unknown[]>) {
  return {
    RunView: async (params: { EntityName: string }) => ({
      Success: true,
      Results: views[params.EntityName] ?? [],
    }),
  } as never;
}

// ── Dimension-tagged post fixtures ───────────────────────────────────────────────────────────
// providerWith ignores ExtraFilter, so every row of an entity comes back for every query; the
// engine buckets the tags by JournalEntryLineID itself, which is what these exercise.
const LINE_1 = 'cccccccc-0000-0000-0000-000000000001';
const LINE_2 = 'cccccccc-0000-0000-0000-000000000002';
const DIM_VENTURE = 'dddddddd-0000-0000-0000-000000000001';
const DIM_PRODUCT = 'dddddddd-0000-0000-0000-000000000002';
const VAL_ACME = 'eeeeeeee-0000-0000-0000-000000000001';
const VAL_WIDGET = 'eeeeeeee-0000-0000-0000-000000000002';

/** The views a tagged Business Central post reads, minus the Dimensions view each case varies. */
function dimensionTaggedViews(): Record<string, unknown[]> {
  return {
    'MJ: Company Integrations': [
      { ID: CI, CompanyID: COMPANY, IntegrationID: 'int-1', Integration: 'Microsoft Dynamics 365 Business Central', IsActive: true },
    ],
    'MJ: Company Integration Entity Maps': [],
    'MJ_BizApps_Accounting: Accounting Engine Extensions': [],
    'MJ_BizApps_Accounting: GL Accounts': [{ Code: '1000', ExternalSystem: null, ExternalAccountID: null }],
    'MJ_BizApps_Accounting: Journal Entry Line Dimensions': [
      { JournalEntryLineID: LINE_1, DimensionID: DIM_VENTURE, DimensionValueID: VAL_ACME },
      { JournalEntryLineID: LINE_1, DimensionID: DIM_PRODUCT, DimensionValueID: VAL_WIDGET },
      { JournalEntryLineID: LINE_2, DimensionID: DIM_VENTURE, DimensionValueID: VAL_ACME },
    ],
    'MJ_BizApps_Accounting: Dimension Values': [
      { ID: VAL_ACME, Code: 'ACME' },
      { ID: VAL_WIDGET, Code: 'WIDGET' },
    ],
  };
}

/** A batch ID as SQL Server returns it, upper case. The token the poster stamps is lower case. */
const TAGGED_BATCH_ID = 'AAAAAAAA-0000-0000-0000-000000000206';
const OWN_TOKEN = 'JEB aaaaaaaa-0000-0000-0000-000000000206';
const OTHER_TOKEN = 'JEB bbbbbbbb-0000-0000-0000-000000000206';

function taggedBatch() {
  return {
    ID: TAGGED_BATCH_ID,
    CompanyID: COMPANY,
    TargetSystem: 'BusinessCentral',
    JournalEntryBatchNumber: 'BATCH-1',
    PostingDate: new Date('2026-08-01'),
  } as never;
}

function taggedLines() {
  return [
    { ID: LINE_1, GLAccountID: 'gl-1', DebitAmount: 100, CreditAmount: null, Description: 'Debit side' },
    { ID: LINE_2, GLAccountID: 'gl-2', DebitAmount: null, CreditAmount: 100, Description: 'Credit side' },
  ] as never;
}

/** The Lines payload the engine handed the ERP verb. */
function postedLines(runVerb: { mock: { calls: unknown[][] } }): Array<{ dimensions?: unknown }> {
  const call = runVerb.mock.calls[0][0] as { Params: { Lines: Array<{ dimensions?: unknown }> } };
  return call.Params.Lines;
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

  it('runs Before but not After when Participates is true and RunAfter is false', async () => {
    extensionCalls.length = 0;
    AccountingERPEngine.Instance.UseSeams({ runSync: async () => ({ Success: true }) });
    const p = providerWith({
      'MJ: Company Integrations': [
        { ID: CI, CompanyID: COMPANY, IntegrationID: 'int-1', Integration: 'QuickBooks Online', IsActive: true },
      ],
      'MJ: Company Integration Entity Maps': [
        { ID: 'map-1', CompanyIntegrationID: CI, Entity: 'MJ_BizApps_Accounting: GL Accounts', IsActive: true },
      ],
      'MJ_BizApps_Accounting: Accounting Engine Extensions': [
        {
          Code: 'BeforeOnly',
          DriverClass: 'BeforeOnlyExt',
          Status: 'Active',
          Sequence: 0,
          CompanyID: null,
          ConfigurationObject: null,
        },
      ],
    });
    await AccountingERPEngine.Instance.SyncMasterData({ Objects: ['accounts'] }, user, p);
    expect(extensionCalls).toEqual(['beforeOnly']);
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

  it('carries each summary line\'s dimension tags to the ERP in wire codes', async () => {
    const runVerb = vi.fn(async () => ({ Success: true, ResultCode: 'SUCCESS' }));
    AccountingERPEngine.Instance.UseSeams({ runVerb });
    const p = providerWith({
      ...dimensionTaggedViews(),
      'MJ_BizApps_Accounting: Dimensions': [
        { ID: DIM_VENTURE, Code: 'VENTURE' },
        { ID: DIM_PRODUCT, Code: 'PRODUCT' },
      ],
    });

    const result: ErpPostResult = await AccountingERPEngine.Instance.PostJournalBatch(
      taggedBatch(), taggedLines(), user, p,
    );

    expect(result.success).toBe(true);
    const lines = postedLines(runVerb);
    expect(lines[0].dimensions).toEqual([
      { code: 'VENTURE', valueCode: 'ACME' },
      { code: 'PRODUCT', valueCode: 'WIDGET' },
    ]);
    expect(lines[1].dimensions).toEqual([{ code: 'VENTURE', valueCode: 'ACME' }]);
  });

  it('refuses to post rather than silently dropping a tag whose dimension has no code', async () => {
    const runVerb = vi.fn(async () => ({ Success: true, ResultCode: 'SUCCESS' }));
    AccountingERPEngine.Instance.UseSeams({ runVerb });
    // PRODUCT is absent from the Dimensions view — the pull sync never landed a code for it.
    const p = providerWith({
      ...dimensionTaggedViews(),
      'MJ_BizApps_Accounting: Dimensions': [{ ID: DIM_VENTURE, Code: 'VENTURE' }],
    });

    const result: ErpPostResult = await AccountingERPEngine.Instance.PostJournalBatch(
      taggedBatch(), taggedLines(), user, p,
    );

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/has no code/);
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

// ── #182: a post the ERP accepted stays accepted; the pre-flight lookup ──────────────────────

const BC_JOURNAL_ID = 'ffffffff-0000-0000-0000-000000000001';

function taggedViewsWithCodes(extra: Record<string, unknown[]> = {}): Record<string, unknown[]> {
  return {
    ...dimensionTaggedViews(),
    'MJ_BizApps_Accounting: Dimensions': [
      { ID: DIM_VENTURE, Code: 'VENTURE' },
      { ID: DIM_PRODUCT, Code: 'PRODUCT' },
    ],
    ...extra,
  };
}

/**
 * A BC G/L entry as the GetGLEntries verb maps it, carrying this batch's token unless told otherwise.
 * The fixtures resolve every account to '1000'.
 */
function glEntry(debitAmount: number, creditAmount: number, postingDate = new Date('2026-08-01'), description = `Netted [${OWN_TOKEN}]`) {
  return { entryNumber: 1, documentNumber: 'BATCH-1', accountNumber: '1000', postingDate, debitAmount, creditAmount, description };
}

/** A runVerb that answers GetGLEntries with `entries` and fails anything else. */
function glEntriesVerb(entries: unknown[]) {
  return vi.fn(async (call: { Verb: string }) => call.Verb === 'GetGLEntries'
    ? { Success: true, ResultCode: 'SUCCESS', Params: [{ Name: 'GLEntries', Value: entries, Type: 'Output' }] }
    : { Success: false, ResultCode: 'ERROR', Message: `unexpected verb ${call.Verb}` });
}

describe('AccountingERPEngine.PostJournalBatch — after the ERP accepts', () => {
  beforeEach(() => {
    extensionCalls.length = 0;
    vi.spyOn(AccountingEngine.Instance, 'Config').mockResolvedValue();
  });

  it('reports a post the ERP accepted as a success even when the afterPost hook throws', async () => {
    AccountingERPEngine.Instance.UseSeams({
      runVerb: async () => ({ Success: true, ResultCode: 'SUCCESS', Params: [{ Name: 'DocNumber', Value: 'BATCH-1', Type: 'Output' }] }),
    });
    const p = providerWith(taggedViewsWithCodes({
      'MJ_BizApps_Accounting: Accounting Engine Extensions': [
        { Code: 'ThrowingAfterPost', DriverClass: 'ThrowingAfterPostExt', Status: 'Active', Sequence: 0, CompanyID: null, ConfigurationObject: null },
      ],
    }));

    const result = await AccountingERPEngine.Instance.PostJournalBatch(taggedBatch(), taggedLines(), user, p);

    expect(result).toEqual({ success: true, externalJournalEntryBatchRef: 'BATCH-1' });
    expect(extensionCalls).toEqual(['afterPost']);
  });

  // The verb's JournalEntryID is the BC general journal, shared by every batch posted through it.
  it('stamps the batch token on every line it sends, after the line\'s own description', async () => {
    const runVerb = vi.fn(async () => ({ Success: true, ResultCode: 'SUCCESS', Params: [{ Name: 'DocNumber', Value: 'BATCH-1', Type: 'Output' }] }));
    AccountingERPEngine.Instance.UseSeams({ runVerb });
    const lines = [...(taggedLines() as unknown as object[]), { ID: 'line-3', GLAccountID: 'gl-3', DebitAmount: 0, CreditAmount: null, Description: null }] as never;

    await AccountingERPEngine.Instance.PostJournalBatch(taggedBatch(), lines, user, providerWith(taggedViewsWithCodes()));

    const sent = (runVerb.mock.calls[0] as unknown as [{ Params: { Lines: Array<{ description?: string }> } }])[0].Params.Lines;
    expect(sent.map((l) => l.description)).toEqual([`Debit side [${OWN_TOKEN}]`, `Credit side [${OWN_TOKEN}]`, `[${OWN_TOKEN}]`]);
  });

  it('records a Business Central post under its document number, not the journal id', async () => {
    AccountingERPEngine.Instance.UseSeams({
      runVerb: async () => ({
        Success: true,
        ResultCode: 'SUCCESS',
        Params: [
          { Name: 'JournalEntryID', Value: BC_JOURNAL_ID, Type: 'Output' },
          { Name: 'DocNumber', Value: 'BATCH-1', Type: 'Output' },
        ],
      }),
    });

    const result = await AccountingERPEngine.Instance.PostJournalBatch(taggedBatch(), taggedLines(), user, providerWith(taggedViewsWithCodes()));

    expect(result.externalJournalEntryBatchRef).toBe('BATCH-1');
  });
});

describe('AccountingERPEngine.FindPostedJournalBatch', () => {
  beforeEach(() => {
    vi.spyOn(AccountingEngine.Instance, 'Config').mockResolvedValue();
  });

  it('finds a Business Central posting that matches the batch line for line', async () => {
    const runVerb = glEntriesVerb([glEntry(100, 0), glEntry(0, 100)]);
    AccountingERPEngine.Instance.UseSeams({ runVerb });

    const result = await AccountingERPEngine.Instance.FindPostedJournalBatch(taggedBatch(), taggedLines(), user, providerWith(taggedViewsWithCodes()));

    expect(result).toEqual({ status: 'Found', externalJournalEntryBatchRef: 'BATCH-1' });
    const call = runVerb.mock.calls[0][0] as unknown as { Params: Record<string, unknown> };
    expect(call.Params.DocumentNumber).toBe('BATCH-1');
  });

  it('reports nothing posted when BC holds no entries under the number', async () => {
    AccountingERPEngine.Instance.UseSeams({ runVerb: glEntriesVerb([]) });

    const result = await AccountingERPEngine.Instance.FindPostedJournalBatch(taggedBatch(), taggedLines(), user, providerWith(taggedViewsWithCodes()));

    expect(result).toEqual({ status: 'NotFound' });
  });

  it.each([
    ['an amount differs', [glEntry(100, 0), glEntry(0, 90)], /1000 0.00\/100.00 \(batch 1, ERP 0\)/],
    ['a line is missing', [glEntry(100, 0)], /1 ERP line\(s\) against 2/],
    ['it posted on another date', [glEntry(100, 0, new Date('2026-07-31')), glEntry(0, 100, new Date('2026-07-31'))], /posted on 2026-07-31; the batch's posting date is 2026-08-01/],
  ])('reports a mismatch when %s', async (_case, entries, detail) => {
    AccountingERPEngine.Instance.UseSeams({ runVerb: glEntriesVerb(entries) });

    const result = await AccountingERPEngine.Instance.FindPostedJournalBatch(taggedBatch(), taggedLines(), user, providerWith(taggedViewsWithCodes()));

    expect(result.status).toBe('Mismatch');
    expect(result.status === 'Mismatch' && result.detail).toMatch(detail);
  });

  // BC adds entries of its own under the document (VAT/tax posting groups): a genuine retry of this
  // same batch then reads as a mismatch, never as a match.
  it('reports a mismatch when BC holds an extra entry of its own under the number', async () => {
    AccountingERPEngine.Instance.UseSeams({ runVerb: glEntriesVerb([glEntry(100, 0), glEntry(0, 100), glEntry(0, 7.5)]) });

    const result = await AccountingERPEngine.Instance.FindPostedJournalBatch(taggedBatch(), taggedLines(), user, providerWith(taggedViewsWithCodes()));

    expect(result.status).toBe('Mismatch');
    expect(result.status === 'Mismatch' && result.detail).toMatch(/3 ERP line\(s\) against 2 in the batch; .*1000 0.00\/7.50 \(batch 0, ERP 1\)/);
  });

  // What the poster sends, as BC would book it and GetGLEntries would return it (dates as JSON strings).
  it('finds the journal the poster sent, round-tripped through BC\'s G/L entry shape', async () => {
    let sent: Array<{ accountNumber: string; debit?: number; credit?: number; description?: string }> = [];
    let sentDate = '';
    const runVerb = vi.fn(async (call: { Verb: string; Params: Record<string, unknown> }) => {
      if (call.Verb === 'CreateJournalEntry') {
        sent = call.Params.Lines as typeof sent;
        sentDate = call.Params.EntryDate as string;
        return { Success: true, ResultCode: 'SUCCESS', Params: [{ Name: 'DocNumber', Value: call.Params.DocNumber, Type: 'Output' }] };
      }
      const entries = sent.map((l, i) => ({
        entryNumber: i + 1,
        documentNumber: 'BATCH-1',
        accountNumber: l.accountNumber,
        postingDate: `${sentDate}T00:00:00.000Z`,
        debitAmount: l.debit ?? 0,
        creditAmount: l.credit ?? 0,
        description: l.description,
      }));
      return { Success: true, ResultCode: 'SUCCESS', Params: [{ Name: 'GLEntries', Value: JSON.parse(JSON.stringify(entries)), Type: 'Output' }] };
    });
    AccountingERPEngine.Instance.UseSeams({ runVerb });
    const p = providerWith(taggedViewsWithCodes());

    const posted = await AccountingERPEngine.Instance.PostJournalBatch(taggedBatch(), taggedLines(), user, p);
    const result = await AccountingERPEngine.Instance.FindPostedJournalBatch(taggedBatch(), taggedLines(), user, p);

    expect(posted.success).toBe(true);
    expect(result).toEqual({ status: 'Found', externalJournalEntryBatchRef: posted.externalJournalEntryBatchRef });
  });

  // #206: the batch number restarts in every database, so another environment's journal can sit under
  // it with the same round amounts. Its token says it is not this batch.
  it('reports another batch\'s journal when every line carries another batch\'s token, even if the lines match', async () => {
    const other = `Netted [${OTHER_TOKEN}]`;
    AccountingERPEngine.Instance.UseSeams({ runVerb: glEntriesVerb([glEntry(100, 0, undefined, other), glEntry(0, 100, undefined, other)]) });

    const result = await AccountingERPEngine.Instance.FindPostedJournalBatch(taggedBatch(), taggedLines(), user, providerWith(taggedViewsWithCodes()));

    expect(result).toEqual({
      status: 'Foreign',
      detail: `its lines carry the token of batch bbbbbbbb-0000-0000-0000-000000000206, not this batch's ${TAGGED_BATCH_ID}.`,
    });
  });

  // A batch posted before tagging carries no token; so does a journal from an environment that does not
  // tag. Only the operator can tell them apart, so it is a mismatch, never a match.
  it('reports a mismatch, never a match, when matching lines carry no token', async () => {
    AccountingERPEngine.Instance.UseSeams({ runVerb: glEntriesVerb([glEntry(100, 0, undefined, 'Netted'), glEntry(0, 100, undefined, 'Netted')]) });

    const result = await AccountingERPEngine.Instance.FindPostedJournalBatch(taggedBatch(), taggedLines(), user, providerWith(taggedViewsWithCodes()));

    expect(result.status).toBe('Mismatch');
    expect(result.status === 'Mismatch' && result.detail).toBe(
      `none of its 2 line(s) carries this batch's token (${OWN_TOKEN}): it was posted before batches were tagged, or from somewhere that does not tag them; its lines otherwise match this batch.`,
    );
  });

  it.each([
    ['one line carries no token', [glEntry(100, 0), glEntry(0, 100, undefined, 'Netted')], /^1 of its 2 line\(s\) carry no batch token; its lines otherwise match/],
    ['one line carries another batch\'s token', [glEntry(100, 0), glEntry(0, 100, undefined, OTHER_TOKEN)], /^it also holds lines of batch bbbbbbbb-0000-0000-0000-000000000206; /],
  ])('reports a mismatch when %s', async (_case, entries, detail) => {
    AccountingERPEngine.Instance.UseSeams({ runVerb: glEntriesVerb(entries) });

    const result = await AccountingERPEngine.Instance.FindPostedJournalBatch(taggedBatch(), taggedLines(), user, providerWith(taggedViewsWithCodes()));

    expect(result.status).toBe('Mismatch');
    expect(result.status === 'Mismatch' && result.detail).toMatch(detail);
  });

  it('reports an error when the number reaches the lookup cap, since the answer may be partial', async () => {
    AccountingERPEngine.Instance.UseSeams({ runVerb: glEntriesVerb(Array.from({ length: 5000 }, () => glEntry(1, 0))) });

    const result = await AccountingERPEngine.Instance.FindPostedJournalBatch(taggedBatch(), taggedLines(), user, providerWith(taggedViewsWithCodes()));

    expect(result).toEqual({ status: 'Error', error: 'document BATCH-1 has 5000 or more G/L entries, more than one lookup reads.' });
  });

  it('reports an error without calling BC when the number would break the OData filter', async () => {
    const runVerb = glEntriesVerb([]);
    AccountingERPEngine.Instance.UseSeams({ runVerb });
    const batch = { ...(taggedBatch() as object), JournalEntryBatchNumber: "BATCH-1' or 1 eq 1" } as never;

    const result = await AccountingERPEngine.Instance.FindPostedJournalBatch(batch, taggedLines(), user, providerWith(taggedViewsWithCodes()));

    expect(result.status).toBe('Error');
    expect(runVerb).not.toHaveBeenCalled();
  });

  it('reports an error, never nothing posted, when the lookup verb fails', async () => {
    AccountingERPEngine.Instance.UseSeams({ runVerb: async () => ({ Success: false, ResultCode: 'ERROR', Message: 'BC 503' }) });

    const result = await AccountingERPEngine.Instance.FindPostedJournalBatch(taggedBatch(), taggedLines(), user, providerWith(taggedViewsWithCodes()));

    expect(result).toEqual({ status: 'Error', error: 'BC 503' });
  });

  it('reports an error when an entry comes back without its amounts', async () => {
    AccountingERPEngine.Instance.UseSeams({ runVerb: glEntriesVerb([{ accountNumber: '1000', postingDate: new Date('2026-08-01') }]) });

    const result = await AccountingERPEngine.Instance.FindPostedJournalBatch(taggedBatch(), taggedLines(), user, providerWith(taggedViewsWithCodes()));

    expect(result.status).toBe('Error');
  });

  it('reports the lookup unavailable for an ERP whose provider offers none', async () => {
    const runVerb = vi.fn();
    AccountingERPEngine.Instance.UseSeams({ runVerb });
    const p = providerWith({
      'MJ: Company Integrations': [
        { ID: CI, CompanyID: COMPANY, IntegrationID: 'int-1', Integration: 'Xero', IsActive: true },
      ],
    });
    const batch = { ID: 'batch-1', CompanyID: COMPANY, TargetSystem: 'Xero', JournalEntryBatchNumber: 'BATCH-1', PostingDate: new Date('2026-08-01') } as never;

    const result = await AccountingERPEngine.Instance.FindPostedJournalBatch(batch, [], user, p);

    expect(result).toEqual({ status: 'Unavailable' });
    expect(runVerb).not.toHaveBeenCalled();
  });
});

// ── #182: QuickBooks Online posts by QBO account id, and looks its journal up by day ─────────

const QBO_ACCOUNT = '35';

function qboViews(glAccounts: unknown[] = [{ Code: '1000', ExternalSystem: 'QuickBooks', ExternalAccountID: QBO_ACCOUNT }]): Record<string, unknown[]> {
  return {
    'MJ: Company Integrations': [
      { ID: CI, CompanyID: COMPANY, IntegrationID: 'int-1', Integration: 'QuickBooks Online', IsActive: true },
    ],
    'MJ: Company Integration Entity Maps': [],
    'MJ_BizApps_Accounting: Accounting Engine Extensions': [],
    'MJ_BizApps_Accounting: GL Accounts': glAccounts,
    'MJ_BizApps_Accounting: Journal Entry Line Dimensions': [],
  };
}

function qboBatch() {
  return { ID: TAGGED_BATCH_ID, CompanyID: COMPANY, TargetSystem: 'QuickBooks', JournalEntryBatchNumber: 'BATCH-1', PostingDate: new Date('2026-08-01') } as never;
}

type QBOSide = 'Debit' | 'Credit';

/**
 * A QBO JournalEntry as GetGLEntries returns it: the mapped transaction, with the QBO record as
 * `metadata`. Each line's Description carries this batch's token unless `description` says otherwise.
 */
function qboJournal(id: string, docNumber: string, lines: Array<[QBOSide, number]>, txnDate = '2026-08-01', description = `Netted [${OWN_TOKEN}]`) {
  return {
    id,
    transactionType: 'JournalEntry',
    transactionNumber: docNumber,
    transactionDate: new Date(`${txnDate}T00:00:00Z`),
    amount: lines.filter(([side]) => side === 'Debit').reduce((sum, [, amount]) => sum + amount, 0),
    lines: [],
    metadata: {
      Id: id,
      DocNumber: docNumber,
      TxnDate: txnDate,
      Line: lines.map(([side, amount], i) => ({
        Id: String(i),
        Description: description,
        Amount: amount,
        DetailType: 'JournalEntryLineDetail',
        JournalEntryLineDetail: { PostingType: side, AccountRef: { value: QBO_ACCOUNT, name: 'Accounts Receivable' } },
      })),
    },
  };
}

/** A runVerb that answers GetGLEntries with `transactions` and fails anything else. */
function qboTransactionsVerb(transactions: unknown[]) {
  return vi.fn(async (call: { Verb: string }) => call.Verb === 'GetGLEntries'
    ? { Success: true, ResultCode: 'SUCCESS', Params: [{ Name: 'Transactions', Value: transactions, Type: 'Output' }] }
    : { Success: false, ResultCode: 'ERROR', Message: `unexpected verb ${call.Verb}` });
}

const BALANCED: Array<[QBOSide, number]> = [['Debit', 100], ['Credit', 100]];

describe('QuickBooks Online — PostJournalBatch', () => {
  beforeEach(() => {
    vi.spyOn(AccountingEngine.Instance, 'Config').mockResolvedValue();
  });

  it('sends each line\'s QBO account id as accountId and records the post under the QBO entry id', async () => {
    const runVerb = vi.fn(async () => ({ Success: true, ResultCode: 'SUCCESS', Params: [{ Name: 'JournalEntryID', Value: '146', Type: 'Output' }] }));
    AccountingERPEngine.Instance.UseSeams({ runVerb });

    const result = await AccountingERPEngine.Instance.PostJournalBatch(qboBatch(), taggedLines(), user, providerWith(qboViews()));

    expect(result).toEqual({ success: true, externalJournalEntryBatchRef: '146' });
    expect(postedLines(runVerb)).toEqual([
      expect.objectContaining({ accountNumber: QBO_ACCOUNT, accountId: QBO_ACCOUNT, debit: 100 }),
      expect.objectContaining({ accountNumber: QBO_ACCOUNT, accountId: QBO_ACCOUNT, credit: 100 }),
    ]);
  });

  // QBO would read the Code as an account id, and could post to whichever account has that id.
  it('refuses to post, without calling QBO, when a GL account has no QBO account id', async () => {
    const runVerb = vi.fn();
    AccountingERPEngine.Instance.UseSeams({ runVerb });

    const result = await AccountingERPEngine.Instance.PostJournalBatch(
      qboBatch(), taggedLines(), user, providerWith(qboViews([{ Code: '1000', ExternalSystem: null, ExternalAccountID: null }])),
    );

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/GL account 1000 has no QuickBooks account ID/);
    expect(runVerb).not.toHaveBeenCalled();
  });
});

describe('QuickBooks Online — FindPostedJournalBatch', () => {
  beforeEach(() => {
    vi.spyOn(AccountingEngine.Instance, 'Config').mockResolvedValue();
  });

  const find = () => AccountingERPEngine.Instance.FindPostedJournalBatch(qboBatch(), taggedLines(), user, providerWith(qboViews()));

  it('reads the posting date\'s journal entries and finds the one under the batch number', async () => {
    const runVerb = qboTransactionsVerb([qboJournal('145', 'BATCH-0', [['Debit', 5], ['Credit', 5]]), qboJournal('146', 'BATCH-1', BALANCED)]);
    AccountingERPEngine.Instance.UseSeams({ runVerb });

    const result = await find();

    expect(result).toEqual({ status: 'Found', externalJournalEntryBatchRef: '146' });
    const call = runVerb.mock.calls[0][0] as unknown as { Params: Record<string, unknown> };
    expect(call.Params).toEqual({ TransactionType: 'JournalEntry', StartDate: '2026-08-01', EndDate: '2026-08-01', MaxResults: 1000 });
  });

  // #206: a QBO sandbox company is often shared by more than one environment, each issuing BATCH-1.
  it('reports another batch\'s journal when every line carries another batch\'s token, even if the lines match', async () => {
    AccountingERPEngine.Instance.UseSeams({ runVerb: qboTransactionsVerb([qboJournal('146', 'BATCH-1', BALANCED, undefined, `Netted [${OTHER_TOKEN}]`)]) });

    expect(await find()).toEqual({
      status: 'Foreign',
      detail: `its lines carry the token of batch bbbbbbbb-0000-0000-0000-000000000206, not this batch's ${TAGGED_BATCH_ID}.`,
    });
  });

  it('reports a mismatch, never a match, when matching lines carry no token', async () => {
    AccountingERPEngine.Instance.UseSeams({ runVerb: qboTransactionsVerb([qboJournal('146', 'BATCH-1', BALANCED, undefined, 'Netted')]) });

    const result = await find();

    expect(result.status).toBe('Mismatch');
    expect(result.status === 'Mismatch' && result.detail).toMatch(/^none of its 2 line\(s\) carries this batch's token/);
  });

  it('reports a mismatch when a line has no description', async () => {
    const journal = qboJournal('146', 'BATCH-1', BALANCED);
    delete (journal.metadata.Line[1] as { Description?: string }).Description;
    AccountingERPEngine.Instance.UseSeams({ runVerb: qboTransactionsVerb([journal]) });

    const result = await find();

    expect(result.status).toBe('Mismatch');
    expect(result.status === 'Mismatch' && result.detail).toMatch(/^1 of its 2 line\(s\) carry no batch token/);
  });

  it('reports nothing posted when the day holds only other documents', async () => {
    AccountingERPEngine.Instance.UseSeams({ runVerb: qboTransactionsVerb([qboJournal('145', 'BATCH-0', BALANCED)]) });

    expect(await find()).toEqual({ status: 'NotFound' });
  });

  it('reports a mismatch when an amount differs', async () => {
    AccountingERPEngine.Instance.UseSeams({ runVerb: qboTransactionsVerb([qboJournal('146', 'BATCH-1', [['Debit', 100], ['Credit', 90], ['Credit', 10]])]) });

    const result = await find();

    expect(result.status).toBe('Mismatch');
    expect(result.status === 'Mismatch' && result.detail).toMatch(/35 0.00\/100.00 \(batch 1, ERP 0\)/);
  });

  it('reports a mismatch when two QBO entries carry the batch number', async () => {
    AccountingERPEngine.Instance.UseSeams({ runVerb: qboTransactionsVerb([qboJournal('146', 'BATCH-1', BALANCED), qboJournal('147', 'BATCH-1', BALANCED)]) });

    const result = await find();

    expect(result.status).toBe('Mismatch');
    expect(result.status === 'Mismatch' && result.detail).toMatch(/4 ERP line\(s\) against 2/);
  });

  it('reports an error when the day reaches the lookup cap, since the answer may be partial', async () => {
    AccountingERPEngine.Instance.UseSeams({ runVerb: qboTransactionsVerb(Array.from({ length: 1000 }, (_, i) => qboJournal(String(i), `OTHER-${i}`, BALANCED))) });

    expect(await find()).toEqual({ status: 'Error', error: 'QuickBooks Online has 1000 or more journal entries on 2026-08-01, more than one lookup reads.' });
  });

  it.each([
    ['a line has no posting type', (j: ReturnType<typeof qboJournal>) => { delete (j.metadata.Line[0].JournalEntryLineDetail as { PostingType?: string }).PostingType; }],
    ['a line has no account', (j: ReturnType<typeof qboJournal>) => { delete (j.metadata.Line[0].JournalEntryLineDetail as { AccountRef?: unknown }).AccountRef; }],
    ['the entry has no date', (j: ReturnType<typeof qboJournal>) => { delete (j.metadata as { TxnDate?: string }).TxnDate; }],
  ])('reports an error when %s', async (_case, damage) => {
    const journal = qboJournal('146', 'BATCH-1', BALANCED);
    damage(journal);
    AccountingERPEngine.Instance.UseSeams({ runVerb: qboTransactionsVerb([journal]) });

    expect((await find()).status).toBe('Error');
  });

  it('reports an error when a transaction comes back without its QBO record', async () => {
    AccountingERPEngine.Instance.UseSeams({ runVerb: qboTransactionsVerb([{ id: '146', transactionNumber: 'BATCH-1' }]) });

    expect((await find()).status).toBe('Error');
  });

  it('reports an error, never nothing posted, when the lookup verb fails', async () => {
    AccountingERPEngine.Instance.UseSeams({ runVerb: async () => ({ Success: false, ResultCode: 'ERROR', Message: 'QBO 503' }) });

    expect(await find()).toEqual({ status: 'Error', error: 'QBO 503' });
  });

  // What the poster sends, as QBO would store it and GetGLEntries would return it.
  it('finds the journal the poster sent, round-tripped through QBO\'s JournalEntry shape', async () => {
    let sent: Array<{ accountId: string; debit?: number; credit?: number; description: string }> = [];
    let sentDate = '';
    const runVerb = vi.fn(async (call: { Verb: string; Params: Record<string, unknown> }) => {
      if (call.Verb === 'CreateJournalEntry') {
        sent = call.Params.Lines as typeof sent;
        sentDate = call.Params.EntryDate as string;
        return { Success: true, ResultCode: 'SUCCESS', Params: [{ Name: 'JournalEntryID', Value: '146', Type: 'Output' }] };
      }
      const journal = qboJournal('146', 'BATCH-1', sent.map((l): [QBOSide, number] => (l.debit ? ['Debit', l.debit] : ['Credit', l.credit ?? 0])), sentDate);
      journal.metadata.Line.forEach((line, i) => { line.Description = sent[i].description; });
      return { Success: true, ResultCode: 'SUCCESS', Params: [{ Name: 'Transactions', Value: JSON.parse(JSON.stringify([journal])), Type: 'Output' }] };
    });
    AccountingERPEngine.Instance.UseSeams({ runVerb });
    const p = providerWith(qboViews());

    const posted = await AccountingERPEngine.Instance.PostJournalBatch(qboBatch(), taggedLines(), user, p);
    const result = await AccountingERPEngine.Instance.FindPostedJournalBatch(qboBatch(), taggedLines(), user, p);

    expect(posted.success).toBe(true);
    expect(result).toEqual({ status: 'Found', externalJournalEntryBatchRef: posted.externalJournalEntryBatchRef });
  });
});

// ── #205: a BC journal batch with a Posting No. Series renumbers the document at posting ────────

const BC_NUMBER = 'GJ-000123';

/**
 * A runVerb for a BC that posted the batch as BC_NUMBER: nothing under the batch number, the
 * batch's entries under BC's own, and those same entries on the posting date's search.
 */
function renumberingVerb(entries: unknown[]) {
  return vi.fn(async (call: { Verb: string; Params: Record<string, unknown> }) => {
    if (call.Verb === 'CreateJournalEntry') {
      return { Success: true, ResultCode: 'SUCCESS', Params: [{ Name: 'DocNumber', Value: call.Params.DocNumber, Type: 'Output' }] };
    }
    const byDate = call.Params.StartDate !== undefined;
    const value = byDate || call.Params.DocumentNumber === BC_NUMBER ? entries : [];
    return { Success: true, ResultCode: 'SUCCESS', Params: [{ Name: 'GLEntries', Value: value, Type: 'Output' }] };
  });
}

function renumbered(entry: ReturnType<typeof glEntry>) {
  return { ...entry, documentNumber: BC_NUMBER };
}

describe('Business Central renumbering a posting', () => {
  beforeEach(() => {
    vi.spyOn(AccountingEngine.Instance, 'Config').mockResolvedValue();
  });

  it('finds the batch under the number BC gave it, by its token on the posting date', async () => {
    const runVerb = renumberingVerb([renumbered(glEntry(100, 0)), renumbered(glEntry(0, 100))]);
    AccountingERPEngine.Instance.UseSeams({ runVerb });

    const result = await AccountingERPEngine.Instance.FindPostedJournalBatch(taggedBatch(), taggedLines(), user, providerWith(taggedViewsWithCodes()));

    expect(result).toEqual({ status: 'Found', externalJournalEntryBatchRef: BC_NUMBER });
    const params = runVerb.mock.calls.map((c) => (c[0] as { Params: Record<string, unknown> }).Params);
    expect(params).toEqual([
      { DocumentNumber: 'BATCH-1', MaxResults: 5000 },
      { StartDate: '2026-08-01', EndDate: '2026-08-01', AccountNumber: '1000', MaxResults: 5000 },
      { DocumentNumber: BC_NUMBER, MaxResults: 5000 },
    ]);
  });

  it('reports nothing posted when the posting date holds only other batches\' entries', async () => {
    const other = `Netted [${OTHER_TOKEN}]`;
    AccountingERPEngine.Instance.UseSeams({
      runVerb: renumberingVerb([renumbered(glEntry(100, 0, undefined, other)), renumbered(glEntry(0, 100, undefined, other))]),
    });

    const result = await AccountingERPEngine.Instance.FindPostedJournalBatch(taggedBatch(), taggedLines(), user, providerWith(taggedViewsWithCodes()));

    expect(result).toEqual({ status: 'NotFound' });
  });

  it('reports an error, never a guess, when the token is on entries of two documents', async () => {
    AccountingERPEngine.Instance.UseSeams({
      runVerb: renumberingVerb([renumbered(glEntry(100, 0)), { ...glEntry(0, 100), documentNumber: 'GJ-000124' }]),
    });

    const result = await AccountingERPEngine.Instance.FindPostedJournalBatch(taggedBatch(), taggedLines(), user, providerWith(taggedViewsWithCodes()));

    expect(result).toEqual({ status: 'Error', error: `token ${OWN_TOKEN} is on G/L entries of 2 documents: ${BC_NUMBER}, GJ-000124.` });
  });

  it('reports an error, never nothing posted, when the posting date\'s search fails', async () => {
    AccountingERPEngine.Instance.UseSeams({
      runVerb: vi.fn(async (call: { Params: Record<string, unknown> }) => call.Params.StartDate !== undefined
        ? { Success: false, ResultCode: 'ERROR', Message: 'BC 503' }
        : { Success: true, ResultCode: 'SUCCESS', Params: [{ Name: 'GLEntries', Value: [], Type: 'Output' }] }),
    });

    const result = await AccountingERPEngine.Instance.FindPostedJournalBatch(taggedBatch(), taggedLines(), user, providerWith(taggedViewsWithCodes()));

    expect(result).toEqual({ status: 'Error', error: 'BC 503' });
  });

  it('records a post under the number BC gave it', async () => {
    AccountingERPEngine.Instance.UseSeams({ runVerb: renumberingVerb([renumbered(glEntry(100, 0)), renumbered(glEntry(0, 100))]) });

    const result = await AccountingERPEngine.Instance.PostJournalBatch(taggedBatch(), taggedLines(), user, providerWith(taggedViewsWithCodes()));

    expect(result).toEqual({ success: true, externalJournalEntryBatchRef: BC_NUMBER });
  });

  it('keeps a post a success, under the number it was sent with, when reading it back fails', async () => {
    AccountingERPEngine.Instance.UseSeams({
      runVerb: vi.fn(async (call: { Verb: string; Params: Record<string, unknown> }) => call.Verb === 'CreateJournalEntry'
        ? { Success: true, ResultCode: 'SUCCESS', Params: [{ Name: 'DocNumber', Value: call.Params.DocNumber, Type: 'Output' }] }
        : { Success: false, ResultCode: 'ERROR', Message: 'BC 503' }),
    });

    const result = await AccountingERPEngine.Instance.PostJournalBatch(taggedBatch(), taggedLines(), user, providerWith(taggedViewsWithCodes()));

    expect(result).toEqual({ success: true, externalJournalEntryBatchRef: 'BATCH-1' });
  });
});

// ── Real-schema filters and connector-named integrations ─────────────────────────────────────

/**
 * Like providerWith, but it behaves like SQL Server for entity maps: that entity has Status and SyncEnabled and no
 * IsActive column, so a filter naming IsActive fails the query instead of being ignored.
 */
function providerWithMapSchema(views: Record<string, unknown[]>, filters: string[]) {
  return {
    RunView: async (params: { EntityName: string; ExtraFilter?: string }) => {
      if (params.EntityName === 'MJ: Company Integration Entity Maps') {
        filters.push(params.ExtraFilter ?? '');
        if (/\bIsActive\b/.test(params.ExtraFilter ?? '')) return { Success: false, ErrorMessage: "Invalid column name 'IsActive'." };
      }
      return { Success: true, Results: views[params.EntityName] ?? [] };
    },
  } as never;
}

describe('AccountingERPEngine against the real entity-map schema', () => {
  beforeEach(() => {
    AccountingERPEngine.Instance.UseSeams({});
    vi.spyOn(AccountingEngine.Instance, 'Config').mockResolvedValue();
  });

  it('finds entity maps by Status and SyncEnabled, so a configured sync actually runs', async () => {
    const syncCalls: string[][] = [];
    AccountingERPEngine.Instance.UseSeams({ runSync: async (_id, _u, mapIds) => { syncCalls.push(mapIds); return { Success: true }; } });
    const filters: string[] = [];
    const p = providerWithMapSchema({
      'MJ: Company Integrations': [
        { ID: CI, CompanyID: COMPANY, IntegrationID: 'int-1', Integration: 'business-central', IsActive: true },
      ],
      'MJ: Company Integration Entity Maps': [
        { ID: 'map-1', CompanyIntegrationID: CI, Entity: 'MJ_BizApps_Accounting: GL Accounts', Status: 'Active', SyncEnabled: true },
      ],
      'MJ_BizApps_Accounting: Accounting Engine Extensions': [],
    }, filters);

    const out = await AccountingERPEngine.Instance.SyncMasterData({ Objects: ['accounts'] }, user, p);

    expect(filters).toHaveLength(1);
    expect(filters[0]).toContain("Status = 'Active'");
    expect(filters[0]).toContain('SyncEnabled = 1');
    expect(filters[0]).not.toMatch(/IsActive/);
    expect(syncCalls).toEqual([['map-1']]);
    expect(out.Results[0]?.Message ?? '').not.toMatch(/No entity maps/);
  });

  it('posts through the Business Central provider when the Integration is named business-central', async () => {
    const runVerb = vi.fn(async () => ({ Success: true, ResultCode: 'SUCCESS', Params: [{ Name: 'DocNumber', Value: 'BATCH-1', Type: 'Output' }] }));
    AccountingERPEngine.Instance.UseSeams({ runVerb });
    const views = taggedViewsWithCodes();
    views['MJ: Company Integrations'] = [
      { ID: CI, CompanyID: COMPANY, IntegrationID: 'int-1', Integration: 'business-central', IsActive: true },
    ];

    const result = await AccountingERPEngine.Instance.PostJournalBatch(taggedBatch(), taggedLines(), user, providerWith(views));

    expect(result.success).toBe(true);
    // The post, then the Business Central provider's readback of it (#205).
    expect(runVerb.mock.calls.map((c) => (c as unknown as [{ Verb: string }])[0].Verb)).toEqual(['CreateJournalEntry', 'GetGLEntries']);
  });
});

describe('namesMatch', () => {
  it('ignores case, spaces and punctuation', () => {
    expect(namesMatch('business-central', 'BusinessCentral')).toBe(true);
    expect(namesMatch('business-central', 'Microsoft Dynamics 365 Business Central')).toBe(true);
    expect(namesMatch('Business Central', 'BC')).toBe(true);
    expect(namesMatch('quickbooks-online', 'QuickBooks Online')).toBe(true);
    expect(namesMatch('QuickBooks Online', 'QuickBooks Online')).toBe(true);
  });

  it('keeps different systems apart', () => {
    expect(namesMatch('business-central', 'QuickBooks Online')).toBe(false);
    expect(namesMatch('QuickBooks Online', 'BusinessCentral')).toBe(false);
    expect(namesMatch('HubSpot', 'BusinessCentral')).toBe(false);
    expect(namesMatch('business-central', null)).toBe(false);
  });
});
