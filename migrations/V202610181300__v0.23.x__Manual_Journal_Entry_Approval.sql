-- =============================================================================
-- Migration: V202610181300__v0.23.x__Manual_Journal_Entry_Approval.sql
-- Description: approval of manual journal entries before they can be batched
--              (bc-aidp-next-golive#353, from #320 §3).
-- =============================================================================
--
-- WHY
--
-- Manual journal entries (LinkedEntityID/LinkedRecordID both NULL, D25) are
-- created by people, not by a booking path, and today join the next batch as
-- soon as they are Pending. Finance's approval rules need them approved first:
-- a manual entry up to a per-company amount by an approver role; above it, or
-- touching a control account at any amount, by the company's Approval CFO; and
-- never by the person who created it.
--
-- WHAT CHANGES
--
-- GLAccount.IsControlAccount (BIT, default 0): the accounts whose manual entries
-- always need the company's Approval CFO (AR, deferred revenue, unbilled,
-- customer deposits, cash, and any account the company names).
--
-- AccountingCompanyProfile.ManualJournalEntryApprovalThreshold (DECIMAL,
-- nullable): NULL switches manual-entry approval off for the company, so every
-- existing install behaves as before until a value is set. At or below it the
-- approver role decides; above it the Approval CFO.
-- AccountingCompanyProfile.ManualJournalEntryApproverRoleID (FK __mj.Role,
-- nullable): the role whose holders approve at or below the threshold. NULL
-- sends every manual entry to the Approval CFO while the threshold is set.
--
-- JournalEntry.ApprovalLevel ('Standard' | 'CFO', nullable): set when a manual
-- entry is created, or its amounts, accounts, date or company change, while its
-- company has a threshold. A non-NULL level IS "this entry needs approval": the
-- batch candidate filter excludes the entry until ApprovedAt is set. There is
-- deliberately no separate ApprovalRequired flag: it would only restate
-- "ApprovalLevel IS NOT NULL", and a BIT compared to a literal inside a CHECK
-- does not convert to PostgreSQL (the converter learns boolean columns from
-- CREATE TABLE only, so `= 0` on a column added here reaches PG as
-- boolean = integer).
-- JournalEntry.ApprovalRequestedByUserID (FK __mj.User): the user whose save
-- raised the approval, who may not approve it. JournalEntry.ApprovalTaskID
-- (FK Tasks): the stamped approval Task, read instead of a Task Link (#223).
-- ApprovedAt and ApprovedByUserID: the approval audit, both or neither, and
-- only on an entry that has an approval level.
--
-- CK_JournalEntry_ApprovedBeforeBatch is the database floor under the batch
-- engine's candidate filter: an entry that needs approval cannot carry a
-- JournalEntryBatchID until it is approved.
--
-- Existing rows: every new column is NULL or defaults to 0, so no existing
-- entry needs approval and nothing already Pending is held back. Every new
-- constraint holds for those values.
--
-- CODEGEN BLOCK: two CodeGen runs, appended in order. The first adds the new
-- columns' fields and objects; the second adds the Journal Entries name fields
-- (ApprovalRequestedByUser, ApprovalTask, ApprovedByUser), which CodeGen only
-- sees once the layered vwJournalEntries has been refreshed. CodeGen's
-- spDeleteUnneededEntityFields calls are left out, as
-- .github/scripts/check-migration-no-prune.mjs requires: on a replay they run
-- against an intermediate schema and delete live fields.
--
-- DETERMINISTIC, NOT IDEMPOTENT: this runs once, in order, against a database
-- that has the prior migrations.
-- =============================================================================

ALTER TABLE __mj_BizAppsAccounting.GLAccount
    ADD IsControlAccount BIT NOT NULL CONSTRAINT DF_GLAccount_IsControlAccount DEFAULT 0;
GO

ALTER TABLE __mj_BizAppsAccounting.AccountingCompanyProfile
    ADD ManualJournalEntryApprovalThreshold DECIMAL(19,4) NULL
            CONSTRAINT CK_AccountingCompanyProfile_ManualJEApprovalThreshold
            CHECK (ManualJournalEntryApprovalThreshold IS NULL OR ManualJournalEntryApprovalThreshold >= 0),
        ManualJournalEntryApproverRoleID UNIQUEIDENTIFIER NULL
            CONSTRAINT FK_AccountingCompanyProfile_ManualJEApproverRole REFERENCES __mj.Role(ID);
GO

ALTER TABLE __mj_BizAppsAccounting.JournalEntry
    ADD ApprovalLevel NVARCHAR(20) NULL
            CONSTRAINT CK_JournalEntry_ApprovalLevel CHECK (ApprovalLevel IN ('Standard','CFO')),
        ApprovalRequestedByUserID UNIQUEIDENTIFIER NULL
            CONSTRAINT FK_JournalEntry_ApprovalRequestedByUser REFERENCES __mj.[User](ID),
        ApprovalTaskID UNIQUEIDENTIFIER NULL
            CONSTRAINT FK_JournalEntry_ApprovalTask REFERENCES __mj_BizAppsTasks.Task(ID),
        ApprovedAt DATETIMEOFFSET NULL,
        ApprovedByUserID UNIQUEIDENTIFIER NULL
            CONSTRAINT FK_JournalEntry_ApprovedByUser REFERENCES __mj.[User](ID),
        CONSTRAINT CK_JournalEntry_ApprovalRequester CHECK (
            (ApprovalLevel IS NULL AND ApprovalRequestedByUserID IS NULL) OR
            (ApprovalLevel IS NOT NULL AND ApprovalRequestedByUserID IS NOT NULL)
        ),
        CONSTRAINT CK_JournalEntry_ApprovalAudit CHECK (
            (ApprovedAt IS NULL AND ApprovedByUserID IS NULL) OR
            (ApprovedAt IS NOT NULL AND ApprovedByUserID IS NOT NULL AND ApprovalLevel IS NOT NULL)
        ),
        CONSTRAINT CK_JournalEntry_ApprovedBeforeBatch CHECK (
            ApprovalLevel IS NULL OR ApprovedAt IS NOT NULL OR JournalEntryBatchID IS NULL
        );
GO

-- The Journal Entries entity's base view is the hand-written layer vwJournalEntries over CodeGen's
-- vwJournalEntriesGenerated (V202609202352). Both select `*`, which SQL Server binds when a view is
-- created, so neither shows the columns added above until it is refreshed. The CodeGen block below
-- syncs entity fields against vwJournalEntries BEFORE it recreates vwJournalEntriesGenerated; run
-- against stale views, that sync drops the new Journal Entry fields it has just inserted.
EXEC sp_refreshview N'__mj_BizAppsAccounting.vwJournalEntriesGenerated';
EXEC sp_refreshview N'__mj_BizAppsAccounting.vwJournalEntries';
GO

EXEC sp_addextendedproperty @name = N'MS_Description',
    @value = N'A control account (AR, deferred revenue, unbilled, customer deposits, cash, or any account the company names): a manual journal entry with a line on it always needs the company''s Approval CFO, whatever its amount. Default 0.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'GLAccount', @level2type = N'COLUMN', @level2name = N'IsControlAccount';
GO

EXEC sp_addextendedproperty @name = N'MS_Description',
    @value = N'The amount (total debits) at or below which a manual journal entry is approved by a holder of ManualJournalEntryApproverRoleID; above it, by the Approval CFO. NULL, the default, switches manual-entry approval off for this company: manual entries batch as before.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'AccountingCompanyProfile', @level2type = N'COLUMN', @level2name = N'ManualJournalEntryApprovalThreshold';
GO

EXEC sp_addextendedproperty @name = N'MS_Description',
    @value = N'The role whose holders approve a manual journal entry at or below ManualJournalEntryApprovalThreshold, never the entry''s creator. NULL sends every manual entry to the Approval CFO while the threshold is set.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'AccountingCompanyProfile', @level2type = N'COLUMN', @level2name = N'ManualJournalEntryApproverRoleID';
GO

EXEC sp_addextendedproperty @name = N'MS_Description',
    @value = N'Set when the entry needs approval: Standard (a holder of the company''s manual-entry approver role) or CFO (above the threshold, a line on a control account, or no other approver available). Set when a manual entry is created, or its amounts, accounts, date or company change, while its company has a ManualJournalEntryApprovalThreshold. An entry with a level is not a batch candidate until ApprovedAt is set. NULL: no approval needed.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntry', @level2type = N'COLUMN', @level2name = N'ApprovalLevel';
GO

EXEC sp_addextendedproperty @name = N'MS_Description',
    @value = N'The user whose save raised the current approval request: the creator, or whoever last changed the entry''s amounts, accounts, date or company. That user may not approve it. Set exactly when ApprovalLevel is.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntry', @level2type = N'COLUMN', @level2name = N'ApprovalRequestedByUserID';
GO

EXEC sp_addextendedproperty @name = N'MS_Description',
    @value = N'The approval Task raised for this manual entry, stamped in the same transaction. The approval is read from this column, never from a Task Link.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntry', @level2type = N'COLUMN', @level2name = N'ApprovalTaskID';
GO

EXEC sp_addextendedproperty @name = N'MS_Description',
    @value = N'When the manual entry was approved. Set together with ApprovedByUserID, only on an entry with an ApprovalLevel; cleared when the entry''s amounts, accounts, date or company change afterwards.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntry', @level2type = N'COLUMN', @level2name = N'ApprovedAt';
GO

EXEC sp_addextendedproperty @name = N'MS_Description',
    @value = N'The user who approved the manual entry: never ApprovalRequestedByUserID. Set together with ApprovedAt.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntry', @level2type = N'COLUMN', @level2name = N'ApprovedByUserID';
GO












































































-- =============================================================================
-- CODEGEN OUTPUT — GENERATED CODE BELOW THIS LINE. DO NOT EDIT BY HAND.
-- =============================================================================


/* SQL text to update existing entities from schema */
EXEC [${mjSchema}].[spUpdateExistingEntitiesFromSchema] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to insert 8 new entity field(s) */

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'dcae4c02-26ff-41e1-af26-9e379453e38c' OR (EntityID = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762' AND Name = 'ApprovalLevel')) BEGIN
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
            'dcae4c02-26ff-41e1-af26-9e379453e38c',
            'C040A1FC-16CE-49CB-B0E2-4F233BD0D762', -- Entity: MJ_BizApps_Accounting: Journal Entries
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762'),
            'ApprovalLevel',
            'Approval Level',
            'Set when the entry needs approval: Standard (a holder of the company''s manual-entry approver role) or CFO (above the threshold, a line on a control account, or no other approver available). Set when a manual entry is created, or its amounts, accounts, date or company change, while its company has a ManualJournalEntryApprovalThreshold. An entry with a level is not a batch candidate until ApprovedAt is set. NULL: no approval needed.',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'd2a395b8-61b0-4209-aa5e-c5e896b0c214' OR (EntityID = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762' AND Name = 'ApprovalRequestedByUserID')) BEGIN
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
            'd2a395b8-61b0-4209-aa5e-c5e896b0c214',
            'C040A1FC-16CE-49CB-B0E2-4F233BD0D762', -- Entity: MJ_BizApps_Accounting: Journal Entries
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762'),
            'ApprovalRequestedByUserID',
            'Approval Requested By User ID',
            'The user whose save raised the current approval request: the creator, or whoever last changed the entry''s amounts, accounts, date or company. That user may not approve it. Set exactly when ApprovalLevel is.',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '3b9807de-48e1-40cb-977d-f78c79b23d90' OR (EntityID = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762' AND Name = 'ApprovalTaskID')) BEGIN
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
            '3b9807de-48e1-40cb-977d-f78c79b23d90',
            'C040A1FC-16CE-49CB-B0E2-4F233BD0D762', -- Entity: MJ_BizApps_Accounting: Journal Entries
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762'),
            'ApprovalTaskID',
            'Approval Task ID',
            'The approval Task raised for this manual entry, stamped in the same transaction. The approval is read from this column, never from a Task Link.',
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
            'B348FFA2-B1A7-4AC2-B6FD-F4E0C0697466',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '9027a89c-ab6c-41fc-8636-943aba82ad8e' OR (EntityID = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762' AND Name = 'ApprovedAt')) BEGIN
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
            '9027a89c-ab6c-41fc-8636-943aba82ad8e',
            'C040A1FC-16CE-49CB-B0E2-4F233BD0D762', -- Entity: MJ_BizApps_Accounting: Journal Entries
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762'),
            'ApprovedAt',
            'Approved At',
            'When the manual entry was approved. Set together with ApprovedByUserID, only on an entry with an ApprovalLevel; cleared when the entry''s amounts, accounts, date or company change afterwards.',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '19391880-f1a2-424e-838e-97b3929b4fd6' OR (EntityID = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762' AND Name = 'ApprovedByUserID')) BEGIN
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
            '19391880-f1a2-424e-838e-97b3929b4fd6',
            'C040A1FC-16CE-49CB-B0E2-4F233BD0D762', -- Entity: MJ_BizApps_Accounting: Journal Entries
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762'),
            'ApprovedByUserID',
            'Approved By User ID',
            'The user who approved the manual entry: never ApprovalRequestedByUserID. Set together with ApprovedAt.',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'e4505aff-df19-41cd-bc3a-137341a72fbc' OR (EntityID = '690BE4C8-C8F2-4067-B48B-57C0671B05A5' AND Name = 'IsControlAccount')) BEGIN
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
            'e4505aff-df19-41cd-bc3a-137341a72fbc',
            '690BE4C8-C8F2-4067-B48B-57C0671B05A5', -- Entity: MJ_BizApps_Accounting: GL Accounts
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '690BE4C8-C8F2-4067-B48B-57C0671B05A5'),
            'IsControlAccount',
            'Is Control Account',
            'A control account (AR, deferred revenue, unbilled, customer deposits, cash, or any account the company names): a manual journal entry with a line on it always needs the company''s Approval CFO, whatever its amount. Default 0.',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'd3a4db04-71b4-48bc-84a1-8d6e29a5d4f1' OR (EntityID = '3E551198-AB66-478E-BEB6-C34EDBE242EC' AND Name = 'ManualJournalEntryApprovalThreshold')) BEGIN
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
            'd3a4db04-71b4-48bc-84a1-8d6e29a5d4f1',
            '3E551198-AB66-478E-BEB6-C34EDBE242EC', -- Entity: MJ_BizApps_Accounting: Accounting Company Profiles
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '3E551198-AB66-478E-BEB6-C34EDBE242EC'),
            'ManualJournalEntryApprovalThreshold',
            'Manual Journal Entry Approval Threshold',
            'The amount (total debits) at or below which a manual journal entry is approved by a holder of ManualJournalEntryApproverRoleID; above it, by the Approval CFO. NULL, the default, switches manual-entry approval off for this company: manual entries batch as before.',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '16e6dbc9-1e36-4a47-a70e-85ed192bd6a7' OR (EntityID = '3E551198-AB66-478E-BEB6-C34EDBE242EC' AND Name = 'ManualJournalEntryApproverRoleID')) BEGIN
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
            '16e6dbc9-1e36-4a47-a70e-85ed192bd6a7',
            '3E551198-AB66-478E-BEB6-C34EDBE242EC', -- Entity: MJ_BizApps_Accounting: Accounting Company Profiles
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '3E551198-AB66-478E-BEB6-C34EDBE242EC'),
            'ManualJournalEntryApproverRoleID',
            'Manual Journal Entry Approver Role ID',
            'The role whose holders approve a manual journal entry at or below ManualJournalEntryApprovalThreshold, never the entry''s creator. NULL sends every manual entry to the Approval CFO while the threshold is set.',
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
            'DA238F34-2837-EF11-86D4-6045BDEE16E6',
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
EXEC [${mjSchema}].[spUpdateExistingEntityFieldsFromSchema] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to set default column width where needed */
EXEC [${mjSchema}].[spSetDefaultColumnWidthWhereNeeded] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to insert entity field value with ID 53880bcb-0d93-4d27-9d1a-322aea998f7b */
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('53880bcb-0d93-4d27-9d1a-322aea998f7b', 'DCAE4C02-26FF-41E1-AF26-9E379453E38C', 1, 'CFO', 'CFO', GETUTCDATE(), GETUTCDATE());

