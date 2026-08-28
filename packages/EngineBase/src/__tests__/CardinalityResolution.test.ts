/**
 * Unit tests for BA-D34 cardinality on ResolveLinkedAccount / ResolveLinkedAccounts.
 *
 * The cached collections are stubbed by shadowing getters on an instance, so no DB.
 * Live coverage (two BankAccount links + one Cash, Save-path tie-guard skip, posting
 * still uses Cash) lives in test-harnesses/server/engine-runtime.ts E5.
 */
import { describe, it, expect } from 'vitest';
import {
  AccountingEngineBase,
  AccountingResolutionError,
  isAccountingResolutionError,
} from '../AccountingEngineBase.js';

const COMPANY = 'aaaaaaaa-0000-0000-0000-000000000001';
const ENTITY = 'bbbbbbbb-0000-0000-0000-00000000000e';
const RECORD = 'cccccccccccccccccccccccccccccccccccc';
const CASH_ROLE = 'c00a0d5b-c267-4d38-a384-20be6fb813e4';
const BANK_ROLE = '069b34e1-90c5-4275-a79a-f9ef71be472f';
const CASH_GL = '11111111-0000-0000-0000-000000001110';
const BANK_OP = '11111111-0000-0000-0000-000000001111';
const BANK_PAY = '11111111-0000-0000-0000-000000001112';
const OTHER_CO_BANK = '22222222-0000-0000-0000-000000002222';
const OTHER_CO = 'dddddddd-0000-0000-0000-00000000000d';

const d = (iso: string): Date => new Date(iso);

interface RoleRow {
  ID: string;
  Name: string;
  Cardinality: 'One' | 'Many';
}
interface LinkRow {
  ID: string;
  EntityID: string;
  RecordID: string;
  GLAccountRoleID: string;
  GLAccountID: string;
  Status: 'Active' | 'Pending' | 'Disabled';
  StartedAt: Date | null;
  EndedAt: Date | null;
}
interface AccountRow {
  ID: string;
  CompanyID: string;
}

function engineWith(
  roles: RoleRow[],
  links: LinkRow[],
  accounts: AccountRow[] = [
    { ID: CASH_GL, CompanyID: COMPANY },
    { ID: BANK_OP, CompanyID: COMPANY },
    { ID: BANK_PAY, CompanyID: COMPANY },
    { ID: OTHER_CO_BANK, CompanyID: OTHER_CO },
  ],
): AccountingEngineBase {
  const engine = Object.create(AccountingEngineBase.prototype) as AccountingEngineBase;
  Object.defineProperty(engine, 'GLAccountRoles', { get: () => roles });
  Object.defineProperty(engine, 'GLAccountLinks', { get: () => links });
  Object.defineProperty(engine, 'GLAccountLinkDimensions', { get: () => [] });
  Object.defineProperty(engine, 'GLAccounts', { get: () => accounts });
  return engine;
}

const roles: RoleRow[] = [
  { ID: CASH_ROLE, Name: 'Cash', Cardinality: 'One' },
  { ID: BANK_ROLE, Name: 'BankAccount', Cardinality: 'Many' },
];

const cashLink = (over: Partial<LinkRow> = {}): LinkRow => ({
  ID: 'link-cash',
  EntityID: ENTITY,
  RecordID: RECORD,
  GLAccountRoleID: CASH_ROLE,
  GLAccountID: CASH_GL,
  Status: 'Active',
  StartedAt: null,
  EndedAt: null,
  ...over,
});

const bankLink = (over: Partial<LinkRow> = {}): LinkRow => ({
  ID: 'link-bank-op',
  EntityID: ENTITY,
  RecordID: RECORD,
  GLAccountRoleID: BANK_ROLE,
  GLAccountID: BANK_OP,
  Status: 'Active',
  StartedAt: null,
  EndedAt: null,
  ...over,
});

