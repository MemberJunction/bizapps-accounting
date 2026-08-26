-- =============================================================================
-- Scoped CodeGen emit for __mj_BizAppsAccounting (mj codegen --skipfiles with
-- includeSchemas). Inspected: regenerates hierarchy GetHierarchyMeta views/SPs
-- for Accounting Company Profiles, Dimension Values, GL Accounts, and Tax
-- Jurisdictions; folds the 16 hierarchy virtual EntityFields (Depth/Path/
-- IsLeaf/ChildCount) that CodeGen leaked into a sibling-schema dump.
-- vwJournalEntries is patched to KEEP RootReversesJournalEntryID and
-- RootReversedByJournalEntryID (leftover hierarchy virtuals in metadata; CodeGen
-- would have DROPped them and 26-vs-24 save-capture would fail).
-- Source: migrations/codegen/CodeGen_Run_2026-08-25_21-20-56.sql
-- EntityFields: sibling leak CodeGen_Run_2026-08-25_21-30-12.sql
-- =============================================================================

/* SQL text to update existing entities from schema */
EXEC [${mjSchema}].[spUpdateExistingEntitiesFromSchema] @ExcludedSchemaNames='sys,staging', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to insert 16 new entity field(s) — hierarchy virtuals for ACP/GL/Tax/Dimension Values.
   CodeGen emitted these during a sibling-schema --skipfiles run; folded here because they belong to Accounting. */

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '5e0dd50a-40bd-4624-bb4e-4a60908bd6ad' OR (EntityID = 'E382FFAB-748C-4EB6-BEA9-1E8DCB7DBC3F' AND Name = 'ParentDimensionValueIDDepth')) BEGIN
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
            '5e0dd50a-40bd-4624-bb4e-4a60908bd6ad',
            'E382FFAB-748C-4EB6-BEA9-1E8DCB7DBC3F', -- Entity: MJ_BizApps_Accounting: Dimension Values
            (SELECT COALESCE(MAX([Sequence]), 0) FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'E382FFAB-748C-4EB6-BEA9-1E8DCB7DBC3F') + 14,
            'ParentDimensionValueIDDepth',
            'Parent Dimension Value ID Depth',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '449d883b-555e-491d-a96a-e3d512ce0818' OR (EntityID = 'E382FFAB-748C-4EB6-BEA9-1E8DCB7DBC3F' AND Name = 'ParentDimensionValueIDPath')) BEGIN
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
            '449d883b-555e-491d-a96a-e3d512ce0818',
            'E382FFAB-748C-4EB6-BEA9-1E8DCB7DBC3F', -- Entity: MJ_BizApps_Accounting: Dimension Values
            (SELECT COALESCE(MAX([Sequence]), 0) FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'E382FFAB-748C-4EB6-BEA9-1E8DCB7DBC3F') + 15,
            'ParentDimensionValueIDPath',
            'Parent Dimension Value ID Path',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '19557b04-739e-4f62-a7ca-7980f3c41133' OR (EntityID = 'E382FFAB-748C-4EB6-BEA9-1E8DCB7DBC3F' AND Name = 'ParentDimensionValueIDIsLeaf')) BEGIN
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
            '19557b04-739e-4f62-a7ca-7980f3c41133',
            'E382FFAB-748C-4EB6-BEA9-1E8DCB7DBC3F', -- Entity: MJ_BizApps_Accounting: Dimension Values
            (SELECT COALESCE(MAX([Sequence]), 0) FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'E382FFAB-748C-4EB6-BEA9-1E8DCB7DBC3F') + 16,
            'ParentDimensionValueIDIsLeaf',
            'Parent Dimension Value ID Is Leaf',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '714bd58c-f165-4a08-9666-d70308b4c4d0' OR (EntityID = 'E382FFAB-748C-4EB6-BEA9-1E8DCB7DBC3F' AND Name = 'ParentDimensionValueIDChildCount')) BEGIN
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
            '714bd58c-f165-4a08-9666-d70308b4c4d0',
            'E382FFAB-748C-4EB6-BEA9-1E8DCB7DBC3F', -- Entity: MJ_BizApps_Accounting: Dimension Values
            (SELECT COALESCE(MAX([Sequence]), 0) FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'E382FFAB-748C-4EB6-BEA9-1E8DCB7DBC3F') + 17,
            'ParentDimensionValueIDChildCount',
            'Parent Dimension Value ID Child Count',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'd3739223-f864-4be5-b399-f3c1bfe6952f' OR (EntityID = '690BE4C8-C8F2-4067-B48B-57C0671B05A5' AND Name = 'ParentGLAccountIDDepth')) BEGIN
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
            'd3739223-f864-4be5-b399-f3c1bfe6952f',
            '690BE4C8-C8F2-4067-B48B-57C0671B05A5', -- Entity: MJ_BizApps_Accounting: GL Accounts
            (SELECT COALESCE(MAX([Sequence]), 0) FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '690BE4C8-C8F2-4067-B48B-57C0671B05A5') + 19,
            'ParentGLAccountIDDepth',
            'Parent GL Account ID Depth',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '44a045c7-2996-4818-bdb2-2925dcd97e12' OR (EntityID = '690BE4C8-C8F2-4067-B48B-57C0671B05A5' AND Name = 'ParentGLAccountIDPath')) BEGIN
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
            '44a045c7-2996-4818-bdb2-2925dcd97e12',
            '690BE4C8-C8F2-4067-B48B-57C0671B05A5', -- Entity: MJ_BizApps_Accounting: GL Accounts
            (SELECT COALESCE(MAX([Sequence]), 0) FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '690BE4C8-C8F2-4067-B48B-57C0671B05A5') + 20,
            'ParentGLAccountIDPath',
            'Parent GL Account ID Path',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'e2755bce-9e88-4acf-8a5b-df0f8d7e377a' OR (EntityID = '690BE4C8-C8F2-4067-B48B-57C0671B05A5' AND Name = 'ParentGLAccountIDIsLeaf')) BEGIN
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
            'e2755bce-9e88-4acf-8a5b-df0f8d7e377a',
            '690BE4C8-C8F2-4067-B48B-57C0671B05A5', -- Entity: MJ_BizApps_Accounting: GL Accounts
            (SELECT COALESCE(MAX([Sequence]), 0) FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '690BE4C8-C8F2-4067-B48B-57C0671B05A5') + 21,
            'ParentGLAccountIDIsLeaf',
            'Parent GL Account ID Is Leaf',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'a78f7534-1b1c-43c5-979a-dd98b3190d5d' OR (EntityID = '690BE4C8-C8F2-4067-B48B-57C0671B05A5' AND Name = 'ParentGLAccountIDChildCount')) BEGIN
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
            'a78f7534-1b1c-43c5-979a-dd98b3190d5d',
            '690BE4C8-C8F2-4067-B48B-57C0671B05A5', -- Entity: MJ_BizApps_Accounting: GL Accounts
            (SELECT COALESCE(MAX([Sequence]), 0) FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '690BE4C8-C8F2-4067-B48B-57C0671B05A5') + 22,
            'ParentGLAccountIDChildCount',
            'Parent GL Account ID Child Count',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '8fee9125-81ff-44b5-ac90-bf2d9781ccd7' OR (EntityID = 'EC804DC4-778A-4627-8F54-5F7ED5DDCAD0' AND Name = 'ParentTaxJurisdictionIDDepth')) BEGIN
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
            '8fee9125-81ff-44b5-ac90-bf2d9781ccd7',
            'EC804DC4-778A-4627-8F54-5F7ED5DDCAD0', -- Entity: MJ_BizApps_Accounting: Tax Jurisdictions
            (SELECT COALESCE(MAX([Sequence]), 0) FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'EC804DC4-778A-4627-8F54-5F7ED5DDCAD0') + 20,
            'ParentTaxJurisdictionIDDepth',
            'Parent Tax Jurisdiction ID Depth',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '1a586de9-8eec-48c2-92d4-b6825db438f5' OR (EntityID = 'EC804DC4-778A-4627-8F54-5F7ED5DDCAD0' AND Name = 'ParentTaxJurisdictionIDPath')) BEGIN
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
            '1a586de9-8eec-48c2-92d4-b6825db438f5',
            'EC804DC4-778A-4627-8F54-5F7ED5DDCAD0', -- Entity: MJ_BizApps_Accounting: Tax Jurisdictions
            (SELECT COALESCE(MAX([Sequence]), 0) FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'EC804DC4-778A-4627-8F54-5F7ED5DDCAD0') + 21,
            'ParentTaxJurisdictionIDPath',
            'Parent Tax Jurisdiction ID Path',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'e7051d11-fae8-4b93-9857-6340067cb63f' OR (EntityID = 'EC804DC4-778A-4627-8F54-5F7ED5DDCAD0' AND Name = 'ParentTaxJurisdictionIDIsLeaf')) BEGIN
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
            'e7051d11-fae8-4b93-9857-6340067cb63f',
            'EC804DC4-778A-4627-8F54-5F7ED5DDCAD0', -- Entity: MJ_BizApps_Accounting: Tax Jurisdictions
            (SELECT COALESCE(MAX([Sequence]), 0) FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'EC804DC4-778A-4627-8F54-5F7ED5DDCAD0') + 22,
            'ParentTaxJurisdictionIDIsLeaf',
            'Parent Tax Jurisdiction ID Is Leaf',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '79866729-2528-43ee-8d33-8a0d41c50454' OR (EntityID = 'EC804DC4-778A-4627-8F54-5F7ED5DDCAD0' AND Name = 'ParentTaxJurisdictionIDChildCount')) BEGIN
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
            '79866729-2528-43ee-8d33-8a0d41c50454',
            'EC804DC4-778A-4627-8F54-5F7ED5DDCAD0', -- Entity: MJ_BizApps_Accounting: Tax Jurisdictions
            (SELECT COALESCE(MAX([Sequence]), 0) FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'EC804DC4-778A-4627-8F54-5F7ED5DDCAD0') + 23,
            'ParentTaxJurisdictionIDChildCount',
            'Parent Tax Jurisdiction ID Child Count',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '8acfe3f2-152b-452f-921b-d1ced62eba14' OR (EntityID = '3E551198-AB66-478E-BEB6-C34EDBE242EC' AND Name = 'ParentAccountingCompanyIDDepth')) BEGIN
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
            '8acfe3f2-152b-452f-921b-d1ced62eba14',
            '3E551198-AB66-478E-BEB6-C34EDBE242EC', -- Entity: MJ_BizApps_Accounting: Accounting Company Profiles
            (SELECT COALESCE(MAX([Sequence]), 0) FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '3E551198-AB66-478E-BEB6-C34EDBE242EC') + 30,
            'ParentAccountingCompanyIDDepth',
            'Parent Accounting Company ID Depth',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '5eb3bcf5-4248-4778-ad90-805067139c55' OR (EntityID = '3E551198-AB66-478E-BEB6-C34EDBE242EC' AND Name = 'ParentAccountingCompanyIDPath')) BEGIN
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
            '5eb3bcf5-4248-4778-ad90-805067139c55',
            '3E551198-AB66-478E-BEB6-C34EDBE242EC', -- Entity: MJ_BizApps_Accounting: Accounting Company Profiles
            (SELECT COALESCE(MAX([Sequence]), 0) FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '3E551198-AB66-478E-BEB6-C34EDBE242EC') + 31,
            'ParentAccountingCompanyIDPath',
            'Parent Accounting Company ID Path',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '58e1fa98-a59c-4ee8-9fbc-89bbbc9d40a5' OR (EntityID = '3E551198-AB66-478E-BEB6-C34EDBE242EC' AND Name = 'ParentAccountingCompanyIDIsLeaf')) BEGIN
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
            '58e1fa98-a59c-4ee8-9fbc-89bbbc9d40a5',
            '3E551198-AB66-478E-BEB6-C34EDBE242EC', -- Entity: MJ_BizApps_Accounting: Accounting Company Profiles
            (SELECT COALESCE(MAX([Sequence]), 0) FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '3E551198-AB66-478E-BEB6-C34EDBE242EC') + 32,
            'ParentAccountingCompanyIDIsLeaf',
            'Parent Accounting Company ID Is Leaf',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '96a9dbc1-a854-4706-a7f7-5b8d2df3967e' OR (EntityID = '3E551198-AB66-478E-BEB6-C34EDBE242EC' AND Name = 'ParentAccountingCompanyIDChildCount')) BEGIN
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
            '96a9dbc1-a854-4706-a7f7-5b8d2df3967e',
            '3E551198-AB66-478E-BEB6-C34EDBE242EC', -- Entity: MJ_BizApps_Accounting: Accounting Company Profiles
            (SELECT COALESCE(MAX([Sequence]), 0) FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '3E551198-AB66-478E-BEB6-C34EDBE242EC') + 33,
            'ParentAccountingCompanyIDChildCount',
            'Parent Accounting Company ID Child Count',
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

