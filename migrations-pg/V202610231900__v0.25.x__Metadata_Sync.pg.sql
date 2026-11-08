-- =============================================================================================
-- PostgreSQL counterpart of V202610231900__v0.25.x__Metadata_Sync.sql -- BizApps Accounting
-- v0.25.x Metadata_Sync
-- =============================================================================================
-- Same records, same values, same order as the T-SQL file; see its header for what ships and why.
--
-- HOW IT WAS MADE
--   * `mj sql-convert --from tsql --to postgres` (MJ CLI 6.1.6) on the push log the T-SQL file was
--     generated from. Each record is a DO block that calls the core function in whichever signature
--     the host has (jsonb or named parameters).
--   * Every assignment matches the T-SQL file (strings verbatim, BIT 1/0 as TRUE/FALSE); checked one
--     by one.
--   * The creates carry the T-SQL file's guards: the action is skipped when its ID or (Name,
--     CategoryID, no parent) exists; each param re-resolves its action by name and is skipped when
--     its ID or (ActionID, Name) exists. Core schema uses the ${mjSchema} placeholder.
--   * Every block was checked to parse and compile on postgres:16.
-- =============================================================================================

SET standard_conforming_strings = on;
-- ===================== Data (INSERT/UPDATE/DELETE) =====================

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_0da7913db1f6 VARCHAR(255);
  p_Description_0da7913db1f6 TEXT;
  p_AutoUpdateDescription_0da7913db1f6 BOOLEAN;
  p_IsPrimaryKey_0da7913db1f6 BOOLEAN;
  p_IsUnique_0da7913db1f6 BOOLEAN;
  p_Category_0da7913db1f6 VARCHAR(255);
  p_ValueListType_0da7913db1f6 VARCHAR(20);
  p_ExtendedType_0da7913db1f6 VARCHAR(50);
  p_CodeType_0da7913db1f6 VARCHAR(50);
  p_DefaultInView_0da7913db1f6 BOOLEAN;
  p_ViewCellTemplate_0da7913db1f6 TEXT;
  p_DefaultColumnWidth_0da7913db1f6 INTEGER;
  p_AllowUpdateAPI_0da7913db1f6 BOOLEAN;
  p_AllowUpdateInView_0da7913db1f6 BOOLEAN;
  p_IncludeInUserSearchAPI_0da7913db1f6 BOOLEAN;
  p_FullTextSearchEnabled_0da7913db1f6 BOOLEAN;
  p_UserSearchParamFormatAPI_0da7913db1f6 VARCHAR(500);
  p_IncludeInGeneratedForm_0da7913db1f6 BOOLEAN;
  p_GeneratedFormSection_0da7913db1f6 VARCHAR(10);
  p_IsNameField_0da7913db1f6 BOOLEAN;
  p_RelatedEntityID_0da7913db1f6 UUID;
  p_RelatedEntityFieldName_0da7913db1f6 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_0da7913db1f6 BOOLEAN;
  p_RelatedEntityNameFieldMap_0da7913db1f6 VARCHAR(255);
  p_RelatedEntityDisplayType_0da7913db1f6 VARCHAR(20);
  p_EntityIDFieldName_0da7913db1f6 VARCHAR(100);
  p_ScopeDefault_0da7913db1f6 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_0da7913db1f6 BOOLEAN;
  p_ValuesToPackWithSchema_0da7913db1f6 VARCHAR(10);
  p_Status_0da7913db1f6 VARCHAR(25);
  p_AutoUpdateIsNameField_0da7913db1f6 BOOLEAN;
  p_AutoUpdateDefaultInView_0da7913db1f6 BOOLEAN;
  p_AutoUpdateCategory_0da7913db1f6 BOOLEAN;
  p_AutoUpdateDisplayName_0da7913db1f6 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_0da7913db1f6 BOOLEAN;
  p_Encrypt_0da7913db1f6 BOOLEAN;
  p_EncryptionKeyID_0da7913db1f6 UUID;
  p_AllowDecryptInAPI_0da7913db1f6 BOOLEAN;
  p_SendEncryptedValue_0da7913db1f6 BOOLEAN;
  p_IsSoftPrimaryKey_0da7913db1f6 BOOLEAN;
  p_IsSoftForeignKey_0da7913db1f6 BOOLEAN;
  p_RelatedEntityJoinFields_0da7913db1f6 TEXT;
  p_JSONType_0da7913db1f6 VARCHAR(255);
  p_JSONTypeIsArray_0da7913db1f6 BOOLEAN;
  p_JSONTypeDefinition_0da7913db1f6 TEXT;
  p_UserSearchPredicateAPI_0da7913db1f6 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_0da7913db1f6 BOOLEAN;
  p_AutoUpdateFullTextSearch_0da7913db1f6 BOOLEAN;
  p_AutoUpdateExtendedType_0da7913db1f6 BOOLEAN;
  p_IsComputed_0da7913db1f6 BOOLEAN;
  p_EmbeddedRecord_0da7913db1f6 TEXT;
  p_Configuration_0da7913db1f6 TEXT;
  p_ID_0da7913db1f6 UUID;
