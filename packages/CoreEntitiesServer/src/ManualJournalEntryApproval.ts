/**
 * ManualJournalEntryApproval — approval of manual journal entries before they can be batched
 * (golive #353, from #320 §3).
 *
 * A MANUAL entry is one no booking path created: its D25 origin pair (LinkedEntityID /
 * LinkedRecordID) is empty, and it is not a batch's netted summary. Order, payment and other
 * system bookings always carry the pair, so they never reach this code.
 *
 * WHEN IT APPLIES: only while the entry's company has an
 * `AccountingCompanyProfile.ManualJournalEntryApprovalThreshold`. Empty (the default) switches the
 * feature off, so every existing install behaves exactly as before.
 *
 * ROUTING (`RouteManualJournalEntryApproval`, pure):
 *   - CFO level — the company's `ApprovalCFOUserID` — when the entry's total debits are ABOVE the
 *     threshold, when any line is on a GL account flagged `IsControlAccount`, when no approver role
 *     is configured, or when no active holder of that role other than the requester exists.
 *   - Standard level otherwise — every active holder of `ManualJournalEntryApproverRoleID` except
 *     the requester.
 *   - Never the requester: a CFO-level entry the CFO raised is refused with a message saying so,
 *     rather than routed to someone with less authority.
 *
 * LIFECYCLE: `JournalEntryEntityServer.Save` asks `PlanForSave` before its transaction (reads
 * only, so a routing failure refuses the save before anything is written), stamps the level and
 * requester onto the header, and after the insert calls `RaiseApprovalTask` and stamps the Task's
 * ID. A later change to an entry's amounts, accounts, date or company re-plans: the open Task is
 * closed, ApprovedAt/ApprovedByUserID are cleared, and a new Task is raised, so an approval always
 * covers the content that will be batched. `RecordDecision` is the decision path
 * (`Accounting.RecordManualJournalEntryDecision`).
 *
 * BATCHING: the batch engine's candidate filter leaves out entries with an ApprovalLevel and no
 * ApprovedAt; CK_JournalEntry_ApprovedBeforeBatch is the database floor under it.
 *
 * PROVIDER: injected and required, like TasksAppApprovalGate. Task writes go through
 * TaskOrchestrationService from @mj-biz-apps/tasks-core.
 *
 * CONNECTS TO:
 *   READS:  Accounting Company Profiles · GL Accounts · Journal Entry Types · MJ: User Roles ·
 *           MJ: Users · Task Types · Tasks · People
 *   WRITES: Journal Entries (approval stamps) · Tasks, Task Links, Task Assignments, Task Decisions
 *           (via TaskOrchestrationService) · Tasks (Status, closing a superseded request)
 *   CALLERS: JournalEntryEntityServer.Save · ManualJournalEntryOperations
 */
import { DatabaseProviderBase, IMetadataProvider, IRunViewProvider, LogError, UserInfo } from '@memberjunction/core';
import { UUIDsEqual } from '@memberjunction/global';
import { IsApprovalOutcome, TaskOrchestrationService, type TaskDecisionOutcomeCode } from '@mj-biz-apps/tasks-core';
import type { mjBizAppsTasksTaskEntity, mjBizAppsTasksTaskTypeEntity } from '@mj-biz-apps/tasks-entities';
import type { mjBizAppsAccountingAccountingCompanyProfileEntity } from '@mj-biz-apps/accounting-entities';
import { ToCalendarDay } from '@mj-biz-apps/common-entities';

import type { JournalEntryEntityServer } from './JournalEntryEntityServer.js';
import { LookupJournalEntryTypeByID } from './JournalEntryTypes.js';
import { isSqlGuid, requireSqlGuid, sqlGuidLiteral } from './SqlGuards.js';

const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';
const ACP_ENTITY = 'MJ_BizApps_Accounting: Accounting Company Profiles';
const GL_ENTITY = 'MJ_BizApps_Accounting: GL Accounts';
const TASK_ENTITY = 'MJ_BizApps_Tasks: Tasks';
const TASK_TYPE_ENTITY = 'MJ_BizApps_Tasks: Task Types';
const PERSON_ENTITY = 'MJ_BizApps_Common: People';
const USER_ENTITY = 'MJ: Users';
const USER_ROLE_ENTITY = 'MJ: User Roles';

