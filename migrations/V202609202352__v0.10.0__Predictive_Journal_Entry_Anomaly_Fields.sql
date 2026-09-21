-- =============================================================================
-- BizAppsAccounting: Add Predictive Anomaly Outcome Columns & Layered Base Views
-- Materialized columns for Predictive Studio journal entry anomaly forecasting and
-- engineered relational & temporal training features computed via layered vwJournalEntries.
-- =============================================================================

---------------------------------------------------------------------------
-- 1. JournalEntry: Add materialized prediction fields
---------------------------------------------------------------------------
ALTER TABLE [${flyway:defaultSchema}].[JournalEntry]
    ADD [PredictedAnomalyProbability] DECIMAL(5, 4) NULL,
        [PredictedAnomalyRiskBand] NVARCHAR(20) NULL,
        [PredictedAnomalyScoredAt] DATETIMEOFFSET NULL;
GO

ALTER TABLE [${flyway:defaultSchema}].[JournalEntry]
    ADD CONSTRAINT [CK_JournalEntry_PredictedAnomalyRiskBand]
        CHECK ([PredictedAnomalyRiskBand] IN ('Low', 'Medium', 'High', 'Critical'));
GO

EXEC sp_addextendedproperty
    @name = N'MS_Description',
    @value = N'0.0000 to 1.0000 probability that the journal entry is anomalous or represents irregular posting activity.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'JournalEntry',
    @level2type = N'COLUMN', @level2name = N'PredictedAnomalyProbability';
GO

EXEC sp_addextendedproperty
    @name = N'MS_Description',
    @value = N'Categorical risk tier derived from anomaly probability: Low, Medium, High, Critical.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'JournalEntry',
    @level2type = N'COLUMN', @level2name = N'PredictedAnomalyRiskBand';
GO

EXEC sp_addextendedproperty
    @name = N'MS_Description',
    @value = N'Timestamp when the journal entry was last scored by the predictive anomaly model.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'JournalEntry',
    @level2type = N'COLUMN', @level2name = N'PredictedAnomalyScoredAt';
GO

---------------------------------------------------------------------------
-- 2. Establish Layered Base Views for Journal Entries
---------------------------------------------------------------------------
UPDATE [${mjSchema}].[Entity]
   SET [BaseViewGenerated] = 0,
       [GeneratedBaseViewName] = 'vwJournalEntriesGenerated'
 WHERE [Name] = 'MJ_BizApps_Accounting: Journal Entries'
   AND ([BaseViewGenerated] <> 0
        OR [GeneratedBaseViewName] IS NULL
        OR [GeneratedBaseViewName] <> 'vwJournalEntriesGenerated');
GO

IF OBJECT_ID('[${flyway:defaultSchema}].[vwJournalEntriesGenerated]', 'V') IS NOT NULL
    DROP VIEW [${flyway:defaultSchema}].[vwJournalEntriesGenerated];
GO

CREATE VIEW [${flyway:defaultSchema}].[vwJournalEntriesGenerated]
AS
SELECT
    j.*,
    MJCompany_CompanyID.[Name] AS [Company],
    mjBizAppsAccountingJournalEntryType_EntryTypeID.[Name] AS [EntryType],
    MJEntity_LinkedEntityID.[Name] AS [LinkedEntity],
    mjBizAppsAccountingJournalEntry_ReversesJournalEntryID.[EntryNumber] AS [ReversesJournalEntry],
    mjBizAppsAccountingJournalEntry_ReversedByJournalEntryID.[EntryNumber] AS [ReversedByJournalEntry],
    mjBizAppsAccountingJournalEntryBatch_JournalEntryBatchID.[JournalEntryBatchNumber] AS [JournalEntryBatch],
    MJFile_FileID.[Name] AS [File]
FROM
    [${flyway:defaultSchema}].[JournalEntry] AS j
INNER JOIN
    [${mjSchema}].[Company] AS MJCompany_CompanyID
  ON
    [j].[CompanyID] = MJCompany_CompanyID.[ID]
INNER JOIN
    [${flyway:defaultSchema}].[JournalEntryType] AS mjBizAppsAccountingJournalEntryType_EntryTypeID
  ON
    [j].[EntryTypeID] = mjBizAppsAccountingJournalEntryType_EntryTypeID.[ID]
LEFT OUTER JOIN
    [${mjSchema}].[Entity] AS MJEntity_LinkedEntityID
  ON
    [j].[LinkedEntityID] = MJEntity_LinkedEntityID.[ID]