BEGIN
  p_DisplayName_0da7913db1f6 := 'Source Record ID';
  p_Description_0da7913db1f6 := 'Primary key of the source record, in the entity named by SourceEntityID.';
  p_AutoUpdateDescription_0da7913db1f6 := TRUE;
  p_IsPrimaryKey_0da7913db1f6 := FALSE;
  p_IsUnique_0da7913db1f6 := FALSE;
  p_Category_0da7913db1f6 := 'Source';
  p_ValueListType_0da7913db1f6 := 'None';
  p_DefaultInView_0da7913db1f6 := TRUE;
  p_DefaultColumnWidth_0da7913db1f6 := 150;
  p_AllowUpdateAPI_0da7913db1f6 := TRUE;
  p_AllowUpdateInView_0da7913db1f6 := TRUE;
  p_IncludeInUserSearchAPI_0da7913db1f6 := FALSE;
  p_FullTextSearchEnabled_0da7913db1f6 := FALSE;
  p_IncludeInGeneratedForm_0da7913db1f6 := TRUE;
  p_GeneratedFormSection_0da7913db1f6 := 'Category';
  p_IsNameField_0da7913db1f6 := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_0da7913db1f6 := FALSE;
  p_RelatedEntityDisplayType_0da7913db1f6 := 'Search';
  p_EntityIDFieldName_0da7913db1f6 := 'SourceEntityID';
  p_AutoUpdateRelatedEntityInfo_0da7913db1f6 := TRUE;
  p_ValuesToPackWithSchema_0da7913db1f6 := 'Auto';
  p_Status_0da7913db1f6 := 'Active';
  p_AutoUpdateIsNameField_0da7913db1f6 := TRUE;
  p_AutoUpdateDefaultInView_0da7913db1f6 := TRUE;
  p_AutoUpdateCategory_0da7913db1f6 := TRUE;
  p_AutoUpdateDisplayName_0da7913db1f6 := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_0da7913db1f6 := TRUE;
  p_Encrypt_0da7913db1f6 := FALSE;
  p_AllowDecryptInAPI_0da7913db1f6 := FALSE;
  p_SendEncryptedValue_0da7913db1f6 := FALSE;
  p_IsSoftPrimaryKey_0da7913db1f6 := FALSE;
  p_IsSoftForeignKey_0da7913db1f6 := FALSE;
  p_JSONTypeIsArray_0da7913db1f6 := FALSE;
  p_UserSearchPredicateAPI_0da7913db1f6 := 'Contains';
  p_AutoUpdateUserSearchPredicate_0da7913db1f6 := TRUE;
  p_AutoUpdateFullTextSearch_0da7913db1f6 := TRUE;
  p_AutoUpdateExtendedType_0da7913db1f6 := TRUE;
  p_IsComputed_0da7913db1f6 := FALSE;
  p_ID_0da7913db1f6 := '3A14A9E7-7D47-472C-89BE-0529FF5E1C72';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM ${mjSchema}."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_0da7913db1f6,
    'Description', p_Description_0da7913db1f6,
    'AutoUpdateDescription', p_AutoUpdateDescription_0da7913db1f6,
    'IsPrimaryKey', p_IsPrimaryKey_0da7913db1f6,
    'IsUnique', p_IsUnique_0da7913db1f6,
    'Category', p_Category_0da7913db1f6,
    'ValueListType', p_ValueListType_0da7913db1f6,
    'ExtendedType', p_ExtendedType_0da7913db1f6,
    'CodeType', p_CodeType_0da7913db1f6,
    'DefaultInView', p_DefaultInView_0da7913db1f6,
    'ViewCellTemplate', p_ViewCellTemplate_0da7913db1f6,
    'DefaultColumnWidth', p_DefaultColumnWidth_0da7913db1f6,
    'AllowUpdateAPI', p_AllowUpdateAPI_0da7913db1f6,
    'AllowUpdateInView', p_AllowUpdateInView_0da7913db1f6,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_0da7913db1f6,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_0da7913db1f6,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_0da7913db1f6,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_0da7913db1f6,
    'GeneratedFormSection', p_GeneratedFormSection_0da7913db1f6,
    'IsNameField', p_IsNameField_0da7913db1f6,
    'RelatedEntityID', p_RelatedEntityID_0da7913db1f6,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_0da7913db1f6,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_0da7913db1f6,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_0da7913db1f6,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_0da7913db1f6,
    'EntityIDFieldName', p_EntityIDFieldName_0da7913db1f6,
    'ScopeDefault', p_ScopeDefault_0da7913db1f6,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_0da7913db1f6,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_0da7913db1f6,
    'Status', p_Status_0da7913db1f6,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_0da7913db1f6,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_0da7913db1f6,
    'AutoUpdateCategory', p_AutoUpdateCategory_0da7913db1f6,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_0da7913db1f6,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_0da7913db1f6,
    'Encrypt', p_Encrypt_0da7913db1f6,
    'EncryptionKeyID', p_EncryptionKeyID_0da7913db1f6,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_0da7913db1f6,
    'SendEncryptedValue', p_SendEncryptedValue_0da7913db1f6,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_0da7913db1f6,
    'IsSoftForeignKey', p_IsSoftForeignKey_0da7913db1f6,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_0da7913db1f6,
    'JSONType', p_JSONType_0da7913db1f6,
    'JSONTypeIsArray', p_JSONTypeIsArray_0da7913db1f6,
    'JSONTypeDefinition', p_JSONTypeDefinition_0da7913db1f6,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_0da7913db1f6,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_0da7913db1f6,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_0da7913db1f6,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_0da7913db1f6,
    'IsComputed', p_IsComputed_0da7913db1f6
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_0da7913db1f6,
    'Configuration', p_Configuration_0da7913db1f6,
    'ID', p_ID_0da7913db1f6
  ));
  ELSE
    PERFORM ${mjSchema}."spUpdateEntityField"(p_DisplayName := p_DisplayName_0da7913db1f6, p_Description := p_Description_0da7913db1f6, p_AutoUpdateDescription := p_AutoUpdateDescription_0da7913db1f6, p_IsPrimaryKey := p_IsPrimaryKey_0da7913db1f6, p_IsUnique := p_IsUnique_0da7913db1f6, p_Category := p_Category_0da7913db1f6, p_ValueListType := p_ValueListType_0da7913db1f6, p_ExtendedType := p_ExtendedType_0da7913db1f6, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_0da7913db1f6, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_0da7913db1f6, p_ViewCellTemplate := p_ViewCellTemplate_0da7913db1f6, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_0da7913db1f6, p_AllowUpdateAPI := p_AllowUpdateAPI_0da7913db1f6, p_AllowUpdateInView := p_AllowUpdateInView_0da7913db1f6, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_0da7913db1f6, p_FullTextSearchEnabled := p_FullTextSearchEnabled_0da7913db1f6, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_0da7913db1f6, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_0da7913db1f6, p_GeneratedFormSection := p_GeneratedFormSection_0da7913db1f6, p_IsNameField := p_IsNameField_0da7913db1f6, p_RelatedEntityID := p_RelatedEntityID_0da7913db1f6, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_0da7913db1f6, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_0da7913db1f6, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_0da7913db1f6, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_0da7913db1f6, p_EntityIDFieldName := p_EntityIDFieldName_0da7913db1f6, p_ScopeDefault := p_ScopeDefault_0da7913db1f6, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_0da7913db1f6, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_0da7913db1f6, p_Status := p_Status_0da7913db1f6, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_0da7913db1f6, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_0da7913db1f6, p_AutoUpdateCategory := p_AutoUpdateCategory_0da7913db1f6, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_0da7913db1f6, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_0da7913db1f6, p_Encrypt := p_Encrypt_0da7913db1f6, p_EncryptionKeyID := p_EncryptionKeyID_0da7913db1f6, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_0da7913db1f6, p_SendEncryptedValue := p_SendEncryptedValue_0da7913db1f6, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_0da7913db1f6, p_IsSoftForeignKey := p_IsSoftForeignKey_0da7913db1f6, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_0da7913db1f6, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_0da7913db1f6, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_0da7913db1f6, p_JSONTypeDefinition := p_JSONTypeDefinition_0da7913db1f6, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_0da7913db1f6, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_0da7913db1f6, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_0da7913db1f6, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_0da7913db1f6, p_IsComputed := p_IsComputed_0da7913db1f6, p_EmbeddedRecord := p_EmbeddedRecord_0da7913db1f6, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_0da7913db1f6, p_Configuration_Clear := TRUE, p_ID := p_ID_0da7913db1f6);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_c0382e065878 VARCHAR(255);
  p_Description_c0382e065878 TEXT;
  p_AutoUpdateDescription_c0382e065878 BOOLEAN;
  p_IsPrimaryKey_c0382e065878 BOOLEAN;
  p_IsUnique_c0382e065878 BOOLEAN;
  p_Category_c0382e065878 VARCHAR(255);
  p_ValueListType_c0382e065878 VARCHAR(20);
  p_ExtendedType_c0382e065878 VARCHAR(50);
  p_CodeType_c0382e065878 VARCHAR(50);
  p_DefaultInView_c0382e065878 BOOLEAN;
  p_ViewCellTemplate_c0382e065878 TEXT;
  p_DefaultColumnWidth_c0382e065878 INTEGER;
  p_AllowUpdateAPI_c0382e065878 BOOLEAN;
  p_AllowUpdateInView_c0382e065878 BOOLEAN;
  p_IncludeInUserSearchAPI_c0382e065878 BOOLEAN;
  p_FullTextSearchEnabled_c0382e065878 BOOLEAN;
  p_UserSearchParamFormatAPI_c0382e065878 VARCHAR(500);
  p_IncludeInGeneratedForm_c0382e065878 BOOLEAN;
  p_GeneratedFormSection_c0382e065878 VARCHAR(10);
  p_IsNameField_c0382e065878 BOOLEAN;
  p_RelatedEntityID_c0382e065878 UUID;
  p_RelatedEntityFieldName_c0382e065878 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_c0382e065878 BOOLEAN;
  p_RelatedEntityNameFieldMap_c0382e065878 VARCHAR(255);
  p_RelatedEntityDisplayType_c0382e065878 VARCHAR(20);
  p_EntityIDFieldName_c0382e065878 VARCHAR(100);
  p_ScopeDefault_c0382e065878 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_c0382e065878 BOOLEAN;
  p_ValuesToPackWithSchema_c0382e065878 VARCHAR(10);
  p_Status_c0382e065878 VARCHAR(25);
  p_AutoUpdateIsNameField_c0382e065878 BOOLEAN;
  p_AutoUpdateDefaultInView_c0382e065878 BOOLEAN;
  p_AutoUpdateCategory_c0382e065878 BOOLEAN;
  p_AutoUpdateDisplayName_c0382e065878 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_c0382e065878 BOOLEAN;
  p_Encrypt_c0382e065878 BOOLEAN;
  p_EncryptionKeyID_c0382e065878 UUID;
  p_AllowDecryptInAPI_c0382e065878 BOOLEAN;
  p_SendEncryptedValue_c0382e065878 BOOLEAN;
  p_IsSoftPrimaryKey_c0382e065878 BOOLEAN;
  p_IsSoftForeignKey_c0382e065878 BOOLEAN;
  p_RelatedEntityJoinFields_c0382e065878 TEXT;
  p_JSONType_c0382e065878 VARCHAR(255);
  p_JSONTypeIsArray_c0382e065878 BOOLEAN;
  p_JSONTypeDefinition_c0382e065878 TEXT;
  p_UserSearchPredicateAPI_c0382e065878 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_c0382e065878 BOOLEAN;
  p_AutoUpdateFullTextSearch_c0382e065878 BOOLEAN;
  p_AutoUpdateExtendedType_c0382e065878 BOOLEAN;
  p_IsComputed_c0382e065878 BOOLEAN;
  p_EmbeddedRecord_c0382e065878 TEXT;
  p_Configuration_c0382e065878 TEXT;
  p_ID_c0382e065878 UUID;