/** The seeded generic approval TaskType that CreateApprovalRequest expects (as the batch gate uses). */
const APPROVAL_REQUEST_TASK_TYPE = 'Approval Request';

/** Task statuses after which a Task asks nobody for anything. */
const CLOSED_TASK_STATUSES: ReadonlySet<string> = new Set(['Completed', 'Cancelled']);

/** Who a manual entry's approval is routed to. Mirrors CK_JournalEntry_ApprovalLevel. */
export type ManualJournalEntryApprovalLevel = 'Standard' | 'CFO';

/** A company's manual-entry approval settings, read from its Accounting Company Profile. */
export interface ManualJournalEntryApprovalPolicy {
  /** Total debits at or below which the approver role decides. */
  Threshold: number;
  /** The role whose holders approve at or below the threshold; null sends everything to the CFO. */
  ApproverRoleID: string | null;
  /** The company's Approval CFO; null when none is configured. */
  CFOUserID: string | null;
}

/** Everything routing needs, already read from the database. */
export interface ManualJournalEntryRoutingInput {
  /** The entry's total debits (functional currency). */
  TotalDebits: number;
  /** True when any line is on a GL account flagged IsControlAccount. */
  TouchesControlAccount: boolean;
  /** The user whose save raises the approval; never an approver. */
  RequesterUserID: string;
  Policy: ManualJournalEntryApprovalPolicy;
  /** Active holders of Policy.ApproverRoleID; empty when no role is configured. */
  RoleHolderUserIDs: string[];
}

/** Where an entry's approval goes, and why. */
export interface ManualJournalEntryApprovalPlan {
  Level: ManualJournalEntryApprovalLevel;
  /** The users assigned to the approval Task (never the requester). */
  ApproverUserIDs: string[];
  /** Why the entry went to this level, in words an approver can read. */
  Reason: string;
  TotalDebits: number;
}

/**
 * What a save must do about approval:
 *   Raise — stamp `Plan` onto the entry and raise a new approval Task (closing any open one);
 *   Clear — the entry's content changed while its company no longer requires approval: drop the
 *           old level and close its Task, as if the entry were new.
 */
export type ManualJournalEntrySaveAction =
  | { Action: 'Raise'; Plan: ManualJournalEntryApprovalPlan }
  | { Action: 'Clear' };

/** A manual entry that cannot be routed to anyone allowed to approve it, or a refused decision. */
export class ManualJournalEntryApprovalError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'ManualJournalEntryApprovalError';
  }
}