describe('ResolveLinkedAccount — Cardinality', () => {
  it('still resolves Cash (One) to the settlement account', () => {
    const engine = engineWith(roles, [cashLink(), bankLink(), bankLink({ ID: 'link-bank-pay', GLAccountID: BANK_PAY })]);
    const hit = engine.ResolveLinkedAccount(ENTITY, RECORD, 'Cash', d('2026-08-28'), COMPANY);
    expect(hit?.Link.GLAccountID).toBe(CASH_GL);
  });

  it('throws ROLE_NOT_SINGULAR for BankAccount rather than picking an arbitrary bank', () => {
    const engine = engineWith(roles, [bankLink(), bankLink({ ID: 'link-bank-pay', GLAccountID: BANK_PAY })]);
    expect(() => engine.ResolveLinkedAccount(ENTITY, RECORD, 'BankAccount', d('2026-08-28'), COMPANY)).toThrow(
      AccountingResolutionError,
    );
    try {
      engine.ResolveLinkedAccount(ENTITY, RECORD, 'BankAccount', d('2026-08-28'), COMPANY);
    } catch (e) {
      expect(isAccountingResolutionError(e)).toBe(true);
      expect((e as AccountingResolutionError).Code).toBe('ROLE_NOT_SINGULAR');
      expect((e as Error).message).toMatch(/ResolveLinkedAccounts/);
    }
  });

  it('throws by role ID as well as by name', () => {
    const engine = engineWith(roles, [bankLink()]);
    expect(() => engine.ResolveLinkedAccount(ENTITY, RECORD, BANK_ROLE, d('2026-08-28'))).toThrow(AccountingResolutionError);
  });

  it('unknown role still returns null (caller walks its fallback chain)', () => {
    const engine = engineWith(roles, [cashLink()]);
    expect(engine.ResolveLinkedAccount(ENTITY, RECORD, 'No Such Role', d('2026-08-28'))).toBeNull();
  });
});

describe('ResolveLinkedAccounts — Many set / One winner', () => {
  it('returns every covering BankAccount link, not a winner', () => {
    const engine = engineWith(roles, [
      bankLink(),
      bankLink({ ID: 'link-bank-pay', GLAccountID: BANK_PAY }),
      bankLink({ ID: 'link-pending', GLAccountID: BANK_OP, Status: 'Pending' }),
      bankLink({ ID: 'link-future', GLAccountID: BANK_PAY, StartedAt: d('2026-09-01') }),
    ]);
    const set = engine.ResolveLinkedAccounts(ENTITY, RECORD, 'BankAccount', d('2026-08-28'), COMPANY);
    expect(set.map((r) => r.Link.ID).sort()).toEqual(['link-bank-op', 'link-bank-pay']);
  });

  it('scopes Many links by forCompanyID', () => {
    const engine = engineWith(roles, [
      bankLink(),
      bankLink({ ID: 'link-other', GLAccountID: OTHER_CO_BANK }),
    ]);
    const mine = engine.ResolveLinkedAccounts(ENTITY, RECORD, BANK_ROLE, d('2026-08-28'), COMPANY);
    expect(mine.map((r) => r.Link.GLAccountID)).toEqual([BANK_OP]);
  });

  it('returns empty when a Many role has no covering link (caller decides if that is fatal)', () => {
    const engine = engineWith(roles, [bankLink({ StartedAt: d('2026-09-01') })]);
    expect(engine.ResolveLinkedAccounts(ENTITY, RECORD, 'BankAccount', d('2026-08-28'))).toEqual([]);
  });

  it('for a One role returns the latest-StartedAt winner as a 0-or-1 array, not every overlapping window', () => {
    const engine = engineWith(roles, [
      cashLink({ ID: 'cash-old', StartedAt: d('2026-01-01') }),
      cashLink({ ID: 'cash-new', StartedAt: d('2026-06-01'), GLAccountID: CASH_GL }),
    ]);
    const set = engine.ResolveLinkedAccounts(ENTITY, RECORD, 'Cash', d('2026-08-28'));
    expect(set.map((r) => r.Link.ID)).toEqual(['cash-new']);
  });
});
