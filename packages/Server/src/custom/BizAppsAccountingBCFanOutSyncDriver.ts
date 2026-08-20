/**
 * BizApps Accounting — Business Central fan-out sync driver.
 *
 * A custom MJ scheduled-job driver, owned by THIS app (registered via @RegisterClass and loaded into
 * MJAPI through the app's server dynamic-package). It fans a single nightly job out across EVERY
 * active, credentialed Company Integration for a given Integration (Business Central), running one
 * IntegrationEngine.RunSync per company with per-company failure isolation. Onboarding a new company
 * is then additive — create its Company Integration (+ its entity/field maps) and this one job picks
 * it up, no new scheduled job required.
 *
 * This lives in the app repo on purpose: the stock `IntegrationSyncScheduledJobDriver` targets one
 * CompanyIntegrationID, and multi-company fan-out is an app concern, not a platform change. The job
 * points at this driver via an app-authored `MJ: Scheduled Job Types` record whose DriverClass is
 * {@link BC_FANOUT_SYNC_DRIVER_CLASS}.
 */

import { RegisterClass } from '@memberjunction/global';
import { BaseScheduledJob, ScheduledJobExecutionContext } from '@memberjunction/scheduling-engine';
import { ValidationResult, ValidationErrorInfo, ValidationErrorType, RunView, UserInfo } from '@memberjunction/core';
import { MJCompanyIntegrationEntity, MJScheduledJobEntity } from '@memberjunction/core-entities';
import { IntegrationEngine } from '@memberjunction/integration-engine';
import type { SyncResult, IntegrationSyncOptions } from '@memberjunction/integration-engine';
import { ScheduledJobResult, NotificationContent } from '@memberjunction/scheduling-base-types';

/** DriverClass value that the app's `MJ: Scheduled Job Types` record points at. */
export const BC_FANOUT_SYNC_DRIVER_CLASS = 'BizAppsAccountingBCFanOutSyncDriver';

/**
 * Configuration schema (stored in ScheduledJob.Configuration):
 * {
 *   IntegrationID: string,      // the Integration to fan out across (e.g. business-central)
 *   EntityMapIDs?: string[],    // optional narrowing, passed through to each RunSync
 *   FullSync?: boolean,         // ignore watermarks and re-pull the whole set per company
 *   SyncDirection?: 'Pull' | 'Push' | 'Bidirectional'
 * }
 */
interface BCFanOutSyncConfiguration {
    IntegrationID: string;
    EntityMapIDs?: string[];
    FullSync?: boolean;
    SyncDirection?: 'Pull' | 'Push' | 'Bidirectional';
}

/**
 * The outcome of syncing one Company Integration. A discriminated union so the aggregation stays
 * strongly typed (no `any`).
 */
type PerCompanyOutcome =
    | { CompanyIntegrationID: string; Status: 'synced'; Result: SyncResult }
    | { CompanyIntegrationID: string; Status: 'skipped'; Reason: string }
    | { CompanyIntegrationID: string; Status: 'error'; ErrorMessage: string };

@RegisterClass(BaseScheduledJob, BC_FANOUT_SYNC_DRIVER_CLASS)
export class BizAppsAccountingBCFanOutSyncDriver extends BaseScheduledJob {

    public async Execute(context: ScheduledJobExecutionContext): Promise<ScheduledJobResult> {
        const config = this.parseConfiguration<BCFanOutSyncConfiguration>(context.Schedule);

        // Load integration-engine metadata once before resolving targets or syncing.
        await IntegrationEngine.Instance.Config(false, context.ContextUser);

        const targets = await this.resolveTargets(config.IntegrationID, context.ContextUser);
        if (targets.length === 0) {
            const message = `No active, credentialed Company Integrations found for IntegrationID ${config.IntegrationID}.`;
            this.log(message);
            return {
                Success: true,
                Details: { IntegrationID: config.IntegrationID, CompanyIntegrationCount: 0, Skipped: true, SkipReason: message },
            };
        }

        this.log(`BC fan-out sync: ${targets.length} company integration(s) for IntegrationID ${config.IntegrationID}`);
        const outcomes: PerCompanyOutcome[] = [];
        for (const companyIntegrationID of targets) {
            outcomes.push(await this.syncOne(companyIntegrationID, config, context));
        }
        return this.buildAggregateResult(config, outcomes);
    }