/** Format an amount the way the messages show it. */
function formatAmount(amount: number): string {
  return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Decide the approval level and approvers for a manual entry. Pure: every input is already read.
 * Throws ManualJournalEntryApprovalError when the entry needs the CFO and the company has none, or
 * the CFO is the requester.
 */
export function RouteManualJournalEntryApproval(input: ManualJournalEntryRoutingInput): ManualJournalEntryApprovalPlan {
  const { Policy, RequesterUserID, TotalDebits } = input;
  if (!RequesterUserID) throw new ManualJournalEntryApprovalError('A manual journal entry needs a signed-in user to raise its approval.');
  if (!Number.isFinite(TotalDebits)) throw new ManualJournalEntryApprovalError('The entry\'s total could not be worked out, so its approval cannot be routed.');

  let cfoReason: string | null = null;
  if (TotalDebits > Policy.Threshold) {
    cfoReason = `its total of ${formatAmount(TotalDebits)} is above the company's manual-entry approval threshold of ${formatAmount(Policy.Threshold)}`;
  } else if (input.TouchesControlAccount) {
    cfoReason = 'it has a line on a control account';
  } else if (!Policy.ApproverRoleID) {
    cfoReason = 'the company has no manual-entry approver role';
  } else {
    const approvers = uniqueIds(input.RoleHolderUserIDs.filter(id => !UUIDsEqual(id, RequesterUserID)));
    if (approvers.length > 0) {
      return {
        Level: 'Standard',
        ApproverUserIDs: approvers,
        Reason: `its total of ${formatAmount(TotalDebits)} is within the company's manual-entry approval threshold of ${formatAmount(Policy.Threshold)}`,
        TotalDebits,
      };
    }
    cfoReason = 'no active holder of the manual-entry approver role other than you exists';
  }

  if (!Policy.CFOUserID) {
    throw new ManualJournalEntryApprovalError(
      `This manual journal entry needs the company's Approval CFO because ${cfoReason}, but the company has no Approval CFO. ` +
      'Set the Approval CFO on its Accounting Company Profile, then save the entry again.',
    );
  }
  if (UUIDsEqual(Policy.CFOUserID, RequesterUserID)) {
    throw new ManualJournalEntryApprovalError(
      `This manual journal entry needs the company's Approval CFO because ${cfoReason}, and you are the Approval CFO. ` +
      'Nobody may approve their own entry, so someone else must enter it.',
    );
  }
  return { Level: 'CFO', ApproverUserIDs: [Policy.CFOUserID], Reason: cfoReason, TotalDebits };
}

/** Facts about a decision attempt, already read. */
export interface ManualJournalEntryDeciderInput {
  Level: ManualJournalEntryApprovalLevel;
  RequesterUserID: string;
  DeciderUserID: string;
  /** The company's Approval CFO now; null when none is configured. */
  CFOUserID: string | null;
  /** Whether the decider holds the company's manual-entry approver role now. */
  DeciderHoldsApproverRole: boolean;
  EntryLabel: string;
}

/**
 * Who may decide (pure): never the requester; a CFO-level entry only the company's Approval CFO; a
 * Standard entry a current holder of the approver role or the Approval CFO.
 */
export function AssertMayDecideManualJournalEntry(input: ManualJournalEntryDeciderInput): void {
  if (UUIDsEqual(input.DeciderUserID, input.RequesterUserID)) {
    throw new ManualJournalEntryApprovalError(
      `${input.EntryLabel}: you raised this approval request (you created the entry or last changed its amounts, accounts, date or company), ` +
      'so you may not decide it. Someone else must.',
    );
  }
  const isCFO = !!input.CFOUserID && UUIDsEqual(input.DeciderUserID, input.CFOUserID);
  if (input.Level === 'CFO') {
    if (!isCFO) {
      throw new ManualJournalEntryApprovalError(
        `${input.EntryLabel}: only the company's Approval CFO may decide this entry, and you are not that user.`,
      );
    }
    return;
  }
  if (!isCFO && !input.DeciderHoldsApproverRole) {
    throw new ManualJournalEntryApprovalError(
      `${input.EntryLabel}: only a holder of the company's manual-entry approver role, or its Approval CFO, may decide this entry.`,
    );
  }
}

/** The result of a recorded decision. */
export interface ManualJournalEntryDecisionResult {
  Approved: boolean;
  ApprovedAt: Date | null;
}

function uniqueIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (!id) continue;
    const key = id.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(id);
  }
  return out;
}

/** True when an entry has no D25 origin pair, i.e. no booking path created it. */
export function IsManualJournalEntry(je: { LinkedEntityID: string | null; LinkedRecordID: string | null }): boolean {
  return !je.LinkedEntityID && !je.LinkedRecordID;
}

/**
 * The approval service. Stateless; one instance per provider. The provider is injected and
 * required (no global fallback).
 */
export class ManualJournalEntryApprovalService {
  private readonly orchestration = new TaskOrchestrationService();

  public constructor(private readonly provider: IMetadataProvider) {
    if (!provider) throw new Error('The manual journal entry approval service was created without a database provider; the calling code must pass one.');
  }

  private get viewProvider(): IRunViewProvider {
    return this.provider as unknown as IRunViewProvider;
  }

  // ─── planning (called by JournalEntryEntityServer.Save, before its transaction) ──────────────

