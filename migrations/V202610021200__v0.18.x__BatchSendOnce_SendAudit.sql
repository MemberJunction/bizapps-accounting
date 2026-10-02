-- =============================================================================
-- Migration: V202610021200__v0.18.x__BatchSendOnce_SendAudit.sql
-- Description: #184 — a batch can be sent only from Approved or Failed, one
--              send at a time, and every send records who made it and which
--              attempt it was.
-- =============================================================================
--
-- WHY
--
-- sendJournalEntryBatch reads the batch's Status, checks it is sendable, then
-- saves Status='Sent'. The generated spUpdate is a blind UPDATE ... WHERE ID=@ID,
-- so nothing ties that write to the status the send read. Two retries of one
-- Failed batch, started close together, both read Failed, both write Sent, and
-- both call the ERP: two journals.
--
-- The entity layer cannot catch this. The second writer's Status OldValue is
-- the Failed it loaded, so its Failed -> Sent looks legal to Validate(). The row
-- lock on the UPDATE is the only place the two sends meet, so the refusal lives
-- in a trigger, and it has to hold whatever the first send has reached by the
-- time the second one's UPDATE lands:
--
--   still Sent          the second UPDATE keeps the row Sent. Nothing keeps a
--                       batch Sent on purpose — every write to a Sent batch
--                       moves it to Posted or Failed — so a top-level UPDATE
--                       that leaves a Sent row Sent is refused. That includes
--                       one whose stamp matches the first send's exactly, the
--                       same millisecond from the same user.
--   Posted, or Failed   the second UPDATE writes the SendAttemptCount it
--   again               computed from its stale load, which the first send
--                       has already used. A send is valid only from Approved or
--                       Failed, and only as the count's next value, so it is
--                       refused. SendAttemptCount is the version token.
--
-- The losing save fails with 50030, and sendJournalEntryBatch throws
-- JournalEntryBatchSendRefusedError before it calls the ERP.
--
-- The send stamp — SentAt, SentByUserID, SendAttemptCount — changes only on a
-- valid send, so a Posted batch's count or sender cannot be edited afterwards.
-- SentAt is compared at millisecond precision: the entity writes JavaScript
-- dates, and an exact comparison misfires on a value SQL wrote with sub-ms digits.
--
-- The UPDATE that CodeGen's trgUpdateJournalEntryBatch makes to set
-- __mj_UpdatedAt fires this trigger again, with the row already Sent. It changes
-- nothing else, so it is let through by name. If that trigger does not exist
-- (between CodeGen's DROP and CREATE inside a migration), OBJECT_ID is NULL and
-- TRIGGER_NESTLEVEL(NULL, ...) counts every trigger on the stack, so the bypass
-- is skipped rather than evaluated against NULL.
--
-- FIRED FIRST. trg_JournalEntryBatch_Immutability also refuses Posted -> Sent
-- and Cancelled -> Sent, with ROLLBACK + THROW. SQL Server does not define the
-- order of AFTER triggers; if that one fires first, the caller gets 3915 in
-- place of 50030 and the refused send is not recognised as one. Section 4 sets
-- this trigger First for UPDATE. SQL Server drops that setting when this trigger
-- itself is altered or dropped and recreated, so any later migration that does
-- either must run sp_settriggerorder again. Recreating other triggers keeps it.
--
-- THROW with no ROLLBACK TRANSACTION first. The entity's save runs spUpdate
-- inside INSERT-EXEC, where a ROLLBACK is itself an error (3915) and the caller
-- would get that in place of the message below. A trigger runs with XACT_ABORT
-- on, so THROW alone rolls the update back.
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
-- SET-BASED UPDATES IN LATER MIGRATIONS: "nothing keeps a batch Sent" refuses
-- any top-level UPDATE of JournalEntryBatch that touches a Sent row, a backfill
-- included. Add WHERE Status <> 'Sent', or disable this trigger around it.
--
-- This runs once, in order, against a database that has every earlier migration.
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
-- never sent. SentByUserID stays NULL — unknown, not asserted. Runs before the
-- trigger exists.
-- -----------------------------------------------------------------------------
UPDATE __mj_BizAppsAccounting.JournalEntryBatch
SET SendAttemptCount = 1
WHERE SentAt IS NOT NULL;
GO

-- -----------------------------------------------------------------------------
-- 3. One send at a time, from Approved or Failed, each the count's next value
-- -----------------------------------------------------------------------------
CREATE TRIGGER __mj_BizAppsAccounting.trg_JournalEntryBatch_SendOnce
ON __mj_BizAppsAccounting.JournalEntryBatch
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @CodeGenUpdateTrigger INT = OBJECT_ID(N'__mj_BizAppsAccounting.trgUpdateJournalEntryBatch');
    IF @CodeGenUpdateTrigger IS NOT NULL AND TRIGGER_NESTLEVEL(@CodeGenUpdateTrigger, 'AFTER', 'DML') > 0 RETURN;

    -- Still Sent: another dispatch holds the batch.
    IF EXISTS (
        SELECT 1 FROM deleted d JOIN inserted i ON i.ID = d.ID
        WHERE d.Status = 'Sent' AND i.Status = 'Sent'
    )
        THROW 50030, 'JournalEntryBatch send refused: the batch is already Sent. An update to a Sent batch must move it to Posted or Failed; if a dispatch is in progress, wait for its outcome.', 1;

    -- Entering Sent: only from Approved or Failed, and only as the count's next value.
    IF EXISTS (
        SELECT 1 FROM deleted d JOIN inserted i ON i.ID = d.ID
        WHERE i.Status = 'Sent' AND d.Status <> 'Sent'
          AND (d.Status NOT IN ('Approved', 'Failed') OR i.SendAttemptCount <> d.SendAttemptCount + 1)
    )
        THROW 50030, 'JournalEntryBatch send refused: a send must start from Approved or Failed and advance SendAttemptCount by one. The batch has been sent since this send loaded it.', 1;

    -- Not a send: the send stamp stays as it is.
    IF EXISTS (
        SELECT 1 FROM deleted d JOIN inserted i ON i.ID = d.ID
        WHERE NOT (i.Status = 'Sent' AND d.Status <> 'Sent')
          AND (
            i.SendAttemptCount <> d.SendAttemptCount OR
            ISNULL(i.SentByUserID, '00000000-0000-0000-0000-000000000000') <> ISNULL(d.SentByUserID, '00000000-0000-0000-0000-000000000000') OR
            (i.SentAt IS NULL AND d.SentAt IS NOT NULL) OR (i.SentAt IS NOT NULL AND d.SentAt IS NULL) OR
            ABS(DATEDIFF_BIG(MICROSECOND, d.SentAt, i.SentAt)) >= 1000
          )
    )
        THROW 50030, 'JournalEntryBatch send refused: SentAt, SentByUserID and SendAttemptCount change only when the batch is sent.', 1;
END;
GO

-- -----------------------------------------------------------------------------
-- 4. Fire before trg_JournalEntryBatch_Immutability, so a refused send reports 50030
-- -----------------------------------------------------------------------------
EXEC sp_settriggerorder
    @triggername = N'__mj_BizAppsAccounting.trg_JournalEntryBatch_SendOnce',
    @order = N'First',
    @stmttype = N'UPDATE';
GO

-- -----------------------------------------------------------------------------
-- 5. Column descriptions — CodeGen carries these into EntityField.Description
-- -----------------------------------------------------------------------------
EXEC sp_updateextendedproperty @name = N'MS_Description',
    @value = N'When the batch last entered Sent. A retry overwrites it; SendAttemptCount counts the sends, and __mj.RecordChange keeps each earlier value.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryBatch', @level2type = N'COLUMN', @level2name = N'SentAt';
GO

EXEC sp_addextendedproperty @name = N'MS_Description',
    @value = N'User whose dispatch last moved the batch into Sent. Stamped on every send; changes at no other time. NULL for batches sent before this column existed.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryBatch', @level2type = N'COLUMN', @level2name = N'SentByUserID';
GO

EXEC sp_addextendedproperty @name = N'MS_Description',
    @value = N'Dispatch attempts that moved the batch into Sent, including a retry that finds the batch already in the ERP and a first send the pre-flight lookup refuses; neither calls the ERP. A retry refused before Sent is not counted. Each send must advance it by one (trg_JournalEntryBatch_SendOnce). Batches sent before this column existed read 1.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryBatch', @level2type = N'COLUMN', @level2name = N'SendAttemptCount';
GO












































































-- =============================================================================
-- CODEGEN OUTPUT — GENERATED CODE BELOW THIS LINE. DO NOT EDIT BY HAND.
-- =============================================================================


/* SQL text to update existing entities from schema */
EXEC [${mjSchema}].[spUpdateExistingEntitiesFromSchema] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to insert 2 new entity field(s) */

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '6581636b-749c-4cac-996c-c29561233bf9' OR (EntityID = '87AD37E9-62F9-4F0E-A15B-F64ADF009112' AND Name = 'SentByUserID')) BEGIN
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
            '6581636b-749c-4cac-996c-c29561233bf9',
            '87AD37E9-62F9-4F0E-A15B-F64ADF009112', -- Entity: MJ_BizApps_Accounting: Journal Entry Batches
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '87AD37E9-62F9-4F0E-A15B-F64ADF009112'),
            'SentByUserID',
            'Sent By User ID',
            'User whose dispatch last moved the batch into Sent. Stamped on every send; changes at no other time. NULL for batches sent before this column existed.',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '54a45f54-e6cf-4fe3-962c-93e9b12a316c' OR (EntityID = '87AD37E9-62F9-4F0E-A15B-F64ADF009112' AND Name = 'SendAttemptCount')) BEGIN
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
            '54a45f54-e6cf-4fe3-962c-93e9b12a316c',
            '87AD37E9-62F9-4F0E-A15B-F64ADF009112', -- Entity: MJ_BizApps_Accounting: Journal Entry Batches
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '87AD37E9-62F9-4F0E-A15B-F64ADF009112'),
            'SendAttemptCount',
            'Send Attempt Count',
            'Dispatch attempts that moved the batch into Sent, including a retry that finds the batch already in the ERP and a first send the pre-flight lookup refuses; neither calls the ERP. A retry refused before Sent is not counted. Each send must advance it by one (trg_JournalEntryBatch_SendOnce). Batches sent before this column existed read 1.',
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
      SELECT 1 FROM [${mjSchema}].[EntityRelationship] WHERE [ID] = '4d28ab5a-4887-4c31-8338-b9239355e9e1'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
                    VALUES ('4d28ab5a-4887-4c31-8338-b9239355e9e1', 'E1238F34-2837-EF11-86D4-6045BDEE16E6', '87AD37E9-62F9-4F0E-A15B-F64ADF009112', 'SentByUserID', 'One To Many', 1, 1, 116, GETUTCDATE(), GETUTCDATE())
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

