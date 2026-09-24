/**
 * AccountingCompanyProfileEntityServer — a new profile's OperatingTimeZone stays as the caller
 * left it (issue #158). Blank means "inherit BizApps.BusinessTimeZone"; a first-save default
 * would make every new company override the business zone. No DB: mock EntityInfo, and the
 * persist step is stubbed on BaseEntity so the test sees what the subclass hands it.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BaseEntity, Metadata, EntityInfo } from '@memberjunction/core';
import { AccountingCompanyProfileEntityServer } from '../AccountingCompanyProfileEntityServer.js';

const ACP_ENTITY = 'MJ_BizApps_Accounting: Accounting Company Profiles';

function createMockEntity(name: string, fieldNames: string[]): EntityInfo {
  const info = Object.create(EntityInfo.prototype);
  info.ID = `id-${name}`;
  info.Name = name;
  info.Status = 'Active';
  info.AllowDirectSQL = true;
  const fields = fieldNames.map(fn => ({
    Name: fn,
    CodeName: fn,
    Type: fn === 'ID' ? 'uniqueidentifier' : 'nvarchar',
    TSType: 'string',
    IsPrimaryKey: fn === 'ID',
    AutoIncrement: false,
    ReadOnly: false,
    AllowsNull: true,
    ValueIsPermittedByValueList: () => true,
  })) as any[];
  Object.defineProperty(info, 'Fields', { get: () => fields, configurable: true });
  Object.defineProperty(info, 'PrimaryKeys', { get: () => fields.filter((f: any) => f.IsPrimaryKey), configurable: true });
  Object.defineProperty(info, 'HasInactiveFields', { get: () => false, configurable: true });
  return info;
}

describe('AccountingCompanyProfileEntityServer (OperatingTimeZone on create)', () => {
  let info: EntityInfo;
  let persisted: Array<string | null>;

  beforeEach(() => {
    info = createMockEntity(ACP_ENTITY, ['ID', 'CompanyCode', 'FunctionalCurrencyCode', 'OperatingTimeZone']);
    Metadata.Provider = { Entities: [info] } as any;
    persisted = [];
    vi.spyOn(BaseEntity.prototype, 'Save').mockImplementation(async function (this: BaseEntity) {
      persisted.push(this.Get('OperatingTimeZone'));
      return true;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('leaves a blank OperatingTimeZone blank on a new profile', async () => {
    const acp = new AccountingCompanyProfileEntityServer(info as any);
    acp.NewRecord();
    acp.CompanyCode = 'ACME';

    expect(await acp.Save()).toBe(true);
    expect(persisted).toEqual([null]);
  });

  it('keeps a caller-supplied OperatingTimeZone, including UTC', async () => {
    for (const zone of ['America/Chicago', 'UTC']) {
      const acp = new AccountingCompanyProfileEntityServer(info as any);
      acp.NewRecord();
      acp.OperatingTimeZone = zone;
      await acp.Save();
    }
    expect(persisted).toEqual(['America/Chicago', 'UTC']);
  });
});
