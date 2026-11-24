-- =============================================================================
-- Migration: V202611161400__v0.28.x__JournalEntry_Voided_Status.sql
-- Description: golive #378 — a terminal `Voided` journal entry status, so an
--              entry that never left the subledger can be cancelled in place
--              instead of offset by a mirror entry.
-- =============================================================================
--
-- WHY
--
-- D15 staged a deferred line's recognition as real forward-dated entries and
-- never edited or deleted a staged entry: a return or cancellation wrote a
-- mirror entry for every month still to come. A one-year subscription returned
-- in its first month left eleven pairs that net to zero, each pair correct only
-- if both halves land in the same batch, and each one more line for finance to
-- review at month-end (golive #378, #474).
--
-- The rule now: an entry that is still Pending, in no batch, has reached
-- nothing outside this ledger, so it can be voided. A Batched or GL-posted
-- entry is still corrected only by a reversing entry.
--
-- WHAT CHANGES
--
-- JournalEntry.Status gains `Voided`: terminal, reached only from Pending, never
-- in a batch. Three nullable columns record who voided the entry, when and why,
-- the same audit triple a cancelled or archived batch carries. They are required
-- on a Voided entry and empty on every other.
--
-- A Voided entry is frozen: no column of it and none of its lines or line
-- dimensions may change, and it cannot be deleted, so the record of what was
-- staged and why it was voided survives. Every reader that sums or batches
-- entries selects Pending, Batched or GLPosted by name, so a Voided entry drops
-- out of batch builds, the ERP send and balances without a filter of its own;
-- CK_JournalEntry_VoidedHasNoBatch keeps one out of a batch at the database.
--
-- Existing rows are Pending, Batched or GLPosted with the new columns NULL, so
-- every constraint below holds on them as added.
--
-- DETERMINISTIC, NOT IDEMPOTENT: this runs once, in order, against a database
-- that has the prior migrations.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. The two constraints that name the status list
-- -----------------------------------------------------------------------------
-- Two statements, not one: T-SQL and PostgreSQL spell a multi-constraint DROP differently, and two
-- single drops convert as they are.
ALTER TABLE __mj_BizAppsAccounting.JournalEntry DROP CONSTRAINT CK_JournalEntry_Status;
GO

ALTER TABLE __mj_BizAppsAccounting.JournalEntry DROP CONSTRAINT CK_JournalEntry_BatchedHasJournalEntryBatch;
GO


-- -----------------------------------------------------------------------------
-- 2. The void audit triple and the widened status list, in one statement
-- -----------------------------------------------------------------------------
-- VoidReason is NVARCHAR(1000), as JournalEntryBatch.CancelReason is. A Voided
-- entry needs all three; any other entry has none, so a void cannot be half
-- recorded and a live entry cannot carry a stale reason.
-- -----------------------------------------------------------------------------
ALTER TABLE __mj_BizAppsAccounting.JournalEntry ADD
    VoidReason      NVARCHAR(1000)   NULL,
    VoidedAt        DATETIMEOFFSET   NULL,
    VoidedByUserID  UNIQUEIDENTIFIER NULL
        CONSTRAINT FK_JournalEntry_VoidedBy FOREIGN KEY REFERENCES __mj.[User](ID),
    CONSTRAINT CK_JournalEntry_Status
        CHECK (Status IN ('Pending','Batched','GLPosted','Voided')),
    CONSTRAINT CK_JournalEntry_BatchedHasJournalEntryBatch
        CHECK (Status IN ('Pending','Voided') OR JournalEntryBatchID IS NOT NULL),
    CONSTRAINT CK_JournalEntry_VoidedHasNoBatch
        CHECK (Status <> 'Voided' OR JournalEntryBatchID IS NULL),
    CONSTRAINT CK_JournalEntry_VoidAudit CHECK (
        (Status = 'Voided'
            AND VoidReason IS NOT NULL
            AND LEN(TRIM(VoidReason)) > 0
            AND VoidedAt IS NOT NULL
            AND VoidedByUserID IS NOT NULL)
        OR
        (Status <> 'Voided'
            AND VoidReason IS NULL
            AND VoidedAt IS NULL
            AND VoidedByUserID IS NULL)
    );
GO


-- -----------------------------------------------------------------------------
-- 3. Only Pending → Voided, and a Voided entry is frozen
-- -----------------------------------------------------------------------------
-- trg_JournalEntry_Immutability refuses a locked entry's content changes but
-- not its move to a status it does not know, so Batched or GLPosted → Voided is
-- refused here. A new trigger rather than a fourth re-creation of that one: the
-- rules are about one status, and the existing trigger stays as reviewed.
-- THROW only, never ROLLBACK first (V202610011000).
-- -----------------------------------------------------------------------------
CREATE OR ALTER TRIGGER __mj_BizAppsAccounting.trg_JournalEntry_VoidRules
ON __mj_BizAppsAccounting.JournalEntry
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    -- An entry is created Pending; Voided is reached only by voiding a Pending one.
    IF EXISTS (SELECT 1 FROM inserted i WHERE i.Status = 'Voided' AND NOT EXISTS (SELECT 1 FROM deleted d WHERE d.ID = i.ID))
    BEGIN
        THROW 50040, 'A journal entry cannot be created Voided. Only a Pending entry in no batch can be voided.', 1;
    END;

    IF EXISTS (
        SELECT 1
        FROM inserted i
        JOIN deleted d ON d.ID = i.ID
        WHERE i.Status = 'Voided' AND d.Status NOT IN ('Pending','Voided')
    )
    BEGIN
        THROW 50040, 'Only a Pending journal entry in no batch can be voided. A Batched or GL-posted entry has left the subledger and is corrected with a reversing entry.', 1;
    END;

    -- A Voided entry never changes again: not its status, not its audit, not its content. Every
    -- column but the bookkeeping ones is compared, so trgUpdateJournalEntry's own __mj_UpdatedAt
    -- stamp (a nested update of the same row) and a Predictive Studio score still go through.
    IF EXISTS (
        SELECT i.ID, i.EntryNumber, i.CompanyID, i.EffectiveDate, i.EntryTypeID, i.Status, i.Description,
               i.LinkedEntityID, i.LinkedRecordID, i.ReversesJournalEntryID, i.ReversedByJournalEntryID,
               i.JournalEntryBatchID, i.GLPostedAt, i.GLReferenceID, i.FileID, i.ApprovalLevel,
               i.ApprovalRequestedByUserID, i.ApprovalTaskID, i.ApprovedAt, i.ApprovedByUserID,
               i.VoidReason, i.VoidedAt, i.VoidedByUserID
        FROM inserted i JOIN deleted d0 ON d0.ID = i.ID
        WHERE d0.Status = 'Voided'
        EXCEPT
        SELECT d.ID, d.EntryNumber, d.CompanyID, d.EffectiveDate, d.EntryTypeID, d.Status, d.Description,
               d.LinkedEntityID, d.LinkedRecordID, d.ReversesJournalEntryID, d.ReversedByJournalEntryID,
               d.JournalEntryBatchID, d.GLPostedAt, d.GLReferenceID, d.FileID, d.ApprovalLevel,
               d.ApprovalRequestedByUserID, d.ApprovalTaskID, d.ApprovedAt, d.ApprovedByUserID,
               d.VoidReason, d.VoidedAt, d.VoidedByUserID
        FROM deleted d
        WHERE d.Status = 'Voided'
    )
    BEGIN
        THROW 50041, 'A Voided journal entry cannot be changed. Voiding is final; book a new entry if the amount is still owed.', 1;
    END;

    IF NOT EXISTS (SELECT 1 FROM inserted) AND EXISTS (SELECT 1 FROM deleted WHERE Status = 'Voided')
    BEGIN
        THROW 50042, 'A Voided journal entry cannot be deleted: it is the record of what was staged and why it was voided.', 1;
    END;
END;
GO

CREATE OR ALTER TRIGGER __mj_BizAppsAccounting.trg_JEL_VoidedFrozen
ON __mj_BizAppsAccounting.JournalEntryLine
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (
        SELECT 1
        FROM __mj_BizAppsAccounting.JournalEntry je
        WHERE je.Status = 'Voided'
          AND je.ID IN (SELECT JournalEntryID FROM inserted UNION SELECT JournalEntryID FROM deleted)
    )
    BEGIN
        THROW 50043, 'The lines of a Voided journal entry cannot be inserted, modified, or deleted.', 1;
    END;
END;
GO

CREATE OR ALTER TRIGGER __mj_BizAppsAccounting.trg_JELD_VoidedFrozen
ON __mj_BizAppsAccounting.JournalEntryLineDimension
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (
        SELECT 1
        FROM __mj_BizAppsAccounting.JournalEntryLine jel
        JOIN __mj_BizAppsAccounting.JournalEntry je ON je.ID = jel.JournalEntryID
        WHERE je.Status = 'Voided'
          AND jel.ID IN (SELECT JournalEntryLineID FROM inserted UNION SELECT JournalEntryLineID FROM deleted)
    )
    BEGIN
        THROW 50044, 'The line dimensions of a Voided journal entry cannot be inserted, modified, or deleted.', 1;
    END;
END;
GO


-- -----------------------------------------------------------------------------
-- 4. Column descriptions — CodeGen carries these into EntityField.Description
-- -----------------------------------------------------------------------------
EXEC sp_updateextendedproperty @name = N'MS_Description',
    @value = N'Lifecycle state: Pending | Batched | GLPosted | Voided (BA-D6). Locked after Batched; only GLPosted transition and GL-roundtrip fields may change. Voided is terminal and reached only from Pending in no batch: the entry never reaches a batch, the ERP or a balance, and it and its lines are frozen.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntry', @level2type = N'COLUMN', @level2name = N'Status';
GO

EXEC sp_addextendedproperty @name = N'MS_Description',
    @value = N'Why this entry was voided instead of posted. Required when Status = Voided and empty otherwise (CK_JournalEntry_VoidAudit).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntry', @level2type = N'COLUMN', @level2name = N'VoidReason';
GO

EXEC sp_addextendedproperty @name = N'MS_Description',
    @value = N'When the entry was voided. Required when Status = Voided and empty otherwise.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntry', @level2type = N'COLUMN', @level2name = N'VoidedAt';
GO

EXEC sp_addextendedproperty @name = N'MS_Description',
    @value = N'User who voided the entry. Required when Status = Voided and empty otherwise.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntry', @level2type = N'COLUMN', @level2name = N'VoidedByUserID';
GO

















































-- =============================================================================
-- CODEGEN OUTPUT — GENERATED CODE BELOW THIS LINE. DO NOT EDIT BY HAND.
-- =============================================================================

/* SQL text to update existing entities from schema */
EXEC [${mjSchema}].[spUpdateExistingEntitiesFromSchema] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';

/* Seed Hierarchy.IsHierarchy on legacy self-referencing FK MJ_BizApps_Accounting: Journal Entries.ReversedByJournalEntryID */
UPDATE [${mjSchema}].[EntityField]
                         SET [Configuration] = '{"Hierarchy":{"IsHierarchy":true}}'
                         WHERE [ID] = '1942E506-B262-4583-BBD9-51B18A56A743' AND ([Configuration] IS NULL OR [Configuration] = '');

/* Seed Hierarchy.IsHierarchy on legacy self-referencing FK MJ_BizApps_Accounting: Journal Entries.ReversesJournalEntryID */
UPDATE [${mjSchema}].[EntityField]
                         SET [Configuration] = '{"Hierarchy":{"IsHierarchy":true}}'
                         WHERE [ID] = 'AB87731D-1323-4D32-8C24-87AB12084818' AND ([Configuration] IS NULL OR [Configuration] = '');

/* SQL text to insert 3 new entity field(s) */

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '48bdcb03-2370-4356-a20c-f69608c95bd2' OR (EntityID = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762' AND Name = 'VoidReason')) BEGIN
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
            '48bdcb03-2370-4356-a20c-f69608c95bd2',
            'C040A1FC-16CE-49CB-B0E2-4F233BD0D762', -- Entity: MJ_BizApps_Accounting: Journal Entries
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762'),
            'VoidReason',
            'Void Reason',
            'Why this entry was voided instead of posted. Required when Status = Voided and empty otherwise (CK_JournalEntry_VoidAudit).',
            'nvarchar',
            2000,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '354b20ae-46fb-43e1-abb4-f0007aaad72a' OR (EntityID = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762' AND Name = 'VoidedAt')) BEGIN
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
            '354b20ae-46fb-43e1-abb4-f0007aaad72a',
            'C040A1FC-16CE-49CB-B0E2-4F233BD0D762', -- Entity: MJ_BizApps_Accounting: Journal Entries
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762'),
            'VoidedAt',
            'Voided At',
            'When the entry was voided. Required when Status = Voided and empty otherwise.',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'e949992b-21ee-4af0-ba7f-81ba82e304fa' OR (EntityID = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762' AND Name = 'VoidedByUserID')) BEGIN
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
            'e949992b-21ee-4af0-ba7f-81ba82e304fa',
            'C040A1FC-16CE-49CB-B0E2-4F233BD0D762', -- Entity: MJ_BizApps_Accounting: Journal Entries
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762'),
            'VoidedByUserID',
            'Voided By User ID',
            'User who voided the entry. Required when Status = Voided and empty otherwise.',
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

/* SQL text to update existing entity fields from schema */
EXEC [${mjSchema}].[spUpdateExistingEntityFieldsFromSchema] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';

/* Update IS-A parent field Name on MJ_BizApps_Accounting: Accounting Company Profiles */
UPDATE [${mjSchema}].[EntityField]
                  SET [IsVirtual]=1,
                      [Type]='nvarchar',
                      [Length]=100,
                      [Precision]=0,
                      [Scale]=0,
                      [AllowsNull]=0,
                      [AllowUpdateAPI]=1,
                      [IncludeRelatedEntityNameFieldInBaseView]=0,
                      [RelatedEntityID]=NULL,
                      [RelatedEntityFieldName]=NULL,
                      [RelatedEntityDisplayType]='Dropdown'
                  WHERE [ID]='B79E7941-2AA9-4761-BEB7-9ABF2A98C0AD';

/* Update IS-A parent field Description on MJ_BizApps_Accounting: Accounting Company Profiles */
UPDATE [${mjSchema}].[EntityField]
                  SET [IsVirtual]=1,
                      [Type]='nvarchar',
                      [Length]=400,
                      [Precision]=0,
                      [Scale]=0,
                      [AllowsNull]=0,
                      [AllowUpdateAPI]=1,
                      [IncludeRelatedEntityNameFieldInBaseView]=0,
                      [RelatedEntityID]=NULL,
                      [RelatedEntityFieldName]=NULL,
                      [RelatedEntityDisplayType]='Dropdown'
                  WHERE [ID]='2F99FAB0-EE99-4A33-825A-A5158528FC23';

/* Update IS-A parent field Website on MJ_BizApps_Accounting: Accounting Company Profiles */
UPDATE [${mjSchema}].[EntityField]
                  SET [IsVirtual]=1,
                      [Type]='nvarchar',
                      [Length]=200,
                      [Precision]=0,
                      [Scale]=0,
                      [AllowsNull]=1,
                      [AllowUpdateAPI]=1,
                      [IncludeRelatedEntityNameFieldInBaseView]=0,
                      [RelatedEntityID]=NULL,
                      [RelatedEntityFieldName]=NULL,
                      [RelatedEntityDisplayType]='Dropdown'
                  WHERE [ID]='FF935548-2816-4B2C-AEC8-A06DFC349CFE';

/* Update IS-A parent field LogoURL on MJ_BizApps_Accounting: Accounting Company Profiles */
UPDATE [${mjSchema}].[EntityField]
                  SET [IsVirtual]=1,
                      [Type]='nvarchar',
                      [Length]=1000,
                      [Precision]=0,
                      [Scale]=0,
                      [AllowsNull]=1,
                      [AllowUpdateAPI]=1,
                      [IncludeRelatedEntityNameFieldInBaseView]=0,
                      [RelatedEntityID]=NULL,
                      [RelatedEntityFieldName]=NULL,
                      [RelatedEntityDisplayType]='Dropdown'
                  WHERE [ID]='AF88A4E4-6383-42E5-82F2-F3E7E7E9D009';

/* Update IS-A parent field Domain on MJ_BizApps_Accounting: Accounting Company Profiles */
UPDATE [${mjSchema}].[EntityField]
                  SET [IsVirtual]=1,
                      [Type]='nvarchar',
                      [Length]=510,
                      [Precision]=0,
                      [Scale]=0,
                      [AllowsNull]=1,
                      [AllowUpdateAPI]=1,
                      [IncludeRelatedEntityNameFieldInBaseView]=0,
                      [RelatedEntityID]=NULL,
                      [RelatedEntityFieldName]=NULL,
                      [RelatedEntityDisplayType]='Dropdown'
                  WHERE [ID]='D7D7E52E-22C9-401B-AF67-43559CB5C4DB';

/* Update entity timestamp for MJ_BizApps_Accounting: Accounting Company Profiles after IS-A field sync */
UPDATE [${mjSchema}].[Entity] SET [__mj_UpdatedAt]=GETUTCDATE() WHERE ID='3E551198-AB66-478E-BEB6-C34EDBE242EC';

/* SQL text to set default column width where needed */
EXEC [${mjSchema}].[spSetDefaultColumnWidthWhereNeeded] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to insert entity field value with ID 4b9ea148-3028-4605-abea-f741ba2d4f2a */
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('4b9ea148-3028-4605-abea-f741ba2d4f2a', 'E5F8375D-12F9-4D6C-9502-080082D84921', 4, 'Voided', 'Voided', GETUTCDATE(), GETUTCDATE());

/* Deterministic search-flag hygiene — clear AllowUserSearchAPI */

         UPDATE [${mjSchema}].[Entity]
         SET [AllowUserSearchAPI] = 0
         WHERE [ID] IN (
            SELECT e.[ID]
            FROM [${mjSchema}].[Entity] e
            WHERE e.[AllowUserSearchAPI] = 1
              AND e.[AutoUpdateAllowUserSearchAPI] = 1
              AND e.[VirtualEntity] = 0
              AND ISNULL(e.[FullTextSearchEnabled], 0) = 0
              AND e.[SchemaName] NOT IN ('${mjSchema}','__mj_BizAppsCommon','__mj_BizAppsTasks','sys')
              AND NOT EXISTS (
               SELECT 1 FROM [${mjSchema}].[EntityField] f2
               WHERE f2.[EntityID] = e.[ID]
                 AND f2.[IncludeInUserSearchAPI] = 1
            )
         );


/* Heal EntityRelationship EntityKeyField from '' to Code (non-PK join column) */
   UPDATE [${mjSchema}].[EntityRelationship]
      SET [EntityKeyField] = 'Code',
          [__mj_UpdatedAt] = GETUTCDATE()
      WHERE [ID] = '216658DB-99C3-417B-8CAE-81F083876B8E';


/* Heal EntityRelationship EntityKeyField from '' to Code (non-PK join column) */
   UPDATE [${mjSchema}].[EntityRelationship]
      SET [EntityKeyField] = 'Code',
          [__mj_UpdatedAt] = GETUTCDATE()
      WHERE [ID] = '6A948F11-F00D-4A30-9FB0-675EEFD39667';

/* Heal EntityRelationship EntityKeyField from '' to Code (non-PK join column) */
   UPDATE [${mjSchema}].[EntityRelationship]
      SET [EntityKeyField] = 'Code',
          [__mj_UpdatedAt] = GETUTCDATE()
      WHERE [ID] = 'D4A6D51A-8406-4C23-A5F3-3EBC5DEBD111';

/* Heal EntityRelationship EntityKeyField from '' to Code (non-PK join column) */
   UPDATE [${mjSchema}].[EntityRelationship]
      SET [EntityKeyField] = 'Code',
          [__mj_UpdatedAt] = GETUTCDATE()
      WHERE [ID] = 'B60EDD8C-C56F-4AD0-84A9-9A9792E578F9';

/* Heal EntityRelationship EntityKeyField from '' to Code (non-PK join column) */
   UPDATE [${mjSchema}].[EntityRelationship]
      SET [EntityKeyField] = 'Code',
          [__mj_UpdatedAt] = GETUTCDATE()
      WHERE [ID] = '40F08B08-D8AD-4A06-8B30-4D4775AA4274';

/* Heal EntityRelationship EntityKeyField from '' to Code (non-PK join column) */
   UPDATE [${mjSchema}].[EntityRelationship]
      SET [EntityKeyField] = 'Code',
          [__mj_UpdatedAt] = GETUTCDATE()
      WHERE [ID] = '5F5962F2-60AC-4416-8F91-AC77876DEF13';


/* Create Entity Relationship: MJ: Users -> MJ_BizApps_Accounting: Journal Entries (One To Many via VoidedByUserID) */
   IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntityRelationship] WHERE [ID] = '9aea0603-7de9-4f11-b1cd-81e01330f448' OR ([EntityID] = 'E1238F34-2837-EF11-86D4-6045BDEE16E6' AND [RelatedEntityID] = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762' AND [RelatedEntityJoinField] = 'VoidedByUserID')
   )
   BEGIN
      INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
                    VALUES ('9aea0603-7de9-4f11-b1cd-81e01330f448', 'E1238F34-2837-EF11-86D4-6045BDEE16E6', 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762', 'VoidedByUserID', 'One To Many', 1, 1, 147, GETUTCDATE(), GETUTCDATE())
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
    __mj_isa_p1.[Name],
    __mj_isa_p1.[Description],
    __mj_isa_p1.[Website],
    __mj_isa_p1.[LogoURL],
    __mj_isa_p1.[Domain],
    mjBizAppsAccountingCurrency_FunctionalCurrencyCode.[Name] AS [FunctionalCurrencyCode_Virtual],
    mjBizAppsAccountingCurrency_ReportingCurrencyCode.[Name] AS [ReportingCurrencyCode_Virtual],
    MJUser_ApprovalCFOUserID.[Name] AS [ApprovalCFOUser],
    MJRole_ManualJournalEntryApproverRoleID.[Name] AS [ManualJournalEntryApproverRole],
    __mj_rgc.[Latitude] AS [__mj_Latitude],
    __mj_rgc.[Longitude] AS [__mj_Longitude],
    hier_ParentAccountingCompanyID.RootID AS [RootParentAccountingCompanyID],
    hier_ParentAccountingCompanyID.Depth AS [ParentAccountingCompanyIDDepth],
    hier_ParentAccountingCompanyID.Path AS [ParentAccountingCompanyIDPath],
    hier_ParentAccountingCompanyID.IsLeaf AS [ParentAccountingCompanyIDIsLeaf],
    hier_ParentAccountingCompanyID.ChildCount AS [ParentAccountingCompanyIDChildCount]
FROM
    [${flyway:defaultSchema}].[AccountingCompanyProfile] AS a
INNER JOIN
    [${mjSchema}].[Company] AS __mj_isa_p1
  ON
    [a].[ID] = __mj_isa_p1.[ID]
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
    [${mjSchema}].[vwRecordGeoCodes] AS __mj_rgc
  ON
    __mj_rgc.[EntityID] = '3E551198-AB66-478E-BEB6-C34EDBE242EC'
    AND __mj_rgc.[RecordID] = CAST([a].[ID] AS NVARCHAR(450))
    AND __mj_rgc.[LocationType] = 'Primary'
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
    @ManualJournalEntryApproverRoleID uniqueidentifier = NULL,
    @BooksClosedThroughDate_Clear bit = 0,
    @BooksClosedThroughDate date = NULL
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
                [BooksClosedThroughDate],
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
                CASE WHEN @BooksClosedThroughDate_Clear = 1 THEN NULL ELSE ISNULL(@BooksClosedThroughDate, NULL) END,
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
    @ManualJournalEntryApproverRoleID uniqueidentifier = NULL,
    @BooksClosedThroughDate_Clear bit = 0,
    @BooksClosedThroughDate date = NULL
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
        [ManualJournalEntryApproverRoleID] = CASE WHEN @ManualJournalEntryApproverRoleID_Clear = 1 THEN NULL ELSE ISNULL(@ManualJournalEntryApproverRoleID, [ManualJournalEntryApproverRoleID]) END,
        [BooksClosedThroughDate] = CASE WHEN @BooksClosedThroughDate_Clear = 1 THEN NULL ELSE ISNULL(@BooksClosedThroughDate, [BooksClosedThroughDate]) END
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

-- Index for foreign key VoidedByUserID in table JournalEntry
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_JournalEntry_VoidedByUserID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[JournalEntry]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_JournalEntry_VoidedByUserID ON [${flyway:defaultSchema}].[JournalEntry] ([VoidedByUserID]);

/* SQL text to update entity field related entity name field map for entity field ID E949992B-21EE-4AF0-BA7F-81BA82E304FA */
EXEC [${mjSchema}].[spUpdateEntityFieldRelatedEntityNameFieldMap] @EntityFieldID='E949992B-21EE-4AF0-BA7F-81BA82E304FA', @RelatedEntityNameFieldMap='VoidedByUser';

/* Hierarchy Metadata Function SQL for MJ_BizApps_Accounting: Journal Entries.ReversesJournalEntryID */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Journal Entries
-- Item: fnJournalEntryReversesJournalEntryID_GetHierarchyMeta
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------
------------------------------------------------------------
----- HIERARCHY METADATA FUNCTION FOR: [JournalEntry].[ReversesJournalEntryID]
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[fnJournalEntryReversesJournalEntryID_GetHierarchyMeta]', 'IF') IS NOT NULL
    DROP FUNCTION [${flyway:defaultSchema}].[fnJournalEntryReversesJournalEntryID_GetHierarchyMeta];
GO

CREATE FUNCTION [${flyway:defaultSchema}].[fnJournalEntryReversesJournalEntryID_GetHierarchyMeta]
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
            [ReversesJournalEntryID],
            0 AS [Depth],
            CAST('/' + CAST([ID] AS NVARCHAR(36)) + '/' AS NVARCHAR(MAX)) AS [Path]
        FROM
            [${flyway:defaultSchema}].[JournalEntry]
        WHERE
            [ID] = @RecordID

        UNION ALL

        SELECT
            p.[ID],
            p.[ReversesJournalEntryID],
            c.[Depth] + 1 AS [Depth],
            CAST('/' + CAST(p.[ID] AS NVARCHAR(36)) + c.[Path] AS NVARCHAR(MAX)) AS [Path]
        FROM
            [${flyway:defaultSchema}].[JournalEntry] p
        INNER JOIN
            CTE_Ancestors c ON p.[ID] = c.[ReversesJournalEntryID]
        WHERE
            c.[Depth] < 100
    )
    SELECT TOP 1
        a.[ID] AS [RootID],
        (SELECT MAX([Depth]) FROM CTE_Ancestors) AS [Depth],
        (SELECT TOP 1 [Path] FROM CTE_Ancestors ORDER BY [Depth] DESC) AS [Path],
        CAST(CASE WHEN EXISTS (SELECT 1 FROM [${flyway:defaultSchema}].[JournalEntry] WHERE [ReversesJournalEntryID] = @RecordID) THEN 0 ELSE 1 END AS BIT) AS [IsLeaf],
        (SELECT COUNT(1) FROM [${flyway:defaultSchema}].[JournalEntry] WHERE [ReversesJournalEntryID] = @RecordID) AS [ChildCount]
    FROM
        CTE_Ancestors a
    WHERE
        a.[ReversesJournalEntryID] IS NULL OR @ParentID IS NULL
    ORDER BY
        a.[Depth] DESC
);
GO

/* Descendants Traversal Function SQL for MJ_BizApps_Accounting: Journal Entries.ReversesJournalEntryID */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Journal Entries
-- Item: fnJournalEntryReversesJournalEntryID_GetDescendants
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------
------------------------------------------------------------
----- DESCENDANTS FUNCTION FOR: [JournalEntry].[ReversesJournalEntryID]
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[fnJournalEntryReversesJournalEntryID_GetDescendants]', 'IF') IS NOT NULL
    DROP FUNCTION [${flyway:defaultSchema}].[fnJournalEntryReversesJournalEntryID_GetDescendants];
GO

CREATE FUNCTION [${flyway:defaultSchema}].[fnJournalEntryReversesJournalEntryID_GetDescendants]
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
            [ReversesJournalEntryID],
            0 AS [RelativeDepth],
            CAST('/' + CAST([ID] AS NVARCHAR(36)) + '/' AS NVARCHAR(MAX)) AS [Path]
        FROM
            [${flyway:defaultSchema}].[JournalEntry]
        WHERE
            [ID] = @RootID

        UNION ALL

        SELECT
            c.[ID],
            c.[ReversesJournalEntryID],
            p.[RelativeDepth] + 1 AS [RelativeDepth],
            CAST(p.[Path] + CAST(c.[ID] AS NVARCHAR(36)) + '/' AS NVARCHAR(MAX)) AS [Path]
        FROM
            [${flyway:defaultSchema}].[JournalEntry] c
        INNER JOIN
            CTE_Descendants p ON c.[ReversesJournalEntryID] = p.[ID]
        WHERE
            (@MaxDepth IS NULL OR p.[RelativeDepth] < @MaxDepth)
            AND p.[RelativeDepth] < 100
    )
    SELECT
        d.[ID] AS [ID],
        d.[RelativeDepth] AS [Depth],
        d.[Path],
        CAST(CASE WHEN EXISTS (SELECT 1 FROM [${flyway:defaultSchema}].[JournalEntry] WHERE [ReversesJournalEntryID] = d.[ID]) THEN 0 ELSE 1 END AS BIT) AS [IsLeaf],
        (SELECT COUNT(1) FROM [${flyway:defaultSchema}].[JournalEntry] WHERE [ReversesJournalEntryID] = d.[ID]) AS [ChildCount]
    FROM
        CTE_Descendants d
);
GO

