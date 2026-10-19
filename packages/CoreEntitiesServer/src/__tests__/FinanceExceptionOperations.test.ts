/**
 * golive #279 — the finance exception operations. No database: the provider is a stub that
 * answers the type catalog, the locking reads and entity creation, and records what was written,
 * whether a transaction was opened, and the order of transaction and SQL calls.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AuthorizationRoleInfo } from '@memberjunction/core';
import type { AuthorizationInfo, EntityInfo, IMetadataProvider, RemoteOpServerContext, UserInfo } from '@memberjunction/core';
import type { AccountingFinanceExceptionToRaise } from '@mj-biz-apps/accounting-entities';

const SYSTEM_USER = { ID: '00000000-0000-4000-8000-00000000000a', Name: 'System' } as UserInfo;
const cachedUsers = vi.hoisted(() => ({ list: [] as UserInfo[] }));
vi.mock('@memberjunction/generic-database-provider', () => ({
  UserCache: { Instance: { GetSystemUser: () => SYSTEM_USER, get Users() { return cachedUsers.list; } } },
}));

import {
  ClearFinanceExceptionOperation,
  GetFinanceExceptionTypesOperation,
  RaiseFinanceExceptionsOperation,
} from '../FinanceExceptionOperations.js';
import {
  FINANCE_EXCEPTIONS_CLEAR_AUTH,
  FINANCE_EXCEPTIONS_CLEAR_ESCALATED_AUTH,
  FINANCE_EXCEPTIONS_CLEAR_UNATTRIBUTED_AUTH,
  FINANCE_EXCEPTIONS_ESCALATED_CREATOR_AUTH,
  FinanceExceptionClearTypeAuthName,
} from '../FinanceExceptionClearPolicy.js';

const COMPANY = '11111111-1111-4111-8111-111111111111';
const CREATOR = '22222222-2222-4222-8222-222222222222';
const REVIEWER = { ID: '33333333-3333-4333-8333-333333333333', Name: 'Reviewer' } as UserInfo;
const OUTSIDER = { ID: '44444444-4444-4444-8444-444444444444', Name: 'Outsider' } as UserInfo;
const SUPERVISOR = { ID: '88888888-8888-4888-8888-888888888888', Name: 'Supervisor' } as UserInfo;
const EXCEPTION_ID = '55555555-5555-4555-8555-555555555555';
const ORDER_LINES = { ID: '66666666-6666-4666-8666-666666666666', Name: 'MJ_BizApps_Orders: Order Lines' };

const TYPES = [
  { ID: 'AAAAAAAA-0000-4000-8000-000000000001', Code: 'PRICE_BELOW_ENGINE_UNAPPROVED', IsActive: true, Configuration: '{}' },
  { ID: 'AAAAAAAA-0000-4000-8000-000000000002', Code: 'PROGRESS_UNATTESTED', IsActive: false, Configuration: '{"MaxDaysWithoutAttestation":35}' },
];

interface WrittenRow {
  ID: string;
  Status?: string;
  FinanceExceptionTypeID?: string;
  DedupeKey?: string;
  SourceEntityID?: string;
  CreatorUnresolved?: boolean;
  SourceCreatedByUserID?: string | null;
  Summary?: string;
  ReviewedByUserID?: string | null;
  ReviewedAt?: Date | null;
  ReviewNote?: string | null;
  LatestResult?: { CompleteMessage: string };
  NewRecord: () => void;
  Load: (id: string) => Promise<boolean>;
  Save: () => Promise<boolean>;
}

interface StubOptions {
  existing?: Array<{
    ID: string;
    FinanceExceptionTypeID: string;
    DedupeKey: string;
    Status?: string;
    SourceCreatedByUserID?: string | null;
    CreatorUnresolved?: boolean;
  }>;
  transactionDepth?: number;
  saveSucceeds?: boolean;
  stored?: Partial<WrittenRow> | null;
  authHolders?: string[];
  /** Rule rights a host has granted: each is held by `holders` and counts as granted. */
  grantedRules?: Array<{ Name: string; holders: string[] }>;
}

