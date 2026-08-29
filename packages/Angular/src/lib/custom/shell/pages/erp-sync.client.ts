import { LogError } from '@memberjunction/core';
import { GraphQLDataProvider } from '@memberjunction/graphql-dataprovider';
import type { RunERPSyncInput, RunERPSyncOutput } from '@mj-biz-apps/accounting-engine-base';

export class ERPSyncClient {
  constructor(private readonly dataProvider: GraphQLDataProvider) {}

  public async RunERPSync(input: RunERPSyncInput): Promise<RunERPSyncOutput> {
    try {
      const res = await this.dataProvider.RouteOperation<RunERPSyncInput, RunERPSyncOutput>(
        'Accounting.RunERPSync',
        input,
      );
      if (!res.Success || !res.Output) {
        return { Success: false, Results: [{ CompanyID: '', CompanyIntegrationID: null, ProviderName: null, Success: false, Message: res.ErrorMessage ?? 'No response from server.', Objects: [] }] };
      }
      return {
        Success: !!res.Output.Success,
        Results: res.Output.Results ?? [],
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      LogError(`Accounting.RunERPSync: ${msg}`);
      return { Success: false, Results: [{ CompanyID: '', CompanyIntegrationID: null, ProviderName: null, Success: false, Message: msg, Objects: [] }] };
    }
  }
}
