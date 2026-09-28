-- =============================================================================
-- Migration: V202609280813__v0.15.x__Finance_Exceptions.sql
-- Description: golive #279 — a finance exception list: records that a finance
--              reviewer must look at before a month is closed.
-- =============================================================================
--
-- WHAT THIS IS
--
-- Detectors in consuming apps (orders, sales) find records whose financial
-- effect rests on a judgement nobody else has checked: a progress attestation
-- that recognises a large amount, a price below the engine result with no
-- approval, a won deal with no confirmed order. Each one raises a row here.
-- A reviewer who did not create the source record clears it as Reviewed (the
-- judgement stands) or Corrected (the data was fixed). A month is ready to
-- close for a company when it has no Open rows.
--
-- FinanceExceptionType is the catalog of kinds. Its Code is the stable key the
-- detectors raise against; Configuration carries the detector's thresholds, so
-- they can be tuned without a release. A detector reads its type through
-- Accounting.GetFinanceExceptionTypes and skips when the type is missing or
-- inactive — it never invents defaults.
--
-- FinanceException is the list itself. Rows are written only through
-- Accounting.RaiseFinanceExceptions, which is idempotent on
-- (FinanceExceptionTypeID, DedupeKey) — UQ_FinanceException_Type_DedupeKey is
-- the floor under that. Status moves only through
-- Accounting.ClearFinanceException (enforced by FinanceExceptionEntityServer):
-- Open -> Reviewed or Open -> Corrected, both terminal. CK_FinanceException_Review
-- keeps the review audit consistent with the status.
--
-- The rows seeding the five types ship as metadata (metadata/finance-exception-types),
-- not here.
--
-- DETERMINISTIC, NOT IDEMPOTENT: this runs once, in order, against a database
-- that has the prior migrations.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. FinanceExceptionType — the catalog of exception kinds
-- -----------------------------------------------------------------------------
CREATE TABLE __mj_BizAppsAccounting.FinanceExceptionType (
    ID UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    Code NVARCHAR(60) NOT NULL,
    Name NVARCHAR(100) NOT NULL,
    Description NVARCHAR(MAX) NULL,
    OwningApp NVARCHAR(100) NOT NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    Configuration NVARCHAR(MAX) NOT NULL DEFAULT N'{}',
    CONSTRAINT PK_FinanceExceptionType PRIMARY KEY (ID),
    CONSTRAINT UQ_FinanceExceptionType_Code UNIQUE (Code),
    CONSTRAINT CK_FinanceExceptionType_Code CHECK (LEN(LTRIM(RTRIM(Code))) > 0),
    CONSTRAINT CK_FinanceExceptionType_Configuration CHECK (ISJSON(Configuration) = 1)
);
GO

EXEC sp_addextendedproperty @name = N'MS_Description',
    @value = N'Catalog of finance exception kinds (golive #279). Each row is one detector''s rule: its stable Code, the app that raises it, whether it is active, and its thresholds in Configuration. Seeded by metadata; a type can be deactivated, or its Configuration changed, without a release.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting',
    @level1type = N'TABLE',  @level1name = N'FinanceExceptionType';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Stable machine code the detectors raise against (e.g. PROGRESS_JUDGMENT_CALL). Unique. Never rename: raising apps key on it.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'FinanceExceptionType', @level2type = N'COLUMN', @level2name = N'Code';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Display name for the exception kind.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'FinanceExceptionType', @level2type = N'COLUMN', @level2name = N'Name';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'What the detector looks for and why a reviewer should look at it.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'FinanceExceptionType', @level2type = N'COLUMN', @level2name = N'Description';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The app whose detector raises this kind (e.g. orders, sales). Informational; accounting does not run the detector.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'FinanceExceptionType', @level2type = N'COLUMN', @level2name = N'OwningApp';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Whether the detector raises this kind. An inactive type is skipped by Accounting.RaiseFinanceExceptions and by the detector itself; existing rows stay on the list.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'FinanceExceptionType', @level2type = N'COLUMN', @level2name = N'IsActive';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'JSON object of the detector''s thresholds (e.g. {"MinDaysSinceClose":7}). Read by the detector through Accounting.GetFinanceExceptionTypes. Must be valid JSON.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'FinanceExceptionType', @level2type = N'COLUMN', @level2name = N'Configuration';
GO


-- -----------------------------------------------------------------------------
-- 2. FinanceException — the review list
-- -----------------------------------------------------------------------------
-- SourceEntityID + SourceRecordID name the record that raised it (polymorphic,
-- same shape as JournalEntry.LinkedEntityID / LinkedRecordID). ExceptionDate is
-- the day the exception belongs to; its month is the close it blocks.
-- SourceCreatedByUserID is the person whose judgement is under review, so they
-- may not clear it. CreatorUnresolved = 1 means a creator exists but has no
-- linked login, so separation of duties cannot be checked.
-- -----------------------------------------------------------------------------
CREATE TABLE __mj_BizAppsAccounting.FinanceException (
    ID UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    FinanceExceptionTypeID UNIQUEIDENTIFIER NOT NULL,
    SourceEntityID UNIQUEIDENTIFIER NOT NULL,
    SourceRecordID NVARCHAR(450) NOT NULL,
    CompanyID UNIQUEIDENTIFIER NOT NULL,
    Amount DECIMAL(19,4) NULL,
    ExceptionDate DATE NOT NULL,
    DetectedAt DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    Summary NVARCHAR(1000) NOT NULL,
    DedupeKey NVARCHAR(400) NOT NULL,
    SourceCreatedByUserID UNIQUEIDENTIFIER NULL,
    CreatorUnresolved BIT NOT NULL DEFAULT 0,
    Status NVARCHAR(20) NOT NULL DEFAULT N'Open',
    ReviewedByUserID UNIQUEIDENTIFIER NULL,
    ReviewedAt DATETIMEOFFSET NULL,
    ReviewNote NVARCHAR(MAX) NULL,
    CONSTRAINT PK_FinanceException PRIMARY KEY (ID),
    CONSTRAINT FK_FinanceException_Type FOREIGN KEY (FinanceExceptionTypeID) REFERENCES __mj_BizAppsAccounting.FinanceExceptionType(ID),
    CONSTRAINT FK_FinanceException_SourceEntity FOREIGN KEY (SourceEntityID) REFERENCES __mj.Entity(ID),
    CONSTRAINT FK_FinanceException_Company FOREIGN KEY (CompanyID) REFERENCES __mj.Company(ID),
    CONSTRAINT FK_FinanceException_SourceCreatedBy FOREIGN KEY (SourceCreatedByUserID) REFERENCES __mj.[User](ID),
    CONSTRAINT FK_FinanceException_ReviewedBy FOREIGN KEY (ReviewedByUserID) REFERENCES __mj.[User](ID),
    CONSTRAINT UQ_FinanceException_Type_DedupeKey UNIQUE (FinanceExceptionTypeID, DedupeKey),
    CONSTRAINT CK_FinanceException_Status CHECK (Status IN ('Open','Reviewed','Corrected')),
    CONSTRAINT CK_FinanceException_DedupeKey CHECK (LEN(LTRIM(RTRIM(DedupeKey))) > 0),
    CONSTRAINT CK_FinanceException_Summary CHECK (LEN(LTRIM(RTRIM(Summary))) > 0),
    -- Open carries no review; a terminal row names who cleared it and when.
    CONSTRAINT CK_FinanceException_Review CHECK (
        (Status = 'Open' AND ReviewedByUserID IS NULL AND ReviewedAt IS NULL AND ReviewNote IS NULL)
        OR (Status IN ('Reviewed','Corrected') AND ReviewedByUserID IS NOT NULL AND ReviewedAt IS NOT NULL)
    )
);
GO

