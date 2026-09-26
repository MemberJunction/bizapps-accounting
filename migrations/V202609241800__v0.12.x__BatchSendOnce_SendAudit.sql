-- =============================================================================
-- Migration: V202609241800__v0.12.x__BatchSendOnce_SendAudit.sql
-- Description: #184 — a batch that is already Sent cannot be sent again, and
--              every send records who made it and which attempt it was.
-- =============================================================================
--
-- WHY
--
-- sendJournalEntryBatch reads the batch's Status, checks it is sendable, then
-- saves Status='Sent'. The generated spUpdate is a blind UPDATE ... WHERE ID=@ID,
-- so nothing ties that write to the status the send read. Two retries of one
-- Failed batch, started within the same second, both read Failed, both write
-- Sent (Sent -> Sent is a legal no-op edge), and both call the ERP: two journals.
--
-- The entity layer cannot catch this. The second writer's Status OldValue is
-- the Failed it loaded, so its Failed -> Sent looks legal to Validate(). The row
-- lock on the UPDATE is the only place the two sends meet, so the refusal lives
-- in a trigger: the second UPDATE runs after the first commits, sees the row
-- already Sent in `deleted`, and a new send stamp on a Sent row is exactly a
-- second send. The losing save fails, and sendJournalEntryBatch throws at its
-- "->Sent failed" check before it calls the ERP.
--
-- The stamp is SentAt plus SendAttemptCount. JournalEntryBatchEntityServer.Save
-- sets both, with SentByUserID, on every transition into Sent. A legitimate write
-- to a Sent batch leaves Sent (Posted or Failed) or changes neither.
--
-- A SEPARATE TRIGGER, not a branch of trg_JournalEntryBatch_Immutability: that
-- trigger is replaced wholesale (CREATE OR ALTER) by each migration that widens
-- its status lists. Keeping this rule in its own object means neither change can
-- silently drop the other.
--
-- SentByUserID and SendAttemptCount are the audit trail on the row itself. The
-- full history of each attempt (the ErrorMessage a later success clears, every
-- overwritten SentAt) is in __mj.RecordChange: the entity tracks record changes.
--
-- DETERMINISTIC, NOT IDEMPOTENT (release-process.md §CodeGen): this runs once,
-- in order, against a database that has the baseline.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Who sent it, and how many times
-- -----------------------------------------------------------------------------
ALTER TABLE __mj_BizAppsAccounting.JournalEntryBatch ADD
    SentByUserID      UNIQUEIDENTIFIER NULL,
    SendAttemptCount  INT              NOT NULL CONSTRAINT DF_JournalEntryBatch_SendAttemptCount DEFAULT 0,
    CONSTRAINT FK_JournalEntryBatch_SentBy FOREIGN KEY (SentByUserID) REFERENCES __mj.[User](ID),
    CONSTRAINT CK_JournalEntryBatch_SendAttemptCount CHECK (SendAttemptCount >= 0);
GO

-- -----------------------------------------------------------------------------
-- 2. A batch that has been sent was sent at least once
-- -----------------------------------------------------------------------------
-- The true count for an existing batch is not recoverable from the row: a retry
-- overwrote SentAt. 1 is the floor, and it keeps a Posted batch from reading as
-- never sent. SentByUserID stays NULL — unknown, not asserted.
-- -----------------------------------------------------------------------------
UPDATE __mj_BizAppsAccounting.JournalEntryBatch
SET SendAttemptCount = 1
WHERE SentAt IS NOT NULL;
GO

-- -----------------------------------------------------------------------------
-- 3. A Sent batch cannot be sent again
-- -----------------------------------------------------------------------------
-- THROW with no ROLLBACK TRANSACTION first. The entity's save runs spUpdate
-- inside INSERT-EXEC, where a ROLLBACK is itself an error: the caller would get
-- "Cannot use the ROLLBACK statement within an INSERT-EXEC statement" in place
-- of the message below. A trigger runs with XACT_ABORT on, so THROW alone rolls
-- the update back.
-- -----------------------------------------------------------------------------
CREATE TRIGGER __mj_BizAppsAccounting.trg_JournalEntryBatch_SendOnce
ON __mj_BizAppsAccounting.JournalEntryBatch
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (
        SELECT 1
        FROM deleted d
        JOIN inserted i ON i.ID = d.ID
        WHERE d.Status = 'Sent'
          AND i.Status = 'Sent'
          AND (
            i.SendAttemptCount <> d.SendAttemptCount OR
            ISNULL(i.SentAt, '0001-01-01') <> ISNULL(d.SentAt, '0001-01-01')
          )
    )
    BEGIN
        THROW 50030, 'JournalEntryBatch is already Sent: another dispatch of this batch is in progress. Its outcome will be Posted or Failed; do not send it again.', 1;
    END;
END;
GO

-- -----------------------------------------------------------------------------
-- 4. Column descriptions — CodeGen carries these into EntityField.Description
-- -----------------------------------------------------------------------------
EXEC sp_updateextendedproperty @name = N'MS_Description',
    @value = N'When the batch was last sent to the ERP. A retry overwrites it; SendAttemptCount counts the sends, and __mj.RecordChange keeps each earlier value.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryBatch', @level2type = N'COLUMN', @level2name = N'SentAt';
GO

EXEC sp_addextendedproperty @name = N'MS_Description',
    @value = N'User who made the latest send to the ERP. Stamped on every transition into Sent. NULL for batches sent before this column existed.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryBatch', @level2type = N'COLUMN', @level2name = N'SentByUserID';
GO

