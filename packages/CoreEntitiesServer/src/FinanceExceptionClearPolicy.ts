/**
 * Who may clear a finance exception (golive #320 §4) — the pure decision behind
 * `Accounting.ClearFinanceException`. No reads: the caller passes the authorization catalog, the
 * role grants, the system user and a user lookup.
 *
 * CONNECTS TO:
 *   CALLED BY  FinanceExceptions.ts (ClearFinanceException: the pre-read gate and the per-record rule)
 *   CALLS      @memberjunction/core AuthorizationInfo.UserCanExecute / AuthorizationEvaluator
 *   METADATA   metadata/authorizations/.finance-exceptions-clear.json (the default right)
 *              metadata/authorizations/.finance-exceptions-clear-rules.json (the rule rights, granted to no role)
 *   DOC        docs/lifecycle-hooks.md §2c, docs/bizapps-accounting-erd.md §10
 *
 * THE RIGHTS. Every one is an `MJ: Authorizations` row the package ships; a host turns a rule on by
 * granting the row to one or more of its roles (an Allow `MJ: Authorization Roles` row). A rule
 * whose row is missing, inactive, or granted to no role is OFF, and the exception falls through to
 * the next rule — so an install that grants none of them behaves exactly as before: any holder of
 * `FinanceExceptions.Clear` (the package's Finance role) may clear any type.
 *
 *   FinanceExceptions.Clear                  the default: types with no per-type grant
 *   FinanceExceptions.ClearType.<TYPE CODE>  only its holders clear that type (not `Clear` holders)
 *   FinanceExceptions.ClearUnattributed      only its holders clear an exception whose creator is
 *                                            unresolved (CreatorUnresolved) or is the system user
 *   FinanceExceptions.EscalatedCreator       a MARKER, not a right: an exception on a record created
 *   FinanceExceptions.ClearEscalated           by a holder of EscalatedCreator is cleared only by a
 *                                            holder of ClearEscalated (both must be granted)
 *
 * PRECEDENCE, per exception, after the checks that always apply (still Open; the reviewer did not
 * create the source record; a note is given):
 *   1. Unattributed creator — ClearUnattributed when granted. Without it a CreatorUnresolved row is
 *      refused (CREATOR_UNRESOLVED, the original rule) and a system-created row falls through.
 *   2. Escalated creator — ClearEscalated when the creator holds EscalatedCreator. A creator ID the
 *      user cache does not know escalates: whether they hold the marker cannot be ruled out.
 *   3. The type's ClearType.<CODE> when granted.
 *   4. FinanceExceptions.Clear.
 * The first rule that applies decides; a later one is not consulted.
 *
 * WHY ESCALATED COMES BEFORE TYPE, AND DOES NOT ALSO NEED THE TYPE RIGHT. The source record's creator
 * may never clear its exception. When the creator is the only holder of a type's right (say the CFO,
 * for a type only the CFO clears), a rule that put Type first, or that required the escalated
 * reviewer to hold the type right as well, would leave that exception clearable by nobody. The
 * escalated lane is how a host sends a senior person's own work to their peers: grant
 * EscalatedCreator and ClearEscalated to the same senior roles (for example the CFO and the senior
 * finance leads), and the creator's peers clear it, whatever the type. Because ClearEscalated
 * applies to every type, grant it only to roles trusted to clear any type.
 *
 * A RULE IS ONLY AS STRONG AS ITS GRANT ROW. Removing the last grant of a rule right turns the rule
 * OFF and its exceptions fall back to the broad right — the zero-impact upgrade depends on that.
 * To say "nobody may clear this type", grant its right to a role that has no members.
 *
 * The package ships a ClearType row for each seeded type. A type another app adds later has none
 * until one is added (by that app or the host), and is cleared under the default right meanwhile.
 * `MJ: Authorizations.Name` is 100 characters, so a type code longer than 50 cannot have one.
 *
 * HIERARCHY. The rule rights have no parent and are checked as DIRECT grants, so holding
 * `FinanceExceptions.Clear` never confers them. That is what lets a host withdraw clearing from its
 * Finance role type by type without removing the package's own grant. The default right keeps the
 * MJ convention (a grant of an ancestor covers it).
 */
import { AuthorizationEvaluator, AuthorizationInfo, AuthorizationRoleInfo, AuthorizationRoleType, RoleInfo, UserInfo } from '@memberjunction/core';
import { UUIDsEqual } from '@memberjunction/global';

const AUTH_PREFIX = 'MJ.BizApps.Accounting.FinanceExceptions';
/** The default right. Held by the Finance role. Fails closed: missing from the catalog, held by nobody. */
export const FINANCE_EXCEPTIONS_CLEAR_AUTH = `${AUTH_PREFIX}.Clear`;
/** Prefix of the per-type rights; the type's Code follows it. */
export const FINANCE_EXCEPTIONS_CLEAR_TYPE_AUTH_PREFIX = `${AUTH_PREFIX}.ClearType.`;
export const FINANCE_EXCEPTIONS_CLEAR_UNATTRIBUTED_AUTH = `${AUTH_PREFIX}.ClearUnattributed`;
export const FINANCE_EXCEPTIONS_ESCALATED_CREATOR_AUTH = `${AUTH_PREFIX}.EscalatedCreator`;
export const FINANCE_EXCEPTIONS_CLEAR_ESCALATED_AUTH = `${AUTH_PREFIX}.ClearEscalated`;

