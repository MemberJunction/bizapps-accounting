/**
 * Only finance moves a company's PostingStartDate (bc-aidp-next-golive#447), the same way only
 * finance moves its BooksClosedThroughDate (#316): moving it earlier puts the entries dated before
 * it into batches, and moving it later holds them back.
 *
 * No DB: the profile uses real EntityInfo with saved state via LoadFromData, and the evaluator is
 * stubbed to grant or refuse each Authorization by name.
 */
import { afterEach, describe, it, expect, vi } from 'vitest';
import { AuthorizationEvaluator, EntityInfo, type AuthorizationInfo, type IMetadataProvider, type UserInfo } from '@memberjunction/core';
import { BOOKS_CLOSED_THROUGH_SET_AUTH, POSTING_START_DATE_SET_AUTH } from '@mj-biz-apps/accounting-engine-base';
import { AccountingCompanyProfileEntityServer } from '../AccountingCompanyProfileEntityServer.js';
import { ACP_ENTITY } from './helpers/in-memory-journal-provider.js';

const COMPANY = 'aaaaaaaa-0000-0000-0000-000000000447';
const USER = { ID: 'SOME-USER' } as unknown as UserInfo;
const DATE_FIELDS = new Set(['PostingStartDate', 'BooksClosedThroughDate']);

afterEach(() => vi.restoreAllMocks());

function profileInfo(): EntityInfo {
  return new EntityInfo({
    ID: 'id-acp',
    Name: ACP_ENTITY,
    Status: 'Active',
    AllowDirectSQL: true,
    EntityFields: ['ID', 'CompanyCode', 'EntityType', 'PostingStartDate', 'BooksClosedThroughDate'].map(fn => ({
      Name: fn,
      CodeName: fn,
      Type: fn === 'ID' ? 'uniqueidentifier' : DATE_FIELDS.has(fn) ? 'date' : 'nvarchar',
      IsPrimaryKey: fn === 'ID',
      AutoIncrement: false,
      AllowsNull: true,
      AllowUpdateAPI: true,
      Status: 'Active',
    })),
  });
}

/** Both Authorizations in the catalog; the user holds only those named in `held`. */
function withGrants(acp: AccountingCompanyProfileEntityServer, held: string[], catalog = [POSTING_START_DATE_SET_AUTH, BOOKS_CLOSED_THROUGH_SET_AUTH]): void {
  Object.defineProperty(acp, 'ProviderToUse', {
    configurable: true,
    get: () => ({ Authorizations: catalog.map(Name => ({ Name })) }) as unknown as IMetadataProvider,
  });
  vi.spyOn(AuthorizationEvaluator.prototype, 'UserCanExecuteWithAncestors')
    .mockImplementation((auth: AuthorizationInfo) => held.includes(auth.Name));
}

const day = (d: string | null): Date | null => (d ? new Date(`${d}T00:00:00Z`) : null);

async function savedProfile(postingStart: string | null): Promise<AccountingCompanyProfileEntityServer> {
  const acp = new AccountingCompanyProfileEntityServer(profileInfo());
  acp.ContextCurrentUser = USER;
  await acp.LoadFromData({ ID: COMPANY, CompanyCode: 'ACME', EntityType: 'Subsidiary', PostingStartDate: day(postingStart), BooksClosedThroughDate: null }, true);
  return acp;
}

const postingStartError = (errors: Array<{ Source: string; Message: string }>): boolean =>
  errors.some(e => e.Source === 'PostingStartDate' && e.Message.includes('Only finance'));

describe('AccountingCompanyProfileEntityServer — only finance moves PostingStartDate', () => {
  it('lets a holder move it earlier, later, or clear it', async () => {
    for (const next of ['2026-09-01', '2026-11-01', null]) {
      const acp = await savedProfile('2026-10-01');
      acp.PostingStartDate = day(next);
      withGrants(acp, [POSTING_START_DATE_SET_AUTH]);
      expect((await acp.ValidateAsync()).Success, `move to ${next}`).toBe(true);
    }
  });

  it('refuses a change by someone without the authorization, even one who may close months', async () => {
    const acp = await savedProfile('2026-10-01');
    acp.PostingStartDate = day('2026-09-01');
    withGrants(acp, [BOOKS_CLOSED_THROUGH_SET_AUTH]);

    const result = await acp.ValidateAsync();

    expect(result.Success).toBe(false);
    expect(postingStartError(result.Errors)).toBe(true);
  });

  it('fails closed when the authorization is missing from the catalog', async () => {
    const acp = await savedProfile('2026-10-01');
    acp.PostingStartDate = day('2026-09-01');
    withGrants(acp, [POSTING_START_DATE_SET_AUTH], [BOOKS_CLOSED_THROUGH_SET_AUTH]);

    expect(postingStartError((await acp.ValidateAsync()).Errors)).toBe(true);
  });

  it('does not check a save that leaves the date as it was', async () => {
    const acp = await savedProfile('2026-10-01');
    acp.CompanyCode = 'ACME2';
    withGrants(acp, []);

    expect(postingStartError((await acp.ValidateAsync()).Errors)).toBe(false);
  });

  it('refuses a new profile created with a date by someone without the authorization, and allows one with none', async () => {
    const dated = new AccountingCompanyProfileEntityServer(profileInfo());
    dated.ContextCurrentUser = USER;
    dated.NewRecord();
    dated.PostingStartDate = day('2026-10-01');
    withGrants(dated, []);
    expect(postingStartError((await dated.ValidateAsync()).Errors)).toBe(true);

    const undated = new AccountingCompanyProfileEntityServer(profileInfo());
    undated.NewRecord();
    withGrants(undated, []);
    expect(postingStartError((await undated.ValidateAsync()).Errors)).toBe(false);
  });

  it('lets a holder create a new profile with a date', async () => {
    const acp = new AccountingCompanyProfileEntityServer(profileInfo());
    acp.ContextCurrentUser = USER;
    acp.NewRecord();
    acp.PostingStartDate = day('2026-10-01');
    withGrants(acp, [POSTING_START_DATE_SET_AUTH]);
    expect(postingStartError((await acp.ValidateAsync()).Errors)).toBe(false);
  });
});
