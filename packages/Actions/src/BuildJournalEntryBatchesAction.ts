import { Metadata } from '@memberjunction/core';
import { ActionResultSimple, RunActionParams } from '@memberjunction/actions-base';
import { BaseAction } from '@memberjunction/actions';
import { RegisterClass } from '@memberjunction/global';
import {
  buildJournalEntryBatch,
  pendingCompanies,
  EmptyJournalEntryBatchError,
  TasksAppApprovalGate,
  type JournalEntryBatchTargetSystem,
  type BuildJournalEntryBatchOptions,
} from '@mj-biz-apps/accounting-core-entities-server';

/**
 * Action: Accounting.BuildJournalEntryBatches
 *
 * Builds single-company GL posting batches from pending candidate journal entries.
 * Netted per (Company, GLAccount, Dimensions) and transactionally locked.
 * Can be scheduled daily with ExcludeEntryTypeCodes=['RevenueRecognition'] to batch
 * orders and payments while deferring subscription revenue recognition to month-end.
 */
@RegisterClass(BaseAction, 'Accounting.BuildJournalEntryBatches')
export class BuildJournalEntryBatchesAction extends BaseAction {
  protected async InternalRunAction(params: RunActionParams): Promise<ActionResultSimple> {
    const targetSystem = ((params.Params.find(p => p.Name === 'TargetSystem')?.Value as JournalEntryBatchTargetSystem) || 'BusinessCentral');
    const cutoffRaw = params.Params.find(p => p.Name === 'Cutoff')?.Value as string | undefined;
    const startDateRaw = params.Params.find(p => p.Name === 'StartDate')?.Value as string | undefined;
    const excludeEntryTypeCodes = params.Params.find(p => p.Name === 'ExcludeEntryTypeCodes')?.Value as string[] | undefined;
    const entryTypeCodes = params.Params.find(p => p.Name === 'EntryTypeCodes')?.Value as string[] | undefined;
    const companyIds = params.Params.find(p => p.Name === 'CompanyIDs')?.Value as string[] | undefined;

    const options: BuildJournalEntryBatchOptions = {
      cutoff: cutoffRaw ? new Date(cutoffRaw) : null,
      startDate: startDateRaw ? new Date(startDateRaw) : null,
      companyIds: companyIds && companyIds.length > 0 ? companyIds : null,
      entryTypeCodes: entryTypeCodes && entryTypeCodes.length > 0 ? entryTypeCodes : null,
      excludeEntryTypeCodes: excludeEntryTypeCodes && excludeEntryTypeCodes.length > 0 ? excludeEntryTypeCodes : null,
    };

    const provider = Metadata.Provider;
    if (!provider) {
      throw new Error('Accounting.BuildJournalEntryBatches: Metadata.Provider is not initialized');
    }
    const user = params.ContextUser;
    const gate = new TasksAppApprovalGate(provider);

    const companies = await pendingCompanies(user, provider, options);
    const builtBatches = [];

    for (const companyId of companies) {
      try {
        const batchRes = await buildJournalEntryBatch(companyId, targetSystem, user.ID, user, provider, gate, options);
        builtBatches.push(batchRes);
      } catch (e) {
        if (e instanceof EmptyJournalEntryBatchError) continue;
        throw e;
      }
    }

    const totalDebits = builtBatches.reduce((sum, b) => sum + b.totalDebits, 0);
    const totalCredits = builtBatches.reduce((sum, b) => sum + b.totalCredits, 0);
    const totalEntries = builtBatches.reduce((sum, b) => sum + b.jeCount, 0);

    const resultParam = params.Params.find(p => p.Name === 'Batches');
    if (resultParam) {
      resultParam.Value = JSON.stringify(builtBatches);
    }
    const countParam = params.Params.find(p => p.Name === 'BatchCount');
    if (countParam) {
      countParam.Value = builtBatches.length;
    }

    const message = builtBatches.length > 0
      ? `Successfully built ${builtBatches.length} batch(es) containing ${totalEntries} journal entries (Dr ${totalDebits.toFixed(2)}, Cr ${totalCredits.toFixed(2)}) across ${companies.length} candidate company(ies).`
      : 'No candidate journal entries found to batch.';

    return {
      Success: true,
      Message: message,
      ResultCode: builtBatches.length > 0 ? 'SUCCESS' : 'NO_BATCHES',
    };
  }
}