BEGIN
  p_DisplayName_c0382e065878 := 'Target Record ID';
  p_Description_c0382e065878 := 'Polymorphic reference part 2: the target record''s primary key (NVARCHAR(400) supports stringified composite keys).';
  p_AutoUpdateDescription_c0382e065878 := TRUE;
  p_IsPrimaryKey_c0382e065878 := FALSE;
  p_IsUnique_c0382e065878 := FALSE;
  p_Category_c0382e065878 := 'Target Definition';
  p_ValueListType_c0382e065878 := 'None';
  p_DefaultInView_c0382e065878 := FALSE;
  p_DefaultColumnWidth_c0382e065878 := 150;
  p_AllowUpdateAPI_c0382e065878 := TRUE;
  p_AllowUpdateInView_c0382e065878 := TRUE;
  p_IncludeInUserSearchAPI_c0382e065878 := FALSE;
  p_FullTextSearchEnabled_c0382e065878 := FALSE;
  p_IncludeInGeneratedForm_c0382e065878 := TRUE;
  p_GeneratedFormSection_c0382e065878 := 'Category';
  p_IsNameField_c0382e065878 := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_c0382e065878 := FALSE;
  p_RelatedEntityDisplayType_c0382e065878 := 'Search';
  p_EntityIDFieldName_c0382e065878 := 'EntityID';
  p_AutoUpdateRelatedEntityInfo_c0382e065878 := TRUE;
  p_ValuesToPackWithSchema_c0382e065878 := 'Auto';
  p_Status_c0382e065878 := 'Active';
  p_AutoUpdateIsNameField_c0382e065878 := TRUE;
  p_AutoUpdateDefaultInView_c0382e065878 := TRUE;
  p_AutoUpdateCategory_c0382e065878 := TRUE;
  p_AutoUpdateDisplayName_c0382e065878 := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_c0382e065878 := TRUE;
  p_Encrypt_c0382e065878 := FALSE;
  p_AllowDecryptInAPI_c0382e065878 := FALSE;
  p_SendEncryptedValue_c0382e065878 := FALSE;
  p_IsSoftPrimaryKey_c0382e065878 := FALSE;
  p_IsSoftForeignKey_c0382e065878 := FALSE;
  p_JSONTypeIsArray_c0382e065878 := FALSE;
  p_UserSearchPredicateAPI_c0382e065878 := 'Contains';
  p_AutoUpdateUserSearchPredicate_c0382e065878 := TRUE;
  p_AutoUpdateFullTextSearch_c0382e065878 := TRUE;
  p_AutoUpdateExtendedType_c0382e065878 := TRUE;
  p_IsComputed_c0382e065878 := FALSE;
  p_ID_c0382e065878 := 'BD052F15-1322-4786-8507-92FF9B0F557C';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM ${mjSchema}."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_c0382e065878,
    'Description', p_Description_c0382e065878,
    'AutoUpdateDescription', p_AutoUpdateDescription_c0382e065878,
    'IsPrimaryKey', p_IsPrimaryKey_c0382e065878,
    'IsUnique', p_IsUnique_c0382e065878,
    'Category', p_Category_c0382e065878,
    'ValueListType', p_ValueListType_c0382e065878,
    'ExtendedType', p_ExtendedType_c0382e065878,
    'CodeType', p_CodeType_c0382e065878,
    'DefaultInView', p_DefaultInView_c0382e065878,
    'ViewCellTemplate', p_ViewCellTemplate_c0382e065878,
    'DefaultColumnWidth', p_DefaultColumnWidth_c0382e065878,
    'AllowUpdateAPI', p_AllowUpdateAPI_c0382e065878,
    'AllowUpdateInView', p_AllowUpdateInView_c0382e065878,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_c0382e065878,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_c0382e065878,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_c0382e065878,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_c0382e065878,
    'GeneratedFormSection', p_GeneratedFormSection_c0382e065878,
    'IsNameField', p_IsNameField_c0382e065878,
    'RelatedEntityID', p_RelatedEntityID_c0382e065878,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_c0382e065878,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_c0382e065878,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_c0382e065878,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_c0382e065878,
    'EntityIDFieldName', p_EntityIDFieldName_c0382e065878,
    'ScopeDefault', p_ScopeDefault_c0382e065878,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_c0382e065878,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_c0382e065878,
    'Status', p_Status_c0382e065878,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_c0382e065878,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_c0382e065878,
    'AutoUpdateCategory', p_AutoUpdateCategory_c0382e065878,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_c0382e065878,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_c0382e065878,
    'Encrypt', p_Encrypt_c0382e065878,
    'EncryptionKeyID', p_EncryptionKeyID_c0382e065878,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_c0382e065878,
    'SendEncryptedValue', p_SendEncryptedValue_c0382e065878,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_c0382e065878,
    'IsSoftForeignKey', p_IsSoftForeignKey_c0382e065878,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_c0382e065878,
    'JSONType', p_JSONType_c0382e065878,
    'JSONTypeIsArray', p_JSONTypeIsArray_c0382e065878,
    'JSONTypeDefinition', p_JSONTypeDefinition_c0382e065878,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_c0382e065878,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_c0382e065878,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_c0382e065878,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_c0382e065878,
    'IsComputed', p_IsComputed_c0382e065878
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_c0382e065878,
    'Configuration', p_Configuration_c0382e065878,
    'ID', p_ID_c0382e065878
  ));
  ELSE
    PERFORM ${mjSchema}."spUpdateEntityField"(p_DisplayName := p_DisplayName_c0382e065878, p_Description := p_Description_c0382e065878, p_AutoUpdateDescription := p_AutoUpdateDescription_c0382e065878, p_IsPrimaryKey := p_IsPrimaryKey_c0382e065878, p_IsUnique := p_IsUnique_c0382e065878, p_Category := p_Category_c0382e065878, p_ValueListType := p_ValueListType_c0382e065878, p_ExtendedType := p_ExtendedType_c0382e065878, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_c0382e065878, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_c0382e065878, p_ViewCellTemplate := p_ViewCellTemplate_c0382e065878, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_c0382e065878, p_AllowUpdateAPI := p_AllowUpdateAPI_c0382e065878, p_AllowUpdateInView := p_AllowUpdateInView_c0382e065878, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_c0382e065878, p_FullTextSearchEnabled := p_FullTextSearchEnabled_c0382e065878, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_c0382e065878, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_c0382e065878, p_GeneratedFormSection := p_GeneratedFormSection_c0382e065878, p_IsNameField := p_IsNameField_c0382e065878, p_RelatedEntityID := p_RelatedEntityID_c0382e065878, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_c0382e065878, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_c0382e065878, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_c0382e065878, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_c0382e065878, p_EntityIDFieldName := p_EntityIDFieldName_c0382e065878, p_ScopeDefault := p_ScopeDefault_c0382e065878, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_c0382e065878, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_c0382e065878, p_Status := p_Status_c0382e065878, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_c0382e065878, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_c0382e065878, p_AutoUpdateCategory := p_AutoUpdateCategory_c0382e065878, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_c0382e065878, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_c0382e065878, p_Encrypt := p_Encrypt_c0382e065878, p_EncryptionKeyID := p_EncryptionKeyID_c0382e065878, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_c0382e065878, p_SendEncryptedValue := p_SendEncryptedValue_c0382e065878, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_c0382e065878, p_IsSoftForeignKey := p_IsSoftForeignKey_c0382e065878, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_c0382e065878, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_c0382e065878, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_c0382e065878, p_JSONTypeDefinition := p_JSONTypeDefinition_c0382e065878, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_c0382e065878, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_c0382e065878, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_c0382e065878, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_c0382e065878, p_IsComputed := p_IsComputed_c0382e065878, p_EmbeddedRecord := p_EmbeddedRecord_c0382e065878, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_c0382e065878, p_Configuration_Clear := TRUE, p_ID := p_ID_c0382e065878);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_222a5dc64463 VARCHAR(255);
  p_Description_222a5dc64463 TEXT;
  p_AutoUpdateDescription_222a5dc64463 BOOLEAN;
  p_IsPrimaryKey_222a5dc64463 BOOLEAN;
  p_IsUnique_222a5dc64463 BOOLEAN;
  p_Category_222a5dc64463 VARCHAR(255);
  p_ValueListType_222a5dc64463 VARCHAR(20);
  p_ExtendedType_222a5dc64463 VARCHAR(50);
  p_CodeType_222a5dc64463 VARCHAR(50);
  p_DefaultInView_222a5dc64463 BOOLEAN;
  p_ViewCellTemplate_222a5dc64463 TEXT;
  p_DefaultColumnWidth_222a5dc64463 INTEGER;
  p_AllowUpdateAPI_222a5dc64463 BOOLEAN;
  p_AllowUpdateInView_222a5dc64463 BOOLEAN;
  p_IncludeInUserSearchAPI_222a5dc64463 BOOLEAN;
  p_FullTextSearchEnabled_222a5dc64463 BOOLEAN;
  p_UserSearchParamFormatAPI_222a5dc64463 VARCHAR(500);
  p_IncludeInGeneratedForm_222a5dc64463 BOOLEAN;
  p_GeneratedFormSection_222a5dc64463 VARCHAR(10);
  p_IsNameField_222a5dc64463 BOOLEAN;
  p_RelatedEntityID_222a5dc64463 UUID;
  p_RelatedEntityFieldName_222a5dc64463 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_222a5dc64463 BOOLEAN;
  p_RelatedEntityNameFieldMap_222a5dc64463 VARCHAR(255);
  p_RelatedEntityDisplayType_222a5dc64463 VARCHAR(20);
  p_EntityIDFieldName_222a5dc64463 VARCHAR(100);
  p_ScopeDefault_222a5dc64463 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_222a5dc64463 BOOLEAN;
  p_ValuesToPackWithSchema_222a5dc64463 VARCHAR(10);
  p_Status_222a5dc64463 VARCHAR(25);
  p_AutoUpdateIsNameField_222a5dc64463 BOOLEAN;
  p_AutoUpdateDefaultInView_222a5dc64463 BOOLEAN;
  p_AutoUpdateCategory_222a5dc64463 BOOLEAN;
  p_AutoUpdateDisplayName_222a5dc64463 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_222a5dc64463 BOOLEAN;
  p_Encrypt_222a5dc64463 BOOLEAN;
  p_EncryptionKeyID_222a5dc64463 UUID;
  p_AllowDecryptInAPI_222a5dc64463 BOOLEAN;
  p_SendEncryptedValue_222a5dc64463 BOOLEAN;
  p_IsSoftPrimaryKey_222a5dc64463 BOOLEAN;
  p_IsSoftForeignKey_222a5dc64463 BOOLEAN;
  p_RelatedEntityJoinFields_222a5dc64463 TEXT;
  p_JSONType_222a5dc64463 VARCHAR(255);
  p_JSONTypeIsArray_222a5dc64463 BOOLEAN;
  p_JSONTypeDefinition_222a5dc64463 TEXT;
  p_UserSearchPredicateAPI_222a5dc64463 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_222a5dc64463 BOOLEAN;
  p_AutoUpdateFullTextSearch_222a5dc64463 BOOLEAN;
  p_AutoUpdateExtendedType_222a5dc64463 BOOLEAN;
  p_IsComputed_222a5dc64463 BOOLEAN;
  p_EmbeddedRecord_222a5dc64463 TEXT;
  p_Configuration_222a5dc64463 TEXT;
  p_ID_222a5dc64463 UUID;
