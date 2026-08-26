/**
 * BusinessCentralSyncEngine — the Business Central fan-out sync, as a server-side engine.
 *
 * WHY THIS EXISTS. Triggering the BC pull is orchestration, not presentation: resolve the
 * integration, find every active + credentialed Company Integration for it, optionally narrow to a
 * set of external objects, then run one `IntegrationEngine.RunSync` per company with per-company
 * failure isolation. `docs/ui-architecture.md`'s review test — "could a non-Angular host — a script,
 * a server job, another app — do this same work with the same objects?" — answers yes for every step,
 * so it belongs here rather than in a page component. Exposed to clients through
 * {@link RunBusinessCentralSyncOperation} (`Accounting.RunBusinessCentralSync`).
 *
 * All data processing stays on the server: fetch, field mapping and upsert happen inside the
 * integration engine, and the caller only awaits the aggregate summary and refreshes its view.
 *
 * NARROWING BY OBJECT NAME, not by entity-map ID: callers name what they want ('dimensions',
 * 'dimensionValues'), and this engine resolves the map IDs. A UI never has to know that entity maps
 * exist, and adding a company is additive — its maps are picked up by name.
 *
 * CONNECTS TO:
 *   OP:     ./RunBusinessCentralSyncOperation (the remote-op surface)
 *   DRIVER: ./BizAppsAccountingBCFanOutSyncDriver (the nightly schedule; still has its own
 *           equivalent fan-out — collapsing it onto this engine is a follow-up, deliberately not
 *           done here to keep this change off that file)
 */
import { BaseSingleton } from '@memberjunction/global';
import { RunView, UserInfo, IMetadataProvider, IRunViewProvider } from '@memberjunction/core';
import { IntegrationEngine } from '@memberjunction/integration-engine';
import type { IntegrationSyncOptions } from '@memberjunction/integration-engine';

/** Default integration name this engine drives. */
export const BUSINESS_CENTRAL_INTEGRATION_NAME = 'business-central';

/** What to sync. Everything is optional — the default is "every active map, incrementally". */
export interface BusinessCentralSyncRequest {
    /** Integration name. Defaults to {@link BUSINESS_CENTRAL_INTEGRATION_NAME}. */
    IntegrationName?: string;
    /** External object names to narrow to (e.g. ['dimensions','dimensionValues']). Empty = all maps. */
    ObjectNames?: string[];
    /** Ignore incremental watermarks and re-pull the whole set. */
    FullSync?: boolean;
}

/** Per-company outcome. A discriminated union so aggregation stays strongly typed. */
export type BusinessCentralSyncOutcome =
    | { CompanyIntegrationID: string; CompanyIntegrationName: string; Status: 'synced';
        RecordsProcessed: number; RecordsCreated: number; RecordsUpdated: number; RecordsErrored: number }
    | { CompanyIntegrationID: string; CompanyIntegrationName: string; Status: 'error'; ErrorMessage: string };

/** The aggregate a caller awaits. */
export interface BusinessCentralSyncSummary {
    CompanyIntegrationCount: number;
    Succeeded: number;
    Failed: number;
    RecordsProcessed: number;
    RecordsCreated: number;
    RecordsUpdated: number;
    RecordsErrored: number;
    /** Set when nothing could be attempted (no integration, no credentialed company, no maps). */
    SkipReason?: string;
    /**
     * One-line human description of this run, composed HERE on purpose.
     *
     * The server already has to describe a run with no client present — the nightly driver's
     * FormatNotification builds the failure-alert Subject/Body — and what counts as success, which
     * company failed, and why nothing ran are all server knowledge. Composing it once here keeps the
     * scheduled job and every UI saying the same thing about the same run. Callers that want to
     * render differently still have the structured counts below.
     */
    Message: string;
    Outcomes: BusinessCentralSyncOutcome[];
}

interface CompanyIntegrationRow { ID: string; Name: string }
interface EntityMapRow { ID: string }
interface IntegrationRow { ID: string }

export class BusinessCentralSyncEngine extends BaseSingleton<BusinessCentralSyncEngine> {
    public static get Instance(): BusinessCentralSyncEngine {
        return super.getInstance<BusinessCentralSyncEngine>();
    }

