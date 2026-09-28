/**
 * ERP field-length limits (bc-aidp-next-golive#280). The limit engine is stubbed with fixture rows
 * shaped like Business Central's integration metadata, so these tests pin which journal value is
 * checked against which BC field, not the engine's resolution (bizapps-common tests that).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IMetadataProvider, UserInfo } from '@memberjunction/core';
import {
  CheckExternalFieldLength,
  ExternalFieldLimitEngine,
  type ExternalFieldTarget,
  type IntegrationObjectFieldRow,
  type IntegrationObjectRow,
} from '@mj-biz-apps/common-entities';
import { CheckErpFieldOnSave, CheckErpJournalInput, IsBusinessCentral } from '../ErpFieldLimits.js';
import type { CreateERPJournalInput } from '../BaseAccountingERPProvider.js';

const BC = 'business-central';

const objects: IntegrationObjectRow[] = [
  { ID: 'o-lines', Name: 'journalLines', Integration: BC },
  { ID: 'o-dims', Name: 'dimensions', Integration: BC },
  { ID: 'o-vals', Name: 'dimensionValues', Integration: BC },
];

const fields: IntegrationObjectFieldRow[] = [
  { IntegrationObjectID: 'o-lines', Name: 'accountNumber', Length: 20 },
  { IntegrationObjectID: 'o-lines', Name: 'documentNumber', Length: 20 },
  { IntegrationObjectID: 'o-lines', Name: 'description', Length: 100 },
  { IntegrationObjectID: 'o-dims', Name: 'code', Length: 20 },
  { IntegrationObjectID: 'o-vals', Name: 'code', Length: 20 },
];

const journal = (overrides: Partial<CreateERPJournalInput> = {}): CreateERPJournalInput => ({
  CompanyID: 'company-1',
  EntryDate: new Date('2026-09-27T00:00:00Z'),
  DocNumber: 'BATCH-000001',
  Lines: [
    { accountNumber: '40100', debit: 10, description: 'Netted from 2 source line(s)', dimensions: [{ code: 'PRODUCT', valueCode: 'WIDGET-STANDARD' }] },
    { accountNumber: '11000', credit: 10, description: 'Netted from 1 source line(s)' },
  ],
  ...overrides,
});

beforeEach(() => {
  vi.spyOn(ExternalFieldLimitEngine.Instance, 'Check').mockImplementation(
    (label: string, value: string | null | undefined, targets: ReadonlyArray<ExternalFieldTarget>) => CheckExternalFieldLength(label, value, targets, objects, fields),
  );
  vi.spyOn(ExternalFieldLimitEngine.Instance, 'Config').mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('IsBusinessCentral', () => {
  it('matches every spelling the integration and target system use', () => {
    expect(IsBusinessCentral('business-central')).toBe(true);
    expect(IsBusinessCentral('Microsoft Dynamics 365 Business Central')).toBe(true);
    expect(IsBusinessCentral('BusinessCentral')).toBe(true);
  });

  it('does not match other ERPs or blanks', () => {
    expect(IsBusinessCentral('QuickBooks Online')).toBe(false);
    expect(IsBusinessCentral(null)).toBe(false);
  });
});

describe('CheckErpJournalInput', () => {
  it('passes a journal whose values all fit', () => {
    expect(CheckErpJournalInput(BC, journal())).toEqual([]);
  });

  it('names an account number over 20 characters, such as a BC account id', () => {
    const guid = '0f4fd84f-1111-2222-3333-444455556666';
    const problems = CheckErpJournalInput(BC, journal({ Lines: [{ accountNumber: guid, debit: 1 }] }));
    expect(problems).toEqual([`GL account number is 36 characters; ${BC} journalLines.accountNumber allows 20. Shorten it before saving.`]);
  });

  it('names a document number over 20 characters', () => {
    expect(CheckErpJournalInput(BC, journal({ DocNumber: 'B'.repeat(21) }))).toEqual([
      `Batch number is 21 characters; ${BC} journalLines.documentNumber allows 20. Shorten it before saving.`,
    ]);
  });

  it('names dimension and dimension value codes over 20 characters, once each', () => {
    const tag = { code: 'D'.repeat(21), valueCode: 'V'.repeat(22) };
    const problems = CheckErpJournalInput(BC, journal({
      Lines: [
        { accountNumber: '40100', debit: 1, dimensions: [tag] },
        { accountNumber: '11000', credit: 1, dimensions: [tag] },
      ],
    }));
    expect(problems).toHaveLength(2);
    expect(problems[0]).toMatch(/^Dimension code is 21 characters; business-central dimensions\.code allows 20/);
    expect(problems[1]).toMatch(/^Dimension value code is 22 characters; business-central dimensionValues\.code allows 20/);
  });

  it('names a line description over 100 characters', () => {
    const problems = CheckErpJournalInput(BC, journal({ Lines: [{ accountNumber: '40100', debit: 1, description: 'x'.repeat(101) }] }));
    expect(problems).toEqual([`Journal line description is 101 characters; ${BC} journalLines.description allows 100. Shorten it before saving.`]);
  });

  it("reads BC's lengths from the connector's metadata whatever the company's integration is named", () => {
    const problems = CheckErpJournalInput('Microsoft Dynamics 365 Business Central', journal({ DocNumber: 'B'.repeat(21) }));
    expect(problems).toEqual([`Batch number is 21 characters; ${BC} journalLines.documentNumber allows 20. Shorten it before saving.`]);
  });

  it('checks nothing for an ERP it has no field table for', () => {
    expect(CheckErpJournalInput('QuickBooks Online', journal({ DocNumber: 'B'.repeat(50) }))).toEqual([]);
  });

  it('fails when the connector metadata has no length for a field, rather than passing', () => {
    vi.mocked(ExternalFieldLimitEngine.Instance.Check).mockImplementation(
      (label: string, value: string | null | undefined, targets: ReadonlyArray<ExternalFieldTarget>) => CheckExternalFieldLength(label, value, targets, objects, []),
    );
    expect(CheckErpJournalInput(BC, journal())[0]).toMatch(/^Batch number cannot be checked: no field length is recorded for business-central journalLines\.documentNumber/);
  });
});

describe('CheckErpFieldOnSave', () => {
  const user = {} as UserInfo;
  const providerWith = (integrations: string[]): IMetadataProvider =>
    ({ RunView: vi.fn().mockResolvedValue({ Success: true, Results: integrations.map((Integration) => ({ Integration })) }) }) as unknown as IMetadataProvider;

  it('checks a code when some company posts to Business Central', async () => {
    const messages = await CheckErpFieldOnSave('DimensionValueCode', 'V'.repeat(21), user, providerWith([BC, 'HubSpot']));
    expect(messages).toEqual([`Dimension value code is 21 characters; ${BC} dimensionValues.code allows 20. Shorten it before saving.`]);
  });

  it('checks nothing when no company posts to an ERP with limits', async () => {
    const messages = await CheckErpFieldOnSave('DimensionValueCode', 'V'.repeat(21), user, providerWith(['HubSpot']));
    expect(messages).toEqual([]);
    expect(ExternalFieldLimitEngine.Instance.Config).not.toHaveBeenCalled();
  });

  it('fails loud when company integrations cannot be read', async () => {
    const provider = { RunView: vi.fn().mockResolvedValue({ Success: false, ErrorMessage: 'denied' }) } as unknown as IMetadataProvider;
    await expect(CheckErpFieldOnSave('DimensionCode', 'X', user, provider)).rejects.toThrow(/denied/);
  });
});
