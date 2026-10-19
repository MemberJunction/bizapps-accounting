import { describe, expect, it } from 'vitest';
import { BaseAccountingEngineExtension } from '../AccountingEngineExtension.js';

class SilentExt extends BaseAccountingEngineExtension {
  get Code(): string { return 'Silent'; }
}

class CashExt extends BaseAccountingEngineExtension {
  get Code(): string { return 'ImportBankAccountBalances'; }
  get RunAfterSyncMasterData(): boolean { return true; }
}

describe('BaseAccountingEngineExtension', () => {
  it('defaults every macro getter to false so an empty subclass is a no-op', () => {
    const ext = new SilentExt();
    expect(ext.RunAfterSyncMasterData).toBe(false);
    expect(ext.RunAfterPostJournalBatch).toBe(false);
    expect(ext.RunAfterPostJournalBatchFailure).toBe(false);
    expect(ext.ParticipatesInSyncMasterData).toBe(false);
    expect(ext.ParticipatesInPostJournalBatch).toBe(false);
    expect(ext.ParticipatesInPostJournalBatchFailure).toBe(false);
  });

  it('lets a subclass opt into SyncMasterData only', () => {
    const ext = new CashExt();
    expect(ext.Code).toBe('ImportBankAccountBalances');
    expect(ext.RunAfterSyncMasterData).toBe(true);
    expect(ext.ParticipatesInSyncMasterData).toBe(true);
    expect(ext.RunAfterPostJournalBatch).toBe(false);
    expect(ext.ParticipatesInPostJournalBatch).toBe(false);
  });
});
