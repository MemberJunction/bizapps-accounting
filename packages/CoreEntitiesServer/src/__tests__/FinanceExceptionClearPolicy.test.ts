/**
 * golive #320 §4 — who may clear which finance exception. Pure: the authorization catalog, role
 * grants and users are built in memory, with MJ's evaluation rule (a matching Deny wins; otherwise
 * at least one matching Allow) reproduced by the fake AuthorizationInfo below.
 */
import { describe, it, expect } from 'vitest';
import { AuthorizationRoleInfo, AuthorizationRoleType } from '@memberjunction/core';
import type { AuthorizationInfo, RoleInfo, UserInfo } from '@memberjunction/core';
import {
  FINANCE_EXCEPTIONS_CLEAR_AUTH,
  FINANCE_EXCEPTIONS_CLEAR_ESCALATED_AUTH,
  FINANCE_EXCEPTIONS_CLEAR_UNATTRIBUTED_AUTH,
  FINANCE_EXCEPTIONS_ESCALATED_CREATOR_AUTH,
  FinanceExceptionClearRuleRefusal,
  FinanceExceptionClearTypeAuthName,
  HoldsAnyFinanceExceptionClearRight,
  HoldsFinanceExceptionClearRule,
  IsFinanceExceptionRuleGranted,
  ResolveFinanceExceptionClearRule,
  type FinanceExceptionClearContext,
  type FinanceExceptionClearSubject,
} from '../FinanceExceptionClearPolicy.js';

const ROLE = {
  Finance: 'R0000000-0000-4000-8000-000000000001',
  SeniorAR: 'R0000000-0000-4000-8000-000000000002',
  CFO: 'R0000000-0000-4000-8000-000000000003',
  Supervisor: 'R0000000-0000-4000-8000-000000000004',
  Seller: 'R0000000-0000-4000-8000-000000000005',
} as const;
type RoleKey = keyof typeof ROLE;
const ROLE_NAMES: Record<RoleKey, string> = {
  Finance: 'Finance',
  SeniorAR: 'Senior Finance (AR)',
  CFO: 'CFO',
  Supervisor: 'Orders Revenue Supervisor',
  Seller: 'Account Director',
};

const SYSTEM_USER_ID = 'U0000000-0000-4000-8000-00000000000a';

function user(id: string, ...roles: RoleKey[]): UserInfo {
  return { ID: id, Name: id, UserRoles: roles.map(r => ({ RoleID: ROLE[r] })) } as unknown as UserInfo;
}

const FINANCE = user('U-FINANCE', 'Finance');
const SENIOR = user('U-SENIOR', 'Finance', 'SeniorAR');
const SENIOR_2 = user('U-SENIOR-2', 'Finance', 'SeniorAR');
const CFO = user('U-CFO', 'CFO');
const SUPERVISOR = user('U-SUPERVISOR', 'Supervisor');
const SELLER = user('U-SELLER', 'Seller');
const USERS = [FINANCE, SENIOR, SENIOR_2, CFO, SUPERVISOR, SELLER];

/** `allowAs` writes the Allow rows' Type as given (a hand-authored row may not say exactly 'Allow'). */
type Grants = Record<string, { allow?: RoleKey[]; deny?: RoleKey[]; inactive?: boolean; allowAs?: string }>;

const TYPE_CODES = [
  'WON_DEAL_ORDER_NOT_CONFIRMED',
  'OVERLAPPING_SUBSCRIPTION',
  'ERP_POSTING_NOT_READ_BACK',
  'PROGRESS_UNATTESTED',
  'PROGRESS_JUDGMENT_CALL',
  'PRICE_BELOW_ENGINE_UNAPPROVED',
];
const RULE_AUTH_NAMES = [
  ...TYPE_CODES.map(FinanceExceptionClearTypeAuthName),
  FINANCE_EXCEPTIONS_CLEAR_UNATTRIBUTED_AUTH,
  FINANCE_EXCEPTIONS_ESCALATED_CREATOR_AUTH,
  FINANCE_EXCEPTIONS_CLEAR_ESCALATED_AUTH,
];