EXEC sp_addextendedproperty @name = N'MS_Description',
    @value = N'Records a finance reviewer must look at before a month is closed (golive #279). Raised by detectors in consuming apps through Accounting.RaiseFinanceExceptions, idempotent on (FinanceExceptionTypeID, DedupeKey). Cleared only through Accounting.ClearFinanceException, by a holder of MJ.BizApps.Accounting.FinanceExceptions.Clear who is not the source record''s creator. A company''s month is ready to close when it has no Open rows.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting',
    @level1type = N'TABLE',  @level1name = N'FinanceException';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The kind of exception.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'FinanceException', @level2type = N'COLUMN', @level2name = N'FinanceExceptionTypeID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'MJ entity of the record that raised the exception. With SourceRecordID, names the source record.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'FinanceException', @level2type = N'COLUMN', @level2name = N'SourceEntityID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Primary key of the source record, in the entity named by SourceEntityID.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'FinanceException', @level2type = N'COLUMN', @level2name = N'SourceRecordID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The company whose books the exception affects. Ready-to-close is judged per company and month.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'FinanceException', @level2type = N'COLUMN', @level2name = N'CompanyID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The amount at stake, in the source record''s currency. NULL when the detector cannot state one.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'FinanceException', @level2type = N'COLUMN', @level2name = N'Amount';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The business day the exception belongs to. Its month is the close it blocks.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'FinanceException', @level2type = N'COLUMN', @level2name = N'ExceptionDate';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'When the exception was raised (UTC).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'FinanceException', @level2type = N'COLUMN', @level2name = N'DetectedAt';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Plain description of what the detector found in the data.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'FinanceException', @level2type = N'COLUMN', @level2name = N'Summary';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The detector''s identity for this occurrence (e.g. the source record ID, or record ID and month). Unique per type: raising the same key again returns the existing row unchanged.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'FinanceException', @level2type = N'COLUMN', @level2name = N'DedupeKey';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The login whose judgement is under review — the attester, booker or deal owner. This user may not clear the exception. NULL when there is none or it could not be resolved.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'FinanceException', @level2type = N'COLUMN', @level2name = N'SourceCreatedByUserID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'1 = the source record has a creator who has no linked login, so separation of duties cannot be checked and the exception cannot be cleared until that is resolved.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'FinanceException', @level2type = N'COLUMN', @level2name = N'CreatorUnresolved';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Open until cleared. Reviewed: the judgement stands. Corrected: the data was fixed. Both are terminal and reachable only through Accounting.ClearFinanceException.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'FinanceException', @level2type = N'COLUMN', @level2name = N'Status';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Who cleared the exception. Required once Reviewed or Corrected; NULL while Open.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'FinanceException', @level2type = N'COLUMN', @level2name = N'ReviewedByUserID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'When the exception was cleared (UTC). Required once Reviewed or Corrected; NULL while Open.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'FinanceException', @level2type = N'COLUMN', @level2name = N'ReviewedAt';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The reviewer''s note on what they checked or changed. Required by Accounting.ClearFinanceException; NULL while Open.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'FinanceException', @level2type = N'COLUMN', @level2name = N'ReviewNote';
GO


















































-- =============================================================================
-- CODEGEN OUTPUT — GENERATED CODE BELOW THIS LINE. DO NOT EDIT BY HAND.
-- =============================================================================