EXEC sp_addextendedproperty @name = N'MS_Description',
    @value = N'How many times the batch has been sent to the ERP: 1 for a first dispatch, one more for each retry. Above 1 on a Posted batch means an earlier send failed. Batches sent before this column existed read 1.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryBatch', @level2type = N'COLUMN', @level2name = N'SendAttemptCount';
GO












































































-- =============================================================================
-- CODEGEN OUTPUT — GENERATED CODE BELOW THIS LINE. DO NOT EDIT BY HAND.
-- =============================================================================


/* SQL text to update existing entities from schema */
EXEC [${mjSchema}].[spUpdateExistingEntitiesFromSchema] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to insert 2 new entity field(s) */

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'bc3f1c31-ca94-4b2c-bc79-ecbf76920aba' OR (EntityID = '87AD37E9-62F9-4F0E-A15B-F64ADF009112' AND Name = 'SentByUserID')) BEGIN
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
            'bc3f1c31-ca94-4b2c-bc79-ecbf76920aba',
            '87AD37E9-62F9-4F0E-A15B-F64ADF009112', -- Entity: MJ_BizApps_Accounting: Journal Entry Batches
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '87AD37E9-62F9-4F0E-A15B-F64ADF009112'),
            'SentByUserID',
            'Sent By User ID',
            'User who made the latest send to the ERP. Stamped on every transition into Sent. NULL for batches sent before this column existed.',
            'uniqueidentifier',
            16,
            0,
            0,
            1,
            NULL,
            0,
            1,
            0,
            0,
            'E1238F34-2837-EF11-86D4-6045BDEE16E6',
            'ID',
            0,
            0,
            1,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'c208ee98-fbaf-41fd-b16f-24c80c3d9de0' OR (EntityID = '87AD37E9-62F9-4F0E-A15B-F64ADF009112' AND Name = 'SendAttemptCount')) BEGIN
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
            'c208ee98-fbaf-41fd-b16f-24c80c3d9de0',
            '87AD37E9-62F9-4F0E-A15B-F64ADF009112', -- Entity: MJ_BizApps_Accounting: Journal Entry Batches
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '87AD37E9-62F9-4F0E-A15B-F64ADF009112'),
            'SendAttemptCount',
            'Send Attempt Count',
            'How many times the batch has been sent to the ERP: 1 for a first dispatch, one more for each retry. Above 1 on a Posted batch means an earlier send failed. Batches sent before this column existed read 1.',
            'int',
            4,
            10,
            0,
            0,
            '(0)',
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

/* SQL text to update existing entity fields from schema */
EXEC [${mjSchema}].[spUpdateExistingEntityFieldsFromSchema] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to set default column width where needed */
EXEC [${mjSchema}].[spSetDefaultColumnWidthWhereNeeded] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';


/* Create Entity Relationship: MJ: Users -> MJ_BizApps_Accounting: Journal Entry Batches (One To Many via SentByUserID) */
   IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntityRelationship] WHERE [ID] = '93beef01-c86f-483c-8657-0d3de438a756'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
                    VALUES ('93beef01-c86f-483c-8657-0d3de438a756', 'E1238F34-2837-EF11-86D4-6045BDEE16E6', '87AD37E9-62F9-4F0E-A15B-F64ADF009112', 'SentByUserID', 'One To Many', 1, 1, 114, GETUTCDATE(), GETUTCDATE())
   END;

/* SQL text to sync schema info from database schemas */
EXEC [${mjSchema}].[spUpdateSchemaInfoFromDatabase] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';

/* Index for Foreign Keys for JournalEntryBatch */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Journal Entry Batches
-- Item: Index for Foreign Keys
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------
-- Index for foreign key CompanyID in table JournalEntryBatch
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_JournalEntryBatch_CompanyID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[JournalEntryBatch]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_JournalEntryBatch_CompanyID ON [${flyway:defaultSchema}].[JournalEntryBatch] ([CompanyID]);

-- Index for foreign key SummaryJournalEntryID in table JournalEntryBatch
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_JournalEntryBatch_SummaryJournalEntryID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[JournalEntryBatch]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_JournalEntryBatch_SummaryJournalEntryID ON [${flyway:defaultSchema}].[JournalEntryBatch] ([SummaryJournalEntryID]);

-- Index for foreign key BatchedByUserID in table JournalEntryBatch
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_JournalEntryBatch_BatchedByUserID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[JournalEntryBatch]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_JournalEntryBatch_BatchedByUserID ON [${flyway:defaultSchema}].[JournalEntryBatch] ([BatchedByUserID]);

-- Index for foreign key ApprovedByUserID in table JournalEntryBatch
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_JournalEntryBatch_ApprovedByUserID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[JournalEntryBatch]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_JournalEntryBatch_ApprovedByUserID ON [${flyway:defaultSchema}].[JournalEntryBatch] ([ApprovedByUserID]);

-- Index for foreign key ApprovalTaskID in table JournalEntryBatch
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_JournalEntryBatch_ApprovalTaskID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[JournalEntryBatch]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_JournalEntryBatch_ApprovalTaskID ON [${flyway:defaultSchema}].[JournalEntryBatch] ([ApprovalTaskID]);

-- Index for foreign key ArchivedByUserID in table JournalEntryBatch
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_JournalEntryBatch_ArchivedByUserID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[JournalEntryBatch]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_JournalEntryBatch_ArchivedByUserID ON [${flyway:defaultSchema}].[JournalEntryBatch] ([ArchivedByUserID]);