/* Ancestors Traversal Function SQL for MJ_BizApps_Accounting: Journal Entries.ReversesJournalEntryID */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Journal Entries
-- Item: fnJournalEntryReversesJournalEntryID_GetAncestors
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------
------------------------------------------------------------
----- ANCESTORS FUNCTION FOR: [JournalEntry].[ReversesJournalEntryID]
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[fnJournalEntryReversesJournalEntryID_GetAncestors]', 'IF') IS NOT NULL
    DROP FUNCTION [${flyway:defaultSchema}].[fnJournalEntryReversesJournalEntryID_GetAncestors];
GO

CREATE FUNCTION [${flyway:defaultSchema}].[fnJournalEntryReversesJournalEntryID_GetAncestors]
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
            [ReversesJournalEntryID],
            0 AS [LevelUp],
            CAST('/' + CAST([ID] AS NVARCHAR(36)) + '/' AS NVARCHAR(MAX)) AS [Path]
        FROM
            [${flyway:defaultSchema}].[JournalEntry]
        WHERE
            [ID] = @RecordID

        UNION ALL

        SELECT
            p.[ID],
            p.[ReversesJournalEntryID],
            c.[LevelUp] + 1 AS [LevelUp],
            CAST('/' + CAST(p.[ID] AS NVARCHAR(36)) + c.[Path] AS NVARCHAR(MAX)) AS [Path]
        FROM
            [${flyway:defaultSchema}].[JournalEntry] p
        INNER JOIN
            CTE_Ancestors c ON p.[ID] = c.[ReversesJournalEntryID]
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

