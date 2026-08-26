/**
 * DimensionSyncClient — thin typed wrapper over the 'Accounting.RunBusinessCentralSync' Remote
 * Operation (→ BusinessCentralSyncEngine). No hand-rolled gql and no orchestration: the fan-out
 * across company integrations, the entity-map narrowing, the fetch/mapping/upsert and the
 * per-company failure isolation are all server-side. Batch/JE/sync actions travel the remote-op
 * stack via `provider.RouteOperation` (four-surface doctrine, Amith 2026-07-28).
 *
 * The caller awaits one call and refreshes its view.
 */
import { LogError } from '@memberjunction/core';
import { GraphQLDataProvider } from '@memberjunction/graphql-dataprovider';

/** BC objects the Dimensions page syncs. The server resolves these names to entity maps. */
export const DIMENSION_OBJECT_NAMES: ReadonlyArray<string> = ['dimensions', 'dimensionValues'];

interface RunBusinessCentralSyncOutputWire {
  CompanyIntegrationCount: number;
  Succeeded: number;
  Failed: number;
  RecordsProcessed: number;
  RecordsCreated: number;
  RecordsUpdated: number;
  RecordsErrored: number;
  SkipReason?: string;
  Outcomes?: Array<{ CompanyIntegrationName: string; Status: string; ErrorMessage?: string }>;
}

export interface DimensionSyncResult {
  Success: boolean;
  /** A ready-to-display summary line, or the reason nothing ran. */
  Message: string;
  /** True when at least one company synced, so the caller knows whether to refresh. */
  AnySynced: boolean;
}

export class DimensionSyncClient {
  constructor(private dataProvider: GraphQLDataProvider) {}

  /** Pull Business Central dimensions + dimension values. `fullSync` ignores incremental watermarks. */
  public async RunSync(fullSync = true): Promise<DimensionSyncResult> {
    try {
      const res = await this.dataProvider.RouteOperation<
        { ObjectNames: string[]; FullSync: boolean },
        RunBusinessCentralSyncOutputWire
      >('Accounting.RunBusinessCentralSync', { ObjectNames: [...DIMENSION_OBJECT_NAMES], FullSync: fullSync });

      if (!res.Success || !res.Output) {
        return { Success: false, AnySynced: false, Message: res.ErrorMessage ?? 'No response from server.' };
      }
      const o = res.Output;
      if (o.SkipReason) {
        return { Success: true, AnySynced: false, Message: o.SkipReason };
      }
      const counts = `${o.RecordsProcessed} processed, ${o.RecordsCreated} created, ${o.RecordsUpdated} updated`;
      if (o.Failed === 0) {
        return { Success: true, AnySynced: o.Succeeded > 0,
          Message: `Dimension sync ran for ${o.CompanyIntegrationCount} company integration(s) — ${counts}.` };
      }
      const failed = (o.Outcomes ?? [])
        .filter((x) => x.Status === 'error')
        .map((x) => `${x.CompanyIntegrationName}: ${x.ErrorMessage ?? 'unknown error'}`)
        .join('; ');
      return { Success: false, AnySynced: o.Succeeded > 0,
        Message: `Dimension sync: ${o.Succeeded}/${o.CompanyIntegrationCount} succeeded (${counts}). Failed — ${failed}` };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      LogError(`DimensionSyncClient.RunSync failed: ${msg}`);
      return { Success: false, AnySynced: false, Message: msg };
    }
  }
}
