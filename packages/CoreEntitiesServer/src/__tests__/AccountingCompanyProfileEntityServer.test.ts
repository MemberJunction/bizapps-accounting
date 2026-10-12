/**
 * AccountingCompanyProfileEntityServer — a new profile's OperatingTimeZone stays as the caller
 * left it (issue #158). Blank means "inherit BizApps.BusinessTimeZone"; a first-save default
 * would make every new company override the business zone. No DB: an in-memory EntityInfo, and
 * the persist step is stubbed on BaseEntity so the test sees what the subclass hands it.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BaseEntity, EntityInfo } from '@memberjunction/core';
import { AccountingCompanyProfileEntityServer } from '../AccountingCompanyProfileEntityServer.js';

const ACP_ENTITY = 'MJ_BizApps_Accounting: Accounting Company Profiles';

/** A real EntityInfo built from init data, as the metadata provider would build it. */
function createEntityInfo(name: string, fieldNames: string[]): EntityInfo {
  return new EntityInfo({
    ID: `id-${name}`,
    Name: name,
    Status: 'Active',
    AllowDirectSQL: true,
    EntityFields: fieldNames.map(fn => ({
      Name: fn,
      CodeName: fn,
      Type: fn === 'ID' ? 'uniqueidentifier' : 'nvarchar',
      IsPrimaryKey: fn === 'ID',
      AutoIncrement: false,
      AllowsNull: true,
      Status: 'Active',
    })),
  });
}

describe('AccountingCompanyProfileEntityServer (OperatingTimeZone on create)', () => {
  let info: EntityInfo;
  let persisted: Array<string | null>;

  beforeEach(() => {
    info = createEntityInfo(ACP_ENTITY, ['ID', 'CompanyCode', 'FunctionalCurrencyCode', 'OperatingTimeZone']);
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
    const acp = new AccountingCompanyProfileEntityServer(info);
    acp.NewRecord();
    acp.CompanyCode = 'ACME';

    expect(await acp.Save()).toBe(true);
    expect(persisted).toEqual([null]);
  });

  it('keeps a caller-supplied OperatingTimeZone, including UTC', async () => {
    for (const zone of ['America/Chicago', 'UTC']) {
      const acp = new AccountingCompanyProfileEntityServer(info);
      acp.NewRecord();
      acp.OperatingTimeZone = zone;
      await acp.Save();
    }
    expect(persisted).toEqual(['America/Chicago', 'UTC']);
  });
});
