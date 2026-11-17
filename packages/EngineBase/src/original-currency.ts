/**
 * Original-currency amounts on journal-entry lines, and the spot-rate lookup that supplies the rate.
 *
 * A line is always booked in the company's functional currency (`DebitAmount` / `CreditAmount`).
 * When the source transaction was in another currency, the line also records what it was in that
 * currency: `OriginalCurrencyCode`, `OriginalDebitAmount` or `OriginalCreditAmount` on the same
 * side, and `ExchangeRateUsed`.
 *
 * RATE DIRECTION. `ExchangeRateUsed` is functional-currency units per ONE unit of the original
 * currency, so `original × rate = functional`. That is the same direction `CurrencySpotRate` stores:
 * `Rate` is units of `ToCurrencyCode` per one unit of `FromCurrencyCode`. A line booked from an AUD
 * amount in a USD company uses the AUD → USD row (From = AUD, To = USD) as its rate unchanged.
 *
 * The table's CHECK constraints keep the fields present together and on the line's side; they do
 * not compare values. {@link OriginalCurrencyProblem} does, so a line whose original amount and rate
 * do not produce its functional amount is refused instead of disagreeing with the ledger
 * (bizapps-accounting#450). Pure, so the draft pipeline and the line entity run the same rule.
 *
 * CONNECTS TO:
 *   PIPELINE: ./pipeline.ts (validateDraftShape refuses a draft line this rule refuses)
 *   SERVER:   JournalEntryLineEntityServer.Validate (refuses the same line at save)
 *   CALLERS:  GetCurrencySpotRate — apps that book foreign-currency transactions read the rate here
 */
import { RunView, type IRunViewProvider, type UserInfo } from '@memberjunction/core';

/**
 * How far `original × rate` may sit from the functional amount: one cent. Amounts are stored to two
 * places and the rate to eight, so a correctly computed line is off by at most half a cent of
 * rounding; anything beyond a cent is a different amount or a different rate.
 */
export const ORIGINAL_AMOUNT_TOLERANCE = 0.01;

/** Floating-point slack so a difference of exactly one cent is not refused for 0.010000000000002. */
const EPSILON = 1e-9;

const CURRENCY_CODE = /^[A-Z]{3}$/;
const CALENDAR_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** The fields of a journal-entry line this rule reads. Matches both a draft line and the entity. */
export interface OriginalCurrencyLine {
  DebitAmount?: number | null;
  CreditAmount?: number | null;
  OriginalCurrencyCode?: string | null;
  OriginalDebitAmount?: number | null;
  OriginalCreditAmount?: number | null;
  ExchangeRateUsed?: number | null;
}

/** True when the line carries any original-currency field. */
export function HasOriginalCurrency(line: OriginalCurrencyLine): boolean {
  return (
    line.OriginalCurrencyCode != null ||
    line.OriginalDebitAmount != null ||
    line.OriginalCreditAmount != null ||
    line.ExchangeRateUsed != null
  );
}

const positive = (n: number | null | undefined): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;

/**
 * Why the line's original-currency fields cannot be saved, or null when they are absent or agree.
 *
 * Refuses: a code that is not three upper-case letters; no original amount, or one on both sides,
 * or one on the other side from the functional amount; an amount or rate that is not above zero; and
 * an original amount whose product with the rate differs from the functional amount by more than
 * {@link ORIGINAL_AMOUNT_TOLERANCE}.
 */
export function OriginalCurrencyProblem(line: OriginalCurrencyLine): string | null {
  if (!HasOriginalCurrency(line)) return null;

  const code = line.OriginalCurrencyCode;
  if (typeof code !== 'string' || !CURRENCY_CODE.test(code)) {
    return `The original currency code '${String(code ?? '')}' is not a three-letter upper-case currency code.`;
  }
  const hasDebit = line.OriginalDebitAmount != null;
  const hasCredit = line.OriginalCreditAmount != null;
  if (hasDebit === hasCredit) {
    return 'A line in another currency needs an original debit amount or an original credit amount, not both and not neither.';
  }
  const functional = hasDebit ? line.DebitAmount : line.CreditAmount;
  if (functional == null) {
    return `The original amount is a ${hasDebit ? 'debit' : 'credit'}, but the line is a ${hasDebit ? 'credit' : 'debit'}. Both amounts go on the same side.`;
  }
  const original = hasDebit ? line.OriginalDebitAmount : line.OriginalCreditAmount;
  if (!positive(original)) {
    return `The original amount must be greater than zero; this line has ${String(original)}.`;
  }
  const rate = line.ExchangeRateUsed;
  if (!positive(rate)) {
    return `A line in ${code} needs an exchange rate greater than zero; this line has ${String(rate ?? 'none')}.`;
  }
  const expected = original * rate;
  if (Math.abs(expected - functional) > ORIGINAL_AMOUNT_TOLERANCE + EPSILON) {
    return `${original.toFixed(2)} ${code} at a rate of ${rate} is ${expected.toFixed(2)}, but the line's amount is ` +
      `${functional.toFixed(2)}. The two may differ by at most ${ORIGINAL_AMOUNT_TOLERANCE.toFixed(2)}.`;
  }
  return null;
}

