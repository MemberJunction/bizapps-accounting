/**
 * GLAccountEntityServer — a Business Central account's External Account ID is a BC account number
 * (bc-aidp-next-golive#282). No DB: mock EntityInfo, saved-state via LoadFromData.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Metadata, EntityInfo, type IMetadataProvider } from '@memberjunction/core';
import { GLAccountEntityServer } from '../GLAccountEntityServer.js';

const GL_ENTITY = 'MJ_BizApps_Accounting: GL Accounts';
const BC_ACCOUNT_ID = '9a1b2c3d-0000-0000-0000-000000000282';

/** The EntityFieldInfo members BaseEntity reads from a mock field. */
interface MockField {
  Name: string;
  CodeName: string;
  Type: string;
  TSType: string;
  IsPrimaryKey: boolean;
  AutoIncrement: boolean;
  ReadOnly: boolean;
  AllowsNull: boolean;
  ValueIsPermittedByValueList: () => boolean;
}

function createMockEntity(name: string, fieldNames: string[], boolFields: string[]): EntityInfo {
  const info = Object.create(EntityInfo.prototype);
  info.ID = `id-${name}`;
  info.Name = name;
  info.Status = 'Active';
  info.AllowDirectSQL = true;
  const fields: MockField[] = fieldNames.map(fn => ({
    Name: fn,
    CodeName: fn,
    Type: fn === 'ID' ? 'uniqueidentifier' : boolFields.includes(fn) ? 'bit' : 'nvarchar',
    TSType: boolFields.includes(fn) ? 'boolean' : 'string',
    IsPrimaryKey: fn === 'ID',
    AutoIncrement: false,
    ReadOnly: false,
    AllowsNull: true,
    ValueIsPermittedByValueList: () => true,
  }));
  Object.defineProperty(info, 'Fields', { get: () => fields, configurable: true });
  Object.defineProperty(info, 'PrimaryKeys', { get: () => fields.filter((f) => f.IsPrimaryKey), configurable: true });
  Object.defineProperty(info, 'HasInactiveFields', { get: () => false, configurable: true });
  return info;
}

describe('GLAccountEntityServer (Business Central account number)', () => {
  let info: EntityInfo;

  beforeEach(() => {
    info = createMockEntity(GL_ENTITY, ['ID', 'CompanyID', 'Code', 'Name', 'AccountType', 'CurrencyCode', 'ExternalSystem', 'ExternalAccountID', 'IsActive'], ['IsActive']);
    Metadata.Provider = { Entities: [info] } as unknown as IMetadataProvider;
  });

  const account = async (externalSystem: string | null, externalAccountID: string | null): Promise<GLAccountEntityServer> => {
    const row = new GLAccountEntityServer(info);
    await row.LoadFromData({ ID: 'gl-1', CompanyID: 'co-1', Code: '41507', Name: 'Event revenue', AccountType: 'Revenue', CurrencyCode: null, ExternalSystem: null, ExternalAccountID: null, IsActive: true });
    row.ExternalSystem = externalSystem;
    row.ExternalAccountID = externalAccountID;
    return row;
  };

  it('refuses a Business Central account id (a GUID) as a BC account\'s External Account ID', async () => {
    const result = (await account('BusinessCentral', BC_ACCOUNT_ID)).Validate();

    expect(result.Success).toBe(false);
    expect(result.Errors.some(e => /External Account ID .* is 36 characters; Business Central account numbers allow 20/.test(e.Message))).toBe(true);
  });

  it('accepts a remapped Business Central account number', async () => {
    expect((await account('BusinessCentral', '41507')).Validate().Success).toBe(true);
  });

  it('accepts a Business Central account with no External Account ID', async () => {
    expect((await account('BusinessCentral', null)).Validate().Success).toBe(true);
  });

  // The limit is BC's; another ERP's ids are its own business.
  it('leaves another ERP\'s External Account ID alone', async () => {
    expect((await account('QuickBooks', BC_ACCOUNT_ID)).Validate().Success).toBe(true);
  });
});
