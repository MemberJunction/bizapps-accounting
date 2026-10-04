import { IRemoteOperationProvider, LogError } from '@memberjunction/core';
import { IsCalendarDay } from '@mj-biz-apps/common-entities';

/**
 * Thin typed client for the batch Remote Operations (§8.2).
 *
 * Deliberately NOT a hand-written GraphQL client: `Accounting.PreviewJournalEntryBatch` / `Accounting.BuildJournalEntryBatch`
 * are Remote Operations, so `provider.RouteOperation(key, input)` marshals them over the generic
 * ExecuteRemoteOperation mutation for us. This file exists only to give the component typed inputs
 * and to turn a failed RemoteOpResult into a thrown Error (the component's error path), rather than
 * to hand-roll transport.
 *
 * Takes `IRemoteOperationProvider` (not `IMetadataProvider`): RouteOperation lives on that
 * interface, which every ProviderBase — i.e. every resolved provider — implements. See the
 * RemoteOpInvokeOptions docs: "The resolved provider also implements IRemoteOperationProvider (it
 * is a ProviderBase)."
 */

export type JournalEntryBatchTargetSystem = 'BusinessCentral' | 'NetSuite' | 'Other' | 'QuickBooks' | 'Sage' | 'Xero';

/** The mockup's 3-way entry-type control (NOT the entity's 16-value EntryType union). */
export type EntryTypeScope = 'All' | 'System' | 'Manual';

/** The §8.2 criteria panel's state. */
export interface JournalEntryBatchCriteria {
  /** A calendar day (`YYYY-MM-DD`, from a date input), INCLUSIVE. EffectiveDate is a DATE column,
   *  so the cutoff is a day, not an instant (golive #168). */
  Cutoff: string | null;
  /** The batch's posting date (`YYYY-MM-DD`) — the journal date the ERP receives (golive #315).
   *  Defaults to the business day; it also ends the candidate pool, like a cutoff. */
  PostingDate: string | null;
  CompanyIDs: string[];
  EntryTypeScope: EntryTypeScope;
  Source: 'Standard' | 'View';
  ViewID: string | null;
  TargetSystem: JournalEntryBatchTargetSystem;
}

export interface BatchPreviewEntry {
  ID: string;
  EntryNumber: string;
  EffectiveDate: string;
  /** The JournalEntryType CODE (issue #24 lookup vocabulary). */
  EntryTypeCode: string;
  CompanyID: string;
  Description: string | null;
  Amount: number;
}

export interface AffectedAccount {
  GLAccountID: string;
  Code: string;
  Name: string;
  CompanyIDs: string[];
  Debit: number;
  Credit: number;
}

export interface BatchPreview {
  Candidates: BatchPreviewEntry[];
  AffectedAccounts: AffectedAccount[];
  /** Netted — what the batch will carry. */
  TotalDebits: number;
  TotalCredits: number;
  /** Before netting — every line of every included entry. */
  GrossDebits: number;
  GrossCredits: number;
  PerCompany: Array<{ CompanyID: string; Debit: number; Credit: number }>;
  OutOfOrderSkipCount: number;
}

export interface BuildOutcome {
  /** One id per batch built — the explicit selection can span companies (one batch each, D7). */
  JournalEntryBatchIDs: string[];
  /** True when every built batch carries its stamped approval task (one-transaction build). */
  ApprovalTaskRaised: boolean;
}

export class JournalEntryBatchWorkspaceClient {
  /**
   * The cutoff and posting date go on the wire as the calendar day itself. The engine reads a
   * `YYYY-MM-DD` string as that day — no browser zone is involved at any step. An empty cutoff sends
   * no cutoff at all, so the pool runs through the posting date; an empty posting date is today.
   */
  private toWireDay(day: string | null): string | null {
    return day && IsCalendarDay(day) ? day : null;
  }

  public async Preview(
    provider: IRemoteOperationProvider,
    criteria: JournalEntryBatchCriteria,
    includedIds: string[] | null,
    entryTypes: string[] | null,
  ): Promise<BatchPreview> {
    const res = await provider.RouteOperation<Record<string, unknown>, BatchPreview>('Accounting.PreviewJournalEntryBatch', {
      Cutoff: this.toWireDay(criteria.Cutoff),
      PostingDate: this.toWireDay(criteria.PostingDate),
      CompanyIDs: criteria.CompanyIDs.length ? criteria.CompanyIDs : null,
      EntryTypeCodes: entryTypes,
      IncludedJournalEntryIDs: includedIds,
    });
    if (!res.Success || !res.Output) {
      const msg = res.ErrorMessage ?? 'Preview failed.';
      LogError(`JournalEntryBatchWorkspaceClient.Preview: ${msg}`);
      throw new Error(msg);
    }
    return res.Output;
  }

  public async Build(provider: IRemoteOperationProvider, criteria: JournalEntryBatchCriteria, includedIds: string[]): Promise<BuildOutcome> {
    const res = await provider.RouteOperation<Record<string, unknown>, BuildBatchOpOutput>(
      'Accounting.BuildJournalEntryBatch',
      {
        TargetSystem: criteria.TargetSystem,
        // Always Explicit from the workspace: the operator SAW a list and ticked it, so the build must
        // be exactly that list — not a re-sweep. Cutoff/CompanyIDs are DELIBERATELY omitted: the
        // Explicit path batches exactly these ids, so those two fields were dead payload the server
        // discards (Marcelo #4, 2026-07-21). Empty / zero-net selections now throw server-side
        // (EmptyBatchError) and surface as res.Success=false — never a silent NothingToBatch.
        Source: 'Explicit',
        JournalEntryIDs: includedIds,
        // The posting date is NOT dead payload: it is the date the batch carries to the ERP. The
        // server refuses it when it is earlier than any of these entries.
        PostingDate: this.toWireDay(criteria.PostingDate),
      },
    );
    if (!res.Success || !res.Output) {
      const msg = res.ErrorMessage ?? 'Build failed.';
      LogError(`JournalEntryBatchWorkspaceClient.Build: ${msg}`);
      throw new Error(msg);
    }
    const o = res.Output;
    const batches = o.Batches ?? [];
    return {
      JournalEntryBatchIDs: batches.map(b => b.batchId),
      ApprovalTaskRaised: batches.length > 0 && batches.every(b => !!b.approvalTaskId),
    };
  }
}

/** The `Accounting.BuildJournalEntryBatch` output: one engine BuildJournalEntryBatchResult per company batch built (D7). */
interface BuildBatchOpOutput {
  Batches: Array<{
    batchId: string;
    summaryLineCount: number;
    totalDebits: number;
    totalCredits: number;
    jeCount: number;
    approvalTaskId: string | null;
  }>;
  NothingToBatch: boolean;
}