// ─── spot-rate lookup ────────────────────────────────────────────────────────

/** A `CurrencySpotRate` row as {@link GetCurrencySpotRate} returns it. */
export interface CurrencySpotRateLookup {
  ID: string;
  FromCurrencyCode: string;
  ToCurrencyCode: string;
  /** The rate's own day, `YYYY-MM-DD`: on or before the day asked for. */
  RateDate: string;
  /** Units of `ToCurrencyCode` per one unit of `FromCurrencyCode`. */
  Rate: number;
  Source: string;
}

interface SpotRateRow {
  ID: string;
  FromCurrencyCode: string;
  ToCurrencyCode: string;
  RateDate: string | Date;
  Rate: number | string;
  Source: string;
}

/** A Date as its UTC calendar day (DATE columns arrive as UTC midnight), or a day string as given. */
function toDay(value: string | Date): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
}

/**
 * The spot rate to convert `fromCurrencyCode` into `toCurrencyCode` on `onDay`: the active
 * `CurrencySpotRate` row for that exact pair with the latest `RateDate` on or before the day. Null
 * when there is none.
 *
 * Direction: the result's `Rate` is units of `toCurrencyCode` per one unit of `fromCurrencyCode`, so
 * `amount in from × Rate = amount in to`. To book an AUD amount in USD, ask for ('AUD', 'USD'). The
 * lookup does not invert the opposite pair: a USD → AUD row does not answer an AUD → USD question,
 * because which direction finance enters is the record of what rate was agreed.
 *
 * When two sources hold a rate for the same latest day, the one changed most recently wins.
 *
 * @param onDay  A `YYYY-MM-DD` calendar day, or a Date read as its UTC day.
 * @throws when a code is not three upper-case letters or the day is not `YYYY-MM-DD`, or the read fails.
 */
export async function GetCurrencySpotRate(
  fromCurrencyCode: string,
  toCurrencyCode: string,
  onDay: string | Date,
  contextUser?: UserInfo,
  provider?: IRunViewProvider,
): Promise<CurrencySpotRateLookup | null> {
  if (!CURRENCY_CODE.test(fromCurrencyCode) || !CURRENCY_CODE.test(toCurrencyCode)) {
    throw new Error(`GetCurrencySpotRate: '${fromCurrencyCode}' and '${toCurrencyCode}' must both be three-letter upper-case currency codes.`);
  }
  const day = toDay(onDay);
  if (!CALENDAR_DAY.test(day)) {
    throw new Error(`GetCurrencySpotRate: '${String(onDay)}' is not a YYYY-MM-DD calendar day.`);
  }
  const result = await new RunView(provider ?? null).RunView<SpotRateRow>(
    {
      EntityName: 'MJ_BizApps_Accounting: Currency Spot Rates',
      // Codes and day are validated above, so they are safe to place in the filter.
      ExtraFilter:
        `FromCurrencyCode = '${fromCurrencyCode}' AND ToCurrencyCode = '${toCurrencyCode}' ` +
        `AND RateDate <= '${day}' AND IsActive = 1`,
      OrderBy: 'RateDate DESC, __mj_UpdatedAt DESC',
      Fields: ['ID', 'FromCurrencyCode', 'ToCurrencyCode', 'RateDate', 'Rate', 'Source'],
      MaxRows: 1,
      ResultType: 'simple',
    },
    contextUser,
  );
  if (!result.Success) {
    throw new Error(`GetCurrencySpotRate: could not read spot rates for ${fromCurrencyCode} → ${toCurrencyCode}: ${result.ErrorMessage}`);
  }
  const row = result.Results[0];
  if (!row) return null;
  return {
    ID: row.ID,
    FromCurrencyCode: row.FromCurrencyCode,
    ToCurrencyCode: row.ToCurrencyCode,
    RateDate: toDay(row.RateDate),
    Rate: Number(row.Rate),
    Source: row.Source,
  };
}