/* SQL text to insert entity field value with ID 8f430f86-9f77-4f76-b582-8d34cb70d6d8 */
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('8f430f86-9f77-4f76-b582-8d34cb70d6d8', 'DCAE4C02-26FF-41E1-AF26-9E379453E38C', 2, 'Standard', 'Standard', GETUTCDATE(), GETUTCDATE());

/* SQL text to update ValueListType for entity field ID DCAE4C02-26FF-41E1-AF26-9E379453E38C */
UPDATE [${mjSchema}].[EntityField] SET ValueListType='List' WHERE ID='DCAE4C02-26FF-41E1-AF26-9E379453E38C';


/* Create Entity Relationship: MJ: Roles -> MJ_BizApps_Accounting: Accounting Company Profiles (One To Many via ManualJournalEntryApproverRoleID) */
   IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntityRelationship] WHERE [ID] = '0cf56726-2d88-4e3d-a3c7-ede4577586a4'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
                    VALUES ('0cf56726-2d88-4e3d-a3c7-ede4577586a4', 'DA238F34-2837-EF11-86D4-6045BDEE16E6', '3E551198-AB66-478E-BEB6-C34EDBE242EC', 'ManualJournalEntryApproverRoleID', 'One To Many', 1, 1, 18, GETUTCDATE(), GETUTCDATE())
   END;