/* SQL text to update existing entity fields from schema */
EXEC [${mjSchema}].[spUpdateExistingEntityFieldsFromSchema] @ExcludedSchemaNames='sys,staging', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to set default column width where needed */
EXEC [${mjSchema}].[spSetDefaultColumnWidthWhereNeeded] @ExcludedSchemaNames='sys,staging', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to sync schema info from database schemas */
EXEC [${mjSchema}].[spUpdateSchemaInfoFromDatabase] @ExcludedSchemaNames='sys,staging', @IncludedSchemaNames='${flyway:defaultSchema}';

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
    [${mjSchema}].[vwRecordGeoCodes] AS ${mjSchema}_rgc
  ON
    ${mjSchema}_rgc.[EntityID] = '3E551198-AB66-478E-BEB6-C34EDBE242EC'
    AND ${mjSchema}_rgc.[RecordID] = CAST([a].[ID] AS NVARCHAR(450))
    AND ${mjSchema}_rgc.[LocationType] = 'Primary'
OUTER APPLY
    [${flyway:defaultSchema}].[fnAccountingCompanyProfileParentAccountingCompanyID_GetHierarchyMeta]([a].[ID], [a].[ParentAccountingCompanyID]) AS hier_ParentAccountingCompanyID
GO
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
    @IsActive bit = NULL
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
                @ActualID
        )
    -- return the new record from the base view, which might have some calculated fields
    SELECT * FROM [${flyway:defaultSchema}].[vwAccountingCompanyProfiles] WHERE [ID] = @ActualID
END
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateAccountingCompanyProfile] TO [cdp_Developer], [cdp_Integration];

