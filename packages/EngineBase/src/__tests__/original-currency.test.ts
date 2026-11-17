/**
 * Original-currency amounts on journal-entry lines (bizapps-accounting#450): the one-cent agreement
 * rule, how the draft pipeline carries the fields to write-ready lines, and the spot-rate lookup.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { RunView } from '@memberjunction/core';
import type { JournalEntryDraft } from '../contract.js';
import { normalizeLines, runDraftPipeline, validateDraftShape, type PipelineLookups } from '../pipeline.js';
import { GetCurrencySpotRate, OriginalCurrencyProblem, ORIGINAL_AMOUNT_TOLERANCE } from '../original-currency.js';

const CO = 'ca000000-0000-4000-8000-000000000001';
const GL_AR = 'aaaaaaaa-0000-4000-8000-000000000001';
const GL_REV = 'aaaaaaaa-0000-4000-8000-000000000002';

const lookups: PipelineLookups = {
  accountByID: (id) => ({ ID: id, CompanyID: CO, IsActive: true }),
  entryTypeByCode: () => ({ ID: 'jet-1', Code: 'Manual', IsActive: true, IsJournalEntryBatchSummary: false }),
  dimensionExists: () => true,
  dimensionValueBelongs: () => true,
};

describe('OriginalCurrencyProblem', () => {
  const fx = { DebitAmount: 66.15, OriginalCurrencyCode: 'AUD', OriginalDebitAmount: 100, ExchangeRateUsed: 0.6615 };

  it('accepts a line with no original-currency fields', () => {
    expect(OriginalCurrencyProblem({ DebitAmount: 100 })).toBeNull();
  });

  it('accepts a line whose original amount × rate is its amount', () => {
    expect(OriginalCurrencyProblem(fx)).toBeNull();
  });

  it('accepts a difference of exactly one cent', () => {
    expect(ORIGINAL_AMOUNT_TOLERANCE).toBe(0.01);
    expect(OriginalCurrencyProblem({ ...fx, DebitAmount: 66.16 })).toBeNull();
    expect(OriginalCurrencyProblem({ ...fx, DebitAmount: 66.14 })).toBeNull();
  });

  it('refuses a difference of more than one cent', () => {
    expect(OriginalCurrencyProblem({ ...fx, DebitAmount: 66.17 })).toMatch(/100\.00 AUD at a rate of 0\.6615 is 66\.15, but the line's amount is 66\.17/);
  });

  it('refuses the example from the issue: 5000 at 0.5 against 100', () => {
    expect(OriginalCurrencyProblem({ DebitAmount: 100, OriginalCurrencyCode: 'EUR', OriginalDebitAmount: 5000, ExchangeRateUsed: 0.5 })).not.toBeNull();
  });

  it('checks a credit line against its credit amount', () => {
    expect(OriginalCurrencyProblem({ CreditAmount: 66.15, OriginalCurrencyCode: 'AUD', OriginalCreditAmount: 100, ExchangeRateUsed: 0.6615 })).toBeNull();
    expect(OriginalCurrencyProblem({ CreditAmount: 70, OriginalCurrencyCode: 'AUD', OriginalCreditAmount: 100, ExchangeRateUsed: 0.6615 })).not.toBeNull();
  });

  it('refuses an original amount on the other side from the line amount', () => {
    expect(OriginalCurrencyProblem({ CreditAmount: 66.15, OriginalCurrencyCode: 'AUD', OriginalDebitAmount: 100, ExchangeRateUsed: 0.6615 })).toMatch(/same side/);
  });

  it('refuses incomplete or invalid fields', () => {
    expect(OriginalCurrencyProblem({ ...fx, OriginalCurrencyCode: undefined })).toMatch(/currency code/);
    expect(OriginalCurrencyProblem({ ...fx, OriginalCurrencyCode: 'aud' })).toMatch(/currency code/);
    expect(OriginalCurrencyProblem({ ...fx, OriginalDebitAmount: undefined })).toMatch(/not both and not neither/);
    expect(OriginalCurrencyProblem({ ...fx, OriginalCreditAmount: 100 })).toMatch(/not both and not neither/);
    expect(OriginalCurrencyProblem({ ...fx, ExchangeRateUsed: undefined })).toMatch(/exchange rate/);
    expect(OriginalCurrencyProblem({ ...fx, ExchangeRateUsed: 0 })).toMatch(/exchange rate/);
    expect(OriginalCurrencyProblem({ ...fx, OriginalDebitAmount: -100 })).toMatch(/greater than zero/);
  });
});

describe('the draft pipeline carries original-currency fields to the lines it writes', () => {
  const draft = (debit: number): JournalEntryDraft => ({
    EffectiveDate: '2026-11-17',
    EntryType: 'Manual',
    Lines: [
      { GLAccountID: GL_AR, DebitAmount: debit, OriginalCurrencyCode: 'AUD', OriginalDebitAmount: 13230, ExchangeRateUsed: 0.6615 },
      { GLAccountID: GL_REV, CreditAmount: 8751.65, OriginalCurrencyCode: 'AUD', OriginalCreditAmount: 13230, ExchangeRateUsed: 0.6615 },
    ],
  });

  it('maps each draft line to a write-ready line with its original amount on its own side', () => {
    const outcome = runDraftPipeline(draft(8751.65), lookups);
    expect(outcome.errors).toEqual([]);
    expect(outcome.normalized.map(l => ({
      DebitAmount: l.DebitAmount, CreditAmount: l.CreditAmount, OriginalCurrencyCode: l.OriginalCurrencyCode,
      OriginalDebitAmount: l.OriginalDebitAmount, OriginalCreditAmount: l.OriginalCreditAmount, ExchangeRateUsed: l.ExchangeRateUsed,
    }))).toEqual([
      { DebitAmount: 8751.65, CreditAmount: null, OriginalCurrencyCode: 'AUD', OriginalDebitAmount: 13230, OriginalCreditAmount: null, ExchangeRateUsed: 0.6615 },
      { DebitAmount: null, CreditAmount: 8751.65, OriginalCurrencyCode: 'AUD', OriginalDebitAmount: null, OriginalCreditAmount: 13230, ExchangeRateUsed: 0.6615 },
    ]);
  });

  it('writes all-null original fields for a functional-currency line', () => {
    const lines = normalizeLines({ EffectiveDate: '2026-11-17', EntryType: 'Manual', Lines: [
      { GLAccountID: GL_AR, DebitAmount: 10 }, { GLAccountID: GL_REV, CreditAmount: 10 },
    ] }, lookups);
    for (const l of lines) {
      expect([l.OriginalCurrencyCode, l.OriginalDebitAmount, l.OriginalCreditAmount, l.ExchangeRateUsed]).toEqual([null, null, null, null]);
    }
  });

  it('refuses a line whose amount × rate disagrees, naming the line', () => {
    const errors = validateDraftShape(draft(8800));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ Code: 'ORIGINAL_AMOUNT_MISMATCH', LineIndex: 0 });
  });

  it('does not merge two same-account lines in another currency', () => {
    const lines = normalizeLines({ EffectiveDate: '2026-11-17', EntryType: 'Manual', Lines: [
      { GLAccountID: GL_AR, DebitAmount: 66.15, OriginalCurrencyCode: 'AUD', OriginalDebitAmount: 100, ExchangeRateUsed: 0.6615 },
      { GLAccountID: GL_AR, DebitAmount: 66.15, OriginalCurrencyCode: 'AUD', OriginalDebitAmount: 100, ExchangeRateUsed: 0.6615 },
      { GLAccountID: GL_REV, CreditAmount: 132.3 },
    ] }, lookups);
    expect(lines.filter(l => l.DebitAmount != null)).toHaveLength(2);
  });

  it('still merges functional-currency lines on the same account', () => {
    const lines = normalizeLines({ EffectiveDate: '2026-11-17', EntryType: 'Manual', Lines: [
      { GLAccountID: GL_AR, DebitAmount: 5 }, { GLAccountID: GL_AR, DebitAmount: 5 }, { GLAccountID: GL_REV, CreditAmount: 10 },
    ] }, lookups);
    expect(lines).toHaveLength(2);
  });
});

describe('GetCurrencySpotRate', () => {
  afterEach(() => vi.restoreAllMocks());

  function fakeRunView(results: object[], success = true) {
    return vi.spyOn(RunView.prototype, 'RunView').mockResolvedValue({
      Success: success, Results: results, ErrorMessage: success ? '' : 'boom',
    } as Awaited<ReturnType<RunView['RunView']>>);
  }

  it('asks for the latest active rate of that exact pair on or before the day', async () => {
    const spy = fakeRunView([]);
    await GetCurrencySpotRate('AUD', 'USD', '2026-11-17');
    const params = spy.mock.calls[0][0];
    expect(params.EntityName).toBe('MJ_BizApps_Accounting: Currency Spot Rates');
    expect(params.ExtraFilter).toBe("FromCurrencyCode = 'AUD' AND ToCurrencyCode = 'USD' AND RateDate <= '2026-11-17' AND IsActive = 1");
    expect(params.OrderBy).toBe('RateDate DESC, __mj_UpdatedAt DESC');
    expect(params.MaxRows).toBe(1);
  });

  it('reads a Date as its UTC day', async () => {
    const spy = fakeRunView([]);
    await GetCurrencySpotRate('AUD', 'USD', new Date(Date.UTC(2026, 10, 17)));
    expect(spy.mock.calls[0][0].ExtraFilter).toContain("RateDate <= '2026-11-17'");
  });

  it('returns the row with a numeric rate and a calendar-day date', async () => {
    fakeRunView([{ ID: 'r1', FromCurrencyCode: 'AUD', ToCurrencyCode: 'USD', RateDate: new Date(Date.UTC(2026, 10, 14)), Rate: '0.66150000', Source: 'Manual' }]);
    expect(await GetCurrencySpotRate('AUD', 'USD', '2026-11-17')).toEqual({
      ID: 'r1', FromCurrencyCode: 'AUD', ToCurrencyCode: 'USD', RateDate: '2026-11-14', Rate: 0.6615, Source: 'Manual',
    });
  });

  it('returns null when no rate is on or before the day', async () => {
    fakeRunView([]);
    expect(await GetCurrencySpotRate('AUD', 'USD', '2026-11-17')).toBeNull();
  });

  it('refuses a malformed code or day before querying', async () => {
    const spy = fakeRunView([]);
    await expect(GetCurrencySpotRate("AUD' OR 1=1 --", 'USD', '2026-11-17')).rejects.toThrow(/currency codes/);
    await expect(GetCurrencySpotRate('AUD', 'USD', 'yesterday')).rejects.toThrow(/calendar day/);
    expect(spy).not.toHaveBeenCalled();
  });

  it('throws when the read fails', async () => {
    fakeRunView([], false);
    await expect(GetCurrencySpotRate('AUD', 'USD', '2026-11-17')).rejects.toThrow(/boom/);
  });
});
