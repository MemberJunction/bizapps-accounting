-- =============================================================================
-- Migration: V202610201100__v0.24.x__JournalEntry_DayOfWeek_Independent_Of_DateFirst.sql
-- Description: #395 — vwJournalEntries computes EffectiveDayOfWeek and IsWeekend
--              the same way on every host, whatever the session's DATEFIRST.
-- =============================================================================
--
-- WHY
--
-- DATEPART(weekday, d) numbers days from the session's @@DATEFIRST, which the
-- login language sets. Under DATEFIRST 7 (US English) 1 is Sunday and 7 is
-- Saturday; under DATEFIRST 1, 1 is Monday and 7 is Sunday. The view marked
-- days 1 and 7 as the weekend, so on a DATEFIRST 1 host Sunday and Monday were
-- the weekend, and the anomaly model's day-of-week features changed with server
-- settings.
--
-- WHAT CHANGES
--
-- Both columns count days from 1 January 1900, a Monday, which no session
-- setting changes: DATEDIFF(day, '19000101', d) % 7 is 0 for Monday through 6
-- for Sunday. EffectiveDayOfWeek keeps the numbering the view has always
-- produced on a DATEFIRST 7 host (1 = Sunday, 7 = Saturday), so models trained
-- on those hosts see the same values. IsWeekend is 1 for Saturday and Sunday
-- only. The PostgreSQL counterpart uses EXTRACT(ISODOW ...) on the date, which
-- no session setting or time zone changes.
--
-- Every other column is unchanged, in the same order and of the same type. The
-- view is dropped and re-created, as every earlier definer did, so the grants
-- are re-applied below.
-- =============================================================================

DROP VIEW [${flyway:defaultSchema}].[vwJournalEntries];
GO

CREATE VIEW [${flyway:defaultSchema}].[vwJournalEntries]
AS
SELECT
    g.*,
    -- Engineered features for Predictive Studio anomaly detection modeling
    -- AnomalyOutcome heuristic: Reversals or unlinked ledger adjustments represent
    -- high-risk audit flags. These signals are withheld from the training feature
    -- set (TotalDebitAmount, LineCount, EffectiveMonth, EffectiveDayOfWeek, IsWeekend)
    -- to prevent target leakage.
    CASE
        WHEN g.ReversesJournalEntryID IS NOT NULL
          OR g.ReversedByJournalEntryID IS NOT NULL
          OR (g.LinkedRecordID IS NULL AND g.LinkedEntityID IS NULL)
        THEN 'Anomalous'
        ELSE 'Normal'
    END AS AnomalyOutcome,
    ISNULL(agg.TotalDebitAmount, 0) AS TotalDebitAmount,
    ISNULL(agg.LineCount, 0) AS LineCount,
    MONTH(g.EffectiveDate) AS EffectiveMonth,
    -- 1 = Sunday through 7 = Saturday whatever the session's DATEFIRST (#395).
    -- 1 January 1900 was a Monday.
    (DATEDIFF(day, '19000101', g.EffectiveDate) + 1) % 7 + 1 AS EffectiveDayOfWeek,
    CASE WHEN DATEDIFF(day, '19000101', g.EffectiveDate) % 7 IN (5, 6) THEN 1 ELSE 0 END AS IsWeekend,
    CASE WHEN g.LinkedRecordID IS NOT NULL THEN 1 ELSE 0 END AS HasLinkedRecord,
    CASE WHEN g.FileID IS NOT NULL THEN 1 ELSE 0 END AS HasFile
FROM
    [${flyway:defaultSchema}].[vwJournalEntriesGenerated] AS g
LEFT OUTER JOIN (
    SELECT
        jel.JournalEntryID,
        SUM(jel.DebitAmount) AS TotalDebitAmount,
        COUNT(*) AS LineCount
    FROM [${flyway:defaultSchema}].[JournalEntryLine] jel
    GROUP BY jel.JournalEntryID
) AS agg ON agg.JournalEntryID = g.ID;
GO

IF DATABASE_PRINCIPAL_ID('cdp_UI') IS NOT NULL
    EXEC('GRANT SELECT ON [${flyway:defaultSchema}].[vwJournalEntries] TO [cdp_UI]');
IF DATABASE_PRINCIPAL_ID('cdp_Developer') IS NOT NULL
    EXEC('GRANT SELECT ON [${flyway:defaultSchema}].[vwJournalEntries] TO [cdp_Developer]');
IF DATABASE_PRINCIPAL_ID('cdp_Integration') IS NOT NULL
    EXEC('GRANT SELECT ON [${flyway:defaultSchema}].[vwJournalEntries] TO [cdp_Integration]');
GO