-- Index for foreign key CancelledByUserID in table JournalEntryBatch
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_JournalEntryBatch_CancelledByUserID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[JournalEntryBatch]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_JournalEntryBatch_CancelledByUserID ON [${flyway:defaultSchema}].[JournalEntryBatch] ([CancelledByUserID]);

-- Index for foreign key ERPNotPostedConfirmedByUserID in table JournalEntryBatch
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_JournalEntryBatch_ERPNotPostedConfirmedByUserID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[JournalEntryBatch]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_JournalEntryBatch_ERPNotPostedConfirmedByUserID ON [${flyway:defaultSchema}].[JournalEntryBatch] ([ERPNotPostedConfirmedByUserID]);

-- Index for foreign key SentByUserID in table JournalEntryBatch
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_JournalEntryBatch_SentByUserID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[JournalEntryBatch]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_JournalEntryBatch_SentByUserID ON [${flyway:defaultSchema}].[JournalEntryBatch] ([SentByUserID]);

/* SQL text to update entity field related entity name field map for entity field ID 6581636B-749C-4CAC-996C-C29561233BF9 */
EXEC [${mjSchema}].[spUpdateEntityFieldRelatedEntityNameFieldMap] @EntityFieldID='6581636B-749C-4CAC-996C-C29561233BF9', @RelatedEntityNameFieldMap='SentByUser';

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
    MJUser_CancelledByUserID.[Name] AS [CancelledByUser],
    MJUser_ERPNotPostedConfirmedByUserID.[Name] AS [ERPNotPostedConfirmedByUser],
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
    [${mjSchema}].[User] AS MJUser_CancelledByUserID
  ON
    [j].[CancelledByUserID] = MJUser_CancelledByUserID.[ID]