/* Root ID Function SQL for MJ_BizApps_Accounting: Journal Entries.ReversesJournalEntryID */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Journal Entries
-- Item: fnJournalEntryReversesJournalEntryID_GetRootID
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------
------------------------------------------------------------
----- ROOT ID FUNCTION FOR: [JournalEntry].[ReversesJournalEntryID]
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[fnJournalEntryReversesJournalEntryID_GetRootID]', 'IF') IS NOT NULL
    DROP FUNCTION [${flyway:defaultSchema}].[fnJournalEntryReversesJournalEntryID_GetRootID];
GO

CREATE FUNCTION [${flyway:defaultSchema}].[fnJournalEntryReversesJournalEntryID_GetRootID]
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
            [ReversesJournalEntryID],
            [ID] AS [RootParentID],
            0 AS [Depth]
        FROM
            [${flyway:defaultSchema}].[JournalEntry]
        WHERE
            [ID] = COALESCE(@ParentID, @RecordID)

        UNION ALL

        SELECT
            c.[ID],
            c.[ReversesJournalEntryID],
            c.[ID] AS [RootParentID],
            p.[Depth] + 1 AS [Depth]
        FROM
            [${flyway:defaultSchema}].[JournalEntry] c
        INNER JOIN
            CTE_RootParent p ON c.[ID] = p.[ReversesJournalEntryID]
        WHERE
            p.[Depth] < 100
    )
    SELECT TOP 1
        [RootParentID] AS RootID
    FROM
        CTE_RootParent
    WHERE
        [ReversesJournalEntryID] IS NULL
    ORDER BY
        [RootParentID]
);
GO