  /**
   * What this save must do about approval, or null for nothing. Reads only; throws
   * ManualJournalEntryApprovalError when the entry cannot be routed to an allowed approver.
   *
   * Nothing is planned unless the entry is Pending, manual, not a batch summary, and either new or
   * changed in its amounts, accounts, date or company. Most entries (every booking-path entry)
   * leave on the first check without a query.
   */
  public async PlanForSave(je: JournalEntryEntityServer, contextUser: UserInfo): Promise<ManualJournalEntrySaveAction | null> {
    if (je.Status !== 'Pending') return null;
    if (!IsManualJournalEntry(je)) return null;
    if (!je.CompanyID) return null; // the entry's own validation refuses a missing company
    // Unloaded lines carry no changes, so the header decides; the lines load only for the total.
    if (!je.HasApprovalRelevantChanges()) return null;
    if (je.IsSaved && !je.Lines.IsLoaded) await je.LoadLines(contextUser);

    const policy = await this.loadPolicy(je.CompanyID, contextUser);
    if (!policy) {
      return je.IsSaved && je.ApprovalLevel ? { Action: 'Clear' } : null;
    }
    if (await this.isBatchSummary(je.EntryTypeID, contextUser)) return null;

    const lines = je.Lines.Items;
    const totalDebits = Math.round(lines.reduce((sum, l) => sum + (l.DebitAmount ?? 0), 0) * 100) / 100;
    const touchesControlAccount = await this.touchesControlAccount(lines.map(l => l.GLAccountID), contextUser);
    const roleHolders = policy.ApproverRoleID ? await this.loadActiveRoleHolders(policy.ApproverRoleID, contextUser) : [];

    const plan = RouteManualJournalEntryApproval({
      TotalDebits: totalDebits,
      TouchesControlAccount: touchesControlAccount,
      RequesterUserID: contextUser.ID,
      Policy: policy,
      RoleHolderUserIDs: roleHolders,
    });
    return { Action: 'Raise', Plan: plan };
  }

  /**
   * The company's policy, or null when manual-entry approval is off for it (no profile, or an
   * empty threshold).
   */
  public async loadPolicy(companyId: string, contextUser: UserInfo): Promise<ManualJournalEntryApprovalPolicy | null> {
    const acp = await this.provider.GetEntityObject<mjBizAppsAccountingAccountingCompanyProfileEntity>(ACP_ENTITY, contextUser);
    if (!(await acp.Load(companyId))) return null;
    const threshold = acp.ManualJournalEntryApprovalThreshold;
    if (threshold === null || threshold === undefined) return null;
    return {
      Threshold: Number(threshold),
      ApproverRoleID: acp.ManualJournalEntryApproverRoleID ?? null,
      CFOUserID: acp.ApprovalCFOUserID ?? null,
    };
  }

  private async isBatchSummary(entryTypeId: string, contextUser: UserInfo): Promise<boolean> {
    if (!entryTypeId) return false;
    const type = await LookupJournalEntryTypeByID(entryTypeId, contextUser, this.provider);
    return !!type?.IsJournalEntryBatchSummary;
  }

  /** Whether any of these GL accounts is a control account. Malformed ids are left to the entry's own validation. */
  private async touchesControlAccount(glAccountIds: string[], contextUser: UserInfo): Promise<boolean> {
    const ids = uniqueIds(glAccountIds.filter(id => isSqlGuid(id)));
    if (ids.length === 0) return false;
    const res = await this.viewProvider.RunView<{ ID: string; IsControlAccount: boolean }>(
      {
        EntityName: GL_ENTITY,
        ExtraFilter: `ID IN (${ids.map(id => sqlGuidLiteral(id, 'ManualJournalEntryApproval.touchesControlAccount')).join(',')})`,
        Fields: ['ID', 'IsControlAccount'],
        ResultType: 'simple',
        BypassCache: true,
      },
      contextUser,
    );
    // Loud: treating a failed read as "no control account" would route a control entry below the CFO.
    if (!res.Success) throw new Error(`Could not check the entry's GL accounts for control accounts: ${res.ErrorMessage ?? 'unknown error'}`);
    return (res.Results ?? []).some(r => !!r.IsControlAccount);
  }

  /** The active users holding this role. */
  private async loadActiveRoleHolders(roleId: string, contextUser: UserInfo): Promise<string[]> {
    const roleRes = await this.viewProvider.RunView<{ UserID: string }>(
      {
        EntityName: USER_ROLE_ENTITY,
        ExtraFilter: `RoleID=${sqlGuidLiteral(roleId, 'ManualJournalEntryApproval.loadActiveRoleHolders')}`,
        Fields: ['UserID'],
        ResultType: 'simple',
        BypassCache: true,
      },
      contextUser,
    );
    if (!roleRes.Success) throw new Error(`Could not read who holds the manual-entry approver role: ${roleRes.ErrorMessage ?? 'unknown error'}`);
    const userIds = uniqueIds((roleRes.Results ?? []).map(r => r.UserID).filter(id => isSqlGuid(id)));
    if (userIds.length === 0) return [];
    const userRes = await this.viewProvider.RunView<{ ID: string; IsActive: boolean }>(
      {
        EntityName: USER_ENTITY,
        ExtraFilter: `ID IN (${userIds.map(id => sqlGuidLiteral(id, 'ManualJournalEntryApproval.loadActiveRoleHolders')).join(',')})`,
        Fields: ['ID', 'IsActive'],
        ResultType: 'simple',
        BypassCache: true,
      },
      contextUser,
    );
    if (!userRes.Success) throw new Error(`Could not read the manual-entry approvers' user records: ${userRes.ErrorMessage ?? 'unknown error'}`);
    return (userRes.Results ?? []).filter(u => !!u.IsActive).map(u => u.ID);
  }