/* SQL generated to create new entity MJ_BizApps_Accounting: Finance Exception Types */

      INSERT INTO [${mjSchema}].[Entity] (
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
         '57fd0c9b-c308-41a4-988a-e4c378a9803d',
         'MJ_BizApps_Accounting: Finance Exception Types',
         'Finance Exception Types',
         'Catalog of finance exception kinds (golive #279). Each row is one detector''s rule: its stable Code, the app that raises it, whether it is active, and its thresholds in Configuration. Seeded by metadata; a type can be deactivated, or its Configuration changed, without a release.',
         NULL,
         'FinanceExceptionType',
         'vwFinanceExceptionTypes',
         '${flyway:defaultSchema}',
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

/* SQL generated to add new entity MJ_BizApps_Accounting: Finance Exception Types to application ID: 'E609083D-D3E2-44AD-9DF3-CB833BEF381D' */
INSERT INTO [${mjSchema}].[ApplicationEntity]
                                       ([ApplicationID], [EntityID], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES
                                       ('E609083D-D3E2-44AD-9DF3-CB833BEF381D', '57fd0c9b-c308-41a4-988a-e4c378a9803d', (SELECT COALESCE(MAX([Sequence]),0)+1 FROM [${mjSchema}].[ApplicationEntity] WHERE [ApplicationID] = 'E609083D-D3E2-44AD-9DF3-CB833BEF381D'), GETUTCDATE(), GETUTCDATE());

/* SQL generated to add new permission for entity MJ_BizApps_Accounting: Finance Exception Types for role UI */
INSERT INTO [${mjSchema}].[EntityPermission]
                ([EntityID], [RoleID], [Type], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt])
              SELECT CAST('57fd0c9b-c308-41a4-988a-e4c378a9803d' AS uniqueidentifier), CAST('E0AFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 'Allow', 1, 0, 0, 0, GETUTCDATE(), GETUTCDATE()
              WHERE NOT EXISTS (
                SELECT 1 FROM [${mjSchema}].[EntityPermission]
                WHERE [EntityID] = CAST('57fd0c9b-c308-41a4-988a-e4c378a9803d' AS uniqueidentifier) AND [RoleID] = CAST('E0AFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier) AND [Type] = 'Allow'
              );

/* SQL generated to add new permission for entity MJ_BizApps_Accounting: Finance Exception Types for role Developer */
INSERT INTO [${mjSchema}].[EntityPermission]
                ([EntityID], [RoleID], [Type], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt])
              SELECT CAST('57fd0c9b-c308-41a4-988a-e4c378a9803d' AS uniqueidentifier), CAST('DEAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 'Allow', 1, 1, 1, 1, GETUTCDATE(), GETUTCDATE()
              WHERE NOT EXISTS (
                SELECT 1 FROM [${mjSchema}].[EntityPermission]
                WHERE [EntityID] = CAST('57fd0c9b-c308-41a4-988a-e4c378a9803d' AS uniqueidentifier) AND [RoleID] = CAST('DEAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier) AND [Type] = 'Allow'
              );

/* SQL generated to add new permission for entity MJ_BizApps_Accounting: Finance Exception Types for role Integration */
INSERT INTO [${mjSchema}].[EntityPermission]
                ([EntityID], [RoleID], [Type], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt])
              SELECT CAST('57fd0c9b-c308-41a4-988a-e4c378a9803d' AS uniqueidentifier), CAST('DFAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 'Allow', 1, 1, 1, 1, GETUTCDATE(), GETUTCDATE()
              WHERE NOT EXISTS (
                SELECT 1 FROM [${mjSchema}].[EntityPermission]
                WHERE [EntityID] = CAST('57fd0c9b-c308-41a4-988a-e4c378a9803d' AS uniqueidentifier) AND [RoleID] = CAST('DFAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier) AND [Type] = 'Allow'
              );

/* SQL generated to create new entity MJ_BizApps_Accounting: Finance Exceptions */

      INSERT INTO [${mjSchema}].[Entity] (
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
         '25d46762-4ea5-4fd5-a99f-f5870f72164c',
         'MJ_BizApps_Accounting: Finance Exceptions',
         'Finance Exceptions',
         'Records a finance reviewer must look at before a month is closed (golive #279). Raised by detectors in consuming apps through Accounting.RaiseFinanceExceptions, idempotent on (FinanceExceptionTypeID, DedupeKey). Cleared only through Accounting.ClearFinanceException, by a holder of MJ.BizApps.Accounting.FinanceExceptions.Clear who is not the source record''s creator. A company''s month is ready to close when it has no Open rows.',
         NULL,
         'FinanceException',
         'vwFinanceExceptions',
         '${flyway:defaultSchema}',
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

/* SQL generated to add new entity MJ_BizApps_Accounting: Finance Exceptions to application ID: 'E609083D-D3E2-44AD-9DF3-CB833BEF381D' */
INSERT INTO [${mjSchema}].[ApplicationEntity]
                                       ([ApplicationID], [EntityID], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES
                                       ('E609083D-D3E2-44AD-9DF3-CB833BEF381D', '25d46762-4ea5-4fd5-a99f-f5870f72164c', (SELECT COALESCE(MAX([Sequence]),0)+1 FROM [${mjSchema}].[ApplicationEntity] WHERE [ApplicationID] = 'E609083D-D3E2-44AD-9DF3-CB833BEF381D'), GETUTCDATE(), GETUTCDATE());

/* SQL generated to add new permission for entity MJ_BizApps_Accounting: Finance Exceptions for role UI */
INSERT INTO [${mjSchema}].[EntityPermission]
                ([EntityID], [RoleID], [Type], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt])
              SELECT CAST('25d46762-4ea5-4fd5-a99f-f5870f72164c' AS uniqueidentifier), CAST('E0AFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 'Allow', 1, 0, 0, 0, GETUTCDATE(), GETUTCDATE()
              WHERE NOT EXISTS (
                SELECT 1 FROM [${mjSchema}].[EntityPermission]
                WHERE [EntityID] = CAST('25d46762-4ea5-4fd5-a99f-f5870f72164c' AS uniqueidentifier) AND [RoleID] = CAST('E0AFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier) AND [Type] = 'Allow'
              );

/* SQL generated to add new permission for entity MJ_BizApps_Accounting: Finance Exceptions for role Developer */
INSERT INTO [${mjSchema}].[EntityPermission]
                ([EntityID], [RoleID], [Type], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt])
              SELECT CAST('25d46762-4ea5-4fd5-a99f-f5870f72164c' AS uniqueidentifier), CAST('DEAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 'Allow', 1, 1, 1, 1, GETUTCDATE(), GETUTCDATE()
              WHERE NOT EXISTS (
                SELECT 1 FROM [${mjSchema}].[EntityPermission]
                WHERE [EntityID] = CAST('25d46762-4ea5-4fd5-a99f-f5870f72164c' AS uniqueidentifier) AND [RoleID] = CAST('DEAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier) AND [Type] = 'Allow'
              );

/* SQL generated to add new permission for entity MJ_BizApps_Accounting: Finance Exceptions for role Integration */
INSERT INTO [${mjSchema}].[EntityPermission]
                ([EntityID], [RoleID], [Type], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt])
              SELECT CAST('25d46762-4ea5-4fd5-a99f-f5870f72164c' AS uniqueidentifier), CAST('DFAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 'Allow', 1, 1, 1, 1, GETUTCDATE(), GETUTCDATE()
              WHERE NOT EXISTS (
                SELECT 1 FROM [${mjSchema}].[EntityPermission]
                WHERE [EntityID] = CAST('25d46762-4ea5-4fd5-a99f-f5870f72164c' AS uniqueidentifier) AND [RoleID] = CAST('DFAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier) AND [Type] = 'Allow'
              );

/* SQL text to update existing entities from schema */
EXEC [${mjSchema}].[spUpdateExistingEntitiesFromSchema] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.FinanceExceptionType */
ALTER TABLE [${flyway:defaultSchema}].[FinanceExceptionType] ADD [__mj_CreatedAt] DATETIMEOFFSET NULL;
GO

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.FinanceExceptionType */
UPDATE [${flyway:defaultSchema}].[FinanceExceptionType] SET [__mj_CreatedAt] = GETUTCDATE() WHERE [__mj_CreatedAt] IS NULL;
GO

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.FinanceExceptionType */
ALTER TABLE [${flyway:defaultSchema}].[FinanceExceptionType] ALTER COLUMN [__mj_CreatedAt] DATETIMEOFFSET NOT NULL;
GO

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.FinanceExceptionType */
ALTER TABLE [${flyway:defaultSchema}].[FinanceExceptionType] ADD CONSTRAINT [DF___mj_BizAppsAccounting_FinanceExceptionType___mj_CreatedAt] DEFAULT GETUTCDATE() FOR [__mj_CreatedAt];
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.FinanceExceptionType */
ALTER TABLE [${flyway:defaultSchema}].[FinanceExceptionType] ADD [__mj_UpdatedAt] DATETIMEOFFSET NULL;
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.FinanceExceptionType */
UPDATE [${flyway:defaultSchema}].[FinanceExceptionType] SET [__mj_UpdatedAt] = GETUTCDATE() WHERE [__mj_UpdatedAt] IS NULL;
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.FinanceExceptionType */
ALTER TABLE [${flyway:defaultSchema}].[FinanceExceptionType] ALTER COLUMN [__mj_UpdatedAt] DATETIMEOFFSET NOT NULL;
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.FinanceExceptionType */
ALTER TABLE [${flyway:defaultSchema}].[FinanceExceptionType] ADD CONSTRAINT [DF___mj_BizAppsAccounting_FinanceExceptionType___mj_UpdatedAt] DEFAULT GETUTCDATE() FOR [__mj_UpdatedAt];
GO

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.FinanceException */
ALTER TABLE [${flyway:defaultSchema}].[FinanceException] ADD [__mj_CreatedAt] DATETIMEOFFSET NULL;
GO

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.FinanceException */
UPDATE [${flyway:defaultSchema}].[FinanceException] SET [__mj_CreatedAt] = GETUTCDATE() WHERE [__mj_CreatedAt] IS NULL;
GO

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.FinanceException */
ALTER TABLE [${flyway:defaultSchema}].[FinanceException] ALTER COLUMN [__mj_CreatedAt] DATETIMEOFFSET NOT NULL;
GO

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.FinanceException */
ALTER TABLE [${flyway:defaultSchema}].[FinanceException] ADD CONSTRAINT [DF___mj_BizAppsAccounting_FinanceException___mj_CreatedAt] DEFAULT GETUTCDATE() FOR [__mj_CreatedAt];
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.FinanceException */
ALTER TABLE [${flyway:defaultSchema}].[FinanceException] ADD [__mj_UpdatedAt] DATETIMEOFFSET NULL;
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.FinanceException */
UPDATE [${flyway:defaultSchema}].[FinanceException] SET [__mj_UpdatedAt] = GETUTCDATE() WHERE [__mj_UpdatedAt] IS NULL;
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.FinanceException */
ALTER TABLE [${flyway:defaultSchema}].[FinanceException] ALTER COLUMN [__mj_UpdatedAt] DATETIMEOFFSET NOT NULL;
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.FinanceException */
ALTER TABLE [${flyway:defaultSchema}].[FinanceException] ADD CONSTRAINT [DF___mj_BizAppsAccounting_FinanceException___mj_UpdatedAt] DEFAULT GETUTCDATE() FOR [__mj_UpdatedAt];
GO

/* SQL text to insert 27 new entity field(s) */

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '04e849de-d4dd-4d67-899c-bfde100d50e1' OR (EntityID = '57FD0C9B-C308-41A4-988A-E4C378A9803D' AND Name = 'ID')) BEGIN
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
            '04e849de-d4dd-4d67-899c-bfde100d50e1',
            '57FD0C9B-C308-41A4-988A-E4C378A9803D', -- Entity: MJ_BizApps_Accounting: Finance Exception Types
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '57FD0C9B-C308-41A4-988A-E4C378A9803D'),
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
            0,
            0,
            0,
            1,
            1,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'f6c8afef-968d-401f-8a34-9dc4bfa593c7' OR (EntityID = '57FD0C9B-C308-41A4-988A-E4C378A9803D' AND Name = 'Code')) BEGIN
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
            'f6c8afef-968d-401f-8a34-9dc4bfa593c7',
            '57FD0C9B-C308-41A4-988A-E4C378A9803D', -- Entity: MJ_BizApps_Accounting: Finance Exception Types
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '57FD0C9B-C308-41A4-988A-E4C378A9803D'),
            'Code',
            'Code',
            'Stable machine code the detectors raise against (e.g. PROGRESS_JUDGMENT_CALL). Unique. Never rename: raising apps key on it.',
            'nvarchar',
            120,
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
            1,
            0,
            1,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '7d073b02-26d3-4c14-b300-cabbbe265cb0' OR (EntityID = '57FD0C9B-C308-41A4-988A-E4C378A9803D' AND Name = 'Name')) BEGIN
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
            '7d073b02-26d3-4c14-b300-cabbbe265cb0',
            '57FD0C9B-C308-41A4-988A-E4C378A9803D', -- Entity: MJ_BizApps_Accounting: Finance Exception Types
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '57FD0C9B-C308-41A4-988A-E4C378A9803D'),
            'Name',
            'Name',
            'Display name for the exception kind.',
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
            1,
            1,
            0,
            1,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'ebca4141-bc0d-48d7-a81e-eaf9741612c3' OR (EntityID = '57FD0C9B-C308-41A4-988A-E4C378A9803D' AND Name = 'Description')) BEGIN
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
            'ebca4141-bc0d-48d7-a81e-eaf9741612c3',
            '57FD0C9B-C308-41A4-988A-E4C378A9803D', -- Entity: MJ_BizApps_Accounting: Finance Exception Types
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '57FD0C9B-C308-41A4-988A-E4C378A9803D'),
            'Description',
            'Description',
            'What the detector looks for and why a reviewer should look at it.',
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
            1,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '21b3a095-4fd5-4cfe-920f-86274dcd79f3' OR (EntityID = '57FD0C9B-C308-41A4-988A-E4C378A9803D' AND Name = 'OwningApp')) BEGIN
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
            '21b3a095-4fd5-4cfe-920f-86274dcd79f3',
            '57FD0C9B-C308-41A4-988A-E4C378A9803D', -- Entity: MJ_BizApps_Accounting: Finance Exception Types
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '57FD0C9B-C308-41A4-988A-E4C378A9803D'),
            'OwningApp',
            'Owning App',
            'The app whose detector raises this kind (e.g. orders, sales). Informational; accounting does not run the detector.',
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
            1,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '5598aff7-5740-4255-9b11-9d9a4f287536' OR (EntityID = '57FD0C9B-C308-41A4-988A-E4C378A9803D' AND Name = 'IsActive')) BEGIN
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
            '5598aff7-5740-4255-9b11-9d9a4f287536',
            '57FD0C9B-C308-41A4-988A-E4C378A9803D', -- Entity: MJ_BizApps_Accounting: Finance Exception Types
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '57FD0C9B-C308-41A4-988A-E4C378A9803D'),
            'IsActive',
            'Is Active',
            'Whether the detector raises this kind. An inactive type is skipped by Accounting.RaiseFinanceExceptions and by the detector itself; existing rows stay on the list.',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '4a61dac3-bae8-4f53-a329-2a1dd54c47c7' OR (EntityID = '57FD0C9B-C308-41A4-988A-E4C378A9803D' AND Name = 'Configuration')) BEGIN
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
            '4a61dac3-bae8-4f53-a329-2a1dd54c47c7',
            '57FD0C9B-C308-41A4-988A-E4C378A9803D', -- Entity: MJ_BizApps_Accounting: Finance Exception Types
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '57FD0C9B-C308-41A4-988A-E4C378A9803D'),
            'Configuration',
            'Configuration',
            'JSON object of the detector''s thresholds (e.g. {"MinDaysSinceClose":7}). Read by the detector through Accounting.GetFinanceExceptionTypes. Must be valid JSON.',
            'nvarchar',
            -1,
            0,
            0,
            0,
            '{}',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '99482808-7995-4552-87c0-87bb50a2cfee' OR (EntityID = '57FD0C9B-C308-41A4-988A-E4C378A9803D' AND Name = '__mj_CreatedAt')) BEGIN
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
            '99482808-7995-4552-87c0-87bb50a2cfee',
            '57FD0C9B-C308-41A4-988A-E4C378A9803D', -- Entity: MJ_BizApps_Accounting: Finance Exception Types
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '57FD0C9B-C308-41A4-988A-E4C378A9803D'),
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '1690156a-57f1-4065-9cae-0730e82c4aed' OR (EntityID = '57FD0C9B-C308-41A4-988A-E4C378A9803D' AND Name = '__mj_UpdatedAt')) BEGIN
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
            '1690156a-57f1-4065-9cae-0730e82c4aed',
            '57FD0C9B-C308-41A4-988A-E4C378A9803D', -- Entity: MJ_BizApps_Accounting: Finance Exception Types
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '57FD0C9B-C308-41A4-988A-E4C378A9803D'),
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'a3815963-5a9d-4d97-8e07-840446503dcd' OR (EntityID = '25D46762-4EA5-4FD5-A99F-F5870F72164C' AND Name = 'ID')) BEGIN
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
            'a3815963-5a9d-4d97-8e07-840446503dcd',
            '25D46762-4EA5-4FD5-A99F-F5870F72164C', -- Entity: MJ_BizApps_Accounting: Finance Exceptions
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '25D46762-4EA5-4FD5-A99F-F5870F72164C'),
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
            0,
            0,
            0,
            1,
            1,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'f9b999eb-b563-44be-9a7d-742757703470' OR (EntityID = '25D46762-4EA5-4FD5-A99F-F5870F72164C' AND Name = 'FinanceExceptionTypeID')) BEGIN
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
            'f9b999eb-b563-44be-9a7d-742757703470',
            '25D46762-4EA5-4FD5-A99F-F5870F72164C', -- Entity: MJ_BizApps_Accounting: Finance Exceptions
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '25D46762-4EA5-4FD5-A99F-F5870F72164C'),
            'FinanceExceptionTypeID',
            'Finance Exception Type ID',
            'The kind of exception.',
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
            '57FD0C9B-C308-41A4-988A-E4C378A9803D',
            'ID',
            0,
            0,
            1,
            0,
            0,
            1,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '3492339b-1b92-4333-a26b-c363c426176f' OR (EntityID = '25D46762-4EA5-4FD5-A99F-F5870F72164C' AND Name = 'SourceEntityID')) BEGIN
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
            '3492339b-1b92-4333-a26b-c363c426176f',
            '25D46762-4EA5-4FD5-A99F-F5870F72164C', -- Entity: MJ_BizApps_Accounting: Finance Exceptions
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '25D46762-4EA5-4FD5-A99F-F5870F72164C'),
            'SourceEntityID',
            'Source Entity ID',
            'MJ entity of the record that raised the exception. With SourceRecordID, names the source record.',
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
            'E0238F34-2837-EF11-86D4-6045BDEE16E6',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '3a14a9e7-7d47-472c-89be-0529ff5e1c72' OR (EntityID = '25D46762-4EA5-4FD5-A99F-F5870F72164C' AND Name = 'SourceRecordID')) BEGIN
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
            '3a14a9e7-7d47-472c-89be-0529ff5e1c72',
            '25D46762-4EA5-4FD5-A99F-F5870F72164C', -- Entity: MJ_BizApps_Accounting: Finance Exceptions
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '25D46762-4EA5-4FD5-A99F-F5870F72164C'),
            'SourceRecordID',
            'Source Record ID',
            'Primary key of the source record, in the entity named by SourceEntityID.',
            'nvarchar',
            900,
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
            1,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'eff056dc-206c-4763-87b9-998095b62412' OR (EntityID = '25D46762-4EA5-4FD5-A99F-F5870F72164C' AND Name = 'CompanyID')) BEGIN
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
            'eff056dc-206c-4763-87b9-998095b62412',
            '25D46762-4EA5-4FD5-A99F-F5870F72164C', -- Entity: MJ_BizApps_Accounting: Finance Exceptions
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '25D46762-4EA5-4FD5-A99F-F5870F72164C'),
            'CompanyID',
            'Company ID',
            'The company whose books the exception affects. Ready-to-close is judged per company and month.',
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
            'D4238F34-2837-EF11-86D4-6045BDEE16E6',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '030c4abd-b3fa-4df7-8da5-b3a58cbdf030' OR (EntityID = '25D46762-4EA5-4FD5-A99F-F5870F72164C' AND Name = 'Amount')) BEGIN
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
            '030c4abd-b3fa-4df7-8da5-b3a58cbdf030',
            '25D46762-4EA5-4FD5-A99F-F5870F72164C', -- Entity: MJ_BizApps_Accounting: Finance Exceptions
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '25D46762-4EA5-4FD5-A99F-F5870F72164C'),
            'Amount',
            'Amount',
            'The amount at stake, in the source record''s currency. NULL when the detector cannot state one.',
            'decimal',
            9,
            19,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'fc5ab177-33f8-463b-b7a1-7f96ccba63c9' OR (EntityID = '25D46762-4EA5-4FD5-A99F-F5870F72164C' AND Name = 'ExceptionDate')) BEGIN
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
            'fc5ab177-33f8-463b-b7a1-7f96ccba63c9',
            '25D46762-4EA5-4FD5-A99F-F5870F72164C', -- Entity: MJ_BizApps_Accounting: Finance Exceptions
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '25D46762-4EA5-4FD5-A99F-F5870F72164C'),
            'ExceptionDate',
            'Exception Date',
            'The business day the exception belongs to. Its month is the close it blocks.',
            'date',
            3,
            10,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '5a05bd54-f1a3-489c-bafa-5d97795d0f35' OR (EntityID = '25D46762-4EA5-4FD5-A99F-F5870F72164C' AND Name = 'DetectedAt')) BEGIN
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
            '5a05bd54-f1a3-489c-bafa-5d97795d0f35',
            '25D46762-4EA5-4FD5-A99F-F5870F72164C', -- Entity: MJ_BizApps_Accounting: Finance Exceptions
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '25D46762-4EA5-4FD5-A99F-F5870F72164C'),
            'DetectedAt',
            'Detected At',
            'When the exception was raised (UTC).',
            'datetimeoffset',
            10,
            34,
            7,
            0,
            'sysdatetimeoffset()',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'd6db0d39-c95f-4a67-9611-95e4ac3cbe75' OR (EntityID = '25D46762-4EA5-4FD5-A99F-F5870F72164C' AND Name = 'Summary')) BEGIN
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
            'd6db0d39-c95f-4a67-9611-95e4ac3cbe75',
            '25D46762-4EA5-4FD5-A99F-F5870F72164C', -- Entity: MJ_BizApps_Accounting: Finance Exceptions
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '25D46762-4EA5-4FD5-A99F-F5870F72164C'),
            'Summary',
            'Summary',
            'Plain description of what the detector found in the data.',
            'nvarchar',
            2000,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'e271a3a0-5f9f-444c-b469-f821a74bc3a0' OR (EntityID = '25D46762-4EA5-4FD5-A99F-F5870F72164C' AND Name = 'DedupeKey')) BEGIN
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
            'e271a3a0-5f9f-444c-b469-f821a74bc3a0',
            '25D46762-4EA5-4FD5-A99F-F5870F72164C', -- Entity: MJ_BizApps_Accounting: Finance Exceptions
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '25D46762-4EA5-4FD5-A99F-F5870F72164C'),
            'DedupeKey',
            'Dedupe Key',
            'The detector''s identity for this occurrence (e.g. the source record ID, or record ID and month). Unique per type: raising the same key again returns the existing row unchanged.',
            'nvarchar',
            800,
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
            1,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'b97dcd2e-3201-4bcb-bdce-0a261c721b0c' OR (EntityID = '25D46762-4EA5-4FD5-A99F-F5870F72164C' AND Name = 'SourceCreatedByUserID')) BEGIN
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
            'b97dcd2e-3201-4bcb-bdce-0a261c721b0c',
            '25D46762-4EA5-4FD5-A99F-F5870F72164C', -- Entity: MJ_BizApps_Accounting: Finance Exceptions
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '25D46762-4EA5-4FD5-A99F-F5870F72164C'),
            'SourceCreatedByUserID',
            'Source Created By User ID',
            'The login whose judgement is under review — the attester, booker or deal owner. This user may not clear the exception. NULL when there is none or it could not be resolved.',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '65f4ac62-a691-4655-bdf7-e4a6d8528fb2' OR (EntityID = '25D46762-4EA5-4FD5-A99F-F5870F72164C' AND Name = 'CreatorUnresolved')) BEGIN
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
            '65f4ac62-a691-4655-bdf7-e4a6d8528fb2',
            '25D46762-4EA5-4FD5-A99F-F5870F72164C', -- Entity: MJ_BizApps_Accounting: Finance Exceptions
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '25D46762-4EA5-4FD5-A99F-F5870F72164C'),
            'CreatorUnresolved',
            'Creator Unresolved',
            '1 = the source record has a creator who has no linked login, so separation of duties cannot be checked and the exception cannot be cleared until that is resolved.',
            'bit',
            1,
            1,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'b9c8e505-9f11-4641-9379-746ef6ea83a3' OR (EntityID = '25D46762-4EA5-4FD5-A99F-F5870F72164C' AND Name = 'Status')) BEGIN
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
            'b9c8e505-9f11-4641-9379-746ef6ea83a3',
            '25D46762-4EA5-4FD5-A99F-F5870F72164C', -- Entity: MJ_BizApps_Accounting: Finance Exceptions
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '25D46762-4EA5-4FD5-A99F-F5870F72164C'),
            'Status',
            'Status',
            'Open until cleared. Reviewed: the judgement stands. Corrected: the data was fixed. Both are terminal and reachable only through Accounting.ClearFinanceException.',
            'nvarchar',
            40,
            0,
            0,
            0,
            'Open',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'b3795610-5a42-4262-8688-b2e67fc16b0a' OR (EntityID = '25D46762-4EA5-4FD5-A99F-F5870F72164C' AND Name = 'ReviewedByUserID')) BEGIN
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
            'b3795610-5a42-4262-8688-b2e67fc16b0a',
            '25D46762-4EA5-4FD5-A99F-F5870F72164C', -- Entity: MJ_BizApps_Accounting: Finance Exceptions
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '25D46762-4EA5-4FD5-A99F-F5870F72164C'),
            'ReviewedByUserID',
            'Reviewed By User ID',
            'Who cleared the exception. Required once Reviewed or Corrected; NULL while Open.',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '33e9d11f-b5f6-4547-96d3-7a8258f828eb' OR (EntityID = '25D46762-4EA5-4FD5-A99F-F5870F72164C' AND Name = 'ReviewedAt')) BEGIN
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
            '33e9d11f-b5f6-4547-96d3-7a8258f828eb',
            '25D46762-4EA5-4FD5-A99F-F5870F72164C', -- Entity: MJ_BizApps_Accounting: Finance Exceptions
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '25D46762-4EA5-4FD5-A99F-F5870F72164C'),
            'ReviewedAt',
            'Reviewed At',
            'When the exception was cleared (UTC). Required once Reviewed or Corrected; NULL while Open.',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '59eff0e1-9b0a-4a17-80f6-3ed6e6347b66' OR (EntityID = '25D46762-4EA5-4FD5-A99F-F5870F72164C' AND Name = 'ReviewNote')) BEGIN
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
            '59eff0e1-9b0a-4a17-80f6-3ed6e6347b66',
            '25D46762-4EA5-4FD5-A99F-F5870F72164C', -- Entity: MJ_BizApps_Accounting: Finance Exceptions
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '25D46762-4EA5-4FD5-A99F-F5870F72164C'),
            'ReviewNote',
            'Review Note',
            'The reviewer''s note on what they checked or changed. Required by Accounting.ClearFinanceException; NULL while Open.',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '31935c65-f0e6-4953-8f96-53c85a8ea24a' OR (EntityID = '25D46762-4EA5-4FD5-A99F-F5870F72164C' AND Name = '__mj_CreatedAt')) BEGIN
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
            '31935c65-f0e6-4953-8f96-53c85a8ea24a',
            '25D46762-4EA5-4FD5-A99F-F5870F72164C', -- Entity: MJ_BizApps_Accounting: Finance Exceptions
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '25D46762-4EA5-4FD5-A99F-F5870F72164C'),
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '3fe960f1-d07e-4ff7-be76-5d83b2fbfa4c' OR (EntityID = '25D46762-4EA5-4FD5-A99F-F5870F72164C' AND Name = '__mj_UpdatedAt')) BEGIN
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
            '3fe960f1-d07e-4ff7-be76-5d83b2fbfa4c',
            '25D46762-4EA5-4FD5-A99F-F5870F72164C', -- Entity: MJ_BizApps_Accounting: Finance Exceptions
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '25D46762-4EA5-4FD5-A99F-F5870F72164C'),
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

