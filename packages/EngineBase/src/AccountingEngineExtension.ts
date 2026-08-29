/**
 * Run-extension seam for AccountingERPEngine.
 *
 * Other Open Apps (FP&A first) subclass this, `@RegisterClass` with a key that
 * matches AccountingEngineExtension.DriverClass, and insert a metadata row.
 * Accounting does not import those apps. Hook participation is on the class
 * (getters default false; Before/After methods are no-ops). Host knobs live
 * on AccountingEngineExtension.Configuration, not on extra columns.
 */
import { IMetadataProvider, UserInfo } from '@memberjunction/core';
import { RequiresSubclass } from '@memberjunction/global';
import type { mjBizAppsAccountingAccountingEngineExtensionEntity_IAccountingEngineExtensionConfiguration } from '@mj-biz-apps/accounting-entities';

export type AccountingERPSyncObject = 'accounts' | 'dimensions' | 'dimensionValues';

export interface AccountingEngineExtensionContext {
  CompanyID: string;
  AsOf: Date;
  Objects: AccountingERPSyncObject[];
  CompanyIntegrationID: string | null;
  ProviderName: string | null;
  User: UserInfo;
  Provider: IMetadataProvider;
  /** Set after PostJournalBatch. */
  JournalEntryBatchID?: string;
  ExternalJournalEntryBatchRef?: string | null;
  ErrorMessage?: string | null;
}

@RequiresSubclass()
export abstract class BaseAccountingEngineExtension {
  abstract get Code(): string;

  get RunAfterSyncMasterData(): boolean {
    return false;
  }
  get RunAfterPostJournalBatch(): boolean {
    return false;
  }
  get RunAfterPostJournalBatchFailure(): boolean {
    return false;
  }

  Configuration: mjBizAppsAccountingAccountingEngineExtensionEntity_IAccountingEngineExtensionConfiguration | null = null;

  async BeforeSyncMasterData(_ctx: AccountingEngineExtensionContext): Promise<void> {}
  async AfterSyncMasterData(_ctx: AccountingEngineExtensionContext): Promise<void> {}
  async AfterSyncAccounts(_ctx: AccountingEngineExtensionContext): Promise<void> {}
  async AfterSyncDimensions(_ctx: AccountingEngineExtensionContext): Promise<void> {}
  async AfterSyncDimensionValues(_ctx: AccountingEngineExtensionContext): Promise<void> {}
  async BeforePostJournalBatch(_ctx: AccountingEngineExtensionContext): Promise<void> {}
  async AfterPostJournalBatch(_ctx: AccountingEngineExtensionContext): Promise<void> {}
  async AfterPostJournalBatchFailure(_ctx: AccountingEngineExtensionContext): Promise<void> {}
}

export const ACCOUNTING_ENGINE_EXTENSION_ENTITY = 'MJ_BizApps_Accounting: Accounting Engine Extensions';
