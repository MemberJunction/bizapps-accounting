/**
 * The books-closed-through date (bc-aidp-next-golive#316).
 *
 *   - Only a holder of MJ.BizApps.Accounting.BooksClosedThroughDate.Set (the Finance role) moves it,
 *     and an authorization missing from the catalog is held by nobody.
 *   - A batch build refuses a posting date on or before it, for every build path, before anything
 *     is netted or written. A failed read refuses too.
 *
 * No DB: the profile uses real EntityInfo with saved state via LoadFromData; the builds run against
 * the in-memory provider, which evaluates the filters the engine emits.
 */
import { afterEach, describe, it, expect, vi } from 'vitest';
import { AuthorizationEvaluator, EntityInfo, type IMetadataProvider, type UserInfo } from '@memberjunction/core';
import {
  AccountingCompanyProfileEntityServer,
  BOOKS_CLOSED_THROUGH_SET_AUTH,
} from '../AccountingCompanyProfileEntityServer.js';
import {
  buildJournalEntryBatch,
  buildJournalEntryBatchFromExplicitIds,
  EmptyJournalEntryBatchError,
  JournalEntryBatchPostingDateError,
  regenerateJournalEntryBatch,
} from '../JournalEntryBatchEngine.js';
import { inMemoryProvider, journal, profile, testUser, ACP_ENTITY, JEL_ENTITY } from './helpers/in-memory-journal-provider.js';

const COMPANY = 'aaaaaaaa-0000-0000-0000-000000000316';
const FINANCE_USER = { ID: 'FINANCE-USER' } as unknown as UserInfo;

afterEach(() => vi.restoreAllMocks());

// ─── the profile: only finance moves the date ───────────────────────────────

function profileInfo(): EntityInfo {
  return new EntityInfo({
    ID: 'id-acp',
    Name: ACP_ENTITY,
    Status: 'Active',
    AllowDirectSQL: true,
    EntityFields: ['ID', 'CompanyCode', 'EntityType', 'BooksClosedThroughDate'].map(fn => ({
      Name: fn,
      CodeName: fn,
      Type: fn === 'ID' ? 'uniqueidentifier' : fn === 'BooksClosedThroughDate' ? 'date' : 'nvarchar',
      IsPrimaryKey: fn === 'ID',
      AutoIncrement: false,
      AllowsNull: true,
      AllowUpdateAPI: true,
      Status: 'Active',
    })),
  });
}

/** The provider's authorization catalog, and whether the evaluator grants the user each one. */
function withAuthorizations(acp: AccountingCompanyProfileEntityServer, catalog: string[], granted: boolean): void {
  Object.defineProperty(acp, 'ProviderToUse', {
    configurable: true,
    get: () => ({ Authorizations: catalog.map(Name => ({ Name })) }) as unknown as IMetadataProvider,
  });
  vi.spyOn(AuthorizationEvaluator.prototype, 'UserCanExecuteWithAncestors').mockReturnValue(granted);
}

async function savedProfile(closedThrough: string | null): Promise<AccountingCompanyProfileEntityServer> {
  const acp = new AccountingCompanyProfileEntityServer(profileInfo());
  acp.ContextCurrentUser = FINANCE_USER;
  await acp.LoadFromData({
    ID: COMPANY,
    CompanyCode: 'ACME',
    EntityType: 'Subsidiary',
    BooksClosedThroughDate: closedThrough ? new Date(`${closedThrough}T00:00:00Z`) : null,
  }, true);
  return acp;
}

const closedError = (errors: Array<{ Source: string; Message: string }>): boolean =>
  errors.some(e => e.Source === 'BooksClosedThroughDate' && e.Message.includes('Only finance'));