/** The per-type right for a type code. */
export function FinanceExceptionClearTypeAuthName(typeCode: string): string {
  return `${FINANCE_EXCEPTIONS_CLEAR_TYPE_AUTH_PREFIX}${typeCode.trim()}`;
}

/** Which rule decided who may clear an exception. */
export type FinanceExceptionClearRuleKind = 'Unattributed' | 'Escalated' | 'Type' | 'Default';

export interface FinanceExceptionClearRule {
  Kind: FinanceExceptionClearRuleKind;
  /** The authorization the reviewer must hold. */
  AuthorizationName: string;
}

export interface FinanceExceptionClearRefusal {
  Code: string;
  Message: string;
}

/** The facts about one exception the rule depends on. */
export interface FinanceExceptionClearSubject {
  TypeCode: string;
  SourceCreatedByUserID: string | null;
  CreatorUnresolved: boolean;
  /** Appended to a CREATOR_UNRESOLVED refusal: the raising app names the creator there. */
  Summary?: string | null;
}

/** What the rule reads, passed in so the decision stays pure. */
export interface FinanceExceptionClearContext {
  Authorizations: ReadonlyArray<AuthorizationInfo>;
  AuthorizationRoles: ReadonlyArray<AuthorizationRoleInfo>;
  Roles?: ReadonlyArray<RoleInfo>;
  /** The MJ system user's ID: a source record it created counts as unattributed. */
  SystemUserID: string | null;
  /** Looks a user (with roles) up by ID; undefined when unknown. */
  FindUser: (userID: string) => UserInfo | undefined;
}

export type FinanceExceptionClearResolution = { Rule: FinanceExceptionClearRule } | { Refusal: FinanceExceptionClearRefusal };

function findAuthorization(context: FinanceExceptionClearContext, name: string): AuthorizationInfo | undefined {
  return context.Authorizations.find(a => a.Name === name);
}

/**
 * The Allow grants of a right. `Type` is read through MJ's own `AuthorizationType()`, which trims and
 * ignores case, so a hand-authored `"allow"` row counts here exactly as it does in `UserCanExecute`.
 * An exact `=== 'Allow'` would see no grant, turn the rule OFF and fall through to the broad default.
 */
function allowGrants(context: FinanceExceptionClearContext, auth: AuthorizationInfo): AuthorizationRoleInfo[] {
  return context.AuthorizationRoles.filter(ar => UUIDsEqual(ar.AuthorizationID, auth.ID) && ar.AuthorizationType() === AuthorizationRoleType.Allow);
}

/** A rule right is ON when its row exists, is active, and is granted (Allow) to at least one role. */
export function IsFinanceExceptionRuleGranted(context: FinanceExceptionClearContext, name: string): boolean {
  const auth = findAuthorization(context, name);
  return !!auth && !!auth.IsActive && allowGrants(context, auth).length > 0;
}

/** A direct grant of `name` (Deny wins, per MJ). False when the row is missing. */
function holdsDirect(context: FinanceExceptionClearContext, name: string, user: UserInfo | undefined): boolean {
  const auth = findAuthorization(context, name);
  return !!auth && !!user && auth.UserCanExecute(user);
}

/** The default right, honouring a grant of any ancestor (the MJ convention). */
function holdsDefault(context: FinanceExceptionClearContext, user: UserInfo): boolean {
  const auth = findAuthorization(context, FINANCE_EXCEPTIONS_CLEAR_AUTH);
  return !!auth && new AuthorizationEvaluator().UserCanExecuteWithAncestors(auth, user, [...context.Authorizations]);
}

function isRuleRight(name: string): boolean {
  return (
    name.startsWith(FINANCE_EXCEPTIONS_CLEAR_TYPE_AUTH_PREFIX) ||
    name === FINANCE_EXCEPTIONS_CLEAR_UNATTRIBUTED_AUTH ||
    name === FINANCE_EXCEPTIONS_CLEAR_ESCALATED_AUTH
  );
}

/**
 * The pre-read gate: whether the user holds any right that could let them clear some finance
 * exception — the default right, or any rule right (EscalatedCreator is a marker and does not count).
 */
export function HoldsAnyFinanceExceptionClearRight(context: FinanceExceptionClearContext, user: UserInfo | null | undefined): boolean {
  if (!user) return false;
  if (holdsDefault(context, user)) return true;
  return context.Authorizations.some(a => isRuleRight(a.Name) && a.UserCanExecute(user));
}

function isSystemCreator(subject: FinanceExceptionClearSubject, context: FinanceExceptionClearContext): boolean {
  return !!subject.SourceCreatedByUserID && !!context.SystemUserID && UUIDsEqual(subject.SourceCreatedByUserID, context.SystemUserID);
}

