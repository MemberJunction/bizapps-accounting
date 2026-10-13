-- =============================================================================
-- Migration: V202610130000__v0.23.x__JournalEntryBatch_ApprovalTask_SetOnce.sql
-- Description: #313 — a batch's approval Task pointer is set once, by the build,
--              and no two batches carry the same approval Task.
-- =============================================================================
--
-- WHY
--
-- The send gate decides whether a batch is approved from the Task named by
-- JournalEntryBatch.ApprovalTaskID, which the build stamps in its own
-- transaction. trg_JournalEntryBatch_Immutability (50009) freezes the pointer
-- only once the batch is Approved or later, so a Pending batch could be
-- re-pointed, even by the same update that approves it. Pointed at another
-- batch's approved Task, it would pass the send gate with no decision of its
-- own.
--
-- WHAT CHANGES
--
-- 1. trg_JournalEntryBatch_ApprovalTaskSetOnce (50035) refuses any change to
--    ApprovalTaskID or ApprovalTaskRaisedAt once ApprovalTaskID is set, in every
--    status. Setting them on a batch that has none (the build's stamp) is still
--    allowed. It is a trigger of its own rather than a rule added to
--    trg_JournalEntryBatch_Immutability, so a later rewrite of that trigger
--    cannot drop it. ApprovalTaskRaisedAt compares at millisecond precision, as
--    the other frozen timestamps do: every entity save writes it back through a
--    JavaScript Date.
--
-- 2. UQ_JournalEntryBatch_ApprovalTaskID: a filtered unique index, so a batch
--    cannot be stamped with a Task another batch already carries. With item 1,
--    a batch's stamp is always the Task its own build raised. Task Links are not
--    used to prove that: they are writable through the tasks app.
--
-- The index fails to build if two existing batches share an ApprovalTaskID.
-- Only a stamp changed by hand can produce that; find it before upgrading with
--   SELECT ApprovalTaskID, COUNT(*) FROM __mj_BizAppsAccounting.JournalEntryBatch
--    WHERE ApprovalTaskID IS NOT NULL GROUP BY ApprovalTaskID HAVING COUNT(*) > 1;
--
-- THROW with no ROLLBACK TRANSACTION first, as the other batch triggers: the
-- entity's spUpdate runs inside INSERT-EXEC, where a ROLLBACK in the trigger is
-- itself an error (3915) and the caller would get that in place of the message.
-- A trigger runs with XACT_ABORT on, so THROW alone rolls the statement back.
--
-- This runs once, in order, against a database that has every earlier migration.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. The approval Task pointer is set once
-- -----------------------------------------------------------------------------
CREATE TRIGGER __mj_BizAppsAccounting.trg_JournalEntryBatch_ApprovalTaskSetOnce
ON __mj_BizAppsAccounting.JournalEntryBatch
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (
        SELECT 1
        FROM deleted d
        JOIN inserted i ON i.ID = d.ID
        WHERE d.ApprovalTaskID IS NOT NULL
          AND (
            i.ApprovalTaskID IS NULL
            OR i.ApprovalTaskID <> d.ApprovalTaskID
            OR i.ApprovalTaskRaisedAt IS NULL
            OR ABS(DATEDIFF_BIG(MICROSECOND, i.ApprovalTaskRaisedAt, d.ApprovalTaskRaisedAt)) >= 1000
          )
    )
        THROW 50035, 'JournalEntryBatch approval Task refused. ApprovalTaskID and ApprovalTaskRaisedAt are set once, by the build that raises the approval Task, and never change or clear after that, in any status.', 1;
END;
GO

-- -----------------------------------------------------------------------------
-- 2. One batch per approval Task
-- -----------------------------------------------------------------------------
CREATE UNIQUE NONCLUSTERED INDEX UQ_JournalEntryBatch_ApprovalTaskID
    ON __mj_BizAppsAccounting.JournalEntryBatch (ApprovalTaskID)
    WHERE ApprovalTaskID IS NOT NULL;
GO


















































-- =============================================================================
-- CODEGEN OUTPUT — GENERATED CODE BELOW THIS LINE. DO NOT EDIT BY HAND.
-- =============================================================================


/* SQL text to update existing entities from schema */
EXEC [${mjSchema}].[spUpdateExistingEntitiesFromSchema] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to update existing entity fields from schema */
EXEC [${mjSchema}].[spUpdateExistingEntityFieldsFromSchema] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to set default column width where needed */
EXEC [${mjSchema}].[spSetDefaultColumnWidthWhereNeeded] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to sync schema info from database schemas */
EXEC [${mjSchema}].[spUpdateSchemaInfoFromDatabase] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';
