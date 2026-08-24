-- =============================================================================
-- Migration: V202608241445__v0.1.x__ApprovalTask_FK.sql
-- Description: Add foreign key constraint FK_JournalEntryBatch_ApprovalTask and
--              ensure EntityRelationship metadata is registered.
-- =============================================================================

-- 1. Physical foreign key constraint
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

-- 2. Entity relationship metadata: Tasks -> Journal Entry Batches (ApprovalTaskID)
IF NOT EXISTS (
    SELECT 1 FROM [${mjSchema}].[EntityRelationship]
    WHERE [EntityID] = (SELECT [ID] FROM [${mjSchema}].[Entity] WHERE [Name] = 'MJ_BizApps_Tasks: Tasks')
      AND [RelatedEntityID] = (SELECT [ID] FROM [${mjSchema}].[Entity] WHERE [Name] = 'MJ_BizApps_Accounting: Journal Entry Batches')
      AND [RelatedEntityJoinField] = 'ApprovalTaskID'
)
BEGIN
    DECLARE @TaskEntityID UNIQUEIDENTIFIER = (SELECT [ID] FROM [${mjSchema}].[Entity] WHERE [Name] = 'MJ_BizApps_Tasks: Tasks');
    DECLARE @JEBEntityID UNIQUEIDENTIFIER = (SELECT [ID] FROM [${mjSchema}].[Entity] WHERE [Name] = 'MJ_BizApps_Accounting: Journal Entry Batches');
    
    IF @TaskEntityID IS NOT NULL AND @JEBEntityID IS NOT NULL
    BEGIN
        INSERT INTO [${mjSchema}].[EntityRelationship] (
            [ID],
            [EntityID],
            [RelatedEntityID],
            [RelatedEntityJoinField],
            [Type],
            [BundleInAPI],
            [IncludeInParentAllQuery],
            [DisplayInForm],
            [AutoUpdateFromSchema]
        ) VALUES (
            NEWID(),
            @TaskEntityID,
            @JEBEntityID,
            'ApprovalTaskID',
            'One To Many',
            1,
            0,
            1,
            1
        );
    END
END
GO
