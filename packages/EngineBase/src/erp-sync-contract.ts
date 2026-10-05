/**
 * Browser-safe contract for Accounting.RunERPSync.
 */
import type { AccountingERPSyncObject } from './AccountingEngineExtension.js';

export interface RunERPSyncInput {
  Objects?: AccountingERPSyncObject[];
  CompanyIDs?: string[];
}

export interface RunERPSyncCompanyResult {
  CompanyID: string;
  CompanyIntegrationID: string | null;
  ProviderName: string | null;
  /** False only when the connection's sync failed. A skipped connection is not a failure. */
  Success: boolean;
  /**
   * True when the connection was not synced and that is expected: an ERP connection with no entity
   * maps for the requested objects, such as a posting-only connection. `Success` is then true, and
   * `Message` says why it was skipped.
   */
  Skipped?: boolean;
  Message: string;
  Objects: AccountingERPSyncObject[];
}

export interface RunERPSyncOutput {
  Success: boolean;
  Results: RunERPSyncCompanyResult[];
}

export const ERP_SYNC_OBJECT_ENTITY: Record<AccountingERPSyncObject, string> = {
  accounts: 'MJ_BizApps_Accounting: GL Accounts',
  dimensions: 'MJ_BizApps_Accounting: Dimensions',
  dimensionValues: 'MJ_BizApps_Accounting: Dimension Values',
};

export const ALL_ERP_SYNC_OBJECTS: AccountingERPSyncObject[] = [
  'accounts',
  'dimensions',
  'dimensionValues',
];