-- Index for foreign key SentByUserID in table JournalEntryBatch
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_JournalEntryBatch_SentByUserID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[JournalEntryBatch]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_JournalEntryBatch_SentByUserID ON [${flyway:defaultSchema}].[JournalEntryBatch] ([SentByUserID]);

/* SQL text to update entity field related entity name field map for entity field ID BC3F1C31-CA94-4B2C-BC79-ECBF76920ABA */
EXEC [${mjSchema}].[spUpdateEntityFieldRelatedEntityNameFieldMap] @EntityFieldID='BC3F1C31-CA94-4B2C-BC79-ECBF76920ABA', @RelatedEntityNameFieldMap='SentByUser';

/* Base View SQL for MJ_BizApps_Accounting: Journal Entries */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Journal Entries
-- Item: vwJournalEntriesGenerated
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- BASE VIEW FOR ENTITY:      MJ_BizApps_Accounting: Journal Entries
-----               SCHEMA:      ${flyway:defaultSchema}
-----               BASE TABLE:  JournalEntry
-----               PRIMARY KEY: ID
------------------------------------------------------------
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
    [j].[FileID] = MJFile_FileID.[ID]
GO
IF OBJECT_ID('[${flyway:defaultSchema}].[vwJournalEntries]', 'V') IS NOT NULL
BEGIN
    EXEC sp_executesql N'REVOKE SELECT ON [${flyway:defaultSchema}].[vwJournalEntries] FROM [cdp_Developer]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwJournalEntries] FROM [cdp_Integration]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwJournalEntries] FROM [cdp_UI]
GRANT SELECT ON [${flyway:defaultSchema}].[vwJournalEntries] TO [cdp_UI], [cdp_Developer], [cdp_Integration]';
END;

/* Base View Permissions SQL for MJ_BizApps_Accounting: Journal Entries */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Journal Entries
-- Item: Permissions for vwJournalEntries
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

IF OBJECT_ID('[${flyway:defaultSchema}].[vwJournalEntries]', 'V') IS NOT NULL
BEGIN
    EXEC sp_executesql N'REVOKE SELECT ON [${flyway:defaultSchema}].[vwJournalEntries] FROM [cdp_Developer]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwJournalEntries] FROM [cdp_Integration]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwJournalEntries] FROM [cdp_UI]
GRANT SELECT ON [${flyway:defaultSchema}].[vwJournalEntries] TO [cdp_UI], [cdp_Developer], [cdp_Integration]';
END;

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
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spDeleteJournalEntry] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spDeleteJournalEntry] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteJournalEntry] TO [cdp_Developer], [cdp_Integration];

/* spDelete Permissions for MJ_BizApps_Accounting: Journal Entries */

REVOKE EXECUTE ON [${flyway:defaultSchema}].[spDeleteJournalEntry] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spDeleteJournalEntry] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteJournalEntry] TO [cdp_Developer], [cdp_Integration];

/* Base View SQL for MJ_BizApps_Accounting: Journal Entry Batches */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Journal Entry Batches
-- Item: vwJournalEntryBatches
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- BASE VIEW FOR ENTITY:      MJ_BizApps_Accounting: Journal Entry Batches
-----               SCHEMA:      ${flyway:defaultSchema}
-----               BASE TABLE:  JournalEntryBatch
-----               PRIMARY KEY: ID
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[vwJournalEntryBatches]', 'V') IS NOT NULL
    DROP VIEW [${flyway:defaultSchema}].[vwJournalEntryBatches];
GO

CREATE VIEW [${flyway:defaultSchema}].[vwJournalEntryBatches]
AS
SELECT
    j.*,
    MJCompany_CompanyID.[Name] AS [Company],
    mjBizAppsAccountingJournalEntry_SummaryJournalEntryID.[EntryNumber] AS [SummaryJournalEntry],
    MJUser_BatchedByUserID.[Name] AS [BatchedByUser],
    MJUser_ApprovedByUserID.[Name] AS [ApprovedByUser],
    mjBizAppsTasksTask_ApprovalTaskID.[Name] AS [ApprovalTask],
    MJUser_ArchivedByUserID.[Name] AS [ArchivedByUser],
    MJUser_SentByUserID.[Name] AS [SentByUser]
FROM
    [${flyway:defaultSchema}].[JournalEntryBatch] AS j
INNER JOIN
    [${mjSchema}].[Company] AS MJCompany_CompanyID
  ON
    [j].[CompanyID] = MJCompany_CompanyID.[ID]
LEFT OUTER JOIN
    [${flyway:defaultSchema}].[JournalEntry] AS mjBizAppsAccountingJournalEntry_SummaryJournalEntryID
  ON
    [j].[SummaryJournalEntryID] = mjBizAppsAccountingJournalEntry_SummaryJournalEntryID.[ID]
INNER JOIN
    [${mjSchema}].[User] AS MJUser_BatchedByUserID
  ON
    [j].[BatchedByUserID] = MJUser_BatchedByUserID.[ID]
LEFT OUTER JOIN
    [${mjSchema}].[User] AS MJUser_ApprovedByUserID
  ON
    [j].[ApprovedByUserID] = MJUser_ApprovedByUserID.[ID]
LEFT OUTER JOIN
    [${mjSchema}_BizAppsTasks].[Task] AS mjBizAppsTasksTask_ApprovalTaskID
  ON
    [j].[ApprovalTaskID] = mjBizAppsTasksTask_ApprovalTaskID.[ID]
LEFT OUTER JOIN
    [${mjSchema}].[User] AS MJUser_ArchivedByUserID
  ON
    [j].[ArchivedByUserID] = MJUser_ArchivedByUserID.[ID]