/* SQL text to update existing entity fields from schema */
EXEC [${mjSchema}].[spUpdateExistingEntityFieldsFromSchema] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to set default column width where needed */
EXEC [${mjSchema}].[spSetDefaultColumnWidthWhereNeeded] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to insert entity field value with ID ec8f6c02-d7f5-4d9a-9253-2230204ccd99 */
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('ec8f6c02-d7f5-4d9a-9253-2230204ccd99', 'B9C8E505-9F11-4641-9379-746EF6EA83A3', 1, 'Corrected', 'Corrected', GETUTCDATE(), GETUTCDATE());

/* SQL text to insert entity field value with ID 3e4198fc-84c4-46f0-933f-90218c0b1d66 */
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('3e4198fc-84c4-46f0-933f-90218c0b1d66', 'B9C8E505-9F11-4641-9379-746EF6EA83A3', 2, 'Open', 'Open', GETUTCDATE(), GETUTCDATE());

/* SQL text to insert entity field value with ID 24daf346-9eb4-4e96-befc-0ef2aae18dc4 */
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('24daf346-9eb4-4e96-befc-0ef2aae18dc4', 'B9C8E505-9F11-4641-9379-746EF6EA83A3', 3, 'Reviewed', 'Reviewed', GETUTCDATE(), GETUTCDATE());

