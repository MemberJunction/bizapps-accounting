/**
 * ManualJournalEntryOperations — the decision on a manual journal entry's approval (golive #353),
 * as a code-only Remote Operation, in the same shape as Accounting.RecordJournalEntryBatchDecision.
 *
 *   Accounting.RecordManualJournalEntryDecision → ManualJournalEntryApprovalService.RecordDecision
 *     Approve: stamps ApprovedAt / ApprovedByUserID, so the entry becomes a batch candidate.
 *     Reject:  records the rejection (a reason is required) and closes the approval Task; the entry
 *              stays out of every batch until its content changes, which raises a new approval.
 *
 * Thin by design: who may decide (never the requester; CFO-level entries only the Approval CFO;
 * Standard entries a holder of the approver role or the Approval CFO) and the one-transaction
 * decision + stamp live in ManualJournalEntryApproval.ts and are tested there.
 *
 * CONNECTS TO:
 *   SERVICE: ./ManualJournalEntryApproval (ManualJournalEntryApprovalService)
 *   BOOT:    LoadManualJournalEntryOperations, called from @mj-biz-apps/accounting-server
 */
import { BaseRemotableOperation, IMetadataProvider, UserInfo } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import {
  IsApprovalOutcome,
  IsTaskDecisionOutcomeCode,
  TaskDecisionOutcomeCodes,
  type TaskDecisionOutcomeCode,
} from '@mj-biz-apps/tasks-core';

import { ManualJournalEntryApprovalService } from './ManualJournalEntryApproval.js';
import { requireSqlGuid } from './SqlGuards.js';

export interface RecordManualJournalEntryDecisionInput {
  JournalEntryID: string;
  /** A tasks-core decision outcome code: Approved, ApprovedWithConditions or Rejected. */
  Decision: TaskDecisionOutcomeCode;
  /** Required for a rejection, so whoever raised the entry knows what to fix. */
  Notes?: string | null;
}

export interface RecordManualJournalEntryDecisionOutput {
  Approved: boolean;
  /** ISO timestamp of the approval; null for a rejection. */
  ApprovedAt: string | null;
}

@RegisterClass(BaseRemotableOperation, 'Accounting.RecordManualJournalEntryDecision')
export class RecordManualJournalEntryDecisionOperation extends BaseRemotableOperation<RecordManualJournalEntryDecisionInput, RecordManualJournalEntryDecisionOutput> {
  public readonly OperationKey = 'Accounting.RecordManualJournalEntryDecision';

  protected async InternalExecute(input: RecordManualJournalEntryDecisionInput, provider: IMetadataProvider, user: UserInfo): Promise<RecordManualJournalEntryDecisionOutput> {
    if (!input?.JournalEntryID) throw new Error('The decision was not recorded: no journal entry was given.');
    // Boundary validation: the id reaches SQL predicates — a UUID or nothing.
    requireSqlGuid(input.JournalEntryID, 'RecordManualJournalEntryDecision');
    if (!IsTaskDecisionOutcomeCode(input.Decision)) {
      throw new Error(`The decision was not recorded: '${String(input.Decision)}' is not a valid decision. Use one of: ${TaskDecisionOutcomeCodes.join(', ')}.`);
    }
    if (!IsApprovalOutcome(input.Decision) && !input.Notes?.trim()) {
      throw new Error('The decision was not recorded: a rejection needs a reason, so whoever raised the entry knows what to change.');
    }
    const result = await new ManualJournalEntryApprovalService(provider).RecordDecision(
      input.JournalEntryID, input.Decision, input.Notes ?? undefined, user,
    );
    return { Approved: result.Approved, ApprovedAt: result.ApprovedAt ? result.ApprovedAt.toISOString() : null };
  }
}

/**
 * Tree-shaking anchor — called from the app's server bootstrap so the `@RegisterClass`
 * registration is retained and the operation stays resolvable by key.
 */
export function LoadManualJournalEntryOperations(): void {
  // intentionally empty
}
