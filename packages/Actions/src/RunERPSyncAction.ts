import { Metadata, type UserInfo } from '@memberjunction/core';
import { ActionResultSimple, RunActionParams } from '@memberjunction/actions-base';
import { BaseAction } from '@memberjunction/actions';
import { RegisterClass, UUIDsEqual } from '@memberjunction/global';
import { UserCache } from '@memberjunction/generic-database-provider';
import { AccountingERPEngine } from '@mj-biz-apps/accounting-core-entities-server';

/**
 * Action: Accounting.RunERPSync
 *
 * One scheduled job calls this once per day for every credentialed company.
 * The engine fans out; this action does not.
 *
 * Only the MJ system user, which the scheduler runs jobs as, may run it. A person syncs from the
 * Explorer ERP sync page, which goes through the `Accounting.RunERPSync` Remote Operation instead.
 */
@RegisterClass(BaseAction, 'Accounting.RunERPSync')
export class RunERPSyncAction extends BaseAction {
  protected async InternalRunAction(params: RunActionParams): Promise<ActionResultSimple> {
    const provider = Metadata.Provider;
    if (!provider) {
      return { Success: false, ResultCode: 'ERROR', Message: 'The ERP sync could not run: the server has no metadata provider loaded.' };
    }
    const user = params.ContextUser;
    if (!user) {
      return { Success: false, ResultCode: 'ERROR', Message: 'The ERP sync could not run: no user was given to run it as.' };
    }
    assertSystemUser(user);
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
      Message: output.Results.map(resultSummary).join('; '),
      Params: [...params.Params, { Name: 'Results', Type: 'Output', Value: output.Results }],
    };
  }
}

/** Fails closed when the user cache does not hold the system user. */
function assertSystemUser(contextUser: UserInfo): void {
  const systemUser = UserCache.Instance.GetSystemUser();
  if (!systemUser || !contextUser?.ID || !UUIDsEqual(contextUser.ID, systemUser.ID)) {
    throw new Error(
      'The ERP sync did not run: this action runs only as the MJ system user, which the scheduled sync job runs as. ' +
      'Run a sync from the ERP sync page instead.',
    );
  }
}

/**
 * One connection's line in the run message. A skipped connection (no entity maps, such as a
 * posting-only connection) is not a failure, and its message says it was skipped and why.
 */
function resultSummary(r: { CompanyID: string; Success: boolean; Skipped?: boolean; Message: string }): string {
  const outcome = r.Skipped || !r.Success ? r.Message : 'ok';
  return `${r.CompanyID}: ${outcome}`;
}