/* Create Entity Relationship: MJ: Users -> MJ_BizApps_Accounting: Journal Entries (One To Many via ApprovalRequestedByUserID) */
   IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntityRelationship] WHERE [ID] = 'ad41de6b-3255-454e-9862-620958113139'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
                    VALUES ('ad41de6b-3255-454e-9862-620958113139', 'E1238F34-2837-EF11-86D4-6045BDEE16E6', 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762', 'ApprovalRequestedByUserID', 'One To Many', 1, 1, 119, GETUTCDATE(), GETUTCDATE())
   END;
                    
/* Create Entity Relationship: MJ: Users -> MJ_BizApps_Accounting: Journal Entries (One To Many via ApprovedByUserID) */
   IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntityRelationship] WHERE [ID] = '5e4f729f-e603-4217-98bc-c232daaf3978'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
                    VALUES ('5e4f729f-e603-4217-98bc-c232daaf3978', 'E1238F34-2837-EF11-86D4-6045BDEE16E6', 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762', 'ApprovedByUserID', 'One To Many', 1, 1, 120, GETUTCDATE(), GETUTCDATE())
   END;


/* Create Entity Relationship: MJ_BizApps_Tasks: Tasks -> MJ_BizApps_Accounting: Journal Entries (One To Many via ApprovalTaskID) */
   IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntityRelationship] WHERE [ID] = 'a503a88e-90a5-494f-8619-9a9991dc1d3e'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
                    VALUES ('a503a88e-90a5-494f-8619-9a9991dc1d3e', 'B348FFA2-B1A7-4AC2-B6FD-F4E0C0697466', 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762', 'ApprovalTaskID', 'One To Many', 1, 1, 12, GETUTCDATE(), GETUTCDATE())
   END;

/* SQL text to sync schema info from database schemas */
EXEC [${mjSchema}].[spUpdateSchemaInfoFromDatabase] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';

/* Index for Foreign Keys for AccountingCompanyProfile */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Accounting Company Profiles
-- Item: Index for Foreign Keys
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------
-- Index for foreign key FunctionalCurrencyCode in table AccountingCompanyProfile
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_AccountingCompanyProfile_FunctionalCurrencyCode' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[AccountingCompanyProfile]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_AccountingCompanyProfile_FunctionalCurrencyCode ON [${flyway:defaultSchema}].[AccountingCompanyProfile] ([FunctionalCurrencyCode]);

-- Index for foreign key ReportingCurrencyCode in table AccountingCompanyProfile
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_AccountingCompanyProfile_ReportingCurrencyCode' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[AccountingCompanyProfile]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_AccountingCompanyProfile_ReportingCurrencyCode ON [${flyway:defaultSchema}].[AccountingCompanyProfile] ([ReportingCurrencyCode]);

-- Index for foreign key ParentAccountingCompanyID in table AccountingCompanyProfile
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_AccountingCompanyProfile_ParentAccountingCompanyID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[AccountingCompanyProfile]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_AccountingCompanyProfile_ParentAccountingCompanyID ON [${flyway:defaultSchema}].[AccountingCompanyProfile] ([ParentAccountingCompanyID]);

-- Index for foreign key ApprovalCFOUserID in table AccountingCompanyProfile
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_AccountingCompanyProfile_ApprovalCFOUserID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[AccountingCompanyProfile]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_AccountingCompanyProfile_ApprovalCFOUserID ON [${flyway:defaultSchema}].[AccountingCompanyProfile] ([ApprovalCFOUserID]);

-- Index for foreign key ManualJournalEntryApproverRoleID in table AccountingCompanyProfile
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_AccountingCompanyProfile_ManualJournalEntryApproverRoleID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[AccountingCompanyProfile]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_AccountingCompanyProfile_ManualJournalEntryApproverRoleID ON [${flyway:defaultSchema}].[AccountingCompanyProfile] ([ManualJournalEntryApproverRoleID]);

/* SQL text to update entity field related entity name field map for entity field ID 16E6DBC9-1E36-4A47-A70E-85ED192BD6A7 */
EXEC [${mjSchema}].[spUpdateEntityFieldRelatedEntityNameFieldMap] @EntityFieldID='16E6DBC9-1E36-4A47-A70E-85ED192BD6A7', @RelatedEntityNameFieldMap='ManualJournalEntryApproverRole';

/* Hierarchy Metadata Function SQL for MJ_BizApps_Accounting: Accounting Company Profiles.ParentAccountingCompanyID */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Accounting Company Profiles
-- Item: fnAccountingCompanyProfileParentAccountingCompanyID_GetHierarchyMeta
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------
------------------------------------------------------------
----- HIERARCHY METADATA FUNCTION FOR: [AccountingCompanyProfile].[ParentAccountingCompanyID]
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[fnAccountingCompanyProfileParentAccountingCompanyID_GetHierarchyMeta]', 'IF') IS NOT NULL
    DROP FUNCTION [${flyway:defaultSchema}].[fnAccountingCompanyProfileParentAccountingCompanyID_GetHierarchyMeta];
GO

CREATE FUNCTION [${flyway:defaultSchema}].[fnAccountingCompanyProfileParentAccountingCompanyID_GetHierarchyMeta]
(
    @RecordID uniqueidentifier,
    @ParentID uniqueidentifier
)
RETURNS TABLE
AS
RETURN
(
    WITH CTE_Ancestors AS (
        SELECT
            [ID],
            [ParentAccountingCompanyID],
            0 AS [Depth],
            CAST('/' + CAST([ID] AS NVARCHAR(36)) + '/' AS NVARCHAR(MAX)) AS [Path]
        FROM
            [${flyway:defaultSchema}].[AccountingCompanyProfile]
        WHERE
            [ID] = @RecordID

        UNION ALL

        SELECT
            p.[ID],
            p.[ParentAccountingCompanyID],
            c.[Depth] + 1 AS [Depth],
            CAST('/' + CAST(p.[ID] AS NVARCHAR(36)) + c.[Path] AS NVARCHAR(MAX)) AS [Path]
        FROM
            [${flyway:defaultSchema}].[AccountingCompanyProfile] p
        INNER JOIN
            CTE_Ancestors c ON p.[ID] = c.[ParentAccountingCompanyID]
        WHERE
            c.[Depth] < 100
    )
    SELECT TOP 1
        a.[ID] AS [RootID],
        (SELECT MAX([Depth]) FROM CTE_Ancestors) AS [Depth],
        (SELECT TOP 1 [Path] FROM CTE_Ancestors ORDER BY [Depth] DESC) AS [Path],
        CAST(CASE WHEN EXISTS (SELECT 1 FROM [${flyway:defaultSchema}].[AccountingCompanyProfile] WHERE [ParentAccountingCompanyID] = @RecordID) THEN 0 ELSE 1 END AS BIT) AS [IsLeaf],
        (SELECT COUNT(1) FROM [${flyway:defaultSchema}].[AccountingCompanyProfile] WHERE [ParentAccountingCompanyID] = @RecordID) AS [ChildCount]
    FROM
        CTE_Ancestors a
    WHERE
        a.[ParentAccountingCompanyID] IS NULL OR @ParentID IS NULL
    ORDER BY
        a.[Depth] DESC
);
GO

/* Descendants Traversal Function SQL for MJ_BizApps_Accounting: Accounting Company Profiles.ParentAccountingCompanyID */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Accounting Company Profiles
-- Item: fnAccountingCompanyProfileParentAccountingCompanyID_GetDescendants
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------
------------------------------------------------------------
----- DESCENDANTS FUNCTION FOR: [AccountingCompanyProfile].[ParentAccountingCompanyID]
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[fnAccountingCompanyProfileParentAccountingCompanyID_GetDescendants]', 'IF') IS NOT NULL
    DROP FUNCTION [${flyway:defaultSchema}].[fnAccountingCompanyProfileParentAccountingCompanyID_GetDescendants];
GO

CREATE FUNCTION [${flyway:defaultSchema}].[fnAccountingCompanyProfileParentAccountingCompanyID_GetDescendants]
(
    @RootID uniqueidentifier,
    @MaxDepth INT = NULL
)
RETURNS TABLE
AS
RETURN
(
    WITH CTE_Descendants AS (
        SELECT
            [ID],
            [ParentAccountingCompanyID],
            0 AS [RelativeDepth],
            CAST('/' + CAST([ID] AS NVARCHAR(36)) + '/' AS NVARCHAR(MAX)) AS [Path]
        FROM
            [${flyway:defaultSchema}].[AccountingCompanyProfile]
        WHERE
            [ID] = @RootID

        UNION ALL

        SELECT
            c.[ID],
            c.[ParentAccountingCompanyID],
            p.[RelativeDepth] + 1 AS [RelativeDepth],
            CAST(p.[Path] + CAST(c.[ID] AS NVARCHAR(36)) + '/' AS NVARCHAR(MAX)) AS [Path]
        FROM
            [${flyway:defaultSchema}].[AccountingCompanyProfile] c
        INNER JOIN
            CTE_Descendants p ON c.[ParentAccountingCompanyID] = p.[ID]
        WHERE
            (@MaxDepth IS NULL OR p.[RelativeDepth] < @MaxDepth)
            AND p.[RelativeDepth] < 100
    )
    SELECT
        d.[ID] AS [ID],
        d.[RelativeDepth] AS [Depth],
        d.[Path],
        CAST(CASE WHEN EXISTS (SELECT 1 FROM [${flyway:defaultSchema}].[AccountingCompanyProfile] WHERE [ParentAccountingCompanyID] = d.[ID]) THEN 0 ELSE 1 END AS BIT) AS [IsLeaf],
        (SELECT COUNT(1) FROM [${flyway:defaultSchema}].[AccountingCompanyProfile] WHERE [ParentAccountingCompanyID] = d.[ID]) AS [ChildCount]
    FROM
        CTE_Descendants d
);
GO

/* Ancestors Traversal Function SQL for MJ_BizApps_Accounting: Accounting Company Profiles.ParentAccountingCompanyID */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Accounting Company Profiles
-- Item: fnAccountingCompanyProfileParentAccountingCompanyID_GetAncestors
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------
------------------------------------------------------------
----- ANCESTORS FUNCTION FOR: [AccountingCompanyProfile].[ParentAccountingCompanyID]
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[fnAccountingCompanyProfileParentAccountingCompanyID_GetAncestors]', 'IF') IS NOT NULL
    DROP FUNCTION [${flyway:defaultSchema}].[fnAccountingCompanyProfileParentAccountingCompanyID_GetAncestors];
GO

CREATE FUNCTION [${flyway:defaultSchema}].[fnAccountingCompanyProfileParentAccountingCompanyID_GetAncestors]
(
    @RecordID uniqueidentifier
)
RETURNS TABLE
AS
RETURN
(
    WITH CTE_Ancestors AS (
        SELECT
            [ID],
            [ParentAccountingCompanyID],
            0 AS [LevelUp],
            CAST('/' + CAST([ID] AS NVARCHAR(36)) + '/' AS NVARCHAR(MAX)) AS [Path]
        FROM
            [${flyway:defaultSchema}].[AccountingCompanyProfile]
        WHERE
            [ID] = @RecordID

        UNION ALL

        SELECT
            p.[ID],
            p.[ParentAccountingCompanyID],
            c.[LevelUp] + 1 AS [LevelUp],
            CAST('/' + CAST(p.[ID] AS NVARCHAR(36)) + c.[Path] AS NVARCHAR(MAX)) AS [Path]
        FROM
            [${flyway:defaultSchema}].[AccountingCompanyProfile] p
        INNER JOIN
            CTE_Ancestors c ON p.[ID] = c.[ParentAccountingCompanyID]
        WHERE
            c.[LevelUp] < 100
    )
    SELECT
        a.[ID] AS [ID],
        a.[LevelUp],
        a.[Path]
    FROM
        CTE_Ancestors a
);
GO

/* Root ID Function SQL for MJ_BizApps_Accounting: Accounting Company Profiles.ParentAccountingCompanyID */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Accounting Company Profiles
-- Item: fnAccountingCompanyProfileParentAccountingCompanyID_GetRootID
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------
------------------------------------------------------------
----- ROOT ID FUNCTION FOR: [AccountingCompanyProfile].[ParentAccountingCompanyID]
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[fnAccountingCompanyProfileParentAccountingCompanyID_GetRootID]', 'IF') IS NOT NULL
    DROP FUNCTION [${flyway:defaultSchema}].[fnAccountingCompanyProfileParentAccountingCompanyID_GetRootID];
GO

CREATE FUNCTION [${flyway:defaultSchema}].[fnAccountingCompanyProfileParentAccountingCompanyID_GetRootID]
(
    @RecordID uniqueidentifier,
    @ParentID uniqueidentifier
)
RETURNS TABLE
AS
RETURN
(
    WITH CTE_RootParent AS (
        SELECT
            [ID],
            [ParentAccountingCompanyID],
            [ID] AS [RootParentID],
            0 AS [Depth]
        FROM
            [${flyway:defaultSchema}].[AccountingCompanyProfile]
        WHERE
            [ID] = COALESCE(@ParentID, @RecordID)

        UNION ALL

        SELECT
            c.[ID],
            c.[ParentAccountingCompanyID],
            c.[ID] AS [RootParentID],
            p.[Depth] + 1 AS [Depth]
        FROM
            [${flyway:defaultSchema}].[AccountingCompanyProfile] c
        INNER JOIN
            CTE_RootParent p ON c.[ID] = p.[ParentAccountingCompanyID]
        WHERE
            p.[Depth] < 100
    )
    SELECT TOP 1
        [RootParentID] AS RootID
    FROM
        CTE_RootParent
    WHERE
        [ParentAccountingCompanyID] IS NULL
    ORDER BY
        [RootParentID]
);
GO

/* Base View SQL for MJ_BizApps_Accounting: Accounting Company Profiles */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Accounting Company Profiles
-- Item: vwAccountingCompanyProfiles
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- BASE VIEW FOR ENTITY:      MJ_BizApps_Accounting: Accounting Company Profiles
-----               SCHEMA:      ${flyway:defaultSchema}
-----               BASE TABLE:  AccountingCompanyProfile
-----               PRIMARY KEY: ID
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[vwAccountingCompanyProfiles]', 'V') IS NOT NULL
    DROP VIEW [${flyway:defaultSchema}].[vwAccountingCompanyProfiles];
GO

CREATE VIEW [${flyway:defaultSchema}].[vwAccountingCompanyProfiles]
AS
SELECT
    a.*,
    ${mjSchema}_isa_p1.[Name],
    ${mjSchema}_isa_p1.[Description],
    ${mjSchema}_isa_p1.[Website],
    ${mjSchema}_isa_p1.[LogoURL],
    ${mjSchema}_isa_p1.[Domain],
    mjBizAppsAccountingCurrency_FunctionalCurrencyCode.[Name] AS [FunctionalCurrencyCode_Virtual],
    mjBizAppsAccountingCurrency_ReportingCurrencyCode.[Name] AS [ReportingCurrencyCode_Virtual],
    MJUser_ApprovalCFOUserID.[Name] AS [ApprovalCFOUser],
    MJRole_ManualJournalEntryApproverRoleID.[Name] AS [ManualJournalEntryApproverRole],
    ${mjSchema}_rgc.[Latitude] AS [${mjSchema}_Latitude],
    ${mjSchema}_rgc.[Longitude] AS [${mjSchema}_Longitude],
    hier_ParentAccountingCompanyID.RootID AS [RootParentAccountingCompanyID],
    hier_ParentAccountingCompanyID.Depth AS [ParentAccountingCompanyIDDepth],
    hier_ParentAccountingCompanyID.Path AS [ParentAccountingCompanyIDPath],
    hier_ParentAccountingCompanyID.IsLeaf AS [ParentAccountingCompanyIDIsLeaf],
    hier_ParentAccountingCompanyID.ChildCount AS [ParentAccountingCompanyIDChildCount]
FROM
    [${flyway:defaultSchema}].[AccountingCompanyProfile] AS a
INNER JOIN
    [${mjSchema}].[Company] AS ${mjSchema}_isa_p1
  ON
    [a].[ID] = ${mjSchema}_isa_p1.[ID]
INNER JOIN
    [${flyway:defaultSchema}].[Currency] AS mjBizAppsAccountingCurrency_FunctionalCurrencyCode
  ON
    [a].[FunctionalCurrencyCode] = mjBizAppsAccountingCurrency_FunctionalCurrencyCode.[Code]
LEFT OUTER JOIN
    [${flyway:defaultSchema}].[Currency] AS mjBizAppsAccountingCurrency_ReportingCurrencyCode
  ON
    [a].[ReportingCurrencyCode] = mjBizAppsAccountingCurrency_ReportingCurrencyCode.[Code]
LEFT OUTER JOIN
    [${mjSchema}].[User] AS MJUser_ApprovalCFOUserID
  ON
    [a].[ApprovalCFOUserID] = MJUser_ApprovalCFOUserID.[ID]
LEFT OUTER JOIN
    [${mjSchema}].[Role] AS MJRole_ManualJournalEntryApproverRoleID
  ON
    [a].[ManualJournalEntryApproverRoleID] = MJRole_ManualJournalEntryApproverRoleID.[ID]
LEFT OUTER JOIN
    [${mjSchema}].[vwRecordGeoCodes] AS ${mjSchema}_rgc
  ON
    ${mjSchema}_rgc.[EntityID] = '3E551198-AB66-478E-BEB6-C34EDBE242EC'
    AND ${mjSchema}_rgc.[RecordID] = CAST([a].[ID] AS NVARCHAR(450))
    AND ${mjSchema}_rgc.[LocationType] = 'Primary'
OUTER APPLY
    [${flyway:defaultSchema}].[fnAccountingCompanyProfileParentAccountingCompanyID_GetHierarchyMeta]([a].[ID], [a].[ParentAccountingCompanyID]) AS hier_ParentAccountingCompanyID
GO
REVOKE SELECT ON [${flyway:defaultSchema}].[vwAccountingCompanyProfiles] FROM [cdp_Developer]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwAccountingCompanyProfiles] FROM [cdp_Integration]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwAccountingCompanyProfiles] FROM [cdp_UI]
GRANT SELECT ON [${flyway:defaultSchema}].[vwAccountingCompanyProfiles] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* Base View Permissions SQL for MJ_BizApps_Accounting: Accounting Company Profiles */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Accounting Company Profiles
-- Item: Permissions for vwAccountingCompanyProfiles
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

