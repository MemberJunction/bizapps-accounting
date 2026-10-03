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
import { BaseAccountingEngineExtension, type AccountingEngineExtensionContext } from '@mj-biz-apps/accounting-engine-base';
import { AccountingEngine } from '../AccountingEngine.js';
import { AccountingERPEngine, namesMatch } from '../AccountingERPEngine.js';
import { BaseAccountingERPProvider } from '../BaseAccountingERPProvider.js';
import type { AccountingVerbResult } from '../AccountingVerbRunner.js';
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

/** Records each posting hook with the connection it saw, or the error it was given. */
@RegisterClass(BaseAccountingEngineExtension, 'RecordingPostExt')
class RecordingPostExt extends BaseAccountingEngineExtension {
  get Code(): string { return 'RecordingPost'; }
  get RunAfterPostJournalBatch(): boolean { return true; }
  get RunAfterPostJournalBatchFailure(): boolean { return true; }
  async BeforePostJournalBatch(ctx: AccountingEngineExtensionContext): Promise<void> { extensionCalls.push(`beforePost:${ctx.CompanyIntegrationID}`); }
  async AfterPostJournalBatch(ctx: AccountingEngineExtensionContext): Promise<void> { extensionCalls.push(`afterPost:${ctx.CompanyIntegrationID}`); }
  async AfterPostJournalBatchFailure(ctx: AccountingEngineExtensionContext): Promise<void> { extensionCalls.push(`afterPostFailure:${ctx.ErrorMessage}`); }
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
      'MJ: Company Integration Field Maps': [
        { EntityMapID: 'map-2', DestinationFieldName: 'Code', IsKeyField: true, Status: 'Active' },
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

// ── bc-aidp-next-golive#282: Business Central posts by account number ─────────────────────
// For BC, ExternalAccountID holds a remapped BC account number (Code is immutable); blank posts by Code.
// A BC account id (a GUID) there is refused: BC's accountNumber allows 20 characters.

const BC_ACCOUNT_ID = '9A1B2C3D-0000-0000-0000-000000000282';

function bcViewsWithAccount(glAccount: Record<string, unknown>): Record<string, unknown[]> {
  return taggedViewsWithCodes({ 'MJ_BizApps_Accounting: GL Accounts': [glAccount] });
}

describe('Business Central — account numbers', () => {
  beforeEach(() => {
    vi.spyOn(AccountingEngine.Instance, 'Config').mockResolvedValue();
  });

  it('sends a remapped account under its External Account ID as the account number', async () => {
    const runVerb = vi.fn(async () => ({ Success: true, ResultCode: 'SUCCESS', Params: [{ Name: 'DocNumber', Value: 'BATCH-1', Type: 'Output' }] }));
    AccountingERPEngine.Instance.UseSeams({ runVerb });

    await AccountingERPEngine.Instance.PostJournalBatch(
      taggedBatch(), taggedLines(), user, providerWith(bcViewsWithAccount({ Code: '41500', ExternalSystem: 'BusinessCentral', ExternalAccountID: '41507' })),
    );

    expect(postedLines(runVerb).map((l) => (l as { accountNumber?: string }).accountNumber)).toEqual(['41507', '41507']);
  });

  it('refuses to post, without calling BC, when an External Account ID is a BC account id', async () => {
    const runVerb = vi.fn();
    AccountingERPEngine.Instance.UseSeams({ runVerb });

    const result = await AccountingERPEngine.Instance.PostJournalBatch(
      taggedBatch(), taggedLines(), user, providerWith(bcViewsWithAccount({ Code: '41507', ExternalSystem: 'BusinessCentral', ExternalAccountID: BC_ACCOUNT_ID })),
    );

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/GL account 41507: External Account ID .* is 36 characters; Business Central account numbers allow 20/);
    expect(runVerb).not.toHaveBeenCalled();
  });

  // An External System left blank applies to every ERP, so the same id is refused when the batch targets BC.
  it('refuses an over-long External Account ID with External System blank, too', async () => {
    const runVerb = vi.fn();
    AccountingERPEngine.Instance.UseSeams({ runVerb });

    const result = await AccountingERPEngine.Instance.PostJournalBatch(
      taggedBatch(), taggedLines(), user, providerWith(bcViewsWithAccount({ Code: '41507', ExternalSystem: null, ExternalAccountID: BC_ACCOUNT_ID })),
    );

    expect(result.success).toBe(false);
    expect(runVerb).not.toHaveBeenCalled();
  });

  // The lookup builds the same lines; it must say it cannot answer, never report a mismatch it made up.
  it('reports a lookup error, not a mismatch, when an External Account ID is a BC account id', async () => {
    AccountingERPEngine.Instance.UseSeams({ runVerb: glEntriesVerb([glEntry(100, 0), glEntry(0, 100)]) });

    const result = await AccountingERPEngine.Instance.FindPostedJournalBatch(
      taggedBatch(), taggedLines(), user, providerWith(bcViewsWithAccount({ Code: '41507', ExternalSystem: 'BusinessCentral', ExternalAccountID: BC_ACCOUNT_ID })),
    );

    expect(result.status).toBe('Error');
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
    expect(call.Params).toEqual({ TransactionType: 'JournalEntry', StartDate: '2026-08-01', EndDate: '2026-08-01', MaxResults: 1000, CompanyIntegrationID: CI });
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
    expect(runVerb).toHaveBeenCalledTimes(1);
  });
});

// ── #256: which connection a batch posts through, and what master-data sync reads ──────────────

const CI_PROD = 'bbbbbbbb-0000-0000-0000-000000000256';
const CI_UAT = 'bbbbbbbb-0000-0000-0000-000000000257';
const POSTING_FLAG = '{"environmentName":"AIDP_Next_UAT","postJournalEntries":true}';

/** An active Company Integration row, as the Company Integrations view returns it. */
function connection(id: string, name: string, integration: string, configuration: string | null = null) {
  return { ID: id, CompanyID: COMPANY, IntegrationID: `int-${integration}`, Integration: integration, Name: name, Configuration: configuration, IsActive: true };
}

function bcConnection(id: string, name: string, configuration: string | null = null) {
  return connection(id, name, 'business-central', configuration);
}

const RECORDING_EXTENSION = [
  { Code: 'RecordingPost', DriverClass: 'RecordingPostExt', Status: 'Active', Sequence: 0, CompanyID: null, ConfigurationObject: null },
];

/** The tagged-batch views, with these connections and the recording posting extension. */
function postingViews(connections: unknown[]) {
  return providerWith(taggedViewsWithCodes({
    'MJ: Company Integrations': connections,
    'MJ_BizApps_Accounting: Accounting Engine Extensions': RECORDING_EXTENSION,
  }));
}

/** A runVerb that accepts a post and answers a lookup with nothing posted, recording every call. */
function connectionVerb() {
  return vi.fn(async (call: { Verb: string; Params: Record<string, unknown> }) => call.Verb === 'CreateJournalEntry'
    ? { Success: true, ResultCode: 'SUCCESS', Params: [{ Name: 'DocNumber', Value: 'BATCH-1', Type: 'Output' }] }
    : { Success: true, ResultCode: 'SUCCESS', Params: [{ Name: 'GLEntries', Value: [], Type: 'Output' }] });
}

/** The CompanyIntegrationID param of each verb call, by verb. */
function connectionParams(runVerb: { mock: { calls: unknown[][] } }): Array<[string, unknown]> {
  return runVerb.mock.calls.map((args) => {
    const call = args[0] as { Verb: string; Params: Record<string, unknown> };
    return [call.Verb, call.Params.CompanyIntegrationID];
  });
}

describe('AccountingERPEngine — choosing the posting connection (#256)', () => {
  beforeEach(() => {
    extensionCalls.length = 0;
    vi.spyOn(AccountingEngine.Instance, 'Config').mockResolvedValue();
  });

  /** Post, then look up, the tagged batch against these connections. */
  async function postAndFind(connections: unknown[]) {
    const runVerb = connectionVerb();
    AccountingERPEngine.Instance.UseSeams({ runVerb });
    const p = postingViews(connections);
    const posted = await AccountingERPEngine.Instance.PostJournalBatch(taggedBatch(), taggedLines(), user, p);
    const found = await AccountingERPEngine.Instance.FindPostedJournalBatch(taggedBatch(), taggedLines(), user, p);
    return { runVerb, posted, found };
  }

  it('refuses as before when the company has no connection for the target, running only afterPostFailure', async () => {
    const { runVerb, posted, found } = await postAndFind([connection(CI_PROD, 'HubSpot', 'HubSpot')]);

    const error = `No active 'BusinessCentral' integration for company ${COMPANY}.`;
    expect(posted).toEqual({ success: false, error });
    expect(found).toEqual({ status: 'Unavailable' });
    expect(runVerb).not.toHaveBeenCalled();
    expect(extensionCalls).toEqual([`afterPostFailure:${error}`]);
  });

  it('posts and looks up through the only matching connection, sending its ID to both verbs', async () => {
    const { runVerb, posted, found } = await postAndFind([
      bcConnection(CI_PROD, 'Business Central'),
      connection(CI_UAT, 'QuickBooks', 'QuickBooks Online', POSTING_FLAG),
    ]);

    expect(posted).toEqual({ success: true, externalJournalEntryBatchRef: 'BATCH-1' });
    expect(found).toEqual({ status: 'NotFound' });
    expect(connectionParams(runVerb)).toEqual([['CreateJournalEntry', CI_PROD], ['GetGLEntries', CI_PROD]]);
    expect(extensionCalls).toEqual([`beforePost:${CI_PROD}`, `afterPost:${CI_PROD}`]);
  });

  it('uses the one connection marked "postJournalEntries": true when several match, for the post and the lookup alike', async () => {
    const { runVerb, posted, found } = await postAndFind([
      bcConnection(CI_PROD, 'Business Central', '{"environmentName":"Production"}'),
      bcConnection(CI_UAT, 'BC UAT', POSTING_FLAG),
    ]);

    expect(posted.success).toBe(true);
    expect(found).toEqual({ status: 'NotFound' });
    expect(connectionParams(runVerb)).toEqual([['CreateJournalEntry', CI_UAT], ['GetGLEntries', CI_UAT]]);
    expect(extensionCalls).toEqual([`beforePost:${CI_UAT}`, `afterPost:${CI_UAT}`]);
  });

  it.each([
    ['none is marked', null, null, /None has "postJournalEntries": true in its Configuration/],
    ['two are marked', POSTING_FLAG, POSTING_FLAG, /2 of them \('BC UAT' \(\S+\), 'Business Central' \(\S+\)\) have "postJournalEntries": true/],
    ['the mark is the string "true", not the boolean', '{"postJournalEntries":"true"}', null, /None has "postJournalEntries": true/],
  ])('refuses to post or look up when several match and %s, naming the connections', async (_case, prodConfig, uatConfig, why) => {
    const { runVerb, posted, found } = await postAndFind([
      bcConnection(CI_PROD, 'Business Central', prodConfig),
      bcConnection(CI_UAT, 'BC UAT', uatConfig),
    ]);

    expect(posted.success).toBe(false);
    expect(posted.error).toContain(`Company ${COMPANY} has 2 active 'BusinessCentral' connections: 'BC UAT' (${CI_UAT}), 'Business Central' (${CI_PROD}).`);
    expect(posted.error).toMatch(why);
    expect(posted.error).toMatch(/Mark exactly one with "postJournalEntries": true in its Configuration, or deactivate the others\.$/);
    // The lookup refuses for the same reason, so a send never reaches the post with the lookup unsettled.
    expect(found).toEqual({ status: 'Error', error: posted.error });
    expect(runVerb).not.toHaveBeenCalled();
    expect(extensionCalls).toEqual([`afterPostFailure:${posted.error}`]);
  });

  it('treats a Configuration that is not JSON as unmarked, and logs it', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const chosen = await postAndFind([bcConnection(CI_PROD, 'Business Central', '{not json'), bcConnection(CI_UAT, 'BC UAT', POSTING_FLAG)]);
      expect(connectionParams(chosen.runVerb)).toEqual([['CreateJournalEntry', CI_UAT], ['GetGLEntries', CI_UAT]]);

      const refused = await postAndFind([bcConnection(CI_PROD, 'Business Central', '{not json'), bcConnection(CI_UAT, 'BC UAT')]);
      expect(refused.posted.error).toMatch(/None has "postJournalEntries": true/);
      expect(refused.runVerb).not.toHaveBeenCalled();

      const messages = logged.mock.calls.map((args) => String(args[0]));
      expect(messages.some((m) => m.includes(`'Business Central' (${CI_PROD})`) && m.includes('not valid JSON'))).toBe(true);
    } finally {
      logged.mockRestore();
    }
  });

