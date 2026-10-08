/**
 * A Division, Department or Branch owns no active GL accounts (bc-aidp-next-golive#313). It uses
 * its legal entity's books, so an account it owned would book entries under a company with no ERP
 * connection and no approver. Refused from both sides: creating or reactivating such an account
 * (GLAccountEntityServer), and creating a profile of one of those types for, or turning into one, a
 * company that owns active accounts (AccountingCompanyProfileEntityServer).
 *
 * No DB: real EntityInfo from init data, saved state via LoadFromData (old values set, as a load
 * from the database sets them), and the provider's RunView
 * stubbed per test with the row the guard reads.
 */
import { describe, it, expect, vi } from 'vitest';
import { EntityInfo, type BaseEntity } from '@memberjunction/core';
import { GLAccountEntityServer } from '../GLAccountEntityServer.js';
import { AccountingCompanyProfileEntityServer } from '../AccountingCompanyProfileEntityServer.js';

const GL_ENTITY = 'MJ_BizApps_Accounting: GL Accounts';
const ACP_ENTITY = 'MJ_BizApps_Accounting: Accounting Company Profiles';
const COMPANY = '11111111-0000-0000-0000-000000000313';

function createEntityInfo(name: string, fieldNames: string[], bitFields: string[] = []): EntityInfo {
  return new EntityInfo({
    ID: `id-${name}`,
    Name: name,
    Status: 'Active',
    AllowDirectSQL: true,
    EntityFields: fieldNames.map(fn => ({
      Name: fn,
      CodeName: fn,
      Type: fn === 'ID' ? 'uniqueidentifier' : bitFields.includes(fn) ? 'bit' : 'nvarchar',
      IsPrimaryKey: fn === 'ID',
      AutoIncrement: false,
      AllowsNull: true,
      AllowUpdateAPI: true,
      Status: 'Active',
    })),
  });
}

/** Point the entity's provider at a RunView that answers with `rows` and records each filter. */
function stubRunView(entity: BaseEntity, rows: Array<Record<string, unknown>>): Array<{ EntityName: string; ExtraFilter: string }> {
  const calls: Array<{ EntityName: string; ExtraFilter: string }> = [];
  Object.defineProperty(entity, 'ProviderToUse', {
    configurable: true,
    get: () => ({
      RunView: vi.fn(async (params: { EntityName: string; ExtraFilter: string }) => {
        calls.push({ EntityName: params.EntityName, ExtraFilter: params.ExtraFilter });
        return { Success: true, Results: rows };
      }),
    }),
  });
  return calls;
}

describe('GLAccountEntityServer — a company that keeps no books owns no active account', () => {
  const info = createEntityInfo(GL_ENTITY, ['ID', 'CompanyID', 'Code', 'Name', 'AccountType', 'CurrencyCode', 'ExternalSystem', 'ExternalAccountID', 'IsActive'], ['IsActive']);

  const newAccount = (isActive: boolean): GLAccountEntityServer => {
    const row = new GLAccountEntityServer(info);
    row.NewRecord();
    row.CompanyID = COMPANY;
    row.Code = '1200';
    row.Name = 'Accounts receivable';
    row.AccountType = 'Asset';
    row.IsActive = isActive;
    return row;
  };

  it.each(['Division', 'Department', 'Branch'])('refuses a new active account owned by a %s', async (type) => {
    const row = newAccount(true);
    const calls = stubRunView(row, [{ EntityType: type }]);

    const result = await row.ValidateAsync();

    expect(result.Success).toBe(false);
    expect(result.Errors.some(e => e.Message.includes(`is a ${type}, which keeps no books of its own`))).toBe(true);
    expect(calls[0]).toEqual({ EntityName: ACP_ENTITY, ExtraFilter: `ID='${COMPANY}'` });
  });

  it.each(['Subsidiary', 'LegalEntity'])('accepts a new account owned by a %s', async (type) => {
    const row = newAccount(true);
    stubRunView(row, [{ EntityType: type }]);
    expect((await row.ValidateAsync()).Success).toBe(true);
  });

  it('accepts a new account on a company with no profile yet', async () => {
    const row = newAccount(true);
    stubRunView(row, []);
    expect((await row.ValidateAsync()).Success).toBe(true);
  });

  it('accepts a new INACTIVE account on a Division without reading the profile: it takes no lines', async () => {
    const row = newAccount(false);
    const calls = stubRunView(row, [{ EntityType: 'Division' }]);
    expect((await row.ValidateAsync()).Success).toBe(true);
    expect(calls).toHaveLength(0);
  });

  it('refuses reactivating an account a Division owns', async () => {
    const row = new GLAccountEntityServer(info);
    await row.LoadFromData({ ID: 'gl-1', CompanyID: COMPANY, Code: '1200', Name: 'AR', AccountType: 'Asset', CurrencyCode: null, ExternalSystem: null, ExternalAccountID: null, IsActive: false }, true);
    row.IsActive = true;
    stubRunView(row, [{ EntityType: 'Division' }]);

    expect((await row.ValidateAsync()).Success).toBe(false);
  });

  it('leaves other edits to a saved account alone', async () => {
    const row = new GLAccountEntityServer(info);
    await row.LoadFromData({ ID: 'gl-1', CompanyID: COMPANY, Code: '1200', Name: 'AR', AccountType: 'Asset', CurrencyCode: null, ExternalSystem: null, ExternalAccountID: null, IsActive: true }, true);
    row.Name = 'Trade receivables';
    const calls = stubRunView(row, [{ EntityType: 'Division' }]);

    expect((await row.ValidateAsync()).Success).toBe(true);
    expect(calls).toHaveLength(0);
  });
});