  // ─── Task writes (called inside JournalEntryEntityServer.Save's transaction) ───────────────────

  /** Raise the approval Task for a saved entry and return its ID. */
  public async RaiseApprovalTask(je: JournalEntryEntityServer, plan: ManualJournalEntryApprovalPlan, contextUser: UserInfo): Promise<string> {
    if (!je.IsSaved || !je.ID) throw new Error('A journal entry must be saved before its approval can be raised.');
    if (plan.ApproverUserIDs.length === 0) throw new ManualJournalEntryApprovalError(`Journal entry ${je.EntryNumber}: there is nobody to send its approval to.`);
    const typeId = await this.resolveApprovalTaskTypeId(contextUser);
    const who = plan.Level === 'CFO' ? 'the Approval CFO' : 'a manual-entry approver';
    const task = await this.orchestration.CreateApprovalRequest({
      Name: `Approve manual journal entry ${je.EntryNumber} (${formatAmount(plan.TotalDebits)})`,
      TypeID: typeId,
      Description:
        `Manual journal entry ${je.EntryNumber}, dated ${ToCalendarDay(je.EffectiveDate) ?? 'no date'}, totalling ${formatAmount(plan.TotalDebits)}, ` +
        `needs approval by ${who} before it can be batched to the ERP: ${plan.Reason}.` +
        (je.Description ? ` Description: ${je.Description}` : ''),
      Priority: plan.Level === 'CFO' ? 'High' : 'Medium',
      LinkEntityID: this.entityId(JE_ENTITY),
      LinkRecordID: je.ID,
      ApproverPersonEntityID: this.entityId(USER_ENTITY),
      ApproverPersonRecordIDs: plan.ApproverUserIDs,
    }, contextUser);
    if (!task?.ID) throw new Error(`Journal entry ${je.EntryNumber}: its approval task was not created.`);
    return task.ID;
  }

  /**
   * Refuse a change to a line saved or deleted ON ITS OWN (not through its journal entry's Save) when
   * that entry is a Pending manual entry under approval: one with an ApprovalLevel, or whose company
   * has a threshold. Only the entry's Save re-routes its approval, so a line edited directly would
   * otherwise change what an approver already approved. Booking-path and non-Pending entries pass
   * (the latter are locked by the immutability triggers anyway).
   */
  public async AssertStandaloneLineChangeAllowed(journalEntryId: string, contextUser: UserInfo): Promise<void> {
    if (!isSqlGuid(journalEntryId)) return; // the line's own validation and the FK refuse a bad id
    const res = await this.viewProvider.RunView<{ EntryNumber: string; Status: string; CompanyID: string; LinkedEntityID: string | null; LinkedRecordID: string | null; ApprovalLevel: string | null }>(
      {
        EntityName: JE_ENTITY,
        ExtraFilter: `ID=${sqlGuidLiteral(journalEntryId, 'ManualJournalEntryApproval.AssertStandaloneLineChangeAllowed')}`,
        Fields: ['EntryNumber', 'Status', 'CompanyID', 'LinkedEntityID', 'LinkedRecordID', 'ApprovalLevel'],
        MaxRows: 1,
        ResultType: 'simple',
        BypassCache: true,
      },
      contextUser,
    );
    if (!res.Success) throw new Error(`Could not check the journal entry this line belongs to: ${res.ErrorMessage ?? 'unknown error'}`);
    const entry = res.Results?.[0];
    if (!entry || entry.Status !== 'Pending' || !IsManualJournalEntry(entry)) return;
    if (!entry.ApprovalLevel && !(await this.loadPolicy(entry.CompanyID, contextUser))) return;
    throw new ManualJournalEntryApprovalError(
      `Journal entry ${entry.EntryNumber} is a manual entry that needs approval, so its lines can be changed only by saving the journal entry itself, ` +
      'which raises its approval again. Edit the entry, not the line.',
    );
  }