REVOKE SELECT ON [${flyway:defaultSchema}].[vwAccountingCompanyProfiles] FROM [cdp_Developer]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwAccountingCompanyProfiles] FROM [cdp_Integration]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwAccountingCompanyProfiles] FROM [cdp_UI]
GRANT SELECT ON [${flyway:defaultSchema}].[vwAccountingCompanyProfiles] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* spCreate SQL for MJ_BizApps_Accounting: Accounting Company Profiles */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Accounting Company Profiles
-- Item: spCreateAccountingCompanyProfile
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- CREATE PROCEDURE FOR AccountingCompanyProfile
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spCreateAccountingCompanyProfile]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spCreateAccountingCompanyProfile];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spCreateAccountingCompanyProfile]
    @ID uniqueidentifier = NULL,
    @EntityType nvarchar(30) = NULL,
    @LegalStructureType_Clear bit = 0,
    @LegalStructureType nvarchar(30) = NULL,
    @IncorporationDate_Clear bit = 0,
    @IncorporationDate date = NULL,
    @JurisdictionCountry_Clear bit = 0,
    @JurisdictionCountry char(2) = NULL,
    @JurisdictionRegion_Clear bit = 0,
    @JurisdictionRegion nvarchar(50) = NULL,
    @FederalTaxID_Clear bit = 0,
    @FederalTaxID nvarchar(40) = NULL,
    @OperatingTimeZone_Clear bit = 0,
    @OperatingTimeZone nvarchar(60) = NULL,
    @CompanyCode nvarchar(20),
    @FunctionalCurrencyCode char(3),
    @ReportingCurrencyCode_Clear bit = 0,
    @ReportingCurrencyCode char(3) = NULL,
    @FiscalYearStartMonth tinyint = NULL,
    @FiscalYearStartDay tinyint = NULL,
    @ParentAccountingCompanyID_Clear bit = 0,
    @ParentAccountingCompanyID uniqueidentifier = NULL,
    @ApprovalCFOUserID_Clear bit = 0,
    @ApprovalCFOUserID uniqueidentifier = NULL,
    @IsActive bit = NULL,
    @PostingStartDate_Clear bit = 0,
    @PostingStartDate date = NULL,
    @ManualJournalEntryApprovalThreshold_Clear bit = 0,
    @ManualJournalEntryApprovalThreshold decimal(19, 4) = NULL,
    @ManualJournalEntryApproverRoleID_Clear bit = 0,
    @ManualJournalEntryApproverRoleID uniqueidentifier = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @ActualID UNIQUEIDENTIFIER = ISNULL(@ID, NEWID())
    INSERT INTO
    [${flyway:defaultSchema}].[AccountingCompanyProfile]
        (
            [EntityType],
                [LegalStructureType],
                [IncorporationDate],
                [JurisdictionCountry],
                [JurisdictionRegion],
                [FederalTaxID],
                [OperatingTimeZone],
                [CompanyCode],
                [FunctionalCurrencyCode],
                [ReportingCurrencyCode],
                [FiscalYearStartMonth],
                [FiscalYearStartDay],
                [ParentAccountingCompanyID],
                [ApprovalCFOUserID],
                [IsActive],
                [PostingStartDate],
                [ManualJournalEntryApprovalThreshold],
                [ManualJournalEntryApproverRoleID],
                [ID]
        )
    VALUES
        (
            ISNULL(@EntityType, 'Subsidiary'),
                CASE WHEN @LegalStructureType_Clear = 1 THEN NULL ELSE ISNULL(@LegalStructureType, NULL) END,
                CASE WHEN @IncorporationDate_Clear = 1 THEN NULL ELSE ISNULL(@IncorporationDate, NULL) END,
                CASE WHEN @JurisdictionCountry_Clear = 1 THEN NULL ELSE ISNULL(@JurisdictionCountry, NULL) END,
                CASE WHEN @JurisdictionRegion_Clear = 1 THEN NULL ELSE ISNULL(@JurisdictionRegion, NULL) END,
                CASE WHEN @FederalTaxID_Clear = 1 THEN NULL ELSE ISNULL(@FederalTaxID, NULL) END,
                CASE WHEN @OperatingTimeZone_Clear = 1 THEN NULL ELSE ISNULL(@OperatingTimeZone, NULL) END,
                @CompanyCode,
                @FunctionalCurrencyCode,
                CASE WHEN @ReportingCurrencyCode_Clear = 1 THEN NULL ELSE ISNULL(@ReportingCurrencyCode, NULL) END,
                ISNULL(@FiscalYearStartMonth, 1),
                ISNULL(@FiscalYearStartDay, 1),
                CASE WHEN @ParentAccountingCompanyID_Clear = 1 THEN NULL ELSE ISNULL(@ParentAccountingCompanyID, NULL) END,
                CASE WHEN @ApprovalCFOUserID_Clear = 1 THEN NULL ELSE ISNULL(@ApprovalCFOUserID, NULL) END,
                ISNULL(@IsActive, 1),
                CASE WHEN @PostingStartDate_Clear = 1 THEN NULL ELSE ISNULL(@PostingStartDate, NULL) END,
                CASE WHEN @ManualJournalEntryApprovalThreshold_Clear = 1 THEN NULL ELSE ISNULL(@ManualJournalEntryApprovalThreshold, NULL) END,
                CASE WHEN @ManualJournalEntryApproverRoleID_Clear = 1 THEN NULL ELSE ISNULL(@ManualJournalEntryApproverRoleID, NULL) END,
                @ActualID
        )
    -- return the new record from the base view, which might have some calculated fields
    SELECT * FROM [${flyway:defaultSchema}].[vwAccountingCompanyProfiles] WHERE [ID] = @ActualID
END
GO
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateAccountingCompanyProfile] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateAccountingCompanyProfile] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateAccountingCompanyProfile] TO [cdp_Developer], [cdp_Integration];

/* spCreate Permissions for MJ_BizApps_Accounting: Accounting Company Profiles */

REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateAccountingCompanyProfile] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateAccountingCompanyProfile] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateAccountingCompanyProfile] TO [cdp_Developer], [cdp_Integration];

/* spUpdate SQL for MJ_BizApps_Accounting: Accounting Company Profiles */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Accounting Company Profiles
-- Item: spUpdateAccountingCompanyProfile
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- UPDATE PROCEDURE FOR AccountingCompanyProfile
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spUpdateAccountingCompanyProfile]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spUpdateAccountingCompanyProfile];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spUpdateAccountingCompanyProfile]
    @ID uniqueidentifier,
    @EntityType nvarchar(30) = NULL,
    @LegalStructureType_Clear bit = 0,
    @LegalStructureType nvarchar(30) = NULL,
    @IncorporationDate_Clear bit = 0,
    @IncorporationDate date = NULL,
    @JurisdictionCountry_Clear bit = 0,
    @JurisdictionCountry char(2) = NULL,
    @JurisdictionRegion_Clear bit = 0,
    @JurisdictionRegion nvarchar(50) = NULL,
    @FederalTaxID_Clear bit = 0,
    @FederalTaxID nvarchar(40) = NULL,
    @OperatingTimeZone_Clear bit = 0,
    @OperatingTimeZone nvarchar(60) = NULL,
    @CompanyCode nvarchar(20) = NULL,
    @FunctionalCurrencyCode char(3) = NULL,
    @ReportingCurrencyCode_Clear bit = 0,
    @ReportingCurrencyCode char(3) = NULL,
    @FiscalYearStartMonth tinyint = NULL,
    @FiscalYearStartDay tinyint = NULL,
    @ParentAccountingCompanyID_Clear bit = 0,
    @ParentAccountingCompanyID uniqueidentifier = NULL,
    @ApprovalCFOUserID_Clear bit = 0,
    @ApprovalCFOUserID uniqueidentifier = NULL,
    @IsActive bit = NULL,
    @PostingStartDate_Clear bit = 0,
    @PostingStartDate date = NULL,
    @ManualJournalEntryApprovalThreshold_Clear bit = 0,
    @ManualJournalEntryApprovalThreshold decimal(19, 4) = NULL,
    @ManualJournalEntryApproverRoleID_Clear bit = 0,
    @ManualJournalEntryApproverRoleID uniqueidentifier = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[AccountingCompanyProfile]
    SET
        [EntityType] = ISNULL(@EntityType, [EntityType]),
        [LegalStructureType] = CASE WHEN @LegalStructureType_Clear = 1 THEN NULL ELSE ISNULL(@LegalStructureType, [LegalStructureType]) END,
        [IncorporationDate] = CASE WHEN @IncorporationDate_Clear = 1 THEN NULL ELSE ISNULL(@IncorporationDate, [IncorporationDate]) END,
        [JurisdictionCountry] = CASE WHEN @JurisdictionCountry_Clear = 1 THEN NULL ELSE ISNULL(@JurisdictionCountry, [JurisdictionCountry]) END,
        [JurisdictionRegion] = CASE WHEN @JurisdictionRegion_Clear = 1 THEN NULL ELSE ISNULL(@JurisdictionRegion, [JurisdictionRegion]) END,
        [FederalTaxID] = CASE WHEN @FederalTaxID_Clear = 1 THEN NULL ELSE ISNULL(@FederalTaxID, [FederalTaxID]) END,
        [OperatingTimeZone] = CASE WHEN @OperatingTimeZone_Clear = 1 THEN NULL ELSE ISNULL(@OperatingTimeZone, [OperatingTimeZone]) END,
        [CompanyCode] = ISNULL(@CompanyCode, [CompanyCode]),
        [FunctionalCurrencyCode] = ISNULL(@FunctionalCurrencyCode, [FunctionalCurrencyCode]),
        [ReportingCurrencyCode] = CASE WHEN @ReportingCurrencyCode_Clear = 1 THEN NULL ELSE ISNULL(@ReportingCurrencyCode, [ReportingCurrencyCode]) END,
        [FiscalYearStartMonth] = ISNULL(@FiscalYearStartMonth, [FiscalYearStartMonth]),
        [FiscalYearStartDay] = ISNULL(@FiscalYearStartDay, [FiscalYearStartDay]),
        [ParentAccountingCompanyID] = CASE WHEN @ParentAccountingCompanyID_Clear = 1 THEN NULL ELSE ISNULL(@ParentAccountingCompanyID, [ParentAccountingCompanyID]) END,
        [ApprovalCFOUserID] = CASE WHEN @ApprovalCFOUserID_Clear = 1 THEN NULL ELSE ISNULL(@ApprovalCFOUserID, [ApprovalCFOUserID]) END,
        [IsActive] = ISNULL(@IsActive, [IsActive]),
        [PostingStartDate] = CASE WHEN @PostingStartDate_Clear = 1 THEN NULL ELSE ISNULL(@PostingStartDate, [PostingStartDate]) END,
        [ManualJournalEntryApprovalThreshold] = CASE WHEN @ManualJournalEntryApprovalThreshold_Clear = 1 THEN NULL ELSE ISNULL(@ManualJournalEntryApprovalThreshold, [ManualJournalEntryApprovalThreshold]) END,
        [ManualJournalEntryApproverRoleID] = CASE WHEN @ManualJournalEntryApproverRoleID_Clear = 1 THEN NULL ELSE ISNULL(@ManualJournalEntryApproverRoleID, [ManualJournalEntryApproverRoleID]) END
    WHERE
        [ID] = @ID

    -- Check if the update was successful
    IF @@ROWCOUNT = 0
        -- Nothing was updated, return no rows, but column structure from base view intact, semantically correct this way.
        SELECT TOP 0 * FROM [${flyway:defaultSchema}].[vwAccountingCompanyProfiles] WHERE 1=0
    ELSE
        -- Return the updated record so the caller can see the updated values and any calculated fields
        SELECT
                                        *
                                    FROM
                                        [${flyway:defaultSchema}].[vwAccountingCompanyProfiles]
                                    WHERE
                                        [ID] = @ID
                                    
