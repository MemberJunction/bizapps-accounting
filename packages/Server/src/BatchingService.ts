import { CompositeKey, LogError, Metadata, RunView, UserInfo } from '@memberjunction/core';
import {
    mjBizAppsAccountingJournalEntryEntity,
    mjBizAppsAccountingJournalEntryBatchEntity
} from '@mj-biz-apps/accounting-entities';
import { getNextBatchNumber } from '@mj-biz-apps/accounting-core-entities-server';

/**
 * Service for managing Journal Entry Batches (S1/S2 background actions).
 * 
 * Implements the batching infrastructure (Phase 3) as defined in BA-D12 and BA-D26.
 */
export class BatchingService {
    /**
     * S1: Daily Batching Engine.
     * Finds all 'Pending' JEs and groups them into batches by Company and Period.
     * Transistions JEs from 'Pending' -> 'Batched'.
     */
    public async createDailyBatches(contextUser: UserInfo): Promise<void> {
        const rv = new RunView();
        const md = new Metadata();

        // 1. Find all 'Pending' JEs
        // In production, we would filter for IsBalanced = 1 as well.
        const result = await rv.RunView<mjBizAppsAccountingJournalEntryEntity>({
            EntityName: 'MJ_BizApps_Accounting: Journal Entries',
            ExtraFilter: `Status = 'Pending'`,
            ResultType: 'simple'
        }, contextUser);

        if (!result.Success) {
            LogError(`Daily Batching: Failed to load pending entries: ${result.ErrorMessage}`);
            return;
        }

        if (result.Results.length === 0) {
            console.log('Daily Batching: No pending journal entries found.');
            return;
        }

        // 2. Group by CompanyID + AccountingPeriodID
        const groups = new Map<string, mjBizAppsAccountingJournalEntryEntity[]>();
        for (const je of result.Results) {
            const key = `${je.CompanyID}|${je.AccountingPeriodID}`;
            const group = groups.get(key) || [];
            group.push(je);
            groups.set(key, group);
        }

        console.log(`Daily Batching: Grouping ${result.Results.length} entries into ${groups.size} potential batches.`);

        // 3. Create Batches per group
        for (const [key, jes] of groups) {
            const [companyId, periodId] = key.split('|');

            try {
                const batch = await md.GetEntityObject<mjBizAppsAccountingJournalEntryBatchEntity>(
                    'MJ_BizApps_Accounting: Journal Entry Batches',
                    contextUser
                );
                batch.NewRecord();
                batch.Set('CompanyID', companyId);
                batch.Set('AccountingPeriodID', periodId);
                batch.Set('Status', 'Pending');
                batch.Set('BatchedAt', new Date());
                batch.Set('BatchedByUserID', contextUser.ID);
                batch.Set('TargetSystem', 'Other'); // Default

                // Assign gap-free atomic batch number
                const batchNumber = await getNextBatchNumber(companyId, contextUser);
                batch.Set('BatchNumber', batchNumber);

                const success = await batch.Save();
                if (success) {
                    console.log(`Daily Batching: Created batch ${batchNumber} (${batch.ID})`);

                    // Assign JEs to batch
                    for (const je of jes) {
                        const jeObj = await md.GetEntityObject<mjBizAppsAccountingJournalEntryEntity>(
                            'MJ_BizApps_Accounting: Journal Entries',
                            CompositeKey.FromID(je.ID),
                            contextUser
                        );
                        jeObj.Set('JournalEntryBatchID', batch.ID);
                        jeObj.Set('Status', 'Batched');
                        await jeObj.Save();
                    }
                } else {
                    LogError(`Daily Batching: Failed to save batch for group ${key}`);
                }
            } catch (error: unknown) {
                LogError(`Daily Batching: Error processing group ${key}: ${error}`);
            }
        }
    }

    /**
     * S2: ERP Acknowledgment Poller.
     * Finds batches in 'Sent' status and checks the external system for confirmation.
     */
    public async pollAcknowledgeBatches(contextUser: UserInfo): Promise<void> {
        const rv = new RunView();
        console.log('Acknowledgment Poller: Not yet implemented — logic depends on specific ERP connector (BC, NetSuite, etc.)');

        // Placeholder for future implementation
        // 1. Query batches where Status = 'Sent'
        // 2. For each, call the respective ERP API
        // 3. Update status to 'Acknowledged' or 'Failed'
    }
}