    /**
     * Every active Company Integration for the Integration that has a credential wired. An
     * un-credentialed integration can't authenticate, so it is excluded rather than run to a quiet
     * 0-record failure.
     */
    private async resolveTargets(integrationID: string, contextUser: UserInfo): Promise<string[]> {
        const rv = new RunView();
        const result = await rv.RunView<MJCompanyIntegrationEntity>({
            EntityName: 'MJ: Company Integrations',
            ExtraFilter: `IntegrationID='${integrationID}' AND IsActive=1 AND CredentialID IS NOT NULL`,
            Fields: ['ID'],
            OrderBy: 'CompanyID',
            ResultType: 'simple',
        }, contextUser);
        if (!result.Success) {
            this.log(`Failed to resolve Company Integrations for IntegrationID ${integrationID}: ${result.ErrorMessage}`);
            return [];
        }
        return result.Results.map(ci => ci.ID);
    }

    /**
     * Syncs one Company Integration, isolating both the maintenance-lock skip and any thrown error
     * so a single company can't abort the fan-out run.
     */
    private async syncOne(
        companyIntegrationID: string,
        config: BCFanOutSyncConfiguration,
        context: ScheduledJobExecutionContext
    ): Promise<PerCompanyOutcome> {
        this.log(`Starting BC sync for CompanyIntegration: ${companyIntegrationID}`);

        // Skip (not fail) while a metadata refresh / schema evolution holds the maintenance lock for
        // this connection — a sync mid-refresh would read half-rewritten metadata/field maps/DDL.
        const maintenance = IntegrationEngine.GetMaintenanceLock(companyIntegrationID);
        if (maintenance) {
            const reason = `Scheduled sync skipped: ${maintenance.Reason} is in progress for this connection (since ${maintenance.AcquiredAt.toISOString()}).`;
            this.log(reason);
            return { CompanyIntegrationID: companyIntegrationID, Status: 'skipped', Reason: reason };
        }

        const options: IntegrationSyncOptions = {
            EntityMapIDs: config.EntityMapIDs,
            FullSync: config.FullSync,
            ScheduledJobRunID: context.Run.ID,
            SyncDirection: config.SyncDirection,
        };

        try {
            const result = await IntegrationEngine.Instance.RunSync(
                companyIntegrationID,
                context.ContextUser,
                'Scheduled',
                // Heartbeat the lease per batch so a healthy long-running sync keeps its slot.
                () => { void context.heartbeat?.(); },
                undefined, // onNotification
                options
            );
            this.log(
                `BC sync completed for ${companyIntegrationID}: ${result.RecordsProcessed} processed, ` +
                `${result.RecordsCreated} created, ${result.RecordsUpdated} updated, ${result.RecordsErrored} errors`
            );
            return { CompanyIntegrationID: companyIntegrationID, Status: 'synced', Result: result };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.log(`BC sync FAILED for ${companyIntegrationID}: ${errorMessage}`);
            return { CompanyIntegrationID: companyIntegrationID, Status: 'error', ErrorMessage: errorMessage };
        }
    }

    /**
     * Aggregates the fan-out into one ScheduledJobResult. The run is a failure only if a company
     * THREW or a completed sync reported Success=false; per-record errors within an otherwise
     * successful sync are summed into totals.
     */
    private buildAggregateResult(config: BCFanOutSyncConfiguration, outcomes: PerCompanyOutcome[]): ScheduledJobResult {
        const synced = outcomes.filter((o): o is Extract<PerCompanyOutcome, { Status: 'synced' }> => o.Status === 'synced');
        const skipped = outcomes.filter((o): o is Extract<PerCompanyOutcome, { Status: 'skipped' }> => o.Status === 'skipped');
        const errored = outcomes.filter((o): o is Extract<PerCompanyOutcome, { Status: 'error' }> => o.Status === 'error');

        const totals = synced.reduce(
            (acc, o) => {
                acc.RecordsProcessed += o.Result.RecordsProcessed;
                acc.RecordsCreated += o.Result.RecordsCreated;
                acc.RecordsUpdated += o.Result.RecordsUpdated;
                acc.RecordsDeleted += o.Result.RecordsDeleted;
                acc.RecordsErrored += o.Result.RecordsErrored;
                acc.RecordsSkipped += o.Result.RecordsSkipped;
                acc.Duration += o.Result.Duration ?? 0;
                return acc;
            },
            { RecordsProcessed: 0, RecordsCreated: 0, RecordsUpdated: 0, RecordsDeleted: 0, RecordsErrored: 0, RecordsSkipped: 0, Duration: 0 }
        );

        const failedCompanies = [
            ...errored.map(o => `${o.CompanyIntegrationID}: ${o.ErrorMessage}`),
            ...synced.filter(o => !o.Result.Success).map(o => `${o.CompanyIntegrationID}: ${o.Result.ErrorMessage ?? 'sync reported failure'}`),
        ];
        const success = failedCompanies.length === 0;

        return {
            Success: success,
            ErrorMessage: success ? undefined : `${failedCompanies.length} of ${outcomes.length} company integration(s) failed: ${failedCompanies.join('; ')}`,
            Details: {
                IntegrationID: config.IntegrationID,
                CompanyIntegrationCount: outcomes.length,
                SyncedCount: synced.length,
                SkippedCount: skipped.length,
                ErroredCount: errored.length,
                ...totals,
                PerCompany: outcomes.map(o =>
                    o.Status === 'synced'
                        ? { CompanyIntegrationID: o.CompanyIntegrationID, Status: o.Status, CompanyIntegrationRunID: o.Result.RunID, RecordsProcessed: o.Result.RecordsProcessed, RecordsCreated: o.Result.RecordsCreated, RecordsUpdated: o.Result.RecordsUpdated, RecordsErrored: o.Result.RecordsErrored, Success: o.Result.Success }
                        : o.Status === 'skipped'
                            ? { CompanyIntegrationID: o.CompanyIntegrationID, Status: o.Status, Reason: o.Reason }
                            : { CompanyIntegrationID: o.CompanyIntegrationID, Status: o.Status, ErrorMessage: o.ErrorMessage }
                ),
            }
        };
    }

