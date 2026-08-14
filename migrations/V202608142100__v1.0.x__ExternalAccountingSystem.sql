-- =============================================================================
-- V202608142100 — ExternalAccountingSystem: metadata-driven ERP dispatch catalog
-- =============================================================================
-- Plan: plans/external-accounting-system-dispatch.md (approved 2026-08-14).
--
-- WHAT THIS DOES
--   1. Creates __mj_BizAppsAccounting.ExternalAccountingSystem — one row per ERP
--      destination, carrying the DriverClass (MJ house pattern: the metadata row
--      maps the domain concept to the adapter class; ClassFactory instantiates by
--      the class's own name). IntegrationName bridges to __mj.Integration by NAME
--      (the Integration row is minted by the connector app's own migration, so an
--      ID coupling across apps would be brittle).
--   2. Seeds BusinessCentral + Mock (hardcoded UUIDs, house rule).
--   3. Converts JournalEntryBatch.TargetSystem (NVARCHAR + CK enum) into an
--      ExternalAccountingSystemID FK: add column → backfill by name → THROW if any
--      row is unmapped (never guess) → NOT NULL + FK → drop the CK + old column.
--   4. Restates trg_JournalEntryBatch_Immutability via CREATE OR ALTER with the
--      FK column in the frozen-compare set (the baseline is append-only history;
--      a baseline edit would be invisible to every existing database).
--
-- ORDERING MATTERS
--   The backfill UPDATE passes the OLD trigger because the new column is not in
--   its frozen-compare list. The trigger swap happens BEFORE the old column drops
--   (the old trigger references TargetSystem and would break otherwise).
--
-- IDEMPOTENCY
--   Safe on a database at any prior state of this file. Steps that reference the
--   TargetSystem column run as dynamic SQL guarded by COL_LENGTH — T-SQL compiles
--   static column references even inside dead IF branches, so a re-run after the
--   column drop would otherwise fail at compile time.
--
-- Generated SQL (vwJournalEntryBatches, spCreate/spUpdate, EntityField metadata)
-- is NOT hand-edited here: CodeGen regenerates it against the new schema and the
-- capture step appends it below.
-- =============================================================================

-- 1 ── the catalog table ──────────────────────────────────────────────────────
IF OBJECT_ID('__mj_BizAppsAccounting.ExternalAccountingSystem', 'U') IS NULL
BEGIN
    CREATE TABLE __mj_BizAppsAccounting.ExternalAccountingSystem (
        ID UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
        Name NVARCHAR(50) NOT NULL,
        DisplayName NVARCHAR(100) NOT NULL,
        Description NVARCHAR(MAX) NULL,
        DriverClass NVARCHAR(255) NOT NULL,
        IntegrationName NVARCHAR(100) NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        CONSTRAINT PK_ExternalAccountingSystem PRIMARY KEY (ID),
        CONSTRAINT UQ_ExternalAccountingSystem_Name UNIQUE (Name)
    );
END;
GO

-- extended properties (guarded — re-runnable)
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('__mj_BizAppsAccounting.ExternalAccountingSystem') AND minor_id = 0 AND name = 'MS_Description')
    EXEC sp_addextendedproperty @name = N'MS_Description',
        @value = N'Catalog of external ERP/GL destinations a JournalEntryBatch can dispatch to. Maps each system to its adapter DriverClass (resolved via ClassFactory) and, when connector-backed, to the __mj.Integration record by name. Seeded with BusinessCentral and Mock; add a row + a registered adapter class to support a new ERP — no engine changes.',
        @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'ExternalAccountingSystem';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.columns c ON ep.major_id = c.object_id AND ep.minor_id = c.column_id WHERE ep.major_id = OBJECT_ID('__mj_BizAppsAccounting.ExternalAccountingSystem') AND c.name = 'DriverClass' AND ep.name = 'MS_Description')
    EXEC sp_addextendedproperty @name = N'MS_Description',
        @value = N'Class name of the BaseExternalAccountingSystemAdapter subclass that handles this system (ClassFactory key — the class''s own name, e.g. BusinessCentralAccountingSystemAdapter).',
        @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'ExternalAccountingSystem', @level2type = N'COLUMN', @level2name = N'DriverClass';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.columns c ON ep.major_id = c.object_id AND ep.minor_id = c.column_id WHERE ep.major_id = OBJECT_ID('__mj_BizAppsAccounting.ExternalAccountingSystem') AND c.name = 'IntegrationName' AND ep.name = 'MS_Description')
    EXEC sp_addextendedproperty @name = N'MS_Description',
        @value = N'Name of the __mj.Integration record backing this system (e.g. business-central), resolved at runtime — NULL for systems with no connector (Mock). By name, not ID: the Integration row is minted by the connector app''s own migration.',
        @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'ExternalAccountingSystem', @level2type = N'COLUMN', @level2name = N'IntegrationName';
GO

-- 2 ── seeds (hardcoded UUIDs) ────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM __mj_BizAppsAccounting.ExternalAccountingSystem WHERE ID = '8E415536-595B-46A7-9F42-8778626DAAB6')
    INSERT INTO __mj_BizAppsAccounting.ExternalAccountingSystem (ID, Name, DisplayName, Description, DriverClass, IntegrationName, IsActive)
    VALUES ('8E415536-595B-46A7-9F42-8778626DAAB6', 'BusinessCentral', 'Microsoft Dynamics 365 Business Central',
            'Posts journal entry batches to Business Central general journals via the connector-business-central Open App (staged journalLines, then the Microsoft.NAV.post bound action as the atomic commit).',
            'BusinessCentralAccountingSystemAdapter', 'business-central', 1);
GO
IF NOT EXISTS (SELECT 1 FROM __mj_BizAppsAccounting.ExternalAccountingSystem WHERE ID = '8C94EFAE-BC38-4F44-BB5E-620B33F9BE96')
    INSERT INTO __mj_BizAppsAccounting.ExternalAccountingSystem (ID, Name, DisplayName, Description, DriverClass, IntegrationName, IsActive)
    VALUES ('8C94EFAE-BC38-4F44-BB5E-620B33F9BE96', 'Mock', 'Mock (testing)',
            'Test destination: always succeeds with a MOCK- reference and touches no external system. Selecting it is an explicit choice — real systems fail loudly when unconfigured; nothing ever falls back to Mock.',
            'MockAccountingSystemAdapter', NULL, 1);
GO

-- 3 ── FK swap on JournalEntryBatch ───────────────────────────────────────────
IF COL_LENGTH('__mj_BizAppsAccounting.JournalEntryBatch', 'ExternalAccountingSystemID') IS NULL
    ALTER TABLE __mj_BizAppsAccounting.JournalEntryBatch ADD ExternalAccountingSystemID UNIQUEIDENTIFIER NULL;
GO

-- backfill by name + loud failure on unmapped rows (dynamic: TargetSystem may already be gone)
IF COL_LENGTH('__mj_BizAppsAccounting.JournalEntryBatch', 'TargetSystem') IS NOT NULL
BEGIN
    EXEC sp_executesql N'
        UPDATE b SET ExternalAccountingSystemID = eas.ID
        FROM __mj_BizAppsAccounting.JournalEntryBatch b
        JOIN __mj_BizAppsAccounting.ExternalAccountingSystem eas ON eas.Name = b.TargetSystem
        WHERE b.ExternalAccountingSystemID IS NULL;

        IF EXISTS (SELECT 1 FROM __mj_BizAppsAccounting.JournalEntryBatch WHERE ExternalAccountingSystemID IS NULL)
        BEGIN
            DECLARE @missing NVARCHAR(200) = (SELECT TOP 1 TargetSystem FROM __mj_BizAppsAccounting.JournalEntryBatch WHERE ExternalAccountingSystemID IS NULL);
            THROW 50030, N''ExternalAccountingSystem migration: JournalEntryBatch rows exist whose TargetSystem has no ExternalAccountingSystem row (first: %s). Seed the missing system, then re-run.'', 1;
        END;';
END;
GO

IF COL_LENGTH('__mj_BizAppsAccounting.JournalEntryBatch', 'ExternalAccountingSystemID') IS NOT NULL
   AND COLUMNPROPERTY(OBJECT_ID('__mj_BizAppsAccounting.JournalEntryBatch'), 'ExternalAccountingSystemID', 'AllowsNull') = 1
    ALTER TABLE __mj_BizAppsAccounting.JournalEntryBatch ALTER COLUMN ExternalAccountingSystemID UNIQUEIDENTIFIER NOT NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_JournalEntryBatch_ExternalAccountingSystem')
    ALTER TABLE __mj_BizAppsAccounting.JournalEntryBatch
        ADD CONSTRAINT FK_JournalEntryBatch_ExternalAccountingSystem
        FOREIGN KEY (ExternalAccountingSystemID) REFERENCES __mj_BizAppsAccounting.ExternalAccountingSystem (ID);
GO

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.columns c ON ep.major_id = c.object_id AND ep.minor_id = c.column_id WHERE ep.major_id = OBJECT_ID('__mj_BizAppsAccounting.JournalEntryBatch') AND c.name = 'ExternalAccountingSystemID' AND ep.name = 'MS_Description')
    EXEC sp_addextendedproperty @name = N'MS_Description',
        @value = N'The external accounting system (ERP/GL) this batch dispatches to. Replaces the retired TargetSystem enum column (V202608142100); frozen once the batch is Approved (immutability trigger).',
        @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryBatch', @level2type = N'COLUMN', @level2name = N'ExternalAccountingSystemID';
