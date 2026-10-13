import { RunView, UserInfo } from '@memberjunction/core';
import { NormalizeUUID, UUIDsEqual } from '@memberjunction/global';
import { mjBizAppsAccountingJournalEntryBatchEntity } from '@mj-biz-apps/accounting-entities';

const COMPANY_PROFILE_ENTITY = 'MJ_BizApps_Accounting: Accounting Company Profiles';

/** The batch fields the Pending-cancel rule reads. */
export type PendingCancelBatch = Pick<mjBizAppsAccountingJournalEntryBatchEntity, 'Status' | 'CompanyID' | 'BatchedByUserID'>;

/** Each company's configured approver (`AccountingCompanyProfile.ApprovalCFOUserID`), keyed by normalized company ID. */
export type CompanyApprovers = ReadonlyMap<string, string>;

/**
 * Read every company's configured approver, for {@link MayCancelPendingBatch}. A failed read answers
 * an empty map: the Cancel button then shows only to a batch's builder, and the server still decides.
 */
export async function LoadCompanyApprovers(rv: RunView, contextUser?: UserInfo): Promise<CompanyApprovers> {
  const res = await rv.RunView<{ ID: string; ApprovalCFOUserID: string | null }>(
    { EntityName: COMPANY_PROFILE_ENTITY, Fields: ['ID', 'ApprovalCFOUserID'], ResultType: 'simple' },
    contextUser,
  );
  const approvers = new Map<string, string>();
  if (!res.Success) return approvers;
  for (const p of res.Results ?? []) {
    if (p.ApprovalCFOUserID) approvers.set(NormalizeUUID(p.ID), p.ApprovalCFOUserID);
  }
  return approvers;
}

/**
 * Whether the server would let this user cancel a Pending batch (golive #302, #308): the company's
 * configured approver, or the user who built the batch. A batch the nightly job built carries the
 * system user as its builder, and no signed-in user is the system user, so only the approver matches
 * it. The server check stays the authority; this only decides whether the Cancel button shows.
 */
export function MayCancelPendingBatch(batch: PendingCancelBatch, userId: string | undefined, approvers: CompanyApprovers): boolean {
  if (!userId) return false;
  const approver = batch.CompanyID ? approvers.get(NormalizeUUID(batch.CompanyID)) : undefined;
  return [approver, batch.BatchedByUserID].some(id => !!id && UUIDsEqual(id, userId));
}