/* SQL text to update ValueListType for entity field ID B9C8E505-9F11-4641-9379-746EF6EA83A3 */
UPDATE [${mjSchema}].[EntityField] SET ValueListType='List' WHERE ID='B9C8E505-9F11-4641-9379-746EF6EA83A3';


/* Create Entity Relationship: MJ: Companies -> MJ_BizApps_Accounting: Finance Exceptions (One To Many via CompanyID) */
   IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntityRelationship] WHERE [ID] = 'b13519e2-67b7-4849-9b22-1077fcd1a02c'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
                    VALUES ('b13519e2-67b7-4849-9b22-1077fcd1a02c', 'D4238F34-2837-EF11-86D4-6045BDEE16E6', '25D46762-4EA5-4FD5-A99F-F5870F72164C', 'CompanyID', 'One To Many', 1, 1, 17, GETUTCDATE(), GETUTCDATE())
   END;
                    
/* Create Entity Relationship: MJ: Entities -> MJ_BizApps_Accounting: Finance Exceptions (One To Many via SourceEntityID) */
   IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntityRelationship] WHERE [ID] = '4cea404a-7cc2-4e32-94ea-b896edd6df55'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
                    VALUES ('4cea404a-7cc2-4e32-94ea-b896edd6df55', 'E0238F34-2837-EF11-86D4-6045BDEE16E6', '25D46762-4EA5-4FD5-A99F-F5870F72164C', 'SourceEntityID', 'One To Many', 1, 1, 85, GETUTCDATE(), GETUTCDATE())
   END;


/* Create Entity Relationship: MJ: Users -> MJ_BizApps_Accounting: Finance Exceptions (One To Many via SourceCreatedByUserID) */
   IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntityRelationship] WHERE [ID] = '314184d9-f072-4179-b36c-8aa5174cdaeb'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
                    VALUES ('314184d9-f072-4179-b36c-8aa5174cdaeb', 'E1238F34-2837-EF11-86D4-6045BDEE16E6', '25D46762-4EA5-4FD5-A99F-F5870F72164C', 'SourceCreatedByUserID', 'One To Many', 1, 1, 116, GETUTCDATE(), GETUTCDATE())
   END;
                    
/* Create Entity Relationship: MJ: Users -> MJ_BizApps_Accounting: Finance Exceptions (One To Many via ReviewedByUserID) */
   IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntityRelationship] WHERE [ID] = '5bd44afe-91ef-485b-86ad-9ab595b65619'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
                    VALUES ('5bd44afe-91ef-485b-86ad-9ab595b65619', 'E1238F34-2837-EF11-86D4-6045BDEE16E6', '25D46762-4EA5-4FD5-A99F-F5870F72164C', 'ReviewedByUserID', 'One To Many', 1, 1, 117, GETUTCDATE(), GETUTCDATE())
   END;


/* Create Entity Relationship: MJ_BizApps_Accounting: Finance Exception Types -> MJ_BizApps_Accounting: Finance Exceptions (One To Many via FinanceExceptionTypeID) */
   IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntityRelationship] WHERE [ID] = '45cec4a6-3cfc-4508-ade9-b50c68c2087b'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
                    VALUES ('45cec4a6-3cfc-4508-ade9-b50c68c2087b', '57FD0C9B-C308-41A4-988A-E4C378A9803D', '25D46762-4EA5-4FD5-A99F-F5870F72164C', 'FinanceExceptionTypeID', 'One To Many', 1, 1, 1, GETUTCDATE(), GETUTCDATE())
   END;

/* SQL text to sync schema info from database schemas */
EXEC [${mjSchema}].[spUpdateSchemaInfoFromDatabase] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';

/* Index for Foreign Keys for FinanceExceptionType */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Finance Exception Types
-- Item: Index for Foreign Keys
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------;