function creatorUnresolvedRefusal(subject: FinanceExceptionClearSubject): FinanceExceptionClearRefusal {
  return {
    Code: 'CREATOR_UNRESOLVED',
    Message:
      "The record's creator has no linked login, so separation of duties cannot be checked. Link the creator " +
      `to a login; the exception can be cleared after the next check refreshes it. ${subject.Summary ?? ''}`.trimEnd(),
  };
}

/** Rule 1, or null when it does not apply. */
function unattributedRule(subject: FinanceExceptionClearSubject, context: FinanceExceptionClearContext): FinanceExceptionClearResolution | null {
  if (!subject.CreatorUnresolved && !isSystemCreator(subject, context)) return null;
  if (IsFinanceExceptionRuleGranted(context, FINANCE_EXCEPTIONS_CLEAR_UNATTRIBUTED_AUTH)) {
    return { Rule: { Kind: 'Unattributed', AuthorizationName: FINANCE_EXCEPTIONS_CLEAR_UNATTRIBUTED_AUTH } };
  }
  return subject.CreatorUnresolved ? { Refusal: creatorUnresolvedRefusal(subject) } : null;
}

/** Rule 2, or null when it does not apply. */
function escalatedRule(subject: FinanceExceptionClearSubject, context: FinanceExceptionClearContext): FinanceExceptionClearResolution | null {
  const creatorID = subject.SourceCreatedByUserID;
  if (!creatorID) return null;
  const on =
    IsFinanceExceptionRuleGranted(context, FINANCE_EXCEPTIONS_ESCALATED_CREATOR_AUTH) &&
    IsFinanceExceptionRuleGranted(context, FINANCE_EXCEPTIONS_CLEAR_ESCALATED_AUTH);
  if (!on) return null;
  const creator = context.FindUser(creatorID);
  const escalates = !creator || holdsDirect(context, FINANCE_EXCEPTIONS_ESCALATED_CREATOR_AUTH, creator);
  return escalates ? { Rule: { Kind: 'Escalated', AuthorizationName: FINANCE_EXCEPTIONS_CLEAR_ESCALATED_AUTH } } : null;
}

/** Decides which right clears this exception (see the header for the precedence). */
export function ResolveFinanceExceptionClearRule(
  subject: FinanceExceptionClearSubject,
  context: FinanceExceptionClearContext,
): FinanceExceptionClearResolution {
  const first = unattributedRule(subject, context) ?? escalatedRule(subject, context);
  if (first) return first;
  const typeAuth = FinanceExceptionClearTypeAuthName(subject.TypeCode);
  if (IsFinanceExceptionRuleGranted(context, typeAuth)) return { Rule: { Kind: 'Type', AuthorizationName: typeAuth } };
  return { Rule: { Kind: 'Default', AuthorizationName: FINANCE_EXCEPTIONS_CLEAR_AUTH } };
}

/** Whether the reviewer holds the right a rule names. */
export function HoldsFinanceExceptionClearRule(context: FinanceExceptionClearContext, rule: FinanceExceptionClearRule, reviewer: UserInfo): boolean {
  return rule.Kind === 'Default' ? holdsDefault(context, reviewer) : holdsDirect(context, rule.AuthorizationName, reviewer);
}

const REFUSAL_CODES: Record<FinanceExceptionClearRuleKind, string> = {
  Unattributed: 'UNATTRIBUTED_NOT_AUTHORIZED',
  Escalated: 'ESCALATED_NOT_AUTHORIZED',
  Type: 'TYPE_NOT_AUTHORIZED',
  Default: 'NOT_AUTHORIZED',
};

function ruleReason(rule: FinanceExceptionClearRule, typeCode: string): string {
  switch (rule.Kind) {
    case 'Unattributed':
      return "This exception's source record has no attributable creator (unresolved, or created by the system)";
    case 'Escalated':
      return "This exception's source record was created by someone whose own work is escalated";
    case 'Type':
      return `Clearing a ${typeCode} exception is limited by type`;
    default:
      return 'Clearing a finance exception';
  }
}

/** Names of the roles granted (Allow) a right, for the refusal message. Empty when none resolve. */
function grantedRoleNames(context: FinanceExceptionClearContext, name: string): string[] {
  const auth = findAuthorization(context, name);
  if (!auth || !context.Roles) return [];
  const roles = context.Roles;
  return allowGrants(context, auth)
    .map(ar => roles.find(r => UUIDsEqual(r.ID, ar.RoleID))?.Name)
    .filter((n): n is string => typeof n === 'string' && n.length > 0);
}

/** The refusal for a reviewer who does not hold the rule's right, naming the right and its roles. */
export function FinanceExceptionClearRuleRefusal(
  context: FinanceExceptionClearContext,
  rule: FinanceExceptionClearRule,
  typeCode: string,
): FinanceExceptionClearRefusal {
  const roles = grantedRoleNames(context, rule.AuthorizationName);
  const heldBy = roles.length > 0 ? ` (granted to: ${roles.join(', ')})` : '';
  return {
    Code: REFUSAL_CODES[rule.Kind],
    Message: `${ruleReason(rule, typeCode)}: it needs the ${rule.AuthorizationName} authorization${heldBy}, which you do not hold.`,
  };
}