LEFT OUTER JOIN
    [${flyway:defaultSchema}].[JournalEntry] AS mjBizAppsAccountingJournalEntry_ReversesJournalEntryID
  ON
    [j].[ReversesJournalEntryID] = mjBizAppsAccountingJournalEntry_ReversesJournalEntryID.[ID]
LEFT OUTER JOIN
    [${flyway:defaultSchema}].[JournalEntry] AS mjBizAppsAccountingJournalEntry_ReversedByJournalEntryID
  ON
    [j].[ReversedByJournalEntryID] = mjBizAppsAccountingJournalEntry_ReversedByJournalEntryID.[ID]
LEFT OUTER JOIN
    [${flyway:defaultSchema}].[JournalEntryBatch] AS mjBizAppsAccountingJournalEntryBatch_JournalEntryBatchID
  ON
    [j].[JournalEntryBatchID] = mjBizAppsAccountingJournalEntryBatch_JournalEntryBatchID.[ID]
LEFT OUTER JOIN
    [${mjSchema}].[File] AS MJFile_FileID
  ON
    [j].[FileID] = MJFile_FileID.[ID];
GO

IF OBJECT_ID('[${flyway:defaultSchema}].[vwJournalEntries]', 'V') IS NOT NULL
    DROP VIEW [${flyway:defaultSchema}].[vwJournalEntries];
GO

CREATE VIEW [${flyway:defaultSchema}].[vwJournalEntries]
AS
SELECT
    g.*,
    -- Engineered features for Predictive Studio anomaly detection modeling
    -- AnomalyOutcome heuristic: Journal entries >= $500, created on weekends,
    -- with > 2 lines, or lacking a linked business record are flagged anomalous
    -- for training data baseline generation.
    CASE 
        WHEN ISNULL(agg.TotalDebitAmount, 0) >= 500
          OR DATEPART(weekday, g.EffectiveDate) IN (1, 7)
          OR ISNULL(agg.LineCount, 0) > 2
          OR g.LinkedRecordID IS NULL
        THEN 'Anomalous' 
        ELSE 'Normal' 
    END AS AnomalyOutcome,
    ISNULL(agg.TotalDebitAmount, 0) AS TotalDebitAmount,
    ISNULL(agg.LineCount, 0) AS LineCount,
    MONTH(g.EffectiveDate) AS EffectiveMonth,
    DATEPART(weekday, g.EffectiveDate) AS EffectiveDayOfWeek,
    CASE WHEN DATEPART(weekday, g.EffectiveDate) IN (1, 7) THEN 1 ELSE 0 END AS IsWeekend,
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














































































































-- =============================================================================
-- CODEGEN OUTPUT — GENERATED CODE BELOW THIS LINE. DO NOT EDIT BY HAND.
-- =============================================================================

/* SQL text to update existing entities from schema */
EXEC [${mjSchema}].[spUpdateExistingEntitiesFromSchema] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';

DECLARE @JournalEntryEntityID UNIQUEIDENTIFIER =
    (SELECT [ID] FROM [${mjSchema}].[Entity] WHERE [Name] = 'MJ_BizApps_Accounting: Journal Entries');
IF @JournalEntryEntityID IS NULL RAISERROR('Journal Entries entity not registered', 16, 1);