/* Base View SQL for MJ_BizApps_Accounting: Finance Exception Types */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Finance Exception Types
-- Item: vwFinanceExceptionTypes
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- BASE VIEW FOR ENTITY:      MJ_BizApps_Accounting: Finance Exception Types
-----               SCHEMA:      ${flyway:defaultSchema}
-----               BASE TABLE:  FinanceExceptionType
-----               PRIMARY KEY: ID
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[vwFinanceExceptionTypes]', 'V') IS NOT NULL
    DROP VIEW [${flyway:defaultSchema}].[vwFinanceExceptionTypes];
GO

CREATE VIEW [${flyway:defaultSchema}].[vwFinanceExceptionTypes]
AS
SELECT
    f.*
FROM
    [${flyway:defaultSchema}].[FinanceExceptionType] AS f
GO
GRANT SELECT ON [${flyway:defaultSchema}].[vwFinanceExceptionTypes] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* Base View Permissions SQL for MJ_BizApps_Accounting: Finance Exception Types */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Finance Exception Types
-- Item: Permissions for vwFinanceExceptionTypes
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

GRANT SELECT ON [${flyway:defaultSchema}].[vwFinanceExceptionTypes] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* spCreate SQL for MJ_BizApps_Accounting: Finance Exception Types */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Finance Exception Types
-- Item: spCreateFinanceExceptionType
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- CREATE PROCEDURE FOR FinanceExceptionType
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spCreateFinanceExceptionType]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spCreateFinanceExceptionType];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spCreateFinanceExceptionType]
    @ID uniqueidentifier = NULL,
    @Code nvarchar(60),
    @Name nvarchar(100),
    @Description_Clear bit = 0,
    @Description nvarchar(MAX) = NULL,
    @OwningApp nvarchar(100),
    @IsActive bit = NULL,
    @Configuration nvarchar(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @InsertedRow TABLE ([ID] UNIQUEIDENTIFIER)

    IF @ID IS NOT NULL
    BEGIN
        -- User provided a value, use it
        INSERT INTO [${flyway:defaultSchema}].[FinanceExceptionType]
            (
                [ID],
                [Code],
                [Name],
                [Description],
                [OwningApp],
                [IsActive],
                [Configuration]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @ID,
                @Code,
                @Name,
                CASE WHEN @Description_Clear = 1 THEN NULL ELSE ISNULL(@Description, NULL) END,
                @OwningApp,
                ISNULL(@IsActive, 1),
                ISNULL(@Configuration, '{}')
            )
    END
    ELSE
    BEGIN
        -- No value provided, let database use its default (e.g., NEWSEQUENTIALID())
        INSERT INTO [${flyway:defaultSchema}].[FinanceExceptionType]
            (
                [Code],
                [Name],
                [Description],
                [OwningApp],
                [IsActive],
                [Configuration]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @Code,
                @Name,
                CASE WHEN @Description_Clear = 1 THEN NULL ELSE ISNULL(@Description, NULL) END,
                @OwningApp,
                ISNULL(@IsActive, 1),
                ISNULL(@Configuration, '{}')
            )
    END
    -- return the new record from the base view, which might have some calculated fields
    SELECT * FROM [${flyway:defaultSchema}].[vwFinanceExceptionTypes] WHERE [ID] = (SELECT [ID] FROM @InsertedRow)
END
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateFinanceExceptionType] TO [cdp_Developer], [cdp_Integration];

/* spCreate Permissions for MJ_BizApps_Accounting: Finance Exception Types */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateFinanceExceptionType] TO [cdp_Developer], [cdp_Integration];

/* spUpdate SQL for MJ_BizApps_Accounting: Finance Exception Types */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Finance Exception Types
-- Item: spUpdateFinanceExceptionType
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- UPDATE PROCEDURE FOR FinanceExceptionType
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spUpdateFinanceExceptionType]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spUpdateFinanceExceptionType];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spUpdateFinanceExceptionType]
    @ID uniqueidentifier,
    @Code nvarchar(60) = NULL,
    @Name nvarchar(100) = NULL,
    @Description_Clear bit = 0,
    @Description nvarchar(MAX) = NULL,
    @OwningApp nvarchar(100) = NULL,
    @IsActive bit = NULL,
    @Configuration nvarchar(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[FinanceExceptionType]
    SET
        [Code] = ISNULL(@Code, [Code]),
        [Name] = ISNULL(@Name, [Name]),
        [Description] = CASE WHEN @Description_Clear = 1 THEN NULL ELSE ISNULL(@Description, [Description]) END,
        [OwningApp] = ISNULL(@OwningApp, [OwningApp]),
        [IsActive] = ISNULL(@IsActive, [IsActive]),
        [Configuration] = ISNULL(@Configuration, [Configuration])
    WHERE
        [ID] = @ID

    -- Check if the update was successful
    IF @@ROWCOUNT = 0
        -- Nothing was updated, return no rows, but column structure from base view intact, semantically correct this way.
        SELECT TOP 0 * FROM [${flyway:defaultSchema}].[vwFinanceExceptionTypes] WHERE 1=0
    ELSE
        -- Return the updated record so the caller can see the updated values and any calculated fields
        SELECT
                                        *
                                    FROM
                                        [${flyway:defaultSchema}].[vwFinanceExceptionTypes]
                                    WHERE
                                        [ID] = @ID
                                    
END
GO

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateFinanceExceptionType] TO [cdp_Developer], [cdp_Integration]
GO

------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the FinanceExceptionType table
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[trgUpdateFinanceExceptionType]', 'TR') IS NOT NULL
    DROP TRIGGER [${flyway:defaultSchema}].[trgUpdateFinanceExceptionType];
GO
CREATE TRIGGER [${flyway:defaultSchema}].trgUpdateFinanceExceptionType
ON [${flyway:defaultSchema}].[FinanceExceptionType]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[FinanceExceptionType]
    SET
        __mj_UpdatedAt = GETUTCDATE()
    FROM
        [${flyway:defaultSchema}].[FinanceExceptionType] AS _organicTable
    INNER JOIN
        INSERTED AS I ON
        _organicTable.[ID] = I.[ID];
END;
GO

/* spUpdate Permissions for MJ_BizApps_Accounting: Finance Exception Types */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateFinanceExceptionType] TO [cdp_Developer], [cdp_Integration];

/* spDelete SQL for MJ_BizApps_Accounting: Finance Exception Types */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Finance Exception Types
-- Item: spDeleteFinanceExceptionType
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- DELETE PROCEDURE FOR FinanceExceptionType
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spDeleteFinanceExceptionType]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spDeleteFinanceExceptionType];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spDeleteFinanceExceptionType]
    @ID uniqueidentifier
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM
        [${flyway:defaultSchema}].[FinanceExceptionType]
    WHERE
        [ID] = @ID


    -- Check if the delete was successful
    IF @@ROWCOUNT = 0
        SELECT NULL AS [ID] -- Return NULL for all primary key fields to indicate no record was deleted
    ELSE
        SELECT @ID AS [ID] -- Return the primary key values to indicate we successfully deleted the record
END
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteFinanceExceptionType] TO [cdp_Developer], [cdp_Integration];

/* spDelete Permissions for MJ_BizApps_Accounting: Finance Exception Types */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteFinanceExceptionType] TO [cdp_Developer], [cdp_Integration];

/* Index for Foreign Keys for FinanceException */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Finance Exceptions
-- Item: Index for Foreign Keys
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------
-- Index for foreign key FinanceExceptionTypeID in table FinanceException
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_FinanceException_FinanceExceptionTypeID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[FinanceException]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_FinanceException_FinanceExceptionTypeID ON [${flyway:defaultSchema}].[FinanceException] ([FinanceExceptionTypeID]);

-- Index for foreign key SourceEntityID in table FinanceException
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_FinanceException_SourceEntityID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[FinanceException]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_FinanceException_SourceEntityID ON [${flyway:defaultSchema}].[FinanceException] ([SourceEntityID]);

-- Index for foreign key CompanyID in table FinanceException
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_FinanceException_CompanyID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[FinanceException]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_FinanceException_CompanyID ON [${flyway:defaultSchema}].[FinanceException] ([CompanyID]);

-- Index for foreign key SourceCreatedByUserID in table FinanceException
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_FinanceException_SourceCreatedByUserID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[FinanceException]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_FinanceException_SourceCreatedByUserID ON [${flyway:defaultSchema}].[FinanceException] ([SourceCreatedByUserID]);

-- Index for foreign key ReviewedByUserID in table FinanceException
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_FinanceException_ReviewedByUserID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[FinanceException]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_FinanceException_ReviewedByUserID ON [${flyway:defaultSchema}].[FinanceException] ([ReviewedByUserID]);

/* SQL text to update entity field related entity name field map for entity field ID F9B999EB-B563-44BE-9A7D-742757703470 */
EXEC [${mjSchema}].[spUpdateEntityFieldRelatedEntityNameFieldMap] @EntityFieldID='F9B999EB-B563-44BE-9A7D-742757703470', @RelatedEntityNameFieldMap='FinanceExceptionType';

/* SQL text to update entity field related entity name field map for entity field ID 3492339B-1B92-4333-A26B-C363C426176F */
EXEC [${mjSchema}].[spUpdateEntityFieldRelatedEntityNameFieldMap] @EntityFieldID='3492339B-1B92-4333-A26B-C363C426176F', @RelatedEntityNameFieldMap='SourceEntity';