describe('AccountingCompanyProfileEntityServer — a company with active accounts cannot stop keeping books', () => {
  const info = createEntityInfo(ACP_ENTITY, ['ID', 'CompanyCode', 'EntityType', 'ParentAccountingCompanyID', 'FunctionalCurrencyCode']);

  const savedProfile = async (entityType: string): Promise<AccountingCompanyProfileEntityServer> => {
    const acp = new AccountingCompanyProfileEntityServer(info);
    await acp.LoadFromData({ ID: COMPANY, CompanyCode: 'BRAND', EntityType: entityType, ParentAccountingCompanyID: null, FunctionalCurrencyCode: 'USD' }, true);
    return acp;
  };

  it('refuses turning a company that owns an active account into a Division', async () => {
    const acp = await savedProfile('Subsidiary');
    acp.EntityType = 'Division';
    const calls = stubRunView(acp, [{ Code: '1200' }]);

    const result = await acp.ValidateAsync();

    expect(result.Success).toBe(false);
    expect(result.Errors.some(e => e.Message.includes('GL account 1200') && e.Message.includes('Deactivate its accounts first'))).toBe(true);
    expect(calls[0]).toEqual({ EntityName: GL_ENTITY, ExtraFilter: `CompanyID='${COMPANY}' AND IsActive=1` });
  });

  it('accepts turning a company with no active accounts into a Division', async () => {
    const acp = await savedProfile('Subsidiary');
    acp.EntityType = 'Division';
    stubRunView(acp, []);
    expect((await acp.ValidateAsync()).Success).toBe(true);
  });

  const newProfile = (entityType: AccountingCompanyProfileEntityServer['EntityType']): AccountingCompanyProfileEntityServer => {
    const acp = new AccountingCompanyProfileEntityServer(info);
    acp.NewRecord();
    acp.ID = COMPANY;
    acp.CompanyCode = 'BRAND';
    acp.EntityType = entityType;
    acp.FunctionalCurrencyCode = 'USD';
    return acp;
  };

  it.each(['Division', 'Department', 'Branch'] as const)('refuses a new %s profile for a company that already owns an active account', async (type) => {
    const acp = newProfile(type);
    const calls = stubRunView(acp, [{ Code: '1200' }]);

    const result = await acp.ValidateAsync();

    expect(result.Success).toBe(false);
    expect(result.Errors.some(e => e.Message.includes('GL account 1200') && e.Message.includes('Deactivate its accounts first'))).toBe(true);
    expect(calls[0]).toEqual({ EntityName: GL_ENTITY, ExtraFilter: `CompanyID='${COMPANY}' AND IsActive=1` });
  });

  it('accepts a new Division profile for a company with no active accounts', async () => {
    const acp = newProfile('Division');
    stubRunView(acp, []);
    expect((await acp.ValidateAsync()).Success).toBe(true);
  });

  it('accepts a new legal-entity profile for a company that owns active accounts, without reading them', async () => {
    const acp = newProfile('Subsidiary');
    const calls = stubRunView(acp, [{ Code: '1200' }]);
    expect((await acp.ValidateAsync()).Success).toBe(true);
    expect(calls).toHaveLength(0);
  });

  it('does not read accounts when EntityType is unchanged or becomes a type that keeps books', async () => {
    const unchanged = await savedProfile('Division');
    unchanged.ParentAccountingCompanyID = '22222222-0000-0000-0000-000000000313';
    const unchangedCalls = stubRunView(unchanged, [{ Code: '1200' }]);
    expect((await unchanged.ValidateAsync()).Success).toBe(true);
    expect(unchangedCalls).toHaveLength(0);

    const toSubsidiary = await savedProfile('Division');
    toSubsidiary.EntityType = 'Subsidiary';
    const subsidiaryCalls = stubRunView(toSubsidiary, [{ Code: '1200' }]);
    expect((await toSubsidiary.ValidateAsync()).Success).toBe(true);
    expect(subsidiaryCalls).toHaveLength(0);
  });
});