describe('AccountingCompanyProfileEntityServer — only finance moves BooksClosedThroughDate', () => {
  it('lets a holder of the authorization close a month', async () => {
    const acp = await savedProfile('2026-07-31');
    acp.BooksClosedThroughDate = new Date('2026-08-31T00:00:00Z');
    withAuthorizations(acp, [BOOKS_CLOSED_THROUGH_SET_AUTH], true);

    expect((await acp.ValidateAsync()).Success).toBe(true);
  });

  it('lets a holder reopen a month by moving the date back, or clear it', async () => {
    const back = await savedProfile('2026-08-31');
    back.BooksClosedThroughDate = new Date('2026-07-31T00:00:00Z');
    withAuthorizations(back, [BOOKS_CLOSED_THROUGH_SET_AUTH], true);
    expect((await back.ValidateAsync()).Success).toBe(true);

    const cleared = await savedProfile('2026-08-31');
    cleared.BooksClosedThroughDate = null;
    withAuthorizations(cleared, [BOOKS_CLOSED_THROUGH_SET_AUTH], true);
    expect((await cleared.ValidateAsync()).Success).toBe(true);
  });

  it('refuses a change by someone without the authorization', async () => {
    const acp = await savedProfile('2026-07-31');
    acp.BooksClosedThroughDate = new Date('2026-08-31T00:00:00Z');
    withAuthorizations(acp, [BOOKS_CLOSED_THROUGH_SET_AUTH], false);

    const result = await acp.ValidateAsync();

    expect(result.Success).toBe(false);
    expect(closedError(result.Errors)).toBe(true);
  });

  it('fails closed when the authorization is missing from the catalog', async () => {
    const acp = await savedProfile('2026-07-31');
    acp.BooksClosedThroughDate = new Date('2026-08-31T00:00:00Z');
    withAuthorizations(acp, [], true);

    expect((await acp.ValidateAsync()).Success).toBe(false);
  });

  it('refuses a new profile created with a date by someone without the authorization', async () => {
    const acp = new AccountingCompanyProfileEntityServer(profileInfo());
    acp.ContextCurrentUser = FINANCE_USER;
    acp.NewRecord();
    acp.BooksClosedThroughDate = new Date('2026-08-31T00:00:00Z');
    withAuthorizations(acp, [BOOKS_CLOSED_THROUGH_SET_AUTH], false);

    expect(closedError((await acp.ValidateAsync()).Errors)).toBe(true);
  });

  it('leaves other edits alone for anyone, and a new profile with no date', async () => {
    const edited = await savedProfile('2026-08-31');
    edited.CompanyCode = 'ACME2';
    withAuthorizations(edited, [BOOKS_CLOSED_THROUGH_SET_AUTH], false);
    expect(closedError((await edited.ValidateAsync()).Errors)).toBe(false);

    const fresh = new AccountingCompanyProfileEntityServer(profileInfo());
    fresh.NewRecord();
    withAuthorizations(fresh, [BOOKS_CLOSED_THROUGH_SET_AUTH], false);
    expect(closedError((await fresh.ValidateAsync()).Errors)).toBe(false);
  });
});

// ─── the batch build: no posting date in a closed month ─────────────────────

const ENTRY = 'dddddddd-0000-0000-0000-000000000316';
const JOURNALS = [journal(ENTRY, COMPANY, '2026-08-15')];

function buildProvider(closedThrough: string | null) {
  return inMemoryProvider({ journals: JOURNALS, profiles: [profile(COMPANY, null, closedThrough)] });
}

/** The member-line read only happens once the build has passed its date checks. */
const netted = (calls: Array<{ EntityName?: string }>): boolean => calls.some(c => c.EntityName === JEL_ENTITY);