END
GO

REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateAccountingCompanyProfile] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateAccountingCompanyProfile] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateAccountingCompanyProfile] TO [cdp_Developer], [cdp_Integration]
GO

------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the AccountingCompanyProfile table
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[trgUpdateAccountingCompanyProfile]', 'TR') IS NOT NULL
    DROP TRIGGER [${flyway:defaultSchema}].[trgUpdateAccountingCompanyProfile];
GO
CREATE TRIGGER [${flyway:defaultSchema}].trgUpdateAccountingCompanyProfile
ON [${flyway:defaultSchema}].[AccountingCompanyProfile]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[AccountingCompanyProfile]
    SET
        __mj_UpdatedAt = GETUTCDATE()
    FROM
        [${flyway:defaultSchema}].[AccountingCompanyProfile] AS _organicTable
    INNER JOIN
        INSERTED AS I ON
        _organicTable.[ID] = I.[ID];
END;
GO

/* spUpdate Permissions for MJ_BizApps_Accounting: Accounting Company Profiles */

REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateAccountingCompanyProfile] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateAccountingCompanyProfile] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateAccountingCompanyProfile] TO [cdp_Developer], [cdp_Integration];

/* spDelete SQL for MJ_BizApps_Accounting: Accounting Company Profiles */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Accounting Company Profiles
-- Item: spDeleteAccountingCompanyProfile
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- DELETE PROCEDURE FOR AccountingCompanyProfile
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spDeleteAccountingCompanyProfile]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spDeleteAccountingCompanyProfile];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spDeleteAccountingCompanyProfile]
    @ID uniqueidentifier
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM
        [${flyway:defaultSchema}].[AccountingCompanyProfile]
    WHERE
        [ID] = @ID


    -- Check if the delete was successful
    IF @@ROWCOUNT = 0
        SELECT NULL AS [ID] -- Return NULL for all primary key fields to indicate no record was deleted
    ELSE
        SELECT @ID AS [ID] -- Return the primary key values to indicate we successfully deleted the record
END
GO
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spDeleteAccountingCompanyProfile] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spDeleteAccountingCompanyProfile] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteAccountingCompanyProfile] TO [cdp_Developer], [cdp_Integration];

/* spDelete Permissions for MJ_BizApps_Accounting: Accounting Company Profiles */

REVOKE EXECUTE ON [${flyway:defaultSchema}].[spDeleteAccountingCompanyProfile] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spDeleteAccountingCompanyProfile] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteAccountingCompanyProfile] TO [cdp_Developer], [cdp_Integration];

/* Index for Foreign Keys for GLAccount */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: GL Accounts
-- Item: Index for Foreign Keys
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------
-- Index for foreign key CompanyID in table GLAccount
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_GLAccount_CompanyID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[GLAccount]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_GLAccount_CompanyID ON [${flyway:defaultSchema}].[GLAccount] ([CompanyID]);

-- Index for foreign key ParentGLAccountID in table GLAccount
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_GLAccount_ParentGLAccountID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[GLAccount]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_GLAccount_ParentGLAccountID ON [${flyway:defaultSchema}].[GLAccount] ([ParentGLAccountID]);

-- Index for foreign key CurrencyCode in table GLAccount
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_GLAccount_CurrencyCode' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[GLAccount]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_GLAccount_CurrencyCode ON [${flyway:defaultSchema}].[GLAccount] ([CurrencyCode]);

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

-- Index for foreign key ApprovalRequestedByUserID in table JournalEntry
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_JournalEntry_ApprovalRequestedByUserID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[JournalEntry]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_JournalEntry_ApprovalRequestedByUserID ON [${flyway:defaultSchema}].[JournalEntry] ([ApprovalRequestedByUserID]);

-- Index for foreign key ApprovalTaskID in table JournalEntry
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_JournalEntry_ApprovalTaskID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[JournalEntry]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_JournalEntry_ApprovalTaskID ON [${flyway:defaultSchema}].[JournalEntry] ([ApprovalTaskID]);

-- Index for foreign key ApprovedByUserID in table JournalEntry
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_JournalEntry_ApprovedByUserID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[JournalEntry]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_JournalEntry_ApprovedByUserID ON [${flyway:defaultSchema}].[JournalEntry] ([ApprovedByUserID]);

/* SQL text to update entity field related entity name field map for entity field ID D2A395B8-61B0-4209-AA5E-C5E896B0C214 */
EXEC [${mjSchema}].[spUpdateEntityFieldRelatedEntityNameFieldMap] @EntityFieldID='D2A395B8-61B0-4209-AA5E-C5E896B0C214', @RelatedEntityNameFieldMap='ApprovalRequestedByUser';

/* Hierarchy Metadata Function SQL for MJ_BizApps_Accounting: GL Accounts.ParentGLAccountID */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: GL Accounts
-- Item: fnGLAccountParentGLAccountID_GetHierarchyMeta
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------
------------------------------------------------------------
----- HIERARCHY METADATA FUNCTION FOR: [GLAccount].[ParentGLAccountID]
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[fnGLAccountParentGLAccountID_GetHierarchyMeta]', 'IF') IS NOT NULL
    DROP FUNCTION [${flyway:defaultSchema}].[fnGLAccountParentGLAccountID_GetHierarchyMeta];
GO

CREATE FUNCTION [${flyway:defaultSchema}].[fnGLAccountParentGLAccountID_GetHierarchyMeta]
(
    @RecordID uniqueidentifier,
    @ParentID uniqueidentifier
)
RETURNS TABLE
AS
RETURN
(
    WITH CTE_Ancestors AS (
        SELECT
            [ID],
            [ParentGLAccountID],
            0 AS [Depth],
            CAST('/' + CAST([ID] AS NVARCHAR(36)) + '/' AS NVARCHAR(MAX)) AS [Path]
        FROM
            [${flyway:defaultSchema}].[GLAccount]
        WHERE
            [ID] = @RecordID

        UNION ALL

        SELECT
            p.[ID],
            p.[ParentGLAccountID],
            c.[Depth] + 1 AS [Depth],
            CAST('/' + CAST(p.[ID] AS NVARCHAR(36)) + c.[Path] AS NVARCHAR(MAX)) AS [Path]
        FROM
            [${flyway:defaultSchema}].[GLAccount] p
        INNER JOIN
            CTE_Ancestors c ON p.[ID] = c.[ParentGLAccountID]
        WHERE
            c.[Depth] < 100
    )
    SELECT TOP 1
        a.[ID] AS [RootID],
        (SELECT MAX([Depth]) FROM CTE_Ancestors) AS [Depth],
        (SELECT TOP 1 [Path] FROM CTE_Ancestors ORDER BY [Depth] DESC) AS [Path],
        CAST(CASE WHEN EXISTS (SELECT 1 FROM [${flyway:defaultSchema}].[GLAccount] WHERE [ParentGLAccountID] = @RecordID) THEN 0 ELSE 1 END AS BIT) AS [IsLeaf],
        (SELECT COUNT(1) FROM [${flyway:defaultSchema}].[GLAccount] WHERE [ParentGLAccountID] = @RecordID) AS [ChildCount]
    FROM
        CTE_Ancestors a
    WHERE
        a.[ParentGLAccountID] IS NULL OR @ParentID IS NULL
    ORDER BY
        a.[Depth] DESC
);
GO

/* Descendants Traversal Function SQL for MJ_BizApps_Accounting: GL Accounts.ParentGLAccountID */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: GL Accounts
-- Item: fnGLAccountParentGLAccountID_GetDescendants
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------
------------------------------------------------------------
----- DESCENDANTS FUNCTION FOR: [GLAccount].[ParentGLAccountID]
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[fnGLAccountParentGLAccountID_GetDescendants]', 'IF') IS NOT NULL
    DROP FUNCTION [${flyway:defaultSchema}].[fnGLAccountParentGLAccountID_GetDescendants];
GO

CREATE FUNCTION [${flyway:defaultSchema}].[fnGLAccountParentGLAccountID_GetDescendants]
(
    @RootID uniqueidentifier,
    @MaxDepth INT = NULL
)
RETURNS TABLE
AS
RETURN
(
    WITH CTE_Descendants AS (
        SELECT
            [ID],
            [ParentGLAccountID],
            0 AS [RelativeDepth],
            CAST('/' + CAST([ID] AS NVARCHAR(36)) + '/' AS NVARCHAR(MAX)) AS [Path]
        FROM
            [${flyway:defaultSchema}].[GLAccount]
        WHERE
            [ID] = @RootID

        UNION ALL

        SELECT
            c.[ID],
            c.[ParentGLAccountID],
            p.[RelativeDepth] + 1 AS [RelativeDepth],
            CAST(p.[Path] + CAST(c.[ID] AS NVARCHAR(36)) + '/' AS NVARCHAR(MAX)) AS [Path]
        FROM
            [${flyway:defaultSchema}].[GLAccount] c
        INNER JOIN
            CTE_Descendants p ON c.[ParentGLAccountID] = p.[ID]
        WHERE
            (@MaxDepth IS NULL OR p.[RelativeDepth] < @MaxDepth)
            AND p.[RelativeDepth] < 100
    )
    SELECT
        d.[ID] AS [ID],
        d.[RelativeDepth] AS [Depth],
        d.[Path],
        CAST(CASE WHEN EXISTS (SELECT 1 FROM [${flyway:defaultSchema}].[GLAccount] WHERE [ParentGLAccountID] = d.[ID]) THEN 0 ELSE 1 END AS BIT) AS [IsLeaf],
        (SELECT COUNT(1) FROM [${flyway:defaultSchema}].[GLAccount] WHERE [ParentGLAccountID] = d.[ID]) AS [ChildCount]
    FROM
        CTE_Descendants d
);
GO

/* Ancestors Traversal Function SQL for MJ_BizApps_Accounting: GL Accounts.ParentGLAccountID */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: GL Accounts
-- Item: fnGLAccountParentGLAccountID_GetAncestors
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------
------------------------------------------------------------
----- ANCESTORS FUNCTION FOR: [GLAccount].[ParentGLAccountID]
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[fnGLAccountParentGLAccountID_GetAncestors]', 'IF') IS NOT NULL
    DROP FUNCTION [${flyway:defaultSchema}].[fnGLAccountParentGLAccountID_GetAncestors];