/* spCreate Permissions for MJ_BizApps_Accounting: Accounting Company Profiles */

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
    @IsActive bit = NULL
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
        [IsActive] = ISNULL(@IsActive, [IsActive])
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
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteAccountingCompanyProfile] TO [cdp_Developer], [cdp_Integration];

/* spDelete Permissions for MJ_BizApps_Accounting: Accounting Company Profiles */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteAccountingCompanyProfile] TO [cdp_Developer], [cdp_Integration];

/* Hierarchy Metadata Function SQL for MJ_BizApps_Accounting: Dimension Values.ParentDimensionValueID */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Dimension Values
-- Item: fnDimensionValueParentDimensionValueID_GetHierarchyMeta
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------
------------------------------------------------------------
----- HIERARCHY METADATA FUNCTION FOR: [DimensionValue].[ParentDimensionValueID]
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[fnDimensionValueParentDimensionValueID_GetHierarchyMeta]', 'IF') IS NOT NULL
    DROP FUNCTION [${flyway:defaultSchema}].[fnDimensionValueParentDimensionValueID_GetHierarchyMeta];
GO

CREATE FUNCTION [${flyway:defaultSchema}].[fnDimensionValueParentDimensionValueID_GetHierarchyMeta]
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
            [ParentDimensionValueID],
            0 AS [Depth],
            CAST('/' + CAST([ID] AS NVARCHAR(36)) + '/' AS NVARCHAR(MAX)) AS [Path]
        FROM
            [${flyway:defaultSchema}].[DimensionValue]
        WHERE
            [ID] = @RecordID

        UNION ALL

        SELECT
            p.[ID],
            p.[ParentDimensionValueID],
            c.[Depth] + 1 AS [Depth],
            CAST('/' + CAST(p.[ID] AS NVARCHAR(36)) + c.[Path] AS NVARCHAR(MAX)) AS [Path]
        FROM
            [${flyway:defaultSchema}].[DimensionValue] p
        INNER JOIN
            CTE_Ancestors c ON p.[ID] = c.[ParentDimensionValueID]
        WHERE
            c.[Depth] < 100
    )
    SELECT TOP 1
        a.[ID] AS [RootID],
        (SELECT MAX([Depth]) FROM CTE_Ancestors) AS [Depth],
        (SELECT TOP 1 [Path] FROM CTE_Ancestors ORDER BY [Depth] DESC) AS [Path],
        CAST(CASE WHEN EXISTS (SELECT 1 FROM [${flyway:defaultSchema}].[DimensionValue] WHERE [ParentDimensionValueID] = @RecordID) THEN 0 ELSE 1 END AS BIT) AS [IsLeaf],
        (SELECT COUNT(1) FROM [${flyway:defaultSchema}].[DimensionValue] WHERE [ParentDimensionValueID] = @RecordID) AS [ChildCount]
    FROM
        CTE_Ancestors a
    WHERE
        a.[ParentDimensionValueID] IS NULL OR @ParentID IS NULL
    ORDER BY
        a.[Depth] DESC
);
GO

/* Descendants Traversal Function SQL for MJ_BizApps_Accounting: Dimension Values.ParentDimensionValueID */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Dimension Values
-- Item: fnDimensionValueParentDimensionValueID_GetDescendants
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------
------------------------------------------------------------
----- DESCENDANTS FUNCTION FOR: [DimensionValue].[ParentDimensionValueID]
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[fnDimensionValueParentDimensionValueID_GetDescendants]', 'IF') IS NOT NULL
    DROP FUNCTION [${flyway:defaultSchema}].[fnDimensionValueParentDimensionValueID_GetDescendants];
GO

CREATE FUNCTION [${flyway:defaultSchema}].[fnDimensionValueParentDimensionValueID_GetDescendants]
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
            [ParentDimensionValueID],
            0 AS [RelativeDepth],
            CAST('/' + CAST([ID] AS NVARCHAR(36)) + '/' AS NVARCHAR(MAX)) AS [Path]
        FROM
            [${flyway:defaultSchema}].[DimensionValue]
        WHERE
            [ID] = @RootID

        UNION ALL

        SELECT
            c.[ID],
            c.[ParentDimensionValueID],
            p.[RelativeDepth] + 1 AS [RelativeDepth],
            CAST(p.[Path] + CAST(c.[ID] AS NVARCHAR(36)) + '/' AS NVARCHAR(MAX)) AS [Path]
        FROM
            [${flyway:defaultSchema}].[DimensionValue] c
        INNER JOIN
            CTE_Descendants p ON c.[ParentDimensionValueID] = p.[ID]
        WHERE
            (@MaxDepth IS NULL OR p.[RelativeDepth] < @MaxDepth)
            AND p.[RelativeDepth] < 100
    )
    SELECT
        d.[ID] AS [ID],
        d.[RelativeDepth] AS [Depth],
        d.[Path],
        CAST(CASE WHEN EXISTS (SELECT 1 FROM [${flyway:defaultSchema}].[DimensionValue] WHERE [ParentDimensionValueID] = d.[ID]) THEN 0 ELSE 1 END AS BIT) AS [IsLeaf],
        (SELECT COUNT(1) FROM [${flyway:defaultSchema}].[DimensionValue] WHERE [ParentDimensionValueID] = d.[ID]) AS [ChildCount]
    FROM
        CTE_Descendants d
);
GO

/* Ancestors Traversal Function SQL for MJ_BizApps_Accounting: Dimension Values.ParentDimensionValueID */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Dimension Values
-- Item: fnDimensionValueParentDimensionValueID_GetAncestors
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------
------------------------------------------------------------
----- ANCESTORS FUNCTION FOR: [DimensionValue].[ParentDimensionValueID]
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[fnDimensionValueParentDimensionValueID_GetAncestors]', 'IF') IS NOT NULL
    DROP FUNCTION [${flyway:defaultSchema}].[fnDimensionValueParentDimensionValueID_GetAncestors];
GO

CREATE FUNCTION [${flyway:defaultSchema}].[fnDimensionValueParentDimensionValueID_GetAncestors]
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
            [ParentDimensionValueID],
            0 AS [LevelUp],
            CAST('/' + CAST([ID] AS NVARCHAR(36)) + '/' AS NVARCHAR(MAX)) AS [Path]
        FROM
            [${flyway:defaultSchema}].[DimensionValue]
        WHERE
            [ID] = @RecordID

        UNION ALL

        SELECT
            p.[ID],
            p.[ParentDimensionValueID],
            c.[LevelUp] + 1 AS [LevelUp],
            CAST('/' + CAST(p.[ID] AS NVARCHAR(36)) + c.[Path] AS NVARCHAR(MAX)) AS [Path]
        FROM
            [${flyway:defaultSchema}].[DimensionValue] p
        INNER JOIN
            CTE_Ancestors c ON p.[ID] = c.[ParentDimensionValueID]
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

/* Root ID Function SQL for MJ_BizApps_Accounting: Dimension Values.ParentDimensionValueID */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Dimension Values
-- Item: fnDimensionValueParentDimensionValueID_GetRootID
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------
------------------------------------------------------------
----- ROOT ID FUNCTION FOR: [DimensionValue].[ParentDimensionValueID]
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[fnDimensionValueParentDimensionValueID_GetRootID]', 'IF') IS NOT NULL
    DROP FUNCTION [${flyway:defaultSchema}].[fnDimensionValueParentDimensionValueID_GetRootID];
GO