/* Hierarchy Metadata Function SQL for MJ_BizApps_Accounting: Journal Entries.ReversedByJournalEntryID */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Journal Entries
-- Item: fnJournalEntryReversedByJournalEntryID_GetHierarchyMeta
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------
------------------------------------------------------------
----- HIERARCHY METADATA FUNCTION FOR: [JournalEntry].[ReversedByJournalEntryID]
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[fnJournalEntryReversedByJournalEntryID_GetHierarchyMeta]', 'IF') IS NOT NULL
    DROP FUNCTION [${flyway:defaultSchema}].[fnJournalEntryReversedByJournalEntryID_GetHierarchyMeta];
GO

CREATE FUNCTION [${flyway:defaultSchema}].[fnJournalEntryReversedByJournalEntryID_GetHierarchyMeta]
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
            [ReversedByJournalEntryID],
            0 AS [Depth],
            CAST('/' + CAST([ID] AS NVARCHAR(36)) + '/' AS NVARCHAR(MAX)) AS [Path]
        FROM
            [${flyway:defaultSchema}].[JournalEntry]
        WHERE
            [ID] = @RecordID

        UNION ALL

        SELECT
            p.[ID],
            p.[ReversedByJournalEntryID],
            c.[Depth] + 1 AS [Depth],
            CAST('/' + CAST(p.[ID] AS NVARCHAR(36)) + c.[Path] AS NVARCHAR(MAX)) AS [Path]
        FROM
            [${flyway:defaultSchema}].[JournalEntry] p
        INNER JOIN
            CTE_Ancestors c ON p.[ID] = c.[ReversedByJournalEntryID]
        WHERE
            c.[Depth] < 100
    )
    SELECT TOP 1
        a.[ID] AS [RootID],
        (SELECT MAX([Depth]) FROM CTE_Ancestors) AS [Depth],
        (SELECT TOP 1 [Path] FROM CTE_Ancestors ORDER BY [Depth] DESC) AS [Path],
        CAST(CASE WHEN EXISTS (SELECT 1 FROM [${flyway:defaultSchema}].[JournalEntry] WHERE [ReversedByJournalEntryID] = @RecordID) THEN 0 ELSE 1 END AS BIT) AS [IsLeaf],
        (SELECT COUNT(1) FROM [${flyway:defaultSchema}].[JournalEntry] WHERE [ReversedByJournalEntryID] = @RecordID) AS [ChildCount]
    FROM
        CTE_Ancestors a
    WHERE
        a.[ReversedByJournalEntryID] IS NULL OR @ParentID IS NULL
    ORDER BY
        a.[Depth] DESC
);
GO

/* Descendants Traversal Function SQL for MJ_BizApps_Accounting: Journal Entries.ReversedByJournalEntryID */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Journal Entries
-- Item: fnJournalEntryReversedByJournalEntryID_GetDescendants
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------
------------------------------------------------------------
----- DESCENDANTS FUNCTION FOR: [JournalEntry].[ReversedByJournalEntryID]
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[fnJournalEntryReversedByJournalEntryID_GetDescendants]', 'IF') IS NOT NULL
    DROP FUNCTION [${flyway:defaultSchema}].[fnJournalEntryReversedByJournalEntryID_GetDescendants];
GO

CREATE FUNCTION [${flyway:defaultSchema}].[fnJournalEntryReversedByJournalEntryID_GetDescendants]
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
            [ReversedByJournalEntryID],
            0 AS [RelativeDepth],
            CAST('/' + CAST([ID] AS NVARCHAR(36)) + '/' AS NVARCHAR(MAX)) AS [Path]
        FROM
            [${flyway:defaultSchema}].[JournalEntry]
        WHERE
            [ID] = @RootID

        UNION ALL

        SELECT
            c.[ID],
            c.[ReversedByJournalEntryID],
            p.[RelativeDepth] + 1 AS [RelativeDepth],
            CAST(p.[Path] + CAST(c.[ID] AS NVARCHAR(36)) + '/' AS NVARCHAR(MAX)) AS [Path]
        FROM
            [${flyway:defaultSchema}].[JournalEntry] c
        INNER JOIN
            CTE_Descendants p ON c.[ReversedByJournalEntryID] = p.[ID]
        WHERE
            (@MaxDepth IS NULL OR p.[RelativeDepth] < @MaxDepth)
            AND p.[RelativeDepth] < 100
    )
    SELECT
        d.[ID] AS [ID],
        d.[RelativeDepth] AS [Depth],
        d.[Path],
        CAST(CASE WHEN EXISTS (SELECT 1 FROM [${flyway:defaultSchema}].[JournalEntry] WHERE [ReversedByJournalEntryID] = d.[ID]) THEN 0 ELSE 1 END AS BIT) AS [IsLeaf],
        (SELECT COUNT(1) FROM [${flyway:defaultSchema}].[JournalEntry] WHERE [ReversedByJournalEntryID] = d.[ID]) AS [ChildCount]
    FROM
        CTE_Descendants d
);
GO