LEFT OUTER JOIN
    [${mjSchema}].[User] AS MJUser_SentByUserID
  ON
    [j].[SentByUserID] = MJUser_SentByUserID.[ID]
GO
REVOKE SELECT ON [${flyway:defaultSchema}].[vwJournalEntryBatches] FROM [cdp_Developer]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwJournalEntryBatches] FROM [cdp_Integration]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwJournalEntryBatches] FROM [cdp_UI]
GRANT SELECT ON [${flyway:defaultSchema}].[vwJournalEntryBatches] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* Base View Permissions SQL for MJ_BizApps_Accounting: Journal Entry Batches */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Journal Entry Batches
-- Item: Permissions for vwJournalEntryBatches
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

REVOKE SELECT ON [${flyway:defaultSchema}].[vwJournalEntryBatches] FROM [cdp_Developer]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwJournalEntryBatches] FROM [cdp_Integration]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwJournalEntryBatches] FROM [cdp_UI]
GRANT SELECT ON [${flyway:defaultSchema}].[vwJournalEntryBatches] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* spCreate SQL for MJ_BizApps_Accounting: Journal Entry Batches */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Journal Entry Batches
-- Item: spCreateJournalEntryBatch
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- CREATE PROCEDURE FOR JournalEntryBatch
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spCreateJournalEntryBatch]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spCreateJournalEntryBatch];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spCreateJournalEntryBatch]
    @ID uniqueidentifier = NULL,
    @JournalEntryBatchNumber nvarchar(40),
    @CompanyID uniqueidentifier,
    @PostingDate date,
    @SummaryJournalEntryID_Clear bit = 0,
    @SummaryJournalEntryID uniqueidentifier = NULL,
    @TargetSystem nvarchar(50),
    @BatchedAt datetimeoffset = NULL,
    @BatchedByUserID uniqueidentifier,
    @Status nvarchar(20) = NULL,
    @TotalEntries int = NULL,
    @TotalDebits decimal(18, 2) = NULL,
    @TotalCredits decimal(18, 2) = NULL,
    @ExternalJournalEntryBatchRef_Clear bit = 0,
    @ExternalJournalEntryBatchRef nvarchar(100) = NULL,
    @ApprovedAt_Clear bit = 0,
    @ApprovedAt datetimeoffset = NULL,
    @ApprovedByUserID_Clear bit = 0,
    @ApprovedByUserID uniqueidentifier = NULL,
    @SentAt_Clear bit = 0,
    @SentAt datetimeoffset = NULL,
    @PostedAt_Clear bit = 0,
    @PostedAt datetimeoffset = NULL,
    @ErrorMessage_Clear bit = 0,
    @ErrorMessage nvarchar(MAX) = NULL,
    @ApprovalTaskID_Clear bit = 0,
    @ApprovalTaskID uniqueidentifier = NULL,
    @ApprovalTaskRaisedAt_Clear bit = 0,
    @ApprovalTaskRaisedAt datetimeoffset = NULL,
    @ArchiveReason_Clear bit = 0,
    @ArchiveReason nvarchar(500) = NULL,
    @ArchivedAt_Clear bit = 0,
    @ArchivedAt datetimeoffset = NULL,
    @ArchivedByUserID_Clear bit = 0,
    @ArchivedByUserID uniqueidentifier = NULL,
    @SentByUserID_Clear bit = 0,
    @SentByUserID uniqueidentifier = NULL,
    @SendAttemptCount int = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @InsertedRow TABLE ([ID] UNIQUEIDENTIFIER)

    IF @ID IS NOT NULL
    BEGIN
        -- User provided a value, use it
        INSERT INTO [${flyway:defaultSchema}].[JournalEntryBatch]
            (
                [ID],
                [JournalEntryBatchNumber],
                [CompanyID],
                [PostingDate],
                [SummaryJournalEntryID],
                [TargetSystem],
                [BatchedAt],
                [BatchedByUserID],
                [Status],
                [TotalEntries],
                [TotalDebits],
                [TotalCredits],
                [ExternalJournalEntryBatchRef],
                [ApprovedAt],
                [ApprovedByUserID],
                [SentAt],
                [PostedAt],
                [ErrorMessage],
                [ApprovalTaskID],
                [ApprovalTaskRaisedAt],
                [ArchiveReason],
                [ArchivedAt],
                [ArchivedByUserID],
                [SentByUserID],
                [SendAttemptCount]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @ID,
                @JournalEntryBatchNumber,
                @CompanyID,
                @PostingDate,
                CASE WHEN @SummaryJournalEntryID_Clear = 1 THEN NULL ELSE ISNULL(@SummaryJournalEntryID, NULL) END,
                @TargetSystem,
                ISNULL(@BatchedAt, sysdatetimeoffset()),
                @BatchedByUserID,
                ISNULL(@Status, 'Pending'),
                ISNULL(@TotalEntries, 0),
                ISNULL(@TotalDebits, 0),
                ISNULL(@TotalCredits, 0),
                CASE WHEN @ExternalJournalEntryBatchRef_Clear = 1 THEN NULL ELSE ISNULL(@ExternalJournalEntryBatchRef, NULL) END,
                CASE WHEN @ApprovedAt_Clear = 1 THEN NULL ELSE ISNULL(@ApprovedAt, NULL) END,
                CASE WHEN @ApprovedByUserID_Clear = 1 THEN NULL ELSE ISNULL(@ApprovedByUserID, NULL) END,
                CASE WHEN @SentAt_Clear = 1 THEN NULL ELSE ISNULL(@SentAt, NULL) END,
                CASE WHEN @PostedAt_Clear = 1 THEN NULL ELSE ISNULL(@PostedAt, NULL) END,
                CASE WHEN @ErrorMessage_Clear = 1 THEN NULL ELSE ISNULL(@ErrorMessage, NULL) END,
                CASE WHEN @ApprovalTaskID_Clear = 1 THEN NULL ELSE ISNULL(@ApprovalTaskID, NULL) END,
                CASE WHEN @ApprovalTaskRaisedAt_Clear = 1 THEN NULL ELSE ISNULL(@ApprovalTaskRaisedAt, NULL) END,
                CASE WHEN @ArchiveReason_Clear = 1 THEN NULL ELSE ISNULL(@ArchiveReason, NULL) END,
                CASE WHEN @ArchivedAt_Clear = 1 THEN NULL ELSE ISNULL(@ArchivedAt, NULL) END,
                CASE WHEN @ArchivedByUserID_Clear = 1 THEN NULL ELSE ISNULL(@ArchivedByUserID, NULL) END,
                CASE WHEN @SentByUserID_Clear = 1 THEN NULL ELSE ISNULL(@SentByUserID, NULL) END,
                ISNULL(@SendAttemptCount, 0)
            )
    END
    ELSE
    BEGIN
        -- No value provided, let database use its default (e.g., NEWSEQUENTIALID())
        INSERT INTO [${flyway:defaultSchema}].[JournalEntryBatch]
            (
                [JournalEntryBatchNumber],
                [CompanyID],
                [PostingDate],
                [SummaryJournalEntryID],
                [TargetSystem],
                [BatchedAt],
                [BatchedByUserID],
                [Status],
                [TotalEntries],
                [TotalDebits],
                [TotalCredits],
                [ExternalJournalEntryBatchRef],
                [ApprovedAt],
                [ApprovedByUserID],
                [SentAt],
                [PostedAt],
                [ErrorMessage],
                [ApprovalTaskID],
                [ApprovalTaskRaisedAt],
                [ArchiveReason],
                [ArchivedAt],
                [ArchivedByUserID],
                [SentByUserID],
                [SendAttemptCount]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @JournalEntryBatchNumber,
                @CompanyID,
                @PostingDate,
                CASE WHEN @SummaryJournalEntryID_Clear = 1 THEN NULL ELSE ISNULL(@SummaryJournalEntryID, NULL) END,
                @TargetSystem,
                ISNULL(@BatchedAt, sysdatetimeoffset()),
                @BatchedByUserID,
                ISNULL(@Status, 'Pending'),
                ISNULL(@TotalEntries, 0),
                ISNULL(@TotalDebits, 0),
                ISNULL(@TotalCredits, 0),
                CASE WHEN @ExternalJournalEntryBatchRef_Clear = 1 THEN NULL ELSE ISNULL(@ExternalJournalEntryBatchRef, NULL) END,
                CASE WHEN @ApprovedAt_Clear = 1 THEN NULL ELSE ISNULL(@ApprovedAt, NULL) END,
                CASE WHEN @ApprovedByUserID_Clear = 1 THEN NULL ELSE ISNULL(@ApprovedByUserID, NULL) END,
                CASE WHEN @SentAt_Clear = 1 THEN NULL ELSE ISNULL(@SentAt, NULL) END,
                CASE WHEN @PostedAt_Clear = 1 THEN NULL ELSE ISNULL(@PostedAt, NULL) END,
                CASE WHEN @ErrorMessage_Clear = 1 THEN NULL ELSE ISNULL(@ErrorMessage, NULL) END,
                CASE WHEN @ApprovalTaskID_Clear = 1 THEN NULL ELSE ISNULL(@ApprovalTaskID, NULL) END,
                CASE WHEN @ApprovalTaskRaisedAt_Clear = 1 THEN NULL ELSE ISNULL(@ApprovalTaskRaisedAt, NULL) END,
                CASE WHEN @ArchiveReason_Clear = 1 THEN NULL ELSE ISNULL(@ArchiveReason, NULL) END,
                CASE WHEN @ArchivedAt_Clear = 1 THEN NULL ELSE ISNULL(@ArchivedAt, NULL) END,
                CASE WHEN @ArchivedByUserID_Clear = 1 THEN NULL ELSE ISNULL(@ArchivedByUserID, NULL) END,
                CASE WHEN @SentByUserID_Clear = 1 THEN NULL ELSE ISNULL(@SentByUserID, NULL) END,
                ISNULL(@SendAttemptCount, 0)
            )
    END
    -- return the new record from the base view, which might have some calculated fields
    SELECT * FROM [${flyway:defaultSchema}].[vwJournalEntryBatches] WHERE [ID] = (SELECT [ID] FROM @InsertedRow)