LEFT OUTER JOIN
    [${mjSchema}].[User] AS MJUser_ERPNotPostedConfirmedByUserID
  ON
    [j].[ERPNotPostedConfirmedByUserID] = MJUser_ERPNotPostedConfirmedByUserID.[ID]
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
    @CancelReason_Clear bit = 0,
    @CancelReason nvarchar(500) = NULL,
    @CancelledAt_Clear bit = 0,
    @CancelledAt datetimeoffset = NULL,
    @CancelledByUserID_Clear bit = 0,
    @CancelledByUserID uniqueidentifier = NULL,
    @ERPNotPostedConfirmedAt_Clear bit = 0,
    @ERPNotPostedConfirmedAt datetimeoffset = NULL,
    @ERPNotPostedConfirmedByUserID_Clear bit = 0,
    @ERPNotPostedConfirmedByUserID uniqueidentifier = NULL,
    @ERPNotPostedBasis_Clear bit = 0,
    @ERPNotPostedBasis nvarchar(20) = NULL,
    @ApprovedContentHash_Clear bit = 0,
    @ApprovedContentHash nvarchar(64) = NULL,
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
                [CancelReason],
                [CancelledAt],
                [CancelledByUserID],
                [ERPNotPostedConfirmedAt],
                [ERPNotPostedConfirmedByUserID],
                [ERPNotPostedBasis],
                [ApprovedContentHash],
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
                CASE WHEN @CancelReason_Clear = 1 THEN NULL ELSE ISNULL(@CancelReason, NULL) END,
                CASE WHEN @CancelledAt_Clear = 1 THEN NULL ELSE ISNULL(@CancelledAt, NULL) END,
                CASE WHEN @CancelledByUserID_Clear = 1 THEN NULL ELSE ISNULL(@CancelledByUserID, NULL) END,
                CASE WHEN @ERPNotPostedConfirmedAt_Clear = 1 THEN NULL ELSE ISNULL(@ERPNotPostedConfirmedAt, NULL) END,
                CASE WHEN @ERPNotPostedConfirmedByUserID_Clear = 1 THEN NULL ELSE ISNULL(@ERPNotPostedConfirmedByUserID, NULL) END,
                CASE WHEN @ERPNotPostedBasis_Clear = 1 THEN NULL ELSE ISNULL(@ERPNotPostedBasis, NULL) END,
                CASE WHEN @ApprovedContentHash_Clear = 1 THEN NULL ELSE ISNULL(@ApprovedContentHash, NULL) END,
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
                [CancelReason],
                [CancelledAt],
                [CancelledByUserID],
                [ERPNotPostedConfirmedAt],
                [ERPNotPostedConfirmedByUserID],
                [ERPNotPostedBasis],
                [ApprovedContentHash],
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
                CASE WHEN @CancelReason_Clear = 1 THEN NULL ELSE ISNULL(@CancelReason, NULL) END,
                CASE WHEN @CancelledAt_Clear = 1 THEN NULL ELSE ISNULL(@CancelledAt, NULL) END,
                CASE WHEN @CancelledByUserID_Clear = 1 THEN NULL ELSE ISNULL(@CancelledByUserID, NULL) END,
                CASE WHEN @ERPNotPostedConfirmedAt_Clear = 1 THEN NULL ELSE ISNULL(@ERPNotPostedConfirmedAt, NULL) END,
                CASE WHEN @ERPNotPostedConfirmedByUserID_Clear = 1 THEN NULL ELSE ISNULL(@ERPNotPostedConfirmedByUserID, NULL) END,
                CASE WHEN @ERPNotPostedBasis_Clear = 1 THEN NULL ELSE ISNULL(@ERPNotPostedBasis, NULL) END,
                CASE WHEN @ApprovedContentHash_Clear = 1 THEN NULL ELSE ISNULL(@ApprovedContentHash, NULL) END,
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
    @CancelReason_Clear bit = 0,
    @CancelReason nvarchar(500) = NULL,
    @CancelledAt_Clear bit = 0,
    @CancelledAt datetimeoffset = NULL,
    @CancelledByUserID_Clear bit = 0,
    @CancelledByUserID uniqueidentifier = NULL,
    @ERPNotPostedConfirmedAt_Clear bit = 0,
    @ERPNotPostedConfirmedAt datetimeoffset = NULL,
    @ERPNotPostedConfirmedByUserID_Clear bit = 0,
    @ERPNotPostedConfirmedByUserID uniqueidentifier = NULL,
    @ERPNotPostedBasis_Clear bit = 0,
    @ERPNotPostedBasis nvarchar(20) = NULL,
    @ApprovedContentHash_Clear bit = 0,
    @ApprovedContentHash nvarchar(64) = NULL,
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
        [CancelReason] = CASE WHEN @CancelReason_Clear = 1 THEN NULL ELSE ISNULL(@CancelReason, [CancelReason]) END,
        [CancelledAt] = CASE WHEN @CancelledAt_Clear = 1 THEN NULL ELSE ISNULL(@CancelledAt, [CancelledAt]) END,
        [CancelledByUserID] = CASE WHEN @CancelledByUserID_Clear = 1 THEN NULL ELSE ISNULL(@CancelledByUserID, [CancelledByUserID]) END,
        [ERPNotPostedConfirmedAt] = CASE WHEN @ERPNotPostedConfirmedAt_Clear = 1 THEN NULL ELSE ISNULL(@ERPNotPostedConfirmedAt, [ERPNotPostedConfirmedAt]) END,
        [ERPNotPostedConfirmedByUserID] = CASE WHEN @ERPNotPostedConfirmedByUserID_Clear = 1 THEN NULL ELSE ISNULL(@ERPNotPostedConfirmedByUserID, [ERPNotPostedConfirmedByUserID]) END,
        [ERPNotPostedBasis] = CASE WHEN @ERPNotPostedBasis_Clear = 1 THEN NULL ELSE ISNULL(@ERPNotPostedBasis, [ERPNotPostedBasis]) END,
        [ApprovedContentHash] = CASE WHEN @ApprovedContentHash_Clear = 1 THEN NULL ELSE ISNULL(@ApprovedContentHash, [ApprovedContentHash]) END,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'efc0dbfa-e37b-4e49-a417-4093baf42ec3' OR (EntityID = '87AD37E9-62F9-4F0E-A15B-F64ADF009112' AND Name = 'SentByUser')) BEGIN
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
            'efc0dbfa-e37b-4e49-a417-4093baf42ec3',
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
   ID = '6581636B-749C-4CAC-996C-C29561233BF9';

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Journal Entry Batches.SendAttemptCount 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Approval and Dispatch',
   GeneratedFormSection = 'Category'
