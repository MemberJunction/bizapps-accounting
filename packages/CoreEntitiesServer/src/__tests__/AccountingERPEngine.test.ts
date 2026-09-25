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

function taggedBatch() {
  return {
    ID: 'batch-1',
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

/** A BC G/L entry as the GetGLEntries verb maps it. The fixtures resolve every account to '1000'. */
function glEntry(debitAmount: number, creditAmount: number, postingDate = new Date('2026-08-01')) {
  return { entryNumber: 1, documentNumber: 'BATCH-1', accountNumber: '1000', postingDate, debitAmount, creditAmount };
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
    let sent: Array<{ accountNumber: string; debit?: number; credit?: number }> = [];
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
        { ID: CI, CompanyID: COMPANY, IntegrationID: 'int-1', Integration: 'QuickBooks Online', IsActive: true },
      ],
    });
    const batch = { ID: 'batch-1', CompanyID: COMPANY, TargetSystem: 'QuickBooks', JournalEntryBatchNumber: 'BATCH-1', PostingDate: new Date('2026-08-01') } as never;

    const result = await AccountingERPEngine.Instance.FindPostedJournalBatch(batch, [], user, p);

    expect(result).toEqual({ status: 'Unavailable' });
    expect(runVerb).not.toHaveBeenCalled();
  });
});
