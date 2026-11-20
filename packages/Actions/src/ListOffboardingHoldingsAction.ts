import { RunView, type UserInfo } from '@memberjunction/core';
import { ActionResultSimple, RunActionParams } from '@memberjunction/actions-base';
import { BaseAction } from '@memberjunction/actions';
import { RegisterClass, UUIDsEqual } from '@memberjunction/global';
import { isSqlGuid } from '@mj-biz-apps/accounting-core-entities-server';

/**
 * Action: Accounting.ListOffboardingHoldings
 *
 * Lists what a departing user holds in Accounting, for the offboarding screen that runs every
 * action in the "Offboarding Holdings" category (bc-aidp-next-golive#297). Accounting holds one
 * kind of responsibility: a company profile's CFO approver (`ApprovalCFOUserID`).
 *
 * Only a company's own CFO approver may name its successor, and here the approver is the leaver, so
 * nobody else qualifies and every holding is listed with `CanReassign: false` and a note pointing to
 * Company Setup. For that reason Accounting ships no reassign action.
 *
 * Reads run as the calling user, so the list is limited to what that user may read.
 */
@RegisterClass(BaseAction, 'Accounting.ListOffboardingHoldings')
export class ListOffboardingHoldingsAction extends BaseAction {
  /**
   * Lets any signed-in user run this action without an action authorization. It grants nothing:
   * every read runs as the caller, so entity permissions still decide what is listed.
   */
  public static readonly AuthorizesCaller = true;

  protected async InternalRunAction(params: RunActionParams): Promise<ActionResultSimple> {
    const input = readLeaverInput(params);
    if (!input.userId && !input.employeeId) {
      return invalidInput('Give LeaverUserID or LeaverEmployeeID.');
    }
    const badId = [input.userId, input.employeeId].find(id => id && !isSqlGuid(id));
    if (badId) return invalidInput(`'${badId}' is not a valid ID.`);

    const leaver = await resolveLeaverUserIds(input, params.ContextUser);
    if (!leaver.resolved) {
      return invalidInput('Neither LeaverUserID nor LeaverEmployeeID matches a user or employee.');
    }
    const holdings = await listCfoApproverHoldings(leaver.userIds, params.ContextUser);
    writeOutput(params, 'Holdings', JSON.stringify(holdings));
    return { Success: true, ResultCode: 'SUCCESS', Message: `Found ${holdings.length} accounting holding(s).` };
  }
}

// ─── Contract ────────────────────────────────────────────────────────────────────────────

/** One item a leaver holds, in the shape every "Offboarding Holdings" action returns. */
export interface OffboardingHolding {
  App: 'Accounting';
  Domain: 'Finance';
  Kind: 'CFO_APPROVER';
  KindLabel: string;
  EntityName: string;
  RecordID: string;
  Label: string;
  CanReassign: boolean;
  Note: string | null;
}

export const COMPANY_PROFILE_ENTITY = 'MJ_BizApps_Accounting: Accounting Company Profiles';
const USER_ENTITY = 'MJ: Users';
const EMPLOYEE_ENTITY = 'MJ: Employees';

// ─── Inputs ──────────────────────────────────────────────────────────────────────────────

interface LeaverInput {
  userId: string | null;
  employeeId: string | null;
}

function readParam(params: RunActionParams, name: string): string | null {
  const value = params.Params.find(p => p.Name === name)?.Value;
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function readLeaverInput(params: RunActionParams): LeaverInput {
  return { userId: readParam(params, 'LeaverUserID'), employeeId: readParam(params, 'LeaverEmployeeID') };
}

function writeOutput(params: RunActionParams, name: string, value: string): void {
  const existing = params.Params.find(p => p.Name === name);
  if (existing) existing.Value = value;
  else params.Params.push({ Name: name, Type: 'Output', Value: value });
}

function invalidInput(message: string): ActionResultSimple {
  return { Success: false, ResultCode: 'INVALID_INPUT', Message: `Accounting holdings were not listed: ${message}` };
}

// ─── Resolving the leaver ────────────────────────────────────────────────────────────────

interface ResolvedLeaver {
  /** True when either ID matched a user or an employee. */
  resolved: boolean;
  /** The leaver's users: the given user plus every user linked to the given employee. */
  userIds: string[];
}

/**
 * The CFO approver is a user, so the leaver is resolved to user IDs. An employee with no user is
 * still a valid leaver: it resolves, with nothing held here.
 */
export async function resolveLeaverUserIds(input: LeaverInput, contextUser: UserInfo): Promise<ResolvedLeaver> {
  const filters: string[] = [];
  if (input.userId) filters.push(`ID='${input.userId}'`);
  if (input.employeeId) filters.push(`EmployeeID='${input.employeeId}'`);
  const users = await runSimple<{ ID: string }>(USER_ENTITY, filters.join(' OR '), ['ID'], contextUser);
  const userIds = dedupe(users.map(u => u.ID));
  if (userIds.length > 0) return { resolved: true, userIds };
  if (!input.employeeId) return { resolved: false, userIds: [] };
  const employees = await runSimple<{ ID: string }>(EMPLOYEE_ENTITY, `ID='${input.employeeId}'`, ['ID'], contextUser);
  return { resolved: employees.length > 0, userIds: [] };
}

function dedupe(ids: string[]): string[] {
  return ids.filter((id, i) => ids.findIndex(other => UUIDsEqual(other, id)) === i);
}

// ─── Holdings ────────────────────────────────────────────────────────────────────────────

interface CompanyProfileRow {
  ID: string;
  Name: string;
}

/** Every company profile whose CFO approver is one of the leaver's users. */
export async function listCfoApproverHoldings(userIds: string[], contextUser: UserInfo): Promise<OffboardingHolding[]> {
  if (userIds.length === 0) return [];
  const inList = userIds.map(id => `'${id}'`).join(', ');
  const rows = await runSimple<CompanyProfileRow>(
    COMPANY_PROFILE_ENTITY, `ApprovalCFOUserID IN (${inList})`, ['ID', 'Name'], contextUser, 'Name ASC',
  );
  return rows.map(toHolding);
}

export function toHolding(row: CompanyProfileRow): OffboardingHolding {
  return {
    App: 'Accounting',
    Domain: 'Finance',
    Kind: 'CFO_APPROVER',
    KindLabel: 'CFO approver',
    EntityName: COMPANY_PROFILE_ENTITY,
    RecordID: row.ID,
    Label: row.Name,
    CanReassign: false,
    Note: `Set a new CFO approver for ${row.Name} in Company Setup.`,
  };
}

async function runSimple<T>(
  entityName: string, filter: string, fields: string[], contextUser: UserInfo, orderBy?: string,
): Promise<T[]> {
  const result = await new RunView().RunView<T>(
    { EntityName: entityName, ExtraFilter: filter, Fields: fields, OrderBy: orderBy, ResultType: 'simple' },
    contextUser,
  );
  if (!result.Success) {
    throw new Error(`Accounting holdings were not listed: could not read ${entityName}. ${result.ErrorMessage ?? ''}`.trim());
  }
  return result.Results ?? [];
}