/* SQL text to insert 11 new entity field(s) */

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '65a6d82b-e0f2-441c-b528-d02fd788cba5' OR (EntityID = @JournalEntryEntityID AND Name = 'PredictedAnomalyProbability')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '65a6d82b-e0f2-441c-b528-d02fd788cba5',
            @JournalEntryEntityID, -- Entity: MJ_BizApps_Accounting: Journal Entries
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = @JournalEntryEntityID),
            'PredictedAnomalyProbability',
            'Predicted Anomaly Probability',
            '0.0000 to 1.0000 probability that the journal entry is anomalous or represents irregular posting activity.',
            'decimal',
            5,
            5,
            4,
            1,
            NULL,
            0,
            1,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '13845d9d-67e5-427c-956f-ec0fb19b5859' OR (EntityID = @JournalEntryEntityID AND Name = 'PredictedAnomalyRiskBand')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '13845d9d-67e5-427c-956f-ec0fb19b5859',
            @JournalEntryEntityID, -- Entity: MJ_BizApps_Accounting: Journal Entries
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = @JournalEntryEntityID),
            'PredictedAnomalyRiskBand',
            'Predicted Anomaly Risk Band',
            'Categorical risk tier derived from anomaly probability: Low, Medium, High, Critical.',
            'nvarchar',
            40,
            0,
            0,
            1,
            NULL,
            0,
            1,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '85fb2f62-1428-43df-8053-90e3014500a0' OR (EntityID = @JournalEntryEntityID AND Name = 'PredictedAnomalyScoredAt')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '85fb2f62-1428-43df-8053-90e3014500a0',
            @JournalEntryEntityID, -- Entity: MJ_BizApps_Accounting: Journal Entries
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = @JournalEntryEntityID),
            'PredictedAnomalyScoredAt',
            'Predicted Anomaly Scored At',
            'Timestamp when the journal entry was last scored by the predictive anomaly model.',
            'datetimeoffset',
            10,
            34,
            7,
            1,
            NULL,
            0,
            1,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '71836c90-010c-4f03-a0f2-abe0e37eda3d' OR (EntityID = @JournalEntryEntityID AND Name = 'AnomalyOutcome')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '71836c90-010c-4f03-a0f2-abe0e37eda3d',
            @JournalEntryEntityID, -- Entity: MJ_BizApps_Accounting: Journal Entries
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = @JournalEntryEntityID),
            'AnomalyOutcome',
            'Anomaly Outcome',
            NULL,
            'varchar',
            9,
            0,
            0,
            0,
            NULL,
            0,
            0,
            1,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'b55285d4-5dd5-42e4-8395-013e87ee0ecb' OR (EntityID = @JournalEntryEntityID AND Name = 'TotalDebitAmount')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            'b55285d4-5dd5-42e4-8395-013e87ee0ecb',
            @JournalEntryEntityID, -- Entity: MJ_BizApps_Accounting: Journal Entries
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = @JournalEntryEntityID),
            'TotalDebitAmount',
            'Total Debit Amount',
            NULL,
            'decimal',
            17,
            38,
            2,
            0,
            NULL,
            0,
            0,
            1,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '2bee0bbb-bc51-4fcf-9a48-45d9e25e8734' OR (EntityID = @JournalEntryEntityID AND Name = 'LineCount')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '2bee0bbb-bc51-4fcf-9a48-45d9e25e8734',
            @JournalEntryEntityID, -- Entity: MJ_BizApps_Accounting: Journal Entries
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = @JournalEntryEntityID),
            'LineCount',
            'Line Count',
            NULL,
            'int',
            4,
            10,
            0,
            0,
            NULL,
            0,
            0,
            1,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '0be539d7-f9ae-4ca6-b18b-9fe77f456617' OR (EntityID = @JournalEntryEntityID AND Name = 'EffectiveMonth')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '0be539d7-f9ae-4ca6-b18b-9fe77f456617',
            @JournalEntryEntityID, -- Entity: MJ_BizApps_Accounting: Journal Entries
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = @JournalEntryEntityID),
            'EffectiveMonth',
            'Effective Month',
            NULL,
            'int',
            4,
            10,
            0,
            1,
            NULL,
            0,
            0,
            1,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'e404e4ba-43e1-4d79-ae84-0a7c00f19f3c' OR (EntityID = @JournalEntryEntityID AND Name = 'EffectiveDayOfWeek')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            'e404e4ba-43e1-4d79-ae84-0a7c00f19f3c',
            @JournalEntryEntityID, -- Entity: MJ_BizApps_Accounting: Journal Entries
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = @JournalEntryEntityID),
            'EffectiveDayOfWeek',
            'Effective Day Of Week',
            NULL,
            'int',
            4,
            10,
            0,
            1,
            NULL,
            0,
            0,
            1,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'dda19850-854f-4d3b-ac92-1341b56e1990' OR (EntityID = @JournalEntryEntityID AND Name = 'IsWeekend')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            'dda19850-854f-4d3b-ac92-1341b56e1990',
            @JournalEntryEntityID, -- Entity: MJ_BizApps_Accounting: Journal Entries
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = @JournalEntryEntityID),
            'IsWeekend',
            'Is Weekend',
            NULL,
            'int',
            4,
            10,
            0,
            0,
            NULL,
            0,
            0,
            1,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '059438ff-3c74-4ab3-82ac-b08de48ef205' OR (EntityID = @JournalEntryEntityID AND Name = 'HasLinkedRecord')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '059438ff-3c74-4ab3-82ac-b08de48ef205',
            @JournalEntryEntityID, -- Entity: MJ_BizApps_Accounting: Journal Entries
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = @JournalEntryEntityID),
            'HasLinkedRecord',
            'Has Linked Record',
            NULL,
            'int',
            4,
            10,
            0,
            0,
            NULL,
            0,
            0,
            1,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '3388c921-27ff-42dd-b308-65e4577df0fe' OR (EntityID = @JournalEntryEntityID AND Name = 'HasFile')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '3388c921-27ff-42dd-b308-65e4577df0fe',
            @JournalEntryEntityID, -- Entity: MJ_BizApps_Accounting: Journal Entries
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = @JournalEntryEntityID),
            'HasFile',
            'Has File',
            NULL,
            'int',
            4,
            10,
            0,
            0,
            NULL,
            0,
            0,
            1,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

