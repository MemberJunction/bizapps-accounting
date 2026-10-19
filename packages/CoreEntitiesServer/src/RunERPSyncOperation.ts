/**
 * Accounting.RunERPSync — same engine the nightly job and the Explorer ERP page call.
 */
import { BaseRemotableOperation, IMetadataProvider, UserInfo } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import type { RunERPSyncInput, RunERPSyncOutput } from '@mj-biz-apps/accounting-engine-base';
import { AccountingERPEngine } from './AccountingERPEngine.js';

@RegisterClass(BaseRemotableOperation, 'Accounting.RunERPSync')
export class RunERPSyncOperation extends BaseRemotableOperation<RunERPSyncInput, RunERPSyncOutput> {
  public readonly OperationKey = 'Accounting.RunERPSync';

  protected async InternalExecute(
    input: RunERPSyncInput,
    provider: IMetadataProvider,
    user: UserInfo,
  ): Promise<RunERPSyncOutput> {
    return AccountingERPEngine.Instance.SyncMasterData(input ?? {}, user, provider);
  }
}

export function LoadRunERPSyncOperation(): void {}