  /** Close an approval Task nobody needs any more (the entry changed, or no longer needs approval). */
  public async CloseSupersededTask(taskId: string, contextUser: UserInfo): Promise<void> {
    const task = await this.provider.GetEntityObject<mjBizAppsTasksTaskEntity>(TASK_ENTITY, contextUser);
    if (!(await task.Load(taskId))) {
      throw new Error(`The earlier approval task ${taskId} did not load, so it could not be closed.`);
    }
    if (CLOSED_TASK_STATUSES.has(task.Status)) return;
    task.Status = 'Cancelled';
    if (!(await task.Save())) {
      throw new Error(`Closing the earlier approval task ${taskId} failed: ${task.LatestResult?.CompleteMessage ?? 'unknown error'}`);
    }
  }

  // ─── the decision (Accounting.RecordManualJournalEntryDecision) ────────────────────────────────

  /**
   * Record an approve/reject decision on a manual entry. An approval stamps ApprovedAt /
   * ApprovedByUserID, which makes the entry a batch candidate; a rejection leaves it out of every
   * batch until its content changes, which raises a new approval. Both write the decision to the
   * entry's stamped approval Task, in one transaction with the stamp.
   */
  public async RecordDecision(
    journalEntryId: string, outcome: TaskDecisionOutcomeCode, notes: string | undefined, contextUser: UserInfo,
  ): Promise<ManualJournalEntryDecisionResult> {
    requireSqlGuid(journalEntryId, 'ManualJournalEntryApproval.RecordDecision');
    const je = await this.provider.GetEntityObject<JournalEntryEntityServer>(JE_ENTITY, contextUser);
    if (!(await je.Load(journalEntryId))) throw new ManualJournalEntryApprovalError(`Journal entry ${journalEntryId} was not found.`);
    const label = `Journal entry ${je.EntryNumber}`;

    const level = je.ApprovalLevel;
    if (!level) throw new ManualJournalEntryApprovalError(`${label} does not need approval.`);
    if (je.ApprovedAt) throw new ManualJournalEntryApprovalError(`${label} is already approved.`);
    if (je.Status !== 'Pending') throw new ManualJournalEntryApprovalError(`${label} is ${je.Status}, and only a Pending entry can be approved.`);
    if (!je.ApprovalTaskID || !je.ApprovalRequestedByUserID) {
      throw new ManualJournalEntryApprovalError(`${label} has no approval request to decide. Change and save the entry to raise one.`);
    }

    const policy = await this.loadPolicyForDecision(je.CompanyID, contextUser);
    const holdsRole = policy.ApproverRoleID ? await this.userHoldsRole(contextUser.ID, policy.ApproverRoleID, contextUser) : false;
    AssertMayDecideManualJournalEntry({
      Level: level,
      RequesterUserID: je.ApprovalRequestedByUserID,
      DeciderUserID: contextUser.ID,
      CFOUserID: policy.CFOUserID,
      DeciderHoldsApproverRole: holdsRole,
      EntryLabel: label,
    });

    const task = await this.provider.GetEntityObject<mjBizAppsTasksTaskEntity>(TASK_ENTITY, contextUser);
    if (!(await task.Load(je.ApprovalTaskID))) {
      throw new Error(`${label}: its approval task ${je.ApprovalTaskID} did not load, so no decision was recorded.`);
    }
    if (CLOSED_TASK_STATUSES.has(task.Status)) {
      throw new ManualJournalEntryApprovalError(
        `${label}: its approval request is already ${task.Status === 'Cancelled' ? 'rejected or closed' : 'decided'}. ` +
        'Change and save the entry to raise a new one.',
      );
    }

    const personId = await this.resolvePersonIdForUser(contextUser);
    const approved = IsApprovalOutcome(outcome);
    const dbProvider = this.provider as unknown as DatabaseProviderBase;
    await dbProvider.BeginTransaction();
    try {
      await this.orchestration.RecordDecision(
        { TaskID: task.ID, OutcomeCode: outcome, DecidedByPersonID: personId ?? undefined, Notes: notes?.trim() || undefined },
        contextUser,
      );
      if (approved) {
        je.ApprovedAt = new Date();
        je.ApprovedByUserID = contextUser.ID;
        if (!(await je.Save())) {
          throw new Error(`${label}: recording the approval on the entry failed: ${je.LatestResult?.CompleteMessage ?? 'unknown error'}`);
        }
      }
      await dbProvider.CommitTransaction();
    } catch (e) {
      try {
        await dbProvider.RollbackTransaction();
      } catch (rollbackError) {
        LogError(`ManualJournalEntryApproval.RecordDecision: rollback failed: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`);
      }
      throw e;
    }
    return { Approved: approved, ApprovedAt: approved ? je.ApprovedAt : null };
  }