/* SQL text to update entity field related entity name field map for entity field ID EFF056DC-206C-4763-87B9-998095B62412 */
EXEC [${mjSchema}].[spUpdateEntityFieldRelatedEntityNameFieldMap] @EntityFieldID='EFF056DC-206C-4763-87B9-998095B62412', @RelatedEntityNameFieldMap='Company';

/* SQL text to update entity field related entity name field map for entity field ID B97DCD2E-3201-4BCB-BDCE-0A261C721B0C */
EXEC [${mjSchema}].[spUpdateEntityFieldRelatedEntityNameFieldMap] @EntityFieldID='B97DCD2E-3201-4BCB-BDCE-0A261C721B0C', @RelatedEntityNameFieldMap='SourceCreatedByUser';

/* SQL text to update entity field related entity name field map for entity field ID B3795610-5A42-4262-8688-B2E67FC16B0A */
EXEC [${mjSchema}].[spUpdateEntityFieldRelatedEntityNameFieldMap] @EntityFieldID='B3795610-5A42-4262-8688-B2E67FC16B0A', @RelatedEntityNameFieldMap='ReviewedByUser';

/* Base View SQL for MJ_BizApps_Accounting: Finance Exceptions */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Finance Exceptions
-- Item: vwFinanceExceptions
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- BASE VIEW FOR ENTITY:      MJ_BizApps_Accounting: Finance Exceptions
-----               SCHEMA:      ${flyway:defaultSchema}
-----               BASE TABLE:  FinanceException
-----               PRIMARY KEY: ID
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[vwFinanceExceptions]', 'V') IS NOT NULL
    DROP VIEW [${flyway:defaultSchema}].[vwFinanceExceptions];
GO

CREATE VIEW [${flyway:defaultSchema}].[vwFinanceExceptions]
AS
SELECT
    f.*,
    mjBizAppsAccountingFinanceExceptionType_FinanceExceptionTypeID.[Name] AS [FinanceExceptionType],
    MJEntity_SourceEntityID.[Name] AS [SourceEntity],
    MJCompany_CompanyID.[Name] AS [Company],
    MJUser_SourceCreatedByUserID.[Name] AS [SourceCreatedByUser],
    MJUser_ReviewedByUserID.[Name] AS [ReviewedByUser]
FROM
    [${flyway:defaultSchema}].[FinanceException] AS f
INNER JOIN
    [${flyway:defaultSchema}].[FinanceExceptionType] AS mjBizAppsAccountingFinanceExceptionType_FinanceExceptionTypeID
  ON
    [f].[FinanceExceptionTypeID] = mjBizAppsAccountingFinanceExceptionType_FinanceExceptionTypeID.[ID]
INNER JOIN
    [${mjSchema}].[Entity] AS MJEntity_SourceEntityID
  ON
    [f].[SourceEntityID] = MJEntity_SourceEntityID.[ID]
INNER JOIN
    [${mjSchema}].[Company] AS MJCompany_CompanyID
  ON
    [f].[CompanyID] = MJCompany_CompanyID.[ID]
LEFT OUTER JOIN
    [${mjSchema}].[User] AS MJUser_SourceCreatedByUserID
  ON
    [f].[SourceCreatedByUserID] = MJUser_SourceCreatedByUserID.[ID]
LEFT OUTER JOIN
    [${mjSchema}].[User] AS MJUser_ReviewedByUserID
  ON
    [f].[ReviewedByUserID] = MJUser_ReviewedByUserID.[ID]
GO
GRANT SELECT ON [${flyway:defaultSchema}].[vwFinanceExceptions] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* Base View Permissions SQL for MJ_BizApps_Accounting: Finance Exceptions */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Finance Exceptions
-- Item: Permissions for vwFinanceExceptions
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

GRANT SELECT ON [${flyway:defaultSchema}].[vwFinanceExceptions] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* spCreate SQL for MJ_BizApps_Accounting: Finance Exceptions */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Finance Exceptions
-- Item: spCreateFinanceException
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- CREATE PROCEDURE FOR FinanceException
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spCreateFinanceException]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spCreateFinanceException];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spCreateFinanceException]
    @ID uniqueidentifier = NULL,
    @FinanceExceptionTypeID uniqueidentifier,
    @SourceEntityID uniqueidentifier,
    @SourceRecordID nvarchar(450),
    @CompanyID uniqueidentifier,
    @Amount_Clear bit = 0,
    @Amount decimal(19, 4) = NULL,
    @ExceptionDate date,
    @DetectedAt datetimeoffset = NULL,
    @Summary nvarchar(1000),
    @DedupeKey nvarchar(400),
    @SourceCreatedByUserID_Clear bit = 0,
    @SourceCreatedByUserID uniqueidentifier = NULL,
    @CreatorUnresolved bit = NULL,
    @Status nvarchar(20) = NULL,
    @ReviewedByUserID_Clear bit = 0,
    @ReviewedByUserID uniqueidentifier = NULL,
    @ReviewedAt_Clear bit = 0,
    @ReviewedAt datetimeoffset = NULL,
    @ReviewNote_Clear bit = 0,
    @ReviewNote nvarchar(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @InsertedRow TABLE ([ID] UNIQUEIDENTIFIER)

    IF @ID IS NOT NULL
    BEGIN
        -- User provided a value, use it
        INSERT INTO [${flyway:defaultSchema}].[FinanceException]
            (
                [ID],
                [FinanceExceptionTypeID],
                [SourceEntityID],
                [SourceRecordID],
                [CompanyID],
                [Amount],
                [ExceptionDate],
                [DetectedAt],
                [Summary],
                [DedupeKey],
                [SourceCreatedByUserID],
                [CreatorUnresolved],
                [Status],
                [ReviewedByUserID],
                [ReviewedAt],
                [ReviewNote]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @ID,
                @FinanceExceptionTypeID,
                @SourceEntityID,
                @SourceRecordID,
                @CompanyID,
                CASE WHEN @Amount_Clear = 1 THEN NULL ELSE ISNULL(@Amount, NULL) END,
                @ExceptionDate,
                ISNULL(@DetectedAt, sysdatetimeoffset()),
                @Summary,
                @DedupeKey,
                CASE WHEN @SourceCreatedByUserID_Clear = 1 THEN NULL ELSE ISNULL(@SourceCreatedByUserID, NULL) END,
                ISNULL(@CreatorUnresolved, 0),
                ISNULL(@Status, 'Open'),
                CASE WHEN @ReviewedByUserID_Clear = 1 THEN NULL ELSE ISNULL(@ReviewedByUserID, NULL) END,
                CASE WHEN @ReviewedAt_Clear = 1 THEN NULL ELSE ISNULL(@ReviewedAt, NULL) END,
                CASE WHEN @ReviewNote_Clear = 1 THEN NULL ELSE ISNULL(@ReviewNote, NULL) END
            )
    END
    ELSE
    BEGIN
        -- No value provided, let database use its default (e.g., NEWSEQUENTIALID())
        INSERT INTO [${flyway:defaultSchema}].[FinanceException]
            (
                [FinanceExceptionTypeID],
                [SourceEntityID],
                [SourceRecordID],
                [CompanyID],
                [Amount],
                [ExceptionDate],
                [DetectedAt],
                [Summary],
                [DedupeKey],
                [SourceCreatedByUserID],
                [CreatorUnresolved],
                [Status],
                [ReviewedByUserID],
                [ReviewedAt],
                [ReviewNote]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @FinanceExceptionTypeID,
                @SourceEntityID,
                @SourceRecordID,
                @CompanyID,
                CASE WHEN @Amount_Clear = 1 THEN NULL ELSE ISNULL(@Amount, NULL) END,
                @ExceptionDate,
                ISNULL(@DetectedAt, sysdatetimeoffset()),
                @Summary,
                @DedupeKey,
                CASE WHEN @SourceCreatedByUserID_Clear = 1 THEN NULL ELSE ISNULL(@SourceCreatedByUserID, NULL) END,
                ISNULL(@CreatorUnresolved, 0),
                ISNULL(@Status, 'Open'),
                CASE WHEN @ReviewedByUserID_Clear = 1 THEN NULL ELSE ISNULL(@ReviewedByUserID, NULL) END,
                CASE WHEN @ReviewedAt_Clear = 1 THEN NULL ELSE ISNULL(@ReviewedAt, NULL) END,
                CASE WHEN @ReviewNote_Clear = 1 THEN NULL ELSE ISNULL(@ReviewNote, NULL) END
            )
    END
    -- return the new record from the base view, which might have some calculated fields
    SELECT * FROM [${flyway:defaultSchema}].[vwFinanceExceptions] WHERE [ID] = (SELECT [ID] FROM @InsertedRow)
END
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateFinanceException] TO [cdp_Developer], [cdp_Integration];

/* spCreate Permissions for MJ_BizApps_Accounting: Finance Exceptions */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateFinanceException] TO [cdp_Developer], [cdp_Integration];