describe('batch build — a posting date in a closed month is refused (golive #316)', () => {
  it('refuses a posting date on the closed-through date, naming the first open day', async () => {
    const { provider, calls } = buildProvider('2026-08-31');
    const build = buildJournalEntryBatchFromExplicitIds([ENTRY], 'BusinessCentral', 'USER-1', testUser, provider, undefined, '2026-08-31');

    await expect(build).rejects.toThrow(JournalEntryBatchPostingDateError);
    await expect(build).rejects.toThrow(/closed through 2026-08-31.*2026-09-01 or later/);
    expect(netted(calls)).toBe(false);
  });

  it('refuses a posting date earlier in a closed month', async () => {
    const { provider } = buildProvider('2026-08-31');
    await expect(buildJournalEntryBatchFromExplicitIds([ENTRY], 'BusinessCentral', 'USER-1', testUser, provider, undefined, '2026-08-20'))
      .rejects.toThrow(JournalEntryBatchPostingDateError);
  });

  it('refuses the oldest-forward build too', async () => {
    const { provider } = buildProvider('2026-08-31');
    await expect(buildJournalEntryBatch(COMPANY, 'BusinessCentral', 'USER-1', testUser, provider, undefined, { postingDate: '2026-08-31' }))
      .rejects.toThrow(JournalEntryBatchPostingDateError);
  });

  it('builds on the first open day', async () => {
    const { provider, calls } = buildProvider('2026-08-31');
    // No lines in the fake, so the build stops at "nets to zero", after its date checks passed.
    await expect(buildJournalEntryBatchFromExplicitIds([ENTRY], 'BusinessCentral', 'USER-1', testUser, provider, undefined, '2026-09-01'))
      .rejects.toThrow(EmptyJournalEntryBatchError);
    expect(netted(calls)).toBe(true);
  });

  it('closes nothing for a company with no date', async () => {
    const { provider } = buildProvider(null);
    await expect(buildJournalEntryBatchFromExplicitIds([ENTRY], 'BusinessCentral', 'USER-1', testUser, provider, undefined, '2026-08-31'))
      .rejects.toThrow(EmptyJournalEntryBatchError);
  });

  it('refuses when the date cannot be read, rather than guessing the month is open', async () => {
    const { provider } = buildProvider(null);
    const failing = {
      ...provider,
      // Only the books-closed read fails: it names one company.
      RunView: async (params: { EntityName?: string; ExtraFilter?: string }) =>
        params.EntityName === ACP_ENTITY && params.ExtraFilter?.startsWith('ID=')
          ? { Success: false, ErrorMessage: 'timeout', Results: [] }
          : (provider as unknown as { RunView: (p: object) => Promise<object> }).RunView(params),
    } as unknown as IMetadataProvider;

    await expect(buildJournalEntryBatchFromExplicitIds([ENTRY], 'BusinessCentral', 'USER-1', testUser, failing, undefined, '2026-09-30'))
      .rejects.toThrow(/could not read company .* books-closed-through date: timeout/);
  });
});

// ─── regenerate: the batch keeps its posting date, which may have closed since ─

describe('regenerate — a batch whose posting date has since closed is refused', () => {
  const BATCH = 'bbbbbbbb-0000-0000-0000-000000000316';

  /** A Pending batch built for 2026-08-31, and a provider that records whether a transaction began. */
  function regenerateProvider(closedThrough: string | null) {
    const { provider } = buildProvider(closedThrough);
    const beginTransaction = vi.fn().mockRejectedValue(new Error('transaction began'));
    const batch = {
      ID: BATCH,
      CompanyID: COMPANY,
      Status: 'Pending',
      PostingDate: new Date('2026-08-31T00:00:00Z'),
      Load: async () => true,
    };
    const withBatch = {
      ...provider,
      GetEntityObject: async () => batch,
      BeginTransaction: beginTransaction,
    } as unknown as IMetadataProvider;
    return { provider: withBatch, beginTransaction };
  }

  it('refuses before tearing anything down, and says to cancel and rebuild', async () => {
    const { provider, beginTransaction } = regenerateProvider('2026-08-31');
    const regenerate = regenerateJournalEntryBatch(BATCH, 'BusinessCentral', testUser, provider);

    await expect(regenerate).rejects.toThrow(JournalEntryBatchPostingDateError);
    await expect(regenerate).rejects.toThrow(/closed through 2026-08-31.*cancel this batch and build a new one/);
    expect(beginTransaction).not.toHaveBeenCalled();
  });

  it('goes ahead while the posting date is still open', async () => {
    const { provider, beginTransaction } = regenerateProvider('2026-07-31');
    await expect(regenerateJournalEntryBatch(BATCH, 'BusinessCentral', testUser, provider)).rejects.toThrow(/transaction began/);
    expect(beginTransaction).toHaveBeenCalledOnce();
  });
});