GO

CREATE FUNCTION [${flyway:defaultSchema}].[fnGLAccountParentGLAccountID_GetAncestors]
(
    @RecordID uniqueidentifier
)
RETURNS TABLE
AS
RETURN
(
    WITH CTE_Ancestors AS (
        SELECT
            [ID],
            [ParentGLAccountID],
            0 AS [LevelUp],
            CAST('/' + CAST([ID] AS NVARCHAR(36)) + '/' AS NVARCHAR(MAX)) AS [Path]
        FROM
            [${flyway:defaultSchema}].[GLAccount]
        WHERE
            [ID] = @RecordID

        UNION ALL

        SELECT
            p.[ID],
            p.[ParentGLAccountID],
            c.[LevelUp] + 1 AS [LevelUp],
            CAST('/' + CAST(p.[ID] AS NVARCHAR(36)) + c.[Path] AS NVARCHAR(MAX)) AS [Path]
        FROM
            [${flyway:defaultSchema}].[GLAccount] p
        INNER JOIN
            CTE_Ancestors c ON p.[ID] = c.[ParentGLAccountID]
        WHERE
            c.[LevelUp] < 100
    )
    SELECT
        a.[ID] AS [ID],
        a.[LevelUp],
        a.[Path]
    FROM
        CTE_Ancestors a
);
GO

/* Root ID Function SQL for MJ_BizApps_Accounting: GL Accounts.ParentGLAccountID */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: GL Accounts
-- Item: fnGLAccountParentGLAccountID_GetRootID
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------
------------------------------------------------------------
----- ROOT ID FUNCTION FOR: [GLAccount].[ParentGLAccountID]
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[fnGLAccountParentGLAccountID_GetRootID]', 'IF') IS NOT NULL
    DROP FUNCTION [${flyway:defaultSchema}].[fnGLAccountParentGLAccountID_GetRootID];
GO

CREATE FUNCTION [${flyway:defaultSchema}].[fnGLAccountParentGLAccountID_GetRootID]
(
    @RecordID uniqueidentifier,
    @ParentID uniqueidentifier
)
RETURNS TABLE
AS
RETURN
(
    WITH CTE_RootParent AS (
        SELECT
            [ID],
            [ParentGLAccountID],
            [ID] AS [RootParentID],
            0 AS [Depth]
        FROM
            [${flyway:defaultSchema}].[GLAccount]
        WHERE
            [ID] = COALESCE(@ParentID, @RecordID)

        UNION ALL

        SELECT
            c.[ID],
            c.[ParentGLAccountID],
            c.[ID] AS [RootParentID],
            p.[Depth] + 1 AS [Depth]
        FROM
            [${flyway:defaultSchema}].[GLAccount] c
        INNER JOIN
            CTE_RootParent p ON c.[ID] = p.[ParentGLAccountID]
        WHERE
            p.[Depth] < 100
    )
    SELECT TOP 1
        [RootParentID] AS RootID
    FROM
        CTE_RootParent
    WHERE
        [ParentGLAccountID] IS NULL
    ORDER BY
        [RootParentID]
);
GO

/* Base View SQL for MJ_BizApps_Accounting: GL Accounts */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: GL Accounts
-- Item: vwGLAccounts
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- BASE VIEW FOR ENTITY:      MJ_BizApps_Accounting: GL Accounts
-----               SCHEMA:      ${flyway:defaultSchema}
-----               BASE TABLE:  GLAccount
-----               PRIMARY KEY: ID
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[vwGLAccounts]', 'V') IS NOT NULL
    DROP VIEW [${flyway:defaultSchema}].[vwGLAccounts];
GO

CREATE VIEW [${flyway:defaultSchema}].[vwGLAccounts]
AS
SELECT
    g.*,
    MJCompany_CompanyID.[Name] AS [Company],
    mjBizAppsAccountingGLAccount_ParentGLAccountID.[Name] AS [ParentGLAccount],
    mjBizAppsAccountingCurrency_CurrencyCode.[Name] AS [CurrencyCode_Virtual],
    hier_ParentGLAccountID.RootID AS [RootParentGLAccountID],
    hier_ParentGLAccountID.Depth AS [ParentGLAccountIDDepth],
    hier_ParentGLAccountID.Path AS [ParentGLAccountIDPath],
    hier_ParentGLAccountID.IsLeaf AS [ParentGLAccountIDIsLeaf],
    hier_ParentGLAccountID.ChildCount AS [ParentGLAccountIDChildCount]
FROM
    [${flyway:defaultSchema}].[GLAccount] AS g
INNER JOIN
    [${mjSchema}].[Company] AS MJCompany_CompanyID
  ON
    [g].[CompanyID] = MJCompany_CompanyID.[ID]
LEFT OUTER JOIN
    [${flyway:defaultSchema}].[GLAccount] AS mjBizAppsAccountingGLAccount_ParentGLAccountID
  ON
    [g].[ParentGLAccountID] = mjBizAppsAccountingGLAccount_ParentGLAccountID.[ID]
LEFT OUTER JOIN
    [${flyway:defaultSchema}].[Currency] AS mjBizAppsAccountingCurrency_CurrencyCode
  ON
    [g].[CurrencyCode] = mjBizAppsAccountingCurrency_CurrencyCode.[Code]
OUTER APPLY
    [${flyway:defaultSchema}].[fnGLAccountParentGLAccountID_GetHierarchyMeta]([g].[ID], [g].[ParentGLAccountID]) AS hier_ParentGLAccountID
GO
REVOKE SELECT ON [${flyway:defaultSchema}].[vwGLAccounts] FROM [cdp_Developer]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwGLAccounts] FROM [cdp_Integration]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwGLAccounts] FROM [cdp_UI]
GRANT SELECT ON [${flyway:defaultSchema}].[vwGLAccounts] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* Base View Permissions SQL for MJ_BizApps_Accounting: GL Accounts */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: GL Accounts
-- Item: Permissions for vwGLAccounts
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

REVOKE SELECT ON [${flyway:defaultSchema}].[vwGLAccounts] FROM [cdp_Developer]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwGLAccounts] FROM [cdp_Integration]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwGLAccounts] FROM [cdp_UI]
GRANT SELECT ON [${flyway:defaultSchema}].[vwGLAccounts] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* spCreate SQL for MJ_BizApps_Accounting: GL Accounts */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: GL Accounts
-- Item: spCreateGLAccount
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- CREATE PROCEDURE FOR GLAccount
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spCreateGLAccount]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spCreateGLAccount];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spCreateGLAccount]
    @ID uniqueidentifier = NULL,
    @CompanyID uniqueidentifier,
    @Code nvarchar(40),
    @Name nvarchar(200),
    @AccountType nvarchar(15),
    @ParentGLAccountID_Clear bit = 0,
    @ParentGLAccountID uniqueidentifier = NULL,
    @CurrencyCode_Clear bit = 0,
    @CurrencyCode char(3) = NULL,
    @ExternalSystem_Clear bit = 0,
    @ExternalSystem nvarchar(50) = NULL,
    @ExternalAccountID_Clear bit = 0,
    @ExternalAccountID nvarchar(100) = NULL,
    @IsActive bit = NULL,
    @IsSystemSeeded bit = NULL,
    @Description_Clear bit = 0,
    @Description nvarchar(MAX) = NULL,
    @IsControlAccount bit = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @InsertedRow TABLE ([ID] UNIQUEIDENTIFIER)

    IF @ID IS NOT NULL
    BEGIN
        -- User provided a value, use it
        INSERT INTO [${flyway:defaultSchema}].[GLAccount]
            (
                [ID],
                [CompanyID],
                [Code],
                [Name],
                [AccountType],
                [ParentGLAccountID],
                [CurrencyCode],
                [ExternalSystem],
                [ExternalAccountID],
                [IsActive],
                [IsSystemSeeded],
                [Description],
                [IsControlAccount]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @ID,
                @CompanyID,
                @Code,
                @Name,
                @AccountType,
                CASE WHEN @ParentGLAccountID_Clear = 1 THEN NULL ELSE ISNULL(@ParentGLAccountID, NULL) END,
                CASE WHEN @CurrencyCode_Clear = 1 THEN NULL ELSE ISNULL(@CurrencyCode, NULL) END,
                CASE WHEN @ExternalSystem_Clear = 1 THEN NULL ELSE ISNULL(@ExternalSystem, NULL) END,
                CASE WHEN @ExternalAccountID_Clear = 1 THEN NULL ELSE ISNULL(@ExternalAccountID, NULL) END,
                ISNULL(@IsActive, 1),
                ISNULL(@IsSystemSeeded, 0),
                CASE WHEN @Description_Clear = 1 THEN NULL ELSE ISNULL(@Description, NULL) END,
                ISNULL(@IsControlAccount, 0)
            )
    END
    ELSE
    BEGIN
        -- No value provided, let database use its default (e.g., NEWSEQUENTIALID())
        INSERT INTO [${flyway:defaultSchema}].[GLAccount]
            (
                [CompanyID],
                [Code],
                [Name],
                [AccountType],
                [ParentGLAccountID],
                [CurrencyCode],
                [ExternalSystem],
                [ExternalAccountID],
                [IsActive],
                [IsSystemSeeded],
                [Description],
                [IsControlAccount]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @CompanyID,
                @Code,
                @Name,
                @AccountType,
                CASE WHEN @ParentGLAccountID_Clear = 1 THEN NULL ELSE ISNULL(@ParentGLAccountID, NULL) END,
                CASE WHEN @CurrencyCode_Clear = 1 THEN NULL ELSE ISNULL(@CurrencyCode, NULL) END,
                CASE WHEN @ExternalSystem_Clear = 1 THEN NULL ELSE ISNULL(@ExternalSystem, NULL) END,
                CASE WHEN @ExternalAccountID_Clear = 1 THEN NULL ELSE ISNULL(@ExternalAccountID, NULL) END,
                ISNULL(@IsActive, 1),
                ISNULL(@IsSystemSeeded, 0),
                CASE WHEN @Description_Clear = 1 THEN NULL ELSE ISNULL(@Description, NULL) END,
                ISNULL(@IsControlAccount, 0)
            )
    END
    -- return the new record from the base view, which might have some calculated fields
    SELECT * FROM [${flyway:defaultSchema}].[vwGLAccounts] WHERE [ID] = (SELECT [ID] FROM @InsertedRow)
END
GO
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateGLAccount] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateGLAccount] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateGLAccount] TO [cdp_Developer], [cdp_Integration];

/* spCreate Permissions for MJ_BizApps_Accounting: GL Accounts */

REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateGLAccount] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateGLAccount] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateGLAccount] TO [cdp_Developer], [cdp_Integration];