function stubProvider(options: StubOptions = {}) {
  const saved: WrittenRow[] = [];
  const calls: string[] = [];
  const tx = {
    begin: vi.fn(async () => void calls.push('begin')),
    commit: vi.fn(async () => void calls.push('commit')),
    rollback: vi.fn(async () => void calls.push('rollback')),
  };
  const executeSQL = vi.fn(async (sql: string) => {
    calls.push('sql');
    return /FinanceExceptionTypeID/.test(sql) ? (options.existing ?? []) : [];
  });
  const getEntityObject = vi.fn(async () => {
    const row: WrittenRow = {
      ID: '',
      NewRecord: () => undefined,
      Load: async () => {
        if (!options.stored) return false;
        Object.assign(row, options.stored);
        return true;
      },
      Save: async () => {
        if (options.saveSucceeds === false) {
          row.LatestResult = { CompleteMessage: 'duplicate key' };
          return false;
        }
        row.ID = row.ID || `NEW-${saved.length + 1}`;
        saved.push(row);
        return true;
      },
    };
    return row;
  });
  const holders = options.authHolders ?? [REVIEWER.ID];
  const auth = { ID: 'AUTH-1', Name: FINANCE_EXCEPTIONS_CLEAR_AUTH, ParentID: null, IsActive: true, UserCanExecute: (u: UserInfo) => holders.includes(u.ID) };
  const rules = (options.grantedRules ?? []).map((r, i) => ({
    ID: `AUTH-RULE-${i}`,
    Name: r.Name,
    ParentID: null,
    IsActive: true,
    UserCanExecute: (u: UserInfo) => r.holders.includes(u.ID),
  }));
  const provider = {
    Entities: [ORDER_LINES] as unknown as EntityInfo[],
    Authorizations: [auth, ...rules] as unknown as AuthorizationInfo[],
    AuthorizationRoles: rules.map(r => new AuthorizationRoleInfo({ AuthorizationID: r.ID, RoleID: 'ROLE-ANY', Type: 'Allow' })),
    TransactionDepth: options.transactionDepth ?? 0,
    BeginTransaction: tx.begin,
    CommitTransaction: tx.commit,
    RollbackTransaction: tx.rollback,
    RunView: vi.fn(async () => ({ Success: true, Results: TYPES })),
    ExecuteSQL: executeSQL,
    GetEntityObject: getEntityObject,
  };
  return { provider: provider as unknown as IMetadataProvider, raw: provider, saved, tx, getEntityObject, executeSQL, calls };
}

function raise(overrides: Partial<AccountingFinanceExceptionToRaise> = {}): AccountingFinanceExceptionToRaise {
  return {
    TypeCode: 'PRICE_BELOW_ENGINE_UNAPPROVED',
    SourceEntityName: ORDER_LINES.Name,
    SourceRecordID: '77777777-7777-4777-8777-777777777777',
    CompanyID: COMPANY,
    Amount: 125.5,
    ExceptionDate: '2026-09-28',
    Summary: 'Unit price is below the pricing engine result and has no approval.',
    DedupeKey: '77777777-7777-4777-8777-777777777777',
    SourceCreatedByUserID: CREATOR,
    ...overrides,
  };
}

function context(provider: IMetadataProvider, user: UserInfo = REVIEWER): RemoteOpServerContext {
  return { provider, user } as unknown as RemoteOpServerContext;
}