/* SQL text to update existing entity fields from schema */
EXEC [${mjSchema}].[spUpdateExistingEntityFieldsFromSchema] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to set default column width where needed */
EXEC [${mjSchema}].[spSetDefaultColumnWidthWhereNeeded] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to insert entity field value with ID 27bbcf7d-9f92-4308-a2f6-845bdf55bc0e */
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('27bbcf7d-9f92-4308-a2f6-845bdf55bc0e', '13845D9D-67E5-427C-956F-EC0FB19B5859', 1, 'Critical', 'Critical', GETUTCDATE(), GETUTCDATE());

/* SQL text to insert entity field value with ID 463cca8d-b9c3-4942-8140-a70fbfd74650 */
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('463cca8d-b9c3-4942-8140-a70fbfd74650', '13845D9D-67E5-427C-956F-EC0FB19B5859', 2, 'High', 'High', GETUTCDATE(), GETUTCDATE());

/* SQL text to insert entity field value with ID 96341ba7-97a0-483c-bb52-992f7af127b7 */
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('96341ba7-97a0-483c-bb52-992f7af127b7', '13845D9D-67E5-427C-956F-EC0FB19B5859', 3, 'Low', 'Low', GETUTCDATE(), GETUTCDATE());

/* SQL text to insert entity field value with ID edd4dc0e-8ac3-49ab-ba1e-5fbc8da58ebc */
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('edd4dc0e-8ac3-49ab-ba1e-5fbc8da58ebc', '13845D9D-67E5-427C-956F-EC0FB19B5859', 4, 'Medium', 'Medium', GETUTCDATE(), GETUTCDATE());

/* SQL text to update ValueListType for entity field ID 13845D9D-67E5-427C-956F-EC0FB19B5859 */
UPDATE [${mjSchema}].[EntityField] SET ValueListType='List' WHERE ID='13845D9D-67E5-427C-956F-EC0FB19B5859';

/* SQL text to sync schema info from database schemas */
EXEC [${mjSchema}].[spUpdateSchemaInfoFromDatabase] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';

/* Index for Foreign Keys for JournalEntry */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Journal Entries
-- Item: Index for Foreign Keys
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------
-- Index for foreign key CompanyID in table JournalEntry
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_JournalEntry_CompanyID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[JournalEntry]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_JournalEntry_CompanyID ON [${flyway:defaultSchema}].[JournalEntry] ([CompanyID]);

-- Index for foreign key EntryTypeID in table JournalEntry
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_JournalEntry_EntryTypeID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[JournalEntry]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_JournalEntry_EntryTypeID ON [${flyway:defaultSchema}].[JournalEntry] ([EntryTypeID]);

-- Index for foreign key LinkedEntityID in table JournalEntry
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_JournalEntry_LinkedEntityID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[JournalEntry]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_JournalEntry_LinkedEntityID ON [${flyway:defaultSchema}].[JournalEntry] ([LinkedEntityID]);

-- Index for foreign key ReversesJournalEntryID in table JournalEntry
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_JournalEntry_ReversesJournalEntryID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[JournalEntry]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_JournalEntry_ReversesJournalEntryID ON [${flyway:defaultSchema}].[JournalEntry] ([ReversesJournalEntryID]);

-- Index for foreign key ReversedByJournalEntryID in table JournalEntry
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_JournalEntry_ReversedByJournalEntryID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[JournalEntry]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_JournalEntry_ReversedByJournalEntryID ON [${flyway:defaultSchema}].[JournalEntry] ([ReversedByJournalEntryID]);

-- Index for foreign key JournalEntryBatchID in table JournalEntry
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_JournalEntry_JournalEntryBatchID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[JournalEntry]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_JournalEntry_JournalEntryBatchID ON [${flyway:defaultSchema}].[JournalEntry] ([JournalEntryBatchID]);

-- Index for foreign key FileID in table JournalEntry
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_JournalEntry_FileID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[JournalEntry]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_JournalEntry_FileID ON [${flyway:defaultSchema}].[JournalEntry] ([FileID]);

