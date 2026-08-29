import { Metadata } from '@memberjunction/core';
import { ActionResultSimple, RunActionParams } from '@memberjunction/actions-base';
import { BaseAction } from '@memberjunction/actions';
import { RegisterClass } from '@memberjunction/global';
import { AccountingERPEngine } from '@mj-biz-apps/accounting-core-entities-server';

/**
 * Action: Accounting.RunERPSync
 *
 * One scheduled job calls this once per day for every credentialed company.
 * The engine fans out; this action does not.
 */
@RegisterClass(BaseAction, 'Accounting.RunERPSync')
export class RunERPSyncAction extends BaseAction {
  protected async InternalRunAction(params: RunActionParams): Promise<ActionResultSimple> {
    const provider = Metadata.Provider;
    if (!provider) {
      return { Success: false, ResultCode: 'ERROR', Message: 'Metadata.Provider is not initialized' };
    }
    const user = params.ContextUser;
    if (!user) {
      return { Success: false, ResultCode: 'ERROR', Message: 'ContextUser is required' };
    }
    const objects = params.Params.find((p) => p.Name === 'Objects')?.Value as Array<'accounts' | 'dimensions' | 'dimensionValues'> | undefined;
    const companyIds = params.Params.find((p) => p.Name === 'CompanyIDs')?.Value as string[] | undefined;
    const output = await AccountingERPEngine.Instance.SyncMasterData(
      { Objects: objects, CompanyIDs: companyIds },
      user,
      provider,
    );
    return {
      Success: output.Success,
      ResultCode: output.Success ? 'SUCCESS' : 'ERROR',
      Message: output.Results.map((r) => `${r.CompanyID}: ${r.Success ? 'ok' : r.Message}`).join('; '),
      Params: [...params.Params, { Name: 'Results', Type: 'Output', Value: output.Results }],
    };
  }
}