describe('Accounting.RaiseFinanceExceptions', () => {
  it('creates a new exception Open, in its own transaction when the caller has none', async () => {
    const s = stubProvider();
    const result = await new RaiseFinanceExceptionsOperation().ExecuteServer({ Exceptions: [raise()] }, context(s.provider));
    expect(result.Success).toBe(true);
    expect(result.Output).toEqual({ Success: true, Results: [{ Index: 0, FinanceExceptionID: 'NEW-1', Created: true }] });
    expect(s.saved[0]).toMatchObject({ Status: 'Open', FinanceExceptionTypeID: TYPES[0].ID, SourceEntityID: ORDER_LINES.ID, CreatorUnresolved: false, SourceCreatedByUserID: CREATOR });
    expect(s.tx.begin).toHaveBeenCalledTimes(1);
    expect(s.tx.commit).toHaveBeenCalledTimes(1);
    expect(s.getEntityObject).toHaveBeenCalledWith('MJ_BizApps_Accounting: Finance Exceptions', SYSTEM_USER);
  });

  it('is idempotent on (TypeCode, DedupeKey): an existing row is returned unchanged, and a repeat in one call reuses the first', async () => {
    const s = stubProvider({
      existing: [{ ID: 'EXISTING-1', FinanceExceptionTypeID: TYPES[0].ID, DedupeKey: 'KEY-A', Status: 'Open', SourceCreatedByUserID: CREATOR, CreatorUnresolved: false }],
    });
    const result = await new RaiseFinanceExceptionsOperation().ExecuteServer(
      { Exceptions: [raise({ DedupeKey: 'KEY-A' }), raise({ DedupeKey: 'KEY-B' }), raise({ DedupeKey: 'KEY-B' })] },
      context(s.provider),
    );
    expect(result.Output?.Success).toBe(true);
    expect(result.Output?.Results).toEqual([
      { Index: 0, FinanceExceptionID: 'EXISTING-1', Created: false },
      { Index: 1, FinanceExceptionID: 'NEW-1', Created: true },
      { Index: 2, FinanceExceptionID: 'NEW-1', Created: false },
    ]);
    expect(s.saved).toHaveLength(1);
  });

  it('refreshes an Open row whose creator has since been resolved', async () => {
    const existing = { ID: 'EXISTING-1', FinanceExceptionTypeID: TYPES[0].ID, DedupeKey: 'KEY-A', Status: 'Open', SourceCreatedByUserID: null, CreatorUnresolved: true };
    const s = stubProvider({ existing: [existing], stored: { ...existing, Summary: 'Owner has no linked login.' } });
    const result = await new RaiseFinanceExceptionsOperation().ExecuteServer(
      { Exceptions: [raise({ DedupeKey: 'KEY-A', SourceCreatedByUserID: CREATOR, CreatorUnresolved: false, Summary: 'Owner resolved.' })] },
      context(s.provider),
    );
    expect(result.Output?.Results).toEqual([{ Index: 0, FinanceExceptionID: 'EXISTING-1', Created: false }]);
    expect(s.saved).toHaveLength(1);
    expect(s.saved[0]).toMatchObject({ ID: 'EXISTING-1', Status: 'Open', SourceCreatedByUserID: CREATOR, CreatorUnresolved: false, Summary: 'Owner resolved.' });
  });

  it('never touches a Reviewed or Corrected row, even when the creator differs', async () => {
    const existing = { ID: 'EXISTING-1', FinanceExceptionTypeID: TYPES[0].ID, DedupeKey: 'KEY-A', Status: 'Reviewed', SourceCreatedByUserID: null, CreatorUnresolved: true };
    const s = stubProvider({ existing: [existing], stored: existing });
    const result = await new RaiseFinanceExceptionsOperation().ExecuteServer(
      { Exceptions: [raise({ DedupeKey: 'KEY-A', SourceCreatedByUserID: CREATOR })] },
      context(s.provider),
    );
    expect(result.Output?.Results).toEqual([{ Index: 0, FinanceExceptionID: 'EXISTING-1', Created: false }]);
    expect(s.saved).toHaveLength(0);
    expect(s.getEntityObject).not.toHaveBeenCalled();
  });

  it('reads existing rows under a key-range update lock inside its transaction', async () => {
    const s = stubProvider();
    await new RaiseFinanceExceptionsOperation().ExecuteServer({ Exceptions: [raise()] }, context(s.provider));
    expect(s.calls).toEqual(['begin', 'sql', 'commit']);
    const [sql] = s.executeSQL.mock.calls[0];
    expect(sql).toMatch(/FROM __mj_BizAppsAccounting\.FinanceException WITH \(UPDLOCK, HOLDLOCK\)/);
    expect(sql).toContain(`FinanceExceptionTypeID = '${TYPES[0].ID}' AND DedupeKey IN (N'77777777-7777-4777-8777-777777777777')`);
  });

  it('is limited to the system user when called through the API; the other two operations are not', () => {
    expect(new RaiseFinanceExceptionsOperation().RequiresSystemUser).toBe(true);
    expect(new ClearFinanceExceptionOperation().RequiresSystemUser).toBe(false);
    expect(new GetFinanceExceptionTypesOperation().RequiresSystemUser).toBe(false);
  });

  it("joins the caller's transaction instead of opening one", async () => {
    const s = stubProvider({ transactionDepth: 1 });
    const result = await new RaiseFinanceExceptionsOperation().ExecuteServer({ Exceptions: [raise()] }, context(s.provider));
    expect(result.Output?.Success).toBe(true);
    expect(s.tx.begin).not.toHaveBeenCalled();
    expect(s.tx.commit).not.toHaveBeenCalled();
  });

  it('skips an inactive type and writes nothing for it', async () => {
    const s = stubProvider();
    const result = await new RaiseFinanceExceptionsOperation().ExecuteServer(
      { Exceptions: [raise({ TypeCode: 'PROGRESS_UNATTESTED' })] },
      context(s.provider),
    );
    expect(result.Output).toEqual({ Success: true, Results: [{ Index: 0, Created: false, Skipped: true }] });
    expect(s.saved).toHaveLength(0);
    expect(s.getEntityObject).not.toHaveBeenCalled();
  });

  it('fails the whole call and writes nothing when any entry names an unknown type or entity', async () => {
    const s = stubProvider();
    const result = await new RaiseFinanceExceptionsOperation().ExecuteServer(
      { Exceptions: [raise(), raise({ TypeCode: 'NO_SUCH_TYPE' }), raise({ SourceEntityName: 'No Such Entity' })] },
      context(s.provider),
    );
    expect(result.Output?.Success).toBe(false);
    expect(result.Output?.Results).toEqual([]);
    expect(result.Output?.Errors).toEqual([
      expect.objectContaining({ Index: 1, Code: 'TYPE_UNKNOWN' }),
      expect.objectContaining({ Index: 2, Code: 'SOURCE_ENTITY_UNKNOWN' }),
    ]);
    expect(s.getEntityObject).not.toHaveBeenCalled();
    expect(s.tx.begin).not.toHaveBeenCalled();
  });

  it('refuses a malformed entry before writing anything', async () => {
    const s = stubProvider();
    const result = await new RaiseFinanceExceptionsOperation().ExecuteServer(
      { Exceptions: [raise({ ExceptionDate: '28/09/2026', CompanyID: "x' OR 1=1 --" })] },
      context(s.provider),
    );
    expect(result.Output?.Success).toBe(false);
    expect(result.Output?.Errors?.map(e => e.Code)).toEqual(['COMPANY_INVALID', 'EXCEPTION_DATE_INVALID']);
    expect(s.getEntityObject).not.toHaveBeenCalled();
  });

  it('rolls its own transaction back when a write fails', async () => {
    const s = stubProvider({ saveSucceeds: false });
    const result = await new RaiseFinanceExceptionsOperation().ExecuteServer({ Exceptions: [raise()] }, context(s.provider));
    expect(result.Output?.Success).toBe(false);
    expect(result.Output?.Errors?.[0].Code).toBe('WRITE_FAILED');
    expect(s.tx.rollback).toHaveBeenCalledTimes(1);
    expect(s.tx.commit).not.toHaveBeenCalled();
  });
});