/* Ancestors Traversal Function SQL for MJ_BizApps_Accounting: Journal Entries.ReversedByJournalEntryID */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Journal Entries
-- Item: fnJournalEntryReversedByJournalEntryID_GetAncestors
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------
------------------------------------------------------------
----- ANCESTORS FUNCTION FOR: [JournalEntry].[ReversedByJournalEntryID]
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[fnJournalEntryReversedByJournalEntryID_GetAncestors]', 'IF') IS NOT NULL
    DROP FUNCTION [${flyway:defaultSchema}].[fnJournalEntryReversedByJournalEntryID_GetAncestors];
GO

CREATE FUNCTION [${flyway:defaultSchema}].[fnJournalEntryReversedByJournalEntryID_GetAncestors]
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
            [ReversedByJournalEntryID],
            0 AS [LevelUp],
            CAST('/' + CAST([ID] AS NVARCHAR(36)) + '/' AS NVARCHAR(MAX)) AS [Path]
        FROM
            [${flyway:defaultSchema}].[JournalEntry]
        WHERE
            [ID] = @RecordID

        UNION ALL

        SELECT
            p.[ID],
            p.[ReversedByJournalEntryID],
            c.[LevelUp] + 1 AS [LevelUp],
            CAST('/' + CAST(p.[ID] AS NVARCHAR(36)) + c.[Path] AS NVARCHAR(MAX)) AS [Path]
        FROM
            [${flyway:defaultSchema}].[JournalEntry] p
        INNER JOIN
            CTE_Ancestors c ON p.[ID] = c.[ReversedByJournalEntryID]
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

/* Root ID Function SQL for MJ_BizApps_Accounting: Journal Entries.ReversedByJournalEntryID */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Journal Entries
-- Item: fnJournalEntryReversedByJournalEntryID_GetRootID
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------
------------------------------------------------------------
----- ROOT ID FUNCTION FOR: [JournalEntry].[ReversedByJournalEntryID]
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[fnJournalEntryReversedByJournalEntryID_GetRootID]', 'IF') IS NOT NULL
    DROP FUNCTION [${flyway:defaultSchema}].[fnJournalEntryReversedByJournalEntryID_GetRootID];
GO

CREATE FUNCTION [${flyway:defaultSchema}].[fnJournalEntryReversedByJournalEntryID_GetRootID]
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
            [ReversedByJournalEntryID],
            [ID] AS [RootParentID],
            0 AS [Depth]
        FROM
            [${flyway:defaultSchema}].[JournalEntry]
        WHERE
            [ID] = COALESCE(@ParentID, @RecordID)

        UNION ALL

        SELECT
            c.[ID],
            c.[ReversedByJournalEntryID],
            c.[ID] AS [RootParentID],
            p.[Depth] + 1 AS [Depth]
        FROM
            [${flyway:defaultSchema}].[JournalEntry] c
        INNER JOIN
            CTE_RootParent p ON c.[ID] = p.[ReversedByJournalEntryID]
        WHERE
            p.[Depth] < 100
    )
    SELECT TOP 1
        [RootParentID] AS RootID
    FROM
        CTE_RootParent
    WHERE
        [ReversedByJournalEntryID] IS NULL
    ORDER BY
        [RootParentID]
);
GO

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
    MJUser_ApprovedByUserID.[Name] AS [ApprovedByUser],
    MJUser_VoidedByUserID.[Name] AS [VoidedByUser],
    hier_ReversesJournalEntryID.RootID AS [RootReversesJournalEntryID],
    hier_ReversesJournalEntryID.Depth AS [ReversesJournalEntryIDDepth],
    hier_ReversesJournalEntryID.Path AS [ReversesJournalEntryIDPath],
    hier_ReversesJournalEntryID.IsLeaf AS [ReversesJournalEntryIDIsLeaf],
    hier_ReversesJournalEntryID.ChildCount AS [ReversesJournalEntryIDChildCount],
    hier_ReversedByJournalEntryID.RootID AS [RootReversedByJournalEntryID],
    hier_ReversedByJournalEntryID.Depth AS [ReversedByJournalEntryIDDepth],
    hier_ReversedByJournalEntryID.Path AS [ReversedByJournalEntryIDPath],
    hier_ReversedByJournalEntryID.IsLeaf AS [ReversedByJournalEntryIDIsLeaf],
    hier_ReversedByJournalEntryID.ChildCount AS [ReversedByJournalEntryIDChildCount]
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
    [__mj_BizAppsTasks].[Task] AS mjBizAppsTasksTask_ApprovalTaskID
  ON
    [j].[ApprovalTaskID] = mjBizAppsTasksTask_ApprovalTaskID.[ID]
LEFT OUTER JOIN
    [${mjSchema}].[User] AS MJUser_ApprovedByUserID
  ON
    [j].[ApprovedByUserID] = MJUser_ApprovedByUserID.[ID]
LEFT OUTER JOIN
    [${mjSchema}].[User] AS MJUser_VoidedByUserID
  ON
    [j].[VoidedByUserID] = MJUser_VoidedByUserID.[ID]
OUTER APPLY
    [${flyway:defaultSchema}].[fnJournalEntryReversesJournalEntryID_GetHierarchyMeta]([j].[ID], [j].[ReversesJournalEntryID]) AS hier_ReversesJournalEntryID
OUTER APPLY
    [${flyway:defaultSchema}].[fnJournalEntryReversedByJournalEntryID_GetHierarchyMeta]([j].[ID], [j].[ReversedByJournalEntryID]) AS hier_ReversedByJournalEntryID
GO
IF OBJECT_ID('[${flyway:defaultSchema}].[vwJournalEntries]', 'V') IS NOT NULL
BEGIN
    EXEC sp_executesql N'REVOKE SELECT ON [${flyway:defaultSchema}].[vwJournalEntries] FROM [cdp_Developer]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwJournalEntries] FROM [cdp_Integration]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwJournalEntries] FROM [cdp_UI]
GRANT SELECT ON [${flyway:defaultSchema}].[vwJournalEntries] TO [cdp_UI], [cdp_Developer], [cdp_Integration]';
END;

/* Refresh layered base view for MJ_BizApps_Accounting: Journal Entries after its inner view changed */
EXEC sp_refreshview '${flyway:defaultSchema}.vwJournalEntriesGenerated';
IF OBJECT_ID('[${flyway:defaultSchema}].[vwJournalEntries]', 'V') IS NOT NULL
BEGIN
    EXEC sp_executesql N'EXEC sp_refreshview ''${flyway:defaultSchema}.vwJournalEntries'';';
END

GO

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
    @ApprovedByUserID uniqueidentifier = NULL,
    @VoidReason_Clear bit = 0,
    @VoidReason nvarchar(1000) = NULL,
    @VoidedAt_Clear bit = 0,
    @VoidedAt datetimeoffset = NULL,
    @VoidedByUserID_Clear bit = 0,
    @VoidedByUserID uniqueidentifier = NULL
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
                [ApprovedByUserID],
                [VoidReason],
                [VoidedAt],
                [VoidedByUserID]
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
                CASE WHEN @ApprovedByUserID_Clear = 1 THEN NULL ELSE ISNULL(@ApprovedByUserID, NULL) END,
                CASE WHEN @VoidReason_Clear = 1 THEN NULL ELSE ISNULL(@VoidReason, NULL) END,
                CASE WHEN @VoidedAt_Clear = 1 THEN NULL ELSE ISNULL(@VoidedAt, NULL) END,
                CASE WHEN @VoidedByUserID_Clear = 1 THEN NULL ELSE ISNULL(@VoidedByUserID, NULL) END
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
                [ApprovedByUserID],
                [VoidReason],
                [VoidedAt],
                [VoidedByUserID]
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
                CASE WHEN @ApprovedByUserID_Clear = 1 THEN NULL ELSE ISNULL(@ApprovedByUserID, NULL) END,
                CASE WHEN @VoidReason_Clear = 1 THEN NULL ELSE ISNULL(@VoidReason, NULL) END,
                CASE WHEN @VoidedAt_Clear = 1 THEN NULL ELSE ISNULL(@VoidedAt, NULL) END,
                CASE WHEN @VoidedByUserID_Clear = 1 THEN NULL ELSE ISNULL(@VoidedByUserID, NULL) END
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
    @ApprovedByUserID uniqueidentifier = NULL,
    @VoidReason_Clear bit = 0,
    @VoidReason nvarchar(1000) = NULL,
    @VoidedAt_Clear bit = 0,
    @VoidedAt datetimeoffset = NULL,
    @VoidedByUserID_Clear bit = 0,
    @VoidedByUserID uniqueidentifier = NULL
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
        [ApprovedByUserID] = CASE WHEN @ApprovedByUserID_Clear = 1 THEN NULL ELSE ISNULL(@ApprovedByUserID, [ApprovedByUserID]) END,
        [VoidReason] = CASE WHEN @VoidReason_Clear = 1 THEN NULL ELSE ISNULL(@VoidReason, [VoidReason]) END,
        [VoidedAt] = CASE WHEN @VoidedAt_Clear = 1 THEN NULL ELSE ISNULL(@VoidedAt, [VoidedAt]) END,
        [VoidedByUserID] = CASE WHEN @VoidedByUserID_Clear = 1 THEN NULL ELSE ISNULL(@VoidedByUserID, [VoidedByUserID]) END
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