  /** The company's approvers for a decision. Unlike planning, the threshold does not matter here. */
  private async loadPolicyForDecision(companyId: string, contextUser: UserInfo): Promise<{ CFOUserID: string | null; ApproverRoleID: string | null }> {
    const acp = await this.provider.GetEntityObject<mjBizAppsAccountingAccountingCompanyProfileEntity>(ACP_ENTITY, contextUser);
    if (!(await acp.Load(companyId))) {
      throw new ManualJournalEntryApprovalError(`Company ${companyId} has no Accounting Company Profile, so the entry's approvers cannot be found.`);
    }
    return { CFOUserID: acp.ApprovalCFOUserID ?? null, ApproverRoleID: acp.ManualJournalEntryApproverRoleID ?? null };
  }

  private async userHoldsRole(userId: string, roleId: string, contextUser: UserInfo): Promise<boolean> {
    const res = await this.viewProvider.RunView<{ ID: string }>(
      {
        EntityName: USER_ROLE_ENTITY,
        ExtraFilter: `UserID=${sqlGuidLiteral(userId, 'ManualJournalEntryApproval.userHoldsRole')} AND RoleID=${sqlGuidLiteral(roleId, 'ManualJournalEntryApproval.userHoldsRole')}`,
        Fields: ['ID'],
        MaxRows: 1,
        ResultType: 'simple',
        BypassCache: true,
      },
      contextUser,
    );
    if (!res.Success) throw new Error(`Could not check whether you hold the manual-entry approver role: ${res.ErrorMessage ?? 'unknown error'}`);
    return (res.Results ?? []).length > 0;
  }

  /** The bizapps-common Person linked to this user, or null; the decision is attributed to it when there is one. */
  private async resolvePersonIdForUser(contextUser: UserInfo): Promise<string | null> {
    const res = await this.viewProvider.RunView<{ ID: string }>(
      {
        EntityName: PERSON_ENTITY,
        ExtraFilter: `LinkedUserID=${sqlGuidLiteral(contextUser.ID, 'ManualJournalEntryApproval.resolvePersonIdForUser')}`,
        Fields: ['ID'],
        MaxRows: 1,
        ResultType: 'simple',
        BypassCache: true,
      },
      contextUser,
    );
    if (!res.Success) throw new Error(`Could not look up the person linked to the current user: ${res.ErrorMessage ?? 'unknown error'}`);
    return res.Results?.[0]?.ID ?? null;
  }

  private async resolveApprovalTaskTypeId(contextUser: UserInfo): Promise<string> {
    const res = await this.viewProvider.RunView<mjBizAppsTasksTaskTypeEntity>(
      { EntityName: TASK_TYPE_ENTITY, ExtraFilter: `Name='${APPROVAL_REQUEST_TASK_TYPE.replace(/'/g, "''")}'`, MaxRows: 1, ResultType: 'entity_object', BypassCache: true },
      contextUser,
    );
    const type = res.Results?.[0];
    if (!res.Success || !type) {
      throw new Error(`The '${APPROVAL_REQUEST_TASK_TYPE}' task type is not set up, so no approval task can be raised. Make sure the Tasks app metadata is installed.`);
    }
    return type.ID;
  }

  private entityId(entityName: string): string {
    const entity = this.provider.EntityByName(entityName);
    if (!entity) throw new Error(`The '${entityName}' entity is missing from the metadata, so the approval task cannot be linked.`);
    return entity.ID;
  }
}
