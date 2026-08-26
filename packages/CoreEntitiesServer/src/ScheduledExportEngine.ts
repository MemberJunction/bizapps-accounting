/**
 * ScheduledExportEngine — unattended journal-entry export.
 *
 * Follows the four-surface doctrine: every rule and every transaction lives HERE, and the caller
 * (an MJ Action driven by ActionScheduledJobDriver) only marshals input. That also means these
 * functions are runnable by hand — which matters, because an unattended, irreversible ledger post
 * is not something to debug through a scheduler.
 *
 * CHANNEL IS THE POINT. Each entry point dispatches under its OWN channel, so the adapter mints a
 * distinct journal per channel (`AIDP_NIGHT`, `AIDP_MONTH`). Business Central's `Microsoft.NAV.post`
 * commits an ENTIRE journal rather than the lines you staged, so two dispatchers sharing one journal
 * means whoever posts first commits the other's half-staged lines. Separate channels is what makes
 * a scheduled run safe to overlap a human's manual dispatch.
 *
 * DELIBERATELY SIMPLE (first pass): dispatch every Approved, not-yet-dispatched batch. Scoping —
 * by company, account, dimension and target ERP — comes in a second pass once the Action is proven
 * to run. Nothing here decides WHAT to batch; batches are built and approved by the existing flow.
 */
import { IMetadataProvider, RunView, UserInfo, LogStatus, LogError } from '@memberjunction/core';
import type { mjBizAppsAccountingJournalEntryBatchEntity } from '@mj-biz-apps/accounting-entities';
import { sendJournalEntryBatch } from './JournalEntryBatchEngine.js';
import { TasksAppApprovalGate } from './TasksAppApprovalGate.js';

/** Channels the scheduled entry points dispatch under. Kept here so job metadata and code agree. */
export const NIGHTLY_CHANNEL = 'NIGHTLY';
export const MONTHLY_CHANNEL = 'MONTHLY';

export interface ScheduledExportOutcome {
  JournalEntryBatchNumber: string;
  JournalEntryBatchID: string;
  Success: boolean;
  Status: string;
  ExternalRef: string | null;
  Error?: string;
}

export interface ScheduledExportResult {
  Channel: string;
  Considered: number;
  Dispatched: number;
  Failed: number;
  Outcomes: ScheduledExportOutcome[];
}

/**
 * Dispatch every Approved batch that has not already been sent, under `channel`.
 *
 * One batch's failure never stops the run: an unattended job that abandons the queue on the first
 * bad batch leaves good work undone until someone notices. Each outcome is recorded and the caller
 * gets the full picture.
 *
 * A batch that already carries an external reference is skipped by the adapter's own already-posted
 * guard, so a re-run cannot double-post.
 */
export async function runScheduledJournalEntryExport(
  channel: string,
  contextUser: UserInfo,
  provider: IMetadataProvider,
): Promise<ScheduledExportResult> {
  const rv = new RunView(provider as unknown as never);
  const found = await rv.RunView<mjBizAppsAccountingJournalEntryBatchEntity>(
    {
      EntityName: 'MJ_BizApps_Accounting: Journal Entry Batches',
      ExtraFilter: `Status='Approved' AND ExternalJournalEntryBatchRef IS NULL`,
      OrderBy: 'JournalEntryBatchNumber',
      ResultType: 'entity_object',
      BypassCache: true,
    },
    contextUser,
  );
  if (!found.Success) {
    throw new Error(`runScheduledJournalEntryExport: could not load Approved batches: ${found.ErrorMessage}`);
  }
  const batches = found.Results ?? [];
  LogStatus(`[ScheduledExport:${channel}] ${batches.length} Approved batch(es) to dispatch`);

  const outcomes: ScheduledExportOutcome[] = [];
  for (const b of batches) {
    try {
      const sent = await sendJournalEntryBatch(b.ID, contextUser, {
        gate: new TasksAppApprovalGate(provider),
        provider,
        channel,
      });
      const ok = sent.Status === 'Posted';
      outcomes.push({
        JournalEntryBatchNumber: b.JournalEntryBatchNumber, JournalEntryBatchID: b.ID,
        Success: ok, Status: sent.Status, ExternalRef: sent.ExternalJournalEntryBatchRef ?? null,
        Error: ok ? undefined : `batch ended in status ${sent.Status}`,
      });
      LogStatus(`[ScheduledExport:${channel}] ${b.JournalEntryBatchNumber} -> ${sent.Status}`);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      outcomes.push({
        JournalEntryBatchNumber: b.JournalEntryBatchNumber, JournalEntryBatchID: b.ID,
        Success: false, Status: 'Error', ExternalRef: null, Error: message,
      });
      // Log and continue: one unusable batch must not strand the rest of the queue.
      LogError(`[ScheduledExport:${channel}] ${b.JournalEntryBatchNumber} FAILED: ${message}`);
    }
  }
  const dispatched = outcomes.filter((o) => o.Success).length;
  return {
    Channel: channel, Considered: batches.length,
    Dispatched: dispatched, Failed: outcomes.length - dispatched, Outcomes: outcomes,
  };
}

/** Nightly export — orders and payments. Posts into the `AIDP_NIGHT` journal. */
export async function runNightlyJournalEntryExport(
  contextUser: UserInfo, provider: IMetadataProvider,
): Promise<ScheduledExportResult> {
  return runScheduledJournalEntryExport(NIGHTLY_CHANNEL, contextUser, provider);
}

/** Monthly export — subscriptions. Posts into the `AIDP_MONTH` journal. */
export async function runMonthlyJournalEntryExport(
  contextUser: UserInfo, provider: IMetadataProvider,
): Promise<ScheduledExportResult> {
  return runScheduledJournalEntryExport(MONTHLY_CHANNEL, contextUser, provider);
}