/* spCreate SQL for MJ_BizApps_Accounting: Journal Entries */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Journal Entries
-- Item: spCreateJournalEntry
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- CREATE PROCEDURE FOR JournalEntry
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spCreateJournalEntry]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spCreateJournalEntry];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spCreateJournalEntry]
    @ID uniqueidentifier = NULL,
    @EntryNumber nvarchar(40),
    @CompanyID uniqueidentifier,
    @EffectiveDate date,
    @EntryTypeID uniqueidentifier,
    @Status nvarchar(20) = NULL,
    @Description_Clear bit = 0,
    @Description nvarchar(MAX) = NULL,
    @LinkedEntityID_Clear bit = 0,
    @LinkedEntityID uniqueidentifier = NULL,
    @LinkedRecordID_Clear bit = 0,
    @LinkedRecordID nvarchar(400) = NULL,
    @ReversesJournalEntryID_Clear bit = 0,
    @ReversesJournalEntryID uniqueidentifier = NULL,
    @ReversedByJournalEntryID_Clear bit = 0,
    @ReversedByJournalEntryID uniqueidentifier = NULL,
    @JournalEntryBatchID_Clear bit = 0,
    @JournalEntryBatchID uniqueidentifier = NULL,
    @GLPostedAt_Clear bit = 0,
    @GLPostedAt datetimeoffset = NULL,
    @GLReferenceID_Clear bit = 0,
    @GLReferenceID nvarchar(100) = NULL,
    @FileID_Clear bit = 0,
    @FileID uniqueidentifier = NULL,
    @PredictedAnomalyProbability_Clear bit = 0,
    @PredictedAnomalyProbability decimal(5, 4) = NULL,
    @PredictedAnomalyRiskBand_Clear bit = 0,
    @PredictedAnomalyRiskBand nvarchar(20) = NULL,
    @PredictedAnomalyScoredAt_Clear bit = 0,
    @PredictedAnomalyScoredAt datetimeoffset = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @InsertedRow TABLE ([ID] UNIQUEIDENTIFIER)

    IF @ID IS NOT NULL
    BEGIN
        -- User provided a value, use it
        INSERT INTO [${flyway:defaultSchema}].[JournalEntry]
            (
                [ID],
                [EntryNumber],
                [CompanyID],
                [EffectiveDate],
                [EntryTypeID],
                [Status],
                [Description],
                [LinkedEntityID],
                [LinkedRecordID],
                [ReversesJournalEntryID],
                [ReversedByJournalEntryID],
                [JournalEntryBatchID],
                [GLPostedAt],
                [GLReferenceID],
                [FileID],
                [PredictedAnomalyProbability],
                [PredictedAnomalyRiskBand],
                [PredictedAnomalyScoredAt]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @ID,
                @EntryNumber,
                @CompanyID,
                @EffectiveDate,
                @EntryTypeID,
                ISNULL(@Status, 'Pending'),
                CASE WHEN @Description_Clear = 1 THEN NULL ELSE ISNULL(@Description, NULL) END,
                CASE WHEN @LinkedEntityID_Clear = 1 THEN NULL ELSE ISNULL(@LinkedEntityID, NULL) END,
                CASE WHEN @LinkedRecordID_Clear = 1 THEN NULL ELSE ISNULL(@LinkedRecordID, NULL) END,
                CASE WHEN @ReversesJournalEntryID_Clear = 1 THEN NULL ELSE ISNULL(@ReversesJournalEntryID, NULL) END,
                CASE WHEN @ReversedByJournalEntryID_Clear = 1 THEN NULL ELSE ISNULL(@ReversedByJournalEntryID, NULL) END,
                CASE WHEN @JournalEntryBatchID_Clear = 1 THEN NULL ELSE ISNULL(@JournalEntryBatchID, NULL) END,
                CASE WHEN @GLPostedAt_Clear = 1 THEN NULL ELSE ISNULL(@GLPostedAt, NULL) END,
                CASE WHEN @GLReferenceID_Clear = 1 THEN NULL ELSE ISNULL(@GLReferenceID, NULL) END,
                CASE WHEN @FileID_Clear = 1 THEN NULL ELSE ISNULL(@FileID, NULL) END,
                CASE WHEN @PredictedAnomalyProbability_Clear = 1 THEN NULL ELSE ISNULL(@PredictedAnomalyProbability, NULL) END,
                CASE WHEN @PredictedAnomalyRiskBand_Clear = 1 THEN NULL ELSE ISNULL(@PredictedAnomalyRiskBand, NULL) END,
                CASE WHEN @PredictedAnomalyScoredAt_Clear = 1 THEN NULL ELSE ISNULL(@PredictedAnomalyScoredAt, NULL) END
            )
    END
    ELSE
    BEGIN
        -- No value provided, let database use its default (e.g., NEWSEQUENTIALID())
        INSERT INTO [${flyway:defaultSchema}].[JournalEntry]
            (
                [EntryNumber],
                [CompanyID],
                [EffectiveDate],
                [EntryTypeID],
                [Status],
                [Description],
                [LinkedEntityID],
                [LinkedRecordID],
                [ReversesJournalEntryID],
                [ReversedByJournalEntryID],
                [JournalEntryBatchID],
                [GLPostedAt],
                [GLReferenceID],
                [FileID],
                [PredictedAnomalyProbability],
                [PredictedAnomalyRiskBand],
                [PredictedAnomalyScoredAt]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @EntryNumber,
                @CompanyID,
                @EffectiveDate,
                @EntryTypeID,
                ISNULL(@Status, 'Pending'),
                CASE WHEN @Description_Clear = 1 THEN NULL ELSE ISNULL(@Description, NULL) END,
                CASE WHEN @LinkedEntityID_Clear = 1 THEN NULL ELSE ISNULL(@LinkedEntityID, NULL) END,
                CASE WHEN @LinkedRecordID_Clear = 1 THEN NULL ELSE ISNULL(@LinkedRecordID, NULL) END,
                CASE WHEN @ReversesJournalEntryID_Clear = 1 THEN NULL ELSE ISNULL(@ReversesJournalEntryID, NULL) END,
                CASE WHEN @ReversedByJournalEntryID_Clear = 1 THEN NULL ELSE ISNULL(@ReversedByJournalEntryID, NULL) END,
                CASE WHEN @JournalEntryBatchID_Clear = 1 THEN NULL ELSE ISNULL(@JournalEntryBatchID, NULL) END,
                CASE WHEN @GLPostedAt_Clear = 1 THEN NULL ELSE ISNULL(@GLPostedAt, NULL) END,
                CASE WHEN @GLReferenceID_Clear = 1 THEN NULL ELSE ISNULL(@GLReferenceID, NULL) END,
                CASE WHEN @FileID_Clear = 1 THEN NULL ELSE ISNULL(@FileID, NULL) END,
                CASE WHEN @PredictedAnomalyProbability_Clear = 1 THEN NULL ELSE ISNULL(@PredictedAnomalyProbability, NULL) END,
                CASE WHEN @PredictedAnomalyRiskBand_Clear = 1 THEN NULL ELSE ISNULL(@PredictedAnomalyRiskBand, NULL) END,
                CASE WHEN @PredictedAnomalyScoredAt_Clear = 1 THEN NULL ELSE ISNULL(@PredictedAnomalyScoredAt, NULL) END
            )
    END
    -- return the new record from the base view, which might have some calculated fields
    SELECT * FROM [${flyway:defaultSchema}].[vwJournalEntries] WHERE [ID] = (SELECT [ID] FROM @InsertedRow)