GO

-- 4 ── restate the immutability trigger with the FK in the frozen set ─────────
CREATE OR ALTER TRIGGER __mj_BizAppsAccounting.trg_JournalEntryBatch_Immutability
ON __mj_BizAppsAccounting.JournalEntryBatch
AFTER UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM inserted) AND EXISTS (SELECT 1 FROM deleted WHERE Status IN ('Approved','Sent','Posted'))
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 50008, 'JournalEntryBatch cannot be deleted once Status is Approved, Sent, or Posted. Cancel it instead.', 1;
    END;

    IF EXISTS (
        SELECT 1
        FROM deleted d
        JOIN inserted i ON i.ID = d.ID
        WHERE d.Status IN ('Approved','Sent','Posted')
          AND (
            i.JournalEntryBatchNumber          <> d.JournalEntryBatchNumber          OR
            i.CompanyID            <> d.CompanyID            OR
            i.PostingDate          <> d.PostingDate          OR
            ISNULL(i.SummaryJournalEntryID, '00000000-0000-0000-0000-000000000000') <> ISNULL(d.SummaryJournalEntryID, '00000000-0000-0000-0000-000000000000') OR
            ISNULL(i.ApprovalTaskID,        '00000000-0000-0000-0000-000000000000') <> ISNULL(d.ApprovalTaskID,        '00000000-0000-0000-0000-000000000000') OR
            i.ExternalAccountingSystemID       <> d.ExternalAccountingSystemID       OR
            i.BatchedAt            <> d.BatchedAt            OR
            i.BatchedByUserID      <> d.BatchedByUserID      OR
            i.TotalEntries         <> d.TotalEntries         OR
            i.TotalDebits          <> d.TotalDebits          OR
            i.TotalCredits         <> d.TotalCredits
          )
    )
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 50009, 'JournalEntryBatch is locked (Status=Approved/Sent/Posted). Only Status / ApprovedAt / ApprovedByUserID / SentAt / PostedAt / ExternalJournalEntryBatchRef / ErrorMessage may evolve (CompanyID, PostingDate, SummaryJournalEntryID, ExternalAccountingSystemID, and the approval-task pointer freeze at approval).', 1;
    END;
END;
GO

-- 5 ── retire the enum column (trigger above no longer references it) ─────────
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_JournalEntryBatch_TargetSystem')
    ALTER TABLE __mj_BizAppsAccounting.JournalEntryBatch DROP CONSTRAINT CK_JournalEntryBatch_TargetSystem;
GO
IF COL_LENGTH('__mj_BizAppsAccounting.JournalEntryBatch', 'TargetSystem') IS NOT NULL
    ALTER TABLE __mj_BizAppsAccounting.JournalEntryBatch DROP COLUMN TargetSystem;
GO

-- 6 ── clean the dropped column's stale CodeGen metadata ─────────────────────
-- The baseline's captured metadata inserts an EntityField row (+ its CK enum
-- EntityFieldValue rows) for TargetSystem. With the column gone, that row is
-- debris — and it makes the FIRST live codegen run fail on
-- UQ_EntityField_EntityID_Sequence (insert of the new FK field collides with
-- the stale row's sequence before codegen's own cleanup deletes it; reproduced
-- from-zero 2026-08-14, twice). Deleting it here makes a fresh deploy's
-- migrate → codegen single-pass clean. Idempotent by construction.
DELETE v FROM [${mjSchema}].[EntityFieldValue] v
WHERE v.EntityFieldID IN (
    SELECT ef.ID FROM [${mjSchema}].[EntityField] ef
    WHERE ef.EntityID = '87AD37E9-62F9-4F0E-A15B-F64ADF009112' AND ef.Name = 'TargetSystem');
GO
DELETE FROM [${mjSchema}].[EntityField]
WHERE EntityID = '87AD37E9-62F9-4F0E-A15B-F64ADF009112' AND Name = 'TargetSystem';
GO























































-- CodeGen Output
/* SQL generated to create new entity MJ_BizApps_Accounting: External Accounting Systems */

      INSERT INTO [__mj].[Entity] (
         [ID],
         [Name],
         [DisplayName],
         [Description],
         [NameSuffix],
         [BaseTable],
         [BaseView],
         [SchemaName],
         [IncludeInAPI],
         [AllowUserSearchAPI],
         [AllowCaching]
         , [TrackRecordChanges]
         , [AuditRecordAccess]
         , [AuditViewRuns]
         , [AllowAllRowsAPI]
         , [AllowCreateAPI]
         , [AllowUpdateAPI]
         , [AllowDeleteAPI]
         , [UserViewMaxRows]
         , [__mj_CreatedAt]
         , [__mj_UpdatedAt]
      )
      VALUES (
         '799f39a9-4fe6-416d-9f0b-66ab655e7880',
         'MJ_BizApps_Accounting: External Accounting Systems',
         'External Accounting Systems',
         'Catalog of external ERP/GL destinations a JournalEntryBatch can dispatch to. Maps each system to its adapter DriverClass (resolved via ClassFactory) and, when connector-backed, to the __mj.Integration record by name. Seeded with BusinessCentral and Mock; add a row + a registered adapter class to support a new ERP — no engine changes.',
         NULL,
         'ExternalAccountingSystem',
         'vwExternalAccountingSystems',
         '__mj_BizAppsAccounting',
         1,
         1,
         0
         , 1
         , 0
         , 0
         , 0
         , 1
         , 1
         , 1
         , 1000
         , GETUTCDATE()
         , GETUTCDATE()
      );