END
GO
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateJournalEntryBatch] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateJournalEntryBatch] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateJournalEntryBatch] TO [cdp_Developer], [cdp_Integration];

/* spCreate Permissions for MJ_BizApps_Accounting: Journal Entry Batches */

REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateJournalEntryBatch] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateJournalEntryBatch] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateJournalEntryBatch] TO [cdp_Developer], [cdp_Integration];

/* spUpdate SQL for MJ_BizApps_Accounting: Journal Entry Batches */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Journal Entry Batches
-- Item: spUpdateJournalEntryBatch
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- UPDATE PROCEDURE FOR JournalEntryBatch
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spUpdateJournalEntryBatch]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spUpdateJournalEntryBatch];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spUpdateJournalEntryBatch]
    @ID uniqueidentifier,
    @JournalEntryBatchNumber nvarchar(40) = NULL,
    @CompanyID uniqueidentifier = NULL,
    @PostingDate date = NULL,
    @SummaryJournalEntryID_Clear bit = 0,
    @SummaryJournalEntryID uniqueidentifier = NULL,
    @TargetSystem nvarchar(50) = NULL,
    @BatchedAt datetimeoffset = NULL,
    @BatchedByUserID uniqueidentifier = NULL,
    @Status nvarchar(20) = NULL,
    @TotalEntries int = NULL,
    @TotalDebits decimal(18, 2) = NULL,
    @TotalCredits decimal(18, 2) = NULL,
    @ExternalJournalEntryBatchRef_Clear bit = 0,
    @ExternalJournalEntryBatchRef nvarchar(100) = NULL,
    @ApprovedAt_Clear bit = 0,
    @ApprovedAt datetimeoffset = NULL,
    @ApprovedByUserID_Clear bit = 0,
    @ApprovedByUserID uniqueidentifier = NULL,
    @SentAt_Clear bit = 0,
    @SentAt datetimeoffset = NULL,
    @PostedAt_Clear bit = 0,
    @PostedAt datetimeoffset = NULL,
    @ErrorMessage_Clear bit = 0,
    @ErrorMessage nvarchar(MAX) = NULL,
    @ApprovalTaskID_Clear bit = 0,
    @ApprovalTaskID uniqueidentifier = NULL,
    @ApprovalTaskRaisedAt_Clear bit = 0,
    @ApprovalTaskRaisedAt datetimeoffset = NULL,
    @ArchiveReason_Clear bit = 0,
    @ArchiveReason nvarchar(500) = NULL,
    @ArchivedAt_Clear bit = 0,
    @ArchivedAt datetimeoffset = NULL,
    @ArchivedByUserID_Clear bit = 0,
    @ArchivedByUserID uniqueidentifier = NULL,
    @SentByUserID_Clear bit = 0,
    @SentByUserID uniqueidentifier = NULL,
    @SendAttemptCount int = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[JournalEntryBatch]
    SET
        [JournalEntryBatchNumber] = ISNULL(@JournalEntryBatchNumber, [JournalEntryBatchNumber]),
        [CompanyID] = ISNULL(@CompanyID, [CompanyID]),
        [PostingDate] = ISNULL(@PostingDate, [PostingDate]),
        [SummaryJournalEntryID] = CASE WHEN @SummaryJournalEntryID_Clear = 1 THEN NULL ELSE ISNULL(@SummaryJournalEntryID, [SummaryJournalEntryID]) END,
        [TargetSystem] = ISNULL(@TargetSystem, [TargetSystem]),
        [BatchedAt] = ISNULL(@BatchedAt, [BatchedAt]),
        [BatchedByUserID] = ISNULL(@BatchedByUserID, [BatchedByUserID]),
        [Status] = ISNULL(@Status, [Status]),
        [TotalEntries] = ISNULL(@TotalEntries, [TotalEntries]),
        [TotalDebits] = ISNULL(@TotalDebits, [TotalDebits]),
        [TotalCredits] = ISNULL(@TotalCredits, [TotalCredits]),
        [ExternalJournalEntryBatchRef] = CASE WHEN @ExternalJournalEntryBatchRef_Clear = 1 THEN NULL ELSE ISNULL(@ExternalJournalEntryBatchRef, [ExternalJournalEntryBatchRef]) END,
        [ApprovedAt] = CASE WHEN @ApprovedAt_Clear = 1 THEN NULL ELSE ISNULL(@ApprovedAt, [ApprovedAt]) END,
        [ApprovedByUserID] = CASE WHEN @ApprovedByUserID_Clear = 1 THEN NULL ELSE ISNULL(@ApprovedByUserID, [ApprovedByUserID]) END,
        [SentAt] = CASE WHEN @SentAt_Clear = 1 THEN NULL ELSE ISNULL(@SentAt, [SentAt]) END,
        [PostedAt] = CASE WHEN @PostedAt_Clear = 1 THEN NULL ELSE ISNULL(@PostedAt, [PostedAt]) END,
        [ErrorMessage] = CASE WHEN @ErrorMessage_Clear = 1 THEN NULL ELSE ISNULL(@ErrorMessage, [ErrorMessage]) END,
        [ApprovalTaskID] = CASE WHEN @ApprovalTaskID_Clear = 1 THEN NULL ELSE ISNULL(@ApprovalTaskID, [ApprovalTaskID]) END,
        [ApprovalTaskRaisedAt] = CASE WHEN @ApprovalTaskRaisedAt_Clear = 1 THEN NULL ELSE ISNULL(@ApprovalTaskRaisedAt, [ApprovalTaskRaisedAt]) END,
        [ArchiveReason] = CASE WHEN @ArchiveReason_Clear = 1 THEN NULL ELSE ISNULL(@ArchiveReason, [ArchiveReason]) END,
        [ArchivedAt] = CASE WHEN @ArchivedAt_Clear = 1 THEN NULL ELSE ISNULL(@ArchivedAt, [ArchivedAt]) END,
        [ArchivedByUserID] = CASE WHEN @ArchivedByUserID_Clear = 1 THEN NULL ELSE ISNULL(@ArchivedByUserID, [ArchivedByUserID]) END,
        [SentByUserID] = CASE WHEN @SentByUserID_Clear = 1 THEN NULL ELSE ISNULL(@SentByUserID, [SentByUserID]) END,
        [SendAttemptCount] = ISNULL(@SendAttemptCount, [SendAttemptCount])
    WHERE
        [ID] = @ID

    -- Check if the update was successful
    IF @@ROWCOUNT = 0
        -- Nothing was updated, return no rows, but column structure from base view intact, semantically correct this way.
        SELECT TOP 0 * FROM [${flyway:defaultSchema}].[vwJournalEntryBatches] WHERE 1=0
    ELSE
        -- Return the updated record so the caller can see the updated values and any calculated fields
        SELECT
                                        *
                                    FROM
                                        [${flyway:defaultSchema}].[vwJournalEntryBatches]
                                    WHERE
                                        [ID] = @ID
                                    