/** The package's own grants: Finance holds the default right; every rule right ships ungranted. */
const PACKAGE_DEFAULT: Grants = { [FINANCE_EXCEPTIONS_CLEAR_AUTH]: { allow: ['Finance'] } };

/** The §4 configuration a host would load on top of the package default. */
const SECTION_4: Grants = {
  ...PACKAGE_DEFAULT,
  [FinanceExceptionClearTypeAuthName('WON_DEAL_ORDER_NOT_CONFIRMED')]: { allow: ['SeniorAR'] },
  [FinanceExceptionClearTypeAuthName('OVERLAPPING_SUBSCRIPTION')]: { allow: ['SeniorAR'] },
  [FinanceExceptionClearTypeAuthName('ERP_POSTING_NOT_READ_BACK')]: { allow: ['SeniorAR'] },
  [FinanceExceptionClearTypeAuthName('PROGRESS_UNATTESTED')]: { allow: ['Supervisor', 'SeniorAR'] },
  [FinanceExceptionClearTypeAuthName('PROGRESS_JUDGMENT_CALL')]: { allow: ['Supervisor'] },
  [FinanceExceptionClearTypeAuthName('PRICE_BELOW_ENGINE_UNAPPROVED')]: { allow: ['CFO'] },
  [FINANCE_EXCEPTIONS_CLEAR_UNATTRIBUTED_AUTH]: { allow: ['SeniorAR'] },
  [FINANCE_EXCEPTIONS_ESCALATED_CREATOR_AUTH]: { allow: ['SeniorAR'] },
  [FINANCE_EXCEPTIONS_CLEAR_ESCALATED_AUTH]: { allow: ['CFO'] },
};

