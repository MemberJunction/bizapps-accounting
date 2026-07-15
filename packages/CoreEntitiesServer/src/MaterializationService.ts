/**
 * MaterializationService — DATE-driven scheduled-JE materialization (B3.2, MOD-11).
 *
 * `materializeDueScheduledEntries(asOf)` turns every still-Scheduled ScheduledJournalEntry whose
 * recognition date ≤ asOf into a real Pending JournalEntry, then flips the SJE to Generated (stamping
 * GeneratedJournalEntryID + GeneratedAt) — each SJE ATOMICALLY (the JE write + the SJE flip commit in
 * ONE TransactionGroup, so a partial can't create a duplicate). Idempotent: only Scheduled rows are
 * processed, so a re-run does nothing new. Batches then pick the materialized JEs up by their date
 * window like any other Pending entry — NO period-close coupling (periods are removed, MOD-1).
 *
 * Reverses the AM-6 "materializer retired" note per MOD-11 (2026-07-13, Robert + Marcelo): recognition
 * fires BY DATE, not by period close. The trigger is a daily MJ Scheduled Action + a manual admin
 * "materialize due through <date>" override (both call this).
 *
 * CONNECTS TO:
 *   ENGINE:  AccountingEngine.QueueJournalEntries (atomic JE write onto the caller's TG)
 *   SERVICE: ScheduledJournalEntryService.mapScheduledEntryType
 *   ENTITY:  Scheduled Journal Entries (+ Line Items) → Journal Entries
 */
import { IMetadataProvider, LogError, RunView, UserInfo } from '@memberjunction/core';
import type { JournalEntryDraft, JournalEntryLineDraft } from '@mj-biz-apps/accounting-engine-base';
import type { mjBizAppsAccountingScheduledJournalEntryEntity } from '@mj-biz-apps/accounting-entities';
import { AccountingEngine } from './AccountingEngine.js';
import { mapScheduledEntryType } from './ScheduledJournalEntryService.js';

const SJE_ENTITY = 'MJ_BizApps_Accounting: Scheduled Journal Entries';
const SJELI_ENTITY = 'MJ_BizApps_Accounting: Scheduled Journal Entry Line Items';

export interface MaterializeResult {
  Materialized: number;
  JournalEntryIDs: string[];
  Failures: Array<{ ScheduledJournalEntryID: string; Reason: string }>;
}

/** Materialize every Scheduled SJE due on/before `asOf`. Idempotent; each SJE is atomic. */
export async function materializeDueScheduledEntries(
  asOf: Date,
  contextUser: UserInfo,
  provider: IMetadataProvider,
): Promise<MaterializeResult> {
  const due = await loadDueScheduledEntries(asOf, contextUser);
  const result: MaterializeResult = { Materialized: 0, JournalEntryIDs: [], Failures: [] };
  for (const sjeId of due) {
    const outcome = await materializeOne(sjeId, contextUser, provider);
    if (outcome.ok && outcome.journalEntryID) {
      result.Materialized += 1;
      result.JournalEntryIDs.push(outcome.journalEntryID);
    } else {
      result.Failures.push({ ScheduledJournalEntryID: sjeId, Reason: outcome.reason ?? 'unknown' });
    }
  }
  return result;
}

/** Still-Scheduled SJE ids with a recognition date on/before asOf, oldest-first. */
async function loadDueScheduledEntries(asOf: Date, contextUser: UserInfo): Promise<string[]> {
  const res = await new RunView().RunView<{ ID: string }>(
    {
      EntityName: SJE_ENTITY,
      ExtraFilter: `Status='Scheduled' AND ScheduledEffectiveDate <= '${asOf.toISOString()}'`,
      OrderBy: 'ScheduledEffectiveDate ASC, ScheduleSequence ASC',
      Fields: ['ID'],
      ResultType: 'simple',
      BypassCache: true,
    },
    contextUser,
  );
  return res.Success ? (res.Results ?? []).map(r => r.ID) : [];
}

interface MaterializeOne {
  ok: boolean;
  journalEntryID?: string;
  reason?: string;
}

/** Create the Pending JE + flip the SJE to Generated in ONE TransactionGroup. */
async function materializeOne(sjeId: string, contextUser: UserInfo, provider: IMetadataProvider): Promise<MaterializeOne> {
  const sje = await provider.GetEntityObject<mjBizAppsAccountingScheduledJournalEntryEntity>(SJE_ENTITY, contextUser);
  if (!(await sje.Load(sjeId))) return { ok: false, reason: 'SJE not found' };
  if (sje.Status !== 'Scheduled') return { ok: false, reason: `SJE is ${sje.Status}, not Scheduled (skipped)` };

  const lines = await loadScheduledLines(sjeId, contextUser);
  if (lines.length === 0) return { ok: false, reason: 'SJE has no line items' };
  const draft: JournalEntryDraft = {
    EffectiveDate: new Date(sje.ScheduledEffectiveDate).toISOString().slice(0, 10),
    EntryType: mapScheduledEntryType(sje.EntryType),
    OrderID: sje.OrderID ?? undefined,
    Description: sje.Description ?? `Scheduled ${sje.EntryType} ${sje.ScheduleSequence}/${sje.ScheduleCount}`,
    Lines: lines,
  };

  const tg = await provider.CreateTransactionGroup();
  const q = await AccountingEngine.Instance.QueueJournalEntries({ Drafts: [draft] }, tg, contextUser, provider);
  if (!q.Success || (q.Queued ?? []).length !== 1) {
    return { ok: false, reason: (q.Errors ?? []).map(e => e.Message).join('; ') || 'JE queue failed' };
  }
  const jeId = q.Queued![0].JournalEntryID;
  sje.Status = 'Generated';
  sje.GeneratedJournalEntryID = jeId;
  sje.GeneratedAt = new Date();
  sje.TransactionGroup = tg;
  if (!(await sje.Save())) return { ok: false, reason: `SJE flip failed to queue: ${sje.LatestResult?.CompleteMessage ?? 'unknown'}` };
  if (!(await tg.Submit())) {
    LogError(`materializeOne(${sjeId}): unit of work rolled back: ${sje.LatestResult?.CompleteMessage ?? 'unknown'}`);
    return { ok: false, reason: 'atomic materialization rolled back' };
  }
  return { ok: true, journalEntryID: jeId };
}

/** The SJE's Dr/Cr line items as JE draft lines. */
async function loadScheduledLines(sjeId: string, contextUser: UserInfo): Promise<JournalEntryLineDraft[]> {
  const res = await new RunView().RunView<{ GLAccountID: string; DebitAmount: number | null; CreditAmount: number | null }>(
    { EntityName: SJELI_ENTITY, ExtraFilter: `ScheduledJournalEntryID='${sjeId}'`, OrderBy: 'LineNumber ASC', Fields: ['GLAccountID', 'DebitAmount', 'CreditAmount'], ResultType: 'simple', BypassCache: true },
    contextUser,
  );
  return (res.Results ?? []).map(l => ({
    GLAccountID: l.GLAccountID,
    ...(l.DebitAmount != null && l.DebitAmount !== 0 ? { DebitAmount: Number(l.DebitAmount) } : { CreditAmount: Number(l.CreditAmount) }),
  }));
}