describe('Accounting.ClearFinanceException', () => {
  const openRow = (overrides: Partial<WrittenRow> = {}): Partial<WrittenRow> => ({
    ID: EXCEPTION_ID,
    FinanceExceptionTypeID: TYPES[0].ID,
    Status: 'Open',
    SourceCreatedByUserID: CREATOR,
    CreatorUnresolved: false,
    ...overrides,
  });
  const clear = (s: ReturnType<typeof stubProvider>, input: Record<string, unknown>, user: UserInfo = REVIEWER) =>
    new ClearFinanceExceptionOperation().ExecuteServer(
      { FinanceExceptionID: EXCEPTION_ID, Outcome: 'Reviewed', Note: 'Checked the approval email.', ...input } as never,
      context(s.provider, user),
    );

  it('refuses a caller without the clear authorization, before reading anything', async () => {
    const s = stubProvider({ stored: openRow() });
    const result = await clear(s, {}, OUTSIDER);
    expect(result.Output?.Success).toBe(false);
    expect(result.Output?.Errors?.[0].Code).toBe('NOT_AUTHORIZED');
    expect(s.getEntityObject).not.toHaveBeenCalled();
  });

  it('refuses without a note', async () => {
    const s = stubProvider({ stored: openRow() });
    const result = await clear(s, { Note: '   ' });
    expect(result.Output?.Errors?.[0].Code).toBe('NOTE_REQUIRED');
    expect(s.saved).toHaveLength(0);
  });

  it("refuses the source record's creator", async () => {
    const s = stubProvider({ stored: openRow({ SourceCreatedByUserID: REVIEWER.ID.toUpperCase() }) });
    const result = await clear(s, {});
    expect(result.Output?.Success).toBe(false);
    expect(result.Output?.Errors?.[0].Code).toBe('CREATOR_CANNOT_CLEAR');
    expect(s.saved).toHaveLength(0);
  });

  it("refuses the source record's creator whatever the GUID casing", async () => {
    // Hex letters in the ID, so the casings genuinely differ (an all-digit ID would not test this).
    const lettered = { ID: 'CFCFCFCF-ABCD-4EF0-8ABC-DEFABCDEF012', Name: 'Lettered' } as UserInfo;
    const s = stubProvider({ stored: openRow({ SourceCreatedByUserID: lettered.ID.toLowerCase() }), authHolders: [lettered.ID] });
    const result = await clear(s, {}, lettered);
    expect(result.Output?.Errors?.[0].Code).toBe('CREATOR_CANNOT_CLEAR');
    expect(s.saved).toHaveLength(0);
  });

  it('refuses while the creator has no linked login', async () => {
    const s = stubProvider({ stored: openRow({ SourceCreatedByUserID: null, CreatorUnresolved: true, Summary: 'Deal owner Pat Example has no linked login.' }) });
    const result = await clear(s, {});
    expect(result.Output?.Errors?.[0]).toMatchObject({ Code: 'CREATOR_UNRESOLVED' });
    expect(result.Output?.Errors?.[0].Message).toMatch(/no linked login, so separation of duties cannot be checked/);
    expect(result.Output?.Errors?.[0].Message).toContain('Deal owner Pat Example has no linked login.');
    expect(s.saved).toHaveLength(0);
  });

  it('refuses an exception that is no longer Open', async () => {
    const s = stubProvider({ stored: openRow({ Status: 'Corrected' }) });
    const result = await clear(s, {});
    expect(result.Output).toEqual({ Success: false, Status: 'Corrected', Errors: [expect.objectContaining({ Code: 'NOT_OPEN' })] });
    expect(s.saved).toHaveLength(0);
  });

  it('clears an Open exception, recording the reviewer, time and note', async () => {
    const s = stubProvider({ stored: openRow() });
    const result = await clear(s, { Outcome: 'Corrected', Note: '  Price corrected on the order.  ' });
    expect(result.Output).toEqual({ Success: true, Status: 'Corrected' });
    expect(s.saved[0]).toMatchObject({ Status: 'Corrected', ReviewedByUserID: REVIEWER.ID, ReviewNote: 'Price corrected on the order.' });
    expect(s.saved[0].ReviewedAt).toBeInstanceOf(Date);
  });

  it('locks the row inside its transaction before reading it', async () => {
    const s = stubProvider({ stored: openRow() });
    await clear(s, {});
    expect(s.calls).toEqual(['begin', 'sql', 'commit']);
    const [sql, params] = s.executeSQL.mock.calls[0] as unknown as [string, Record<string, unknown>];
    expect(sql).toMatch(/FROM __mj_BizAppsAccounting\.FinanceException WITH \(UPDLOCK, ROWLOCK\) WHERE ID = @ID/);
    expect(params).toEqual({ ID: EXCEPTION_ID });
  });

  it('refuses a holder of the default right when the type has its own clearing right', async () => {
    const typeRight = FinanceExceptionClearTypeAuthName(TYPES[0].Code);
    const s = stubProvider({ stored: openRow(), grantedRules: [{ Name: typeRight, holders: [SUPERVISOR.ID] }] });
    const result = await clear(s, {});
    expect(result.Output).toEqual({ Success: false, Status: 'Open', Errors: [expect.objectContaining({ Code: 'TYPE_NOT_AUTHORIZED' })] });
    expect(result.Output?.Errors?.[0].Message).toContain(typeRight);
    expect(s.saved).toHaveLength(0);
  });

  it('lets a holder of only a per-type right through the gate and clear that type', async () => {
    const s = stubProvider({
      stored: openRow(),
      authHolders: [],
      grantedRules: [{ Name: FinanceExceptionClearTypeAuthName(TYPES[0].Code), holders: [SUPERVISOR.ID] }],
    });
    const result = await clear(s, {}, SUPERVISOR);
    expect(result.Output).toEqual({ Success: true, Status: 'Reviewed' });
    expect(s.saved[0]).toMatchObject({ ReviewedByUserID: SUPERVISOR.ID });
  });

  it('lets the unattributed right clear an exception whose creator is unresolved', async () => {
    const s = stubProvider({
      stored: openRow({ SourceCreatedByUserID: null, CreatorUnresolved: true }),
      grantedRules: [{ Name: FINANCE_EXCEPTIONS_CLEAR_UNATTRIBUTED_AUTH, holders: [REVIEWER.ID] }],
    });
    const result = await clear(s, {});
    expect(result.Output).toEqual({ Success: true, Status: 'Reviewed' });
  });

  it('refuses a system-created exception to a reviewer without the unattributed right', async () => {
    const s = stubProvider({
      stored: openRow({ SourceCreatedByUserID: SYSTEM_USER.ID }),
      grantedRules: [{ Name: FINANCE_EXCEPTIONS_CLEAR_UNATTRIBUTED_AUTH, holders: [SUPERVISOR.ID] }],
    });
    const result = await clear(s, {});
    expect(result.Output?.Errors?.[0].Code).toBe('UNATTRIBUTED_NOT_AUTHORIZED');
    expect(s.saved).toHaveLength(0);
  });

  it('reports TYPE_UNKNOWN when the exception names a type that cannot be read', async () => {
    const s = stubProvider({ stored: openRow({ FinanceExceptionTypeID: 'AAAAAAAA-0000-4000-8000-0000000000FF' }) });
    const result = await clear(s, {});
    expect(result.Output).toEqual({ Success: false, Status: 'Open', Errors: [expect.objectContaining({ Code: 'TYPE_UNKNOWN' })] });
    expect(s.saved).toHaveLength(0);
  });

  it('reports SAVE_FAILED when the type catalog cannot be read', async () => {
    const s = stubProvider({ stored: openRow() });
    s.raw.RunView.mockResolvedValueOnce({ Success: false, Results: [], ErrorMessage: 'timeout' } as never);
    const result = await clear(s, {});
    expect(result.Output?.Errors?.[0]).toMatchObject({ Code: 'SAVE_FAILED', Message: expect.stringContaining('timeout') });
    expect(s.tx.rollback).toHaveBeenCalledTimes(1);
  });

  it('checks the creator before the rule: a per-type holder still cannot clear their own record', async () => {
    const s = stubProvider({
      stored: openRow({ SourceCreatedByUserID: SUPERVISOR.ID }),
      grantedRules: [{ Name: FinanceExceptionClearTypeAuthName(TYPES[0].Code), holders: [SUPERVISOR.ID] }],
    });
    const result = await clear(s, {}, SUPERVISOR);
    expect(result.Output?.Errors?.[0].Code).toBe('CREATOR_CANNOT_CLEAR');
  });

  describe('escalation shared by the CFO and Senior Finance: the creator never clears, a peer does', () => {
    const CFO = { ID: 'C0C0C0C0-0000-4000-8000-0000000000C1', Name: 'CFO' } as UserInfo;
    const SENIOR = { ID: 'C0C0C0C0-0000-4000-8000-0000000000A1', Name: 'Senior Finance (AR)' } as UserInfo;
    const SENIOR_2 = { ID: 'C0C0C0C0-0000-4000-8000-0000000000A2', Name: 'Senior Finance (AR) 2' } as UserInfo;
    const seniors = [CFO.ID, SENIOR.ID, SENIOR_2.ID];
    // TYPES[0] is PRICE_BELOW_ENGINE_UNAPPROVED, narrowed to the CFO alone.
    const grantedRules = [
      { Name: FinanceExceptionClearTypeAuthName(TYPES[0].Code), holders: [CFO.ID] },
      { Name: FINANCE_EXCEPTIONS_ESCALATED_CREATOR_AUTH, holders: seniors },
      { Name: FINANCE_EXCEPTIONS_CLEAR_ESCALATED_AUTH, holders: seniors },
    ];
    beforeEach(() => {
      cachedUsers.list = [CFO, SENIOR, SENIOR_2, REVIEWER];
    });
    afterEach(() => {
      cachedUsers.list = [];
    });

    it('refuses the CFO an exception on a record the CFO created, even of a type only the CFO clears', async () => {
      const s = stubProvider({ stored: openRow({ SourceCreatedByUserID: CFO.ID }), grantedRules });
      expect((await clear(s, {}, CFO)).Output?.Errors?.[0].Code).toBe('CREATOR_CANNOT_CLEAR');
      expect(s.saved).toHaveLength(0);
    });

    it('lets Senior Finance clear it', async () => {
      const s = stubProvider({ stored: openRow({ SourceCreatedByUserID: CFO.ID }), grantedRules });
      expect((await clear(s, {}, SENIOR)).Output).toEqual({ Success: true, Status: 'Reviewed' });
      expect(s.saved[0]).toMatchObject({ ReviewedByUserID: SENIOR.ID });
    });

    it('refuses a plain Finance holder of the default right', async () => {
      const s = stubProvider({ stored: openRow({ SourceCreatedByUserID: CFO.ID }), grantedRules });
      expect((await clear(s, {}, REVIEWER)).Output?.Errors?.[0].Code).toBe('ESCALATED_NOT_AUTHORIZED');
    });

    it('sends a Senior-Finance-created exception to the CFO or another Senior Finance holder, never its creator', async () => {
      for (const [reviewer, expected] of [
        [SENIOR, 'CREATOR_CANNOT_CLEAR'],
        [CFO, 'Reviewed'],
        [SENIOR_2, 'Reviewed'],
      ] as const) {
        const s = stubProvider({ stored: openRow({ SourceCreatedByUserID: SENIOR.ID }), grantedRules });
        const output = (await clear(s, {}, reviewer)).Output;
        expect(output?.Success ? output.Status : output?.Errors?.[0].Code).toBe(expected);
      }
    });
  });

  it('rolls back and reports SAVE_FAILED when the save fails', async () => {
    const s = stubProvider({ stored: openRow(), saveSucceeds: false });
    const result = await clear(s, {});
    expect(result.Output).toEqual({ Success: false, Status: 'Open', Errors: [expect.objectContaining({ Code: 'SAVE_FAILED' })] });
    expect(s.tx.rollback).toHaveBeenCalledTimes(1);
    expect(s.tx.commit).not.toHaveBeenCalled();
  });
});

describe('Accounting.GetFinanceExceptionTypes', () => {
  it('returns each requested type with its parsed Configuration', async () => {
    const s = stubProvider();
    const result = await new GetFinanceExceptionTypesOperation().ExecuteServer({ Codes: ['PROGRESS_UNATTESTED', 'MISSING'] }, context(s.provider));
    expect(result.Output).toEqual({
      Success: true,
      Types: [{ Code: 'PROGRESS_UNATTESTED', IsActive: false, Configuration: { MaxDaysWithoutAttestation: 35 } }],
    });
  });
});