CREATE FUNCTION [${flyway:defaultSchema}].[fnDimensionValueParentDimensionValueID_GetRootID]
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
            [ParentDimensionValueID],
            [ID] AS [RootParentID],
            0 AS [Depth]
        FROM
            [${flyway:defaultSchema}].[DimensionValue]
        WHERE
            [ID] = COALESCE(@ParentID, @RecordID)

        UNION ALL

        SELECT
            c.[ID],
            c.[ParentDimensionValueID],
            c.[ID] AS [RootParentID],
            p.[Depth] + 1 AS [Depth]
        FROM
            [${flyway:defaultSchema}].[DimensionValue] c
        INNER JOIN
            CTE_RootParent p ON c.[ID] = p.[ParentDimensionValueID]
        WHERE
            p.[Depth] < 100
    )
    SELECT TOP 1
        [RootParentID] AS RootID
    FROM
        CTE_RootParent
    WHERE
        [ParentDimensionValueID] IS NULL
    ORDER BY
        [RootParentID]
);
GO

/* Base View SQL for MJ_BizApps_Accounting: Dimension Values */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Dimension Values
-- Item: vwDimensionValues
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- BASE VIEW FOR ENTITY:      MJ_BizApps_Accounting: Dimension Values
-----               SCHEMA:      ${flyway:defaultSchema}
-----               BASE TABLE:  DimensionValue
-----               PRIMARY KEY: ID
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[vwDimensionValues]', 'V') IS NOT NULL
    DROP VIEW [${flyway:defaultSchema}].[vwDimensionValues];
GO

CREATE VIEW [${flyway:defaultSchema}].[vwDimensionValues]
AS
SELECT
    d.*,
    mjBizAppsAccountingDimension_DimensionID.[Name] AS [Dimension],
    mjBizAppsAccountingDimensionValue_ParentDimensionValueID.[Name] AS [ParentDimensionValue],
    hier_ParentDimensionValueID.RootID AS [RootParentDimensionValueID],
    hier_ParentDimensionValueID.Depth AS [ParentDimensionValueIDDepth],
    hier_ParentDimensionValueID.Path AS [ParentDimensionValueIDPath],
    hier_ParentDimensionValueID.IsLeaf AS [ParentDimensionValueIDIsLeaf],
    hier_ParentDimensionValueID.ChildCount AS [ParentDimensionValueIDChildCount]
FROM
    [${flyway:defaultSchema}].[DimensionValue] AS d
INNER JOIN
    [${flyway:defaultSchema}].[Dimension] AS mjBizAppsAccountingDimension_DimensionID
  ON
    [d].[DimensionID] = mjBizAppsAccountingDimension_DimensionID.[ID]
LEFT OUTER JOIN
    [${flyway:defaultSchema}].[DimensionValue] AS mjBizAppsAccountingDimensionValue_ParentDimensionValueID
  ON
    [d].[ParentDimensionValueID] = mjBizAppsAccountingDimensionValue_ParentDimensionValueID.[ID]
OUTER APPLY
    [${flyway:defaultSchema}].[fnDimensionValueParentDimensionValueID_GetHierarchyMeta]([d].[ID], [d].[ParentDimensionValueID]) AS hier_ParentDimensionValueID
GO
GRANT SELECT ON [${flyway:defaultSchema}].[vwDimensionValues] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* Base View Permissions SQL for MJ_BizApps_Accounting: Dimension Values */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Dimension Values
-- Item: Permissions for vwDimensionValues
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

GRANT SELECT ON [${flyway:defaultSchema}].[vwDimensionValues] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* spCreate SQL for MJ_BizApps_Accounting: Dimension Values */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Dimension Values
-- Item: spCreateDimensionValue
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- CREATE PROCEDURE FOR DimensionValue
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spCreateDimensionValue]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spCreateDimensionValue];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spCreateDimensionValue]
    @ID uniqueidentifier = NULL,
    @DimensionID uniqueidentifier,
    @Code nvarchar(80),
    @Name nvarchar(200),
    @ParentDimensionValueID_Clear bit = 0,
    @ParentDimensionValueID uniqueidentifier = NULL,
    @EffectiveFrom_Clear bit = 0,
    @EffectiveFrom date = NULL,
    @EffectiveTo_Clear bit = 0,
    @EffectiveTo date = NULL,
    @IsActive bit = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @InsertedRow TABLE ([ID] UNIQUEIDENTIFIER)

    IF @ID IS NOT NULL
    BEGIN
        -- User provided a value, use it
        INSERT INTO [${flyway:defaultSchema}].[DimensionValue]
            (
                [ID],
                [DimensionID],
                [Code],
                [Name],
                [ParentDimensionValueID],
                [EffectiveFrom],
                [EffectiveTo],
                [IsActive]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @ID,
                @DimensionID,
                @Code,
                @Name,
                CASE WHEN @ParentDimensionValueID_Clear = 1 THEN NULL ELSE ISNULL(@ParentDimensionValueID, NULL) END,
                CASE WHEN @EffectiveFrom_Clear = 1 THEN NULL ELSE ISNULL(@EffectiveFrom, NULL) END,
                CASE WHEN @EffectiveTo_Clear = 1 THEN NULL ELSE ISNULL(@EffectiveTo, NULL) END,
                ISNULL(@IsActive, 1)
            )
    END
    ELSE
    BEGIN
        -- No value provided, let database use its default (e.g., NEWSEQUENTIALID())
        INSERT INTO [${flyway:defaultSchema}].[DimensionValue]
            (
                [DimensionID],
                [Code],
                [Name],
                [ParentDimensionValueID],
                [EffectiveFrom],
                [EffectiveTo],
                [IsActive]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @DimensionID,
                @Code,
                @Name,
                CASE WHEN @ParentDimensionValueID_Clear = 1 THEN NULL ELSE ISNULL(@ParentDimensionValueID, NULL) END,
                CASE WHEN @EffectiveFrom_Clear = 1 THEN NULL ELSE ISNULL(@EffectiveFrom, NULL) END,
                CASE WHEN @EffectiveTo_Clear = 1 THEN NULL ELSE ISNULL(@EffectiveTo, NULL) END,
                ISNULL(@IsActive, 1)
            )
    END
    -- return the new record from the base view, which might have some calculated fields
    SELECT * FROM [${flyway:defaultSchema}].[vwDimensionValues] WHERE [ID] = (SELECT [ID] FROM @InsertedRow)
END
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateDimensionValue] TO [cdp_Developer], [cdp_Integration];

/* spCreate Permissions for MJ_BizApps_Accounting: Dimension Values */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateDimensionValue] TO [cdp_Developer], [cdp_Integration];

