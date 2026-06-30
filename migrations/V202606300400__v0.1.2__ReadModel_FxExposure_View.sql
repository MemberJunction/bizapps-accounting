-- =============================================================================
-- Block 6 (cont.) — vw_FxExposure read-model view.
--
-- Surfaces the FX position the subledger CAN see today from its own data: foreign-currency-denominated
-- JE lines (OriginalCurrencyCode set + ≠ the company's functional currency), netted per Company × currency,
-- with the booked functional value and — when a current spot rate exists — the implied unrealized FX delta.
--
-- Works with what we have now: JournalEntryLine carries OriginalCurrencyCode / OriginalDebit/CreditAmount /
-- ExchangeRateUsed; CurrencySpotRate carries the latest rate per pair. The reval CALC (whether the realized/
-- unrealized FX entry is generated here or in Payments) is still under discussion (W5 / §C1) — this view does
-- not generate anything; it reports the exposure. If CurrencySpotRate is unpopulated, CurrentSpotRate +
-- UnrealizedFxDelta are NULL and the view still shows the booked foreign-currency position (degrades cleanly).
-- =============================================================================

CREATE OR ALTER VIEW __mj_BizAppsAccounting.vw_FxExposure AS
WITH spot AS (
    -- latest active spot rate per (from,to) currency pair
    SELECT FromCurrencyCode, ToCurrencyCode, Rate,
           ROW_NUMBER() OVER (PARTITION BY FromCurrencyCode, ToCurrencyCode ORDER BY RateDate DESC) AS rn
    FROM __mj_BizAppsAccounting.CurrencySpotRate
    WHERE IsActive = 1
),
pos AS (
    -- net foreign-currency position per Company × original currency, over committed JE lines
    SELECT
        je.CompanyID,
        acp.FunctionalCurrencyCode,
        jel.OriginalCurrencyCode,
        SUM(ISNULL(jel.OriginalDebitAmount, 0) - ISNULL(jel.OriginalCreditAmount, 0)) AS NetOriginalAmount,
        SUM(ISNULL(jel.DebitAmount, 0)         - ISNULL(jel.CreditAmount, 0))         AS NetFunctionalBooked,
        COUNT(*)                                                                       AS LineCount
    FROM __mj_BizAppsAccounting.JournalEntryLine jel
    JOIN __mj_BizAppsAccounting.JournalEntry je ON je.ID = jel.JournalEntryID
    JOIN __mj_BizAppsAccounting.AccountingCompanyProfile acp ON acp.ID = je.CompanyID
    WHERE jel.OriginalCurrencyCode IS NOT NULL
      AND jel.OriginalCurrencyCode <> acp.FunctionalCurrencyCode   -- true foreign exposure only
      AND je.Status IN ('Batched', 'GLPosted')
    GROUP BY je.CompanyID, acp.FunctionalCurrencyCode, jel.OriginalCurrencyCode
)
SELECT
    pos.CompanyID,
    c.Name                          AS CompanyName,
    pos.FunctionalCurrencyCode,
    pos.OriginalCurrencyCode,
    pos.NetOriginalAmount,
    pos.NetFunctionalBooked,
    pos.LineCount,
    s.Rate                          AS CurrentSpotRate,
    -- exposure: foreign position valued at the current rate, less what was booked in functional terms.
    -- NULL until a spot rate exists for the pair (no fabricated number).
    CASE WHEN s.Rate IS NOT NULL
         THEN ROUND(pos.NetOriginalAmount * s.Rate - pos.NetFunctionalBooked, 2)
         ELSE NULL END              AS UnrealizedFxDelta
FROM pos
LEFT JOIN __mj.Company c ON c.ID = pos.CompanyID
LEFT JOIN spot s ON s.FromCurrencyCode = pos.OriginalCurrencyCode
                AND s.ToCurrencyCode = pos.FunctionalCurrencyCode
                AND s.rn = 1;
GO