    public ValidateConfiguration(schedule: MJScheduledJobEntity): ValidationResult {
        const result = new ValidationResult();
        try {
            const config = this.parseConfiguration<BCFanOutSyncConfiguration>(schedule);
            if (!config.IntegrationID) {
                result.Errors.push(new ValidationErrorInfo(
                    'Configuration.IntegrationID',
                    'IntegrationID is required (the Integration to fan out across, e.g. business-central)',
                    config.IntegrationID,
                    ValidationErrorType.Failure
                ));
            }
            if (config.EntityMapIDs && !Array.isArray(config.EntityMapIDs)) {
                result.Errors.push(new ValidationErrorInfo(
                    'Configuration.EntityMapIDs',
                    'EntityMapIDs must be an array of strings',
                    config.EntityMapIDs,
                    ValidationErrorType.Failure
                ));
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Invalid configuration';
            result.Errors.push(new ValidationErrorInfo('Configuration', errorMessage, schedule.Configuration, ValidationErrorType.Failure));
        }
        result.Success = result.Errors.length === 0;
        return result;
    }

    public FormatNotification(context: ScheduledJobExecutionContext, result: ScheduledJobResult): NotificationContent {
        const d = result.Details;
        const subject = result.Success
            ? `BC fan-out sync completed: ${context.Schedule.Name}`
            : `BC fan-out sync failed: ${context.Schedule.Name}`;
        const durationMs = typeof d?.Duration === 'number' ? d.Duration : undefined;
        const durationStr = durationMs != null ? `${(durationMs / 1000).toFixed(1)}s` : 'N/A';
        const body = [
            `Scheduled Business Central fan-out sync "${context.Schedule.Name}" ${result.Success ? 'completed' : 'failed'}.`,
            '',
            `Company Integrations: ${d?.CompanyIntegrationCount ?? 'N/A'} (synced ${d?.SyncedCount ?? 0}, skipped ${d?.SkippedCount ?? 0}, errored ${d?.ErroredCount ?? 0})`,
            `Records Processed: ${d?.RecordsProcessed ?? 'N/A'} (created ${d?.RecordsCreated ?? 0}, updated ${d?.RecordsUpdated ?? 0}, errors ${d?.RecordsErrored ?? 0})`,
            `Duration: ${durationStr}`,
            ...(result.Success ? [] : ['', `Error: ${result.ErrorMessage ?? 'Unknown error'}`]),
        ].join('\n');
        return {
            Subject: subject,
            Body: body,
            Priority: result.Success ? 'Normal' : 'High',
            Metadata: { ScheduleID: context.Schedule.ID, JobType: BC_FANOUT_SYNC_DRIVER_CLASS, IntegrationID: d?.IntegrationID },
        };
    }
}

/** Tree-shaking anchor: call from the server bootstrap so the @RegisterClass side effect survives. */
export function LoadBizAppsAccountingBCFanOutSyncDriver(): void {
    // The @RegisterClass decorator above performs the registration; this keeps the class in the bundle.
}