/* spUpdate SQL for MJ_BizApps_Accounting: Dimension Values */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Dimension Values
-- Item: spUpdateDimensionValue
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- UPDATE PROCEDURE FOR DimensionValue
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spUpdateDimensionValue]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spUpdateDimensionValue];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spUpdateDimensionValue]
    @ID uniqueidentifier,
    @DimensionID uniqueidentifier = NULL,
    @Code nvarchar(80) = NULL,
    @Name nvarchar(200) = NULL,
    @ParentDimensionValueID_Clear bit = 0,
    @ParentDimensionValueID uniqueidentifier = NULL,
    @EffectiveFrom_Clear bit = 0,
    @EffectiveFrom date = NULL,
    @EffectiveTo_Clear bit = 0,
    @EffectiveTo date = NULL,
    @IsActive bit = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[DimensionValue]
    SET
        [DimensionID] = ISNULL(@DimensionID, [DimensionID]),
        [Code] = ISNULL(@Code, [Code]),
        [Name] = ISNULL(@Name, [Name]),
        [ParentDimensionValueID] = CASE WHEN @ParentDimensionValueID_Clear = 1 THEN NULL ELSE ISNULL(@ParentDimensionValueID, [ParentDimensionValueID]) END,
        [EffectiveFrom] = CASE WHEN @EffectiveFrom_Clear = 1 THEN NULL ELSE ISNULL(@EffectiveFrom, [EffectiveFrom]) END,
        [EffectiveTo] = CASE WHEN @EffectiveTo_Clear = 1 THEN NULL ELSE ISNULL(@EffectiveTo, [EffectiveTo]) END,
        [IsActive] = ISNULL(@IsActive, [IsActive])
    WHERE
        [ID] = @ID

    -- Check if the update was successful
    IF @@ROWCOUNT = 0
        -- Nothing was updated, return no rows, but column structure from base view intact, semantically correct this way.
        SELECT TOP 0 * FROM [${flyway:defaultSchema}].[vwDimensionValues] WHERE 1=0
    ELSE
        -- Return the updated record so the caller can see the updated values and any calculated fields
        SELECT
                                        *
                                    FROM
                                        [${flyway:defaultSchema}].[vwDimensionValues]
                                    WHERE
                                        [ID] = @ID
                                    
END
GO

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateDimensionValue] TO [cdp_Developer], [cdp_Integration]
GO

------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the DimensionValue table
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[trgUpdateDimensionValue]', 'TR') IS NOT NULL
    DROP TRIGGER [${flyway:defaultSchema}].[trgUpdateDimensionValue];
GO
CREATE TRIGGER [${flyway:defaultSchema}].trgUpdateDimensionValue
ON [${flyway:defaultSchema}].[DimensionValue]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[DimensionValue]
    SET
        __mj_UpdatedAt = GETUTCDATE()
    FROM
        [${flyway:defaultSchema}].[DimensionValue] AS _organicTable
    INNER JOIN
        INSERTED AS I ON
        _organicTable.[ID] = I.[ID];
END;
GO

/* spUpdate Permissions for MJ_BizApps_Accounting: Dimension Values */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateDimensionValue] TO [cdp_Developer], [cdp_Integration];

/* spDelete SQL for MJ_BizApps_Accounting: Dimension Values */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Dimension Values
-- Item: spDeleteDimensionValue
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- DELETE PROCEDURE FOR DimensionValue
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spDeleteDimensionValue]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spDeleteDimensionValue];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spDeleteDimensionValue]
    @ID uniqueidentifier
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM
        [${flyway:defaultSchema}].[DimensionValue]
    WHERE
        [ID] = @ID


    -- Check if the delete was successful
    IF @@ROWCOUNT = 0
        SELECT NULL AS [ID] -- Return NULL for all primary key fields to indicate no record was deleted
    ELSE
        SELECT @ID AS [ID] -- Return the primary key values to indicate we successfully deleted the record
END
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteDimensionValue] TO [cdp_Developer], [cdp_Integration];

/* spDelete Permissions for MJ_BizApps_Accounting: Dimension Values */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteDimensionValue] TO [cdp_Developer], [cdp_Integration];

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
    @Description nvarchar(MAX) = NULL
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
                [Description]
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
                CASE WHEN @Description_Clear = 1 THEN NULL ELSE ISNULL(@Description, NULL) END
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
                [Description]
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
                CASE WHEN @Description_Clear = 1 THEN NULL ELSE ISNULL(@Description, NULL) END
            )
    END
    -- return the new record from the base view, which might have some calculated fields
    SELECT * FROM [${flyway:defaultSchema}].[vwGLAccounts] WHERE [ID] = (SELECT [ID] FROM @InsertedRow)
END
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateGLAccount] TO [cdp_Developer], [cdp_Integration];

/* spCreate Permissions for MJ_BizApps_Accounting: GL Accounts */

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
    @Description nvarchar(MAX) = NULL
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
        [Description] = CASE WHEN @Description_Clear = 1 THEN NULL ELSE ISNULL(@Description, [Description]) END
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
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteGLAccount] TO [cdp_Developer], [cdp_Integration];

/* spDelete Permissions for MJ_BizApps_Accounting: GL Accounts */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteGLAccount] TO [cdp_Developer], [cdp_Integration];

/* Base View SQL for MJ_BizApps_Accounting: Journal Entries */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Journal Entries
-- Item: vwJournalEntries
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
IF OBJECT_ID('[${flyway:defaultSchema}].[vwJournalEntries]', 'V') IS NOT NULL
    DROP VIEW [${flyway:defaultSchema}].[vwJournalEntries];
GO

CREATE VIEW [${flyway:defaultSchema}].[vwJournalEntries]
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
    root_ReversesJournalEntryID.RootID AS [RootReversesJournalEntryID],
    root_ReversedByJournalEntryID.RootID AS [RootReversedByJournalEntryID]
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
OUTER APPLY
    [${flyway:defaultSchema}].[fnJournalEntryReversesJournalEntryID_GetRootID]([j].[ID], [j].[ReversesJournalEntryID]) AS root_ReversesJournalEntryID
OUTER APPLY
    [${flyway:defaultSchema}].[fnJournalEntryReversedByJournalEntryID_GetRootID]([j].[ID], [j].[ReversedByJournalEntryID]) AS root_ReversedByJournalEntryID
GO
GRANT SELECT ON [${flyway:defaultSchema}].[vwJournalEntries] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* Base View Permissions SQL for MJ_BizApps_Accounting: Journal Entries */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Journal Entries
-- Item: Permissions for vwJournalEntries
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

GRANT SELECT ON [${flyway:defaultSchema}].[vwJournalEntries] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

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
    @FileID uniqueidentifier = NULL
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
                [FileID]
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
                CASE WHEN @FileID_Clear = 1 THEN NULL ELSE ISNULL(@FileID, NULL) END
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
                [FileID]
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
                CASE WHEN @FileID_Clear = 1 THEN NULL ELSE ISNULL(@FileID, NULL) END
            )
    END
    -- return the new record from the base view, which might have some calculated fields
    SELECT * FROM [${flyway:defaultSchema}].[vwJournalEntries] WHERE [ID] = (SELECT [ID] FROM @InsertedRow)
END
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateJournalEntry] TO [cdp_Developer], [cdp_Integration];

/* spCreate Permissions for MJ_BizApps_Accounting: Journal Entries */

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
    @FileID uniqueidentifier = NULL
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
        [FileID] = CASE WHEN @FileID_Clear = 1 THEN NULL ELSE ISNULL(@FileID, [FileID]) END
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
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteJournalEntry] TO [cdp_Developer], [cdp_Integration];

/* spDelete Permissions for MJ_BizApps_Accounting: Journal Entries */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteJournalEntry] TO [cdp_Developer], [cdp_Integration];

/* Hierarchy Metadata Function SQL for MJ_BizApps_Accounting: Tax Jurisdictions.ParentTaxJurisdictionID */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Tax Jurisdictions
-- Item: fnTaxJurisdictionParentTaxJurisdictionID_GetHierarchyMeta
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------
------------------------------------------------------------
----- HIERARCHY METADATA FUNCTION FOR: [TaxJurisdiction].[ParentTaxJurisdictionID]
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[fnTaxJurisdictionParentTaxJurisdictionID_GetHierarchyMeta]', 'IF') IS NOT NULL
    DROP FUNCTION [${flyway:defaultSchema}].[fnTaxJurisdictionParentTaxJurisdictionID_GetHierarchyMeta];
