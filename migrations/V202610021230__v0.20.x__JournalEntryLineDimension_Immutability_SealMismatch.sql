-- =============================================================================
-- Migration: V202610021230__v0.20.x__JournalEntryLineDimension_Immutability_SealMismatch.sql
-- Description: #216 — dimension tags on a locked journal entry line are frozen,
--              and a batch records when a retry found it posted in the ERP
--              although its approved-content seal no longer matched.
-- =============================================================================
--
-- WHY
--
-- A batch's approved-content seal (ApprovedContentHash) covers every summary
-- line's dimension tags. Every other part of what it covers is already frozen
-- by a trigger once the batch is approved — the header by
-- trg_JournalEntryBatch_Immutability, the summary entry by
-- trg_JournalEntry_Immutability, its lines by trg_JEL_Immutability — but
-- JournalEntryLineDimension rows were not. A tag edited on a locked line broke
-- the seal, and a Failed batch whose journal had in fact reached the ERP could
-- then be neither retried (the seal refused it) nor cancelled (the ERP lookup
-- found the posting): it could only be archived.
--
-- WHAT CHANGES
--
-- 1. trg_JELD_Immutability refuses insert, update and delete of a dimension tag
--    on a line whose journal entry is Batched or GLPosted, as
--    trg_JEL_Immutability does for the line itself. Corrections are reversal
--    entries, as for lines.
--
-- 2. JournalEntryBatch.SealMismatchDetectedAt: when a Failed batch's retry finds
--    its journal already in the ERP, the batch is recorded Posted with no second
--    post even though the seal no longer matches (nothing is sent, and the ERP
--    holds what was approved). This column records when that happened, so the
--    batch can be listed and its local tags reviewed. NULL on every other batch.
--    Existing rows stay NULL.
--
-- 3. The flag is frozen. trg_JournalEntryBatch_Immutability (50034) lets
--    SealMismatchDetectedAt be set only by the update that records a retried
--    batch Posted (Sent -> Posted with SendAttemptCount above 1), and refuses any
--    later change or clear and any insert that carries it. It is the review
--    record, so no save may stamp it on a batch that was not adopted this way or
--    erase it from one that was. trg_JournalEntryBatch_SendOnce keeps its First
--    firing order: only this trigger is altered.
--
-- Every rule in both triggers THROWs with no ROLLBACK TRANSACTION first, as
-- V202610011000 (#211) left the batch trigger. A dimension tag or a batch is
-- saved by the entity's spCreate / spUpdate / spDelete, which the provider runs
-- inside INSERT-EXEC, where a ROLLBACK in the trigger is itself an error (3915)
-- and the caller would get that in place of the message. A trigger runs with
-- XACT_ABORT on, so THROW alone rolls the statement back.
--
-- Dimension tags already edited on locked lines are not re-checked: the rule
-- applies to changes from now on.
--
-- This runs once, in order, against a database that has every earlier migration.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Dimension tags on a locked journal entry line are frozen
-- -----------------------------------------------------------------------------
CREATE TRIGGER __mj_BizAppsAccounting.trg_JELD_Immutability
ON __mj_BizAppsAccounting.JournalEntryLineDimension
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (
        SELECT 1
          FROM __mj_BizAppsAccounting.JournalEntryLine jel
          JOIN __mj_BizAppsAccounting.JournalEntry je ON je.ID = jel.JournalEntryID
         WHERE jel.ID IN (SELECT JournalEntryLineID FROM inserted UNION SELECT JournalEntryLineID FROM deleted)
           AND je.Status IN ('Batched','GLPosted')
    )
        THROW 50033, 'JournalEntryLineDimension on a locked JournalEntry (Status=Batched/GLPosted) cannot be inserted, modified, or deleted. Use the reversal pattern.', 1;
END;
GO

-- -----------------------------------------------------------------------------
-- 2. When a retry adopted the ERP's posting over a broken seal
-- -----------------------------------------------------------------------------
ALTER TABLE __mj_BizAppsAccounting.JournalEntryBatch ADD
    SealMismatchDetectedAt DATETIMEOFFSET NULL;
GO

EXEC sp_addextendedproperty @name = N'MS_Description',
    @value = N'When a retry of this Failed batch found its journal already in the ERP and recorded it Posted, with no second post, although the batch no longer matched its approved-content seal (a summary line''s dimension tags changed after approval). The local tags then differ from what the ERP holds; review them. NULL when the seal matched or the batch was never adopted this way.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryBatch', @level2type = N'COLUMN', @level2name = N'SealMismatchDetectedAt';
GO

-- -----------------------------------------------------------------------------
-- 3. SealMismatchDetectedAt is set once, by the retry that records the batch Posted
-- -----------------------------------------------------------------------------
-- trg_JournalEntryBatch_Immutability is the V202610021220 (PendingCancelTeardownGate)
-- body verbatim, plus INSERT among its events and the SEAL MISMATCH rule (50034)
-- at the end. The earlier rules join inserted to deleted, or need deleted with no
-- inserted, so an insert reaches only the new rule.
CREATE OR ALTER TRIGGER __mj_BizAppsAccounting.trg_JournalEntryBatch_Immutability
ON __mj_BizAppsAccounting.JournalEntryBatch
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    -- DELETE: an approved batch is never deleted, and neither is the record that one was cancelled.
    IF NOT EXISTS (SELECT 1 FROM inserted) AND EXISTS (
        SELECT 1 FROM deleted
        WHERE Status IN ('Approved','Sent','Posted','Failed','Archived')
           OR (Status = 'Cancelled' AND ApprovedAt IS NOT NULL)
    )
    BEGIN
        THROW 50008, 'JournalEntryBatch cannot be deleted once Status is Approved, Sent, Posted, Failed, or Archived, or once it was cancelled after approval. Cancel it instead.', 1;
    END;

    -- STATUS: Cancelled releases entries, so only Pending / Approved / Failed may reach it, a batch
    -- reaches it only with its summary pointer cleared (by the same update, or by regenerate's
    -- teardown before it), and the terminal statuses never change again. Nothing moves back to
    -- Pending (a Pending batch's members can be released by any journal entry save), only a Pending
    -- batch is approved, and a Sent batch is not archived (it may still be posting in the ERP).
    -- Posted and Failed are the outcomes of a send, so only a Sent batch reaches them; -> Sent is
    -- policed by trg_JournalEntryBatch_SendOnce (50030).
    IF EXISTS (
        SELECT 1
        FROM deleted d
        JOIN inserted i ON i.ID = d.ID
        WHERE i.Status <> d.Status
          AND (
            d.Status IN ('Posted','Cancelled','Archived')
            OR i.Status = 'Pending'
            OR (i.Status = 'Approved' AND d.Status <> 'Pending')
            OR (i.Status = 'Archived' AND d.Status NOT IN ('Pending','Approved','Failed'))
            OR (i.Status = 'Cancelled' AND d.Status NOT IN ('Pending','Approved','Failed'))
            OR (i.Status = 'Cancelled' AND i.SummaryJournalEntryID IS NOT NULL)
            OR (i.Status IN ('Posted','Failed') AND d.Status <> 'Sent')
          )
    )
    BEGIN
        THROW 50031, 'JournalEntryBatch status change refused. Posted, Cancelled and Archived are terminal; no batch returns to Pending; only a Pending batch is approved; Posted and Failed are reachable only from Sent; Archived is reachable only from Pending, Approved or Failed; Cancelled is reachable only from Pending, Approved or Failed; and a batch is cancelled only with its summary pointer cleared (JournalEntryBatchEntityServer.Cancel).', 1;
    END;

    -- AUDIT: the cancel audit and the ERP check are written only by the update that cancels the
    -- batch, so no other save can stamp a "not posted in the ERP" record on it; and SentAt, once set,
    -- is never cleared, because it is the evidence CK_JournalEntryBatch_CancelERPCheck keys on. A
    -- retry re-stamps SentAt with a new time, which is allowed.
    IF EXISTS (
        SELECT 1
        FROM deleted d
        JOIN inserted i ON i.ID = d.ID
        WHERE (d.SentAt IS NOT NULL AND i.SentAt IS NULL)
           OR (
               NOT (i.Status = 'Cancelled' AND d.Status <> 'Cancelled')
               AND (
                   ISNULL(i.CancelReason,                  N'')                                    <> ISNULL(d.CancelReason,                  N'')                                    OR
                   (CASE WHEN i.CancelledAt IS NULL AND d.CancelledAt IS NULL THEN 0 WHEN i.CancelledAt IS NULL OR d.CancelledAt IS NULL THEN 1 WHEN ABS(DATEDIFF_BIG(MICROSECOND, i.CancelledAt, d.CancelledAt)) >= 1000 THEN 1 ELSE 0 END) = 1 OR
                   ISNULL(i.CancelledByUserID,             '00000000-0000-0000-0000-000000000000') <> ISNULL(d.CancelledByUserID,             '00000000-0000-0000-0000-000000000000') OR
                   (CASE WHEN i.ERPNotPostedConfirmedAt IS NULL AND d.ERPNotPostedConfirmedAt IS NULL THEN 0 WHEN i.ERPNotPostedConfirmedAt IS NULL OR d.ERPNotPostedConfirmedAt IS NULL THEN 1 WHEN ABS(DATEDIFF_BIG(MICROSECOND, i.ERPNotPostedConfirmedAt, d.ERPNotPostedConfirmedAt)) >= 1000 THEN 1 ELSE 0 END) = 1 OR
                   ISNULL(i.ERPNotPostedConfirmedByUserID, '00000000-0000-0000-0000-000000000000') <> ISNULL(d.ERPNotPostedConfirmedByUserID, '00000000-0000-0000-0000-000000000000') OR
                   ISNULL(i.ERPNotPostedBasis,             N'')                                    <> ISNULL(d.ERPNotPostedBasis,             N'')
               )
           )
    )
    BEGIN
        THROW 50032, 'JournalEntryBatch audit refused. CancelReason / CancelledAt / CancelledByUserID and ERPNotPostedConfirmedAt / ERPNotPostedConfirmedByUserID / ERPNotPostedBasis are written only by the update that cancels the batch, and SentAt is never cleared once set.', 1;
    END;

    -- CONTENT: frozen from approval on, Failed and Cancelled included. The timestamps this migration
    -- freezes compare at millisecond precision: every entity save writes each column back through a
    -- JavaScript Date, so a value written by SQL with sub-millisecond digits would otherwise read as
    -- changed on the next ordinary save.
    IF EXISTS (
        SELECT 1
        FROM deleted d
        JOIN inserted i ON i.ID = d.ID
        WHERE d.Status IN ('Approved','Sent','Posted','Failed','Archived','Cancelled')
          AND (
            i.JournalEntryBatchNumber          <> d.JournalEntryBatchNumber          OR
            i.CompanyID            <> d.CompanyID            OR
            i.PostingDate          <> d.PostingDate          OR
            -- The summary pointer is frozen, except for the one sanctioned change: an Approved or
            -- Failed batch clearing it in the same update that marks it Cancelled.
            (
                ISNULL(i.SummaryJournalEntryID, '00000000-0000-0000-0000-000000000000') <> ISNULL(d.SummaryJournalEntryID, '00000000-0000-0000-0000-000000000000')
                AND NOT (
                    d.Status IN ('Approved','Failed')
                    AND i.Status = 'Cancelled'
                    AND i.SummaryJournalEntryID IS NULL
                )
            ) OR
            ISNULL(i.ApprovalTaskID,        '00000000-0000-0000-0000-000000000000') <> ISNULL(d.ApprovalTaskID,        '00000000-0000-0000-0000-000000000000') OR
            (CASE WHEN i.ApprovedAt IS NULL AND d.ApprovedAt IS NULL THEN 0 WHEN i.ApprovedAt IS NULL OR d.ApprovedAt IS NULL THEN 1 WHEN ABS(DATEDIFF_BIG(MICROSECOND, i.ApprovedAt, d.ApprovedAt)) >= 1000 THEN 1 ELSE 0 END) = 1 OR
            ISNULL(i.ApprovedByUserID,      '00000000-0000-0000-0000-000000000000') <> ISNULL(d.ApprovedByUserID,      '00000000-0000-0000-0000-000000000000') OR
            ISNULL(i.ApprovedContentHash,   N'')                                    <> ISNULL(d.ApprovedContentHash,   N'')                                    OR
            i.TargetSystem         <> d.TargetSystem         OR
            i.BatchedAt            <> d.BatchedAt            OR
            i.BatchedByUserID      <> d.BatchedByUserID      OR
            i.TotalEntries         <> d.TotalEntries         OR
            i.TotalDebits          <> d.TotalDebits          OR
            i.TotalCredits         <> d.TotalCredits         OR
            -- Once Cancelled, the cancel audit and the ERP-check attestation are the record; they freeze too.
            (
                d.Status = 'Cancelled'
                AND (
                    ISNULL(i.CancelReason,                  N'')                                    <> ISNULL(d.CancelReason,                  N'')                                    OR
                    (CASE WHEN i.CancelledAt IS NULL AND d.CancelledAt IS NULL THEN 0 WHEN i.CancelledAt IS NULL OR d.CancelledAt IS NULL THEN 1 WHEN ABS(DATEDIFF_BIG(MICROSECOND, i.CancelledAt, d.CancelledAt)) >= 1000 THEN 1 ELSE 0 END) = 1 OR
                    ISNULL(i.CancelledByUserID,             '00000000-0000-0000-0000-000000000000') <> ISNULL(d.CancelledByUserID,             '00000000-0000-0000-0000-000000000000') OR
                    (CASE WHEN i.ERPNotPostedConfirmedAt IS NULL AND d.ERPNotPostedConfirmedAt IS NULL THEN 0 WHEN i.ERPNotPostedConfirmedAt IS NULL OR d.ERPNotPostedConfirmedAt IS NULL THEN 1 WHEN ABS(DATEDIFF_BIG(MICROSECOND, i.ERPNotPostedConfirmedAt, d.ERPNotPostedConfirmedAt)) >= 1000 THEN 1 ELSE 0 END) = 1 OR
                    ISNULL(i.ERPNotPostedConfirmedByUserID, '00000000-0000-0000-0000-000000000000') <> ISNULL(d.ERPNotPostedConfirmedByUserID, '00000000-0000-0000-0000-000000000000')
                )
            )
          )
    )
    BEGIN
        THROW 50009, 'JournalEntryBatch is locked (Status=Approved/Sent/Posted/Failed/Archived/Cancelled). Only Status / PostedAt / the Archive audit triple / ExternalJournalEntryBatchRef / ErrorMessage may evolve; the send stamp (SentAt / SentByUserID / SendAttemptCount) changes only on a send (50030); the Cancel audit and ERP check are written only by the update that cancels the batch (50032). CompanyID, PostingDate, SummaryJournalEntryID, the approval-task pointer, ApprovedAt / ApprovedByUserID and ApprovedContentHash freeze at approval; the summary pointer may clear only as an Approved or Failed batch is Cancelled.', 1;
    END;

    -- SEAL MISMATCH (#216): SealMismatchDetectedAt is written only by the update that records a
    -- retried batch Posted from the ERP, and once set it never changes or clears. A retry is a send
    -- from Failed; a first send from Approved is attempt 1, so Sent -> Posted with SendAttemptCount
    -- above 1 is the one update that may set it. A new batch carries none. Compared at millisecond
    -- precision, as above. THROW with no ROLLBACK, so an entity save reports this message, not 3915.
    IF EXISTS (
        SELECT 1
        FROM inserted i
        LEFT JOIN deleted d ON d.ID = i.ID
        WHERE (d.ID IS NULL AND i.SealMismatchDetectedAt IS NOT NULL)
           OR (
               d.SealMismatchDetectedAt IS NOT NULL
               AND (i.SealMismatchDetectedAt IS NULL OR ABS(DATEDIFF_BIG(MICROSECOND, i.SealMismatchDetectedAt, d.SealMismatchDetectedAt)) >= 1000)
           )
           OR (
               d.ID IS NOT NULL
               AND d.SealMismatchDetectedAt IS NULL
               AND i.SealMismatchDetectedAt IS NOT NULL
               AND NOT (d.Status = 'Sent' AND i.Status = 'Posted' AND i.SendAttemptCount > 1)
           )
    )
        THROW 50034, 'JournalEntryBatch SealMismatchDetectedAt refused. It is set only by the update that records a retried batch Posted (Sent -> Posted, SendAttemptCount above 1), and once set it is never changed or cleared.', 1;
END;
GO


















































-- =============================================================================
-- CODEGEN OUTPUT — GENERATED CODE BELOW THIS LINE. DO NOT EDIT BY HAND.
-- =============================================================================


/* SQL text to update existing entities from schema */
EXEC [${mjSchema}].[spUpdateExistingEntitiesFromSchema] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to insert 1 new entity field(s) */

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '1a8d15cf-9bd7-4334-8e2b-9406143e3c49' OR (EntityID = '87AD37E9-62F9-4F0E-A15B-F64ADF009112' AND Name = 'SealMismatchDetectedAt')) BEGIN
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
            '1a8d15cf-9bd7-4334-8e2b-9406143e3c49',
            '87AD37E9-62F9-4F0E-A15B-F64ADF009112', -- Entity: MJ_BizApps_Accounting: Journal Entry Batches
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '87AD37E9-62F9-4F0E-A15B-F64ADF009112'),
            'SealMismatchDetectedAt',
            'Seal Mismatch Detected At',
            'When a retry of this Failed batch found its journal already in the ERP and recorded it Posted, with no second post, although the batch no longer matched its approved-content seal (a summary line''s dimension tags changed after approval). The local tags then differ from what the ERP holds; review them. NULL when the seal matched or the batch was never adopted this way.',
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

/* SQL text to update existing entity fields from schema */
EXEC [${mjSchema}].[spUpdateExistingEntityFieldsFromSchema] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to set default column width where needed */
EXEC [${mjSchema}].[spSetDefaultColumnWidthWhereNeeded] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';

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
    @SendAttemptCount int = NULL,
    @SealMismatchDetectedAt_Clear bit = 0,
    @SealMismatchDetectedAt datetimeoffset = NULL
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
                [SendAttemptCount],
                [SealMismatchDetectedAt]
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
                ISNULL(@SendAttemptCount, 0),
                CASE WHEN @SealMismatchDetectedAt_Clear = 1 THEN NULL ELSE ISNULL(@SealMismatchDetectedAt, NULL) END
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
                [SendAttemptCount],
                [SealMismatchDetectedAt]
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
                ISNULL(@SendAttemptCount, 0),
                CASE WHEN @SealMismatchDetectedAt_Clear = 1 THEN NULL ELSE ISNULL(@SealMismatchDetectedAt, NULL) END
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
    @SendAttemptCount int = NULL,
    @SealMismatchDetectedAt_Clear bit = 0,
    @SealMismatchDetectedAt datetimeoffset = NULL
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
        [SendAttemptCount] = ISNULL(@SendAttemptCount, [SendAttemptCount]),
        [SealMismatchDetectedAt] = CASE WHEN @SealMismatchDetectedAt_Clear = 1 THEN NULL ELSE ISNULL(@SealMismatchDetectedAt, [SealMismatchDetectedAt]) END
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

/* SQL text to update existing entity fields from schema (1 scoped entities) */
EXEC [${mjSchema}].[spUpdateExistingEntityFieldsFromSchema] @ExcludedSchemaNames='', @EntityIDs='87AD37E9-62F9-4F0E-A15B-F64ADF009112', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to set default column width where needed */
EXEC [${mjSchema}].[spSetDefaultColumnWidthWhereNeeded] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';