BEGIN
  p_DisplayName_222a5dc64463 := 'Linked Record ID';
  p_Description_222a5dc64463 := 'Polymorphic origin part 2: the source record''s primary key (NVARCHAR(400) supports stringified composite keys). Soft by nature — the record lives in a downstream app''s schema. Set and NULL together with LinkedEntityID (CK_JournalEntry_LinkedPair).';
  p_AutoUpdateDescription_222a5dc64463 := TRUE;
  p_IsPrimaryKey_222a5dc64463 := FALSE;
  p_IsUnique_222a5dc64463 := FALSE;
  p_Category_222a5dc64463 := 'Source Integration';
  p_ValueListType_222a5dc64463 := 'None';
  p_DefaultInView_222a5dc64463 := FALSE;
  p_DefaultColumnWidth_222a5dc64463 := 150;
  p_AllowUpdateAPI_222a5dc64463 := TRUE;
  p_AllowUpdateInView_222a5dc64463 := TRUE;
  p_IncludeInUserSearchAPI_222a5dc64463 := FALSE;
  p_FullTextSearchEnabled_222a5dc64463 := FALSE;
  p_IncludeInGeneratedForm_222a5dc64463 := TRUE;
  p_GeneratedFormSection_222a5dc64463 := 'Category';
  p_IsNameField_222a5dc64463 := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_222a5dc64463 := FALSE;
  p_RelatedEntityDisplayType_222a5dc64463 := 'Search';
  p_EntityIDFieldName_222a5dc64463 := 'LinkedEntityID';
  p_AutoUpdateRelatedEntityInfo_222a5dc64463 := TRUE;
  p_ValuesToPackWithSchema_222a5dc64463 := 'Auto';
  p_Status_222a5dc64463 := 'Active';
  p_AutoUpdateIsNameField_222a5dc64463 := TRUE;
  p_AutoUpdateDefaultInView_222a5dc64463 := TRUE;
  p_AutoUpdateCategory_222a5dc64463 := TRUE;
  p_AutoUpdateDisplayName_222a5dc64463 := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_222a5dc64463 := TRUE;
  p_Encrypt_222a5dc64463 := FALSE;
  p_AllowDecryptInAPI_222a5dc64463 := FALSE;
  p_SendEncryptedValue_222a5dc64463 := FALSE;
  p_IsSoftPrimaryKey_222a5dc64463 := FALSE;
  p_IsSoftForeignKey_222a5dc64463 := FALSE;
  p_JSONTypeIsArray_222a5dc64463 := FALSE;
  p_UserSearchPredicateAPI_222a5dc64463 := 'Contains';
  p_AutoUpdateUserSearchPredicate_222a5dc64463 := TRUE;
  p_AutoUpdateFullTextSearch_222a5dc64463 := TRUE;
  p_AutoUpdateExtendedType_222a5dc64463 := TRUE;
  p_IsComputed_222a5dc64463 := FALSE;
  p_ID_222a5dc64463 := '471106A2-D515-4906-A9D6-AF527B477158';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM ${mjSchema}."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_222a5dc64463,
    'Description', p_Description_222a5dc64463,
    'AutoUpdateDescription', p_AutoUpdateDescription_222a5dc64463,
    'IsPrimaryKey', p_IsPrimaryKey_222a5dc64463,
    'IsUnique', p_IsUnique_222a5dc64463,
    'Category', p_Category_222a5dc64463,
    'ValueListType', p_ValueListType_222a5dc64463,
    'ExtendedType', p_ExtendedType_222a5dc64463,
    'CodeType', p_CodeType_222a5dc64463,
    'DefaultInView', p_DefaultInView_222a5dc64463,
    'ViewCellTemplate', p_ViewCellTemplate_222a5dc64463,
    'DefaultColumnWidth', p_DefaultColumnWidth_222a5dc64463,
    'AllowUpdateAPI', p_AllowUpdateAPI_222a5dc64463,
    'AllowUpdateInView', p_AllowUpdateInView_222a5dc64463,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_222a5dc64463,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_222a5dc64463,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_222a5dc64463,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_222a5dc64463,
    'GeneratedFormSection', p_GeneratedFormSection_222a5dc64463,
    'IsNameField', p_IsNameField_222a5dc64463,
    'RelatedEntityID', p_RelatedEntityID_222a5dc64463,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_222a5dc64463,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_222a5dc64463,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_222a5dc64463,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_222a5dc64463,
    'EntityIDFieldName', p_EntityIDFieldName_222a5dc64463,
    'ScopeDefault', p_ScopeDefault_222a5dc64463,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_222a5dc64463,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_222a5dc64463,
    'Status', p_Status_222a5dc64463,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_222a5dc64463,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_222a5dc64463,
    'AutoUpdateCategory', p_AutoUpdateCategory_222a5dc64463,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_222a5dc64463,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_222a5dc64463,
    'Encrypt', p_Encrypt_222a5dc64463,
    'EncryptionKeyID', p_EncryptionKeyID_222a5dc64463,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_222a5dc64463,
    'SendEncryptedValue', p_SendEncryptedValue_222a5dc64463,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_222a5dc64463,
    'IsSoftForeignKey', p_IsSoftForeignKey_222a5dc64463,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_222a5dc64463,
    'JSONType', p_JSONType_222a5dc64463,
    'JSONTypeIsArray', p_JSONTypeIsArray_222a5dc64463,
    'JSONTypeDefinition', p_JSONTypeDefinition_222a5dc64463,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_222a5dc64463,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_222a5dc64463,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_222a5dc64463,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_222a5dc64463,
    'IsComputed', p_IsComputed_222a5dc64463
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_222a5dc64463,
    'Configuration', p_Configuration_222a5dc64463,
    'ID', p_ID_222a5dc64463
  ));
  ELSE
    PERFORM ${mjSchema}."spUpdateEntityField"(p_DisplayName := p_DisplayName_222a5dc64463, p_Description := p_Description_222a5dc64463, p_AutoUpdateDescription := p_AutoUpdateDescription_222a5dc64463, p_IsPrimaryKey := p_IsPrimaryKey_222a5dc64463, p_IsUnique := p_IsUnique_222a5dc64463, p_Category := p_Category_222a5dc64463, p_ValueListType := p_ValueListType_222a5dc64463, p_ExtendedType := p_ExtendedType_222a5dc64463, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_222a5dc64463, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_222a5dc64463, p_ViewCellTemplate := p_ViewCellTemplate_222a5dc64463, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_222a5dc64463, p_AllowUpdateAPI := p_AllowUpdateAPI_222a5dc64463, p_AllowUpdateInView := p_AllowUpdateInView_222a5dc64463, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_222a5dc64463, p_FullTextSearchEnabled := p_FullTextSearchEnabled_222a5dc64463, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_222a5dc64463, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_222a5dc64463, p_GeneratedFormSection := p_GeneratedFormSection_222a5dc64463, p_IsNameField := p_IsNameField_222a5dc64463, p_RelatedEntityID := p_RelatedEntityID_222a5dc64463, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_222a5dc64463, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_222a5dc64463, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_222a5dc64463, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_222a5dc64463, p_EntityIDFieldName := p_EntityIDFieldName_222a5dc64463, p_ScopeDefault := p_ScopeDefault_222a5dc64463, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_222a5dc64463, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_222a5dc64463, p_Status := p_Status_222a5dc64463, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_222a5dc64463, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_222a5dc64463, p_AutoUpdateCategory := p_AutoUpdateCategory_222a5dc64463, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_222a5dc64463, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_222a5dc64463, p_Encrypt := p_Encrypt_222a5dc64463, p_EncryptionKeyID := p_EncryptionKeyID_222a5dc64463, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_222a5dc64463, p_SendEncryptedValue := p_SendEncryptedValue_222a5dc64463, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_222a5dc64463, p_IsSoftForeignKey := p_IsSoftForeignKey_222a5dc64463, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_222a5dc64463, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_222a5dc64463, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_222a5dc64463, p_JSONTypeDefinition := p_JSONTypeDefinition_222a5dc64463, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_222a5dc64463, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_222a5dc64463, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_222a5dc64463, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_222a5dc64463, p_IsComputed := p_IsComputed_222a5dc64463, p_EmbeddedRecord := p_EmbeddedRecord_222a5dc64463, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_222a5dc64463, p_Configuration_Clear := TRUE, p_ID := p_ID_222a5dc64463);
  END IF;
