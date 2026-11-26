import { IMetadataProvider, Metadata, RunView, UserInfo } from '@memberjunction/core';
import { NormalizeUUID, UUIDsEqual } from '@memberjunction/global';
import { AccountingEngineBase } from '@mj-biz-apps/accounting-engine-base';
import { mjBizAppsAccountingJournalEntryBatchEntity } from '@mj-biz-apps/accounting-entities';

const COMPANY_PROFILE_ENTITY = 'MJ_BizApps_Accounting: Accounting Company Profiles';

/** The batch fields the Pending-cancel rule reads. */
export type PendingCancelBatch = Pick<mjBizAppsAccountingJournalEntryBatchEntity, 'Status' | 'CompanyID' | 'BatchedByUserID'>;

/** The batch fields the decision rule reads. */
export type DecisionBatch = Pick<mjBizAppsAccountingJournalEntryBatchEntity, 'CompanyID' | 'BatchedByUserID'>;

/** The batch fields the post-approval cancel rule reads. */
export type ApprovedCancelBatch = Pick<mjBizAppsAccountingJournalEntryBatchEntity, 'CompanyID' | 'ApprovedByUserID'>;

/** The batch fields the archive rule reads. */
export type ArchiveBatch = PendingCancelBatch & ApprovedCancelBatch;

/** Each company's configured approver (`AccountingCompanyProfile.ApprovalCFOUserID`), keyed by normalized company ID. */
export type CompanyApprovers = ReadonlyMap<string, string>;

/** Build a `CompanyApprovers` lookup map from any profile collection (cached engine or RunView rows). */
export function CompanyApproversFromProfiles(
  profiles: ReadonlyArray<{ ID: string; ApprovalCFOUserID: string | null }>,
): CompanyApprovers {
  const approvers = new Map<string, string>();
  for (const p of profiles) {
    if (p.ApprovalCFOUserID) approvers.set(NormalizeUUID(p.ID), p.ApprovalCFOUserID);
  }
  return approvers;
}

/**
 * Read every company's configured approver from the shared `AccountingEngineBase` reference cache
 * (zero per-page RunView). Fails closed to an empty map on permission or load failure so buttons
 * gated on approver status stay hidden while the server remains the authority.
 */
export async function LoadCompanyApproversFromEngine(
  provider?: IMetadataProvider,
  contextUser?: UserInfo,
): Promise<CompanyApprovers> {
  try {
    const md = provider ?? Metadata.Provider;
    await AccountingEngineBase.Instance.Config(false, contextUser ?? md?.CurrentUser, md);
    return CompanyApproversFromProfiles(AccountingEngineBase.Instance.CompanyProfiles);
  } catch {
    return new Map<string, string>();
  }
}

/**
 * Read every company's configured approver, for the rules below. A failed read answers an empty
 * map: no user then counts as the approver, so the buttons only the approver may use stay hidden,
 * and the server still decides.
 */
export async function LoadCompanyApprovers(rv: RunView, contextUser?: UserInfo): Promise<CompanyApprovers> {
  const res = await rv.RunView<{ ID: string; ApprovalCFOUserID: string | null }>(
    { EntityName: COMPANY_PROFILE_ENTITY, Fields: ['ID', 'ApprovalCFOUserID'], ResultType: 'simple' },
    contextUser,
  );
  if (!res.Success) return new Map<string, string>();
  return CompanyApproversFromProfiles(res.Results ?? []);
}

/** The batch company's configured approver, or undefined when none is configured or the read failed. */
function approverOf(companyId: string | null, approvers: CompanyApprovers): string | undefined {
  return companyId ? approvers.get(NormalizeUUID(companyId)) : undefined;
}

/** Whether `userId` is one of `allowed`, skipping the IDs that are not set. */
function isOneOf(userId: string | undefined, allowed: ReadonlyArray<string | null | undefined>): boolean {
  if (!userId) return false;
  return allowed.some(id => !!id && UUIDsEqual(id, userId));
}

/**
 * Whether the server would let this user cancel a Pending batch (golive #302, #308): the company's
 * configured approver, or the user who built the batch. A batch the nightly job built carries the
 * system user as its builder, and no signed-in user is the system user, so only the approver matches
 * it. The server check stays the authority; this only decides whether the Cancel button shows.
 */
export function MayCancelPendingBatch(batch: PendingCancelBatch, userId: string | undefined, approvers: CompanyApprovers): boolean {
  return isOneOf(userId, [approverOf(batch.CompanyID, approvers), batch.BatchedByUserID]);
}

/**
 * Whether the server would record this user's Approve or Reject on a Pending batch (#339): the
 * company's configured approver. Separation of duties refuses the user who built the batch, with one
 * deliberate exception (golive #450): the company's approver may decide on a batch they built, since
 * they are its only approver and a batch they built could otherwise never be approved. This mirrors
 * the server's IsRefusedSelfApproval, which stays the authority; this only decides whether the
 * buttons show.
 */
export function MayDecideBatch(batch: DecisionBatch, userId: string | undefined, approvers: CompanyApprovers): boolean {
  const approver = approverOf(batch.CompanyID, approvers);
  if (!isOneOf(userId, [approver])) return false;
  return !isRefusedSelfApproval(userId, batch.BatchedByUserID, approver);
}

/** The builder-is-not-approver rule and its approver exception (golive #450), as the server applies it. */
function isRefusedSelfApproval(userId: string | undefined, builderUserId: string | null, approver: string | undefined): boolean {
  if (!isOneOf(userId, [builderUserId])) return false;
  return !isOneOf(userId, [approver]);
}

/**
 * Whether the server would let this user cancel an Approved or Failed batch (#183, #339): the
 * company's configured approver, or the user who approved the batch. The server check stays the
 * authority; this only decides whether the Cancel button shows.
 */
export function MayCancelApprovedBatch(batch: ApprovedCancelBatch, userId: string | undefined, approvers: CompanyApprovers): boolean {
  return isOneOf(userId, [approverOf(batch.CompanyID, approvers), batch.ApprovedByUserID]);
}

/** The batch fields the ERP-accepted rule reads. */
export type ErpAcceptedBatch = Pick<mjBizAppsAccountingJournalEntryBatchEntity, 'Status' | 'ExternalJournalEntryBatchRef'>;

/**
 * Whether a Failed batch carries the ERP's reference (#412, #413): the ERP accepted it and only
 * recording it Posted failed. The server refuses Cancel and Archive on it, since both would leave
 * the books disagreeing with the ERP; a retry records it Posted. Screens hide both for it.
 */
export function IsErpAcceptedFailedBatch(batch: ErpAcceptedBatch): boolean {
  return batch.Status === 'Failed' && !!batch.ExternalJournalEntryBatchRef;
}

/**
 * Whether the server would let this user archive the batch (#448, golive #325): on a Pending batch
 * the company's approver or a holder of the batch-operator Authorization (the Finance role; a
 * builder without it may cancel the batch, not archive it); past approval the company's approver or
 * the user who approved it. The server check stays the authority; this only decides whether the
 * Archive button shows.
 */
export function MayArchiveBatch(
  batch: ArchiveBatch,
  userId: string | undefined,
  approvers: CompanyApprovers,
  mayOperateBatches = false,
): boolean {
  if (!userId) return false;
  return batch.Status === 'Pending'
    ? Boolean(mayOperateBatches) || isOneOf(userId, [approverOf(batch.CompanyID, approvers)])
    : MayCancelApprovedBatch(batch, userId, approvers);
}