END
GO

REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateJournalEntryBatch] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateJournalEntryBatch] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateJournalEntryBatch] TO [cdp_Developer], [cdp_Integration]
GO

------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the JournalEntryBatch table
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[trgUpdateJournalEntryBatch]', 'TR') IS NOT NULL
    DROP TRIGGER [${flyway:defaultSchema}].[trgUpdateJournalEntryBatch];
GO
CREATE TRIGGER [${flyway:defaultSchema}].trgUpdateJournalEntryBatch
ON [${flyway:defaultSchema}].[JournalEntryBatch]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[JournalEntryBatch]
    SET
        __mj_UpdatedAt = GETUTCDATE()
    FROM
        [${flyway:defaultSchema}].[JournalEntryBatch] AS _organicTable
    INNER JOIN
        INSERTED AS I ON
        _organicTable.[ID] = I.[ID];
END;
GO

/* spUpdate Permissions for MJ_BizApps_Accounting: Journal Entry Batches */

REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateJournalEntryBatch] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateJournalEntryBatch] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateJournalEntryBatch] TO [cdp_Developer], [cdp_Integration];

/* spDelete SQL for MJ_BizApps_Accounting: Journal Entry Batches */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Journal Entry Batches
-- Item: spDeleteJournalEntryBatch
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- DELETE PROCEDURE FOR JournalEntryBatch
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spDeleteJournalEntryBatch]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spDeleteJournalEntryBatch];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spDeleteJournalEntryBatch]
    @ID uniqueidentifier
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM
        [${flyway:defaultSchema}].[JournalEntryBatch]
    WHERE
        [ID] = @ID


    -- Check if the delete was successful
    IF @@ROWCOUNT = 0
        SELECT NULL AS [ID] -- Return NULL for all primary key fields to indicate no record was deleted
    ELSE
        SELECT @ID AS [ID] -- Return the primary key values to indicate we successfully deleted the record