GO

CREATE FUNCTION [${flyway:defaultSchema}].[fnTaxJurisdictionParentTaxJurisdictionID_GetHierarchyMeta]
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
            [ParentTaxJurisdictionID],
            0 AS [Depth],
            CAST('/' + CAST([ID] AS NVARCHAR(36)) + '/' AS NVARCHAR(MAX)) AS [Path]
        FROM
            [${flyway:defaultSchema}].[TaxJurisdiction]
        WHERE
            [ID] = @RecordID

        UNION ALL

        SELECT
            p.[ID],
            p.[ParentTaxJurisdictionID],
            c.[Depth] + 1 AS [Depth],
            CAST('/' + CAST(p.[ID] AS NVARCHAR(36)) + c.[Path] AS NVARCHAR(MAX)) AS [Path]
        FROM
            [${flyway:defaultSchema}].[TaxJurisdiction] p
        INNER JOIN
            CTE_Ancestors c ON p.[ID] = c.[ParentTaxJurisdictionID]
        WHERE
            c.[Depth] < 100
    )
    SELECT TOP 1
        a.[ID] AS [RootID],
        (SELECT MAX([Depth]) FROM CTE_Ancestors) AS [Depth],
        (SELECT TOP 1 [Path] FROM CTE_Ancestors ORDER BY [Depth] DESC) AS [Path],
        CAST(CASE WHEN EXISTS (SELECT 1 FROM [${flyway:defaultSchema}].[TaxJurisdiction] WHERE [ParentTaxJurisdictionID] = @RecordID) THEN 0 ELSE 1 END AS BIT) AS [IsLeaf],
        (SELECT COUNT(1) FROM [${flyway:defaultSchema}].[TaxJurisdiction] WHERE [ParentTaxJurisdictionID] = @RecordID) AS [ChildCount]
    FROM
        CTE_Ancestors a
    WHERE
        a.[ParentTaxJurisdictionID] IS NULL OR @ParentID IS NULL
    ORDER BY
        a.[Depth] DESC
);
GO

/* Descendants Traversal Function SQL for MJ_BizApps_Accounting: Tax Jurisdictions.ParentTaxJurisdictionID */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Tax Jurisdictions
-- Item: fnTaxJurisdictionParentTaxJurisdictionID_GetDescendants
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------
------------------------------------------------------------
----- DESCENDANTS FUNCTION FOR: [TaxJurisdiction].[ParentTaxJurisdictionID]
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[fnTaxJurisdictionParentTaxJurisdictionID_GetDescendants]', 'IF') IS NOT NULL
    DROP FUNCTION [${flyway:defaultSchema}].[fnTaxJurisdictionParentTaxJurisdictionID_GetDescendants];
GO

CREATE FUNCTION [${flyway:defaultSchema}].[fnTaxJurisdictionParentTaxJurisdictionID_GetDescendants]
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
            [ParentTaxJurisdictionID],
            0 AS [RelativeDepth],
            CAST('/' + CAST([ID] AS NVARCHAR(36)) + '/' AS NVARCHAR(MAX)) AS [Path]
        FROM
            [${flyway:defaultSchema}].[TaxJurisdiction]
        WHERE
            [ID] = @RootID

        UNION ALL

        SELECT
            c.[ID],
            c.[ParentTaxJurisdictionID],
            p.[RelativeDepth] + 1 AS [RelativeDepth],
            CAST(p.[Path] + CAST(c.[ID] AS NVARCHAR(36)) + '/' AS NVARCHAR(MAX)) AS [Path]
        FROM
            [${flyway:defaultSchema}].[TaxJurisdiction] c
        INNER JOIN
            CTE_Descendants p ON c.[ParentTaxJurisdictionID] = p.[ID]
        WHERE
            (@MaxDepth IS NULL OR p.[RelativeDepth] < @MaxDepth)
            AND p.[RelativeDepth] < 100
    )
    SELECT
        d.[ID] AS [ID],
        d.[RelativeDepth] AS [Depth],
        d.[Path],
        CAST(CASE WHEN EXISTS (SELECT 1 FROM [${flyway:defaultSchema}].[TaxJurisdiction] WHERE [ParentTaxJurisdictionID] = d.[ID]) THEN 0 ELSE 1 END AS BIT) AS [IsLeaf],
        (SELECT COUNT(1) FROM [${flyway:defaultSchema}].[TaxJurisdiction] WHERE [ParentTaxJurisdictionID] = d.[ID]) AS [ChildCount]
    FROM
        CTE_Descendants d
);
GO

/* Ancestors Traversal Function SQL for MJ_BizApps_Accounting: Tax Jurisdictions.ParentTaxJurisdictionID */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Tax Jurisdictions
-- Item: fnTaxJurisdictionParentTaxJurisdictionID_GetAncestors
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------
------------------------------------------------------------
----- ANCESTORS FUNCTION FOR: [TaxJurisdiction].[ParentTaxJurisdictionID]
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[fnTaxJurisdictionParentTaxJurisdictionID_GetAncestors]', 'IF') IS NOT NULL
    DROP FUNCTION [${flyway:defaultSchema}].[fnTaxJurisdictionParentTaxJurisdictionID_GetAncestors];
GO

CREATE FUNCTION [${flyway:defaultSchema}].[fnTaxJurisdictionParentTaxJurisdictionID_GetAncestors]
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
            [ParentTaxJurisdictionID],
            0 AS [LevelUp],
            CAST('/' + CAST([ID] AS NVARCHAR(36)) + '/' AS NVARCHAR(MAX)) AS [Path]
        FROM
            [${flyway:defaultSchema}].[TaxJurisdiction]
        WHERE
            [ID] = @RecordID

        UNION ALL

        SELECT
            p.[ID],
            p.[ParentTaxJurisdictionID],
            c.[LevelUp] + 1 AS [LevelUp],
            CAST('/' + CAST(p.[ID] AS NVARCHAR(36)) + c.[Path] AS NVARCHAR(MAX)) AS [Path]
        FROM
            [${flyway:defaultSchema}].[TaxJurisdiction] p
        INNER JOIN
            CTE_Ancestors c ON p.[ID] = c.[ParentTaxJurisdictionID]
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

/* Root ID Function SQL for MJ_BizApps_Accounting: Tax Jurisdictions.ParentTaxJurisdictionID */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Tax Jurisdictions
-- Item: fnTaxJurisdictionParentTaxJurisdictionID_GetRootID
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------
------------------------------------------------------------
----- ROOT ID FUNCTION FOR: [TaxJurisdiction].[ParentTaxJurisdictionID]
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[fnTaxJurisdictionParentTaxJurisdictionID_GetRootID]', 'IF') IS NOT NULL
    DROP FUNCTION [${flyway:defaultSchema}].[fnTaxJurisdictionParentTaxJurisdictionID_GetRootID];
GO

