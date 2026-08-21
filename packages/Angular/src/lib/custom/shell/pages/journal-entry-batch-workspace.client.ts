import { IRemoteOperationProvider, LogError } from '@memberjunction/core';

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
  /** `datetime-local` value (LOCAL time, as typed). Converted to a UTC instant on the wire. */
  Cutoff: string | null;
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
  TotalDebits: number;
  TotalCredits: number;
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
   * A `datetime-local` string is LOCAL wall-clock with no zone. `new Date(local)` interprets it in
   * the browser's zone — which is exactly right here: the operator means "5pm my time". The engine
   * then compares a real UTC instant.
   */
  private toInstant(local: string | null): string | null {
    if (!local) return null;
    const d = new Date(local);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  public async Preview(
    provider: IRemoteOperationProvider,
    criteria: JournalEntryBatchCriteria,
    includedIds: string[] | null,
    entryTypes: string[] | null,
  ): Promise<BatchPreview> {
    const res = await provider.RouteOperation<Record<string, unknown>, BatchPreview>('Accounting.PreviewJournalEntryBatch', {
      Cutoff: this.toInstant(criteria.Cutoff),
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
