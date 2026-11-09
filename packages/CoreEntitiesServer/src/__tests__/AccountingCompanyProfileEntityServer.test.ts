/**
 * AccountingCompanyProfileEntityServer — a new profile's OperatingTimeZone stays as the caller
 * left it (issue #158). Blank means "inherit BizApps.BusinessTimeZone"; a first-save default
 * would make every new company override the business zone. No DB: an in-memory EntityInfo, and
 * the persist step is stubbed on BaseEntity so the test sees what the subclass hands it.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BaseEntity, EntityInfo, RunView } from '@memberjunction/core';
import { AccountingCompanyProfileEntityServer } from '../AccountingCompanyProfileEntityServer.js';
import { DEFAULT_CHART_OF_ACCOUNTS } from '../SeedData.js';

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

/**
 * SeedDefaultChartOfAccounts reads the company's existing GL account codes with a filter built from
 * the profile's ID (issue #384). The ID goes through the UUID guard like every other ID this file
 * puts in a filter, so a value that is not a UUID is refused before any query runs.
 */
describe('AccountingCompanyProfileEntityServer.SeedDefaultChartOfAccounts (company ID filter)', () => {
  let info: EntityInfo;
  let filters: string[];

  beforeEach(() => {
    info = createEntityInfo(ACP_ENTITY, ['ID', 'CompanyCode', 'FunctionalCurrencyCode']);
    filters = [];
    // Every starter code already exists, so the seed reads and creates nothing.
    vi.spyOn(RunView.prototype, 'RunView').mockImplementation(async (params) => {
      filters.push(String(params.ExtraFilter));
      return {
        Success: true,
        Results: DEFAULT_CHART_OF_ACCOUNTS.map(a => ({ Code: a.code })),
        RowCount: DEFAULT_CHART_OF_ACCOUNTS.length,
        TotalRowCount: DEFAULT_CHART_OF_ACCOUNTS.length,
        ExecutionTime: 0,
        ErrorMessage: '',
        UserViewRunID: '',
      };
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('filters on the company ID as a guarded GUID literal', async () => {
    const id = '6F1C2D3E-4A5B-4C6D-8E7F-901234ABCDEF';
    const acp = new AccountingCompanyProfileEntityServer(info);
    acp.LoadFromData({ ID: id, CompanyCode: 'ACME', FunctionalCurrencyCode: 'USD' });

    await acp.SeedDefaultChartOfAccounts();

    expect(filters).toEqual([`CompanyID='${id}'`]);
  });

  it('refuses an ID that is not a UUID before running any query', async () => {
    const acp = new AccountingCompanyProfileEntityServer(info);
    acp.LoadFromData({ ID: "x' OR 1=1--", CompanyCode: 'ACME', FunctionalCurrencyCode: 'USD' });

    await expect(acp.SeedDefaultChartOfAccounts()).rejects.toThrow(/not a valid UUID/);
    expect(filters).toEqual([]);
  });
});