CREATE FUNCTION [${flyway:defaultSchema}].[fnTaxJurisdictionParentTaxJurisdictionID_GetRootID]
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
            [ParentTaxJurisdictionID],
            [ID] AS [RootParentID],
            0 AS [Depth]
        FROM
            [${flyway:defaultSchema}].[TaxJurisdiction]
        WHERE
            [ID] = COALESCE(@ParentID, @RecordID)

        UNION ALL

        SELECT
            c.[ID],
            c.[ParentTaxJurisdictionID],
            c.[ID] AS [RootParentID],
            p.[Depth] + 1 AS [Depth]
        FROM
            [${flyway:defaultSchema}].[TaxJurisdiction] c
        INNER JOIN
            CTE_RootParent p ON c.[ID] = p.[ParentTaxJurisdictionID]
        WHERE
            p.[Depth] < 100
    )
    SELECT TOP 1
        [RootParentID] AS RootID
    FROM
        CTE_RootParent
    WHERE
        [ParentTaxJurisdictionID] IS NULL
    ORDER BY
        [RootParentID]
);
GO

/* Base View SQL for MJ_BizApps_Accounting: Tax Jurisdictions */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Tax Jurisdictions
-- Item: vwTaxJurisdictions
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- BASE VIEW FOR ENTITY:      MJ_BizApps_Accounting: Tax Jurisdictions
-----               SCHEMA:      ${flyway:defaultSchema}
-----               BASE TABLE:  TaxJurisdiction
-----               PRIMARY KEY: ID
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[vwTaxJurisdictions]', 'V') IS NOT NULL
    DROP VIEW [${flyway:defaultSchema}].[vwTaxJurisdictions];
GO

CREATE VIEW [${flyway:defaultSchema}].[vwTaxJurisdictions]
AS
SELECT
    t.*,
    mjBizAppsAccountingTaxAuthority_TaxAuthorityID.[Name] AS [TaxAuthority],
    mjBizAppsAccountingTaxJurisdiction_ParentTaxJurisdictionID.[Name] AS [ParentTaxJurisdiction],
    ${mjSchema}_rgc.[Latitude] AS [${mjSchema}_Latitude],
    ${mjSchema}_rgc.[Longitude] AS [${mjSchema}_Longitude],
    hier_ParentTaxJurisdictionID.RootID AS [RootParentTaxJurisdictionID],
    hier_ParentTaxJurisdictionID.Depth AS [ParentTaxJurisdictionIDDepth],
    hier_ParentTaxJurisdictionID.Path AS [ParentTaxJurisdictionIDPath],
    hier_ParentTaxJurisdictionID.IsLeaf AS [ParentTaxJurisdictionIDIsLeaf],
    hier_ParentTaxJurisdictionID.ChildCount AS [ParentTaxJurisdictionIDChildCount]
FROM
    [${flyway:defaultSchema}].[TaxJurisdiction] AS t
INNER JOIN
    [${flyway:defaultSchema}].[TaxAuthority] AS mjBizAppsAccountingTaxAuthority_TaxAuthorityID
  ON
    [t].[TaxAuthorityID] = mjBizAppsAccountingTaxAuthority_TaxAuthorityID.[ID]
LEFT OUTER JOIN
    [${flyway:defaultSchema}].[TaxJurisdiction] AS mjBizAppsAccountingTaxJurisdiction_ParentTaxJurisdictionID
  ON
    [t].[ParentTaxJurisdictionID] = mjBizAppsAccountingTaxJurisdiction_ParentTaxJurisdictionID.[ID]
LEFT OUTER JOIN
    [${mjSchema}].[vwRecordGeoCodes] AS ${mjSchema}_rgc
  ON
    ${mjSchema}_rgc.[EntityID] = 'EC804DC4-778A-4627-8F54-5F7ED5DDCAD0'
    AND ${mjSchema}_rgc.[RecordID] = CAST([t].[ID] AS NVARCHAR(450))
    AND ${mjSchema}_rgc.[LocationType] = 'Primary'
OUTER APPLY
    [${flyway:defaultSchema}].[fnTaxJurisdictionParentTaxJurisdictionID_GetHierarchyMeta]([t].[ID], [t].[ParentTaxJurisdictionID]) AS hier_ParentTaxJurisdictionID
GO
GRANT SELECT ON [${flyway:defaultSchema}].[vwTaxJurisdictions] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* Base View Permissions SQL for MJ_BizApps_Accounting: Tax Jurisdictions */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Tax Jurisdictions
-- Item: Permissions for vwTaxJurisdictions
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

GRANT SELECT ON [${flyway:defaultSchema}].[vwTaxJurisdictions] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* spCreate SQL for MJ_BizApps_Accounting: Tax Jurisdictions */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Tax Jurisdictions
-- Item: spCreateTaxJurisdiction
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- CREATE PROCEDURE FOR TaxJurisdiction
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spCreateTaxJurisdiction]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spCreateTaxJurisdiction];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spCreateTaxJurisdiction]
    @ID uniqueidentifier = NULL,
    @TaxAuthorityID uniqueidentifier,
    @Code nvarchar(80),
    @Name nvarchar(200),
    @CountryCode_Clear bit = 0,
    @CountryCode char(2) = NULL,
    @RegionCode_Clear bit = 0,
    @RegionCode nvarchar(50) = NULL,
    @PostalCode_Clear bit = 0,
    @PostalCode nvarchar(20) = NULL,
    @PostalCodeStart_Clear bit = 0,
    @PostalCodeStart nvarchar(20) = NULL,
    @PostalCodeEnd_Clear bit = 0,
    @PostalCodeEnd nvarchar(20) = NULL,
    @CityName_Clear bit = 0,
    @CityName nvarchar(200) = NULL,
    @ParentTaxJurisdictionID_Clear bit = 0,
    @ParentTaxJurisdictionID uniqueidentifier = NULL,
    @IsActive bit = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @InsertedRow TABLE ([ID] UNIQUEIDENTIFIER)

    IF @ID IS NOT NULL
    BEGIN
        -- User provided a value, use it
        INSERT INTO [${flyway:defaultSchema}].[TaxJurisdiction]
            (
                [ID],
                [TaxAuthorityID],
                [Code],
                [Name],
                [CountryCode],
                [RegionCode],
                [PostalCode],
                [PostalCodeStart],
                [PostalCodeEnd],
                [CityName],
                [ParentTaxJurisdictionID],
                [IsActive]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @ID,
                @TaxAuthorityID,
                @Code,
                @Name,
                CASE WHEN @CountryCode_Clear = 1 THEN NULL ELSE ISNULL(@CountryCode, NULL) END,
                CASE WHEN @RegionCode_Clear = 1 THEN NULL ELSE ISNULL(@RegionCode, NULL) END,
                CASE WHEN @PostalCode_Clear = 1 THEN NULL ELSE ISNULL(@PostalCode, NULL) END,
                CASE WHEN @PostalCodeStart_Clear = 1 THEN NULL ELSE ISNULL(@PostalCodeStart, NULL) END,
                CASE WHEN @PostalCodeEnd_Clear = 1 THEN NULL ELSE ISNULL(@PostalCodeEnd, NULL) END,
                CASE WHEN @CityName_Clear = 1 THEN NULL ELSE ISNULL(@CityName, NULL) END,
                CASE WHEN @ParentTaxJurisdictionID_Clear = 1 THEN NULL ELSE ISNULL(@ParentTaxJurisdictionID, NULL) END,
                ISNULL(@IsActive, 1)
            )
    END
    ELSE
    BEGIN
        -- No value provided, let database use its default (e.g., NEWSEQUENTIALID())
        INSERT INTO [${flyway:defaultSchema}].[TaxJurisdiction]
            (
                [TaxAuthorityID],
                [Code],
                [Name],
                [CountryCode],
                [RegionCode],
                [PostalCode],
                [PostalCodeStart],
                [PostalCodeEnd],
                [CityName],
                [ParentTaxJurisdictionID],
                [IsActive]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @TaxAuthorityID,
                @Code,
                @Name,
                CASE WHEN @CountryCode_Clear = 1 THEN NULL ELSE ISNULL(@CountryCode, NULL) END,
                CASE WHEN @RegionCode_Clear = 1 THEN NULL ELSE ISNULL(@RegionCode, NULL) END,
                CASE WHEN @PostalCode_Clear = 1 THEN NULL ELSE ISNULL(@PostalCode, NULL) END,
                CASE WHEN @PostalCodeStart_Clear = 1 THEN NULL ELSE ISNULL(@PostalCodeStart, NULL) END,
                CASE WHEN @PostalCodeEnd_Clear = 1 THEN NULL ELSE ISNULL(@PostalCodeEnd, NULL) END,
                CASE WHEN @CityName_Clear = 1 THEN NULL ELSE ISNULL(@CityName, NULL) END,
                CASE WHEN @ParentTaxJurisdictionID_Clear = 1 THEN NULL ELSE ISNULL(@ParentTaxJurisdictionID, NULL) END,
                ISNULL(@IsActive, 1)
            )
    END
    -- return the new record from the base view, which might have some calculated fields
    SELECT * FROM [${flyway:defaultSchema}].[vwTaxJurisdictions] WHERE [ID] = (SELECT [ID] FROM @InsertedRow)