END $mj$;

-- Save MJ: Actions (core SP call only)
DO $mj$
DECLARE
  p_ID_622e52faad15 UUID;
  p_CategoryID_622e52faad15 UUID;
  p_Name_622e52faad15 VARCHAR(425);
  p_Description_622e52faad15 TEXT;
  p_Type_622e52faad15 VARCHAR(20);
  p_UserPrompt_622e52faad15 TEXT;
  p_UserComments_622e52faad15 TEXT;
  p_Code_622e52faad15 TEXT;
  p_CodeComments_622e52faad15 TEXT;
  p_CodeApprovalStatus_622e52faad15 VARCHAR(20);
  p_CodeApprovalComments_622e52faad15 TEXT;
  p_CodeApprovedByUserID_622e52faad15 UUID;
  p_CodeApprovedAt_622e52faad15 TIMESTAMPTZ;
  p_CodeLocked_622e52faad15 BOOLEAN;
  p_ForceCodeGeneration_622e52faad15 BOOLEAN;
  p_RetentionPeriod_622e52faad15 INTEGER;
  p_Status_622e52faad15 VARCHAR(20);
  p_DriverClass_622e52faad15 VARCHAR(255);
  p_ParentID_622e52faad15 UUID;
  p_IconClass_622e52faad15 VARCHAR(100);
  p_DefaultCompactPromptID_622e52faad15 UUID;
  p_Config_622e52faad15 TEXT;
  p_RuntimeActionConfiguration_622e52faad15 TEXT;
  p_MaxExecutionTimeMS_622e52faad15 INTEGER;
  p_CreatedByAgentID_622e52faad15 UUID;