WHERE 
   ID = '54A45F54-E6CF-4FE3-962C-93E9B12A316C';

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Journal Entry Batches.SentByUser 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Approval and Dispatch',
   GeneratedFormSection = 'Category'
WHERE 
   ID = 'EFC0DBFA-E37B-4E49-A417-4093BAF42EC3';

/* Generated Validation Functions for MJ_BizApps_Accounting: Journal Entry Batches */
-- CHECK constraint for MJ_BizApps_Accounting: Journal Entry Batches: Field: SendAttemptCount was newly set or modified since the last generation of the validation function, the code was regenerated and updating the GeneratedCode table with the new generated validation function
IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[GeneratedCode] WHERE [CategoryID] = (SELECT [ID] FROM [${mjSchema}].[vwGeneratedCodeCategories] WHERE [Name]='CodeGen: Validators') AND [LinkedEntityID] = 'DF238F34-2837-EF11-86D4-6045BDEE16E6' AND [LinkedRecordPrimaryKey] = '54A45F54-E6CF-4FE3-962C-93E9B12A316C'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[GeneratedCode] ([ID], [CategoryID], [GeneratedByModelID], [GeneratedAt], [Language], [Status], [Source], [Code], [Description], [Name], [LinkedEntityID], [LinkedRecordPrimaryKey])
VALUES ('034181c7-2967-4456-8228-992bdf860999', (SELECT [ID] FROM [${mjSchema}].[vwGeneratedCodeCategories] WHERE [Name]='CodeGen: Validators'), 'C43229F6-4CC8-4838-9D04-03419A2DA191', GETUTCDATE(), 'TypeScript', 'Approved', '([SendAttemptCount]>=(0))', 'public ValidateSendAttemptCountGreaterThanOrEqualToZero(result: ValidationResult) {
	if (this.SendAttemptCount != null && this.SendAttemptCount < 0) {
		result.Errors.push(new ValidationErrorInfo(
			"SendAttemptCount",
			"The send attempt count cannot be negative.",
			this.SendAttemptCount,
			ValidationErrorType.Failure
		));
	}
}', 'The number of send attempts must be zero or a positive number to ensure valid tracking of delivery attempts.', 'ValidateSendAttemptCountGreaterThanOrEqualToZero', 'DF238F34-2837-EF11-86D4-6045BDEE16E6', '54A45F54-E6CF-4FE3-962C-93E9B12A316C')
   END;