    /**
     * Runs the fan-out. Never throws for a per-company failure — those are isolated into
     * {@link BusinessCentralSyncSummary.Outcomes} so one bad credential cannot fail the rest.
     */
    public async RunSync(
        request: BusinessCentralSyncRequest,
        user: UserInfo,
        provider?: IMetadataProvider,
    ): Promise<BusinessCentralSyncSummary> {
        const integrationName = request.IntegrationName?.trim() || BUSINESS_CENTRAL_INTEGRATION_NAME;
        await IntegrationEngine.Instance.Config(false, user);

        // The concrete provider implements BOTH interfaces (ProviderBase implements IMetadataProvider,
        // IRunViewProvider), but the remote-op surface hands us the narrower IMetadataProvider. Same
        // cast the app already uses in JournalEntryBatchOperations/JournalEntryTypes, and that MJ core
        // itself uses in providerBase.ts. Kept to this one line rather than pushed onto callers.
        const rv = new RunView(provider as unknown as IRunViewProvider | undefined);
        const empty = (SkipReason: string): BusinessCentralSyncSummary => ({
            CompanyIntegrationCount: 0, Succeeded: 0, Failed: 0,
            RecordsProcessed: 0, RecordsCreated: 0, RecordsUpdated: 0, RecordsErrored: 0,
            SkipReason, Message: SkipReason, Outcomes: [],
        });

        const integration = await rv.RunView<IntegrationRow>({
            EntityName: 'MJ: Integrations',
            ExtraFilter: `Name='${escapeSQLString(integrationName)}'`,
            Fields: ['ID'], ResultType: 'simple', MaxRows: 1,
        }, user);
        const integrationID = integration.Results?.[0]?.ID;
        if (!integrationID) {
            return empty(`Integration '${integrationName}' is not registered in this environment.`);
        }

        const companies = await rv.RunView<CompanyIntegrationRow>({
            EntityName: 'MJ: Company Integrations',
            ExtraFilter: `IntegrationID='${integrationID}' AND IsActive=1 AND CredentialID IS NOT NULL`,
            Fields: ['ID', 'Name'], OrderBy: 'Name', ResultType: 'simple',
        }, user);
        const targets = companies.Results ?? [];
        if (targets.length === 0) {
            return empty(`No active, credentialed Company Integrations found for '${integrationName}'.`);
        }

        let entityMapIDs: string[] | undefined;
        if (request.ObjectNames?.length) {
            entityMapIDs = await this.resolveEntityMapIDs(rv, targets, request.ObjectNames, user);
            if (entityMapIDs.length === 0) {
                return empty(`No active entity maps found for ${request.ObjectNames.join(', ')}.`);
            }
        }

        const options: IntegrationSyncOptions = { FullSync: request.FullSync === true, EntityMapIDs: entityMapIDs };
        const outcomes: BusinessCentralSyncOutcome[] = [];
        for (const target of targets) {
            outcomes.push(await this.syncOne(target, options, user));
        }
        return this.aggregate(outcomes);
    }

    /** Active entity-map IDs across the target companies whose external object name was requested. */
    private async resolveEntityMapIDs(
        rv: RunView, targets: CompanyIntegrationRow[], objectNames: string[], user: UserInfo,
    ): Promise<string[]> {
        const names = objectNames.map((n) => `'${escapeSQLString(n)}'`).join(',');
        const ids = targets.map((t) => `'${t.ID}'`).join(',');
        const maps = await rv.RunView<EntityMapRow>({
            EntityName: 'MJ: Company Integration Entity Maps',
            ExtraFilter: `CompanyIntegrationID IN (${ids}) AND ExternalObjectName IN (${names}) AND Status='Active'`,
            Fields: ['ID'], ResultType: 'simple',
        }, user);
        return maps.Success ? (maps.Results ?? []).map((m) => m.ID) : [];
    }

    /** One company. Failures are captured, never thrown, so the fan-out continues. */
    private async syncOne(
        target: CompanyIntegrationRow, options: IntegrationSyncOptions, user: UserInfo,
    ): Promise<BusinessCentralSyncOutcome> {
        try {
            const result = await IntegrationEngine.Instance.RunSync(
                target.ID, user, 'Manual', undefined, undefined, options);
            return {
                CompanyIntegrationID: target.ID, CompanyIntegrationName: target.Name, Status: 'synced',
                RecordsProcessed: result.RecordsProcessed, RecordsCreated: result.RecordsCreated,
                RecordsUpdated: result.RecordsUpdated, RecordsErrored: result.RecordsErrored,
            };
        } catch (error) {
            return {
                CompanyIntegrationID: target.ID, CompanyIntegrationName: target.Name, Status: 'error',
                ErrorMessage: error instanceof Error ? error.message : String(error),
            };
        }
    }

    private aggregate(outcomes: BusinessCentralSyncOutcome[]): BusinessCentralSyncSummary {
        const synced = outcomes.filter((o): o is Extract<BusinessCentralSyncOutcome, { Status: 'synced' }> => o.Status === 'synced');
        const sum = (pick: (o: Extract<BusinessCentralSyncOutcome, { Status: 'synced' }>) => number): number =>
            synced.reduce((total, o) => total + pick(o), 0);
        const failedNames = outcomes
            .filter((o): o is Extract<BusinessCentralSyncOutcome, { Status: 'error' }> => o.Status === 'error')
            .map((o) => `${o.CompanyIntegrationName}: ${o.ErrorMessage}`);
        const counts =
            `${sum((o) => o.RecordsProcessed)} processed, ${sum((o) => o.RecordsCreated)} created, ` +
            `${sum((o) => o.RecordsUpdated)} updated`;
        const message = failedNames.length === 0
            ? `Sync ran for ${outcomes.length} company integration(s) — ${counts}.`
            : `Sync: ${synced.length}/${outcomes.length} succeeded (${counts}). Failed — ${failedNames.join('; ')}`;

        return {
            Message: message,
            CompanyIntegrationCount: outcomes.length,
            Succeeded: synced.length,
            Failed: outcomes.length - synced.length,
            RecordsProcessed: sum((o) => o.RecordsProcessed),
            RecordsCreated: sum((o) => o.RecordsCreated),
            RecordsUpdated: sum((o) => o.RecordsUpdated),
            RecordsErrored: sum((o) => o.RecordsErrored),
            Outcomes: outcomes,
        };
    }
}

/** Single-quote escape for the string literals interpolated into ExtraFilter above. */
function escapeSQLString(value: string): string {
    return value.replace(/'/g, "''");
}