END
GO
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateJournalEntry] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateJournalEntry] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateJournalEntry] TO [cdp_Developer], [cdp_Integration];

/* spCreate Permissions for MJ_BizApps_Accounting: Journal Entries */

REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateJournalEntry] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateJournalEntry] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateJournalEntry] TO [cdp_Developer], [cdp_Integration];

/* spUpdate SQL for MJ_BizApps_Accounting: Journal Entries */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Journal Entries
-- Item: spUpdateJournalEntry
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- UPDATE PROCEDURE FOR JournalEntry
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spUpdateJournalEntry]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spUpdateJournalEntry];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spUpdateJournalEntry]
    @ID uniqueidentifier,
    @EntryNumber nvarchar(40) = NULL,
    @CompanyID uniqueidentifier = NULL,
    @EffectiveDate date = NULL,
    @EntryTypeID uniqueidentifier = NULL,
    @Status nvarchar(20) = NULL,
    @Description_Clear bit = 0,
    @Description nvarchar(MAX) = NULL,
    @LinkedEntityID_Clear bit = 0,
    @LinkedEntityID uniqueidentifier = NULL,
    @LinkedRecordID_Clear bit = 0,
    @LinkedRecordID nvarchar(400) = NULL,
    @ReversesJournalEntryID_Clear bit = 0,
    @ReversesJournalEntryID uniqueidentifier = NULL,
    @ReversedByJournalEntryID_Clear bit = 0,
    @ReversedByJournalEntryID uniqueidentifier = NULL,
    @JournalEntryBatchID_Clear bit = 0,
    @JournalEntryBatchID uniqueidentifier = NULL,
    @GLPostedAt_Clear bit = 0,
    @GLPostedAt datetimeoffset = NULL,
    @GLReferenceID_Clear bit = 0,
    @GLReferenceID nvarchar(100) = NULL,
    @FileID_Clear bit = 0,
    @FileID uniqueidentifier = NULL,
    @PredictedAnomalyProbability_Clear bit = 0,
    @PredictedAnomalyProbability decimal(5, 4) = NULL,
    @PredictedAnomalyRiskBand_Clear bit = 0,
    @PredictedAnomalyRiskBand nvarchar(20) = NULL,
    @PredictedAnomalyScoredAt_Clear bit = 0,
    @PredictedAnomalyScoredAt datetimeoffset = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[JournalEntry]
    SET
        [EntryNumber] = ISNULL(@EntryNumber, [EntryNumber]),
        [CompanyID] = ISNULL(@CompanyID, [CompanyID]),
        [EffectiveDate] = ISNULL(@EffectiveDate, [EffectiveDate]),
        [EntryTypeID] = ISNULL(@EntryTypeID, [EntryTypeID]),
        [Status] = ISNULL(@Status, [Status]),
        [Description] = CASE WHEN @Description_Clear = 1 THEN NULL ELSE ISNULL(@Description, [Description]) END,
        [LinkedEntityID] = CASE WHEN @LinkedEntityID_Clear = 1 THEN NULL ELSE ISNULL(@LinkedEntityID, [LinkedEntityID]) END,
        [LinkedRecordID] = CASE WHEN @LinkedRecordID_Clear = 1 THEN NULL ELSE ISNULL(@LinkedRecordID, [LinkedRecordID]) END,
        [ReversesJournalEntryID] = CASE WHEN @ReversesJournalEntryID_Clear = 1 THEN NULL ELSE ISNULL(@ReversesJournalEntryID, [ReversesJournalEntryID]) END,
        [ReversedByJournalEntryID] = CASE WHEN @ReversedByJournalEntryID_Clear = 1 THEN NULL ELSE ISNULL(@ReversedByJournalEntryID, [ReversedByJournalEntryID]) END,
        [JournalEntryBatchID] = CASE WHEN @JournalEntryBatchID_Clear = 1 THEN NULL ELSE ISNULL(@JournalEntryBatchID, [JournalEntryBatchID]) END,
        [GLPostedAt] = CASE WHEN @GLPostedAt_Clear = 1 THEN NULL ELSE ISNULL(@GLPostedAt, [GLPostedAt]) END,
        [GLReferenceID] = CASE WHEN @GLReferenceID_Clear = 1 THEN NULL ELSE ISNULL(@GLReferenceID, [GLReferenceID]) END,
        [FileID] = CASE WHEN @FileID_Clear = 1 THEN NULL ELSE ISNULL(@FileID, [FileID]) END,
        [PredictedAnomalyProbability] = CASE WHEN @PredictedAnomalyProbability_Clear = 1 THEN NULL ELSE ISNULL(@PredictedAnomalyProbability, [PredictedAnomalyProbability]) END,
        [PredictedAnomalyRiskBand] = CASE WHEN @PredictedAnomalyRiskBand_Clear = 1 THEN NULL ELSE ISNULL(@PredictedAnomalyRiskBand, [PredictedAnomalyRiskBand]) END,
        [PredictedAnomalyScoredAt] = CASE WHEN @PredictedAnomalyScoredAt_Clear = 1 THEN NULL ELSE ISNULL(@PredictedAnomalyScoredAt, [PredictedAnomalyScoredAt]) END
    WHERE
        [ID] = @ID

    -- Check if the update was successful
    IF @@ROWCOUNT = 0
        -- Nothing was updated, return no rows, but column structure from base view intact, semantically correct this way.
        SELECT TOP 0 * FROM [${flyway:defaultSchema}].[vwJournalEntries] WHERE 1=0
    ELSE
        -- Return the updated record so the caller can see the updated values and any calculated fields
        SELECT
                                        *
                                    FROM
                                        [${flyway:defaultSchema}].[vwJournalEntries]
                                    WHERE
                                        [ID] = @ID
                                    