function buildContext(grants: Grants, users: UserInfo[] = USERS): FinanceExceptionClearContext {
  const authorizationRoles: AuthorizationRoleInfo[] = [];
  const authorizations = [FINANCE_EXCEPTIONS_CLEAR_AUTH, ...RULE_AUTH_NAMES].map((name, i) => {
    const id = `A0000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
    const grant = grants[name] ?? {};
    // Real MJ AuthorizationRoleInfo rows, so their Type is read the way MJ reads it (trimmed, any case).
    for (const r of grant.allow ?? []) authorizationRoles.push(new AuthorizationRoleInfo({ AuthorizationID: id, RoleID: ROLE[r], Type: grant.allowAs ?? 'Allow' }));
    for (const r of grant.deny ?? []) authorizationRoles.push(new AuthorizationRoleInfo({ AuthorizationID: id, RoleID: ROLE[r], Type: 'Deny' }));
    const IsActive = !grant.inactive;
    const UserCanExecute = (u: UserInfo): boolean => {
      if (!IsActive) return false;
      const mine = authorizationRoles.filter(ar => ar.AuthorizationID === id && u.UserRoles.some(ur => ur.RoleID === ar.RoleID));
      return (
        !mine.some(ar => ar.AuthorizationType() === AuthorizationRoleType.Deny) && mine.some(ar => ar.AuthorizationType() === AuthorizationRoleType.Allow)
      );
    };
    return { ID: id, Name: name, ParentID: null, IsActive, UserCanExecute } as unknown as AuthorizationInfo;
  });
  const roles = (Object.keys(ROLE) as RoleKey[]).map(k => ({ ID: ROLE[k], Name: ROLE_NAMES[k] }) as RoleInfo);
  return {
    Authorizations: authorizations,
    AuthorizationRoles: authorizationRoles,
    Roles: roles,
    SystemUserID: SYSTEM_USER_ID,
    FindUser: id => users.find(u => u.ID === id),
  };
}

function subject(overrides: Partial<FinanceExceptionClearSubject> = {}): FinanceExceptionClearSubject {
  return { TypeCode: 'WON_DEAL_ORDER_NOT_CONFIRMED', SourceCreatedByUserID: SELLER.ID, CreatorUnresolved: false, ...overrides };
}

/** Whether `reviewer` may clear, or the refusal code. */
function decide(context: FinanceExceptionClearContext, s: FinanceExceptionClearSubject, reviewer: UserInfo): string {
  const resolution = ResolveFinanceExceptionClearRule(s, context);
  if ('Refusal' in resolution) return resolution.Refusal.Code;
  return HoldsFinanceExceptionClearRule(context, resolution.Rule, reviewer)
    ? `ALLOWED:${resolution.Rule.Kind}`
    : FinanceExceptionClearRuleRefusal(context, resolution.Rule, s.TypeCode).Code;
}

describe('FinanceExceptionClearTypeAuthName', () => {
  it('appends the trimmed type code to the per-type prefix', () => {
    expect(FinanceExceptionClearTypeAuthName('  PRICE_BELOW_ENGINE_UNAPPROVED ')).toBe(
      'MJ.BizApps.Accounting.FinanceExceptions.ClearType.PRICE_BELOW_ENGINE_UNAPPROVED',
    );
  });
});

describe('an install that grants no rule right (the package default)', () => {
  const context = buildContext(PACKAGE_DEFAULT);

  it.each(TYPE_CODES)('lets a Finance holder clear %s under the default right', code => {
    expect(decide(context, subject({ TypeCode: code }), FINANCE)).toBe('ALLOWED:Default');
  });

  it('refuses someone without the default right', () => {
    expect(decide(context, subject(), CFO)).toBe('NOT_AUTHORIZED');
  });

  it('still refuses an exception whose creator is unresolved', () => {
    const resolution = ResolveFinanceExceptionClearRule(subject({ SourceCreatedByUserID: null, CreatorUnresolved: true, Summary: 'Owner has no login.' }), context);
    expect(resolution).toEqual({ Refusal: { Code: 'CREATOR_UNRESOLVED', Message: expect.stringContaining('Owner has no login.') } });
  });

  it('treats a system-created record like any other', () => {
    expect(decide(context, subject({ SourceCreatedByUserID: SYSTEM_USER_ID }), FINANCE)).toBe('ALLOWED:Default');
  });

  it('turns no rule on', () => {
    for (const name of RULE_AUTH_NAMES) expect(IsFinanceExceptionRuleGranted(context, name)).toBe(false);
  });
});

describe('the section 4 configuration', () => {
  const context = buildContext(SECTION_4);

  it.each([
    ['WON_DEAL_ORDER_NOT_CONFIRMED', SENIOR, 'ALLOWED:Type'],
    ['WON_DEAL_ORDER_NOT_CONFIRMED', FINANCE, 'TYPE_NOT_AUTHORIZED'],
    ['OVERLAPPING_SUBSCRIPTION', SENIOR, 'ALLOWED:Type'],
    ['OVERLAPPING_SUBSCRIPTION', CFO, 'TYPE_NOT_AUTHORIZED'],
    ['ERP_POSTING_NOT_READ_BACK', SENIOR, 'ALLOWED:Type'],
    ['ERP_POSTING_NOT_READ_BACK', FINANCE, 'TYPE_NOT_AUTHORIZED'],
    ['PROGRESS_UNATTESTED', SUPERVISOR, 'ALLOWED:Type'],
    ['PROGRESS_UNATTESTED', SENIOR, 'ALLOWED:Type'],
    ['PROGRESS_UNATTESTED', FINANCE, 'TYPE_NOT_AUTHORIZED'],
    ['PROGRESS_JUDGMENT_CALL', SUPERVISOR, 'ALLOWED:Type'],
    ['PROGRESS_JUDGMENT_CALL', SENIOR, 'TYPE_NOT_AUTHORIZED'],
    ['PRICE_BELOW_ENGINE_UNAPPROVED', CFO, 'ALLOWED:Type'],
    ['PRICE_BELOW_ENGINE_UNAPPROVED', SENIOR, 'TYPE_NOT_AUTHORIZED'],
  ] as const)('%s cleared by %s → %s', (code, reviewer, expected) => {
    expect(decide(context, subject({ TypeCode: code }), reviewer)).toBe(expected);
  });

  it('does not let the default right stand in for a per-type right', () => {
    expect(decide(context, subject({ TypeCode: 'PRICE_BELOW_ENGINE_UNAPPROVED' }), FINANCE)).toBe('TYPE_NOT_AUTHORIZED');
  });

  it('falls back to the default right for a type with no per-type grant', () => {
    expect(decide(context, subject({ TypeCode: 'SOME_FUTURE_TYPE' }), FINANCE)).toBe('ALLOWED:Default');
  });

  it('sends an unresolved creator to the unattributed right, whatever the type', () => {
    const s = subject({ TypeCode: 'PRICE_BELOW_ENGINE_UNAPPROVED', SourceCreatedByUserID: null, CreatorUnresolved: true });
    expect(decide(context, s, SENIOR)).toBe('ALLOWED:Unattributed');
    expect(decide(context, s, CFO)).toBe('UNATTRIBUTED_NOT_AUTHORIZED');
  });

  it('sends a system-created record to the unattributed right (GUID case ignored)', () => {
    const s = subject({ TypeCode: 'PROGRESS_JUDGMENT_CALL', SourceCreatedByUserID: SYSTEM_USER_ID.toLowerCase() });
    expect(decide(context, s, SENIOR)).toBe('ALLOWED:Unattributed');
    expect(decide(context, s, SUPERVISOR)).toBe('UNATTRIBUTED_NOT_AUTHORIZED');
  });

  it("escalates a senior reviewer's own work to the escalated right, past the type rule", () => {
    const s = subject({ TypeCode: 'OVERLAPPING_SUBSCRIPTION', SourceCreatedByUserID: SENIOR.ID });
    expect(decide(context, s, SENIOR_2)).toBe('ESCALATED_NOT_AUTHORIZED');
    expect(decide(context, s, CFO)).toBe('ALLOWED:Escalated');
  });

  it('escalates when the creator is not in the user cache, since the marker cannot be ruled out', () => {
    expect(decide(context, subject({ SourceCreatedByUserID: 'U-GONE' }), CFO)).toBe('ALLOWED:Escalated');
  });

  it('does not escalate a creator who lacks the marker', () => {
    expect(decide(context, subject({ SourceCreatedByUserID: FINANCE.ID }), SENIOR)).toBe('ALLOWED:Type');
  });

  it('names the right and the roles granted it when refusing', () => {
    const resolution = ResolveFinanceExceptionClearRule(subject({ TypeCode: 'PRICE_BELOW_ENGINE_UNAPPROVED' }), context);
    if (!('Rule' in resolution)) throw new Error('expected a rule');
    const refusal = FinanceExceptionClearRuleRefusal(context, resolution.Rule, 'PRICE_BELOW_ENGINE_UNAPPROVED');
    expect(refusal.Code).toBe('TYPE_NOT_AUTHORIZED');
    expect(refusal.Message).toContain('MJ.BizApps.Accounting.FinanceExceptions.ClearType.PRICE_BELOW_ENGINE_UNAPPROVED');
    expect(refusal.Message).toContain('(granted to: CFO)');
  });
});

describe('escalation shared by the CFO and the senior finance leads (creator never clears)', () => {
  // EscalatedCreator and ClearEscalated both granted to CFO and Senior Finance (AR): an exception on a
  // record one of them created is cleared by one of the others, never by its creator, whatever the type.
  const SHARED_ESCALATION: Grants = {
    ...SECTION_4,
    [FINANCE_EXCEPTIONS_ESCALATED_CREATOR_AUTH]: { allow: ['CFO', 'SeniorAR'] },
    [FINANCE_EXCEPTIONS_CLEAR_ESCALATED_AUTH]: { allow: ['CFO', 'SeniorAR'] },
  };
  const context = buildContext(SHARED_ESCALATION);

  it.each(TYPE_CODES)('a CFO-created %s exception is cleared by Senior Finance, not by Finance', code => {
    const s = subject({ TypeCode: code, SourceCreatedByUserID: CFO.ID });
    expect(decide(context, s, SENIOR)).toBe('ALLOWED:Escalated');
    expect(decide(context, s, FINANCE)).toBe('ESCALATED_NOT_AUTHORIZED');
    expect(decide(context, s, SUPERVISOR)).toBe('ESCALATED_NOT_AUTHORIZED');
  });

  it('keeps a CFO-created exception of a CFO-only type clearable (Type first would leave only the creator)', () => {
    const s = subject({ TypeCode: 'PRICE_BELOW_ENGINE_UNAPPROVED', SourceCreatedByUserID: CFO.ID });
    expect(decide(context, s, SENIOR)).toBe('ALLOWED:Escalated');
    // Without the shared escalation the only holder of the type right is the creator.
    expect(decide(buildContext(SECTION_4), s, SENIOR)).toBe('TYPE_NOT_AUTHORIZED');
  });

  it('sends a Senior-Finance-created exception to the CFO or another Senior Finance holder', () => {
    const s = subject({ TypeCode: 'OVERLAPPING_SUBSCRIPTION', SourceCreatedByUserID: SENIOR.ID });
    expect(decide(context, s, CFO)).toBe('ALLOWED:Escalated');
    expect(decide(context, s, SENIOR_2)).toBe('ALLOWED:Escalated');
    expect(decide(context, s, FINANCE)).toBe('ESCALATED_NOT_AUTHORIZED');
  });

  it("names both roles in the refusal", () => {
    const resolution = ResolveFinanceExceptionClearRule(subject({ SourceCreatedByUserID: CFO.ID }), context);
    if (!('Rule' in resolution)) throw new Error('expected a rule');
    expect(FinanceExceptionClearRuleRefusal(context, resolution.Rule, 'WON_DEAL_ORDER_NOT_CONFIRMED').Message).toContain(
      '(granted to: CFO, Senior Finance (AR))',
    );
  });
  // That the creator themself is refused is the operation's check (CREATOR_CANNOT_CLEAR), pinned in
  // FinanceExceptionOperations.test.ts, which runs before this rule is consulted.
});

describe('the grant row Type is read the way MJ reads it', () => {
  it.each(['allow', 'ALLOW', ' Allow '])('a %j grant turns the type rule on, so the default right no longer clears it', allowAs => {
    const context = buildContext({
      ...PACKAGE_DEFAULT,
      [FinanceExceptionClearTypeAuthName('PRICE_BELOW_ENGINE_UNAPPROVED')]: { allow: ['CFO'], allowAs },
    });
    const s = subject({ TypeCode: 'PRICE_BELOW_ENGINE_UNAPPROVED' });
    expect(IsFinanceExceptionRuleGranted(context, FinanceExceptionClearTypeAuthName('PRICE_BELOW_ENGINE_UNAPPROVED'))).toBe(true);
    expect(decide(context, s, FINANCE)).toBe('TYPE_NOT_AUTHORIZED');
    expect(decide(context, s, CFO)).toBe('ALLOWED:Type');
  });

  it('names a role granted by a non-canonical Allow row in the refusal', () => {
    const context = buildContext({
      ...PACKAGE_DEFAULT,
      [FinanceExceptionClearTypeAuthName('PRICE_BELOW_ENGINE_UNAPPROVED')]: { allow: ['CFO'], allowAs: 'allow' },
    });
    const resolution = ResolveFinanceExceptionClearRule(subject({ TypeCode: 'PRICE_BELOW_ENGINE_UNAPPROVED' }), context);
    if (!('Rule' in resolution)) throw new Error('expected a rule');
    expect(FinanceExceptionClearRuleRefusal(context, resolution.Rule, 'PRICE_BELOW_ENGINE_UNAPPROVED').Message).toContain('(granted to: CFO)');
  });
});

describe('partial and unusual configurations', () => {
  it('ignores escalation unless both the marker and the escalated right are granted', () => {
    const context = buildContext({
      ...PACKAGE_DEFAULT,
      [FINANCE_EXCEPTIONS_ESCALATED_CREATOR_AUTH]: { allow: ['SeniorAR'] },
    });
    expect(decide(context, subject({ SourceCreatedByUserID: SENIOR.ID }), FINANCE)).toBe('ALLOWED:Default');
  });

  it('treats an inactive per-type right as off, so the default applies', () => {
    const context = buildContext({
      ...PACKAGE_DEFAULT,
      [FinanceExceptionClearTypeAuthName('WON_DEAL_ORDER_NOT_CONFIRMED')]: { allow: ['SeniorAR'], inactive: true },
    });
    expect(decide(context, subject(), FINANCE)).toBe('ALLOWED:Default');
  });

  it('lets a host say "nobody clears this type" by granting it to a role none of the reviewers hold', () => {
    // A rule is ON while it has an Allow row; whether anyone holds that role does not matter.
    const context = buildContext({ ...PACKAGE_DEFAULT, [FinanceExceptionClearTypeAuthName('WON_DEAL_ORDER_NOT_CONFIRMED')]: { allow: ['Seller'] } });
    for (const reviewer of [FINANCE, SENIOR, CFO, SUPERVISOR]) {
      expect(decide(context, subject({ SourceCreatedByUserID: FINANCE.ID === reviewer.ID ? CFO.ID : FINANCE.ID }), reviewer)).toBe('TYPE_NOT_AUTHORIZED');
    }
  });

  it('treats a right granted only by Deny rows as off', () => {
    const context = buildContext({
      ...PACKAGE_DEFAULT,
      [FinanceExceptionClearTypeAuthName('WON_DEAL_ORDER_NOT_CONFIRMED')]: { deny: ['Finance'] },
    });
    expect(IsFinanceExceptionRuleGranted(context, FinanceExceptionClearTypeAuthName('WON_DEAL_ORDER_NOT_CONFIRMED'))).toBe(false);
  });

  it('lets a Deny on one of the reviewer\'s roles win over an Allow on another', () => {
    const context = buildContext({
      ...PACKAGE_DEFAULT,
      [FinanceExceptionClearTypeAuthName('WON_DEAL_ORDER_NOT_CONFIRMED')]: { allow: ['SeniorAR'], deny: ['Finance'] },
    });
    expect(decide(context, subject(), SENIOR)).toBe('TYPE_NOT_AUTHORIZED');
  });

  it('refuses an unresolved creator recorded as the system user while the unattributed right is ungranted', () => {
    const context = buildContext(PACKAGE_DEFAULT);
    expect(decide(context, subject({ SourceCreatedByUserID: SYSTEM_USER_ID, CreatorUnresolved: true }), FINANCE)).toBe('CREATOR_UNRESOLVED');
  });

  it('works without a role list, leaving the role names out of the message', () => {
    const context = { ...buildContext(SECTION_4), Roles: undefined };
    const refusal = FinanceExceptionClearRuleRefusal(context, { Kind: 'Escalated', AuthorizationName: FINANCE_EXCEPTIONS_CLEAR_ESCALATED_AUTH }, 'X');
    expect(refusal).toEqual({ Code: 'ESCALATED_NOT_AUTHORIZED', Message: expect.not.stringContaining('granted to') });
  });

  it('refuses everyone when the catalog has none of the rights', () => {
    const context: FinanceExceptionClearContext = { Authorizations: [], AuthorizationRoles: [], SystemUserID: null, FindUser: () => undefined };
    expect(decide(context, subject(), FINANCE)).toBe('NOT_AUTHORIZED');
    expect(HoldsAnyFinanceExceptionClearRight(context, FINANCE)).toBe(false);
  });
});

describe('HoldsAnyFinanceExceptionClearRight (the pre-read gate)', () => {
  const context = buildContext(SECTION_4);

  it('admits a holder of the default right or of any clearing rule right', () => {
    expect(HoldsAnyFinanceExceptionClearRight(context, FINANCE)).toBe(true);
    expect(HoldsAnyFinanceExceptionClearRight(context, SUPERVISOR)).toBe(true);
    expect(HoldsAnyFinanceExceptionClearRight(context, CFO)).toBe(true);
  });

  it('refuses a user with no clearing right, and a missing user', () => {
    expect(HoldsAnyFinanceExceptionClearRight(context, SELLER)).toBe(false);
    expect(HoldsAnyFinanceExceptionClearRight(context, null)).toBe(false);
  });

  it('does not count the escalated-creator marker as a right', () => {
    const markerOnly = buildContext({ [FINANCE_EXCEPTIONS_ESCALATED_CREATOR_AUTH]: { allow: ['SeniorAR'] } });
    expect(HoldsAnyFinanceExceptionClearRight(markerOnly, user('U-MARKER', 'SeniorAR'))).toBe(false);
  });
});
