/**
 * Scheduled journal-entry export Actions.
 *
 * Thin by the four-surface doctrine: marshal, call the engine, shape the result. Every rule lives in
 * ScheduledExportEngine, so these are also the manual "run it now" surface — the same body a
 * scheduled job runs can be invoked by a human, which is how an unattended irreversible post gets
 * tested and re-run without a scheduler.
 *
 * Wired to the scheduler by a ScheduledJob row pointing at ScheduledJobType 'Action'
 * (ActionScheduledJobDriver). See metadata/scheduled-jobs.
 */
import { BaseAction } from '@memberjunction/actions';
import { ActionResultSimple, RunActionParams } from '@memberjunction/actions-base';
import { RegisterClass } from '@memberjunction/global';
import { Metadata } from '@memberjunction/core';
import {
  runNightlyJournalEntryExport, runMonthlyJournalEntryExport, type ScheduledExportResult,
} from '@mj-biz-apps/accounting-core-entities-server';

/** Shared shaping so both actions report identically. */
function toResult(result: ScheduledExportResult): ActionResultSimple {
  const failed = result.Failed > 0;
  return {
    // A run that dispatched nothing is a SUCCESS with zero work, not a failure — an empty queue is
    // the normal overnight case. Only an actual dispatch failure is unsuccessful.
    Success: !failed,
    ResultCode: failed ? 'PARTIAL_FAILURE' : 'SUCCESS',
    Message: `[${result.Channel}] considered ${result.Considered}, dispatched ${result.Dispatched}, failed ${result.Failed}`
      + (failed ? `: ${result.Outcomes.filter((o) => !o.Success).map((o) => `${o.JournalEntryBatchNumber} (${o.Error})`).join('; ')}` : ''),
    Params: [{ Name: 'Result', Type: 'Output', Value: JSON.stringify(result) }],
  };
}

@RegisterClass(BaseAction, 'Accounting.RunNightlyJournalEntryExport')
export class RunNightlyJournalEntryExportAction extends BaseAction {
  protected async InternalRunAction(params: RunActionParams): Promise<ActionResultSimple> {
    return toResult(await runNightlyJournalEntryExport(params.ContextUser, Metadata.Provider));
  }
}

@RegisterClass(BaseAction, 'Accounting.RunMonthlyJournalEntryExport')
export class RunMonthlyJournalEntryExportAction extends BaseAction {
  protected async InternalRunAction(params: RunActionParams): Promise<ActionResultSimple> {
    return toResult(await runMonthlyJournalEntryExport(params.ContextUser, Metadata.Provider));
  }
}
