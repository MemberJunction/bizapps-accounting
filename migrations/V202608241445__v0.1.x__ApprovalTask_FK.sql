-- =============================================================================
-- Migration: V202608241445__v0.1.x__ApprovalTask_FK.sql
-- Description: Add foreign key constraint FK_JournalEntryBatch_ApprovalTask
-- =============================================================================

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys 
    WHERE name = 'FK_JournalEntryBatch_ApprovalTask' 
      AND parent_object_id = OBJECT_ID('__mj_BizAppsAccounting.JournalEntryBatch')
)
BEGIN
    ALTER TABLE __mj_BizAppsAccounting.JournalEntryBatch
        ADD CONSTRAINT FK_JournalEntryBatch_ApprovalTask
        FOREIGN KEY (ApprovalTaskID) REFERENCES __mj_BizAppsTasks.Task(ID);
END
GO