/* spUpdate SQL for MJ_BizApps_Accounting: GL Accounts */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: GL Accounts
-- Item: spUpdateGLAccount
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- UPDATE PROCEDURE FOR GLAccount
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spUpdateGLAccount]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spUpdateGLAccount];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spUpdateGLAccount]
    @ID uniqueidentifier,
    @CompanyID uniqueidentifier = NULL,
    @Code nvarchar(40) = NULL,
    @Name nvarchar(200) = NULL,
    @AccountType nvarchar(15) = NULL,
    @ParentGLAccountID_Clear bit = 0,
    @ParentGLAccountID uniqueidentifier = NULL,
    @CurrencyCode_Clear bit = 0,
    @CurrencyCode char(3) = NULL,
    @ExternalSystem_Clear bit = 0,
    @ExternalSystem nvarchar(50) = NULL,
    @ExternalAccountID_Clear bit = 0,
    @ExternalAccountID nvarchar(100) = NULL,
    @IsActive bit = NULL,
    @IsSystemSeeded bit = NULL,
    @Description_Clear bit = 0,
    @Description nvarchar(MAX) = NULL,
    @IsControlAccount bit = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[GLAccount]
    SET
        [CompanyID] = ISNULL(@CompanyID, [CompanyID]),
        [Code] = ISNULL(@Code, [Code]),
        [Name] = ISNULL(@Name, [Name]),
        [AccountType] = ISNULL(@AccountType, [AccountType]),
        [ParentGLAccountID] = CASE WHEN @ParentGLAccountID_Clear = 1 THEN NULL ELSE ISNULL(@ParentGLAccountID, [ParentGLAccountID]) END,
        [CurrencyCode] = CASE WHEN @CurrencyCode_Clear = 1 THEN NULL ELSE ISNULL(@CurrencyCode, [CurrencyCode]) END,
        [ExternalSystem] = CASE WHEN @ExternalSystem_Clear = 1 THEN NULL ELSE ISNULL(@ExternalSystem, [ExternalSystem]) END,
        [ExternalAccountID] = CASE WHEN @ExternalAccountID_Clear = 1 THEN NULL ELSE ISNULL(@ExternalAccountID, [ExternalAccountID]) END,
        [IsActive] = ISNULL(@IsActive, [IsActive]),
        [IsSystemSeeded] = ISNULL(@IsSystemSeeded, [IsSystemSeeded]),
        [Description] = CASE WHEN @Description_Clear = 1 THEN NULL ELSE ISNULL(@Description, [Description]) END,
        [IsControlAccount] = ISNULL(@IsControlAccount, [IsControlAccount])
    WHERE
        [ID] = @ID

    -- Check if the update was successful
    IF @@ROWCOUNT = 0
        -- Nothing was updated, return no rows, but column structure from base view intact, semantically correct this way.
        SELECT TOP 0 * FROM [${flyway:defaultSchema}].[vwGLAccounts] WHERE 1=0
    ELSE
        -- Return the updated record so the caller can see the updated values and any calculated fields
        SELECT
                                        *
                                    FROM
                                        [${flyway:defaultSchema}].[vwGLAccounts]
                                    WHERE
                                        [ID] = @ID
                                    
END
GO

REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateGLAccount] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateGLAccount] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateGLAccount] TO [cdp_Developer], [cdp_Integration]
GO

------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the GLAccount table
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[trgUpdateGLAccount]', 'TR') IS NOT NULL
    DROP TRIGGER [${flyway:defaultSchema}].[trgUpdateGLAccount];
GO
CREATE TRIGGER [${flyway:defaultSchema}].trgUpdateGLAccount
ON [${flyway:defaultSchema}].[GLAccount]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[GLAccount]
    SET
        __mj_UpdatedAt = GETUTCDATE()
    FROM
        [${flyway:defaultSchema}].[GLAccount] AS _organicTable
    INNER JOIN
        INSERTED AS I ON
        _organicTable.[ID] = I.[ID];
END;
GO

/* spUpdate Permissions for MJ_BizApps_Accounting: GL Accounts */

REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateGLAccount] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateGLAccount] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateGLAccount] TO [cdp_Developer], [cdp_Integration];

/* spDelete SQL for MJ_BizApps_Accounting: GL Accounts */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: GL Accounts
-- Item: spDeleteGLAccount
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- DELETE PROCEDURE FOR GLAccount
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spDeleteGLAccount]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spDeleteGLAccount];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spDeleteGLAccount]
    @ID uniqueidentifier
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM
        [${flyway:defaultSchema}].[GLAccount]
    WHERE
        [ID] = @ID


    -- Check if the delete was successful
    IF @@ROWCOUNT = 0
        SELECT NULL AS [ID] -- Return NULL for all primary key fields to indicate no record was deleted
    ELSE
        SELECT @ID AS [ID] -- Return the primary key values to indicate we successfully deleted the record
END
GO
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spDeleteGLAccount] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spDeleteGLAccount] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteGLAccount] TO [cdp_Developer], [cdp_Integration];

/* spDelete Permissions for MJ_BizApps_Accounting: GL Accounts */

REVOKE EXECUTE ON [${flyway:defaultSchema}].[spDeleteGLAccount] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spDeleteGLAccount] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteGLAccount] TO [cdp_Developer], [cdp_Integration];

/* SQL text to update entity field related entity name field map for entity field ID 3B9807DE-48E1-40CB-977D-F78C79B23D90 */
EXEC [${mjSchema}].[spUpdateEntityFieldRelatedEntityNameFieldMap] @EntityFieldID='3B9807DE-48E1-40CB-977D-F78C79B23D90', @RelatedEntityNameFieldMap='ApprovalTask';

/* SQL text to update entity field related entity name field map for entity field ID 19391880-F1A2-424E-838E-97B3929B4FD6 */
EXEC [${mjSchema}].[spUpdateEntityFieldRelatedEntityNameFieldMap] @EntityFieldID='19391880-F1A2-424E-838E-97B3929B4FD6', @RelatedEntityNameFieldMap='ApprovedByUser';

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
    MJFile_FileID.[Name] AS [File],
    MJUser_ApprovalRequestedByUserID.[Name] AS [ApprovalRequestedByUser],
    mjBizAppsTasksTask_ApprovalTaskID.[Name] AS [ApprovalTask],
    MJUser_ApprovedByUserID.[Name] AS [ApprovedByUser]
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
LEFT OUTER JOIN
    [${mjSchema}].[User] AS MJUser_ApprovalRequestedByUserID
  ON
    [j].[ApprovalRequestedByUserID] = MJUser_ApprovalRequestedByUserID.[ID]
LEFT OUTER JOIN
    [${mjSchema}_BizAppsTasks].[Task] AS mjBizAppsTasksTask_ApprovalTaskID
  ON
    [j].[ApprovalTaskID] = mjBizAppsTasksTask_ApprovalTaskID.[ID]
LEFT OUTER JOIN
    [${mjSchema}].[User] AS MJUser_ApprovedByUserID
  ON
    [j].[ApprovedByUserID] = MJUser_ApprovedByUserID.[ID]
GO
IF OBJECT_ID('[${flyway:defaultSchema}].[vwJournalEntries]', 'V') IS NOT NULL
BEGIN
    EXEC sp_executesql N'REVOKE SELECT ON [${flyway:defaultSchema}].[vwJournalEntries] FROM [cdp_UI]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwJournalEntries] FROM [cdp_Developer]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwJournalEntries] FROM [cdp_Integration]
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
    EXEC sp_executesql N'REVOKE SELECT ON [${flyway:defaultSchema}].[vwJournalEntries] FROM [cdp_UI]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwJournalEntries] FROM [cdp_Developer]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwJournalEntries] FROM [cdp_Integration]
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
    @PredictedAnomalyScoredAt datetimeoffset = NULL,
    @ApprovalLevel_Clear bit = 0,
    @ApprovalLevel nvarchar(20) = NULL,
    @ApprovalRequestedByUserID_Clear bit = 0,
    @ApprovalRequestedByUserID uniqueidentifier = NULL,
    @ApprovalTaskID_Clear bit = 0,
    @ApprovalTaskID uniqueidentifier = NULL,
    @ApprovedAt_Clear bit = 0,
    @ApprovedAt datetimeoffset = NULL,
    @ApprovedByUserID_Clear bit = 0,
    @ApprovedByUserID uniqueidentifier = NULL
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
                [PredictedAnomalyScoredAt],
                [ApprovalLevel],
                [ApprovalRequestedByUserID],
                [ApprovalTaskID],
                [ApprovedAt],
                [ApprovedByUserID]
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
                CASE WHEN @PredictedAnomalyScoredAt_Clear = 1 THEN NULL ELSE ISNULL(@PredictedAnomalyScoredAt, NULL) END,
                CASE WHEN @ApprovalLevel_Clear = 1 THEN NULL ELSE ISNULL(@ApprovalLevel, NULL) END,
                CASE WHEN @ApprovalRequestedByUserID_Clear = 1 THEN NULL ELSE ISNULL(@ApprovalRequestedByUserID, NULL) END,
                CASE WHEN @ApprovalTaskID_Clear = 1 THEN NULL ELSE ISNULL(@ApprovalTaskID, NULL) END,
                CASE WHEN @ApprovedAt_Clear = 1 THEN NULL ELSE ISNULL(@ApprovedAt, NULL) END,
                CASE WHEN @ApprovedByUserID_Clear = 1 THEN NULL ELSE ISNULL(@ApprovedByUserID, NULL) END
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
                [PredictedAnomalyScoredAt],
                [ApprovalLevel],
                [ApprovalRequestedByUserID],
                [ApprovalTaskID],
                [ApprovedAt],
                [ApprovedByUserID]
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
                CASE WHEN @PredictedAnomalyScoredAt_Clear = 1 THEN NULL ELSE ISNULL(@PredictedAnomalyScoredAt, NULL) END,
                CASE WHEN @ApprovalLevel_Clear = 1 THEN NULL ELSE ISNULL(@ApprovalLevel, NULL) END,
                CASE WHEN @ApprovalRequestedByUserID_Clear = 1 THEN NULL ELSE ISNULL(@ApprovalRequestedByUserID, NULL) END,
                CASE WHEN @ApprovalTaskID_Clear = 1 THEN NULL ELSE ISNULL(@ApprovalTaskID, NULL) END,
                CASE WHEN @ApprovedAt_Clear = 1 THEN NULL ELSE ISNULL(@ApprovedAt, NULL) END,
                CASE WHEN @ApprovedByUserID_Clear = 1 THEN NULL ELSE ISNULL(@ApprovedByUserID, NULL) END
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
    @PredictedAnomalyScoredAt datetimeoffset = NULL,
    @ApprovalLevel_Clear bit = 0,
    @ApprovalLevel nvarchar(20) = NULL,
    @ApprovalRequestedByUserID_Clear bit = 0,
    @ApprovalRequestedByUserID uniqueidentifier = NULL,
    @ApprovalTaskID_Clear bit = 0,
    @ApprovalTaskID uniqueidentifier = NULL,
    @ApprovedAt_Clear bit = 0,
    @ApprovedAt datetimeoffset = NULL,
    @ApprovedByUserID_Clear bit = 0,
    @ApprovedByUserID uniqueidentifier = NULL
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
        [PredictedAnomalyScoredAt] = CASE WHEN @PredictedAnomalyScoredAt_Clear = 1 THEN NULL ELSE ISNULL(@PredictedAnomalyScoredAt, [PredictedAnomalyScoredAt]) END,
        [ApprovalLevel] = CASE WHEN @ApprovalLevel_Clear = 1 THEN NULL ELSE ISNULL(@ApprovalLevel, [ApprovalLevel]) END,
        [ApprovalRequestedByUserID] = CASE WHEN @ApprovalRequestedByUserID_Clear = 1 THEN NULL ELSE ISNULL(@ApprovalRequestedByUserID, [ApprovalRequestedByUserID]) END,
        [ApprovalTaskID] = CASE WHEN @ApprovalTaskID_Clear = 1 THEN NULL ELSE ISNULL(@ApprovalTaskID, [ApprovalTaskID]) END,
        [ApprovedAt] = CASE WHEN @ApprovedAt_Clear = 1 THEN NULL ELSE ISNULL(@ApprovedAt, [ApprovedAt]) END,
        [ApprovedByUserID] = CASE WHEN @ApprovedByUserID_Clear = 1 THEN NULL ELSE ISNULL(@ApprovedByUserID, [ApprovedByUserID]) END
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