/* SQL generated to add new entity MJ_BizApps_Accounting: External Accounting Systems to application ID: 'E609083D-D3E2-44AD-9DF3-CB833BEF381D' */
INSERT INTO [__mj].[ApplicationEntity]
                                       ([ApplicationID], [EntityID], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES
                                       ('E609083D-D3E2-44AD-9DF3-CB833BEF381D', '799f39a9-4fe6-416d-9f0b-66ab655e7880', (SELECT COALESCE(MAX([Sequence]),0)+1 FROM [__mj].[ApplicationEntity] WHERE [ApplicationID] = 'E609083D-D3E2-44AD-9DF3-CB833BEF381D'), GETUTCDATE(), GETUTCDATE());

/* SQL generated to add new permission for entity MJ_BizApps_Accounting: External Accounting Systems for role UI */
INSERT INTO [__mj].[EntityPermission]
                                                   ([EntityID], [RoleID], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES
                                                   ('799f39a9-4fe6-416d-9f0b-66ab655e7880', 'E0AFCCEC-6A37-EF11-86D4-000D3A4E707E', 1, 0, 0, 0, GETUTCDATE(), GETUTCDATE());

/* SQL generated to add new permission for entity MJ_BizApps_Accounting: External Accounting Systems for role Developer */
INSERT INTO [__mj].[EntityPermission]
                                                   ([EntityID], [RoleID], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES
                                                   ('799f39a9-4fe6-416d-9f0b-66ab655e7880', 'DEAFCCEC-6A37-EF11-86D4-000D3A4E707E', 1, 1, 1, 1, GETUTCDATE(), GETUTCDATE());

/* SQL generated to add new permission for entity MJ_BizApps_Accounting: External Accounting Systems for role Integration */
INSERT INTO [__mj].[EntityPermission]
                                                   ([EntityID], [RoleID], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES
                                                   ('799f39a9-4fe6-416d-9f0b-66ab655e7880', 'DFAFCCEC-6A37-EF11-86D4-000D3A4E707E', 1, 1, 1, 1, GETUTCDATE(), GETUTCDATE());

/* SQL text to update existing entities from schema */
EXEC [__mj].[spUpdateExistingEntitiesFromSchema] @ExcludedSchemaNames='sys,staging,dbo,__mj,__mj_BizAppsCommon,__mj_BizAppsTasks,__mj_BizAppsCommon,__mj_BizAppsTasks,__mj_BizAppsOrders,__mj';

/* SQL text to add special date field __mj_CreatedAt to entity __mj_BizAppsAccounting.ExternalAccountingSystem */
ALTER TABLE [__mj_BizAppsAccounting].[ExternalAccountingSystem] ADD [__mj_CreatedAt] DATETIMEOFFSET NULL;
GO

/* SQL text to add special date field __mj_CreatedAt to entity __mj_BizAppsAccounting.ExternalAccountingSystem */
UPDATE [__mj_BizAppsAccounting].[ExternalAccountingSystem] SET [__mj_CreatedAt] = GETUTCDATE() WHERE [__mj_CreatedAt] IS NULL;
GO

/* SQL text to add special date field __mj_CreatedAt to entity __mj_BizAppsAccounting.ExternalAccountingSystem */
ALTER TABLE [__mj_BizAppsAccounting].[ExternalAccountingSystem] ALTER COLUMN [__mj_CreatedAt] DATETIMEOFFSET NOT NULL;
GO

/* SQL text to add special date field __mj_CreatedAt to entity __mj_BizAppsAccounting.ExternalAccountingSystem */
ALTER TABLE [__mj_BizAppsAccounting].[ExternalAccountingSystem] ADD CONSTRAINT [DF___mj_BizAppsAccounting_ExternalAccountingSystem___mj_CreatedAt] DEFAULT GETUTCDATE() FOR [__mj_CreatedAt];
GO

/* SQL text to add special date field __mj_UpdatedAt to entity __mj_BizAppsAccounting.ExternalAccountingSystem */
ALTER TABLE [__mj_BizAppsAccounting].[ExternalAccountingSystem] ADD [__mj_UpdatedAt] DATETIMEOFFSET NULL;
GO

/* SQL text to add special date field __mj_UpdatedAt to entity __mj_BizAppsAccounting.ExternalAccountingSystem */
UPDATE [__mj_BizAppsAccounting].[ExternalAccountingSystem] SET [__mj_UpdatedAt] = GETUTCDATE() WHERE [__mj_UpdatedAt] IS NULL;
GO

/* SQL text to add special date field __mj_UpdatedAt to entity __mj_BizAppsAccounting.ExternalAccountingSystem */
ALTER TABLE [__mj_BizAppsAccounting].[ExternalAccountingSystem] ALTER COLUMN [__mj_UpdatedAt] DATETIMEOFFSET NOT NULL;
GO

/* SQL text to add special date field __mj_UpdatedAt to entity __mj_BizAppsAccounting.ExternalAccountingSystem */
ALTER TABLE [__mj_BizAppsAccounting].[ExternalAccountingSystem] ADD CONSTRAINT [DF___mj_BizAppsAccounting_ExternalAccountingSystem___mj_UpdatedAt] DEFAULT GETUTCDATE() FOR [__mj_UpdatedAt];
GO

/* SQL text to insert 10 new entity field(s) */

      IF NOT EXISTS (SELECT 1 FROM [__mj].[EntityField] WHERE ID = '30148522-7534-40af-bdd6-1a045ed75534' OR (EntityID = '799F39A9-4FE6-416D-9F0B-66AB655E7880' AND Name = 'ID')) BEGIN
         INSERT INTO [__mj].[EntityField]
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
            '30148522-7534-40af-bdd6-1a045ed75534',
            '799F39A9-4FE6-416D-9F0B-66AB655E7880', -- Entity: MJ_BizApps_Accounting: External Accounting Systems
            100001,
            'ID',
            'ID',
            NULL,
            'uniqueidentifier',
            16,
            0,
            0,
            0,
            'newsequentialid()',
            0,
            0,
            0,
            0,
            NULL,
            NULL,
            0,
            1,
            0,
            0,
            1,
            1,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [__mj].[EntityField] WHERE ID = '4c65a09d-a017-41b8-a2f5-8281f218ddc0' OR (EntityID = '799F39A9-4FE6-416D-9F0B-66AB655E7880' AND Name = 'Name')) BEGIN
         INSERT INTO [__mj].[EntityField]
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
            '4c65a09d-a017-41b8-a2f5-8281f218ddc0',
            '799F39A9-4FE6-416D-9F0B-66AB655E7880', -- Entity: MJ_BizApps_Accounting: External Accounting Systems
            100002,
            'Name',
            'Name',
            NULL,
            'nvarchar',
            100,
            0,
            0,
            0,
            NULL,
            0,
            1,
            0,
            0,
            NULL,
            NULL,
            1,
            1,
            0,
            1,
            0,
            1,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [__mj].[EntityField] WHERE ID = '82eb8a60-ea5e-4717-a400-47727e3bc4ad' OR (EntityID = '799F39A9-4FE6-416D-9F0B-66AB655E7880' AND Name = 'DisplayName')) BEGIN
         INSERT INTO [__mj].[EntityField]
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
            '82eb8a60-ea5e-4717-a400-47727e3bc4ad',
            '799F39A9-4FE6-416D-9F0B-66AB655E7880', -- Entity: MJ_BizApps_Accounting: External Accounting Systems
            100003,
            'DisplayName',
            'Display Name',
            NULL,
            'nvarchar',
            200,
            0,
            0,
            0,
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

      IF NOT EXISTS (SELECT 1 FROM [__mj].[EntityField] WHERE ID = '6b26f1a1-f353-4842-ac7b-5886adad3736' OR (EntityID = '799F39A9-4FE6-416D-9F0B-66AB655E7880' AND Name = 'Description')) BEGIN
         INSERT INTO [__mj].[EntityField]
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
            '6b26f1a1-f353-4842-ac7b-5886adad3736',
            '799F39A9-4FE6-416D-9F0B-66AB655E7880', -- Entity: MJ_BizApps_Accounting: External Accounting Systems
            100004,
            'Description',
            'Description',
            NULL,
            'nvarchar',
            -1,
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

      IF NOT EXISTS (SELECT 1 FROM [__mj].[EntityField] WHERE ID = 'e00a7f2c-1fad-42a8-9ae6-8d7d90d3751a' OR (EntityID = '799F39A9-4FE6-416D-9F0B-66AB655E7880' AND Name = 'DriverClass')) BEGIN
         INSERT INTO [__mj].[EntityField]
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
            'e00a7f2c-1fad-42a8-9ae6-8d7d90d3751a',
            '799F39A9-4FE6-416D-9F0B-66AB655E7880', -- Entity: MJ_BizApps_Accounting: External Accounting Systems
            100005,
            'DriverClass',
            'Driver Class',
            'Class name of the BaseExternalAccountingSystemAdapter subclass that handles this system (ClassFactory key — the class''s own name, e.g. BusinessCentralAccountingSystemAdapter).',
            'nvarchar',
            510,
            0,
            0,
            0,
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

      IF NOT EXISTS (SELECT 1 FROM [__mj].[EntityField] WHERE ID = 'b9e0365c-0214-42f4-81b2-47caaf891dcb' OR (EntityID = '799F39A9-4FE6-416D-9F0B-66AB655E7880' AND Name = 'IntegrationName')) BEGIN
         INSERT INTO [__mj].[EntityField]
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
            'b9e0365c-0214-42f4-81b2-47caaf891dcb',
            '799F39A9-4FE6-416D-9F0B-66AB655E7880', -- Entity: MJ_BizApps_Accounting: External Accounting Systems
            100006,
            'IntegrationName',
            'Integration Name',
            'Name of the __mj.Integration record backing this system (e.g. business-central), resolved at runtime — NULL for systems with no connector (Mock). By name, not ID: the Integration row is minted by the connector app''s own migration.',
            'nvarchar',
            200,
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

      IF NOT EXISTS (SELECT 1 FROM [__mj].[EntityField] WHERE ID = '3c13a6fc-d502-48e4-a617-edeee884a141' OR (EntityID = '799F39A9-4FE6-416D-9F0B-66AB655E7880' AND Name = 'IsActive')) BEGIN
         INSERT INTO [__mj].[EntityField]
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
            '3c13a6fc-d502-48e4-a617-edeee884a141',
            '799F39A9-4FE6-416D-9F0B-66AB655E7880', -- Entity: MJ_BizApps_Accounting: External Accounting Systems
            100007,
            'IsActive',
            'Is Active',
            NULL,
            'bit',
            1,
            1,
            0,
            0,
            '(1)',
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

      IF NOT EXISTS (SELECT 1 FROM [__mj].[EntityField] WHERE ID = 'bbe5c2ee-14f7-4f1a-810e-aacbd6dab2c6' OR (EntityID = '799F39A9-4FE6-416D-9F0B-66AB655E7880' AND Name = '__mj_CreatedAt')) BEGIN
         INSERT INTO [__mj].[EntityField]
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
            'bbe5c2ee-14f7-4f1a-810e-aacbd6dab2c6',
            '799F39A9-4FE6-416D-9F0B-66AB655E7880', -- Entity: MJ_BizApps_Accounting: External Accounting Systems
            100008,
            '__mj_CreatedAt',
            'Created At',
            NULL,
            'datetimeoffset',
            10,
            34,
            7,
            0,
            'getutcdate()',
            0,
            0,
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

      IF NOT EXISTS (SELECT 1 FROM [__mj].[EntityField] WHERE ID = '4523db33-30d3-4891-960f-5c92ca663881' OR (EntityID = '799F39A9-4FE6-416D-9F0B-66AB655E7880' AND Name = '__mj_UpdatedAt')) BEGIN
         INSERT INTO [__mj].[EntityField]
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
            '4523db33-30d3-4891-960f-5c92ca663881',
            '799F39A9-4FE6-416D-9F0B-66AB655E7880', -- Entity: MJ_BizApps_Accounting: External Accounting Systems
            100009,
            '__mj_UpdatedAt',
            'Updated At',
            NULL,
            'datetimeoffset',
            10,
            34,
            7,
            0,
            'getutcdate()',
            0,
            0,
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

      IF NOT EXISTS (SELECT 1 FROM [__mj].[EntityField] WHERE ID = '1d53cefa-4379-4b0a-91d5-93c4e9dc7a4d' OR (EntityID = '87AD37E9-62F9-4F0E-A15B-F64ADF009112' AND Name = 'ExternalAccountingSystemID')) BEGIN
         INSERT INTO [__mj].[EntityField]
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
            '1d53cefa-4379-4b0a-91d5-93c4e9dc7a4d',
            '87AD37E9-62F9-4F0E-A15B-F64ADF009112', -- Entity: MJ_BizApps_Accounting: Journal Entry Batches
            100049,
            'ExternalAccountingSystemID',
            'External Accounting System ID',
            'The external accounting system (ERP/GL) this batch dispatches to. Replaces the retired TargetSystem enum column (V202608142100); frozen once the batch is Approved (immutability trigger).',
            'uniqueidentifier',
            16,
            0,
            0,
            0,
            NULL,
            0,
            1,
            0,
            0,
            '799F39A9-4FE6-416D-9F0B-66AB655E7880',
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

/* SQL text to update existing entity fields from schema */
EXEC [__mj].[spUpdateExistingEntityFieldsFromSchema] @ExcludedSchemaNames='sys,staging,dbo,__mj,__mj_BizAppsCommon,__mj_BizAppsTasks,__mj_BizAppsCommon,__mj_BizAppsTasks,__mj_BizAppsOrders,__mj';

/* SQL text to set default column width where needed */
EXEC [__mj].[spSetDefaultColumnWidthWhereNeeded] @ExcludedSchemaNames='sys,staging,dbo,__mj,__mj_BizAppsCommon,__mj_BizAppsTasks,__mj_BizAppsCommon,__mj_BizAppsTasks,__mj_BizAppsOrders,__mj';


/* Create Entity Relationship: MJ_BizApps_Accounting: External Accounting Systems -> MJ_BizApps_Accounting: Journal Entry Batches (One To Many via ExternalAccountingSystemID) */
   IF NOT EXISTS (
      SELECT 1 FROM [__mj].[EntityRelationship] WHERE [ID] = '5b455089-6441-4826-a9d3-066cc1c5eb3c'
   )
   BEGIN
      INSERT INTO [__mj].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
                    VALUES ('5b455089-6441-4826-a9d3-066cc1c5eb3c', '799F39A9-4FE6-416D-9F0B-66AB655E7880', '87AD37E9-62F9-4F0E-A15B-F64ADF009112', 'ExternalAccountingSystemID', 'One To Many', 1, 1, 1, GETUTCDATE(), GETUTCDATE())
   END;

/* SQL text to sync schema info from database schemas */
EXEC [__mj].[spUpdateSchemaInfoFromDatabase] @ExcludedSchemaNames='sys,staging,dbo,__mj,__mj_BizAppsCommon,__mj_BizAppsTasks,__mj_BizAppsCommon,__mj_BizAppsTasks,__mj_BizAppsOrders,__mj';

/* Index for Foreign Keys for ExternalAccountingSystem */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: External Accounting Systems
-- Item: Index for Foreign Keys
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------;

/* Base View SQL for MJ_BizApps_Accounting: External Accounting Systems */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: External Accounting Systems
-- Item: vwExternalAccountingSystems
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- BASE VIEW FOR ENTITY:      MJ_BizApps_Accounting: External Accounting Systems
-----               SCHEMA:      __mj_BizAppsAccounting
-----               BASE TABLE:  ExternalAccountingSystem
-----               PRIMARY KEY: ID
------------------------------------------------------------
IF OBJECT_ID('[__mj_BizAppsAccounting].[vwExternalAccountingSystems]', 'V') IS NOT NULL
    DROP VIEW [__mj_BizAppsAccounting].[vwExternalAccountingSystems];
GO

CREATE VIEW [__mj_BizAppsAccounting].[vwExternalAccountingSystems]
AS
SELECT
    e.*
FROM
    [__mj_BizAppsAccounting].[ExternalAccountingSystem] AS e
GO
GRANT SELECT ON [__mj_BizAppsAccounting].[vwExternalAccountingSystems] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* Base View Permissions SQL for MJ_BizApps_Accounting: External Accounting Systems */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: External Accounting Systems
-- Item: Permissions for vwExternalAccountingSystems
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

GRANT SELECT ON [__mj_BizAppsAccounting].[vwExternalAccountingSystems] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* spCreate SQL for MJ_BizApps_Accounting: External Accounting Systems */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: External Accounting Systems
-- Item: spCreateExternalAccountingSystem
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- CREATE PROCEDURE FOR ExternalAccountingSystem
------------------------------------------------------------
IF OBJECT_ID('[__mj_BizAppsAccounting].[spCreateExternalAccountingSystem]', 'P') IS NOT NULL
    DROP PROCEDURE [__mj_BizAppsAccounting].[spCreateExternalAccountingSystem];
GO

CREATE PROCEDURE [__mj_BizAppsAccounting].[spCreateExternalAccountingSystem]
    @ID uniqueidentifier = NULL,
    @Name nvarchar(50),
    @DisplayName nvarchar(100),
    @Description_Clear bit = 0,
    @Description nvarchar(MAX) = NULL,
    @DriverClass nvarchar(255),
    @IntegrationName_Clear bit = 0,
    @IntegrationName nvarchar(100) = NULL,
    @IsActive bit = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @InsertedRow TABLE ([ID] UNIQUEIDENTIFIER)

    IF @ID IS NOT NULL
    BEGIN
        -- User provided a value, use it
        INSERT INTO [__mj_BizAppsAccounting].[ExternalAccountingSystem]
            (
                [ID],
                [Name],
                [DisplayName],
                [Description],
                [DriverClass],
                [IntegrationName],
                [IsActive]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @ID,
                @Name,
                @DisplayName,
                CASE WHEN @Description_Clear = 1 THEN NULL ELSE ISNULL(@Description, NULL) END,
                @DriverClass,
                CASE WHEN @IntegrationName_Clear = 1 THEN NULL ELSE ISNULL(@IntegrationName, NULL) END,
                ISNULL(@IsActive, 1)
            )
    END
    ELSE
    BEGIN
        -- No value provided, let database use its default (e.g., NEWSEQUENTIALID())
        INSERT INTO [__mj_BizAppsAccounting].[ExternalAccountingSystem]
            (
                [Name],
                [DisplayName],
                [Description],
                [DriverClass],
                [IntegrationName],
                [IsActive]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @Name,
                @DisplayName,
                CASE WHEN @Description_Clear = 1 THEN NULL ELSE ISNULL(@Description, NULL) END,
                @DriverClass,
                CASE WHEN @IntegrationName_Clear = 1 THEN NULL ELSE ISNULL(@IntegrationName, NULL) END,
                ISNULL(@IsActive, 1)
            )
    END
    -- return the new record from the base view, which might have some calculated fields
    SELECT * FROM [__mj_BizAppsAccounting].[vwExternalAccountingSystems] WHERE [ID] = (SELECT [ID] FROM @InsertedRow)
END
GO
GRANT EXECUTE ON [__mj_BizAppsAccounting].[spCreateExternalAccountingSystem] TO [cdp_Developer], [cdp_Integration];

/* spCreate Permissions for MJ_BizApps_Accounting: External Accounting Systems */

GRANT EXECUTE ON [__mj_BizAppsAccounting].[spCreateExternalAccountingSystem] TO [cdp_Developer], [cdp_Integration];

/* spUpdate SQL for MJ_BizApps_Accounting: External Accounting Systems */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: External Accounting Systems
-- Item: spUpdateExternalAccountingSystem
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- UPDATE PROCEDURE FOR ExternalAccountingSystem
------------------------------------------------------------
IF OBJECT_ID('[__mj_BizAppsAccounting].[spUpdateExternalAccountingSystem]', 'P') IS NOT NULL
    DROP PROCEDURE [__mj_BizAppsAccounting].[spUpdateExternalAccountingSystem];
GO

CREATE PROCEDURE [__mj_BizAppsAccounting].[spUpdateExternalAccountingSystem]
    @ID uniqueidentifier,
    @Name nvarchar(50) = NULL,
    @DisplayName nvarchar(100) = NULL,
    @Description_Clear bit = 0,
    @Description nvarchar(MAX) = NULL,
    @DriverClass nvarchar(255) = NULL,
    @IntegrationName_Clear bit = 0,
    @IntegrationName nvarchar(100) = NULL,
    @IsActive bit = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [__mj_BizAppsAccounting].[ExternalAccountingSystem]
    SET
        [Name] = ISNULL(@Name, [Name]),
        [DisplayName] = ISNULL(@DisplayName, [DisplayName]),
        [Description] = CASE WHEN @Description_Clear = 1 THEN NULL ELSE ISNULL(@Description, [Description]) END,
        [DriverClass] = ISNULL(@DriverClass, [DriverClass]),
        [IntegrationName] = CASE WHEN @IntegrationName_Clear = 1 THEN NULL ELSE ISNULL(@IntegrationName, [IntegrationName]) END,
        [IsActive] = ISNULL(@IsActive, [IsActive])
    WHERE
        [ID] = @ID

    -- Check if the update was successful
    IF @@ROWCOUNT = 0
        -- Nothing was updated, return no rows, but column structure from base view intact, semantically correct this way.
        SELECT TOP 0 * FROM [__mj_BizAppsAccounting].[vwExternalAccountingSystems] WHERE 1=0
    ELSE
        -- Return the updated record so the caller can see the updated values and any calculated fields
        SELECT
                                        *
                                    FROM
                                        [__mj_BizAppsAccounting].[vwExternalAccountingSystems]
                                    WHERE
                                        [ID] = @ID
                                    
END
GO

GRANT EXECUTE ON [__mj_BizAppsAccounting].[spUpdateExternalAccountingSystem] TO [cdp_Developer], [cdp_Integration]
GO

------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the ExternalAccountingSystem table
------------------------------------------------------------
IF OBJECT_ID('[__mj_BizAppsAccounting].[trgUpdateExternalAccountingSystem]', 'TR') IS NOT NULL
    DROP TRIGGER [__mj_BizAppsAccounting].[trgUpdateExternalAccountingSystem];
GO
CREATE TRIGGER [__mj_BizAppsAccounting].trgUpdateExternalAccountingSystem
ON [__mj_BizAppsAccounting].[ExternalAccountingSystem]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [__mj_BizAppsAccounting].[ExternalAccountingSystem]
    SET
        __mj_UpdatedAt = GETUTCDATE()
    FROM
        [__mj_BizAppsAccounting].[ExternalAccountingSystem] AS _organicTable
    INNER JOIN
        INSERTED AS I ON
        _organicTable.[ID] = I.[ID];
END;
GO

/* spUpdate Permissions for MJ_BizApps_Accounting: External Accounting Systems */

GRANT EXECUTE ON [__mj_BizAppsAccounting].[spUpdateExternalAccountingSystem] TO [cdp_Developer], [cdp_Integration];

/* spDelete SQL for MJ_BizApps_Accounting: External Accounting Systems */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: External Accounting Systems
-- Item: spDeleteExternalAccountingSystem
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- DELETE PROCEDURE FOR ExternalAccountingSystem
------------------------------------------------------------
IF OBJECT_ID('[__mj_BizAppsAccounting].[spDeleteExternalAccountingSystem]', 'P') IS NOT NULL
    DROP PROCEDURE [__mj_BizAppsAccounting].[spDeleteExternalAccountingSystem];
GO

CREATE PROCEDURE [__mj_BizAppsAccounting].[spDeleteExternalAccountingSystem]
    @ID uniqueidentifier
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM
        [__mj_BizAppsAccounting].[ExternalAccountingSystem]
    WHERE
        [ID] = @ID


    -- Check if the delete was successful
    IF @@ROWCOUNT = 0
        SELECT NULL AS [ID] -- Return NULL for all primary key fields to indicate no record was deleted
    ELSE
        SELECT @ID AS [ID] -- Return the primary key values to indicate we successfully deleted the record
END
GO
GRANT EXECUTE ON [__mj_BizAppsAccounting].[spDeleteExternalAccountingSystem] TO [cdp_Developer], [cdp_Integration];

/* spDelete Permissions for MJ_BizApps_Accounting: External Accounting Systems */

GRANT EXECUTE ON [__mj_BizAppsAccounting].[spDeleteExternalAccountingSystem] TO [cdp_Developer], [cdp_Integration];

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
    AND object_id = OBJECT_ID('[__mj_BizAppsAccounting].[JournalEntryBatch]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_JournalEntryBatch_CompanyID ON [__mj_BizAppsAccounting].[JournalEntryBatch] ([CompanyID]);

-- Index for foreign key SummaryJournalEntryID in table JournalEntryBatch
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_JournalEntryBatch_SummaryJournalEntryID' 
    AND object_id = OBJECT_ID('[__mj_BizAppsAccounting].[JournalEntryBatch]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_JournalEntryBatch_SummaryJournalEntryID ON [__mj_BizAppsAccounting].[JournalEntryBatch] ([SummaryJournalEntryID]);

-- Index for foreign key BatchedByUserID in table JournalEntryBatch
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_JournalEntryBatch_BatchedByUserID' 
    AND object_id = OBJECT_ID('[__mj_BizAppsAccounting].[JournalEntryBatch]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_JournalEntryBatch_BatchedByUserID ON [__mj_BizAppsAccounting].[JournalEntryBatch] ([BatchedByUserID]);

-- Index for foreign key ApprovedByUserID in table JournalEntryBatch
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_JournalEntryBatch_ApprovedByUserID' 
    AND object_id = OBJECT_ID('[__mj_BizAppsAccounting].[JournalEntryBatch]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_JournalEntryBatch_ApprovedByUserID ON [__mj_BizAppsAccounting].[JournalEntryBatch] ([ApprovedByUserID]);

-- Index for foreign key ApprovalTaskID in table JournalEntryBatch
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_JournalEntryBatch_ApprovalTaskID' 
    AND object_id = OBJECT_ID('[__mj_BizAppsAccounting].[JournalEntryBatch]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_JournalEntryBatch_ApprovalTaskID ON [__mj_BizAppsAccounting].[JournalEntryBatch] ([ApprovalTaskID]);

-- Index for foreign key ExternalAccountingSystemID in table JournalEntryBatch
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_JournalEntryBatch_ExternalAccountingSystemID' 
    AND object_id = OBJECT_ID('[__mj_BizAppsAccounting].[JournalEntryBatch]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_JournalEntryBatch_ExternalAccountingSystemID ON [__mj_BizAppsAccounting].[JournalEntryBatch] ([ExternalAccountingSystemID]);

/* SQL text to update entity field related entity name field map for entity field ID 1D53CEFA-4379-4B0A-91D5-93C4E9DC7A4D */
EXEC [__mj].[spUpdateEntityFieldRelatedEntityNameFieldMap] @EntityFieldID='1D53CEFA-4379-4B0A-91D5-93C4E9DC7A4D', @RelatedEntityNameFieldMap='ExternalAccountingSystem';

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
-----               SCHEMA:      __mj_BizAppsAccounting
-----               BASE TABLE:  JournalEntryBatch
-----               PRIMARY KEY: ID
------------------------------------------------------------
IF OBJECT_ID('[__mj_BizAppsAccounting].[vwJournalEntryBatches]', 'V') IS NOT NULL
    DROP VIEW [__mj_BizAppsAccounting].[vwJournalEntryBatches];
GO

CREATE VIEW [__mj_BizAppsAccounting].[vwJournalEntryBatches]
AS
SELECT
    j.*,
    MJCompany_CompanyID.[Name] AS [Company],
    mjBizAppsAccountingJournalEntry_SummaryJournalEntryID.[EntryNumber] AS [SummaryJournalEntry],
    MJUser_BatchedByUserID.[Name] AS [BatchedByUser],
    MJUser_ApprovedByUserID.[Name] AS [ApprovedByUser],
    mjBizAppsTasksTask_ApprovalTaskID.[Name] AS [ApprovalTask],
    mjBizAppsAccountingExternalAccountingSystem_ExternalAccountingSystemID.[Name] AS [ExternalAccountingSystem]
FROM
    [__mj_BizAppsAccounting].[JournalEntryBatch] AS j
INNER JOIN
    [__mj].[Company] AS MJCompany_CompanyID
  ON
    [j].[CompanyID] = MJCompany_CompanyID.[ID]
LEFT OUTER JOIN
    [__mj_BizAppsAccounting].[JournalEntry] AS mjBizAppsAccountingJournalEntry_SummaryJournalEntryID
  ON
    [j].[SummaryJournalEntryID] = mjBizAppsAccountingJournalEntry_SummaryJournalEntryID.[ID]
INNER JOIN
    [__mj].[User] AS MJUser_BatchedByUserID
  ON
    [j].[BatchedByUserID] = MJUser_BatchedByUserID.[ID]
LEFT OUTER JOIN
    [__mj].[User] AS MJUser_ApprovedByUserID
  ON
    [j].[ApprovedByUserID] = MJUser_ApprovedByUserID.[ID]
LEFT OUTER JOIN
    [__mj_BizAppsTasks].[Task] AS mjBizAppsTasksTask_ApprovalTaskID
  ON
    [j].[ApprovalTaskID] = mjBizAppsTasksTask_ApprovalTaskID.[ID]
INNER JOIN
    [__mj_BizAppsAccounting].[ExternalAccountingSystem] AS mjBizAppsAccountingExternalAccountingSystem_ExternalAccountingSystemID
  ON
    [j].[ExternalAccountingSystemID] = mjBizAppsAccountingExternalAccountingSystem_ExternalAccountingSystemID.[ID]
GO
GRANT SELECT ON [__mj_BizAppsAccounting].[vwJournalEntryBatches] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* Base View Permissions SQL for MJ_BizApps_Accounting: Journal Entry Batches */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Journal Entry Batches
-- Item: Permissions for vwJournalEntryBatches
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

GRANT SELECT ON [__mj_BizAppsAccounting].[vwJournalEntryBatches] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

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
IF OBJECT_ID('[__mj_BizAppsAccounting].[spCreateJournalEntryBatch]', 'P') IS NOT NULL
    DROP PROCEDURE [__mj_BizAppsAccounting].[spCreateJournalEntryBatch];
GO

CREATE PROCEDURE [__mj_BizAppsAccounting].[spCreateJournalEntryBatch]
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
    @ExternalAccountingSystemID uniqueidentifier
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @InsertedRow TABLE ([ID] UNIQUEIDENTIFIER)

    IF @ID IS NOT NULL
    BEGIN
        -- User provided a value, use it
        INSERT INTO [__mj_BizAppsAccounting].[JournalEntryBatch]
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
                [ExternalAccountingSystemID]
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
                @ExternalAccountingSystemID
            )
    END
    ELSE
    BEGIN
        -- No value provided, let database use its default (e.g., NEWSEQUENTIALID())
        INSERT INTO [__mj_BizAppsAccounting].[JournalEntryBatch]
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
                [ExternalAccountingSystemID]
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
                @ExternalAccountingSystemID
            )
    END
    -- return the new record from the base view, which might have some calculated fields
    SELECT * FROM [__mj_BizAppsAccounting].[vwJournalEntryBatches] WHERE [ID] = (SELECT [ID] FROM @InsertedRow)
END
GO
GRANT EXECUTE ON [__mj_BizAppsAccounting].[spCreateJournalEntryBatch] TO [cdp_Developer], [cdp_Integration];

/* spCreate Permissions for MJ_BizApps_Accounting: Journal Entry Batches */

GRANT EXECUTE ON [__mj_BizAppsAccounting].[spCreateJournalEntryBatch] TO [cdp_Developer], [cdp_Integration];

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
IF OBJECT_ID('[__mj_BizAppsAccounting].[spUpdateJournalEntryBatch]', 'P') IS NOT NULL
    DROP PROCEDURE [__mj_BizAppsAccounting].[spUpdateJournalEntryBatch];
GO

CREATE PROCEDURE [__mj_BizAppsAccounting].[spUpdateJournalEntryBatch]
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
    @ExternalAccountingSystemID uniqueidentifier = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [__mj_BizAppsAccounting].[JournalEntryBatch]
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
        [ExternalAccountingSystemID] = ISNULL(@ExternalAccountingSystemID, [ExternalAccountingSystemID])
    WHERE
        [ID] = @ID

    -- Check if the update was successful
    IF @@ROWCOUNT = 0
        -- Nothing was updated, return no rows, but column structure from base view intact, semantically correct this way.
        SELECT TOP 0 * FROM [__mj_BizAppsAccounting].[vwJournalEntryBatches] WHERE 1=0
    ELSE
        -- Return the updated record so the caller can see the updated values and any calculated fields
        SELECT
                                        *
                                    FROM
                                        [__mj_BizAppsAccounting].[vwJournalEntryBatches]
                                    WHERE
                                        [ID] = @ID
                                    
END
GO

GRANT EXECUTE ON [__mj_BizAppsAccounting].[spUpdateJournalEntryBatch] TO [cdp_Developer], [cdp_Integration]
GO

------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the JournalEntryBatch table
------------------------------------------------------------
IF OBJECT_ID('[__mj_BizAppsAccounting].[trgUpdateJournalEntryBatch]', 'TR') IS NOT NULL
    DROP TRIGGER [__mj_BizAppsAccounting].[trgUpdateJournalEntryBatch];
GO
CREATE TRIGGER [__mj_BizAppsAccounting].trgUpdateJournalEntryBatch
ON [__mj_BizAppsAccounting].[JournalEntryBatch]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [__mj_BizAppsAccounting].[JournalEntryBatch]
    SET
        __mj_UpdatedAt = GETUTCDATE()
    FROM
        [__mj_BizAppsAccounting].[JournalEntryBatch] AS _organicTable
    INNER JOIN
        INSERTED AS I ON
        _organicTable.[ID] = I.[ID];
END;
GO

/* spUpdate Permissions for MJ_BizApps_Accounting: Journal Entry Batches */

GRANT EXECUTE ON [__mj_BizAppsAccounting].[spUpdateJournalEntryBatch] TO [cdp_Developer], [cdp_Integration];

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
IF OBJECT_ID('[__mj_BizAppsAccounting].[spDeleteJournalEntryBatch]', 'P') IS NOT NULL
    DROP PROCEDURE [__mj_BizAppsAccounting].[spDeleteJournalEntryBatch];
GO

CREATE PROCEDURE [__mj_BizAppsAccounting].[spDeleteJournalEntryBatch]
    @ID uniqueidentifier
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM
        [__mj_BizAppsAccounting].[JournalEntryBatch]
    WHERE
        [ID] = @ID


    -- Check if the delete was successful
    IF @@ROWCOUNT = 0
        SELECT NULL AS [ID] -- Return NULL for all primary key fields to indicate no record was deleted
    ELSE
        SELECT @ID AS [ID] -- Return the primary key values to indicate we successfully deleted the record
END
GO
GRANT EXECUTE ON [__mj_BizAppsAccounting].[spDeleteJournalEntryBatch] TO [cdp_Developer], [cdp_Integration];

/* spDelete Permissions for MJ_BizApps_Accounting: Journal Entry Batches */

GRANT EXECUTE ON [__mj_BizAppsAccounting].[spDeleteJournalEntryBatch] TO [cdp_Developer], [cdp_Integration];

/* SQL text to delete unneeded entity fields */
EXEC [__mj].[spDeleteUnneededEntityFields] @ExcludedSchemaNames='sys,staging,dbo,__mj,__mj_BizAppsCommon,__mj_BizAppsTasks,__mj_BizAppsCommon,__mj_BizAppsTasks,__mj_BizAppsOrders,__mj';

/* SQL text to insert 1 new entity field(s) */

      IF NOT EXISTS (SELECT 1 FROM [__mj].[EntityField] WHERE ID = '47d86525-170e-4c37-aacb-92c777632977' OR (EntityID = '87AD37E9-62F9-4F0E-A15B-F64ADF009112' AND Name = 'ExternalAccountingSystem')) BEGIN
         INSERT INTO [__mj].[EntityField]
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
            '47d86525-170e-4c37-aacb-92c777632977',
            '87AD37E9-62F9-4F0E-A15B-F64ADF009112', -- Entity: MJ_BizApps_Accounting: Journal Entry Batches
            200077,
            'ExternalAccountingSystem',
            'External Accounting System',
            NULL,
            'nvarchar',
            100,
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

/* SQL text to update existing entity fields from schema */
EXEC [__mj].[spUpdateExistingEntityFieldsFromSchema] @ExcludedSchemaNames='sys,staging,dbo,__mj,__mj_BizAppsCommon,__mj_BizAppsTasks,__mj_BizAppsCommon,__mj_BizAppsTasks,__mj_BizAppsOrders,__mj';

/* SQL text to set default column width where needed */
EXEC [__mj].[spSetDefaultColumnWidthWhereNeeded] @ExcludedSchemaNames='sys,staging,dbo,__mj,__mj_BizAppsCommon,__mj_BizAppsTasks,__mj_BizAppsCommon,__mj_BizAppsTasks,__mj_BizAppsOrders,__mj';

/* Set field properties for entity */

               UPDATE [__mj].[EntityField]
               SET DefaultInView = 1
               WHERE ID = '286D3C31-D01A-465C-8C42-DFAB6CFB3C7C'
               AND AutoUpdateDefaultInView = 1;

/* Set field properties for entity */

               UPDATE [__mj].[EntityField]
               SET DefaultInView = 1
               WHERE ID = '82EB8A60-EA5E-4717-A400-47727E3BC4AD'
               AND AutoUpdateDefaultInView = 1;

               UPDATE [__mj].[EntityField]
               SET DefaultInView = 1
               WHERE ID = 'B9E0365C-0214-42F4-81B2-47CAAF891DCB'
               AND AutoUpdateDefaultInView = 1;

               UPDATE [__mj].[EntityField]
               SET DefaultInView = 1
               WHERE ID = '3C13A6FC-D502-48E4-A617-EDEEE884A141'
               AND AutoUpdateDefaultInView = 1;

            UPDATE [__mj].[Entity]
            SET AllowUserSearchAPI = 0
            WHERE ID = '799F39A9-4FE6-416D-9F0B-66AB655E7880'
            AND AutoUpdateAllowUserSearchAPI = 1;

/* Set categories for 9 fields */

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: External Accounting Systems.ID 
UPDATE [__mj].[EntityField]
SET 
   Category = 'System Metadata',
   GeneratedFormSection = 'Category',
   ExtendedType = NULL,
   CodeType = NULL
WHERE 
   ID = '30148522-7534-40AF-BDD6-1A045ED75534' AND AutoUpdateCategory = 1;

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: External Accounting Systems.Name 
UPDATE [__mj].[EntityField]
SET 
   Category = 'System Configuration',
   GeneratedFormSection = 'Category',
   ExtendedType = NULL,
   CodeType = NULL
WHERE 
   ID = '4C65A09D-A017-41B8-A2F5-8281F218DDC0' AND AutoUpdateCategory = 1;

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: External Accounting Systems.DisplayName 
UPDATE [__mj].[EntityField]
SET 
   Category = 'System Configuration',
   GeneratedFormSection = 'Category',
   ExtendedType = NULL,
   CodeType = NULL
WHERE 
   ID = '82EB8A60-EA5E-4717-A400-47727E3BC4AD' AND AutoUpdateCategory = 1;

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: External Accounting Systems.Description 
UPDATE [__mj].[EntityField]
SET 
   Category = 'System Configuration',
   GeneratedFormSection = 'Category',
   ExtendedType = NULL,
   CodeType = NULL
WHERE 
   ID = '6B26F1A1-F353-4842-AC7B-5886ADAD3736' AND AutoUpdateCategory = 1;

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: External Accounting Systems.DriverClass 
UPDATE [__mj].[EntityField]
SET 
   Category = 'Integration Settings',
   GeneratedFormSection = 'Category',
   ExtendedType = NULL,
   CodeType = NULL
WHERE 
   ID = 'E00A7F2C-1FAD-42A8-9AE6-8D7D90D3751A' AND AutoUpdateCategory = 1;

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: External Accounting Systems.IntegrationName 
UPDATE [__mj].[EntityField]
SET 
   Category = 'Integration Settings',
   GeneratedFormSection = 'Category',
   ExtendedType = NULL,
   CodeType = NULL
WHERE 
   ID = 'B9E0365C-0214-42F4-81B2-47CAAF891DCB' AND AutoUpdateCategory = 1;

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: External Accounting Systems.IsActive 
UPDATE [__mj].[EntityField]
SET 
   Category = 'System Configuration',
   GeneratedFormSection = 'Category',
   DisplayName = 'Active',
   ExtendedType = NULL,
   CodeType = NULL
WHERE 
   ID = '3C13A6FC-D502-48E4-A617-EDEEE884A141' AND AutoUpdateCategory = 1;

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: External Accounting Systems.__mj_CreatedAt 
UPDATE [__mj].[EntityField]
SET 
   Category = 'System Metadata',
   GeneratedFormSection = 'Category',
   ExtendedType = NULL,
   CodeType = NULL
WHERE 
   ID = 'BBE5C2EE-14F7-4F1A-810E-AACBD6DAB2C6' AND AutoUpdateCategory = 1;

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: External Accounting Systems.__mj_UpdatedAt 
UPDATE [__mj].[EntityField]
SET 
   Category = 'System Metadata',
   GeneratedFormSection = 'Category',
   ExtendedType = NULL,
   CodeType = NULL
WHERE 
   ID = '4523DB33-30D3-4891-960F-5C92CA663881' AND AutoUpdateCategory = 1;

/* Set entity icon to fa fa-calculator */

               UPDATE [__mj].[Entity]
               SET [Icon] = 'fa fa-calculator', [__mj_UpdatedAt] = GETUTCDATE()
               WHERE [ID] = '799F39A9-4FE6-416D-9F0B-66AB655E7880';

/* Insert FieldCategoryInfo setting for entity */

               INSERT INTO [__mj].[EntitySetting] ([ID], [EntityID], [Name], [Value], [__mj_CreatedAt], [__mj_UpdatedAt])
               VALUES ('a799dd22-1c0b-42b7-9a08-5ba390174809', '799F39A9-4FE6-416D-9F0B-66AB655E7880', 'FieldCategoryInfo', '{"System Configuration":{"icon":"fa fa-cog","description":"General settings and identification for the accounting system"},"Integration Settings":{"icon":"fa fa-plug","description":"Technical configuration for connecting to external accounting systems"},"System Metadata":{"icon":"fa fa-database","description":"System-managed audit and tracking fields"}}', GETUTCDATE(), GETUTCDATE());

/* Insert FieldCategoryIcons setting (legacy) */

               INSERT INTO [__mj].[EntitySetting] ([ID], [EntityID], [Name], [Value], [__mj_CreatedAt], [__mj_UpdatedAt])
               VALUES ('ae9d201a-bcd4-43c4-881a-272d97ee7986', '799F39A9-4FE6-416D-9F0B-66AB655E7880', 'FieldCategoryIcons', '{"System Configuration":"fa fa-cog","Integration Settings":"fa fa-plug","System Metadata":"fa fa-database"}', GETUTCDATE(), GETUTCDATE());

/* Set DefaultForNewUser=false for NEW entity (category: reference, confidence: high) */

         UPDATE [__mj].[ApplicationEntity]
         SET [DefaultForNewUser] = 0, [__mj_UpdatedAt] = GETUTCDATE()
         WHERE [EntityID] = '799F39A9-4FE6-416D-9F0B-66AB655E7880';

/* Set field properties for entity */

               UPDATE [__mj].[EntityField]
               SET UserSearchPredicateAPI = 'Exact'
               WHERE ID = 'AAB31B26-4985-4EDC-B329-C1F3B05E88C3'
               AND AutoUpdateUserSearchPredicate = 1;

/* Set categories for 28 fields */

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Journal Entry Batches.ID 
UPDATE [__mj].[EntityField]
SET 
   GeneratedFormSection = 'Category',
   ExtendedType = NULL,
   CodeType = NULL
WHERE 
   ID = '3EFB2BE7-5EEF-4AEB-8208-6547778FC7D4' AND AutoUpdateCategory = 1;

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Journal Entry Batches.__mj_CreatedAt 
UPDATE [__mj].[EntityField]
SET 
   GeneratedFormSection = 'Category',
   ExtendedType = NULL,
   CodeType = NULL
WHERE 
   ID = '2F59C022-C90F-4232-ABCD-FB8FB8EDE98F' AND AutoUpdateCategory = 1;

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Journal Entry Batches.__mj_UpdatedAt 
UPDATE [__mj].[EntityField]
SET 
   GeneratedFormSection = 'Category',
   ExtendedType = NULL,
   CodeType = NULL
WHERE 
   ID = '484B805F-581B-4CE4-B798-B46319B7B6D1' AND AutoUpdateCategory = 1;

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Journal Entry Batches.JournalEntryBatchNumber 
UPDATE [__mj].[EntityField]
SET 
   GeneratedFormSection = 'Category',
   ExtendedType = NULL,
   CodeType = NULL
WHERE 
   ID = '6C5C540A-D502-4298-A338-6B3203B258BB' AND AutoUpdateCategory = 1;

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Journal Entry Batches.CompanyID 
UPDATE [__mj].[EntityField]
SET 
   GeneratedFormSection = 'Category',
   ExtendedType = NULL,
   CodeType = NULL
WHERE 
   ID = '26D4F833-5A61-44CE-9FD4-BD8B951A77EE' AND AutoUpdateCategory = 1;

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Journal Entry Batches.PostingDate 
UPDATE [__mj].[EntityField]
SET 
   GeneratedFormSection = 'Category',
   ExtendedType = NULL,
   CodeType = NULL
WHERE 
   ID = '3DB1ED08-CDEC-453C-9343-1190309F1E53' AND AutoUpdateCategory = 1;

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Journal Entry Batches.SummaryJournalEntryID 
UPDATE [__mj].[EntityField]
SET 
   GeneratedFormSection = 'Category',
   ExtendedType = NULL,
   CodeType = NULL
WHERE 
   ID = 'DA48C4EC-86B1-4F90-9B8F-C96E0EF6E5CF' AND AutoUpdateCategory = 1;

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Journal Entry Batches.Company 
UPDATE [__mj].[EntityField]
SET 
   GeneratedFormSection = 'Category',
   ExtendedType = NULL,
   CodeType = NULL
WHERE 
   ID = '7EA83E28-EF8E-44E5-B53F-65D72C884D87' AND AutoUpdateCategory = 1;

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Journal Entry Batches.SummaryJournalEntry 
UPDATE [__mj].[EntityField]
SET 
   GeneratedFormSection = 'Category',
   ExtendedType = NULL,
   CodeType = NULL
WHERE 
   ID = 'D4F3B45C-6463-4DF3-A274-A3180EECB6B2' AND AutoUpdateCategory = 1;

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Journal Entry Batches.BatchedAt 
UPDATE [__mj].[EntityField]
SET 
   GeneratedFormSection = 'Category',
   ExtendedType = NULL,
   CodeType = NULL
WHERE 
   ID = '825DCE21-9A35-4670-B041-30ED3F6DED92' AND AutoUpdateCategory = 1;

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Journal Entry Batches.BatchedByUserID 
UPDATE [__mj].[EntityField]
SET 
   GeneratedFormSection = 'Category',
   ExtendedType = NULL,
   CodeType = NULL
WHERE 
   ID = 'C75F54A8-AC15-420F-8112-85FB1C69FAB0' AND AutoUpdateCategory = 1;

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Journal Entry Batches.Status 
UPDATE [__mj].[EntityField]
SET 
   GeneratedFormSection = 'Category',
   ExtendedType = NULL,
   CodeType = NULL
WHERE 
   ID = 'A8858845-79A8-45EC-A643-BEC1F49EADEE' AND AutoUpdateCategory = 1;

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Journal Entry Batches.BatchedByUser 
UPDATE [__mj].[EntityField]
SET 
   GeneratedFormSection = 'Category',
   ExtendedType = NULL,
   CodeType = NULL
WHERE 
   ID = '1C2F5EC7-70F8-44F2-8960-D52B7F4FD980' AND AutoUpdateCategory = 1;

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Journal Entry Batches.TotalEntries 
UPDATE [__mj].[EntityField]
SET 
   GeneratedFormSection = 'Category',
   ExtendedType = NULL,
   CodeType = NULL
WHERE 
   ID = '8BEF629A-691D-4EEC-A9C2-E33EE34FDFB1' AND AutoUpdateCategory = 1;

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Journal Entry Batches.TotalDebits 
UPDATE [__mj].[EntityField]
SET 
   GeneratedFormSection = 'Category',
   ExtendedType = NULL,
   CodeType = NULL
WHERE 
   ID = '32B601A4-E083-4F1D-A0A0-650FF5529066' AND AutoUpdateCategory = 1;

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Journal Entry Batches.TotalCredits 
UPDATE [__mj].[EntityField]
SET 
   GeneratedFormSection = 'Category',
   ExtendedType = NULL,
   CodeType = NULL
WHERE 
   ID = '8B862D43-388A-490F-A962-6BCA2F477C20' AND AutoUpdateCategory = 1;

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Journal Entry Batches.ExternalJournalEntryBatchRef 
UPDATE [__mj].[EntityField]
SET 
   GeneratedFormSection = 'Category',
   ExtendedType = NULL,
   CodeType = NULL
WHERE 
   ID = '7435B01D-42EC-4CEB-B590-A6763B95F00C' AND AutoUpdateCategory = 1;

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Journal Entry Batches.ErrorMessage 
UPDATE [__mj].[EntityField]
SET 
   GeneratedFormSection = 'Category',
   ExtendedType = NULL,
   CodeType = NULL
WHERE 
   ID = '6BA61A54-CCCA-41BA-B732-27A3C68EA990' AND AutoUpdateCategory = 1;

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Journal Entry Batches.ApprovedAt 
UPDATE [__mj].[EntityField]
SET 
   GeneratedFormSection = 'Category',
   ExtendedType = NULL,
   CodeType = NULL
WHERE 
   ID = '598D0AD1-9B48-49A1-925C-734722CA87E2' AND AutoUpdateCategory = 1;

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Journal Entry Batches.ApprovedByUserID 
UPDATE [__mj].[EntityField]
SET 
   GeneratedFormSection = 'Category',
   ExtendedType = NULL,
   CodeType = NULL
WHERE 
   ID = 'C00DEF37-44C1-49E6-B0A8-FDEFBB93289D' AND AutoUpdateCategory = 1;

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Journal Entry Batches.SentAt 
UPDATE [__mj].[EntityField]
SET 
   GeneratedFormSection = 'Category',
   ExtendedType = NULL,
   CodeType = NULL
WHERE 
   ID = 'E1D269E3-4698-41A4-8070-7AF0763E2F25' AND AutoUpdateCategory = 1;

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Journal Entry Batches.PostedAt 
UPDATE [__mj].[EntityField]
SET 
   GeneratedFormSection = 'Category',
   ExtendedType = NULL,
   CodeType = NULL
WHERE 
   ID = '2F98D791-7A7E-4B53-93FF-9DF832728ADC' AND AutoUpdateCategory = 1;

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Journal Entry Batches.ApprovalTaskID 
UPDATE [__mj].[EntityField]
SET 
   GeneratedFormSection = 'Category',
   ExtendedType = NULL,
   CodeType = NULL
WHERE 
   ID = 'AFD52865-7704-49DD-A376-064F64F18D6B' AND AutoUpdateCategory = 1;

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Journal Entry Batches.ApprovalTaskRaisedAt 
UPDATE [__mj].[EntityField]
SET 
   GeneratedFormSection = 'Category',
   ExtendedType = NULL,
   CodeType = NULL
WHERE 
   ID = 'A253F689-D1FA-47F8-9108-26A1BBF850C8' AND AutoUpdateCategory = 1;

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Journal Entry Batches.ApprovedByUser 
UPDATE [__mj].[EntityField]
SET 
   GeneratedFormSection = 'Category',
   ExtendedType = NULL,
   CodeType = NULL
WHERE 
   ID = '0230CB88-6691-444F-8391-AB240E930758' AND AutoUpdateCategory = 1;

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Journal Entry Batches.ApprovalTask 
UPDATE [__mj].[EntityField]
SET 
   GeneratedFormSection = 'Category',
   ExtendedType = NULL,
   CodeType = NULL
WHERE 
   ID = '5B2E72E4-9C4F-4AEF-B7EA-F38477675683' AND AutoUpdateCategory = 1;

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Journal Entry Batches.ExternalAccountingSystemID 
UPDATE [__mj].[EntityField]
SET 
   Category = 'Approval and Dispatch',
   GeneratedFormSection = 'Category',
   ExtendedType = NULL,
   CodeType = NULL
WHERE 
   ID = '1D53CEFA-4379-4B0A-91D5-93C4E9DC7A4D' AND AutoUpdateCategory = 1;

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Journal Entry Batches.ExternalAccountingSystem 
UPDATE [__mj].[EntityField]
SET 
   Category = 'Approval and Dispatch',
   GeneratedFormSection = 'Category',
   ExtendedType = NULL,
   CodeType = NULL
WHERE 
   ID = '47D86525-170E-4C37-AACB-92C777632977' AND AutoUpdateCategory = 1;

-- CodeGen Output — Run #2 (regenerated after `mj sync push` applied metadata config)
/* SQL text to update existing entities from schema */
EXEC [${mjSchema}].[spUpdateExistingEntitiesFromSchema] @ExcludedSchemaNames='sys,staging,dbo,${mjSchema},${mjSchema}_BizAppsCommon,${mjSchema}_BizAppsTasks,${mjSchema}_BizAppsCommon,${mjSchema}_BizAppsTasks,${mjSchema}_BizAppsOrders,${mjSchema}';

/* SQL text to update existing entity fields from schema */
EXEC [${mjSchema}].[spUpdateExistingEntityFieldsFromSchema] @ExcludedSchemaNames='sys,staging,dbo,${mjSchema},${mjSchema}_BizAppsCommon,${mjSchema}_BizAppsTasks,${mjSchema}_BizAppsCommon,${mjSchema}_BizAppsTasks,${mjSchema}_BizAppsOrders,${mjSchema}';

/* SQL text to set default column width where needed */
EXEC [${mjSchema}].[spSetDefaultColumnWidthWhereNeeded] @ExcludedSchemaNames='sys,staging,dbo,${mjSchema},${mjSchema}_BizAppsCommon,${mjSchema}_BizAppsTasks,${mjSchema}_BizAppsCommon,${mjSchema}_BizAppsTasks,${mjSchema}_BizAppsOrders,${mjSchema}';

/* SQL text to sync schema info from database schemas */
EXEC [${mjSchema}].[spUpdateSchemaInfoFromDatabase] @ExcludedSchemaNames='sys,staging,dbo,${mjSchema},${mjSchema}_BizAppsCommon,${mjSchema}_BizAppsTasks,${mjSchema}_BizAppsCommon,${mjSchema}_BizAppsTasks,${mjSchema}_BizAppsOrders,${mjSchema}';

/* SQL text to delete unneeded entity fields */
EXEC [${mjSchema}].[spDeleteUnneededEntityFields] @ExcludedSchemaNames='sys,staging,dbo,${mjSchema},${mjSchema}_BizAppsCommon,${mjSchema}_BizAppsTasks,${mjSchema}_BizAppsCommon,${mjSchema}_BizAppsTasks,${mjSchema}_BizAppsOrders,${mjSchema}';

/* SQL text to update existing entity fields from schema */
EXEC [${mjSchema}].[spUpdateExistingEntityFieldsFromSchema] @ExcludedSchemaNames='sys,staging,dbo,${mjSchema},${mjSchema}_BizAppsCommon,${mjSchema}_BizAppsTasks,${mjSchema}_BizAppsCommon,${mjSchema}_BizAppsTasks,${mjSchema}_BizAppsOrders,${mjSchema}';

/* SQL text to set default column width where needed */
EXEC [${mjSchema}].[spSetDefaultColumnWidthWhereNeeded] @ExcludedSchemaNames='sys,staging,dbo,${mjSchema},${mjSchema}_BizAppsCommon,${mjSchema}_BizAppsTasks,${mjSchema}_BizAppsCommon,${mjSchema}_BizAppsTasks,${mjSchema}_BizAppsOrders,${mjSchema}';

/* Set field properties for entity */

               UPDATE [${mjSchema}].[EntityField]
               SET DefaultInView = 1
               WHERE ID = 'E00A7F2C-1FAD-42A8-9AE6-8D7D90D3751A'
               AND AutoUpdateDefaultInView = 1;

/* Set field properties for entity */

               UPDATE [${mjSchema}].[EntityField]
               SET DefaultInView = 1
               WHERE ID = '6A562A4D-1EA0-453E-9C37-EEF6BC082DC0'
               AND AutoUpdateDefaultInView = 1;

/* Set field properties for entity */

               UPDATE [${mjSchema}].[EntityField]
               SET UserSearchPredicateAPI = 'BeginsWith'
               WHERE ID = 'AAB31B26-4985-4EDC-B329-C1F3B05E88C3'
               AND AutoUpdateUserSearchPredicate = 1;

/* Generated Validation Functions for MJ_BizApps_Accounting: Accounting Company Profiles */
-- CHECK constraint for MJ_BizApps_Accounting: Accounting Company Profiles: Field: FiscalYearStartMonth was newly set or modified since the last generation of the validation function, the code was regenerated and updating the GeneratedCode table with the new generated validation function
INSERT INTO [${mjSchema}].[GeneratedCode] ([CategoryID], [GeneratedByModelID], [GeneratedAt], [Language], [Status], [Source], [Code], [Description], [Name], [LinkedEntityID], [LinkedRecordPrimaryKey])
                      VALUES ((SELECT [ID] FROM [${mjSchema}].[vwGeneratedCodeCategories] WHERE [Name]='CodeGen: Validators'), 'C43229F6-4CC8-4838-9D04-03419A2DA191', GETUTCDATE(), 'TypeScript', 'Approved', '([FiscalYearStartMonth]>=(1) AND [FiscalYearStartMonth]<=(12))', 'public ValidateFiscalYearStartMonthRange(result: ValidationResult) {
	if (this.FiscalYearStartMonth !== undefined && this.FiscalYearStartMonth !== null) {
		if (this.FiscalYearStartMonth < 1 || this.FiscalYearStartMonth > 12) {
			result.Errors.push(new ValidationErrorInfo(
				"FiscalYearStartMonth",
				"Fiscal Year Start Month must be between 1 and 12.",
				this.FiscalYearStartMonth,
				ValidationErrorType.Failure
			));
		}
	}
}', 'The fiscal year start month must be a valid month number between 1 (January) and 12 (December).', 'ValidateFiscalYearStartMonthRange', 'DF238F34-2837-EF11-86D4-6045BDEE16E6', '25D07118-5DE8-45DC-9432-CE751F43E346');

