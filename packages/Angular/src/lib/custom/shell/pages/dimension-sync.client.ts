/**
 * DimensionSyncClient — thin typed wrapper over the 'Accounting.RunBusinessCentralSync' Remote
 * Operation (→ BusinessCentralSyncEngine). No hand-rolled gql, no orchestration and no
 * presentation: the fan-out across company integrations, the entity-map narrowing, the
 * fetch/mapping/upsert and the per-company failure isolation are all server-side, and formatting
 * the outcome for a user is the caller's job. Sync actions travel the remote-op stack via
 * `provider.RouteOperation` (four-surface doctrine, Amith 2026-07-28).
 *
 * This file exists only to give the page a typed call site — same role as
 * `journal-entry.client.ts`, which likewise returns data rather than display text.
 */
import { LogError } from '@memberjunction/core';
import { GraphQLDataProvider } from '@memberjunction/graphql-dataprovider';

/** BC objects the Dimensions page syncs. The SERVER resolves these names to entity maps. */
export const DIMENSION_OBJECT_NAMES: ReadonlyArray<string> = ['dimensions', 'dimensionValues'];

/** One company integration's outcome, as returned by the operation. */
export interface DimensionSyncOutcome {
  CompanyIntegrationName: string;
  Status: string;
  ErrorMessage?: string;
}

/** The operation's aggregate — counts only; the caller decides how to say it. */
export interface DimensionSyncSummary {
  CompanyIntegrationCount: number;
  Succeeded: number;
  Failed: number;
  RecordsProcessed: number;
  RecordsCreated: number;
  RecordsUpdated: number;
  RecordsErrored: number;
  /** Set when nothing could be attempted (no integration / no credentialed company / no maps). */
  SkipReason?: string;
  Outcomes?: DimensionSyncOutcome[];
}

export interface DimensionSyncResult {
  Success: boolean;
  Summary?: DimensionSyncSummary;
  ErrorMessage?: string;
}

export class DimensionSyncClient {
  constructor(private dataProvider: GraphQLDataProvider) {}

  /** Pull Business Central dimensions + dimension values. `fullSync` ignores incremental watermarks. */
  public async SyncDimensions(fullSync = true): Promise<DimensionSyncResult> {
    try {
      const res = await this.dataProvider.RouteOperation<
        { ObjectNames: string[]; FullSync: boolean },
        DimensionSyncSummary
      >('Accounting.RunBusinessCentralSync', { ObjectNames: [...DIMENSION_OBJECT_NAMES], FullSync: fullSync });

      if (!res.Success || !res.Output) {
        return { Success: false, ErrorMessage: res.ErrorMessage ?? 'No response from server.' };
      }
      return { Success: true, Summary: res.Output };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      LogError(`DimensionSyncClient.SyncDimensions failed: ${msg}`);
      return { Success: false, ErrorMessage: msg };
    }
  }
}
