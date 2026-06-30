/**
 * ChartOfAccountsMappingService — Block 5 (server-side COA-mapping approval workflow).
 *
 * A ChartOfAccountsMapping translates a local GLAccount → an external ERP account (§5.5). It is only honored
 * by the batching engine's `resolveExternalAccount` once **approved** (ApprovedByUserID set). This service is
 * the approval lifecycle:
 *   proposeMapping(): record an UNapproved mapping (ApprovedByUserID/ApprovedAt null — the DB
 *     CK_COAMapping_ApprovalCoherence enforces both-or-neither, so a proposal is invisible to resolution).
 *   approveMapping(): stamp the approver + timestamp; **strict 1:1** — supersede any prior approved+effective
 *     mapping for the same (Company × ExternalSystem × InternalGLAccount) by closing its EffectiveTo, so a
 *     local account never resolves to two ERP accounts at once. Idempotent (re-approving is a no-op).
 *
 * Division of labor (P2): the DB CHECK constraint is the un-bypassable floor (approval coherence + date range);
 * this service orchestrates the *workflow* (propose/approve/supersede) that the floor can't express.
 *
 * NOTE — dimension-through-batch (the other Block-5 server concern) is delivered + live-proven in the Block-2
 * batching engine: `netLines` groups by GLAccount × dimension-combo and `buildBatch` writes a
 * JournalEntryBatchLineDimension per summary line (see block2-runtime.ts "dimension-through-batch").
 *
 * CONNECTS TO:
 *   READS/WRITES: Chart Of Accounts Mappings · consumed by BatchingEngine.resolveExternalAccount (§5.5)
 *   CHECK:        CK_COAMapping_ApprovalCoherence (approved-both-or-neither) · CK_COAMapping_DateRange
 *   ENTITY:       'MJ_BizApps_Accounting: Chart Of Accounts Mappings'
 *   DOC:          docs/ARCHITECTURE.md · plan §5.5
 */
import { Metadata, RunView, UserInfo } from '@memberjunction/core';
import type { mjBizAppsAccountingChartOfAccountsMappingEntity } from '@mj-biz-apps/accounting-entities';

const COA_MAP_ENTITY = 'MJ_BizApps_Accounting: Chart Of Accounts Mappings';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export interface ProposeMappingSpec {
  companyId: string;
  externalSystem: string;
  externalAccountId: string;
  externalAccountName?: string;
  internalGLAccountId: string;
  effectiveFrom: Date;
  effectiveTo?: Date | null;
  changeNote?: string;
}

export interface ApproveMappingResult { approvedMappingId: string; supersededMappingIds: string[] }

/** Pure: do two `[from, to]` date ranges overlap? A null `to` means open-ended (no end). Unit-tested. */
export function rangesOverlap(aFrom: Date, aTo: Date | null, bFrom: Date, bTo: Date | null): boolean {
  const aEnd = aTo ? aTo.getTime() : Number.POSITIVE_INFINITY;
  const bEnd = bTo ? bTo.getTime() : Number.POSITIVE_INFINITY;
  return aFrom.getTime() <= bEnd && bFrom.getTime() <= aEnd;
}

/** Record an unapproved (proposed) mapping. Invisible to resolution until approved. */
export async function proposeMapping(spec: ProposeMappingSpec, contextUser: UserInfo): Promise<string> {
  const md = new Metadata();
  const m = await md.GetEntityObject<mjBizAppsAccountingChartOfAccountsMappingEntity>(COA_MAP_ENTITY, contextUser);
  m.NewRecord();
  m.CompanyID = spec.companyId;
  m.ExternalSystem = spec.externalSystem;
  m.ExternalAccountID = spec.externalAccountId;
  m.ExternalAccountName = spec.externalAccountName ?? null;
  m.InternalGLAccountID = spec.internalGLAccountId;
  m.EffectiveFrom = spec.effectiveFrom;
  m.EffectiveTo = spec.effectiveTo ?? null;
  m.ChangeNote = spec.changeNote ?? null;
  // ApprovedByUserID / ApprovedAt intentionally left null — a proposal, not yet approved.
  if (!(await m.Save())) throw new Error(`proposeMapping: save failed: ${m.LatestResult?.CompleteMessage ?? 'unknown'}`);
  return m.ID;
}

/** Approve a proposed mapping; supersede prior approved+overlapping mappings for the same local GL (strict 1:1). */
export async function approveMapping(mappingId: string, approverUserId: string, contextUser: UserInfo): Promise<ApproveMappingResult> {
  const md = new Metadata();
  const m = await md.GetEntityObject<mjBizAppsAccountingChartOfAccountsMappingEntity>(COA_MAP_ENTITY, contextUser);
  if (!(await m.Load(mappingId))) throw new Error(`approveMapping: mapping ${mappingId} not found`);
  if (m.ApprovedByUserID) return { approvedMappingId: mappingId, supersededMappingIds: [] }; // already approved — idempotent

  const supersededMappingIds = await supersedeOverlappingApproved(m, contextUser);
  m.ApprovedByUserID = approverUserId;
  m.ApprovedAt = new Date();
  if (!(await m.Save())) throw new Error(`approveMapping: approve save failed: ${m.LatestResult?.CompleteMessage ?? 'unknown'}`);
  return { approvedMappingId: mappingId, supersededMappingIds };
}

/** Close out (EffectiveTo = day before the new mapping starts) every prior approved mapping for the same
 *  Company × ExternalSystem × InternalGLAccount whose effective range overlaps the new one. */
async function supersedeOverlappingApproved(m: mjBizAppsAccountingChartOfAccountsMappingEntity, contextUser: UserInfo): Promise<string[]> {
  const rv = new RunView();
  const res = await rv.RunView<{ ID: string; EffectiveFrom: string; EffectiveTo: string | null }>(
    { EntityName: COA_MAP_ENTITY,
      ExtraFilter: `ID <> '${m.ID}' AND CompanyID='${m.CompanyID}' AND ExternalSystem='${m.ExternalSystem}' AND InternalGLAccountID='${m.InternalGLAccountID}' AND ApprovedByUserID IS NOT NULL`,
      Fields: ['ID', 'EffectiveFrom', 'EffectiveTo'], ResultType: 'simple', BypassCache: true },
    contextUser,
  );
  const newFrom = new Date(m.EffectiveFrom);
  const newTo = m.EffectiveTo ? new Date(m.EffectiveTo) : null;
  const closeAt = new Date(newFrom.getTime() - ONE_DAY_MS);
  const supersededIds: string[] = [];
  const md = new Metadata();
  for (const row of res.Results ?? []) {
    if (!rangesOverlap(new Date(row.EffectiveFrom), row.EffectiveTo ? new Date(row.EffectiveTo) : null, newFrom, newTo)) continue;
    const prior = await md.GetEntityObject<mjBizAppsAccountingChartOfAccountsMappingEntity>(COA_MAP_ENTITY, contextUser);
    await prior.Load(row.ID);
    prior.EffectiveTo = closeAt;
    if (!(await prior.Save())) throw new Error(`approveMapping: failed to supersede prior mapping ${row.ID}: ${prior.LatestResult?.CompleteMessage ?? 'unknown'}`);
    supersededIds.push(row.ID);
  }
  return supersededIds;
}
