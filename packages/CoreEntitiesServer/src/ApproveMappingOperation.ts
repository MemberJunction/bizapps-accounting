/**
 * ApproveMappingOperation — `Accounting.ApproveChartOfAccountsMapping` (§8.3 ERP mapping screen).
 *
 * The ERP-mapping screen's Approve verb MUST come through the engine, not a direct entity save.
 * `approveMapping()` is not a field stamp: it enforces the **strict 1:1** rule by superseding any
 * prior approved+effective mapping for the same (company × GL account × external system). A UI that
 * merely set `ApprovedByUserID` would skip that and leave TWO approved mappings live — which
 * `resolveExternalAccount` would then pick between arbitrarily, silently sending batches to the
 * wrong ERP account.
 *
 * Code-only Remote Operation, per the app's established pattern (Accounting.CreateJournalEntry etc.)
 * and Marcelo's direction to route processing through remotable operations + engines.
 *
 * CONNECTS TO:
 *   ENGINE: ./ChartOfAccountsMappingService (approveMapping — supersede semantics live there)
 */
import { BaseRemotableOperation, IMetadataProvider, UserInfo } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import { approveMapping, type ApproveMappingResult } from './ChartOfAccountsMappingService.js';

export interface ApproveMappingInput {
  /** The ChartOfAccountsMapping to approve. */
  MappingID: string;
}

/** Reports what was superseded, so the UI can say so rather than silently swapping a mapping. */
export interface ApproveMappingOperationResult extends ApproveMappingResult {
  Success: true;
}

@RegisterClass(BaseRemotableOperation, 'Accounting.ApproveChartOfAccountsMapping')
export class ApproveMappingOperation extends BaseRemotableOperation<ApproveMappingInput, ApproveMappingOperationResult> {
  public readonly OperationKey = 'Accounting.ApproveChartOfAccountsMapping';

  protected async InternalExecute(
    input: ApproveMappingInput,
    _provider: IMetadataProvider,
    user: UserInfo,
  ): Promise<ApproveMappingOperationResult> {
    if (!input?.MappingID) throw new Error('ApproveChartOfAccountsMapping: MappingID is required.');
    // The approver is the AUTHENTICATED user — never a client-supplied id. This is an approval:
    // letting the caller name the approver would make the audit trail forgeable.
    const result = await approveMapping(input.MappingID, user.ID, user);
    return { ...result, Success: true };
  }
}

/** Tree-shaking anchor — called from the server bootstrap so `@RegisterClass` is retained. */
export function LoadApproveMappingOperation(): void {
  // intentionally empty
}