END
GO
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spDeleteJournalEntryBatch] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spDeleteJournalEntryBatch] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteJournalEntryBatch] TO [cdp_Developer], [cdp_Integration];

/* spDelete Permissions for MJ_BizApps_Accounting: Journal Entry Batches */

REVOKE EXECUTE ON [${flyway:defaultSchema}].[spDeleteJournalEntryBatch] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spDeleteJournalEntryBatch] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteJournalEntryBatch] TO [cdp_Developer], [cdp_Integration];

/* SQL text to delete unneeded entity fields (1 scoped entities) */
EXEC [${mjSchema}].[spDeleteUnneededEntityFields] @ExcludedSchemaNames='', @EntityIDs='87AD37E9-62F9-4F0E-A15B-F64ADF009112', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to insert 1 new entity field(s) */

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'e7b0fd21-6179-4e35-9d99-a4ce119be8e4' OR (EntityID = '87AD37E9-62F9-4F0E-A15B-F64ADF009112' AND Name = 'SentByUser')) BEGIN
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
            'e7b0fd21-6179-4e35-9d99-a4ce119be8e4',
            '87AD37E9-62F9-4F0E-A15B-F64ADF009112', -- Entity: MJ_BizApps_Accounting: Journal Entry Batches
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '87AD37E9-62F9-4F0E-A15B-F64ADF009112'),
            'SentByUser',
            'Sent By User',
            NULL,
            'nvarchar',
            200,
            0,
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

/* SQL text to update existing entity fields from schema (1 scoped entities) */
EXEC [${mjSchema}].[spUpdateExistingEntityFieldsFromSchema] @ExcludedSchemaNames='', @EntityIDs='87AD37E9-62F9-4F0E-A15B-F64ADF009112', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to set default column width where needed */
EXEC [${mjSchema}].[spSetDefaultColumnWidthWhereNeeded] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';

/* Set categories for 7 fields */

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Journal Entry Batches.ArchiveReason 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Status and Lifecycle',
   GeneratedFormSection = 'Category'
WHERE 
   ID = '88C4A711-FB72-43A4-9800-069F42D60A3E';

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Journal Entry Batches.ArchivedAt 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Status and Lifecycle',
   GeneratedFormSection = 'Category'
WHERE 
   ID = '46B12172-B692-4E3E-9700-4838D439AA91';

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Journal Entry Batches.ArchivedByUserID 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Status and Lifecycle',
   GeneratedFormSection = 'Category'
WHERE 
   ID = '0C7DD17F-A4ED-460E-91BF-07F8F643E56C';

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Journal Entry Batches.ArchivedByUser 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Status and Lifecycle',
   GeneratedFormSection = 'Category'
WHERE 
   ID = '7DBAEC1E-3101-4314-B8BF-25F0F2EF6EC6';

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Journal Entry Batches.SentByUserID 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Approval and Dispatch',
   GeneratedFormSection = 'Category'