  it('sends the chosen connection to the QuickBooks Online post and lookup too', async () => {
    const runVerb = vi.fn(async (call: { Verb: string }): Promise<AccountingVerbResult> => call.Verb === 'CreateJournalEntry'
      ? { Success: true, ResultCode: 'SUCCESS', Params: [{ Name: 'JournalEntryID', Value: '146', Type: 'Output' }] }
      : { Success: true, ResultCode: 'SUCCESS', Params: [{ Name: 'Transactions', Value: [], Type: 'Output' }] });
    AccountingERPEngine.Instance.UseSeams({ runVerb });
    const p = providerWith({
      ...qboViews(),
      'MJ: Company Integrations': [
        connection(CI_PROD, 'QBO live', 'QuickBooks Online'),
        connection(CI_UAT, 'QBO sandbox', 'QuickBooks Online', '{"postJournalEntries":true}'),
      ],
    });

    await AccountingERPEngine.Instance.PostJournalBatch(qboBatch(), taggedLines(), user, p);
    await AccountingERPEngine.Instance.FindPostedJournalBatch(qboBatch(), taggedLines(), user, p);

    expect(connectionParams(runVerb)).toEqual([['CreateJournalEntry', CI_UAT], ['GetGLEntries', CI_UAT]]);
  });
});