/* SQL text to insert 1 new entity field(s) */

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '0f216bab-f9f2-44f1-8177-c15fe5d384d6' OR (EntityID = '3E551198-AB66-478E-BEB6-C34EDBE242EC' AND Name = 'ManualJournalEntryApproverRole')) BEGIN
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
            '0f216bab-f9f2-44f1-8177-c15fe5d384d6',
            '3E551198-AB66-478E-BEB6-C34EDBE242EC', -- Entity: MJ_BizApps_Accounting: Accounting Company Profiles
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '3E551198-AB66-478E-BEB6-C34EDBE242EC'),
            'ManualJournalEntryApproverRole',
            'Manual Journal Entry Approver Role',
            NULL,
            'nvarchar',
            100,
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

/* SQL text to update existing entity fields from schema (3 scoped entities) */
EXEC [${mjSchema}].[spUpdateExistingEntityFieldsFromSchema] @ExcludedSchemaNames='', @EntityIDs='C040A1FC-16CE-49CB-B0E2-4F233BD0D762,690BE4C8-C8F2-4067-B48B-57C0671B05A5,3E551198-AB66-478E-BEB6-C34EDBE242EC', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to set default column width where needed */
EXEC [${mjSchema}].[spSetDefaultColumnWidthWhereNeeded] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';

/* Refresh custom base views for modified entities so schema changes are picked up */
EXEC sp_refreshview '${flyway:defaultSchema}.vwJournalEntriesGenerated';
IF OBJECT_ID('[${flyway:defaultSchema}].[vwJournalEntries]', 'V') IS NOT NULL
BEGIN
    EXEC sp_executesql N'EXEC sp_refreshview ''${flyway:defaultSchema}.vwJournalEntries'';';
END;


/* SQL text to update existing entities from schema */
EXEC [${mjSchema}].[spUpdateExistingEntitiesFromSchema] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to insert 3 new entity field(s) */

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'fcd8c833-8cba-4a3a-814d-f9b678c9cd05' OR (EntityID = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762' AND Name = 'ApprovalRequestedByUser')) BEGIN
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
            'fcd8c833-8cba-4a3a-814d-f9b678c9cd05',
            'C040A1FC-16CE-49CB-B0E2-4F233BD0D762', -- Entity: MJ_BizApps_Accounting: Journal Entries
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762'),
            'ApprovalRequestedByUser',
            'Approval Requested By User',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'da9dd1eb-2fa2-4f99-801d-91775f8b1f12' OR (EntityID = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762' AND Name = 'ApprovalTask')) BEGIN
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
            'da9dd1eb-2fa2-4f99-801d-91775f8b1f12',
            'C040A1FC-16CE-49CB-B0E2-4F233BD0D762', -- Entity: MJ_BizApps_Accounting: Journal Entries
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762'),
            'ApprovalTask',
            'Approval Task',
            NULL,
            'nvarchar',
            510,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '2ede0581-5be1-4235-9d74-4ec4811bc9f2' OR (EntityID = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762' AND Name = 'ApprovedByUser')) BEGIN
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
            '2ede0581-5be1-4235-9d74-4ec4811bc9f2',
            'C040A1FC-16CE-49CB-B0E2-4F233BD0D762', -- Entity: MJ_BizApps_Accounting: Journal Entries
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762'),
            'ApprovedByUser',
            'Approved By User',
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

/* SQL text to update existing entity fields from schema */
EXEC [${mjSchema}].[spUpdateExistingEntityFieldsFromSchema] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to set default column width where needed */
EXEC [${mjSchema}].[spSetDefaultColumnWidthWhereNeeded] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';

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

-- Index for foreign key ApprovalRequestedByUserID in table JournalEntry
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_JournalEntry_ApprovalRequestedByUserID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[JournalEntry]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_JournalEntry_ApprovalRequestedByUserID ON [${flyway:defaultSchema}].[JournalEntry] ([ApprovalRequestedByUserID]);

-- Index for foreign key ApprovalTaskID in table JournalEntry
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_JournalEntry_ApprovalTaskID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[JournalEntry]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_JournalEntry_ApprovalTaskID ON [${flyway:defaultSchema}].[JournalEntry] ([ApprovalTaskID]);

-- Index for foreign key ApprovedByUserID in table JournalEntry
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_JournalEntry_ApprovedByUserID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[JournalEntry]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_JournalEntry_ApprovedByUserID ON [${flyway:defaultSchema}].[JournalEntry] ([ApprovedByUserID]);

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
    MJFile_FileID.[Name] AS [File],
    MJUser_ApprovalRequestedByUserID.[Name] AS [ApprovalRequestedByUser],
    mjBizAppsTasksTask_ApprovalTaskID.[Name] AS [ApprovalTask],
    MJUser_ApprovedByUserID.[Name] AS [ApprovedByUser]
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
LEFT OUTER JOIN
    [${mjSchema}].[User] AS MJUser_ApprovalRequestedByUserID
  ON
    [j].[ApprovalRequestedByUserID] = MJUser_ApprovalRequestedByUserID.[ID]
LEFT OUTER JOIN
    [${mjSchema}_BizAppsTasks].[Task] AS mjBizAppsTasksTask_ApprovalTaskID
  ON
    [j].[ApprovalTaskID] = mjBizAppsTasksTask_ApprovalTaskID.[ID]
LEFT OUTER JOIN
    [${mjSchema}].[User] AS MJUser_ApprovedByUserID
  ON
    [j].[ApprovedByUserID] = MJUser_ApprovedByUserID.[ID]
GO
IF OBJECT_ID('[${flyway:defaultSchema}].[vwJournalEntries]', 'V') IS NOT NULL
BEGIN
    EXEC sp_executesql N'REVOKE SELECT ON [${flyway:defaultSchema}].[vwJournalEntries] FROM [cdp_UI]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwJournalEntries] FROM [cdp_Developer]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwJournalEntries] FROM [cdp_Integration]
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
    EXEC sp_executesql N'REVOKE SELECT ON [${flyway:defaultSchema}].[vwJournalEntries] FROM [cdp_UI]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwJournalEntries] FROM [cdp_Developer]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwJournalEntries] FROM [cdp_Integration]
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
    @PredictedAnomalyScoredAt datetimeoffset = NULL,
    @ApprovalLevel_Clear bit = 0,
    @ApprovalLevel nvarchar(20) = NULL,
    @ApprovalRequestedByUserID_Clear bit = 0,
    @ApprovalRequestedByUserID uniqueidentifier = NULL,
    @ApprovalTaskID_Clear bit = 0,
    @ApprovalTaskID uniqueidentifier = NULL,
    @ApprovedAt_Clear bit = 0,
    @ApprovedAt datetimeoffset = NULL,
    @ApprovedByUserID_Clear bit = 0,
    @ApprovedByUserID uniqueidentifier = NULL
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
                [PredictedAnomalyScoredAt],
                [ApprovalLevel],
                [ApprovalRequestedByUserID],
                [ApprovalTaskID],
                [ApprovedAt],
                [ApprovedByUserID]
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
                CASE WHEN @PredictedAnomalyScoredAt_Clear = 1 THEN NULL ELSE ISNULL(@PredictedAnomalyScoredAt, NULL) END,
                CASE WHEN @ApprovalLevel_Clear = 1 THEN NULL ELSE ISNULL(@ApprovalLevel, NULL) END,
                CASE WHEN @ApprovalRequestedByUserID_Clear = 1 THEN NULL ELSE ISNULL(@ApprovalRequestedByUserID, NULL) END,
                CASE WHEN @ApprovalTaskID_Clear = 1 THEN NULL ELSE ISNULL(@ApprovalTaskID, NULL) END,
                CASE WHEN @ApprovedAt_Clear = 1 THEN NULL ELSE ISNULL(@ApprovedAt, NULL) END,
                CASE WHEN @ApprovedByUserID_Clear = 1 THEN NULL ELSE ISNULL(@ApprovedByUserID, NULL) END
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
                [PredictedAnomalyScoredAt],
                [ApprovalLevel],
                [ApprovalRequestedByUserID],
                [ApprovalTaskID],
                [ApprovedAt],
                [ApprovedByUserID]
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
                CASE WHEN @PredictedAnomalyScoredAt_Clear = 1 THEN NULL ELSE ISNULL(@PredictedAnomalyScoredAt, NULL) END,
                CASE WHEN @ApprovalLevel_Clear = 1 THEN NULL ELSE ISNULL(@ApprovalLevel, NULL) END,
                CASE WHEN @ApprovalRequestedByUserID_Clear = 1 THEN NULL ELSE ISNULL(@ApprovalRequestedByUserID, NULL) END,
                CASE WHEN @ApprovalTaskID_Clear = 1 THEN NULL ELSE ISNULL(@ApprovalTaskID, NULL) END,
                CASE WHEN @ApprovedAt_Clear = 1 THEN NULL ELSE ISNULL(@ApprovedAt, NULL) END,
                CASE WHEN @ApprovedByUserID_Clear = 1 THEN NULL ELSE ISNULL(@ApprovedByUserID, NULL) END
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
    @PredictedAnomalyScoredAt datetimeoffset = NULL,
    @ApprovalLevel_Clear bit = 0,
    @ApprovalLevel nvarchar(20) = NULL,
    @ApprovalRequestedByUserID_Clear bit = 0,
    @ApprovalRequestedByUserID uniqueidentifier = NULL,
    @ApprovalTaskID_Clear bit = 0,
    @ApprovalTaskID uniqueidentifier = NULL,
    @ApprovedAt_Clear bit = 0,
    @ApprovedAt datetimeoffset = NULL,
    @ApprovedByUserID_Clear bit = 0,
    @ApprovedByUserID uniqueidentifier = NULL
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
        [PredictedAnomalyScoredAt] = CASE WHEN @PredictedAnomalyScoredAt_Clear = 1 THEN NULL ELSE ISNULL(@PredictedAnomalyScoredAt, [PredictedAnomalyScoredAt]) END,
        [ApprovalLevel] = CASE WHEN @ApprovalLevel_Clear = 1 THEN NULL ELSE ISNULL(@ApprovalLevel, [ApprovalLevel]) END,
        [ApprovalRequestedByUserID] = CASE WHEN @ApprovalRequestedByUserID_Clear = 1 THEN NULL ELSE ISNULL(@ApprovalRequestedByUserID, [ApprovalRequestedByUserID]) END,
        [ApprovalTaskID] = CASE WHEN @ApprovalTaskID_Clear = 1 THEN NULL ELSE ISNULL(@ApprovalTaskID, [ApprovalTaskID]) END,
        [ApprovedAt] = CASE WHEN @ApprovedAt_Clear = 1 THEN NULL ELSE ISNULL(@ApprovedAt, [ApprovedAt]) END,
        [ApprovedByUserID] = CASE WHEN @ApprovedByUserID_Clear = 1 THEN NULL ELSE ISNULL(@ApprovedByUserID, [ApprovedByUserID]) END
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

/* SQL text to update existing entity fields from schema (1 scoped entities) */
EXEC [${mjSchema}].[spUpdateExistingEntityFieldsFromSchema] @ExcludedSchemaNames='', @EntityIDs='C040A1FC-16CE-49CB-B0E2-4F233BD0D762', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to set default column width where needed */
EXEC [${mjSchema}].[spSetDefaultColumnWidthWhereNeeded] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';

/* Refresh custom base views for modified entities so schema changes are picked up */
EXEC sp_refreshview '${flyway:defaultSchema}.vwJournalEntriesGenerated';
IF OBJECT_ID('[${flyway:defaultSchema}].[vwJournalEntries]', 'V') IS NOT NULL
BEGIN
    EXEC sp_executesql N'EXEC sp_refreshview ''${flyway:defaultSchema}.vwJournalEntries'';';
END;