WHERE 
   ID = 'BC3F1C31-CA94-4B2C-BC79-ECBF76920ABA';

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Journal Entry Batches.SendAttemptCount 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Approval and Dispatch',
   GeneratedFormSection = 'Category'
WHERE 
   ID = 'C208EE98-FBAF-41FD-B16F-24C80C3D9DE0';

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Journal Entry Batches.SentByUser 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Approval and Dispatch',
   GeneratedFormSection = 'Category'
WHERE 
   ID = 'E7B0FD21-6179-4E35-9D99-A4CE119BE8E4';

/* Generated Validation Functions for MJ_BizApps_Accounting: Journal Entry Batches */
-- CHECK constraint for MJ_BizApps_Accounting: Journal Entry Batches: Field: SendAttemptCount was newly set or modified since the last generation of the validation function, the code was regenerated and updating the GeneratedCode table with the new generated validation function
IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[GeneratedCode] WHERE [CategoryID] = (SELECT [ID] FROM [${mjSchema}].[vwGeneratedCodeCategories] WHERE [Name]='CodeGen: Validators') AND [LinkedEntityID] = 'DF238F34-2837-EF11-86D4-6045BDEE16E6' AND [LinkedRecordPrimaryKey] = 'C208EE98-FBAF-41FD-B16F-24C80C3D9DE0'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[GeneratedCode] ([ID], [CategoryID], [GeneratedByModelID], [GeneratedAt], [Language], [Status], [Source], [Code], [Description], [Name], [LinkedEntityID], [LinkedRecordPrimaryKey])
VALUES ('9b69230a-e3bf-4cd5-843a-9b13baa86b0b', (SELECT [ID] FROM [${mjSchema}].[vwGeneratedCodeCategories] WHERE [Name]='CodeGen: Validators'), 'C43229F6-4CC8-4838-9D04-03419A2DA191', GETUTCDATE(), 'TypeScript', 'Approved', '([SendAttemptCount]>=(0))', 'public ValidateSendAttemptCountGreaterThanOrEqualToZero(result: ValidationResult) {
	if (this.SendAttemptCount < 0) {
		result.Errors.push(new ValidationErrorInfo(
			"SendAttemptCount",
			"Send attempt count must be 0 or greater.",
			this.SendAttemptCount,
			ValidationErrorType.Failure
		));
	}
}', 'The number of send attempts must be zero or a positive number to ensure we do not record a negative count of attempts.', 'ValidateSendAttemptCountGreaterThanOrEqualToZero', 'DF238F34-2837-EF11-86D4-6045BDEE16E6', 'C208EE98-FBAF-41FD-B16F-24C80C3D9DE0')
   END;

-- CHECK constraint for MJ_BizApps_Accounting: Journal Entry Batches @ Table Level was newly set or modified since the last generation of the validation function, the code was regenerated and updating the GeneratedCode table with the new generated validation function
IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[GeneratedCode] WHERE [CategoryID] = (SELECT [ID] FROM [${mjSchema}].[vwGeneratedCodeCategories] WHERE [Name]='CodeGen: Validators') AND [LinkedEntityID] = 'E0238F34-2837-EF11-86D4-6045BDEE16E6' AND [LinkedRecordPrimaryKey] = '87AD37E9-62F9-4F0E-A15B-F64ADF009112'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[GeneratedCode] ([ID], [CategoryID], [GeneratedByModelID], [GeneratedAt], [Language], [Status], [Source], [Code], [Description], [Name], [LinkedEntityID], [LinkedRecordPrimaryKey])
VALUES ('d4539d60-de60-41c7-8288-b68b79ae4208', (SELECT [ID] FROM [${mjSchema}].[vwGeneratedCodeCategories] WHERE [Name]='CodeGen: Validators'), 'C43229F6-4CC8-4838-9D04-03419A2DA191', GETUTCDATE(), 'TypeScript', 'Approved', '([Status]<>''Archived'' OR [ArchiveReason] IS NOT NULL AND len(ltrim(rtrim([ArchiveReason])))>(0) AND [ArchivedAt] IS NOT NULL AND [ArchivedByUserID] IS NOT NULL)', '	public ValidateArchivedStatusRequirements(result: ValidationResult) {
		if (this.Status === "Archived") {
			const hasReason = this.ArchiveReason != null && this.ArchiveReason.trim().length > 0;
			const hasDate = this.ArchivedAt != null;
			const hasUser = this.ArchivedByUserID != null;

			if (!hasReason) {
				result.Errors.push(new ValidationErrorInfo(
					"ArchiveReason",
					"An archive reason must be provided when the record is archived.",
					this.ArchiveReason,
					ValidationErrorType.Failure
				));
			}
			if (!hasDate) {
				result.Errors.push(new ValidationErrorInfo(
					"ArchivedAt",
					"The archived date must be set when the record is archived.",
					this.ArchivedAt,
					ValidationErrorType.Failure
				));
			}
			if (!hasUser) {
				result.Errors.push(new ValidationErrorInfo(
					"ArchivedByUserID",
					"The user who archived the record must be specified when the record is archived.",
					this.ArchivedByUserID,
					ValidationErrorType.Failure
				));
			}
		}
	}', 'When a record''s status is set to ''Archived'', an archive reason must be provided (and cannot be blank), along with the date/time it was archived and the ID of the user who archived it.', 'ValidateArchivedStatusRequirements', 'E0238F34-2837-EF11-86D4-6045BDEE16E6', '87AD37E9-62F9-4F0E-A15B-F64ADF009112')
   END;