END
GO

REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateJournalEntry] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateJournalEntry] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateJournalEntry] TO [cdp_Developer], [cdp_Integration]
GO

------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the JournalEntry table
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[trgUpdateJournalEntry]', 'TR') IS NOT NULL
    DROP TRIGGER [${flyway:defaultSchema}].[trgUpdateJournalEntry];
GO
CREATE TRIGGER [${flyway:defaultSchema}].trgUpdateJournalEntry
ON [${flyway:defaultSchema}].[JournalEntry]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[JournalEntry]
    SET
        __mj_UpdatedAt = GETUTCDATE()
    FROM
        [${flyway:defaultSchema}].[JournalEntry] AS _organicTable
    INNER JOIN
        INSERTED AS I ON
        _organicTable.[ID] = I.[ID];
END;
GO

/* spUpdate Permissions for MJ_BizApps_Accounting: Journal Entries */

REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateJournalEntry] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateJournalEntry] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateJournalEntry] TO [cdp_Developer], [cdp_Integration];

/* spDelete SQL for MJ_BizApps_Accounting: Journal Entries */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Journal Entries
-- Item: spDeleteJournalEntry
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- DELETE PROCEDURE FOR JournalEntry
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spDeleteJournalEntry]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spDeleteJournalEntry];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spDeleteJournalEntry]
    @ID uniqueidentifier
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM
        [${flyway:defaultSchema}].[JournalEntry]
    WHERE
        [ID] = @ID


    -- Check if the delete was successful
    IF @@ROWCOUNT = 0
        SELECT NULL AS [ID] -- Return NULL for all primary key fields to indicate no record was deleted
    ELSE
        SELECT @ID AS [ID] -- Return the primary key values to indicate we successfully deleted the record