/* spUpdate SQL for MJ_BizApps_Accounting: Finance Exceptions */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Finance Exceptions
-- Item: spUpdateFinanceException
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- UPDATE PROCEDURE FOR FinanceException
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spUpdateFinanceException]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spUpdateFinanceException];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spUpdateFinanceException]
    @ID uniqueidentifier,
    @FinanceExceptionTypeID uniqueidentifier = NULL,
    @SourceEntityID uniqueidentifier = NULL,
    @SourceRecordID nvarchar(450) = NULL,
    @CompanyID uniqueidentifier = NULL,
    @Amount_Clear bit = 0,
    @Amount decimal(19, 4) = NULL,
    @ExceptionDate date = NULL,
    @DetectedAt datetimeoffset = NULL,
    @Summary nvarchar(1000) = NULL,
    @DedupeKey nvarchar(400) = NULL,
    @SourceCreatedByUserID_Clear bit = 0,
    @SourceCreatedByUserID uniqueidentifier = NULL,
    @CreatorUnresolved bit = NULL,
    @Status nvarchar(20) = NULL,
    @ReviewedByUserID_Clear bit = 0,
    @ReviewedByUserID uniqueidentifier = NULL,
    @ReviewedAt_Clear bit = 0,
    @ReviewedAt datetimeoffset = NULL,
    @ReviewNote_Clear bit = 0,
    @ReviewNote nvarchar(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[FinanceException]
    SET
        [FinanceExceptionTypeID] = ISNULL(@FinanceExceptionTypeID, [FinanceExceptionTypeID]),
        [SourceEntityID] = ISNULL(@SourceEntityID, [SourceEntityID]),
        [SourceRecordID] = ISNULL(@SourceRecordID, [SourceRecordID]),
        [CompanyID] = ISNULL(@CompanyID, [CompanyID]),
        [Amount] = CASE WHEN @Amount_Clear = 1 THEN NULL ELSE ISNULL(@Amount, [Amount]) END,
        [ExceptionDate] = ISNULL(@ExceptionDate, [ExceptionDate]),
        [DetectedAt] = ISNULL(@DetectedAt, [DetectedAt]),
        [Summary] = ISNULL(@Summary, [Summary]),
        [DedupeKey] = ISNULL(@DedupeKey, [DedupeKey]),
        [SourceCreatedByUserID] = CASE WHEN @SourceCreatedByUserID_Clear = 1 THEN NULL ELSE ISNULL(@SourceCreatedByUserID, [SourceCreatedByUserID]) END,
        [CreatorUnresolved] = ISNULL(@CreatorUnresolved, [CreatorUnresolved]),
        [Status] = ISNULL(@Status, [Status]),
        [ReviewedByUserID] = CASE WHEN @ReviewedByUserID_Clear = 1 THEN NULL ELSE ISNULL(@ReviewedByUserID, [ReviewedByUserID]) END,
        [ReviewedAt] = CASE WHEN @ReviewedAt_Clear = 1 THEN NULL ELSE ISNULL(@ReviewedAt, [ReviewedAt]) END,
        [ReviewNote] = CASE WHEN @ReviewNote_Clear = 1 THEN NULL ELSE ISNULL(@ReviewNote, [ReviewNote]) END
    WHERE
        [ID] = @ID

    -- Check if the update was successful
    IF @@ROWCOUNT = 0
        -- Nothing was updated, return no rows, but column structure from base view intact, semantically correct this way.
        SELECT TOP 0 * FROM [${flyway:defaultSchema}].[vwFinanceExceptions] WHERE 1=0
    ELSE
        -- Return the updated record so the caller can see the updated values and any calculated fields
        SELECT
                                        *
                                    FROM
                                        [${flyway:defaultSchema}].[vwFinanceExceptions]
                                    WHERE
                                        [ID] = @ID
                                    
END
GO

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateFinanceException] TO [cdp_Developer], [cdp_Integration]
GO

------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the FinanceException table
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[trgUpdateFinanceException]', 'TR') IS NOT NULL
    DROP TRIGGER [${flyway:defaultSchema}].[trgUpdateFinanceException];
GO
CREATE TRIGGER [${flyway:defaultSchema}].trgUpdateFinanceException
ON [${flyway:defaultSchema}].[FinanceException]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[FinanceException]
    SET
        __mj_UpdatedAt = GETUTCDATE()
    FROM
        [${flyway:defaultSchema}].[FinanceException] AS _organicTable
    INNER JOIN
        INSERTED AS I ON
        _organicTable.[ID] = I.[ID];
END;
GO

/* spUpdate Permissions for MJ_BizApps_Accounting: Finance Exceptions */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateFinanceException] TO [cdp_Developer], [cdp_Integration];

/* spDelete SQL for MJ_BizApps_Accounting: Finance Exceptions */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Finance Exceptions
-- Item: spDeleteFinanceException
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- DELETE PROCEDURE FOR FinanceException
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spDeleteFinanceException]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spDeleteFinanceException];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spDeleteFinanceException]
    @ID uniqueidentifier
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM
        [${flyway:defaultSchema}].[FinanceException]
    WHERE
        [ID] = @ID


    -- Check if the delete was successful
    IF @@ROWCOUNT = 0
        SELECT NULL AS [ID] -- Return NULL for all primary key fields to indicate no record was deleted
    ELSE
        SELECT @ID AS [ID] -- Return the primary key values to indicate we successfully deleted the record
END
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteFinanceException] TO [cdp_Developer], [cdp_Integration];

/* spDelete Permissions for MJ_BizApps_Accounting: Finance Exceptions */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteFinanceException] TO [cdp_Developer], [cdp_Integration];

/* SQL text to delete unneeded entity fields (2 scoped entities) */
EXEC [${mjSchema}].[spDeleteUnneededEntityFields] @ExcludedSchemaNames='', @EntityIDs='57FD0C9B-C308-41A4-988A-E4C378A9803D,25D46762-4EA5-4FD5-A99F-F5870F72164C', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to insert 5 new entity field(s) */

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'a25ecc57-5b6d-449c-bf73-ce93d635e89f' OR (EntityID = '25D46762-4EA5-4FD5-A99F-F5870F72164C' AND Name = 'FinanceExceptionType')) BEGIN
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
            'a25ecc57-5b6d-449c-bf73-ce93d635e89f',
            '25D46762-4EA5-4FD5-A99F-F5870F72164C', -- Entity: MJ_BizApps_Accounting: Finance Exceptions
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '25D46762-4EA5-4FD5-A99F-F5870F72164C'),
            'FinanceExceptionType',
            'Finance Exception Type',
            NULL,
            'nvarchar',
            200,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '1cea1e60-0147-4bcf-94bc-389b83a78e21' OR (EntityID = '25D46762-4EA5-4FD5-A99F-F5870F72164C' AND Name = 'SourceEntity')) BEGIN
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
            '1cea1e60-0147-4bcf-94bc-389b83a78e21',
            '25D46762-4EA5-4FD5-A99F-F5870F72164C', -- Entity: MJ_BizApps_Accounting: Finance Exceptions
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '25D46762-4EA5-4FD5-A99F-F5870F72164C'),
            'SourceEntity',
            'Source Entity',
            NULL,
            'nvarchar',
            510,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'f5179ceb-585b-4ef7-aec0-de159322456c' OR (EntityID = '25D46762-4EA5-4FD5-A99F-F5870F72164C' AND Name = 'Company')) BEGIN
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
            'f5179ceb-585b-4ef7-aec0-de159322456c',
            '25D46762-4EA5-4FD5-A99F-F5870F72164C', -- Entity: MJ_BizApps_Accounting: Finance Exceptions
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '25D46762-4EA5-4FD5-A99F-F5870F72164C'),
            'Company',
            'Company',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '8de52f2d-9111-4dd1-b275-d079dcd2b122' OR (EntityID = '25D46762-4EA5-4FD5-A99F-F5870F72164C' AND Name = 'SourceCreatedByUser')) BEGIN
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
            '8de52f2d-9111-4dd1-b275-d079dcd2b122',
            '25D46762-4EA5-4FD5-A99F-F5870F72164C', -- Entity: MJ_BizApps_Accounting: Finance Exceptions
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '25D46762-4EA5-4FD5-A99F-F5870F72164C'),
            'SourceCreatedByUser',
            'Source Created By User',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '710d67a5-5d51-43ad-94fc-f8a7a25eb5c1' OR (EntityID = '25D46762-4EA5-4FD5-A99F-F5870F72164C' AND Name = 'ReviewedByUser')) BEGIN
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
            '710d67a5-5d51-43ad-94fc-f8a7a25eb5c1',
            '25D46762-4EA5-4FD5-A99F-F5870F72164C', -- Entity: MJ_BizApps_Accounting: Finance Exceptions
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '25D46762-4EA5-4FD5-A99F-F5870F72164C'),
            'ReviewedByUser',
            'Reviewed By User',
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

/* SQL text to update existing entity fields from schema (2 scoped entities) */
EXEC [${mjSchema}].[spUpdateExistingEntityFieldsFromSchema] @ExcludedSchemaNames='', @EntityIDs='57FD0C9B-C308-41A4-988A-E4C378A9803D,25D46762-4EA5-4FD5-A99F-F5870F72164C', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to set default column width where needed */
EXEC [${mjSchema}].[spSetDefaultColumnWidthWhereNeeded] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';