BEGIN
  p_ID_622e52faad15 := 'FA82A39C-0DA9-4CBB-8A4A-6CDFFB78415D';
  p_CategoryID_622e52faad15 := '074DF299-8D1F-438B-B855-8DFF17AE565E';
  p_Name_622e52faad15 := 'Dispatch Approved Journal Entry Batches';
  p_Description_622e52faad15 := 'Sends every Approved journal entry batch to its ERP, oldest approval first, the way the Dispatch button does: each send passes the CFO approval gate, the approved-content check and the ERP lookup. Approves nothing and never retries a Failed batch. Runs only as the MJ system user, for the scheduled dispatch job.';
  p_Type_622e52faad15 := 'Custom';
  p_UserPrompt_622e52faad15 := 'Dispatch the approved journal entry batches to the ERP.';
  p_CodeApprovalStatus_622e52faad15 := 'Approved';
  p_CodeLocked_622e52faad15 := FALSE;
  p_ForceCodeGeneration_622e52faad15 := FALSE;
  p_Status_622e52faad15 := 'Active';
  p_DriverClass_622e52faad15 := 'Accounting.DispatchApprovedJournalEntryBatches';
  p_IconClass_622e52faad15 := 'fa-solid fa-paper-plane';
  IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."Action"
               WHERE "ID" = p_ID_622e52faad15
                  OR ("Name" = p_Name_622e52faad15 AND "CategoryID" = p_CategoryID_622e52faad15 AND "ParentID" IS NULL)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateAction'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM ${mjSchema}."spCreateAction"(p_data := jsonb_build_object(
      'ID', p_ID_622e52faad15,
      'CategoryID', p_CategoryID_622e52faad15,
      'Name', p_Name_622e52faad15,
      'Description', p_Description_622e52faad15,
      'Type', p_Type_622e52faad15,
      'UserPrompt', p_UserPrompt_622e52faad15,
      'UserComments', p_UserComments_622e52faad15,
      'Code', p_Code_622e52faad15,
      'CodeComments', p_CodeComments_622e52faad15,
      'CodeApprovalStatus', p_CodeApprovalStatus_622e52faad15,
      'CodeApprovalComments', p_CodeApprovalComments_622e52faad15,
      'CodeApprovedByUserID', p_CodeApprovedByUserID_622e52faad15,
      'CodeApprovedAt', p_CodeApprovedAt_622e52faad15,
      'CodeLocked', p_CodeLocked_622e52faad15,
      'ForceCodeGeneration', p_ForceCodeGeneration_622e52faad15,
      'RetentionPeriod', p_RetentionPeriod_622e52faad15,
      'Status', p_Status_622e52faad15,
      'DriverClass', p_DriverClass_622e52faad15,
      'ParentID', p_ParentID_622e52faad15,
      'IconClass', p_IconClass_622e52faad15,
      'DefaultCompactPromptID', p_DefaultCompactPromptID_622e52faad15,
      'Config', p_Config_622e52faad15,
      'RuntimeActionConfiguration', p_RuntimeActionConfiguration_622e52faad15,
      'MaxExecutionTimeMS', p_MaxExecutionTimeMS_622e52faad15,
      'CreatedByAgentID', p_CreatedByAgentID_622e52faad15
    ));
    ELSE
      PERFORM ${mjSchema}."spCreateAction"(p_ID := p_ID_622e52faad15, p_CategoryID := p_CategoryID_622e52faad15, p_Name := p_Name_622e52faad15, p_Description := p_Description_622e52faad15, p_Type := p_Type_622e52faad15, p_UserPrompt := p_UserPrompt_622e52faad15, p_UserComments := p_UserComments_622e52faad15, p_UserComments_Clear := TRUE, p_Code := p_Code_622e52faad15, p_Code_Clear := TRUE, p_CodeComments := p_CodeComments_622e52faad15, p_CodeComments_Clear := TRUE, p_CodeApprovalStatus := p_CodeApprovalStatus_622e52faad15, p_CodeApprovalComments := p_CodeApprovalComments_622e52faad15, p_CodeApprovalComments_Clear := TRUE, p_CodeApprovedByUserID := p_CodeApprovedByUserID_622e52faad15, p_CodeApprovedByUserID_Clear := TRUE, p_CodeApprovedAt := p_CodeApprovedAt_622e52faad15, p_CodeApprovedAt_Clear := TRUE, p_CodeLocked := p_CodeLocked_622e52faad15, p_ForceCodeGeneration := p_ForceCodeGeneration_622e52faad15, p_RetentionPeriod := p_RetentionPeriod_622e52faad15, p_RetentionPeriod_Clear := TRUE, p_Status := p_Status_622e52faad15, p_DriverClass := p_DriverClass_622e52faad15, p_ParentID := p_ParentID_622e52faad15, p_ParentID_Clear := TRUE, p_IconClass := p_IconClass_622e52faad15, p_DefaultCompactPromptID := p_DefaultCompactPromptID_622e52faad15, p_DefaultCompactPromptID_Clear := TRUE, p_Config := p_Config_622e52faad15, p_Config_Clear := TRUE, p_RuntimeActionConfiguration := p_RuntimeActionConfiguration_622e52faad15, p_RuntimeActionConfiguration_Clear := TRUE, p_MaxExecutionTimeMS := p_MaxExecutionTimeMS_622e52faad15, p_MaxExecutionTimeMS_Clear := TRUE, p_CreatedByAgentID := p_CreatedByAgentID_622e52faad15, p_CreatedByAgentID_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Action Params (core SP call only)
DO $mj$
DECLARE
  p_ID_d6077c7723a6 UUID;
  p_ActionID_d6077c7723a6 UUID;
  p_Name_d6077c7723a6 VARCHAR(255);
  p_DefaultValue_d6077c7723a6 TEXT;
  p_Type_d6077c7723a6 CHAR(10);
  p_ValueType_d6077c7723a6 VARCHAR(30);
  p_IsArray_d6077c7723a6 BOOLEAN;
  p_Description_d6077c7723a6 TEXT;
  p_IsRequired_d6077c7723a6 BOOLEAN;
  p_MediaModality_d6077c7723a6 VARCHAR(20);
  p_LogValue_d6077c7723a6 BOOLEAN;
BEGIN
  p_ID_d6077c7723a6 := '628CECD9-A81E-4E0B-9851-5A8AB0311C21';
  p_ActionID_d6077c7723a6 := 'FA82A39C-0DA9-4CBB-8A4A-6CDFFB78415D';
  p_Name_d6077c7723a6 := 'TargetSystem';
  p_Type_d6077c7723a6 := 'Input';
  p_ValueType_d6077c7723a6 := 'Scalar';
  p_IsArray_d6077c7723a6 := FALSE;
  p_Description_d6077c7723a6 := 'Only batches for this ERP (e.g. ''BusinessCentral'', ''QuickBooks''). Omit for every ERP.';
  p_IsRequired_d6077c7723a6 := FALSE;
  p_LogValue_d6077c7723a6 := TRUE;
  p_ActionID_d6077c7723a6 := COALESCE((SELECT "ID" FROM ${mjSchema}."Action" WHERE "Name" = 'Dispatch Approved Journal Entry Batches' ORDER BY CASE WHEN "ID" = p_ActionID_d6077c7723a6 THEN 0 ELSE 1 END LIMIT 1), p_ActionID_d6077c7723a6);
  IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."ActionParam"
               WHERE "ID" = p_ID_d6077c7723a6
                  OR ("ActionID" = p_ActionID_d6077c7723a6 AND "Name" = p_Name_d6077c7723a6)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateActionParam'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM ${mjSchema}."spCreateActionParam"(p_data := jsonb_build_object(
      'ID', p_ID_d6077c7723a6,
      'ActionID', p_ActionID_d6077c7723a6,
      'Name', p_Name_d6077c7723a6,
      'DefaultValue', p_DefaultValue_d6077c7723a6,
      'Type', p_Type_d6077c7723a6,
      'ValueType', p_ValueType_d6077c7723a6,
      'IsArray', p_IsArray_d6077c7723a6,
      'Description', p_Description_d6077c7723a6,
      'IsRequired', p_IsRequired_d6077c7723a6,
      'MediaModality', p_MediaModality_d6077c7723a6,
      'LogValue', p_LogValue_d6077c7723a6
    ));
    ELSE
      PERFORM ${mjSchema}."spCreateActionParam"(p_ID := p_ID_d6077c7723a6, p_ActionID := p_ActionID_d6077c7723a6, p_Name := p_Name_d6077c7723a6, p_DefaultValue := p_DefaultValue_d6077c7723a6, p_DefaultValue_Clear := TRUE, p_Type := p_Type_d6077c7723a6, p_ValueType := p_ValueType_d6077c7723a6, p_IsArray := p_IsArray_d6077c7723a6, p_Description := p_Description_d6077c7723a6, p_IsRequired := p_IsRequired_d6077c7723a6, p_MediaModality := p_MediaModality_d6077c7723a6, p_MediaModality_Clear := TRUE, p_LogValue := p_LogValue_d6077c7723a6);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Action Params (core SP call only)