describe('AccountingERPEngine.SyncMasterData — ERP connections only (#256)', () => {
  const MAP_VIEW = 'MJ: Company Integration Entity Maps';

  beforeEach(() => {
    AccountingERPEngine.Instance.UseSeams({});
    vi.spyOn(AccountingEngine.Instance, 'Config').mockResolvedValue();
  });

  /** Entity maps for GL accounts on each of these connections; the stub provider ignores the filter, so each is checked by ID. */
  function mapsFor(...connectionIds: string[]) {
    return connectionIds.map((id, i) => ({ ID: `map-${i}`, CompanyIntegrationID: id, Entity: 'MJ_BizApps_Accounting: GL Accounts', Status: 'Active', SyncEnabled: true }));
  }

  /** Like providerWith, but entity maps are answered per connection, as the real filter would. */
  function providerWithMapsByConnection(views: Record<string, unknown[]>, failMaps = false) {
    return {
      RunView: async (params: { EntityName: string; ExtraFilter?: string }) => {
        if (params.EntityName === MAP_VIEW) {
          if (failMaps) return { Success: false, ErrorMessage: 'timeout reading entity maps' };
          const rows = (views[MAP_VIEW] ?? []) as Array<{ CompanyIntegrationID: string }>;
          return { Success: true, Results: rows.filter((r) => (params.ExtraFilter ?? '').includes(r.CompanyIntegrationID)) };
        }
        return { Success: true, Results: views[params.EntityName] ?? [] };
      },
    } as never;
  }

  it('leaves out connections to systems that are not ERPs', async () => {
    const synced: string[] = [];
    AccountingERPEngine.Instance.UseSeams({ runSync: async (id) => { synced.push(id); return { Success: true }; } });
    const p = providerWithMapsByConnection({
      'MJ: Company Integrations': [
        connection('ci-hubspot', 'HubSpot', 'HubSpot'),
        connection('ci-irs', 'IRS 990', 'IRS'),
        connection('ci-asana', 'Asana', 'Asana'),
        bcConnection(CI_PROD, 'Business Central'),
      ],
      [MAP_VIEW]: mapsFor('ci-hubspot', 'ci-irs', 'ci-asana', CI_PROD),
      'MJ_BizApps_Accounting: Accounting Engine Extensions': [],
    });

    const out = await AccountingERPEngine.Instance.SyncMasterData({ Objects: ['accounts'] }, user, p);

    expect(synced).toEqual([CI_PROD]);
    expect(out.Results.map((r) => r.CompanyIntegrationID)).toEqual([CI_PROD]);
    expect(out.Success).toBe(true);
  });

  it('reports an ERP connection with no entity maps as skipped, which does not fail the run', async () => {
    const synced: string[] = [];
    AccountingERPEngine.Instance.UseSeams({ runSync: async (id) => { synced.push(id); return { Success: true }; } });
    const p = providerWithMapsByConnection({
      'MJ: Company Integrations': [bcConnection(CI_PROD, 'Business Central'), bcConnection(CI_UAT, 'Sidecar posting')],
      [MAP_VIEW]: mapsFor(CI_PROD),
      'MJ_BizApps_Accounting: Accounting Engine Extensions': [],
    });

    const out = await AccountingERPEngine.Instance.SyncMasterData({ Objects: ['accounts', 'dimensions'] }, user, p);

    expect(synced).toEqual([CI_PROD]);
    expect(out.Success).toBe(true);
    const skipped = out.Results.find((r) => r.CompanyIntegrationID === CI_UAT);
    expect(skipped).toMatchObject({ Success: true, Skipped: true, Objects: ['accounts', 'dimensions'] });
    expect(skipped?.Message).toMatch(/^Skipped: no active, sync-enabled entity maps for accounts, dimensions/);
    expect(out.Results.find((r) => r.CompanyIntegrationID === CI_PROD)?.Skipped).toBeUndefined();
  });

  it('still fails the run when a sync fails, beside a skipped connection', async () => {
    AccountingERPEngine.Instance.UseSeams({ runSync: async () => ({ Success: false, Message: 'BC 401' }) });
    const p = providerWithMapsByConnection({
      'MJ: Company Integrations': [bcConnection(CI_PROD, 'Business Central'), bcConnection(CI_UAT, 'Sidecar posting')],
      [MAP_VIEW]: mapsFor(CI_PROD),
      'MJ_BizApps_Accounting: Accounting Engine Extensions': [],
    });

    const out = await AccountingERPEngine.Instance.SyncMasterData({ Objects: ['accounts'] }, user, p);

    expect(out.Success).toBe(false);
    expect(out.Results.find((r) => r.CompanyIntegrationID === CI_PROD)).toMatchObject({ Success: false, Message: 'BC 401' });
    expect(out.Results.find((r) => r.CompanyIntegrationID === CI_UAT)).toMatchObject({ Success: true, Skipped: true });
  });

  it('fails, never skips, a connection whose entity maps cannot be read', async () => {
    const synced: string[] = [];
    AccountingERPEngine.Instance.UseSeams({ runSync: async (id) => { synced.push(id); return { Success: true }; } });
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const p = providerWithMapsByConnection({
        'MJ: Company Integrations': [bcConnection(CI_PROD, 'Business Central')],
        'MJ_BizApps_Accounting: Accounting Engine Extensions': [],
      }, true);

      const out = await AccountingERPEngine.Instance.SyncMasterData({ Objects: ['accounts'] }, user, p);

      expect(synced).toEqual([]);
      expect(out.Success).toBe(false);
      expect(out.Results[0]).toMatchObject({ Success: false, CompanyIntegrationID: CI_PROD });
      expect(out.Results[0].Skipped).toBeUndefined();
      expect(out.Results[0].Message).toMatch(/Entity maps for Company Integration .* failed to load: timeout reading entity maps/);
    } finally {
      logged.mockRestore();
    }
  });

  it('reports nothing to sync, as before, when a company has only non-ERP connections', async () => {
    AccountingERPEngine.Instance.UseSeams({ runSync: async () => ({ Success: true }) });
    const p = providerWithMapsByConnection({
      'MJ: Company Integrations': [connection('ci-hubspot', 'HubSpot', 'HubSpot')],
      [MAP_VIEW]: mapsFor('ci-hubspot'),
      'MJ_BizApps_Accounting: Accounting Engine Extensions': [],
    });

    const out = await AccountingERPEngine.Instance.SyncMasterData({ Objects: ['accounts'], CompanyIDs: [COMPANY] }, user, p);

    expect(out).toEqual({ Success: false, Results: [] });
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

describe('AccountingERPEngine.SyncMasterData — shared master data merges on Code (#268)', () => {
  const DIMENSIONS = 'MJ_BizApps_Accounting: Dimensions';
  const DIMENSION_VALUES = 'MJ_BizApps_Accounting: Dimension Values';

  beforeEach(() => {
    AccountingERPEngine.Instance.UseSeams({});
    vi.spyOn(AccountingEngine.Instance, 'Config').mockResolvedValue();
  });

  function keyField(entityMapID: string, field: string, extra: Record<string, unknown> = {}) {
    return { EntityMapID: entityMapID, DestinationFieldName: field, IsKeyField: true, Status: 'Active', ...extra };
  }

  /** One ERP connection with a GL Accounts, a Dimensions and a Dimension Values map, and these field maps. */
  function viewsWith(fieldMaps: unknown[]): Record<string, unknown[]> {
    return {
      'MJ: Company Integrations': [
        { ID: CI, CompanyID: COMPANY, IntegrationID: 'int-1', Integration: 'business-central', IsActive: true },
      ],
      'MJ: Company Integration Entity Maps': [
        { ID: 'map-gl', CompanyIntegrationID: CI, Entity: 'MJ_BizApps_Accounting: GL Accounts', Status: 'Active', SyncEnabled: true },
        { ID: 'map-dim', CompanyIntegrationID: CI, Entity: DIMENSIONS, Status: 'Active', SyncEnabled: true },
        { ID: 'map-val', CompanyIntegrationID: CI, Entity: DIMENSION_VALUES, Status: 'Active', SyncEnabled: true },
      ],
      'MJ: Company Integration Field Maps': fieldMaps,
      'MJ_BizApps_Accounting: Accounting Engine Extensions': [],
    };
  }

  it('syncs when Dimensions match on Code and Dimension Values on DimensionID + Code', async () => {
    const synced: string[][] = [];
    AccountingERPEngine.Instance.UseSeams({ runSync: async (_id, _u, mapIds) => { synced.push(mapIds); return { Success: true }; } });
    const p = providerWith(viewsWith([
      keyField('map-dim', 'Code'),
      keyField('MAP-VAL', 'code'),
      keyField('map-val', 'DimensionID', { IsKeyField: 1 }),
    ]));

    const out = await AccountingERPEngine.Instance.SyncMasterData({}, user, p);

    expect(out.Success).toBe(true);
    expect(synced).toEqual([['map-gl', 'map-dim', 'map-val']]);
  });

  it('fails the connection before pulling anything when the Dimensions map has no Code key', async () => {
    const synced: string[][] = [];
    AccountingERPEngine.Instance.UseSeams({ runSync: async (_id, _u, mapIds) => { synced.push(mapIds); return { Success: true }; } });
    const p = providerWith(viewsWith([
      keyField('map-val', 'DimensionID'),
      keyField('map-val', 'Code'),
    ]));

    const out = await AccountingERPEngine.Instance.SyncMasterData({}, user, p);

    expect(synced).toEqual([]);
    expect(out.Success).toBe(false);
    expect(out.Results[0].Success).toBe(false);
    expect(out.Results[0].Message).toMatch(/Entity map map-dim for MJ_BizApps_Accounting: Dimensions must match on key fields Code/);
    expect(out.Results[0].Message).toMatch(/its active key fields are none/);
    expect(out.Results[0].Message).not.toMatch(/map-val/);
  });

  it('refuses a Dimensions map keyed on more than Code, which would insert instead of merging', async () => {
    AccountingERPEngine.Instance.UseSeams({ runSync: async () => ({ Success: true }) });
    const p = providerWith(viewsWith([
      keyField('map-dim', 'Code'),
      keyField('map-dim', 'Name'),
      keyField('map-val', 'DimensionID'),
      keyField('map-val', 'Code'),
    ]));

    const out = await AccountingERPEngine.Instance.SyncMasterData({ Objects: ['dimensions'] }, user, p);

    expect(out.Success).toBe(false);
    expect(out.Results[0].Message).toMatch(/its active key fields are Code \+ Name/);
  });

  it('refuses a Dimension Values map keyed on Code alone, which merges values across Dimensions', async () => {
    AccountingERPEngine.Instance.UseSeams({ runSync: async () => ({ Success: true }) });
    const p = providerWith(viewsWith([
      keyField('map-dim', 'Code'),
      keyField('map-val', 'Code'),
      keyField('map-val', 'DimensionID', { Status: 'Inactive' }),
      keyField('map-val', 'Name', { IsKeyField: false }),
    ]));

    const out = await AccountingERPEngine.Instance.SyncMasterData({ Objects: ['dimensionValues'] }, user, p);

    expect(out.Success).toBe(false);
    expect(out.Results[0].Message).toMatch(/Entity map map-val for MJ_BizApps_Accounting: Dimension Values must match on key fields DimensionID \+ Code/);
    expect(out.Results[0].Message).toMatch(/its active key fields are Code\./);
  });

  it('does not check key fields for an accounts-only sync', async () => {
    const synced: string[][] = [];
    AccountingERPEngine.Instance.UseSeams({ runSync: async (_id, _u, mapIds) => { synced.push(mapIds); return { Success: true }; } });
    const p = providerWith(viewsWith([]));

    const out = await AccountingERPEngine.Instance.SyncMasterData({ Objects: ['accounts'] }, user, p);

    expect(out.Success).toBe(true);
    expect(synced).toEqual([['map-gl']]);
  });

  it('fails the connection when the field maps cannot be read', async () => {
    AccountingERPEngine.Instance.UseSeams({ runSync: async () => ({ Success: true }) });
    const views = viewsWith([]);
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const p = {
        RunView: async (params: { EntityName: string }) => params.EntityName === 'MJ: Company Integration Field Maps'
          ? { Success: false, ErrorMessage: 'field maps timeout' }
          : { Success: true, Results: views[params.EntityName] ?? [] },
      } as never;

      const out = await AccountingERPEngine.Instance.SyncMasterData({ Objects: ['dimensions'] }, user, p);

      expect(out.Success).toBe(false);
      expect(out.Results[0].Message).toMatch(/Field maps for entity maps map-dim failed to load: field maps timeout/);
    } finally {
      logged.mockRestore();
    }
  });
});