END
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateTaxJurisdiction] TO [cdp_Developer], [cdp_Integration];

/* spCreate Permissions for MJ_BizApps_Accounting: Tax Jurisdictions */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateTaxJurisdiction] TO [cdp_Developer], [cdp_Integration];

/* spUpdate SQL for MJ_BizApps_Accounting: Tax Jurisdictions */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Tax Jurisdictions
-- Item: spUpdateTaxJurisdiction
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- UPDATE PROCEDURE FOR TaxJurisdiction
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spUpdateTaxJurisdiction]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spUpdateTaxJurisdiction];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spUpdateTaxJurisdiction]
    @ID uniqueidentifier,
    @TaxAuthorityID uniqueidentifier = NULL,
    @Code nvarchar(80) = NULL,
    @Name nvarchar(200) = NULL,
    @CountryCode_Clear bit = 0,
    @CountryCode char(2) = NULL,
    @RegionCode_Clear bit = 0,
    @RegionCode nvarchar(50) = NULL,
    @PostalCode_Clear bit = 0,
    @PostalCode nvarchar(20) = NULL,
    @PostalCodeStart_Clear bit = 0,
    @PostalCodeStart nvarchar(20) = NULL,
    @PostalCodeEnd_Clear bit = 0,
    @PostalCodeEnd nvarchar(20) = NULL,
    @CityName_Clear bit = 0,
    @CityName nvarchar(200) = NULL,
    @ParentTaxJurisdictionID_Clear bit = 0,
    @ParentTaxJurisdictionID uniqueidentifier = NULL,
    @IsActive bit = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[TaxJurisdiction]
    SET
        [TaxAuthorityID] = ISNULL(@TaxAuthorityID, [TaxAuthorityID]),
        [Code] = ISNULL(@Code, [Code]),
        [Name] = ISNULL(@Name, [Name]),
        [CountryCode] = CASE WHEN @CountryCode_Clear = 1 THEN NULL ELSE ISNULL(@CountryCode, [CountryCode]) END,
        [RegionCode] = CASE WHEN @RegionCode_Clear = 1 THEN NULL ELSE ISNULL(@RegionCode, [RegionCode]) END,
        [PostalCode] = CASE WHEN @PostalCode_Clear = 1 THEN NULL ELSE ISNULL(@PostalCode, [PostalCode]) END,
        [PostalCodeStart] = CASE WHEN @PostalCodeStart_Clear = 1 THEN NULL ELSE ISNULL(@PostalCodeStart, [PostalCodeStart]) END,
        [PostalCodeEnd] = CASE WHEN @PostalCodeEnd_Clear = 1 THEN NULL ELSE ISNULL(@PostalCodeEnd, [PostalCodeEnd]) END,
        [CityName] = CASE WHEN @CityName_Clear = 1 THEN NULL ELSE ISNULL(@CityName, [CityName]) END,
        [ParentTaxJurisdictionID] = CASE WHEN @ParentTaxJurisdictionID_Clear = 1 THEN NULL ELSE ISNULL(@ParentTaxJurisdictionID, [ParentTaxJurisdictionID]) END,
        [IsActive] = ISNULL(@IsActive, [IsActive])
    WHERE
        [ID] = @ID

    -- Check if the update was successful
    IF @@ROWCOUNT = 0
        -- Nothing was updated, return no rows, but column structure from base view intact, semantically correct this way.
        SELECT TOP 0 * FROM [${flyway:defaultSchema}].[vwTaxJurisdictions] WHERE 1=0
    ELSE
        -- Return the updated record so the caller can see the updated values and any calculated fields
        SELECT
                                        *
                                    FROM
                                        [${flyway:defaultSchema}].[vwTaxJurisdictions]
                                    WHERE
                                        [ID] = @ID
                                    
END
GO

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateTaxJurisdiction] TO [cdp_Developer], [cdp_Integration]
GO

------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the TaxJurisdiction table
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[trgUpdateTaxJurisdiction]', 'TR') IS NOT NULL
    DROP TRIGGER [${flyway:defaultSchema}].[trgUpdateTaxJurisdiction];
GO
CREATE TRIGGER [${flyway:defaultSchema}].trgUpdateTaxJurisdiction
ON [${flyway:defaultSchema}].[TaxJurisdiction]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[TaxJurisdiction]
    SET
        __mj_UpdatedAt = GETUTCDATE()
    FROM
        [${flyway:defaultSchema}].[TaxJurisdiction] AS _organicTable
    INNER JOIN
        INSERTED AS I ON
        _organicTable.[ID] = I.[ID];
END;
GO

/* spUpdate Permissions for MJ_BizApps_Accounting: Tax Jurisdictions */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateTaxJurisdiction] TO [cdp_Developer], [cdp_Integration];

/* spDelete SQL for MJ_BizApps_Accounting: Tax Jurisdictions */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Tax Jurisdictions
-- Item: spDeleteTaxJurisdiction
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- DELETE PROCEDURE FOR TaxJurisdiction
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spDeleteTaxJurisdiction]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spDeleteTaxJurisdiction];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spDeleteTaxJurisdiction]
    @ID uniqueidentifier
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM
        [${flyway:defaultSchema}].[TaxJurisdiction]
    WHERE
        [ID] = @ID


    -- Check if the delete was successful
    IF @@ROWCOUNT = 0
        SELECT NULL AS [ID] -- Return NULL for all primary key fields to indicate no record was deleted
    ELSE
        SELECT @ID AS [ID] -- Return the primary key values to indicate we successfully deleted the record
END
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteTaxJurisdiction] TO [cdp_Developer], [cdp_Integration];

/* spDelete Permissions for MJ_BizApps_Accounting: Tax Jurisdictions */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteTaxJurisdiction] TO [cdp_Developer], [cdp_Integration];