DO $mj$
DECLARE
  p_ID_5d9ce240ca0c UUID;
  p_ActionID_5d9ce240ca0c UUID;
  p_Name_5d9ce240ca0c VARCHAR(255);
  p_DefaultValue_5d9ce240ca0c TEXT;
  p_Type_5d9ce240ca0c CHAR(10);
  p_ValueType_5d9ce240ca0c VARCHAR(30);
  p_IsArray_5d9ce240ca0c BOOLEAN;
  p_Description_5d9ce240ca0c TEXT;
  p_IsRequired_5d9ce240ca0c BOOLEAN;
  p_MediaModality_5d9ce240ca0c VARCHAR(20);
  p_LogValue_5d9ce240ca0c BOOLEAN;
BEGIN
  p_ID_5d9ce240ca0c := 'A43A245F-C645-4583-9573-1A651B02A6B3';
  p_ActionID_5d9ce240ca0c := 'FA82A39C-0DA9-4CBB-8A4A-6CDFFB78415D';
  p_Name_5d9ce240ca0c := 'CompanyIDs';
  p_Type_5d9ce240ca0c := 'Input';
  p_ValueType_5d9ce240ca0c := 'Scalar';
  p_IsArray_5d9ce240ca0c := TRUE;
  p_Description_5d9ce240ca0c := 'Only batches for these companies. Omit for every company.';
  p_IsRequired_5d9ce240ca0c := FALSE;
  p_LogValue_5d9ce240ca0c := TRUE;
  p_ActionID_5d9ce240ca0c := COALESCE((SELECT "ID" FROM ${mjSchema}."Action" WHERE "Name" = 'Dispatch Approved Journal Entry Batches' ORDER BY CASE WHEN "ID" = p_ActionID_5d9ce240ca0c THEN 0 ELSE 1 END LIMIT 1), p_ActionID_5d9ce240ca0c);
  IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."ActionParam"
               WHERE "ID" = p_ID_5d9ce240ca0c
                  OR ("ActionID" = p_ActionID_5d9ce240ca0c AND "Name" = p_Name_5d9ce240ca0c)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateActionParam'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM ${mjSchema}."spCreateActionParam"(p_data := jsonb_build_object(
      'ID', p_ID_5d9ce240ca0c,
      'ActionID', p_ActionID_5d9ce240ca0c,
      'Name', p_Name_5d9ce240ca0c,
      'DefaultValue', p_DefaultValue_5d9ce240ca0c,
      'Type', p_Type_5d9ce240ca0c,
      'ValueType', p_ValueType_5d9ce240ca0c,
      'IsArray', p_IsArray_5d9ce240ca0c,
      'Description', p_Description_5d9ce240ca0c,
      'IsRequired', p_IsRequired_5d9ce240ca0c,
      'MediaModality', p_MediaModality_5d9ce240ca0c,
      'LogValue', p_LogValue_5d9ce240ca0c
    ));
    ELSE
      PERFORM ${mjSchema}."spCreateActionParam"(p_ID := p_ID_5d9ce240ca0c, p_ActionID := p_ActionID_5d9ce240ca0c, p_Name := p_Name_5d9ce240ca0c, p_DefaultValue := p_DefaultValue_5d9ce240ca0c, p_DefaultValue_Clear := TRUE, p_Type := p_Type_5d9ce240ca0c, p_ValueType := p_ValueType_5d9ce240ca0c, p_IsArray := p_IsArray_5d9ce240ca0c, p_Description := p_Description_5d9ce240ca0c, p_IsRequired := p_IsRequired_5d9ce240ca0c, p_MediaModality := p_MediaModality_5d9ce240ca0c, p_MediaModality_Clear := TRUE, p_LogValue := p_LogValue_5d9ce240ca0c);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Action Params (core SP call only)
