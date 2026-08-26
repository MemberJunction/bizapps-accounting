/**
 * RunBusinessCentralSyncOperation — 'Accounting.RunBusinessCentralSync' as a code-only Remote
 * Operation (four-surface doctrine, Amith 2026-07-28: an action that runs entity/engine logic
 * server-side travels the remote-op stack).
 *
 * Thin by design: the fan-out — resolve the integration, find every active + credentialed Company
 * Integration, narrow to the requested external objects, run one IntegrationEngine sync per company
 * with per-company failure isolation — lives in {@link BusinessCentralSyncEngine}. This op only
 * validates input and maps the summary, so a UI awaits one call and refreshes its view; no fetch,
 * mapping or upsert logic ever crosses to the client.
 *
 * CONNECTS TO:
 *   ENGINE:  ./BusinessCentralSyncEngine
 *   CLIENTS: DimensionSyncClient (Angular, via provider.RouteOperation)
 */
import { BaseRemotableOperation, IMetadataProvider, UserInfo } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import {
    BusinessCentralSyncEngine,
    type BusinessCentralSyncOutcome,
} from './BusinessCentralSyncEngine.js';

/** Operation key clients pass to `RouteOperation`. */
export const RUN_BC_SYNC_OPERATION_KEY = 'Accounting.RunBusinessCentralSync';

export interface RunBusinessCentralSyncInput {
    /** External object names to narrow to (e.g. ['dimensions','dimensionValues']). Omit = every active map. */
    ObjectNames?: string[];
    /** Ignore incremental watermarks and re-pull the whole set. Defaults to false. */
    FullSync?: boolean;
    /** Integration name override; defaults to 'business-central'. */
    IntegrationName?: string;
}

export interface RunBusinessCentralSyncOutput {
    CompanyIntegrationCount: number;
    Succeeded: number;
    Failed: number;
    RecordsProcessed: number;
    RecordsCreated: number;
    RecordsUpdated: number;
    RecordsErrored: number;
    /** Present when nothing could be attempted (no integration / no credentialed company / no maps). */
    SkipReason?: string;
    /** Per-company detail, so a caller can name which company failed rather than just a count. */
    Outcomes: BusinessCentralSyncOutcome[];
}

@RegisterClass(BaseRemotableOperation, RUN_BC_SYNC_OPERATION_KEY)
export class RunBusinessCentralSyncOperation
    extends BaseRemotableOperation<RunBusinessCentralSyncInput, RunBusinessCentralSyncOutput> {

    public readonly OperationKey = RUN_BC_SYNC_OPERATION_KEY;

    protected async InternalExecute(
        input: RunBusinessCentralSyncInput, provider: IMetadataProvider, user: UserInfo,
    ): Promise<RunBusinessCentralSyncOutput> {
        const objectNames = (input?.ObjectNames ?? [])
            .map((n) => n?.trim())
            .filter((n): n is string => !!n && n.length > 0);

        const summary = await BusinessCentralSyncEngine.Instance.RunSync({
            IntegrationName: input?.IntegrationName,
            ObjectNames: objectNames.length > 0 ? objectNames : undefined,
            FullSync: input?.FullSync === true,
        }, user, provider);

        return {
            CompanyIntegrationCount: summary.CompanyIntegrationCount,
            Succeeded: summary.Succeeded,
            Failed: summary.Failed,
            RecordsProcessed: summary.RecordsProcessed,
            RecordsCreated: summary.RecordsCreated,
            RecordsUpdated: summary.RecordsUpdated,
            RecordsErrored: summary.RecordsErrored,
            SkipReason: summary.SkipReason,
            Outcomes: summary.Outcomes,
        };
    }
}

/** Tree-shaking anchor — called from the app's server bootstrap so the registration is retained. */
export function LoadRunBusinessCentralSyncOperation(): void {
    // intentionally empty
}