END
GO
/* spDelete Permissions for MJ_BizApps_Accounting: Journal Entries */
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spDeleteJournalEntry] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spDeleteJournalEntry] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteJournalEntry] TO [cdp_Developer], [cdp_Integration];

/* SQL text to update existing entity fields from schema (1 scoped entities) */
DECLARE @JournalEntryEntityID_Settings UNIQUEIDENTIFIER =
    (SELECT [ID] FROM [${mjSchema}].[Entity] WHERE [Name] = 'MJ_BizApps_Accounting: Journal Entries');
IF @JournalEntryEntityID_Settings IS NULL RAISERROR('Journal Entries entity not registered', 16, 1);

EXEC [${mjSchema}].[spUpdateExistingEntityFieldsFromSchema] @ExcludedSchemaNames='', @EntityIDs=@JournalEntryEntityID_Settings, @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to set default column width where needed */
EXEC [${mjSchema}].[spSetDefaultColumnWidthWhereNeeded] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';

/* Set categories for 3 fields */

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Journal Entries.PredictedAnomalyProbability 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Anomaly Detection',
   GeneratedFormSection = 'Category',
   DisplayName = 'Anomaly Probability'
WHERE 
   ID = '65A6D82B-E0F2-441C-B528-D02FD788CBA5';

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Journal Entries.PredictedAnomalyRiskBand 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Anomaly Detection',
   GeneratedFormSection = 'Category',
   DisplayName = 'Anomaly Risk Band'
WHERE 
   ID = '13845D9D-67E5-427C-956F-EC0FB19B5859';

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Journal Entries.PredictedAnomalyScoredAt 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Anomaly Detection',
   GeneratedFormSection = 'Category',
   DisplayName = 'Anomaly Scored At'
WHERE 
   ID = '85FB2F62-1428-43DF-8053-90E3014500A0';

/* Update FieldCategoryInfo setting for entity */

                  UPDATE [${mjSchema}].[EntitySetting]
                  SET [Value] = '{
  "Anomaly Detection": {
    "description": "Predictive analytics and risk assessment data for journal entry validation",
    "icon": "fa fa-exclamation-triangle"
  }
}', [__mj_UpdatedAt] = GETUTCDATE()
                  WHERE [EntityID] = @JournalEntryEntityID_Settings AND [Name] = 'FieldCategoryInfo';

/* Update FieldCategoryIcons setting (legacy) */

                  UPDATE [${mjSchema}].[EntitySetting]
                  SET [Value] = '{
  "Anomaly Detection": "fa fa-exclamation-triangle"
}', [__mj_UpdatedAt] = GETUTCDATE()
                  WHERE [EntityID] = @JournalEntryEntityID_Settings AND [Name] = 'FieldCategoryIcons';


/* Refresh custom base views for modified entities so schema changes are picked up */
EXEC sp_refreshview '${flyway:defaultSchema}.vwJournalEntries';
GO