DO $mj$
DECLARE
  p_ID_12a2df6b3d5b UUID;
  p_ActionID_12a2df6b3d5b UUID;
  p_Name_12a2df6b3d5b VARCHAR(255);
  p_DefaultValue_12a2df6b3d5b TEXT;
  p_Type_12a2df6b3d5b CHAR(10);
  p_ValueType_12a2df6b3d5b VARCHAR(30);
  p_IsArray_12a2df6b3d5b BOOLEAN;
  p_Description_12a2df6b3d5b TEXT;
  p_IsRequired_12a2df6b3d5b BOOLEAN;
  p_MediaModality_12a2df6b3d5b VARCHAR(20);
  p_LogValue_12a2df6b3d5b BOOLEAN;
BEGIN
  p_ID_12a2df6b3d5b := 'C8ED5C4F-4BF4-4230-9F85-87C36FF908D0';
  p_ActionID_12a2df6b3d5b := 'FA82A39C-0DA9-4CBB-8A4A-6CDFFB78415D';
  p_Name_12a2df6b3d5b := 'PostedCount';
  p_Type_12a2df6b3d5b := 'Output';
  p_ValueType_12a2df6b3d5b := 'Scalar';
  p_IsArray_12a2df6b3d5b := FALSE;
  p_Description_12a2df6b3d5b := 'The number of batches that reached Posted in this run.';
  p_IsRequired_12a2df6b3d5b := FALSE;
  p_LogValue_12a2df6b3d5b := TRUE;
  p_ActionID_12a2df6b3d5b := COALESCE((SELECT "ID" FROM ${mjSchema}."Action" WHERE "Name" = 'Dispatch Approved Journal Entry Batches' ORDER BY CASE WHEN "ID" = p_ActionID_12a2df6b3d5b THEN 0 ELSE 1 END LIMIT 1), p_ActionID_12a2df6b3d5b);
  IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."ActionParam"
               WHERE "ID" = p_ID_12a2df6b3d5b
                  OR ("ActionID" = p_ActionID_12a2df6b3d5b AND "Name" = p_Name_12a2df6b3d5b)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateActionParam'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM ${mjSchema}."spCreateActionParam"(p_data := jsonb_build_object(
      'ID', p_ID_12a2df6b3d5b,
      'ActionID', p_ActionID_12a2df6b3d5b,
      'Name', p_Name_12a2df6b3d5b,
      'DefaultValue', p_DefaultValue_12a2df6b3d5b,
      'Type', p_Type_12a2df6b3d5b,
      'ValueType', p_ValueType_12a2df6b3d5b,
      'IsArray', p_IsArray_12a2df6b3d5b,
      'Description', p_Description_12a2df6b3d5b,
      'IsRequired', p_IsRequired_12a2df6b3d5b,
      'MediaModality', p_MediaModality_12a2df6b3d5b,
      'LogValue', p_LogValue_12a2df6b3d5b
    ));
    ELSE
      PERFORM ${mjSchema}."spCreateActionParam"(p_ID := p_ID_12a2df6b3d5b, p_ActionID := p_ActionID_12a2df6b3d5b, p_Name := p_Name_12a2df6b3d5b, p_DefaultValue := p_DefaultValue_12a2df6b3d5b, p_DefaultValue_Clear := TRUE, p_Type := p_Type_12a2df6b3d5b, p_ValueType := p_ValueType_12a2df6b3d5b, p_IsArray := p_IsArray_12a2df6b3d5b, p_Description := p_Description_12a2df6b3d5b, p_IsRequired := p_IsRequired_12a2df6b3d5b, p_MediaModality := p_MediaModality_12a2df6b3d5b, p_MediaModality_Clear := TRUE, p_LogValue := p_LogValue_12a2df6b3d5b);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Action Params (core SP call only)
DO $mj$
DECLARE
  p_ID_bdbb8f393081 UUID;
  p_ActionID_bdbb8f393081 UUID;
  p_Name_bdbb8f393081 VARCHAR(255);
  p_DefaultValue_bdbb8f393081 TEXT;
  p_Type_bdbb8f393081 CHAR(10);
  p_ValueType_bdbb8f393081 VARCHAR(30);
  p_IsArray_bdbb8f393081 BOOLEAN;
  p_Description_bdbb8f393081 TEXT;
  p_IsRequired_bdbb8f393081 BOOLEAN;
  p_MediaModality_bdbb8f393081 VARCHAR(20);
  p_LogValue_bdbb8f393081 BOOLEAN;
BEGIN
  p_ID_bdbb8f393081 := '996F2184-92AB-4A55-935A-0D583B4613AF';
  p_ActionID_bdbb8f393081 := 'FA82A39C-0DA9-4CBB-8A4A-6CDFFB78415D';
  p_Name_bdbb8f393081 := 'Batches';
  p_Type_bdbb8f393081 := 'Output';
  p_ValueType_bdbb8f393081 := 'Scalar';
  p_IsArray_bdbb8f393081 := FALSE;
  p_Description_bdbb8f393081 := 'JSON array of each batch sent: its ID, number, company, the status it ended at, and the error when it did not post.';
  p_IsRequired_bdbb8f393081 := FALSE;
  p_LogValue_bdbb8f393081 := TRUE;
  p_ActionID_bdbb8f393081 := COALESCE((SELECT "ID" FROM ${mjSchema}."Action" WHERE "Name" = 'Dispatch Approved Journal Entry Batches' ORDER BY CASE WHEN "ID" = p_ActionID_bdbb8f393081 THEN 0 ELSE 1 END LIMIT 1), p_ActionID_bdbb8f393081);
  IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."ActionParam"
               WHERE "ID" = p_ID_bdbb8f393081
                  OR ("ActionID" = p_ActionID_bdbb8f393081 AND "Name" = p_Name_bdbb8f393081)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateActionParam'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM ${mjSchema}."spCreateActionParam"(p_data := jsonb_build_object(
      'ID', p_ID_bdbb8f393081,
      'ActionID', p_ActionID_bdbb8f393081,
      'Name', p_Name_bdbb8f393081,
      'DefaultValue', p_DefaultValue_bdbb8f393081,
      'Type', p_Type_bdbb8f393081,
      'ValueType', p_ValueType_bdbb8f393081,
      'IsArray', p_IsArray_bdbb8f393081,
      'Description', p_Description_bdbb8f393081,
      'IsRequired', p_IsRequired_bdbb8f393081,
      'MediaModality', p_MediaModality_bdbb8f393081,
      'LogValue', p_LogValue_bdbb8f393081
    ));
    ELSE
      PERFORM ${mjSchema}."spCreateActionParam"(p_ID := p_ID_bdbb8f393081, p_ActionID := p_ActionID_bdbb8f393081, p_Name := p_Name_bdbb8f393081, p_DefaultValue := p_DefaultValue_bdbb8f393081, p_DefaultValue_Clear := TRUE, p_Type := p_Type_bdbb8f393081, p_ValueType := p_ValueType_bdbb8f393081, p_IsArray := p_IsArray_bdbb8f393081, p_Description := p_Description_bdbb8f393081, p_IsRequired := p_IsRequired_bdbb8f393081, p_MediaModality := p_MediaModality_bdbb8f393081, p_MediaModality_Clear := TRUE, p_LogValue := p_LogValue_bdbb8f393081);
    END IF;
  END IF;
END $mj$;