/* SQL text to delete unneeded entity fields */
EXEC [${mjSchema}].[spDeleteUnneededEntityFields] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to insert 11 new entity field(s) */

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'ef54ea22-9601-43ed-b8a8-c2cf140a2e0f' OR (EntityID = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762' AND Name = 'VoidedByUser')) BEGIN
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
            'ef54ea22-9601-43ed-b8a8-c2cf140a2e0f',
            'C040A1FC-16CE-49CB-B0E2-4F233BD0D762', -- Entity: MJ_BizApps_Accounting: Journal Entries
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762'),
            'VoidedByUser',
            'Voided By User',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '61e3d297-b9e9-4914-a991-6639c39d0d88' OR (EntityID = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762' AND Name = 'RootReversesJournalEntryID')) BEGIN
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
            '61e3d297-b9e9-4914-a991-6639c39d0d88',
            'C040A1FC-16CE-49CB-B0E2-4F233BD0D762', -- Entity: MJ_BizApps_Accounting: Journal Entries
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762'),
            'RootReversesJournalEntryID',
            'Root Reverses Journal Entry ID',
            NULL,
            'uniqueidentifier',
            16,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'dae91fa5-7060-46b2-9642-755fcdbedd13' OR (EntityID = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762' AND Name = 'ReversesJournalEntryIDDepth')) BEGIN
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
            'dae91fa5-7060-46b2-9642-755fcdbedd13',
            'C040A1FC-16CE-49CB-B0E2-4F233BD0D762', -- Entity: MJ_BizApps_Accounting: Journal Entries
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762'),
            'ReversesJournalEntryIDDepth',
            'Reverses Journal Entry ID Depth',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '2fa501cc-0c0f-4187-b84e-d4937b891e54' OR (EntityID = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762' AND Name = 'ReversesJournalEntryIDPath')) BEGIN
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
            '2fa501cc-0c0f-4187-b84e-d4937b891e54',
            'C040A1FC-16CE-49CB-B0E2-4F233BD0D762', -- Entity: MJ_BizApps_Accounting: Journal Entries
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762'),
            'ReversesJournalEntryIDPath',
            'Reverses Journal Entry ID Path',
            NULL,
            'nvarchar',
            -1,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'a815f2e4-e233-47e7-a7b4-f4d4211325b0' OR (EntityID = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762' AND Name = 'ReversesJournalEntryIDIsLeaf')) BEGIN
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
            'a815f2e4-e233-47e7-a7b4-f4d4211325b0',
            'C040A1FC-16CE-49CB-B0E2-4F233BD0D762', -- Entity: MJ_BizApps_Accounting: Journal Entries
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762'),
            'ReversesJournalEntryIDIsLeaf',
            'Reverses Journal Entry ID Is Leaf',
            NULL,
            'bit',
            1,
            1,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'cf142b1e-b93c-45de-8b5e-44387ae1d1e1' OR (EntityID = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762' AND Name = 'ReversesJournalEntryIDChildCount')) BEGIN
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
            'cf142b1e-b93c-45de-8b5e-44387ae1d1e1',
            'C040A1FC-16CE-49CB-B0E2-4F233BD0D762', -- Entity: MJ_BizApps_Accounting: Journal Entries
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762'),
            'ReversesJournalEntryIDChildCount',
            'Reverses Journal Entry ID Child Count',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '2698ffb6-9938-47d7-8314-95160e32ac56' OR (EntityID = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762' AND Name = 'RootReversedByJournalEntryID')) BEGIN
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
            '2698ffb6-9938-47d7-8314-95160e32ac56',
            'C040A1FC-16CE-49CB-B0E2-4F233BD0D762', -- Entity: MJ_BizApps_Accounting: Journal Entries
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762'),
            'RootReversedByJournalEntryID',
            'Root Reversed By Journal Entry ID',
            NULL,
            'uniqueidentifier',
            16,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '705aaac3-8a2d-4e4e-8023-0a1fb20d8a06' OR (EntityID = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762' AND Name = 'ReversedByJournalEntryIDDepth')) BEGIN
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
            '705aaac3-8a2d-4e4e-8023-0a1fb20d8a06',
            'C040A1FC-16CE-49CB-B0E2-4F233BD0D762', -- Entity: MJ_BizApps_Accounting: Journal Entries
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762'),
            'ReversedByJournalEntryIDDepth',
            'Reversed By Journal Entry ID Depth',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '1ba96cdb-e63d-43f0-a78c-6853c6023aac' OR (EntityID = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762' AND Name = 'ReversedByJournalEntryIDPath')) BEGIN
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
            '1ba96cdb-e63d-43f0-a78c-6853c6023aac',
            'C040A1FC-16CE-49CB-B0E2-4F233BD0D762', -- Entity: MJ_BizApps_Accounting: Journal Entries
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762'),
            'ReversedByJournalEntryIDPath',
            'Reversed By Journal Entry ID Path',
            NULL,
            'nvarchar',
            -1,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '35ef52c5-7ac4-42b9-9b8d-70c02d150c97' OR (EntityID = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762' AND Name = 'ReversedByJournalEntryIDIsLeaf')) BEGIN
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
            '35ef52c5-7ac4-42b9-9b8d-70c02d150c97',
            'C040A1FC-16CE-49CB-B0E2-4F233BD0D762', -- Entity: MJ_BizApps_Accounting: Journal Entries
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762'),
            'ReversedByJournalEntryIDIsLeaf',
            'Reversed By Journal Entry ID Is Leaf',
            NULL,
            'bit',
            1,
            1,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '09ba9f31-95f1-4bb2-bdb4-b8a1eb2863b3' OR (EntityID = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762' AND Name = 'ReversedByJournalEntryIDChildCount')) BEGIN
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
            '09ba9f31-95f1-4bb2-bdb4-b8a1eb2863b3',
            'C040A1FC-16CE-49CB-B0E2-4F233BD0D762', -- Entity: MJ_BizApps_Accounting: Journal Entries
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762'),
            'ReversedByJournalEntryIDChildCount',
            'Reversed By Journal Entry ID Child Count',
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

/* SQL text to update existing entity fields from schema (2 scoped entities) */
EXEC [${mjSchema}].[spUpdateExistingEntityFieldsFromSchema] @ExcludedSchemaNames='', @EntityIDs='C040A1FC-16CE-49CB-B0E2-4F233BD0D762,3E551198-AB66-478E-BEB6-C34EDBE242EC', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to set default column width where needed */
EXEC [${mjSchema}].[spSetDefaultColumnWidthWhereNeeded] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';

/* Set categories for 17 fields */

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Journal Entries.VoidReason 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Classification',
   GeneratedFormSection = 'Category'
WHERE 
   ID = '48BDCB03-2370-4356-A20C-F69608C95BD2';

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Journal Entries.VoidedAt 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Classification',
   GeneratedFormSection = 'Category'
WHERE 
   ID = '354B20AE-46FB-43E1-ABB4-F0007AAAD72A';

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Journal Entries.VoidedByUserID 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Classification',
   GeneratedFormSection = 'Category',
   DisplayName = 'Voided By User'
WHERE 
   ID = 'E949992B-21EE-4AF0-BA7F-81BA82E304FA';

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Journal Entries.ApprovalRequestedByUser 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Approval',
   GeneratedFormSection = 'Category'
WHERE 
   ID = 'FCD8C833-8CBA-4A3A-814D-F9B678C9CD05';

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Journal Entries.ApprovalTask 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Approval',
   GeneratedFormSection = 'Category'
WHERE 
   ID = 'DA9DD1EB-2FA2-4F99-801D-91775F8B1F12';

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Journal Entries.ApprovedByUser 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Approval',
   GeneratedFormSection = 'Category'
WHERE 
   ID = '2EDE0581-5BE1-4235-9D74-4EC4811BC9F2';

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Journal Entries.VoidedByUser 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Classification',
   GeneratedFormSection = 'Category'
WHERE 
   ID = 'EF54EA22-9601-43ED-B8A8-C2CF140A2E0F';

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Journal Entries.RootReversesJournalEntryID 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Reversal Tracking',
   GeneratedFormSection = 'Category',
   DisplayName = 'Root Reverses Journal Entry'
WHERE 
   ID = '61E3D297-B9E9-4914-A991-6639C39D0D88';

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Journal Entries.ReversesJournalEntryIDDepth 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Reversal Tracking',
   GeneratedFormSection = 'Category',
   DisplayName = 'Reverses Journal Entry Depth'
WHERE 
   ID = 'DAE91FA5-7060-46B2-9642-755FCDBEDD13';

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Journal Entries.ReversesJournalEntryIDPath 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Reversal Tracking',
   GeneratedFormSection = 'Category',
   DisplayName = 'Reverses Journal Entry Path'
WHERE 
   ID = '2FA501CC-0C0F-4187-B84E-D4937B891E54';

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Journal Entries.ReversesJournalEntryIDIsLeaf 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Reversal Tracking',
   GeneratedFormSection = 'Category',
   DisplayName = 'Reverses Journal Entry Is Leaf'
WHERE 
   ID = 'A815F2E4-E233-47E7-A7B4-F4D4211325B0';

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Journal Entries.ReversesJournalEntryIDChildCount 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Reversal Tracking',
   GeneratedFormSection = 'Category',
   DisplayName = 'Reverses Journal Entry Child Count'
WHERE 
   ID = 'CF142B1E-B93C-45DE-8B5E-44387AE1D1E1';

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Journal Entries.RootReversedByJournalEntryID 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Reversal Tracking',
   GeneratedFormSection = 'Category',
   DisplayName = 'Root Reversed By Journal Entry'
WHERE 
   ID = '2698FFB6-9938-47D7-8314-95160E32AC56';

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Journal Entries.ReversedByJournalEntryIDDepth 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Reversal Tracking',
   GeneratedFormSection = 'Category',
   DisplayName = 'Reversed By Journal Entry Depth'
WHERE 
   ID = '705AAAC3-8A2D-4E4E-8023-0A1FB20D8A06';

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Journal Entries.ReversedByJournalEntryIDPath 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Reversal Tracking',
   GeneratedFormSection = 'Category',
   DisplayName = 'Reversed By Journal Entry Path'
WHERE 
   ID = '1BA96CDB-E63D-43F0-A78C-6853C6023AAC';

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Journal Entries.ReversedByJournalEntryIDIsLeaf 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Reversal Tracking',
   GeneratedFormSection = 'Category',
   DisplayName = 'Reversed By Journal Entry Is Leaf'
WHERE 
   ID = '35EF52C5-7AC4-42B9-9B8D-70C02D150C97';

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Journal Entries.ReversedByJournalEntryIDChildCount 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Reversal Tracking',
   GeneratedFormSection = 'Category',
   DisplayName = 'Reversed By Journal Entry Child Count'
WHERE 
   ID = '09BA9F31-95F1-4BB2-BDB4-B8A1EB2863B3';

/* Refresh custom base views for modified entities so schema changes are picked up */
EXEC sp_refreshview '${flyway:defaultSchema}.vwJournalEntriesGenerated';
IF OBJECT_ID('[${flyway:defaultSchema}].[vwJournalEntries]', 'V') IS NOT NULL
BEGIN
    EXEC sp_executesql N'EXEC sp_refreshview ''${flyway:defaultSchema}.vwJournalEntries'';';
END;

/* Generated Validation Functions for MJ_BizApps_Accounting: Accounting Company Profiles */
-- CHECK constraint for MJ_BizApps_Accounting: Accounting Company Profiles: Field: ManualJournalEntryApprovalThreshold was newly set or modified since the last generation of the validation function, the code was regenerated and updating the GeneratedCode table with the new generated validation function
IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[GeneratedCode] WHERE [CategoryID] = (SELECT [ID] FROM [${mjSchema}].[vwGeneratedCodeCategories] WHERE [Name]='CodeGen: Validators') AND [LinkedEntityID] = 'DF238F34-2837-EF11-86D4-6045BDEE16E6' AND [LinkedRecordPrimaryKey] = 'D3A4DB04-71B4-48BC-84A1-8D6E29A5D4F1'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[GeneratedCode] ([ID], [CategoryID], [GeneratedByModelID], [GeneratedAt], [Language], [Status], [Source], [Code], [Description], [Name], [LinkedEntityID], [LinkedRecordPrimaryKey])
VALUES ('7c70c025-ae4d-4005-8521-be572c9a9ade', (SELECT [ID] FROM [${mjSchema}].[vwGeneratedCodeCategories] WHERE [Name]='CodeGen: Validators'), '4B500A24-0259-4EFF-9E34-24E9F5EC9DAB', GETUTCDATE(), 'TypeScript', 'Approved', '([ManualJournalEntryApprovalThreshold] IS NULL OR [ManualJournalEntryApprovalThreshold]>=(0))', 'public ValidateManualJournalEntryApprovalThresholdNonNegative(result: ValidationResult) {
	if (this.ManualJournalEntryApprovalThreshold != null && this.ManualJournalEntryApprovalThreshold < 0) {
		result.Errors.push(new ValidationErrorInfo(
			"ManualJournalEntryApprovalThreshold",
			"Manual journal entry approval threshold must be greater than or equal to 0.",
			this.ManualJournalEntryApprovalThreshold,
			ValidationErrorType.Failure
		));
	}
}', 'Manual journal entry approval threshold cannot be negative; it must be zero or greater if specified.', 'ValidateManualJournalEntryApprovalThresholdNonNegative', 'DF238F34-2837-EF11-86D4-6045BDEE16E6', 'D3A4DB04-71B4-48BC-84A1-8D6E29A5D4F1')
   END;

/* Generated Validation Functions for MJ_BizApps_Accounting: Journal Entries */
-- CHECK constraint for MJ_BizApps_Accounting: Journal Entries @ Table Level was newly set or modified since the last generation of the validation function, the code was regenerated and updating the GeneratedCode table with the new generated validation function
IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[GeneratedCode] WHERE [CategoryID] = (SELECT [ID] FROM [${mjSchema}].[vwGeneratedCodeCategories] WHERE [Name]='CodeGen: Validators') AND [LinkedEntityID] = 'E0238F34-2837-EF11-86D4-6045BDEE16E6' AND [LinkedRecordPrimaryKey] = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762' AND [Name] = 'ValidateApprovalDetails'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[GeneratedCode] ([ID], [CategoryID], [GeneratedByModelID], [GeneratedAt], [Language], [Status], [Source], [Code], [Description], [Name], [LinkedEntityID], [LinkedRecordPrimaryKey])
VALUES ('1aed9cdf-4046-4160-ae01-2287b621b488', (SELECT [ID] FROM [${mjSchema}].[vwGeneratedCodeCategories] WHERE [Name]='CodeGen: Validators'), '4B500A24-0259-4EFF-9E34-24E9F5EC9DAB', GETUTCDATE(), 'TypeScript', 'Approved', '([ApprovedAt] IS NULL AND [ApprovedByUserID] IS NULL OR [ApprovedAt] IS NOT NULL AND [ApprovedByUserID] IS NOT NULL AND [ApprovalLevel] IS NOT NULL)', 'public ValidateApprovalDetails(result: ValidationResult): void {
	const hasApprovedAt = this.ApprovedAt != null;
	const hasApprovedByUserID = this.ApprovedByUserID != null;
	const hasApprovalLevel = this.ApprovalLevel != null && this.ApprovalLevel.trim().length > 0;

	const isUnapproved = !hasApprovedAt && !hasApprovedByUserID;
	const isFullyApproved = hasApprovedAt && hasApprovedByUserID && hasApprovalLevel;

	if (!isUnapproved && !isFullyApproved) {
		result.Errors.push(new ValidationErrorInfo(
			"ApprovedAt",
			"When approving an entry, approval timestamp, approving user, and approval level must all be specified. If not approved, approval timestamp and approving user must be blank.",
			this.ApprovedAt,
			ValidationErrorType.Failure
		));
	}
}', 'Ensures that approval details are complete: approval date, approving user, and approval level must all be provided together when an entry is approved, or all remain empty if not approved.', 'ValidateApprovalDetails', 'E0238F34-2837-EF11-86D4-6045BDEE16E6', 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762')
   END;

-- CHECK constraint for MJ_BizApps_Accounting: Journal Entries @ Table Level was newly set or modified since the last generation of the validation function, the code was regenerated and updating the GeneratedCode table with the new generated validation function
IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[GeneratedCode] WHERE [CategoryID] = (SELECT [ID] FROM [${mjSchema}].[vwGeneratedCodeCategories] WHERE [Name]='CodeGen: Validators') AND [LinkedEntityID] = 'E0238F34-2837-EF11-86D4-6045BDEE16E6' AND [LinkedRecordPrimaryKey] = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762' AND [Name] = 'ValidateApprovalLevelAndRequestedByUserID'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[GeneratedCode] ([ID], [CategoryID], [GeneratedByModelID], [GeneratedAt], [Language], [Status], [Source], [Code], [Description], [Name], [LinkedEntityID], [LinkedRecordPrimaryKey])
VALUES ('306b35c1-fd5a-450a-bb61-ed328f1a817a', (SELECT [ID] FROM [${mjSchema}].[vwGeneratedCodeCategories] WHERE [Name]='CodeGen: Validators'), '4B500A24-0259-4EFF-9E34-24E9F5EC9DAB', GETUTCDATE(), 'TypeScript', 'Approved', '([ApprovalLevel] IS NULL AND [ApprovalRequestedByUserID] IS NULL OR [ApprovalLevel] IS NOT NULL AND [ApprovalRequestedByUserID] IS NOT NULL)', 'public ValidateApprovalLevelAndRequestedByUserID(result: ValidationResult) {
	const hasApprovalLevel = this.ApprovalLevel != null && this.ApprovalLevel.trim().length > 0;
	const hasRequestedByUser = this.ApprovalRequestedByUserID != null;

	if ((hasApprovalLevel && !hasRequestedByUser) || (!hasApprovalLevel && hasRequestedByUser)) {
		result.Errors.push(new ValidationErrorInfo(
			"ApprovalLevel",
			"Approval level and the user requesting approval must both be provided together, or both be left blank.",
			this.ApprovalLevel,
			ValidationErrorType.Failure
		));
	}
}', 'Approval level and requesting user must either both be provided or both be empty, ensuring that approval requirements always record who requested the approval.', 'ValidateApprovalLevelAndRequestedByUserID', 'E0238F34-2837-EF11-86D4-6045BDEE16E6', 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762')
   END;

-- CHECK constraint for MJ_BizApps_Accounting: Journal Entries @ Table Level was newly set or modified since the last generation of the validation function, the code was regenerated and updating the GeneratedCode table with the new generated validation function
IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[GeneratedCode] WHERE [CategoryID] = (SELECT [ID] FROM [${mjSchema}].[vwGeneratedCodeCategories] WHERE [Name]='CodeGen: Validators') AND [LinkedEntityID] = 'E0238F34-2837-EF11-86D4-6045BDEE16E6' AND [LinkedRecordPrimaryKey] = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762' AND [Name] = 'ValidateApprovalLevelBatchAndApprovedAt'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[GeneratedCode] ([ID], [CategoryID], [GeneratedByModelID], [GeneratedAt], [Language], [Status], [Source], [Code], [Description], [Name], [LinkedEntityID], [LinkedRecordPrimaryKey])
VALUES ('45d9bf52-c385-40a9-8ded-b30c702b2482', (SELECT [ID] FROM [${mjSchema}].[vwGeneratedCodeCategories] WHERE [Name]='CodeGen: Validators'), '4B500A24-0259-4EFF-9E34-24E9F5EC9DAB', GETUTCDATE(), 'TypeScript', 'Approved', '([ApprovalLevel] IS NULL OR [ApprovedAt] IS NOT NULL OR [JournalEntryBatchID] IS NULL)', 'public ValidateApprovalLevelBatchAndApprovedAt(result: ValidationResult) {
	if (this.ApprovalLevel != null && this.JournalEntryBatchID != null && this.ApprovedAt == null) {
		result.Errors.push(new ValidationErrorInfo(
			"ApprovedAt",
			"An approval date is required for batched journal entries that have an approval level specified.",
			this.ApprovedAt,
			ValidationErrorType.Failure
		));
	}
}', 'Journal entries that are assigned to a batch and have an approval level specified must have an approval date recorded.', 'ValidateApprovalLevelBatchAndApprovedAt', 'E0238F34-2837-EF11-86D4-6045BDEE16E6', 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762')
   END;

-- CHECK constraint for MJ_BizApps_Accounting: Journal Entries @ Table Level was newly set or modified since the last generation of the validation function, the code was regenerated and updating the GeneratedCode table with the new generated validation function
IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[GeneratedCode] WHERE [CategoryID] = (SELECT [ID] FROM [${mjSchema}].[vwGeneratedCodeCategories] WHERE [Name]='CodeGen: Validators') AND [LinkedEntityID] = 'E0238F34-2837-EF11-86D4-6045BDEE16E6' AND [LinkedRecordPrimaryKey] = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762' AND [Name] = 'ValidateJournalEntryBatchIDForStatus'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[GeneratedCode] ([ID], [CategoryID], [GeneratedByModelID], [GeneratedAt], [Language], [Status], [Source], [Code], [Description], [Name], [LinkedEntityID], [LinkedRecordPrimaryKey])
VALUES ('764af510-5520-4fa5-8620-f11954f22b8c', (SELECT [ID] FROM [${mjSchema}].[vwGeneratedCodeCategories] WHERE [Name]='CodeGen: Validators'), '4B500A24-0259-4EFF-9E34-24E9F5EC9DAB', GETUTCDATE(), 'TypeScript', 'Approved', '([Status]=''Voided'' OR [Status]=''Pending'' OR [JournalEntryBatchID] IS NOT NULL)', 'public ValidateJournalEntryBatchIDForStatus(result: ValidationResult) {
	if (this.Status !== ''Voided'' && this.Status !== ''Pending'' && this.JournalEntryBatchID == null) {
		result.Errors.push(new ValidationErrorInfo(
			"JournalEntryBatchID",
			"Journal Entry Batch is required unless the entry status is Pending or Voided.",
			this.JournalEntryBatchID,
			ValidationErrorType.Failure
		));
	}
}', 'Journal entries must belong to a journal entry batch unless their status is Pending or Voided.', 'ValidateJournalEntryBatchIDForStatus', 'E0238F34-2837-EF11-86D4-6045BDEE16E6', 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762')
   END;

-- CHECK constraint for MJ_BizApps_Accounting: Journal Entries @ Table Level was newly set or modified since the last generation of the validation function, the code was regenerated and updating the GeneratedCode table with the new generated validation function
IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[GeneratedCode] WHERE [CategoryID] = (SELECT [ID] FROM [${mjSchema}].[vwGeneratedCodeCategories] WHERE [Name]='CodeGen: Validators') AND [LinkedEntityID] = 'E0238F34-2837-EF11-86D4-6045BDEE16E6' AND [LinkedRecordPrimaryKey] = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762' AND [Name] = 'ValidateStatusAndJournalEntryBatchID'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[GeneratedCode] ([ID], [CategoryID], [GeneratedByModelID], [GeneratedAt], [Language], [Status], [Source], [Code], [Description], [Name], [LinkedEntityID], [LinkedRecordPrimaryKey])
VALUES ('bfc533b1-32eb-40ba-9483-89b26afcab5b', (SELECT [ID] FROM [${mjSchema}].[vwGeneratedCodeCategories] WHERE [Name]='CodeGen: Validators'), '4B500A24-0259-4EFF-9E34-24E9F5EC9DAB', GETUTCDATE(), 'TypeScript', 'Approved', '([Status]<>''Voided'' OR [JournalEntryBatchID] IS NULL)', 'public ValidateStatusAndJournalEntryBatchID(result: ValidationResult) {
	if (this.Status === ''Voided'' && this.JournalEntryBatchID != null) {
		result.Errors.push(new ValidationErrorInfo(
			"JournalEntryBatchID",
			"A voided journal entry cannot be associated with a journal entry batch.",
			this.JournalEntryBatchID,
			ValidationErrorType.Failure
		));
	}
}', 'Voided journal entries cannot be assigned to a journal entry batch.', 'ValidateStatusAndJournalEntryBatchID', 'E0238F34-2837-EF11-86D4-6045BDEE16E6', 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762')
   END;

-- CHECK constraint for MJ_BizApps_Accounting: Journal Entries @ Table Level was newly set or modified since the last generation of the validation function, the code was regenerated and updating the GeneratedCode table with the new generated validation function
IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[GeneratedCode] WHERE [CategoryID] = (SELECT [ID] FROM [${mjSchema}].[vwGeneratedCodeCategories] WHERE [Name]='CodeGen: Validators') AND [LinkedEntityID] = 'E0238F34-2837-EF11-86D4-6045BDEE16E6' AND [LinkedRecordPrimaryKey] = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762' AND [Name] = 'ValidateVoidFieldsForStatus'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[GeneratedCode] ([ID], [CategoryID], [GeneratedByModelID], [GeneratedAt], [Language], [Status], [Source], [Code], [Description], [Name], [LinkedEntityID], [LinkedRecordPrimaryKey])
VALUES ('8a4b0d81-2722-4997-b5ce-e49bb1be9480', (SELECT [ID] FROM [${mjSchema}].[vwGeneratedCodeCategories] WHERE [Name]='CodeGen: Validators'), '4B500A24-0259-4EFF-9E34-24E9F5EC9DAB', GETUTCDATE(), 'TypeScript', 'Approved', '([Status]=''Voided'' AND [VoidReason] IS NOT NULL AND len(Trim([VoidReason]))>(0) AND [VoidedAt] IS NOT NULL AND [VoidedByUserID] IS NOT NULL OR [Status]<>''Voided'' AND [VoidReason] IS NULL AND [VoidedAt] IS NULL AND [VoidedByUserID] IS NULL)', 'public ValidateVoidFieldsForStatus(result: ValidationResult) {
	const isVoided = this.Status === ''Voided'';
	const hasVoidReason = this.VoidReason != null && this.VoidReason.trim().length > 0;
	const hasVoidedAt = this.VoidedAt != null;
	const hasVoidedBy = this.VoidedByUserID != null;

	if (isVoided) {
		if (!hasVoidReason || !hasVoidedAt || !hasVoidedBy) {
			result.Errors.push(new ValidationErrorInfo(
				"Status",
				"Voided entries must specify a void reason, date voided, and the user who voided the record.",
				this.Status,
				ValidationErrorType.Failure
			));
		}
	} else {
		if (this.VoidReason != null || hasVoidedAt || hasVoidedBy) {
			result.Errors.push(new ValidationErrorInfo(
				"Status",
				"Entries that are not voided cannot have a void reason, voided date, or voided by user.",
				this.Status,
				ValidationErrorType.Failure
			));
		}
	}
}', 'Voided records must include a void reason, voided date, and the user who voided the record, while non-voided records must have all void-related fields left blank.', 'ValidateVoidFieldsForStatus', 'E0238F34-2837-EF11-86D4-6045BDEE16E6', 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762')
   END;

