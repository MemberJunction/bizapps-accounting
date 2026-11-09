-- =============================================================================================
-- PostgreSQL counterpart of V202610201335__v0.24.x__Metadata_Sync.sql -- BizApps Accounting
-- v0.24.x Metadata_Sync
-- =============================================================================================
-- Same records, same values, same order as the T-SQL file; see its header for what ships and why.
--
-- HOW IT WAS MADE
--   * `mj sql-convert --from tsql --to postgres` (MJ CLI 6.1.6) on the push log the T-SQL file was
--     generated from. Each record is a DO block that calls the core or accounting function in
--     whichever signature the host has (jsonb or named parameters).
--   * The converter rewrites string literals and can drop BIT and numeric values (MJ#5918), so
--     every assignment is copied verbatim from the T-SQL file (BIT 1/0 as TRUE/FALSE).
--   * The creates carry the T-SQL file's guards: skip when the ID or the table's unique key already
--     exists, with parents re-resolved by name. Core schema uses the ${mjSchema} placeholder; the
--     accounting schema is quoted "__mj_BizAppsAccounting" (see migrations-pg/README.md).
-- =============================================================================================

SET standard_conforming_strings = on;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_3d679af7a390 VARCHAR(255);
  p_Description_3d679af7a390 TEXT;
  p_AutoUpdateDescription_3d679af7a390 BOOLEAN;
  p_IsPrimaryKey_3d679af7a390 BOOLEAN;
  p_IsUnique_3d679af7a390 BOOLEAN;
  p_Category_3d679af7a390 VARCHAR(255);
  p_ValueListType_3d679af7a390 VARCHAR(20);
  p_ExtendedType_3d679af7a390 VARCHAR(50);
  p_CodeType_3d679af7a390 VARCHAR(50);
  p_DefaultInView_3d679af7a390 BOOLEAN;
  p_ViewCellTemplate_3d679af7a390 TEXT;
  p_DefaultColumnWidth_3d679af7a390 INTEGER;
  p_AllowUpdateAPI_3d679af7a390 BOOLEAN;
  p_AllowUpdateInView_3d679af7a390 BOOLEAN;
  p_IncludeInUserSearchAPI_3d679af7a390 BOOLEAN;
  p_FullTextSearchEnabled_3d679af7a390 BOOLEAN;
  p_UserSearchParamFormatAPI_3d679af7a390 VARCHAR(500);
  p_IncludeInGeneratedForm_3d679af7a390 BOOLEAN;
  p_GeneratedFormSection_3d679af7a390 VARCHAR(10);
  p_IsNameField_3d679af7a390 BOOLEAN;
  p_RelatedEntityID_3d679af7a390 UUID;
  p_RelatedEntityFieldName_3d679af7a390 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_3d679af7a390 BOOLEAN;
  p_RelatedEntityNameFieldMap_3d679af7a390 VARCHAR(255);
  p_RelatedEntityDisplayType_3d679af7a390 VARCHAR(20);
  p_EntityIDFieldName_3d679af7a390 VARCHAR(100);
  p_ScopeDefault_3d679af7a390 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_3d679af7a390 BOOLEAN;
  p_ValuesToPackWithSchema_3d679af7a390 VARCHAR(10);
  p_Status_3d679af7a390 VARCHAR(25);
  p_AutoUpdateIsNameField_3d679af7a390 BOOLEAN;
  p_AutoUpdateDefaultInView_3d679af7a390 BOOLEAN;
  p_AutoUpdateCategory_3d679af7a390 BOOLEAN;
  p_AutoUpdateDisplayName_3d679af7a390 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_3d679af7a390 BOOLEAN;
  p_Encrypt_3d679af7a390 BOOLEAN;
  p_EncryptionKeyID_3d679af7a390 UUID;
  p_AllowDecryptInAPI_3d679af7a390 BOOLEAN;
  p_SendEncryptedValue_3d679af7a390 BOOLEAN;
  p_IsSoftPrimaryKey_3d679af7a390 BOOLEAN;
  p_IsSoftForeignKey_3d679af7a390 BOOLEAN;
  p_RelatedEntityJoinFields_3d679af7a390 TEXT;
  p_JSONType_3d679af7a390 VARCHAR(255);
  p_JSONTypeIsArray_3d679af7a390 BOOLEAN;
  p_JSONTypeDefinition_3d679af7a390 TEXT;
  p_UserSearchPredicateAPI_3d679af7a390 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_3d679af7a390 BOOLEAN;
  p_AutoUpdateFullTextSearch_3d679af7a390 BOOLEAN;
  p_AutoUpdateExtendedType_3d679af7a390 BOOLEAN;
  p_IsComputed_3d679af7a390 BOOLEAN;
  p_EmbeddedRecord_3d679af7a390 TEXT;
  p_Configuration_3d679af7a390 TEXT;
  p_ID_3d679af7a390 UUID;
BEGIN
  p_DisplayName_3d679af7a390 := 'Posting Start Date';
  p_Description_3d679af7a390 := 'The first EffectiveDate this company posts to the ERP. Journal entries dated before it never enter a posting batch (for example, history brought in at cutover that the ERP already holds). NULL means no floor: every Pending entry is a candidate.';
  p_AutoUpdateDescription_3d679af7a390 := TRUE;
  p_IsPrimaryKey_3d679af7a390 := FALSE;
  p_IsUnique_3d679af7a390 := FALSE;
  p_Category_3d679af7a390 := 'Financial Settings';
  p_ValueListType_3d679af7a390 := 'None';
  p_DefaultInView_3d679af7a390 := FALSE;
  p_DefaultColumnWidth_3d679af7a390 := 150;
  p_AllowUpdateAPI_3d679af7a390 := TRUE;
  p_AllowUpdateInView_3d679af7a390 := TRUE;
  p_IncludeInUserSearchAPI_3d679af7a390 := FALSE;
  p_FullTextSearchEnabled_3d679af7a390 := FALSE;
  p_IncludeInGeneratedForm_3d679af7a390 := TRUE;
  p_GeneratedFormSection_3d679af7a390 := 'Category';
  p_IsNameField_3d679af7a390 := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_3d679af7a390 := FALSE;
  p_RelatedEntityDisplayType_3d679af7a390 := 'Search';
  p_AutoUpdateRelatedEntityInfo_3d679af7a390 := TRUE;
  p_ValuesToPackWithSchema_3d679af7a390 := 'Auto';
  p_Status_3d679af7a390 := 'Active';
  p_AutoUpdateIsNameField_3d679af7a390 := TRUE;
  p_AutoUpdateDefaultInView_3d679af7a390 := TRUE;
  p_AutoUpdateCategory_3d679af7a390 := TRUE;
  p_AutoUpdateDisplayName_3d679af7a390 := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_3d679af7a390 := TRUE;
  p_Encrypt_3d679af7a390 := FALSE;
  p_AllowDecryptInAPI_3d679af7a390 := FALSE;
  p_SendEncryptedValue_3d679af7a390 := FALSE;
  p_IsSoftPrimaryKey_3d679af7a390 := FALSE;
  p_IsSoftForeignKey_3d679af7a390 := FALSE;
  p_JSONTypeIsArray_3d679af7a390 := FALSE;
  p_UserSearchPredicateAPI_3d679af7a390 := 'Contains';
  p_AutoUpdateUserSearchPredicate_3d679af7a390 := TRUE;
  p_AutoUpdateFullTextSearch_3d679af7a390 := TRUE;
  p_AutoUpdateExtendedType_3d679af7a390 := TRUE;
  p_IsComputed_3d679af7a390 := FALSE;
  p_ID_3d679af7a390 := '4CD570A0-9BE5-4036-863B-FDA304697691';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM ${mjSchema}."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_3d679af7a390,
    'Description', p_Description_3d679af7a390,
    'AutoUpdateDescription', p_AutoUpdateDescription_3d679af7a390,
    'IsPrimaryKey', p_IsPrimaryKey_3d679af7a390,
    'IsUnique', p_IsUnique_3d679af7a390,
    'Category', p_Category_3d679af7a390,
    'ValueListType', p_ValueListType_3d679af7a390,
    'ExtendedType', p_ExtendedType_3d679af7a390,
    'CodeType', p_CodeType_3d679af7a390,
    'DefaultInView', p_DefaultInView_3d679af7a390,
    'ViewCellTemplate', p_ViewCellTemplate_3d679af7a390,
    'DefaultColumnWidth', p_DefaultColumnWidth_3d679af7a390,
    'AllowUpdateAPI', p_AllowUpdateAPI_3d679af7a390,
    'AllowUpdateInView', p_AllowUpdateInView_3d679af7a390,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_3d679af7a390,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_3d679af7a390,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_3d679af7a390,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_3d679af7a390,
    'GeneratedFormSection', p_GeneratedFormSection_3d679af7a390,
    'IsNameField', p_IsNameField_3d679af7a390,
    'RelatedEntityID', p_RelatedEntityID_3d679af7a390,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_3d679af7a390,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_3d679af7a390,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_3d679af7a390,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_3d679af7a390,
    'EntityIDFieldName', p_EntityIDFieldName_3d679af7a390,
    'ScopeDefault', p_ScopeDefault_3d679af7a390,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_3d679af7a390,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_3d679af7a390,
    'Status', p_Status_3d679af7a390,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_3d679af7a390,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_3d679af7a390,
    'AutoUpdateCategory', p_AutoUpdateCategory_3d679af7a390,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_3d679af7a390,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_3d679af7a390,
    'Encrypt', p_Encrypt_3d679af7a390,
    'EncryptionKeyID', p_EncryptionKeyID_3d679af7a390,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_3d679af7a390,
    'SendEncryptedValue', p_SendEncryptedValue_3d679af7a390,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_3d679af7a390,
    'IsSoftForeignKey', p_IsSoftForeignKey_3d679af7a390,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_3d679af7a390,
    'JSONType', p_JSONType_3d679af7a390,
    'JSONTypeIsArray', p_JSONTypeIsArray_3d679af7a390,
    'JSONTypeDefinition', p_JSONTypeDefinition_3d679af7a390,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_3d679af7a390,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_3d679af7a390,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_3d679af7a390,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_3d679af7a390,
    'IsComputed', p_IsComputed_3d679af7a390
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_3d679af7a390,
    'Configuration', p_Configuration_3d679af7a390,
    'ID', p_ID_3d679af7a390
  ));
  ELSE
    PERFORM ${mjSchema}."spUpdateEntityField"(p_DisplayName := p_DisplayName_3d679af7a390, p_Description := p_Description_3d679af7a390, p_AutoUpdateDescription := p_AutoUpdateDescription_3d679af7a390, p_IsPrimaryKey := p_IsPrimaryKey_3d679af7a390, p_IsUnique := p_IsUnique_3d679af7a390, p_Category := p_Category_3d679af7a390, p_ValueListType := p_ValueListType_3d679af7a390, p_ExtendedType := p_ExtendedType_3d679af7a390, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_3d679af7a390, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_3d679af7a390, p_ViewCellTemplate := p_ViewCellTemplate_3d679af7a390, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_3d679af7a390, p_AllowUpdateAPI := p_AllowUpdateAPI_3d679af7a390, p_AllowUpdateInView := p_AllowUpdateInView_3d679af7a390, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_3d679af7a390, p_FullTextSearchEnabled := p_FullTextSearchEnabled_3d679af7a390, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_3d679af7a390, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_3d679af7a390, p_GeneratedFormSection := p_GeneratedFormSection_3d679af7a390, p_IsNameField := p_IsNameField_3d679af7a390, p_RelatedEntityID := p_RelatedEntityID_3d679af7a390, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_3d679af7a390, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_3d679af7a390, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_3d679af7a390, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_3d679af7a390, p_EntityIDFieldName := p_EntityIDFieldName_3d679af7a390, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_3d679af7a390, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_3d679af7a390, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_3d679af7a390, p_Status := p_Status_3d679af7a390, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_3d679af7a390, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_3d679af7a390, p_AutoUpdateCategory := p_AutoUpdateCategory_3d679af7a390, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_3d679af7a390, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_3d679af7a390, p_Encrypt := p_Encrypt_3d679af7a390, p_EncryptionKeyID := p_EncryptionKeyID_3d679af7a390, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_3d679af7a390, p_SendEncryptedValue := p_SendEncryptedValue_3d679af7a390, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_3d679af7a390, p_IsSoftForeignKey := p_IsSoftForeignKey_3d679af7a390, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_3d679af7a390, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_3d679af7a390, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_3d679af7a390, p_JSONTypeDefinition := p_JSONTypeDefinition_3d679af7a390, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_3d679af7a390, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_3d679af7a390, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_3d679af7a390, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_3d679af7a390, p_IsComputed := p_IsComputed_3d679af7a390, p_EmbeddedRecord := p_EmbeddedRecord_3d679af7a390, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_3d679af7a390, p_Configuration_Clear := TRUE, p_ID := p_ID_3d679af7a390);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_1c028e3d76ba VARCHAR(255);
  p_Description_1c028e3d76ba TEXT;
  p_AutoUpdateDescription_1c028e3d76ba BOOLEAN;
  p_IsPrimaryKey_1c028e3d76ba BOOLEAN;
  p_IsUnique_1c028e3d76ba BOOLEAN;
  p_Category_1c028e3d76ba VARCHAR(255);
  p_ValueListType_1c028e3d76ba VARCHAR(20);
  p_ExtendedType_1c028e3d76ba VARCHAR(50);
  p_CodeType_1c028e3d76ba VARCHAR(50);
  p_DefaultInView_1c028e3d76ba BOOLEAN;
  p_ViewCellTemplate_1c028e3d76ba TEXT;
  p_DefaultColumnWidth_1c028e3d76ba INTEGER;
  p_AllowUpdateAPI_1c028e3d76ba BOOLEAN;
  p_AllowUpdateInView_1c028e3d76ba BOOLEAN;
  p_IncludeInUserSearchAPI_1c028e3d76ba BOOLEAN;
  p_FullTextSearchEnabled_1c028e3d76ba BOOLEAN;
  p_UserSearchParamFormatAPI_1c028e3d76ba VARCHAR(500);
  p_IncludeInGeneratedForm_1c028e3d76ba BOOLEAN;
  p_GeneratedFormSection_1c028e3d76ba VARCHAR(10);
  p_IsNameField_1c028e3d76ba BOOLEAN;
  p_RelatedEntityID_1c028e3d76ba UUID;
  p_RelatedEntityFieldName_1c028e3d76ba VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_1c028e3d76ba BOOLEAN;
  p_RelatedEntityNameFieldMap_1c028e3d76ba VARCHAR(255);
  p_RelatedEntityDisplayType_1c028e3d76ba VARCHAR(20);
  p_EntityIDFieldName_1c028e3d76ba VARCHAR(100);
  p_ScopeDefault_1c028e3d76ba VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_1c028e3d76ba BOOLEAN;
  p_ValuesToPackWithSchema_1c028e3d76ba VARCHAR(10);
  p_Status_1c028e3d76ba VARCHAR(25);
  p_AutoUpdateIsNameField_1c028e3d76ba BOOLEAN;
  p_AutoUpdateDefaultInView_1c028e3d76ba BOOLEAN;
  p_AutoUpdateCategory_1c028e3d76ba BOOLEAN;
  p_AutoUpdateDisplayName_1c028e3d76ba BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_1c028e3d76ba BOOLEAN;
  p_Encrypt_1c028e3d76ba BOOLEAN;
  p_EncryptionKeyID_1c028e3d76ba UUID;
  p_AllowDecryptInAPI_1c028e3d76ba BOOLEAN;
  p_SendEncryptedValue_1c028e3d76ba BOOLEAN;
  p_IsSoftPrimaryKey_1c028e3d76ba BOOLEAN;
  p_IsSoftForeignKey_1c028e3d76ba BOOLEAN;
  p_RelatedEntityJoinFields_1c028e3d76ba TEXT;
  p_JSONType_1c028e3d76ba VARCHAR(255);
  p_JSONTypeIsArray_1c028e3d76ba BOOLEAN;
  p_JSONTypeDefinition_1c028e3d76ba TEXT;
  p_UserSearchPredicateAPI_1c028e3d76ba VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_1c028e3d76ba BOOLEAN;
  p_AutoUpdateFullTextSearch_1c028e3d76ba BOOLEAN;
  p_AutoUpdateExtendedType_1c028e3d76ba BOOLEAN;
  p_IsComputed_1c028e3d76ba BOOLEAN;
  p_EmbeddedRecord_1c028e3d76ba TEXT;
  p_Configuration_1c028e3d76ba TEXT;
  p_ID_1c028e3d76ba UUID;
BEGIN
  p_DisplayName_1c028e3d76ba := 'Parent Accounting Company ID Depth';
  p_AutoUpdateDescription_1c028e3d76ba := TRUE;
  p_IsPrimaryKey_1c028e3d76ba := FALSE;
  p_IsUnique_1c028e3d76ba := FALSE;
  p_Category_1c028e3d76ba := 'Administrative Settings';
  p_ValueListType_1c028e3d76ba := 'None';
  p_DefaultInView_1c028e3d76ba := FALSE;
  p_DefaultColumnWidth_1c028e3d76ba := 50;
  p_AllowUpdateAPI_1c028e3d76ba := FALSE;
  p_AllowUpdateInView_1c028e3d76ba := TRUE;
  p_IncludeInUserSearchAPI_1c028e3d76ba := FALSE;
  p_FullTextSearchEnabled_1c028e3d76ba := FALSE;
  p_IncludeInGeneratedForm_1c028e3d76ba := TRUE;
  p_GeneratedFormSection_1c028e3d76ba := 'Category';
  p_IsNameField_1c028e3d76ba := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_1c028e3d76ba := FALSE;
  p_RelatedEntityDisplayType_1c028e3d76ba := 'Search';
  p_AutoUpdateRelatedEntityInfo_1c028e3d76ba := TRUE;
  p_ValuesToPackWithSchema_1c028e3d76ba := 'Auto';
  p_Status_1c028e3d76ba := 'Active';
  p_AutoUpdateIsNameField_1c028e3d76ba := TRUE;
  p_AutoUpdateDefaultInView_1c028e3d76ba := TRUE;
  p_AutoUpdateCategory_1c028e3d76ba := TRUE;
  p_AutoUpdateDisplayName_1c028e3d76ba := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_1c028e3d76ba := TRUE;
  p_Encrypt_1c028e3d76ba := FALSE;
  p_AllowDecryptInAPI_1c028e3d76ba := FALSE;
  p_SendEncryptedValue_1c028e3d76ba := FALSE;
  p_IsSoftPrimaryKey_1c028e3d76ba := FALSE;
  p_IsSoftForeignKey_1c028e3d76ba := FALSE;
  p_JSONTypeIsArray_1c028e3d76ba := FALSE;
  p_UserSearchPredicateAPI_1c028e3d76ba := 'Contains';
  p_AutoUpdateUserSearchPredicate_1c028e3d76ba := TRUE;
  p_AutoUpdateFullTextSearch_1c028e3d76ba := TRUE;
  p_AutoUpdateExtendedType_1c028e3d76ba := TRUE;
  p_IsComputed_1c028e3d76ba := FALSE;
  p_ID_1c028e3d76ba := '8ACFE3F2-152B-452F-921B-D1CED62EBA14';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM ${mjSchema}."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_1c028e3d76ba,
    'Description', p_Description_1c028e3d76ba,
    'AutoUpdateDescription', p_AutoUpdateDescription_1c028e3d76ba,
    'IsPrimaryKey', p_IsPrimaryKey_1c028e3d76ba,
    'IsUnique', p_IsUnique_1c028e3d76ba,
    'Category', p_Category_1c028e3d76ba,
    'ValueListType', p_ValueListType_1c028e3d76ba,
    'ExtendedType', p_ExtendedType_1c028e3d76ba,
    'CodeType', p_CodeType_1c028e3d76ba,
    'DefaultInView', p_DefaultInView_1c028e3d76ba,
    'ViewCellTemplate', p_ViewCellTemplate_1c028e3d76ba,
    'DefaultColumnWidth', p_DefaultColumnWidth_1c028e3d76ba,
    'AllowUpdateAPI', p_AllowUpdateAPI_1c028e3d76ba,
    'AllowUpdateInView', p_AllowUpdateInView_1c028e3d76ba,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_1c028e3d76ba,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_1c028e3d76ba,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_1c028e3d76ba,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_1c028e3d76ba,
    'GeneratedFormSection', p_GeneratedFormSection_1c028e3d76ba,
    'IsNameField', p_IsNameField_1c028e3d76ba,
    'RelatedEntityID', p_RelatedEntityID_1c028e3d76ba,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_1c028e3d76ba,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_1c028e3d76ba,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_1c028e3d76ba,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_1c028e3d76ba,
    'EntityIDFieldName', p_EntityIDFieldName_1c028e3d76ba,
    'ScopeDefault', p_ScopeDefault_1c028e3d76ba,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_1c028e3d76ba,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_1c028e3d76ba,
    'Status', p_Status_1c028e3d76ba,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_1c028e3d76ba,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_1c028e3d76ba,
    'AutoUpdateCategory', p_AutoUpdateCategory_1c028e3d76ba,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_1c028e3d76ba,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_1c028e3d76ba,
    'Encrypt', p_Encrypt_1c028e3d76ba,
    'EncryptionKeyID', p_EncryptionKeyID_1c028e3d76ba,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_1c028e3d76ba,
    'SendEncryptedValue', p_SendEncryptedValue_1c028e3d76ba,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_1c028e3d76ba,
    'IsSoftForeignKey', p_IsSoftForeignKey_1c028e3d76ba,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_1c028e3d76ba,
    'JSONType', p_JSONType_1c028e3d76ba,
    'JSONTypeIsArray', p_JSONTypeIsArray_1c028e3d76ba,
    'JSONTypeDefinition', p_JSONTypeDefinition_1c028e3d76ba,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_1c028e3d76ba,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_1c028e3d76ba,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_1c028e3d76ba,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_1c028e3d76ba,
    'IsComputed', p_IsComputed_1c028e3d76ba
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_1c028e3d76ba,
    'Configuration', p_Configuration_1c028e3d76ba,
    'ID', p_ID_1c028e3d76ba
  ));
  ELSE
    PERFORM ${mjSchema}."spUpdateEntityField"(p_DisplayName := p_DisplayName_1c028e3d76ba, p_Description := p_Description_1c028e3d76ba, p_Description_Clear := TRUE, p_AutoUpdateDescription := p_AutoUpdateDescription_1c028e3d76ba, p_IsPrimaryKey := p_IsPrimaryKey_1c028e3d76ba, p_IsUnique := p_IsUnique_1c028e3d76ba, p_Category := p_Category_1c028e3d76ba, p_ValueListType := p_ValueListType_1c028e3d76ba, p_ExtendedType := p_ExtendedType_1c028e3d76ba, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_1c028e3d76ba, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_1c028e3d76ba, p_ViewCellTemplate := p_ViewCellTemplate_1c028e3d76ba, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_1c028e3d76ba, p_AllowUpdateAPI := p_AllowUpdateAPI_1c028e3d76ba, p_AllowUpdateInView := p_AllowUpdateInView_1c028e3d76ba, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_1c028e3d76ba, p_FullTextSearchEnabled := p_FullTextSearchEnabled_1c028e3d76ba, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_1c028e3d76ba, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_1c028e3d76ba, p_GeneratedFormSection := p_GeneratedFormSection_1c028e3d76ba, p_IsNameField := p_IsNameField_1c028e3d76ba, p_RelatedEntityID := p_RelatedEntityID_1c028e3d76ba, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_1c028e3d76ba, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_1c028e3d76ba, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_1c028e3d76ba, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_1c028e3d76ba, p_EntityIDFieldName := p_EntityIDFieldName_1c028e3d76ba, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_1c028e3d76ba, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_1c028e3d76ba, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_1c028e3d76ba, p_Status := p_Status_1c028e3d76ba, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_1c028e3d76ba, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_1c028e3d76ba, p_AutoUpdateCategory := p_AutoUpdateCategory_1c028e3d76ba, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_1c028e3d76ba, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_1c028e3d76ba, p_Encrypt := p_Encrypt_1c028e3d76ba, p_EncryptionKeyID := p_EncryptionKeyID_1c028e3d76ba, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_1c028e3d76ba, p_SendEncryptedValue := p_SendEncryptedValue_1c028e3d76ba, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_1c028e3d76ba, p_IsSoftForeignKey := p_IsSoftForeignKey_1c028e3d76ba, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_1c028e3d76ba, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_1c028e3d76ba, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_1c028e3d76ba, p_JSONTypeDefinition := p_JSONTypeDefinition_1c028e3d76ba, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_1c028e3d76ba, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_1c028e3d76ba, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_1c028e3d76ba, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_1c028e3d76ba, p_IsComputed := p_IsComputed_1c028e3d76ba, p_EmbeddedRecord := p_EmbeddedRecord_1c028e3d76ba, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_1c028e3d76ba, p_Configuration_Clear := TRUE, p_ID := p_ID_1c028e3d76ba);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_3718961dc22f VARCHAR(255);
  p_Description_3718961dc22f TEXT;
  p_AutoUpdateDescription_3718961dc22f BOOLEAN;
  p_IsPrimaryKey_3718961dc22f BOOLEAN;
  p_IsUnique_3718961dc22f BOOLEAN;
  p_Category_3718961dc22f VARCHAR(255);
  p_ValueListType_3718961dc22f VARCHAR(20);
  p_ExtendedType_3718961dc22f VARCHAR(50);
  p_CodeType_3718961dc22f VARCHAR(50);
  p_DefaultInView_3718961dc22f BOOLEAN;
  p_ViewCellTemplate_3718961dc22f TEXT;
  p_DefaultColumnWidth_3718961dc22f INTEGER;
  p_AllowUpdateAPI_3718961dc22f BOOLEAN;
  p_AllowUpdateInView_3718961dc22f BOOLEAN;
  p_IncludeInUserSearchAPI_3718961dc22f BOOLEAN;
  p_FullTextSearchEnabled_3718961dc22f BOOLEAN;
  p_UserSearchParamFormatAPI_3718961dc22f VARCHAR(500);
  p_IncludeInGeneratedForm_3718961dc22f BOOLEAN;
  p_GeneratedFormSection_3718961dc22f VARCHAR(10);
  p_IsNameField_3718961dc22f BOOLEAN;
  p_RelatedEntityID_3718961dc22f UUID;
  p_RelatedEntityFieldName_3718961dc22f VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_3718961dc22f BOOLEAN;
  p_RelatedEntityNameFieldMap_3718961dc22f VARCHAR(255);
  p_RelatedEntityDisplayType_3718961dc22f VARCHAR(20);
  p_EntityIDFieldName_3718961dc22f VARCHAR(100);
  p_ScopeDefault_3718961dc22f VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_3718961dc22f BOOLEAN;
  p_ValuesToPackWithSchema_3718961dc22f VARCHAR(10);
  p_Status_3718961dc22f VARCHAR(25);
  p_AutoUpdateIsNameField_3718961dc22f BOOLEAN;
  p_AutoUpdateDefaultInView_3718961dc22f BOOLEAN;
  p_AutoUpdateCategory_3718961dc22f BOOLEAN;
  p_AutoUpdateDisplayName_3718961dc22f BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_3718961dc22f BOOLEAN;
  p_Encrypt_3718961dc22f BOOLEAN;
  p_EncryptionKeyID_3718961dc22f UUID;
  p_AllowDecryptInAPI_3718961dc22f BOOLEAN;
  p_SendEncryptedValue_3718961dc22f BOOLEAN;
  p_IsSoftPrimaryKey_3718961dc22f BOOLEAN;
  p_IsSoftForeignKey_3718961dc22f BOOLEAN;
  p_RelatedEntityJoinFields_3718961dc22f TEXT;
  p_JSONType_3718961dc22f VARCHAR(255);
  p_JSONTypeIsArray_3718961dc22f BOOLEAN;
  p_JSONTypeDefinition_3718961dc22f TEXT;
  p_UserSearchPredicateAPI_3718961dc22f VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_3718961dc22f BOOLEAN;
  p_AutoUpdateFullTextSearch_3718961dc22f BOOLEAN;
  p_AutoUpdateExtendedType_3718961dc22f BOOLEAN;
  p_IsComputed_3718961dc22f BOOLEAN;
  p_EmbeddedRecord_3718961dc22f TEXT;
  p_Configuration_3718961dc22f TEXT;
  p_ID_3718961dc22f UUID;
BEGIN
  p_DisplayName_3718961dc22f := 'Parent Accounting Company ID Path';
  p_AutoUpdateDescription_3718961dc22f := TRUE;
  p_IsPrimaryKey_3718961dc22f := FALSE;
  p_IsUnique_3718961dc22f := FALSE;
  p_Category_3718961dc22f := 'Administrative Settings';
  p_ValueListType_3718961dc22f := 'None';
  p_DefaultInView_3718961dc22f := FALSE;
  p_DefaultColumnWidth_3718961dc22f := 150;
  p_AllowUpdateAPI_3718961dc22f := FALSE;
  p_AllowUpdateInView_3718961dc22f := TRUE;
  p_IncludeInUserSearchAPI_3718961dc22f := FALSE;
  p_FullTextSearchEnabled_3718961dc22f := FALSE;
  p_IncludeInGeneratedForm_3718961dc22f := TRUE;
  p_GeneratedFormSection_3718961dc22f := 'Category';
  p_IsNameField_3718961dc22f := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_3718961dc22f := FALSE;
  p_RelatedEntityDisplayType_3718961dc22f := 'Search';
  p_AutoUpdateRelatedEntityInfo_3718961dc22f := TRUE;
  p_ValuesToPackWithSchema_3718961dc22f := 'Auto';
  p_Status_3718961dc22f := 'Active';
  p_AutoUpdateIsNameField_3718961dc22f := TRUE;
  p_AutoUpdateDefaultInView_3718961dc22f := TRUE;
  p_AutoUpdateCategory_3718961dc22f := TRUE;
  p_AutoUpdateDisplayName_3718961dc22f := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_3718961dc22f := TRUE;
  p_Encrypt_3718961dc22f := FALSE;
  p_AllowDecryptInAPI_3718961dc22f := FALSE;
  p_SendEncryptedValue_3718961dc22f := FALSE;
  p_IsSoftPrimaryKey_3718961dc22f := FALSE;
  p_IsSoftForeignKey_3718961dc22f := FALSE;
  p_JSONTypeIsArray_3718961dc22f := FALSE;
  p_UserSearchPredicateAPI_3718961dc22f := 'Contains';
  p_AutoUpdateUserSearchPredicate_3718961dc22f := TRUE;
  p_AutoUpdateFullTextSearch_3718961dc22f := TRUE;
  p_AutoUpdateExtendedType_3718961dc22f := TRUE;
  p_IsComputed_3718961dc22f := FALSE;
  p_ID_3718961dc22f := '5EB3BCF5-4248-4778-AD90-805067139C55';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM ${mjSchema}."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_3718961dc22f,
    'Description', p_Description_3718961dc22f,
    'AutoUpdateDescription', p_AutoUpdateDescription_3718961dc22f,
    'IsPrimaryKey', p_IsPrimaryKey_3718961dc22f,
    'IsUnique', p_IsUnique_3718961dc22f,
    'Category', p_Category_3718961dc22f,
    'ValueListType', p_ValueListType_3718961dc22f,
    'ExtendedType', p_ExtendedType_3718961dc22f,
    'CodeType', p_CodeType_3718961dc22f,
    'DefaultInView', p_DefaultInView_3718961dc22f,
    'ViewCellTemplate', p_ViewCellTemplate_3718961dc22f,
    'DefaultColumnWidth', p_DefaultColumnWidth_3718961dc22f,
    'AllowUpdateAPI', p_AllowUpdateAPI_3718961dc22f,
    'AllowUpdateInView', p_AllowUpdateInView_3718961dc22f,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_3718961dc22f,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_3718961dc22f,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_3718961dc22f,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_3718961dc22f,
    'GeneratedFormSection', p_GeneratedFormSection_3718961dc22f,
    'IsNameField', p_IsNameField_3718961dc22f,
    'RelatedEntityID', p_RelatedEntityID_3718961dc22f,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_3718961dc22f,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_3718961dc22f,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_3718961dc22f,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_3718961dc22f,
    'EntityIDFieldName', p_EntityIDFieldName_3718961dc22f,
    'ScopeDefault', p_ScopeDefault_3718961dc22f,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_3718961dc22f,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_3718961dc22f,
    'Status', p_Status_3718961dc22f,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_3718961dc22f,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_3718961dc22f,
    'AutoUpdateCategory', p_AutoUpdateCategory_3718961dc22f,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_3718961dc22f,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_3718961dc22f,
    'Encrypt', p_Encrypt_3718961dc22f,
    'EncryptionKeyID', p_EncryptionKeyID_3718961dc22f,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_3718961dc22f,
    'SendEncryptedValue', p_SendEncryptedValue_3718961dc22f,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_3718961dc22f,
    'IsSoftForeignKey', p_IsSoftForeignKey_3718961dc22f,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_3718961dc22f,
    'JSONType', p_JSONType_3718961dc22f,
    'JSONTypeIsArray', p_JSONTypeIsArray_3718961dc22f,
    'JSONTypeDefinition', p_JSONTypeDefinition_3718961dc22f,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_3718961dc22f,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_3718961dc22f,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_3718961dc22f,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_3718961dc22f,
    'IsComputed', p_IsComputed_3718961dc22f
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_3718961dc22f,
    'Configuration', p_Configuration_3718961dc22f,
    'ID', p_ID_3718961dc22f
  ));
  ELSE
    PERFORM ${mjSchema}."spUpdateEntityField"(p_DisplayName := p_DisplayName_3718961dc22f, p_Description := p_Description_3718961dc22f, p_Description_Clear := TRUE, p_AutoUpdateDescription := p_AutoUpdateDescription_3718961dc22f, p_IsPrimaryKey := p_IsPrimaryKey_3718961dc22f, p_IsUnique := p_IsUnique_3718961dc22f, p_Category := p_Category_3718961dc22f, p_ValueListType := p_ValueListType_3718961dc22f, p_ExtendedType := p_ExtendedType_3718961dc22f, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_3718961dc22f, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_3718961dc22f, p_ViewCellTemplate := p_ViewCellTemplate_3718961dc22f, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_3718961dc22f, p_AllowUpdateAPI := p_AllowUpdateAPI_3718961dc22f, p_AllowUpdateInView := p_AllowUpdateInView_3718961dc22f, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_3718961dc22f, p_FullTextSearchEnabled := p_FullTextSearchEnabled_3718961dc22f, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_3718961dc22f, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_3718961dc22f, p_GeneratedFormSection := p_GeneratedFormSection_3718961dc22f, p_IsNameField := p_IsNameField_3718961dc22f, p_RelatedEntityID := p_RelatedEntityID_3718961dc22f, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_3718961dc22f, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_3718961dc22f, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_3718961dc22f, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_3718961dc22f, p_EntityIDFieldName := p_EntityIDFieldName_3718961dc22f, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_3718961dc22f, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_3718961dc22f, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_3718961dc22f, p_Status := p_Status_3718961dc22f, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_3718961dc22f, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_3718961dc22f, p_AutoUpdateCategory := p_AutoUpdateCategory_3718961dc22f, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_3718961dc22f, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_3718961dc22f, p_Encrypt := p_Encrypt_3718961dc22f, p_EncryptionKeyID := p_EncryptionKeyID_3718961dc22f, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_3718961dc22f, p_SendEncryptedValue := p_SendEncryptedValue_3718961dc22f, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_3718961dc22f, p_IsSoftForeignKey := p_IsSoftForeignKey_3718961dc22f, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_3718961dc22f, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_3718961dc22f, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_3718961dc22f, p_JSONTypeDefinition := p_JSONTypeDefinition_3718961dc22f, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_3718961dc22f, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_3718961dc22f, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_3718961dc22f, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_3718961dc22f, p_IsComputed := p_IsComputed_3718961dc22f, p_EmbeddedRecord := p_EmbeddedRecord_3718961dc22f, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_3718961dc22f, p_Configuration_Clear := TRUE, p_ID := p_ID_3718961dc22f);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_5be2a6989313 VARCHAR(255);
  p_Description_5be2a6989313 TEXT;
  p_AutoUpdateDescription_5be2a6989313 BOOLEAN;
  p_IsPrimaryKey_5be2a6989313 BOOLEAN;
  p_IsUnique_5be2a6989313 BOOLEAN;
  p_Category_5be2a6989313 VARCHAR(255);
  p_ValueListType_5be2a6989313 VARCHAR(20);
  p_ExtendedType_5be2a6989313 VARCHAR(50);
  p_CodeType_5be2a6989313 VARCHAR(50);
  p_DefaultInView_5be2a6989313 BOOLEAN;
  p_ViewCellTemplate_5be2a6989313 TEXT;
  p_DefaultColumnWidth_5be2a6989313 INTEGER;
  p_AllowUpdateAPI_5be2a6989313 BOOLEAN;
  p_AllowUpdateInView_5be2a6989313 BOOLEAN;
  p_IncludeInUserSearchAPI_5be2a6989313 BOOLEAN;
  p_FullTextSearchEnabled_5be2a6989313 BOOLEAN;
  p_UserSearchParamFormatAPI_5be2a6989313 VARCHAR(500);
  p_IncludeInGeneratedForm_5be2a6989313 BOOLEAN;
  p_GeneratedFormSection_5be2a6989313 VARCHAR(10);
  p_IsNameField_5be2a6989313 BOOLEAN;
  p_RelatedEntityID_5be2a6989313 UUID;
  p_RelatedEntityFieldName_5be2a6989313 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_5be2a6989313 BOOLEAN;
  p_RelatedEntityNameFieldMap_5be2a6989313 VARCHAR(255);
  p_RelatedEntityDisplayType_5be2a6989313 VARCHAR(20);
  p_EntityIDFieldName_5be2a6989313 VARCHAR(100);
  p_ScopeDefault_5be2a6989313 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_5be2a6989313 BOOLEAN;
  p_ValuesToPackWithSchema_5be2a6989313 VARCHAR(10);
  p_Status_5be2a6989313 VARCHAR(25);
  p_AutoUpdateIsNameField_5be2a6989313 BOOLEAN;
  p_AutoUpdateDefaultInView_5be2a6989313 BOOLEAN;
  p_AutoUpdateCategory_5be2a6989313 BOOLEAN;
  p_AutoUpdateDisplayName_5be2a6989313 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_5be2a6989313 BOOLEAN;
  p_Encrypt_5be2a6989313 BOOLEAN;
  p_EncryptionKeyID_5be2a6989313 UUID;
  p_AllowDecryptInAPI_5be2a6989313 BOOLEAN;
  p_SendEncryptedValue_5be2a6989313 BOOLEAN;
  p_IsSoftPrimaryKey_5be2a6989313 BOOLEAN;
  p_IsSoftForeignKey_5be2a6989313 BOOLEAN;
  p_RelatedEntityJoinFields_5be2a6989313 TEXT;
  p_JSONType_5be2a6989313 VARCHAR(255);
  p_JSONTypeIsArray_5be2a6989313 BOOLEAN;
  p_JSONTypeDefinition_5be2a6989313 TEXT;
  p_UserSearchPredicateAPI_5be2a6989313 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_5be2a6989313 BOOLEAN;
  p_AutoUpdateFullTextSearch_5be2a6989313 BOOLEAN;
  p_AutoUpdateExtendedType_5be2a6989313 BOOLEAN;
  p_IsComputed_5be2a6989313 BOOLEAN;
  p_EmbeddedRecord_5be2a6989313 TEXT;
  p_Configuration_5be2a6989313 TEXT;
  p_ID_5be2a6989313 UUID;
BEGIN
  p_DisplayName_5be2a6989313 := 'Parent Accounting Company ID Is Leaf';
  p_AutoUpdateDescription_5be2a6989313 := TRUE;
  p_IsPrimaryKey_5be2a6989313 := FALSE;
  p_IsUnique_5be2a6989313 := FALSE;
  p_Category_5be2a6989313 := 'Administrative Settings';
  p_ValueListType_5be2a6989313 := 'None';
  p_DefaultInView_5be2a6989313 := FALSE;
  p_DefaultColumnWidth_5be2a6989313 := 150;
  p_AllowUpdateAPI_5be2a6989313 := FALSE;
  p_AllowUpdateInView_5be2a6989313 := TRUE;
  p_IncludeInUserSearchAPI_5be2a6989313 := FALSE;
  p_FullTextSearchEnabled_5be2a6989313 := FALSE;
  p_IncludeInGeneratedForm_5be2a6989313 := TRUE;
  p_GeneratedFormSection_5be2a6989313 := 'Category';
  p_IsNameField_5be2a6989313 := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_5be2a6989313 := FALSE;
  p_RelatedEntityDisplayType_5be2a6989313 := 'Search';
  p_AutoUpdateRelatedEntityInfo_5be2a6989313 := TRUE;
  p_ValuesToPackWithSchema_5be2a6989313 := 'Auto';
  p_Status_5be2a6989313 := 'Active';
  p_AutoUpdateIsNameField_5be2a6989313 := TRUE;
  p_AutoUpdateDefaultInView_5be2a6989313 := TRUE;
  p_AutoUpdateCategory_5be2a6989313 := TRUE;
  p_AutoUpdateDisplayName_5be2a6989313 := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_5be2a6989313 := TRUE;
  p_Encrypt_5be2a6989313 := FALSE;
  p_AllowDecryptInAPI_5be2a6989313 := FALSE;
  p_SendEncryptedValue_5be2a6989313 := FALSE;
  p_IsSoftPrimaryKey_5be2a6989313 := FALSE;
  p_IsSoftForeignKey_5be2a6989313 := FALSE;
  p_JSONTypeIsArray_5be2a6989313 := FALSE;
  p_UserSearchPredicateAPI_5be2a6989313 := 'Contains';
  p_AutoUpdateUserSearchPredicate_5be2a6989313 := TRUE;
  p_AutoUpdateFullTextSearch_5be2a6989313 := TRUE;
  p_AutoUpdateExtendedType_5be2a6989313 := TRUE;
  p_IsComputed_5be2a6989313 := FALSE;
  p_ID_5be2a6989313 := '58E1FA98-A59C-4EE8-9FBC-89BBBC9D40A5';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM ${mjSchema}."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_5be2a6989313,
    'Description', p_Description_5be2a6989313,
    'AutoUpdateDescription', p_AutoUpdateDescription_5be2a6989313,
    'IsPrimaryKey', p_IsPrimaryKey_5be2a6989313,
    'IsUnique', p_IsUnique_5be2a6989313,
    'Category', p_Category_5be2a6989313,
    'ValueListType', p_ValueListType_5be2a6989313,
    'ExtendedType', p_ExtendedType_5be2a6989313,
    'CodeType', p_CodeType_5be2a6989313,
    'DefaultInView', p_DefaultInView_5be2a6989313,
    'ViewCellTemplate', p_ViewCellTemplate_5be2a6989313,
    'DefaultColumnWidth', p_DefaultColumnWidth_5be2a6989313,
    'AllowUpdateAPI', p_AllowUpdateAPI_5be2a6989313,
    'AllowUpdateInView', p_AllowUpdateInView_5be2a6989313,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_5be2a6989313,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_5be2a6989313,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_5be2a6989313,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_5be2a6989313,
    'GeneratedFormSection', p_GeneratedFormSection_5be2a6989313,
    'IsNameField', p_IsNameField_5be2a6989313,
    'RelatedEntityID', p_RelatedEntityID_5be2a6989313,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_5be2a6989313,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_5be2a6989313,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_5be2a6989313,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_5be2a6989313,
    'EntityIDFieldName', p_EntityIDFieldName_5be2a6989313,
    'ScopeDefault', p_ScopeDefault_5be2a6989313,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_5be2a6989313,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_5be2a6989313,
    'Status', p_Status_5be2a6989313,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_5be2a6989313,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_5be2a6989313,
    'AutoUpdateCategory', p_AutoUpdateCategory_5be2a6989313,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_5be2a6989313,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_5be2a6989313,
    'Encrypt', p_Encrypt_5be2a6989313,
    'EncryptionKeyID', p_EncryptionKeyID_5be2a6989313,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_5be2a6989313,
    'SendEncryptedValue', p_SendEncryptedValue_5be2a6989313,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_5be2a6989313,
    'IsSoftForeignKey', p_IsSoftForeignKey_5be2a6989313,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_5be2a6989313,
    'JSONType', p_JSONType_5be2a6989313,
    'JSONTypeIsArray', p_JSONTypeIsArray_5be2a6989313,
    'JSONTypeDefinition', p_JSONTypeDefinition_5be2a6989313,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_5be2a6989313,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_5be2a6989313,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_5be2a6989313,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_5be2a6989313,
    'IsComputed', p_IsComputed_5be2a6989313
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_5be2a6989313,
    'Configuration', p_Configuration_5be2a6989313,
    'ID', p_ID_5be2a6989313
  ));
  ELSE
    PERFORM ${mjSchema}."spUpdateEntityField"(p_DisplayName := p_DisplayName_5be2a6989313, p_Description := p_Description_5be2a6989313, p_Description_Clear := TRUE, p_AutoUpdateDescription := p_AutoUpdateDescription_5be2a6989313, p_IsPrimaryKey := p_IsPrimaryKey_5be2a6989313, p_IsUnique := p_IsUnique_5be2a6989313, p_Category := p_Category_5be2a6989313, p_ValueListType := p_ValueListType_5be2a6989313, p_ExtendedType := p_ExtendedType_5be2a6989313, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_5be2a6989313, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_5be2a6989313, p_ViewCellTemplate := p_ViewCellTemplate_5be2a6989313, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_5be2a6989313, p_AllowUpdateAPI := p_AllowUpdateAPI_5be2a6989313, p_AllowUpdateInView := p_AllowUpdateInView_5be2a6989313, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_5be2a6989313, p_FullTextSearchEnabled := p_FullTextSearchEnabled_5be2a6989313, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_5be2a6989313, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_5be2a6989313, p_GeneratedFormSection := p_GeneratedFormSection_5be2a6989313, p_IsNameField := p_IsNameField_5be2a6989313, p_RelatedEntityID := p_RelatedEntityID_5be2a6989313, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_5be2a6989313, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_5be2a6989313, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_5be2a6989313, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_5be2a6989313, p_EntityIDFieldName := p_EntityIDFieldName_5be2a6989313, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_5be2a6989313, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_5be2a6989313, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_5be2a6989313, p_Status := p_Status_5be2a6989313, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_5be2a6989313, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_5be2a6989313, p_AutoUpdateCategory := p_AutoUpdateCategory_5be2a6989313, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_5be2a6989313, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_5be2a6989313, p_Encrypt := p_Encrypt_5be2a6989313, p_EncryptionKeyID := p_EncryptionKeyID_5be2a6989313, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_5be2a6989313, p_SendEncryptedValue := p_SendEncryptedValue_5be2a6989313, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_5be2a6989313, p_IsSoftForeignKey := p_IsSoftForeignKey_5be2a6989313, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_5be2a6989313, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_5be2a6989313, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_5be2a6989313, p_JSONTypeDefinition := p_JSONTypeDefinition_5be2a6989313, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_5be2a6989313, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_5be2a6989313, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_5be2a6989313, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_5be2a6989313, p_IsComputed := p_IsComputed_5be2a6989313, p_EmbeddedRecord := p_EmbeddedRecord_5be2a6989313, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_5be2a6989313, p_Configuration_Clear := TRUE, p_ID := p_ID_5be2a6989313);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_fe287c16c68f VARCHAR(255);
  p_Description_fe287c16c68f TEXT;
  p_AutoUpdateDescription_fe287c16c68f BOOLEAN;
  p_IsPrimaryKey_fe287c16c68f BOOLEAN;
  p_IsUnique_fe287c16c68f BOOLEAN;
  p_Category_fe287c16c68f VARCHAR(255);
  p_ValueListType_fe287c16c68f VARCHAR(20);
  p_ExtendedType_fe287c16c68f VARCHAR(50);
  p_CodeType_fe287c16c68f VARCHAR(50);
  p_DefaultInView_fe287c16c68f BOOLEAN;
  p_ViewCellTemplate_fe287c16c68f TEXT;
  p_DefaultColumnWidth_fe287c16c68f INTEGER;
  p_AllowUpdateAPI_fe287c16c68f BOOLEAN;
  p_AllowUpdateInView_fe287c16c68f BOOLEAN;
  p_IncludeInUserSearchAPI_fe287c16c68f BOOLEAN;
  p_FullTextSearchEnabled_fe287c16c68f BOOLEAN;
  p_UserSearchParamFormatAPI_fe287c16c68f VARCHAR(500);
  p_IncludeInGeneratedForm_fe287c16c68f BOOLEAN;
  p_GeneratedFormSection_fe287c16c68f VARCHAR(10);
  p_IsNameField_fe287c16c68f BOOLEAN;
  p_RelatedEntityID_fe287c16c68f UUID;
  p_RelatedEntityFieldName_fe287c16c68f VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_fe287c16c68f BOOLEAN;
  p_RelatedEntityNameFieldMap_fe287c16c68f VARCHAR(255);
  p_RelatedEntityDisplayType_fe287c16c68f VARCHAR(20);
  p_EntityIDFieldName_fe287c16c68f VARCHAR(100);
  p_ScopeDefault_fe287c16c68f VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_fe287c16c68f BOOLEAN;
  p_ValuesToPackWithSchema_fe287c16c68f VARCHAR(10);
  p_Status_fe287c16c68f VARCHAR(25);
  p_AutoUpdateIsNameField_fe287c16c68f BOOLEAN;
  p_AutoUpdateDefaultInView_fe287c16c68f BOOLEAN;
  p_AutoUpdateCategory_fe287c16c68f BOOLEAN;
  p_AutoUpdateDisplayName_fe287c16c68f BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_fe287c16c68f BOOLEAN;
  p_Encrypt_fe287c16c68f BOOLEAN;
  p_EncryptionKeyID_fe287c16c68f UUID;
  p_AllowDecryptInAPI_fe287c16c68f BOOLEAN;
  p_SendEncryptedValue_fe287c16c68f BOOLEAN;
  p_IsSoftPrimaryKey_fe287c16c68f BOOLEAN;
  p_IsSoftForeignKey_fe287c16c68f BOOLEAN;
  p_RelatedEntityJoinFields_fe287c16c68f TEXT;
  p_JSONType_fe287c16c68f VARCHAR(255);
  p_JSONTypeIsArray_fe287c16c68f BOOLEAN;
  p_JSONTypeDefinition_fe287c16c68f TEXT;
  p_UserSearchPredicateAPI_fe287c16c68f VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_fe287c16c68f BOOLEAN;
  p_AutoUpdateFullTextSearch_fe287c16c68f BOOLEAN;
  p_AutoUpdateExtendedType_fe287c16c68f BOOLEAN;
  p_IsComputed_fe287c16c68f BOOLEAN;
  p_EmbeddedRecord_fe287c16c68f TEXT;
  p_Configuration_fe287c16c68f TEXT;
  p_ID_fe287c16c68f UUID;
BEGIN
  p_DisplayName_fe287c16c68f := 'Parent Accounting Company ID Child Count';
  p_AutoUpdateDescription_fe287c16c68f := TRUE;
  p_IsPrimaryKey_fe287c16c68f := FALSE;
  p_IsUnique_fe287c16c68f := FALSE;
  p_Category_fe287c16c68f := 'Administrative Settings';
  p_ValueListType_fe287c16c68f := 'None';
  p_DefaultInView_fe287c16c68f := FALSE;
  p_DefaultColumnWidth_fe287c16c68f := 50;
  p_AllowUpdateAPI_fe287c16c68f := FALSE;
  p_AllowUpdateInView_fe287c16c68f := TRUE;
  p_IncludeInUserSearchAPI_fe287c16c68f := FALSE;
  p_FullTextSearchEnabled_fe287c16c68f := FALSE;
  p_IncludeInGeneratedForm_fe287c16c68f := TRUE;
  p_GeneratedFormSection_fe287c16c68f := 'Category';
  p_IsNameField_fe287c16c68f := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_fe287c16c68f := FALSE;
  p_RelatedEntityDisplayType_fe287c16c68f := 'Search';
  p_AutoUpdateRelatedEntityInfo_fe287c16c68f := TRUE;
  p_ValuesToPackWithSchema_fe287c16c68f := 'Auto';
  p_Status_fe287c16c68f := 'Active';
  p_AutoUpdateIsNameField_fe287c16c68f := TRUE;
  p_AutoUpdateDefaultInView_fe287c16c68f := TRUE;
  p_AutoUpdateCategory_fe287c16c68f := TRUE;
  p_AutoUpdateDisplayName_fe287c16c68f := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_fe287c16c68f := TRUE;
  p_Encrypt_fe287c16c68f := FALSE;
  p_AllowDecryptInAPI_fe287c16c68f := FALSE;
  p_SendEncryptedValue_fe287c16c68f := FALSE;
  p_IsSoftPrimaryKey_fe287c16c68f := FALSE;
  p_IsSoftForeignKey_fe287c16c68f := FALSE;
  p_JSONTypeIsArray_fe287c16c68f := FALSE;
  p_UserSearchPredicateAPI_fe287c16c68f := 'Contains';
  p_AutoUpdateUserSearchPredicate_fe287c16c68f := TRUE;
  p_AutoUpdateFullTextSearch_fe287c16c68f := TRUE;
  p_AutoUpdateExtendedType_fe287c16c68f := TRUE;
  p_IsComputed_fe287c16c68f := FALSE;
  p_ID_fe287c16c68f := '96A9DBC1-A854-4706-A7F7-5B8D2DF3967E';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM ${mjSchema}."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_fe287c16c68f,
    'Description', p_Description_fe287c16c68f,
    'AutoUpdateDescription', p_AutoUpdateDescription_fe287c16c68f,
    'IsPrimaryKey', p_IsPrimaryKey_fe287c16c68f,
    'IsUnique', p_IsUnique_fe287c16c68f,
    'Category', p_Category_fe287c16c68f,
    'ValueListType', p_ValueListType_fe287c16c68f,
    'ExtendedType', p_ExtendedType_fe287c16c68f,
    'CodeType', p_CodeType_fe287c16c68f,
    'DefaultInView', p_DefaultInView_fe287c16c68f,
    'ViewCellTemplate', p_ViewCellTemplate_fe287c16c68f,
    'DefaultColumnWidth', p_DefaultColumnWidth_fe287c16c68f,
    'AllowUpdateAPI', p_AllowUpdateAPI_fe287c16c68f,
    'AllowUpdateInView', p_AllowUpdateInView_fe287c16c68f,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_fe287c16c68f,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_fe287c16c68f,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_fe287c16c68f,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_fe287c16c68f,
    'GeneratedFormSection', p_GeneratedFormSection_fe287c16c68f,
    'IsNameField', p_IsNameField_fe287c16c68f,
    'RelatedEntityID', p_RelatedEntityID_fe287c16c68f,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_fe287c16c68f,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_fe287c16c68f,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_fe287c16c68f,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_fe287c16c68f,
    'EntityIDFieldName', p_EntityIDFieldName_fe287c16c68f,
    'ScopeDefault', p_ScopeDefault_fe287c16c68f,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_fe287c16c68f,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_fe287c16c68f,
    'Status', p_Status_fe287c16c68f,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_fe287c16c68f,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_fe287c16c68f,
    'AutoUpdateCategory', p_AutoUpdateCategory_fe287c16c68f,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_fe287c16c68f,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_fe287c16c68f,
    'Encrypt', p_Encrypt_fe287c16c68f,
    'EncryptionKeyID', p_EncryptionKeyID_fe287c16c68f,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_fe287c16c68f,
    'SendEncryptedValue', p_SendEncryptedValue_fe287c16c68f,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_fe287c16c68f,
    'IsSoftForeignKey', p_IsSoftForeignKey_fe287c16c68f,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_fe287c16c68f,
    'JSONType', p_JSONType_fe287c16c68f,
    'JSONTypeIsArray', p_JSONTypeIsArray_fe287c16c68f,
    'JSONTypeDefinition', p_JSONTypeDefinition_fe287c16c68f,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_fe287c16c68f,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_fe287c16c68f,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_fe287c16c68f,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_fe287c16c68f,
    'IsComputed', p_IsComputed_fe287c16c68f
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_fe287c16c68f,
    'Configuration', p_Configuration_fe287c16c68f,
    'ID', p_ID_fe287c16c68f
  ));
  ELSE
    PERFORM ${mjSchema}."spUpdateEntityField"(p_DisplayName := p_DisplayName_fe287c16c68f, p_Description := p_Description_fe287c16c68f, p_Description_Clear := TRUE, p_AutoUpdateDescription := p_AutoUpdateDescription_fe287c16c68f, p_IsPrimaryKey := p_IsPrimaryKey_fe287c16c68f, p_IsUnique := p_IsUnique_fe287c16c68f, p_Category := p_Category_fe287c16c68f, p_ValueListType := p_ValueListType_fe287c16c68f, p_ExtendedType := p_ExtendedType_fe287c16c68f, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_fe287c16c68f, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_fe287c16c68f, p_ViewCellTemplate := p_ViewCellTemplate_fe287c16c68f, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_fe287c16c68f, p_AllowUpdateAPI := p_AllowUpdateAPI_fe287c16c68f, p_AllowUpdateInView := p_AllowUpdateInView_fe287c16c68f, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_fe287c16c68f, p_FullTextSearchEnabled := p_FullTextSearchEnabled_fe287c16c68f, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_fe287c16c68f, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_fe287c16c68f, p_GeneratedFormSection := p_GeneratedFormSection_fe287c16c68f, p_IsNameField := p_IsNameField_fe287c16c68f, p_RelatedEntityID := p_RelatedEntityID_fe287c16c68f, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_fe287c16c68f, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_fe287c16c68f, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_fe287c16c68f, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_fe287c16c68f, p_EntityIDFieldName := p_EntityIDFieldName_fe287c16c68f, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_fe287c16c68f, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_fe287c16c68f, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_fe287c16c68f, p_Status := p_Status_fe287c16c68f, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_fe287c16c68f, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_fe287c16c68f, p_AutoUpdateCategory := p_AutoUpdateCategory_fe287c16c68f, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_fe287c16c68f, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_fe287c16c68f, p_Encrypt := p_Encrypt_fe287c16c68f, p_EncryptionKeyID := p_EncryptionKeyID_fe287c16c68f, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_fe287c16c68f, p_SendEncryptedValue := p_SendEncryptedValue_fe287c16c68f, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_fe287c16c68f, p_IsSoftForeignKey := p_IsSoftForeignKey_fe287c16c68f, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_fe287c16c68f, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_fe287c16c68f, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_fe287c16c68f, p_JSONTypeDefinition := p_JSONTypeDefinition_fe287c16c68f, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_fe287c16c68f, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_fe287c16c68f, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_fe287c16c68f, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_fe287c16c68f, p_IsComputed := p_IsComputed_fe287c16c68f, p_EmbeddedRecord := p_EmbeddedRecord_fe287c16c68f, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_fe287c16c68f, p_Configuration_Clear := TRUE, p_ID := p_ID_fe287c16c68f);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_94fdb03f8808 VARCHAR(255);
  p_Description_94fdb03f8808 TEXT;
  p_AutoUpdateDescription_94fdb03f8808 BOOLEAN;
  p_IsPrimaryKey_94fdb03f8808 BOOLEAN;
  p_IsUnique_94fdb03f8808 BOOLEAN;
  p_Category_94fdb03f8808 VARCHAR(255);
  p_ValueListType_94fdb03f8808 VARCHAR(20);
  p_ExtendedType_94fdb03f8808 VARCHAR(50);
  p_CodeType_94fdb03f8808 VARCHAR(50);
  p_DefaultInView_94fdb03f8808 BOOLEAN;
  p_ViewCellTemplate_94fdb03f8808 TEXT;
  p_DefaultColumnWidth_94fdb03f8808 INTEGER;
  p_AllowUpdateAPI_94fdb03f8808 BOOLEAN;
  p_AllowUpdateInView_94fdb03f8808 BOOLEAN;
  p_IncludeInUserSearchAPI_94fdb03f8808 BOOLEAN;
  p_FullTextSearchEnabled_94fdb03f8808 BOOLEAN;
  p_UserSearchParamFormatAPI_94fdb03f8808 VARCHAR(500);
  p_IncludeInGeneratedForm_94fdb03f8808 BOOLEAN;
  p_GeneratedFormSection_94fdb03f8808 VARCHAR(10);
  p_IsNameField_94fdb03f8808 BOOLEAN;
  p_RelatedEntityID_94fdb03f8808 UUID;
  p_RelatedEntityFieldName_94fdb03f8808 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_94fdb03f8808 BOOLEAN;
  p_RelatedEntityNameFieldMap_94fdb03f8808 VARCHAR(255);
  p_RelatedEntityDisplayType_94fdb03f8808 VARCHAR(20);
  p_EntityIDFieldName_94fdb03f8808 VARCHAR(100);
  p_ScopeDefault_94fdb03f8808 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_94fdb03f8808 BOOLEAN;
  p_ValuesToPackWithSchema_94fdb03f8808 VARCHAR(10);
  p_Status_94fdb03f8808 VARCHAR(25);
  p_AutoUpdateIsNameField_94fdb03f8808 BOOLEAN;
  p_AutoUpdateDefaultInView_94fdb03f8808 BOOLEAN;
  p_AutoUpdateCategory_94fdb03f8808 BOOLEAN;
  p_AutoUpdateDisplayName_94fdb03f8808 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_94fdb03f8808 BOOLEAN;
  p_Encrypt_94fdb03f8808 BOOLEAN;
  p_EncryptionKeyID_94fdb03f8808 UUID;
  p_AllowDecryptInAPI_94fdb03f8808 BOOLEAN;
  p_SendEncryptedValue_94fdb03f8808 BOOLEAN;
  p_IsSoftPrimaryKey_94fdb03f8808 BOOLEAN;
  p_IsSoftForeignKey_94fdb03f8808 BOOLEAN;
  p_RelatedEntityJoinFields_94fdb03f8808 TEXT;
  p_JSONType_94fdb03f8808 VARCHAR(255);
  p_JSONTypeIsArray_94fdb03f8808 BOOLEAN;
  p_JSONTypeDefinition_94fdb03f8808 TEXT;
  p_UserSearchPredicateAPI_94fdb03f8808 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_94fdb03f8808 BOOLEAN;
  p_AutoUpdateFullTextSearch_94fdb03f8808 BOOLEAN;
  p_AutoUpdateExtendedType_94fdb03f8808 BOOLEAN;
  p_IsComputed_94fdb03f8808 BOOLEAN;
  p_EmbeddedRecord_94fdb03f8808 TEXT;
  p_Configuration_94fdb03f8808 TEXT;
  p_ID_94fdb03f8808 UUID;
BEGIN
  p_DisplayName_94fdb03f8808 := 'Parent Dimension Value ID Depth';
  p_AutoUpdateDescription_94fdb03f8808 := TRUE;
  p_IsPrimaryKey_94fdb03f8808 := FALSE;
  p_IsUnique_94fdb03f8808 := FALSE;
  p_Category_94fdb03f8808 := 'Hierarchy';
  p_ValueListType_94fdb03f8808 := 'None';
  p_DefaultInView_94fdb03f8808 := FALSE;
  p_DefaultColumnWidth_94fdb03f8808 := 50;
  p_AllowUpdateAPI_94fdb03f8808 := FALSE;
  p_AllowUpdateInView_94fdb03f8808 := TRUE;
  p_IncludeInUserSearchAPI_94fdb03f8808 := FALSE;
  p_FullTextSearchEnabled_94fdb03f8808 := FALSE;
  p_IncludeInGeneratedForm_94fdb03f8808 := TRUE;
  p_GeneratedFormSection_94fdb03f8808 := 'Category';
  p_IsNameField_94fdb03f8808 := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_94fdb03f8808 := FALSE;
  p_RelatedEntityDisplayType_94fdb03f8808 := 'Search';
  p_AutoUpdateRelatedEntityInfo_94fdb03f8808 := TRUE;
  p_ValuesToPackWithSchema_94fdb03f8808 := 'Auto';
  p_Status_94fdb03f8808 := 'Active';
  p_AutoUpdateIsNameField_94fdb03f8808 := TRUE;
  p_AutoUpdateDefaultInView_94fdb03f8808 := TRUE;
  p_AutoUpdateCategory_94fdb03f8808 := TRUE;
  p_AutoUpdateDisplayName_94fdb03f8808 := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_94fdb03f8808 := TRUE;
  p_Encrypt_94fdb03f8808 := FALSE;
  p_AllowDecryptInAPI_94fdb03f8808 := FALSE;
  p_SendEncryptedValue_94fdb03f8808 := FALSE;
  p_IsSoftPrimaryKey_94fdb03f8808 := FALSE;
  p_IsSoftForeignKey_94fdb03f8808 := FALSE;
  p_JSONTypeIsArray_94fdb03f8808 := FALSE;
  p_UserSearchPredicateAPI_94fdb03f8808 := 'Contains';
  p_AutoUpdateUserSearchPredicate_94fdb03f8808 := TRUE;
  p_AutoUpdateFullTextSearch_94fdb03f8808 := TRUE;
  p_AutoUpdateExtendedType_94fdb03f8808 := TRUE;
  p_IsComputed_94fdb03f8808 := FALSE;
  p_ID_94fdb03f8808 := '5E0DD50A-40BD-4624-BB4E-4A60908BD6AD';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM ${mjSchema}."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_94fdb03f8808,
    'Description', p_Description_94fdb03f8808,
    'AutoUpdateDescription', p_AutoUpdateDescription_94fdb03f8808,
    'IsPrimaryKey', p_IsPrimaryKey_94fdb03f8808,
    'IsUnique', p_IsUnique_94fdb03f8808,
    'Category', p_Category_94fdb03f8808,
    'ValueListType', p_ValueListType_94fdb03f8808,
    'ExtendedType', p_ExtendedType_94fdb03f8808,
    'CodeType', p_CodeType_94fdb03f8808,
    'DefaultInView', p_DefaultInView_94fdb03f8808,
    'ViewCellTemplate', p_ViewCellTemplate_94fdb03f8808,
    'DefaultColumnWidth', p_DefaultColumnWidth_94fdb03f8808,
    'AllowUpdateAPI', p_AllowUpdateAPI_94fdb03f8808,
    'AllowUpdateInView', p_AllowUpdateInView_94fdb03f8808,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_94fdb03f8808,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_94fdb03f8808,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_94fdb03f8808,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_94fdb03f8808,
    'GeneratedFormSection', p_GeneratedFormSection_94fdb03f8808,
    'IsNameField', p_IsNameField_94fdb03f8808,
    'RelatedEntityID', p_RelatedEntityID_94fdb03f8808,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_94fdb03f8808,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_94fdb03f8808,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_94fdb03f8808,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_94fdb03f8808,
    'EntityIDFieldName', p_EntityIDFieldName_94fdb03f8808,
    'ScopeDefault', p_ScopeDefault_94fdb03f8808,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_94fdb03f8808,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_94fdb03f8808,
    'Status', p_Status_94fdb03f8808,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_94fdb03f8808,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_94fdb03f8808,
    'AutoUpdateCategory', p_AutoUpdateCategory_94fdb03f8808,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_94fdb03f8808,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_94fdb03f8808,
    'Encrypt', p_Encrypt_94fdb03f8808,
    'EncryptionKeyID', p_EncryptionKeyID_94fdb03f8808,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_94fdb03f8808,
    'SendEncryptedValue', p_SendEncryptedValue_94fdb03f8808,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_94fdb03f8808,
    'IsSoftForeignKey', p_IsSoftForeignKey_94fdb03f8808,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_94fdb03f8808,
    'JSONType', p_JSONType_94fdb03f8808,
    'JSONTypeIsArray', p_JSONTypeIsArray_94fdb03f8808,
    'JSONTypeDefinition', p_JSONTypeDefinition_94fdb03f8808,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_94fdb03f8808,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_94fdb03f8808,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_94fdb03f8808,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_94fdb03f8808,
    'IsComputed', p_IsComputed_94fdb03f8808
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_94fdb03f8808,
    'Configuration', p_Configuration_94fdb03f8808,
    'ID', p_ID_94fdb03f8808
  ));
  ELSE
    PERFORM ${mjSchema}."spUpdateEntityField"(p_DisplayName := p_DisplayName_94fdb03f8808, p_Description := p_Description_94fdb03f8808, p_Description_Clear := TRUE, p_AutoUpdateDescription := p_AutoUpdateDescription_94fdb03f8808, p_IsPrimaryKey := p_IsPrimaryKey_94fdb03f8808, p_IsUnique := p_IsUnique_94fdb03f8808, p_Category := p_Category_94fdb03f8808, p_ValueListType := p_ValueListType_94fdb03f8808, p_ExtendedType := p_ExtendedType_94fdb03f8808, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_94fdb03f8808, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_94fdb03f8808, p_ViewCellTemplate := p_ViewCellTemplate_94fdb03f8808, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_94fdb03f8808, p_AllowUpdateAPI := p_AllowUpdateAPI_94fdb03f8808, p_AllowUpdateInView := p_AllowUpdateInView_94fdb03f8808, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_94fdb03f8808, p_FullTextSearchEnabled := p_FullTextSearchEnabled_94fdb03f8808, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_94fdb03f8808, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_94fdb03f8808, p_GeneratedFormSection := p_GeneratedFormSection_94fdb03f8808, p_IsNameField := p_IsNameField_94fdb03f8808, p_RelatedEntityID := p_RelatedEntityID_94fdb03f8808, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_94fdb03f8808, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_94fdb03f8808, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_94fdb03f8808, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_94fdb03f8808, p_EntityIDFieldName := p_EntityIDFieldName_94fdb03f8808, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_94fdb03f8808, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_94fdb03f8808, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_94fdb03f8808, p_Status := p_Status_94fdb03f8808, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_94fdb03f8808, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_94fdb03f8808, p_AutoUpdateCategory := p_AutoUpdateCategory_94fdb03f8808, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_94fdb03f8808, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_94fdb03f8808, p_Encrypt := p_Encrypt_94fdb03f8808, p_EncryptionKeyID := p_EncryptionKeyID_94fdb03f8808, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_94fdb03f8808, p_SendEncryptedValue := p_SendEncryptedValue_94fdb03f8808, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_94fdb03f8808, p_IsSoftForeignKey := p_IsSoftForeignKey_94fdb03f8808, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_94fdb03f8808, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_94fdb03f8808, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_94fdb03f8808, p_JSONTypeDefinition := p_JSONTypeDefinition_94fdb03f8808, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_94fdb03f8808, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_94fdb03f8808, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_94fdb03f8808, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_94fdb03f8808, p_IsComputed := p_IsComputed_94fdb03f8808, p_EmbeddedRecord := p_EmbeddedRecord_94fdb03f8808, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_94fdb03f8808, p_Configuration_Clear := TRUE, p_ID := p_ID_94fdb03f8808);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_7685824ad8f0 VARCHAR(255);
  p_Description_7685824ad8f0 TEXT;
  p_AutoUpdateDescription_7685824ad8f0 BOOLEAN;
  p_IsPrimaryKey_7685824ad8f0 BOOLEAN;
  p_IsUnique_7685824ad8f0 BOOLEAN;
  p_Category_7685824ad8f0 VARCHAR(255);
  p_ValueListType_7685824ad8f0 VARCHAR(20);
  p_ExtendedType_7685824ad8f0 VARCHAR(50);
  p_CodeType_7685824ad8f0 VARCHAR(50);
  p_DefaultInView_7685824ad8f0 BOOLEAN;
  p_ViewCellTemplate_7685824ad8f0 TEXT;
  p_DefaultColumnWidth_7685824ad8f0 INTEGER;
  p_AllowUpdateAPI_7685824ad8f0 BOOLEAN;
  p_AllowUpdateInView_7685824ad8f0 BOOLEAN;
  p_IncludeInUserSearchAPI_7685824ad8f0 BOOLEAN;
  p_FullTextSearchEnabled_7685824ad8f0 BOOLEAN;
  p_UserSearchParamFormatAPI_7685824ad8f0 VARCHAR(500);
  p_IncludeInGeneratedForm_7685824ad8f0 BOOLEAN;
  p_GeneratedFormSection_7685824ad8f0 VARCHAR(10);
  p_IsNameField_7685824ad8f0 BOOLEAN;
  p_RelatedEntityID_7685824ad8f0 UUID;
  p_RelatedEntityFieldName_7685824ad8f0 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_7685824ad8f0 BOOLEAN;
  p_RelatedEntityNameFieldMap_7685824ad8f0 VARCHAR(255);
  p_RelatedEntityDisplayType_7685824ad8f0 VARCHAR(20);
  p_EntityIDFieldName_7685824ad8f0 VARCHAR(100);
  p_ScopeDefault_7685824ad8f0 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_7685824ad8f0 BOOLEAN;
  p_ValuesToPackWithSchema_7685824ad8f0 VARCHAR(10);
  p_Status_7685824ad8f0 VARCHAR(25);
  p_AutoUpdateIsNameField_7685824ad8f0 BOOLEAN;
  p_AutoUpdateDefaultInView_7685824ad8f0 BOOLEAN;
  p_AutoUpdateCategory_7685824ad8f0 BOOLEAN;
  p_AutoUpdateDisplayName_7685824ad8f0 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_7685824ad8f0 BOOLEAN;
  p_Encrypt_7685824ad8f0 BOOLEAN;
  p_EncryptionKeyID_7685824ad8f0 UUID;
  p_AllowDecryptInAPI_7685824ad8f0 BOOLEAN;
  p_SendEncryptedValue_7685824ad8f0 BOOLEAN;
  p_IsSoftPrimaryKey_7685824ad8f0 BOOLEAN;
  p_IsSoftForeignKey_7685824ad8f0 BOOLEAN;
  p_RelatedEntityJoinFields_7685824ad8f0 TEXT;
  p_JSONType_7685824ad8f0 VARCHAR(255);
  p_JSONTypeIsArray_7685824ad8f0 BOOLEAN;
  p_JSONTypeDefinition_7685824ad8f0 TEXT;
  p_UserSearchPredicateAPI_7685824ad8f0 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_7685824ad8f0 BOOLEAN;
  p_AutoUpdateFullTextSearch_7685824ad8f0 BOOLEAN;
  p_AutoUpdateExtendedType_7685824ad8f0 BOOLEAN;
  p_IsComputed_7685824ad8f0 BOOLEAN;
  p_EmbeddedRecord_7685824ad8f0 TEXT;
  p_Configuration_7685824ad8f0 TEXT;
  p_ID_7685824ad8f0 UUID;
BEGIN
  p_DisplayName_7685824ad8f0 := 'Parent Dimension Value ID Path';
  p_AutoUpdateDescription_7685824ad8f0 := TRUE;
  p_IsPrimaryKey_7685824ad8f0 := FALSE;
  p_IsUnique_7685824ad8f0 := FALSE;
  p_Category_7685824ad8f0 := 'Hierarchy';
  p_ValueListType_7685824ad8f0 := 'None';
  p_DefaultInView_7685824ad8f0 := FALSE;
  p_DefaultColumnWidth_7685824ad8f0 := 150;
  p_AllowUpdateAPI_7685824ad8f0 := FALSE;
  p_AllowUpdateInView_7685824ad8f0 := TRUE;
  p_IncludeInUserSearchAPI_7685824ad8f0 := FALSE;
  p_FullTextSearchEnabled_7685824ad8f0 := FALSE;
  p_IncludeInGeneratedForm_7685824ad8f0 := TRUE;
  p_GeneratedFormSection_7685824ad8f0 := 'Category';
  p_IsNameField_7685824ad8f0 := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_7685824ad8f0 := FALSE;
  p_RelatedEntityDisplayType_7685824ad8f0 := 'Search';
  p_AutoUpdateRelatedEntityInfo_7685824ad8f0 := TRUE;
  p_ValuesToPackWithSchema_7685824ad8f0 := 'Auto';
  p_Status_7685824ad8f0 := 'Active';
  p_AutoUpdateIsNameField_7685824ad8f0 := TRUE;
  p_AutoUpdateDefaultInView_7685824ad8f0 := TRUE;
  p_AutoUpdateCategory_7685824ad8f0 := TRUE;
  p_AutoUpdateDisplayName_7685824ad8f0 := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_7685824ad8f0 := TRUE;
  p_Encrypt_7685824ad8f0 := FALSE;
  p_AllowDecryptInAPI_7685824ad8f0 := FALSE;
  p_SendEncryptedValue_7685824ad8f0 := FALSE;
  p_IsSoftPrimaryKey_7685824ad8f0 := FALSE;
  p_IsSoftForeignKey_7685824ad8f0 := FALSE;
  p_JSONTypeIsArray_7685824ad8f0 := FALSE;
  p_UserSearchPredicateAPI_7685824ad8f0 := 'Contains';
  p_AutoUpdateUserSearchPredicate_7685824ad8f0 := TRUE;
  p_AutoUpdateFullTextSearch_7685824ad8f0 := TRUE;
  p_AutoUpdateExtendedType_7685824ad8f0 := TRUE;
  p_IsComputed_7685824ad8f0 := FALSE;
  p_ID_7685824ad8f0 := '449D883B-555E-491D-A96A-E3D512CE0818';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM ${mjSchema}."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_7685824ad8f0,
    'Description', p_Description_7685824ad8f0,
    'AutoUpdateDescription', p_AutoUpdateDescription_7685824ad8f0,
    'IsPrimaryKey', p_IsPrimaryKey_7685824ad8f0,
    'IsUnique', p_IsUnique_7685824ad8f0,
    'Category', p_Category_7685824ad8f0,
    'ValueListType', p_ValueListType_7685824ad8f0,
    'ExtendedType', p_ExtendedType_7685824ad8f0,
    'CodeType', p_CodeType_7685824ad8f0,
    'DefaultInView', p_DefaultInView_7685824ad8f0,
    'ViewCellTemplate', p_ViewCellTemplate_7685824ad8f0,
    'DefaultColumnWidth', p_DefaultColumnWidth_7685824ad8f0,
    'AllowUpdateAPI', p_AllowUpdateAPI_7685824ad8f0,
    'AllowUpdateInView', p_AllowUpdateInView_7685824ad8f0,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_7685824ad8f0,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_7685824ad8f0,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_7685824ad8f0,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_7685824ad8f0,
    'GeneratedFormSection', p_GeneratedFormSection_7685824ad8f0,
    'IsNameField', p_IsNameField_7685824ad8f0,
    'RelatedEntityID', p_RelatedEntityID_7685824ad8f0,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_7685824ad8f0,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_7685824ad8f0,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_7685824ad8f0,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_7685824ad8f0,
    'EntityIDFieldName', p_EntityIDFieldName_7685824ad8f0,
    'ScopeDefault', p_ScopeDefault_7685824ad8f0,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_7685824ad8f0,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_7685824ad8f0,
    'Status', p_Status_7685824ad8f0,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_7685824ad8f0,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_7685824ad8f0,
    'AutoUpdateCategory', p_AutoUpdateCategory_7685824ad8f0,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_7685824ad8f0,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_7685824ad8f0,
    'Encrypt', p_Encrypt_7685824ad8f0,
    'EncryptionKeyID', p_EncryptionKeyID_7685824ad8f0,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_7685824ad8f0,
    'SendEncryptedValue', p_SendEncryptedValue_7685824ad8f0,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_7685824ad8f0,
    'IsSoftForeignKey', p_IsSoftForeignKey_7685824ad8f0,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_7685824ad8f0,
    'JSONType', p_JSONType_7685824ad8f0,
    'JSONTypeIsArray', p_JSONTypeIsArray_7685824ad8f0,
    'JSONTypeDefinition', p_JSONTypeDefinition_7685824ad8f0,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_7685824ad8f0,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_7685824ad8f0,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_7685824ad8f0,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_7685824ad8f0,
    'IsComputed', p_IsComputed_7685824ad8f0
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_7685824ad8f0,
    'Configuration', p_Configuration_7685824ad8f0,
    'ID', p_ID_7685824ad8f0
  ));
  ELSE
    PERFORM ${mjSchema}."spUpdateEntityField"(p_DisplayName := p_DisplayName_7685824ad8f0, p_Description := p_Description_7685824ad8f0, p_Description_Clear := TRUE, p_AutoUpdateDescription := p_AutoUpdateDescription_7685824ad8f0, p_IsPrimaryKey := p_IsPrimaryKey_7685824ad8f0, p_IsUnique := p_IsUnique_7685824ad8f0, p_Category := p_Category_7685824ad8f0, p_ValueListType := p_ValueListType_7685824ad8f0, p_ExtendedType := p_ExtendedType_7685824ad8f0, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_7685824ad8f0, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_7685824ad8f0, p_ViewCellTemplate := p_ViewCellTemplate_7685824ad8f0, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_7685824ad8f0, p_AllowUpdateAPI := p_AllowUpdateAPI_7685824ad8f0, p_AllowUpdateInView := p_AllowUpdateInView_7685824ad8f0, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_7685824ad8f0, p_FullTextSearchEnabled := p_FullTextSearchEnabled_7685824ad8f0, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_7685824ad8f0, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_7685824ad8f0, p_GeneratedFormSection := p_GeneratedFormSection_7685824ad8f0, p_IsNameField := p_IsNameField_7685824ad8f0, p_RelatedEntityID := p_RelatedEntityID_7685824ad8f0, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_7685824ad8f0, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_7685824ad8f0, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_7685824ad8f0, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_7685824ad8f0, p_EntityIDFieldName := p_EntityIDFieldName_7685824ad8f0, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_7685824ad8f0, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_7685824ad8f0, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_7685824ad8f0, p_Status := p_Status_7685824ad8f0, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_7685824ad8f0, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_7685824ad8f0, p_AutoUpdateCategory := p_AutoUpdateCategory_7685824ad8f0, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_7685824ad8f0, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_7685824ad8f0, p_Encrypt := p_Encrypt_7685824ad8f0, p_EncryptionKeyID := p_EncryptionKeyID_7685824ad8f0, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_7685824ad8f0, p_SendEncryptedValue := p_SendEncryptedValue_7685824ad8f0, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_7685824ad8f0, p_IsSoftForeignKey := p_IsSoftForeignKey_7685824ad8f0, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_7685824ad8f0, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_7685824ad8f0, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_7685824ad8f0, p_JSONTypeDefinition := p_JSONTypeDefinition_7685824ad8f0, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_7685824ad8f0, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_7685824ad8f0, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_7685824ad8f0, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_7685824ad8f0, p_IsComputed := p_IsComputed_7685824ad8f0, p_EmbeddedRecord := p_EmbeddedRecord_7685824ad8f0, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_7685824ad8f0, p_Configuration_Clear := TRUE, p_ID := p_ID_7685824ad8f0);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_8a40be2daff9 VARCHAR(255);
  p_Description_8a40be2daff9 TEXT;
  p_AutoUpdateDescription_8a40be2daff9 BOOLEAN;
  p_IsPrimaryKey_8a40be2daff9 BOOLEAN;
  p_IsUnique_8a40be2daff9 BOOLEAN;
  p_Category_8a40be2daff9 VARCHAR(255);
  p_ValueListType_8a40be2daff9 VARCHAR(20);
  p_ExtendedType_8a40be2daff9 VARCHAR(50);
  p_CodeType_8a40be2daff9 VARCHAR(50);
  p_DefaultInView_8a40be2daff9 BOOLEAN;
  p_ViewCellTemplate_8a40be2daff9 TEXT;
  p_DefaultColumnWidth_8a40be2daff9 INTEGER;
  p_AllowUpdateAPI_8a40be2daff9 BOOLEAN;
  p_AllowUpdateInView_8a40be2daff9 BOOLEAN;
  p_IncludeInUserSearchAPI_8a40be2daff9 BOOLEAN;
  p_FullTextSearchEnabled_8a40be2daff9 BOOLEAN;
  p_UserSearchParamFormatAPI_8a40be2daff9 VARCHAR(500);
  p_IncludeInGeneratedForm_8a40be2daff9 BOOLEAN;
  p_GeneratedFormSection_8a40be2daff9 VARCHAR(10);
  p_IsNameField_8a40be2daff9 BOOLEAN;
  p_RelatedEntityID_8a40be2daff9 UUID;
  p_RelatedEntityFieldName_8a40be2daff9 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_8a40be2daff9 BOOLEAN;
  p_RelatedEntityNameFieldMap_8a40be2daff9 VARCHAR(255);
  p_RelatedEntityDisplayType_8a40be2daff9 VARCHAR(20);
  p_EntityIDFieldName_8a40be2daff9 VARCHAR(100);
  p_ScopeDefault_8a40be2daff9 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_8a40be2daff9 BOOLEAN;
  p_ValuesToPackWithSchema_8a40be2daff9 VARCHAR(10);
  p_Status_8a40be2daff9 VARCHAR(25);
  p_AutoUpdateIsNameField_8a40be2daff9 BOOLEAN;
  p_AutoUpdateDefaultInView_8a40be2daff9 BOOLEAN;
  p_AutoUpdateCategory_8a40be2daff9 BOOLEAN;
  p_AutoUpdateDisplayName_8a40be2daff9 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_8a40be2daff9 BOOLEAN;
  p_Encrypt_8a40be2daff9 BOOLEAN;
  p_EncryptionKeyID_8a40be2daff9 UUID;
  p_AllowDecryptInAPI_8a40be2daff9 BOOLEAN;
  p_SendEncryptedValue_8a40be2daff9 BOOLEAN;
  p_IsSoftPrimaryKey_8a40be2daff9 BOOLEAN;
  p_IsSoftForeignKey_8a40be2daff9 BOOLEAN;
  p_RelatedEntityJoinFields_8a40be2daff9 TEXT;
  p_JSONType_8a40be2daff9 VARCHAR(255);
  p_JSONTypeIsArray_8a40be2daff9 BOOLEAN;
  p_JSONTypeDefinition_8a40be2daff9 TEXT;
  p_UserSearchPredicateAPI_8a40be2daff9 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_8a40be2daff9 BOOLEAN;
  p_AutoUpdateFullTextSearch_8a40be2daff9 BOOLEAN;
  p_AutoUpdateExtendedType_8a40be2daff9 BOOLEAN;
  p_IsComputed_8a40be2daff9 BOOLEAN;
  p_EmbeddedRecord_8a40be2daff9 TEXT;
  p_Configuration_8a40be2daff9 TEXT;
  p_ID_8a40be2daff9 UUID;
BEGIN
  p_DisplayName_8a40be2daff9 := 'Parent Dimension Value ID Is Leaf';
  p_AutoUpdateDescription_8a40be2daff9 := TRUE;
  p_IsPrimaryKey_8a40be2daff9 := FALSE;
  p_IsUnique_8a40be2daff9 := FALSE;
  p_Category_8a40be2daff9 := 'Hierarchy';
  p_ValueListType_8a40be2daff9 := 'None';
  p_DefaultInView_8a40be2daff9 := FALSE;
  p_DefaultColumnWidth_8a40be2daff9 := 150;
  p_AllowUpdateAPI_8a40be2daff9 := FALSE;
  p_AllowUpdateInView_8a40be2daff9 := TRUE;
  p_IncludeInUserSearchAPI_8a40be2daff9 := FALSE;
  p_FullTextSearchEnabled_8a40be2daff9 := FALSE;
  p_IncludeInGeneratedForm_8a40be2daff9 := TRUE;
  p_GeneratedFormSection_8a40be2daff9 := 'Category';
  p_IsNameField_8a40be2daff9 := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_8a40be2daff9 := FALSE;
  p_RelatedEntityDisplayType_8a40be2daff9 := 'Search';
  p_AutoUpdateRelatedEntityInfo_8a40be2daff9 := TRUE;
  p_ValuesToPackWithSchema_8a40be2daff9 := 'Auto';
  p_Status_8a40be2daff9 := 'Active';
  p_AutoUpdateIsNameField_8a40be2daff9 := TRUE;
  p_AutoUpdateDefaultInView_8a40be2daff9 := TRUE;
  p_AutoUpdateCategory_8a40be2daff9 := TRUE;
  p_AutoUpdateDisplayName_8a40be2daff9 := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_8a40be2daff9 := TRUE;
  p_Encrypt_8a40be2daff9 := FALSE;
  p_AllowDecryptInAPI_8a40be2daff9 := FALSE;
  p_SendEncryptedValue_8a40be2daff9 := FALSE;
  p_IsSoftPrimaryKey_8a40be2daff9 := FALSE;
  p_IsSoftForeignKey_8a40be2daff9 := FALSE;
  p_JSONTypeIsArray_8a40be2daff9 := FALSE;
  p_UserSearchPredicateAPI_8a40be2daff9 := 'Contains';
  p_AutoUpdateUserSearchPredicate_8a40be2daff9 := TRUE;
  p_AutoUpdateFullTextSearch_8a40be2daff9 := TRUE;
  p_AutoUpdateExtendedType_8a40be2daff9 := TRUE;
  p_IsComputed_8a40be2daff9 := FALSE;
  p_ID_8a40be2daff9 := '19557B04-739E-4F62-A7CA-7980F3C41133';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM ${mjSchema}."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_8a40be2daff9,
    'Description', p_Description_8a40be2daff9,
    'AutoUpdateDescription', p_AutoUpdateDescription_8a40be2daff9,
    'IsPrimaryKey', p_IsPrimaryKey_8a40be2daff9,
    'IsUnique', p_IsUnique_8a40be2daff9,
    'Category', p_Category_8a40be2daff9,
    'ValueListType', p_ValueListType_8a40be2daff9,
    'ExtendedType', p_ExtendedType_8a40be2daff9,
    'CodeType', p_CodeType_8a40be2daff9,
    'DefaultInView', p_DefaultInView_8a40be2daff9,
    'ViewCellTemplate', p_ViewCellTemplate_8a40be2daff9,
    'DefaultColumnWidth', p_DefaultColumnWidth_8a40be2daff9,
    'AllowUpdateAPI', p_AllowUpdateAPI_8a40be2daff9,
    'AllowUpdateInView', p_AllowUpdateInView_8a40be2daff9,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_8a40be2daff9,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_8a40be2daff9,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_8a40be2daff9,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_8a40be2daff9,
    'GeneratedFormSection', p_GeneratedFormSection_8a40be2daff9,
    'IsNameField', p_IsNameField_8a40be2daff9,
    'RelatedEntityID', p_RelatedEntityID_8a40be2daff9,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_8a40be2daff9,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_8a40be2daff9,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_8a40be2daff9,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_8a40be2daff9,
    'EntityIDFieldName', p_EntityIDFieldName_8a40be2daff9,
    'ScopeDefault', p_ScopeDefault_8a40be2daff9,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_8a40be2daff9,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_8a40be2daff9,
    'Status', p_Status_8a40be2daff9,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_8a40be2daff9,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_8a40be2daff9,
    'AutoUpdateCategory', p_AutoUpdateCategory_8a40be2daff9,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_8a40be2daff9,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_8a40be2daff9,
    'Encrypt', p_Encrypt_8a40be2daff9,
    'EncryptionKeyID', p_EncryptionKeyID_8a40be2daff9,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_8a40be2daff9,
    'SendEncryptedValue', p_SendEncryptedValue_8a40be2daff9,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_8a40be2daff9,
    'IsSoftForeignKey', p_IsSoftForeignKey_8a40be2daff9,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_8a40be2daff9,
    'JSONType', p_JSONType_8a40be2daff9,
    'JSONTypeIsArray', p_JSONTypeIsArray_8a40be2daff9,
    'JSONTypeDefinition', p_JSONTypeDefinition_8a40be2daff9,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_8a40be2daff9,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_8a40be2daff9,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_8a40be2daff9,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_8a40be2daff9,
    'IsComputed', p_IsComputed_8a40be2daff9
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_8a40be2daff9,
    'Configuration', p_Configuration_8a40be2daff9,
    'ID', p_ID_8a40be2daff9
  ));
  ELSE
    PERFORM ${mjSchema}."spUpdateEntityField"(p_DisplayName := p_DisplayName_8a40be2daff9, p_Description := p_Description_8a40be2daff9, p_Description_Clear := TRUE, p_AutoUpdateDescription := p_AutoUpdateDescription_8a40be2daff9, p_IsPrimaryKey := p_IsPrimaryKey_8a40be2daff9, p_IsUnique := p_IsUnique_8a40be2daff9, p_Category := p_Category_8a40be2daff9, p_ValueListType := p_ValueListType_8a40be2daff9, p_ExtendedType := p_ExtendedType_8a40be2daff9, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_8a40be2daff9, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_8a40be2daff9, p_ViewCellTemplate := p_ViewCellTemplate_8a40be2daff9, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_8a40be2daff9, p_AllowUpdateAPI := p_AllowUpdateAPI_8a40be2daff9, p_AllowUpdateInView := p_AllowUpdateInView_8a40be2daff9, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_8a40be2daff9, p_FullTextSearchEnabled := p_FullTextSearchEnabled_8a40be2daff9, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_8a40be2daff9, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_8a40be2daff9, p_GeneratedFormSection := p_GeneratedFormSection_8a40be2daff9, p_IsNameField := p_IsNameField_8a40be2daff9, p_RelatedEntityID := p_RelatedEntityID_8a40be2daff9, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_8a40be2daff9, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_8a40be2daff9, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_8a40be2daff9, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_8a40be2daff9, p_EntityIDFieldName := p_EntityIDFieldName_8a40be2daff9, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_8a40be2daff9, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_8a40be2daff9, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_8a40be2daff9, p_Status := p_Status_8a40be2daff9, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_8a40be2daff9, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_8a40be2daff9, p_AutoUpdateCategory := p_AutoUpdateCategory_8a40be2daff9, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_8a40be2daff9, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_8a40be2daff9, p_Encrypt := p_Encrypt_8a40be2daff9, p_EncryptionKeyID := p_EncryptionKeyID_8a40be2daff9, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_8a40be2daff9, p_SendEncryptedValue := p_SendEncryptedValue_8a40be2daff9, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_8a40be2daff9, p_IsSoftForeignKey := p_IsSoftForeignKey_8a40be2daff9, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_8a40be2daff9, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_8a40be2daff9, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_8a40be2daff9, p_JSONTypeDefinition := p_JSONTypeDefinition_8a40be2daff9, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_8a40be2daff9, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_8a40be2daff9, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_8a40be2daff9, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_8a40be2daff9, p_IsComputed := p_IsComputed_8a40be2daff9, p_EmbeddedRecord := p_EmbeddedRecord_8a40be2daff9, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_8a40be2daff9, p_Configuration_Clear := TRUE, p_ID := p_ID_8a40be2daff9);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_ee6271d64e86 VARCHAR(255);
  p_Description_ee6271d64e86 TEXT;
  p_AutoUpdateDescription_ee6271d64e86 BOOLEAN;
  p_IsPrimaryKey_ee6271d64e86 BOOLEAN;
  p_IsUnique_ee6271d64e86 BOOLEAN;
  p_Category_ee6271d64e86 VARCHAR(255);
  p_ValueListType_ee6271d64e86 VARCHAR(20);
  p_ExtendedType_ee6271d64e86 VARCHAR(50);
  p_CodeType_ee6271d64e86 VARCHAR(50);
  p_DefaultInView_ee6271d64e86 BOOLEAN;
  p_ViewCellTemplate_ee6271d64e86 TEXT;
  p_DefaultColumnWidth_ee6271d64e86 INTEGER;
  p_AllowUpdateAPI_ee6271d64e86 BOOLEAN;
  p_AllowUpdateInView_ee6271d64e86 BOOLEAN;
  p_IncludeInUserSearchAPI_ee6271d64e86 BOOLEAN;
  p_FullTextSearchEnabled_ee6271d64e86 BOOLEAN;
  p_UserSearchParamFormatAPI_ee6271d64e86 VARCHAR(500);
  p_IncludeInGeneratedForm_ee6271d64e86 BOOLEAN;
  p_GeneratedFormSection_ee6271d64e86 VARCHAR(10);
  p_IsNameField_ee6271d64e86 BOOLEAN;
  p_RelatedEntityID_ee6271d64e86 UUID;
  p_RelatedEntityFieldName_ee6271d64e86 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_ee6271d64e86 BOOLEAN;
  p_RelatedEntityNameFieldMap_ee6271d64e86 VARCHAR(255);
  p_RelatedEntityDisplayType_ee6271d64e86 VARCHAR(20);
  p_EntityIDFieldName_ee6271d64e86 VARCHAR(100);
  p_ScopeDefault_ee6271d64e86 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_ee6271d64e86 BOOLEAN;
  p_ValuesToPackWithSchema_ee6271d64e86 VARCHAR(10);
  p_Status_ee6271d64e86 VARCHAR(25);
  p_AutoUpdateIsNameField_ee6271d64e86 BOOLEAN;
  p_AutoUpdateDefaultInView_ee6271d64e86 BOOLEAN;
  p_AutoUpdateCategory_ee6271d64e86 BOOLEAN;
  p_AutoUpdateDisplayName_ee6271d64e86 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_ee6271d64e86 BOOLEAN;
  p_Encrypt_ee6271d64e86 BOOLEAN;
  p_EncryptionKeyID_ee6271d64e86 UUID;
  p_AllowDecryptInAPI_ee6271d64e86 BOOLEAN;
  p_SendEncryptedValue_ee6271d64e86 BOOLEAN;
  p_IsSoftPrimaryKey_ee6271d64e86 BOOLEAN;
  p_IsSoftForeignKey_ee6271d64e86 BOOLEAN;
  p_RelatedEntityJoinFields_ee6271d64e86 TEXT;
  p_JSONType_ee6271d64e86 VARCHAR(255);
  p_JSONTypeIsArray_ee6271d64e86 BOOLEAN;
  p_JSONTypeDefinition_ee6271d64e86 TEXT;
  p_UserSearchPredicateAPI_ee6271d64e86 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_ee6271d64e86 BOOLEAN;
  p_AutoUpdateFullTextSearch_ee6271d64e86 BOOLEAN;
  p_AutoUpdateExtendedType_ee6271d64e86 BOOLEAN;
  p_IsComputed_ee6271d64e86 BOOLEAN;
  p_EmbeddedRecord_ee6271d64e86 TEXT;
  p_Configuration_ee6271d64e86 TEXT;
  p_ID_ee6271d64e86 UUID;
BEGIN
  p_DisplayName_ee6271d64e86 := 'Parent Dimension Value ID Child Count';
  p_AutoUpdateDescription_ee6271d64e86 := TRUE;
  p_IsPrimaryKey_ee6271d64e86 := FALSE;
  p_IsUnique_ee6271d64e86 := FALSE;
  p_Category_ee6271d64e86 := 'Hierarchy';
  p_ValueListType_ee6271d64e86 := 'None';
  p_DefaultInView_ee6271d64e86 := FALSE;
  p_DefaultColumnWidth_ee6271d64e86 := 50;
  p_AllowUpdateAPI_ee6271d64e86 := FALSE;
  p_AllowUpdateInView_ee6271d64e86 := TRUE;
  p_IncludeInUserSearchAPI_ee6271d64e86 := FALSE;
  p_FullTextSearchEnabled_ee6271d64e86 := FALSE;
  p_IncludeInGeneratedForm_ee6271d64e86 := TRUE;
  p_GeneratedFormSection_ee6271d64e86 := 'Category';
  p_IsNameField_ee6271d64e86 := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_ee6271d64e86 := FALSE;
  p_RelatedEntityDisplayType_ee6271d64e86 := 'Search';
  p_AutoUpdateRelatedEntityInfo_ee6271d64e86 := TRUE;
  p_ValuesToPackWithSchema_ee6271d64e86 := 'Auto';
  p_Status_ee6271d64e86 := 'Active';
  p_AutoUpdateIsNameField_ee6271d64e86 := TRUE;
  p_AutoUpdateDefaultInView_ee6271d64e86 := TRUE;
  p_AutoUpdateCategory_ee6271d64e86 := TRUE;
  p_AutoUpdateDisplayName_ee6271d64e86 := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_ee6271d64e86 := TRUE;
  p_Encrypt_ee6271d64e86 := FALSE;
  p_AllowDecryptInAPI_ee6271d64e86 := FALSE;
  p_SendEncryptedValue_ee6271d64e86 := FALSE;
  p_IsSoftPrimaryKey_ee6271d64e86 := FALSE;
  p_IsSoftForeignKey_ee6271d64e86 := FALSE;
  p_JSONTypeIsArray_ee6271d64e86 := FALSE;
  p_UserSearchPredicateAPI_ee6271d64e86 := 'Contains';
  p_AutoUpdateUserSearchPredicate_ee6271d64e86 := TRUE;
  p_AutoUpdateFullTextSearch_ee6271d64e86 := TRUE;
  p_AutoUpdateExtendedType_ee6271d64e86 := TRUE;
  p_IsComputed_ee6271d64e86 := FALSE;
  p_ID_ee6271d64e86 := '714BD58C-F165-4A08-9666-D70308B4C4D0';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM ${mjSchema}."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_ee6271d64e86,
    'Description', p_Description_ee6271d64e86,
    'AutoUpdateDescription', p_AutoUpdateDescription_ee6271d64e86,
    'IsPrimaryKey', p_IsPrimaryKey_ee6271d64e86,
    'IsUnique', p_IsUnique_ee6271d64e86,
    'Category', p_Category_ee6271d64e86,
    'ValueListType', p_ValueListType_ee6271d64e86,
    'ExtendedType', p_ExtendedType_ee6271d64e86,
    'CodeType', p_CodeType_ee6271d64e86,
    'DefaultInView', p_DefaultInView_ee6271d64e86,
    'ViewCellTemplate', p_ViewCellTemplate_ee6271d64e86,
    'DefaultColumnWidth', p_DefaultColumnWidth_ee6271d64e86,
    'AllowUpdateAPI', p_AllowUpdateAPI_ee6271d64e86,
    'AllowUpdateInView', p_AllowUpdateInView_ee6271d64e86,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_ee6271d64e86,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_ee6271d64e86,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_ee6271d64e86,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_ee6271d64e86,
    'GeneratedFormSection', p_GeneratedFormSection_ee6271d64e86,
    'IsNameField', p_IsNameField_ee6271d64e86,
    'RelatedEntityID', p_RelatedEntityID_ee6271d64e86,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_ee6271d64e86,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_ee6271d64e86,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_ee6271d64e86,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_ee6271d64e86,
    'EntityIDFieldName', p_EntityIDFieldName_ee6271d64e86,
    'ScopeDefault', p_ScopeDefault_ee6271d64e86,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_ee6271d64e86,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_ee6271d64e86,
    'Status', p_Status_ee6271d64e86,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_ee6271d64e86,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_ee6271d64e86,
    'AutoUpdateCategory', p_AutoUpdateCategory_ee6271d64e86,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_ee6271d64e86,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_ee6271d64e86,
    'Encrypt', p_Encrypt_ee6271d64e86,
    'EncryptionKeyID', p_EncryptionKeyID_ee6271d64e86,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_ee6271d64e86,
    'SendEncryptedValue', p_SendEncryptedValue_ee6271d64e86,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_ee6271d64e86,
    'IsSoftForeignKey', p_IsSoftForeignKey_ee6271d64e86,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_ee6271d64e86,
    'JSONType', p_JSONType_ee6271d64e86,
    'JSONTypeIsArray', p_JSONTypeIsArray_ee6271d64e86,
    'JSONTypeDefinition', p_JSONTypeDefinition_ee6271d64e86,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_ee6271d64e86,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_ee6271d64e86,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_ee6271d64e86,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_ee6271d64e86,
    'IsComputed', p_IsComputed_ee6271d64e86
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_ee6271d64e86,
    'Configuration', p_Configuration_ee6271d64e86,
    'ID', p_ID_ee6271d64e86
  ));
  ELSE
    PERFORM ${mjSchema}."spUpdateEntityField"(p_DisplayName := p_DisplayName_ee6271d64e86, p_Description := p_Description_ee6271d64e86, p_Description_Clear := TRUE, p_AutoUpdateDescription := p_AutoUpdateDescription_ee6271d64e86, p_IsPrimaryKey := p_IsPrimaryKey_ee6271d64e86, p_IsUnique := p_IsUnique_ee6271d64e86, p_Category := p_Category_ee6271d64e86, p_ValueListType := p_ValueListType_ee6271d64e86, p_ExtendedType := p_ExtendedType_ee6271d64e86, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_ee6271d64e86, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_ee6271d64e86, p_ViewCellTemplate := p_ViewCellTemplate_ee6271d64e86, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_ee6271d64e86, p_AllowUpdateAPI := p_AllowUpdateAPI_ee6271d64e86, p_AllowUpdateInView := p_AllowUpdateInView_ee6271d64e86, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_ee6271d64e86, p_FullTextSearchEnabled := p_FullTextSearchEnabled_ee6271d64e86, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_ee6271d64e86, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_ee6271d64e86, p_GeneratedFormSection := p_GeneratedFormSection_ee6271d64e86, p_IsNameField := p_IsNameField_ee6271d64e86, p_RelatedEntityID := p_RelatedEntityID_ee6271d64e86, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_ee6271d64e86, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_ee6271d64e86, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_ee6271d64e86, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_ee6271d64e86, p_EntityIDFieldName := p_EntityIDFieldName_ee6271d64e86, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_ee6271d64e86, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_ee6271d64e86, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_ee6271d64e86, p_Status := p_Status_ee6271d64e86, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_ee6271d64e86, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_ee6271d64e86, p_AutoUpdateCategory := p_AutoUpdateCategory_ee6271d64e86, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_ee6271d64e86, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_ee6271d64e86, p_Encrypt := p_Encrypt_ee6271d64e86, p_EncryptionKeyID := p_EncryptionKeyID_ee6271d64e86, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_ee6271d64e86, p_SendEncryptedValue := p_SendEncryptedValue_ee6271d64e86, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_ee6271d64e86, p_IsSoftForeignKey := p_IsSoftForeignKey_ee6271d64e86, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_ee6271d64e86, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_ee6271d64e86, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_ee6271d64e86, p_JSONTypeDefinition := p_JSONTypeDefinition_ee6271d64e86, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_ee6271d64e86, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_ee6271d64e86, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_ee6271d64e86, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_ee6271d64e86, p_IsComputed := p_IsComputed_ee6271d64e86, p_EmbeddedRecord := p_EmbeddedRecord_ee6271d64e86, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_ee6271d64e86, p_Configuration_Clear := TRUE, p_ID := p_ID_ee6271d64e86);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_178dc77ad872 VARCHAR(255);
  p_Description_178dc77ad872 TEXT;
  p_AutoUpdateDescription_178dc77ad872 BOOLEAN;
  p_IsPrimaryKey_178dc77ad872 BOOLEAN;
  p_IsUnique_178dc77ad872 BOOLEAN;
  p_Category_178dc77ad872 VARCHAR(255);
  p_ValueListType_178dc77ad872 VARCHAR(20);
  p_ExtendedType_178dc77ad872 VARCHAR(50);
  p_CodeType_178dc77ad872 VARCHAR(50);
  p_DefaultInView_178dc77ad872 BOOLEAN;
  p_ViewCellTemplate_178dc77ad872 TEXT;
  p_DefaultColumnWidth_178dc77ad872 INTEGER;
  p_AllowUpdateAPI_178dc77ad872 BOOLEAN;
  p_AllowUpdateInView_178dc77ad872 BOOLEAN;
  p_IncludeInUserSearchAPI_178dc77ad872 BOOLEAN;
  p_FullTextSearchEnabled_178dc77ad872 BOOLEAN;
  p_UserSearchParamFormatAPI_178dc77ad872 VARCHAR(500);
  p_IncludeInGeneratedForm_178dc77ad872 BOOLEAN;
  p_GeneratedFormSection_178dc77ad872 VARCHAR(10);
  p_IsNameField_178dc77ad872 BOOLEAN;
  p_RelatedEntityID_178dc77ad872 UUID;
  p_RelatedEntityFieldName_178dc77ad872 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_178dc77ad872 BOOLEAN;
  p_RelatedEntityNameFieldMap_178dc77ad872 VARCHAR(255);
  p_RelatedEntityDisplayType_178dc77ad872 VARCHAR(20);
  p_EntityIDFieldName_178dc77ad872 VARCHAR(100);
  p_ScopeDefault_178dc77ad872 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_178dc77ad872 BOOLEAN;
  p_ValuesToPackWithSchema_178dc77ad872 VARCHAR(10);
  p_Status_178dc77ad872 VARCHAR(25);
  p_AutoUpdateIsNameField_178dc77ad872 BOOLEAN;
  p_AutoUpdateDefaultInView_178dc77ad872 BOOLEAN;
  p_AutoUpdateCategory_178dc77ad872 BOOLEAN;
  p_AutoUpdateDisplayName_178dc77ad872 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_178dc77ad872 BOOLEAN;
  p_Encrypt_178dc77ad872 BOOLEAN;
  p_EncryptionKeyID_178dc77ad872 UUID;
  p_AllowDecryptInAPI_178dc77ad872 BOOLEAN;
  p_SendEncryptedValue_178dc77ad872 BOOLEAN;
  p_IsSoftPrimaryKey_178dc77ad872 BOOLEAN;
  p_IsSoftForeignKey_178dc77ad872 BOOLEAN;
  p_RelatedEntityJoinFields_178dc77ad872 TEXT;
  p_JSONType_178dc77ad872 VARCHAR(255);
  p_JSONTypeIsArray_178dc77ad872 BOOLEAN;
  p_JSONTypeDefinition_178dc77ad872 TEXT;
  p_UserSearchPredicateAPI_178dc77ad872 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_178dc77ad872 BOOLEAN;
  p_AutoUpdateFullTextSearch_178dc77ad872 BOOLEAN;
  p_AutoUpdateExtendedType_178dc77ad872 BOOLEAN;
  p_IsComputed_178dc77ad872 BOOLEAN;
  p_EmbeddedRecord_178dc77ad872 TEXT;
  p_Configuration_178dc77ad872 TEXT;
  p_ID_178dc77ad872 UUID;
BEGIN
  p_DisplayName_178dc77ad872 := 'Finance Exception Type ID';
  p_Description_178dc77ad872 := 'The kind of exception.';
  p_AutoUpdateDescription_178dc77ad872 := TRUE;
  p_IsPrimaryKey_178dc77ad872 := FALSE;
  p_IsUnique_178dc77ad872 := TRUE;
  p_Category_178dc77ad872 := 'Exception Details';
  p_ValueListType_178dc77ad872 := 'None';
  p_DefaultInView_178dc77ad872 := FALSE;
  p_DefaultColumnWidth_178dc77ad872 := 150;
  p_AllowUpdateAPI_178dc77ad872 := TRUE;
  p_AllowUpdateInView_178dc77ad872 := TRUE;
  p_IncludeInUserSearchAPI_178dc77ad872 := FALSE;
  p_FullTextSearchEnabled_178dc77ad872 := FALSE;
  p_IncludeInGeneratedForm_178dc77ad872 := TRUE;
  p_GeneratedFormSection_178dc77ad872 := 'Category';
  p_IsNameField_178dc77ad872 := FALSE;
  p_RelatedEntityID_178dc77ad872 := '57FD0C9B-C308-41A4-988A-E4C378A9803D';
  p_RelatedEntityFieldName_178dc77ad872 := 'ID';
  p_IncludeRelatedEntityNameFieldInBaseView_178dc77ad872 := TRUE;
  p_RelatedEntityNameFieldMap_178dc77ad872 := 'FinanceExceptionType';
  p_RelatedEntityDisplayType_178dc77ad872 := 'Search';
  p_AutoUpdateRelatedEntityInfo_178dc77ad872 := TRUE;
  p_ValuesToPackWithSchema_178dc77ad872 := 'Auto';
  p_Status_178dc77ad872 := 'Active';
  p_AutoUpdateIsNameField_178dc77ad872 := TRUE;
  p_AutoUpdateDefaultInView_178dc77ad872 := TRUE;
  p_AutoUpdateCategory_178dc77ad872 := TRUE;
  p_AutoUpdateDisplayName_178dc77ad872 := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_178dc77ad872 := TRUE;
  p_Encrypt_178dc77ad872 := FALSE;
  p_AllowDecryptInAPI_178dc77ad872 := FALSE;
  p_SendEncryptedValue_178dc77ad872 := FALSE;
  p_IsSoftPrimaryKey_178dc77ad872 := FALSE;
  p_IsSoftForeignKey_178dc77ad872 := FALSE;
  p_JSONTypeIsArray_178dc77ad872 := FALSE;
  p_UserSearchPredicateAPI_178dc77ad872 := 'Contains';
  p_AutoUpdateUserSearchPredicate_178dc77ad872 := TRUE;
  p_AutoUpdateFullTextSearch_178dc77ad872 := TRUE;
  p_AutoUpdateExtendedType_178dc77ad872 := TRUE;
  p_IsComputed_178dc77ad872 := FALSE;
  p_ID_178dc77ad872 := 'F9B999EB-B563-44BE-9A7D-742757703470';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM ${mjSchema}."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_178dc77ad872,
    'Description', p_Description_178dc77ad872,
    'AutoUpdateDescription', p_AutoUpdateDescription_178dc77ad872,
    'IsPrimaryKey', p_IsPrimaryKey_178dc77ad872,
    'IsUnique', p_IsUnique_178dc77ad872,
    'Category', p_Category_178dc77ad872,
    'ValueListType', p_ValueListType_178dc77ad872,
    'ExtendedType', p_ExtendedType_178dc77ad872,
    'CodeType', p_CodeType_178dc77ad872,
    'DefaultInView', p_DefaultInView_178dc77ad872,
    'ViewCellTemplate', p_ViewCellTemplate_178dc77ad872,
    'DefaultColumnWidth', p_DefaultColumnWidth_178dc77ad872,
    'AllowUpdateAPI', p_AllowUpdateAPI_178dc77ad872,
    'AllowUpdateInView', p_AllowUpdateInView_178dc77ad872,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_178dc77ad872,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_178dc77ad872,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_178dc77ad872,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_178dc77ad872,
    'GeneratedFormSection', p_GeneratedFormSection_178dc77ad872,
    'IsNameField', p_IsNameField_178dc77ad872,
    'RelatedEntityID', p_RelatedEntityID_178dc77ad872,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_178dc77ad872,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_178dc77ad872,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_178dc77ad872,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_178dc77ad872,
    'EntityIDFieldName', p_EntityIDFieldName_178dc77ad872,
    'ScopeDefault', p_ScopeDefault_178dc77ad872,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_178dc77ad872,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_178dc77ad872,
    'Status', p_Status_178dc77ad872,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_178dc77ad872,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_178dc77ad872,
    'AutoUpdateCategory', p_AutoUpdateCategory_178dc77ad872,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_178dc77ad872,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_178dc77ad872,
    'Encrypt', p_Encrypt_178dc77ad872,
    'EncryptionKeyID', p_EncryptionKeyID_178dc77ad872,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_178dc77ad872,
    'SendEncryptedValue', p_SendEncryptedValue_178dc77ad872,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_178dc77ad872,
    'IsSoftForeignKey', p_IsSoftForeignKey_178dc77ad872,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_178dc77ad872,
    'JSONType', p_JSONType_178dc77ad872,
    'JSONTypeIsArray', p_JSONTypeIsArray_178dc77ad872,
    'JSONTypeDefinition', p_JSONTypeDefinition_178dc77ad872,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_178dc77ad872,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_178dc77ad872,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_178dc77ad872,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_178dc77ad872,
    'IsComputed', p_IsComputed_178dc77ad872
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_178dc77ad872,
    'Configuration', p_Configuration_178dc77ad872,
    'ID', p_ID_178dc77ad872
  ));
  ELSE
    PERFORM ${mjSchema}."spUpdateEntityField"(p_DisplayName := p_DisplayName_178dc77ad872, p_Description := p_Description_178dc77ad872, p_AutoUpdateDescription := p_AutoUpdateDescription_178dc77ad872, p_IsPrimaryKey := p_IsPrimaryKey_178dc77ad872, p_IsUnique := p_IsUnique_178dc77ad872, p_Category := p_Category_178dc77ad872, p_ValueListType := p_ValueListType_178dc77ad872, p_ExtendedType := p_ExtendedType_178dc77ad872, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_178dc77ad872, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_178dc77ad872, p_ViewCellTemplate := p_ViewCellTemplate_178dc77ad872, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_178dc77ad872, p_AllowUpdateAPI := p_AllowUpdateAPI_178dc77ad872, p_AllowUpdateInView := p_AllowUpdateInView_178dc77ad872, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_178dc77ad872, p_FullTextSearchEnabled := p_FullTextSearchEnabled_178dc77ad872, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_178dc77ad872, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_178dc77ad872, p_GeneratedFormSection := p_GeneratedFormSection_178dc77ad872, p_IsNameField := p_IsNameField_178dc77ad872, p_RelatedEntityID := p_RelatedEntityID_178dc77ad872, p_RelatedEntityFieldName := p_RelatedEntityFieldName_178dc77ad872, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_178dc77ad872, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_178dc77ad872, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_178dc77ad872, p_EntityIDFieldName := p_EntityIDFieldName_178dc77ad872, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_178dc77ad872, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_178dc77ad872, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_178dc77ad872, p_Status := p_Status_178dc77ad872, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_178dc77ad872, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_178dc77ad872, p_AutoUpdateCategory := p_AutoUpdateCategory_178dc77ad872, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_178dc77ad872, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_178dc77ad872, p_Encrypt := p_Encrypt_178dc77ad872, p_EncryptionKeyID := p_EncryptionKeyID_178dc77ad872, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_178dc77ad872, p_SendEncryptedValue := p_SendEncryptedValue_178dc77ad872, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_178dc77ad872, p_IsSoftForeignKey := p_IsSoftForeignKey_178dc77ad872, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_178dc77ad872, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_178dc77ad872, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_178dc77ad872, p_JSONTypeDefinition := p_JSONTypeDefinition_178dc77ad872, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_178dc77ad872, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_178dc77ad872, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_178dc77ad872, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_178dc77ad872, p_IsComputed := p_IsComputed_178dc77ad872, p_EmbeddedRecord := p_EmbeddedRecord_178dc77ad872, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_178dc77ad872, p_Configuration_Clear := TRUE, p_ID := p_ID_178dc77ad872);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_5ee700ebdb98 VARCHAR(255);
  p_Description_5ee700ebdb98 TEXT;
  p_AutoUpdateDescription_5ee700ebdb98 BOOLEAN;
  p_IsPrimaryKey_5ee700ebdb98 BOOLEAN;
  p_IsUnique_5ee700ebdb98 BOOLEAN;
  p_Category_5ee700ebdb98 VARCHAR(255);
  p_ValueListType_5ee700ebdb98 VARCHAR(20);
  p_ExtendedType_5ee700ebdb98 VARCHAR(50);
  p_CodeType_5ee700ebdb98 VARCHAR(50);
  p_DefaultInView_5ee700ebdb98 BOOLEAN;
  p_ViewCellTemplate_5ee700ebdb98 TEXT;
  p_DefaultColumnWidth_5ee700ebdb98 INTEGER;
  p_AllowUpdateAPI_5ee700ebdb98 BOOLEAN;
  p_AllowUpdateInView_5ee700ebdb98 BOOLEAN;
  p_IncludeInUserSearchAPI_5ee700ebdb98 BOOLEAN;
  p_FullTextSearchEnabled_5ee700ebdb98 BOOLEAN;
  p_UserSearchParamFormatAPI_5ee700ebdb98 VARCHAR(500);
  p_IncludeInGeneratedForm_5ee700ebdb98 BOOLEAN;
  p_GeneratedFormSection_5ee700ebdb98 VARCHAR(10);
  p_IsNameField_5ee700ebdb98 BOOLEAN;
  p_RelatedEntityID_5ee700ebdb98 UUID;
  p_RelatedEntityFieldName_5ee700ebdb98 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_5ee700ebdb98 BOOLEAN;
  p_RelatedEntityNameFieldMap_5ee700ebdb98 VARCHAR(255);
  p_RelatedEntityDisplayType_5ee700ebdb98 VARCHAR(20);
  p_EntityIDFieldName_5ee700ebdb98 VARCHAR(100);
  p_ScopeDefault_5ee700ebdb98 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_5ee700ebdb98 BOOLEAN;
  p_ValuesToPackWithSchema_5ee700ebdb98 VARCHAR(10);
  p_Status_5ee700ebdb98 VARCHAR(25);
  p_AutoUpdateIsNameField_5ee700ebdb98 BOOLEAN;
  p_AutoUpdateDefaultInView_5ee700ebdb98 BOOLEAN;
  p_AutoUpdateCategory_5ee700ebdb98 BOOLEAN;
  p_AutoUpdateDisplayName_5ee700ebdb98 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_5ee700ebdb98 BOOLEAN;
  p_Encrypt_5ee700ebdb98 BOOLEAN;
  p_EncryptionKeyID_5ee700ebdb98 UUID;
  p_AllowDecryptInAPI_5ee700ebdb98 BOOLEAN;
  p_SendEncryptedValue_5ee700ebdb98 BOOLEAN;
  p_IsSoftPrimaryKey_5ee700ebdb98 BOOLEAN;
  p_IsSoftForeignKey_5ee700ebdb98 BOOLEAN;
  p_RelatedEntityJoinFields_5ee700ebdb98 TEXT;
  p_JSONType_5ee700ebdb98 VARCHAR(255);
  p_JSONTypeIsArray_5ee700ebdb98 BOOLEAN;
  p_JSONTypeDefinition_5ee700ebdb98 TEXT;
  p_UserSearchPredicateAPI_5ee700ebdb98 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_5ee700ebdb98 BOOLEAN;
  p_AutoUpdateFullTextSearch_5ee700ebdb98 BOOLEAN;
  p_AutoUpdateExtendedType_5ee700ebdb98 BOOLEAN;
  p_IsComputed_5ee700ebdb98 BOOLEAN;
  p_EmbeddedRecord_5ee700ebdb98 TEXT;
  p_Configuration_5ee700ebdb98 TEXT;
  p_ID_5ee700ebdb98 UUID;
BEGIN
  p_DisplayName_5ee700ebdb98 := 'Company ID';
  p_Description_5ee700ebdb98 := 'The company whose books the exception affects. Ready-to-close is judged per company and month.';
  p_AutoUpdateDescription_5ee700ebdb98 := TRUE;
  p_IsPrimaryKey_5ee700ebdb98 := FALSE;
  p_IsUnique_5ee700ebdb98 := FALSE;
  p_Category_5ee700ebdb98 := 'Exception Details';
  p_ValueListType_5ee700ebdb98 := 'None';
  p_DefaultInView_5ee700ebdb98 := FALSE;
  p_DefaultColumnWidth_5ee700ebdb98 := 150;
  p_AllowUpdateAPI_5ee700ebdb98 := TRUE;
  p_AllowUpdateInView_5ee700ebdb98 := TRUE;
  p_IncludeInUserSearchAPI_5ee700ebdb98 := FALSE;
  p_FullTextSearchEnabled_5ee700ebdb98 := FALSE;
  p_IncludeInGeneratedForm_5ee700ebdb98 := TRUE;
  p_GeneratedFormSection_5ee700ebdb98 := 'Category';
  p_IsNameField_5ee700ebdb98 := FALSE;
  p_RelatedEntityID_5ee700ebdb98 := 'D4238F34-2837-EF11-86D4-6045BDEE16E6';
  p_RelatedEntityFieldName_5ee700ebdb98 := 'ID';
  p_IncludeRelatedEntityNameFieldInBaseView_5ee700ebdb98 := TRUE;
  p_RelatedEntityNameFieldMap_5ee700ebdb98 := 'Company';
  p_RelatedEntityDisplayType_5ee700ebdb98 := 'Search';
  p_AutoUpdateRelatedEntityInfo_5ee700ebdb98 := TRUE;
  p_ValuesToPackWithSchema_5ee700ebdb98 := 'Auto';
  p_Status_5ee700ebdb98 := 'Active';
  p_AutoUpdateIsNameField_5ee700ebdb98 := TRUE;
  p_AutoUpdateDefaultInView_5ee700ebdb98 := TRUE;
  p_AutoUpdateCategory_5ee700ebdb98 := TRUE;
  p_AutoUpdateDisplayName_5ee700ebdb98 := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_5ee700ebdb98 := TRUE;
  p_Encrypt_5ee700ebdb98 := FALSE;
  p_AllowDecryptInAPI_5ee700ebdb98 := FALSE;
  p_SendEncryptedValue_5ee700ebdb98 := FALSE;
  p_IsSoftPrimaryKey_5ee700ebdb98 := FALSE;
  p_IsSoftForeignKey_5ee700ebdb98 := FALSE;
  p_JSONTypeIsArray_5ee700ebdb98 := FALSE;
  p_UserSearchPredicateAPI_5ee700ebdb98 := 'Contains';
  p_AutoUpdateUserSearchPredicate_5ee700ebdb98 := TRUE;
  p_AutoUpdateFullTextSearch_5ee700ebdb98 := TRUE;
  p_AutoUpdateExtendedType_5ee700ebdb98 := TRUE;
  p_IsComputed_5ee700ebdb98 := FALSE;
  p_ID_5ee700ebdb98 := 'EFF056DC-206C-4763-87B9-998095B62412';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM ${mjSchema}."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_5ee700ebdb98,
    'Description', p_Description_5ee700ebdb98,
    'AutoUpdateDescription', p_AutoUpdateDescription_5ee700ebdb98,
    'IsPrimaryKey', p_IsPrimaryKey_5ee700ebdb98,
    'IsUnique', p_IsUnique_5ee700ebdb98,
    'Category', p_Category_5ee700ebdb98,
    'ValueListType', p_ValueListType_5ee700ebdb98,
    'ExtendedType', p_ExtendedType_5ee700ebdb98,
    'CodeType', p_CodeType_5ee700ebdb98,
    'DefaultInView', p_DefaultInView_5ee700ebdb98,
    'ViewCellTemplate', p_ViewCellTemplate_5ee700ebdb98,
    'DefaultColumnWidth', p_DefaultColumnWidth_5ee700ebdb98,
    'AllowUpdateAPI', p_AllowUpdateAPI_5ee700ebdb98,
    'AllowUpdateInView', p_AllowUpdateInView_5ee700ebdb98,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_5ee700ebdb98,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_5ee700ebdb98,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_5ee700ebdb98,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_5ee700ebdb98,
    'GeneratedFormSection', p_GeneratedFormSection_5ee700ebdb98,
    'IsNameField', p_IsNameField_5ee700ebdb98,
    'RelatedEntityID', p_RelatedEntityID_5ee700ebdb98,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_5ee700ebdb98,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_5ee700ebdb98,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_5ee700ebdb98,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_5ee700ebdb98,
    'EntityIDFieldName', p_EntityIDFieldName_5ee700ebdb98,
    'ScopeDefault', p_ScopeDefault_5ee700ebdb98,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_5ee700ebdb98,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_5ee700ebdb98,
    'Status', p_Status_5ee700ebdb98,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_5ee700ebdb98,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_5ee700ebdb98,
    'AutoUpdateCategory', p_AutoUpdateCategory_5ee700ebdb98,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_5ee700ebdb98,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_5ee700ebdb98,
    'Encrypt', p_Encrypt_5ee700ebdb98,
    'EncryptionKeyID', p_EncryptionKeyID_5ee700ebdb98,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_5ee700ebdb98,
    'SendEncryptedValue', p_SendEncryptedValue_5ee700ebdb98,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_5ee700ebdb98,
    'IsSoftForeignKey', p_IsSoftForeignKey_5ee700ebdb98,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_5ee700ebdb98,
    'JSONType', p_JSONType_5ee700ebdb98,
    'JSONTypeIsArray', p_JSONTypeIsArray_5ee700ebdb98,
    'JSONTypeDefinition', p_JSONTypeDefinition_5ee700ebdb98,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_5ee700ebdb98,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_5ee700ebdb98,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_5ee700ebdb98,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_5ee700ebdb98,
    'IsComputed', p_IsComputed_5ee700ebdb98
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_5ee700ebdb98,
    'Configuration', p_Configuration_5ee700ebdb98,
    'ID', p_ID_5ee700ebdb98
  ));
  ELSE
    PERFORM ${mjSchema}."spUpdateEntityField"(p_DisplayName := p_DisplayName_5ee700ebdb98, p_Description := p_Description_5ee700ebdb98, p_AutoUpdateDescription := p_AutoUpdateDescription_5ee700ebdb98, p_IsPrimaryKey := p_IsPrimaryKey_5ee700ebdb98, p_IsUnique := p_IsUnique_5ee700ebdb98, p_Category := p_Category_5ee700ebdb98, p_ValueListType := p_ValueListType_5ee700ebdb98, p_ExtendedType := p_ExtendedType_5ee700ebdb98, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_5ee700ebdb98, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_5ee700ebdb98, p_ViewCellTemplate := p_ViewCellTemplate_5ee700ebdb98, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_5ee700ebdb98, p_AllowUpdateAPI := p_AllowUpdateAPI_5ee700ebdb98, p_AllowUpdateInView := p_AllowUpdateInView_5ee700ebdb98, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_5ee700ebdb98, p_FullTextSearchEnabled := p_FullTextSearchEnabled_5ee700ebdb98, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_5ee700ebdb98, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_5ee700ebdb98, p_GeneratedFormSection := p_GeneratedFormSection_5ee700ebdb98, p_IsNameField := p_IsNameField_5ee700ebdb98, p_RelatedEntityID := p_RelatedEntityID_5ee700ebdb98, p_RelatedEntityFieldName := p_RelatedEntityFieldName_5ee700ebdb98, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_5ee700ebdb98, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_5ee700ebdb98, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_5ee700ebdb98, p_EntityIDFieldName := p_EntityIDFieldName_5ee700ebdb98, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_5ee700ebdb98, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_5ee700ebdb98, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_5ee700ebdb98, p_Status := p_Status_5ee700ebdb98, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_5ee700ebdb98, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_5ee700ebdb98, p_AutoUpdateCategory := p_AutoUpdateCategory_5ee700ebdb98, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_5ee700ebdb98, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_5ee700ebdb98, p_Encrypt := p_Encrypt_5ee700ebdb98, p_EncryptionKeyID := p_EncryptionKeyID_5ee700ebdb98, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_5ee700ebdb98, p_SendEncryptedValue := p_SendEncryptedValue_5ee700ebdb98, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_5ee700ebdb98, p_IsSoftForeignKey := p_IsSoftForeignKey_5ee700ebdb98, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_5ee700ebdb98, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_5ee700ebdb98, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_5ee700ebdb98, p_JSONTypeDefinition := p_JSONTypeDefinition_5ee700ebdb98, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_5ee700ebdb98, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_5ee700ebdb98, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_5ee700ebdb98, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_5ee700ebdb98, p_IsComputed := p_IsComputed_5ee700ebdb98, p_EmbeddedRecord := p_EmbeddedRecord_5ee700ebdb98, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_5ee700ebdb98, p_Configuration_Clear := TRUE, p_ID := p_ID_5ee700ebdb98);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_8c5d15b60744 VARCHAR(255);
  p_Description_8c5d15b60744 TEXT;
  p_AutoUpdateDescription_8c5d15b60744 BOOLEAN;
  p_IsPrimaryKey_8c5d15b60744 BOOLEAN;
  p_IsUnique_8c5d15b60744 BOOLEAN;
  p_Category_8c5d15b60744 VARCHAR(255);
  p_ValueListType_8c5d15b60744 VARCHAR(20);
  p_ExtendedType_8c5d15b60744 VARCHAR(50);
  p_CodeType_8c5d15b60744 VARCHAR(50);
  p_DefaultInView_8c5d15b60744 BOOLEAN;
  p_ViewCellTemplate_8c5d15b60744 TEXT;
  p_DefaultColumnWidth_8c5d15b60744 INTEGER;
  p_AllowUpdateAPI_8c5d15b60744 BOOLEAN;
  p_AllowUpdateInView_8c5d15b60744 BOOLEAN;
  p_IncludeInUserSearchAPI_8c5d15b60744 BOOLEAN;
  p_FullTextSearchEnabled_8c5d15b60744 BOOLEAN;
  p_UserSearchParamFormatAPI_8c5d15b60744 VARCHAR(500);
  p_IncludeInGeneratedForm_8c5d15b60744 BOOLEAN;
  p_GeneratedFormSection_8c5d15b60744 VARCHAR(10);
  p_IsNameField_8c5d15b60744 BOOLEAN;
  p_RelatedEntityID_8c5d15b60744 UUID;
  p_RelatedEntityFieldName_8c5d15b60744 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_8c5d15b60744 BOOLEAN;
  p_RelatedEntityNameFieldMap_8c5d15b60744 VARCHAR(255);
  p_RelatedEntityDisplayType_8c5d15b60744 VARCHAR(20);
  p_EntityIDFieldName_8c5d15b60744 VARCHAR(100);
  p_ScopeDefault_8c5d15b60744 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_8c5d15b60744 BOOLEAN;
  p_ValuesToPackWithSchema_8c5d15b60744 VARCHAR(10);
  p_Status_8c5d15b60744 VARCHAR(25);
  p_AutoUpdateIsNameField_8c5d15b60744 BOOLEAN;
  p_AutoUpdateDefaultInView_8c5d15b60744 BOOLEAN;
  p_AutoUpdateCategory_8c5d15b60744 BOOLEAN;
  p_AutoUpdateDisplayName_8c5d15b60744 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_8c5d15b60744 BOOLEAN;
  p_Encrypt_8c5d15b60744 BOOLEAN;
  p_EncryptionKeyID_8c5d15b60744 UUID;
  p_AllowDecryptInAPI_8c5d15b60744 BOOLEAN;
  p_SendEncryptedValue_8c5d15b60744 BOOLEAN;
  p_IsSoftPrimaryKey_8c5d15b60744 BOOLEAN;
  p_IsSoftForeignKey_8c5d15b60744 BOOLEAN;
  p_RelatedEntityJoinFields_8c5d15b60744 TEXT;
  p_JSONType_8c5d15b60744 VARCHAR(255);
  p_JSONTypeIsArray_8c5d15b60744 BOOLEAN;
  p_JSONTypeDefinition_8c5d15b60744 TEXT;
  p_UserSearchPredicateAPI_8c5d15b60744 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_8c5d15b60744 BOOLEAN;
  p_AutoUpdateFullTextSearch_8c5d15b60744 BOOLEAN;
  p_AutoUpdateExtendedType_8c5d15b60744 BOOLEAN;
  p_IsComputed_8c5d15b60744 BOOLEAN;
  p_EmbeddedRecord_8c5d15b60744 TEXT;
  p_Configuration_8c5d15b60744 TEXT;
  p_ID_8c5d15b60744 UUID;
BEGIN
  p_DisplayName_8c5d15b60744 := 'Amount';
  p_Description_8c5d15b60744 := 'The amount at stake, in the source record''s currency. NULL when the detector cannot state one.';
  p_AutoUpdateDescription_8c5d15b60744 := TRUE;
  p_IsPrimaryKey_8c5d15b60744 := FALSE;
  p_IsUnique_8c5d15b60744 := FALSE;
  p_Category_8c5d15b60744 := 'Exception Details';
  p_ValueListType_8c5d15b60744 := 'None';
  p_DefaultInView_8c5d15b60744 := FALSE;
  p_DefaultColumnWidth_8c5d15b60744 := 150;
  p_AllowUpdateAPI_8c5d15b60744 := TRUE;
  p_AllowUpdateInView_8c5d15b60744 := TRUE;
  p_IncludeInUserSearchAPI_8c5d15b60744 := FALSE;
  p_FullTextSearchEnabled_8c5d15b60744 := FALSE;
  p_IncludeInGeneratedForm_8c5d15b60744 := TRUE;
  p_GeneratedFormSection_8c5d15b60744 := 'Category';
  p_IsNameField_8c5d15b60744 := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_8c5d15b60744 := FALSE;
  p_RelatedEntityDisplayType_8c5d15b60744 := 'Search';
  p_AutoUpdateRelatedEntityInfo_8c5d15b60744 := TRUE;
  p_ValuesToPackWithSchema_8c5d15b60744 := 'Auto';
  p_Status_8c5d15b60744 := 'Active';
  p_AutoUpdateIsNameField_8c5d15b60744 := TRUE;
  p_AutoUpdateDefaultInView_8c5d15b60744 := TRUE;
  p_AutoUpdateCategory_8c5d15b60744 := TRUE;
  p_AutoUpdateDisplayName_8c5d15b60744 := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_8c5d15b60744 := TRUE;
  p_Encrypt_8c5d15b60744 := FALSE;
  p_AllowDecryptInAPI_8c5d15b60744 := FALSE;
  p_SendEncryptedValue_8c5d15b60744 := FALSE;
  p_IsSoftPrimaryKey_8c5d15b60744 := FALSE;
  p_IsSoftForeignKey_8c5d15b60744 := FALSE;
  p_JSONTypeIsArray_8c5d15b60744 := FALSE;
  p_UserSearchPredicateAPI_8c5d15b60744 := 'Contains';
  p_AutoUpdateUserSearchPredicate_8c5d15b60744 := TRUE;
  p_AutoUpdateFullTextSearch_8c5d15b60744 := TRUE;
  p_AutoUpdateExtendedType_8c5d15b60744 := TRUE;
  p_IsComputed_8c5d15b60744 := FALSE;
  p_ID_8c5d15b60744 := '030C4ABD-B3FA-4DF7-8DA5-B3A58CBDF030';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM ${mjSchema}."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_8c5d15b60744,
    'Description', p_Description_8c5d15b60744,
    'AutoUpdateDescription', p_AutoUpdateDescription_8c5d15b60744,
    'IsPrimaryKey', p_IsPrimaryKey_8c5d15b60744,
    'IsUnique', p_IsUnique_8c5d15b60744,
    'Category', p_Category_8c5d15b60744,
    'ValueListType', p_ValueListType_8c5d15b60744,
    'ExtendedType', p_ExtendedType_8c5d15b60744,
    'CodeType', p_CodeType_8c5d15b60744,
    'DefaultInView', p_DefaultInView_8c5d15b60744,
    'ViewCellTemplate', p_ViewCellTemplate_8c5d15b60744,
    'DefaultColumnWidth', p_DefaultColumnWidth_8c5d15b60744,
    'AllowUpdateAPI', p_AllowUpdateAPI_8c5d15b60744,
    'AllowUpdateInView', p_AllowUpdateInView_8c5d15b60744,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_8c5d15b60744,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_8c5d15b60744,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_8c5d15b60744,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_8c5d15b60744,
    'GeneratedFormSection', p_GeneratedFormSection_8c5d15b60744,
    'IsNameField', p_IsNameField_8c5d15b60744,
    'RelatedEntityID', p_RelatedEntityID_8c5d15b60744,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_8c5d15b60744,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_8c5d15b60744,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_8c5d15b60744,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_8c5d15b60744,
    'EntityIDFieldName', p_EntityIDFieldName_8c5d15b60744,
    'ScopeDefault', p_ScopeDefault_8c5d15b60744,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_8c5d15b60744,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_8c5d15b60744,
    'Status', p_Status_8c5d15b60744,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_8c5d15b60744,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_8c5d15b60744,
    'AutoUpdateCategory', p_AutoUpdateCategory_8c5d15b60744,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_8c5d15b60744,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_8c5d15b60744,
    'Encrypt', p_Encrypt_8c5d15b60744,
    'EncryptionKeyID', p_EncryptionKeyID_8c5d15b60744,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_8c5d15b60744,
    'SendEncryptedValue', p_SendEncryptedValue_8c5d15b60744,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_8c5d15b60744,
    'IsSoftForeignKey', p_IsSoftForeignKey_8c5d15b60744,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_8c5d15b60744,
    'JSONType', p_JSONType_8c5d15b60744,
    'JSONTypeIsArray', p_JSONTypeIsArray_8c5d15b60744,
    'JSONTypeDefinition', p_JSONTypeDefinition_8c5d15b60744,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_8c5d15b60744,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_8c5d15b60744,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_8c5d15b60744,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_8c5d15b60744,
    'IsComputed', p_IsComputed_8c5d15b60744
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_8c5d15b60744,
    'Configuration', p_Configuration_8c5d15b60744,
    'ID', p_ID_8c5d15b60744
  ));
  ELSE
    PERFORM ${mjSchema}."spUpdateEntityField"(p_DisplayName := p_DisplayName_8c5d15b60744, p_Description := p_Description_8c5d15b60744, p_AutoUpdateDescription := p_AutoUpdateDescription_8c5d15b60744, p_IsPrimaryKey := p_IsPrimaryKey_8c5d15b60744, p_IsUnique := p_IsUnique_8c5d15b60744, p_Category := p_Category_8c5d15b60744, p_ValueListType := p_ValueListType_8c5d15b60744, p_ExtendedType := p_ExtendedType_8c5d15b60744, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_8c5d15b60744, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_8c5d15b60744, p_ViewCellTemplate := p_ViewCellTemplate_8c5d15b60744, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_8c5d15b60744, p_AllowUpdateAPI := p_AllowUpdateAPI_8c5d15b60744, p_AllowUpdateInView := p_AllowUpdateInView_8c5d15b60744, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_8c5d15b60744, p_FullTextSearchEnabled := p_FullTextSearchEnabled_8c5d15b60744, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_8c5d15b60744, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_8c5d15b60744, p_GeneratedFormSection := p_GeneratedFormSection_8c5d15b60744, p_IsNameField := p_IsNameField_8c5d15b60744, p_RelatedEntityID := p_RelatedEntityID_8c5d15b60744, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_8c5d15b60744, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_8c5d15b60744, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_8c5d15b60744, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_8c5d15b60744, p_EntityIDFieldName := p_EntityIDFieldName_8c5d15b60744, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_8c5d15b60744, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_8c5d15b60744, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_8c5d15b60744, p_Status := p_Status_8c5d15b60744, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_8c5d15b60744, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_8c5d15b60744, p_AutoUpdateCategory := p_AutoUpdateCategory_8c5d15b60744, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_8c5d15b60744, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_8c5d15b60744, p_Encrypt := p_Encrypt_8c5d15b60744, p_EncryptionKeyID := p_EncryptionKeyID_8c5d15b60744, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_8c5d15b60744, p_SendEncryptedValue := p_SendEncryptedValue_8c5d15b60744, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_8c5d15b60744, p_IsSoftForeignKey := p_IsSoftForeignKey_8c5d15b60744, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_8c5d15b60744, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_8c5d15b60744, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_8c5d15b60744, p_JSONTypeDefinition := p_JSONTypeDefinition_8c5d15b60744, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_8c5d15b60744, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_8c5d15b60744, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_8c5d15b60744, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_8c5d15b60744, p_IsComputed := p_IsComputed_8c5d15b60744, p_EmbeddedRecord := p_EmbeddedRecord_8c5d15b60744, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_8c5d15b60744, p_Configuration_Clear := TRUE, p_ID := p_ID_8c5d15b60744);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_f3db31ba41c7 VARCHAR(255);
  p_Description_f3db31ba41c7 TEXT;
  p_AutoUpdateDescription_f3db31ba41c7 BOOLEAN;
  p_IsPrimaryKey_f3db31ba41c7 BOOLEAN;
  p_IsUnique_f3db31ba41c7 BOOLEAN;
  p_Category_f3db31ba41c7 VARCHAR(255);
  p_ValueListType_f3db31ba41c7 VARCHAR(20);
  p_ExtendedType_f3db31ba41c7 VARCHAR(50);
  p_CodeType_f3db31ba41c7 VARCHAR(50);
  p_DefaultInView_f3db31ba41c7 BOOLEAN;
  p_ViewCellTemplate_f3db31ba41c7 TEXT;
  p_DefaultColumnWidth_f3db31ba41c7 INTEGER;
  p_AllowUpdateAPI_f3db31ba41c7 BOOLEAN;
  p_AllowUpdateInView_f3db31ba41c7 BOOLEAN;
  p_IncludeInUserSearchAPI_f3db31ba41c7 BOOLEAN;
  p_FullTextSearchEnabled_f3db31ba41c7 BOOLEAN;
  p_UserSearchParamFormatAPI_f3db31ba41c7 VARCHAR(500);
  p_IncludeInGeneratedForm_f3db31ba41c7 BOOLEAN;
  p_GeneratedFormSection_f3db31ba41c7 VARCHAR(10);
  p_IsNameField_f3db31ba41c7 BOOLEAN;
  p_RelatedEntityID_f3db31ba41c7 UUID;
  p_RelatedEntityFieldName_f3db31ba41c7 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_f3db31ba41c7 BOOLEAN;
  p_RelatedEntityNameFieldMap_f3db31ba41c7 VARCHAR(255);
  p_RelatedEntityDisplayType_f3db31ba41c7 VARCHAR(20);
  p_EntityIDFieldName_f3db31ba41c7 VARCHAR(100);
  p_ScopeDefault_f3db31ba41c7 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_f3db31ba41c7 BOOLEAN;
  p_ValuesToPackWithSchema_f3db31ba41c7 VARCHAR(10);
  p_Status_f3db31ba41c7 VARCHAR(25);
  p_AutoUpdateIsNameField_f3db31ba41c7 BOOLEAN;
  p_AutoUpdateDefaultInView_f3db31ba41c7 BOOLEAN;
  p_AutoUpdateCategory_f3db31ba41c7 BOOLEAN;
  p_AutoUpdateDisplayName_f3db31ba41c7 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_f3db31ba41c7 BOOLEAN;
  p_Encrypt_f3db31ba41c7 BOOLEAN;
  p_EncryptionKeyID_f3db31ba41c7 UUID;
  p_AllowDecryptInAPI_f3db31ba41c7 BOOLEAN;
  p_SendEncryptedValue_f3db31ba41c7 BOOLEAN;
  p_IsSoftPrimaryKey_f3db31ba41c7 BOOLEAN;
  p_IsSoftForeignKey_f3db31ba41c7 BOOLEAN;
  p_RelatedEntityJoinFields_f3db31ba41c7 TEXT;
  p_JSONType_f3db31ba41c7 VARCHAR(255);
  p_JSONTypeIsArray_f3db31ba41c7 BOOLEAN;
  p_JSONTypeDefinition_f3db31ba41c7 TEXT;
  p_UserSearchPredicateAPI_f3db31ba41c7 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_f3db31ba41c7 BOOLEAN;
  p_AutoUpdateFullTextSearch_f3db31ba41c7 BOOLEAN;
  p_AutoUpdateExtendedType_f3db31ba41c7 BOOLEAN;
  p_IsComputed_f3db31ba41c7 BOOLEAN;
  p_EmbeddedRecord_f3db31ba41c7 TEXT;
  p_Configuration_f3db31ba41c7 TEXT;
  p_ID_f3db31ba41c7 UUID;
BEGIN
  p_DisplayName_f3db31ba41c7 := 'Exception Date';
  p_Description_f3db31ba41c7 := 'The business day the exception belongs to. Its month is the close it blocks.';
  p_AutoUpdateDescription_f3db31ba41c7 := TRUE;
  p_IsPrimaryKey_f3db31ba41c7 := FALSE;
  p_IsUnique_f3db31ba41c7 := FALSE;
  p_Category_f3db31ba41c7 := 'Exception Details';
  p_ValueListType_f3db31ba41c7 := 'None';
  p_DefaultInView_f3db31ba41c7 := FALSE;
  p_DefaultColumnWidth_f3db31ba41c7 := 150;
  p_AllowUpdateAPI_f3db31ba41c7 := TRUE;
  p_AllowUpdateInView_f3db31ba41c7 := TRUE;
  p_IncludeInUserSearchAPI_f3db31ba41c7 := FALSE;
  p_FullTextSearchEnabled_f3db31ba41c7 := FALSE;
  p_IncludeInGeneratedForm_f3db31ba41c7 := TRUE;
  p_GeneratedFormSection_f3db31ba41c7 := 'Category';
  p_IsNameField_f3db31ba41c7 := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_f3db31ba41c7 := FALSE;
  p_RelatedEntityDisplayType_f3db31ba41c7 := 'Search';
  p_AutoUpdateRelatedEntityInfo_f3db31ba41c7 := TRUE;
  p_ValuesToPackWithSchema_f3db31ba41c7 := 'Auto';
  p_Status_f3db31ba41c7 := 'Active';
  p_AutoUpdateIsNameField_f3db31ba41c7 := TRUE;
  p_AutoUpdateDefaultInView_f3db31ba41c7 := TRUE;
  p_AutoUpdateCategory_f3db31ba41c7 := TRUE;
  p_AutoUpdateDisplayName_f3db31ba41c7 := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_f3db31ba41c7 := TRUE;
  p_Encrypt_f3db31ba41c7 := FALSE;
  p_AllowDecryptInAPI_f3db31ba41c7 := FALSE;
  p_SendEncryptedValue_f3db31ba41c7 := FALSE;
  p_IsSoftPrimaryKey_f3db31ba41c7 := FALSE;
  p_IsSoftForeignKey_f3db31ba41c7 := FALSE;
  p_JSONTypeIsArray_f3db31ba41c7 := FALSE;
  p_UserSearchPredicateAPI_f3db31ba41c7 := 'Contains';
  p_AutoUpdateUserSearchPredicate_f3db31ba41c7 := TRUE;
  p_AutoUpdateFullTextSearch_f3db31ba41c7 := TRUE;
  p_AutoUpdateExtendedType_f3db31ba41c7 := TRUE;
  p_IsComputed_f3db31ba41c7 := FALSE;
  p_ID_f3db31ba41c7 := 'FC5AB177-33F8-463B-B7A1-7F96CCBA63C9';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM ${mjSchema}."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_f3db31ba41c7,
    'Description', p_Description_f3db31ba41c7,
    'AutoUpdateDescription', p_AutoUpdateDescription_f3db31ba41c7,
    'IsPrimaryKey', p_IsPrimaryKey_f3db31ba41c7,
    'IsUnique', p_IsUnique_f3db31ba41c7,
    'Category', p_Category_f3db31ba41c7,
    'ValueListType', p_ValueListType_f3db31ba41c7,
    'ExtendedType', p_ExtendedType_f3db31ba41c7,
    'CodeType', p_CodeType_f3db31ba41c7,
    'DefaultInView', p_DefaultInView_f3db31ba41c7,
    'ViewCellTemplate', p_ViewCellTemplate_f3db31ba41c7,
    'DefaultColumnWidth', p_DefaultColumnWidth_f3db31ba41c7,
    'AllowUpdateAPI', p_AllowUpdateAPI_f3db31ba41c7,
    'AllowUpdateInView', p_AllowUpdateInView_f3db31ba41c7,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_f3db31ba41c7,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_f3db31ba41c7,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_f3db31ba41c7,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_f3db31ba41c7,
    'GeneratedFormSection', p_GeneratedFormSection_f3db31ba41c7,
    'IsNameField', p_IsNameField_f3db31ba41c7,
    'RelatedEntityID', p_RelatedEntityID_f3db31ba41c7,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_f3db31ba41c7,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_f3db31ba41c7,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_f3db31ba41c7,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_f3db31ba41c7,
    'EntityIDFieldName', p_EntityIDFieldName_f3db31ba41c7,
    'ScopeDefault', p_ScopeDefault_f3db31ba41c7,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_f3db31ba41c7,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_f3db31ba41c7,
    'Status', p_Status_f3db31ba41c7,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_f3db31ba41c7,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_f3db31ba41c7,
    'AutoUpdateCategory', p_AutoUpdateCategory_f3db31ba41c7,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_f3db31ba41c7,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_f3db31ba41c7,
    'Encrypt', p_Encrypt_f3db31ba41c7,
    'EncryptionKeyID', p_EncryptionKeyID_f3db31ba41c7,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_f3db31ba41c7,
    'SendEncryptedValue', p_SendEncryptedValue_f3db31ba41c7,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_f3db31ba41c7,
    'IsSoftForeignKey', p_IsSoftForeignKey_f3db31ba41c7,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_f3db31ba41c7,
    'JSONType', p_JSONType_f3db31ba41c7,
    'JSONTypeIsArray', p_JSONTypeIsArray_f3db31ba41c7,
    'JSONTypeDefinition', p_JSONTypeDefinition_f3db31ba41c7,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_f3db31ba41c7,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_f3db31ba41c7,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_f3db31ba41c7,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_f3db31ba41c7,
    'IsComputed', p_IsComputed_f3db31ba41c7
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_f3db31ba41c7,
    'Configuration', p_Configuration_f3db31ba41c7,
    'ID', p_ID_f3db31ba41c7
  ));
  ELSE
    PERFORM ${mjSchema}."spUpdateEntityField"(p_DisplayName := p_DisplayName_f3db31ba41c7, p_Description := p_Description_f3db31ba41c7, p_AutoUpdateDescription := p_AutoUpdateDescription_f3db31ba41c7, p_IsPrimaryKey := p_IsPrimaryKey_f3db31ba41c7, p_IsUnique := p_IsUnique_f3db31ba41c7, p_Category := p_Category_f3db31ba41c7, p_ValueListType := p_ValueListType_f3db31ba41c7, p_ExtendedType := p_ExtendedType_f3db31ba41c7, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_f3db31ba41c7, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_f3db31ba41c7, p_ViewCellTemplate := p_ViewCellTemplate_f3db31ba41c7, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_f3db31ba41c7, p_AllowUpdateAPI := p_AllowUpdateAPI_f3db31ba41c7, p_AllowUpdateInView := p_AllowUpdateInView_f3db31ba41c7, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_f3db31ba41c7, p_FullTextSearchEnabled := p_FullTextSearchEnabled_f3db31ba41c7, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_f3db31ba41c7, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_f3db31ba41c7, p_GeneratedFormSection := p_GeneratedFormSection_f3db31ba41c7, p_IsNameField := p_IsNameField_f3db31ba41c7, p_RelatedEntityID := p_RelatedEntityID_f3db31ba41c7, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_f3db31ba41c7, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_f3db31ba41c7, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_f3db31ba41c7, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_f3db31ba41c7, p_EntityIDFieldName := p_EntityIDFieldName_f3db31ba41c7, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_f3db31ba41c7, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_f3db31ba41c7, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_f3db31ba41c7, p_Status := p_Status_f3db31ba41c7, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_f3db31ba41c7, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_f3db31ba41c7, p_AutoUpdateCategory := p_AutoUpdateCategory_f3db31ba41c7, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_f3db31ba41c7, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_f3db31ba41c7, p_Encrypt := p_Encrypt_f3db31ba41c7, p_EncryptionKeyID := p_EncryptionKeyID_f3db31ba41c7, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_f3db31ba41c7, p_SendEncryptedValue := p_SendEncryptedValue_f3db31ba41c7, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_f3db31ba41c7, p_IsSoftForeignKey := p_IsSoftForeignKey_f3db31ba41c7, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_f3db31ba41c7, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_f3db31ba41c7, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_f3db31ba41c7, p_JSONTypeDefinition := p_JSONTypeDefinition_f3db31ba41c7, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_f3db31ba41c7, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_f3db31ba41c7, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_f3db31ba41c7, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_f3db31ba41c7, p_IsComputed := p_IsComputed_f3db31ba41c7, p_EmbeddedRecord := p_EmbeddedRecord_f3db31ba41c7, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_f3db31ba41c7, p_Configuration_Clear := TRUE, p_ID := p_ID_f3db31ba41c7);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_cd1e34fcd442 VARCHAR(255);
  p_Description_cd1e34fcd442 TEXT;
  p_AutoUpdateDescription_cd1e34fcd442 BOOLEAN;
  p_IsPrimaryKey_cd1e34fcd442 BOOLEAN;
  p_IsUnique_cd1e34fcd442 BOOLEAN;
  p_Category_cd1e34fcd442 VARCHAR(255);
  p_ValueListType_cd1e34fcd442 VARCHAR(20);
  p_ExtendedType_cd1e34fcd442 VARCHAR(50);
  p_CodeType_cd1e34fcd442 VARCHAR(50);
  p_DefaultInView_cd1e34fcd442 BOOLEAN;
  p_ViewCellTemplate_cd1e34fcd442 TEXT;
  p_DefaultColumnWidth_cd1e34fcd442 INTEGER;
  p_AllowUpdateAPI_cd1e34fcd442 BOOLEAN;
  p_AllowUpdateInView_cd1e34fcd442 BOOLEAN;
  p_IncludeInUserSearchAPI_cd1e34fcd442 BOOLEAN;
  p_FullTextSearchEnabled_cd1e34fcd442 BOOLEAN;
  p_UserSearchParamFormatAPI_cd1e34fcd442 VARCHAR(500);
  p_IncludeInGeneratedForm_cd1e34fcd442 BOOLEAN;
  p_GeneratedFormSection_cd1e34fcd442 VARCHAR(10);
  p_IsNameField_cd1e34fcd442 BOOLEAN;
  p_RelatedEntityID_cd1e34fcd442 UUID;
  p_RelatedEntityFieldName_cd1e34fcd442 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_cd1e34fcd442 BOOLEAN;
  p_RelatedEntityNameFieldMap_cd1e34fcd442 VARCHAR(255);
  p_RelatedEntityDisplayType_cd1e34fcd442 VARCHAR(20);
  p_EntityIDFieldName_cd1e34fcd442 VARCHAR(100);
  p_ScopeDefault_cd1e34fcd442 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_cd1e34fcd442 BOOLEAN;
  p_ValuesToPackWithSchema_cd1e34fcd442 VARCHAR(10);
  p_Status_cd1e34fcd442 VARCHAR(25);
  p_AutoUpdateIsNameField_cd1e34fcd442 BOOLEAN;
  p_AutoUpdateDefaultInView_cd1e34fcd442 BOOLEAN;
  p_AutoUpdateCategory_cd1e34fcd442 BOOLEAN;
  p_AutoUpdateDisplayName_cd1e34fcd442 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_cd1e34fcd442 BOOLEAN;
  p_Encrypt_cd1e34fcd442 BOOLEAN;
  p_EncryptionKeyID_cd1e34fcd442 UUID;
  p_AllowDecryptInAPI_cd1e34fcd442 BOOLEAN;
  p_SendEncryptedValue_cd1e34fcd442 BOOLEAN;
  p_IsSoftPrimaryKey_cd1e34fcd442 BOOLEAN;
  p_IsSoftForeignKey_cd1e34fcd442 BOOLEAN;
  p_RelatedEntityJoinFields_cd1e34fcd442 TEXT;
  p_JSONType_cd1e34fcd442 VARCHAR(255);
  p_JSONTypeIsArray_cd1e34fcd442 BOOLEAN;
  p_JSONTypeDefinition_cd1e34fcd442 TEXT;
  p_UserSearchPredicateAPI_cd1e34fcd442 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_cd1e34fcd442 BOOLEAN;
  p_AutoUpdateFullTextSearch_cd1e34fcd442 BOOLEAN;
  p_AutoUpdateExtendedType_cd1e34fcd442 BOOLEAN;
  p_IsComputed_cd1e34fcd442 BOOLEAN;
  p_EmbeddedRecord_cd1e34fcd442 TEXT;
  p_Configuration_cd1e34fcd442 TEXT;
  p_ID_cd1e34fcd442 UUID;
BEGIN
  p_DisplayName_cd1e34fcd442 := 'Summary';
  p_Description_cd1e34fcd442 := 'Plain description of what the detector found in the data.';
  p_AutoUpdateDescription_cd1e34fcd442 := TRUE;
  p_IsPrimaryKey_cd1e34fcd442 := FALSE;
  p_IsUnique_cd1e34fcd442 := FALSE;
  p_Category_cd1e34fcd442 := 'Exception Details';
  p_ValueListType_cd1e34fcd442 := 'None';
  p_DefaultInView_cd1e34fcd442 := FALSE;
  p_DefaultColumnWidth_cd1e34fcd442 := 150;
  p_AllowUpdateAPI_cd1e34fcd442 := TRUE;
  p_AllowUpdateInView_cd1e34fcd442 := TRUE;
  p_IncludeInUserSearchAPI_cd1e34fcd442 := FALSE;
  p_FullTextSearchEnabled_cd1e34fcd442 := FALSE;
  p_IncludeInGeneratedForm_cd1e34fcd442 := TRUE;
  p_GeneratedFormSection_cd1e34fcd442 := 'Category';
  p_IsNameField_cd1e34fcd442 := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_cd1e34fcd442 := FALSE;
  p_RelatedEntityDisplayType_cd1e34fcd442 := 'Search';
  p_AutoUpdateRelatedEntityInfo_cd1e34fcd442 := TRUE;
  p_ValuesToPackWithSchema_cd1e34fcd442 := 'Auto';
  p_Status_cd1e34fcd442 := 'Active';
  p_AutoUpdateIsNameField_cd1e34fcd442 := TRUE;
  p_AutoUpdateDefaultInView_cd1e34fcd442 := TRUE;
  p_AutoUpdateCategory_cd1e34fcd442 := TRUE;
  p_AutoUpdateDisplayName_cd1e34fcd442 := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_cd1e34fcd442 := TRUE;
  p_Encrypt_cd1e34fcd442 := FALSE;
  p_AllowDecryptInAPI_cd1e34fcd442 := FALSE;
  p_SendEncryptedValue_cd1e34fcd442 := FALSE;
  p_IsSoftPrimaryKey_cd1e34fcd442 := FALSE;
  p_IsSoftForeignKey_cd1e34fcd442 := FALSE;
  p_JSONTypeIsArray_cd1e34fcd442 := FALSE;
  p_UserSearchPredicateAPI_cd1e34fcd442 := 'Contains';
  p_AutoUpdateUserSearchPredicate_cd1e34fcd442 := TRUE;
  p_AutoUpdateFullTextSearch_cd1e34fcd442 := TRUE;
  p_AutoUpdateExtendedType_cd1e34fcd442 := TRUE;
  p_IsComputed_cd1e34fcd442 := FALSE;
  p_ID_cd1e34fcd442 := 'D6DB0D39-C95F-4A67-9611-95E4AC3CBE75';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM ${mjSchema}."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_cd1e34fcd442,
    'Description', p_Description_cd1e34fcd442,
    'AutoUpdateDescription', p_AutoUpdateDescription_cd1e34fcd442,
    'IsPrimaryKey', p_IsPrimaryKey_cd1e34fcd442,
    'IsUnique', p_IsUnique_cd1e34fcd442,
    'Category', p_Category_cd1e34fcd442,
    'ValueListType', p_ValueListType_cd1e34fcd442,
    'ExtendedType', p_ExtendedType_cd1e34fcd442,
    'CodeType', p_CodeType_cd1e34fcd442,
    'DefaultInView', p_DefaultInView_cd1e34fcd442,
    'ViewCellTemplate', p_ViewCellTemplate_cd1e34fcd442,
    'DefaultColumnWidth', p_DefaultColumnWidth_cd1e34fcd442,
    'AllowUpdateAPI', p_AllowUpdateAPI_cd1e34fcd442,
    'AllowUpdateInView', p_AllowUpdateInView_cd1e34fcd442,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_cd1e34fcd442,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_cd1e34fcd442,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_cd1e34fcd442,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_cd1e34fcd442,
    'GeneratedFormSection', p_GeneratedFormSection_cd1e34fcd442,
    'IsNameField', p_IsNameField_cd1e34fcd442,
    'RelatedEntityID', p_RelatedEntityID_cd1e34fcd442,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_cd1e34fcd442,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_cd1e34fcd442,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_cd1e34fcd442,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_cd1e34fcd442,
    'EntityIDFieldName', p_EntityIDFieldName_cd1e34fcd442,
    'ScopeDefault', p_ScopeDefault_cd1e34fcd442,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_cd1e34fcd442,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_cd1e34fcd442,
    'Status', p_Status_cd1e34fcd442,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_cd1e34fcd442,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_cd1e34fcd442,
    'AutoUpdateCategory', p_AutoUpdateCategory_cd1e34fcd442,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_cd1e34fcd442,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_cd1e34fcd442,
    'Encrypt', p_Encrypt_cd1e34fcd442,
    'EncryptionKeyID', p_EncryptionKeyID_cd1e34fcd442,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_cd1e34fcd442,
    'SendEncryptedValue', p_SendEncryptedValue_cd1e34fcd442,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_cd1e34fcd442,
    'IsSoftForeignKey', p_IsSoftForeignKey_cd1e34fcd442,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_cd1e34fcd442,
    'JSONType', p_JSONType_cd1e34fcd442,
    'JSONTypeIsArray', p_JSONTypeIsArray_cd1e34fcd442,
    'JSONTypeDefinition', p_JSONTypeDefinition_cd1e34fcd442,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_cd1e34fcd442,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_cd1e34fcd442,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_cd1e34fcd442,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_cd1e34fcd442,
    'IsComputed', p_IsComputed_cd1e34fcd442
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_cd1e34fcd442,
    'Configuration', p_Configuration_cd1e34fcd442,
    'ID', p_ID_cd1e34fcd442
  ));
  ELSE
    PERFORM ${mjSchema}."spUpdateEntityField"(p_DisplayName := p_DisplayName_cd1e34fcd442, p_Description := p_Description_cd1e34fcd442, p_AutoUpdateDescription := p_AutoUpdateDescription_cd1e34fcd442, p_IsPrimaryKey := p_IsPrimaryKey_cd1e34fcd442, p_IsUnique := p_IsUnique_cd1e34fcd442, p_Category := p_Category_cd1e34fcd442, p_ValueListType := p_ValueListType_cd1e34fcd442, p_ExtendedType := p_ExtendedType_cd1e34fcd442, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_cd1e34fcd442, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_cd1e34fcd442, p_ViewCellTemplate := p_ViewCellTemplate_cd1e34fcd442, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_cd1e34fcd442, p_AllowUpdateAPI := p_AllowUpdateAPI_cd1e34fcd442, p_AllowUpdateInView := p_AllowUpdateInView_cd1e34fcd442, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_cd1e34fcd442, p_FullTextSearchEnabled := p_FullTextSearchEnabled_cd1e34fcd442, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_cd1e34fcd442, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_cd1e34fcd442, p_GeneratedFormSection := p_GeneratedFormSection_cd1e34fcd442, p_IsNameField := p_IsNameField_cd1e34fcd442, p_RelatedEntityID := p_RelatedEntityID_cd1e34fcd442, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_cd1e34fcd442, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_cd1e34fcd442, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_cd1e34fcd442, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_cd1e34fcd442, p_EntityIDFieldName := p_EntityIDFieldName_cd1e34fcd442, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_cd1e34fcd442, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_cd1e34fcd442, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_cd1e34fcd442, p_Status := p_Status_cd1e34fcd442, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_cd1e34fcd442, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_cd1e34fcd442, p_AutoUpdateCategory := p_AutoUpdateCategory_cd1e34fcd442, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_cd1e34fcd442, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_cd1e34fcd442, p_Encrypt := p_Encrypt_cd1e34fcd442, p_EncryptionKeyID := p_EncryptionKeyID_cd1e34fcd442, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_cd1e34fcd442, p_SendEncryptedValue := p_SendEncryptedValue_cd1e34fcd442, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_cd1e34fcd442, p_IsSoftForeignKey := p_IsSoftForeignKey_cd1e34fcd442, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_cd1e34fcd442, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_cd1e34fcd442, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_cd1e34fcd442, p_JSONTypeDefinition := p_JSONTypeDefinition_cd1e34fcd442, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_cd1e34fcd442, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_cd1e34fcd442, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_cd1e34fcd442, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_cd1e34fcd442, p_IsComputed := p_IsComputed_cd1e34fcd442, p_EmbeddedRecord := p_EmbeddedRecord_cd1e34fcd442, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_cd1e34fcd442, p_Configuration_Clear := TRUE, p_ID := p_ID_cd1e34fcd442);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_defefd5745ce VARCHAR(255);
  p_Description_defefd5745ce TEXT;
  p_AutoUpdateDescription_defefd5745ce BOOLEAN;
  p_IsPrimaryKey_defefd5745ce BOOLEAN;
  p_IsUnique_defefd5745ce BOOLEAN;
  p_Category_defefd5745ce VARCHAR(255);
  p_ValueListType_defefd5745ce VARCHAR(20);
  p_ExtendedType_defefd5745ce VARCHAR(50);
  p_CodeType_defefd5745ce VARCHAR(50);
  p_DefaultInView_defefd5745ce BOOLEAN;
  p_ViewCellTemplate_defefd5745ce TEXT;
  p_DefaultColumnWidth_defefd5745ce INTEGER;
  p_AllowUpdateAPI_defefd5745ce BOOLEAN;
  p_AllowUpdateInView_defefd5745ce BOOLEAN;
  p_IncludeInUserSearchAPI_defefd5745ce BOOLEAN;
  p_FullTextSearchEnabled_defefd5745ce BOOLEAN;
  p_UserSearchParamFormatAPI_defefd5745ce VARCHAR(500);
  p_IncludeInGeneratedForm_defefd5745ce BOOLEAN;
  p_GeneratedFormSection_defefd5745ce VARCHAR(10);
  p_IsNameField_defefd5745ce BOOLEAN;
  p_RelatedEntityID_defefd5745ce UUID;
  p_RelatedEntityFieldName_defefd5745ce VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_defefd5745ce BOOLEAN;
  p_RelatedEntityNameFieldMap_defefd5745ce VARCHAR(255);
  p_RelatedEntityDisplayType_defefd5745ce VARCHAR(20);
  p_EntityIDFieldName_defefd5745ce VARCHAR(100);
  p_ScopeDefault_defefd5745ce VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_defefd5745ce BOOLEAN;
  p_ValuesToPackWithSchema_defefd5745ce VARCHAR(10);
  p_Status_defefd5745ce VARCHAR(25);
  p_AutoUpdateIsNameField_defefd5745ce BOOLEAN;
  p_AutoUpdateDefaultInView_defefd5745ce BOOLEAN;
  p_AutoUpdateCategory_defefd5745ce BOOLEAN;
  p_AutoUpdateDisplayName_defefd5745ce BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_defefd5745ce BOOLEAN;
  p_Encrypt_defefd5745ce BOOLEAN;
  p_EncryptionKeyID_defefd5745ce UUID;
  p_AllowDecryptInAPI_defefd5745ce BOOLEAN;
  p_SendEncryptedValue_defefd5745ce BOOLEAN;
  p_IsSoftPrimaryKey_defefd5745ce BOOLEAN;
  p_IsSoftForeignKey_defefd5745ce BOOLEAN;
  p_RelatedEntityJoinFields_defefd5745ce TEXT;
  p_JSONType_defefd5745ce VARCHAR(255);
  p_JSONTypeIsArray_defefd5745ce BOOLEAN;
  p_JSONTypeDefinition_defefd5745ce TEXT;
  p_UserSearchPredicateAPI_defefd5745ce VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_defefd5745ce BOOLEAN;
  p_AutoUpdateFullTextSearch_defefd5745ce BOOLEAN;
  p_AutoUpdateExtendedType_defefd5745ce BOOLEAN;
  p_IsComputed_defefd5745ce BOOLEAN;
  p_EmbeddedRecord_defefd5745ce TEXT;
  p_Configuration_defefd5745ce TEXT;
  p_ID_defefd5745ce UUID;
BEGIN
  p_DisplayName_defefd5745ce := 'Dedupe Key';
  p_Description_defefd5745ce := 'The detector''s identity for this occurrence (e.g. the source record ID, or record ID and month). Unique per type: raising the same key again returns the existing row. If that row is still Open and the repeat raise carries a different creator, its SourceCreatedByUserID, CreatorUnresolved and Summary are updated to match; nothing else changes, and Reviewed or Corrected rows are never touched.';
  p_AutoUpdateDescription_defefd5745ce := TRUE;
  p_IsPrimaryKey_defefd5745ce := FALSE;
  p_IsUnique_defefd5745ce := TRUE;
  p_Category_defefd5745ce := 'Exception Details';
  p_ValueListType_defefd5745ce := 'None';
  p_DefaultInView_defefd5745ce := FALSE;
  p_DefaultColumnWidth_defefd5745ce := 150;
  p_AllowUpdateAPI_defefd5745ce := TRUE;
  p_AllowUpdateInView_defefd5745ce := TRUE;
  p_IncludeInUserSearchAPI_defefd5745ce := FALSE;
  p_FullTextSearchEnabled_defefd5745ce := FALSE;
  p_IncludeInGeneratedForm_defefd5745ce := TRUE;
  p_GeneratedFormSection_defefd5745ce := 'Category';
  p_IsNameField_defefd5745ce := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_defefd5745ce := FALSE;
  p_RelatedEntityDisplayType_defefd5745ce := 'Search';
  p_AutoUpdateRelatedEntityInfo_defefd5745ce := TRUE;
  p_ValuesToPackWithSchema_defefd5745ce := 'Auto';
  p_Status_defefd5745ce := 'Active';
  p_AutoUpdateIsNameField_defefd5745ce := TRUE;
  p_AutoUpdateDefaultInView_defefd5745ce := TRUE;
  p_AutoUpdateCategory_defefd5745ce := TRUE;
  p_AutoUpdateDisplayName_defefd5745ce := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_defefd5745ce := TRUE;
  p_Encrypt_defefd5745ce := FALSE;
  p_AllowDecryptInAPI_defefd5745ce := FALSE;
  p_SendEncryptedValue_defefd5745ce := FALSE;
  p_IsSoftPrimaryKey_defefd5745ce := FALSE;
  p_IsSoftForeignKey_defefd5745ce := FALSE;
  p_JSONTypeIsArray_defefd5745ce := FALSE;
  p_UserSearchPredicateAPI_defefd5745ce := 'Contains';
  p_AutoUpdateUserSearchPredicate_defefd5745ce := TRUE;
  p_AutoUpdateFullTextSearch_defefd5745ce := TRUE;
  p_AutoUpdateExtendedType_defefd5745ce := TRUE;
  p_IsComputed_defefd5745ce := FALSE;
  p_ID_defefd5745ce := 'E271A3A0-5F9F-444C-B469-F821A74BC3A0';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM ${mjSchema}."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_defefd5745ce,
    'Description', p_Description_defefd5745ce,
    'AutoUpdateDescription', p_AutoUpdateDescription_defefd5745ce,
    'IsPrimaryKey', p_IsPrimaryKey_defefd5745ce,
    'IsUnique', p_IsUnique_defefd5745ce,
    'Category', p_Category_defefd5745ce,
    'ValueListType', p_ValueListType_defefd5745ce,
    'ExtendedType', p_ExtendedType_defefd5745ce,
    'CodeType', p_CodeType_defefd5745ce,
    'DefaultInView', p_DefaultInView_defefd5745ce,
    'ViewCellTemplate', p_ViewCellTemplate_defefd5745ce,
    'DefaultColumnWidth', p_DefaultColumnWidth_defefd5745ce,
    'AllowUpdateAPI', p_AllowUpdateAPI_defefd5745ce,
    'AllowUpdateInView', p_AllowUpdateInView_defefd5745ce,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_defefd5745ce,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_defefd5745ce,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_defefd5745ce,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_defefd5745ce,
    'GeneratedFormSection', p_GeneratedFormSection_defefd5745ce,
    'IsNameField', p_IsNameField_defefd5745ce,
    'RelatedEntityID', p_RelatedEntityID_defefd5745ce,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_defefd5745ce,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_defefd5745ce,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_defefd5745ce,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_defefd5745ce,
    'EntityIDFieldName', p_EntityIDFieldName_defefd5745ce,
    'ScopeDefault', p_ScopeDefault_defefd5745ce,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_defefd5745ce,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_defefd5745ce,
    'Status', p_Status_defefd5745ce,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_defefd5745ce,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_defefd5745ce,
    'AutoUpdateCategory', p_AutoUpdateCategory_defefd5745ce,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_defefd5745ce,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_defefd5745ce,
    'Encrypt', p_Encrypt_defefd5745ce,
    'EncryptionKeyID', p_EncryptionKeyID_defefd5745ce,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_defefd5745ce,
    'SendEncryptedValue', p_SendEncryptedValue_defefd5745ce,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_defefd5745ce,
    'IsSoftForeignKey', p_IsSoftForeignKey_defefd5745ce,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_defefd5745ce,
    'JSONType', p_JSONType_defefd5745ce,
    'JSONTypeIsArray', p_JSONTypeIsArray_defefd5745ce,
    'JSONTypeDefinition', p_JSONTypeDefinition_defefd5745ce,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_defefd5745ce,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_defefd5745ce,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_defefd5745ce,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_defefd5745ce,
    'IsComputed', p_IsComputed_defefd5745ce
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_defefd5745ce,
    'Configuration', p_Configuration_defefd5745ce,
    'ID', p_ID_defefd5745ce
  ));
  ELSE
    PERFORM ${mjSchema}."spUpdateEntityField"(p_DisplayName := p_DisplayName_defefd5745ce, p_Description := p_Description_defefd5745ce, p_AutoUpdateDescription := p_AutoUpdateDescription_defefd5745ce, p_IsPrimaryKey := p_IsPrimaryKey_defefd5745ce, p_IsUnique := p_IsUnique_defefd5745ce, p_Category := p_Category_defefd5745ce, p_ValueListType := p_ValueListType_defefd5745ce, p_ExtendedType := p_ExtendedType_defefd5745ce, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_defefd5745ce, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_defefd5745ce, p_ViewCellTemplate := p_ViewCellTemplate_defefd5745ce, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_defefd5745ce, p_AllowUpdateAPI := p_AllowUpdateAPI_defefd5745ce, p_AllowUpdateInView := p_AllowUpdateInView_defefd5745ce, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_defefd5745ce, p_FullTextSearchEnabled := p_FullTextSearchEnabled_defefd5745ce, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_defefd5745ce, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_defefd5745ce, p_GeneratedFormSection := p_GeneratedFormSection_defefd5745ce, p_IsNameField := p_IsNameField_defefd5745ce, p_RelatedEntityID := p_RelatedEntityID_defefd5745ce, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_defefd5745ce, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_defefd5745ce, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_defefd5745ce, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_defefd5745ce, p_EntityIDFieldName := p_EntityIDFieldName_defefd5745ce, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_defefd5745ce, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_defefd5745ce, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_defefd5745ce, p_Status := p_Status_defefd5745ce, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_defefd5745ce, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_defefd5745ce, p_AutoUpdateCategory := p_AutoUpdateCategory_defefd5745ce, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_defefd5745ce, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_defefd5745ce, p_Encrypt := p_Encrypt_defefd5745ce, p_EncryptionKeyID := p_EncryptionKeyID_defefd5745ce, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_defefd5745ce, p_SendEncryptedValue := p_SendEncryptedValue_defefd5745ce, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_defefd5745ce, p_IsSoftForeignKey := p_IsSoftForeignKey_defefd5745ce, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_defefd5745ce, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_defefd5745ce, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_defefd5745ce, p_JSONTypeDefinition := p_JSONTypeDefinition_defefd5745ce, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_defefd5745ce, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_defefd5745ce, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_defefd5745ce, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_defefd5745ce, p_IsComputed := p_IsComputed_defefd5745ce, p_EmbeddedRecord := p_EmbeddedRecord_defefd5745ce, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_defefd5745ce, p_Configuration_Clear := TRUE, p_ID := p_ID_defefd5745ce);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_951abde62e65 VARCHAR(255);
  p_Description_951abde62e65 TEXT;
  p_AutoUpdateDescription_951abde62e65 BOOLEAN;
  p_IsPrimaryKey_951abde62e65 BOOLEAN;
  p_IsUnique_951abde62e65 BOOLEAN;
  p_Category_951abde62e65 VARCHAR(255);
  p_ValueListType_951abde62e65 VARCHAR(20);
  p_ExtendedType_951abde62e65 VARCHAR(50);
  p_CodeType_951abde62e65 VARCHAR(50);
  p_DefaultInView_951abde62e65 BOOLEAN;
  p_ViewCellTemplate_951abde62e65 TEXT;
  p_DefaultColumnWidth_951abde62e65 INTEGER;
  p_AllowUpdateAPI_951abde62e65 BOOLEAN;
  p_AllowUpdateInView_951abde62e65 BOOLEAN;
  p_IncludeInUserSearchAPI_951abde62e65 BOOLEAN;
  p_FullTextSearchEnabled_951abde62e65 BOOLEAN;
  p_UserSearchParamFormatAPI_951abde62e65 VARCHAR(500);
  p_IncludeInGeneratedForm_951abde62e65 BOOLEAN;
  p_GeneratedFormSection_951abde62e65 VARCHAR(10);
  p_IsNameField_951abde62e65 BOOLEAN;
  p_RelatedEntityID_951abde62e65 UUID;
  p_RelatedEntityFieldName_951abde62e65 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_951abde62e65 BOOLEAN;
  p_RelatedEntityNameFieldMap_951abde62e65 VARCHAR(255);
  p_RelatedEntityDisplayType_951abde62e65 VARCHAR(20);
  p_EntityIDFieldName_951abde62e65 VARCHAR(100);
  p_ScopeDefault_951abde62e65 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_951abde62e65 BOOLEAN;
  p_ValuesToPackWithSchema_951abde62e65 VARCHAR(10);
  p_Status_951abde62e65 VARCHAR(25);
  p_AutoUpdateIsNameField_951abde62e65 BOOLEAN;
  p_AutoUpdateDefaultInView_951abde62e65 BOOLEAN;
  p_AutoUpdateCategory_951abde62e65 BOOLEAN;
  p_AutoUpdateDisplayName_951abde62e65 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_951abde62e65 BOOLEAN;
  p_Encrypt_951abde62e65 BOOLEAN;
  p_EncryptionKeyID_951abde62e65 UUID;
  p_AllowDecryptInAPI_951abde62e65 BOOLEAN;
  p_SendEncryptedValue_951abde62e65 BOOLEAN;
  p_IsSoftPrimaryKey_951abde62e65 BOOLEAN;
  p_IsSoftForeignKey_951abde62e65 BOOLEAN;
  p_RelatedEntityJoinFields_951abde62e65 TEXT;
  p_JSONType_951abde62e65 VARCHAR(255);
  p_JSONTypeIsArray_951abde62e65 BOOLEAN;
  p_JSONTypeDefinition_951abde62e65 TEXT;
  p_UserSearchPredicateAPI_951abde62e65 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_951abde62e65 BOOLEAN;
  p_AutoUpdateFullTextSearch_951abde62e65 BOOLEAN;
  p_AutoUpdateExtendedType_951abde62e65 BOOLEAN;
  p_IsComputed_951abde62e65 BOOLEAN;
  p_EmbeddedRecord_951abde62e65 TEXT;
  p_Configuration_951abde62e65 TEXT;
  p_ID_951abde62e65 UUID;
BEGIN
  p_DisplayName_951abde62e65 := 'Source Entity ID';
  p_Description_951abde62e65 := 'MJ entity of the record that raised the exception. With SourceRecordID, names the source record.';
  p_AutoUpdateDescription_951abde62e65 := TRUE;
  p_IsPrimaryKey_951abde62e65 := FALSE;
  p_IsUnique_951abde62e65 := FALSE;
  p_Category_951abde62e65 := 'Source';
  p_ValueListType_951abde62e65 := 'None';
  p_DefaultInView_951abde62e65 := FALSE;
  p_DefaultColumnWidth_951abde62e65 := 150;
  p_AllowUpdateAPI_951abde62e65 := TRUE;
  p_AllowUpdateInView_951abde62e65 := TRUE;
  p_IncludeInUserSearchAPI_951abde62e65 := FALSE;
  p_FullTextSearchEnabled_951abde62e65 := FALSE;
  p_IncludeInGeneratedForm_951abde62e65 := TRUE;
  p_GeneratedFormSection_951abde62e65 := 'Category';
  p_IsNameField_951abde62e65 := FALSE;
  p_RelatedEntityID_951abde62e65 := 'E0238F34-2837-EF11-86D4-6045BDEE16E6';
  p_RelatedEntityFieldName_951abde62e65 := 'ID';
  p_IncludeRelatedEntityNameFieldInBaseView_951abde62e65 := TRUE;
  p_RelatedEntityNameFieldMap_951abde62e65 := 'SourceEntity';
  p_RelatedEntityDisplayType_951abde62e65 := 'Search';
  p_AutoUpdateRelatedEntityInfo_951abde62e65 := TRUE;
  p_ValuesToPackWithSchema_951abde62e65 := 'Auto';
  p_Status_951abde62e65 := 'Active';
  p_AutoUpdateIsNameField_951abde62e65 := TRUE;
  p_AutoUpdateDefaultInView_951abde62e65 := TRUE;
  p_AutoUpdateCategory_951abde62e65 := TRUE;
  p_AutoUpdateDisplayName_951abde62e65 := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_951abde62e65 := TRUE;
  p_Encrypt_951abde62e65 := FALSE;
  p_AllowDecryptInAPI_951abde62e65 := FALSE;
  p_SendEncryptedValue_951abde62e65 := FALSE;
  p_IsSoftPrimaryKey_951abde62e65 := FALSE;
  p_IsSoftForeignKey_951abde62e65 := FALSE;
  p_JSONTypeIsArray_951abde62e65 := FALSE;
  p_UserSearchPredicateAPI_951abde62e65 := 'Contains';
  p_AutoUpdateUserSearchPredicate_951abde62e65 := TRUE;
  p_AutoUpdateFullTextSearch_951abde62e65 := TRUE;
  p_AutoUpdateExtendedType_951abde62e65 := TRUE;
  p_IsComputed_951abde62e65 := FALSE;
  p_ID_951abde62e65 := '3492339B-1B92-4333-A26B-C363C426176F';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM ${mjSchema}."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_951abde62e65,
    'Description', p_Description_951abde62e65,
    'AutoUpdateDescription', p_AutoUpdateDescription_951abde62e65,
    'IsPrimaryKey', p_IsPrimaryKey_951abde62e65,
    'IsUnique', p_IsUnique_951abde62e65,
    'Category', p_Category_951abde62e65,
    'ValueListType', p_ValueListType_951abde62e65,
    'ExtendedType', p_ExtendedType_951abde62e65,
    'CodeType', p_CodeType_951abde62e65,
    'DefaultInView', p_DefaultInView_951abde62e65,
    'ViewCellTemplate', p_ViewCellTemplate_951abde62e65,
    'DefaultColumnWidth', p_DefaultColumnWidth_951abde62e65,
    'AllowUpdateAPI', p_AllowUpdateAPI_951abde62e65,
    'AllowUpdateInView', p_AllowUpdateInView_951abde62e65,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_951abde62e65,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_951abde62e65,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_951abde62e65,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_951abde62e65,
    'GeneratedFormSection', p_GeneratedFormSection_951abde62e65,
    'IsNameField', p_IsNameField_951abde62e65,
    'RelatedEntityID', p_RelatedEntityID_951abde62e65,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_951abde62e65,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_951abde62e65,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_951abde62e65,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_951abde62e65,
    'EntityIDFieldName', p_EntityIDFieldName_951abde62e65,
    'ScopeDefault', p_ScopeDefault_951abde62e65,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_951abde62e65,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_951abde62e65,
    'Status', p_Status_951abde62e65,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_951abde62e65,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_951abde62e65,
    'AutoUpdateCategory', p_AutoUpdateCategory_951abde62e65,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_951abde62e65,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_951abde62e65,
    'Encrypt', p_Encrypt_951abde62e65,
    'EncryptionKeyID', p_EncryptionKeyID_951abde62e65,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_951abde62e65,
    'SendEncryptedValue', p_SendEncryptedValue_951abde62e65,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_951abde62e65,
    'IsSoftForeignKey', p_IsSoftForeignKey_951abde62e65,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_951abde62e65,
    'JSONType', p_JSONType_951abde62e65,
    'JSONTypeIsArray', p_JSONTypeIsArray_951abde62e65,
    'JSONTypeDefinition', p_JSONTypeDefinition_951abde62e65,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_951abde62e65,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_951abde62e65,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_951abde62e65,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_951abde62e65,
    'IsComputed', p_IsComputed_951abde62e65
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_951abde62e65,
    'Configuration', p_Configuration_951abde62e65,
    'ID', p_ID_951abde62e65
  ));
  ELSE
    PERFORM ${mjSchema}."spUpdateEntityField"(p_DisplayName := p_DisplayName_951abde62e65, p_Description := p_Description_951abde62e65, p_AutoUpdateDescription := p_AutoUpdateDescription_951abde62e65, p_IsPrimaryKey := p_IsPrimaryKey_951abde62e65, p_IsUnique := p_IsUnique_951abde62e65, p_Category := p_Category_951abde62e65, p_ValueListType := p_ValueListType_951abde62e65, p_ExtendedType := p_ExtendedType_951abde62e65, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_951abde62e65, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_951abde62e65, p_ViewCellTemplate := p_ViewCellTemplate_951abde62e65, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_951abde62e65, p_AllowUpdateAPI := p_AllowUpdateAPI_951abde62e65, p_AllowUpdateInView := p_AllowUpdateInView_951abde62e65, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_951abde62e65, p_FullTextSearchEnabled := p_FullTextSearchEnabled_951abde62e65, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_951abde62e65, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_951abde62e65, p_GeneratedFormSection := p_GeneratedFormSection_951abde62e65, p_IsNameField := p_IsNameField_951abde62e65, p_RelatedEntityID := p_RelatedEntityID_951abde62e65, p_RelatedEntityFieldName := p_RelatedEntityFieldName_951abde62e65, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_951abde62e65, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_951abde62e65, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_951abde62e65, p_EntityIDFieldName := p_EntityIDFieldName_951abde62e65, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_951abde62e65, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_951abde62e65, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_951abde62e65, p_Status := p_Status_951abde62e65, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_951abde62e65, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_951abde62e65, p_AutoUpdateCategory := p_AutoUpdateCategory_951abde62e65, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_951abde62e65, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_951abde62e65, p_Encrypt := p_Encrypt_951abde62e65, p_EncryptionKeyID := p_EncryptionKeyID_951abde62e65, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_951abde62e65, p_SendEncryptedValue := p_SendEncryptedValue_951abde62e65, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_951abde62e65, p_IsSoftForeignKey := p_IsSoftForeignKey_951abde62e65, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_951abde62e65, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_951abde62e65, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_951abde62e65, p_JSONTypeDefinition := p_JSONTypeDefinition_951abde62e65, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_951abde62e65, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_951abde62e65, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_951abde62e65, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_951abde62e65, p_IsComputed := p_IsComputed_951abde62e65, p_EmbeddedRecord := p_EmbeddedRecord_951abde62e65, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_951abde62e65, p_Configuration_Clear := TRUE, p_ID := p_ID_951abde62e65);
  END IF;
END $mj$;

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
    PERFORM ${mjSchema}."spUpdateEntityField"(p_DisplayName := p_DisplayName_0da7913db1f6, p_Description := p_Description_0da7913db1f6, p_AutoUpdateDescription := p_AutoUpdateDescription_0da7913db1f6, p_IsPrimaryKey := p_IsPrimaryKey_0da7913db1f6, p_IsUnique := p_IsUnique_0da7913db1f6, p_Category := p_Category_0da7913db1f6, p_ValueListType := p_ValueListType_0da7913db1f6, p_ExtendedType := p_ExtendedType_0da7913db1f6, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_0da7913db1f6, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_0da7913db1f6, p_ViewCellTemplate := p_ViewCellTemplate_0da7913db1f6, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_0da7913db1f6, p_AllowUpdateAPI := p_AllowUpdateAPI_0da7913db1f6, p_AllowUpdateInView := p_AllowUpdateInView_0da7913db1f6, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_0da7913db1f6, p_FullTextSearchEnabled := p_FullTextSearchEnabled_0da7913db1f6, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_0da7913db1f6, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_0da7913db1f6, p_GeneratedFormSection := p_GeneratedFormSection_0da7913db1f6, p_IsNameField := p_IsNameField_0da7913db1f6, p_RelatedEntityID := p_RelatedEntityID_0da7913db1f6, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_0da7913db1f6, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_0da7913db1f6, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_0da7913db1f6, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_0da7913db1f6, p_EntityIDFieldName := p_EntityIDFieldName_0da7913db1f6, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_0da7913db1f6, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_0da7913db1f6, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_0da7913db1f6, p_Status := p_Status_0da7913db1f6, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_0da7913db1f6, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_0da7913db1f6, p_AutoUpdateCategory := p_AutoUpdateCategory_0da7913db1f6, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_0da7913db1f6, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_0da7913db1f6, p_Encrypt := p_Encrypt_0da7913db1f6, p_EncryptionKeyID := p_EncryptionKeyID_0da7913db1f6, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_0da7913db1f6, p_SendEncryptedValue := p_SendEncryptedValue_0da7913db1f6, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_0da7913db1f6, p_IsSoftForeignKey := p_IsSoftForeignKey_0da7913db1f6, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_0da7913db1f6, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_0da7913db1f6, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_0da7913db1f6, p_JSONTypeDefinition := p_JSONTypeDefinition_0da7913db1f6, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_0da7913db1f6, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_0da7913db1f6, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_0da7913db1f6, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_0da7913db1f6, p_IsComputed := p_IsComputed_0da7913db1f6, p_EmbeddedRecord := p_EmbeddedRecord_0da7913db1f6, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_0da7913db1f6, p_Configuration_Clear := TRUE, p_ID := p_ID_0da7913db1f6);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_3393e6146369 VARCHAR(255);
  p_Description_3393e6146369 TEXT;
  p_AutoUpdateDescription_3393e6146369 BOOLEAN;
  p_IsPrimaryKey_3393e6146369 BOOLEAN;
  p_IsUnique_3393e6146369 BOOLEAN;
  p_Category_3393e6146369 VARCHAR(255);
  p_ValueListType_3393e6146369 VARCHAR(20);
  p_ExtendedType_3393e6146369 VARCHAR(50);
  p_CodeType_3393e6146369 VARCHAR(50);
  p_DefaultInView_3393e6146369 BOOLEAN;
  p_ViewCellTemplate_3393e6146369 TEXT;
  p_DefaultColumnWidth_3393e6146369 INTEGER;
  p_AllowUpdateAPI_3393e6146369 BOOLEAN;
  p_AllowUpdateInView_3393e6146369 BOOLEAN;
  p_IncludeInUserSearchAPI_3393e6146369 BOOLEAN;
  p_FullTextSearchEnabled_3393e6146369 BOOLEAN;
  p_UserSearchParamFormatAPI_3393e6146369 VARCHAR(500);
  p_IncludeInGeneratedForm_3393e6146369 BOOLEAN;
  p_GeneratedFormSection_3393e6146369 VARCHAR(10);
  p_IsNameField_3393e6146369 BOOLEAN;
  p_RelatedEntityID_3393e6146369 UUID;
  p_RelatedEntityFieldName_3393e6146369 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_3393e6146369 BOOLEAN;
  p_RelatedEntityNameFieldMap_3393e6146369 VARCHAR(255);
  p_RelatedEntityDisplayType_3393e6146369 VARCHAR(20);
  p_EntityIDFieldName_3393e6146369 VARCHAR(100);
  p_ScopeDefault_3393e6146369 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_3393e6146369 BOOLEAN;
  p_ValuesToPackWithSchema_3393e6146369 VARCHAR(10);
  p_Status_3393e6146369 VARCHAR(25);
  p_AutoUpdateIsNameField_3393e6146369 BOOLEAN;
  p_AutoUpdateDefaultInView_3393e6146369 BOOLEAN;
  p_AutoUpdateCategory_3393e6146369 BOOLEAN;
  p_AutoUpdateDisplayName_3393e6146369 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_3393e6146369 BOOLEAN;
  p_Encrypt_3393e6146369 BOOLEAN;
  p_EncryptionKeyID_3393e6146369 UUID;
  p_AllowDecryptInAPI_3393e6146369 BOOLEAN;
  p_SendEncryptedValue_3393e6146369 BOOLEAN;
  p_IsSoftPrimaryKey_3393e6146369 BOOLEAN;
  p_IsSoftForeignKey_3393e6146369 BOOLEAN;
  p_RelatedEntityJoinFields_3393e6146369 TEXT;
  p_JSONType_3393e6146369 VARCHAR(255);
  p_JSONTypeIsArray_3393e6146369 BOOLEAN;
  p_JSONTypeDefinition_3393e6146369 TEXT;
  p_UserSearchPredicateAPI_3393e6146369 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_3393e6146369 BOOLEAN;
  p_AutoUpdateFullTextSearch_3393e6146369 BOOLEAN;
  p_AutoUpdateExtendedType_3393e6146369 BOOLEAN;
  p_IsComputed_3393e6146369 BOOLEAN;
  p_EmbeddedRecord_3393e6146369 TEXT;
  p_Configuration_3393e6146369 TEXT;
  p_ID_3393e6146369 UUID;
BEGIN
  p_DisplayName_3393e6146369 := 'Source Created By User ID';
  p_Description_3393e6146369 := 'The login whose judgement is under review — the attester, booker or deal owner. This user may not clear the exception. NULL when there is none or it could not be resolved.';
  p_AutoUpdateDescription_3393e6146369 := TRUE;
  p_IsPrimaryKey_3393e6146369 := FALSE;
  p_IsUnique_3393e6146369 := FALSE;
  p_Category_3393e6146369 := 'Source';
  p_ValueListType_3393e6146369 := 'None';
  p_DefaultInView_3393e6146369 := FALSE;
  p_DefaultColumnWidth_3393e6146369 := 150;
  p_AllowUpdateAPI_3393e6146369 := TRUE;
  p_AllowUpdateInView_3393e6146369 := TRUE;
  p_IncludeInUserSearchAPI_3393e6146369 := FALSE;
  p_FullTextSearchEnabled_3393e6146369 := FALSE;
  p_IncludeInGeneratedForm_3393e6146369 := TRUE;
  p_GeneratedFormSection_3393e6146369 := 'Category';
  p_IsNameField_3393e6146369 := FALSE;
  p_RelatedEntityID_3393e6146369 := 'E1238F34-2837-EF11-86D4-6045BDEE16E6';
  p_RelatedEntityFieldName_3393e6146369 := 'ID';
  p_IncludeRelatedEntityNameFieldInBaseView_3393e6146369 := TRUE;
  p_RelatedEntityNameFieldMap_3393e6146369 := 'SourceCreatedByUser';
  p_RelatedEntityDisplayType_3393e6146369 := 'Search';
  p_AutoUpdateRelatedEntityInfo_3393e6146369 := TRUE;
  p_ValuesToPackWithSchema_3393e6146369 := 'Auto';
  p_Status_3393e6146369 := 'Active';
  p_AutoUpdateIsNameField_3393e6146369 := TRUE;
  p_AutoUpdateDefaultInView_3393e6146369 := TRUE;
  p_AutoUpdateCategory_3393e6146369 := TRUE;
  p_AutoUpdateDisplayName_3393e6146369 := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_3393e6146369 := TRUE;
  p_Encrypt_3393e6146369 := FALSE;
  p_AllowDecryptInAPI_3393e6146369 := FALSE;
  p_SendEncryptedValue_3393e6146369 := FALSE;
  p_IsSoftPrimaryKey_3393e6146369 := FALSE;
  p_IsSoftForeignKey_3393e6146369 := FALSE;
  p_JSONTypeIsArray_3393e6146369 := FALSE;
  p_UserSearchPredicateAPI_3393e6146369 := 'Contains';
  p_AutoUpdateUserSearchPredicate_3393e6146369 := TRUE;
  p_AutoUpdateFullTextSearch_3393e6146369 := TRUE;
  p_AutoUpdateExtendedType_3393e6146369 := TRUE;
  p_IsComputed_3393e6146369 := FALSE;
  p_ID_3393e6146369 := 'B97DCD2E-3201-4BCB-BDCE-0A261C721B0C';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM ${mjSchema}."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_3393e6146369,
    'Description', p_Description_3393e6146369,
    'AutoUpdateDescription', p_AutoUpdateDescription_3393e6146369,
    'IsPrimaryKey', p_IsPrimaryKey_3393e6146369,
    'IsUnique', p_IsUnique_3393e6146369,
    'Category', p_Category_3393e6146369,
    'ValueListType', p_ValueListType_3393e6146369,
    'ExtendedType', p_ExtendedType_3393e6146369,
    'CodeType', p_CodeType_3393e6146369,
    'DefaultInView', p_DefaultInView_3393e6146369,
    'ViewCellTemplate', p_ViewCellTemplate_3393e6146369,
    'DefaultColumnWidth', p_DefaultColumnWidth_3393e6146369,
    'AllowUpdateAPI', p_AllowUpdateAPI_3393e6146369,
    'AllowUpdateInView', p_AllowUpdateInView_3393e6146369,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_3393e6146369,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_3393e6146369,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_3393e6146369,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_3393e6146369,
    'GeneratedFormSection', p_GeneratedFormSection_3393e6146369,
    'IsNameField', p_IsNameField_3393e6146369,
    'RelatedEntityID', p_RelatedEntityID_3393e6146369,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_3393e6146369,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_3393e6146369,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_3393e6146369,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_3393e6146369,
    'EntityIDFieldName', p_EntityIDFieldName_3393e6146369,
    'ScopeDefault', p_ScopeDefault_3393e6146369,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_3393e6146369,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_3393e6146369,
    'Status', p_Status_3393e6146369,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_3393e6146369,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_3393e6146369,
    'AutoUpdateCategory', p_AutoUpdateCategory_3393e6146369,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_3393e6146369,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_3393e6146369,
    'Encrypt', p_Encrypt_3393e6146369,
    'EncryptionKeyID', p_EncryptionKeyID_3393e6146369,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_3393e6146369,
    'SendEncryptedValue', p_SendEncryptedValue_3393e6146369,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_3393e6146369,
    'IsSoftForeignKey', p_IsSoftForeignKey_3393e6146369,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_3393e6146369,
    'JSONType', p_JSONType_3393e6146369,
    'JSONTypeIsArray', p_JSONTypeIsArray_3393e6146369,
    'JSONTypeDefinition', p_JSONTypeDefinition_3393e6146369,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_3393e6146369,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_3393e6146369,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_3393e6146369,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_3393e6146369,
    'IsComputed', p_IsComputed_3393e6146369
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_3393e6146369,
    'Configuration', p_Configuration_3393e6146369,
    'ID', p_ID_3393e6146369
  ));
  ELSE
    PERFORM ${mjSchema}."spUpdateEntityField"(p_DisplayName := p_DisplayName_3393e6146369, p_Description := p_Description_3393e6146369, p_AutoUpdateDescription := p_AutoUpdateDescription_3393e6146369, p_IsPrimaryKey := p_IsPrimaryKey_3393e6146369, p_IsUnique := p_IsUnique_3393e6146369, p_Category := p_Category_3393e6146369, p_ValueListType := p_ValueListType_3393e6146369, p_ExtendedType := p_ExtendedType_3393e6146369, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_3393e6146369, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_3393e6146369, p_ViewCellTemplate := p_ViewCellTemplate_3393e6146369, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_3393e6146369, p_AllowUpdateAPI := p_AllowUpdateAPI_3393e6146369, p_AllowUpdateInView := p_AllowUpdateInView_3393e6146369, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_3393e6146369, p_FullTextSearchEnabled := p_FullTextSearchEnabled_3393e6146369, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_3393e6146369, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_3393e6146369, p_GeneratedFormSection := p_GeneratedFormSection_3393e6146369, p_IsNameField := p_IsNameField_3393e6146369, p_RelatedEntityID := p_RelatedEntityID_3393e6146369, p_RelatedEntityFieldName := p_RelatedEntityFieldName_3393e6146369, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_3393e6146369, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_3393e6146369, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_3393e6146369, p_EntityIDFieldName := p_EntityIDFieldName_3393e6146369, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_3393e6146369, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_3393e6146369, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_3393e6146369, p_Status := p_Status_3393e6146369, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_3393e6146369, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_3393e6146369, p_AutoUpdateCategory := p_AutoUpdateCategory_3393e6146369, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_3393e6146369, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_3393e6146369, p_Encrypt := p_Encrypt_3393e6146369, p_EncryptionKeyID := p_EncryptionKeyID_3393e6146369, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_3393e6146369, p_SendEncryptedValue := p_SendEncryptedValue_3393e6146369, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_3393e6146369, p_IsSoftForeignKey := p_IsSoftForeignKey_3393e6146369, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_3393e6146369, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_3393e6146369, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_3393e6146369, p_JSONTypeDefinition := p_JSONTypeDefinition_3393e6146369, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_3393e6146369, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_3393e6146369, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_3393e6146369, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_3393e6146369, p_IsComputed := p_IsComputed_3393e6146369, p_EmbeddedRecord := p_EmbeddedRecord_3393e6146369, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_3393e6146369, p_Configuration_Clear := TRUE, p_ID := p_ID_3393e6146369);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_5d17f5c93359 VARCHAR(255);
  p_Description_5d17f5c93359 TEXT;
  p_AutoUpdateDescription_5d17f5c93359 BOOLEAN;
  p_IsPrimaryKey_5d17f5c93359 BOOLEAN;
  p_IsUnique_5d17f5c93359 BOOLEAN;
  p_Category_5d17f5c93359 VARCHAR(255);
  p_ValueListType_5d17f5c93359 VARCHAR(20);
  p_ExtendedType_5d17f5c93359 VARCHAR(50);
  p_CodeType_5d17f5c93359 VARCHAR(50);
  p_DefaultInView_5d17f5c93359 BOOLEAN;
  p_ViewCellTemplate_5d17f5c93359 TEXT;
  p_DefaultColumnWidth_5d17f5c93359 INTEGER;
  p_AllowUpdateAPI_5d17f5c93359 BOOLEAN;
  p_AllowUpdateInView_5d17f5c93359 BOOLEAN;
  p_IncludeInUserSearchAPI_5d17f5c93359 BOOLEAN;
  p_FullTextSearchEnabled_5d17f5c93359 BOOLEAN;
  p_UserSearchParamFormatAPI_5d17f5c93359 VARCHAR(500);
  p_IncludeInGeneratedForm_5d17f5c93359 BOOLEAN;
  p_GeneratedFormSection_5d17f5c93359 VARCHAR(10);
  p_IsNameField_5d17f5c93359 BOOLEAN;
  p_RelatedEntityID_5d17f5c93359 UUID;
  p_RelatedEntityFieldName_5d17f5c93359 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_5d17f5c93359 BOOLEAN;
  p_RelatedEntityNameFieldMap_5d17f5c93359 VARCHAR(255);
  p_RelatedEntityDisplayType_5d17f5c93359 VARCHAR(20);
  p_EntityIDFieldName_5d17f5c93359 VARCHAR(100);
  p_ScopeDefault_5d17f5c93359 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_5d17f5c93359 BOOLEAN;
  p_ValuesToPackWithSchema_5d17f5c93359 VARCHAR(10);
  p_Status_5d17f5c93359 VARCHAR(25);
  p_AutoUpdateIsNameField_5d17f5c93359 BOOLEAN;
  p_AutoUpdateDefaultInView_5d17f5c93359 BOOLEAN;
  p_AutoUpdateCategory_5d17f5c93359 BOOLEAN;
  p_AutoUpdateDisplayName_5d17f5c93359 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_5d17f5c93359 BOOLEAN;
  p_Encrypt_5d17f5c93359 BOOLEAN;
  p_EncryptionKeyID_5d17f5c93359 UUID;
  p_AllowDecryptInAPI_5d17f5c93359 BOOLEAN;
  p_SendEncryptedValue_5d17f5c93359 BOOLEAN;
  p_IsSoftPrimaryKey_5d17f5c93359 BOOLEAN;
  p_IsSoftForeignKey_5d17f5c93359 BOOLEAN;
  p_RelatedEntityJoinFields_5d17f5c93359 TEXT;
  p_JSONType_5d17f5c93359 VARCHAR(255);
  p_JSONTypeIsArray_5d17f5c93359 BOOLEAN;
  p_JSONTypeDefinition_5d17f5c93359 TEXT;
  p_UserSearchPredicateAPI_5d17f5c93359 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_5d17f5c93359 BOOLEAN;
  p_AutoUpdateFullTextSearch_5d17f5c93359 BOOLEAN;
  p_AutoUpdateExtendedType_5d17f5c93359 BOOLEAN;
  p_IsComputed_5d17f5c93359 BOOLEAN;
  p_EmbeddedRecord_5d17f5c93359 TEXT;
  p_Configuration_5d17f5c93359 TEXT;
  p_ID_5d17f5c93359 UUID;
BEGIN
  p_DisplayName_5d17f5c93359 := 'Creator Unresolved';
  p_Description_5d17f5c93359 := '1 = the source record has a creator who has no linked login, so separation of duties cannot be checked and the exception cannot be cleared until that is resolved.';
  p_AutoUpdateDescription_5d17f5c93359 := TRUE;
  p_IsPrimaryKey_5d17f5c93359 := FALSE;
  p_IsUnique_5d17f5c93359 := FALSE;
  p_Category_5d17f5c93359 := 'Source';
  p_ValueListType_5d17f5c93359 := 'None';
  p_DefaultInView_5d17f5c93359 := FALSE;
  p_DefaultColumnWidth_5d17f5c93359 := 150;
  p_AllowUpdateAPI_5d17f5c93359 := TRUE;
  p_AllowUpdateInView_5d17f5c93359 := TRUE;
  p_IncludeInUserSearchAPI_5d17f5c93359 := FALSE;
  p_FullTextSearchEnabled_5d17f5c93359 := FALSE;
  p_IncludeInGeneratedForm_5d17f5c93359 := TRUE;
  p_GeneratedFormSection_5d17f5c93359 := 'Category';
  p_IsNameField_5d17f5c93359 := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_5d17f5c93359 := FALSE;
  p_RelatedEntityDisplayType_5d17f5c93359 := 'Search';
  p_AutoUpdateRelatedEntityInfo_5d17f5c93359 := TRUE;
  p_ValuesToPackWithSchema_5d17f5c93359 := 'Auto';
  p_Status_5d17f5c93359 := 'Active';
  p_AutoUpdateIsNameField_5d17f5c93359 := TRUE;
  p_AutoUpdateDefaultInView_5d17f5c93359 := TRUE;
  p_AutoUpdateCategory_5d17f5c93359 := TRUE;
  p_AutoUpdateDisplayName_5d17f5c93359 := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_5d17f5c93359 := TRUE;
  p_Encrypt_5d17f5c93359 := FALSE;
  p_AllowDecryptInAPI_5d17f5c93359 := FALSE;
  p_SendEncryptedValue_5d17f5c93359 := FALSE;
  p_IsSoftPrimaryKey_5d17f5c93359 := FALSE;
  p_IsSoftForeignKey_5d17f5c93359 := FALSE;
  p_JSONTypeIsArray_5d17f5c93359 := FALSE;
  p_UserSearchPredicateAPI_5d17f5c93359 := 'Contains';
  p_AutoUpdateUserSearchPredicate_5d17f5c93359 := TRUE;
  p_AutoUpdateFullTextSearch_5d17f5c93359 := TRUE;
  p_AutoUpdateExtendedType_5d17f5c93359 := TRUE;
  p_IsComputed_5d17f5c93359 := FALSE;
  p_ID_5d17f5c93359 := '65F4AC62-A691-4655-BDF7-E4A6D8528FB2';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM ${mjSchema}."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_5d17f5c93359,
    'Description', p_Description_5d17f5c93359,
    'AutoUpdateDescription', p_AutoUpdateDescription_5d17f5c93359,
    'IsPrimaryKey', p_IsPrimaryKey_5d17f5c93359,
    'IsUnique', p_IsUnique_5d17f5c93359,
    'Category', p_Category_5d17f5c93359,
    'ValueListType', p_ValueListType_5d17f5c93359,
    'ExtendedType', p_ExtendedType_5d17f5c93359,
    'CodeType', p_CodeType_5d17f5c93359,
    'DefaultInView', p_DefaultInView_5d17f5c93359,
    'ViewCellTemplate', p_ViewCellTemplate_5d17f5c93359,
    'DefaultColumnWidth', p_DefaultColumnWidth_5d17f5c93359,
    'AllowUpdateAPI', p_AllowUpdateAPI_5d17f5c93359,
    'AllowUpdateInView', p_AllowUpdateInView_5d17f5c93359,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_5d17f5c93359,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_5d17f5c93359,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_5d17f5c93359,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_5d17f5c93359,
    'GeneratedFormSection', p_GeneratedFormSection_5d17f5c93359,
    'IsNameField', p_IsNameField_5d17f5c93359,
    'RelatedEntityID', p_RelatedEntityID_5d17f5c93359,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_5d17f5c93359,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_5d17f5c93359,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_5d17f5c93359,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_5d17f5c93359,
    'EntityIDFieldName', p_EntityIDFieldName_5d17f5c93359,
    'ScopeDefault', p_ScopeDefault_5d17f5c93359,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_5d17f5c93359,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_5d17f5c93359,
    'Status', p_Status_5d17f5c93359,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_5d17f5c93359,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_5d17f5c93359,
    'AutoUpdateCategory', p_AutoUpdateCategory_5d17f5c93359,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_5d17f5c93359,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_5d17f5c93359,
    'Encrypt', p_Encrypt_5d17f5c93359,
    'EncryptionKeyID', p_EncryptionKeyID_5d17f5c93359,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_5d17f5c93359,
    'SendEncryptedValue', p_SendEncryptedValue_5d17f5c93359,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_5d17f5c93359,
    'IsSoftForeignKey', p_IsSoftForeignKey_5d17f5c93359,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_5d17f5c93359,
    'JSONType', p_JSONType_5d17f5c93359,
    'JSONTypeIsArray', p_JSONTypeIsArray_5d17f5c93359,
    'JSONTypeDefinition', p_JSONTypeDefinition_5d17f5c93359,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_5d17f5c93359,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_5d17f5c93359,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_5d17f5c93359,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_5d17f5c93359,
    'IsComputed', p_IsComputed_5d17f5c93359
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_5d17f5c93359,
    'Configuration', p_Configuration_5d17f5c93359,
    'ID', p_ID_5d17f5c93359
  ));
  ELSE
    PERFORM ${mjSchema}."spUpdateEntityField"(p_DisplayName := p_DisplayName_5d17f5c93359, p_Description := p_Description_5d17f5c93359, p_AutoUpdateDescription := p_AutoUpdateDescription_5d17f5c93359, p_IsPrimaryKey := p_IsPrimaryKey_5d17f5c93359, p_IsUnique := p_IsUnique_5d17f5c93359, p_Category := p_Category_5d17f5c93359, p_ValueListType := p_ValueListType_5d17f5c93359, p_ExtendedType := p_ExtendedType_5d17f5c93359, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_5d17f5c93359, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_5d17f5c93359, p_ViewCellTemplate := p_ViewCellTemplate_5d17f5c93359, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_5d17f5c93359, p_AllowUpdateAPI := p_AllowUpdateAPI_5d17f5c93359, p_AllowUpdateInView := p_AllowUpdateInView_5d17f5c93359, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_5d17f5c93359, p_FullTextSearchEnabled := p_FullTextSearchEnabled_5d17f5c93359, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_5d17f5c93359, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_5d17f5c93359, p_GeneratedFormSection := p_GeneratedFormSection_5d17f5c93359, p_IsNameField := p_IsNameField_5d17f5c93359, p_RelatedEntityID := p_RelatedEntityID_5d17f5c93359, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_5d17f5c93359, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_5d17f5c93359, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_5d17f5c93359, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_5d17f5c93359, p_EntityIDFieldName := p_EntityIDFieldName_5d17f5c93359, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_5d17f5c93359, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_5d17f5c93359, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_5d17f5c93359, p_Status := p_Status_5d17f5c93359, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_5d17f5c93359, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_5d17f5c93359, p_AutoUpdateCategory := p_AutoUpdateCategory_5d17f5c93359, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_5d17f5c93359, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_5d17f5c93359, p_Encrypt := p_Encrypt_5d17f5c93359, p_EncryptionKeyID := p_EncryptionKeyID_5d17f5c93359, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_5d17f5c93359, p_SendEncryptedValue := p_SendEncryptedValue_5d17f5c93359, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_5d17f5c93359, p_IsSoftForeignKey := p_IsSoftForeignKey_5d17f5c93359, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_5d17f5c93359, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_5d17f5c93359, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_5d17f5c93359, p_JSONTypeDefinition := p_JSONTypeDefinition_5d17f5c93359, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_5d17f5c93359, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_5d17f5c93359, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_5d17f5c93359, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_5d17f5c93359, p_IsComputed := p_IsComputed_5d17f5c93359, p_EmbeddedRecord := p_EmbeddedRecord_5d17f5c93359, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_5d17f5c93359, p_Configuration_Clear := TRUE, p_ID := p_ID_5d17f5c93359);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_84656e86c6c2 VARCHAR(255);
  p_Description_84656e86c6c2 TEXT;
  p_AutoUpdateDescription_84656e86c6c2 BOOLEAN;
  p_IsPrimaryKey_84656e86c6c2 BOOLEAN;
  p_IsUnique_84656e86c6c2 BOOLEAN;
  p_Category_84656e86c6c2 VARCHAR(255);
  p_ValueListType_84656e86c6c2 VARCHAR(20);
  p_ExtendedType_84656e86c6c2 VARCHAR(50);
  p_CodeType_84656e86c6c2 VARCHAR(50);
  p_DefaultInView_84656e86c6c2 BOOLEAN;
  p_ViewCellTemplate_84656e86c6c2 TEXT;
  p_DefaultColumnWidth_84656e86c6c2 INTEGER;
  p_AllowUpdateAPI_84656e86c6c2 BOOLEAN;
  p_AllowUpdateInView_84656e86c6c2 BOOLEAN;
  p_IncludeInUserSearchAPI_84656e86c6c2 BOOLEAN;
  p_FullTextSearchEnabled_84656e86c6c2 BOOLEAN;
  p_UserSearchParamFormatAPI_84656e86c6c2 VARCHAR(500);
  p_IncludeInGeneratedForm_84656e86c6c2 BOOLEAN;
  p_GeneratedFormSection_84656e86c6c2 VARCHAR(10);
  p_IsNameField_84656e86c6c2 BOOLEAN;
  p_RelatedEntityID_84656e86c6c2 UUID;
  p_RelatedEntityFieldName_84656e86c6c2 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_84656e86c6c2 BOOLEAN;
  p_RelatedEntityNameFieldMap_84656e86c6c2 VARCHAR(255);
  p_RelatedEntityDisplayType_84656e86c6c2 VARCHAR(20);
  p_EntityIDFieldName_84656e86c6c2 VARCHAR(100);
  p_ScopeDefault_84656e86c6c2 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_84656e86c6c2 BOOLEAN;
  p_ValuesToPackWithSchema_84656e86c6c2 VARCHAR(10);
  p_Status_84656e86c6c2 VARCHAR(25);
  p_AutoUpdateIsNameField_84656e86c6c2 BOOLEAN;
  p_AutoUpdateDefaultInView_84656e86c6c2 BOOLEAN;
  p_AutoUpdateCategory_84656e86c6c2 BOOLEAN;
  p_AutoUpdateDisplayName_84656e86c6c2 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_84656e86c6c2 BOOLEAN;
  p_Encrypt_84656e86c6c2 BOOLEAN;
  p_EncryptionKeyID_84656e86c6c2 UUID;
  p_AllowDecryptInAPI_84656e86c6c2 BOOLEAN;
  p_SendEncryptedValue_84656e86c6c2 BOOLEAN;
  p_IsSoftPrimaryKey_84656e86c6c2 BOOLEAN;
  p_IsSoftForeignKey_84656e86c6c2 BOOLEAN;
  p_RelatedEntityJoinFields_84656e86c6c2 TEXT;
  p_JSONType_84656e86c6c2 VARCHAR(255);
  p_JSONTypeIsArray_84656e86c6c2 BOOLEAN;
  p_JSONTypeDefinition_84656e86c6c2 TEXT;
  p_UserSearchPredicateAPI_84656e86c6c2 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_84656e86c6c2 BOOLEAN;
  p_AutoUpdateFullTextSearch_84656e86c6c2 BOOLEAN;
  p_AutoUpdateExtendedType_84656e86c6c2 BOOLEAN;
  p_IsComputed_84656e86c6c2 BOOLEAN;
  p_EmbeddedRecord_84656e86c6c2 TEXT;
  p_Configuration_84656e86c6c2 TEXT;
  p_ID_84656e86c6c2 UUID;
BEGIN
  p_DisplayName_84656e86c6c2 := 'Detected At';
  p_Description_84656e86c6c2 := 'When the exception was raised (UTC).';
  p_AutoUpdateDescription_84656e86c6c2 := TRUE;
  p_IsPrimaryKey_84656e86c6c2 := FALSE;
  p_IsUnique_84656e86c6c2 := FALSE;
  p_Category_84656e86c6c2 := 'Source';
  p_ValueListType_84656e86c6c2 := 'None';
  p_DefaultInView_84656e86c6c2 := FALSE;
  p_DefaultColumnWidth_84656e86c6c2 := 100;
  p_AllowUpdateAPI_84656e86c6c2 := TRUE;
  p_AllowUpdateInView_84656e86c6c2 := TRUE;
  p_IncludeInUserSearchAPI_84656e86c6c2 := FALSE;
  p_FullTextSearchEnabled_84656e86c6c2 := FALSE;
  p_IncludeInGeneratedForm_84656e86c6c2 := TRUE;
  p_GeneratedFormSection_84656e86c6c2 := 'Category';
  p_IsNameField_84656e86c6c2 := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_84656e86c6c2 := FALSE;
  p_RelatedEntityDisplayType_84656e86c6c2 := 'Search';
  p_AutoUpdateRelatedEntityInfo_84656e86c6c2 := TRUE;
  p_ValuesToPackWithSchema_84656e86c6c2 := 'Auto';
  p_Status_84656e86c6c2 := 'Active';
  p_AutoUpdateIsNameField_84656e86c6c2 := TRUE;
  p_AutoUpdateDefaultInView_84656e86c6c2 := TRUE;
  p_AutoUpdateCategory_84656e86c6c2 := TRUE;
  p_AutoUpdateDisplayName_84656e86c6c2 := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_84656e86c6c2 := TRUE;
  p_Encrypt_84656e86c6c2 := FALSE;
  p_AllowDecryptInAPI_84656e86c6c2 := FALSE;
  p_SendEncryptedValue_84656e86c6c2 := FALSE;
  p_IsSoftPrimaryKey_84656e86c6c2 := FALSE;
  p_IsSoftForeignKey_84656e86c6c2 := FALSE;
  p_JSONTypeIsArray_84656e86c6c2 := FALSE;
  p_UserSearchPredicateAPI_84656e86c6c2 := 'Contains';
  p_AutoUpdateUserSearchPredicate_84656e86c6c2 := TRUE;
  p_AutoUpdateFullTextSearch_84656e86c6c2 := TRUE;
  p_AutoUpdateExtendedType_84656e86c6c2 := TRUE;
  p_IsComputed_84656e86c6c2 := FALSE;
  p_ID_84656e86c6c2 := '5A05BD54-F1A3-489C-BAFA-5D97795D0F35';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM ${mjSchema}."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_84656e86c6c2,
    'Description', p_Description_84656e86c6c2,
    'AutoUpdateDescription', p_AutoUpdateDescription_84656e86c6c2,
    'IsPrimaryKey', p_IsPrimaryKey_84656e86c6c2,
    'IsUnique', p_IsUnique_84656e86c6c2,
    'Category', p_Category_84656e86c6c2,
    'ValueListType', p_ValueListType_84656e86c6c2,
    'ExtendedType', p_ExtendedType_84656e86c6c2,
    'CodeType', p_CodeType_84656e86c6c2,
    'DefaultInView', p_DefaultInView_84656e86c6c2,
    'ViewCellTemplate', p_ViewCellTemplate_84656e86c6c2,
    'DefaultColumnWidth', p_DefaultColumnWidth_84656e86c6c2,
    'AllowUpdateAPI', p_AllowUpdateAPI_84656e86c6c2,
    'AllowUpdateInView', p_AllowUpdateInView_84656e86c6c2,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_84656e86c6c2,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_84656e86c6c2,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_84656e86c6c2,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_84656e86c6c2,
    'GeneratedFormSection', p_GeneratedFormSection_84656e86c6c2,
    'IsNameField', p_IsNameField_84656e86c6c2,
    'RelatedEntityID', p_RelatedEntityID_84656e86c6c2,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_84656e86c6c2,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_84656e86c6c2,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_84656e86c6c2,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_84656e86c6c2,
    'EntityIDFieldName', p_EntityIDFieldName_84656e86c6c2,
    'ScopeDefault', p_ScopeDefault_84656e86c6c2,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_84656e86c6c2,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_84656e86c6c2,
    'Status', p_Status_84656e86c6c2,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_84656e86c6c2,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_84656e86c6c2,
    'AutoUpdateCategory', p_AutoUpdateCategory_84656e86c6c2,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_84656e86c6c2,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_84656e86c6c2,
    'Encrypt', p_Encrypt_84656e86c6c2,
    'EncryptionKeyID', p_EncryptionKeyID_84656e86c6c2,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_84656e86c6c2,
    'SendEncryptedValue', p_SendEncryptedValue_84656e86c6c2,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_84656e86c6c2,
    'IsSoftForeignKey', p_IsSoftForeignKey_84656e86c6c2,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_84656e86c6c2,
    'JSONType', p_JSONType_84656e86c6c2,
    'JSONTypeIsArray', p_JSONTypeIsArray_84656e86c6c2,
    'JSONTypeDefinition', p_JSONTypeDefinition_84656e86c6c2,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_84656e86c6c2,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_84656e86c6c2,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_84656e86c6c2,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_84656e86c6c2,
    'IsComputed', p_IsComputed_84656e86c6c2
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_84656e86c6c2,
    'Configuration', p_Configuration_84656e86c6c2,
    'ID', p_ID_84656e86c6c2
  ));
  ELSE
    PERFORM ${mjSchema}."spUpdateEntityField"(p_DisplayName := p_DisplayName_84656e86c6c2, p_Description := p_Description_84656e86c6c2, p_AutoUpdateDescription := p_AutoUpdateDescription_84656e86c6c2, p_IsPrimaryKey := p_IsPrimaryKey_84656e86c6c2, p_IsUnique := p_IsUnique_84656e86c6c2, p_Category := p_Category_84656e86c6c2, p_ValueListType := p_ValueListType_84656e86c6c2, p_ExtendedType := p_ExtendedType_84656e86c6c2, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_84656e86c6c2, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_84656e86c6c2, p_ViewCellTemplate := p_ViewCellTemplate_84656e86c6c2, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_84656e86c6c2, p_AllowUpdateAPI := p_AllowUpdateAPI_84656e86c6c2, p_AllowUpdateInView := p_AllowUpdateInView_84656e86c6c2, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_84656e86c6c2, p_FullTextSearchEnabled := p_FullTextSearchEnabled_84656e86c6c2, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_84656e86c6c2, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_84656e86c6c2, p_GeneratedFormSection := p_GeneratedFormSection_84656e86c6c2, p_IsNameField := p_IsNameField_84656e86c6c2, p_RelatedEntityID := p_RelatedEntityID_84656e86c6c2, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_84656e86c6c2, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_84656e86c6c2, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_84656e86c6c2, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_84656e86c6c2, p_EntityIDFieldName := p_EntityIDFieldName_84656e86c6c2, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_84656e86c6c2, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_84656e86c6c2, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_84656e86c6c2, p_Status := p_Status_84656e86c6c2, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_84656e86c6c2, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_84656e86c6c2, p_AutoUpdateCategory := p_AutoUpdateCategory_84656e86c6c2, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_84656e86c6c2, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_84656e86c6c2, p_Encrypt := p_Encrypt_84656e86c6c2, p_EncryptionKeyID := p_EncryptionKeyID_84656e86c6c2, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_84656e86c6c2, p_SendEncryptedValue := p_SendEncryptedValue_84656e86c6c2, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_84656e86c6c2, p_IsSoftForeignKey := p_IsSoftForeignKey_84656e86c6c2, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_84656e86c6c2, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_84656e86c6c2, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_84656e86c6c2, p_JSONTypeDefinition := p_JSONTypeDefinition_84656e86c6c2, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_84656e86c6c2, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_84656e86c6c2, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_84656e86c6c2, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_84656e86c6c2, p_IsComputed := p_IsComputed_84656e86c6c2, p_EmbeddedRecord := p_EmbeddedRecord_84656e86c6c2, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_84656e86c6c2, p_Configuration_Clear := TRUE, p_ID := p_ID_84656e86c6c2);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_17bcab8d3306 VARCHAR(255);
  p_Description_17bcab8d3306 TEXT;
  p_AutoUpdateDescription_17bcab8d3306 BOOLEAN;
  p_IsPrimaryKey_17bcab8d3306 BOOLEAN;
  p_IsUnique_17bcab8d3306 BOOLEAN;
  p_Category_17bcab8d3306 VARCHAR(255);
  p_ValueListType_17bcab8d3306 VARCHAR(20);
  p_ExtendedType_17bcab8d3306 VARCHAR(50);
  p_CodeType_17bcab8d3306 VARCHAR(50);
  p_DefaultInView_17bcab8d3306 BOOLEAN;
  p_ViewCellTemplate_17bcab8d3306 TEXT;
  p_DefaultColumnWidth_17bcab8d3306 INTEGER;
  p_AllowUpdateAPI_17bcab8d3306 BOOLEAN;
  p_AllowUpdateInView_17bcab8d3306 BOOLEAN;
  p_IncludeInUserSearchAPI_17bcab8d3306 BOOLEAN;
  p_FullTextSearchEnabled_17bcab8d3306 BOOLEAN;
  p_UserSearchParamFormatAPI_17bcab8d3306 VARCHAR(500);
  p_IncludeInGeneratedForm_17bcab8d3306 BOOLEAN;
  p_GeneratedFormSection_17bcab8d3306 VARCHAR(10);
  p_IsNameField_17bcab8d3306 BOOLEAN;
  p_RelatedEntityID_17bcab8d3306 UUID;
  p_RelatedEntityFieldName_17bcab8d3306 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_17bcab8d3306 BOOLEAN;
  p_RelatedEntityNameFieldMap_17bcab8d3306 VARCHAR(255);
  p_RelatedEntityDisplayType_17bcab8d3306 VARCHAR(20);
  p_EntityIDFieldName_17bcab8d3306 VARCHAR(100);
  p_ScopeDefault_17bcab8d3306 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_17bcab8d3306 BOOLEAN;
  p_ValuesToPackWithSchema_17bcab8d3306 VARCHAR(10);
  p_Status_17bcab8d3306 VARCHAR(25);
  p_AutoUpdateIsNameField_17bcab8d3306 BOOLEAN;
  p_AutoUpdateDefaultInView_17bcab8d3306 BOOLEAN;
  p_AutoUpdateCategory_17bcab8d3306 BOOLEAN;
  p_AutoUpdateDisplayName_17bcab8d3306 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_17bcab8d3306 BOOLEAN;
  p_Encrypt_17bcab8d3306 BOOLEAN;
  p_EncryptionKeyID_17bcab8d3306 UUID;
  p_AllowDecryptInAPI_17bcab8d3306 BOOLEAN;
  p_SendEncryptedValue_17bcab8d3306 BOOLEAN;
  p_IsSoftPrimaryKey_17bcab8d3306 BOOLEAN;
  p_IsSoftForeignKey_17bcab8d3306 BOOLEAN;
  p_RelatedEntityJoinFields_17bcab8d3306 TEXT;
  p_JSONType_17bcab8d3306 VARCHAR(255);
  p_JSONTypeIsArray_17bcab8d3306 BOOLEAN;
  p_JSONTypeDefinition_17bcab8d3306 TEXT;
  p_UserSearchPredicateAPI_17bcab8d3306 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_17bcab8d3306 BOOLEAN;
  p_AutoUpdateFullTextSearch_17bcab8d3306 BOOLEAN;
  p_AutoUpdateExtendedType_17bcab8d3306 BOOLEAN;
  p_IsComputed_17bcab8d3306 BOOLEAN;
  p_EmbeddedRecord_17bcab8d3306 TEXT;
  p_Configuration_17bcab8d3306 TEXT;
  p_ID_17bcab8d3306 UUID;
BEGIN
  p_DisplayName_17bcab8d3306 := 'Status';
  p_Description_17bcab8d3306 := 'Open until cleared. Reviewed: the judgement stands. Corrected: the data was fixed. Both are terminal and reachable only through Accounting.ClearFinanceException.';
  p_AutoUpdateDescription_17bcab8d3306 := TRUE;
  p_IsPrimaryKey_17bcab8d3306 := FALSE;
  p_IsUnique_17bcab8d3306 := FALSE;
  p_Category_17bcab8d3306 := 'Review';
  p_ValueListType_17bcab8d3306 := 'List';
  p_DefaultInView_17bcab8d3306 := FALSE;
  p_DefaultColumnWidth_17bcab8d3306 := 150;
  p_AllowUpdateAPI_17bcab8d3306 := TRUE;
  p_AllowUpdateInView_17bcab8d3306 := TRUE;
  p_IncludeInUserSearchAPI_17bcab8d3306 := FALSE;
  p_FullTextSearchEnabled_17bcab8d3306 := FALSE;
  p_IncludeInGeneratedForm_17bcab8d3306 := TRUE;
  p_GeneratedFormSection_17bcab8d3306 := 'Category';
  p_IsNameField_17bcab8d3306 := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_17bcab8d3306 := FALSE;
  p_RelatedEntityDisplayType_17bcab8d3306 := 'Search';
  p_AutoUpdateRelatedEntityInfo_17bcab8d3306 := TRUE;
  p_ValuesToPackWithSchema_17bcab8d3306 := 'Auto';
  p_Status_17bcab8d3306 := 'Active';
  p_AutoUpdateIsNameField_17bcab8d3306 := TRUE;
  p_AutoUpdateDefaultInView_17bcab8d3306 := TRUE;
  p_AutoUpdateCategory_17bcab8d3306 := TRUE;
  p_AutoUpdateDisplayName_17bcab8d3306 := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_17bcab8d3306 := TRUE;
  p_Encrypt_17bcab8d3306 := FALSE;
  p_AllowDecryptInAPI_17bcab8d3306 := FALSE;
  p_SendEncryptedValue_17bcab8d3306 := FALSE;
  p_IsSoftPrimaryKey_17bcab8d3306 := FALSE;
  p_IsSoftForeignKey_17bcab8d3306 := FALSE;
  p_JSONTypeIsArray_17bcab8d3306 := FALSE;
  p_UserSearchPredicateAPI_17bcab8d3306 := 'Contains';
  p_AutoUpdateUserSearchPredicate_17bcab8d3306 := TRUE;
  p_AutoUpdateFullTextSearch_17bcab8d3306 := TRUE;
  p_AutoUpdateExtendedType_17bcab8d3306 := TRUE;
  p_IsComputed_17bcab8d3306 := FALSE;
  p_ID_17bcab8d3306 := 'B9C8E505-9F11-4641-9379-746EF6EA83A3';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM ${mjSchema}."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_17bcab8d3306,
    'Description', p_Description_17bcab8d3306,
    'AutoUpdateDescription', p_AutoUpdateDescription_17bcab8d3306,
    'IsPrimaryKey', p_IsPrimaryKey_17bcab8d3306,
    'IsUnique', p_IsUnique_17bcab8d3306,
    'Category', p_Category_17bcab8d3306,
    'ValueListType', p_ValueListType_17bcab8d3306,
    'ExtendedType', p_ExtendedType_17bcab8d3306,
    'CodeType', p_CodeType_17bcab8d3306,
    'DefaultInView', p_DefaultInView_17bcab8d3306,
    'ViewCellTemplate', p_ViewCellTemplate_17bcab8d3306,
    'DefaultColumnWidth', p_DefaultColumnWidth_17bcab8d3306,
    'AllowUpdateAPI', p_AllowUpdateAPI_17bcab8d3306,
    'AllowUpdateInView', p_AllowUpdateInView_17bcab8d3306,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_17bcab8d3306,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_17bcab8d3306,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_17bcab8d3306,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_17bcab8d3306,
    'GeneratedFormSection', p_GeneratedFormSection_17bcab8d3306,
    'IsNameField', p_IsNameField_17bcab8d3306,
    'RelatedEntityID', p_RelatedEntityID_17bcab8d3306,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_17bcab8d3306,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_17bcab8d3306,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_17bcab8d3306,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_17bcab8d3306,
    'EntityIDFieldName', p_EntityIDFieldName_17bcab8d3306,
    'ScopeDefault', p_ScopeDefault_17bcab8d3306,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_17bcab8d3306,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_17bcab8d3306,
    'Status', p_Status_17bcab8d3306,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_17bcab8d3306,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_17bcab8d3306,
    'AutoUpdateCategory', p_AutoUpdateCategory_17bcab8d3306,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_17bcab8d3306,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_17bcab8d3306,
    'Encrypt', p_Encrypt_17bcab8d3306,
    'EncryptionKeyID', p_EncryptionKeyID_17bcab8d3306,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_17bcab8d3306,
    'SendEncryptedValue', p_SendEncryptedValue_17bcab8d3306,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_17bcab8d3306,
    'IsSoftForeignKey', p_IsSoftForeignKey_17bcab8d3306,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_17bcab8d3306,
    'JSONType', p_JSONType_17bcab8d3306,
    'JSONTypeIsArray', p_JSONTypeIsArray_17bcab8d3306,
    'JSONTypeDefinition', p_JSONTypeDefinition_17bcab8d3306,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_17bcab8d3306,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_17bcab8d3306,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_17bcab8d3306,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_17bcab8d3306,
    'IsComputed', p_IsComputed_17bcab8d3306
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_17bcab8d3306,
    'Configuration', p_Configuration_17bcab8d3306,
    'ID', p_ID_17bcab8d3306
  ));
  ELSE
    PERFORM ${mjSchema}."spUpdateEntityField"(p_DisplayName := p_DisplayName_17bcab8d3306, p_Description := p_Description_17bcab8d3306, p_AutoUpdateDescription := p_AutoUpdateDescription_17bcab8d3306, p_IsPrimaryKey := p_IsPrimaryKey_17bcab8d3306, p_IsUnique := p_IsUnique_17bcab8d3306, p_Category := p_Category_17bcab8d3306, p_ValueListType := p_ValueListType_17bcab8d3306, p_ExtendedType := p_ExtendedType_17bcab8d3306, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_17bcab8d3306, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_17bcab8d3306, p_ViewCellTemplate := p_ViewCellTemplate_17bcab8d3306, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_17bcab8d3306, p_AllowUpdateAPI := p_AllowUpdateAPI_17bcab8d3306, p_AllowUpdateInView := p_AllowUpdateInView_17bcab8d3306, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_17bcab8d3306, p_FullTextSearchEnabled := p_FullTextSearchEnabled_17bcab8d3306, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_17bcab8d3306, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_17bcab8d3306, p_GeneratedFormSection := p_GeneratedFormSection_17bcab8d3306, p_IsNameField := p_IsNameField_17bcab8d3306, p_RelatedEntityID := p_RelatedEntityID_17bcab8d3306, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_17bcab8d3306, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_17bcab8d3306, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_17bcab8d3306, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_17bcab8d3306, p_EntityIDFieldName := p_EntityIDFieldName_17bcab8d3306, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_17bcab8d3306, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_17bcab8d3306, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_17bcab8d3306, p_Status := p_Status_17bcab8d3306, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_17bcab8d3306, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_17bcab8d3306, p_AutoUpdateCategory := p_AutoUpdateCategory_17bcab8d3306, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_17bcab8d3306, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_17bcab8d3306, p_Encrypt := p_Encrypt_17bcab8d3306, p_EncryptionKeyID := p_EncryptionKeyID_17bcab8d3306, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_17bcab8d3306, p_SendEncryptedValue := p_SendEncryptedValue_17bcab8d3306, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_17bcab8d3306, p_IsSoftForeignKey := p_IsSoftForeignKey_17bcab8d3306, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_17bcab8d3306, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_17bcab8d3306, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_17bcab8d3306, p_JSONTypeDefinition := p_JSONTypeDefinition_17bcab8d3306, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_17bcab8d3306, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_17bcab8d3306, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_17bcab8d3306, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_17bcab8d3306, p_IsComputed := p_IsComputed_17bcab8d3306, p_EmbeddedRecord := p_EmbeddedRecord_17bcab8d3306, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_17bcab8d3306, p_Configuration_Clear := TRUE, p_ID := p_ID_17bcab8d3306);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_9b403dd0646d VARCHAR(255);
  p_Description_9b403dd0646d TEXT;
  p_AutoUpdateDescription_9b403dd0646d BOOLEAN;
  p_IsPrimaryKey_9b403dd0646d BOOLEAN;
  p_IsUnique_9b403dd0646d BOOLEAN;
  p_Category_9b403dd0646d VARCHAR(255);
  p_ValueListType_9b403dd0646d VARCHAR(20);
  p_ExtendedType_9b403dd0646d VARCHAR(50);
  p_CodeType_9b403dd0646d VARCHAR(50);
  p_DefaultInView_9b403dd0646d BOOLEAN;
  p_ViewCellTemplate_9b403dd0646d TEXT;
  p_DefaultColumnWidth_9b403dd0646d INTEGER;
  p_AllowUpdateAPI_9b403dd0646d BOOLEAN;
  p_AllowUpdateInView_9b403dd0646d BOOLEAN;
  p_IncludeInUserSearchAPI_9b403dd0646d BOOLEAN;
  p_FullTextSearchEnabled_9b403dd0646d BOOLEAN;
  p_UserSearchParamFormatAPI_9b403dd0646d VARCHAR(500);
  p_IncludeInGeneratedForm_9b403dd0646d BOOLEAN;
  p_GeneratedFormSection_9b403dd0646d VARCHAR(10);
  p_IsNameField_9b403dd0646d BOOLEAN;
  p_RelatedEntityID_9b403dd0646d UUID;
  p_RelatedEntityFieldName_9b403dd0646d VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_9b403dd0646d BOOLEAN;
  p_RelatedEntityNameFieldMap_9b403dd0646d VARCHAR(255);
  p_RelatedEntityDisplayType_9b403dd0646d VARCHAR(20);
  p_EntityIDFieldName_9b403dd0646d VARCHAR(100);
  p_ScopeDefault_9b403dd0646d VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_9b403dd0646d BOOLEAN;
  p_ValuesToPackWithSchema_9b403dd0646d VARCHAR(10);
  p_Status_9b403dd0646d VARCHAR(25);
  p_AutoUpdateIsNameField_9b403dd0646d BOOLEAN;
  p_AutoUpdateDefaultInView_9b403dd0646d BOOLEAN;
  p_AutoUpdateCategory_9b403dd0646d BOOLEAN;
  p_AutoUpdateDisplayName_9b403dd0646d BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_9b403dd0646d BOOLEAN;
  p_Encrypt_9b403dd0646d BOOLEAN;
  p_EncryptionKeyID_9b403dd0646d UUID;
  p_AllowDecryptInAPI_9b403dd0646d BOOLEAN;
  p_SendEncryptedValue_9b403dd0646d BOOLEAN;
  p_IsSoftPrimaryKey_9b403dd0646d BOOLEAN;
  p_IsSoftForeignKey_9b403dd0646d BOOLEAN;
  p_RelatedEntityJoinFields_9b403dd0646d TEXT;
  p_JSONType_9b403dd0646d VARCHAR(255);
  p_JSONTypeIsArray_9b403dd0646d BOOLEAN;
  p_JSONTypeDefinition_9b403dd0646d TEXT;
  p_UserSearchPredicateAPI_9b403dd0646d VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_9b403dd0646d BOOLEAN;
  p_AutoUpdateFullTextSearch_9b403dd0646d BOOLEAN;
  p_AutoUpdateExtendedType_9b403dd0646d BOOLEAN;
  p_IsComputed_9b403dd0646d BOOLEAN;
  p_EmbeddedRecord_9b403dd0646d TEXT;
  p_Configuration_9b403dd0646d TEXT;
  p_ID_9b403dd0646d UUID;
BEGIN
  p_DisplayName_9b403dd0646d := 'Reviewed By User ID';
  p_Description_9b403dd0646d := 'Who cleared the exception. Required once Reviewed or Corrected; NULL while Open.';
  p_AutoUpdateDescription_9b403dd0646d := TRUE;
  p_IsPrimaryKey_9b403dd0646d := FALSE;
  p_IsUnique_9b403dd0646d := FALSE;
  p_Category_9b403dd0646d := 'Review';
  p_ValueListType_9b403dd0646d := 'None';
  p_DefaultInView_9b403dd0646d := FALSE;
  p_DefaultColumnWidth_9b403dd0646d := 150;
  p_AllowUpdateAPI_9b403dd0646d := TRUE;
  p_AllowUpdateInView_9b403dd0646d := TRUE;
  p_IncludeInUserSearchAPI_9b403dd0646d := FALSE;
  p_FullTextSearchEnabled_9b403dd0646d := FALSE;
  p_IncludeInGeneratedForm_9b403dd0646d := TRUE;
  p_GeneratedFormSection_9b403dd0646d := 'Category';
  p_IsNameField_9b403dd0646d := FALSE;
  p_RelatedEntityID_9b403dd0646d := 'E1238F34-2837-EF11-86D4-6045BDEE16E6';
  p_RelatedEntityFieldName_9b403dd0646d := 'ID';
  p_IncludeRelatedEntityNameFieldInBaseView_9b403dd0646d := TRUE;
  p_RelatedEntityNameFieldMap_9b403dd0646d := 'ReviewedByUser';
  p_RelatedEntityDisplayType_9b403dd0646d := 'Search';
  p_AutoUpdateRelatedEntityInfo_9b403dd0646d := TRUE;
  p_ValuesToPackWithSchema_9b403dd0646d := 'Auto';
  p_Status_9b403dd0646d := 'Active';
  p_AutoUpdateIsNameField_9b403dd0646d := TRUE;
  p_AutoUpdateDefaultInView_9b403dd0646d := TRUE;
  p_AutoUpdateCategory_9b403dd0646d := TRUE;
  p_AutoUpdateDisplayName_9b403dd0646d := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_9b403dd0646d := TRUE;
  p_Encrypt_9b403dd0646d := FALSE;
  p_AllowDecryptInAPI_9b403dd0646d := FALSE;
  p_SendEncryptedValue_9b403dd0646d := FALSE;
  p_IsSoftPrimaryKey_9b403dd0646d := FALSE;
  p_IsSoftForeignKey_9b403dd0646d := FALSE;
  p_JSONTypeIsArray_9b403dd0646d := FALSE;
  p_UserSearchPredicateAPI_9b403dd0646d := 'Contains';
  p_AutoUpdateUserSearchPredicate_9b403dd0646d := TRUE;
  p_AutoUpdateFullTextSearch_9b403dd0646d := TRUE;
  p_AutoUpdateExtendedType_9b403dd0646d := TRUE;
  p_IsComputed_9b403dd0646d := FALSE;
  p_ID_9b403dd0646d := 'B3795610-5A42-4262-8688-B2E67FC16B0A';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM ${mjSchema}."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_9b403dd0646d,
    'Description', p_Description_9b403dd0646d,
    'AutoUpdateDescription', p_AutoUpdateDescription_9b403dd0646d,
    'IsPrimaryKey', p_IsPrimaryKey_9b403dd0646d,
    'IsUnique', p_IsUnique_9b403dd0646d,
    'Category', p_Category_9b403dd0646d,
    'ValueListType', p_ValueListType_9b403dd0646d,
    'ExtendedType', p_ExtendedType_9b403dd0646d,
    'CodeType', p_CodeType_9b403dd0646d,
    'DefaultInView', p_DefaultInView_9b403dd0646d,
    'ViewCellTemplate', p_ViewCellTemplate_9b403dd0646d,
    'DefaultColumnWidth', p_DefaultColumnWidth_9b403dd0646d,
    'AllowUpdateAPI', p_AllowUpdateAPI_9b403dd0646d,
    'AllowUpdateInView', p_AllowUpdateInView_9b403dd0646d,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_9b403dd0646d,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_9b403dd0646d,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_9b403dd0646d,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_9b403dd0646d,
    'GeneratedFormSection', p_GeneratedFormSection_9b403dd0646d,
    'IsNameField', p_IsNameField_9b403dd0646d,
    'RelatedEntityID', p_RelatedEntityID_9b403dd0646d,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_9b403dd0646d,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_9b403dd0646d,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_9b403dd0646d,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_9b403dd0646d,
    'EntityIDFieldName', p_EntityIDFieldName_9b403dd0646d,
    'ScopeDefault', p_ScopeDefault_9b403dd0646d,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_9b403dd0646d,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_9b403dd0646d,
    'Status', p_Status_9b403dd0646d,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_9b403dd0646d,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_9b403dd0646d,
    'AutoUpdateCategory', p_AutoUpdateCategory_9b403dd0646d,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_9b403dd0646d,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_9b403dd0646d,
    'Encrypt', p_Encrypt_9b403dd0646d,
    'EncryptionKeyID', p_EncryptionKeyID_9b403dd0646d,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_9b403dd0646d,
    'SendEncryptedValue', p_SendEncryptedValue_9b403dd0646d,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_9b403dd0646d,
    'IsSoftForeignKey', p_IsSoftForeignKey_9b403dd0646d,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_9b403dd0646d,
    'JSONType', p_JSONType_9b403dd0646d,
    'JSONTypeIsArray', p_JSONTypeIsArray_9b403dd0646d,
    'JSONTypeDefinition', p_JSONTypeDefinition_9b403dd0646d,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_9b403dd0646d,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_9b403dd0646d,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_9b403dd0646d,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_9b403dd0646d,
    'IsComputed', p_IsComputed_9b403dd0646d
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_9b403dd0646d,
    'Configuration', p_Configuration_9b403dd0646d,
    'ID', p_ID_9b403dd0646d
  ));
  ELSE
    PERFORM ${mjSchema}."spUpdateEntityField"(p_DisplayName := p_DisplayName_9b403dd0646d, p_Description := p_Description_9b403dd0646d, p_AutoUpdateDescription := p_AutoUpdateDescription_9b403dd0646d, p_IsPrimaryKey := p_IsPrimaryKey_9b403dd0646d, p_IsUnique := p_IsUnique_9b403dd0646d, p_Category := p_Category_9b403dd0646d, p_ValueListType := p_ValueListType_9b403dd0646d, p_ExtendedType := p_ExtendedType_9b403dd0646d, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_9b403dd0646d, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_9b403dd0646d, p_ViewCellTemplate := p_ViewCellTemplate_9b403dd0646d, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_9b403dd0646d, p_AllowUpdateAPI := p_AllowUpdateAPI_9b403dd0646d, p_AllowUpdateInView := p_AllowUpdateInView_9b403dd0646d, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_9b403dd0646d, p_FullTextSearchEnabled := p_FullTextSearchEnabled_9b403dd0646d, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_9b403dd0646d, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_9b403dd0646d, p_GeneratedFormSection := p_GeneratedFormSection_9b403dd0646d, p_IsNameField := p_IsNameField_9b403dd0646d, p_RelatedEntityID := p_RelatedEntityID_9b403dd0646d, p_RelatedEntityFieldName := p_RelatedEntityFieldName_9b403dd0646d, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_9b403dd0646d, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_9b403dd0646d, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_9b403dd0646d, p_EntityIDFieldName := p_EntityIDFieldName_9b403dd0646d, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_9b403dd0646d, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_9b403dd0646d, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_9b403dd0646d, p_Status := p_Status_9b403dd0646d, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_9b403dd0646d, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_9b403dd0646d, p_AutoUpdateCategory := p_AutoUpdateCategory_9b403dd0646d, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_9b403dd0646d, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_9b403dd0646d, p_Encrypt := p_Encrypt_9b403dd0646d, p_EncryptionKeyID := p_EncryptionKeyID_9b403dd0646d, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_9b403dd0646d, p_SendEncryptedValue := p_SendEncryptedValue_9b403dd0646d, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_9b403dd0646d, p_IsSoftForeignKey := p_IsSoftForeignKey_9b403dd0646d, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_9b403dd0646d, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_9b403dd0646d, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_9b403dd0646d, p_JSONTypeDefinition := p_JSONTypeDefinition_9b403dd0646d, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_9b403dd0646d, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_9b403dd0646d, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_9b403dd0646d, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_9b403dd0646d, p_IsComputed := p_IsComputed_9b403dd0646d, p_EmbeddedRecord := p_EmbeddedRecord_9b403dd0646d, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_9b403dd0646d, p_Configuration_Clear := TRUE, p_ID := p_ID_9b403dd0646d);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_49672e906f6b VARCHAR(255);
  p_Description_49672e906f6b TEXT;
  p_AutoUpdateDescription_49672e906f6b BOOLEAN;
  p_IsPrimaryKey_49672e906f6b BOOLEAN;
  p_IsUnique_49672e906f6b BOOLEAN;
  p_Category_49672e906f6b VARCHAR(255);
  p_ValueListType_49672e906f6b VARCHAR(20);
  p_ExtendedType_49672e906f6b VARCHAR(50);
  p_CodeType_49672e906f6b VARCHAR(50);
  p_DefaultInView_49672e906f6b BOOLEAN;
  p_ViewCellTemplate_49672e906f6b TEXT;
  p_DefaultColumnWidth_49672e906f6b INTEGER;
  p_AllowUpdateAPI_49672e906f6b BOOLEAN;
  p_AllowUpdateInView_49672e906f6b BOOLEAN;
  p_IncludeInUserSearchAPI_49672e906f6b BOOLEAN;
  p_FullTextSearchEnabled_49672e906f6b BOOLEAN;
  p_UserSearchParamFormatAPI_49672e906f6b VARCHAR(500);
  p_IncludeInGeneratedForm_49672e906f6b BOOLEAN;
  p_GeneratedFormSection_49672e906f6b VARCHAR(10);
  p_IsNameField_49672e906f6b BOOLEAN;
  p_RelatedEntityID_49672e906f6b UUID;
  p_RelatedEntityFieldName_49672e906f6b VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_49672e906f6b BOOLEAN;
  p_RelatedEntityNameFieldMap_49672e906f6b VARCHAR(255);
  p_RelatedEntityDisplayType_49672e906f6b VARCHAR(20);
  p_EntityIDFieldName_49672e906f6b VARCHAR(100);
  p_ScopeDefault_49672e906f6b VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_49672e906f6b BOOLEAN;
  p_ValuesToPackWithSchema_49672e906f6b VARCHAR(10);
  p_Status_49672e906f6b VARCHAR(25);
  p_AutoUpdateIsNameField_49672e906f6b BOOLEAN;
  p_AutoUpdateDefaultInView_49672e906f6b BOOLEAN;
  p_AutoUpdateCategory_49672e906f6b BOOLEAN;
  p_AutoUpdateDisplayName_49672e906f6b BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_49672e906f6b BOOLEAN;
  p_Encrypt_49672e906f6b BOOLEAN;
  p_EncryptionKeyID_49672e906f6b UUID;
  p_AllowDecryptInAPI_49672e906f6b BOOLEAN;
  p_SendEncryptedValue_49672e906f6b BOOLEAN;
  p_IsSoftPrimaryKey_49672e906f6b BOOLEAN;
  p_IsSoftForeignKey_49672e906f6b BOOLEAN;
  p_RelatedEntityJoinFields_49672e906f6b TEXT;
  p_JSONType_49672e906f6b VARCHAR(255);
  p_JSONTypeIsArray_49672e906f6b BOOLEAN;
  p_JSONTypeDefinition_49672e906f6b TEXT;
  p_UserSearchPredicateAPI_49672e906f6b VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_49672e906f6b BOOLEAN;
  p_AutoUpdateFullTextSearch_49672e906f6b BOOLEAN;
  p_AutoUpdateExtendedType_49672e906f6b BOOLEAN;
  p_IsComputed_49672e906f6b BOOLEAN;
  p_EmbeddedRecord_49672e906f6b TEXT;
  p_Configuration_49672e906f6b TEXT;
  p_ID_49672e906f6b UUID;
BEGIN
  p_DisplayName_49672e906f6b := 'Reviewed At';
  p_Description_49672e906f6b := 'When the exception was cleared (UTC). Required once Reviewed or Corrected; NULL while Open.';
  p_AutoUpdateDescription_49672e906f6b := TRUE;
  p_IsPrimaryKey_49672e906f6b := FALSE;
  p_IsUnique_49672e906f6b := FALSE;
  p_Category_49672e906f6b := 'Review';
  p_ValueListType_49672e906f6b := 'None';
  p_DefaultInView_49672e906f6b := FALSE;
  p_DefaultColumnWidth_49672e906f6b := 100;
  p_AllowUpdateAPI_49672e906f6b := TRUE;
  p_AllowUpdateInView_49672e906f6b := TRUE;
  p_IncludeInUserSearchAPI_49672e906f6b := FALSE;
  p_FullTextSearchEnabled_49672e906f6b := FALSE;
  p_IncludeInGeneratedForm_49672e906f6b := TRUE;
  p_GeneratedFormSection_49672e906f6b := 'Category';
  p_IsNameField_49672e906f6b := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_49672e906f6b := FALSE;
  p_RelatedEntityDisplayType_49672e906f6b := 'Search';
  p_AutoUpdateRelatedEntityInfo_49672e906f6b := TRUE;
  p_ValuesToPackWithSchema_49672e906f6b := 'Auto';
  p_Status_49672e906f6b := 'Active';
  p_AutoUpdateIsNameField_49672e906f6b := TRUE;
  p_AutoUpdateDefaultInView_49672e906f6b := TRUE;
  p_AutoUpdateCategory_49672e906f6b := TRUE;
  p_AutoUpdateDisplayName_49672e906f6b := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_49672e906f6b := TRUE;
  p_Encrypt_49672e906f6b := FALSE;
  p_AllowDecryptInAPI_49672e906f6b := FALSE;
  p_SendEncryptedValue_49672e906f6b := FALSE;
  p_IsSoftPrimaryKey_49672e906f6b := FALSE;
  p_IsSoftForeignKey_49672e906f6b := FALSE;
  p_JSONTypeIsArray_49672e906f6b := FALSE;
  p_UserSearchPredicateAPI_49672e906f6b := 'Contains';
  p_AutoUpdateUserSearchPredicate_49672e906f6b := TRUE;
  p_AutoUpdateFullTextSearch_49672e906f6b := TRUE;
  p_AutoUpdateExtendedType_49672e906f6b := TRUE;
  p_IsComputed_49672e906f6b := FALSE;
  p_ID_49672e906f6b := '33E9D11F-B5F6-4547-96D3-7A8258F828EB';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM ${mjSchema}."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_49672e906f6b,
    'Description', p_Description_49672e906f6b,
    'AutoUpdateDescription', p_AutoUpdateDescription_49672e906f6b,
    'IsPrimaryKey', p_IsPrimaryKey_49672e906f6b,
    'IsUnique', p_IsUnique_49672e906f6b,
    'Category', p_Category_49672e906f6b,
    'ValueListType', p_ValueListType_49672e906f6b,
    'ExtendedType', p_ExtendedType_49672e906f6b,
    'CodeType', p_CodeType_49672e906f6b,
    'DefaultInView', p_DefaultInView_49672e906f6b,
    'ViewCellTemplate', p_ViewCellTemplate_49672e906f6b,
    'DefaultColumnWidth', p_DefaultColumnWidth_49672e906f6b,
    'AllowUpdateAPI', p_AllowUpdateAPI_49672e906f6b,
    'AllowUpdateInView', p_AllowUpdateInView_49672e906f6b,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_49672e906f6b,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_49672e906f6b,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_49672e906f6b,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_49672e906f6b,
    'GeneratedFormSection', p_GeneratedFormSection_49672e906f6b,
    'IsNameField', p_IsNameField_49672e906f6b,
    'RelatedEntityID', p_RelatedEntityID_49672e906f6b,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_49672e906f6b,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_49672e906f6b,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_49672e906f6b,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_49672e906f6b,
    'EntityIDFieldName', p_EntityIDFieldName_49672e906f6b,
    'ScopeDefault', p_ScopeDefault_49672e906f6b,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_49672e906f6b,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_49672e906f6b,
    'Status', p_Status_49672e906f6b,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_49672e906f6b,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_49672e906f6b,
    'AutoUpdateCategory', p_AutoUpdateCategory_49672e906f6b,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_49672e906f6b,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_49672e906f6b,
    'Encrypt', p_Encrypt_49672e906f6b,
    'EncryptionKeyID', p_EncryptionKeyID_49672e906f6b,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_49672e906f6b,
    'SendEncryptedValue', p_SendEncryptedValue_49672e906f6b,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_49672e906f6b,
    'IsSoftForeignKey', p_IsSoftForeignKey_49672e906f6b,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_49672e906f6b,
    'JSONType', p_JSONType_49672e906f6b,
    'JSONTypeIsArray', p_JSONTypeIsArray_49672e906f6b,
    'JSONTypeDefinition', p_JSONTypeDefinition_49672e906f6b,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_49672e906f6b,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_49672e906f6b,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_49672e906f6b,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_49672e906f6b,
    'IsComputed', p_IsComputed_49672e906f6b
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_49672e906f6b,
    'Configuration', p_Configuration_49672e906f6b,
    'ID', p_ID_49672e906f6b
  ));
  ELSE
    PERFORM ${mjSchema}."spUpdateEntityField"(p_DisplayName := p_DisplayName_49672e906f6b, p_Description := p_Description_49672e906f6b, p_AutoUpdateDescription := p_AutoUpdateDescription_49672e906f6b, p_IsPrimaryKey := p_IsPrimaryKey_49672e906f6b, p_IsUnique := p_IsUnique_49672e906f6b, p_Category := p_Category_49672e906f6b, p_ValueListType := p_ValueListType_49672e906f6b, p_ExtendedType := p_ExtendedType_49672e906f6b, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_49672e906f6b, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_49672e906f6b, p_ViewCellTemplate := p_ViewCellTemplate_49672e906f6b, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_49672e906f6b, p_AllowUpdateAPI := p_AllowUpdateAPI_49672e906f6b, p_AllowUpdateInView := p_AllowUpdateInView_49672e906f6b, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_49672e906f6b, p_FullTextSearchEnabled := p_FullTextSearchEnabled_49672e906f6b, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_49672e906f6b, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_49672e906f6b, p_GeneratedFormSection := p_GeneratedFormSection_49672e906f6b, p_IsNameField := p_IsNameField_49672e906f6b, p_RelatedEntityID := p_RelatedEntityID_49672e906f6b, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_49672e906f6b, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_49672e906f6b, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_49672e906f6b, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_49672e906f6b, p_EntityIDFieldName := p_EntityIDFieldName_49672e906f6b, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_49672e906f6b, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_49672e906f6b, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_49672e906f6b, p_Status := p_Status_49672e906f6b, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_49672e906f6b, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_49672e906f6b, p_AutoUpdateCategory := p_AutoUpdateCategory_49672e906f6b, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_49672e906f6b, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_49672e906f6b, p_Encrypt := p_Encrypt_49672e906f6b, p_EncryptionKeyID := p_EncryptionKeyID_49672e906f6b, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_49672e906f6b, p_SendEncryptedValue := p_SendEncryptedValue_49672e906f6b, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_49672e906f6b, p_IsSoftForeignKey := p_IsSoftForeignKey_49672e906f6b, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_49672e906f6b, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_49672e906f6b, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_49672e906f6b, p_JSONTypeDefinition := p_JSONTypeDefinition_49672e906f6b, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_49672e906f6b, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_49672e906f6b, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_49672e906f6b, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_49672e906f6b, p_IsComputed := p_IsComputed_49672e906f6b, p_EmbeddedRecord := p_EmbeddedRecord_49672e906f6b, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_49672e906f6b, p_Configuration_Clear := TRUE, p_ID := p_ID_49672e906f6b);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_bfb839b1bee7 VARCHAR(255);
  p_Description_bfb839b1bee7 TEXT;
  p_AutoUpdateDescription_bfb839b1bee7 BOOLEAN;
  p_IsPrimaryKey_bfb839b1bee7 BOOLEAN;
  p_IsUnique_bfb839b1bee7 BOOLEAN;
  p_Category_bfb839b1bee7 VARCHAR(255);
  p_ValueListType_bfb839b1bee7 VARCHAR(20);
  p_ExtendedType_bfb839b1bee7 VARCHAR(50);
  p_CodeType_bfb839b1bee7 VARCHAR(50);
  p_DefaultInView_bfb839b1bee7 BOOLEAN;
  p_ViewCellTemplate_bfb839b1bee7 TEXT;
  p_DefaultColumnWidth_bfb839b1bee7 INTEGER;
  p_AllowUpdateAPI_bfb839b1bee7 BOOLEAN;
  p_AllowUpdateInView_bfb839b1bee7 BOOLEAN;
  p_IncludeInUserSearchAPI_bfb839b1bee7 BOOLEAN;
  p_FullTextSearchEnabled_bfb839b1bee7 BOOLEAN;
  p_UserSearchParamFormatAPI_bfb839b1bee7 VARCHAR(500);
  p_IncludeInGeneratedForm_bfb839b1bee7 BOOLEAN;
  p_GeneratedFormSection_bfb839b1bee7 VARCHAR(10);
  p_IsNameField_bfb839b1bee7 BOOLEAN;
  p_RelatedEntityID_bfb839b1bee7 UUID;
  p_RelatedEntityFieldName_bfb839b1bee7 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_bfb839b1bee7 BOOLEAN;
  p_RelatedEntityNameFieldMap_bfb839b1bee7 VARCHAR(255);
  p_RelatedEntityDisplayType_bfb839b1bee7 VARCHAR(20);
  p_EntityIDFieldName_bfb839b1bee7 VARCHAR(100);
  p_ScopeDefault_bfb839b1bee7 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_bfb839b1bee7 BOOLEAN;
  p_ValuesToPackWithSchema_bfb839b1bee7 VARCHAR(10);
  p_Status_bfb839b1bee7 VARCHAR(25);
  p_AutoUpdateIsNameField_bfb839b1bee7 BOOLEAN;
  p_AutoUpdateDefaultInView_bfb839b1bee7 BOOLEAN;
  p_AutoUpdateCategory_bfb839b1bee7 BOOLEAN;
  p_AutoUpdateDisplayName_bfb839b1bee7 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_bfb839b1bee7 BOOLEAN;
  p_Encrypt_bfb839b1bee7 BOOLEAN;
  p_EncryptionKeyID_bfb839b1bee7 UUID;
  p_AllowDecryptInAPI_bfb839b1bee7 BOOLEAN;
  p_SendEncryptedValue_bfb839b1bee7 BOOLEAN;
  p_IsSoftPrimaryKey_bfb839b1bee7 BOOLEAN;
  p_IsSoftForeignKey_bfb839b1bee7 BOOLEAN;
  p_RelatedEntityJoinFields_bfb839b1bee7 TEXT;
  p_JSONType_bfb839b1bee7 VARCHAR(255);
  p_JSONTypeIsArray_bfb839b1bee7 BOOLEAN;
  p_JSONTypeDefinition_bfb839b1bee7 TEXT;
  p_UserSearchPredicateAPI_bfb839b1bee7 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_bfb839b1bee7 BOOLEAN;
  p_AutoUpdateFullTextSearch_bfb839b1bee7 BOOLEAN;
  p_AutoUpdateExtendedType_bfb839b1bee7 BOOLEAN;
  p_IsComputed_bfb839b1bee7 BOOLEAN;
  p_EmbeddedRecord_bfb839b1bee7 TEXT;
  p_Configuration_bfb839b1bee7 TEXT;
  p_ID_bfb839b1bee7 UUID;
BEGIN
  p_DisplayName_bfb839b1bee7 := 'Review Note';
  p_Description_bfb839b1bee7 := 'The reviewer''s note on what they checked or changed. Required by Accounting.ClearFinanceException; NULL while Open.';
  p_AutoUpdateDescription_bfb839b1bee7 := TRUE;
  p_IsPrimaryKey_bfb839b1bee7 := FALSE;
  p_IsUnique_bfb839b1bee7 := FALSE;
  p_Category_bfb839b1bee7 := 'Review';
  p_ValueListType_bfb839b1bee7 := 'None';
  p_DefaultInView_bfb839b1bee7 := FALSE;
  p_DefaultColumnWidth_bfb839b1bee7 := 150;
  p_AllowUpdateAPI_bfb839b1bee7 := TRUE;
  p_AllowUpdateInView_bfb839b1bee7 := TRUE;
  p_IncludeInUserSearchAPI_bfb839b1bee7 := FALSE;
  p_FullTextSearchEnabled_bfb839b1bee7 := FALSE;
  p_IncludeInGeneratedForm_bfb839b1bee7 := TRUE;
  p_GeneratedFormSection_bfb839b1bee7 := 'Category';
  p_IsNameField_bfb839b1bee7 := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_bfb839b1bee7 := FALSE;
  p_RelatedEntityDisplayType_bfb839b1bee7 := 'Search';
  p_AutoUpdateRelatedEntityInfo_bfb839b1bee7 := TRUE;
  p_ValuesToPackWithSchema_bfb839b1bee7 := 'Auto';
  p_Status_bfb839b1bee7 := 'Active';
  p_AutoUpdateIsNameField_bfb839b1bee7 := TRUE;
  p_AutoUpdateDefaultInView_bfb839b1bee7 := TRUE;
  p_AutoUpdateCategory_bfb839b1bee7 := TRUE;
  p_AutoUpdateDisplayName_bfb839b1bee7 := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_bfb839b1bee7 := TRUE;
  p_Encrypt_bfb839b1bee7 := FALSE;
  p_AllowDecryptInAPI_bfb839b1bee7 := FALSE;
  p_SendEncryptedValue_bfb839b1bee7 := FALSE;
  p_IsSoftPrimaryKey_bfb839b1bee7 := FALSE;
  p_IsSoftForeignKey_bfb839b1bee7 := FALSE;
  p_JSONTypeIsArray_bfb839b1bee7 := FALSE;
  p_UserSearchPredicateAPI_bfb839b1bee7 := 'Contains';
  p_AutoUpdateUserSearchPredicate_bfb839b1bee7 := TRUE;
  p_AutoUpdateFullTextSearch_bfb839b1bee7 := TRUE;
  p_AutoUpdateExtendedType_bfb839b1bee7 := TRUE;
  p_IsComputed_bfb839b1bee7 := FALSE;
  p_ID_bfb839b1bee7 := '59EFF0E1-9B0A-4A17-80F6-3ED6E6347B66';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM ${mjSchema}."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_bfb839b1bee7,
    'Description', p_Description_bfb839b1bee7,
    'AutoUpdateDescription', p_AutoUpdateDescription_bfb839b1bee7,
    'IsPrimaryKey', p_IsPrimaryKey_bfb839b1bee7,
    'IsUnique', p_IsUnique_bfb839b1bee7,
    'Category', p_Category_bfb839b1bee7,
    'ValueListType', p_ValueListType_bfb839b1bee7,
    'ExtendedType', p_ExtendedType_bfb839b1bee7,
    'CodeType', p_CodeType_bfb839b1bee7,
    'DefaultInView', p_DefaultInView_bfb839b1bee7,
    'ViewCellTemplate', p_ViewCellTemplate_bfb839b1bee7,
    'DefaultColumnWidth', p_DefaultColumnWidth_bfb839b1bee7,
    'AllowUpdateAPI', p_AllowUpdateAPI_bfb839b1bee7,
    'AllowUpdateInView', p_AllowUpdateInView_bfb839b1bee7,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_bfb839b1bee7,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_bfb839b1bee7,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_bfb839b1bee7,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_bfb839b1bee7,
    'GeneratedFormSection', p_GeneratedFormSection_bfb839b1bee7,
    'IsNameField', p_IsNameField_bfb839b1bee7,
    'RelatedEntityID', p_RelatedEntityID_bfb839b1bee7,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_bfb839b1bee7,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_bfb839b1bee7,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_bfb839b1bee7,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_bfb839b1bee7,
    'EntityIDFieldName', p_EntityIDFieldName_bfb839b1bee7,
    'ScopeDefault', p_ScopeDefault_bfb839b1bee7,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_bfb839b1bee7,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_bfb839b1bee7,
    'Status', p_Status_bfb839b1bee7,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_bfb839b1bee7,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_bfb839b1bee7,
    'AutoUpdateCategory', p_AutoUpdateCategory_bfb839b1bee7,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_bfb839b1bee7,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_bfb839b1bee7,
    'Encrypt', p_Encrypt_bfb839b1bee7,
    'EncryptionKeyID', p_EncryptionKeyID_bfb839b1bee7,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_bfb839b1bee7,
    'SendEncryptedValue', p_SendEncryptedValue_bfb839b1bee7,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_bfb839b1bee7,
    'IsSoftForeignKey', p_IsSoftForeignKey_bfb839b1bee7,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_bfb839b1bee7,
    'JSONType', p_JSONType_bfb839b1bee7,
    'JSONTypeIsArray', p_JSONTypeIsArray_bfb839b1bee7,
    'JSONTypeDefinition', p_JSONTypeDefinition_bfb839b1bee7,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_bfb839b1bee7,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_bfb839b1bee7,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_bfb839b1bee7,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_bfb839b1bee7,
    'IsComputed', p_IsComputed_bfb839b1bee7
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_bfb839b1bee7,
    'Configuration', p_Configuration_bfb839b1bee7,
    'ID', p_ID_bfb839b1bee7
  ));
  ELSE
    PERFORM ${mjSchema}."spUpdateEntityField"(p_DisplayName := p_DisplayName_bfb839b1bee7, p_Description := p_Description_bfb839b1bee7, p_AutoUpdateDescription := p_AutoUpdateDescription_bfb839b1bee7, p_IsPrimaryKey := p_IsPrimaryKey_bfb839b1bee7, p_IsUnique := p_IsUnique_bfb839b1bee7, p_Category := p_Category_bfb839b1bee7, p_ValueListType := p_ValueListType_bfb839b1bee7, p_ExtendedType := p_ExtendedType_bfb839b1bee7, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_bfb839b1bee7, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_bfb839b1bee7, p_ViewCellTemplate := p_ViewCellTemplate_bfb839b1bee7, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_bfb839b1bee7, p_AllowUpdateAPI := p_AllowUpdateAPI_bfb839b1bee7, p_AllowUpdateInView := p_AllowUpdateInView_bfb839b1bee7, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_bfb839b1bee7, p_FullTextSearchEnabled := p_FullTextSearchEnabled_bfb839b1bee7, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_bfb839b1bee7, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_bfb839b1bee7, p_GeneratedFormSection := p_GeneratedFormSection_bfb839b1bee7, p_IsNameField := p_IsNameField_bfb839b1bee7, p_RelatedEntityID := p_RelatedEntityID_bfb839b1bee7, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_bfb839b1bee7, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_bfb839b1bee7, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_bfb839b1bee7, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_bfb839b1bee7, p_EntityIDFieldName := p_EntityIDFieldName_bfb839b1bee7, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_bfb839b1bee7, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_bfb839b1bee7, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_bfb839b1bee7, p_Status := p_Status_bfb839b1bee7, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_bfb839b1bee7, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_bfb839b1bee7, p_AutoUpdateCategory := p_AutoUpdateCategory_bfb839b1bee7, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_bfb839b1bee7, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_bfb839b1bee7, p_Encrypt := p_Encrypt_bfb839b1bee7, p_EncryptionKeyID := p_EncryptionKeyID_bfb839b1bee7, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_bfb839b1bee7, p_SendEncryptedValue := p_SendEncryptedValue_bfb839b1bee7, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_bfb839b1bee7, p_IsSoftForeignKey := p_IsSoftForeignKey_bfb839b1bee7, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_bfb839b1bee7, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_bfb839b1bee7, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_bfb839b1bee7, p_JSONTypeDefinition := p_JSONTypeDefinition_bfb839b1bee7, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_bfb839b1bee7, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_bfb839b1bee7, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_bfb839b1bee7, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_bfb839b1bee7, p_IsComputed := p_IsComputed_bfb839b1bee7, p_EmbeddedRecord := p_EmbeddedRecord_bfb839b1bee7, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_bfb839b1bee7, p_Configuration_Clear := TRUE, p_ID := p_ID_bfb839b1bee7);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_952ce7faec4c VARCHAR(255);
  p_Description_952ce7faec4c TEXT;
  p_AutoUpdateDescription_952ce7faec4c BOOLEAN;
  p_IsPrimaryKey_952ce7faec4c BOOLEAN;
  p_IsUnique_952ce7faec4c BOOLEAN;
  p_Category_952ce7faec4c VARCHAR(255);
  p_ValueListType_952ce7faec4c VARCHAR(20);
  p_ExtendedType_952ce7faec4c VARCHAR(50);
  p_CodeType_952ce7faec4c VARCHAR(50);
  p_DefaultInView_952ce7faec4c BOOLEAN;
  p_ViewCellTemplate_952ce7faec4c TEXT;
  p_DefaultColumnWidth_952ce7faec4c INTEGER;
  p_AllowUpdateAPI_952ce7faec4c BOOLEAN;
  p_AllowUpdateInView_952ce7faec4c BOOLEAN;
  p_IncludeInUserSearchAPI_952ce7faec4c BOOLEAN;
  p_FullTextSearchEnabled_952ce7faec4c BOOLEAN;
  p_UserSearchParamFormatAPI_952ce7faec4c VARCHAR(500);
  p_IncludeInGeneratedForm_952ce7faec4c BOOLEAN;
  p_GeneratedFormSection_952ce7faec4c VARCHAR(10);
  p_IsNameField_952ce7faec4c BOOLEAN;
  p_RelatedEntityID_952ce7faec4c UUID;
  p_RelatedEntityFieldName_952ce7faec4c VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_952ce7faec4c BOOLEAN;
  p_RelatedEntityNameFieldMap_952ce7faec4c VARCHAR(255);
  p_RelatedEntityDisplayType_952ce7faec4c VARCHAR(20);
  p_EntityIDFieldName_952ce7faec4c VARCHAR(100);
  p_ScopeDefault_952ce7faec4c VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_952ce7faec4c BOOLEAN;
  p_ValuesToPackWithSchema_952ce7faec4c VARCHAR(10);
  p_Status_952ce7faec4c VARCHAR(25);
  p_AutoUpdateIsNameField_952ce7faec4c BOOLEAN;
  p_AutoUpdateDefaultInView_952ce7faec4c BOOLEAN;
  p_AutoUpdateCategory_952ce7faec4c BOOLEAN;
  p_AutoUpdateDisplayName_952ce7faec4c BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_952ce7faec4c BOOLEAN;
  p_Encrypt_952ce7faec4c BOOLEAN;
  p_EncryptionKeyID_952ce7faec4c UUID;
  p_AllowDecryptInAPI_952ce7faec4c BOOLEAN;
  p_SendEncryptedValue_952ce7faec4c BOOLEAN;
  p_IsSoftPrimaryKey_952ce7faec4c BOOLEAN;
  p_IsSoftForeignKey_952ce7faec4c BOOLEAN;
  p_RelatedEntityJoinFields_952ce7faec4c TEXT;
  p_JSONType_952ce7faec4c VARCHAR(255);
  p_JSONTypeIsArray_952ce7faec4c BOOLEAN;
  p_JSONTypeDefinition_952ce7faec4c TEXT;
  p_UserSearchPredicateAPI_952ce7faec4c VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_952ce7faec4c BOOLEAN;
  p_AutoUpdateFullTextSearch_952ce7faec4c BOOLEAN;
  p_AutoUpdateExtendedType_952ce7faec4c BOOLEAN;
  p_IsComputed_952ce7faec4c BOOLEAN;
  p_EmbeddedRecord_952ce7faec4c TEXT;
  p_Configuration_952ce7faec4c TEXT;
  p_ID_952ce7faec4c UUID;
BEGIN
  p_DisplayName_952ce7faec4c := 'Created At';
  p_AutoUpdateDescription_952ce7faec4c := TRUE;
  p_IsPrimaryKey_952ce7faec4c := FALSE;
  p_IsUnique_952ce7faec4c := FALSE;
  p_Category_952ce7faec4c := 'System Metadata';
  p_ValueListType_952ce7faec4c := 'None';
  p_DefaultInView_952ce7faec4c := FALSE;
  p_DefaultColumnWidth_952ce7faec4c := 100;
  p_AllowUpdateAPI_952ce7faec4c := FALSE;
  p_AllowUpdateInView_952ce7faec4c := TRUE;
  p_IncludeInUserSearchAPI_952ce7faec4c := FALSE;
  p_FullTextSearchEnabled_952ce7faec4c := FALSE;
  p_IncludeInGeneratedForm_952ce7faec4c := TRUE;
  p_GeneratedFormSection_952ce7faec4c := 'Category';
  p_IsNameField_952ce7faec4c := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_952ce7faec4c := FALSE;
  p_RelatedEntityDisplayType_952ce7faec4c := 'Search';
  p_AutoUpdateRelatedEntityInfo_952ce7faec4c := TRUE;
  p_ValuesToPackWithSchema_952ce7faec4c := 'Auto';
  p_Status_952ce7faec4c := 'Active';
  p_AutoUpdateIsNameField_952ce7faec4c := TRUE;
  p_AutoUpdateDefaultInView_952ce7faec4c := TRUE;
  p_AutoUpdateCategory_952ce7faec4c := TRUE;
  p_AutoUpdateDisplayName_952ce7faec4c := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_952ce7faec4c := TRUE;
  p_Encrypt_952ce7faec4c := FALSE;
  p_AllowDecryptInAPI_952ce7faec4c := FALSE;
  p_SendEncryptedValue_952ce7faec4c := FALSE;
  p_IsSoftPrimaryKey_952ce7faec4c := FALSE;
  p_IsSoftForeignKey_952ce7faec4c := FALSE;
  p_JSONTypeIsArray_952ce7faec4c := FALSE;
  p_UserSearchPredicateAPI_952ce7faec4c := 'Contains';
  p_AutoUpdateUserSearchPredicate_952ce7faec4c := TRUE;
  p_AutoUpdateFullTextSearch_952ce7faec4c := TRUE;
  p_AutoUpdateExtendedType_952ce7faec4c := TRUE;
  p_IsComputed_952ce7faec4c := FALSE;
  p_ID_952ce7faec4c := '31935C65-F0E6-4953-8F96-53C85A8EA24A';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM ${mjSchema}."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_952ce7faec4c,
    'Description', p_Description_952ce7faec4c,
    'AutoUpdateDescription', p_AutoUpdateDescription_952ce7faec4c,
    'IsPrimaryKey', p_IsPrimaryKey_952ce7faec4c,
    'IsUnique', p_IsUnique_952ce7faec4c,
    'Category', p_Category_952ce7faec4c,
    'ValueListType', p_ValueListType_952ce7faec4c,
    'ExtendedType', p_ExtendedType_952ce7faec4c,
    'CodeType', p_CodeType_952ce7faec4c,
    'DefaultInView', p_DefaultInView_952ce7faec4c,
    'ViewCellTemplate', p_ViewCellTemplate_952ce7faec4c,
    'DefaultColumnWidth', p_DefaultColumnWidth_952ce7faec4c,
    'AllowUpdateAPI', p_AllowUpdateAPI_952ce7faec4c,
    'AllowUpdateInView', p_AllowUpdateInView_952ce7faec4c,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_952ce7faec4c,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_952ce7faec4c,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_952ce7faec4c,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_952ce7faec4c,
    'GeneratedFormSection', p_GeneratedFormSection_952ce7faec4c,
    'IsNameField', p_IsNameField_952ce7faec4c,
    'RelatedEntityID', p_RelatedEntityID_952ce7faec4c,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_952ce7faec4c,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_952ce7faec4c,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_952ce7faec4c,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_952ce7faec4c,
    'EntityIDFieldName', p_EntityIDFieldName_952ce7faec4c,
    'ScopeDefault', p_ScopeDefault_952ce7faec4c,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_952ce7faec4c,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_952ce7faec4c,
    'Status', p_Status_952ce7faec4c,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_952ce7faec4c,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_952ce7faec4c,
    'AutoUpdateCategory', p_AutoUpdateCategory_952ce7faec4c,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_952ce7faec4c,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_952ce7faec4c,
    'Encrypt', p_Encrypt_952ce7faec4c,
    'EncryptionKeyID', p_EncryptionKeyID_952ce7faec4c,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_952ce7faec4c,
    'SendEncryptedValue', p_SendEncryptedValue_952ce7faec4c,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_952ce7faec4c,
    'IsSoftForeignKey', p_IsSoftForeignKey_952ce7faec4c,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_952ce7faec4c,
    'JSONType', p_JSONType_952ce7faec4c,
    'JSONTypeIsArray', p_JSONTypeIsArray_952ce7faec4c,
    'JSONTypeDefinition', p_JSONTypeDefinition_952ce7faec4c,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_952ce7faec4c,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_952ce7faec4c,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_952ce7faec4c,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_952ce7faec4c,
    'IsComputed', p_IsComputed_952ce7faec4c
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_952ce7faec4c,
    'Configuration', p_Configuration_952ce7faec4c,
    'ID', p_ID_952ce7faec4c
  ));
  ELSE
    PERFORM ${mjSchema}."spUpdateEntityField"(p_DisplayName := p_DisplayName_952ce7faec4c, p_Description := p_Description_952ce7faec4c, p_Description_Clear := TRUE, p_AutoUpdateDescription := p_AutoUpdateDescription_952ce7faec4c, p_IsPrimaryKey := p_IsPrimaryKey_952ce7faec4c, p_IsUnique := p_IsUnique_952ce7faec4c, p_Category := p_Category_952ce7faec4c, p_ValueListType := p_ValueListType_952ce7faec4c, p_ExtendedType := p_ExtendedType_952ce7faec4c, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_952ce7faec4c, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_952ce7faec4c, p_ViewCellTemplate := p_ViewCellTemplate_952ce7faec4c, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_952ce7faec4c, p_AllowUpdateAPI := p_AllowUpdateAPI_952ce7faec4c, p_AllowUpdateInView := p_AllowUpdateInView_952ce7faec4c, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_952ce7faec4c, p_FullTextSearchEnabled := p_FullTextSearchEnabled_952ce7faec4c, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_952ce7faec4c, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_952ce7faec4c, p_GeneratedFormSection := p_GeneratedFormSection_952ce7faec4c, p_IsNameField := p_IsNameField_952ce7faec4c, p_RelatedEntityID := p_RelatedEntityID_952ce7faec4c, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_952ce7faec4c, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_952ce7faec4c, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_952ce7faec4c, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_952ce7faec4c, p_EntityIDFieldName := p_EntityIDFieldName_952ce7faec4c, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_952ce7faec4c, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_952ce7faec4c, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_952ce7faec4c, p_Status := p_Status_952ce7faec4c, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_952ce7faec4c, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_952ce7faec4c, p_AutoUpdateCategory := p_AutoUpdateCategory_952ce7faec4c, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_952ce7faec4c, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_952ce7faec4c, p_Encrypt := p_Encrypt_952ce7faec4c, p_EncryptionKeyID := p_EncryptionKeyID_952ce7faec4c, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_952ce7faec4c, p_SendEncryptedValue := p_SendEncryptedValue_952ce7faec4c, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_952ce7faec4c, p_IsSoftForeignKey := p_IsSoftForeignKey_952ce7faec4c, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_952ce7faec4c, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_952ce7faec4c, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_952ce7faec4c, p_JSONTypeDefinition := p_JSONTypeDefinition_952ce7faec4c, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_952ce7faec4c, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_952ce7faec4c, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_952ce7faec4c, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_952ce7faec4c, p_IsComputed := p_IsComputed_952ce7faec4c, p_EmbeddedRecord := p_EmbeddedRecord_952ce7faec4c, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_952ce7faec4c, p_Configuration_Clear := TRUE, p_ID := p_ID_952ce7faec4c);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_44e2a8f4c8ae VARCHAR(255);
  p_Description_44e2a8f4c8ae TEXT;
  p_AutoUpdateDescription_44e2a8f4c8ae BOOLEAN;
  p_IsPrimaryKey_44e2a8f4c8ae BOOLEAN;
  p_IsUnique_44e2a8f4c8ae BOOLEAN;
  p_Category_44e2a8f4c8ae VARCHAR(255);
  p_ValueListType_44e2a8f4c8ae VARCHAR(20);
  p_ExtendedType_44e2a8f4c8ae VARCHAR(50);
  p_CodeType_44e2a8f4c8ae VARCHAR(50);
  p_DefaultInView_44e2a8f4c8ae BOOLEAN;
  p_ViewCellTemplate_44e2a8f4c8ae TEXT;
  p_DefaultColumnWidth_44e2a8f4c8ae INTEGER;
  p_AllowUpdateAPI_44e2a8f4c8ae BOOLEAN;
  p_AllowUpdateInView_44e2a8f4c8ae BOOLEAN;
  p_IncludeInUserSearchAPI_44e2a8f4c8ae BOOLEAN;
  p_FullTextSearchEnabled_44e2a8f4c8ae BOOLEAN;
  p_UserSearchParamFormatAPI_44e2a8f4c8ae VARCHAR(500);
  p_IncludeInGeneratedForm_44e2a8f4c8ae BOOLEAN;
  p_GeneratedFormSection_44e2a8f4c8ae VARCHAR(10);
  p_IsNameField_44e2a8f4c8ae BOOLEAN;
  p_RelatedEntityID_44e2a8f4c8ae UUID;
  p_RelatedEntityFieldName_44e2a8f4c8ae VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_44e2a8f4c8ae BOOLEAN;
  p_RelatedEntityNameFieldMap_44e2a8f4c8ae VARCHAR(255);
  p_RelatedEntityDisplayType_44e2a8f4c8ae VARCHAR(20);
  p_EntityIDFieldName_44e2a8f4c8ae VARCHAR(100);
  p_ScopeDefault_44e2a8f4c8ae VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_44e2a8f4c8ae BOOLEAN;
  p_ValuesToPackWithSchema_44e2a8f4c8ae VARCHAR(10);
  p_Status_44e2a8f4c8ae VARCHAR(25);
  p_AutoUpdateIsNameField_44e2a8f4c8ae BOOLEAN;
  p_AutoUpdateDefaultInView_44e2a8f4c8ae BOOLEAN;
  p_AutoUpdateCategory_44e2a8f4c8ae BOOLEAN;
  p_AutoUpdateDisplayName_44e2a8f4c8ae BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_44e2a8f4c8ae BOOLEAN;
  p_Encrypt_44e2a8f4c8ae BOOLEAN;
  p_EncryptionKeyID_44e2a8f4c8ae UUID;
  p_AllowDecryptInAPI_44e2a8f4c8ae BOOLEAN;
  p_SendEncryptedValue_44e2a8f4c8ae BOOLEAN;
  p_IsSoftPrimaryKey_44e2a8f4c8ae BOOLEAN;
  p_IsSoftForeignKey_44e2a8f4c8ae BOOLEAN;
  p_RelatedEntityJoinFields_44e2a8f4c8ae TEXT;
  p_JSONType_44e2a8f4c8ae VARCHAR(255);
  p_JSONTypeIsArray_44e2a8f4c8ae BOOLEAN;
  p_JSONTypeDefinition_44e2a8f4c8ae TEXT;
  p_UserSearchPredicateAPI_44e2a8f4c8ae VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_44e2a8f4c8ae BOOLEAN;
  p_AutoUpdateFullTextSearch_44e2a8f4c8ae BOOLEAN;
  p_AutoUpdateExtendedType_44e2a8f4c8ae BOOLEAN;
  p_IsComputed_44e2a8f4c8ae BOOLEAN;
  p_EmbeddedRecord_44e2a8f4c8ae TEXT;
  p_Configuration_44e2a8f4c8ae TEXT;
  p_ID_44e2a8f4c8ae UUID;
BEGIN
  p_DisplayName_44e2a8f4c8ae := 'Updated At';
  p_AutoUpdateDescription_44e2a8f4c8ae := TRUE;
  p_IsPrimaryKey_44e2a8f4c8ae := FALSE;
  p_IsUnique_44e2a8f4c8ae := FALSE;
  p_Category_44e2a8f4c8ae := 'System Metadata';
  p_ValueListType_44e2a8f4c8ae := 'None';
  p_DefaultInView_44e2a8f4c8ae := FALSE;
  p_DefaultColumnWidth_44e2a8f4c8ae := 100;
  p_AllowUpdateAPI_44e2a8f4c8ae := FALSE;
  p_AllowUpdateInView_44e2a8f4c8ae := TRUE;
  p_IncludeInUserSearchAPI_44e2a8f4c8ae := FALSE;
  p_FullTextSearchEnabled_44e2a8f4c8ae := FALSE;
  p_IncludeInGeneratedForm_44e2a8f4c8ae := TRUE;
  p_GeneratedFormSection_44e2a8f4c8ae := 'Category';
  p_IsNameField_44e2a8f4c8ae := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_44e2a8f4c8ae := FALSE;
  p_RelatedEntityDisplayType_44e2a8f4c8ae := 'Search';
  p_AutoUpdateRelatedEntityInfo_44e2a8f4c8ae := TRUE;
  p_ValuesToPackWithSchema_44e2a8f4c8ae := 'Auto';
  p_Status_44e2a8f4c8ae := 'Active';
  p_AutoUpdateIsNameField_44e2a8f4c8ae := TRUE;
  p_AutoUpdateDefaultInView_44e2a8f4c8ae := TRUE;
  p_AutoUpdateCategory_44e2a8f4c8ae := TRUE;
  p_AutoUpdateDisplayName_44e2a8f4c8ae := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_44e2a8f4c8ae := TRUE;
  p_Encrypt_44e2a8f4c8ae := FALSE;
  p_AllowDecryptInAPI_44e2a8f4c8ae := FALSE;
  p_SendEncryptedValue_44e2a8f4c8ae := FALSE;
  p_IsSoftPrimaryKey_44e2a8f4c8ae := FALSE;
  p_IsSoftForeignKey_44e2a8f4c8ae := FALSE;
  p_JSONTypeIsArray_44e2a8f4c8ae := FALSE;
  p_UserSearchPredicateAPI_44e2a8f4c8ae := 'Contains';
  p_AutoUpdateUserSearchPredicate_44e2a8f4c8ae := TRUE;
  p_AutoUpdateFullTextSearch_44e2a8f4c8ae := TRUE;
  p_AutoUpdateExtendedType_44e2a8f4c8ae := TRUE;
  p_IsComputed_44e2a8f4c8ae := FALSE;
  p_ID_44e2a8f4c8ae := '3FE960F1-D07E-4FF7-BE76-5D83B2FBFA4C';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM ${mjSchema}."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_44e2a8f4c8ae,
    'Description', p_Description_44e2a8f4c8ae,
    'AutoUpdateDescription', p_AutoUpdateDescription_44e2a8f4c8ae,
    'IsPrimaryKey', p_IsPrimaryKey_44e2a8f4c8ae,
    'IsUnique', p_IsUnique_44e2a8f4c8ae,
    'Category', p_Category_44e2a8f4c8ae,
    'ValueListType', p_ValueListType_44e2a8f4c8ae,
    'ExtendedType', p_ExtendedType_44e2a8f4c8ae,
    'CodeType', p_CodeType_44e2a8f4c8ae,
    'DefaultInView', p_DefaultInView_44e2a8f4c8ae,
    'ViewCellTemplate', p_ViewCellTemplate_44e2a8f4c8ae,
    'DefaultColumnWidth', p_DefaultColumnWidth_44e2a8f4c8ae,
    'AllowUpdateAPI', p_AllowUpdateAPI_44e2a8f4c8ae,
    'AllowUpdateInView', p_AllowUpdateInView_44e2a8f4c8ae,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_44e2a8f4c8ae,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_44e2a8f4c8ae,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_44e2a8f4c8ae,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_44e2a8f4c8ae,
    'GeneratedFormSection', p_GeneratedFormSection_44e2a8f4c8ae,
    'IsNameField', p_IsNameField_44e2a8f4c8ae,
    'RelatedEntityID', p_RelatedEntityID_44e2a8f4c8ae,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_44e2a8f4c8ae,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_44e2a8f4c8ae,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_44e2a8f4c8ae,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_44e2a8f4c8ae,
    'EntityIDFieldName', p_EntityIDFieldName_44e2a8f4c8ae,
    'ScopeDefault', p_ScopeDefault_44e2a8f4c8ae,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_44e2a8f4c8ae,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_44e2a8f4c8ae,
    'Status', p_Status_44e2a8f4c8ae,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_44e2a8f4c8ae,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_44e2a8f4c8ae,
    'AutoUpdateCategory', p_AutoUpdateCategory_44e2a8f4c8ae,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_44e2a8f4c8ae,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_44e2a8f4c8ae,
    'Encrypt', p_Encrypt_44e2a8f4c8ae,
    'EncryptionKeyID', p_EncryptionKeyID_44e2a8f4c8ae,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_44e2a8f4c8ae,
    'SendEncryptedValue', p_SendEncryptedValue_44e2a8f4c8ae,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_44e2a8f4c8ae,
    'IsSoftForeignKey', p_IsSoftForeignKey_44e2a8f4c8ae,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_44e2a8f4c8ae,
    'JSONType', p_JSONType_44e2a8f4c8ae,
    'JSONTypeIsArray', p_JSONTypeIsArray_44e2a8f4c8ae,
    'JSONTypeDefinition', p_JSONTypeDefinition_44e2a8f4c8ae,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_44e2a8f4c8ae,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_44e2a8f4c8ae,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_44e2a8f4c8ae,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_44e2a8f4c8ae,
    'IsComputed', p_IsComputed_44e2a8f4c8ae
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_44e2a8f4c8ae,
    'Configuration', p_Configuration_44e2a8f4c8ae,
    'ID', p_ID_44e2a8f4c8ae
  ));
  ELSE
    PERFORM ${mjSchema}."spUpdateEntityField"(p_DisplayName := p_DisplayName_44e2a8f4c8ae, p_Description := p_Description_44e2a8f4c8ae, p_Description_Clear := TRUE, p_AutoUpdateDescription := p_AutoUpdateDescription_44e2a8f4c8ae, p_IsPrimaryKey := p_IsPrimaryKey_44e2a8f4c8ae, p_IsUnique := p_IsUnique_44e2a8f4c8ae, p_Category := p_Category_44e2a8f4c8ae, p_ValueListType := p_ValueListType_44e2a8f4c8ae, p_ExtendedType := p_ExtendedType_44e2a8f4c8ae, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_44e2a8f4c8ae, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_44e2a8f4c8ae, p_ViewCellTemplate := p_ViewCellTemplate_44e2a8f4c8ae, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_44e2a8f4c8ae, p_AllowUpdateAPI := p_AllowUpdateAPI_44e2a8f4c8ae, p_AllowUpdateInView := p_AllowUpdateInView_44e2a8f4c8ae, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_44e2a8f4c8ae, p_FullTextSearchEnabled := p_FullTextSearchEnabled_44e2a8f4c8ae, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_44e2a8f4c8ae, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_44e2a8f4c8ae, p_GeneratedFormSection := p_GeneratedFormSection_44e2a8f4c8ae, p_IsNameField := p_IsNameField_44e2a8f4c8ae, p_RelatedEntityID := p_RelatedEntityID_44e2a8f4c8ae, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_44e2a8f4c8ae, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_44e2a8f4c8ae, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_44e2a8f4c8ae, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_44e2a8f4c8ae, p_EntityIDFieldName := p_EntityIDFieldName_44e2a8f4c8ae, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_44e2a8f4c8ae, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_44e2a8f4c8ae, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_44e2a8f4c8ae, p_Status := p_Status_44e2a8f4c8ae, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_44e2a8f4c8ae, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_44e2a8f4c8ae, p_AutoUpdateCategory := p_AutoUpdateCategory_44e2a8f4c8ae, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_44e2a8f4c8ae, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_44e2a8f4c8ae, p_Encrypt := p_Encrypt_44e2a8f4c8ae, p_EncryptionKeyID := p_EncryptionKeyID_44e2a8f4c8ae, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_44e2a8f4c8ae, p_SendEncryptedValue := p_SendEncryptedValue_44e2a8f4c8ae, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_44e2a8f4c8ae, p_IsSoftForeignKey := p_IsSoftForeignKey_44e2a8f4c8ae, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_44e2a8f4c8ae, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_44e2a8f4c8ae, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_44e2a8f4c8ae, p_JSONTypeDefinition := p_JSONTypeDefinition_44e2a8f4c8ae, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_44e2a8f4c8ae, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_44e2a8f4c8ae, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_44e2a8f4c8ae, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_44e2a8f4c8ae, p_IsComputed := p_IsComputed_44e2a8f4c8ae, p_EmbeddedRecord := p_EmbeddedRecord_44e2a8f4c8ae, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_44e2a8f4c8ae, p_Configuration_Clear := TRUE, p_ID := p_ID_44e2a8f4c8ae);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_ab0229bc3c20 VARCHAR(255);
  p_Description_ab0229bc3c20 TEXT;
  p_AutoUpdateDescription_ab0229bc3c20 BOOLEAN;
  p_IsPrimaryKey_ab0229bc3c20 BOOLEAN;
  p_IsUnique_ab0229bc3c20 BOOLEAN;
  p_Category_ab0229bc3c20 VARCHAR(255);
  p_ValueListType_ab0229bc3c20 VARCHAR(20);
  p_ExtendedType_ab0229bc3c20 VARCHAR(50);
  p_CodeType_ab0229bc3c20 VARCHAR(50);
  p_DefaultInView_ab0229bc3c20 BOOLEAN;
  p_ViewCellTemplate_ab0229bc3c20 TEXT;
  p_DefaultColumnWidth_ab0229bc3c20 INTEGER;
  p_AllowUpdateAPI_ab0229bc3c20 BOOLEAN;
  p_AllowUpdateInView_ab0229bc3c20 BOOLEAN;
  p_IncludeInUserSearchAPI_ab0229bc3c20 BOOLEAN;
  p_FullTextSearchEnabled_ab0229bc3c20 BOOLEAN;
  p_UserSearchParamFormatAPI_ab0229bc3c20 VARCHAR(500);
  p_IncludeInGeneratedForm_ab0229bc3c20 BOOLEAN;
  p_GeneratedFormSection_ab0229bc3c20 VARCHAR(10);
  p_IsNameField_ab0229bc3c20 BOOLEAN;
  p_RelatedEntityID_ab0229bc3c20 UUID;
  p_RelatedEntityFieldName_ab0229bc3c20 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_ab0229bc3c20 BOOLEAN;
  p_RelatedEntityNameFieldMap_ab0229bc3c20 VARCHAR(255);
  p_RelatedEntityDisplayType_ab0229bc3c20 VARCHAR(20);
  p_EntityIDFieldName_ab0229bc3c20 VARCHAR(100);
  p_ScopeDefault_ab0229bc3c20 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_ab0229bc3c20 BOOLEAN;
  p_ValuesToPackWithSchema_ab0229bc3c20 VARCHAR(10);
  p_Status_ab0229bc3c20 VARCHAR(25);
  p_AutoUpdateIsNameField_ab0229bc3c20 BOOLEAN;
  p_AutoUpdateDefaultInView_ab0229bc3c20 BOOLEAN;
  p_AutoUpdateCategory_ab0229bc3c20 BOOLEAN;
  p_AutoUpdateDisplayName_ab0229bc3c20 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_ab0229bc3c20 BOOLEAN;
  p_Encrypt_ab0229bc3c20 BOOLEAN;
  p_EncryptionKeyID_ab0229bc3c20 UUID;
  p_AllowDecryptInAPI_ab0229bc3c20 BOOLEAN;
  p_SendEncryptedValue_ab0229bc3c20 BOOLEAN;
  p_IsSoftPrimaryKey_ab0229bc3c20 BOOLEAN;
  p_IsSoftForeignKey_ab0229bc3c20 BOOLEAN;
  p_RelatedEntityJoinFields_ab0229bc3c20 TEXT;
  p_JSONType_ab0229bc3c20 VARCHAR(255);
  p_JSONTypeIsArray_ab0229bc3c20 BOOLEAN;
  p_JSONTypeDefinition_ab0229bc3c20 TEXT;
  p_UserSearchPredicateAPI_ab0229bc3c20 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_ab0229bc3c20 BOOLEAN;
  p_AutoUpdateFullTextSearch_ab0229bc3c20 BOOLEAN;
  p_AutoUpdateExtendedType_ab0229bc3c20 BOOLEAN;
  p_IsComputed_ab0229bc3c20 BOOLEAN;
  p_EmbeddedRecord_ab0229bc3c20 TEXT;
  p_Configuration_ab0229bc3c20 TEXT;
  p_ID_ab0229bc3c20 UUID;
BEGIN
  p_DisplayName_ab0229bc3c20 := 'Code';
  p_Description_ab0229bc3c20 := 'Stable machine code the detectors raise against (e.g. PROGRESS_JUDGMENT_CALL). Unique. Never rename: raising apps key on it.';
  p_AutoUpdateDescription_ab0229bc3c20 := TRUE;
  p_IsPrimaryKey_ab0229bc3c20 := FALSE;
  p_IsUnique_ab0229bc3c20 := TRUE;
  p_Category_ab0229bc3c20 := 'Type Details';
  p_ValueListType_ab0229bc3c20 := 'None';
  p_DefaultInView_ab0229bc3c20 := TRUE;
  p_DefaultColumnWidth_ab0229bc3c20 := 150;
  p_AllowUpdateAPI_ab0229bc3c20 := TRUE;
  p_AllowUpdateInView_ab0229bc3c20 := TRUE;
  p_IncludeInUserSearchAPI_ab0229bc3c20 := FALSE;
  p_FullTextSearchEnabled_ab0229bc3c20 := FALSE;
  p_IncludeInGeneratedForm_ab0229bc3c20 := TRUE;
  p_GeneratedFormSection_ab0229bc3c20 := 'Category';
  p_IsNameField_ab0229bc3c20 := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_ab0229bc3c20 := FALSE;
  p_RelatedEntityDisplayType_ab0229bc3c20 := 'Search';
  p_AutoUpdateRelatedEntityInfo_ab0229bc3c20 := TRUE;
  p_ValuesToPackWithSchema_ab0229bc3c20 := 'Auto';
  p_Status_ab0229bc3c20 := 'Active';
  p_AutoUpdateIsNameField_ab0229bc3c20 := TRUE;
  p_AutoUpdateDefaultInView_ab0229bc3c20 := TRUE;
  p_AutoUpdateCategory_ab0229bc3c20 := TRUE;
  p_AutoUpdateDisplayName_ab0229bc3c20 := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_ab0229bc3c20 := TRUE;
  p_Encrypt_ab0229bc3c20 := FALSE;
  p_AllowDecryptInAPI_ab0229bc3c20 := FALSE;
  p_SendEncryptedValue_ab0229bc3c20 := FALSE;
  p_IsSoftPrimaryKey_ab0229bc3c20 := FALSE;
  p_IsSoftForeignKey_ab0229bc3c20 := FALSE;
  p_JSONTypeIsArray_ab0229bc3c20 := FALSE;
  p_UserSearchPredicateAPI_ab0229bc3c20 := 'Contains';
  p_AutoUpdateUserSearchPredicate_ab0229bc3c20 := TRUE;
  p_AutoUpdateFullTextSearch_ab0229bc3c20 := TRUE;
  p_AutoUpdateExtendedType_ab0229bc3c20 := TRUE;
  p_IsComputed_ab0229bc3c20 := FALSE;
  p_ID_ab0229bc3c20 := 'F6C8AFEF-968D-401F-8A34-9DC4BFA593C7';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM ${mjSchema}."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_ab0229bc3c20,
    'Description', p_Description_ab0229bc3c20,
    'AutoUpdateDescription', p_AutoUpdateDescription_ab0229bc3c20,
    'IsPrimaryKey', p_IsPrimaryKey_ab0229bc3c20,
    'IsUnique', p_IsUnique_ab0229bc3c20,
    'Category', p_Category_ab0229bc3c20,
    'ValueListType', p_ValueListType_ab0229bc3c20,
    'ExtendedType', p_ExtendedType_ab0229bc3c20,
    'CodeType', p_CodeType_ab0229bc3c20,
    'DefaultInView', p_DefaultInView_ab0229bc3c20,
    'ViewCellTemplate', p_ViewCellTemplate_ab0229bc3c20,
    'DefaultColumnWidth', p_DefaultColumnWidth_ab0229bc3c20,
    'AllowUpdateAPI', p_AllowUpdateAPI_ab0229bc3c20,
    'AllowUpdateInView', p_AllowUpdateInView_ab0229bc3c20,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_ab0229bc3c20,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_ab0229bc3c20,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_ab0229bc3c20,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_ab0229bc3c20,
    'GeneratedFormSection', p_GeneratedFormSection_ab0229bc3c20,
    'IsNameField', p_IsNameField_ab0229bc3c20,
    'RelatedEntityID', p_RelatedEntityID_ab0229bc3c20,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_ab0229bc3c20,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_ab0229bc3c20,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_ab0229bc3c20,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_ab0229bc3c20,
    'EntityIDFieldName', p_EntityIDFieldName_ab0229bc3c20,
    'ScopeDefault', p_ScopeDefault_ab0229bc3c20,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_ab0229bc3c20,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_ab0229bc3c20,
    'Status', p_Status_ab0229bc3c20,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_ab0229bc3c20,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_ab0229bc3c20,
    'AutoUpdateCategory', p_AutoUpdateCategory_ab0229bc3c20,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_ab0229bc3c20,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_ab0229bc3c20,
    'Encrypt', p_Encrypt_ab0229bc3c20,
    'EncryptionKeyID', p_EncryptionKeyID_ab0229bc3c20,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_ab0229bc3c20,
    'SendEncryptedValue', p_SendEncryptedValue_ab0229bc3c20,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_ab0229bc3c20,
    'IsSoftForeignKey', p_IsSoftForeignKey_ab0229bc3c20,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_ab0229bc3c20,
    'JSONType', p_JSONType_ab0229bc3c20,
    'JSONTypeIsArray', p_JSONTypeIsArray_ab0229bc3c20,
    'JSONTypeDefinition', p_JSONTypeDefinition_ab0229bc3c20,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_ab0229bc3c20,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_ab0229bc3c20,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_ab0229bc3c20,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_ab0229bc3c20,
    'IsComputed', p_IsComputed_ab0229bc3c20
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_ab0229bc3c20,
    'Configuration', p_Configuration_ab0229bc3c20,
    'ID', p_ID_ab0229bc3c20
  ));
  ELSE
    PERFORM ${mjSchema}."spUpdateEntityField"(p_DisplayName := p_DisplayName_ab0229bc3c20, p_Description := p_Description_ab0229bc3c20, p_AutoUpdateDescription := p_AutoUpdateDescription_ab0229bc3c20, p_IsPrimaryKey := p_IsPrimaryKey_ab0229bc3c20, p_IsUnique := p_IsUnique_ab0229bc3c20, p_Category := p_Category_ab0229bc3c20, p_ValueListType := p_ValueListType_ab0229bc3c20, p_ExtendedType := p_ExtendedType_ab0229bc3c20, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_ab0229bc3c20, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_ab0229bc3c20, p_ViewCellTemplate := p_ViewCellTemplate_ab0229bc3c20, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_ab0229bc3c20, p_AllowUpdateAPI := p_AllowUpdateAPI_ab0229bc3c20, p_AllowUpdateInView := p_AllowUpdateInView_ab0229bc3c20, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_ab0229bc3c20, p_FullTextSearchEnabled := p_FullTextSearchEnabled_ab0229bc3c20, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_ab0229bc3c20, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_ab0229bc3c20, p_GeneratedFormSection := p_GeneratedFormSection_ab0229bc3c20, p_IsNameField := p_IsNameField_ab0229bc3c20, p_RelatedEntityID := p_RelatedEntityID_ab0229bc3c20, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_ab0229bc3c20, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_ab0229bc3c20, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_ab0229bc3c20, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_ab0229bc3c20, p_EntityIDFieldName := p_EntityIDFieldName_ab0229bc3c20, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_ab0229bc3c20, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_ab0229bc3c20, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_ab0229bc3c20, p_Status := p_Status_ab0229bc3c20, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_ab0229bc3c20, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_ab0229bc3c20, p_AutoUpdateCategory := p_AutoUpdateCategory_ab0229bc3c20, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_ab0229bc3c20, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_ab0229bc3c20, p_Encrypt := p_Encrypt_ab0229bc3c20, p_EncryptionKeyID := p_EncryptionKeyID_ab0229bc3c20, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_ab0229bc3c20, p_SendEncryptedValue := p_SendEncryptedValue_ab0229bc3c20, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_ab0229bc3c20, p_IsSoftForeignKey := p_IsSoftForeignKey_ab0229bc3c20, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_ab0229bc3c20, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_ab0229bc3c20, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_ab0229bc3c20, p_JSONTypeDefinition := p_JSONTypeDefinition_ab0229bc3c20, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_ab0229bc3c20, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_ab0229bc3c20, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_ab0229bc3c20, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_ab0229bc3c20, p_IsComputed := p_IsComputed_ab0229bc3c20, p_EmbeddedRecord := p_EmbeddedRecord_ab0229bc3c20, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_ab0229bc3c20, p_Configuration_Clear := TRUE, p_ID := p_ID_ab0229bc3c20);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_9b07614c9630 VARCHAR(255);
  p_Description_9b07614c9630 TEXT;
  p_AutoUpdateDescription_9b07614c9630 BOOLEAN;
  p_IsPrimaryKey_9b07614c9630 BOOLEAN;
  p_IsUnique_9b07614c9630 BOOLEAN;
  p_Category_9b07614c9630 VARCHAR(255);
  p_ValueListType_9b07614c9630 VARCHAR(20);
  p_ExtendedType_9b07614c9630 VARCHAR(50);
  p_CodeType_9b07614c9630 VARCHAR(50);
  p_DefaultInView_9b07614c9630 BOOLEAN;
  p_ViewCellTemplate_9b07614c9630 TEXT;
  p_DefaultColumnWidth_9b07614c9630 INTEGER;
  p_AllowUpdateAPI_9b07614c9630 BOOLEAN;
  p_AllowUpdateInView_9b07614c9630 BOOLEAN;
  p_IncludeInUserSearchAPI_9b07614c9630 BOOLEAN;
  p_FullTextSearchEnabled_9b07614c9630 BOOLEAN;
  p_UserSearchParamFormatAPI_9b07614c9630 VARCHAR(500);
  p_IncludeInGeneratedForm_9b07614c9630 BOOLEAN;
  p_GeneratedFormSection_9b07614c9630 VARCHAR(10);
  p_IsNameField_9b07614c9630 BOOLEAN;
  p_RelatedEntityID_9b07614c9630 UUID;
  p_RelatedEntityFieldName_9b07614c9630 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_9b07614c9630 BOOLEAN;
  p_RelatedEntityNameFieldMap_9b07614c9630 VARCHAR(255);
  p_RelatedEntityDisplayType_9b07614c9630 VARCHAR(20);
  p_EntityIDFieldName_9b07614c9630 VARCHAR(100);
  p_ScopeDefault_9b07614c9630 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_9b07614c9630 BOOLEAN;
  p_ValuesToPackWithSchema_9b07614c9630 VARCHAR(10);
  p_Status_9b07614c9630 VARCHAR(25);
  p_AutoUpdateIsNameField_9b07614c9630 BOOLEAN;
  p_AutoUpdateDefaultInView_9b07614c9630 BOOLEAN;
  p_AutoUpdateCategory_9b07614c9630 BOOLEAN;
  p_AutoUpdateDisplayName_9b07614c9630 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_9b07614c9630 BOOLEAN;
  p_Encrypt_9b07614c9630 BOOLEAN;
  p_EncryptionKeyID_9b07614c9630 UUID;
  p_AllowDecryptInAPI_9b07614c9630 BOOLEAN;
  p_SendEncryptedValue_9b07614c9630 BOOLEAN;
  p_IsSoftPrimaryKey_9b07614c9630 BOOLEAN;
  p_IsSoftForeignKey_9b07614c9630 BOOLEAN;
  p_RelatedEntityJoinFields_9b07614c9630 TEXT;
  p_JSONType_9b07614c9630 VARCHAR(255);
  p_JSONTypeIsArray_9b07614c9630 BOOLEAN;
  p_JSONTypeDefinition_9b07614c9630 TEXT;
  p_UserSearchPredicateAPI_9b07614c9630 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_9b07614c9630 BOOLEAN;
  p_AutoUpdateFullTextSearch_9b07614c9630 BOOLEAN;
  p_AutoUpdateExtendedType_9b07614c9630 BOOLEAN;
  p_IsComputed_9b07614c9630 BOOLEAN;
  p_EmbeddedRecord_9b07614c9630 TEXT;
  p_Configuration_9b07614c9630 TEXT;
  p_ID_9b07614c9630 UUID;
BEGIN
  p_DisplayName_9b07614c9630 := 'Name';
  p_Description_9b07614c9630 := 'Display name for the exception kind.';
  p_AutoUpdateDescription_9b07614c9630 := TRUE;
  p_IsPrimaryKey_9b07614c9630 := FALSE;
  p_IsUnique_9b07614c9630 := FALSE;
  p_Category_9b07614c9630 := 'Type Details';
  p_ValueListType_9b07614c9630 := 'None';
  p_DefaultInView_9b07614c9630 := TRUE;
  p_DefaultColumnWidth_9b07614c9630 := 150;
  p_AllowUpdateAPI_9b07614c9630 := TRUE;
  p_AllowUpdateInView_9b07614c9630 := TRUE;
  p_IncludeInUserSearchAPI_9b07614c9630 := TRUE;
  p_FullTextSearchEnabled_9b07614c9630 := FALSE;
  p_IncludeInGeneratedForm_9b07614c9630 := TRUE;
  p_GeneratedFormSection_9b07614c9630 := 'Category';
  p_IsNameField_9b07614c9630 := TRUE;
  p_IncludeRelatedEntityNameFieldInBaseView_9b07614c9630 := FALSE;
  p_RelatedEntityDisplayType_9b07614c9630 := 'Search';
  p_AutoUpdateRelatedEntityInfo_9b07614c9630 := TRUE;
  p_ValuesToPackWithSchema_9b07614c9630 := 'Auto';
  p_Status_9b07614c9630 := 'Active';
  p_AutoUpdateIsNameField_9b07614c9630 := TRUE;
  p_AutoUpdateDefaultInView_9b07614c9630 := TRUE;
  p_AutoUpdateCategory_9b07614c9630 := TRUE;
  p_AutoUpdateDisplayName_9b07614c9630 := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_9b07614c9630 := TRUE;
  p_Encrypt_9b07614c9630 := FALSE;
  p_AllowDecryptInAPI_9b07614c9630 := FALSE;
  p_SendEncryptedValue_9b07614c9630 := FALSE;
  p_IsSoftPrimaryKey_9b07614c9630 := FALSE;
  p_IsSoftForeignKey_9b07614c9630 := FALSE;
  p_JSONTypeIsArray_9b07614c9630 := FALSE;
  p_UserSearchPredicateAPI_9b07614c9630 := 'Contains';
  p_AutoUpdateUserSearchPredicate_9b07614c9630 := TRUE;
  p_AutoUpdateFullTextSearch_9b07614c9630 := TRUE;
  p_AutoUpdateExtendedType_9b07614c9630 := TRUE;
  p_IsComputed_9b07614c9630 := FALSE;
  p_ID_9b07614c9630 := '7D073B02-26D3-4C14-B300-CABBBE265CB0';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM ${mjSchema}."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_9b07614c9630,
    'Description', p_Description_9b07614c9630,
    'AutoUpdateDescription', p_AutoUpdateDescription_9b07614c9630,
    'IsPrimaryKey', p_IsPrimaryKey_9b07614c9630,
    'IsUnique', p_IsUnique_9b07614c9630,
    'Category', p_Category_9b07614c9630,
    'ValueListType', p_ValueListType_9b07614c9630,
    'ExtendedType', p_ExtendedType_9b07614c9630,
    'CodeType', p_CodeType_9b07614c9630,
    'DefaultInView', p_DefaultInView_9b07614c9630,
    'ViewCellTemplate', p_ViewCellTemplate_9b07614c9630,
    'DefaultColumnWidth', p_DefaultColumnWidth_9b07614c9630,
    'AllowUpdateAPI', p_AllowUpdateAPI_9b07614c9630,
    'AllowUpdateInView', p_AllowUpdateInView_9b07614c9630,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_9b07614c9630,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_9b07614c9630,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_9b07614c9630,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_9b07614c9630,
    'GeneratedFormSection', p_GeneratedFormSection_9b07614c9630,
    'IsNameField', p_IsNameField_9b07614c9630,
    'RelatedEntityID', p_RelatedEntityID_9b07614c9630,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_9b07614c9630,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_9b07614c9630,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_9b07614c9630,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_9b07614c9630,
    'EntityIDFieldName', p_EntityIDFieldName_9b07614c9630,
    'ScopeDefault', p_ScopeDefault_9b07614c9630,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_9b07614c9630,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_9b07614c9630,
    'Status', p_Status_9b07614c9630,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_9b07614c9630,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_9b07614c9630,
    'AutoUpdateCategory', p_AutoUpdateCategory_9b07614c9630,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_9b07614c9630,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_9b07614c9630,
    'Encrypt', p_Encrypt_9b07614c9630,
    'EncryptionKeyID', p_EncryptionKeyID_9b07614c9630,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_9b07614c9630,
    'SendEncryptedValue', p_SendEncryptedValue_9b07614c9630,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_9b07614c9630,
    'IsSoftForeignKey', p_IsSoftForeignKey_9b07614c9630,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_9b07614c9630,
    'JSONType', p_JSONType_9b07614c9630,
    'JSONTypeIsArray', p_JSONTypeIsArray_9b07614c9630,
    'JSONTypeDefinition', p_JSONTypeDefinition_9b07614c9630,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_9b07614c9630,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_9b07614c9630,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_9b07614c9630,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_9b07614c9630,
    'IsComputed', p_IsComputed_9b07614c9630
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_9b07614c9630,
    'Configuration', p_Configuration_9b07614c9630,
    'ID', p_ID_9b07614c9630
  ));
  ELSE
    PERFORM ${mjSchema}."spUpdateEntityField"(p_DisplayName := p_DisplayName_9b07614c9630, p_Description := p_Description_9b07614c9630, p_AutoUpdateDescription := p_AutoUpdateDescription_9b07614c9630, p_IsPrimaryKey := p_IsPrimaryKey_9b07614c9630, p_IsUnique := p_IsUnique_9b07614c9630, p_Category := p_Category_9b07614c9630, p_ValueListType := p_ValueListType_9b07614c9630, p_ExtendedType := p_ExtendedType_9b07614c9630, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_9b07614c9630, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_9b07614c9630, p_ViewCellTemplate := p_ViewCellTemplate_9b07614c9630, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_9b07614c9630, p_AllowUpdateAPI := p_AllowUpdateAPI_9b07614c9630, p_AllowUpdateInView := p_AllowUpdateInView_9b07614c9630, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_9b07614c9630, p_FullTextSearchEnabled := p_FullTextSearchEnabled_9b07614c9630, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_9b07614c9630, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_9b07614c9630, p_GeneratedFormSection := p_GeneratedFormSection_9b07614c9630, p_IsNameField := p_IsNameField_9b07614c9630, p_RelatedEntityID := p_RelatedEntityID_9b07614c9630, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_9b07614c9630, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_9b07614c9630, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_9b07614c9630, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_9b07614c9630, p_EntityIDFieldName := p_EntityIDFieldName_9b07614c9630, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_9b07614c9630, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_9b07614c9630, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_9b07614c9630, p_Status := p_Status_9b07614c9630, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_9b07614c9630, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_9b07614c9630, p_AutoUpdateCategory := p_AutoUpdateCategory_9b07614c9630, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_9b07614c9630, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_9b07614c9630, p_Encrypt := p_Encrypt_9b07614c9630, p_EncryptionKeyID := p_EncryptionKeyID_9b07614c9630, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_9b07614c9630, p_SendEncryptedValue := p_SendEncryptedValue_9b07614c9630, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_9b07614c9630, p_IsSoftForeignKey := p_IsSoftForeignKey_9b07614c9630, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_9b07614c9630, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_9b07614c9630, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_9b07614c9630, p_JSONTypeDefinition := p_JSONTypeDefinition_9b07614c9630, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_9b07614c9630, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_9b07614c9630, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_9b07614c9630, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_9b07614c9630, p_IsComputed := p_IsComputed_9b07614c9630, p_EmbeddedRecord := p_EmbeddedRecord_9b07614c9630, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_9b07614c9630, p_Configuration_Clear := TRUE, p_ID := p_ID_9b07614c9630);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_fa217fda4a0e VARCHAR(255);
  p_Description_fa217fda4a0e TEXT;
  p_AutoUpdateDescription_fa217fda4a0e BOOLEAN;
  p_IsPrimaryKey_fa217fda4a0e BOOLEAN;
  p_IsUnique_fa217fda4a0e BOOLEAN;
  p_Category_fa217fda4a0e VARCHAR(255);
  p_ValueListType_fa217fda4a0e VARCHAR(20);
  p_ExtendedType_fa217fda4a0e VARCHAR(50);
  p_CodeType_fa217fda4a0e VARCHAR(50);
  p_DefaultInView_fa217fda4a0e BOOLEAN;
  p_ViewCellTemplate_fa217fda4a0e TEXT;
  p_DefaultColumnWidth_fa217fda4a0e INTEGER;
  p_AllowUpdateAPI_fa217fda4a0e BOOLEAN;
  p_AllowUpdateInView_fa217fda4a0e BOOLEAN;
  p_IncludeInUserSearchAPI_fa217fda4a0e BOOLEAN;
  p_FullTextSearchEnabled_fa217fda4a0e BOOLEAN;
  p_UserSearchParamFormatAPI_fa217fda4a0e VARCHAR(500);
  p_IncludeInGeneratedForm_fa217fda4a0e BOOLEAN;
  p_GeneratedFormSection_fa217fda4a0e VARCHAR(10);
  p_IsNameField_fa217fda4a0e BOOLEAN;
  p_RelatedEntityID_fa217fda4a0e UUID;
  p_RelatedEntityFieldName_fa217fda4a0e VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_fa217fda4a0e BOOLEAN;
  p_RelatedEntityNameFieldMap_fa217fda4a0e VARCHAR(255);
  p_RelatedEntityDisplayType_fa217fda4a0e VARCHAR(20);
  p_EntityIDFieldName_fa217fda4a0e VARCHAR(100);
  p_ScopeDefault_fa217fda4a0e VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_fa217fda4a0e BOOLEAN;
  p_ValuesToPackWithSchema_fa217fda4a0e VARCHAR(10);
  p_Status_fa217fda4a0e VARCHAR(25);
  p_AutoUpdateIsNameField_fa217fda4a0e BOOLEAN;
  p_AutoUpdateDefaultInView_fa217fda4a0e BOOLEAN;
  p_AutoUpdateCategory_fa217fda4a0e BOOLEAN;
  p_AutoUpdateDisplayName_fa217fda4a0e BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_fa217fda4a0e BOOLEAN;
  p_Encrypt_fa217fda4a0e BOOLEAN;
  p_EncryptionKeyID_fa217fda4a0e UUID;
  p_AllowDecryptInAPI_fa217fda4a0e BOOLEAN;
  p_SendEncryptedValue_fa217fda4a0e BOOLEAN;
  p_IsSoftPrimaryKey_fa217fda4a0e BOOLEAN;
  p_IsSoftForeignKey_fa217fda4a0e BOOLEAN;
  p_RelatedEntityJoinFields_fa217fda4a0e TEXT;
  p_JSONType_fa217fda4a0e VARCHAR(255);
  p_JSONTypeIsArray_fa217fda4a0e BOOLEAN;
  p_JSONTypeDefinition_fa217fda4a0e TEXT;
  p_UserSearchPredicateAPI_fa217fda4a0e VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_fa217fda4a0e BOOLEAN;
  p_AutoUpdateFullTextSearch_fa217fda4a0e BOOLEAN;
  p_AutoUpdateExtendedType_fa217fda4a0e BOOLEAN;
  p_IsComputed_fa217fda4a0e BOOLEAN;
  p_EmbeddedRecord_fa217fda4a0e TEXT;
  p_Configuration_fa217fda4a0e TEXT;
  p_ID_fa217fda4a0e UUID;
BEGIN
  p_DisplayName_fa217fda4a0e := 'Description';
  p_Description_fa217fda4a0e := 'What the detector looks for and why a reviewer should look at it.';
  p_AutoUpdateDescription_fa217fda4a0e := TRUE;
  p_IsPrimaryKey_fa217fda4a0e := FALSE;
  p_IsUnique_fa217fda4a0e := FALSE;
  p_Category_fa217fda4a0e := 'Type Details';
  p_ValueListType_fa217fda4a0e := 'None';
  p_DefaultInView_fa217fda4a0e := TRUE;
  p_DefaultColumnWidth_fa217fda4a0e := 150;
  p_AllowUpdateAPI_fa217fda4a0e := TRUE;
  p_AllowUpdateInView_fa217fda4a0e := TRUE;
  p_IncludeInUserSearchAPI_fa217fda4a0e := FALSE;
  p_FullTextSearchEnabled_fa217fda4a0e := FALSE;
  p_IncludeInGeneratedForm_fa217fda4a0e := TRUE;
  p_GeneratedFormSection_fa217fda4a0e := 'Category';
  p_IsNameField_fa217fda4a0e := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_fa217fda4a0e := FALSE;
  p_RelatedEntityDisplayType_fa217fda4a0e := 'Search';
  p_AutoUpdateRelatedEntityInfo_fa217fda4a0e := TRUE;
  p_ValuesToPackWithSchema_fa217fda4a0e := 'Auto';
  p_Status_fa217fda4a0e := 'Active';
  p_AutoUpdateIsNameField_fa217fda4a0e := TRUE;
  p_AutoUpdateDefaultInView_fa217fda4a0e := TRUE;
  p_AutoUpdateCategory_fa217fda4a0e := TRUE;
  p_AutoUpdateDisplayName_fa217fda4a0e := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_fa217fda4a0e := TRUE;
  p_Encrypt_fa217fda4a0e := FALSE;
  p_AllowDecryptInAPI_fa217fda4a0e := FALSE;
  p_SendEncryptedValue_fa217fda4a0e := FALSE;
  p_IsSoftPrimaryKey_fa217fda4a0e := FALSE;
  p_IsSoftForeignKey_fa217fda4a0e := FALSE;
  p_JSONTypeIsArray_fa217fda4a0e := FALSE;
  p_UserSearchPredicateAPI_fa217fda4a0e := 'Contains';
  p_AutoUpdateUserSearchPredicate_fa217fda4a0e := TRUE;
  p_AutoUpdateFullTextSearch_fa217fda4a0e := TRUE;
  p_AutoUpdateExtendedType_fa217fda4a0e := TRUE;
  p_IsComputed_fa217fda4a0e := FALSE;
  p_ID_fa217fda4a0e := 'EBCA4141-BC0D-48D7-A81E-EAF9741612C3';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM ${mjSchema}."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_fa217fda4a0e,
    'Description', p_Description_fa217fda4a0e,
    'AutoUpdateDescription', p_AutoUpdateDescription_fa217fda4a0e,
    'IsPrimaryKey', p_IsPrimaryKey_fa217fda4a0e,
    'IsUnique', p_IsUnique_fa217fda4a0e,
    'Category', p_Category_fa217fda4a0e,
    'ValueListType', p_ValueListType_fa217fda4a0e,
    'ExtendedType', p_ExtendedType_fa217fda4a0e,
    'CodeType', p_CodeType_fa217fda4a0e,
    'DefaultInView', p_DefaultInView_fa217fda4a0e,
    'ViewCellTemplate', p_ViewCellTemplate_fa217fda4a0e,
    'DefaultColumnWidth', p_DefaultColumnWidth_fa217fda4a0e,
    'AllowUpdateAPI', p_AllowUpdateAPI_fa217fda4a0e,
    'AllowUpdateInView', p_AllowUpdateInView_fa217fda4a0e,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_fa217fda4a0e,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_fa217fda4a0e,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_fa217fda4a0e,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_fa217fda4a0e,
    'GeneratedFormSection', p_GeneratedFormSection_fa217fda4a0e,
    'IsNameField', p_IsNameField_fa217fda4a0e,
    'RelatedEntityID', p_RelatedEntityID_fa217fda4a0e,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_fa217fda4a0e,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_fa217fda4a0e,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_fa217fda4a0e,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_fa217fda4a0e,
    'EntityIDFieldName', p_EntityIDFieldName_fa217fda4a0e,
    'ScopeDefault', p_ScopeDefault_fa217fda4a0e,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_fa217fda4a0e,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_fa217fda4a0e,
    'Status', p_Status_fa217fda4a0e,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_fa217fda4a0e,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_fa217fda4a0e,
    'AutoUpdateCategory', p_AutoUpdateCategory_fa217fda4a0e,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_fa217fda4a0e,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_fa217fda4a0e,
    'Encrypt', p_Encrypt_fa217fda4a0e,
    'EncryptionKeyID', p_EncryptionKeyID_fa217fda4a0e,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_fa217fda4a0e,
    'SendEncryptedValue', p_SendEncryptedValue_fa217fda4a0e,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_fa217fda4a0e,
    'IsSoftForeignKey', p_IsSoftForeignKey_fa217fda4a0e,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_fa217fda4a0e,
    'JSONType', p_JSONType_fa217fda4a0e,
    'JSONTypeIsArray', p_JSONTypeIsArray_fa217fda4a0e,
    'JSONTypeDefinition', p_JSONTypeDefinition_fa217fda4a0e,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_fa217fda4a0e,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_fa217fda4a0e,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_fa217fda4a0e,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_fa217fda4a0e,
    'IsComputed', p_IsComputed_fa217fda4a0e
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_fa217fda4a0e,
    'Configuration', p_Configuration_fa217fda4a0e,
    'ID', p_ID_fa217fda4a0e
  ));
  ELSE
    PERFORM ${mjSchema}."spUpdateEntityField"(p_DisplayName := p_DisplayName_fa217fda4a0e, p_Description := p_Description_fa217fda4a0e, p_AutoUpdateDescription := p_AutoUpdateDescription_fa217fda4a0e, p_IsPrimaryKey := p_IsPrimaryKey_fa217fda4a0e, p_IsUnique := p_IsUnique_fa217fda4a0e, p_Category := p_Category_fa217fda4a0e, p_ValueListType := p_ValueListType_fa217fda4a0e, p_ExtendedType := p_ExtendedType_fa217fda4a0e, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_fa217fda4a0e, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_fa217fda4a0e, p_ViewCellTemplate := p_ViewCellTemplate_fa217fda4a0e, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_fa217fda4a0e, p_AllowUpdateAPI := p_AllowUpdateAPI_fa217fda4a0e, p_AllowUpdateInView := p_AllowUpdateInView_fa217fda4a0e, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_fa217fda4a0e, p_FullTextSearchEnabled := p_FullTextSearchEnabled_fa217fda4a0e, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_fa217fda4a0e, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_fa217fda4a0e, p_GeneratedFormSection := p_GeneratedFormSection_fa217fda4a0e, p_IsNameField := p_IsNameField_fa217fda4a0e, p_RelatedEntityID := p_RelatedEntityID_fa217fda4a0e, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_fa217fda4a0e, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_fa217fda4a0e, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_fa217fda4a0e, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_fa217fda4a0e, p_EntityIDFieldName := p_EntityIDFieldName_fa217fda4a0e, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_fa217fda4a0e, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_fa217fda4a0e, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_fa217fda4a0e, p_Status := p_Status_fa217fda4a0e, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_fa217fda4a0e, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_fa217fda4a0e, p_AutoUpdateCategory := p_AutoUpdateCategory_fa217fda4a0e, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_fa217fda4a0e, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_fa217fda4a0e, p_Encrypt := p_Encrypt_fa217fda4a0e, p_EncryptionKeyID := p_EncryptionKeyID_fa217fda4a0e, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_fa217fda4a0e, p_SendEncryptedValue := p_SendEncryptedValue_fa217fda4a0e, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_fa217fda4a0e, p_IsSoftForeignKey := p_IsSoftForeignKey_fa217fda4a0e, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_fa217fda4a0e, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_fa217fda4a0e, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_fa217fda4a0e, p_JSONTypeDefinition := p_JSONTypeDefinition_fa217fda4a0e, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_fa217fda4a0e, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_fa217fda4a0e, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_fa217fda4a0e, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_fa217fda4a0e, p_IsComputed := p_IsComputed_fa217fda4a0e, p_EmbeddedRecord := p_EmbeddedRecord_fa217fda4a0e, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_fa217fda4a0e, p_Configuration_Clear := TRUE, p_ID := p_ID_fa217fda4a0e);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_30b3c6762b67 VARCHAR(255);
  p_Description_30b3c6762b67 TEXT;
  p_AutoUpdateDescription_30b3c6762b67 BOOLEAN;
  p_IsPrimaryKey_30b3c6762b67 BOOLEAN;
  p_IsUnique_30b3c6762b67 BOOLEAN;
  p_Category_30b3c6762b67 VARCHAR(255);
  p_ValueListType_30b3c6762b67 VARCHAR(20);
  p_ExtendedType_30b3c6762b67 VARCHAR(50);
  p_CodeType_30b3c6762b67 VARCHAR(50);
  p_DefaultInView_30b3c6762b67 BOOLEAN;
  p_ViewCellTemplate_30b3c6762b67 TEXT;
  p_DefaultColumnWidth_30b3c6762b67 INTEGER;
  p_AllowUpdateAPI_30b3c6762b67 BOOLEAN;
  p_AllowUpdateInView_30b3c6762b67 BOOLEAN;
  p_IncludeInUserSearchAPI_30b3c6762b67 BOOLEAN;
  p_FullTextSearchEnabled_30b3c6762b67 BOOLEAN;
  p_UserSearchParamFormatAPI_30b3c6762b67 VARCHAR(500);
  p_IncludeInGeneratedForm_30b3c6762b67 BOOLEAN;
  p_GeneratedFormSection_30b3c6762b67 VARCHAR(10);
  p_IsNameField_30b3c6762b67 BOOLEAN;
  p_RelatedEntityID_30b3c6762b67 UUID;
  p_RelatedEntityFieldName_30b3c6762b67 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_30b3c6762b67 BOOLEAN;
  p_RelatedEntityNameFieldMap_30b3c6762b67 VARCHAR(255);
  p_RelatedEntityDisplayType_30b3c6762b67 VARCHAR(20);
  p_EntityIDFieldName_30b3c6762b67 VARCHAR(100);
  p_ScopeDefault_30b3c6762b67 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_30b3c6762b67 BOOLEAN;
  p_ValuesToPackWithSchema_30b3c6762b67 VARCHAR(10);
  p_Status_30b3c6762b67 VARCHAR(25);
  p_AutoUpdateIsNameField_30b3c6762b67 BOOLEAN;
  p_AutoUpdateDefaultInView_30b3c6762b67 BOOLEAN;
  p_AutoUpdateCategory_30b3c6762b67 BOOLEAN;
  p_AutoUpdateDisplayName_30b3c6762b67 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_30b3c6762b67 BOOLEAN;
  p_Encrypt_30b3c6762b67 BOOLEAN;
  p_EncryptionKeyID_30b3c6762b67 UUID;
  p_AllowDecryptInAPI_30b3c6762b67 BOOLEAN;
  p_SendEncryptedValue_30b3c6762b67 BOOLEAN;
  p_IsSoftPrimaryKey_30b3c6762b67 BOOLEAN;
  p_IsSoftForeignKey_30b3c6762b67 BOOLEAN;
  p_RelatedEntityJoinFields_30b3c6762b67 TEXT;
  p_JSONType_30b3c6762b67 VARCHAR(255);
  p_JSONTypeIsArray_30b3c6762b67 BOOLEAN;
  p_JSONTypeDefinition_30b3c6762b67 TEXT;
  p_UserSearchPredicateAPI_30b3c6762b67 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_30b3c6762b67 BOOLEAN;
  p_AutoUpdateFullTextSearch_30b3c6762b67 BOOLEAN;
  p_AutoUpdateExtendedType_30b3c6762b67 BOOLEAN;
  p_IsComputed_30b3c6762b67 BOOLEAN;
  p_EmbeddedRecord_30b3c6762b67 TEXT;
  p_Configuration_30b3c6762b67 TEXT;
  p_ID_30b3c6762b67 UUID;
BEGIN
  p_DisplayName_30b3c6762b67 := 'Owning App';
  p_Description_30b3c6762b67 := 'The app whose detector raises this kind (e.g. orders, sales). Informational; accounting does not run the detector.';
  p_AutoUpdateDescription_30b3c6762b67 := TRUE;
  p_IsPrimaryKey_30b3c6762b67 := FALSE;
  p_IsUnique_30b3c6762b67 := FALSE;
  p_Category_30b3c6762b67 := 'Type Details';
  p_ValueListType_30b3c6762b67 := 'None';
  p_DefaultInView_30b3c6762b67 := TRUE;
  p_DefaultColumnWidth_30b3c6762b67 := 150;
  p_AllowUpdateAPI_30b3c6762b67 := TRUE;
  p_AllowUpdateInView_30b3c6762b67 := TRUE;
  p_IncludeInUserSearchAPI_30b3c6762b67 := FALSE;
  p_FullTextSearchEnabled_30b3c6762b67 := FALSE;
  p_IncludeInGeneratedForm_30b3c6762b67 := TRUE;
  p_GeneratedFormSection_30b3c6762b67 := 'Category';
  p_IsNameField_30b3c6762b67 := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_30b3c6762b67 := FALSE;
  p_RelatedEntityDisplayType_30b3c6762b67 := 'Search';
  p_AutoUpdateRelatedEntityInfo_30b3c6762b67 := TRUE;
  p_ValuesToPackWithSchema_30b3c6762b67 := 'Auto';
  p_Status_30b3c6762b67 := 'Active';
  p_AutoUpdateIsNameField_30b3c6762b67 := TRUE;
  p_AutoUpdateDefaultInView_30b3c6762b67 := TRUE;
  p_AutoUpdateCategory_30b3c6762b67 := TRUE;
  p_AutoUpdateDisplayName_30b3c6762b67 := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_30b3c6762b67 := TRUE;
  p_Encrypt_30b3c6762b67 := FALSE;
  p_AllowDecryptInAPI_30b3c6762b67 := FALSE;
  p_SendEncryptedValue_30b3c6762b67 := FALSE;
  p_IsSoftPrimaryKey_30b3c6762b67 := FALSE;
  p_IsSoftForeignKey_30b3c6762b67 := FALSE;
  p_JSONTypeIsArray_30b3c6762b67 := FALSE;
  p_UserSearchPredicateAPI_30b3c6762b67 := 'Contains';
  p_AutoUpdateUserSearchPredicate_30b3c6762b67 := TRUE;
  p_AutoUpdateFullTextSearch_30b3c6762b67 := TRUE;
  p_AutoUpdateExtendedType_30b3c6762b67 := TRUE;
  p_IsComputed_30b3c6762b67 := FALSE;
  p_ID_30b3c6762b67 := '21B3A095-4FD5-4CFE-920F-86274DCD79F3';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM ${mjSchema}."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_30b3c6762b67,
    'Description', p_Description_30b3c6762b67,
    'AutoUpdateDescription', p_AutoUpdateDescription_30b3c6762b67,
    'IsPrimaryKey', p_IsPrimaryKey_30b3c6762b67,
    'IsUnique', p_IsUnique_30b3c6762b67,
    'Category', p_Category_30b3c6762b67,
    'ValueListType', p_ValueListType_30b3c6762b67,
    'ExtendedType', p_ExtendedType_30b3c6762b67,
    'CodeType', p_CodeType_30b3c6762b67,
    'DefaultInView', p_DefaultInView_30b3c6762b67,
    'ViewCellTemplate', p_ViewCellTemplate_30b3c6762b67,
    'DefaultColumnWidth', p_DefaultColumnWidth_30b3c6762b67,
    'AllowUpdateAPI', p_AllowUpdateAPI_30b3c6762b67,
    'AllowUpdateInView', p_AllowUpdateInView_30b3c6762b67,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_30b3c6762b67,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_30b3c6762b67,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_30b3c6762b67,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_30b3c6762b67,
    'GeneratedFormSection', p_GeneratedFormSection_30b3c6762b67,
    'IsNameField', p_IsNameField_30b3c6762b67,
    'RelatedEntityID', p_RelatedEntityID_30b3c6762b67,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_30b3c6762b67,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_30b3c6762b67,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_30b3c6762b67,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_30b3c6762b67,
    'EntityIDFieldName', p_EntityIDFieldName_30b3c6762b67,
    'ScopeDefault', p_ScopeDefault_30b3c6762b67,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_30b3c6762b67,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_30b3c6762b67,
    'Status', p_Status_30b3c6762b67,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_30b3c6762b67,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_30b3c6762b67,
    'AutoUpdateCategory', p_AutoUpdateCategory_30b3c6762b67,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_30b3c6762b67,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_30b3c6762b67,
    'Encrypt', p_Encrypt_30b3c6762b67,
    'EncryptionKeyID', p_EncryptionKeyID_30b3c6762b67,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_30b3c6762b67,
    'SendEncryptedValue', p_SendEncryptedValue_30b3c6762b67,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_30b3c6762b67,
    'IsSoftForeignKey', p_IsSoftForeignKey_30b3c6762b67,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_30b3c6762b67,
    'JSONType', p_JSONType_30b3c6762b67,
    'JSONTypeIsArray', p_JSONTypeIsArray_30b3c6762b67,
    'JSONTypeDefinition', p_JSONTypeDefinition_30b3c6762b67,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_30b3c6762b67,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_30b3c6762b67,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_30b3c6762b67,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_30b3c6762b67,
    'IsComputed', p_IsComputed_30b3c6762b67
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_30b3c6762b67,
    'Configuration', p_Configuration_30b3c6762b67,
    'ID', p_ID_30b3c6762b67
  ));
  ELSE
    PERFORM ${mjSchema}."spUpdateEntityField"(p_DisplayName := p_DisplayName_30b3c6762b67, p_Description := p_Description_30b3c6762b67, p_AutoUpdateDescription := p_AutoUpdateDescription_30b3c6762b67, p_IsPrimaryKey := p_IsPrimaryKey_30b3c6762b67, p_IsUnique := p_IsUnique_30b3c6762b67, p_Category := p_Category_30b3c6762b67, p_ValueListType := p_ValueListType_30b3c6762b67, p_ExtendedType := p_ExtendedType_30b3c6762b67, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_30b3c6762b67, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_30b3c6762b67, p_ViewCellTemplate := p_ViewCellTemplate_30b3c6762b67, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_30b3c6762b67, p_AllowUpdateAPI := p_AllowUpdateAPI_30b3c6762b67, p_AllowUpdateInView := p_AllowUpdateInView_30b3c6762b67, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_30b3c6762b67, p_FullTextSearchEnabled := p_FullTextSearchEnabled_30b3c6762b67, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_30b3c6762b67, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_30b3c6762b67, p_GeneratedFormSection := p_GeneratedFormSection_30b3c6762b67, p_IsNameField := p_IsNameField_30b3c6762b67, p_RelatedEntityID := p_RelatedEntityID_30b3c6762b67, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_30b3c6762b67, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_30b3c6762b67, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_30b3c6762b67, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_30b3c6762b67, p_EntityIDFieldName := p_EntityIDFieldName_30b3c6762b67, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_30b3c6762b67, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_30b3c6762b67, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_30b3c6762b67, p_Status := p_Status_30b3c6762b67, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_30b3c6762b67, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_30b3c6762b67, p_AutoUpdateCategory := p_AutoUpdateCategory_30b3c6762b67, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_30b3c6762b67, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_30b3c6762b67, p_Encrypt := p_Encrypt_30b3c6762b67, p_EncryptionKeyID := p_EncryptionKeyID_30b3c6762b67, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_30b3c6762b67, p_SendEncryptedValue := p_SendEncryptedValue_30b3c6762b67, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_30b3c6762b67, p_IsSoftForeignKey := p_IsSoftForeignKey_30b3c6762b67, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_30b3c6762b67, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_30b3c6762b67, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_30b3c6762b67, p_JSONTypeDefinition := p_JSONTypeDefinition_30b3c6762b67, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_30b3c6762b67, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_30b3c6762b67, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_30b3c6762b67, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_30b3c6762b67, p_IsComputed := p_IsComputed_30b3c6762b67, p_EmbeddedRecord := p_EmbeddedRecord_30b3c6762b67, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_30b3c6762b67, p_Configuration_Clear := TRUE, p_ID := p_ID_30b3c6762b67);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_ecb450003e88 VARCHAR(255);
  p_Description_ecb450003e88 TEXT;
  p_AutoUpdateDescription_ecb450003e88 BOOLEAN;
  p_IsPrimaryKey_ecb450003e88 BOOLEAN;
  p_IsUnique_ecb450003e88 BOOLEAN;
  p_Category_ecb450003e88 VARCHAR(255);
  p_ValueListType_ecb450003e88 VARCHAR(20);
  p_ExtendedType_ecb450003e88 VARCHAR(50);
  p_CodeType_ecb450003e88 VARCHAR(50);
  p_DefaultInView_ecb450003e88 BOOLEAN;
  p_ViewCellTemplate_ecb450003e88 TEXT;
  p_DefaultColumnWidth_ecb450003e88 INTEGER;
  p_AllowUpdateAPI_ecb450003e88 BOOLEAN;
  p_AllowUpdateInView_ecb450003e88 BOOLEAN;
  p_IncludeInUserSearchAPI_ecb450003e88 BOOLEAN;
  p_FullTextSearchEnabled_ecb450003e88 BOOLEAN;
  p_UserSearchParamFormatAPI_ecb450003e88 VARCHAR(500);
  p_IncludeInGeneratedForm_ecb450003e88 BOOLEAN;
  p_GeneratedFormSection_ecb450003e88 VARCHAR(10);
  p_IsNameField_ecb450003e88 BOOLEAN;
  p_RelatedEntityID_ecb450003e88 UUID;
  p_RelatedEntityFieldName_ecb450003e88 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_ecb450003e88 BOOLEAN;
  p_RelatedEntityNameFieldMap_ecb450003e88 VARCHAR(255);
  p_RelatedEntityDisplayType_ecb450003e88 VARCHAR(20);
  p_EntityIDFieldName_ecb450003e88 VARCHAR(100);
  p_ScopeDefault_ecb450003e88 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_ecb450003e88 BOOLEAN;
  p_ValuesToPackWithSchema_ecb450003e88 VARCHAR(10);
  p_Status_ecb450003e88 VARCHAR(25);
  p_AutoUpdateIsNameField_ecb450003e88 BOOLEAN;
  p_AutoUpdateDefaultInView_ecb450003e88 BOOLEAN;
  p_AutoUpdateCategory_ecb450003e88 BOOLEAN;
  p_AutoUpdateDisplayName_ecb450003e88 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_ecb450003e88 BOOLEAN;
  p_Encrypt_ecb450003e88 BOOLEAN;
  p_EncryptionKeyID_ecb450003e88 UUID;
  p_AllowDecryptInAPI_ecb450003e88 BOOLEAN;
  p_SendEncryptedValue_ecb450003e88 BOOLEAN;
  p_IsSoftPrimaryKey_ecb450003e88 BOOLEAN;
  p_IsSoftForeignKey_ecb450003e88 BOOLEAN;
  p_RelatedEntityJoinFields_ecb450003e88 TEXT;
  p_JSONType_ecb450003e88 VARCHAR(255);
  p_JSONTypeIsArray_ecb450003e88 BOOLEAN;
  p_JSONTypeDefinition_ecb450003e88 TEXT;
  p_UserSearchPredicateAPI_ecb450003e88 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_ecb450003e88 BOOLEAN;
  p_AutoUpdateFullTextSearch_ecb450003e88 BOOLEAN;
  p_AutoUpdateExtendedType_ecb450003e88 BOOLEAN;
  p_IsComputed_ecb450003e88 BOOLEAN;
  p_EmbeddedRecord_ecb450003e88 TEXT;
  p_Configuration_ecb450003e88 TEXT;
  p_ID_ecb450003e88 UUID;
BEGIN
  p_DisplayName_ecb450003e88 := 'Is Active';
  p_Description_ecb450003e88 := 'Whether the detector raises this kind. An inactive type is skipped by Accounting.RaiseFinanceExceptions and by the detector itself; existing rows stay on the list.';
  p_AutoUpdateDescription_ecb450003e88 := TRUE;
  p_IsPrimaryKey_ecb450003e88 := FALSE;
  p_IsUnique_ecb450003e88 := FALSE;
  p_Category_ecb450003e88 := 'Type Details';
  p_ValueListType_ecb450003e88 := 'None';
  p_DefaultInView_ecb450003e88 := FALSE;
  p_DefaultColumnWidth_ecb450003e88 := 150;
  p_AllowUpdateAPI_ecb450003e88 := TRUE;
  p_AllowUpdateInView_ecb450003e88 := TRUE;
  p_IncludeInUserSearchAPI_ecb450003e88 := FALSE;
  p_FullTextSearchEnabled_ecb450003e88 := FALSE;
  p_IncludeInGeneratedForm_ecb450003e88 := TRUE;
  p_GeneratedFormSection_ecb450003e88 := 'Category';
  p_IsNameField_ecb450003e88 := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_ecb450003e88 := FALSE;
  p_RelatedEntityDisplayType_ecb450003e88 := 'Search';
  p_AutoUpdateRelatedEntityInfo_ecb450003e88 := TRUE;
  p_ValuesToPackWithSchema_ecb450003e88 := 'Auto';
  p_Status_ecb450003e88 := 'Active';
  p_AutoUpdateIsNameField_ecb450003e88 := TRUE;
  p_AutoUpdateDefaultInView_ecb450003e88 := TRUE;
  p_AutoUpdateCategory_ecb450003e88 := TRUE;
  p_AutoUpdateDisplayName_ecb450003e88 := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_ecb450003e88 := TRUE;
  p_Encrypt_ecb450003e88 := FALSE;
  p_AllowDecryptInAPI_ecb450003e88 := FALSE;
  p_SendEncryptedValue_ecb450003e88 := FALSE;
  p_IsSoftPrimaryKey_ecb450003e88 := FALSE;
  p_IsSoftForeignKey_ecb450003e88 := FALSE;
  p_JSONTypeIsArray_ecb450003e88 := FALSE;
  p_UserSearchPredicateAPI_ecb450003e88 := 'Contains';
  p_AutoUpdateUserSearchPredicate_ecb450003e88 := TRUE;
  p_AutoUpdateFullTextSearch_ecb450003e88 := TRUE;
  p_AutoUpdateExtendedType_ecb450003e88 := TRUE;
  p_IsComputed_ecb450003e88 := FALSE;
  p_ID_ecb450003e88 := '5598AFF7-5740-4255-9B11-9D9A4F287536';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM ${mjSchema}."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_ecb450003e88,
    'Description', p_Description_ecb450003e88,
    'AutoUpdateDescription', p_AutoUpdateDescription_ecb450003e88,
    'IsPrimaryKey', p_IsPrimaryKey_ecb450003e88,
    'IsUnique', p_IsUnique_ecb450003e88,
    'Category', p_Category_ecb450003e88,
    'ValueListType', p_ValueListType_ecb450003e88,
    'ExtendedType', p_ExtendedType_ecb450003e88,
    'CodeType', p_CodeType_ecb450003e88,
    'DefaultInView', p_DefaultInView_ecb450003e88,
    'ViewCellTemplate', p_ViewCellTemplate_ecb450003e88,
    'DefaultColumnWidth', p_DefaultColumnWidth_ecb450003e88,
    'AllowUpdateAPI', p_AllowUpdateAPI_ecb450003e88,
    'AllowUpdateInView', p_AllowUpdateInView_ecb450003e88,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_ecb450003e88,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_ecb450003e88,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_ecb450003e88,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_ecb450003e88,
    'GeneratedFormSection', p_GeneratedFormSection_ecb450003e88,
    'IsNameField', p_IsNameField_ecb450003e88,
    'RelatedEntityID', p_RelatedEntityID_ecb450003e88,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_ecb450003e88,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_ecb450003e88,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_ecb450003e88,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_ecb450003e88,
    'EntityIDFieldName', p_EntityIDFieldName_ecb450003e88,
    'ScopeDefault', p_ScopeDefault_ecb450003e88,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_ecb450003e88,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_ecb450003e88,
    'Status', p_Status_ecb450003e88,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_ecb450003e88,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_ecb450003e88,
    'AutoUpdateCategory', p_AutoUpdateCategory_ecb450003e88,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_ecb450003e88,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_ecb450003e88,
    'Encrypt', p_Encrypt_ecb450003e88,
    'EncryptionKeyID', p_EncryptionKeyID_ecb450003e88,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_ecb450003e88,
    'SendEncryptedValue', p_SendEncryptedValue_ecb450003e88,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_ecb450003e88,
    'IsSoftForeignKey', p_IsSoftForeignKey_ecb450003e88,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_ecb450003e88,
    'JSONType', p_JSONType_ecb450003e88,
    'JSONTypeIsArray', p_JSONTypeIsArray_ecb450003e88,
    'JSONTypeDefinition', p_JSONTypeDefinition_ecb450003e88,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_ecb450003e88,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_ecb450003e88,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_ecb450003e88,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_ecb450003e88,
    'IsComputed', p_IsComputed_ecb450003e88
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_ecb450003e88,
    'Configuration', p_Configuration_ecb450003e88,
    'ID', p_ID_ecb450003e88
  ));
  ELSE
    PERFORM ${mjSchema}."spUpdateEntityField"(p_DisplayName := p_DisplayName_ecb450003e88, p_Description := p_Description_ecb450003e88, p_AutoUpdateDescription := p_AutoUpdateDescription_ecb450003e88, p_IsPrimaryKey := p_IsPrimaryKey_ecb450003e88, p_IsUnique := p_IsUnique_ecb450003e88, p_Category := p_Category_ecb450003e88, p_ValueListType := p_ValueListType_ecb450003e88, p_ExtendedType := p_ExtendedType_ecb450003e88, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_ecb450003e88, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_ecb450003e88, p_ViewCellTemplate := p_ViewCellTemplate_ecb450003e88, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_ecb450003e88, p_AllowUpdateAPI := p_AllowUpdateAPI_ecb450003e88, p_AllowUpdateInView := p_AllowUpdateInView_ecb450003e88, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_ecb450003e88, p_FullTextSearchEnabled := p_FullTextSearchEnabled_ecb450003e88, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_ecb450003e88, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_ecb450003e88, p_GeneratedFormSection := p_GeneratedFormSection_ecb450003e88, p_IsNameField := p_IsNameField_ecb450003e88, p_RelatedEntityID := p_RelatedEntityID_ecb450003e88, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_ecb450003e88, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_ecb450003e88, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_ecb450003e88, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_ecb450003e88, p_EntityIDFieldName := p_EntityIDFieldName_ecb450003e88, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_ecb450003e88, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_ecb450003e88, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_ecb450003e88, p_Status := p_Status_ecb450003e88, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_ecb450003e88, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_ecb450003e88, p_AutoUpdateCategory := p_AutoUpdateCategory_ecb450003e88, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_ecb450003e88, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_ecb450003e88, p_Encrypt := p_Encrypt_ecb450003e88, p_EncryptionKeyID := p_EncryptionKeyID_ecb450003e88, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_ecb450003e88, p_SendEncryptedValue := p_SendEncryptedValue_ecb450003e88, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_ecb450003e88, p_IsSoftForeignKey := p_IsSoftForeignKey_ecb450003e88, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_ecb450003e88, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_ecb450003e88, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_ecb450003e88, p_JSONTypeDefinition := p_JSONTypeDefinition_ecb450003e88, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_ecb450003e88, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_ecb450003e88, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_ecb450003e88, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_ecb450003e88, p_IsComputed := p_IsComputed_ecb450003e88, p_EmbeddedRecord := p_EmbeddedRecord_ecb450003e88, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_ecb450003e88, p_Configuration_Clear := TRUE, p_ID := p_ID_ecb450003e88);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_11ebf6044a39 VARCHAR(255);
  p_Description_11ebf6044a39 TEXT;
  p_AutoUpdateDescription_11ebf6044a39 BOOLEAN;
  p_IsPrimaryKey_11ebf6044a39 BOOLEAN;
  p_IsUnique_11ebf6044a39 BOOLEAN;
  p_Category_11ebf6044a39 VARCHAR(255);
  p_ValueListType_11ebf6044a39 VARCHAR(20);
  p_ExtendedType_11ebf6044a39 VARCHAR(50);
  p_CodeType_11ebf6044a39 VARCHAR(50);
  p_DefaultInView_11ebf6044a39 BOOLEAN;
  p_ViewCellTemplate_11ebf6044a39 TEXT;
  p_DefaultColumnWidth_11ebf6044a39 INTEGER;
  p_AllowUpdateAPI_11ebf6044a39 BOOLEAN;
  p_AllowUpdateInView_11ebf6044a39 BOOLEAN;
  p_IncludeInUserSearchAPI_11ebf6044a39 BOOLEAN;
  p_FullTextSearchEnabled_11ebf6044a39 BOOLEAN;
  p_UserSearchParamFormatAPI_11ebf6044a39 VARCHAR(500);
  p_IncludeInGeneratedForm_11ebf6044a39 BOOLEAN;
  p_GeneratedFormSection_11ebf6044a39 VARCHAR(10);
  p_IsNameField_11ebf6044a39 BOOLEAN;
  p_RelatedEntityID_11ebf6044a39 UUID;
  p_RelatedEntityFieldName_11ebf6044a39 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_11ebf6044a39 BOOLEAN;
  p_RelatedEntityNameFieldMap_11ebf6044a39 VARCHAR(255);
  p_RelatedEntityDisplayType_11ebf6044a39 VARCHAR(20);
  p_EntityIDFieldName_11ebf6044a39 VARCHAR(100);
  p_ScopeDefault_11ebf6044a39 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_11ebf6044a39 BOOLEAN;
  p_ValuesToPackWithSchema_11ebf6044a39 VARCHAR(10);
  p_Status_11ebf6044a39 VARCHAR(25);
  p_AutoUpdateIsNameField_11ebf6044a39 BOOLEAN;
  p_AutoUpdateDefaultInView_11ebf6044a39 BOOLEAN;
  p_AutoUpdateCategory_11ebf6044a39 BOOLEAN;
  p_AutoUpdateDisplayName_11ebf6044a39 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_11ebf6044a39 BOOLEAN;
  p_Encrypt_11ebf6044a39 BOOLEAN;
  p_EncryptionKeyID_11ebf6044a39 UUID;
  p_AllowDecryptInAPI_11ebf6044a39 BOOLEAN;
  p_SendEncryptedValue_11ebf6044a39 BOOLEAN;
  p_IsSoftPrimaryKey_11ebf6044a39 BOOLEAN;
  p_IsSoftForeignKey_11ebf6044a39 BOOLEAN;
  p_RelatedEntityJoinFields_11ebf6044a39 TEXT;
  p_JSONType_11ebf6044a39 VARCHAR(255);
  p_JSONTypeIsArray_11ebf6044a39 BOOLEAN;
  p_JSONTypeDefinition_11ebf6044a39 TEXT;
  p_UserSearchPredicateAPI_11ebf6044a39 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_11ebf6044a39 BOOLEAN;
  p_AutoUpdateFullTextSearch_11ebf6044a39 BOOLEAN;
  p_AutoUpdateExtendedType_11ebf6044a39 BOOLEAN;
  p_IsComputed_11ebf6044a39 BOOLEAN;
  p_EmbeddedRecord_11ebf6044a39 TEXT;
  p_Configuration_11ebf6044a39 TEXT;
  p_ID_11ebf6044a39 UUID;
BEGIN
  p_DisplayName_11ebf6044a39 := 'Configuration';
  p_Description_11ebf6044a39 := 'JSON object of the detector''s thresholds (e.g. {"MinDaysSinceClose":7}). Read by the detector through Accounting.GetFinanceExceptionTypes. Must be valid JSON.';
  p_AutoUpdateDescription_11ebf6044a39 := TRUE;
  p_IsPrimaryKey_11ebf6044a39 := FALSE;
  p_IsUnique_11ebf6044a39 := FALSE;
  p_Category_11ebf6044a39 := 'Type Details';
  p_ValueListType_11ebf6044a39 := 'None';
  p_DefaultInView_11ebf6044a39 := FALSE;
  p_DefaultColumnWidth_11ebf6044a39 := 150;
  p_AllowUpdateAPI_11ebf6044a39 := TRUE;
  p_AllowUpdateInView_11ebf6044a39 := TRUE;
  p_IncludeInUserSearchAPI_11ebf6044a39 := FALSE;
  p_FullTextSearchEnabled_11ebf6044a39 := FALSE;
  p_IncludeInGeneratedForm_11ebf6044a39 := TRUE;
  p_GeneratedFormSection_11ebf6044a39 := 'Category';
  p_IsNameField_11ebf6044a39 := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_11ebf6044a39 := FALSE;
  p_RelatedEntityDisplayType_11ebf6044a39 := 'Search';
  p_AutoUpdateRelatedEntityInfo_11ebf6044a39 := TRUE;
  p_ValuesToPackWithSchema_11ebf6044a39 := 'Auto';
  p_Status_11ebf6044a39 := 'Active';
  p_AutoUpdateIsNameField_11ebf6044a39 := TRUE;
  p_AutoUpdateDefaultInView_11ebf6044a39 := TRUE;
  p_AutoUpdateCategory_11ebf6044a39 := TRUE;
  p_AutoUpdateDisplayName_11ebf6044a39 := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_11ebf6044a39 := TRUE;
  p_Encrypt_11ebf6044a39 := FALSE;
  p_AllowDecryptInAPI_11ebf6044a39 := FALSE;
  p_SendEncryptedValue_11ebf6044a39 := FALSE;
  p_IsSoftPrimaryKey_11ebf6044a39 := FALSE;
  p_IsSoftForeignKey_11ebf6044a39 := FALSE;
  p_JSONTypeIsArray_11ebf6044a39 := FALSE;
  p_UserSearchPredicateAPI_11ebf6044a39 := 'Contains';
  p_AutoUpdateUserSearchPredicate_11ebf6044a39 := TRUE;
  p_AutoUpdateFullTextSearch_11ebf6044a39 := TRUE;
  p_AutoUpdateExtendedType_11ebf6044a39 := TRUE;
  p_IsComputed_11ebf6044a39 := FALSE;
  p_ID_11ebf6044a39 := '4A61DAC3-BAE8-4F53-A329-2A1DD54C47C7';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM ${mjSchema}."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_11ebf6044a39,
    'Description', p_Description_11ebf6044a39,
    'AutoUpdateDescription', p_AutoUpdateDescription_11ebf6044a39,
    'IsPrimaryKey', p_IsPrimaryKey_11ebf6044a39,
    'IsUnique', p_IsUnique_11ebf6044a39,
    'Category', p_Category_11ebf6044a39,
    'ValueListType', p_ValueListType_11ebf6044a39,
    'ExtendedType', p_ExtendedType_11ebf6044a39,
    'CodeType', p_CodeType_11ebf6044a39,
    'DefaultInView', p_DefaultInView_11ebf6044a39,
    'ViewCellTemplate', p_ViewCellTemplate_11ebf6044a39,
    'DefaultColumnWidth', p_DefaultColumnWidth_11ebf6044a39,
    'AllowUpdateAPI', p_AllowUpdateAPI_11ebf6044a39,
    'AllowUpdateInView', p_AllowUpdateInView_11ebf6044a39,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_11ebf6044a39,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_11ebf6044a39,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_11ebf6044a39,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_11ebf6044a39,
    'GeneratedFormSection', p_GeneratedFormSection_11ebf6044a39,
    'IsNameField', p_IsNameField_11ebf6044a39,
    'RelatedEntityID', p_RelatedEntityID_11ebf6044a39,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_11ebf6044a39,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_11ebf6044a39,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_11ebf6044a39,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_11ebf6044a39,
    'EntityIDFieldName', p_EntityIDFieldName_11ebf6044a39,
    'ScopeDefault', p_ScopeDefault_11ebf6044a39,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_11ebf6044a39,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_11ebf6044a39,
    'Status', p_Status_11ebf6044a39,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_11ebf6044a39,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_11ebf6044a39,
    'AutoUpdateCategory', p_AutoUpdateCategory_11ebf6044a39,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_11ebf6044a39,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_11ebf6044a39,
    'Encrypt', p_Encrypt_11ebf6044a39,
    'EncryptionKeyID', p_EncryptionKeyID_11ebf6044a39,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_11ebf6044a39,
    'SendEncryptedValue', p_SendEncryptedValue_11ebf6044a39,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_11ebf6044a39,
    'IsSoftForeignKey', p_IsSoftForeignKey_11ebf6044a39,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_11ebf6044a39,
    'JSONType', p_JSONType_11ebf6044a39,
    'JSONTypeIsArray', p_JSONTypeIsArray_11ebf6044a39,
    'JSONTypeDefinition', p_JSONTypeDefinition_11ebf6044a39,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_11ebf6044a39,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_11ebf6044a39,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_11ebf6044a39,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_11ebf6044a39,
    'IsComputed', p_IsComputed_11ebf6044a39
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_11ebf6044a39,
    'Configuration', p_Configuration_11ebf6044a39,
    'ID', p_ID_11ebf6044a39
  ));
  ELSE
    PERFORM ${mjSchema}."spUpdateEntityField"(p_DisplayName := p_DisplayName_11ebf6044a39, p_Description := p_Description_11ebf6044a39, p_AutoUpdateDescription := p_AutoUpdateDescription_11ebf6044a39, p_IsPrimaryKey := p_IsPrimaryKey_11ebf6044a39, p_IsUnique := p_IsUnique_11ebf6044a39, p_Category := p_Category_11ebf6044a39, p_ValueListType := p_ValueListType_11ebf6044a39, p_ExtendedType := p_ExtendedType_11ebf6044a39, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_11ebf6044a39, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_11ebf6044a39, p_ViewCellTemplate := p_ViewCellTemplate_11ebf6044a39, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_11ebf6044a39, p_AllowUpdateAPI := p_AllowUpdateAPI_11ebf6044a39, p_AllowUpdateInView := p_AllowUpdateInView_11ebf6044a39, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_11ebf6044a39, p_FullTextSearchEnabled := p_FullTextSearchEnabled_11ebf6044a39, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_11ebf6044a39, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_11ebf6044a39, p_GeneratedFormSection := p_GeneratedFormSection_11ebf6044a39, p_IsNameField := p_IsNameField_11ebf6044a39, p_RelatedEntityID := p_RelatedEntityID_11ebf6044a39, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_11ebf6044a39, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_11ebf6044a39, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_11ebf6044a39, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_11ebf6044a39, p_EntityIDFieldName := p_EntityIDFieldName_11ebf6044a39, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_11ebf6044a39, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_11ebf6044a39, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_11ebf6044a39, p_Status := p_Status_11ebf6044a39, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_11ebf6044a39, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_11ebf6044a39, p_AutoUpdateCategory := p_AutoUpdateCategory_11ebf6044a39, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_11ebf6044a39, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_11ebf6044a39, p_Encrypt := p_Encrypt_11ebf6044a39, p_EncryptionKeyID := p_EncryptionKeyID_11ebf6044a39, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_11ebf6044a39, p_SendEncryptedValue := p_SendEncryptedValue_11ebf6044a39, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_11ebf6044a39, p_IsSoftForeignKey := p_IsSoftForeignKey_11ebf6044a39, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_11ebf6044a39, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_11ebf6044a39, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_11ebf6044a39, p_JSONTypeDefinition := p_JSONTypeDefinition_11ebf6044a39, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_11ebf6044a39, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_11ebf6044a39, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_11ebf6044a39, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_11ebf6044a39, p_IsComputed := p_IsComputed_11ebf6044a39, p_EmbeddedRecord := p_EmbeddedRecord_11ebf6044a39, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_11ebf6044a39, p_Configuration_Clear := TRUE, p_ID := p_ID_11ebf6044a39);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_6da181e92957 VARCHAR(255);
  p_Description_6da181e92957 TEXT;
  p_AutoUpdateDescription_6da181e92957 BOOLEAN;
  p_IsPrimaryKey_6da181e92957 BOOLEAN;
  p_IsUnique_6da181e92957 BOOLEAN;
  p_Category_6da181e92957 VARCHAR(255);
  p_ValueListType_6da181e92957 VARCHAR(20);
  p_ExtendedType_6da181e92957 VARCHAR(50);
  p_CodeType_6da181e92957 VARCHAR(50);
  p_DefaultInView_6da181e92957 BOOLEAN;
  p_ViewCellTemplate_6da181e92957 TEXT;
  p_DefaultColumnWidth_6da181e92957 INTEGER;
  p_AllowUpdateAPI_6da181e92957 BOOLEAN;
  p_AllowUpdateInView_6da181e92957 BOOLEAN;
  p_IncludeInUserSearchAPI_6da181e92957 BOOLEAN;
  p_FullTextSearchEnabled_6da181e92957 BOOLEAN;
  p_UserSearchParamFormatAPI_6da181e92957 VARCHAR(500);
  p_IncludeInGeneratedForm_6da181e92957 BOOLEAN;
  p_GeneratedFormSection_6da181e92957 VARCHAR(10);
  p_IsNameField_6da181e92957 BOOLEAN;
  p_RelatedEntityID_6da181e92957 UUID;
  p_RelatedEntityFieldName_6da181e92957 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_6da181e92957 BOOLEAN;
  p_RelatedEntityNameFieldMap_6da181e92957 VARCHAR(255);
  p_RelatedEntityDisplayType_6da181e92957 VARCHAR(20);
  p_EntityIDFieldName_6da181e92957 VARCHAR(100);
  p_ScopeDefault_6da181e92957 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_6da181e92957 BOOLEAN;
  p_ValuesToPackWithSchema_6da181e92957 VARCHAR(10);
  p_Status_6da181e92957 VARCHAR(25);
  p_AutoUpdateIsNameField_6da181e92957 BOOLEAN;
  p_AutoUpdateDefaultInView_6da181e92957 BOOLEAN;
  p_AutoUpdateCategory_6da181e92957 BOOLEAN;
  p_AutoUpdateDisplayName_6da181e92957 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_6da181e92957 BOOLEAN;
  p_Encrypt_6da181e92957 BOOLEAN;
  p_EncryptionKeyID_6da181e92957 UUID;
  p_AllowDecryptInAPI_6da181e92957 BOOLEAN;
  p_SendEncryptedValue_6da181e92957 BOOLEAN;
  p_IsSoftPrimaryKey_6da181e92957 BOOLEAN;
  p_IsSoftForeignKey_6da181e92957 BOOLEAN;
  p_RelatedEntityJoinFields_6da181e92957 TEXT;
  p_JSONType_6da181e92957 VARCHAR(255);
  p_JSONTypeIsArray_6da181e92957 BOOLEAN;
  p_JSONTypeDefinition_6da181e92957 TEXT;
  p_UserSearchPredicateAPI_6da181e92957 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_6da181e92957 BOOLEAN;
  p_AutoUpdateFullTextSearch_6da181e92957 BOOLEAN;
  p_AutoUpdateExtendedType_6da181e92957 BOOLEAN;
  p_IsComputed_6da181e92957 BOOLEAN;
  p_EmbeddedRecord_6da181e92957 TEXT;
  p_Configuration_6da181e92957 TEXT;
  p_ID_6da181e92957 UUID;
BEGIN
  p_DisplayName_6da181e92957 := 'Created At';
  p_AutoUpdateDescription_6da181e92957 := TRUE;
  p_IsPrimaryKey_6da181e92957 := FALSE;
  p_IsUnique_6da181e92957 := FALSE;
  p_Category_6da181e92957 := 'System Metadata';
  p_ValueListType_6da181e92957 := 'None';
  p_DefaultInView_6da181e92957 := FALSE;
  p_DefaultColumnWidth_6da181e92957 := 100;
  p_AllowUpdateAPI_6da181e92957 := FALSE;
  p_AllowUpdateInView_6da181e92957 := TRUE;
  p_IncludeInUserSearchAPI_6da181e92957 := FALSE;
  p_FullTextSearchEnabled_6da181e92957 := FALSE;
  p_IncludeInGeneratedForm_6da181e92957 := TRUE;
  p_GeneratedFormSection_6da181e92957 := 'Category';
  p_IsNameField_6da181e92957 := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_6da181e92957 := FALSE;
  p_RelatedEntityDisplayType_6da181e92957 := 'Search';
  p_AutoUpdateRelatedEntityInfo_6da181e92957 := TRUE;
  p_ValuesToPackWithSchema_6da181e92957 := 'Auto';
  p_Status_6da181e92957 := 'Active';
  p_AutoUpdateIsNameField_6da181e92957 := TRUE;
  p_AutoUpdateDefaultInView_6da181e92957 := TRUE;
  p_AutoUpdateCategory_6da181e92957 := TRUE;
  p_AutoUpdateDisplayName_6da181e92957 := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_6da181e92957 := TRUE;
  p_Encrypt_6da181e92957 := FALSE;
  p_AllowDecryptInAPI_6da181e92957 := FALSE;
  p_SendEncryptedValue_6da181e92957 := FALSE;
  p_IsSoftPrimaryKey_6da181e92957 := FALSE;
  p_IsSoftForeignKey_6da181e92957 := FALSE;
  p_JSONTypeIsArray_6da181e92957 := FALSE;
  p_UserSearchPredicateAPI_6da181e92957 := 'Contains';
  p_AutoUpdateUserSearchPredicate_6da181e92957 := TRUE;
  p_AutoUpdateFullTextSearch_6da181e92957 := TRUE;
  p_AutoUpdateExtendedType_6da181e92957 := TRUE;
  p_IsComputed_6da181e92957 := FALSE;
  p_ID_6da181e92957 := '99482808-7995-4552-87C0-87BB50A2CFEE';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM ${mjSchema}."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_6da181e92957,
    'Description', p_Description_6da181e92957,
    'AutoUpdateDescription', p_AutoUpdateDescription_6da181e92957,
    'IsPrimaryKey', p_IsPrimaryKey_6da181e92957,
    'IsUnique', p_IsUnique_6da181e92957,
    'Category', p_Category_6da181e92957,
    'ValueListType', p_ValueListType_6da181e92957,
    'ExtendedType', p_ExtendedType_6da181e92957,
    'CodeType', p_CodeType_6da181e92957,
    'DefaultInView', p_DefaultInView_6da181e92957,
    'ViewCellTemplate', p_ViewCellTemplate_6da181e92957,
    'DefaultColumnWidth', p_DefaultColumnWidth_6da181e92957,
    'AllowUpdateAPI', p_AllowUpdateAPI_6da181e92957,
    'AllowUpdateInView', p_AllowUpdateInView_6da181e92957,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_6da181e92957,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_6da181e92957,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_6da181e92957,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_6da181e92957,
    'GeneratedFormSection', p_GeneratedFormSection_6da181e92957,
    'IsNameField', p_IsNameField_6da181e92957,
    'RelatedEntityID', p_RelatedEntityID_6da181e92957,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_6da181e92957,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_6da181e92957,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_6da181e92957,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_6da181e92957,
    'EntityIDFieldName', p_EntityIDFieldName_6da181e92957,
    'ScopeDefault', p_ScopeDefault_6da181e92957,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_6da181e92957,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_6da181e92957,
    'Status', p_Status_6da181e92957,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_6da181e92957,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_6da181e92957,
    'AutoUpdateCategory', p_AutoUpdateCategory_6da181e92957,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_6da181e92957,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_6da181e92957,
    'Encrypt', p_Encrypt_6da181e92957,
    'EncryptionKeyID', p_EncryptionKeyID_6da181e92957,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_6da181e92957,
    'SendEncryptedValue', p_SendEncryptedValue_6da181e92957,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_6da181e92957,
    'IsSoftForeignKey', p_IsSoftForeignKey_6da181e92957,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_6da181e92957,
    'JSONType', p_JSONType_6da181e92957,
    'JSONTypeIsArray', p_JSONTypeIsArray_6da181e92957,
    'JSONTypeDefinition', p_JSONTypeDefinition_6da181e92957,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_6da181e92957,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_6da181e92957,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_6da181e92957,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_6da181e92957,
    'IsComputed', p_IsComputed_6da181e92957
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_6da181e92957,
    'Configuration', p_Configuration_6da181e92957,
    'ID', p_ID_6da181e92957
  ));
  ELSE
    PERFORM ${mjSchema}."spUpdateEntityField"(p_DisplayName := p_DisplayName_6da181e92957, p_Description := p_Description_6da181e92957, p_Description_Clear := TRUE, p_AutoUpdateDescription := p_AutoUpdateDescription_6da181e92957, p_IsPrimaryKey := p_IsPrimaryKey_6da181e92957, p_IsUnique := p_IsUnique_6da181e92957, p_Category := p_Category_6da181e92957, p_ValueListType := p_ValueListType_6da181e92957, p_ExtendedType := p_ExtendedType_6da181e92957, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_6da181e92957, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_6da181e92957, p_ViewCellTemplate := p_ViewCellTemplate_6da181e92957, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_6da181e92957, p_AllowUpdateAPI := p_AllowUpdateAPI_6da181e92957, p_AllowUpdateInView := p_AllowUpdateInView_6da181e92957, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_6da181e92957, p_FullTextSearchEnabled := p_FullTextSearchEnabled_6da181e92957, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_6da181e92957, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_6da181e92957, p_GeneratedFormSection := p_GeneratedFormSection_6da181e92957, p_IsNameField := p_IsNameField_6da181e92957, p_RelatedEntityID := p_RelatedEntityID_6da181e92957, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_6da181e92957, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_6da181e92957, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_6da181e92957, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_6da181e92957, p_EntityIDFieldName := p_EntityIDFieldName_6da181e92957, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_6da181e92957, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_6da181e92957, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_6da181e92957, p_Status := p_Status_6da181e92957, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_6da181e92957, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_6da181e92957, p_AutoUpdateCategory := p_AutoUpdateCategory_6da181e92957, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_6da181e92957, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_6da181e92957, p_Encrypt := p_Encrypt_6da181e92957, p_EncryptionKeyID := p_EncryptionKeyID_6da181e92957, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_6da181e92957, p_SendEncryptedValue := p_SendEncryptedValue_6da181e92957, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_6da181e92957, p_IsSoftForeignKey := p_IsSoftForeignKey_6da181e92957, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_6da181e92957, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_6da181e92957, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_6da181e92957, p_JSONTypeDefinition := p_JSONTypeDefinition_6da181e92957, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_6da181e92957, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_6da181e92957, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_6da181e92957, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_6da181e92957, p_IsComputed := p_IsComputed_6da181e92957, p_EmbeddedRecord := p_EmbeddedRecord_6da181e92957, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_6da181e92957, p_Configuration_Clear := TRUE, p_ID := p_ID_6da181e92957);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_831fd3bd3cd0 VARCHAR(255);
  p_Description_831fd3bd3cd0 TEXT;
  p_AutoUpdateDescription_831fd3bd3cd0 BOOLEAN;
  p_IsPrimaryKey_831fd3bd3cd0 BOOLEAN;
  p_IsUnique_831fd3bd3cd0 BOOLEAN;
  p_Category_831fd3bd3cd0 VARCHAR(255);
  p_ValueListType_831fd3bd3cd0 VARCHAR(20);
  p_ExtendedType_831fd3bd3cd0 VARCHAR(50);
  p_CodeType_831fd3bd3cd0 VARCHAR(50);
  p_DefaultInView_831fd3bd3cd0 BOOLEAN;
  p_ViewCellTemplate_831fd3bd3cd0 TEXT;
  p_DefaultColumnWidth_831fd3bd3cd0 INTEGER;
  p_AllowUpdateAPI_831fd3bd3cd0 BOOLEAN;
  p_AllowUpdateInView_831fd3bd3cd0 BOOLEAN;
  p_IncludeInUserSearchAPI_831fd3bd3cd0 BOOLEAN;
  p_FullTextSearchEnabled_831fd3bd3cd0 BOOLEAN;
  p_UserSearchParamFormatAPI_831fd3bd3cd0 VARCHAR(500);
  p_IncludeInGeneratedForm_831fd3bd3cd0 BOOLEAN;
  p_GeneratedFormSection_831fd3bd3cd0 VARCHAR(10);
  p_IsNameField_831fd3bd3cd0 BOOLEAN;
  p_RelatedEntityID_831fd3bd3cd0 UUID;
  p_RelatedEntityFieldName_831fd3bd3cd0 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_831fd3bd3cd0 BOOLEAN;
  p_RelatedEntityNameFieldMap_831fd3bd3cd0 VARCHAR(255);
  p_RelatedEntityDisplayType_831fd3bd3cd0 VARCHAR(20);
  p_EntityIDFieldName_831fd3bd3cd0 VARCHAR(100);
  p_ScopeDefault_831fd3bd3cd0 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_831fd3bd3cd0 BOOLEAN;
  p_ValuesToPackWithSchema_831fd3bd3cd0 VARCHAR(10);
  p_Status_831fd3bd3cd0 VARCHAR(25);
  p_AutoUpdateIsNameField_831fd3bd3cd0 BOOLEAN;
  p_AutoUpdateDefaultInView_831fd3bd3cd0 BOOLEAN;
  p_AutoUpdateCategory_831fd3bd3cd0 BOOLEAN;
  p_AutoUpdateDisplayName_831fd3bd3cd0 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_831fd3bd3cd0 BOOLEAN;
  p_Encrypt_831fd3bd3cd0 BOOLEAN;
  p_EncryptionKeyID_831fd3bd3cd0 UUID;
  p_AllowDecryptInAPI_831fd3bd3cd0 BOOLEAN;
  p_SendEncryptedValue_831fd3bd3cd0 BOOLEAN;
  p_IsSoftPrimaryKey_831fd3bd3cd0 BOOLEAN;
  p_IsSoftForeignKey_831fd3bd3cd0 BOOLEAN;
  p_RelatedEntityJoinFields_831fd3bd3cd0 TEXT;
  p_JSONType_831fd3bd3cd0 VARCHAR(255);
  p_JSONTypeIsArray_831fd3bd3cd0 BOOLEAN;
  p_JSONTypeDefinition_831fd3bd3cd0 TEXT;
  p_UserSearchPredicateAPI_831fd3bd3cd0 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_831fd3bd3cd0 BOOLEAN;
  p_AutoUpdateFullTextSearch_831fd3bd3cd0 BOOLEAN;
  p_AutoUpdateExtendedType_831fd3bd3cd0 BOOLEAN;
  p_IsComputed_831fd3bd3cd0 BOOLEAN;
  p_EmbeddedRecord_831fd3bd3cd0 TEXT;
  p_Configuration_831fd3bd3cd0 TEXT;
  p_ID_831fd3bd3cd0 UUID;
BEGIN
  p_DisplayName_831fd3bd3cd0 := 'Updated At';
  p_AutoUpdateDescription_831fd3bd3cd0 := TRUE;
  p_IsPrimaryKey_831fd3bd3cd0 := FALSE;
  p_IsUnique_831fd3bd3cd0 := FALSE;
  p_Category_831fd3bd3cd0 := 'System Metadata';
  p_ValueListType_831fd3bd3cd0 := 'None';
  p_DefaultInView_831fd3bd3cd0 := FALSE;
  p_DefaultColumnWidth_831fd3bd3cd0 := 100;
  p_AllowUpdateAPI_831fd3bd3cd0 := FALSE;
  p_AllowUpdateInView_831fd3bd3cd0 := TRUE;
  p_IncludeInUserSearchAPI_831fd3bd3cd0 := FALSE;
  p_FullTextSearchEnabled_831fd3bd3cd0 := FALSE;
  p_IncludeInGeneratedForm_831fd3bd3cd0 := TRUE;
  p_GeneratedFormSection_831fd3bd3cd0 := 'Category';
  p_IsNameField_831fd3bd3cd0 := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_831fd3bd3cd0 := FALSE;
  p_RelatedEntityDisplayType_831fd3bd3cd0 := 'Search';
  p_AutoUpdateRelatedEntityInfo_831fd3bd3cd0 := TRUE;
  p_ValuesToPackWithSchema_831fd3bd3cd0 := 'Auto';
  p_Status_831fd3bd3cd0 := 'Active';
  p_AutoUpdateIsNameField_831fd3bd3cd0 := TRUE;
  p_AutoUpdateDefaultInView_831fd3bd3cd0 := TRUE;
  p_AutoUpdateCategory_831fd3bd3cd0 := TRUE;
  p_AutoUpdateDisplayName_831fd3bd3cd0 := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_831fd3bd3cd0 := TRUE;
  p_Encrypt_831fd3bd3cd0 := FALSE;
  p_AllowDecryptInAPI_831fd3bd3cd0 := FALSE;
  p_SendEncryptedValue_831fd3bd3cd0 := FALSE;
  p_IsSoftPrimaryKey_831fd3bd3cd0 := FALSE;
  p_IsSoftForeignKey_831fd3bd3cd0 := FALSE;
  p_JSONTypeIsArray_831fd3bd3cd0 := FALSE;
  p_UserSearchPredicateAPI_831fd3bd3cd0 := 'Contains';
  p_AutoUpdateUserSearchPredicate_831fd3bd3cd0 := TRUE;
  p_AutoUpdateFullTextSearch_831fd3bd3cd0 := TRUE;
  p_AutoUpdateExtendedType_831fd3bd3cd0 := TRUE;
  p_IsComputed_831fd3bd3cd0 := FALSE;
  p_ID_831fd3bd3cd0 := '1690156A-57F1-4065-9CAE-0730E82C4AED';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM ${mjSchema}."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_831fd3bd3cd0,
    'Description', p_Description_831fd3bd3cd0,
    'AutoUpdateDescription', p_AutoUpdateDescription_831fd3bd3cd0,
    'IsPrimaryKey', p_IsPrimaryKey_831fd3bd3cd0,
    'IsUnique', p_IsUnique_831fd3bd3cd0,
    'Category', p_Category_831fd3bd3cd0,
    'ValueListType', p_ValueListType_831fd3bd3cd0,
    'ExtendedType', p_ExtendedType_831fd3bd3cd0,
    'CodeType', p_CodeType_831fd3bd3cd0,
    'DefaultInView', p_DefaultInView_831fd3bd3cd0,
    'ViewCellTemplate', p_ViewCellTemplate_831fd3bd3cd0,
    'DefaultColumnWidth', p_DefaultColumnWidth_831fd3bd3cd0,
    'AllowUpdateAPI', p_AllowUpdateAPI_831fd3bd3cd0,
    'AllowUpdateInView', p_AllowUpdateInView_831fd3bd3cd0,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_831fd3bd3cd0,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_831fd3bd3cd0,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_831fd3bd3cd0,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_831fd3bd3cd0,
    'GeneratedFormSection', p_GeneratedFormSection_831fd3bd3cd0,
    'IsNameField', p_IsNameField_831fd3bd3cd0,
    'RelatedEntityID', p_RelatedEntityID_831fd3bd3cd0,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_831fd3bd3cd0,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_831fd3bd3cd0,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_831fd3bd3cd0,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_831fd3bd3cd0,
    'EntityIDFieldName', p_EntityIDFieldName_831fd3bd3cd0,
    'ScopeDefault', p_ScopeDefault_831fd3bd3cd0,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_831fd3bd3cd0,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_831fd3bd3cd0,
    'Status', p_Status_831fd3bd3cd0,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_831fd3bd3cd0,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_831fd3bd3cd0,
    'AutoUpdateCategory', p_AutoUpdateCategory_831fd3bd3cd0,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_831fd3bd3cd0,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_831fd3bd3cd0,
    'Encrypt', p_Encrypt_831fd3bd3cd0,
    'EncryptionKeyID', p_EncryptionKeyID_831fd3bd3cd0,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_831fd3bd3cd0,
    'SendEncryptedValue', p_SendEncryptedValue_831fd3bd3cd0,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_831fd3bd3cd0,
    'IsSoftForeignKey', p_IsSoftForeignKey_831fd3bd3cd0,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_831fd3bd3cd0,
    'JSONType', p_JSONType_831fd3bd3cd0,
    'JSONTypeIsArray', p_JSONTypeIsArray_831fd3bd3cd0,
    'JSONTypeDefinition', p_JSONTypeDefinition_831fd3bd3cd0,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_831fd3bd3cd0,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_831fd3bd3cd0,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_831fd3bd3cd0,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_831fd3bd3cd0,
    'IsComputed', p_IsComputed_831fd3bd3cd0
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_831fd3bd3cd0,
    'Configuration', p_Configuration_831fd3bd3cd0,
    'ID', p_ID_831fd3bd3cd0
  ));
  ELSE
    PERFORM ${mjSchema}."spUpdateEntityField"(p_DisplayName := p_DisplayName_831fd3bd3cd0, p_Description := p_Description_831fd3bd3cd0, p_Description_Clear := TRUE, p_AutoUpdateDescription := p_AutoUpdateDescription_831fd3bd3cd0, p_IsPrimaryKey := p_IsPrimaryKey_831fd3bd3cd0, p_IsUnique := p_IsUnique_831fd3bd3cd0, p_Category := p_Category_831fd3bd3cd0, p_ValueListType := p_ValueListType_831fd3bd3cd0, p_ExtendedType := p_ExtendedType_831fd3bd3cd0, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_831fd3bd3cd0, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_831fd3bd3cd0, p_ViewCellTemplate := p_ViewCellTemplate_831fd3bd3cd0, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_831fd3bd3cd0, p_AllowUpdateAPI := p_AllowUpdateAPI_831fd3bd3cd0, p_AllowUpdateInView := p_AllowUpdateInView_831fd3bd3cd0, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_831fd3bd3cd0, p_FullTextSearchEnabled := p_FullTextSearchEnabled_831fd3bd3cd0, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_831fd3bd3cd0, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_831fd3bd3cd0, p_GeneratedFormSection := p_GeneratedFormSection_831fd3bd3cd0, p_IsNameField := p_IsNameField_831fd3bd3cd0, p_RelatedEntityID := p_RelatedEntityID_831fd3bd3cd0, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_831fd3bd3cd0, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_831fd3bd3cd0, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_831fd3bd3cd0, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_831fd3bd3cd0, p_EntityIDFieldName := p_EntityIDFieldName_831fd3bd3cd0, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_831fd3bd3cd0, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_831fd3bd3cd0, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_831fd3bd3cd0, p_Status := p_Status_831fd3bd3cd0, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_831fd3bd3cd0, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_831fd3bd3cd0, p_AutoUpdateCategory := p_AutoUpdateCategory_831fd3bd3cd0, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_831fd3bd3cd0, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_831fd3bd3cd0, p_Encrypt := p_Encrypt_831fd3bd3cd0, p_EncryptionKeyID := p_EncryptionKeyID_831fd3bd3cd0, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_831fd3bd3cd0, p_SendEncryptedValue := p_SendEncryptedValue_831fd3bd3cd0, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_831fd3bd3cd0, p_IsSoftForeignKey := p_IsSoftForeignKey_831fd3bd3cd0, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_831fd3bd3cd0, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_831fd3bd3cd0, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_831fd3bd3cd0, p_JSONTypeDefinition := p_JSONTypeDefinition_831fd3bd3cd0, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_831fd3bd3cd0, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_831fd3bd3cd0, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_831fd3bd3cd0, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_831fd3bd3cd0, p_IsComputed := p_IsComputed_831fd3bd3cd0, p_EmbeddedRecord := p_EmbeddedRecord_831fd3bd3cd0, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_831fd3bd3cd0, p_Configuration_Clear := TRUE, p_ID := p_ID_831fd3bd3cd0);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_6f3e92dee882 VARCHAR(255);
  p_Description_6f3e92dee882 TEXT;
  p_AutoUpdateDescription_6f3e92dee882 BOOLEAN;
  p_IsPrimaryKey_6f3e92dee882 BOOLEAN;
  p_IsUnique_6f3e92dee882 BOOLEAN;
  p_Category_6f3e92dee882 VARCHAR(255);
  p_ValueListType_6f3e92dee882 VARCHAR(20);
  p_ExtendedType_6f3e92dee882 VARCHAR(50);
  p_CodeType_6f3e92dee882 VARCHAR(50);
  p_DefaultInView_6f3e92dee882 BOOLEAN;
  p_ViewCellTemplate_6f3e92dee882 TEXT;
  p_DefaultColumnWidth_6f3e92dee882 INTEGER;
  p_AllowUpdateAPI_6f3e92dee882 BOOLEAN;
  p_AllowUpdateInView_6f3e92dee882 BOOLEAN;
  p_IncludeInUserSearchAPI_6f3e92dee882 BOOLEAN;
  p_FullTextSearchEnabled_6f3e92dee882 BOOLEAN;
  p_UserSearchParamFormatAPI_6f3e92dee882 VARCHAR(500);
  p_IncludeInGeneratedForm_6f3e92dee882 BOOLEAN;
  p_GeneratedFormSection_6f3e92dee882 VARCHAR(10);
  p_IsNameField_6f3e92dee882 BOOLEAN;
  p_RelatedEntityID_6f3e92dee882 UUID;
  p_RelatedEntityFieldName_6f3e92dee882 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_6f3e92dee882 BOOLEAN;
  p_RelatedEntityNameFieldMap_6f3e92dee882 VARCHAR(255);
  p_RelatedEntityDisplayType_6f3e92dee882 VARCHAR(20);
  p_EntityIDFieldName_6f3e92dee882 VARCHAR(100);
  p_ScopeDefault_6f3e92dee882 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_6f3e92dee882 BOOLEAN;
  p_ValuesToPackWithSchema_6f3e92dee882 VARCHAR(10);
  p_Status_6f3e92dee882 VARCHAR(25);
  p_AutoUpdateIsNameField_6f3e92dee882 BOOLEAN;
  p_AutoUpdateDefaultInView_6f3e92dee882 BOOLEAN;
  p_AutoUpdateCategory_6f3e92dee882 BOOLEAN;
  p_AutoUpdateDisplayName_6f3e92dee882 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_6f3e92dee882 BOOLEAN;
  p_Encrypt_6f3e92dee882 BOOLEAN;
  p_EncryptionKeyID_6f3e92dee882 UUID;
  p_AllowDecryptInAPI_6f3e92dee882 BOOLEAN;
  p_SendEncryptedValue_6f3e92dee882 BOOLEAN;
  p_IsSoftPrimaryKey_6f3e92dee882 BOOLEAN;
  p_IsSoftForeignKey_6f3e92dee882 BOOLEAN;
  p_RelatedEntityJoinFields_6f3e92dee882 TEXT;
  p_JSONType_6f3e92dee882 VARCHAR(255);
  p_JSONTypeIsArray_6f3e92dee882 BOOLEAN;
  p_JSONTypeDefinition_6f3e92dee882 TEXT;
  p_UserSearchPredicateAPI_6f3e92dee882 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_6f3e92dee882 BOOLEAN;
  p_AutoUpdateFullTextSearch_6f3e92dee882 BOOLEAN;
  p_AutoUpdateExtendedType_6f3e92dee882 BOOLEAN;
  p_IsComputed_6f3e92dee882 BOOLEAN;
  p_EmbeddedRecord_6f3e92dee882 TEXT;
  p_Configuration_6f3e92dee882 TEXT;
  p_ID_6f3e92dee882 UUID;
BEGIN
  p_DisplayName_6f3e92dee882 := 'Parent GL Account ID Depth';
  p_AutoUpdateDescription_6f3e92dee882 := TRUE;
  p_IsPrimaryKey_6f3e92dee882 := FALSE;
  p_IsUnique_6f3e92dee882 := FALSE;
  p_Category_6f3e92dee882 := 'Hierarchy and Rollup';
  p_ValueListType_6f3e92dee882 := 'None';
  p_DefaultInView_6f3e92dee882 := FALSE;
  p_DefaultColumnWidth_6f3e92dee882 := 50;
  p_AllowUpdateAPI_6f3e92dee882 := FALSE;
  p_AllowUpdateInView_6f3e92dee882 := TRUE;
  p_IncludeInUserSearchAPI_6f3e92dee882 := FALSE;
  p_FullTextSearchEnabled_6f3e92dee882 := FALSE;
  p_IncludeInGeneratedForm_6f3e92dee882 := TRUE;
  p_GeneratedFormSection_6f3e92dee882 := 'Category';
  p_IsNameField_6f3e92dee882 := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_6f3e92dee882 := FALSE;
  p_RelatedEntityDisplayType_6f3e92dee882 := 'Search';
  p_AutoUpdateRelatedEntityInfo_6f3e92dee882 := TRUE;
  p_ValuesToPackWithSchema_6f3e92dee882 := 'Auto';
  p_Status_6f3e92dee882 := 'Active';
  p_AutoUpdateIsNameField_6f3e92dee882 := TRUE;
  p_AutoUpdateDefaultInView_6f3e92dee882 := TRUE;
  p_AutoUpdateCategory_6f3e92dee882 := TRUE;
  p_AutoUpdateDisplayName_6f3e92dee882 := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_6f3e92dee882 := TRUE;
  p_Encrypt_6f3e92dee882 := FALSE;
  p_AllowDecryptInAPI_6f3e92dee882 := FALSE;
  p_SendEncryptedValue_6f3e92dee882 := FALSE;
  p_IsSoftPrimaryKey_6f3e92dee882 := FALSE;
  p_IsSoftForeignKey_6f3e92dee882 := FALSE;
  p_JSONTypeIsArray_6f3e92dee882 := FALSE;
  p_UserSearchPredicateAPI_6f3e92dee882 := 'Contains';
  p_AutoUpdateUserSearchPredicate_6f3e92dee882 := TRUE;
  p_AutoUpdateFullTextSearch_6f3e92dee882 := TRUE;
  p_AutoUpdateExtendedType_6f3e92dee882 := TRUE;
  p_IsComputed_6f3e92dee882 := FALSE;
  p_ID_6f3e92dee882 := 'D3739223-F864-4BE5-B399-F3C1BFE6952F';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM ${mjSchema}."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_6f3e92dee882,
    'Description', p_Description_6f3e92dee882,
    'AutoUpdateDescription', p_AutoUpdateDescription_6f3e92dee882,
    'IsPrimaryKey', p_IsPrimaryKey_6f3e92dee882,
    'IsUnique', p_IsUnique_6f3e92dee882,
    'Category', p_Category_6f3e92dee882,
    'ValueListType', p_ValueListType_6f3e92dee882,
    'ExtendedType', p_ExtendedType_6f3e92dee882,
    'CodeType', p_CodeType_6f3e92dee882,
    'DefaultInView', p_DefaultInView_6f3e92dee882,
    'ViewCellTemplate', p_ViewCellTemplate_6f3e92dee882,
    'DefaultColumnWidth', p_DefaultColumnWidth_6f3e92dee882,
    'AllowUpdateAPI', p_AllowUpdateAPI_6f3e92dee882,
    'AllowUpdateInView', p_AllowUpdateInView_6f3e92dee882,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_6f3e92dee882,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_6f3e92dee882,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_6f3e92dee882,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_6f3e92dee882,
    'GeneratedFormSection', p_GeneratedFormSection_6f3e92dee882,
    'IsNameField', p_IsNameField_6f3e92dee882,
    'RelatedEntityID', p_RelatedEntityID_6f3e92dee882,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_6f3e92dee882,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_6f3e92dee882,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_6f3e92dee882,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_6f3e92dee882,
    'EntityIDFieldName', p_EntityIDFieldName_6f3e92dee882,
    'ScopeDefault', p_ScopeDefault_6f3e92dee882,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_6f3e92dee882,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_6f3e92dee882,
    'Status', p_Status_6f3e92dee882,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_6f3e92dee882,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_6f3e92dee882,
    'AutoUpdateCategory', p_AutoUpdateCategory_6f3e92dee882,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_6f3e92dee882,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_6f3e92dee882,
    'Encrypt', p_Encrypt_6f3e92dee882,
    'EncryptionKeyID', p_EncryptionKeyID_6f3e92dee882,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_6f3e92dee882,
    'SendEncryptedValue', p_SendEncryptedValue_6f3e92dee882,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_6f3e92dee882,
    'IsSoftForeignKey', p_IsSoftForeignKey_6f3e92dee882,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_6f3e92dee882,
    'JSONType', p_JSONType_6f3e92dee882,
    'JSONTypeIsArray', p_JSONTypeIsArray_6f3e92dee882,
    'JSONTypeDefinition', p_JSONTypeDefinition_6f3e92dee882,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_6f3e92dee882,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_6f3e92dee882,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_6f3e92dee882,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_6f3e92dee882,
    'IsComputed', p_IsComputed_6f3e92dee882
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_6f3e92dee882,
    'Configuration', p_Configuration_6f3e92dee882,
    'ID', p_ID_6f3e92dee882
  ));
  ELSE
    PERFORM ${mjSchema}."spUpdateEntityField"(p_DisplayName := p_DisplayName_6f3e92dee882, p_Description := p_Description_6f3e92dee882, p_Description_Clear := TRUE, p_AutoUpdateDescription := p_AutoUpdateDescription_6f3e92dee882, p_IsPrimaryKey := p_IsPrimaryKey_6f3e92dee882, p_IsUnique := p_IsUnique_6f3e92dee882, p_Category := p_Category_6f3e92dee882, p_ValueListType := p_ValueListType_6f3e92dee882, p_ExtendedType := p_ExtendedType_6f3e92dee882, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_6f3e92dee882, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_6f3e92dee882, p_ViewCellTemplate := p_ViewCellTemplate_6f3e92dee882, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_6f3e92dee882, p_AllowUpdateAPI := p_AllowUpdateAPI_6f3e92dee882, p_AllowUpdateInView := p_AllowUpdateInView_6f3e92dee882, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_6f3e92dee882, p_FullTextSearchEnabled := p_FullTextSearchEnabled_6f3e92dee882, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_6f3e92dee882, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_6f3e92dee882, p_GeneratedFormSection := p_GeneratedFormSection_6f3e92dee882, p_IsNameField := p_IsNameField_6f3e92dee882, p_RelatedEntityID := p_RelatedEntityID_6f3e92dee882, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_6f3e92dee882, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_6f3e92dee882, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_6f3e92dee882, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_6f3e92dee882, p_EntityIDFieldName := p_EntityIDFieldName_6f3e92dee882, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_6f3e92dee882, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_6f3e92dee882, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_6f3e92dee882, p_Status := p_Status_6f3e92dee882, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_6f3e92dee882, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_6f3e92dee882, p_AutoUpdateCategory := p_AutoUpdateCategory_6f3e92dee882, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_6f3e92dee882, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_6f3e92dee882, p_Encrypt := p_Encrypt_6f3e92dee882, p_EncryptionKeyID := p_EncryptionKeyID_6f3e92dee882, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_6f3e92dee882, p_SendEncryptedValue := p_SendEncryptedValue_6f3e92dee882, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_6f3e92dee882, p_IsSoftForeignKey := p_IsSoftForeignKey_6f3e92dee882, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_6f3e92dee882, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_6f3e92dee882, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_6f3e92dee882, p_JSONTypeDefinition := p_JSONTypeDefinition_6f3e92dee882, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_6f3e92dee882, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_6f3e92dee882, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_6f3e92dee882, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_6f3e92dee882, p_IsComputed := p_IsComputed_6f3e92dee882, p_EmbeddedRecord := p_EmbeddedRecord_6f3e92dee882, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_6f3e92dee882, p_Configuration_Clear := TRUE, p_ID := p_ID_6f3e92dee882);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_ec3508728cb9 VARCHAR(255);
  p_Description_ec3508728cb9 TEXT;
  p_AutoUpdateDescription_ec3508728cb9 BOOLEAN;
  p_IsPrimaryKey_ec3508728cb9 BOOLEAN;
  p_IsUnique_ec3508728cb9 BOOLEAN;
  p_Category_ec3508728cb9 VARCHAR(255);
  p_ValueListType_ec3508728cb9 VARCHAR(20);
  p_ExtendedType_ec3508728cb9 VARCHAR(50);
  p_CodeType_ec3508728cb9 VARCHAR(50);
  p_DefaultInView_ec3508728cb9 BOOLEAN;
  p_ViewCellTemplate_ec3508728cb9 TEXT;
  p_DefaultColumnWidth_ec3508728cb9 INTEGER;
  p_AllowUpdateAPI_ec3508728cb9 BOOLEAN;
  p_AllowUpdateInView_ec3508728cb9 BOOLEAN;
  p_IncludeInUserSearchAPI_ec3508728cb9 BOOLEAN;
  p_FullTextSearchEnabled_ec3508728cb9 BOOLEAN;
  p_UserSearchParamFormatAPI_ec3508728cb9 VARCHAR(500);
  p_IncludeInGeneratedForm_ec3508728cb9 BOOLEAN;
  p_GeneratedFormSection_ec3508728cb9 VARCHAR(10);
  p_IsNameField_ec3508728cb9 BOOLEAN;
  p_RelatedEntityID_ec3508728cb9 UUID;
  p_RelatedEntityFieldName_ec3508728cb9 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_ec3508728cb9 BOOLEAN;
  p_RelatedEntityNameFieldMap_ec3508728cb9 VARCHAR(255);
  p_RelatedEntityDisplayType_ec3508728cb9 VARCHAR(20);
  p_EntityIDFieldName_ec3508728cb9 VARCHAR(100);
  p_ScopeDefault_ec3508728cb9 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_ec3508728cb9 BOOLEAN;
  p_ValuesToPackWithSchema_ec3508728cb9 VARCHAR(10);
  p_Status_ec3508728cb9 VARCHAR(25);
  p_AutoUpdateIsNameField_ec3508728cb9 BOOLEAN;
  p_AutoUpdateDefaultInView_ec3508728cb9 BOOLEAN;
  p_AutoUpdateCategory_ec3508728cb9 BOOLEAN;
  p_AutoUpdateDisplayName_ec3508728cb9 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_ec3508728cb9 BOOLEAN;
  p_Encrypt_ec3508728cb9 BOOLEAN;
  p_EncryptionKeyID_ec3508728cb9 UUID;
  p_AllowDecryptInAPI_ec3508728cb9 BOOLEAN;
  p_SendEncryptedValue_ec3508728cb9 BOOLEAN;
  p_IsSoftPrimaryKey_ec3508728cb9 BOOLEAN;
  p_IsSoftForeignKey_ec3508728cb9 BOOLEAN;
  p_RelatedEntityJoinFields_ec3508728cb9 TEXT;
  p_JSONType_ec3508728cb9 VARCHAR(255);
  p_JSONTypeIsArray_ec3508728cb9 BOOLEAN;
  p_JSONTypeDefinition_ec3508728cb9 TEXT;
  p_UserSearchPredicateAPI_ec3508728cb9 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_ec3508728cb9 BOOLEAN;
  p_AutoUpdateFullTextSearch_ec3508728cb9 BOOLEAN;
  p_AutoUpdateExtendedType_ec3508728cb9 BOOLEAN;
  p_IsComputed_ec3508728cb9 BOOLEAN;
  p_EmbeddedRecord_ec3508728cb9 TEXT;
  p_Configuration_ec3508728cb9 TEXT;
  p_ID_ec3508728cb9 UUID;
BEGIN
  p_DisplayName_ec3508728cb9 := 'Parent GL Account ID Path';
  p_AutoUpdateDescription_ec3508728cb9 := TRUE;
  p_IsPrimaryKey_ec3508728cb9 := FALSE;
  p_IsUnique_ec3508728cb9 := FALSE;
  p_Category_ec3508728cb9 := 'Hierarchy and Rollup';
  p_ValueListType_ec3508728cb9 := 'None';
  p_DefaultInView_ec3508728cb9 := FALSE;
  p_DefaultColumnWidth_ec3508728cb9 := 150;
  p_AllowUpdateAPI_ec3508728cb9 := FALSE;
  p_AllowUpdateInView_ec3508728cb9 := TRUE;
  p_IncludeInUserSearchAPI_ec3508728cb9 := FALSE;
  p_FullTextSearchEnabled_ec3508728cb9 := FALSE;
  p_IncludeInGeneratedForm_ec3508728cb9 := TRUE;
  p_GeneratedFormSection_ec3508728cb9 := 'Category';
  p_IsNameField_ec3508728cb9 := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_ec3508728cb9 := FALSE;
  p_RelatedEntityDisplayType_ec3508728cb9 := 'Search';
  p_AutoUpdateRelatedEntityInfo_ec3508728cb9 := TRUE;
  p_ValuesToPackWithSchema_ec3508728cb9 := 'Auto';
  p_Status_ec3508728cb9 := 'Active';
  p_AutoUpdateIsNameField_ec3508728cb9 := TRUE;
  p_AutoUpdateDefaultInView_ec3508728cb9 := TRUE;
  p_AutoUpdateCategory_ec3508728cb9 := TRUE;
  p_AutoUpdateDisplayName_ec3508728cb9 := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_ec3508728cb9 := TRUE;
  p_Encrypt_ec3508728cb9 := FALSE;
  p_AllowDecryptInAPI_ec3508728cb9 := FALSE;
  p_SendEncryptedValue_ec3508728cb9 := FALSE;
  p_IsSoftPrimaryKey_ec3508728cb9 := FALSE;
  p_IsSoftForeignKey_ec3508728cb9 := FALSE;
  p_JSONTypeIsArray_ec3508728cb9 := FALSE;
  p_UserSearchPredicateAPI_ec3508728cb9 := 'Contains';
  p_AutoUpdateUserSearchPredicate_ec3508728cb9 := TRUE;
  p_AutoUpdateFullTextSearch_ec3508728cb9 := TRUE;
  p_AutoUpdateExtendedType_ec3508728cb9 := TRUE;
  p_IsComputed_ec3508728cb9 := FALSE;
  p_ID_ec3508728cb9 := '44A045C7-2996-4818-BDB2-2925DCD97E12';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM ${mjSchema}."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_ec3508728cb9,
    'Description', p_Description_ec3508728cb9,
    'AutoUpdateDescription', p_AutoUpdateDescription_ec3508728cb9,
    'IsPrimaryKey', p_IsPrimaryKey_ec3508728cb9,
    'IsUnique', p_IsUnique_ec3508728cb9,
    'Category', p_Category_ec3508728cb9,
    'ValueListType', p_ValueListType_ec3508728cb9,
    'ExtendedType', p_ExtendedType_ec3508728cb9,
    'CodeType', p_CodeType_ec3508728cb9,
    'DefaultInView', p_DefaultInView_ec3508728cb9,
    'ViewCellTemplate', p_ViewCellTemplate_ec3508728cb9,
    'DefaultColumnWidth', p_DefaultColumnWidth_ec3508728cb9,
    'AllowUpdateAPI', p_AllowUpdateAPI_ec3508728cb9,
    'AllowUpdateInView', p_AllowUpdateInView_ec3508728cb9,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_ec3508728cb9,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_ec3508728cb9,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_ec3508728cb9,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_ec3508728cb9,
    'GeneratedFormSection', p_GeneratedFormSection_ec3508728cb9,
    'IsNameField', p_IsNameField_ec3508728cb9,
    'RelatedEntityID', p_RelatedEntityID_ec3508728cb9,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_ec3508728cb9,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_ec3508728cb9,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_ec3508728cb9,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_ec3508728cb9,
    'EntityIDFieldName', p_EntityIDFieldName_ec3508728cb9,
    'ScopeDefault', p_ScopeDefault_ec3508728cb9,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_ec3508728cb9,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_ec3508728cb9,
    'Status', p_Status_ec3508728cb9,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_ec3508728cb9,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_ec3508728cb9,
    'AutoUpdateCategory', p_AutoUpdateCategory_ec3508728cb9,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_ec3508728cb9,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_ec3508728cb9,
    'Encrypt', p_Encrypt_ec3508728cb9,
    'EncryptionKeyID', p_EncryptionKeyID_ec3508728cb9,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_ec3508728cb9,
    'SendEncryptedValue', p_SendEncryptedValue_ec3508728cb9,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_ec3508728cb9,
    'IsSoftForeignKey', p_IsSoftForeignKey_ec3508728cb9,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_ec3508728cb9,
    'JSONType', p_JSONType_ec3508728cb9,
    'JSONTypeIsArray', p_JSONTypeIsArray_ec3508728cb9,
    'JSONTypeDefinition', p_JSONTypeDefinition_ec3508728cb9,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_ec3508728cb9,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_ec3508728cb9,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_ec3508728cb9,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_ec3508728cb9,
    'IsComputed', p_IsComputed_ec3508728cb9
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_ec3508728cb9,
    'Configuration', p_Configuration_ec3508728cb9,
    'ID', p_ID_ec3508728cb9
  ));
  ELSE
    PERFORM ${mjSchema}."spUpdateEntityField"(p_DisplayName := p_DisplayName_ec3508728cb9, p_Description := p_Description_ec3508728cb9, p_Description_Clear := TRUE, p_AutoUpdateDescription := p_AutoUpdateDescription_ec3508728cb9, p_IsPrimaryKey := p_IsPrimaryKey_ec3508728cb9, p_IsUnique := p_IsUnique_ec3508728cb9, p_Category := p_Category_ec3508728cb9, p_ValueListType := p_ValueListType_ec3508728cb9, p_ExtendedType := p_ExtendedType_ec3508728cb9, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_ec3508728cb9, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_ec3508728cb9, p_ViewCellTemplate := p_ViewCellTemplate_ec3508728cb9, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_ec3508728cb9, p_AllowUpdateAPI := p_AllowUpdateAPI_ec3508728cb9, p_AllowUpdateInView := p_AllowUpdateInView_ec3508728cb9, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_ec3508728cb9, p_FullTextSearchEnabled := p_FullTextSearchEnabled_ec3508728cb9, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_ec3508728cb9, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_ec3508728cb9, p_GeneratedFormSection := p_GeneratedFormSection_ec3508728cb9, p_IsNameField := p_IsNameField_ec3508728cb9, p_RelatedEntityID := p_RelatedEntityID_ec3508728cb9, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_ec3508728cb9, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_ec3508728cb9, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_ec3508728cb9, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_ec3508728cb9, p_EntityIDFieldName := p_EntityIDFieldName_ec3508728cb9, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_ec3508728cb9, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_ec3508728cb9, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_ec3508728cb9, p_Status := p_Status_ec3508728cb9, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_ec3508728cb9, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_ec3508728cb9, p_AutoUpdateCategory := p_AutoUpdateCategory_ec3508728cb9, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_ec3508728cb9, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_ec3508728cb9, p_Encrypt := p_Encrypt_ec3508728cb9, p_EncryptionKeyID := p_EncryptionKeyID_ec3508728cb9, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_ec3508728cb9, p_SendEncryptedValue := p_SendEncryptedValue_ec3508728cb9, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_ec3508728cb9, p_IsSoftForeignKey := p_IsSoftForeignKey_ec3508728cb9, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_ec3508728cb9, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_ec3508728cb9, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_ec3508728cb9, p_JSONTypeDefinition := p_JSONTypeDefinition_ec3508728cb9, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_ec3508728cb9, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_ec3508728cb9, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_ec3508728cb9, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_ec3508728cb9, p_IsComputed := p_IsComputed_ec3508728cb9, p_EmbeddedRecord := p_EmbeddedRecord_ec3508728cb9, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_ec3508728cb9, p_Configuration_Clear := TRUE, p_ID := p_ID_ec3508728cb9);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_047c7c07dc40 VARCHAR(255);
  p_Description_047c7c07dc40 TEXT;
  p_AutoUpdateDescription_047c7c07dc40 BOOLEAN;
  p_IsPrimaryKey_047c7c07dc40 BOOLEAN;
  p_IsUnique_047c7c07dc40 BOOLEAN;
  p_Category_047c7c07dc40 VARCHAR(255);
  p_ValueListType_047c7c07dc40 VARCHAR(20);
  p_ExtendedType_047c7c07dc40 VARCHAR(50);
  p_CodeType_047c7c07dc40 VARCHAR(50);
  p_DefaultInView_047c7c07dc40 BOOLEAN;
  p_ViewCellTemplate_047c7c07dc40 TEXT;
  p_DefaultColumnWidth_047c7c07dc40 INTEGER;
  p_AllowUpdateAPI_047c7c07dc40 BOOLEAN;
  p_AllowUpdateInView_047c7c07dc40 BOOLEAN;
  p_IncludeInUserSearchAPI_047c7c07dc40 BOOLEAN;
  p_FullTextSearchEnabled_047c7c07dc40 BOOLEAN;
  p_UserSearchParamFormatAPI_047c7c07dc40 VARCHAR(500);
  p_IncludeInGeneratedForm_047c7c07dc40 BOOLEAN;
  p_GeneratedFormSection_047c7c07dc40 VARCHAR(10);
  p_IsNameField_047c7c07dc40 BOOLEAN;
  p_RelatedEntityID_047c7c07dc40 UUID;
  p_RelatedEntityFieldName_047c7c07dc40 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_047c7c07dc40 BOOLEAN;
  p_RelatedEntityNameFieldMap_047c7c07dc40 VARCHAR(255);
  p_RelatedEntityDisplayType_047c7c07dc40 VARCHAR(20);
  p_EntityIDFieldName_047c7c07dc40 VARCHAR(100);
  p_ScopeDefault_047c7c07dc40 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_047c7c07dc40 BOOLEAN;
  p_ValuesToPackWithSchema_047c7c07dc40 VARCHAR(10);
  p_Status_047c7c07dc40 VARCHAR(25);
  p_AutoUpdateIsNameField_047c7c07dc40 BOOLEAN;
  p_AutoUpdateDefaultInView_047c7c07dc40 BOOLEAN;
  p_AutoUpdateCategory_047c7c07dc40 BOOLEAN;
  p_AutoUpdateDisplayName_047c7c07dc40 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_047c7c07dc40 BOOLEAN;
  p_Encrypt_047c7c07dc40 BOOLEAN;
  p_EncryptionKeyID_047c7c07dc40 UUID;
  p_AllowDecryptInAPI_047c7c07dc40 BOOLEAN;
  p_SendEncryptedValue_047c7c07dc40 BOOLEAN;
  p_IsSoftPrimaryKey_047c7c07dc40 BOOLEAN;
  p_IsSoftForeignKey_047c7c07dc40 BOOLEAN;
  p_RelatedEntityJoinFields_047c7c07dc40 TEXT;
  p_JSONType_047c7c07dc40 VARCHAR(255);
  p_JSONTypeIsArray_047c7c07dc40 BOOLEAN;
  p_JSONTypeDefinition_047c7c07dc40 TEXT;
  p_UserSearchPredicateAPI_047c7c07dc40 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_047c7c07dc40 BOOLEAN;
  p_AutoUpdateFullTextSearch_047c7c07dc40 BOOLEAN;
  p_AutoUpdateExtendedType_047c7c07dc40 BOOLEAN;
  p_IsComputed_047c7c07dc40 BOOLEAN;
  p_EmbeddedRecord_047c7c07dc40 TEXT;
  p_Configuration_047c7c07dc40 TEXT;
  p_ID_047c7c07dc40 UUID;
BEGIN
  p_DisplayName_047c7c07dc40 := 'Parent GL Account ID Is Leaf';
  p_AutoUpdateDescription_047c7c07dc40 := TRUE;
  p_IsPrimaryKey_047c7c07dc40 := FALSE;
  p_IsUnique_047c7c07dc40 := FALSE;
  p_Category_047c7c07dc40 := 'Hierarchy and Rollup';
  p_ValueListType_047c7c07dc40 := 'None';
  p_DefaultInView_047c7c07dc40 := FALSE;
  p_DefaultColumnWidth_047c7c07dc40 := 150;
  p_AllowUpdateAPI_047c7c07dc40 := FALSE;
  p_AllowUpdateInView_047c7c07dc40 := TRUE;
  p_IncludeInUserSearchAPI_047c7c07dc40 := FALSE;
  p_FullTextSearchEnabled_047c7c07dc40 := FALSE;
  p_IncludeInGeneratedForm_047c7c07dc40 := TRUE;
  p_GeneratedFormSection_047c7c07dc40 := 'Category';
  p_IsNameField_047c7c07dc40 := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_047c7c07dc40 := FALSE;
  p_RelatedEntityDisplayType_047c7c07dc40 := 'Search';
  p_AutoUpdateRelatedEntityInfo_047c7c07dc40 := TRUE;
  p_ValuesToPackWithSchema_047c7c07dc40 := 'Auto';
  p_Status_047c7c07dc40 := 'Active';
  p_AutoUpdateIsNameField_047c7c07dc40 := TRUE;
  p_AutoUpdateDefaultInView_047c7c07dc40 := TRUE;
  p_AutoUpdateCategory_047c7c07dc40 := TRUE;
  p_AutoUpdateDisplayName_047c7c07dc40 := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_047c7c07dc40 := TRUE;
  p_Encrypt_047c7c07dc40 := FALSE;
  p_AllowDecryptInAPI_047c7c07dc40 := FALSE;
  p_SendEncryptedValue_047c7c07dc40 := FALSE;
  p_IsSoftPrimaryKey_047c7c07dc40 := FALSE;
  p_IsSoftForeignKey_047c7c07dc40 := FALSE;
  p_JSONTypeIsArray_047c7c07dc40 := FALSE;
  p_UserSearchPredicateAPI_047c7c07dc40 := 'Contains';
  p_AutoUpdateUserSearchPredicate_047c7c07dc40 := TRUE;
  p_AutoUpdateFullTextSearch_047c7c07dc40 := TRUE;
  p_AutoUpdateExtendedType_047c7c07dc40 := TRUE;
  p_IsComputed_047c7c07dc40 := FALSE;
  p_ID_047c7c07dc40 := 'E2755BCE-9E88-4ACF-8A5B-DF0F8D7E377A';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM ${mjSchema}."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_047c7c07dc40,
    'Description', p_Description_047c7c07dc40,
    'AutoUpdateDescription', p_AutoUpdateDescription_047c7c07dc40,
    'IsPrimaryKey', p_IsPrimaryKey_047c7c07dc40,
    'IsUnique', p_IsUnique_047c7c07dc40,
    'Category', p_Category_047c7c07dc40,
    'ValueListType', p_ValueListType_047c7c07dc40,
    'ExtendedType', p_ExtendedType_047c7c07dc40,
    'CodeType', p_CodeType_047c7c07dc40,
    'DefaultInView', p_DefaultInView_047c7c07dc40,
    'ViewCellTemplate', p_ViewCellTemplate_047c7c07dc40,
    'DefaultColumnWidth', p_DefaultColumnWidth_047c7c07dc40,
    'AllowUpdateAPI', p_AllowUpdateAPI_047c7c07dc40,
    'AllowUpdateInView', p_AllowUpdateInView_047c7c07dc40,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_047c7c07dc40,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_047c7c07dc40,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_047c7c07dc40,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_047c7c07dc40,
    'GeneratedFormSection', p_GeneratedFormSection_047c7c07dc40,
    'IsNameField', p_IsNameField_047c7c07dc40,
    'RelatedEntityID', p_RelatedEntityID_047c7c07dc40,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_047c7c07dc40,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_047c7c07dc40,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_047c7c07dc40,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_047c7c07dc40,
    'EntityIDFieldName', p_EntityIDFieldName_047c7c07dc40,
    'ScopeDefault', p_ScopeDefault_047c7c07dc40,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_047c7c07dc40,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_047c7c07dc40,
    'Status', p_Status_047c7c07dc40,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_047c7c07dc40,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_047c7c07dc40,
    'AutoUpdateCategory', p_AutoUpdateCategory_047c7c07dc40,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_047c7c07dc40,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_047c7c07dc40,
    'Encrypt', p_Encrypt_047c7c07dc40,
    'EncryptionKeyID', p_EncryptionKeyID_047c7c07dc40,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_047c7c07dc40,
    'SendEncryptedValue', p_SendEncryptedValue_047c7c07dc40,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_047c7c07dc40,
    'IsSoftForeignKey', p_IsSoftForeignKey_047c7c07dc40,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_047c7c07dc40,
    'JSONType', p_JSONType_047c7c07dc40,
    'JSONTypeIsArray', p_JSONTypeIsArray_047c7c07dc40,
    'JSONTypeDefinition', p_JSONTypeDefinition_047c7c07dc40,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_047c7c07dc40,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_047c7c07dc40,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_047c7c07dc40,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_047c7c07dc40,
    'IsComputed', p_IsComputed_047c7c07dc40
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_047c7c07dc40,
    'Configuration', p_Configuration_047c7c07dc40,
    'ID', p_ID_047c7c07dc40
  ));
  ELSE
    PERFORM ${mjSchema}."spUpdateEntityField"(p_DisplayName := p_DisplayName_047c7c07dc40, p_Description := p_Description_047c7c07dc40, p_Description_Clear := TRUE, p_AutoUpdateDescription := p_AutoUpdateDescription_047c7c07dc40, p_IsPrimaryKey := p_IsPrimaryKey_047c7c07dc40, p_IsUnique := p_IsUnique_047c7c07dc40, p_Category := p_Category_047c7c07dc40, p_ValueListType := p_ValueListType_047c7c07dc40, p_ExtendedType := p_ExtendedType_047c7c07dc40, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_047c7c07dc40, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_047c7c07dc40, p_ViewCellTemplate := p_ViewCellTemplate_047c7c07dc40, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_047c7c07dc40, p_AllowUpdateAPI := p_AllowUpdateAPI_047c7c07dc40, p_AllowUpdateInView := p_AllowUpdateInView_047c7c07dc40, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_047c7c07dc40, p_FullTextSearchEnabled := p_FullTextSearchEnabled_047c7c07dc40, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_047c7c07dc40, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_047c7c07dc40, p_GeneratedFormSection := p_GeneratedFormSection_047c7c07dc40, p_IsNameField := p_IsNameField_047c7c07dc40, p_RelatedEntityID := p_RelatedEntityID_047c7c07dc40, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_047c7c07dc40, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_047c7c07dc40, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_047c7c07dc40, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_047c7c07dc40, p_EntityIDFieldName := p_EntityIDFieldName_047c7c07dc40, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_047c7c07dc40, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_047c7c07dc40, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_047c7c07dc40, p_Status := p_Status_047c7c07dc40, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_047c7c07dc40, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_047c7c07dc40, p_AutoUpdateCategory := p_AutoUpdateCategory_047c7c07dc40, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_047c7c07dc40, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_047c7c07dc40, p_Encrypt := p_Encrypt_047c7c07dc40, p_EncryptionKeyID := p_EncryptionKeyID_047c7c07dc40, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_047c7c07dc40, p_SendEncryptedValue := p_SendEncryptedValue_047c7c07dc40, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_047c7c07dc40, p_IsSoftForeignKey := p_IsSoftForeignKey_047c7c07dc40, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_047c7c07dc40, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_047c7c07dc40, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_047c7c07dc40, p_JSONTypeDefinition := p_JSONTypeDefinition_047c7c07dc40, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_047c7c07dc40, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_047c7c07dc40, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_047c7c07dc40, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_047c7c07dc40, p_IsComputed := p_IsComputed_047c7c07dc40, p_EmbeddedRecord := p_EmbeddedRecord_047c7c07dc40, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_047c7c07dc40, p_Configuration_Clear := TRUE, p_ID := p_ID_047c7c07dc40);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_fd08fe406069 VARCHAR(255);
  p_Description_fd08fe406069 TEXT;
  p_AutoUpdateDescription_fd08fe406069 BOOLEAN;
  p_IsPrimaryKey_fd08fe406069 BOOLEAN;
  p_IsUnique_fd08fe406069 BOOLEAN;
  p_Category_fd08fe406069 VARCHAR(255);
  p_ValueListType_fd08fe406069 VARCHAR(20);
  p_ExtendedType_fd08fe406069 VARCHAR(50);
  p_CodeType_fd08fe406069 VARCHAR(50);
  p_DefaultInView_fd08fe406069 BOOLEAN;
  p_ViewCellTemplate_fd08fe406069 TEXT;
  p_DefaultColumnWidth_fd08fe406069 INTEGER;
  p_AllowUpdateAPI_fd08fe406069 BOOLEAN;
  p_AllowUpdateInView_fd08fe406069 BOOLEAN;
  p_IncludeInUserSearchAPI_fd08fe406069 BOOLEAN;
  p_FullTextSearchEnabled_fd08fe406069 BOOLEAN;
  p_UserSearchParamFormatAPI_fd08fe406069 VARCHAR(500);
  p_IncludeInGeneratedForm_fd08fe406069 BOOLEAN;
  p_GeneratedFormSection_fd08fe406069 VARCHAR(10);
  p_IsNameField_fd08fe406069 BOOLEAN;
  p_RelatedEntityID_fd08fe406069 UUID;
  p_RelatedEntityFieldName_fd08fe406069 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_fd08fe406069 BOOLEAN;
  p_RelatedEntityNameFieldMap_fd08fe406069 VARCHAR(255);
  p_RelatedEntityDisplayType_fd08fe406069 VARCHAR(20);
  p_EntityIDFieldName_fd08fe406069 VARCHAR(100);
  p_ScopeDefault_fd08fe406069 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_fd08fe406069 BOOLEAN;
  p_ValuesToPackWithSchema_fd08fe406069 VARCHAR(10);
  p_Status_fd08fe406069 VARCHAR(25);
  p_AutoUpdateIsNameField_fd08fe406069 BOOLEAN;
  p_AutoUpdateDefaultInView_fd08fe406069 BOOLEAN;
  p_AutoUpdateCategory_fd08fe406069 BOOLEAN;
  p_AutoUpdateDisplayName_fd08fe406069 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_fd08fe406069 BOOLEAN;
  p_Encrypt_fd08fe406069 BOOLEAN;
  p_EncryptionKeyID_fd08fe406069 UUID;
  p_AllowDecryptInAPI_fd08fe406069 BOOLEAN;
  p_SendEncryptedValue_fd08fe406069 BOOLEAN;
  p_IsSoftPrimaryKey_fd08fe406069 BOOLEAN;
  p_IsSoftForeignKey_fd08fe406069 BOOLEAN;
  p_RelatedEntityJoinFields_fd08fe406069 TEXT;
  p_JSONType_fd08fe406069 VARCHAR(255);
  p_JSONTypeIsArray_fd08fe406069 BOOLEAN;
  p_JSONTypeDefinition_fd08fe406069 TEXT;
  p_UserSearchPredicateAPI_fd08fe406069 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_fd08fe406069 BOOLEAN;
  p_AutoUpdateFullTextSearch_fd08fe406069 BOOLEAN;
  p_AutoUpdateExtendedType_fd08fe406069 BOOLEAN;
  p_IsComputed_fd08fe406069 BOOLEAN;
  p_EmbeddedRecord_fd08fe406069 TEXT;
  p_Configuration_fd08fe406069 TEXT;
  p_ID_fd08fe406069 UUID;
BEGIN
  p_DisplayName_fd08fe406069 := 'Parent GL Account ID Child Count';
  p_AutoUpdateDescription_fd08fe406069 := TRUE;
  p_IsPrimaryKey_fd08fe406069 := FALSE;
  p_IsUnique_fd08fe406069 := FALSE;
  p_Category_fd08fe406069 := 'Hierarchy and Rollup';
  p_ValueListType_fd08fe406069 := 'None';
  p_DefaultInView_fd08fe406069 := FALSE;
  p_DefaultColumnWidth_fd08fe406069 := 50;
  p_AllowUpdateAPI_fd08fe406069 := FALSE;
  p_AllowUpdateInView_fd08fe406069 := TRUE;
  p_IncludeInUserSearchAPI_fd08fe406069 := FALSE;
  p_FullTextSearchEnabled_fd08fe406069 := FALSE;
  p_IncludeInGeneratedForm_fd08fe406069 := TRUE;
  p_GeneratedFormSection_fd08fe406069 := 'Category';
  p_IsNameField_fd08fe406069 := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_fd08fe406069 := FALSE;
  p_RelatedEntityDisplayType_fd08fe406069 := 'Search';
  p_AutoUpdateRelatedEntityInfo_fd08fe406069 := TRUE;
  p_ValuesToPackWithSchema_fd08fe406069 := 'Auto';
  p_Status_fd08fe406069 := 'Active';
  p_AutoUpdateIsNameField_fd08fe406069 := TRUE;
  p_AutoUpdateDefaultInView_fd08fe406069 := TRUE;
  p_AutoUpdateCategory_fd08fe406069 := TRUE;
  p_AutoUpdateDisplayName_fd08fe406069 := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_fd08fe406069 := TRUE;
  p_Encrypt_fd08fe406069 := FALSE;
  p_AllowDecryptInAPI_fd08fe406069 := FALSE;
  p_SendEncryptedValue_fd08fe406069 := FALSE;
  p_IsSoftPrimaryKey_fd08fe406069 := FALSE;
  p_IsSoftForeignKey_fd08fe406069 := FALSE;
  p_JSONTypeIsArray_fd08fe406069 := FALSE;
  p_UserSearchPredicateAPI_fd08fe406069 := 'Contains';
  p_AutoUpdateUserSearchPredicate_fd08fe406069 := TRUE;
  p_AutoUpdateFullTextSearch_fd08fe406069 := TRUE;
  p_AutoUpdateExtendedType_fd08fe406069 := TRUE;
  p_IsComputed_fd08fe406069 := FALSE;
  p_ID_fd08fe406069 := 'A78F7534-1B1C-43C5-979A-DD98B3190D5D';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM ${mjSchema}."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_fd08fe406069,
    'Description', p_Description_fd08fe406069,
    'AutoUpdateDescription', p_AutoUpdateDescription_fd08fe406069,
    'IsPrimaryKey', p_IsPrimaryKey_fd08fe406069,
    'IsUnique', p_IsUnique_fd08fe406069,
    'Category', p_Category_fd08fe406069,
    'ValueListType', p_ValueListType_fd08fe406069,
    'ExtendedType', p_ExtendedType_fd08fe406069,
    'CodeType', p_CodeType_fd08fe406069,
    'DefaultInView', p_DefaultInView_fd08fe406069,
    'ViewCellTemplate', p_ViewCellTemplate_fd08fe406069,
    'DefaultColumnWidth', p_DefaultColumnWidth_fd08fe406069,
    'AllowUpdateAPI', p_AllowUpdateAPI_fd08fe406069,
    'AllowUpdateInView', p_AllowUpdateInView_fd08fe406069,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_fd08fe406069,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_fd08fe406069,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_fd08fe406069,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_fd08fe406069,
    'GeneratedFormSection', p_GeneratedFormSection_fd08fe406069,
    'IsNameField', p_IsNameField_fd08fe406069,
    'RelatedEntityID', p_RelatedEntityID_fd08fe406069,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_fd08fe406069,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_fd08fe406069,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_fd08fe406069,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_fd08fe406069,
    'EntityIDFieldName', p_EntityIDFieldName_fd08fe406069,
    'ScopeDefault', p_ScopeDefault_fd08fe406069,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_fd08fe406069,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_fd08fe406069,
    'Status', p_Status_fd08fe406069,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_fd08fe406069,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_fd08fe406069,
    'AutoUpdateCategory', p_AutoUpdateCategory_fd08fe406069,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_fd08fe406069,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_fd08fe406069,
    'Encrypt', p_Encrypt_fd08fe406069,
    'EncryptionKeyID', p_EncryptionKeyID_fd08fe406069,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_fd08fe406069,
    'SendEncryptedValue', p_SendEncryptedValue_fd08fe406069,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_fd08fe406069,
    'IsSoftForeignKey', p_IsSoftForeignKey_fd08fe406069,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_fd08fe406069,
    'JSONType', p_JSONType_fd08fe406069,
    'JSONTypeIsArray', p_JSONTypeIsArray_fd08fe406069,
    'JSONTypeDefinition', p_JSONTypeDefinition_fd08fe406069,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_fd08fe406069,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_fd08fe406069,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_fd08fe406069,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_fd08fe406069,
    'IsComputed', p_IsComputed_fd08fe406069
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_fd08fe406069,
    'Configuration', p_Configuration_fd08fe406069,
    'ID', p_ID_fd08fe406069
  ));
  ELSE
    PERFORM ${mjSchema}."spUpdateEntityField"(p_DisplayName := p_DisplayName_fd08fe406069, p_Description := p_Description_fd08fe406069, p_Description_Clear := TRUE, p_AutoUpdateDescription := p_AutoUpdateDescription_fd08fe406069, p_IsPrimaryKey := p_IsPrimaryKey_fd08fe406069, p_IsUnique := p_IsUnique_fd08fe406069, p_Category := p_Category_fd08fe406069, p_ValueListType := p_ValueListType_fd08fe406069, p_ExtendedType := p_ExtendedType_fd08fe406069, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_fd08fe406069, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_fd08fe406069, p_ViewCellTemplate := p_ViewCellTemplate_fd08fe406069, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_fd08fe406069, p_AllowUpdateAPI := p_AllowUpdateAPI_fd08fe406069, p_AllowUpdateInView := p_AllowUpdateInView_fd08fe406069, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_fd08fe406069, p_FullTextSearchEnabled := p_FullTextSearchEnabled_fd08fe406069, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_fd08fe406069, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_fd08fe406069, p_GeneratedFormSection := p_GeneratedFormSection_fd08fe406069, p_IsNameField := p_IsNameField_fd08fe406069, p_RelatedEntityID := p_RelatedEntityID_fd08fe406069, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_fd08fe406069, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_fd08fe406069, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_fd08fe406069, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_fd08fe406069, p_EntityIDFieldName := p_EntityIDFieldName_fd08fe406069, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_fd08fe406069, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_fd08fe406069, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_fd08fe406069, p_Status := p_Status_fd08fe406069, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_fd08fe406069, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_fd08fe406069, p_AutoUpdateCategory := p_AutoUpdateCategory_fd08fe406069, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_fd08fe406069, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_fd08fe406069, p_Encrypt := p_Encrypt_fd08fe406069, p_EncryptionKeyID := p_EncryptionKeyID_fd08fe406069, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_fd08fe406069, p_SendEncryptedValue := p_SendEncryptedValue_fd08fe406069, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_fd08fe406069, p_IsSoftForeignKey := p_IsSoftForeignKey_fd08fe406069, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_fd08fe406069, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_fd08fe406069, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_fd08fe406069, p_JSONTypeDefinition := p_JSONTypeDefinition_fd08fe406069, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_fd08fe406069, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_fd08fe406069, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_fd08fe406069, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_fd08fe406069, p_IsComputed := p_IsComputed_fd08fe406069, p_EmbeddedRecord := p_EmbeddedRecord_fd08fe406069, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_fd08fe406069, p_Configuration_Clear := TRUE, p_ID := p_ID_fd08fe406069);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_f3a45e28aac2 VARCHAR(255);
  p_Description_f3a45e28aac2 TEXT;
  p_AutoUpdateDescription_f3a45e28aac2 BOOLEAN;
  p_IsPrimaryKey_f3a45e28aac2 BOOLEAN;
  p_IsUnique_f3a45e28aac2 BOOLEAN;
  p_Category_f3a45e28aac2 VARCHAR(255);
  p_ValueListType_f3a45e28aac2 VARCHAR(20);
  p_ExtendedType_f3a45e28aac2 VARCHAR(50);
  p_CodeType_f3a45e28aac2 VARCHAR(50);
  p_DefaultInView_f3a45e28aac2 BOOLEAN;
  p_ViewCellTemplate_f3a45e28aac2 TEXT;
  p_DefaultColumnWidth_f3a45e28aac2 INTEGER;
  p_AllowUpdateAPI_f3a45e28aac2 BOOLEAN;
  p_AllowUpdateInView_f3a45e28aac2 BOOLEAN;
  p_IncludeInUserSearchAPI_f3a45e28aac2 BOOLEAN;
  p_FullTextSearchEnabled_f3a45e28aac2 BOOLEAN;
  p_UserSearchParamFormatAPI_f3a45e28aac2 VARCHAR(500);
  p_IncludeInGeneratedForm_f3a45e28aac2 BOOLEAN;
  p_GeneratedFormSection_f3a45e28aac2 VARCHAR(10);
  p_IsNameField_f3a45e28aac2 BOOLEAN;
  p_RelatedEntityID_f3a45e28aac2 UUID;
  p_RelatedEntityFieldName_f3a45e28aac2 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_f3a45e28aac2 BOOLEAN;
  p_RelatedEntityNameFieldMap_f3a45e28aac2 VARCHAR(255);
  p_RelatedEntityDisplayType_f3a45e28aac2 VARCHAR(20);
  p_EntityIDFieldName_f3a45e28aac2 VARCHAR(100);
  p_ScopeDefault_f3a45e28aac2 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_f3a45e28aac2 BOOLEAN;
  p_ValuesToPackWithSchema_f3a45e28aac2 VARCHAR(10);
  p_Status_f3a45e28aac2 VARCHAR(25);
  p_AutoUpdateIsNameField_f3a45e28aac2 BOOLEAN;
  p_AutoUpdateDefaultInView_f3a45e28aac2 BOOLEAN;
  p_AutoUpdateCategory_f3a45e28aac2 BOOLEAN;
  p_AutoUpdateDisplayName_f3a45e28aac2 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_f3a45e28aac2 BOOLEAN;
  p_Encrypt_f3a45e28aac2 BOOLEAN;
  p_EncryptionKeyID_f3a45e28aac2 UUID;
  p_AllowDecryptInAPI_f3a45e28aac2 BOOLEAN;
  p_SendEncryptedValue_f3a45e28aac2 BOOLEAN;
  p_IsSoftPrimaryKey_f3a45e28aac2 BOOLEAN;
  p_IsSoftForeignKey_f3a45e28aac2 BOOLEAN;
  p_RelatedEntityJoinFields_f3a45e28aac2 TEXT;
  p_JSONType_f3a45e28aac2 VARCHAR(255);
  p_JSONTypeIsArray_f3a45e28aac2 BOOLEAN;
  p_JSONTypeDefinition_f3a45e28aac2 TEXT;
  p_UserSearchPredicateAPI_f3a45e28aac2 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_f3a45e28aac2 BOOLEAN;
  p_AutoUpdateFullTextSearch_f3a45e28aac2 BOOLEAN;
  p_AutoUpdateExtendedType_f3a45e28aac2 BOOLEAN;
  p_IsComputed_f3a45e28aac2 BOOLEAN;
  p_EmbeddedRecord_f3a45e28aac2 TEXT;
  p_Configuration_f3a45e28aac2 TEXT;
  p_ID_f3a45e28aac2 UUID;
BEGIN
  p_DisplayName_f3a45e28aac2 := 'Anomaly Outcome';
  p_AutoUpdateDescription_f3a45e28aac2 := TRUE;
  p_IsPrimaryKey_f3a45e28aac2 := FALSE;
  p_IsUnique_f3a45e28aac2 := FALSE;
  p_Category_f3a45e28aac2 := 'Anomaly Detection';
  p_ValueListType_f3a45e28aac2 := 'None';
  p_DefaultInView_f3a45e28aac2 := FALSE;
  p_DefaultColumnWidth_f3a45e28aac2 := 150;
  p_AllowUpdateAPI_f3a45e28aac2 := FALSE;
  p_AllowUpdateInView_f3a45e28aac2 := TRUE;
  p_IncludeInUserSearchAPI_f3a45e28aac2 := FALSE;
  p_FullTextSearchEnabled_f3a45e28aac2 := FALSE;
  p_IncludeInGeneratedForm_f3a45e28aac2 := TRUE;
  p_GeneratedFormSection_f3a45e28aac2 := 'Category';
  p_IsNameField_f3a45e28aac2 := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_f3a45e28aac2 := FALSE;
  p_RelatedEntityDisplayType_f3a45e28aac2 := 'Search';
  p_AutoUpdateRelatedEntityInfo_f3a45e28aac2 := TRUE;
  p_ValuesToPackWithSchema_f3a45e28aac2 := 'Auto';
  p_Status_f3a45e28aac2 := 'Active';
  p_AutoUpdateIsNameField_f3a45e28aac2 := TRUE;
  p_AutoUpdateDefaultInView_f3a45e28aac2 := TRUE;
  p_AutoUpdateCategory_f3a45e28aac2 := TRUE;
  p_AutoUpdateDisplayName_f3a45e28aac2 := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_f3a45e28aac2 := TRUE;
  p_Encrypt_f3a45e28aac2 := FALSE;
  p_AllowDecryptInAPI_f3a45e28aac2 := FALSE;
  p_SendEncryptedValue_f3a45e28aac2 := FALSE;
  p_IsSoftPrimaryKey_f3a45e28aac2 := FALSE;
  p_IsSoftForeignKey_f3a45e28aac2 := FALSE;
  p_JSONTypeIsArray_f3a45e28aac2 := FALSE;
  p_UserSearchPredicateAPI_f3a45e28aac2 := 'Contains';
  p_AutoUpdateUserSearchPredicate_f3a45e28aac2 := TRUE;
  p_AutoUpdateFullTextSearch_f3a45e28aac2 := TRUE;
  p_AutoUpdateExtendedType_f3a45e28aac2 := TRUE;
  p_IsComputed_f3a45e28aac2 := FALSE;
  p_ID_f3a45e28aac2 := '71836C90-010C-4F03-A0F2-ABE0E37EDA3D';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM ${mjSchema}."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_f3a45e28aac2,
    'Description', p_Description_f3a45e28aac2,
    'AutoUpdateDescription', p_AutoUpdateDescription_f3a45e28aac2,
    'IsPrimaryKey', p_IsPrimaryKey_f3a45e28aac2,
    'IsUnique', p_IsUnique_f3a45e28aac2,
    'Category', p_Category_f3a45e28aac2,
    'ValueListType', p_ValueListType_f3a45e28aac2,
    'ExtendedType', p_ExtendedType_f3a45e28aac2,
    'CodeType', p_CodeType_f3a45e28aac2,
    'DefaultInView', p_DefaultInView_f3a45e28aac2,
    'ViewCellTemplate', p_ViewCellTemplate_f3a45e28aac2,
    'DefaultColumnWidth', p_DefaultColumnWidth_f3a45e28aac2,
    'AllowUpdateAPI', p_AllowUpdateAPI_f3a45e28aac2,
    'AllowUpdateInView', p_AllowUpdateInView_f3a45e28aac2,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_f3a45e28aac2,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_f3a45e28aac2,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_f3a45e28aac2,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_f3a45e28aac2,
    'GeneratedFormSection', p_GeneratedFormSection_f3a45e28aac2,
    'IsNameField', p_IsNameField_f3a45e28aac2,
    'RelatedEntityID', p_RelatedEntityID_f3a45e28aac2,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_f3a45e28aac2,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_f3a45e28aac2,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_f3a45e28aac2,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_f3a45e28aac2,
    'EntityIDFieldName', p_EntityIDFieldName_f3a45e28aac2,
    'ScopeDefault', p_ScopeDefault_f3a45e28aac2,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_f3a45e28aac2,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_f3a45e28aac2,
    'Status', p_Status_f3a45e28aac2,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_f3a45e28aac2,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_f3a45e28aac2,
    'AutoUpdateCategory', p_AutoUpdateCategory_f3a45e28aac2,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_f3a45e28aac2,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_f3a45e28aac2,
    'Encrypt', p_Encrypt_f3a45e28aac2,
    'EncryptionKeyID', p_EncryptionKeyID_f3a45e28aac2,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_f3a45e28aac2,
    'SendEncryptedValue', p_SendEncryptedValue_f3a45e28aac2,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_f3a45e28aac2,
    'IsSoftForeignKey', p_IsSoftForeignKey_f3a45e28aac2,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_f3a45e28aac2,
    'JSONType', p_JSONType_f3a45e28aac2,
    'JSONTypeIsArray', p_JSONTypeIsArray_f3a45e28aac2,
    'JSONTypeDefinition', p_JSONTypeDefinition_f3a45e28aac2,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_f3a45e28aac2,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_f3a45e28aac2,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_f3a45e28aac2,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_f3a45e28aac2,
    'IsComputed', p_IsComputed_f3a45e28aac2
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_f3a45e28aac2,
    'Configuration', p_Configuration_f3a45e28aac2,
    'ID', p_ID_f3a45e28aac2
  ));
  ELSE
    PERFORM ${mjSchema}."spUpdateEntityField"(p_DisplayName := p_DisplayName_f3a45e28aac2, p_Description := p_Description_f3a45e28aac2, p_Description_Clear := TRUE, p_AutoUpdateDescription := p_AutoUpdateDescription_f3a45e28aac2, p_IsPrimaryKey := p_IsPrimaryKey_f3a45e28aac2, p_IsUnique := p_IsUnique_f3a45e28aac2, p_Category := p_Category_f3a45e28aac2, p_ValueListType := p_ValueListType_f3a45e28aac2, p_ExtendedType := p_ExtendedType_f3a45e28aac2, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_f3a45e28aac2, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_f3a45e28aac2, p_ViewCellTemplate := p_ViewCellTemplate_f3a45e28aac2, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_f3a45e28aac2, p_AllowUpdateAPI := p_AllowUpdateAPI_f3a45e28aac2, p_AllowUpdateInView := p_AllowUpdateInView_f3a45e28aac2, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_f3a45e28aac2, p_FullTextSearchEnabled := p_FullTextSearchEnabled_f3a45e28aac2, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_f3a45e28aac2, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_f3a45e28aac2, p_GeneratedFormSection := p_GeneratedFormSection_f3a45e28aac2, p_IsNameField := p_IsNameField_f3a45e28aac2, p_RelatedEntityID := p_RelatedEntityID_f3a45e28aac2, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_f3a45e28aac2, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_f3a45e28aac2, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_f3a45e28aac2, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_f3a45e28aac2, p_EntityIDFieldName := p_EntityIDFieldName_f3a45e28aac2, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_f3a45e28aac2, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_f3a45e28aac2, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_f3a45e28aac2, p_Status := p_Status_f3a45e28aac2, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_f3a45e28aac2, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_f3a45e28aac2, p_AutoUpdateCategory := p_AutoUpdateCategory_f3a45e28aac2, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_f3a45e28aac2, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_f3a45e28aac2, p_Encrypt := p_Encrypt_f3a45e28aac2, p_EncryptionKeyID := p_EncryptionKeyID_f3a45e28aac2, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_f3a45e28aac2, p_SendEncryptedValue := p_SendEncryptedValue_f3a45e28aac2, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_f3a45e28aac2, p_IsSoftForeignKey := p_IsSoftForeignKey_f3a45e28aac2, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_f3a45e28aac2, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_f3a45e28aac2, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_f3a45e28aac2, p_JSONTypeDefinition := p_JSONTypeDefinition_f3a45e28aac2, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_f3a45e28aac2, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_f3a45e28aac2, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_f3a45e28aac2, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_f3a45e28aac2, p_IsComputed := p_IsComputed_f3a45e28aac2, p_EmbeddedRecord := p_EmbeddedRecord_f3a45e28aac2, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_f3a45e28aac2, p_Configuration_Clear := TRUE, p_ID := p_ID_f3a45e28aac2);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_6266ccc01694 VARCHAR(255);
  p_Description_6266ccc01694 TEXT;
  p_AutoUpdateDescription_6266ccc01694 BOOLEAN;
  p_IsPrimaryKey_6266ccc01694 BOOLEAN;
  p_IsUnique_6266ccc01694 BOOLEAN;
  p_Category_6266ccc01694 VARCHAR(255);
  p_ValueListType_6266ccc01694 VARCHAR(20);
  p_ExtendedType_6266ccc01694 VARCHAR(50);
  p_CodeType_6266ccc01694 VARCHAR(50);
  p_DefaultInView_6266ccc01694 BOOLEAN;
  p_ViewCellTemplate_6266ccc01694 TEXT;
  p_DefaultColumnWidth_6266ccc01694 INTEGER;
  p_AllowUpdateAPI_6266ccc01694 BOOLEAN;
  p_AllowUpdateInView_6266ccc01694 BOOLEAN;
  p_IncludeInUserSearchAPI_6266ccc01694 BOOLEAN;
  p_FullTextSearchEnabled_6266ccc01694 BOOLEAN;
  p_UserSearchParamFormatAPI_6266ccc01694 VARCHAR(500);
  p_IncludeInGeneratedForm_6266ccc01694 BOOLEAN;
  p_GeneratedFormSection_6266ccc01694 VARCHAR(10);
  p_IsNameField_6266ccc01694 BOOLEAN;
  p_RelatedEntityID_6266ccc01694 UUID;
  p_RelatedEntityFieldName_6266ccc01694 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_6266ccc01694 BOOLEAN;
  p_RelatedEntityNameFieldMap_6266ccc01694 VARCHAR(255);
  p_RelatedEntityDisplayType_6266ccc01694 VARCHAR(20);
  p_EntityIDFieldName_6266ccc01694 VARCHAR(100);
  p_ScopeDefault_6266ccc01694 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_6266ccc01694 BOOLEAN;
  p_ValuesToPackWithSchema_6266ccc01694 VARCHAR(10);
  p_Status_6266ccc01694 VARCHAR(25);
  p_AutoUpdateIsNameField_6266ccc01694 BOOLEAN;
  p_AutoUpdateDefaultInView_6266ccc01694 BOOLEAN;
  p_AutoUpdateCategory_6266ccc01694 BOOLEAN;
  p_AutoUpdateDisplayName_6266ccc01694 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_6266ccc01694 BOOLEAN;
  p_Encrypt_6266ccc01694 BOOLEAN;
  p_EncryptionKeyID_6266ccc01694 UUID;
  p_AllowDecryptInAPI_6266ccc01694 BOOLEAN;
  p_SendEncryptedValue_6266ccc01694 BOOLEAN;
  p_IsSoftPrimaryKey_6266ccc01694 BOOLEAN;
  p_IsSoftForeignKey_6266ccc01694 BOOLEAN;
  p_RelatedEntityJoinFields_6266ccc01694 TEXT;
  p_JSONType_6266ccc01694 VARCHAR(255);
  p_JSONTypeIsArray_6266ccc01694 BOOLEAN;
  p_JSONTypeDefinition_6266ccc01694 TEXT;
  p_UserSearchPredicateAPI_6266ccc01694 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_6266ccc01694 BOOLEAN;
  p_AutoUpdateFullTextSearch_6266ccc01694 BOOLEAN;
  p_AutoUpdateExtendedType_6266ccc01694 BOOLEAN;
  p_IsComputed_6266ccc01694 BOOLEAN;
  p_EmbeddedRecord_6266ccc01694 TEXT;
  p_Configuration_6266ccc01694 TEXT;
  p_ID_6266ccc01694 UUID;
BEGIN
  p_DisplayName_6266ccc01694 := 'Total Debit Amount';
  p_AutoUpdateDescription_6266ccc01694 := TRUE;
  p_IsPrimaryKey_6266ccc01694 := FALSE;
  p_IsUnique_6266ccc01694 := FALSE;
  p_Category_6266ccc01694 := 'Anomaly Detection';
  p_ValueListType_6266ccc01694 := 'None';
  p_DefaultInView_6266ccc01694 := FALSE;
  p_DefaultColumnWidth_6266ccc01694 := 150;
  p_AllowUpdateAPI_6266ccc01694 := FALSE;
  p_AllowUpdateInView_6266ccc01694 := TRUE;
  p_IncludeInUserSearchAPI_6266ccc01694 := FALSE;
  p_FullTextSearchEnabled_6266ccc01694 := FALSE;
  p_IncludeInGeneratedForm_6266ccc01694 := TRUE;
  p_GeneratedFormSection_6266ccc01694 := 'Category';
  p_IsNameField_6266ccc01694 := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_6266ccc01694 := FALSE;
  p_RelatedEntityDisplayType_6266ccc01694 := 'Search';
  p_AutoUpdateRelatedEntityInfo_6266ccc01694 := TRUE;
  p_ValuesToPackWithSchema_6266ccc01694 := 'Auto';
  p_Status_6266ccc01694 := 'Active';
  p_AutoUpdateIsNameField_6266ccc01694 := TRUE;
  p_AutoUpdateDefaultInView_6266ccc01694 := TRUE;
  p_AutoUpdateCategory_6266ccc01694 := TRUE;
  p_AutoUpdateDisplayName_6266ccc01694 := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_6266ccc01694 := TRUE;
  p_Encrypt_6266ccc01694 := FALSE;
  p_AllowDecryptInAPI_6266ccc01694 := FALSE;
  p_SendEncryptedValue_6266ccc01694 := FALSE;
  p_IsSoftPrimaryKey_6266ccc01694 := FALSE;
  p_IsSoftForeignKey_6266ccc01694 := FALSE;
  p_JSONTypeIsArray_6266ccc01694 := FALSE;
  p_UserSearchPredicateAPI_6266ccc01694 := 'Contains';
  p_AutoUpdateUserSearchPredicate_6266ccc01694 := TRUE;
  p_AutoUpdateFullTextSearch_6266ccc01694 := TRUE;
  p_AutoUpdateExtendedType_6266ccc01694 := TRUE;
  p_IsComputed_6266ccc01694 := FALSE;
  p_ID_6266ccc01694 := 'B55285D4-5DD5-42E4-8395-013E87EE0ECB';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM ${mjSchema}."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_6266ccc01694,
    'Description', p_Description_6266ccc01694,
    'AutoUpdateDescription', p_AutoUpdateDescription_6266ccc01694,
    'IsPrimaryKey', p_IsPrimaryKey_6266ccc01694,
    'IsUnique', p_IsUnique_6266ccc01694,
    'Category', p_Category_6266ccc01694,
    'ValueListType', p_ValueListType_6266ccc01694,
    'ExtendedType', p_ExtendedType_6266ccc01694,
    'CodeType', p_CodeType_6266ccc01694,
    'DefaultInView', p_DefaultInView_6266ccc01694,
    'ViewCellTemplate', p_ViewCellTemplate_6266ccc01694,
    'DefaultColumnWidth', p_DefaultColumnWidth_6266ccc01694,
    'AllowUpdateAPI', p_AllowUpdateAPI_6266ccc01694,
    'AllowUpdateInView', p_AllowUpdateInView_6266ccc01694,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_6266ccc01694,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_6266ccc01694,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_6266ccc01694,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_6266ccc01694,
    'GeneratedFormSection', p_GeneratedFormSection_6266ccc01694,
    'IsNameField', p_IsNameField_6266ccc01694,
    'RelatedEntityID', p_RelatedEntityID_6266ccc01694,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_6266ccc01694,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_6266ccc01694,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_6266ccc01694,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_6266ccc01694,
    'EntityIDFieldName', p_EntityIDFieldName_6266ccc01694,
    'ScopeDefault', p_ScopeDefault_6266ccc01694,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_6266ccc01694,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_6266ccc01694,
    'Status', p_Status_6266ccc01694,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_6266ccc01694,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_6266ccc01694,
    'AutoUpdateCategory', p_AutoUpdateCategory_6266ccc01694,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_6266ccc01694,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_6266ccc01694,
    'Encrypt', p_Encrypt_6266ccc01694,
    'EncryptionKeyID', p_EncryptionKeyID_6266ccc01694,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_6266ccc01694,
    'SendEncryptedValue', p_SendEncryptedValue_6266ccc01694,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_6266ccc01694,
    'IsSoftForeignKey', p_IsSoftForeignKey_6266ccc01694,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_6266ccc01694,
    'JSONType', p_JSONType_6266ccc01694,
    'JSONTypeIsArray', p_JSONTypeIsArray_6266ccc01694,
    'JSONTypeDefinition', p_JSONTypeDefinition_6266ccc01694,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_6266ccc01694,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_6266ccc01694,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_6266ccc01694,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_6266ccc01694,
    'IsComputed', p_IsComputed_6266ccc01694
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_6266ccc01694,
    'Configuration', p_Configuration_6266ccc01694,
    'ID', p_ID_6266ccc01694
  ));
  ELSE
    PERFORM ${mjSchema}."spUpdateEntityField"(p_DisplayName := p_DisplayName_6266ccc01694, p_Description := p_Description_6266ccc01694, p_Description_Clear := TRUE, p_AutoUpdateDescription := p_AutoUpdateDescription_6266ccc01694, p_IsPrimaryKey := p_IsPrimaryKey_6266ccc01694, p_IsUnique := p_IsUnique_6266ccc01694, p_Category := p_Category_6266ccc01694, p_ValueListType := p_ValueListType_6266ccc01694, p_ExtendedType := p_ExtendedType_6266ccc01694, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_6266ccc01694, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_6266ccc01694, p_ViewCellTemplate := p_ViewCellTemplate_6266ccc01694, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_6266ccc01694, p_AllowUpdateAPI := p_AllowUpdateAPI_6266ccc01694, p_AllowUpdateInView := p_AllowUpdateInView_6266ccc01694, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_6266ccc01694, p_FullTextSearchEnabled := p_FullTextSearchEnabled_6266ccc01694, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_6266ccc01694, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_6266ccc01694, p_GeneratedFormSection := p_GeneratedFormSection_6266ccc01694, p_IsNameField := p_IsNameField_6266ccc01694, p_RelatedEntityID := p_RelatedEntityID_6266ccc01694, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_6266ccc01694, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_6266ccc01694, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_6266ccc01694, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_6266ccc01694, p_EntityIDFieldName := p_EntityIDFieldName_6266ccc01694, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_6266ccc01694, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_6266ccc01694, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_6266ccc01694, p_Status := p_Status_6266ccc01694, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_6266ccc01694, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_6266ccc01694, p_AutoUpdateCategory := p_AutoUpdateCategory_6266ccc01694, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_6266ccc01694, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_6266ccc01694, p_Encrypt := p_Encrypt_6266ccc01694, p_EncryptionKeyID := p_EncryptionKeyID_6266ccc01694, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_6266ccc01694, p_SendEncryptedValue := p_SendEncryptedValue_6266ccc01694, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_6266ccc01694, p_IsSoftForeignKey := p_IsSoftForeignKey_6266ccc01694, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_6266ccc01694, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_6266ccc01694, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_6266ccc01694, p_JSONTypeDefinition := p_JSONTypeDefinition_6266ccc01694, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_6266ccc01694, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_6266ccc01694, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_6266ccc01694, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_6266ccc01694, p_IsComputed := p_IsComputed_6266ccc01694, p_EmbeddedRecord := p_EmbeddedRecord_6266ccc01694, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_6266ccc01694, p_Configuration_Clear := TRUE, p_ID := p_ID_6266ccc01694);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_bcc2d099cf92 VARCHAR(255);
  p_Description_bcc2d099cf92 TEXT;
  p_AutoUpdateDescription_bcc2d099cf92 BOOLEAN;
  p_IsPrimaryKey_bcc2d099cf92 BOOLEAN;
  p_IsUnique_bcc2d099cf92 BOOLEAN;
  p_Category_bcc2d099cf92 VARCHAR(255);
  p_ValueListType_bcc2d099cf92 VARCHAR(20);
  p_ExtendedType_bcc2d099cf92 VARCHAR(50);
  p_CodeType_bcc2d099cf92 VARCHAR(50);
  p_DefaultInView_bcc2d099cf92 BOOLEAN;
  p_ViewCellTemplate_bcc2d099cf92 TEXT;
  p_DefaultColumnWidth_bcc2d099cf92 INTEGER;
  p_AllowUpdateAPI_bcc2d099cf92 BOOLEAN;
  p_AllowUpdateInView_bcc2d099cf92 BOOLEAN;
  p_IncludeInUserSearchAPI_bcc2d099cf92 BOOLEAN;
  p_FullTextSearchEnabled_bcc2d099cf92 BOOLEAN;
  p_UserSearchParamFormatAPI_bcc2d099cf92 VARCHAR(500);
  p_IncludeInGeneratedForm_bcc2d099cf92 BOOLEAN;
  p_GeneratedFormSection_bcc2d099cf92 VARCHAR(10);
  p_IsNameField_bcc2d099cf92 BOOLEAN;
  p_RelatedEntityID_bcc2d099cf92 UUID;
  p_RelatedEntityFieldName_bcc2d099cf92 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_bcc2d099cf92 BOOLEAN;
  p_RelatedEntityNameFieldMap_bcc2d099cf92 VARCHAR(255);
  p_RelatedEntityDisplayType_bcc2d099cf92 VARCHAR(20);
  p_EntityIDFieldName_bcc2d099cf92 VARCHAR(100);
  p_ScopeDefault_bcc2d099cf92 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_bcc2d099cf92 BOOLEAN;
  p_ValuesToPackWithSchema_bcc2d099cf92 VARCHAR(10);
  p_Status_bcc2d099cf92 VARCHAR(25);
  p_AutoUpdateIsNameField_bcc2d099cf92 BOOLEAN;
  p_AutoUpdateDefaultInView_bcc2d099cf92 BOOLEAN;
  p_AutoUpdateCategory_bcc2d099cf92 BOOLEAN;
  p_AutoUpdateDisplayName_bcc2d099cf92 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_bcc2d099cf92 BOOLEAN;
  p_Encrypt_bcc2d099cf92 BOOLEAN;
  p_EncryptionKeyID_bcc2d099cf92 UUID;
  p_AllowDecryptInAPI_bcc2d099cf92 BOOLEAN;
  p_SendEncryptedValue_bcc2d099cf92 BOOLEAN;
  p_IsSoftPrimaryKey_bcc2d099cf92 BOOLEAN;
  p_IsSoftForeignKey_bcc2d099cf92 BOOLEAN;
  p_RelatedEntityJoinFields_bcc2d099cf92 TEXT;
  p_JSONType_bcc2d099cf92 VARCHAR(255);
  p_JSONTypeIsArray_bcc2d099cf92 BOOLEAN;
  p_JSONTypeDefinition_bcc2d099cf92 TEXT;
  p_UserSearchPredicateAPI_bcc2d099cf92 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_bcc2d099cf92 BOOLEAN;
  p_AutoUpdateFullTextSearch_bcc2d099cf92 BOOLEAN;
  p_AutoUpdateExtendedType_bcc2d099cf92 BOOLEAN;
  p_IsComputed_bcc2d099cf92 BOOLEAN;
  p_EmbeddedRecord_bcc2d099cf92 TEXT;
  p_Configuration_bcc2d099cf92 TEXT;
  p_ID_bcc2d099cf92 UUID;
BEGIN
  p_DisplayName_bcc2d099cf92 := 'Line Count';
  p_AutoUpdateDescription_bcc2d099cf92 := TRUE;
  p_IsPrimaryKey_bcc2d099cf92 := FALSE;
  p_IsUnique_bcc2d099cf92 := FALSE;
  p_Category_bcc2d099cf92 := 'Anomaly Detection';
  p_ValueListType_bcc2d099cf92 := 'None';
  p_DefaultInView_bcc2d099cf92 := FALSE;
  p_DefaultColumnWidth_bcc2d099cf92 := 50;
  p_AllowUpdateAPI_bcc2d099cf92 := FALSE;
  p_AllowUpdateInView_bcc2d099cf92 := TRUE;
  p_IncludeInUserSearchAPI_bcc2d099cf92 := FALSE;
  p_FullTextSearchEnabled_bcc2d099cf92 := FALSE;
  p_IncludeInGeneratedForm_bcc2d099cf92 := TRUE;
  p_GeneratedFormSection_bcc2d099cf92 := 'Category';
  p_IsNameField_bcc2d099cf92 := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_bcc2d099cf92 := FALSE;
  p_RelatedEntityDisplayType_bcc2d099cf92 := 'Search';
  p_AutoUpdateRelatedEntityInfo_bcc2d099cf92 := TRUE;
  p_ValuesToPackWithSchema_bcc2d099cf92 := 'Auto';
  p_Status_bcc2d099cf92 := 'Active';
  p_AutoUpdateIsNameField_bcc2d099cf92 := TRUE;
  p_AutoUpdateDefaultInView_bcc2d099cf92 := TRUE;
  p_AutoUpdateCategory_bcc2d099cf92 := TRUE;
  p_AutoUpdateDisplayName_bcc2d099cf92 := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_bcc2d099cf92 := TRUE;
  p_Encrypt_bcc2d099cf92 := FALSE;
  p_AllowDecryptInAPI_bcc2d099cf92 := FALSE;
  p_SendEncryptedValue_bcc2d099cf92 := FALSE;
  p_IsSoftPrimaryKey_bcc2d099cf92 := FALSE;
  p_IsSoftForeignKey_bcc2d099cf92 := FALSE;
  p_JSONTypeIsArray_bcc2d099cf92 := FALSE;
  p_UserSearchPredicateAPI_bcc2d099cf92 := 'Contains';
  p_AutoUpdateUserSearchPredicate_bcc2d099cf92 := TRUE;
  p_AutoUpdateFullTextSearch_bcc2d099cf92 := TRUE;
  p_AutoUpdateExtendedType_bcc2d099cf92 := TRUE;
  p_IsComputed_bcc2d099cf92 := FALSE;
  p_ID_bcc2d099cf92 := '2BEE0BBB-BC51-4FCF-9A48-45D9E25E8734';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM ${mjSchema}."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_bcc2d099cf92,
    'Description', p_Description_bcc2d099cf92,
    'AutoUpdateDescription', p_AutoUpdateDescription_bcc2d099cf92,
    'IsPrimaryKey', p_IsPrimaryKey_bcc2d099cf92,
    'IsUnique', p_IsUnique_bcc2d099cf92,
    'Category', p_Category_bcc2d099cf92,
    'ValueListType', p_ValueListType_bcc2d099cf92,
    'ExtendedType', p_ExtendedType_bcc2d099cf92,
    'CodeType', p_CodeType_bcc2d099cf92,
    'DefaultInView', p_DefaultInView_bcc2d099cf92,
    'ViewCellTemplate', p_ViewCellTemplate_bcc2d099cf92,
    'DefaultColumnWidth', p_DefaultColumnWidth_bcc2d099cf92,
    'AllowUpdateAPI', p_AllowUpdateAPI_bcc2d099cf92,
    'AllowUpdateInView', p_AllowUpdateInView_bcc2d099cf92,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_bcc2d099cf92,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_bcc2d099cf92,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_bcc2d099cf92,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_bcc2d099cf92,
    'GeneratedFormSection', p_GeneratedFormSection_bcc2d099cf92,
    'IsNameField', p_IsNameField_bcc2d099cf92,
    'RelatedEntityID', p_RelatedEntityID_bcc2d099cf92,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_bcc2d099cf92,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_bcc2d099cf92,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_bcc2d099cf92,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_bcc2d099cf92,
    'EntityIDFieldName', p_EntityIDFieldName_bcc2d099cf92,
    'ScopeDefault', p_ScopeDefault_bcc2d099cf92,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_bcc2d099cf92,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_bcc2d099cf92,
    'Status', p_Status_bcc2d099cf92,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_bcc2d099cf92,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_bcc2d099cf92,
    'AutoUpdateCategory', p_AutoUpdateCategory_bcc2d099cf92,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_bcc2d099cf92,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_bcc2d099cf92,
    'Encrypt', p_Encrypt_bcc2d099cf92,
    'EncryptionKeyID', p_EncryptionKeyID_bcc2d099cf92,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_bcc2d099cf92,
    'SendEncryptedValue', p_SendEncryptedValue_bcc2d099cf92,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_bcc2d099cf92,
    'IsSoftForeignKey', p_IsSoftForeignKey_bcc2d099cf92,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_bcc2d099cf92,
    'JSONType', p_JSONType_bcc2d099cf92,
    'JSONTypeIsArray', p_JSONTypeIsArray_bcc2d099cf92,
    'JSONTypeDefinition', p_JSONTypeDefinition_bcc2d099cf92,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_bcc2d099cf92,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_bcc2d099cf92,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_bcc2d099cf92,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_bcc2d099cf92,
    'IsComputed', p_IsComputed_bcc2d099cf92
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_bcc2d099cf92,
    'Configuration', p_Configuration_bcc2d099cf92,
    'ID', p_ID_bcc2d099cf92
  ));
  ELSE
    PERFORM ${mjSchema}."spUpdateEntityField"(p_DisplayName := p_DisplayName_bcc2d099cf92, p_Description := p_Description_bcc2d099cf92, p_Description_Clear := TRUE, p_AutoUpdateDescription := p_AutoUpdateDescription_bcc2d099cf92, p_IsPrimaryKey := p_IsPrimaryKey_bcc2d099cf92, p_IsUnique := p_IsUnique_bcc2d099cf92, p_Category := p_Category_bcc2d099cf92, p_ValueListType := p_ValueListType_bcc2d099cf92, p_ExtendedType := p_ExtendedType_bcc2d099cf92, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_bcc2d099cf92, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_bcc2d099cf92, p_ViewCellTemplate := p_ViewCellTemplate_bcc2d099cf92, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_bcc2d099cf92, p_AllowUpdateAPI := p_AllowUpdateAPI_bcc2d099cf92, p_AllowUpdateInView := p_AllowUpdateInView_bcc2d099cf92, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_bcc2d099cf92, p_FullTextSearchEnabled := p_FullTextSearchEnabled_bcc2d099cf92, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_bcc2d099cf92, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_bcc2d099cf92, p_GeneratedFormSection := p_GeneratedFormSection_bcc2d099cf92, p_IsNameField := p_IsNameField_bcc2d099cf92, p_RelatedEntityID := p_RelatedEntityID_bcc2d099cf92, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_bcc2d099cf92, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_bcc2d099cf92, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_bcc2d099cf92, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_bcc2d099cf92, p_EntityIDFieldName := p_EntityIDFieldName_bcc2d099cf92, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_bcc2d099cf92, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_bcc2d099cf92, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_bcc2d099cf92, p_Status := p_Status_bcc2d099cf92, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_bcc2d099cf92, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_bcc2d099cf92, p_AutoUpdateCategory := p_AutoUpdateCategory_bcc2d099cf92, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_bcc2d099cf92, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_bcc2d099cf92, p_Encrypt := p_Encrypt_bcc2d099cf92, p_EncryptionKeyID := p_EncryptionKeyID_bcc2d099cf92, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_bcc2d099cf92, p_SendEncryptedValue := p_SendEncryptedValue_bcc2d099cf92, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_bcc2d099cf92, p_IsSoftForeignKey := p_IsSoftForeignKey_bcc2d099cf92, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_bcc2d099cf92, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_bcc2d099cf92, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_bcc2d099cf92, p_JSONTypeDefinition := p_JSONTypeDefinition_bcc2d099cf92, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_bcc2d099cf92, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_bcc2d099cf92, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_bcc2d099cf92, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_bcc2d099cf92, p_IsComputed := p_IsComputed_bcc2d099cf92, p_EmbeddedRecord := p_EmbeddedRecord_bcc2d099cf92, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_bcc2d099cf92, p_Configuration_Clear := TRUE, p_ID := p_ID_bcc2d099cf92);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_aab0f8024a6f VARCHAR(255);
  p_Description_aab0f8024a6f TEXT;
  p_AutoUpdateDescription_aab0f8024a6f BOOLEAN;
  p_IsPrimaryKey_aab0f8024a6f BOOLEAN;
  p_IsUnique_aab0f8024a6f BOOLEAN;
  p_Category_aab0f8024a6f VARCHAR(255);
  p_ValueListType_aab0f8024a6f VARCHAR(20);
  p_ExtendedType_aab0f8024a6f VARCHAR(50);
  p_CodeType_aab0f8024a6f VARCHAR(50);
  p_DefaultInView_aab0f8024a6f BOOLEAN;
  p_ViewCellTemplate_aab0f8024a6f TEXT;
  p_DefaultColumnWidth_aab0f8024a6f INTEGER;
  p_AllowUpdateAPI_aab0f8024a6f BOOLEAN;
  p_AllowUpdateInView_aab0f8024a6f BOOLEAN;
  p_IncludeInUserSearchAPI_aab0f8024a6f BOOLEAN;
  p_FullTextSearchEnabled_aab0f8024a6f BOOLEAN;
  p_UserSearchParamFormatAPI_aab0f8024a6f VARCHAR(500);
  p_IncludeInGeneratedForm_aab0f8024a6f BOOLEAN;
  p_GeneratedFormSection_aab0f8024a6f VARCHAR(10);
  p_IsNameField_aab0f8024a6f BOOLEAN;
  p_RelatedEntityID_aab0f8024a6f UUID;
  p_RelatedEntityFieldName_aab0f8024a6f VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_aab0f8024a6f BOOLEAN;
  p_RelatedEntityNameFieldMap_aab0f8024a6f VARCHAR(255);
  p_RelatedEntityDisplayType_aab0f8024a6f VARCHAR(20);
  p_EntityIDFieldName_aab0f8024a6f VARCHAR(100);
  p_ScopeDefault_aab0f8024a6f VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_aab0f8024a6f BOOLEAN;
  p_ValuesToPackWithSchema_aab0f8024a6f VARCHAR(10);
  p_Status_aab0f8024a6f VARCHAR(25);
  p_AutoUpdateIsNameField_aab0f8024a6f BOOLEAN;
  p_AutoUpdateDefaultInView_aab0f8024a6f BOOLEAN;
  p_AutoUpdateCategory_aab0f8024a6f BOOLEAN;
  p_AutoUpdateDisplayName_aab0f8024a6f BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_aab0f8024a6f BOOLEAN;
  p_Encrypt_aab0f8024a6f BOOLEAN;
  p_EncryptionKeyID_aab0f8024a6f UUID;
  p_AllowDecryptInAPI_aab0f8024a6f BOOLEAN;
  p_SendEncryptedValue_aab0f8024a6f BOOLEAN;
  p_IsSoftPrimaryKey_aab0f8024a6f BOOLEAN;
  p_IsSoftForeignKey_aab0f8024a6f BOOLEAN;
  p_RelatedEntityJoinFields_aab0f8024a6f TEXT;
  p_JSONType_aab0f8024a6f VARCHAR(255);
  p_JSONTypeIsArray_aab0f8024a6f BOOLEAN;
  p_JSONTypeDefinition_aab0f8024a6f TEXT;
  p_UserSearchPredicateAPI_aab0f8024a6f VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_aab0f8024a6f BOOLEAN;
  p_AutoUpdateFullTextSearch_aab0f8024a6f BOOLEAN;
  p_AutoUpdateExtendedType_aab0f8024a6f BOOLEAN;
  p_IsComputed_aab0f8024a6f BOOLEAN;
  p_EmbeddedRecord_aab0f8024a6f TEXT;
  p_Configuration_aab0f8024a6f TEXT;
  p_ID_aab0f8024a6f UUID;
BEGIN
  p_DisplayName_aab0f8024a6f := 'Effective Month';
  p_AutoUpdateDescription_aab0f8024a6f := TRUE;
  p_IsPrimaryKey_aab0f8024a6f := FALSE;
  p_IsUnique_aab0f8024a6f := FALSE;
  p_Category_aab0f8024a6f := 'Anomaly Detection';
  p_ValueListType_aab0f8024a6f := 'None';
  p_DefaultInView_aab0f8024a6f := FALSE;
  p_DefaultColumnWidth_aab0f8024a6f := 50;
  p_AllowUpdateAPI_aab0f8024a6f := FALSE;
  p_AllowUpdateInView_aab0f8024a6f := TRUE;
  p_IncludeInUserSearchAPI_aab0f8024a6f := FALSE;
  p_FullTextSearchEnabled_aab0f8024a6f := FALSE;
  p_IncludeInGeneratedForm_aab0f8024a6f := TRUE;
  p_GeneratedFormSection_aab0f8024a6f := 'Category';
  p_IsNameField_aab0f8024a6f := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_aab0f8024a6f := FALSE;
  p_RelatedEntityDisplayType_aab0f8024a6f := 'Search';
  p_AutoUpdateRelatedEntityInfo_aab0f8024a6f := TRUE;
  p_ValuesToPackWithSchema_aab0f8024a6f := 'Auto';
  p_Status_aab0f8024a6f := 'Active';
  p_AutoUpdateIsNameField_aab0f8024a6f := TRUE;
  p_AutoUpdateDefaultInView_aab0f8024a6f := TRUE;
  p_AutoUpdateCategory_aab0f8024a6f := TRUE;
  p_AutoUpdateDisplayName_aab0f8024a6f := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_aab0f8024a6f := TRUE;
  p_Encrypt_aab0f8024a6f := FALSE;
  p_AllowDecryptInAPI_aab0f8024a6f := FALSE;
  p_SendEncryptedValue_aab0f8024a6f := FALSE;
  p_IsSoftPrimaryKey_aab0f8024a6f := FALSE;
  p_IsSoftForeignKey_aab0f8024a6f := FALSE;
  p_JSONTypeIsArray_aab0f8024a6f := FALSE;
  p_UserSearchPredicateAPI_aab0f8024a6f := 'Contains';
  p_AutoUpdateUserSearchPredicate_aab0f8024a6f := TRUE;
  p_AutoUpdateFullTextSearch_aab0f8024a6f := TRUE;
  p_AutoUpdateExtendedType_aab0f8024a6f := TRUE;
  p_IsComputed_aab0f8024a6f := FALSE;
  p_ID_aab0f8024a6f := '0BE539D7-F9AE-4CA6-B18B-9FE77F456617';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM ${mjSchema}."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_aab0f8024a6f,
    'Description', p_Description_aab0f8024a6f,
    'AutoUpdateDescription', p_AutoUpdateDescription_aab0f8024a6f,
    'IsPrimaryKey', p_IsPrimaryKey_aab0f8024a6f,
    'IsUnique', p_IsUnique_aab0f8024a6f,
    'Category', p_Category_aab0f8024a6f,
    'ValueListType', p_ValueListType_aab0f8024a6f,
    'ExtendedType', p_ExtendedType_aab0f8024a6f,
    'CodeType', p_CodeType_aab0f8024a6f,
    'DefaultInView', p_DefaultInView_aab0f8024a6f,
    'ViewCellTemplate', p_ViewCellTemplate_aab0f8024a6f,
    'DefaultColumnWidth', p_DefaultColumnWidth_aab0f8024a6f,
    'AllowUpdateAPI', p_AllowUpdateAPI_aab0f8024a6f,
    'AllowUpdateInView', p_AllowUpdateInView_aab0f8024a6f,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_aab0f8024a6f,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_aab0f8024a6f,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_aab0f8024a6f,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_aab0f8024a6f,
    'GeneratedFormSection', p_GeneratedFormSection_aab0f8024a6f,
    'IsNameField', p_IsNameField_aab0f8024a6f,
    'RelatedEntityID', p_RelatedEntityID_aab0f8024a6f,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_aab0f8024a6f,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_aab0f8024a6f,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_aab0f8024a6f,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_aab0f8024a6f,
    'EntityIDFieldName', p_EntityIDFieldName_aab0f8024a6f,
    'ScopeDefault', p_ScopeDefault_aab0f8024a6f,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_aab0f8024a6f,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_aab0f8024a6f,
    'Status', p_Status_aab0f8024a6f,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_aab0f8024a6f,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_aab0f8024a6f,
    'AutoUpdateCategory', p_AutoUpdateCategory_aab0f8024a6f,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_aab0f8024a6f,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_aab0f8024a6f,
    'Encrypt', p_Encrypt_aab0f8024a6f,
    'EncryptionKeyID', p_EncryptionKeyID_aab0f8024a6f,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_aab0f8024a6f,
    'SendEncryptedValue', p_SendEncryptedValue_aab0f8024a6f,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_aab0f8024a6f,
    'IsSoftForeignKey', p_IsSoftForeignKey_aab0f8024a6f,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_aab0f8024a6f,
    'JSONType', p_JSONType_aab0f8024a6f,
    'JSONTypeIsArray', p_JSONTypeIsArray_aab0f8024a6f,
    'JSONTypeDefinition', p_JSONTypeDefinition_aab0f8024a6f,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_aab0f8024a6f,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_aab0f8024a6f,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_aab0f8024a6f,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_aab0f8024a6f,
    'IsComputed', p_IsComputed_aab0f8024a6f
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_aab0f8024a6f,
    'Configuration', p_Configuration_aab0f8024a6f,
    'ID', p_ID_aab0f8024a6f
  ));
  ELSE
    PERFORM ${mjSchema}."spUpdateEntityField"(p_DisplayName := p_DisplayName_aab0f8024a6f, p_Description := p_Description_aab0f8024a6f, p_Description_Clear := TRUE, p_AutoUpdateDescription := p_AutoUpdateDescription_aab0f8024a6f, p_IsPrimaryKey := p_IsPrimaryKey_aab0f8024a6f, p_IsUnique := p_IsUnique_aab0f8024a6f, p_Category := p_Category_aab0f8024a6f, p_ValueListType := p_ValueListType_aab0f8024a6f, p_ExtendedType := p_ExtendedType_aab0f8024a6f, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_aab0f8024a6f, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_aab0f8024a6f, p_ViewCellTemplate := p_ViewCellTemplate_aab0f8024a6f, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_aab0f8024a6f, p_AllowUpdateAPI := p_AllowUpdateAPI_aab0f8024a6f, p_AllowUpdateInView := p_AllowUpdateInView_aab0f8024a6f, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_aab0f8024a6f, p_FullTextSearchEnabled := p_FullTextSearchEnabled_aab0f8024a6f, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_aab0f8024a6f, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_aab0f8024a6f, p_GeneratedFormSection := p_GeneratedFormSection_aab0f8024a6f, p_IsNameField := p_IsNameField_aab0f8024a6f, p_RelatedEntityID := p_RelatedEntityID_aab0f8024a6f, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_aab0f8024a6f, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_aab0f8024a6f, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_aab0f8024a6f, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_aab0f8024a6f, p_EntityIDFieldName := p_EntityIDFieldName_aab0f8024a6f, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_aab0f8024a6f, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_aab0f8024a6f, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_aab0f8024a6f, p_Status := p_Status_aab0f8024a6f, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_aab0f8024a6f, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_aab0f8024a6f, p_AutoUpdateCategory := p_AutoUpdateCategory_aab0f8024a6f, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_aab0f8024a6f, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_aab0f8024a6f, p_Encrypt := p_Encrypt_aab0f8024a6f, p_EncryptionKeyID := p_EncryptionKeyID_aab0f8024a6f, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_aab0f8024a6f, p_SendEncryptedValue := p_SendEncryptedValue_aab0f8024a6f, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_aab0f8024a6f, p_IsSoftForeignKey := p_IsSoftForeignKey_aab0f8024a6f, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_aab0f8024a6f, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_aab0f8024a6f, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_aab0f8024a6f, p_JSONTypeDefinition := p_JSONTypeDefinition_aab0f8024a6f, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_aab0f8024a6f, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_aab0f8024a6f, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_aab0f8024a6f, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_aab0f8024a6f, p_IsComputed := p_IsComputed_aab0f8024a6f, p_EmbeddedRecord := p_EmbeddedRecord_aab0f8024a6f, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_aab0f8024a6f, p_Configuration_Clear := TRUE, p_ID := p_ID_aab0f8024a6f);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_bc36f124bdeb VARCHAR(255);
  p_Description_bc36f124bdeb TEXT;
  p_AutoUpdateDescription_bc36f124bdeb BOOLEAN;
  p_IsPrimaryKey_bc36f124bdeb BOOLEAN;
  p_IsUnique_bc36f124bdeb BOOLEAN;
  p_Category_bc36f124bdeb VARCHAR(255);
  p_ValueListType_bc36f124bdeb VARCHAR(20);
  p_ExtendedType_bc36f124bdeb VARCHAR(50);
  p_CodeType_bc36f124bdeb VARCHAR(50);
  p_DefaultInView_bc36f124bdeb BOOLEAN;
  p_ViewCellTemplate_bc36f124bdeb TEXT;
  p_DefaultColumnWidth_bc36f124bdeb INTEGER;
  p_AllowUpdateAPI_bc36f124bdeb BOOLEAN;
  p_AllowUpdateInView_bc36f124bdeb BOOLEAN;
  p_IncludeInUserSearchAPI_bc36f124bdeb BOOLEAN;
  p_FullTextSearchEnabled_bc36f124bdeb BOOLEAN;
  p_UserSearchParamFormatAPI_bc36f124bdeb VARCHAR(500);
  p_IncludeInGeneratedForm_bc36f124bdeb BOOLEAN;
  p_GeneratedFormSection_bc36f124bdeb VARCHAR(10);
  p_IsNameField_bc36f124bdeb BOOLEAN;
  p_RelatedEntityID_bc36f124bdeb UUID;
  p_RelatedEntityFieldName_bc36f124bdeb VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_bc36f124bdeb BOOLEAN;
  p_RelatedEntityNameFieldMap_bc36f124bdeb VARCHAR(255);
  p_RelatedEntityDisplayType_bc36f124bdeb VARCHAR(20);
  p_EntityIDFieldName_bc36f124bdeb VARCHAR(100);
  p_ScopeDefault_bc36f124bdeb VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_bc36f124bdeb BOOLEAN;
  p_ValuesToPackWithSchema_bc36f124bdeb VARCHAR(10);
  p_Status_bc36f124bdeb VARCHAR(25);
  p_AutoUpdateIsNameField_bc36f124bdeb BOOLEAN;
  p_AutoUpdateDefaultInView_bc36f124bdeb BOOLEAN;
  p_AutoUpdateCategory_bc36f124bdeb BOOLEAN;
  p_AutoUpdateDisplayName_bc36f124bdeb BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_bc36f124bdeb BOOLEAN;
  p_Encrypt_bc36f124bdeb BOOLEAN;
  p_EncryptionKeyID_bc36f124bdeb UUID;
  p_AllowDecryptInAPI_bc36f124bdeb BOOLEAN;
  p_SendEncryptedValue_bc36f124bdeb BOOLEAN;
  p_IsSoftPrimaryKey_bc36f124bdeb BOOLEAN;
  p_IsSoftForeignKey_bc36f124bdeb BOOLEAN;
  p_RelatedEntityJoinFields_bc36f124bdeb TEXT;
  p_JSONType_bc36f124bdeb VARCHAR(255);
  p_JSONTypeIsArray_bc36f124bdeb BOOLEAN;
  p_JSONTypeDefinition_bc36f124bdeb TEXT;
  p_UserSearchPredicateAPI_bc36f124bdeb VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_bc36f124bdeb BOOLEAN;
  p_AutoUpdateFullTextSearch_bc36f124bdeb BOOLEAN;
  p_AutoUpdateExtendedType_bc36f124bdeb BOOLEAN;
  p_IsComputed_bc36f124bdeb BOOLEAN;
  p_EmbeddedRecord_bc36f124bdeb TEXT;
  p_Configuration_bc36f124bdeb TEXT;
  p_ID_bc36f124bdeb UUID;
BEGIN
  p_DisplayName_bc36f124bdeb := 'Effective Day Of Week';
  p_AutoUpdateDescription_bc36f124bdeb := TRUE;
  p_IsPrimaryKey_bc36f124bdeb := FALSE;
  p_IsUnique_bc36f124bdeb := FALSE;
  p_Category_bc36f124bdeb := 'Anomaly Detection';
  p_ValueListType_bc36f124bdeb := 'None';
  p_DefaultInView_bc36f124bdeb := FALSE;
  p_DefaultColumnWidth_bc36f124bdeb := 50;
  p_AllowUpdateAPI_bc36f124bdeb := FALSE;
  p_AllowUpdateInView_bc36f124bdeb := TRUE;
  p_IncludeInUserSearchAPI_bc36f124bdeb := FALSE;
  p_FullTextSearchEnabled_bc36f124bdeb := FALSE;
  p_IncludeInGeneratedForm_bc36f124bdeb := TRUE;
  p_GeneratedFormSection_bc36f124bdeb := 'Category';
  p_IsNameField_bc36f124bdeb := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_bc36f124bdeb := FALSE;
  p_RelatedEntityDisplayType_bc36f124bdeb := 'Search';
  p_AutoUpdateRelatedEntityInfo_bc36f124bdeb := TRUE;
  p_ValuesToPackWithSchema_bc36f124bdeb := 'Auto';
  p_Status_bc36f124bdeb := 'Active';
  p_AutoUpdateIsNameField_bc36f124bdeb := TRUE;
  p_AutoUpdateDefaultInView_bc36f124bdeb := TRUE;
  p_AutoUpdateCategory_bc36f124bdeb := TRUE;
  p_AutoUpdateDisplayName_bc36f124bdeb := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_bc36f124bdeb := TRUE;
  p_Encrypt_bc36f124bdeb := FALSE;
  p_AllowDecryptInAPI_bc36f124bdeb := FALSE;
  p_SendEncryptedValue_bc36f124bdeb := FALSE;
  p_IsSoftPrimaryKey_bc36f124bdeb := FALSE;
  p_IsSoftForeignKey_bc36f124bdeb := FALSE;
  p_JSONTypeIsArray_bc36f124bdeb := FALSE;
  p_UserSearchPredicateAPI_bc36f124bdeb := 'Contains';
  p_AutoUpdateUserSearchPredicate_bc36f124bdeb := TRUE;
  p_AutoUpdateFullTextSearch_bc36f124bdeb := TRUE;
  p_AutoUpdateExtendedType_bc36f124bdeb := TRUE;
  p_IsComputed_bc36f124bdeb := FALSE;
  p_ID_bc36f124bdeb := 'E404E4BA-43E1-4D79-AE84-0A7C00F19F3C';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM ${mjSchema}."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_bc36f124bdeb,
    'Description', p_Description_bc36f124bdeb,
    'AutoUpdateDescription', p_AutoUpdateDescription_bc36f124bdeb,
    'IsPrimaryKey', p_IsPrimaryKey_bc36f124bdeb,
    'IsUnique', p_IsUnique_bc36f124bdeb,
    'Category', p_Category_bc36f124bdeb,
    'ValueListType', p_ValueListType_bc36f124bdeb,
    'ExtendedType', p_ExtendedType_bc36f124bdeb,
    'CodeType', p_CodeType_bc36f124bdeb,
    'DefaultInView', p_DefaultInView_bc36f124bdeb,
    'ViewCellTemplate', p_ViewCellTemplate_bc36f124bdeb,
    'DefaultColumnWidth', p_DefaultColumnWidth_bc36f124bdeb,
    'AllowUpdateAPI', p_AllowUpdateAPI_bc36f124bdeb,
    'AllowUpdateInView', p_AllowUpdateInView_bc36f124bdeb,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_bc36f124bdeb,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_bc36f124bdeb,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_bc36f124bdeb,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_bc36f124bdeb,
    'GeneratedFormSection', p_GeneratedFormSection_bc36f124bdeb,
    'IsNameField', p_IsNameField_bc36f124bdeb,
    'RelatedEntityID', p_RelatedEntityID_bc36f124bdeb,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_bc36f124bdeb,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_bc36f124bdeb,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_bc36f124bdeb,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_bc36f124bdeb,
    'EntityIDFieldName', p_EntityIDFieldName_bc36f124bdeb,
    'ScopeDefault', p_ScopeDefault_bc36f124bdeb,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_bc36f124bdeb,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_bc36f124bdeb,
    'Status', p_Status_bc36f124bdeb,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_bc36f124bdeb,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_bc36f124bdeb,
    'AutoUpdateCategory', p_AutoUpdateCategory_bc36f124bdeb,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_bc36f124bdeb,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_bc36f124bdeb,
    'Encrypt', p_Encrypt_bc36f124bdeb,
    'EncryptionKeyID', p_EncryptionKeyID_bc36f124bdeb,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_bc36f124bdeb,
    'SendEncryptedValue', p_SendEncryptedValue_bc36f124bdeb,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_bc36f124bdeb,
    'IsSoftForeignKey', p_IsSoftForeignKey_bc36f124bdeb,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_bc36f124bdeb,
    'JSONType', p_JSONType_bc36f124bdeb,
    'JSONTypeIsArray', p_JSONTypeIsArray_bc36f124bdeb,
    'JSONTypeDefinition', p_JSONTypeDefinition_bc36f124bdeb,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_bc36f124bdeb,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_bc36f124bdeb,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_bc36f124bdeb,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_bc36f124bdeb,
    'IsComputed', p_IsComputed_bc36f124bdeb
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_bc36f124bdeb,
    'Configuration', p_Configuration_bc36f124bdeb,
    'ID', p_ID_bc36f124bdeb
  ));
  ELSE
    PERFORM ${mjSchema}."spUpdateEntityField"(p_DisplayName := p_DisplayName_bc36f124bdeb, p_Description := p_Description_bc36f124bdeb, p_Description_Clear := TRUE, p_AutoUpdateDescription := p_AutoUpdateDescription_bc36f124bdeb, p_IsPrimaryKey := p_IsPrimaryKey_bc36f124bdeb, p_IsUnique := p_IsUnique_bc36f124bdeb, p_Category := p_Category_bc36f124bdeb, p_ValueListType := p_ValueListType_bc36f124bdeb, p_ExtendedType := p_ExtendedType_bc36f124bdeb, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_bc36f124bdeb, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_bc36f124bdeb, p_ViewCellTemplate := p_ViewCellTemplate_bc36f124bdeb, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_bc36f124bdeb, p_AllowUpdateAPI := p_AllowUpdateAPI_bc36f124bdeb, p_AllowUpdateInView := p_AllowUpdateInView_bc36f124bdeb, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_bc36f124bdeb, p_FullTextSearchEnabled := p_FullTextSearchEnabled_bc36f124bdeb, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_bc36f124bdeb, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_bc36f124bdeb, p_GeneratedFormSection := p_GeneratedFormSection_bc36f124bdeb, p_IsNameField := p_IsNameField_bc36f124bdeb, p_RelatedEntityID := p_RelatedEntityID_bc36f124bdeb, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_bc36f124bdeb, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_bc36f124bdeb, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_bc36f124bdeb, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_bc36f124bdeb, p_EntityIDFieldName := p_EntityIDFieldName_bc36f124bdeb, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_bc36f124bdeb, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_bc36f124bdeb, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_bc36f124bdeb, p_Status := p_Status_bc36f124bdeb, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_bc36f124bdeb, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_bc36f124bdeb, p_AutoUpdateCategory := p_AutoUpdateCategory_bc36f124bdeb, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_bc36f124bdeb, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_bc36f124bdeb, p_Encrypt := p_Encrypt_bc36f124bdeb, p_EncryptionKeyID := p_EncryptionKeyID_bc36f124bdeb, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_bc36f124bdeb, p_SendEncryptedValue := p_SendEncryptedValue_bc36f124bdeb, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_bc36f124bdeb, p_IsSoftForeignKey := p_IsSoftForeignKey_bc36f124bdeb, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_bc36f124bdeb, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_bc36f124bdeb, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_bc36f124bdeb, p_JSONTypeDefinition := p_JSONTypeDefinition_bc36f124bdeb, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_bc36f124bdeb, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_bc36f124bdeb, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_bc36f124bdeb, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_bc36f124bdeb, p_IsComputed := p_IsComputed_bc36f124bdeb, p_EmbeddedRecord := p_EmbeddedRecord_bc36f124bdeb, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_bc36f124bdeb, p_Configuration_Clear := TRUE, p_ID := p_ID_bc36f124bdeb);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_efc64c8d21a7 VARCHAR(255);
  p_Description_efc64c8d21a7 TEXT;
  p_AutoUpdateDescription_efc64c8d21a7 BOOLEAN;
  p_IsPrimaryKey_efc64c8d21a7 BOOLEAN;
  p_IsUnique_efc64c8d21a7 BOOLEAN;
  p_Category_efc64c8d21a7 VARCHAR(255);
  p_ValueListType_efc64c8d21a7 VARCHAR(20);
  p_ExtendedType_efc64c8d21a7 VARCHAR(50);
  p_CodeType_efc64c8d21a7 VARCHAR(50);
  p_DefaultInView_efc64c8d21a7 BOOLEAN;
  p_ViewCellTemplate_efc64c8d21a7 TEXT;
  p_DefaultColumnWidth_efc64c8d21a7 INTEGER;
  p_AllowUpdateAPI_efc64c8d21a7 BOOLEAN;
  p_AllowUpdateInView_efc64c8d21a7 BOOLEAN;
  p_IncludeInUserSearchAPI_efc64c8d21a7 BOOLEAN;
  p_FullTextSearchEnabled_efc64c8d21a7 BOOLEAN;
  p_UserSearchParamFormatAPI_efc64c8d21a7 VARCHAR(500);
  p_IncludeInGeneratedForm_efc64c8d21a7 BOOLEAN;
  p_GeneratedFormSection_efc64c8d21a7 VARCHAR(10);
  p_IsNameField_efc64c8d21a7 BOOLEAN;
  p_RelatedEntityID_efc64c8d21a7 UUID;
  p_RelatedEntityFieldName_efc64c8d21a7 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_efc64c8d21a7 BOOLEAN;
  p_RelatedEntityNameFieldMap_efc64c8d21a7 VARCHAR(255);
  p_RelatedEntityDisplayType_efc64c8d21a7 VARCHAR(20);
  p_EntityIDFieldName_efc64c8d21a7 VARCHAR(100);
  p_ScopeDefault_efc64c8d21a7 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_efc64c8d21a7 BOOLEAN;
  p_ValuesToPackWithSchema_efc64c8d21a7 VARCHAR(10);
  p_Status_efc64c8d21a7 VARCHAR(25);
  p_AutoUpdateIsNameField_efc64c8d21a7 BOOLEAN;
  p_AutoUpdateDefaultInView_efc64c8d21a7 BOOLEAN;
  p_AutoUpdateCategory_efc64c8d21a7 BOOLEAN;
  p_AutoUpdateDisplayName_efc64c8d21a7 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_efc64c8d21a7 BOOLEAN;
  p_Encrypt_efc64c8d21a7 BOOLEAN;
  p_EncryptionKeyID_efc64c8d21a7 UUID;
  p_AllowDecryptInAPI_efc64c8d21a7 BOOLEAN;
  p_SendEncryptedValue_efc64c8d21a7 BOOLEAN;
  p_IsSoftPrimaryKey_efc64c8d21a7 BOOLEAN;
  p_IsSoftForeignKey_efc64c8d21a7 BOOLEAN;
  p_RelatedEntityJoinFields_efc64c8d21a7 TEXT;
  p_JSONType_efc64c8d21a7 VARCHAR(255);
  p_JSONTypeIsArray_efc64c8d21a7 BOOLEAN;
  p_JSONTypeDefinition_efc64c8d21a7 TEXT;
  p_UserSearchPredicateAPI_efc64c8d21a7 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_efc64c8d21a7 BOOLEAN;
  p_AutoUpdateFullTextSearch_efc64c8d21a7 BOOLEAN;
  p_AutoUpdateExtendedType_efc64c8d21a7 BOOLEAN;
  p_IsComputed_efc64c8d21a7 BOOLEAN;
  p_EmbeddedRecord_efc64c8d21a7 TEXT;
  p_Configuration_efc64c8d21a7 TEXT;
  p_ID_efc64c8d21a7 UUID;
BEGIN
  p_DisplayName_efc64c8d21a7 := 'Is Weekend';
  p_AutoUpdateDescription_efc64c8d21a7 := TRUE;
  p_IsPrimaryKey_efc64c8d21a7 := FALSE;
  p_IsUnique_efc64c8d21a7 := FALSE;
  p_Category_efc64c8d21a7 := 'Anomaly Detection';
  p_ValueListType_efc64c8d21a7 := 'None';
  p_DefaultInView_efc64c8d21a7 := FALSE;
  p_DefaultColumnWidth_efc64c8d21a7 := 50;
  p_AllowUpdateAPI_efc64c8d21a7 := FALSE;
  p_AllowUpdateInView_efc64c8d21a7 := TRUE;
  p_IncludeInUserSearchAPI_efc64c8d21a7 := FALSE;
  p_FullTextSearchEnabled_efc64c8d21a7 := FALSE;
  p_IncludeInGeneratedForm_efc64c8d21a7 := TRUE;
  p_GeneratedFormSection_efc64c8d21a7 := 'Category';
  p_IsNameField_efc64c8d21a7 := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_efc64c8d21a7 := FALSE;
  p_RelatedEntityDisplayType_efc64c8d21a7 := 'Search';
  p_AutoUpdateRelatedEntityInfo_efc64c8d21a7 := TRUE;
  p_ValuesToPackWithSchema_efc64c8d21a7 := 'Auto';
  p_Status_efc64c8d21a7 := 'Active';
  p_AutoUpdateIsNameField_efc64c8d21a7 := TRUE;
  p_AutoUpdateDefaultInView_efc64c8d21a7 := TRUE;
  p_AutoUpdateCategory_efc64c8d21a7 := TRUE;
  p_AutoUpdateDisplayName_efc64c8d21a7 := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_efc64c8d21a7 := TRUE;
  p_Encrypt_efc64c8d21a7 := FALSE;
  p_AllowDecryptInAPI_efc64c8d21a7 := FALSE;
  p_SendEncryptedValue_efc64c8d21a7 := FALSE;
  p_IsSoftPrimaryKey_efc64c8d21a7 := FALSE;
  p_IsSoftForeignKey_efc64c8d21a7 := FALSE;
  p_JSONTypeIsArray_efc64c8d21a7 := FALSE;
  p_UserSearchPredicateAPI_efc64c8d21a7 := 'Contains';
  p_AutoUpdateUserSearchPredicate_efc64c8d21a7 := TRUE;
  p_AutoUpdateFullTextSearch_efc64c8d21a7 := TRUE;
  p_AutoUpdateExtendedType_efc64c8d21a7 := TRUE;
  p_IsComputed_efc64c8d21a7 := FALSE;
  p_ID_efc64c8d21a7 := 'DDA19850-854F-4D3B-AC92-1341B56E1990';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM ${mjSchema}."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_efc64c8d21a7,
    'Description', p_Description_efc64c8d21a7,
    'AutoUpdateDescription', p_AutoUpdateDescription_efc64c8d21a7,
    'IsPrimaryKey', p_IsPrimaryKey_efc64c8d21a7,
    'IsUnique', p_IsUnique_efc64c8d21a7,
    'Category', p_Category_efc64c8d21a7,
    'ValueListType', p_ValueListType_efc64c8d21a7,
    'ExtendedType', p_ExtendedType_efc64c8d21a7,
    'CodeType', p_CodeType_efc64c8d21a7,
    'DefaultInView', p_DefaultInView_efc64c8d21a7,
    'ViewCellTemplate', p_ViewCellTemplate_efc64c8d21a7,
    'DefaultColumnWidth', p_DefaultColumnWidth_efc64c8d21a7,
    'AllowUpdateAPI', p_AllowUpdateAPI_efc64c8d21a7,
    'AllowUpdateInView', p_AllowUpdateInView_efc64c8d21a7,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_efc64c8d21a7,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_efc64c8d21a7,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_efc64c8d21a7,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_efc64c8d21a7,
    'GeneratedFormSection', p_GeneratedFormSection_efc64c8d21a7,
    'IsNameField', p_IsNameField_efc64c8d21a7,
    'RelatedEntityID', p_RelatedEntityID_efc64c8d21a7,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_efc64c8d21a7,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_efc64c8d21a7,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_efc64c8d21a7,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_efc64c8d21a7,
    'EntityIDFieldName', p_EntityIDFieldName_efc64c8d21a7,
    'ScopeDefault', p_ScopeDefault_efc64c8d21a7,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_efc64c8d21a7,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_efc64c8d21a7,
    'Status', p_Status_efc64c8d21a7,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_efc64c8d21a7,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_efc64c8d21a7,
    'AutoUpdateCategory', p_AutoUpdateCategory_efc64c8d21a7,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_efc64c8d21a7,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_efc64c8d21a7,
    'Encrypt', p_Encrypt_efc64c8d21a7,
    'EncryptionKeyID', p_EncryptionKeyID_efc64c8d21a7,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_efc64c8d21a7,
    'SendEncryptedValue', p_SendEncryptedValue_efc64c8d21a7,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_efc64c8d21a7,
    'IsSoftForeignKey', p_IsSoftForeignKey_efc64c8d21a7,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_efc64c8d21a7,
    'JSONType', p_JSONType_efc64c8d21a7,
    'JSONTypeIsArray', p_JSONTypeIsArray_efc64c8d21a7,
    'JSONTypeDefinition', p_JSONTypeDefinition_efc64c8d21a7,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_efc64c8d21a7,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_efc64c8d21a7,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_efc64c8d21a7,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_efc64c8d21a7,
    'IsComputed', p_IsComputed_efc64c8d21a7
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_efc64c8d21a7,
    'Configuration', p_Configuration_efc64c8d21a7,
    'ID', p_ID_efc64c8d21a7
  ));
  ELSE
    PERFORM ${mjSchema}."spUpdateEntityField"(p_DisplayName := p_DisplayName_efc64c8d21a7, p_Description := p_Description_efc64c8d21a7, p_Description_Clear := TRUE, p_AutoUpdateDescription := p_AutoUpdateDescription_efc64c8d21a7, p_IsPrimaryKey := p_IsPrimaryKey_efc64c8d21a7, p_IsUnique := p_IsUnique_efc64c8d21a7, p_Category := p_Category_efc64c8d21a7, p_ValueListType := p_ValueListType_efc64c8d21a7, p_ExtendedType := p_ExtendedType_efc64c8d21a7, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_efc64c8d21a7, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_efc64c8d21a7, p_ViewCellTemplate := p_ViewCellTemplate_efc64c8d21a7, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_efc64c8d21a7, p_AllowUpdateAPI := p_AllowUpdateAPI_efc64c8d21a7, p_AllowUpdateInView := p_AllowUpdateInView_efc64c8d21a7, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_efc64c8d21a7, p_FullTextSearchEnabled := p_FullTextSearchEnabled_efc64c8d21a7, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_efc64c8d21a7, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_efc64c8d21a7, p_GeneratedFormSection := p_GeneratedFormSection_efc64c8d21a7, p_IsNameField := p_IsNameField_efc64c8d21a7, p_RelatedEntityID := p_RelatedEntityID_efc64c8d21a7, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_efc64c8d21a7, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_efc64c8d21a7, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_efc64c8d21a7, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_efc64c8d21a7, p_EntityIDFieldName := p_EntityIDFieldName_efc64c8d21a7, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_efc64c8d21a7, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_efc64c8d21a7, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_efc64c8d21a7, p_Status := p_Status_efc64c8d21a7, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_efc64c8d21a7, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_efc64c8d21a7, p_AutoUpdateCategory := p_AutoUpdateCategory_efc64c8d21a7, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_efc64c8d21a7, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_efc64c8d21a7, p_Encrypt := p_Encrypt_efc64c8d21a7, p_EncryptionKeyID := p_EncryptionKeyID_efc64c8d21a7, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_efc64c8d21a7, p_SendEncryptedValue := p_SendEncryptedValue_efc64c8d21a7, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_efc64c8d21a7, p_IsSoftForeignKey := p_IsSoftForeignKey_efc64c8d21a7, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_efc64c8d21a7, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_efc64c8d21a7, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_efc64c8d21a7, p_JSONTypeDefinition := p_JSONTypeDefinition_efc64c8d21a7, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_efc64c8d21a7, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_efc64c8d21a7, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_efc64c8d21a7, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_efc64c8d21a7, p_IsComputed := p_IsComputed_efc64c8d21a7, p_EmbeddedRecord := p_EmbeddedRecord_efc64c8d21a7, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_efc64c8d21a7, p_Configuration_Clear := TRUE, p_ID := p_ID_efc64c8d21a7);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_6144dd076f89 VARCHAR(255);
  p_Description_6144dd076f89 TEXT;
  p_AutoUpdateDescription_6144dd076f89 BOOLEAN;
  p_IsPrimaryKey_6144dd076f89 BOOLEAN;
  p_IsUnique_6144dd076f89 BOOLEAN;
  p_Category_6144dd076f89 VARCHAR(255);
  p_ValueListType_6144dd076f89 VARCHAR(20);
  p_ExtendedType_6144dd076f89 VARCHAR(50);
  p_CodeType_6144dd076f89 VARCHAR(50);
  p_DefaultInView_6144dd076f89 BOOLEAN;
  p_ViewCellTemplate_6144dd076f89 TEXT;
  p_DefaultColumnWidth_6144dd076f89 INTEGER;
  p_AllowUpdateAPI_6144dd076f89 BOOLEAN;
  p_AllowUpdateInView_6144dd076f89 BOOLEAN;
  p_IncludeInUserSearchAPI_6144dd076f89 BOOLEAN;
  p_FullTextSearchEnabled_6144dd076f89 BOOLEAN;
  p_UserSearchParamFormatAPI_6144dd076f89 VARCHAR(500);
  p_IncludeInGeneratedForm_6144dd076f89 BOOLEAN;
  p_GeneratedFormSection_6144dd076f89 VARCHAR(10);
  p_IsNameField_6144dd076f89 BOOLEAN;
  p_RelatedEntityID_6144dd076f89 UUID;
  p_RelatedEntityFieldName_6144dd076f89 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_6144dd076f89 BOOLEAN;
  p_RelatedEntityNameFieldMap_6144dd076f89 VARCHAR(255);
  p_RelatedEntityDisplayType_6144dd076f89 VARCHAR(20);
  p_EntityIDFieldName_6144dd076f89 VARCHAR(100);
  p_ScopeDefault_6144dd076f89 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_6144dd076f89 BOOLEAN;
  p_ValuesToPackWithSchema_6144dd076f89 VARCHAR(10);
  p_Status_6144dd076f89 VARCHAR(25);
  p_AutoUpdateIsNameField_6144dd076f89 BOOLEAN;
  p_AutoUpdateDefaultInView_6144dd076f89 BOOLEAN;
  p_AutoUpdateCategory_6144dd076f89 BOOLEAN;
  p_AutoUpdateDisplayName_6144dd076f89 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_6144dd076f89 BOOLEAN;
  p_Encrypt_6144dd076f89 BOOLEAN;
  p_EncryptionKeyID_6144dd076f89 UUID;
  p_AllowDecryptInAPI_6144dd076f89 BOOLEAN;
  p_SendEncryptedValue_6144dd076f89 BOOLEAN;
  p_IsSoftPrimaryKey_6144dd076f89 BOOLEAN;
  p_IsSoftForeignKey_6144dd076f89 BOOLEAN;
  p_RelatedEntityJoinFields_6144dd076f89 TEXT;
  p_JSONType_6144dd076f89 VARCHAR(255);
  p_JSONTypeIsArray_6144dd076f89 BOOLEAN;
  p_JSONTypeDefinition_6144dd076f89 TEXT;
  p_UserSearchPredicateAPI_6144dd076f89 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_6144dd076f89 BOOLEAN;
  p_AutoUpdateFullTextSearch_6144dd076f89 BOOLEAN;
  p_AutoUpdateExtendedType_6144dd076f89 BOOLEAN;
  p_IsComputed_6144dd076f89 BOOLEAN;
  p_EmbeddedRecord_6144dd076f89 TEXT;
  p_Configuration_6144dd076f89 TEXT;
  p_ID_6144dd076f89 UUID;
BEGIN
  p_DisplayName_6144dd076f89 := 'Has Linked Record';
  p_AutoUpdateDescription_6144dd076f89 := TRUE;
  p_IsPrimaryKey_6144dd076f89 := FALSE;
  p_IsUnique_6144dd076f89 := FALSE;
  p_Category_6144dd076f89 := 'Anomaly Detection';
  p_ValueListType_6144dd076f89 := 'None';
  p_DefaultInView_6144dd076f89 := FALSE;
  p_DefaultColumnWidth_6144dd076f89 := 50;
  p_AllowUpdateAPI_6144dd076f89 := FALSE;
  p_AllowUpdateInView_6144dd076f89 := TRUE;
  p_IncludeInUserSearchAPI_6144dd076f89 := FALSE;
  p_FullTextSearchEnabled_6144dd076f89 := FALSE;
  p_IncludeInGeneratedForm_6144dd076f89 := TRUE;
  p_GeneratedFormSection_6144dd076f89 := 'Category';
  p_IsNameField_6144dd076f89 := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_6144dd076f89 := FALSE;
  p_RelatedEntityDisplayType_6144dd076f89 := 'Search';
  p_AutoUpdateRelatedEntityInfo_6144dd076f89 := TRUE;
  p_ValuesToPackWithSchema_6144dd076f89 := 'Auto';
  p_Status_6144dd076f89 := 'Active';
  p_AutoUpdateIsNameField_6144dd076f89 := TRUE;
  p_AutoUpdateDefaultInView_6144dd076f89 := TRUE;
  p_AutoUpdateCategory_6144dd076f89 := TRUE;
  p_AutoUpdateDisplayName_6144dd076f89 := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_6144dd076f89 := TRUE;
  p_Encrypt_6144dd076f89 := FALSE;
  p_AllowDecryptInAPI_6144dd076f89 := FALSE;
  p_SendEncryptedValue_6144dd076f89 := FALSE;
  p_IsSoftPrimaryKey_6144dd076f89 := FALSE;
  p_IsSoftForeignKey_6144dd076f89 := FALSE;
  p_JSONTypeIsArray_6144dd076f89 := FALSE;
  p_UserSearchPredicateAPI_6144dd076f89 := 'Contains';
  p_AutoUpdateUserSearchPredicate_6144dd076f89 := TRUE;
  p_AutoUpdateFullTextSearch_6144dd076f89 := TRUE;
  p_AutoUpdateExtendedType_6144dd076f89 := TRUE;
  p_IsComputed_6144dd076f89 := FALSE;
  p_ID_6144dd076f89 := '059438FF-3C74-4AB3-82AC-B08DE48EF205';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM ${mjSchema}."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_6144dd076f89,
    'Description', p_Description_6144dd076f89,
    'AutoUpdateDescription', p_AutoUpdateDescription_6144dd076f89,
    'IsPrimaryKey', p_IsPrimaryKey_6144dd076f89,
    'IsUnique', p_IsUnique_6144dd076f89,
    'Category', p_Category_6144dd076f89,
    'ValueListType', p_ValueListType_6144dd076f89,
    'ExtendedType', p_ExtendedType_6144dd076f89,
    'CodeType', p_CodeType_6144dd076f89,
    'DefaultInView', p_DefaultInView_6144dd076f89,
    'ViewCellTemplate', p_ViewCellTemplate_6144dd076f89,
    'DefaultColumnWidth', p_DefaultColumnWidth_6144dd076f89,
    'AllowUpdateAPI', p_AllowUpdateAPI_6144dd076f89,
    'AllowUpdateInView', p_AllowUpdateInView_6144dd076f89,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_6144dd076f89,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_6144dd076f89,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_6144dd076f89,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_6144dd076f89,
    'GeneratedFormSection', p_GeneratedFormSection_6144dd076f89,
    'IsNameField', p_IsNameField_6144dd076f89,
    'RelatedEntityID', p_RelatedEntityID_6144dd076f89,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_6144dd076f89,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_6144dd076f89,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_6144dd076f89,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_6144dd076f89,
    'EntityIDFieldName', p_EntityIDFieldName_6144dd076f89,
    'ScopeDefault', p_ScopeDefault_6144dd076f89,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_6144dd076f89,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_6144dd076f89,
    'Status', p_Status_6144dd076f89,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_6144dd076f89,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_6144dd076f89,
    'AutoUpdateCategory', p_AutoUpdateCategory_6144dd076f89,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_6144dd076f89,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_6144dd076f89,
    'Encrypt', p_Encrypt_6144dd076f89,
    'EncryptionKeyID', p_EncryptionKeyID_6144dd076f89,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_6144dd076f89,
    'SendEncryptedValue', p_SendEncryptedValue_6144dd076f89,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_6144dd076f89,
    'IsSoftForeignKey', p_IsSoftForeignKey_6144dd076f89,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_6144dd076f89,
    'JSONType', p_JSONType_6144dd076f89,
    'JSONTypeIsArray', p_JSONTypeIsArray_6144dd076f89,
    'JSONTypeDefinition', p_JSONTypeDefinition_6144dd076f89,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_6144dd076f89,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_6144dd076f89,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_6144dd076f89,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_6144dd076f89,
    'IsComputed', p_IsComputed_6144dd076f89
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_6144dd076f89,
    'Configuration', p_Configuration_6144dd076f89,
    'ID', p_ID_6144dd076f89
  ));
  ELSE
    PERFORM ${mjSchema}."spUpdateEntityField"(p_DisplayName := p_DisplayName_6144dd076f89, p_Description := p_Description_6144dd076f89, p_Description_Clear := TRUE, p_AutoUpdateDescription := p_AutoUpdateDescription_6144dd076f89, p_IsPrimaryKey := p_IsPrimaryKey_6144dd076f89, p_IsUnique := p_IsUnique_6144dd076f89, p_Category := p_Category_6144dd076f89, p_ValueListType := p_ValueListType_6144dd076f89, p_ExtendedType := p_ExtendedType_6144dd076f89, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_6144dd076f89, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_6144dd076f89, p_ViewCellTemplate := p_ViewCellTemplate_6144dd076f89, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_6144dd076f89, p_AllowUpdateAPI := p_AllowUpdateAPI_6144dd076f89, p_AllowUpdateInView := p_AllowUpdateInView_6144dd076f89, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_6144dd076f89, p_FullTextSearchEnabled := p_FullTextSearchEnabled_6144dd076f89, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_6144dd076f89, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_6144dd076f89, p_GeneratedFormSection := p_GeneratedFormSection_6144dd076f89, p_IsNameField := p_IsNameField_6144dd076f89, p_RelatedEntityID := p_RelatedEntityID_6144dd076f89, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_6144dd076f89, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_6144dd076f89, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_6144dd076f89, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_6144dd076f89, p_EntityIDFieldName := p_EntityIDFieldName_6144dd076f89, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_6144dd076f89, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_6144dd076f89, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_6144dd076f89, p_Status := p_Status_6144dd076f89, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_6144dd076f89, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_6144dd076f89, p_AutoUpdateCategory := p_AutoUpdateCategory_6144dd076f89, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_6144dd076f89, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_6144dd076f89, p_Encrypt := p_Encrypt_6144dd076f89, p_EncryptionKeyID := p_EncryptionKeyID_6144dd076f89, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_6144dd076f89, p_SendEncryptedValue := p_SendEncryptedValue_6144dd076f89, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_6144dd076f89, p_IsSoftForeignKey := p_IsSoftForeignKey_6144dd076f89, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_6144dd076f89, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_6144dd076f89, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_6144dd076f89, p_JSONTypeDefinition := p_JSONTypeDefinition_6144dd076f89, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_6144dd076f89, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_6144dd076f89, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_6144dd076f89, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_6144dd076f89, p_IsComputed := p_IsComputed_6144dd076f89, p_EmbeddedRecord := p_EmbeddedRecord_6144dd076f89, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_6144dd076f89, p_Configuration_Clear := TRUE, p_ID := p_ID_6144dd076f89);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_ddd97132dfef VARCHAR(255);
  p_Description_ddd97132dfef TEXT;
  p_AutoUpdateDescription_ddd97132dfef BOOLEAN;
  p_IsPrimaryKey_ddd97132dfef BOOLEAN;
  p_IsUnique_ddd97132dfef BOOLEAN;
  p_Category_ddd97132dfef VARCHAR(255);
  p_ValueListType_ddd97132dfef VARCHAR(20);
  p_ExtendedType_ddd97132dfef VARCHAR(50);
  p_CodeType_ddd97132dfef VARCHAR(50);
  p_DefaultInView_ddd97132dfef BOOLEAN;
  p_ViewCellTemplate_ddd97132dfef TEXT;
  p_DefaultColumnWidth_ddd97132dfef INTEGER;
  p_AllowUpdateAPI_ddd97132dfef BOOLEAN;
  p_AllowUpdateInView_ddd97132dfef BOOLEAN;
  p_IncludeInUserSearchAPI_ddd97132dfef BOOLEAN;
  p_FullTextSearchEnabled_ddd97132dfef BOOLEAN;
  p_UserSearchParamFormatAPI_ddd97132dfef VARCHAR(500);
  p_IncludeInGeneratedForm_ddd97132dfef BOOLEAN;
  p_GeneratedFormSection_ddd97132dfef VARCHAR(10);
  p_IsNameField_ddd97132dfef BOOLEAN;
  p_RelatedEntityID_ddd97132dfef UUID;
  p_RelatedEntityFieldName_ddd97132dfef VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_ddd97132dfef BOOLEAN;
  p_RelatedEntityNameFieldMap_ddd97132dfef VARCHAR(255);
  p_RelatedEntityDisplayType_ddd97132dfef VARCHAR(20);
  p_EntityIDFieldName_ddd97132dfef VARCHAR(100);
  p_ScopeDefault_ddd97132dfef VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_ddd97132dfef BOOLEAN;
  p_ValuesToPackWithSchema_ddd97132dfef VARCHAR(10);
  p_Status_ddd97132dfef VARCHAR(25);
  p_AutoUpdateIsNameField_ddd97132dfef BOOLEAN;
  p_AutoUpdateDefaultInView_ddd97132dfef BOOLEAN;
  p_AutoUpdateCategory_ddd97132dfef BOOLEAN;
  p_AutoUpdateDisplayName_ddd97132dfef BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_ddd97132dfef BOOLEAN;
  p_Encrypt_ddd97132dfef BOOLEAN;
  p_EncryptionKeyID_ddd97132dfef UUID;
  p_AllowDecryptInAPI_ddd97132dfef BOOLEAN;
  p_SendEncryptedValue_ddd97132dfef BOOLEAN;
  p_IsSoftPrimaryKey_ddd97132dfef BOOLEAN;
  p_IsSoftForeignKey_ddd97132dfef BOOLEAN;
  p_RelatedEntityJoinFields_ddd97132dfef TEXT;
  p_JSONType_ddd97132dfef VARCHAR(255);
  p_JSONTypeIsArray_ddd97132dfef BOOLEAN;
  p_JSONTypeDefinition_ddd97132dfef TEXT;
  p_UserSearchPredicateAPI_ddd97132dfef VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_ddd97132dfef BOOLEAN;
  p_AutoUpdateFullTextSearch_ddd97132dfef BOOLEAN;
  p_AutoUpdateExtendedType_ddd97132dfef BOOLEAN;
  p_IsComputed_ddd97132dfef BOOLEAN;
  p_EmbeddedRecord_ddd97132dfef TEXT;
  p_Configuration_ddd97132dfef TEXT;
  p_ID_ddd97132dfef UUID;
BEGIN
  p_DisplayName_ddd97132dfef := 'Has File';
  p_AutoUpdateDescription_ddd97132dfef := TRUE;
  p_IsPrimaryKey_ddd97132dfef := FALSE;
  p_IsUnique_ddd97132dfef := FALSE;
  p_Category_ddd97132dfef := 'Anomaly Detection';
  p_ValueListType_ddd97132dfef := 'None';
  p_DefaultInView_ddd97132dfef := FALSE;
  p_DefaultColumnWidth_ddd97132dfef := 50;
  p_AllowUpdateAPI_ddd97132dfef := FALSE;
  p_AllowUpdateInView_ddd97132dfef := TRUE;
  p_IncludeInUserSearchAPI_ddd97132dfef := FALSE;
  p_FullTextSearchEnabled_ddd97132dfef := FALSE;
  p_IncludeInGeneratedForm_ddd97132dfef := TRUE;
  p_GeneratedFormSection_ddd97132dfef := 'Category';
  p_IsNameField_ddd97132dfef := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_ddd97132dfef := FALSE;
  p_RelatedEntityDisplayType_ddd97132dfef := 'Search';
  p_AutoUpdateRelatedEntityInfo_ddd97132dfef := TRUE;
  p_ValuesToPackWithSchema_ddd97132dfef := 'Auto';
  p_Status_ddd97132dfef := 'Active';
  p_AutoUpdateIsNameField_ddd97132dfef := TRUE;
  p_AutoUpdateDefaultInView_ddd97132dfef := TRUE;
  p_AutoUpdateCategory_ddd97132dfef := TRUE;
  p_AutoUpdateDisplayName_ddd97132dfef := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_ddd97132dfef := TRUE;
  p_Encrypt_ddd97132dfef := FALSE;
  p_AllowDecryptInAPI_ddd97132dfef := FALSE;
  p_SendEncryptedValue_ddd97132dfef := FALSE;
  p_IsSoftPrimaryKey_ddd97132dfef := FALSE;
  p_IsSoftForeignKey_ddd97132dfef := FALSE;
  p_JSONTypeIsArray_ddd97132dfef := FALSE;
  p_UserSearchPredicateAPI_ddd97132dfef := 'Contains';
  p_AutoUpdateUserSearchPredicate_ddd97132dfef := TRUE;
  p_AutoUpdateFullTextSearch_ddd97132dfef := TRUE;
  p_AutoUpdateExtendedType_ddd97132dfef := TRUE;
  p_IsComputed_ddd97132dfef := FALSE;
  p_ID_ddd97132dfef := '3388C921-27FF-42DD-B308-65E4577DF0FE';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM ${mjSchema}."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_ddd97132dfef,
    'Description', p_Description_ddd97132dfef,
    'AutoUpdateDescription', p_AutoUpdateDescription_ddd97132dfef,
    'IsPrimaryKey', p_IsPrimaryKey_ddd97132dfef,
    'IsUnique', p_IsUnique_ddd97132dfef,
    'Category', p_Category_ddd97132dfef,
    'ValueListType', p_ValueListType_ddd97132dfef,
    'ExtendedType', p_ExtendedType_ddd97132dfef,
    'CodeType', p_CodeType_ddd97132dfef,
    'DefaultInView', p_DefaultInView_ddd97132dfef,
    'ViewCellTemplate', p_ViewCellTemplate_ddd97132dfef,
    'DefaultColumnWidth', p_DefaultColumnWidth_ddd97132dfef,
    'AllowUpdateAPI', p_AllowUpdateAPI_ddd97132dfef,
    'AllowUpdateInView', p_AllowUpdateInView_ddd97132dfef,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_ddd97132dfef,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_ddd97132dfef,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_ddd97132dfef,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_ddd97132dfef,
    'GeneratedFormSection', p_GeneratedFormSection_ddd97132dfef,
    'IsNameField', p_IsNameField_ddd97132dfef,
    'RelatedEntityID', p_RelatedEntityID_ddd97132dfef,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_ddd97132dfef,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_ddd97132dfef,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_ddd97132dfef,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_ddd97132dfef,
    'EntityIDFieldName', p_EntityIDFieldName_ddd97132dfef,
    'ScopeDefault', p_ScopeDefault_ddd97132dfef,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_ddd97132dfef,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_ddd97132dfef,
    'Status', p_Status_ddd97132dfef,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_ddd97132dfef,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_ddd97132dfef,
    'AutoUpdateCategory', p_AutoUpdateCategory_ddd97132dfef,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_ddd97132dfef,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_ddd97132dfef,
    'Encrypt', p_Encrypt_ddd97132dfef,
    'EncryptionKeyID', p_EncryptionKeyID_ddd97132dfef,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_ddd97132dfef,
    'SendEncryptedValue', p_SendEncryptedValue_ddd97132dfef,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_ddd97132dfef,
    'IsSoftForeignKey', p_IsSoftForeignKey_ddd97132dfef,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_ddd97132dfef,
    'JSONType', p_JSONType_ddd97132dfef,
    'JSONTypeIsArray', p_JSONTypeIsArray_ddd97132dfef,
    'JSONTypeDefinition', p_JSONTypeDefinition_ddd97132dfef,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_ddd97132dfef,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_ddd97132dfef,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_ddd97132dfef,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_ddd97132dfef,
    'IsComputed', p_IsComputed_ddd97132dfef
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_ddd97132dfef,
    'Configuration', p_Configuration_ddd97132dfef,
    'ID', p_ID_ddd97132dfef
  ));
  ELSE
    PERFORM ${mjSchema}."spUpdateEntityField"(p_DisplayName := p_DisplayName_ddd97132dfef, p_Description := p_Description_ddd97132dfef, p_Description_Clear := TRUE, p_AutoUpdateDescription := p_AutoUpdateDescription_ddd97132dfef, p_IsPrimaryKey := p_IsPrimaryKey_ddd97132dfef, p_IsUnique := p_IsUnique_ddd97132dfef, p_Category := p_Category_ddd97132dfef, p_ValueListType := p_ValueListType_ddd97132dfef, p_ExtendedType := p_ExtendedType_ddd97132dfef, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_ddd97132dfef, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_ddd97132dfef, p_ViewCellTemplate := p_ViewCellTemplate_ddd97132dfef, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_ddd97132dfef, p_AllowUpdateAPI := p_AllowUpdateAPI_ddd97132dfef, p_AllowUpdateInView := p_AllowUpdateInView_ddd97132dfef, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_ddd97132dfef, p_FullTextSearchEnabled := p_FullTextSearchEnabled_ddd97132dfef, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_ddd97132dfef, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_ddd97132dfef, p_GeneratedFormSection := p_GeneratedFormSection_ddd97132dfef, p_IsNameField := p_IsNameField_ddd97132dfef, p_RelatedEntityID := p_RelatedEntityID_ddd97132dfef, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_ddd97132dfef, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_ddd97132dfef, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_ddd97132dfef, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_ddd97132dfef, p_EntityIDFieldName := p_EntityIDFieldName_ddd97132dfef, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_ddd97132dfef, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_ddd97132dfef, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_ddd97132dfef, p_Status := p_Status_ddd97132dfef, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_ddd97132dfef, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_ddd97132dfef, p_AutoUpdateCategory := p_AutoUpdateCategory_ddd97132dfef, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_ddd97132dfef, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_ddd97132dfef, p_Encrypt := p_Encrypt_ddd97132dfef, p_EncryptionKeyID := p_EncryptionKeyID_ddd97132dfef, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_ddd97132dfef, p_SendEncryptedValue := p_SendEncryptedValue_ddd97132dfef, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_ddd97132dfef, p_IsSoftForeignKey := p_IsSoftForeignKey_ddd97132dfef, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_ddd97132dfef, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_ddd97132dfef, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_ddd97132dfef, p_JSONTypeDefinition := p_JSONTypeDefinition_ddd97132dfef, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_ddd97132dfef, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_ddd97132dfef, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_ddd97132dfef, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_ddd97132dfef, p_IsComputed := p_IsComputed_ddd97132dfef, p_EmbeddedRecord := p_EmbeddedRecord_ddd97132dfef, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_ddd97132dfef, p_Configuration_Clear := TRUE, p_ID := p_ID_ddd97132dfef);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_2b23c67fd8bf VARCHAR(255);
  p_Description_2b23c67fd8bf TEXT;
  p_AutoUpdateDescription_2b23c67fd8bf BOOLEAN;
  p_IsPrimaryKey_2b23c67fd8bf BOOLEAN;
  p_IsUnique_2b23c67fd8bf BOOLEAN;
  p_Category_2b23c67fd8bf VARCHAR(255);
  p_ValueListType_2b23c67fd8bf VARCHAR(20);
  p_ExtendedType_2b23c67fd8bf VARCHAR(50);
  p_CodeType_2b23c67fd8bf VARCHAR(50);
  p_DefaultInView_2b23c67fd8bf BOOLEAN;
  p_ViewCellTemplate_2b23c67fd8bf TEXT;
  p_DefaultColumnWidth_2b23c67fd8bf INTEGER;
  p_AllowUpdateAPI_2b23c67fd8bf BOOLEAN;
  p_AllowUpdateInView_2b23c67fd8bf BOOLEAN;
  p_IncludeInUserSearchAPI_2b23c67fd8bf BOOLEAN;
  p_FullTextSearchEnabled_2b23c67fd8bf BOOLEAN;
  p_UserSearchParamFormatAPI_2b23c67fd8bf VARCHAR(500);
  p_IncludeInGeneratedForm_2b23c67fd8bf BOOLEAN;
  p_GeneratedFormSection_2b23c67fd8bf VARCHAR(10);
  p_IsNameField_2b23c67fd8bf BOOLEAN;
  p_RelatedEntityID_2b23c67fd8bf UUID;
  p_RelatedEntityFieldName_2b23c67fd8bf VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_2b23c67fd8bf BOOLEAN;
  p_RelatedEntityNameFieldMap_2b23c67fd8bf VARCHAR(255);
  p_RelatedEntityDisplayType_2b23c67fd8bf VARCHAR(20);
  p_EntityIDFieldName_2b23c67fd8bf VARCHAR(100);
  p_ScopeDefault_2b23c67fd8bf VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_2b23c67fd8bf BOOLEAN;
  p_ValuesToPackWithSchema_2b23c67fd8bf VARCHAR(10);
  p_Status_2b23c67fd8bf VARCHAR(25);
  p_AutoUpdateIsNameField_2b23c67fd8bf BOOLEAN;
  p_AutoUpdateDefaultInView_2b23c67fd8bf BOOLEAN;
  p_AutoUpdateCategory_2b23c67fd8bf BOOLEAN;
  p_AutoUpdateDisplayName_2b23c67fd8bf BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_2b23c67fd8bf BOOLEAN;
  p_Encrypt_2b23c67fd8bf BOOLEAN;
  p_EncryptionKeyID_2b23c67fd8bf UUID;
  p_AllowDecryptInAPI_2b23c67fd8bf BOOLEAN;
  p_SendEncryptedValue_2b23c67fd8bf BOOLEAN;
  p_IsSoftPrimaryKey_2b23c67fd8bf BOOLEAN;
  p_IsSoftForeignKey_2b23c67fd8bf BOOLEAN;
  p_RelatedEntityJoinFields_2b23c67fd8bf TEXT;
  p_JSONType_2b23c67fd8bf VARCHAR(255);
  p_JSONTypeIsArray_2b23c67fd8bf BOOLEAN;
  p_JSONTypeDefinition_2b23c67fd8bf TEXT;
  p_UserSearchPredicateAPI_2b23c67fd8bf VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_2b23c67fd8bf BOOLEAN;
  p_AutoUpdateFullTextSearch_2b23c67fd8bf BOOLEAN;
  p_AutoUpdateExtendedType_2b23c67fd8bf BOOLEAN;
  p_IsComputed_2b23c67fd8bf BOOLEAN;
  p_EmbeddedRecord_2b23c67fd8bf TEXT;
  p_Configuration_2b23c67fd8bf TEXT;
  p_ID_2b23c67fd8bf UUID;
BEGIN
  p_DisplayName_2b23c67fd8bf := 'Seal Mismatch Detected At';
  p_Description_2b23c67fd8bf := 'When a retry of this Failed batch found its journal already in the ERP and recorded it Posted, with no second post, although the batch no longer matched its approved-content seal (a summary line''s dimension tags changed after approval). The local tags then differ from what the ERP holds; review them. NULL when the seal matched or the batch was never adopted this way.';
  p_AutoUpdateDescription_2b23c67fd8bf := TRUE;
  p_IsPrimaryKey_2b23c67fd8bf := FALSE;
  p_IsUnique_2b23c67fd8bf := FALSE;
  p_Category_2b23c67fd8bf := 'Approval and Dispatch';
  p_ValueListType_2b23c67fd8bf := 'None';
  p_DefaultInView_2b23c67fd8bf := FALSE;
  p_DefaultColumnWidth_2b23c67fd8bf := 100;
  p_AllowUpdateAPI_2b23c67fd8bf := TRUE;
  p_AllowUpdateInView_2b23c67fd8bf := TRUE;
  p_IncludeInUserSearchAPI_2b23c67fd8bf := FALSE;
  p_FullTextSearchEnabled_2b23c67fd8bf := FALSE;
  p_IncludeInGeneratedForm_2b23c67fd8bf := TRUE;
  p_GeneratedFormSection_2b23c67fd8bf := 'Category';
  p_IsNameField_2b23c67fd8bf := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_2b23c67fd8bf := FALSE;
  p_RelatedEntityDisplayType_2b23c67fd8bf := 'Search';
  p_AutoUpdateRelatedEntityInfo_2b23c67fd8bf := TRUE;
  p_ValuesToPackWithSchema_2b23c67fd8bf := 'Auto';
  p_Status_2b23c67fd8bf := 'Active';
  p_AutoUpdateIsNameField_2b23c67fd8bf := TRUE;
  p_AutoUpdateDefaultInView_2b23c67fd8bf := TRUE;
  p_AutoUpdateCategory_2b23c67fd8bf := TRUE;
  p_AutoUpdateDisplayName_2b23c67fd8bf := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_2b23c67fd8bf := TRUE;
  p_Encrypt_2b23c67fd8bf := FALSE;
  p_AllowDecryptInAPI_2b23c67fd8bf := FALSE;
  p_SendEncryptedValue_2b23c67fd8bf := FALSE;
  p_IsSoftPrimaryKey_2b23c67fd8bf := FALSE;
  p_IsSoftForeignKey_2b23c67fd8bf := FALSE;
  p_JSONTypeIsArray_2b23c67fd8bf := FALSE;
  p_UserSearchPredicateAPI_2b23c67fd8bf := 'Contains';
  p_AutoUpdateUserSearchPredicate_2b23c67fd8bf := TRUE;
  p_AutoUpdateFullTextSearch_2b23c67fd8bf := TRUE;
  p_AutoUpdateExtendedType_2b23c67fd8bf := TRUE;
  p_IsComputed_2b23c67fd8bf := FALSE;
  p_ID_2b23c67fd8bf := '1A8D15CF-9BD7-4334-8E2B-9406143E3C49';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM ${mjSchema}."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_2b23c67fd8bf,
    'Description', p_Description_2b23c67fd8bf,
    'AutoUpdateDescription', p_AutoUpdateDescription_2b23c67fd8bf,
    'IsPrimaryKey', p_IsPrimaryKey_2b23c67fd8bf,
    'IsUnique', p_IsUnique_2b23c67fd8bf,
    'Category', p_Category_2b23c67fd8bf,
    'ValueListType', p_ValueListType_2b23c67fd8bf,
    'ExtendedType', p_ExtendedType_2b23c67fd8bf,
    'CodeType', p_CodeType_2b23c67fd8bf,
    'DefaultInView', p_DefaultInView_2b23c67fd8bf,
    'ViewCellTemplate', p_ViewCellTemplate_2b23c67fd8bf,
    'DefaultColumnWidth', p_DefaultColumnWidth_2b23c67fd8bf,
    'AllowUpdateAPI', p_AllowUpdateAPI_2b23c67fd8bf,
    'AllowUpdateInView', p_AllowUpdateInView_2b23c67fd8bf,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_2b23c67fd8bf,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_2b23c67fd8bf,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_2b23c67fd8bf,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_2b23c67fd8bf,
    'GeneratedFormSection', p_GeneratedFormSection_2b23c67fd8bf,
    'IsNameField', p_IsNameField_2b23c67fd8bf,
    'RelatedEntityID', p_RelatedEntityID_2b23c67fd8bf,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_2b23c67fd8bf,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_2b23c67fd8bf,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_2b23c67fd8bf,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_2b23c67fd8bf,
    'EntityIDFieldName', p_EntityIDFieldName_2b23c67fd8bf,
    'ScopeDefault', p_ScopeDefault_2b23c67fd8bf,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_2b23c67fd8bf,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_2b23c67fd8bf,
    'Status', p_Status_2b23c67fd8bf,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_2b23c67fd8bf,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_2b23c67fd8bf,
    'AutoUpdateCategory', p_AutoUpdateCategory_2b23c67fd8bf,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_2b23c67fd8bf,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_2b23c67fd8bf,
    'Encrypt', p_Encrypt_2b23c67fd8bf,
    'EncryptionKeyID', p_EncryptionKeyID_2b23c67fd8bf,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_2b23c67fd8bf,
    'SendEncryptedValue', p_SendEncryptedValue_2b23c67fd8bf,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_2b23c67fd8bf,
    'IsSoftForeignKey', p_IsSoftForeignKey_2b23c67fd8bf,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_2b23c67fd8bf,
    'JSONType', p_JSONType_2b23c67fd8bf,
    'JSONTypeIsArray', p_JSONTypeIsArray_2b23c67fd8bf,
    'JSONTypeDefinition', p_JSONTypeDefinition_2b23c67fd8bf,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_2b23c67fd8bf,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_2b23c67fd8bf,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_2b23c67fd8bf,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_2b23c67fd8bf,
    'IsComputed', p_IsComputed_2b23c67fd8bf
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_2b23c67fd8bf,
    'Configuration', p_Configuration_2b23c67fd8bf,
    'ID', p_ID_2b23c67fd8bf
  ));
  ELSE
    PERFORM ${mjSchema}."spUpdateEntityField"(p_DisplayName := p_DisplayName_2b23c67fd8bf, p_Description := p_Description_2b23c67fd8bf, p_AutoUpdateDescription := p_AutoUpdateDescription_2b23c67fd8bf, p_IsPrimaryKey := p_IsPrimaryKey_2b23c67fd8bf, p_IsUnique := p_IsUnique_2b23c67fd8bf, p_Category := p_Category_2b23c67fd8bf, p_ValueListType := p_ValueListType_2b23c67fd8bf, p_ExtendedType := p_ExtendedType_2b23c67fd8bf, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_2b23c67fd8bf, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_2b23c67fd8bf, p_ViewCellTemplate := p_ViewCellTemplate_2b23c67fd8bf, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_2b23c67fd8bf, p_AllowUpdateAPI := p_AllowUpdateAPI_2b23c67fd8bf, p_AllowUpdateInView := p_AllowUpdateInView_2b23c67fd8bf, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_2b23c67fd8bf, p_FullTextSearchEnabled := p_FullTextSearchEnabled_2b23c67fd8bf, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_2b23c67fd8bf, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_2b23c67fd8bf, p_GeneratedFormSection := p_GeneratedFormSection_2b23c67fd8bf, p_IsNameField := p_IsNameField_2b23c67fd8bf, p_RelatedEntityID := p_RelatedEntityID_2b23c67fd8bf, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_2b23c67fd8bf, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_2b23c67fd8bf, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_2b23c67fd8bf, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_2b23c67fd8bf, p_EntityIDFieldName := p_EntityIDFieldName_2b23c67fd8bf, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_2b23c67fd8bf, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_2b23c67fd8bf, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_2b23c67fd8bf, p_Status := p_Status_2b23c67fd8bf, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_2b23c67fd8bf, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_2b23c67fd8bf, p_AutoUpdateCategory := p_AutoUpdateCategory_2b23c67fd8bf, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_2b23c67fd8bf, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_2b23c67fd8bf, p_Encrypt := p_Encrypt_2b23c67fd8bf, p_EncryptionKeyID := p_EncryptionKeyID_2b23c67fd8bf, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_2b23c67fd8bf, p_SendEncryptedValue := p_SendEncryptedValue_2b23c67fd8bf, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_2b23c67fd8bf, p_IsSoftForeignKey := p_IsSoftForeignKey_2b23c67fd8bf, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_2b23c67fd8bf, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_2b23c67fd8bf, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_2b23c67fd8bf, p_JSONTypeDefinition := p_JSONTypeDefinition_2b23c67fd8bf, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_2b23c67fd8bf, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_2b23c67fd8bf, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_2b23c67fd8bf, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_2b23c67fd8bf, p_IsComputed := p_IsComputed_2b23c67fd8bf, p_EmbeddedRecord := p_EmbeddedRecord_2b23c67fd8bf, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_2b23c67fd8bf, p_Configuration_Clear := TRUE, p_ID := p_ID_2b23c67fd8bf);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_e2a19599c763 VARCHAR(255);
  p_Description_e2a19599c763 TEXT;
  p_AutoUpdateDescription_e2a19599c763 BOOLEAN;
  p_IsPrimaryKey_e2a19599c763 BOOLEAN;
  p_IsUnique_e2a19599c763 BOOLEAN;
  p_Category_e2a19599c763 VARCHAR(255);
  p_ValueListType_e2a19599c763 VARCHAR(20);
  p_ExtendedType_e2a19599c763 VARCHAR(50);
  p_CodeType_e2a19599c763 VARCHAR(50);
  p_DefaultInView_e2a19599c763 BOOLEAN;
  p_ViewCellTemplate_e2a19599c763 TEXT;
  p_DefaultColumnWidth_e2a19599c763 INTEGER;
  p_AllowUpdateAPI_e2a19599c763 BOOLEAN;
  p_AllowUpdateInView_e2a19599c763 BOOLEAN;
  p_IncludeInUserSearchAPI_e2a19599c763 BOOLEAN;
  p_FullTextSearchEnabled_e2a19599c763 BOOLEAN;
  p_UserSearchParamFormatAPI_e2a19599c763 VARCHAR(500);
  p_IncludeInGeneratedForm_e2a19599c763 BOOLEAN;
  p_GeneratedFormSection_e2a19599c763 VARCHAR(10);
  p_IsNameField_e2a19599c763 BOOLEAN;
  p_RelatedEntityID_e2a19599c763 UUID;
  p_RelatedEntityFieldName_e2a19599c763 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_e2a19599c763 BOOLEAN;
  p_RelatedEntityNameFieldMap_e2a19599c763 VARCHAR(255);
  p_RelatedEntityDisplayType_e2a19599c763 VARCHAR(20);
  p_EntityIDFieldName_e2a19599c763 VARCHAR(100);
  p_ScopeDefault_e2a19599c763 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_e2a19599c763 BOOLEAN;
  p_ValuesToPackWithSchema_e2a19599c763 VARCHAR(10);
  p_Status_e2a19599c763 VARCHAR(25);
  p_AutoUpdateIsNameField_e2a19599c763 BOOLEAN;
  p_AutoUpdateDefaultInView_e2a19599c763 BOOLEAN;
  p_AutoUpdateCategory_e2a19599c763 BOOLEAN;
  p_AutoUpdateDisplayName_e2a19599c763 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_e2a19599c763 BOOLEAN;
  p_Encrypt_e2a19599c763 BOOLEAN;
  p_EncryptionKeyID_e2a19599c763 UUID;
  p_AllowDecryptInAPI_e2a19599c763 BOOLEAN;
  p_SendEncryptedValue_e2a19599c763 BOOLEAN;
  p_IsSoftPrimaryKey_e2a19599c763 BOOLEAN;
  p_IsSoftForeignKey_e2a19599c763 BOOLEAN;
  p_RelatedEntityJoinFields_e2a19599c763 TEXT;
  p_JSONType_e2a19599c763 VARCHAR(255);
  p_JSONTypeIsArray_e2a19599c763 BOOLEAN;
  p_JSONTypeDefinition_e2a19599c763 TEXT;
  p_UserSearchPredicateAPI_e2a19599c763 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_e2a19599c763 BOOLEAN;
  p_AutoUpdateFullTextSearch_e2a19599c763 BOOLEAN;
  p_AutoUpdateExtendedType_e2a19599c763 BOOLEAN;
  p_IsComputed_e2a19599c763 BOOLEAN;
  p_EmbeddedRecord_e2a19599c763 TEXT;
  p_Configuration_e2a19599c763 TEXT;
  p_ID_e2a19599c763 UUID;
BEGIN
  p_DisplayName_e2a19599c763 := 'Parent Tax Jurisdiction ID Depth';
  p_AutoUpdateDescription_e2a19599c763 := TRUE;
  p_IsPrimaryKey_e2a19599c763 := FALSE;
  p_IsUnique_e2a19599c763 := FALSE;
  p_Category_e2a19599c763 := 'Jurisdiction Hierarchy';
  p_ValueListType_e2a19599c763 := 'None';
  p_DefaultInView_e2a19599c763 := FALSE;
  p_DefaultColumnWidth_e2a19599c763 := 50;
  p_AllowUpdateAPI_e2a19599c763 := FALSE;
  p_AllowUpdateInView_e2a19599c763 := TRUE;
  p_IncludeInUserSearchAPI_e2a19599c763 := FALSE;
  p_FullTextSearchEnabled_e2a19599c763 := FALSE;
  p_IncludeInGeneratedForm_e2a19599c763 := TRUE;
  p_GeneratedFormSection_e2a19599c763 := 'Category';
  p_IsNameField_e2a19599c763 := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_e2a19599c763 := FALSE;
  p_RelatedEntityDisplayType_e2a19599c763 := 'Search';
  p_AutoUpdateRelatedEntityInfo_e2a19599c763 := TRUE;
  p_ValuesToPackWithSchema_e2a19599c763 := 'Auto';
  p_Status_e2a19599c763 := 'Active';
  p_AutoUpdateIsNameField_e2a19599c763 := TRUE;
  p_AutoUpdateDefaultInView_e2a19599c763 := TRUE;
  p_AutoUpdateCategory_e2a19599c763 := TRUE;
  p_AutoUpdateDisplayName_e2a19599c763 := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_e2a19599c763 := TRUE;
  p_Encrypt_e2a19599c763 := FALSE;
  p_AllowDecryptInAPI_e2a19599c763 := FALSE;
  p_SendEncryptedValue_e2a19599c763 := FALSE;
  p_IsSoftPrimaryKey_e2a19599c763 := FALSE;
  p_IsSoftForeignKey_e2a19599c763 := FALSE;
  p_JSONTypeIsArray_e2a19599c763 := FALSE;
  p_UserSearchPredicateAPI_e2a19599c763 := 'Contains';
  p_AutoUpdateUserSearchPredicate_e2a19599c763 := TRUE;
  p_AutoUpdateFullTextSearch_e2a19599c763 := TRUE;
  p_AutoUpdateExtendedType_e2a19599c763 := TRUE;
  p_IsComputed_e2a19599c763 := FALSE;
  p_ID_e2a19599c763 := '8FEE9125-81FF-44B5-AC90-BF2D9781CCD7';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM ${mjSchema}."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_e2a19599c763,
    'Description', p_Description_e2a19599c763,
    'AutoUpdateDescription', p_AutoUpdateDescription_e2a19599c763,
    'IsPrimaryKey', p_IsPrimaryKey_e2a19599c763,
    'IsUnique', p_IsUnique_e2a19599c763,
    'Category', p_Category_e2a19599c763,
    'ValueListType', p_ValueListType_e2a19599c763,
    'ExtendedType', p_ExtendedType_e2a19599c763,
    'CodeType', p_CodeType_e2a19599c763,
    'DefaultInView', p_DefaultInView_e2a19599c763,
    'ViewCellTemplate', p_ViewCellTemplate_e2a19599c763,
    'DefaultColumnWidth', p_DefaultColumnWidth_e2a19599c763,
    'AllowUpdateAPI', p_AllowUpdateAPI_e2a19599c763,
    'AllowUpdateInView', p_AllowUpdateInView_e2a19599c763,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_e2a19599c763,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_e2a19599c763,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_e2a19599c763,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_e2a19599c763,
    'GeneratedFormSection', p_GeneratedFormSection_e2a19599c763,
    'IsNameField', p_IsNameField_e2a19599c763,
    'RelatedEntityID', p_RelatedEntityID_e2a19599c763,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_e2a19599c763,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_e2a19599c763,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_e2a19599c763,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_e2a19599c763,
    'EntityIDFieldName', p_EntityIDFieldName_e2a19599c763,
    'ScopeDefault', p_ScopeDefault_e2a19599c763,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_e2a19599c763,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_e2a19599c763,
    'Status', p_Status_e2a19599c763,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_e2a19599c763,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_e2a19599c763,
    'AutoUpdateCategory', p_AutoUpdateCategory_e2a19599c763,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_e2a19599c763,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_e2a19599c763,
    'Encrypt', p_Encrypt_e2a19599c763,
    'EncryptionKeyID', p_EncryptionKeyID_e2a19599c763,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_e2a19599c763,
    'SendEncryptedValue', p_SendEncryptedValue_e2a19599c763,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_e2a19599c763,
    'IsSoftForeignKey', p_IsSoftForeignKey_e2a19599c763,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_e2a19599c763,
    'JSONType', p_JSONType_e2a19599c763,
    'JSONTypeIsArray', p_JSONTypeIsArray_e2a19599c763,
    'JSONTypeDefinition', p_JSONTypeDefinition_e2a19599c763,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_e2a19599c763,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_e2a19599c763,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_e2a19599c763,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_e2a19599c763,
    'IsComputed', p_IsComputed_e2a19599c763
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_e2a19599c763,
    'Configuration', p_Configuration_e2a19599c763,
    'ID', p_ID_e2a19599c763
  ));
  ELSE
    PERFORM ${mjSchema}."spUpdateEntityField"(p_DisplayName := p_DisplayName_e2a19599c763, p_Description := p_Description_e2a19599c763, p_Description_Clear := TRUE, p_AutoUpdateDescription := p_AutoUpdateDescription_e2a19599c763, p_IsPrimaryKey := p_IsPrimaryKey_e2a19599c763, p_IsUnique := p_IsUnique_e2a19599c763, p_Category := p_Category_e2a19599c763, p_ValueListType := p_ValueListType_e2a19599c763, p_ExtendedType := p_ExtendedType_e2a19599c763, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_e2a19599c763, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_e2a19599c763, p_ViewCellTemplate := p_ViewCellTemplate_e2a19599c763, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_e2a19599c763, p_AllowUpdateAPI := p_AllowUpdateAPI_e2a19599c763, p_AllowUpdateInView := p_AllowUpdateInView_e2a19599c763, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_e2a19599c763, p_FullTextSearchEnabled := p_FullTextSearchEnabled_e2a19599c763, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_e2a19599c763, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_e2a19599c763, p_GeneratedFormSection := p_GeneratedFormSection_e2a19599c763, p_IsNameField := p_IsNameField_e2a19599c763, p_RelatedEntityID := p_RelatedEntityID_e2a19599c763, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_e2a19599c763, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_e2a19599c763, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_e2a19599c763, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_e2a19599c763, p_EntityIDFieldName := p_EntityIDFieldName_e2a19599c763, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_e2a19599c763, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_e2a19599c763, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_e2a19599c763, p_Status := p_Status_e2a19599c763, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_e2a19599c763, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_e2a19599c763, p_AutoUpdateCategory := p_AutoUpdateCategory_e2a19599c763, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_e2a19599c763, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_e2a19599c763, p_Encrypt := p_Encrypt_e2a19599c763, p_EncryptionKeyID := p_EncryptionKeyID_e2a19599c763, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_e2a19599c763, p_SendEncryptedValue := p_SendEncryptedValue_e2a19599c763, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_e2a19599c763, p_IsSoftForeignKey := p_IsSoftForeignKey_e2a19599c763, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_e2a19599c763, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_e2a19599c763, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_e2a19599c763, p_JSONTypeDefinition := p_JSONTypeDefinition_e2a19599c763, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_e2a19599c763, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_e2a19599c763, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_e2a19599c763, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_e2a19599c763, p_IsComputed := p_IsComputed_e2a19599c763, p_EmbeddedRecord := p_EmbeddedRecord_e2a19599c763, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_e2a19599c763, p_Configuration_Clear := TRUE, p_ID := p_ID_e2a19599c763);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_ca59c067e157 VARCHAR(255);
  p_Description_ca59c067e157 TEXT;
  p_AutoUpdateDescription_ca59c067e157 BOOLEAN;
  p_IsPrimaryKey_ca59c067e157 BOOLEAN;
  p_IsUnique_ca59c067e157 BOOLEAN;
  p_Category_ca59c067e157 VARCHAR(255);
  p_ValueListType_ca59c067e157 VARCHAR(20);
  p_ExtendedType_ca59c067e157 VARCHAR(50);
  p_CodeType_ca59c067e157 VARCHAR(50);
  p_DefaultInView_ca59c067e157 BOOLEAN;
  p_ViewCellTemplate_ca59c067e157 TEXT;
  p_DefaultColumnWidth_ca59c067e157 INTEGER;
  p_AllowUpdateAPI_ca59c067e157 BOOLEAN;
  p_AllowUpdateInView_ca59c067e157 BOOLEAN;
  p_IncludeInUserSearchAPI_ca59c067e157 BOOLEAN;
  p_FullTextSearchEnabled_ca59c067e157 BOOLEAN;
  p_UserSearchParamFormatAPI_ca59c067e157 VARCHAR(500);
  p_IncludeInGeneratedForm_ca59c067e157 BOOLEAN;
  p_GeneratedFormSection_ca59c067e157 VARCHAR(10);
  p_IsNameField_ca59c067e157 BOOLEAN;
  p_RelatedEntityID_ca59c067e157 UUID;
  p_RelatedEntityFieldName_ca59c067e157 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_ca59c067e157 BOOLEAN;
  p_RelatedEntityNameFieldMap_ca59c067e157 VARCHAR(255);
  p_RelatedEntityDisplayType_ca59c067e157 VARCHAR(20);
  p_EntityIDFieldName_ca59c067e157 VARCHAR(100);
  p_ScopeDefault_ca59c067e157 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_ca59c067e157 BOOLEAN;
  p_ValuesToPackWithSchema_ca59c067e157 VARCHAR(10);
  p_Status_ca59c067e157 VARCHAR(25);
  p_AutoUpdateIsNameField_ca59c067e157 BOOLEAN;
  p_AutoUpdateDefaultInView_ca59c067e157 BOOLEAN;
  p_AutoUpdateCategory_ca59c067e157 BOOLEAN;
  p_AutoUpdateDisplayName_ca59c067e157 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_ca59c067e157 BOOLEAN;
  p_Encrypt_ca59c067e157 BOOLEAN;
  p_EncryptionKeyID_ca59c067e157 UUID;
  p_AllowDecryptInAPI_ca59c067e157 BOOLEAN;
  p_SendEncryptedValue_ca59c067e157 BOOLEAN;
  p_IsSoftPrimaryKey_ca59c067e157 BOOLEAN;
  p_IsSoftForeignKey_ca59c067e157 BOOLEAN;
  p_RelatedEntityJoinFields_ca59c067e157 TEXT;
  p_JSONType_ca59c067e157 VARCHAR(255);
  p_JSONTypeIsArray_ca59c067e157 BOOLEAN;
  p_JSONTypeDefinition_ca59c067e157 TEXT;
  p_UserSearchPredicateAPI_ca59c067e157 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_ca59c067e157 BOOLEAN;
  p_AutoUpdateFullTextSearch_ca59c067e157 BOOLEAN;
  p_AutoUpdateExtendedType_ca59c067e157 BOOLEAN;
  p_IsComputed_ca59c067e157 BOOLEAN;
  p_EmbeddedRecord_ca59c067e157 TEXT;
  p_Configuration_ca59c067e157 TEXT;
  p_ID_ca59c067e157 UUID;
BEGIN
  p_DisplayName_ca59c067e157 := 'Parent Tax Jurisdiction ID Path';
  p_AutoUpdateDescription_ca59c067e157 := TRUE;
  p_IsPrimaryKey_ca59c067e157 := FALSE;
  p_IsUnique_ca59c067e157 := FALSE;
  p_Category_ca59c067e157 := 'Jurisdiction Hierarchy';
  p_ValueListType_ca59c067e157 := 'None';
  p_DefaultInView_ca59c067e157 := FALSE;
  p_DefaultColumnWidth_ca59c067e157 := 150;
  p_AllowUpdateAPI_ca59c067e157 := FALSE;
  p_AllowUpdateInView_ca59c067e157 := TRUE;
  p_IncludeInUserSearchAPI_ca59c067e157 := FALSE;
  p_FullTextSearchEnabled_ca59c067e157 := FALSE;
  p_IncludeInGeneratedForm_ca59c067e157 := TRUE;
  p_GeneratedFormSection_ca59c067e157 := 'Category';
  p_IsNameField_ca59c067e157 := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_ca59c067e157 := FALSE;
  p_RelatedEntityDisplayType_ca59c067e157 := 'Search';
  p_AutoUpdateRelatedEntityInfo_ca59c067e157 := TRUE;
  p_ValuesToPackWithSchema_ca59c067e157 := 'Auto';
  p_Status_ca59c067e157 := 'Active';
  p_AutoUpdateIsNameField_ca59c067e157 := TRUE;
  p_AutoUpdateDefaultInView_ca59c067e157 := TRUE;
  p_AutoUpdateCategory_ca59c067e157 := TRUE;
  p_AutoUpdateDisplayName_ca59c067e157 := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_ca59c067e157 := TRUE;
  p_Encrypt_ca59c067e157 := FALSE;
  p_AllowDecryptInAPI_ca59c067e157 := FALSE;
  p_SendEncryptedValue_ca59c067e157 := FALSE;
  p_IsSoftPrimaryKey_ca59c067e157 := FALSE;
  p_IsSoftForeignKey_ca59c067e157 := FALSE;
  p_JSONTypeIsArray_ca59c067e157 := FALSE;
  p_UserSearchPredicateAPI_ca59c067e157 := 'Contains';
  p_AutoUpdateUserSearchPredicate_ca59c067e157 := TRUE;
  p_AutoUpdateFullTextSearch_ca59c067e157 := TRUE;
  p_AutoUpdateExtendedType_ca59c067e157 := TRUE;
  p_IsComputed_ca59c067e157 := FALSE;
  p_ID_ca59c067e157 := '1A586DE9-8EEC-48C2-92D4-B6825DB438F5';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM ${mjSchema}."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_ca59c067e157,
    'Description', p_Description_ca59c067e157,
    'AutoUpdateDescription', p_AutoUpdateDescription_ca59c067e157,
    'IsPrimaryKey', p_IsPrimaryKey_ca59c067e157,
    'IsUnique', p_IsUnique_ca59c067e157,
    'Category', p_Category_ca59c067e157,
    'ValueListType', p_ValueListType_ca59c067e157,
    'ExtendedType', p_ExtendedType_ca59c067e157,
    'CodeType', p_CodeType_ca59c067e157,
    'DefaultInView', p_DefaultInView_ca59c067e157,
    'ViewCellTemplate', p_ViewCellTemplate_ca59c067e157,
    'DefaultColumnWidth', p_DefaultColumnWidth_ca59c067e157,
    'AllowUpdateAPI', p_AllowUpdateAPI_ca59c067e157,
    'AllowUpdateInView', p_AllowUpdateInView_ca59c067e157,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_ca59c067e157,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_ca59c067e157,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_ca59c067e157,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_ca59c067e157,
    'GeneratedFormSection', p_GeneratedFormSection_ca59c067e157,
    'IsNameField', p_IsNameField_ca59c067e157,
    'RelatedEntityID', p_RelatedEntityID_ca59c067e157,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_ca59c067e157,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_ca59c067e157,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_ca59c067e157,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_ca59c067e157,
    'EntityIDFieldName', p_EntityIDFieldName_ca59c067e157,
    'ScopeDefault', p_ScopeDefault_ca59c067e157,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_ca59c067e157,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_ca59c067e157,
    'Status', p_Status_ca59c067e157,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_ca59c067e157,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_ca59c067e157,
    'AutoUpdateCategory', p_AutoUpdateCategory_ca59c067e157,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_ca59c067e157,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_ca59c067e157,
    'Encrypt', p_Encrypt_ca59c067e157,
    'EncryptionKeyID', p_EncryptionKeyID_ca59c067e157,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_ca59c067e157,
    'SendEncryptedValue', p_SendEncryptedValue_ca59c067e157,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_ca59c067e157,
    'IsSoftForeignKey', p_IsSoftForeignKey_ca59c067e157,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_ca59c067e157,
    'JSONType', p_JSONType_ca59c067e157,
    'JSONTypeIsArray', p_JSONTypeIsArray_ca59c067e157,
    'JSONTypeDefinition', p_JSONTypeDefinition_ca59c067e157,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_ca59c067e157,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_ca59c067e157,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_ca59c067e157,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_ca59c067e157,
    'IsComputed', p_IsComputed_ca59c067e157
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_ca59c067e157,
    'Configuration', p_Configuration_ca59c067e157,
    'ID', p_ID_ca59c067e157
  ));
  ELSE
    PERFORM ${mjSchema}."spUpdateEntityField"(p_DisplayName := p_DisplayName_ca59c067e157, p_Description := p_Description_ca59c067e157, p_Description_Clear := TRUE, p_AutoUpdateDescription := p_AutoUpdateDescription_ca59c067e157, p_IsPrimaryKey := p_IsPrimaryKey_ca59c067e157, p_IsUnique := p_IsUnique_ca59c067e157, p_Category := p_Category_ca59c067e157, p_ValueListType := p_ValueListType_ca59c067e157, p_ExtendedType := p_ExtendedType_ca59c067e157, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_ca59c067e157, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_ca59c067e157, p_ViewCellTemplate := p_ViewCellTemplate_ca59c067e157, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_ca59c067e157, p_AllowUpdateAPI := p_AllowUpdateAPI_ca59c067e157, p_AllowUpdateInView := p_AllowUpdateInView_ca59c067e157, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_ca59c067e157, p_FullTextSearchEnabled := p_FullTextSearchEnabled_ca59c067e157, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_ca59c067e157, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_ca59c067e157, p_GeneratedFormSection := p_GeneratedFormSection_ca59c067e157, p_IsNameField := p_IsNameField_ca59c067e157, p_RelatedEntityID := p_RelatedEntityID_ca59c067e157, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_ca59c067e157, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_ca59c067e157, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_ca59c067e157, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_ca59c067e157, p_EntityIDFieldName := p_EntityIDFieldName_ca59c067e157, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_ca59c067e157, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_ca59c067e157, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_ca59c067e157, p_Status := p_Status_ca59c067e157, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_ca59c067e157, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_ca59c067e157, p_AutoUpdateCategory := p_AutoUpdateCategory_ca59c067e157, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_ca59c067e157, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_ca59c067e157, p_Encrypt := p_Encrypt_ca59c067e157, p_EncryptionKeyID := p_EncryptionKeyID_ca59c067e157, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_ca59c067e157, p_SendEncryptedValue := p_SendEncryptedValue_ca59c067e157, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_ca59c067e157, p_IsSoftForeignKey := p_IsSoftForeignKey_ca59c067e157, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_ca59c067e157, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_ca59c067e157, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_ca59c067e157, p_JSONTypeDefinition := p_JSONTypeDefinition_ca59c067e157, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_ca59c067e157, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_ca59c067e157, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_ca59c067e157, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_ca59c067e157, p_IsComputed := p_IsComputed_ca59c067e157, p_EmbeddedRecord := p_EmbeddedRecord_ca59c067e157, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_ca59c067e157, p_Configuration_Clear := TRUE, p_ID := p_ID_ca59c067e157);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_33aa98bb5f73 VARCHAR(255);
  p_Description_33aa98bb5f73 TEXT;
  p_AutoUpdateDescription_33aa98bb5f73 BOOLEAN;
  p_IsPrimaryKey_33aa98bb5f73 BOOLEAN;
  p_IsUnique_33aa98bb5f73 BOOLEAN;
  p_Category_33aa98bb5f73 VARCHAR(255);
  p_ValueListType_33aa98bb5f73 VARCHAR(20);
  p_ExtendedType_33aa98bb5f73 VARCHAR(50);
  p_CodeType_33aa98bb5f73 VARCHAR(50);
  p_DefaultInView_33aa98bb5f73 BOOLEAN;
  p_ViewCellTemplate_33aa98bb5f73 TEXT;
  p_DefaultColumnWidth_33aa98bb5f73 INTEGER;
  p_AllowUpdateAPI_33aa98bb5f73 BOOLEAN;
  p_AllowUpdateInView_33aa98bb5f73 BOOLEAN;
  p_IncludeInUserSearchAPI_33aa98bb5f73 BOOLEAN;
  p_FullTextSearchEnabled_33aa98bb5f73 BOOLEAN;
  p_UserSearchParamFormatAPI_33aa98bb5f73 VARCHAR(500);
  p_IncludeInGeneratedForm_33aa98bb5f73 BOOLEAN;
  p_GeneratedFormSection_33aa98bb5f73 VARCHAR(10);
  p_IsNameField_33aa98bb5f73 BOOLEAN;
  p_RelatedEntityID_33aa98bb5f73 UUID;
  p_RelatedEntityFieldName_33aa98bb5f73 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_33aa98bb5f73 BOOLEAN;
  p_RelatedEntityNameFieldMap_33aa98bb5f73 VARCHAR(255);
  p_RelatedEntityDisplayType_33aa98bb5f73 VARCHAR(20);
  p_EntityIDFieldName_33aa98bb5f73 VARCHAR(100);
  p_ScopeDefault_33aa98bb5f73 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_33aa98bb5f73 BOOLEAN;
  p_ValuesToPackWithSchema_33aa98bb5f73 VARCHAR(10);
  p_Status_33aa98bb5f73 VARCHAR(25);
  p_AutoUpdateIsNameField_33aa98bb5f73 BOOLEAN;
  p_AutoUpdateDefaultInView_33aa98bb5f73 BOOLEAN;
  p_AutoUpdateCategory_33aa98bb5f73 BOOLEAN;
  p_AutoUpdateDisplayName_33aa98bb5f73 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_33aa98bb5f73 BOOLEAN;
  p_Encrypt_33aa98bb5f73 BOOLEAN;
  p_EncryptionKeyID_33aa98bb5f73 UUID;
  p_AllowDecryptInAPI_33aa98bb5f73 BOOLEAN;
  p_SendEncryptedValue_33aa98bb5f73 BOOLEAN;
  p_IsSoftPrimaryKey_33aa98bb5f73 BOOLEAN;
  p_IsSoftForeignKey_33aa98bb5f73 BOOLEAN;
  p_RelatedEntityJoinFields_33aa98bb5f73 TEXT;
  p_JSONType_33aa98bb5f73 VARCHAR(255);
  p_JSONTypeIsArray_33aa98bb5f73 BOOLEAN;
  p_JSONTypeDefinition_33aa98bb5f73 TEXT;
  p_UserSearchPredicateAPI_33aa98bb5f73 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_33aa98bb5f73 BOOLEAN;
  p_AutoUpdateFullTextSearch_33aa98bb5f73 BOOLEAN;
  p_AutoUpdateExtendedType_33aa98bb5f73 BOOLEAN;
  p_IsComputed_33aa98bb5f73 BOOLEAN;
  p_EmbeddedRecord_33aa98bb5f73 TEXT;
  p_Configuration_33aa98bb5f73 TEXT;
  p_ID_33aa98bb5f73 UUID;
BEGIN
  p_DisplayName_33aa98bb5f73 := 'Parent Tax Jurisdiction ID Is Leaf';
  p_AutoUpdateDescription_33aa98bb5f73 := TRUE;
  p_IsPrimaryKey_33aa98bb5f73 := FALSE;
  p_IsUnique_33aa98bb5f73 := FALSE;
  p_Category_33aa98bb5f73 := 'Jurisdiction Hierarchy';
  p_ValueListType_33aa98bb5f73 := 'None';
  p_DefaultInView_33aa98bb5f73 := FALSE;
  p_DefaultColumnWidth_33aa98bb5f73 := 150;
  p_AllowUpdateAPI_33aa98bb5f73 := FALSE;
  p_AllowUpdateInView_33aa98bb5f73 := TRUE;
  p_IncludeInUserSearchAPI_33aa98bb5f73 := FALSE;
  p_FullTextSearchEnabled_33aa98bb5f73 := FALSE;
  p_IncludeInGeneratedForm_33aa98bb5f73 := TRUE;
  p_GeneratedFormSection_33aa98bb5f73 := 'Category';
  p_IsNameField_33aa98bb5f73 := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_33aa98bb5f73 := FALSE;
  p_RelatedEntityDisplayType_33aa98bb5f73 := 'Search';
  p_AutoUpdateRelatedEntityInfo_33aa98bb5f73 := TRUE;
  p_ValuesToPackWithSchema_33aa98bb5f73 := 'Auto';
  p_Status_33aa98bb5f73 := 'Active';
  p_AutoUpdateIsNameField_33aa98bb5f73 := TRUE;
  p_AutoUpdateDefaultInView_33aa98bb5f73 := TRUE;
  p_AutoUpdateCategory_33aa98bb5f73 := TRUE;
  p_AutoUpdateDisplayName_33aa98bb5f73 := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_33aa98bb5f73 := TRUE;
  p_Encrypt_33aa98bb5f73 := FALSE;
  p_AllowDecryptInAPI_33aa98bb5f73 := FALSE;
  p_SendEncryptedValue_33aa98bb5f73 := FALSE;
  p_IsSoftPrimaryKey_33aa98bb5f73 := FALSE;
  p_IsSoftForeignKey_33aa98bb5f73 := FALSE;
  p_JSONTypeIsArray_33aa98bb5f73 := FALSE;
  p_UserSearchPredicateAPI_33aa98bb5f73 := 'Contains';
  p_AutoUpdateUserSearchPredicate_33aa98bb5f73 := TRUE;
  p_AutoUpdateFullTextSearch_33aa98bb5f73 := TRUE;
  p_AutoUpdateExtendedType_33aa98bb5f73 := TRUE;
  p_IsComputed_33aa98bb5f73 := FALSE;
  p_ID_33aa98bb5f73 := 'E7051D11-FAE8-4B93-9857-6340067CB63F';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM ${mjSchema}."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_33aa98bb5f73,
    'Description', p_Description_33aa98bb5f73,
    'AutoUpdateDescription', p_AutoUpdateDescription_33aa98bb5f73,
    'IsPrimaryKey', p_IsPrimaryKey_33aa98bb5f73,
    'IsUnique', p_IsUnique_33aa98bb5f73,
    'Category', p_Category_33aa98bb5f73,
    'ValueListType', p_ValueListType_33aa98bb5f73,
    'ExtendedType', p_ExtendedType_33aa98bb5f73,
    'CodeType', p_CodeType_33aa98bb5f73,
    'DefaultInView', p_DefaultInView_33aa98bb5f73,
    'ViewCellTemplate', p_ViewCellTemplate_33aa98bb5f73,
    'DefaultColumnWidth', p_DefaultColumnWidth_33aa98bb5f73,
    'AllowUpdateAPI', p_AllowUpdateAPI_33aa98bb5f73,
    'AllowUpdateInView', p_AllowUpdateInView_33aa98bb5f73,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_33aa98bb5f73,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_33aa98bb5f73,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_33aa98bb5f73,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_33aa98bb5f73,
    'GeneratedFormSection', p_GeneratedFormSection_33aa98bb5f73,
    'IsNameField', p_IsNameField_33aa98bb5f73,
    'RelatedEntityID', p_RelatedEntityID_33aa98bb5f73,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_33aa98bb5f73,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_33aa98bb5f73,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_33aa98bb5f73,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_33aa98bb5f73,
    'EntityIDFieldName', p_EntityIDFieldName_33aa98bb5f73,
    'ScopeDefault', p_ScopeDefault_33aa98bb5f73,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_33aa98bb5f73,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_33aa98bb5f73,
    'Status', p_Status_33aa98bb5f73,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_33aa98bb5f73,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_33aa98bb5f73,
    'AutoUpdateCategory', p_AutoUpdateCategory_33aa98bb5f73,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_33aa98bb5f73,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_33aa98bb5f73,
    'Encrypt', p_Encrypt_33aa98bb5f73,
    'EncryptionKeyID', p_EncryptionKeyID_33aa98bb5f73,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_33aa98bb5f73,
    'SendEncryptedValue', p_SendEncryptedValue_33aa98bb5f73,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_33aa98bb5f73,
    'IsSoftForeignKey', p_IsSoftForeignKey_33aa98bb5f73,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_33aa98bb5f73,
    'JSONType', p_JSONType_33aa98bb5f73,
    'JSONTypeIsArray', p_JSONTypeIsArray_33aa98bb5f73,
    'JSONTypeDefinition', p_JSONTypeDefinition_33aa98bb5f73,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_33aa98bb5f73,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_33aa98bb5f73,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_33aa98bb5f73,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_33aa98bb5f73,
    'IsComputed', p_IsComputed_33aa98bb5f73
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_33aa98bb5f73,
    'Configuration', p_Configuration_33aa98bb5f73,
    'ID', p_ID_33aa98bb5f73
  ));
  ELSE
    PERFORM ${mjSchema}."spUpdateEntityField"(p_DisplayName := p_DisplayName_33aa98bb5f73, p_Description := p_Description_33aa98bb5f73, p_Description_Clear := TRUE, p_AutoUpdateDescription := p_AutoUpdateDescription_33aa98bb5f73, p_IsPrimaryKey := p_IsPrimaryKey_33aa98bb5f73, p_IsUnique := p_IsUnique_33aa98bb5f73, p_Category := p_Category_33aa98bb5f73, p_ValueListType := p_ValueListType_33aa98bb5f73, p_ExtendedType := p_ExtendedType_33aa98bb5f73, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_33aa98bb5f73, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_33aa98bb5f73, p_ViewCellTemplate := p_ViewCellTemplate_33aa98bb5f73, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_33aa98bb5f73, p_AllowUpdateAPI := p_AllowUpdateAPI_33aa98bb5f73, p_AllowUpdateInView := p_AllowUpdateInView_33aa98bb5f73, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_33aa98bb5f73, p_FullTextSearchEnabled := p_FullTextSearchEnabled_33aa98bb5f73, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_33aa98bb5f73, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_33aa98bb5f73, p_GeneratedFormSection := p_GeneratedFormSection_33aa98bb5f73, p_IsNameField := p_IsNameField_33aa98bb5f73, p_RelatedEntityID := p_RelatedEntityID_33aa98bb5f73, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_33aa98bb5f73, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_33aa98bb5f73, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_33aa98bb5f73, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_33aa98bb5f73, p_EntityIDFieldName := p_EntityIDFieldName_33aa98bb5f73, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_33aa98bb5f73, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_33aa98bb5f73, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_33aa98bb5f73, p_Status := p_Status_33aa98bb5f73, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_33aa98bb5f73, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_33aa98bb5f73, p_AutoUpdateCategory := p_AutoUpdateCategory_33aa98bb5f73, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_33aa98bb5f73, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_33aa98bb5f73, p_Encrypt := p_Encrypt_33aa98bb5f73, p_EncryptionKeyID := p_EncryptionKeyID_33aa98bb5f73, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_33aa98bb5f73, p_SendEncryptedValue := p_SendEncryptedValue_33aa98bb5f73, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_33aa98bb5f73, p_IsSoftForeignKey := p_IsSoftForeignKey_33aa98bb5f73, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_33aa98bb5f73, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_33aa98bb5f73, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_33aa98bb5f73, p_JSONTypeDefinition := p_JSONTypeDefinition_33aa98bb5f73, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_33aa98bb5f73, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_33aa98bb5f73, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_33aa98bb5f73, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_33aa98bb5f73, p_IsComputed := p_IsComputed_33aa98bb5f73, p_EmbeddedRecord := p_EmbeddedRecord_33aa98bb5f73, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_33aa98bb5f73, p_Configuration_Clear := TRUE, p_ID := p_ID_33aa98bb5f73);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_fbd29928258f VARCHAR(255);
  p_Description_fbd29928258f TEXT;
  p_AutoUpdateDescription_fbd29928258f BOOLEAN;
  p_IsPrimaryKey_fbd29928258f BOOLEAN;
  p_IsUnique_fbd29928258f BOOLEAN;
  p_Category_fbd29928258f VARCHAR(255);
  p_ValueListType_fbd29928258f VARCHAR(20);
  p_ExtendedType_fbd29928258f VARCHAR(50);
  p_CodeType_fbd29928258f VARCHAR(50);
  p_DefaultInView_fbd29928258f BOOLEAN;
  p_ViewCellTemplate_fbd29928258f TEXT;
  p_DefaultColumnWidth_fbd29928258f INTEGER;
  p_AllowUpdateAPI_fbd29928258f BOOLEAN;
  p_AllowUpdateInView_fbd29928258f BOOLEAN;
  p_IncludeInUserSearchAPI_fbd29928258f BOOLEAN;
  p_FullTextSearchEnabled_fbd29928258f BOOLEAN;
  p_UserSearchParamFormatAPI_fbd29928258f VARCHAR(500);
  p_IncludeInGeneratedForm_fbd29928258f BOOLEAN;
  p_GeneratedFormSection_fbd29928258f VARCHAR(10);
  p_IsNameField_fbd29928258f BOOLEAN;
  p_RelatedEntityID_fbd29928258f UUID;
  p_RelatedEntityFieldName_fbd29928258f VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_fbd29928258f BOOLEAN;
  p_RelatedEntityNameFieldMap_fbd29928258f VARCHAR(255);
  p_RelatedEntityDisplayType_fbd29928258f VARCHAR(20);
  p_EntityIDFieldName_fbd29928258f VARCHAR(100);
  p_ScopeDefault_fbd29928258f VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_fbd29928258f BOOLEAN;
  p_ValuesToPackWithSchema_fbd29928258f VARCHAR(10);
  p_Status_fbd29928258f VARCHAR(25);
  p_AutoUpdateIsNameField_fbd29928258f BOOLEAN;
  p_AutoUpdateDefaultInView_fbd29928258f BOOLEAN;
  p_AutoUpdateCategory_fbd29928258f BOOLEAN;
  p_AutoUpdateDisplayName_fbd29928258f BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_fbd29928258f BOOLEAN;
  p_Encrypt_fbd29928258f BOOLEAN;
  p_EncryptionKeyID_fbd29928258f UUID;
  p_AllowDecryptInAPI_fbd29928258f BOOLEAN;
  p_SendEncryptedValue_fbd29928258f BOOLEAN;
  p_IsSoftPrimaryKey_fbd29928258f BOOLEAN;
  p_IsSoftForeignKey_fbd29928258f BOOLEAN;
  p_RelatedEntityJoinFields_fbd29928258f TEXT;
  p_JSONType_fbd29928258f VARCHAR(255);
  p_JSONTypeIsArray_fbd29928258f BOOLEAN;
  p_JSONTypeDefinition_fbd29928258f TEXT;
  p_UserSearchPredicateAPI_fbd29928258f VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_fbd29928258f BOOLEAN;
  p_AutoUpdateFullTextSearch_fbd29928258f BOOLEAN;
  p_AutoUpdateExtendedType_fbd29928258f BOOLEAN;
  p_IsComputed_fbd29928258f BOOLEAN;
  p_EmbeddedRecord_fbd29928258f TEXT;
  p_Configuration_fbd29928258f TEXT;
  p_ID_fbd29928258f UUID;
BEGIN
  p_DisplayName_fbd29928258f := 'Parent Tax Jurisdiction ID Child Count';
  p_AutoUpdateDescription_fbd29928258f := TRUE;
  p_IsPrimaryKey_fbd29928258f := FALSE;
  p_IsUnique_fbd29928258f := FALSE;
  p_Category_fbd29928258f := 'Jurisdiction Hierarchy';
  p_ValueListType_fbd29928258f := 'None';
  p_DefaultInView_fbd29928258f := FALSE;
  p_DefaultColumnWidth_fbd29928258f := 50;
  p_AllowUpdateAPI_fbd29928258f := FALSE;
  p_AllowUpdateInView_fbd29928258f := TRUE;
  p_IncludeInUserSearchAPI_fbd29928258f := FALSE;
  p_FullTextSearchEnabled_fbd29928258f := FALSE;
  p_IncludeInGeneratedForm_fbd29928258f := TRUE;
  p_GeneratedFormSection_fbd29928258f := 'Category';
  p_IsNameField_fbd29928258f := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_fbd29928258f := FALSE;
  p_RelatedEntityDisplayType_fbd29928258f := 'Search';
  p_AutoUpdateRelatedEntityInfo_fbd29928258f := TRUE;
  p_ValuesToPackWithSchema_fbd29928258f := 'Auto';
  p_Status_fbd29928258f := 'Active';
  p_AutoUpdateIsNameField_fbd29928258f := TRUE;
  p_AutoUpdateDefaultInView_fbd29928258f := TRUE;
  p_AutoUpdateCategory_fbd29928258f := TRUE;
  p_AutoUpdateDisplayName_fbd29928258f := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_fbd29928258f := TRUE;
  p_Encrypt_fbd29928258f := FALSE;
  p_AllowDecryptInAPI_fbd29928258f := FALSE;
  p_SendEncryptedValue_fbd29928258f := FALSE;
  p_IsSoftPrimaryKey_fbd29928258f := FALSE;
  p_IsSoftForeignKey_fbd29928258f := FALSE;
  p_JSONTypeIsArray_fbd29928258f := FALSE;
  p_UserSearchPredicateAPI_fbd29928258f := 'Contains';
  p_AutoUpdateUserSearchPredicate_fbd29928258f := TRUE;
  p_AutoUpdateFullTextSearch_fbd29928258f := TRUE;
  p_AutoUpdateExtendedType_fbd29928258f := TRUE;
  p_IsComputed_fbd29928258f := FALSE;
  p_ID_fbd29928258f := '79866729-2528-43EE-8D33-8A0D41C50454';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM ${mjSchema}."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_fbd29928258f,
    'Description', p_Description_fbd29928258f,
    'AutoUpdateDescription', p_AutoUpdateDescription_fbd29928258f,
    'IsPrimaryKey', p_IsPrimaryKey_fbd29928258f,
    'IsUnique', p_IsUnique_fbd29928258f,
    'Category', p_Category_fbd29928258f,
    'ValueListType', p_ValueListType_fbd29928258f,
    'ExtendedType', p_ExtendedType_fbd29928258f,
    'CodeType', p_CodeType_fbd29928258f,
    'DefaultInView', p_DefaultInView_fbd29928258f,
    'ViewCellTemplate', p_ViewCellTemplate_fbd29928258f,
    'DefaultColumnWidth', p_DefaultColumnWidth_fbd29928258f,
    'AllowUpdateAPI', p_AllowUpdateAPI_fbd29928258f,
    'AllowUpdateInView', p_AllowUpdateInView_fbd29928258f,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_fbd29928258f,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_fbd29928258f,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_fbd29928258f,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_fbd29928258f,
    'GeneratedFormSection', p_GeneratedFormSection_fbd29928258f,
    'IsNameField', p_IsNameField_fbd29928258f,
    'RelatedEntityID', p_RelatedEntityID_fbd29928258f,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_fbd29928258f,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_fbd29928258f,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_fbd29928258f,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_fbd29928258f,
    'EntityIDFieldName', p_EntityIDFieldName_fbd29928258f,
    'ScopeDefault', p_ScopeDefault_fbd29928258f,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_fbd29928258f,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_fbd29928258f,
    'Status', p_Status_fbd29928258f,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_fbd29928258f,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_fbd29928258f,
    'AutoUpdateCategory', p_AutoUpdateCategory_fbd29928258f,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_fbd29928258f,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_fbd29928258f,
    'Encrypt', p_Encrypt_fbd29928258f,
    'EncryptionKeyID', p_EncryptionKeyID_fbd29928258f,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_fbd29928258f,
    'SendEncryptedValue', p_SendEncryptedValue_fbd29928258f,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_fbd29928258f,
    'IsSoftForeignKey', p_IsSoftForeignKey_fbd29928258f,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_fbd29928258f,
    'JSONType', p_JSONType_fbd29928258f,
    'JSONTypeIsArray', p_JSONTypeIsArray_fbd29928258f,
    'JSONTypeDefinition', p_JSONTypeDefinition_fbd29928258f,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_fbd29928258f,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_fbd29928258f,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_fbd29928258f,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_fbd29928258f,
    'IsComputed', p_IsComputed_fbd29928258f
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_fbd29928258f,
    'Configuration', p_Configuration_fbd29928258f,
    'ID', p_ID_fbd29928258f
  ));
  ELSE
    PERFORM ${mjSchema}."spUpdateEntityField"(p_DisplayName := p_DisplayName_fbd29928258f, p_Description := p_Description_fbd29928258f, p_Description_Clear := TRUE, p_AutoUpdateDescription := p_AutoUpdateDescription_fbd29928258f, p_IsPrimaryKey := p_IsPrimaryKey_fbd29928258f, p_IsUnique := p_IsUnique_fbd29928258f, p_Category := p_Category_fbd29928258f, p_ValueListType := p_ValueListType_fbd29928258f, p_ExtendedType := p_ExtendedType_fbd29928258f, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_fbd29928258f, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_fbd29928258f, p_ViewCellTemplate := p_ViewCellTemplate_fbd29928258f, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_fbd29928258f, p_AllowUpdateAPI := p_AllowUpdateAPI_fbd29928258f, p_AllowUpdateInView := p_AllowUpdateInView_fbd29928258f, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_fbd29928258f, p_FullTextSearchEnabled := p_FullTextSearchEnabled_fbd29928258f, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_fbd29928258f, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_fbd29928258f, p_GeneratedFormSection := p_GeneratedFormSection_fbd29928258f, p_IsNameField := p_IsNameField_fbd29928258f, p_RelatedEntityID := p_RelatedEntityID_fbd29928258f, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_fbd29928258f, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_fbd29928258f, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_fbd29928258f, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_fbd29928258f, p_EntityIDFieldName := p_EntityIDFieldName_fbd29928258f, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_fbd29928258f, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_fbd29928258f, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_fbd29928258f, p_Status := p_Status_fbd29928258f, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_fbd29928258f, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_fbd29928258f, p_AutoUpdateCategory := p_AutoUpdateCategory_fbd29928258f, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_fbd29928258f, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_fbd29928258f, p_Encrypt := p_Encrypt_fbd29928258f, p_EncryptionKeyID := p_EncryptionKeyID_fbd29928258f, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_fbd29928258f, p_SendEncryptedValue := p_SendEncryptedValue_fbd29928258f, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_fbd29928258f, p_IsSoftForeignKey := p_IsSoftForeignKey_fbd29928258f, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_fbd29928258f, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_fbd29928258f, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_fbd29928258f, p_JSONTypeDefinition := p_JSONTypeDefinition_fbd29928258f, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_fbd29928258f, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_fbd29928258f, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_fbd29928258f, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_fbd29928258f, p_IsComputed := p_IsComputed_fbd29928258f, p_EmbeddedRecord := p_EmbeddedRecord_fbd29928258f, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_fbd29928258f, p_Configuration_Clear := TRUE, p_ID := p_ID_fbd29928258f);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_2d157a61cd54 VARCHAR(255);
  p_Description_2d157a61cd54 TEXT;
  p_AutoUpdateDescription_2d157a61cd54 BOOLEAN;
  p_IsPrimaryKey_2d157a61cd54 BOOLEAN;
  p_IsUnique_2d157a61cd54 BOOLEAN;
  p_Category_2d157a61cd54 VARCHAR(255);
  p_ValueListType_2d157a61cd54 VARCHAR(20);
  p_ExtendedType_2d157a61cd54 VARCHAR(50);
  p_CodeType_2d157a61cd54 VARCHAR(50);
  p_DefaultInView_2d157a61cd54 BOOLEAN;
  p_ViewCellTemplate_2d157a61cd54 TEXT;
  p_DefaultColumnWidth_2d157a61cd54 INTEGER;
  p_AllowUpdateAPI_2d157a61cd54 BOOLEAN;
  p_AllowUpdateInView_2d157a61cd54 BOOLEAN;
  p_IncludeInUserSearchAPI_2d157a61cd54 BOOLEAN;
  p_FullTextSearchEnabled_2d157a61cd54 BOOLEAN;
  p_UserSearchParamFormatAPI_2d157a61cd54 VARCHAR(500);
  p_IncludeInGeneratedForm_2d157a61cd54 BOOLEAN;
  p_GeneratedFormSection_2d157a61cd54 VARCHAR(10);
  p_IsNameField_2d157a61cd54 BOOLEAN;
  p_RelatedEntityID_2d157a61cd54 UUID;
  p_RelatedEntityFieldName_2d157a61cd54 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_2d157a61cd54 BOOLEAN;
  p_RelatedEntityNameFieldMap_2d157a61cd54 VARCHAR(255);
  p_RelatedEntityDisplayType_2d157a61cd54 VARCHAR(20);
  p_EntityIDFieldName_2d157a61cd54 VARCHAR(100);
  p_ScopeDefault_2d157a61cd54 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_2d157a61cd54 BOOLEAN;
  p_ValuesToPackWithSchema_2d157a61cd54 VARCHAR(10);
  p_Status_2d157a61cd54 VARCHAR(25);
  p_AutoUpdateIsNameField_2d157a61cd54 BOOLEAN;
  p_AutoUpdateDefaultInView_2d157a61cd54 BOOLEAN;
  p_AutoUpdateCategory_2d157a61cd54 BOOLEAN;
  p_AutoUpdateDisplayName_2d157a61cd54 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_2d157a61cd54 BOOLEAN;
  p_Encrypt_2d157a61cd54 BOOLEAN;
  p_EncryptionKeyID_2d157a61cd54 UUID;
  p_AllowDecryptInAPI_2d157a61cd54 BOOLEAN;
  p_SendEncryptedValue_2d157a61cd54 BOOLEAN;
  p_IsSoftPrimaryKey_2d157a61cd54 BOOLEAN;
  p_IsSoftForeignKey_2d157a61cd54 BOOLEAN;
  p_RelatedEntityJoinFields_2d157a61cd54 TEXT;
  p_JSONType_2d157a61cd54 VARCHAR(255);
  p_JSONTypeIsArray_2d157a61cd54 BOOLEAN;
  p_JSONTypeDefinition_2d157a61cd54 TEXT;
  p_UserSearchPredicateAPI_2d157a61cd54 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_2d157a61cd54 BOOLEAN;
  p_AutoUpdateFullTextSearch_2d157a61cd54 BOOLEAN;
  p_AutoUpdateExtendedType_2d157a61cd54 BOOLEAN;
  p_IsComputed_2d157a61cd54 BOOLEAN;
  p_EmbeddedRecord_2d157a61cd54 TEXT;
  p_Configuration_2d157a61cd54 TEXT;
  p_ID_2d157a61cd54 UUID;
BEGIN
  p_DisplayName_2d157a61cd54 := 'Books Closed Through Date';
  p_Description_2d157a61cd54 := 'The last day of the latest month finance has closed for this company. A journal entry batch, progress measurement or correction dated on or before it is in a closed month. NULL means nothing is closed. Set by finance when a close finishes; moving it back reopens a month.';
  p_AutoUpdateDescription_2d157a61cd54 := TRUE;
  p_IsPrimaryKey_2d157a61cd54 := FALSE;
  p_IsUnique_2d157a61cd54 := FALSE;
  p_Category_2d157a61cd54 := 'Financial Settings';
  p_ValueListType_2d157a61cd54 := 'None';
  p_DefaultInView_2d157a61cd54 := FALSE;
  p_DefaultColumnWidth_2d157a61cd54 := 150;
  p_AllowUpdateAPI_2d157a61cd54 := TRUE;
  p_AllowUpdateInView_2d157a61cd54 := TRUE;
  p_IncludeInUserSearchAPI_2d157a61cd54 := FALSE;
  p_FullTextSearchEnabled_2d157a61cd54 := FALSE;
  p_IncludeInGeneratedForm_2d157a61cd54 := TRUE;
  p_GeneratedFormSection_2d157a61cd54 := 'Category';
  p_IsNameField_2d157a61cd54 := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_2d157a61cd54 := FALSE;
  p_RelatedEntityDisplayType_2d157a61cd54 := 'Search';
  p_AutoUpdateRelatedEntityInfo_2d157a61cd54 := TRUE;
  p_ValuesToPackWithSchema_2d157a61cd54 := 'Auto';
  p_Status_2d157a61cd54 := 'Active';
  p_AutoUpdateIsNameField_2d157a61cd54 := TRUE;
  p_AutoUpdateDefaultInView_2d157a61cd54 := TRUE;
  p_AutoUpdateCategory_2d157a61cd54 := TRUE;
  p_AutoUpdateDisplayName_2d157a61cd54 := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_2d157a61cd54 := TRUE;
  p_Encrypt_2d157a61cd54 := FALSE;
  p_AllowDecryptInAPI_2d157a61cd54 := FALSE;
  p_SendEncryptedValue_2d157a61cd54 := FALSE;
  p_IsSoftPrimaryKey_2d157a61cd54 := FALSE;
  p_IsSoftForeignKey_2d157a61cd54 := FALSE;
  p_JSONTypeIsArray_2d157a61cd54 := FALSE;
  p_UserSearchPredicateAPI_2d157a61cd54 := 'Contains';
  p_AutoUpdateUserSearchPredicate_2d157a61cd54 := TRUE;
  p_AutoUpdateFullTextSearch_2d157a61cd54 := TRUE;
  p_AutoUpdateExtendedType_2d157a61cd54 := TRUE;
  p_IsComputed_2d157a61cd54 := FALSE;
  p_ID_2d157a61cd54 := '7DB17BFA-5D46-44C5-B162-565731E35B5D';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM ${mjSchema}."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_2d157a61cd54,
    'Description', p_Description_2d157a61cd54,
    'AutoUpdateDescription', p_AutoUpdateDescription_2d157a61cd54,
    'IsPrimaryKey', p_IsPrimaryKey_2d157a61cd54,
    'IsUnique', p_IsUnique_2d157a61cd54,
    'Category', p_Category_2d157a61cd54,
    'ValueListType', p_ValueListType_2d157a61cd54,
    'ExtendedType', p_ExtendedType_2d157a61cd54,
    'CodeType', p_CodeType_2d157a61cd54,
    'DefaultInView', p_DefaultInView_2d157a61cd54,
    'ViewCellTemplate', p_ViewCellTemplate_2d157a61cd54,
    'DefaultColumnWidth', p_DefaultColumnWidth_2d157a61cd54,
    'AllowUpdateAPI', p_AllowUpdateAPI_2d157a61cd54,
    'AllowUpdateInView', p_AllowUpdateInView_2d157a61cd54,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_2d157a61cd54,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_2d157a61cd54,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_2d157a61cd54,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_2d157a61cd54,
    'GeneratedFormSection', p_GeneratedFormSection_2d157a61cd54,
    'IsNameField', p_IsNameField_2d157a61cd54,
    'RelatedEntityID', p_RelatedEntityID_2d157a61cd54,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_2d157a61cd54,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_2d157a61cd54,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_2d157a61cd54,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_2d157a61cd54,
    'EntityIDFieldName', p_EntityIDFieldName_2d157a61cd54,
    'ScopeDefault', p_ScopeDefault_2d157a61cd54,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_2d157a61cd54,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_2d157a61cd54,
    'Status', p_Status_2d157a61cd54,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_2d157a61cd54,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_2d157a61cd54,
    'AutoUpdateCategory', p_AutoUpdateCategory_2d157a61cd54,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_2d157a61cd54,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_2d157a61cd54,
    'Encrypt', p_Encrypt_2d157a61cd54,
    'EncryptionKeyID', p_EncryptionKeyID_2d157a61cd54,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_2d157a61cd54,
    'SendEncryptedValue', p_SendEncryptedValue_2d157a61cd54,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_2d157a61cd54,
    'IsSoftForeignKey', p_IsSoftForeignKey_2d157a61cd54,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_2d157a61cd54,
    'JSONType', p_JSONType_2d157a61cd54,
    'JSONTypeIsArray', p_JSONTypeIsArray_2d157a61cd54,
    'JSONTypeDefinition', p_JSONTypeDefinition_2d157a61cd54,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_2d157a61cd54,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_2d157a61cd54,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_2d157a61cd54,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_2d157a61cd54,
    'IsComputed', p_IsComputed_2d157a61cd54
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_2d157a61cd54,
    'Configuration', p_Configuration_2d157a61cd54,
    'ID', p_ID_2d157a61cd54
  ));
  ELSE
    PERFORM ${mjSchema}."spUpdateEntityField"(p_DisplayName := p_DisplayName_2d157a61cd54, p_Description := p_Description_2d157a61cd54, p_AutoUpdateDescription := p_AutoUpdateDescription_2d157a61cd54, p_IsPrimaryKey := p_IsPrimaryKey_2d157a61cd54, p_IsUnique := p_IsUnique_2d157a61cd54, p_Category := p_Category_2d157a61cd54, p_ValueListType := p_ValueListType_2d157a61cd54, p_ExtendedType := p_ExtendedType_2d157a61cd54, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_2d157a61cd54, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_2d157a61cd54, p_ViewCellTemplate := p_ViewCellTemplate_2d157a61cd54, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_2d157a61cd54, p_AllowUpdateAPI := p_AllowUpdateAPI_2d157a61cd54, p_AllowUpdateInView := p_AllowUpdateInView_2d157a61cd54, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_2d157a61cd54, p_FullTextSearchEnabled := p_FullTextSearchEnabled_2d157a61cd54, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_2d157a61cd54, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_2d157a61cd54, p_GeneratedFormSection := p_GeneratedFormSection_2d157a61cd54, p_IsNameField := p_IsNameField_2d157a61cd54, p_RelatedEntityID := p_RelatedEntityID_2d157a61cd54, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_2d157a61cd54, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_2d157a61cd54, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_2d157a61cd54, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_2d157a61cd54, p_EntityIDFieldName := p_EntityIDFieldName_2d157a61cd54, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_2d157a61cd54, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_2d157a61cd54, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_2d157a61cd54, p_Status := p_Status_2d157a61cd54, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_2d157a61cd54, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_2d157a61cd54, p_AutoUpdateCategory := p_AutoUpdateCategory_2d157a61cd54, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_2d157a61cd54, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_2d157a61cd54, p_Encrypt := p_Encrypt_2d157a61cd54, p_EncryptionKeyID := p_EncryptionKeyID_2d157a61cd54, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_2d157a61cd54, p_SendEncryptedValue := p_SendEncryptedValue_2d157a61cd54, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_2d157a61cd54, p_IsSoftForeignKey := p_IsSoftForeignKey_2d157a61cd54, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_2d157a61cd54, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_2d157a61cd54, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_2d157a61cd54, p_JSONTypeDefinition := p_JSONTypeDefinition_2d157a61cd54, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_2d157a61cd54, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_2d157a61cd54, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_2d157a61cd54, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_2d157a61cd54, p_IsComputed := p_IsComputed_2d157a61cd54, p_EmbeddedRecord := p_EmbeddedRecord_2d157a61cd54, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_2d157a61cd54, p_Configuration_Clear := TRUE, p_ID := p_ID_2d157a61cd54);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_4bfe1228ee23 VARCHAR(255);
  p_Description_4bfe1228ee23 TEXT;
  p_AutoUpdateDescription_4bfe1228ee23 BOOLEAN;
  p_IsPrimaryKey_4bfe1228ee23 BOOLEAN;
  p_IsUnique_4bfe1228ee23 BOOLEAN;
  p_Category_4bfe1228ee23 VARCHAR(255);
  p_ValueListType_4bfe1228ee23 VARCHAR(20);
  p_ExtendedType_4bfe1228ee23 VARCHAR(50);
  p_CodeType_4bfe1228ee23 VARCHAR(50);
  p_DefaultInView_4bfe1228ee23 BOOLEAN;
  p_ViewCellTemplate_4bfe1228ee23 TEXT;
  p_DefaultColumnWidth_4bfe1228ee23 INTEGER;
  p_AllowUpdateAPI_4bfe1228ee23 BOOLEAN;
  p_AllowUpdateInView_4bfe1228ee23 BOOLEAN;
  p_IncludeInUserSearchAPI_4bfe1228ee23 BOOLEAN;
  p_FullTextSearchEnabled_4bfe1228ee23 BOOLEAN;
  p_UserSearchParamFormatAPI_4bfe1228ee23 VARCHAR(500);
  p_IncludeInGeneratedForm_4bfe1228ee23 BOOLEAN;
  p_GeneratedFormSection_4bfe1228ee23 VARCHAR(10);
  p_IsNameField_4bfe1228ee23 BOOLEAN;
  p_RelatedEntityID_4bfe1228ee23 UUID;
  p_RelatedEntityFieldName_4bfe1228ee23 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_4bfe1228ee23 BOOLEAN;
  p_RelatedEntityNameFieldMap_4bfe1228ee23 VARCHAR(255);
  p_RelatedEntityDisplayType_4bfe1228ee23 VARCHAR(20);
  p_EntityIDFieldName_4bfe1228ee23 VARCHAR(100);
  p_ScopeDefault_4bfe1228ee23 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_4bfe1228ee23 BOOLEAN;
  p_ValuesToPackWithSchema_4bfe1228ee23 VARCHAR(10);
  p_Status_4bfe1228ee23 VARCHAR(25);
  p_AutoUpdateIsNameField_4bfe1228ee23 BOOLEAN;
  p_AutoUpdateDefaultInView_4bfe1228ee23 BOOLEAN;
  p_AutoUpdateCategory_4bfe1228ee23 BOOLEAN;
  p_AutoUpdateDisplayName_4bfe1228ee23 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_4bfe1228ee23 BOOLEAN;
  p_Encrypt_4bfe1228ee23 BOOLEAN;
  p_EncryptionKeyID_4bfe1228ee23 UUID;
  p_AllowDecryptInAPI_4bfe1228ee23 BOOLEAN;
  p_SendEncryptedValue_4bfe1228ee23 BOOLEAN;
  p_IsSoftPrimaryKey_4bfe1228ee23 BOOLEAN;
  p_IsSoftForeignKey_4bfe1228ee23 BOOLEAN;
  p_RelatedEntityJoinFields_4bfe1228ee23 TEXT;
  p_JSONType_4bfe1228ee23 VARCHAR(255);
  p_JSONTypeIsArray_4bfe1228ee23 BOOLEAN;
  p_JSONTypeDefinition_4bfe1228ee23 TEXT;
  p_UserSearchPredicateAPI_4bfe1228ee23 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_4bfe1228ee23 BOOLEAN;
  p_AutoUpdateFullTextSearch_4bfe1228ee23 BOOLEAN;
  p_AutoUpdateExtendedType_4bfe1228ee23 BOOLEAN;
  p_IsComputed_4bfe1228ee23 BOOLEAN;
  p_EmbeddedRecord_4bfe1228ee23 TEXT;
  p_Configuration_4bfe1228ee23 TEXT;
  p_ID_4bfe1228ee23 UUID;
BEGIN
  p_DisplayName_4bfe1228ee23 := 'Manual Journal Entry Approval Threshold';
  p_Description_4bfe1228ee23 := 'The amount (total debits) at or below which a manual journal entry is approved by a holder of ManualJournalEntryApproverRoleID; above it, by the Approval CFO. NULL, the default, switches manual-entry approval off for this company: manual entries batch as before.';
  p_AutoUpdateDescription_4bfe1228ee23 := TRUE;
  p_IsPrimaryKey_4bfe1228ee23 := FALSE;
  p_IsUnique_4bfe1228ee23 := FALSE;
  p_Category_4bfe1228ee23 := 'Administrative Settings';
  p_ValueListType_4bfe1228ee23 := 'None';
  p_DefaultInView_4bfe1228ee23 := FALSE;
  p_DefaultColumnWidth_4bfe1228ee23 := 150;
  p_AllowUpdateAPI_4bfe1228ee23 := TRUE;
  p_AllowUpdateInView_4bfe1228ee23 := TRUE;
  p_IncludeInUserSearchAPI_4bfe1228ee23 := FALSE;
  p_FullTextSearchEnabled_4bfe1228ee23 := FALSE;
  p_IncludeInGeneratedForm_4bfe1228ee23 := TRUE;
  p_GeneratedFormSection_4bfe1228ee23 := 'Category';
  p_IsNameField_4bfe1228ee23 := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_4bfe1228ee23 := FALSE;
  p_RelatedEntityDisplayType_4bfe1228ee23 := 'Search';
  p_AutoUpdateRelatedEntityInfo_4bfe1228ee23 := TRUE;
  p_ValuesToPackWithSchema_4bfe1228ee23 := 'Auto';
  p_Status_4bfe1228ee23 := 'Active';
  p_AutoUpdateIsNameField_4bfe1228ee23 := TRUE;
  p_AutoUpdateDefaultInView_4bfe1228ee23 := TRUE;
  p_AutoUpdateCategory_4bfe1228ee23 := TRUE;
  p_AutoUpdateDisplayName_4bfe1228ee23 := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_4bfe1228ee23 := TRUE;
  p_Encrypt_4bfe1228ee23 := FALSE;
  p_AllowDecryptInAPI_4bfe1228ee23 := FALSE;
  p_SendEncryptedValue_4bfe1228ee23 := FALSE;
  p_IsSoftPrimaryKey_4bfe1228ee23 := FALSE;
  p_IsSoftForeignKey_4bfe1228ee23 := FALSE;
  p_JSONTypeIsArray_4bfe1228ee23 := FALSE;
  p_UserSearchPredicateAPI_4bfe1228ee23 := 'Contains';
  p_AutoUpdateUserSearchPredicate_4bfe1228ee23 := TRUE;
  p_AutoUpdateFullTextSearch_4bfe1228ee23 := TRUE;
  p_AutoUpdateExtendedType_4bfe1228ee23 := TRUE;
  p_IsComputed_4bfe1228ee23 := FALSE;
  p_ID_4bfe1228ee23 := 'D3A4DB04-71B4-48BC-84A1-8D6E29A5D4F1';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM ${mjSchema}."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_4bfe1228ee23,
    'Description', p_Description_4bfe1228ee23,
    'AutoUpdateDescription', p_AutoUpdateDescription_4bfe1228ee23,
    'IsPrimaryKey', p_IsPrimaryKey_4bfe1228ee23,
    'IsUnique', p_IsUnique_4bfe1228ee23,
    'Category', p_Category_4bfe1228ee23,
    'ValueListType', p_ValueListType_4bfe1228ee23,
    'ExtendedType', p_ExtendedType_4bfe1228ee23,
    'CodeType', p_CodeType_4bfe1228ee23,
    'DefaultInView', p_DefaultInView_4bfe1228ee23,
    'ViewCellTemplate', p_ViewCellTemplate_4bfe1228ee23,
    'DefaultColumnWidth', p_DefaultColumnWidth_4bfe1228ee23,
    'AllowUpdateAPI', p_AllowUpdateAPI_4bfe1228ee23,
    'AllowUpdateInView', p_AllowUpdateInView_4bfe1228ee23,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_4bfe1228ee23,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_4bfe1228ee23,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_4bfe1228ee23,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_4bfe1228ee23,
    'GeneratedFormSection', p_GeneratedFormSection_4bfe1228ee23,
    'IsNameField', p_IsNameField_4bfe1228ee23,
    'RelatedEntityID', p_RelatedEntityID_4bfe1228ee23,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_4bfe1228ee23,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_4bfe1228ee23,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_4bfe1228ee23,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_4bfe1228ee23,
    'EntityIDFieldName', p_EntityIDFieldName_4bfe1228ee23,
    'ScopeDefault', p_ScopeDefault_4bfe1228ee23,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_4bfe1228ee23,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_4bfe1228ee23,
    'Status', p_Status_4bfe1228ee23,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_4bfe1228ee23,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_4bfe1228ee23,
    'AutoUpdateCategory', p_AutoUpdateCategory_4bfe1228ee23,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_4bfe1228ee23,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_4bfe1228ee23,
    'Encrypt', p_Encrypt_4bfe1228ee23,
    'EncryptionKeyID', p_EncryptionKeyID_4bfe1228ee23,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_4bfe1228ee23,
    'SendEncryptedValue', p_SendEncryptedValue_4bfe1228ee23,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_4bfe1228ee23,
    'IsSoftForeignKey', p_IsSoftForeignKey_4bfe1228ee23,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_4bfe1228ee23,
    'JSONType', p_JSONType_4bfe1228ee23,
    'JSONTypeIsArray', p_JSONTypeIsArray_4bfe1228ee23,
    'JSONTypeDefinition', p_JSONTypeDefinition_4bfe1228ee23,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_4bfe1228ee23,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_4bfe1228ee23,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_4bfe1228ee23,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_4bfe1228ee23,
    'IsComputed', p_IsComputed_4bfe1228ee23
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_4bfe1228ee23,
    'Configuration', p_Configuration_4bfe1228ee23,
    'ID', p_ID_4bfe1228ee23
  ));
  ELSE
    PERFORM ${mjSchema}."spUpdateEntityField"(p_DisplayName := p_DisplayName_4bfe1228ee23, p_Description := p_Description_4bfe1228ee23, p_AutoUpdateDescription := p_AutoUpdateDescription_4bfe1228ee23, p_IsPrimaryKey := p_IsPrimaryKey_4bfe1228ee23, p_IsUnique := p_IsUnique_4bfe1228ee23, p_Category := p_Category_4bfe1228ee23, p_ValueListType := p_ValueListType_4bfe1228ee23, p_ExtendedType := p_ExtendedType_4bfe1228ee23, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_4bfe1228ee23, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_4bfe1228ee23, p_ViewCellTemplate := p_ViewCellTemplate_4bfe1228ee23, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_4bfe1228ee23, p_AllowUpdateAPI := p_AllowUpdateAPI_4bfe1228ee23, p_AllowUpdateInView := p_AllowUpdateInView_4bfe1228ee23, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_4bfe1228ee23, p_FullTextSearchEnabled := p_FullTextSearchEnabled_4bfe1228ee23, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_4bfe1228ee23, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_4bfe1228ee23, p_GeneratedFormSection := p_GeneratedFormSection_4bfe1228ee23, p_IsNameField := p_IsNameField_4bfe1228ee23, p_RelatedEntityID := p_RelatedEntityID_4bfe1228ee23, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_4bfe1228ee23, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_4bfe1228ee23, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_4bfe1228ee23, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_4bfe1228ee23, p_EntityIDFieldName := p_EntityIDFieldName_4bfe1228ee23, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_4bfe1228ee23, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_4bfe1228ee23, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_4bfe1228ee23, p_Status := p_Status_4bfe1228ee23, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_4bfe1228ee23, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_4bfe1228ee23, p_AutoUpdateCategory := p_AutoUpdateCategory_4bfe1228ee23, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_4bfe1228ee23, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_4bfe1228ee23, p_Encrypt := p_Encrypt_4bfe1228ee23, p_EncryptionKeyID := p_EncryptionKeyID_4bfe1228ee23, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_4bfe1228ee23, p_SendEncryptedValue := p_SendEncryptedValue_4bfe1228ee23, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_4bfe1228ee23, p_IsSoftForeignKey := p_IsSoftForeignKey_4bfe1228ee23, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_4bfe1228ee23, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_4bfe1228ee23, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_4bfe1228ee23, p_JSONTypeDefinition := p_JSONTypeDefinition_4bfe1228ee23, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_4bfe1228ee23, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_4bfe1228ee23, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_4bfe1228ee23, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_4bfe1228ee23, p_IsComputed := p_IsComputed_4bfe1228ee23, p_EmbeddedRecord := p_EmbeddedRecord_4bfe1228ee23, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_4bfe1228ee23, p_Configuration_Clear := TRUE, p_ID := p_ID_4bfe1228ee23);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_7cbb84754516 VARCHAR(255);
  p_Description_7cbb84754516 TEXT;
  p_AutoUpdateDescription_7cbb84754516 BOOLEAN;
  p_IsPrimaryKey_7cbb84754516 BOOLEAN;
  p_IsUnique_7cbb84754516 BOOLEAN;
  p_Category_7cbb84754516 VARCHAR(255);
  p_ValueListType_7cbb84754516 VARCHAR(20);
  p_ExtendedType_7cbb84754516 VARCHAR(50);
  p_CodeType_7cbb84754516 VARCHAR(50);
  p_DefaultInView_7cbb84754516 BOOLEAN;
  p_ViewCellTemplate_7cbb84754516 TEXT;
  p_DefaultColumnWidth_7cbb84754516 INTEGER;
  p_AllowUpdateAPI_7cbb84754516 BOOLEAN;
  p_AllowUpdateInView_7cbb84754516 BOOLEAN;
  p_IncludeInUserSearchAPI_7cbb84754516 BOOLEAN;
  p_FullTextSearchEnabled_7cbb84754516 BOOLEAN;
  p_UserSearchParamFormatAPI_7cbb84754516 VARCHAR(500);
  p_IncludeInGeneratedForm_7cbb84754516 BOOLEAN;
  p_GeneratedFormSection_7cbb84754516 VARCHAR(10);
  p_IsNameField_7cbb84754516 BOOLEAN;
  p_RelatedEntityID_7cbb84754516 UUID;
  p_RelatedEntityFieldName_7cbb84754516 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_7cbb84754516 BOOLEAN;
  p_RelatedEntityNameFieldMap_7cbb84754516 VARCHAR(255);
  p_RelatedEntityDisplayType_7cbb84754516 VARCHAR(20);
  p_EntityIDFieldName_7cbb84754516 VARCHAR(100);
  p_ScopeDefault_7cbb84754516 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_7cbb84754516 BOOLEAN;
  p_ValuesToPackWithSchema_7cbb84754516 VARCHAR(10);
  p_Status_7cbb84754516 VARCHAR(25);
  p_AutoUpdateIsNameField_7cbb84754516 BOOLEAN;
  p_AutoUpdateDefaultInView_7cbb84754516 BOOLEAN;
  p_AutoUpdateCategory_7cbb84754516 BOOLEAN;
  p_AutoUpdateDisplayName_7cbb84754516 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_7cbb84754516 BOOLEAN;
  p_Encrypt_7cbb84754516 BOOLEAN;
  p_EncryptionKeyID_7cbb84754516 UUID;
  p_AllowDecryptInAPI_7cbb84754516 BOOLEAN;
  p_SendEncryptedValue_7cbb84754516 BOOLEAN;
  p_IsSoftPrimaryKey_7cbb84754516 BOOLEAN;
  p_IsSoftForeignKey_7cbb84754516 BOOLEAN;
  p_RelatedEntityJoinFields_7cbb84754516 TEXT;
  p_JSONType_7cbb84754516 VARCHAR(255);
  p_JSONTypeIsArray_7cbb84754516 BOOLEAN;
  p_JSONTypeDefinition_7cbb84754516 TEXT;
  p_UserSearchPredicateAPI_7cbb84754516 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_7cbb84754516 BOOLEAN;
  p_AutoUpdateFullTextSearch_7cbb84754516 BOOLEAN;
  p_AutoUpdateExtendedType_7cbb84754516 BOOLEAN;
  p_IsComputed_7cbb84754516 BOOLEAN;
  p_EmbeddedRecord_7cbb84754516 TEXT;
  p_Configuration_7cbb84754516 TEXT;
  p_ID_7cbb84754516 UUID;
BEGIN
  p_DisplayName_7cbb84754516 := 'Manual Journal Entry Approver Role ID';
  p_Description_7cbb84754516 := 'The role whose holders approve a manual journal entry at or below ManualJournalEntryApprovalThreshold, never the entry''s creator. NULL sends every manual entry to the Approval CFO while the threshold is set.';
  p_AutoUpdateDescription_7cbb84754516 := TRUE;
  p_IsPrimaryKey_7cbb84754516 := FALSE;
  p_IsUnique_7cbb84754516 := FALSE;
  p_Category_7cbb84754516 := 'Administrative Settings';
  p_ValueListType_7cbb84754516 := 'None';
  p_DefaultInView_7cbb84754516 := FALSE;
  p_DefaultColumnWidth_7cbb84754516 := 150;
  p_AllowUpdateAPI_7cbb84754516 := TRUE;
  p_AllowUpdateInView_7cbb84754516 := TRUE;
  p_IncludeInUserSearchAPI_7cbb84754516 := FALSE;
  p_FullTextSearchEnabled_7cbb84754516 := FALSE;
  p_IncludeInGeneratedForm_7cbb84754516 := TRUE;
  p_GeneratedFormSection_7cbb84754516 := 'Category';
  p_IsNameField_7cbb84754516 := FALSE;
  p_RelatedEntityID_7cbb84754516 := 'DA238F34-2837-EF11-86D4-6045BDEE16E6';
  p_RelatedEntityFieldName_7cbb84754516 := 'ID';
  p_IncludeRelatedEntityNameFieldInBaseView_7cbb84754516 := TRUE;
  p_RelatedEntityNameFieldMap_7cbb84754516 := 'ManualJournalEntryApproverRole';
  p_RelatedEntityDisplayType_7cbb84754516 := 'Search';
  p_AutoUpdateRelatedEntityInfo_7cbb84754516 := TRUE;
  p_ValuesToPackWithSchema_7cbb84754516 := 'Auto';
  p_Status_7cbb84754516 := 'Active';
  p_AutoUpdateIsNameField_7cbb84754516 := TRUE;
  p_AutoUpdateDefaultInView_7cbb84754516 := TRUE;
  p_AutoUpdateCategory_7cbb84754516 := TRUE;
  p_AutoUpdateDisplayName_7cbb84754516 := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_7cbb84754516 := TRUE;
  p_Encrypt_7cbb84754516 := FALSE;
  p_AllowDecryptInAPI_7cbb84754516 := FALSE;
  p_SendEncryptedValue_7cbb84754516 := FALSE;
  p_IsSoftPrimaryKey_7cbb84754516 := FALSE;
  p_IsSoftForeignKey_7cbb84754516 := FALSE;
  p_JSONTypeIsArray_7cbb84754516 := FALSE;
  p_UserSearchPredicateAPI_7cbb84754516 := 'Contains';
  p_AutoUpdateUserSearchPredicate_7cbb84754516 := TRUE;
  p_AutoUpdateFullTextSearch_7cbb84754516 := TRUE;
  p_AutoUpdateExtendedType_7cbb84754516 := TRUE;
  p_IsComputed_7cbb84754516 := FALSE;
  p_ID_7cbb84754516 := '16E6DBC9-1E36-4A47-A70E-85ED192BD6A7';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM ${mjSchema}."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_7cbb84754516,
    'Description', p_Description_7cbb84754516,
    'AutoUpdateDescription', p_AutoUpdateDescription_7cbb84754516,
    'IsPrimaryKey', p_IsPrimaryKey_7cbb84754516,
    'IsUnique', p_IsUnique_7cbb84754516,
    'Category', p_Category_7cbb84754516,
    'ValueListType', p_ValueListType_7cbb84754516,
    'ExtendedType', p_ExtendedType_7cbb84754516,
    'CodeType', p_CodeType_7cbb84754516,
    'DefaultInView', p_DefaultInView_7cbb84754516,
    'ViewCellTemplate', p_ViewCellTemplate_7cbb84754516,
    'DefaultColumnWidth', p_DefaultColumnWidth_7cbb84754516,
    'AllowUpdateAPI', p_AllowUpdateAPI_7cbb84754516,
    'AllowUpdateInView', p_AllowUpdateInView_7cbb84754516,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_7cbb84754516,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_7cbb84754516,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_7cbb84754516,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_7cbb84754516,
    'GeneratedFormSection', p_GeneratedFormSection_7cbb84754516,
    'IsNameField', p_IsNameField_7cbb84754516,
    'RelatedEntityID', p_RelatedEntityID_7cbb84754516,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_7cbb84754516,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_7cbb84754516,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_7cbb84754516,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_7cbb84754516,
    'EntityIDFieldName', p_EntityIDFieldName_7cbb84754516,
    'ScopeDefault', p_ScopeDefault_7cbb84754516,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_7cbb84754516,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_7cbb84754516,
    'Status', p_Status_7cbb84754516,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_7cbb84754516,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_7cbb84754516,
    'AutoUpdateCategory', p_AutoUpdateCategory_7cbb84754516,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_7cbb84754516,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_7cbb84754516,
    'Encrypt', p_Encrypt_7cbb84754516,
    'EncryptionKeyID', p_EncryptionKeyID_7cbb84754516,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_7cbb84754516,
    'SendEncryptedValue', p_SendEncryptedValue_7cbb84754516,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_7cbb84754516,
    'IsSoftForeignKey', p_IsSoftForeignKey_7cbb84754516,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_7cbb84754516,
    'JSONType', p_JSONType_7cbb84754516,
    'JSONTypeIsArray', p_JSONTypeIsArray_7cbb84754516,
    'JSONTypeDefinition', p_JSONTypeDefinition_7cbb84754516,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_7cbb84754516,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_7cbb84754516,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_7cbb84754516,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_7cbb84754516,
    'IsComputed', p_IsComputed_7cbb84754516
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_7cbb84754516,
    'Configuration', p_Configuration_7cbb84754516,
    'ID', p_ID_7cbb84754516
  ));
  ELSE
    PERFORM ${mjSchema}."spUpdateEntityField"(p_DisplayName := p_DisplayName_7cbb84754516, p_Description := p_Description_7cbb84754516, p_AutoUpdateDescription := p_AutoUpdateDescription_7cbb84754516, p_IsPrimaryKey := p_IsPrimaryKey_7cbb84754516, p_IsUnique := p_IsUnique_7cbb84754516, p_Category := p_Category_7cbb84754516, p_ValueListType := p_ValueListType_7cbb84754516, p_ExtendedType := p_ExtendedType_7cbb84754516, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_7cbb84754516, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_7cbb84754516, p_ViewCellTemplate := p_ViewCellTemplate_7cbb84754516, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_7cbb84754516, p_AllowUpdateAPI := p_AllowUpdateAPI_7cbb84754516, p_AllowUpdateInView := p_AllowUpdateInView_7cbb84754516, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_7cbb84754516, p_FullTextSearchEnabled := p_FullTextSearchEnabled_7cbb84754516, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_7cbb84754516, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_7cbb84754516, p_GeneratedFormSection := p_GeneratedFormSection_7cbb84754516, p_IsNameField := p_IsNameField_7cbb84754516, p_RelatedEntityID := p_RelatedEntityID_7cbb84754516, p_RelatedEntityFieldName := p_RelatedEntityFieldName_7cbb84754516, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_7cbb84754516, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_7cbb84754516, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_7cbb84754516, p_EntityIDFieldName := p_EntityIDFieldName_7cbb84754516, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_7cbb84754516, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_7cbb84754516, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_7cbb84754516, p_Status := p_Status_7cbb84754516, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_7cbb84754516, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_7cbb84754516, p_AutoUpdateCategory := p_AutoUpdateCategory_7cbb84754516, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_7cbb84754516, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_7cbb84754516, p_Encrypt := p_Encrypt_7cbb84754516, p_EncryptionKeyID := p_EncryptionKeyID_7cbb84754516, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_7cbb84754516, p_SendEncryptedValue := p_SendEncryptedValue_7cbb84754516, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_7cbb84754516, p_IsSoftForeignKey := p_IsSoftForeignKey_7cbb84754516, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_7cbb84754516, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_7cbb84754516, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_7cbb84754516, p_JSONTypeDefinition := p_JSONTypeDefinition_7cbb84754516, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_7cbb84754516, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_7cbb84754516, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_7cbb84754516, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_7cbb84754516, p_IsComputed := p_IsComputed_7cbb84754516, p_EmbeddedRecord := p_EmbeddedRecord_7cbb84754516, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_7cbb84754516, p_Configuration_Clear := TRUE, p_ID := p_ID_7cbb84754516);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_95908f5aa1b8 VARCHAR(255);
  p_Description_95908f5aa1b8 TEXT;
  p_AutoUpdateDescription_95908f5aa1b8 BOOLEAN;
  p_IsPrimaryKey_95908f5aa1b8 BOOLEAN;
  p_IsUnique_95908f5aa1b8 BOOLEAN;
  p_Category_95908f5aa1b8 VARCHAR(255);
  p_ValueListType_95908f5aa1b8 VARCHAR(20);
  p_ExtendedType_95908f5aa1b8 VARCHAR(50);
  p_CodeType_95908f5aa1b8 VARCHAR(50);
  p_DefaultInView_95908f5aa1b8 BOOLEAN;
  p_ViewCellTemplate_95908f5aa1b8 TEXT;
  p_DefaultColumnWidth_95908f5aa1b8 INTEGER;
  p_AllowUpdateAPI_95908f5aa1b8 BOOLEAN;
  p_AllowUpdateInView_95908f5aa1b8 BOOLEAN;
  p_IncludeInUserSearchAPI_95908f5aa1b8 BOOLEAN;
  p_FullTextSearchEnabled_95908f5aa1b8 BOOLEAN;
  p_UserSearchParamFormatAPI_95908f5aa1b8 VARCHAR(500);
  p_IncludeInGeneratedForm_95908f5aa1b8 BOOLEAN;
  p_GeneratedFormSection_95908f5aa1b8 VARCHAR(10);
  p_IsNameField_95908f5aa1b8 BOOLEAN;
  p_RelatedEntityID_95908f5aa1b8 UUID;
  p_RelatedEntityFieldName_95908f5aa1b8 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_95908f5aa1b8 BOOLEAN;
  p_RelatedEntityNameFieldMap_95908f5aa1b8 VARCHAR(255);
  p_RelatedEntityDisplayType_95908f5aa1b8 VARCHAR(20);
  p_EntityIDFieldName_95908f5aa1b8 VARCHAR(100);
  p_ScopeDefault_95908f5aa1b8 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_95908f5aa1b8 BOOLEAN;
  p_ValuesToPackWithSchema_95908f5aa1b8 VARCHAR(10);
  p_Status_95908f5aa1b8 VARCHAR(25);
  p_AutoUpdateIsNameField_95908f5aa1b8 BOOLEAN;
  p_AutoUpdateDefaultInView_95908f5aa1b8 BOOLEAN;
  p_AutoUpdateCategory_95908f5aa1b8 BOOLEAN;
  p_AutoUpdateDisplayName_95908f5aa1b8 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_95908f5aa1b8 BOOLEAN;
  p_Encrypt_95908f5aa1b8 BOOLEAN;
  p_EncryptionKeyID_95908f5aa1b8 UUID;
  p_AllowDecryptInAPI_95908f5aa1b8 BOOLEAN;
  p_SendEncryptedValue_95908f5aa1b8 BOOLEAN;
  p_IsSoftPrimaryKey_95908f5aa1b8 BOOLEAN;
  p_IsSoftForeignKey_95908f5aa1b8 BOOLEAN;
  p_RelatedEntityJoinFields_95908f5aa1b8 TEXT;
  p_JSONType_95908f5aa1b8 VARCHAR(255);
  p_JSONTypeIsArray_95908f5aa1b8 BOOLEAN;
  p_JSONTypeDefinition_95908f5aa1b8 TEXT;
  p_UserSearchPredicateAPI_95908f5aa1b8 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_95908f5aa1b8 BOOLEAN;
  p_AutoUpdateFullTextSearch_95908f5aa1b8 BOOLEAN;
  p_AutoUpdateExtendedType_95908f5aa1b8 BOOLEAN;
  p_IsComputed_95908f5aa1b8 BOOLEAN;
  p_EmbeddedRecord_95908f5aa1b8 TEXT;
  p_Configuration_95908f5aa1b8 TEXT;
  p_ID_95908f5aa1b8 UUID;
BEGIN
  p_DisplayName_95908f5aa1b8 := 'Is Control Account';
  p_Description_95908f5aa1b8 := 'A control account (AR, deferred revenue, unbilled, customer deposits, cash, or any account the company names): a manual journal entry with a line on it always needs the company''s Approval CFO, whatever its amount. Default 0.';
  p_AutoUpdateDescription_95908f5aa1b8 := TRUE;
  p_IsPrimaryKey_95908f5aa1b8 := FALSE;
  p_IsUnique_95908f5aa1b8 := FALSE;
  p_Category_95908f5aa1b8 := 'Account Details';
  p_ValueListType_95908f5aa1b8 := 'None';
  p_DefaultInView_95908f5aa1b8 := FALSE;
  p_DefaultColumnWidth_95908f5aa1b8 := 150;
  p_AllowUpdateAPI_95908f5aa1b8 := TRUE;
  p_AllowUpdateInView_95908f5aa1b8 := TRUE;
  p_IncludeInUserSearchAPI_95908f5aa1b8 := FALSE;
  p_FullTextSearchEnabled_95908f5aa1b8 := FALSE;
  p_IncludeInGeneratedForm_95908f5aa1b8 := TRUE;
  p_GeneratedFormSection_95908f5aa1b8 := 'Category';
  p_IsNameField_95908f5aa1b8 := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_95908f5aa1b8 := FALSE;
  p_RelatedEntityDisplayType_95908f5aa1b8 := 'Search';
  p_AutoUpdateRelatedEntityInfo_95908f5aa1b8 := TRUE;
  p_ValuesToPackWithSchema_95908f5aa1b8 := 'Auto';
  p_Status_95908f5aa1b8 := 'Active';
  p_AutoUpdateIsNameField_95908f5aa1b8 := TRUE;
  p_AutoUpdateDefaultInView_95908f5aa1b8 := TRUE;
  p_AutoUpdateCategory_95908f5aa1b8 := TRUE;
  p_AutoUpdateDisplayName_95908f5aa1b8 := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_95908f5aa1b8 := TRUE;
  p_Encrypt_95908f5aa1b8 := FALSE;
  p_AllowDecryptInAPI_95908f5aa1b8 := FALSE;
  p_SendEncryptedValue_95908f5aa1b8 := FALSE;
  p_IsSoftPrimaryKey_95908f5aa1b8 := FALSE;
  p_IsSoftForeignKey_95908f5aa1b8 := FALSE;
  p_JSONTypeIsArray_95908f5aa1b8 := FALSE;
  p_UserSearchPredicateAPI_95908f5aa1b8 := 'Contains';
  p_AutoUpdateUserSearchPredicate_95908f5aa1b8 := TRUE;
  p_AutoUpdateFullTextSearch_95908f5aa1b8 := TRUE;
  p_AutoUpdateExtendedType_95908f5aa1b8 := TRUE;
  p_IsComputed_95908f5aa1b8 := FALSE;
  p_ID_95908f5aa1b8 := 'E4505AFF-DF19-41CD-BC3A-137341A72FBC';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM ${mjSchema}."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_95908f5aa1b8,
    'Description', p_Description_95908f5aa1b8,
    'AutoUpdateDescription', p_AutoUpdateDescription_95908f5aa1b8,
    'IsPrimaryKey', p_IsPrimaryKey_95908f5aa1b8,
    'IsUnique', p_IsUnique_95908f5aa1b8,
    'Category', p_Category_95908f5aa1b8,
    'ValueListType', p_ValueListType_95908f5aa1b8,
    'ExtendedType', p_ExtendedType_95908f5aa1b8,
    'CodeType', p_CodeType_95908f5aa1b8,
    'DefaultInView', p_DefaultInView_95908f5aa1b8,
    'ViewCellTemplate', p_ViewCellTemplate_95908f5aa1b8,
    'DefaultColumnWidth', p_DefaultColumnWidth_95908f5aa1b8,
    'AllowUpdateAPI', p_AllowUpdateAPI_95908f5aa1b8,
    'AllowUpdateInView', p_AllowUpdateInView_95908f5aa1b8,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_95908f5aa1b8,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_95908f5aa1b8,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_95908f5aa1b8,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_95908f5aa1b8,
    'GeneratedFormSection', p_GeneratedFormSection_95908f5aa1b8,
    'IsNameField', p_IsNameField_95908f5aa1b8,
    'RelatedEntityID', p_RelatedEntityID_95908f5aa1b8,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_95908f5aa1b8,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_95908f5aa1b8,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_95908f5aa1b8,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_95908f5aa1b8,
    'EntityIDFieldName', p_EntityIDFieldName_95908f5aa1b8,
    'ScopeDefault', p_ScopeDefault_95908f5aa1b8,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_95908f5aa1b8,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_95908f5aa1b8,
    'Status', p_Status_95908f5aa1b8,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_95908f5aa1b8,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_95908f5aa1b8,
    'AutoUpdateCategory', p_AutoUpdateCategory_95908f5aa1b8,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_95908f5aa1b8,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_95908f5aa1b8,
    'Encrypt', p_Encrypt_95908f5aa1b8,
    'EncryptionKeyID', p_EncryptionKeyID_95908f5aa1b8,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_95908f5aa1b8,
    'SendEncryptedValue', p_SendEncryptedValue_95908f5aa1b8,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_95908f5aa1b8,
    'IsSoftForeignKey', p_IsSoftForeignKey_95908f5aa1b8,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_95908f5aa1b8,
    'JSONType', p_JSONType_95908f5aa1b8,
    'JSONTypeIsArray', p_JSONTypeIsArray_95908f5aa1b8,
    'JSONTypeDefinition', p_JSONTypeDefinition_95908f5aa1b8,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_95908f5aa1b8,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_95908f5aa1b8,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_95908f5aa1b8,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_95908f5aa1b8,
    'IsComputed', p_IsComputed_95908f5aa1b8
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_95908f5aa1b8,
    'Configuration', p_Configuration_95908f5aa1b8,
    'ID', p_ID_95908f5aa1b8
  ));
  ELSE
    PERFORM ${mjSchema}."spUpdateEntityField"(p_DisplayName := p_DisplayName_95908f5aa1b8, p_Description := p_Description_95908f5aa1b8, p_AutoUpdateDescription := p_AutoUpdateDescription_95908f5aa1b8, p_IsPrimaryKey := p_IsPrimaryKey_95908f5aa1b8, p_IsUnique := p_IsUnique_95908f5aa1b8, p_Category := p_Category_95908f5aa1b8, p_ValueListType := p_ValueListType_95908f5aa1b8, p_ExtendedType := p_ExtendedType_95908f5aa1b8, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_95908f5aa1b8, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_95908f5aa1b8, p_ViewCellTemplate := p_ViewCellTemplate_95908f5aa1b8, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_95908f5aa1b8, p_AllowUpdateAPI := p_AllowUpdateAPI_95908f5aa1b8, p_AllowUpdateInView := p_AllowUpdateInView_95908f5aa1b8, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_95908f5aa1b8, p_FullTextSearchEnabled := p_FullTextSearchEnabled_95908f5aa1b8, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_95908f5aa1b8, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_95908f5aa1b8, p_GeneratedFormSection := p_GeneratedFormSection_95908f5aa1b8, p_IsNameField := p_IsNameField_95908f5aa1b8, p_RelatedEntityID := p_RelatedEntityID_95908f5aa1b8, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_95908f5aa1b8, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_95908f5aa1b8, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_95908f5aa1b8, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_95908f5aa1b8, p_EntityIDFieldName := p_EntityIDFieldName_95908f5aa1b8, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_95908f5aa1b8, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_95908f5aa1b8, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_95908f5aa1b8, p_Status := p_Status_95908f5aa1b8, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_95908f5aa1b8, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_95908f5aa1b8, p_AutoUpdateCategory := p_AutoUpdateCategory_95908f5aa1b8, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_95908f5aa1b8, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_95908f5aa1b8, p_Encrypt := p_Encrypt_95908f5aa1b8, p_EncryptionKeyID := p_EncryptionKeyID_95908f5aa1b8, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_95908f5aa1b8, p_SendEncryptedValue := p_SendEncryptedValue_95908f5aa1b8, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_95908f5aa1b8, p_IsSoftForeignKey := p_IsSoftForeignKey_95908f5aa1b8, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_95908f5aa1b8, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_95908f5aa1b8, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_95908f5aa1b8, p_JSONTypeDefinition := p_JSONTypeDefinition_95908f5aa1b8, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_95908f5aa1b8, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_95908f5aa1b8, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_95908f5aa1b8, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_95908f5aa1b8, p_IsComputed := p_IsComputed_95908f5aa1b8, p_EmbeddedRecord := p_EmbeddedRecord_95908f5aa1b8, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_95908f5aa1b8, p_Configuration_Clear := TRUE, p_ID := p_ID_95908f5aa1b8);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_d35b868eeb7f VARCHAR(255);
  p_Description_d35b868eeb7f TEXT;
  p_AutoUpdateDescription_d35b868eeb7f BOOLEAN;
  p_IsPrimaryKey_d35b868eeb7f BOOLEAN;
  p_IsUnique_d35b868eeb7f BOOLEAN;
  p_Category_d35b868eeb7f VARCHAR(255);
  p_ValueListType_d35b868eeb7f VARCHAR(20);
  p_ExtendedType_d35b868eeb7f VARCHAR(50);
  p_CodeType_d35b868eeb7f VARCHAR(50);
  p_DefaultInView_d35b868eeb7f BOOLEAN;
  p_ViewCellTemplate_d35b868eeb7f TEXT;
  p_DefaultColumnWidth_d35b868eeb7f INTEGER;
  p_AllowUpdateAPI_d35b868eeb7f BOOLEAN;
  p_AllowUpdateInView_d35b868eeb7f BOOLEAN;
  p_IncludeInUserSearchAPI_d35b868eeb7f BOOLEAN;
  p_FullTextSearchEnabled_d35b868eeb7f BOOLEAN;
  p_UserSearchParamFormatAPI_d35b868eeb7f VARCHAR(500);
  p_IncludeInGeneratedForm_d35b868eeb7f BOOLEAN;
  p_GeneratedFormSection_d35b868eeb7f VARCHAR(10);
  p_IsNameField_d35b868eeb7f BOOLEAN;
  p_RelatedEntityID_d35b868eeb7f UUID;
  p_RelatedEntityFieldName_d35b868eeb7f VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_d35b868eeb7f BOOLEAN;
  p_RelatedEntityNameFieldMap_d35b868eeb7f VARCHAR(255);
  p_RelatedEntityDisplayType_d35b868eeb7f VARCHAR(20);
  p_EntityIDFieldName_d35b868eeb7f VARCHAR(100);
  p_ScopeDefault_d35b868eeb7f VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_d35b868eeb7f BOOLEAN;
  p_ValuesToPackWithSchema_d35b868eeb7f VARCHAR(10);
  p_Status_d35b868eeb7f VARCHAR(25);
  p_AutoUpdateIsNameField_d35b868eeb7f BOOLEAN;
  p_AutoUpdateDefaultInView_d35b868eeb7f BOOLEAN;
  p_AutoUpdateCategory_d35b868eeb7f BOOLEAN;
  p_AutoUpdateDisplayName_d35b868eeb7f BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_d35b868eeb7f BOOLEAN;
  p_Encrypt_d35b868eeb7f BOOLEAN;
  p_EncryptionKeyID_d35b868eeb7f UUID;
  p_AllowDecryptInAPI_d35b868eeb7f BOOLEAN;
  p_SendEncryptedValue_d35b868eeb7f BOOLEAN;
  p_IsSoftPrimaryKey_d35b868eeb7f BOOLEAN;
  p_IsSoftForeignKey_d35b868eeb7f BOOLEAN;
  p_RelatedEntityJoinFields_d35b868eeb7f TEXT;
  p_JSONType_d35b868eeb7f VARCHAR(255);
  p_JSONTypeIsArray_d35b868eeb7f BOOLEAN;
  p_JSONTypeDefinition_d35b868eeb7f TEXT;
  p_UserSearchPredicateAPI_d35b868eeb7f VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_d35b868eeb7f BOOLEAN;
  p_AutoUpdateFullTextSearch_d35b868eeb7f BOOLEAN;
  p_AutoUpdateExtendedType_d35b868eeb7f BOOLEAN;
  p_IsComputed_d35b868eeb7f BOOLEAN;
  p_EmbeddedRecord_d35b868eeb7f TEXT;
  p_Configuration_d35b868eeb7f TEXT;
  p_ID_d35b868eeb7f UUID;
BEGIN
  p_DisplayName_d35b868eeb7f := 'Approval Level';
  p_Description_d35b868eeb7f := 'Set when the entry needs approval: Standard (a holder of the company''s manual-entry approver role) or CFO (above the threshold, a line on a control account, or no other approver available). Set when a manual entry is created, or its amounts, accounts, date or company change, while its company has a ManualJournalEntryApprovalThreshold. An entry with a level is not a batch candidate until ApprovedAt is set. NULL: no approval needed.';
  p_AutoUpdateDescription_d35b868eeb7f := TRUE;
  p_IsPrimaryKey_d35b868eeb7f := FALSE;
  p_IsUnique_d35b868eeb7f := FALSE;
  p_Category_d35b868eeb7f := 'Approval';
  p_ValueListType_d35b868eeb7f := 'List';
  p_DefaultInView_d35b868eeb7f := FALSE;
  p_DefaultColumnWidth_d35b868eeb7f := 150;
  p_AllowUpdateAPI_d35b868eeb7f := TRUE;
  p_AllowUpdateInView_d35b868eeb7f := TRUE;
  p_IncludeInUserSearchAPI_d35b868eeb7f := FALSE;
  p_FullTextSearchEnabled_d35b868eeb7f := FALSE;
  p_IncludeInGeneratedForm_d35b868eeb7f := TRUE;
  p_GeneratedFormSection_d35b868eeb7f := 'Category';
  p_IsNameField_d35b868eeb7f := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_d35b868eeb7f := FALSE;
  p_RelatedEntityDisplayType_d35b868eeb7f := 'Search';
  p_AutoUpdateRelatedEntityInfo_d35b868eeb7f := TRUE;
  p_ValuesToPackWithSchema_d35b868eeb7f := 'Auto';
  p_Status_d35b868eeb7f := 'Active';
  p_AutoUpdateIsNameField_d35b868eeb7f := TRUE;
  p_AutoUpdateDefaultInView_d35b868eeb7f := TRUE;
  p_AutoUpdateCategory_d35b868eeb7f := TRUE;
  p_AutoUpdateDisplayName_d35b868eeb7f := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_d35b868eeb7f := TRUE;
  p_Encrypt_d35b868eeb7f := FALSE;
  p_AllowDecryptInAPI_d35b868eeb7f := FALSE;
  p_SendEncryptedValue_d35b868eeb7f := FALSE;
  p_IsSoftPrimaryKey_d35b868eeb7f := FALSE;
  p_IsSoftForeignKey_d35b868eeb7f := FALSE;
  p_JSONTypeIsArray_d35b868eeb7f := FALSE;
  p_UserSearchPredicateAPI_d35b868eeb7f := 'Contains';
  p_AutoUpdateUserSearchPredicate_d35b868eeb7f := TRUE;
  p_AutoUpdateFullTextSearch_d35b868eeb7f := TRUE;
  p_AutoUpdateExtendedType_d35b868eeb7f := TRUE;
  p_IsComputed_d35b868eeb7f := FALSE;
  p_ID_d35b868eeb7f := 'DCAE4C02-26FF-41E1-AF26-9E379453E38C';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM ${mjSchema}."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_d35b868eeb7f,
    'Description', p_Description_d35b868eeb7f,
    'AutoUpdateDescription', p_AutoUpdateDescription_d35b868eeb7f,
    'IsPrimaryKey', p_IsPrimaryKey_d35b868eeb7f,
    'IsUnique', p_IsUnique_d35b868eeb7f,
    'Category', p_Category_d35b868eeb7f,
    'ValueListType', p_ValueListType_d35b868eeb7f,
    'ExtendedType', p_ExtendedType_d35b868eeb7f,
    'CodeType', p_CodeType_d35b868eeb7f,
    'DefaultInView', p_DefaultInView_d35b868eeb7f,
    'ViewCellTemplate', p_ViewCellTemplate_d35b868eeb7f,
    'DefaultColumnWidth', p_DefaultColumnWidth_d35b868eeb7f,
    'AllowUpdateAPI', p_AllowUpdateAPI_d35b868eeb7f,
    'AllowUpdateInView', p_AllowUpdateInView_d35b868eeb7f,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_d35b868eeb7f,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_d35b868eeb7f,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_d35b868eeb7f,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_d35b868eeb7f,
    'GeneratedFormSection', p_GeneratedFormSection_d35b868eeb7f,
    'IsNameField', p_IsNameField_d35b868eeb7f,
    'RelatedEntityID', p_RelatedEntityID_d35b868eeb7f,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_d35b868eeb7f,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_d35b868eeb7f,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_d35b868eeb7f,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_d35b868eeb7f,
    'EntityIDFieldName', p_EntityIDFieldName_d35b868eeb7f,
    'ScopeDefault', p_ScopeDefault_d35b868eeb7f,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_d35b868eeb7f,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_d35b868eeb7f,
    'Status', p_Status_d35b868eeb7f,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_d35b868eeb7f,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_d35b868eeb7f,
    'AutoUpdateCategory', p_AutoUpdateCategory_d35b868eeb7f,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_d35b868eeb7f,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_d35b868eeb7f,
    'Encrypt', p_Encrypt_d35b868eeb7f,
    'EncryptionKeyID', p_EncryptionKeyID_d35b868eeb7f,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_d35b868eeb7f,
    'SendEncryptedValue', p_SendEncryptedValue_d35b868eeb7f,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_d35b868eeb7f,
    'IsSoftForeignKey', p_IsSoftForeignKey_d35b868eeb7f,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_d35b868eeb7f,
    'JSONType', p_JSONType_d35b868eeb7f,
    'JSONTypeIsArray', p_JSONTypeIsArray_d35b868eeb7f,
    'JSONTypeDefinition', p_JSONTypeDefinition_d35b868eeb7f,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_d35b868eeb7f,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_d35b868eeb7f,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_d35b868eeb7f,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_d35b868eeb7f,
    'IsComputed', p_IsComputed_d35b868eeb7f
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_d35b868eeb7f,
    'Configuration', p_Configuration_d35b868eeb7f,
    'ID', p_ID_d35b868eeb7f
  ));
  ELSE
    PERFORM ${mjSchema}."spUpdateEntityField"(p_DisplayName := p_DisplayName_d35b868eeb7f, p_Description := p_Description_d35b868eeb7f, p_AutoUpdateDescription := p_AutoUpdateDescription_d35b868eeb7f, p_IsPrimaryKey := p_IsPrimaryKey_d35b868eeb7f, p_IsUnique := p_IsUnique_d35b868eeb7f, p_Category := p_Category_d35b868eeb7f, p_ValueListType := p_ValueListType_d35b868eeb7f, p_ExtendedType := p_ExtendedType_d35b868eeb7f, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_d35b868eeb7f, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_d35b868eeb7f, p_ViewCellTemplate := p_ViewCellTemplate_d35b868eeb7f, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_d35b868eeb7f, p_AllowUpdateAPI := p_AllowUpdateAPI_d35b868eeb7f, p_AllowUpdateInView := p_AllowUpdateInView_d35b868eeb7f, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_d35b868eeb7f, p_FullTextSearchEnabled := p_FullTextSearchEnabled_d35b868eeb7f, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_d35b868eeb7f, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_d35b868eeb7f, p_GeneratedFormSection := p_GeneratedFormSection_d35b868eeb7f, p_IsNameField := p_IsNameField_d35b868eeb7f, p_RelatedEntityID := p_RelatedEntityID_d35b868eeb7f, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_d35b868eeb7f, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_d35b868eeb7f, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_d35b868eeb7f, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_d35b868eeb7f, p_EntityIDFieldName := p_EntityIDFieldName_d35b868eeb7f, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_d35b868eeb7f, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_d35b868eeb7f, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_d35b868eeb7f, p_Status := p_Status_d35b868eeb7f, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_d35b868eeb7f, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_d35b868eeb7f, p_AutoUpdateCategory := p_AutoUpdateCategory_d35b868eeb7f, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_d35b868eeb7f, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_d35b868eeb7f, p_Encrypt := p_Encrypt_d35b868eeb7f, p_EncryptionKeyID := p_EncryptionKeyID_d35b868eeb7f, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_d35b868eeb7f, p_SendEncryptedValue := p_SendEncryptedValue_d35b868eeb7f, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_d35b868eeb7f, p_IsSoftForeignKey := p_IsSoftForeignKey_d35b868eeb7f, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_d35b868eeb7f, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_d35b868eeb7f, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_d35b868eeb7f, p_JSONTypeDefinition := p_JSONTypeDefinition_d35b868eeb7f, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_d35b868eeb7f, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_d35b868eeb7f, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_d35b868eeb7f, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_d35b868eeb7f, p_IsComputed := p_IsComputed_d35b868eeb7f, p_EmbeddedRecord := p_EmbeddedRecord_d35b868eeb7f, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_d35b868eeb7f, p_Configuration_Clear := TRUE, p_ID := p_ID_d35b868eeb7f);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_2f3ec7cb2612 VARCHAR(255);
  p_Description_2f3ec7cb2612 TEXT;
  p_AutoUpdateDescription_2f3ec7cb2612 BOOLEAN;
  p_IsPrimaryKey_2f3ec7cb2612 BOOLEAN;
  p_IsUnique_2f3ec7cb2612 BOOLEAN;
  p_Category_2f3ec7cb2612 VARCHAR(255);
  p_ValueListType_2f3ec7cb2612 VARCHAR(20);
  p_ExtendedType_2f3ec7cb2612 VARCHAR(50);
  p_CodeType_2f3ec7cb2612 VARCHAR(50);
  p_DefaultInView_2f3ec7cb2612 BOOLEAN;
  p_ViewCellTemplate_2f3ec7cb2612 TEXT;
  p_DefaultColumnWidth_2f3ec7cb2612 INTEGER;
  p_AllowUpdateAPI_2f3ec7cb2612 BOOLEAN;
  p_AllowUpdateInView_2f3ec7cb2612 BOOLEAN;
  p_IncludeInUserSearchAPI_2f3ec7cb2612 BOOLEAN;
  p_FullTextSearchEnabled_2f3ec7cb2612 BOOLEAN;
  p_UserSearchParamFormatAPI_2f3ec7cb2612 VARCHAR(500);
  p_IncludeInGeneratedForm_2f3ec7cb2612 BOOLEAN;
  p_GeneratedFormSection_2f3ec7cb2612 VARCHAR(10);
  p_IsNameField_2f3ec7cb2612 BOOLEAN;
  p_RelatedEntityID_2f3ec7cb2612 UUID;
  p_RelatedEntityFieldName_2f3ec7cb2612 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_2f3ec7cb2612 BOOLEAN;
  p_RelatedEntityNameFieldMap_2f3ec7cb2612 VARCHAR(255);
  p_RelatedEntityDisplayType_2f3ec7cb2612 VARCHAR(20);
  p_EntityIDFieldName_2f3ec7cb2612 VARCHAR(100);
  p_ScopeDefault_2f3ec7cb2612 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_2f3ec7cb2612 BOOLEAN;
  p_ValuesToPackWithSchema_2f3ec7cb2612 VARCHAR(10);
  p_Status_2f3ec7cb2612 VARCHAR(25);
  p_AutoUpdateIsNameField_2f3ec7cb2612 BOOLEAN;
  p_AutoUpdateDefaultInView_2f3ec7cb2612 BOOLEAN;
  p_AutoUpdateCategory_2f3ec7cb2612 BOOLEAN;
  p_AutoUpdateDisplayName_2f3ec7cb2612 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_2f3ec7cb2612 BOOLEAN;
  p_Encrypt_2f3ec7cb2612 BOOLEAN;
  p_EncryptionKeyID_2f3ec7cb2612 UUID;
  p_AllowDecryptInAPI_2f3ec7cb2612 BOOLEAN;
  p_SendEncryptedValue_2f3ec7cb2612 BOOLEAN;
  p_IsSoftPrimaryKey_2f3ec7cb2612 BOOLEAN;
  p_IsSoftForeignKey_2f3ec7cb2612 BOOLEAN;
  p_RelatedEntityJoinFields_2f3ec7cb2612 TEXT;
  p_JSONType_2f3ec7cb2612 VARCHAR(255);
  p_JSONTypeIsArray_2f3ec7cb2612 BOOLEAN;
  p_JSONTypeDefinition_2f3ec7cb2612 TEXT;
  p_UserSearchPredicateAPI_2f3ec7cb2612 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_2f3ec7cb2612 BOOLEAN;
  p_AutoUpdateFullTextSearch_2f3ec7cb2612 BOOLEAN;
  p_AutoUpdateExtendedType_2f3ec7cb2612 BOOLEAN;
  p_IsComputed_2f3ec7cb2612 BOOLEAN;
  p_EmbeddedRecord_2f3ec7cb2612 TEXT;
  p_Configuration_2f3ec7cb2612 TEXT;
  p_ID_2f3ec7cb2612 UUID;
BEGIN
  p_DisplayName_2f3ec7cb2612 := 'Approval Requested By User ID';
  p_Description_2f3ec7cb2612 := 'The user whose save raised the current approval request: the creator, or whoever last changed the entry''s amounts, accounts, date or company. That user may not approve it. Set exactly when ApprovalLevel is.';
  p_AutoUpdateDescription_2f3ec7cb2612 := TRUE;
  p_IsPrimaryKey_2f3ec7cb2612 := FALSE;
  p_IsUnique_2f3ec7cb2612 := FALSE;
  p_Category_2f3ec7cb2612 := 'Approval';
  p_ValueListType_2f3ec7cb2612 := 'None';
  p_DefaultInView_2f3ec7cb2612 := FALSE;
  p_DefaultColumnWidth_2f3ec7cb2612 := 150;
  p_AllowUpdateAPI_2f3ec7cb2612 := TRUE;
  p_AllowUpdateInView_2f3ec7cb2612 := TRUE;
  p_IncludeInUserSearchAPI_2f3ec7cb2612 := FALSE;
  p_FullTextSearchEnabled_2f3ec7cb2612 := FALSE;
  p_IncludeInGeneratedForm_2f3ec7cb2612 := TRUE;
  p_GeneratedFormSection_2f3ec7cb2612 := 'Category';
  p_IsNameField_2f3ec7cb2612 := FALSE;
  p_RelatedEntityID_2f3ec7cb2612 := 'E1238F34-2837-EF11-86D4-6045BDEE16E6';
  p_RelatedEntityFieldName_2f3ec7cb2612 := 'ID';
  p_IncludeRelatedEntityNameFieldInBaseView_2f3ec7cb2612 := TRUE;
  p_RelatedEntityNameFieldMap_2f3ec7cb2612 := 'ApprovalRequestedByUser';
  p_RelatedEntityDisplayType_2f3ec7cb2612 := 'Search';
  p_AutoUpdateRelatedEntityInfo_2f3ec7cb2612 := TRUE;
  p_ValuesToPackWithSchema_2f3ec7cb2612 := 'Auto';
  p_Status_2f3ec7cb2612 := 'Active';
  p_AutoUpdateIsNameField_2f3ec7cb2612 := TRUE;
  p_AutoUpdateDefaultInView_2f3ec7cb2612 := TRUE;
  p_AutoUpdateCategory_2f3ec7cb2612 := TRUE;
  p_AutoUpdateDisplayName_2f3ec7cb2612 := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_2f3ec7cb2612 := TRUE;
  p_Encrypt_2f3ec7cb2612 := FALSE;
  p_AllowDecryptInAPI_2f3ec7cb2612 := FALSE;
  p_SendEncryptedValue_2f3ec7cb2612 := FALSE;
  p_IsSoftPrimaryKey_2f3ec7cb2612 := FALSE;
  p_IsSoftForeignKey_2f3ec7cb2612 := FALSE;
  p_JSONTypeIsArray_2f3ec7cb2612 := FALSE;
  p_UserSearchPredicateAPI_2f3ec7cb2612 := 'Contains';
  p_AutoUpdateUserSearchPredicate_2f3ec7cb2612 := TRUE;
  p_AutoUpdateFullTextSearch_2f3ec7cb2612 := TRUE;
  p_AutoUpdateExtendedType_2f3ec7cb2612 := TRUE;
  p_IsComputed_2f3ec7cb2612 := FALSE;
  p_ID_2f3ec7cb2612 := 'D2A395B8-61B0-4209-AA5E-C5E896B0C214';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM ${mjSchema}."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_2f3ec7cb2612,
    'Description', p_Description_2f3ec7cb2612,
    'AutoUpdateDescription', p_AutoUpdateDescription_2f3ec7cb2612,
    'IsPrimaryKey', p_IsPrimaryKey_2f3ec7cb2612,
    'IsUnique', p_IsUnique_2f3ec7cb2612,
    'Category', p_Category_2f3ec7cb2612,
    'ValueListType', p_ValueListType_2f3ec7cb2612,
    'ExtendedType', p_ExtendedType_2f3ec7cb2612,
    'CodeType', p_CodeType_2f3ec7cb2612,
    'DefaultInView', p_DefaultInView_2f3ec7cb2612,
    'ViewCellTemplate', p_ViewCellTemplate_2f3ec7cb2612,
    'DefaultColumnWidth', p_DefaultColumnWidth_2f3ec7cb2612,
    'AllowUpdateAPI', p_AllowUpdateAPI_2f3ec7cb2612,
    'AllowUpdateInView', p_AllowUpdateInView_2f3ec7cb2612,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_2f3ec7cb2612,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_2f3ec7cb2612,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_2f3ec7cb2612,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_2f3ec7cb2612,
    'GeneratedFormSection', p_GeneratedFormSection_2f3ec7cb2612,
    'IsNameField', p_IsNameField_2f3ec7cb2612,
    'RelatedEntityID', p_RelatedEntityID_2f3ec7cb2612,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_2f3ec7cb2612,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_2f3ec7cb2612,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_2f3ec7cb2612,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_2f3ec7cb2612,
    'EntityIDFieldName', p_EntityIDFieldName_2f3ec7cb2612,
    'ScopeDefault', p_ScopeDefault_2f3ec7cb2612,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_2f3ec7cb2612,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_2f3ec7cb2612,
    'Status', p_Status_2f3ec7cb2612,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_2f3ec7cb2612,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_2f3ec7cb2612,
    'AutoUpdateCategory', p_AutoUpdateCategory_2f3ec7cb2612,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_2f3ec7cb2612,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_2f3ec7cb2612,
    'Encrypt', p_Encrypt_2f3ec7cb2612,
    'EncryptionKeyID', p_EncryptionKeyID_2f3ec7cb2612,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_2f3ec7cb2612,
    'SendEncryptedValue', p_SendEncryptedValue_2f3ec7cb2612,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_2f3ec7cb2612,
    'IsSoftForeignKey', p_IsSoftForeignKey_2f3ec7cb2612,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_2f3ec7cb2612,
    'JSONType', p_JSONType_2f3ec7cb2612,
    'JSONTypeIsArray', p_JSONTypeIsArray_2f3ec7cb2612,
    'JSONTypeDefinition', p_JSONTypeDefinition_2f3ec7cb2612,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_2f3ec7cb2612,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_2f3ec7cb2612,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_2f3ec7cb2612,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_2f3ec7cb2612,
    'IsComputed', p_IsComputed_2f3ec7cb2612
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_2f3ec7cb2612,
    'Configuration', p_Configuration_2f3ec7cb2612,
    'ID', p_ID_2f3ec7cb2612
  ));
  ELSE
    PERFORM ${mjSchema}."spUpdateEntityField"(p_DisplayName := p_DisplayName_2f3ec7cb2612, p_Description := p_Description_2f3ec7cb2612, p_AutoUpdateDescription := p_AutoUpdateDescription_2f3ec7cb2612, p_IsPrimaryKey := p_IsPrimaryKey_2f3ec7cb2612, p_IsUnique := p_IsUnique_2f3ec7cb2612, p_Category := p_Category_2f3ec7cb2612, p_ValueListType := p_ValueListType_2f3ec7cb2612, p_ExtendedType := p_ExtendedType_2f3ec7cb2612, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_2f3ec7cb2612, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_2f3ec7cb2612, p_ViewCellTemplate := p_ViewCellTemplate_2f3ec7cb2612, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_2f3ec7cb2612, p_AllowUpdateAPI := p_AllowUpdateAPI_2f3ec7cb2612, p_AllowUpdateInView := p_AllowUpdateInView_2f3ec7cb2612, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_2f3ec7cb2612, p_FullTextSearchEnabled := p_FullTextSearchEnabled_2f3ec7cb2612, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_2f3ec7cb2612, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_2f3ec7cb2612, p_GeneratedFormSection := p_GeneratedFormSection_2f3ec7cb2612, p_IsNameField := p_IsNameField_2f3ec7cb2612, p_RelatedEntityID := p_RelatedEntityID_2f3ec7cb2612, p_RelatedEntityFieldName := p_RelatedEntityFieldName_2f3ec7cb2612, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_2f3ec7cb2612, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_2f3ec7cb2612, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_2f3ec7cb2612, p_EntityIDFieldName := p_EntityIDFieldName_2f3ec7cb2612, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_2f3ec7cb2612, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_2f3ec7cb2612, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_2f3ec7cb2612, p_Status := p_Status_2f3ec7cb2612, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_2f3ec7cb2612, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_2f3ec7cb2612, p_AutoUpdateCategory := p_AutoUpdateCategory_2f3ec7cb2612, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_2f3ec7cb2612, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_2f3ec7cb2612, p_Encrypt := p_Encrypt_2f3ec7cb2612, p_EncryptionKeyID := p_EncryptionKeyID_2f3ec7cb2612, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_2f3ec7cb2612, p_SendEncryptedValue := p_SendEncryptedValue_2f3ec7cb2612, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_2f3ec7cb2612, p_IsSoftForeignKey := p_IsSoftForeignKey_2f3ec7cb2612, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_2f3ec7cb2612, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_2f3ec7cb2612, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_2f3ec7cb2612, p_JSONTypeDefinition := p_JSONTypeDefinition_2f3ec7cb2612, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_2f3ec7cb2612, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_2f3ec7cb2612, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_2f3ec7cb2612, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_2f3ec7cb2612, p_IsComputed := p_IsComputed_2f3ec7cb2612, p_EmbeddedRecord := p_EmbeddedRecord_2f3ec7cb2612, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_2f3ec7cb2612, p_Configuration_Clear := TRUE, p_ID := p_ID_2f3ec7cb2612);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_57141ae6d01d VARCHAR(255);
  p_Description_57141ae6d01d TEXT;
  p_AutoUpdateDescription_57141ae6d01d BOOLEAN;
  p_IsPrimaryKey_57141ae6d01d BOOLEAN;
  p_IsUnique_57141ae6d01d BOOLEAN;
  p_Category_57141ae6d01d VARCHAR(255);
  p_ValueListType_57141ae6d01d VARCHAR(20);
  p_ExtendedType_57141ae6d01d VARCHAR(50);
  p_CodeType_57141ae6d01d VARCHAR(50);
  p_DefaultInView_57141ae6d01d BOOLEAN;
  p_ViewCellTemplate_57141ae6d01d TEXT;
  p_DefaultColumnWidth_57141ae6d01d INTEGER;
  p_AllowUpdateAPI_57141ae6d01d BOOLEAN;
  p_AllowUpdateInView_57141ae6d01d BOOLEAN;
  p_IncludeInUserSearchAPI_57141ae6d01d BOOLEAN;
  p_FullTextSearchEnabled_57141ae6d01d BOOLEAN;
  p_UserSearchParamFormatAPI_57141ae6d01d VARCHAR(500);
  p_IncludeInGeneratedForm_57141ae6d01d BOOLEAN;
  p_GeneratedFormSection_57141ae6d01d VARCHAR(10);
  p_IsNameField_57141ae6d01d BOOLEAN;
  p_RelatedEntityID_57141ae6d01d UUID;
  p_RelatedEntityFieldName_57141ae6d01d VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_57141ae6d01d BOOLEAN;
  p_RelatedEntityNameFieldMap_57141ae6d01d VARCHAR(255);
  p_RelatedEntityDisplayType_57141ae6d01d VARCHAR(20);
  p_EntityIDFieldName_57141ae6d01d VARCHAR(100);
  p_ScopeDefault_57141ae6d01d VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_57141ae6d01d BOOLEAN;
  p_ValuesToPackWithSchema_57141ae6d01d VARCHAR(10);
  p_Status_57141ae6d01d VARCHAR(25);
  p_AutoUpdateIsNameField_57141ae6d01d BOOLEAN;
  p_AutoUpdateDefaultInView_57141ae6d01d BOOLEAN;
  p_AutoUpdateCategory_57141ae6d01d BOOLEAN;
  p_AutoUpdateDisplayName_57141ae6d01d BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_57141ae6d01d BOOLEAN;
  p_Encrypt_57141ae6d01d BOOLEAN;
  p_EncryptionKeyID_57141ae6d01d UUID;
  p_AllowDecryptInAPI_57141ae6d01d BOOLEAN;
  p_SendEncryptedValue_57141ae6d01d BOOLEAN;
  p_IsSoftPrimaryKey_57141ae6d01d BOOLEAN;
  p_IsSoftForeignKey_57141ae6d01d BOOLEAN;
  p_RelatedEntityJoinFields_57141ae6d01d TEXT;
  p_JSONType_57141ae6d01d VARCHAR(255);
  p_JSONTypeIsArray_57141ae6d01d BOOLEAN;
  p_JSONTypeDefinition_57141ae6d01d TEXT;
  p_UserSearchPredicateAPI_57141ae6d01d VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_57141ae6d01d BOOLEAN;
  p_AutoUpdateFullTextSearch_57141ae6d01d BOOLEAN;
  p_AutoUpdateExtendedType_57141ae6d01d BOOLEAN;
  p_IsComputed_57141ae6d01d BOOLEAN;
  p_EmbeddedRecord_57141ae6d01d TEXT;
  p_Configuration_57141ae6d01d TEXT;
  p_ID_57141ae6d01d UUID;
BEGIN
  p_DisplayName_57141ae6d01d := 'Approval Task ID';
  p_Description_57141ae6d01d := 'The approval Task raised for this manual entry, stamped in the same transaction. The approval is read from this column, never from a Task Link.';
  p_AutoUpdateDescription_57141ae6d01d := TRUE;
  p_IsPrimaryKey_57141ae6d01d := FALSE;
  p_IsUnique_57141ae6d01d := FALSE;
  p_Category_57141ae6d01d := 'Approval';
  p_ValueListType_57141ae6d01d := 'None';
  p_DefaultInView_57141ae6d01d := FALSE;
  p_DefaultColumnWidth_57141ae6d01d := 150;
  p_AllowUpdateAPI_57141ae6d01d := TRUE;
  p_AllowUpdateInView_57141ae6d01d := TRUE;
  p_IncludeInUserSearchAPI_57141ae6d01d := FALSE;
  p_FullTextSearchEnabled_57141ae6d01d := FALSE;
  p_IncludeInGeneratedForm_57141ae6d01d := TRUE;
  p_GeneratedFormSection_57141ae6d01d := 'Category';
  p_IsNameField_57141ae6d01d := FALSE;
  p_RelatedEntityID_57141ae6d01d := 'B348FFA2-B1A7-4AC2-B6FD-F4E0C0697466';
  p_RelatedEntityFieldName_57141ae6d01d := 'ID';
  p_IncludeRelatedEntityNameFieldInBaseView_57141ae6d01d := TRUE;
  p_RelatedEntityNameFieldMap_57141ae6d01d := 'ApprovalTask';
  p_RelatedEntityDisplayType_57141ae6d01d := 'Search';
  p_AutoUpdateRelatedEntityInfo_57141ae6d01d := TRUE;
  p_ValuesToPackWithSchema_57141ae6d01d := 'Auto';
  p_Status_57141ae6d01d := 'Active';
  p_AutoUpdateIsNameField_57141ae6d01d := TRUE;
  p_AutoUpdateDefaultInView_57141ae6d01d := TRUE;
  p_AutoUpdateCategory_57141ae6d01d := TRUE;
  p_AutoUpdateDisplayName_57141ae6d01d := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_57141ae6d01d := TRUE;
  p_Encrypt_57141ae6d01d := FALSE;
  p_AllowDecryptInAPI_57141ae6d01d := FALSE;
  p_SendEncryptedValue_57141ae6d01d := FALSE;
  p_IsSoftPrimaryKey_57141ae6d01d := FALSE;
  p_IsSoftForeignKey_57141ae6d01d := FALSE;
  p_JSONTypeIsArray_57141ae6d01d := FALSE;
  p_UserSearchPredicateAPI_57141ae6d01d := 'Contains';
  p_AutoUpdateUserSearchPredicate_57141ae6d01d := TRUE;
  p_AutoUpdateFullTextSearch_57141ae6d01d := TRUE;
  p_AutoUpdateExtendedType_57141ae6d01d := TRUE;
  p_IsComputed_57141ae6d01d := FALSE;
  p_ID_57141ae6d01d := '3B9807DE-48E1-40CB-977D-F78C79B23D90';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM ${mjSchema}."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_57141ae6d01d,
    'Description', p_Description_57141ae6d01d,
    'AutoUpdateDescription', p_AutoUpdateDescription_57141ae6d01d,
    'IsPrimaryKey', p_IsPrimaryKey_57141ae6d01d,
    'IsUnique', p_IsUnique_57141ae6d01d,
    'Category', p_Category_57141ae6d01d,
    'ValueListType', p_ValueListType_57141ae6d01d,
    'ExtendedType', p_ExtendedType_57141ae6d01d,
    'CodeType', p_CodeType_57141ae6d01d,
    'DefaultInView', p_DefaultInView_57141ae6d01d,
    'ViewCellTemplate', p_ViewCellTemplate_57141ae6d01d,
    'DefaultColumnWidth', p_DefaultColumnWidth_57141ae6d01d,
    'AllowUpdateAPI', p_AllowUpdateAPI_57141ae6d01d,
    'AllowUpdateInView', p_AllowUpdateInView_57141ae6d01d,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_57141ae6d01d,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_57141ae6d01d,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_57141ae6d01d,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_57141ae6d01d,
    'GeneratedFormSection', p_GeneratedFormSection_57141ae6d01d,
    'IsNameField', p_IsNameField_57141ae6d01d,
    'RelatedEntityID', p_RelatedEntityID_57141ae6d01d,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_57141ae6d01d,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_57141ae6d01d,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_57141ae6d01d,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_57141ae6d01d,
    'EntityIDFieldName', p_EntityIDFieldName_57141ae6d01d,
    'ScopeDefault', p_ScopeDefault_57141ae6d01d,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_57141ae6d01d,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_57141ae6d01d,
    'Status', p_Status_57141ae6d01d,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_57141ae6d01d,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_57141ae6d01d,
    'AutoUpdateCategory', p_AutoUpdateCategory_57141ae6d01d,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_57141ae6d01d,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_57141ae6d01d,
    'Encrypt', p_Encrypt_57141ae6d01d,
    'EncryptionKeyID', p_EncryptionKeyID_57141ae6d01d,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_57141ae6d01d,
    'SendEncryptedValue', p_SendEncryptedValue_57141ae6d01d,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_57141ae6d01d,
    'IsSoftForeignKey', p_IsSoftForeignKey_57141ae6d01d,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_57141ae6d01d,
    'JSONType', p_JSONType_57141ae6d01d,
    'JSONTypeIsArray', p_JSONTypeIsArray_57141ae6d01d,
    'JSONTypeDefinition', p_JSONTypeDefinition_57141ae6d01d,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_57141ae6d01d,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_57141ae6d01d,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_57141ae6d01d,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_57141ae6d01d,
    'IsComputed', p_IsComputed_57141ae6d01d
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_57141ae6d01d,
    'Configuration', p_Configuration_57141ae6d01d,
    'ID', p_ID_57141ae6d01d
  ));
  ELSE
    PERFORM ${mjSchema}."spUpdateEntityField"(p_DisplayName := p_DisplayName_57141ae6d01d, p_Description := p_Description_57141ae6d01d, p_AutoUpdateDescription := p_AutoUpdateDescription_57141ae6d01d, p_IsPrimaryKey := p_IsPrimaryKey_57141ae6d01d, p_IsUnique := p_IsUnique_57141ae6d01d, p_Category := p_Category_57141ae6d01d, p_ValueListType := p_ValueListType_57141ae6d01d, p_ExtendedType := p_ExtendedType_57141ae6d01d, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_57141ae6d01d, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_57141ae6d01d, p_ViewCellTemplate := p_ViewCellTemplate_57141ae6d01d, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_57141ae6d01d, p_AllowUpdateAPI := p_AllowUpdateAPI_57141ae6d01d, p_AllowUpdateInView := p_AllowUpdateInView_57141ae6d01d, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_57141ae6d01d, p_FullTextSearchEnabled := p_FullTextSearchEnabled_57141ae6d01d, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_57141ae6d01d, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_57141ae6d01d, p_GeneratedFormSection := p_GeneratedFormSection_57141ae6d01d, p_IsNameField := p_IsNameField_57141ae6d01d, p_RelatedEntityID := p_RelatedEntityID_57141ae6d01d, p_RelatedEntityFieldName := p_RelatedEntityFieldName_57141ae6d01d, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_57141ae6d01d, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_57141ae6d01d, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_57141ae6d01d, p_EntityIDFieldName := p_EntityIDFieldName_57141ae6d01d, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_57141ae6d01d, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_57141ae6d01d, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_57141ae6d01d, p_Status := p_Status_57141ae6d01d, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_57141ae6d01d, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_57141ae6d01d, p_AutoUpdateCategory := p_AutoUpdateCategory_57141ae6d01d, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_57141ae6d01d, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_57141ae6d01d, p_Encrypt := p_Encrypt_57141ae6d01d, p_EncryptionKeyID := p_EncryptionKeyID_57141ae6d01d, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_57141ae6d01d, p_SendEncryptedValue := p_SendEncryptedValue_57141ae6d01d, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_57141ae6d01d, p_IsSoftForeignKey := p_IsSoftForeignKey_57141ae6d01d, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_57141ae6d01d, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_57141ae6d01d, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_57141ae6d01d, p_JSONTypeDefinition := p_JSONTypeDefinition_57141ae6d01d, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_57141ae6d01d, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_57141ae6d01d, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_57141ae6d01d, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_57141ae6d01d, p_IsComputed := p_IsComputed_57141ae6d01d, p_EmbeddedRecord := p_EmbeddedRecord_57141ae6d01d, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_57141ae6d01d, p_Configuration_Clear := TRUE, p_ID := p_ID_57141ae6d01d);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_618969781505 VARCHAR(255);
  p_Description_618969781505 TEXT;
  p_AutoUpdateDescription_618969781505 BOOLEAN;
  p_IsPrimaryKey_618969781505 BOOLEAN;
  p_IsUnique_618969781505 BOOLEAN;
  p_Category_618969781505 VARCHAR(255);
  p_ValueListType_618969781505 VARCHAR(20);
  p_ExtendedType_618969781505 VARCHAR(50);
  p_CodeType_618969781505 VARCHAR(50);
  p_DefaultInView_618969781505 BOOLEAN;
  p_ViewCellTemplate_618969781505 TEXT;
  p_DefaultColumnWidth_618969781505 INTEGER;
  p_AllowUpdateAPI_618969781505 BOOLEAN;
  p_AllowUpdateInView_618969781505 BOOLEAN;
  p_IncludeInUserSearchAPI_618969781505 BOOLEAN;
  p_FullTextSearchEnabled_618969781505 BOOLEAN;
  p_UserSearchParamFormatAPI_618969781505 VARCHAR(500);
  p_IncludeInGeneratedForm_618969781505 BOOLEAN;
  p_GeneratedFormSection_618969781505 VARCHAR(10);
  p_IsNameField_618969781505 BOOLEAN;
  p_RelatedEntityID_618969781505 UUID;
  p_RelatedEntityFieldName_618969781505 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_618969781505 BOOLEAN;
  p_RelatedEntityNameFieldMap_618969781505 VARCHAR(255);
  p_RelatedEntityDisplayType_618969781505 VARCHAR(20);
  p_EntityIDFieldName_618969781505 VARCHAR(100);
  p_ScopeDefault_618969781505 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_618969781505 BOOLEAN;
  p_ValuesToPackWithSchema_618969781505 VARCHAR(10);
  p_Status_618969781505 VARCHAR(25);
  p_AutoUpdateIsNameField_618969781505 BOOLEAN;
  p_AutoUpdateDefaultInView_618969781505 BOOLEAN;
  p_AutoUpdateCategory_618969781505 BOOLEAN;
  p_AutoUpdateDisplayName_618969781505 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_618969781505 BOOLEAN;
  p_Encrypt_618969781505 BOOLEAN;
  p_EncryptionKeyID_618969781505 UUID;
  p_AllowDecryptInAPI_618969781505 BOOLEAN;
  p_SendEncryptedValue_618969781505 BOOLEAN;
  p_IsSoftPrimaryKey_618969781505 BOOLEAN;
  p_IsSoftForeignKey_618969781505 BOOLEAN;
  p_RelatedEntityJoinFields_618969781505 TEXT;
  p_JSONType_618969781505 VARCHAR(255);
  p_JSONTypeIsArray_618969781505 BOOLEAN;
  p_JSONTypeDefinition_618969781505 TEXT;
  p_UserSearchPredicateAPI_618969781505 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_618969781505 BOOLEAN;
  p_AutoUpdateFullTextSearch_618969781505 BOOLEAN;
  p_AutoUpdateExtendedType_618969781505 BOOLEAN;
  p_IsComputed_618969781505 BOOLEAN;
  p_EmbeddedRecord_618969781505 TEXT;
  p_Configuration_618969781505 TEXT;
  p_ID_618969781505 UUID;
BEGIN
  p_DisplayName_618969781505 := 'Approved At';
  p_Description_618969781505 := 'When the manual entry was approved. Set together with ApprovedByUserID, only on an entry with an ApprovalLevel; cleared when the entry''s amounts, accounts, date or company change afterwards.';
  p_AutoUpdateDescription_618969781505 := TRUE;
  p_IsPrimaryKey_618969781505 := FALSE;
  p_IsUnique_618969781505 := FALSE;
  p_Category_618969781505 := 'Approval';
  p_ValueListType_618969781505 := 'None';
  p_DefaultInView_618969781505 := FALSE;
  p_DefaultColumnWidth_618969781505 := 100;
  p_AllowUpdateAPI_618969781505 := TRUE;
  p_AllowUpdateInView_618969781505 := TRUE;
  p_IncludeInUserSearchAPI_618969781505 := FALSE;
  p_FullTextSearchEnabled_618969781505 := FALSE;
  p_IncludeInGeneratedForm_618969781505 := TRUE;
  p_GeneratedFormSection_618969781505 := 'Category';
  p_IsNameField_618969781505 := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_618969781505 := FALSE;
  p_RelatedEntityDisplayType_618969781505 := 'Search';
  p_AutoUpdateRelatedEntityInfo_618969781505 := TRUE;
  p_ValuesToPackWithSchema_618969781505 := 'Auto';
  p_Status_618969781505 := 'Active';
  p_AutoUpdateIsNameField_618969781505 := TRUE;
  p_AutoUpdateDefaultInView_618969781505 := TRUE;
  p_AutoUpdateCategory_618969781505 := TRUE;
  p_AutoUpdateDisplayName_618969781505 := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_618969781505 := TRUE;
  p_Encrypt_618969781505 := FALSE;
  p_AllowDecryptInAPI_618969781505 := FALSE;
  p_SendEncryptedValue_618969781505 := FALSE;
  p_IsSoftPrimaryKey_618969781505 := FALSE;
  p_IsSoftForeignKey_618969781505 := FALSE;
  p_JSONTypeIsArray_618969781505 := FALSE;
  p_UserSearchPredicateAPI_618969781505 := 'Contains';
  p_AutoUpdateUserSearchPredicate_618969781505 := TRUE;
  p_AutoUpdateFullTextSearch_618969781505 := TRUE;
  p_AutoUpdateExtendedType_618969781505 := TRUE;
  p_IsComputed_618969781505 := FALSE;
  p_ID_618969781505 := '9027A89C-AB6C-41FC-8636-943ABA82AD8E';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM ${mjSchema}."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_618969781505,
    'Description', p_Description_618969781505,
    'AutoUpdateDescription', p_AutoUpdateDescription_618969781505,
    'IsPrimaryKey', p_IsPrimaryKey_618969781505,
    'IsUnique', p_IsUnique_618969781505,
    'Category', p_Category_618969781505,
    'ValueListType', p_ValueListType_618969781505,
    'ExtendedType', p_ExtendedType_618969781505,
    'CodeType', p_CodeType_618969781505,
    'DefaultInView', p_DefaultInView_618969781505,
    'ViewCellTemplate', p_ViewCellTemplate_618969781505,
    'DefaultColumnWidth', p_DefaultColumnWidth_618969781505,
    'AllowUpdateAPI', p_AllowUpdateAPI_618969781505,
    'AllowUpdateInView', p_AllowUpdateInView_618969781505,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_618969781505,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_618969781505,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_618969781505,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_618969781505,
    'GeneratedFormSection', p_GeneratedFormSection_618969781505,
    'IsNameField', p_IsNameField_618969781505,
    'RelatedEntityID', p_RelatedEntityID_618969781505,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_618969781505,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_618969781505,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_618969781505,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_618969781505,
    'EntityIDFieldName', p_EntityIDFieldName_618969781505,
    'ScopeDefault', p_ScopeDefault_618969781505,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_618969781505,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_618969781505,
    'Status', p_Status_618969781505,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_618969781505,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_618969781505,
    'AutoUpdateCategory', p_AutoUpdateCategory_618969781505,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_618969781505,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_618969781505,
    'Encrypt', p_Encrypt_618969781505,
    'EncryptionKeyID', p_EncryptionKeyID_618969781505,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_618969781505,
    'SendEncryptedValue', p_SendEncryptedValue_618969781505,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_618969781505,
    'IsSoftForeignKey', p_IsSoftForeignKey_618969781505,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_618969781505,
    'JSONType', p_JSONType_618969781505,
    'JSONTypeIsArray', p_JSONTypeIsArray_618969781505,
    'JSONTypeDefinition', p_JSONTypeDefinition_618969781505,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_618969781505,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_618969781505,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_618969781505,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_618969781505,
    'IsComputed', p_IsComputed_618969781505
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_618969781505,
    'Configuration', p_Configuration_618969781505,
    'ID', p_ID_618969781505
  ));
  ELSE
    PERFORM ${mjSchema}."spUpdateEntityField"(p_DisplayName := p_DisplayName_618969781505, p_Description := p_Description_618969781505, p_AutoUpdateDescription := p_AutoUpdateDescription_618969781505, p_IsPrimaryKey := p_IsPrimaryKey_618969781505, p_IsUnique := p_IsUnique_618969781505, p_Category := p_Category_618969781505, p_ValueListType := p_ValueListType_618969781505, p_ExtendedType := p_ExtendedType_618969781505, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_618969781505, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_618969781505, p_ViewCellTemplate := p_ViewCellTemplate_618969781505, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_618969781505, p_AllowUpdateAPI := p_AllowUpdateAPI_618969781505, p_AllowUpdateInView := p_AllowUpdateInView_618969781505, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_618969781505, p_FullTextSearchEnabled := p_FullTextSearchEnabled_618969781505, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_618969781505, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_618969781505, p_GeneratedFormSection := p_GeneratedFormSection_618969781505, p_IsNameField := p_IsNameField_618969781505, p_RelatedEntityID := p_RelatedEntityID_618969781505, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_618969781505, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_618969781505, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_618969781505, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_618969781505, p_EntityIDFieldName := p_EntityIDFieldName_618969781505, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_618969781505, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_618969781505, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_618969781505, p_Status := p_Status_618969781505, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_618969781505, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_618969781505, p_AutoUpdateCategory := p_AutoUpdateCategory_618969781505, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_618969781505, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_618969781505, p_Encrypt := p_Encrypt_618969781505, p_EncryptionKeyID := p_EncryptionKeyID_618969781505, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_618969781505, p_SendEncryptedValue := p_SendEncryptedValue_618969781505, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_618969781505, p_IsSoftForeignKey := p_IsSoftForeignKey_618969781505, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_618969781505, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_618969781505, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_618969781505, p_JSONTypeDefinition := p_JSONTypeDefinition_618969781505, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_618969781505, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_618969781505, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_618969781505, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_618969781505, p_IsComputed := p_IsComputed_618969781505, p_EmbeddedRecord := p_EmbeddedRecord_618969781505, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_618969781505, p_Configuration_Clear := TRUE, p_ID := p_ID_618969781505);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_c7f73a15d17c VARCHAR(255);
  p_Description_c7f73a15d17c TEXT;
  p_AutoUpdateDescription_c7f73a15d17c BOOLEAN;
  p_IsPrimaryKey_c7f73a15d17c BOOLEAN;
  p_IsUnique_c7f73a15d17c BOOLEAN;
  p_Category_c7f73a15d17c VARCHAR(255);
  p_ValueListType_c7f73a15d17c VARCHAR(20);
  p_ExtendedType_c7f73a15d17c VARCHAR(50);
  p_CodeType_c7f73a15d17c VARCHAR(50);
  p_DefaultInView_c7f73a15d17c BOOLEAN;
  p_ViewCellTemplate_c7f73a15d17c TEXT;
  p_DefaultColumnWidth_c7f73a15d17c INTEGER;
  p_AllowUpdateAPI_c7f73a15d17c BOOLEAN;
  p_AllowUpdateInView_c7f73a15d17c BOOLEAN;
  p_IncludeInUserSearchAPI_c7f73a15d17c BOOLEAN;
  p_FullTextSearchEnabled_c7f73a15d17c BOOLEAN;
  p_UserSearchParamFormatAPI_c7f73a15d17c VARCHAR(500);
  p_IncludeInGeneratedForm_c7f73a15d17c BOOLEAN;
  p_GeneratedFormSection_c7f73a15d17c VARCHAR(10);
  p_IsNameField_c7f73a15d17c BOOLEAN;
  p_RelatedEntityID_c7f73a15d17c UUID;
  p_RelatedEntityFieldName_c7f73a15d17c VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_c7f73a15d17c BOOLEAN;
  p_RelatedEntityNameFieldMap_c7f73a15d17c VARCHAR(255);
  p_RelatedEntityDisplayType_c7f73a15d17c VARCHAR(20);
  p_EntityIDFieldName_c7f73a15d17c VARCHAR(100);
  p_ScopeDefault_c7f73a15d17c VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_c7f73a15d17c BOOLEAN;
  p_ValuesToPackWithSchema_c7f73a15d17c VARCHAR(10);
  p_Status_c7f73a15d17c VARCHAR(25);
  p_AutoUpdateIsNameField_c7f73a15d17c BOOLEAN;
  p_AutoUpdateDefaultInView_c7f73a15d17c BOOLEAN;
  p_AutoUpdateCategory_c7f73a15d17c BOOLEAN;
  p_AutoUpdateDisplayName_c7f73a15d17c BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_c7f73a15d17c BOOLEAN;
  p_Encrypt_c7f73a15d17c BOOLEAN;
  p_EncryptionKeyID_c7f73a15d17c UUID;
  p_AllowDecryptInAPI_c7f73a15d17c BOOLEAN;
  p_SendEncryptedValue_c7f73a15d17c BOOLEAN;
  p_IsSoftPrimaryKey_c7f73a15d17c BOOLEAN;
  p_IsSoftForeignKey_c7f73a15d17c BOOLEAN;
  p_RelatedEntityJoinFields_c7f73a15d17c TEXT;
  p_JSONType_c7f73a15d17c VARCHAR(255);
  p_JSONTypeIsArray_c7f73a15d17c BOOLEAN;
  p_JSONTypeDefinition_c7f73a15d17c TEXT;
  p_UserSearchPredicateAPI_c7f73a15d17c VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_c7f73a15d17c BOOLEAN;
  p_AutoUpdateFullTextSearch_c7f73a15d17c BOOLEAN;
  p_AutoUpdateExtendedType_c7f73a15d17c BOOLEAN;
  p_IsComputed_c7f73a15d17c BOOLEAN;
  p_EmbeddedRecord_c7f73a15d17c TEXT;
  p_Configuration_c7f73a15d17c TEXT;
  p_ID_c7f73a15d17c UUID;
BEGIN
  p_DisplayName_c7f73a15d17c := 'Approved By User ID';
  p_Description_c7f73a15d17c := 'The user who approved the manual entry: never ApprovalRequestedByUserID. Set together with ApprovedAt.';
  p_AutoUpdateDescription_c7f73a15d17c := TRUE;
  p_IsPrimaryKey_c7f73a15d17c := FALSE;
  p_IsUnique_c7f73a15d17c := FALSE;
  p_Category_c7f73a15d17c := 'Approval';
  p_ValueListType_c7f73a15d17c := 'None';
  p_DefaultInView_c7f73a15d17c := FALSE;
  p_DefaultColumnWidth_c7f73a15d17c := 150;
  p_AllowUpdateAPI_c7f73a15d17c := TRUE;
  p_AllowUpdateInView_c7f73a15d17c := TRUE;
  p_IncludeInUserSearchAPI_c7f73a15d17c := FALSE;
  p_FullTextSearchEnabled_c7f73a15d17c := FALSE;
  p_IncludeInGeneratedForm_c7f73a15d17c := TRUE;
  p_GeneratedFormSection_c7f73a15d17c := 'Category';
  p_IsNameField_c7f73a15d17c := FALSE;
  p_RelatedEntityID_c7f73a15d17c := 'E1238F34-2837-EF11-86D4-6045BDEE16E6';
  p_RelatedEntityFieldName_c7f73a15d17c := 'ID';
  p_IncludeRelatedEntityNameFieldInBaseView_c7f73a15d17c := TRUE;
  p_RelatedEntityNameFieldMap_c7f73a15d17c := 'ApprovedByUser';
  p_RelatedEntityDisplayType_c7f73a15d17c := 'Search';
  p_AutoUpdateRelatedEntityInfo_c7f73a15d17c := TRUE;
  p_ValuesToPackWithSchema_c7f73a15d17c := 'Auto';
  p_Status_c7f73a15d17c := 'Active';
  p_AutoUpdateIsNameField_c7f73a15d17c := TRUE;
  p_AutoUpdateDefaultInView_c7f73a15d17c := TRUE;
  p_AutoUpdateCategory_c7f73a15d17c := TRUE;
  p_AutoUpdateDisplayName_c7f73a15d17c := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_c7f73a15d17c := TRUE;
  p_Encrypt_c7f73a15d17c := FALSE;
  p_AllowDecryptInAPI_c7f73a15d17c := FALSE;
  p_SendEncryptedValue_c7f73a15d17c := FALSE;
  p_IsSoftPrimaryKey_c7f73a15d17c := FALSE;
  p_IsSoftForeignKey_c7f73a15d17c := FALSE;
  p_JSONTypeIsArray_c7f73a15d17c := FALSE;
  p_UserSearchPredicateAPI_c7f73a15d17c := 'Contains';
  p_AutoUpdateUserSearchPredicate_c7f73a15d17c := TRUE;
  p_AutoUpdateFullTextSearch_c7f73a15d17c := TRUE;
  p_AutoUpdateExtendedType_c7f73a15d17c := TRUE;
  p_IsComputed_c7f73a15d17c := FALSE;
  p_ID_c7f73a15d17c := '19391880-F1A2-424E-838E-97B3929B4FD6';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM ${mjSchema}."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_c7f73a15d17c,
    'Description', p_Description_c7f73a15d17c,
    'AutoUpdateDescription', p_AutoUpdateDescription_c7f73a15d17c,
    'IsPrimaryKey', p_IsPrimaryKey_c7f73a15d17c,
    'IsUnique', p_IsUnique_c7f73a15d17c,
    'Category', p_Category_c7f73a15d17c,
    'ValueListType', p_ValueListType_c7f73a15d17c,
    'ExtendedType', p_ExtendedType_c7f73a15d17c,
    'CodeType', p_CodeType_c7f73a15d17c,
    'DefaultInView', p_DefaultInView_c7f73a15d17c,
    'ViewCellTemplate', p_ViewCellTemplate_c7f73a15d17c,
    'DefaultColumnWidth', p_DefaultColumnWidth_c7f73a15d17c,
    'AllowUpdateAPI', p_AllowUpdateAPI_c7f73a15d17c,
    'AllowUpdateInView', p_AllowUpdateInView_c7f73a15d17c,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_c7f73a15d17c,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_c7f73a15d17c,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_c7f73a15d17c,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_c7f73a15d17c,
    'GeneratedFormSection', p_GeneratedFormSection_c7f73a15d17c,
    'IsNameField', p_IsNameField_c7f73a15d17c,
    'RelatedEntityID', p_RelatedEntityID_c7f73a15d17c,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_c7f73a15d17c,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_c7f73a15d17c,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_c7f73a15d17c,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_c7f73a15d17c,
    'EntityIDFieldName', p_EntityIDFieldName_c7f73a15d17c,
    'ScopeDefault', p_ScopeDefault_c7f73a15d17c,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_c7f73a15d17c,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_c7f73a15d17c,
    'Status', p_Status_c7f73a15d17c,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_c7f73a15d17c,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_c7f73a15d17c,
    'AutoUpdateCategory', p_AutoUpdateCategory_c7f73a15d17c,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_c7f73a15d17c,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_c7f73a15d17c,
    'Encrypt', p_Encrypt_c7f73a15d17c,
    'EncryptionKeyID', p_EncryptionKeyID_c7f73a15d17c,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_c7f73a15d17c,
    'SendEncryptedValue', p_SendEncryptedValue_c7f73a15d17c,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_c7f73a15d17c,
    'IsSoftForeignKey', p_IsSoftForeignKey_c7f73a15d17c,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_c7f73a15d17c,
    'JSONType', p_JSONType_c7f73a15d17c,
    'JSONTypeIsArray', p_JSONTypeIsArray_c7f73a15d17c,
    'JSONTypeDefinition', p_JSONTypeDefinition_c7f73a15d17c,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_c7f73a15d17c,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_c7f73a15d17c,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_c7f73a15d17c,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_c7f73a15d17c,
    'IsComputed', p_IsComputed_c7f73a15d17c
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_c7f73a15d17c,
    'Configuration', p_Configuration_c7f73a15d17c,
    'ID', p_ID_c7f73a15d17c
  ));
  ELSE
    PERFORM ${mjSchema}."spUpdateEntityField"(p_DisplayName := p_DisplayName_c7f73a15d17c, p_Description := p_Description_c7f73a15d17c, p_AutoUpdateDescription := p_AutoUpdateDescription_c7f73a15d17c, p_IsPrimaryKey := p_IsPrimaryKey_c7f73a15d17c, p_IsUnique := p_IsUnique_c7f73a15d17c, p_Category := p_Category_c7f73a15d17c, p_ValueListType := p_ValueListType_c7f73a15d17c, p_ExtendedType := p_ExtendedType_c7f73a15d17c, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_c7f73a15d17c, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_c7f73a15d17c, p_ViewCellTemplate := p_ViewCellTemplate_c7f73a15d17c, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_c7f73a15d17c, p_AllowUpdateAPI := p_AllowUpdateAPI_c7f73a15d17c, p_AllowUpdateInView := p_AllowUpdateInView_c7f73a15d17c, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_c7f73a15d17c, p_FullTextSearchEnabled := p_FullTextSearchEnabled_c7f73a15d17c, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_c7f73a15d17c, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_c7f73a15d17c, p_GeneratedFormSection := p_GeneratedFormSection_c7f73a15d17c, p_IsNameField := p_IsNameField_c7f73a15d17c, p_RelatedEntityID := p_RelatedEntityID_c7f73a15d17c, p_RelatedEntityFieldName := p_RelatedEntityFieldName_c7f73a15d17c, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_c7f73a15d17c, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_c7f73a15d17c, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_c7f73a15d17c, p_EntityIDFieldName := p_EntityIDFieldName_c7f73a15d17c, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_c7f73a15d17c, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_c7f73a15d17c, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_c7f73a15d17c, p_Status := p_Status_c7f73a15d17c, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_c7f73a15d17c, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_c7f73a15d17c, p_AutoUpdateCategory := p_AutoUpdateCategory_c7f73a15d17c, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_c7f73a15d17c, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_c7f73a15d17c, p_Encrypt := p_Encrypt_c7f73a15d17c, p_EncryptionKeyID := p_EncryptionKeyID_c7f73a15d17c, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_c7f73a15d17c, p_SendEncryptedValue := p_SendEncryptedValue_c7f73a15d17c, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_c7f73a15d17c, p_IsSoftForeignKey := p_IsSoftForeignKey_c7f73a15d17c, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_c7f73a15d17c, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_c7f73a15d17c, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_c7f73a15d17c, p_JSONTypeDefinition := p_JSONTypeDefinition_c7f73a15d17c, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_c7f73a15d17c, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_c7f73a15d17c, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_c7f73a15d17c, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_c7f73a15d17c, p_IsComputed := p_IsComputed_c7f73a15d17c, p_EmbeddedRecord := p_EmbeddedRecord_c7f73a15d17c, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_c7f73a15d17c, p_Configuration_Clear := TRUE, p_ID := p_ID_c7f73a15d17c);
  END IF;
END $mj$;

-- Save MJ_BizApps_Accounting: GL Account Roles (core SP call only)
DO $mj$
DECLARE
  p_Name_9e235e72fb35 VARCHAR(100);
  p_Description_9e235e72fb35 TEXT;
  p_Status_9e235e72fb35 VARCHAR(10);
  p_Sequence_9e235e72fb35 INTEGER;
  p_Cardinality_9e235e72fb35 VARCHAR(10);
  p_ID_9e235e72fb35 UUID;
BEGIN
  p_Name_9e235e72fb35 := 'Inventory';
  p_Description_9e235e72fb35 := 'Inventory asset account. Nothing in Accounting posts to this role yet.';
  p_Status_9e235e72fb35 := 'Active';
  p_Sequence_9e235e72fb35 := 30;
  p_Cardinality_9e235e72fb35 := 'One';
  p_ID_9e235e72fb35 := 'EC0DFA1E-4B57-4734-83B0-D20B72AC8968';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '__mj_BizAppsAccounting' AND p.proname = 'spUpdateGLAccountRole'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "__mj_BizAppsAccounting"."spUpdateGLAccountRole"(p_data := jsonb_build_object(
    'Name', p_Name_9e235e72fb35,
    'Description', p_Description_9e235e72fb35,
    'Status', p_Status_9e235e72fb35,
    'Sequence', p_Sequence_9e235e72fb35,
    'Cardinality', p_Cardinality_9e235e72fb35,
    'ID', p_ID_9e235e72fb35
  ));
  ELSE
    PERFORM "__mj_BizAppsAccounting"."spUpdateGLAccountRole"(p_Name := p_Name_9e235e72fb35, p_Description := p_Description_9e235e72fb35, p_Status := p_Status_9e235e72fb35, p_Sequence := p_Sequence_9e235e72fb35, p_Cardinality := p_Cardinality_9e235e72fb35, p_ID := p_ID_9e235e72fb35);
  END IF;
END $mj$;

-- Save MJ_BizApps_Accounting: GL Account Roles (core SP call only)
DO $mj$
DECLARE
  p_Name_cd6838c9fe76 VARCHAR(100);
  p_Description_cd6838c9fe76 TEXT;
  p_Status_cd6838c9fe76 VARCHAR(10);
  p_Sequence_cd6838c9fe76 INTEGER;
  p_Cardinality_cd6838c9fe76 VARCHAR(10);
  p_ID_cd6838c9fe76 UUID;
BEGIN
  p_Name_cd6838c9fe76 := 'Cost of Goods Sold';
  p_Description_cd6838c9fe76 := 'Cost of goods sold expense account. Nothing in Accounting posts to this role yet.';
  p_Status_cd6838c9fe76 := 'Active';
  p_Sequence_cd6838c9fe76 := 40;
  p_Cardinality_cd6838c9fe76 := 'One';
  p_ID_cd6838c9fe76 := '2466C088-3DFA-4DC7-92A6-34D40EAF1A91';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '__mj_BizAppsAccounting' AND p.proname = 'spUpdateGLAccountRole'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "__mj_BizAppsAccounting"."spUpdateGLAccountRole"(p_data := jsonb_build_object(
    'Name', p_Name_cd6838c9fe76,
    'Description', p_Description_cd6838c9fe76,
    'Status', p_Status_cd6838c9fe76,
    'Sequence', p_Sequence_cd6838c9fe76,
    'Cardinality', p_Cardinality_cd6838c9fe76,
    'ID', p_ID_cd6838c9fe76
  ));
  ELSE
    PERFORM "__mj_BizAppsAccounting"."spUpdateGLAccountRole"(p_Name := p_Name_cd6838c9fe76, p_Description := p_Description_cd6838c9fe76, p_Status := p_Status_cd6838c9fe76, p_Sequence := p_Sequence_cd6838c9fe76, p_Cardinality := p_Cardinality_cd6838c9fe76, p_ID := p_ID_cd6838c9fe76);
  END IF;
END $mj$;

-- Save MJ_BizApps_Accounting: GL Account Roles (core SP call only)
DO $mj$
DECLARE
  p_Name_74b81eb6eae2 VARCHAR(100);
  p_Description_74b81eb6eae2 TEXT;
  p_Status_74b81eb6eae2 VARCHAR(10);
  p_Sequence_74b81eb6eae2 INTEGER;
  p_Cardinality_74b81eb6eae2 VARCHAR(10);
  p_ID_74b81eb6eae2 UUID;
BEGIN
  p_Name_74b81eb6eae2 := 'Deferred Revenue';
  p_Description_74b81eb6eae2 := 'Liability account credited for revenue not yet earned (subscriptions).';
  p_Status_74b81eb6eae2 := 'Active';
  p_Sequence_74b81eb6eae2 := 80;
  p_Cardinality_74b81eb6eae2 := 'One';
  p_ID_74b81eb6eae2 := '6D2EB237-F568-4372-8AA4-924995CD6834';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '__mj_BizAppsAccounting' AND p.proname = 'spUpdateGLAccountRole'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "__mj_BizAppsAccounting"."spUpdateGLAccountRole"(p_data := jsonb_build_object(
    'Name', p_Name_74b81eb6eae2,
    'Description', p_Description_74b81eb6eae2,
    'Status', p_Status_74b81eb6eae2,
    'Sequence', p_Sequence_74b81eb6eae2,
    'Cardinality', p_Cardinality_74b81eb6eae2,
    'ID', p_ID_74b81eb6eae2
  ));
  ELSE
    PERFORM "__mj_BizAppsAccounting"."spUpdateGLAccountRole"(p_Name := p_Name_74b81eb6eae2, p_Description := p_Description_74b81eb6eae2, p_Status := p_Status_74b81eb6eae2, p_Sequence := p_Sequence_74b81eb6eae2, p_Cardinality := p_Cardinality_74b81eb6eae2, p_ID := p_ID_74b81eb6eae2);
  END IF;
END $mj$;

-- Save MJ_BizApps_Accounting: GL Account Roles (core SP call only)
DO $mj$
DECLARE
  p_ID_5fabc81b6070 UUID;
  p_Name_5fabc81b6070 VARCHAR(100);
  p_Description_5fabc81b6070 TEXT;
  p_Status_5fabc81b6070 VARCHAR(10);
  p_Sequence_5fabc81b6070 INTEGER;
  p_Cardinality_5fabc81b6070 VARCHAR(10);
BEGIN
  p_ID_5fabc81b6070 := '00513874-D40A-49CD-97FF-AD55B85937FF';
  p_Name_5fabc81b6070 := 'Gift Card Liability';
  p_Description_5fabc81b6070 := 'Liability account for what the company owes on gift cards sold and not yet spent. Orders credits it when a gift card is sold, since the sale earns no revenue, and debits it when the card is spent as a tender. Resolved like every other role: product, product category, product type, then company. With no link, orders books the gift card to the Deferred Revenue account instead and logs a warning; the entry balances, but the two obligations cannot be told apart on the balance sheet.';
  p_Status_5fabc81b6070 := 'Active';
  p_Sequence_5fabc81b6070 := 120;
  p_Cardinality_5fabc81b6070 := 'One';
  IF NOT EXISTS (SELECT 1 FROM "__mj_BizAppsAccounting"."GLAccountRole"
               WHERE "ID" = p_ID_5fabc81b6070
                  OR ("Name" = p_Name_5fabc81b6070)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '__mj_BizAppsAccounting' AND p.proname = 'spCreateGLAccountRole'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "__mj_BizAppsAccounting"."spCreateGLAccountRole"(p_data := jsonb_build_object(
      'ID', p_ID_5fabc81b6070,
      'Name', p_Name_5fabc81b6070,
      'Description', p_Description_5fabc81b6070,
      'Status', p_Status_5fabc81b6070,
      'Sequence', p_Sequence_5fabc81b6070,
      'Cardinality', p_Cardinality_5fabc81b6070
    ));
    ELSE
      PERFORM "__mj_BizAppsAccounting"."spCreateGLAccountRole"(p_ID := p_ID_5fabc81b6070, p_Name := p_Name_5fabc81b6070, p_Description := p_Description_5fabc81b6070, p_Status := p_Status_5fabc81b6070, p_Sequence := p_Sequence_5fabc81b6070, p_Cardinality := p_Cardinality_5fabc81b6070);
    END IF;
  END IF;
END $mj$;

-- Save MJ_BizApps_Accounting: Finance Exception Types (core SP call only)
DO $mj$
DECLARE
  p_ID_01cd188556ff UUID;
  p_Code_01cd188556ff VARCHAR(60);
  p_Name_01cd188556ff VARCHAR(100);
  p_Description_01cd188556ff TEXT;
  p_OwningApp_01cd188556ff VARCHAR(100);
  p_IsActive_01cd188556ff BOOLEAN;
  p_Configuration_01cd188556ff TEXT;
BEGIN
  p_ID_01cd188556ff := '7B1C255D-4DCF-4738-B49F-3F9000ABF369';
  p_Code_01cd188556ff := 'ERP_POSTING_REJECTED';
  p_Name_01cd188556ff := 'ERP Posting Rejected';
  p_Description_01cd188556ff := 'A journal batch the ERP rejected when it was sent, for example because its posting date is in a period the ERP has closed. The batch is Failed and carries the ERP''s message. Fix the cause and send the batch again, or cancel it. Raised by accounting on each failed send, against the batch.';
  p_OwningApp_01cd188556ff := 'accounting';
  p_IsActive_01cd188556ff := TRUE;
  p_Configuration_01cd188556ff := '{}';
  IF NOT EXISTS (SELECT 1 FROM "__mj_BizAppsAccounting"."FinanceExceptionType"
               WHERE "ID" = p_ID_01cd188556ff
                  OR ("Code" = p_Code_01cd188556ff)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '__mj_BizAppsAccounting' AND p.proname = 'spCreateFinanceExceptionType'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "__mj_BizAppsAccounting"."spCreateFinanceExceptionType"(p_data := jsonb_build_object(
      'ID', p_ID_01cd188556ff,
      'Code', p_Code_01cd188556ff,
      'Name', p_Name_01cd188556ff,
      'Description', p_Description_01cd188556ff,
      'OwningApp', p_OwningApp_01cd188556ff,
      'IsActive', p_IsActive_01cd188556ff,
      'Configuration', p_Configuration_01cd188556ff
    ));
    ELSE
      PERFORM "__mj_BizAppsAccounting"."spCreateFinanceExceptionType"(p_ID := p_ID_01cd188556ff, p_Code := p_Code_01cd188556ff, p_Name := p_Name_01cd188556ff, p_Description := p_Description_01cd188556ff, p_OwningApp := p_OwningApp_01cd188556ff, p_IsActive := p_IsActive_01cd188556ff, p_Configuration := p_Configuration_01cd188556ff);
    END IF;
  END IF;
END $mj$;

-- Save MJ_BizApps_Accounting: Finance Exception Types (core SP call only)
DO $mj$
DECLARE
  p_ID_0f758f1b3149 UUID;
  p_Code_0f758f1b3149 VARCHAR(60);
  p_Name_0f758f1b3149 VARCHAR(100);
  p_Description_0f758f1b3149 TEXT;
  p_OwningApp_0f758f1b3149 VARCHAR(100);
  p_IsActive_0f758f1b3149 BOOLEAN;
  p_Configuration_0f758f1b3149 TEXT;
BEGIN
  p_ID_0f758f1b3149 := '1182AA25-1982-46E8-99A7-23D07F296F22';
  p_Code_0f758f1b3149 := 'PROVIDER_REFUND_NOT_BOOKED';
  p_Name_0f758f1b3149 := 'Gateway Refund Not Booked';
  p_Description_0f758f1b3149 := 'A refund made at the payment gateway (for example in the Stripe dashboard) that orders could not book against the payment automatically: the payment is not captured, the gateway has refunded more than was captured, or the gateway''s refunds do not match the refunds orders already holds. The money has left; finance books it with Refund Payment or corrects the refund already recorded. Raised by orders when the gateway reports the refund, against the payment.';
  p_OwningApp_0f758f1b3149 := 'orders';
  p_IsActive_0f758f1b3149 := TRUE;
  p_Configuration_0f758f1b3149 := '{}';
  IF NOT EXISTS (SELECT 1 FROM "__mj_BizAppsAccounting"."FinanceExceptionType"
               WHERE "ID" = p_ID_0f758f1b3149
                  OR ("Code" = p_Code_0f758f1b3149)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '__mj_BizAppsAccounting' AND p.proname = 'spCreateFinanceExceptionType'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "__mj_BizAppsAccounting"."spCreateFinanceExceptionType"(p_data := jsonb_build_object(
      'ID', p_ID_0f758f1b3149,
      'Code', p_Code_0f758f1b3149,
      'Name', p_Name_0f758f1b3149,
      'Description', p_Description_0f758f1b3149,
      'OwningApp', p_OwningApp_0f758f1b3149,
      'IsActive', p_IsActive_0f758f1b3149,
      'Configuration', p_Configuration_0f758f1b3149
    ));
    ELSE
      PERFORM "__mj_BizAppsAccounting"."spCreateFinanceExceptionType"(p_ID := p_ID_0f758f1b3149, p_Code := p_Code_0f758f1b3149, p_Name := p_Name_0f758f1b3149, p_Description := p_Description_0f758f1b3149, p_OwningApp := p_OwningApp_0f758f1b3149, p_IsActive := p_IsActive_0f758f1b3149, p_Configuration := p_Configuration_0f758f1b3149);
    END IF;
  END IF;
END $mj$;

-- Save MJ_BizApps_Accounting: Finance Exception Types (core SP call only)
DO $mj$
DECLARE
  p_ID_a67cd0370e33 UUID;
  p_Code_a67cd0370e33 VARCHAR(60);
  p_Name_a67cd0370e33 VARCHAR(100);
  p_Description_a67cd0370e33 TEXT;
  p_OwningApp_a67cd0370e33 VARCHAR(100);
  p_IsActive_a67cd0370e33 BOOLEAN;
  p_Configuration_a67cd0370e33 TEXT;
BEGIN
  p_ID_a67cd0370e33 := '155F86C0-CF1F-4832-8E30-903B7C22B31C';
  p_Code_a67cd0370e33 := 'PROVIDER_CHARGE_MISMATCH';
  p_Name_a67cd0370e33 := 'Gateway Charge Mismatch';
  p_Description_a67cd0370e33 := 'A difference between the payment gateway''s charges and orders'' payments found by the charge reconciliation: a charge with no orders payment (for example one taken outside the checkout), a captured payment whose charge the gateway does not have, or a refunded charge whose payment orders still holds as captured. Nothing is corrected automatically. Raised by an orders job, against the payment or the payment intent when there is one.';
  p_OwningApp_a67cd0370e33 := 'orders';
  p_IsActive_a67cd0370e33 := TRUE;
  p_Configuration_a67cd0370e33 := '{}';
  IF NOT EXISTS (SELECT 1 FROM "__mj_BizAppsAccounting"."FinanceExceptionType"
               WHERE "ID" = p_ID_a67cd0370e33
                  OR ("Code" = p_Code_a67cd0370e33)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '__mj_BizAppsAccounting' AND p.proname = 'spCreateFinanceExceptionType'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "__mj_BizAppsAccounting"."spCreateFinanceExceptionType"(p_data := jsonb_build_object(
      'ID', p_ID_a67cd0370e33,
      'Code', p_Code_a67cd0370e33,
      'Name', p_Name_a67cd0370e33,
      'Description', p_Description_a67cd0370e33,
      'OwningApp', p_OwningApp_a67cd0370e33,
      'IsActive', p_IsActive_a67cd0370e33,
      'Configuration', p_Configuration_a67cd0370e33
    ));
    ELSE
      PERFORM "__mj_BizAppsAccounting"."spCreateFinanceExceptionType"(p_ID := p_ID_a67cd0370e33, p_Code := p_Code_a67cd0370e33, p_Name := p_Name_a67cd0370e33, p_Description := p_Description_a67cd0370e33, p_OwningApp := p_OwningApp_a67cd0370e33, p_IsActive := p_IsActive_a67cd0370e33, p_Configuration := p_Configuration_a67cd0370e33);
    END IF;
  END IF;
END $mj$;

-- Save MJ_BizApps_Accounting: Finance Exception Types (core SP call only)
DO $mj$
DECLARE
  p_ID_5357de4af8ef UUID;
  p_Code_5357de4af8ef VARCHAR(60);
  p_Name_5357de4af8ef VARCHAR(100);
  p_Description_5357de4af8ef TEXT;
  p_OwningApp_5357de4af8ef VARCHAR(100);
  p_IsActive_5357de4af8ef BOOLEAN;
  p_Configuration_5357de4af8ef TEXT;
BEGIN
  p_ID_5357de4af8ef := 'A578E7B7-1790-4978-8772-79582CDB45C5';
  p_Code_5357de4af8ef := 'PROVIDER_PAYMENT_ORDER_DUPLICATE';
  p_Name_5357de4af8ef := 'Possible Duplicate of a Payment Order';
  p_Description_5357de4af8ef := 'An order that may duplicate one created from a card payment that matched no order: same buyer, a shared product and the same total within 30 days. Raised by orders when the keyed order is confirmed, against that order, naming the order created from the payment. Nothing is cancelled automatically; finance cancels or credits one of the two.';
  p_OwningApp_5357de4af8ef := 'orders';
  p_IsActive_5357de4af8ef := TRUE;
  p_Configuration_5357de4af8ef := '{}';
  IF NOT EXISTS (SELECT 1 FROM "__mj_BizAppsAccounting"."FinanceExceptionType"
               WHERE "ID" = p_ID_5357de4af8ef
                  OR ("Code" = p_Code_5357de4af8ef)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '__mj_BizAppsAccounting' AND p.proname = 'spCreateFinanceExceptionType'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "__mj_BizAppsAccounting"."spCreateFinanceExceptionType"(p_data := jsonb_build_object(
      'ID', p_ID_5357de4af8ef,
      'Code', p_Code_5357de4af8ef,
      'Name', p_Name_5357de4af8ef,
      'Description', p_Description_5357de4af8ef,
      'OwningApp', p_OwningApp_5357de4af8ef,
      'IsActive', p_IsActive_5357de4af8ef,
      'Configuration', p_Configuration_5357de4af8ef
    ));
    ELSE
      PERFORM "__mj_BizAppsAccounting"."spCreateFinanceExceptionType"(p_ID := p_ID_5357de4af8ef, p_Code := p_Code_5357de4af8ef, p_Name := p_Name_5357de4af8ef, p_Description := p_Description_5357de4af8ef, p_OwningApp := p_OwningApp_5357de4af8ef, p_IsActive := p_IsActive_5357de4af8ef, p_Configuration := p_Configuration_5357de4af8ef);
    END IF;
  END IF;
END $mj$;

-- Save MJ_BizApps_Accounting: Finance Exception Types (core SP call only)
DO $mj$
DECLARE
  p_ID_d22aac601209 UUID;
  p_Code_d22aac601209 VARCHAR(60);
  p_Name_d22aac601209 VARCHAR(100);
  p_Description_d22aac601209 TEXT;
  p_OwningApp_d22aac601209 VARCHAR(100);
  p_IsActive_d22aac601209 BOOLEAN;
  p_Configuration_d22aac601209 TEXT;
BEGIN
  p_ID_d22aac601209 := '80CE39DE-352D-4F31-BAD2-54A367DA2294';
  p_Code_d22aac601209 := 'SUBSCRIPTION_TERM_LENGTH';
  p_Name_d22aac601209 := 'Subscription Length Other Than Its Term';
  p_Description_d22aac601209 := 'A subscription order line whose stated service period gives it a length other than its subscription type''s term, with what the length and the price come to at the list rate. Raised by orders at booking, in the same transaction as the confirm; it refuses nothing.';
  p_OwningApp_d22aac601209 := 'orders';
  p_IsActive_d22aac601209 := TRUE;
  p_Configuration_d22aac601209 := '{}';
  IF NOT EXISTS (SELECT 1 FROM "__mj_BizAppsAccounting"."FinanceExceptionType"
               WHERE "ID" = p_ID_d22aac601209
                  OR ("Code" = p_Code_d22aac601209)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '__mj_BizAppsAccounting' AND p.proname = 'spCreateFinanceExceptionType'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "__mj_BizAppsAccounting"."spCreateFinanceExceptionType"(p_data := jsonb_build_object(
      'ID', p_ID_d22aac601209,
      'Code', p_Code_d22aac601209,
      'Name', p_Name_d22aac601209,
      'Description', p_Description_d22aac601209,
      'OwningApp', p_OwningApp_d22aac601209,
      'IsActive', p_IsActive_d22aac601209,
      'Configuration', p_Configuration_d22aac601209
    ));
    ELSE
      PERFORM "__mj_BizAppsAccounting"."spCreateFinanceExceptionType"(p_ID := p_ID_d22aac601209, p_Code := p_Code_d22aac601209, p_Name := p_Name_d22aac601209, p_Description := p_Description_d22aac601209, p_OwningApp := p_OwningApp_d22aac601209, p_IsActive := p_IsActive_d22aac601209, p_Configuration := p_Configuration_d22aac601209);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Remote Operations (core SP call only)
DO $mj$
DECLARE
  p_Name_cb68b2c401e1 VARCHAR(255);
  p_OperationKey_cb68b2c401e1 VARCHAR(255);
  p_CategoryID_cb68b2c401e1 UUID;
  p_Description_cb68b2c401e1 TEXT;
  p_InputTypeName_cb68b2c401e1 VARCHAR(255);
  p_InputTypeDefinition_cb68b2c401e1 TEXT;
  p_InputTypeIsArray_cb68b2c401e1 BOOLEAN;
  p_OutputTypeName_cb68b2c401e1 VARCHAR(255);
  p_OutputTypeDefinition_cb68b2c401e1 TEXT;
  p_OutputTypeIsArray_cb68b2c401e1 BOOLEAN;
  p_ExecutionMode_cb68b2c401e1 VARCHAR(20);
  p_RequiredScope_cb68b2c401e1 VARCHAR(255);
  p_RequiresSystemUser_cb68b2c401e1 BOOLEAN;
  p_GenerationType_cb68b2c401e1 VARCHAR(20);
  p_Code_cb68b2c401e1 TEXT;
  p_CodeApprovalStatus_cb68b2c401e1 VARCHAR(20);
  p_CodeApprovedByUserID_cb68b2c401e1 UUID;
  p_CodeApprovedAt_cb68b2c401e1 TIMESTAMPTZ;
  p_ContractFingerprint_cb68b2c401e1 VARCHAR(100);
  p_Status_cb68b2c401e1 VARCHAR(20);
  p_CacheTTLSeconds_cb68b2c401e1 INTEGER;
  p_TimeoutMS_cb68b2c401e1 INTEGER;
  p_MaxConcurrency_cb68b2c401e1 INTEGER;
  p_CodeLocked_cb68b2c401e1 BOOLEAN;
  p_CodeComments_cb68b2c401e1 TEXT;
  p_Libraries_cb68b2c401e1 TEXT;
  p_ID_cb68b2c401e1 UUID;
BEGIN
  p_Name_cb68b2c401e1 := 'Clear Finance Exception';
  p_OperationKey_cb68b2c401e1 := 'Accounting.ClearFinanceException';
  p_CategoryID_cb68b2c401e1 := 'BF08299C-0F79-466A-97DC-9ECA2F28760A';
  p_Description_cb68b2c401e1 := 'Clear an Open finance exception as Reviewed (the judgement stands) or Corrected (the data was fixed), with a required note. Always refused to the source record''s creator. Which authorization the reviewer needs is decided per exception: MJ.BizApps.Accounting.FinanceExceptions.ClearUnattributed when the creator is unresolved or the system user and that right is granted (otherwise an unresolved creator is refused); ClearEscalated when the creator holds the EscalatedCreator marker; the type''s ClearType.<TYPE CODE> when granted; otherwise FinanceExceptions.Clear. A rule right is in force only while granted to some role. The only way an exception''s status changes.';
  p_InputTypeName_cb68b2c401e1 := 'AccountingClearFinanceExceptionInput';
  p_InputTypeDefinition_cb68b2c401e1 := '/**
 * Input for `Accounting.ClearFinanceException`.
 *
 * NO import statements — definitions are emitted verbatim.
 */
export interface AccountingClearFinanceExceptionInput {
    FinanceExceptionID: string;
    /** Reviewed: the judgement stands. Corrected: the data was fixed. Both are terminal. */
    Outcome: ''Reviewed'' | ''Corrected'';
    /** What the reviewer checked or changed. Required. */
    Note: string;
}
';
  p_InputTypeIsArray_cb68b2c401e1 := FALSE;
  p_OutputTypeName_cb68b2c401e1 := 'AccountingClearFinanceExceptionOutput';
  p_OutputTypeDefinition_cb68b2c401e1 := '/**
 * Output for `Accounting.ClearFinanceException`.
 *
 * NO import statements — definitions are emitted verbatim.
 */
export interface AccountingClearFinanceExceptionError {
    Code: string;
    Message: string;
}

export interface AccountingClearFinanceExceptionOutput {
    Success: boolean;
    /** The exception''s status after the call: the outcome on success, the unchanged status on a refusal that read it. */
    Status?: string;
    Errors?: AccountingClearFinanceExceptionError[];
}
';
  p_OutputTypeIsArray_cb68b2c401e1 := FALSE;
  p_ExecutionMode_cb68b2c401e1 := 'Sync';
  p_RequiredScope_cb68b2c401e1 := 'accounting:write';
  p_RequiresSystemUser_cb68b2c401e1 := FALSE;
  p_GenerationType_cb68b2c401e1 := 'Manual';
  p_CodeApprovalStatus_cb68b2c401e1 := 'Approved';
  p_Status_cb68b2c401e1 := 'Active';
  p_CodeLocked_cb68b2c401e1 := FALSE;
  p_ID_cb68b2c401e1 := 'AA31C44E-B72B-4BD2-97C1-C2AE8C36462C';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateRemoteOperation'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM ${mjSchema}."spUpdateRemoteOperation"(p_data := jsonb_build_object(
    'Name', p_Name_cb68b2c401e1,
    'OperationKey', p_OperationKey_cb68b2c401e1,
    'CategoryID', p_CategoryID_cb68b2c401e1,
    'Description', p_Description_cb68b2c401e1,
    'InputTypeName', p_InputTypeName_cb68b2c401e1,
    'InputTypeDefinition', p_InputTypeDefinition_cb68b2c401e1,
    'InputTypeIsArray', p_InputTypeIsArray_cb68b2c401e1,
    'OutputTypeName', p_OutputTypeName_cb68b2c401e1,
    'OutputTypeDefinition', p_OutputTypeDefinition_cb68b2c401e1,
    'OutputTypeIsArray', p_OutputTypeIsArray_cb68b2c401e1,
    'ExecutionMode', p_ExecutionMode_cb68b2c401e1,
    'RequiredScope', p_RequiredScope_cb68b2c401e1,
    'RequiresSystemUser', p_RequiresSystemUser_cb68b2c401e1,
    'GenerationType', p_GenerationType_cb68b2c401e1,
    'Code', p_Code_cb68b2c401e1,
    'CodeApprovalStatus', p_CodeApprovalStatus_cb68b2c401e1,
    'CodeApprovedByUserID', p_CodeApprovedByUserID_cb68b2c401e1,
    'CodeApprovedAt', p_CodeApprovedAt_cb68b2c401e1,
    'ContractFingerprint', p_ContractFingerprint_cb68b2c401e1,
    'Status', p_Status_cb68b2c401e1,
    'CacheTTLSeconds', p_CacheTTLSeconds_cb68b2c401e1,
    'TimeoutMS', p_TimeoutMS_cb68b2c401e1,
    'MaxConcurrency', p_MaxConcurrency_cb68b2c401e1,
    'CodeLocked', p_CodeLocked_cb68b2c401e1,
    'CodeComments', p_CodeComments_cb68b2c401e1,
    'Libraries', p_Libraries_cb68b2c401e1,
    'ID', p_ID_cb68b2c401e1
  ));
  ELSE
    PERFORM ${mjSchema}."spUpdateRemoteOperation"(p_Name := p_Name_cb68b2c401e1, p_OperationKey := p_OperationKey_cb68b2c401e1, p_CategoryID := p_CategoryID_cb68b2c401e1, p_Description := p_Description_cb68b2c401e1, p_InputTypeName := p_InputTypeName_cb68b2c401e1, p_InputTypeDefinition := p_InputTypeDefinition_cb68b2c401e1, p_InputTypeIsArray := p_InputTypeIsArray_cb68b2c401e1, p_OutputTypeName := p_OutputTypeName_cb68b2c401e1, p_OutputTypeDefinition := p_OutputTypeDefinition_cb68b2c401e1, p_OutputTypeIsArray := p_OutputTypeIsArray_cb68b2c401e1, p_ExecutionMode := p_ExecutionMode_cb68b2c401e1, p_RequiredScope := p_RequiredScope_cb68b2c401e1, p_RequiresSystemUser := p_RequiresSystemUser_cb68b2c401e1, p_GenerationType := p_GenerationType_cb68b2c401e1, p_Code := p_Code_cb68b2c401e1, p_Code_Clear := TRUE, p_CodeApprovalStatus := p_CodeApprovalStatus_cb68b2c401e1, p_CodeApprovedByUserID := p_CodeApprovedByUserID_cb68b2c401e1, p_CodeApprovedByUserID_Clear := TRUE, p_CodeApprovedAt := p_CodeApprovedAt_cb68b2c401e1, p_CodeApprovedAt_Clear := TRUE, p_ContractFingerprint := p_ContractFingerprint_cb68b2c401e1, p_ContractFingerprint_Clear := TRUE, p_Status := p_Status_cb68b2c401e1, p_CacheTTLSeconds := p_CacheTTLSeconds_cb68b2c401e1, p_CacheTTLSeconds_Clear := TRUE, p_TimeoutMS := p_TimeoutMS_cb68b2c401e1, p_TimeoutMS_Clear := TRUE, p_MaxConcurrency := p_MaxConcurrency_cb68b2c401e1, p_MaxConcurrency_Clear := TRUE, p_CodeLocked := p_CodeLocked_cb68b2c401e1, p_CodeComments := p_CodeComments_cb68b2c401e1, p_CodeComments_Clear := TRUE, p_Libraries := p_Libraries_cb68b2c401e1, p_Libraries_Clear := TRUE, p_ID := p_ID_cb68b2c401e1);
  END IF;
END $mj$;

-- Save MJ: API Scopes (core SP call only)
DO $mj$
DECLARE
  p_ID_ab9241197cb4 UUID;
  p_Name_ab9241197cb4 VARCHAR(100);
  p_Category_ab9241197cb4 VARCHAR(100);
  p_Description_ab9241197cb4 VARCHAR(500);
  p_ParentID_ab9241197cb4 UUID;
  p_FullPath_ab9241197cb4 VARCHAR(500);
  p_ResourceType_ab9241197cb4 VARCHAR(50);
  p_IsActive_ab9241197cb4 BOOLEAN;
  p_UIConfig_ab9241197cb4 TEXT;
BEGIN
  p_ID_ab9241197cb4 := '3C1C4E61-F078-48A8-A101-0E985E5A2A18';
  p_Name_ab9241197cb4 := 'accounting';
  p_Category_ab9241197cb4 := 'Accounting';
  p_Description_ab9241197cb4 := 'Parent scope for Accounting remote operations';
  p_FullPath_ab9241197cb4 := 'accounting';
  p_IsActive_ab9241197cb4 := TRUE;
  IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."APIScope"
               WHERE "ID" = p_ID_ab9241197cb4
                  OR ("FullPath" = p_FullPath_ab9241197cb4)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateAPIScope'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM ${mjSchema}."spCreateAPIScope"(p_data := jsonb_build_object(
      'ID', p_ID_ab9241197cb4,
      'Name', p_Name_ab9241197cb4,
      'Category', p_Category_ab9241197cb4,
      'Description', p_Description_ab9241197cb4,
      'ParentID', p_ParentID_ab9241197cb4,
      'FullPath', p_FullPath_ab9241197cb4,
      'ResourceType', p_ResourceType_ab9241197cb4,
      'IsActive', p_IsActive_ab9241197cb4,
      'UIConfig', p_UIConfig_ab9241197cb4
    ));
    ELSE
      PERFORM ${mjSchema}."spCreateAPIScope"(p_ID := p_ID_ab9241197cb4, p_Name := p_Name_ab9241197cb4, p_Category := p_Category_ab9241197cb4, p_Description := p_Description_ab9241197cb4, p_ParentID := p_ParentID_ab9241197cb4, p_ParentID_Clear := TRUE, p_FullPath := p_FullPath_ab9241197cb4, p_ResourceType := p_ResourceType_ab9241197cb4, p_ResourceType_Clear := TRUE, p_IsActive := p_IsActive_ab9241197cb4, p_UIConfig := p_UIConfig_ab9241197cb4, p_UIConfig_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: API Scopes (core SP call only)
DO $mj$
DECLARE
  p_ID_1bd020c12ba4 UUID;
  p_Name_1bd020c12ba4 VARCHAR(100);
  p_Category_1bd020c12ba4 VARCHAR(100);
  p_Description_1bd020c12ba4 VARCHAR(500);
  p_ParentID_1bd020c12ba4 UUID;
  p_FullPath_1bd020c12ba4 VARCHAR(500);
  p_ResourceType_1bd020c12ba4 VARCHAR(50);
  p_IsActive_1bd020c12ba4 BOOLEAN;
  p_UIConfig_1bd020c12ba4 TEXT;
BEGIN
  p_ID_1bd020c12ba4 := '6506ADAB-2078-41AE-879F-DE193B1BBC39';
  p_Name_1bd020c12ba4 := 'read';
  p_Category_1bd020c12ba4 := 'Accounting';
  p_Description_1bd020c12ba4 := 'Read-only Accounting operations: batch previews, journal entry states, stranded entries, approval state and finance exception types';
  p_ParentID_1bd020c12ba4 := '3C1C4E61-F078-48A8-A101-0E985E5A2A18';
  p_FullPath_1bd020c12ba4 := 'accounting:read';
  p_IsActive_1bd020c12ba4 := TRUE;
  p_ParentID_1bd020c12ba4 := COALESCE((SELECT "ID" FROM ${mjSchema}."APIScope" WHERE "FullPath" = 'accounting' ORDER BY CASE WHEN "ID" = p_ParentID_1bd020c12ba4 THEN 0 ELSE 1 END LIMIT 1), p_ParentID_1bd020c12ba4);
  IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."APIScope"
               WHERE "ID" = p_ID_1bd020c12ba4
                  OR ("FullPath" = p_FullPath_1bd020c12ba4)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateAPIScope'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM ${mjSchema}."spCreateAPIScope"(p_data := jsonb_build_object(
      'ID', p_ID_1bd020c12ba4,
      'Name', p_Name_1bd020c12ba4,
      'Category', p_Category_1bd020c12ba4,
      'Description', p_Description_1bd020c12ba4,
      'ParentID', p_ParentID_1bd020c12ba4,
      'FullPath', p_FullPath_1bd020c12ba4,
      'ResourceType', p_ResourceType_1bd020c12ba4,
      'IsActive', p_IsActive_1bd020c12ba4,
      'UIConfig', p_UIConfig_1bd020c12ba4
    ));
    ELSE
      PERFORM ${mjSchema}."spCreateAPIScope"(p_ID := p_ID_1bd020c12ba4, p_Name := p_Name_1bd020c12ba4, p_Category := p_Category_1bd020c12ba4, p_Description := p_Description_1bd020c12ba4, p_ParentID := p_ParentID_1bd020c12ba4, p_FullPath := p_FullPath_1bd020c12ba4, p_ResourceType := p_ResourceType_1bd020c12ba4, p_ResourceType_Clear := TRUE, p_IsActive := p_IsActive_1bd020c12ba4, p_UIConfig := p_UIConfig_1bd020c12ba4, p_UIConfig_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: API Scopes (core SP call only)
DO $mj$
DECLARE
  p_ID_360c12ae4875 UUID;
  p_Name_360c12ae4875 VARCHAR(100);
  p_Category_360c12ae4875 VARCHAR(100);
  p_Description_360c12ae4875 VARCHAR(500);
  p_ParentID_360c12ae4875 UUID;
  p_FullPath_360c12ae4875 VARCHAR(500);
  p_ResourceType_360c12ae4875 VARCHAR(50);
  p_IsActive_360c12ae4875 BOOLEAN;
  p_UIConfig_360c12ae4875 TEXT;
BEGIN
  p_ID_360c12ae4875 := 'D10952F0-1423-435D-B144-70E33988BE93';
  p_Name_360c12ae4875 := 'write';
  p_Category_360c12ae4875 := 'Accounting';
  p_Description_360c12ae4875 := 'Accounting operations that change data inside Accounting: journal entries and reversals, batch build, regenerate, decisions, archive and cancellation, and finance exceptions';
  p_ParentID_360c12ae4875 := '3C1C4E61-F078-48A8-A101-0E985E5A2A18';
  p_FullPath_360c12ae4875 := 'accounting:write';
  p_IsActive_360c12ae4875 := TRUE;
  p_ParentID_360c12ae4875 := COALESCE((SELECT "ID" FROM ${mjSchema}."APIScope" WHERE "FullPath" = 'accounting' ORDER BY CASE WHEN "ID" = p_ParentID_360c12ae4875 THEN 0 ELSE 1 END LIMIT 1), p_ParentID_360c12ae4875);
  IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."APIScope"
               WHERE "ID" = p_ID_360c12ae4875
                  OR ("FullPath" = p_FullPath_360c12ae4875)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateAPIScope'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM ${mjSchema}."spCreateAPIScope"(p_data := jsonb_build_object(
      'ID', p_ID_360c12ae4875,
      'Name', p_Name_360c12ae4875,
      'Category', p_Category_360c12ae4875,
      'Description', p_Description_360c12ae4875,
      'ParentID', p_ParentID_360c12ae4875,
      'FullPath', p_FullPath_360c12ae4875,
      'ResourceType', p_ResourceType_360c12ae4875,
      'IsActive', p_IsActive_360c12ae4875,
      'UIConfig', p_UIConfig_360c12ae4875
    ));
    ELSE
      PERFORM ${mjSchema}."spCreateAPIScope"(p_ID := p_ID_360c12ae4875, p_Name := p_Name_360c12ae4875, p_Category := p_Category_360c12ae4875, p_Description := p_Description_360c12ae4875, p_ParentID := p_ParentID_360c12ae4875, p_FullPath := p_FullPath_360c12ae4875, p_ResourceType := p_ResourceType_360c12ae4875, p_ResourceType_Clear := TRUE, p_IsActive := p_IsActive_360c12ae4875, p_UIConfig := p_UIConfig_360c12ae4875, p_UIConfig_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: API Scopes (core SP call only)
DO $mj$
DECLARE
  p_ID_61ece7a7b779 UUID;
  p_Name_61ece7a7b779 VARCHAR(100);
  p_Category_61ece7a7b779 VARCHAR(100);
  p_Description_61ece7a7b779 VARCHAR(500);
  p_ParentID_61ece7a7b779 UUID;
  p_FullPath_61ece7a7b779 VARCHAR(500);
  p_ResourceType_61ece7a7b779 VARCHAR(50);
  p_IsActive_61ece7a7b779 BOOLEAN;
  p_UIConfig_61ece7a7b779 TEXT;
BEGIN
  p_ID_61ece7a7b779 := '7ED8C7EE-2C11-4E74-AF43-F77020845CB2';
  p_Name_61ece7a7b779 := 'post';
  p_Category_61ece7a7b779 := 'Accounting';
  p_Description_61ece7a7b779 := 'Accounting operations that act on the ERP: dispatch a batch to the ERP, finish posting a batch the ERP accepted, and run the ERP master-data sync';
  p_ParentID_61ece7a7b779 := '3C1C4E61-F078-48A8-A101-0E985E5A2A18';
  p_FullPath_61ece7a7b779 := 'accounting:post';
  p_IsActive_61ece7a7b779 := TRUE;
  p_ParentID_61ece7a7b779 := COALESCE((SELECT "ID" FROM ${mjSchema}."APIScope" WHERE "FullPath" = 'accounting' ORDER BY CASE WHEN "ID" = p_ParentID_61ece7a7b779 THEN 0 ELSE 1 END LIMIT 1), p_ParentID_61ece7a7b779);
  IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."APIScope"
               WHERE "ID" = p_ID_61ece7a7b779
                  OR ("FullPath" = p_FullPath_61ece7a7b779)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateAPIScope'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM ${mjSchema}."spCreateAPIScope"(p_data := jsonb_build_object(
      'ID', p_ID_61ece7a7b779,
      'Name', p_Name_61ece7a7b779,
      'Category', p_Category_61ece7a7b779,
      'Description', p_Description_61ece7a7b779,
      'ParentID', p_ParentID_61ece7a7b779,
      'FullPath', p_FullPath_61ece7a7b779,
      'ResourceType', p_ResourceType_61ece7a7b779,
      'IsActive', p_IsActive_61ece7a7b779,
      'UIConfig', p_UIConfig_61ece7a7b779
    ));
    ELSE
      PERFORM ${mjSchema}."spCreateAPIScope"(p_ID := p_ID_61ece7a7b779, p_Name := p_Name_61ece7a7b779, p_Category := p_Category_61ece7a7b779, p_Description := p_Description_61ece7a7b779, p_ParentID := p_ParentID_61ece7a7b779, p_FullPath := p_FullPath_61ece7a7b779, p_ResourceType := p_ResourceType_61ece7a7b779, p_ResourceType_Clear := TRUE, p_IsActive := p_IsActive_61ece7a7b779, p_UIConfig := p_UIConfig_61ece7a7b779, p_UIConfig_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: API Application Scopes (core SP call only)
DO $mj$
DECLARE
  p_ID_97482cd50243 UUID;
  p_ApplicationID_97482cd50243 UUID;
  p_ScopeID_97482cd50243 UUID;
  p_ResourcePattern_97482cd50243 VARCHAR(750);
  p_PatternType_97482cd50243 VARCHAR(20);
  p_IsDeny_97482cd50243 BOOLEAN;
  p_Priority_97482cd50243 INTEGER;
  p_RowFilterID_97482cd50243 UUID;
BEGIN
  p_ID_97482cd50243 := '5EEAB93B-93CD-482C-9202-BA76E79AF83C';
  p_ApplicationID_97482cd50243 := '15A906BC-55F3-489C-A7D3-F8DAE9F26D6B';
  p_ScopeID_97482cd50243 := '6506ADAB-2078-41AE-879F-DE193B1BBC39';
  p_ResourcePattern_97482cd50243 := '*';
  p_PatternType_97482cd50243 := 'Include';
  p_IsDeny_97482cd50243 := FALSE;
  p_Priority_97482cd50243 := 0;
  p_ApplicationID_97482cd50243 := COALESCE((SELECT "ID" FROM ${mjSchema}."APIApplication" WHERE "Name" = 'MJAPI' ORDER BY CASE WHEN "ID" = p_ApplicationID_97482cd50243 THEN 0 ELSE 1 END LIMIT 1), p_ApplicationID_97482cd50243);
  p_ScopeID_97482cd50243 := COALESCE((SELECT "ID" FROM ${mjSchema}."APIScope" WHERE "FullPath" = 'accounting:read' ORDER BY CASE WHEN "ID" = p_ScopeID_97482cd50243 THEN 0 ELSE 1 END LIMIT 1), p_ScopeID_97482cd50243);
  IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."APIApplicationScope"
               WHERE "ID" = p_ID_97482cd50243
                  OR ("ApplicationID" = p_ApplicationID_97482cd50243 AND "ScopeID" = p_ScopeID_97482cd50243 AND ("ResourcePattern" = p_ResourcePattern_97482cd50243 OR ("ResourcePattern" IS NULL AND p_ResourcePattern_97482cd50243 IS NULL)))) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateAPIApplicationScope'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM ${mjSchema}."spCreateAPIApplicationScope"(p_data := jsonb_build_object(
      'ID', p_ID_97482cd50243,
      'ApplicationID', p_ApplicationID_97482cd50243,
      'ScopeID', p_ScopeID_97482cd50243,
      'ResourcePattern', p_ResourcePattern_97482cd50243,
      'PatternType', p_PatternType_97482cd50243,
      'IsDeny', p_IsDeny_97482cd50243,
      'Priority', p_Priority_97482cd50243,
      'RowFilterID', p_RowFilterID_97482cd50243
    ));
    ELSE
      PERFORM ${mjSchema}."spCreateAPIApplicationScope"(p_ID := p_ID_97482cd50243, p_ApplicationID := p_ApplicationID_97482cd50243, p_ScopeID := p_ScopeID_97482cd50243, p_ResourcePattern := p_ResourcePattern_97482cd50243, p_PatternType := p_PatternType_97482cd50243, p_IsDeny := p_IsDeny_97482cd50243, p_Priority := p_Priority_97482cd50243, p_RowFilterID := p_RowFilterID_97482cd50243, p_RowFilterID_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: API Application Scopes (core SP call only)
DO $mj$
DECLARE
  p_ID_ece4f002ebe9 UUID;
  p_ApplicationID_ece4f002ebe9 UUID;
  p_ScopeID_ece4f002ebe9 UUID;
  p_ResourcePattern_ece4f002ebe9 VARCHAR(750);
  p_PatternType_ece4f002ebe9 VARCHAR(20);
  p_IsDeny_ece4f002ebe9 BOOLEAN;
  p_Priority_ece4f002ebe9 INTEGER;
  p_RowFilterID_ece4f002ebe9 UUID;
BEGIN
  p_ID_ece4f002ebe9 := 'B9D3F50E-0AF0-4851-934B-AD91887804DB';
  p_ApplicationID_ece4f002ebe9 := '15A906BC-55F3-489C-A7D3-F8DAE9F26D6B';
  p_ScopeID_ece4f002ebe9 := 'D10952F0-1423-435D-B144-70E33988BE93';
  p_ResourcePattern_ece4f002ebe9 := '*';
  p_PatternType_ece4f002ebe9 := 'Include';
  p_IsDeny_ece4f002ebe9 := FALSE;
  p_Priority_ece4f002ebe9 := 0;
  p_ApplicationID_ece4f002ebe9 := COALESCE((SELECT "ID" FROM ${mjSchema}."APIApplication" WHERE "Name" = 'MJAPI' ORDER BY CASE WHEN "ID" = p_ApplicationID_ece4f002ebe9 THEN 0 ELSE 1 END LIMIT 1), p_ApplicationID_ece4f002ebe9);
  p_ScopeID_ece4f002ebe9 := COALESCE((SELECT "ID" FROM ${mjSchema}."APIScope" WHERE "FullPath" = 'accounting:write' ORDER BY CASE WHEN "ID" = p_ScopeID_ece4f002ebe9 THEN 0 ELSE 1 END LIMIT 1), p_ScopeID_ece4f002ebe9);
  IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."APIApplicationScope"
               WHERE "ID" = p_ID_ece4f002ebe9
                  OR ("ApplicationID" = p_ApplicationID_ece4f002ebe9 AND "ScopeID" = p_ScopeID_ece4f002ebe9 AND ("ResourcePattern" = p_ResourcePattern_ece4f002ebe9 OR ("ResourcePattern" IS NULL AND p_ResourcePattern_ece4f002ebe9 IS NULL)))) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateAPIApplicationScope'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM ${mjSchema}."spCreateAPIApplicationScope"(p_data := jsonb_build_object(
      'ID', p_ID_ece4f002ebe9,
      'ApplicationID', p_ApplicationID_ece4f002ebe9,
      'ScopeID', p_ScopeID_ece4f002ebe9,
      'ResourcePattern', p_ResourcePattern_ece4f002ebe9,
      'PatternType', p_PatternType_ece4f002ebe9,
      'IsDeny', p_IsDeny_ece4f002ebe9,
      'Priority', p_Priority_ece4f002ebe9,
      'RowFilterID', p_RowFilterID_ece4f002ebe9
    ));
    ELSE
      PERFORM ${mjSchema}."spCreateAPIApplicationScope"(p_ID := p_ID_ece4f002ebe9, p_ApplicationID := p_ApplicationID_ece4f002ebe9, p_ScopeID := p_ScopeID_ece4f002ebe9, p_ResourcePattern := p_ResourcePattern_ece4f002ebe9, p_PatternType := p_PatternType_ece4f002ebe9, p_IsDeny := p_IsDeny_ece4f002ebe9, p_Priority := p_Priority_ece4f002ebe9, p_RowFilterID := p_RowFilterID_ece4f002ebe9, p_RowFilterID_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: API Application Scopes (core SP call only)
DO $mj$
DECLARE
  p_ID_454816ac8b7c UUID;
  p_ApplicationID_454816ac8b7c UUID;
  p_ScopeID_454816ac8b7c UUID;
  p_ResourcePattern_454816ac8b7c VARCHAR(750);
  p_PatternType_454816ac8b7c VARCHAR(20);
  p_IsDeny_454816ac8b7c BOOLEAN;
  p_Priority_454816ac8b7c INTEGER;
  p_RowFilterID_454816ac8b7c UUID;
BEGIN
  p_ID_454816ac8b7c := '8B4A3B41-6DF2-4E43-AD8B-82479B5BA156';
  p_ApplicationID_454816ac8b7c := '15A906BC-55F3-489C-A7D3-F8DAE9F26D6B';
  p_ScopeID_454816ac8b7c := '7ED8C7EE-2C11-4E74-AF43-F77020845CB2';
  p_ResourcePattern_454816ac8b7c := '*';
  p_PatternType_454816ac8b7c := 'Include';
  p_IsDeny_454816ac8b7c := FALSE;
  p_Priority_454816ac8b7c := 0;
  p_ApplicationID_454816ac8b7c := COALESCE((SELECT "ID" FROM ${mjSchema}."APIApplication" WHERE "Name" = 'MJAPI' ORDER BY CASE WHEN "ID" = p_ApplicationID_454816ac8b7c THEN 0 ELSE 1 END LIMIT 1), p_ApplicationID_454816ac8b7c);
  p_ScopeID_454816ac8b7c := COALESCE((SELECT "ID" FROM ${mjSchema}."APIScope" WHERE "FullPath" = 'accounting:post' ORDER BY CASE WHEN "ID" = p_ScopeID_454816ac8b7c THEN 0 ELSE 1 END LIMIT 1), p_ScopeID_454816ac8b7c);
  IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."APIApplicationScope"
               WHERE "ID" = p_ID_454816ac8b7c
                  OR ("ApplicationID" = p_ApplicationID_454816ac8b7c AND "ScopeID" = p_ScopeID_454816ac8b7c AND ("ResourcePattern" = p_ResourcePattern_454816ac8b7c OR ("ResourcePattern" IS NULL AND p_ResourcePattern_454816ac8b7c IS NULL)))) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateAPIApplicationScope'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM ${mjSchema}."spCreateAPIApplicationScope"(p_data := jsonb_build_object(
      'ID', p_ID_454816ac8b7c,
      'ApplicationID', p_ApplicationID_454816ac8b7c,
      'ScopeID', p_ScopeID_454816ac8b7c,
      'ResourcePattern', p_ResourcePattern_454816ac8b7c,
      'PatternType', p_PatternType_454816ac8b7c,
      'IsDeny', p_IsDeny_454816ac8b7c,
      'Priority', p_Priority_454816ac8b7c,
      'RowFilterID', p_RowFilterID_454816ac8b7c
    ));
    ELSE
      PERFORM ${mjSchema}."spCreateAPIApplicationScope"(p_ID := p_ID_454816ac8b7c, p_ApplicationID := p_ApplicationID_454816ac8b7c, p_ScopeID := p_ScopeID_454816ac8b7c, p_ResourcePattern := p_ResourcePattern_454816ac8b7c, p_PatternType := p_PatternType_454816ac8b7c, p_IsDeny := p_IsDeny_454816ac8b7c, p_Priority := p_Priority_454816ac8b7c, p_RowFilterID := p_RowFilterID_454816ac8b7c, p_RowFilterID_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Actions (core SP call only)
DO $mj$
DECLARE
  p_CategoryID_4ddd1ff52095 UUID;
  p_Name_4ddd1ff52095 VARCHAR(425);
  p_Description_4ddd1ff52095 TEXT;
  p_Type_4ddd1ff52095 VARCHAR(20);
  p_UserPrompt_4ddd1ff52095 TEXT;
  p_UserComments_4ddd1ff52095 TEXT;
  p_Code_4ddd1ff52095 TEXT;
  p_CodeComments_4ddd1ff52095 TEXT;
  p_CodeApprovalStatus_4ddd1ff52095 VARCHAR(20);
  p_CodeApprovalComments_4ddd1ff52095 TEXT;
  p_CodeApprovedByUserID_4ddd1ff52095 UUID;
  p_CodeApprovedAt_4ddd1ff52095 TIMESTAMPTZ;
  p_CodeLocked_4ddd1ff52095 BOOLEAN;
  p_ForceCodeGeneration_4ddd1ff52095 BOOLEAN;
  p_RetentionPeriod_4ddd1ff52095 INTEGER;
  p_Status_4ddd1ff52095 VARCHAR(20);
  p_DriverClass_4ddd1ff52095 VARCHAR(255);
  p_ParentID_4ddd1ff52095 UUID;
  p_IconClass_4ddd1ff52095 VARCHAR(100);
  p_DefaultCompactPromptID_4ddd1ff52095 UUID;
  p_Config_4ddd1ff52095 TEXT;
  p_RuntimeActionConfiguration_4ddd1ff52095 TEXT;
  p_MaxExecutionTimeMS_4ddd1ff52095 INTEGER;
  p_CreatedByAgentID_4ddd1ff52095 UUID;
  p_ID_4ddd1ff52095 UUID;
BEGIN
  p_CategoryID_4ddd1ff52095 := '074DF299-8D1F-438B-B855-8DFF17AE565E';
  p_Name_4ddd1ff52095 := 'Build Journal Entry Batches';
  p_Description_4ddd1ff52095 := 'Builds single-company GL posting batches from pending candidate journal entries, netting lines per account/dimension combination. Supports filtering by target ERP system, cutoff date, and including/excluding specific JournalEntryType codes (such as excluding RevenueRecognition for daily batch runs).';
  p_Type_4ddd1ff52095 := 'Custom';
  p_UserPrompt_4ddd1ff52095 := 'Build GL posting batches for pending journal entries.';
  p_CodeApprovalStatus_4ddd1ff52095 := 'Approved';
  p_CodeLocked_4ddd1ff52095 := FALSE;
  p_ForceCodeGeneration_4ddd1ff52095 := FALSE;
  p_Status_4ddd1ff52095 := 'Active';
  p_DriverClass_4ddd1ff52095 := 'Accounting.BuildJournalEntryBatches';
  p_IconClass_4ddd1ff52095 := 'fa-solid fa-layer-group';
  p_ID_4ddd1ff52095 := 'E839FB12-5813-4B85-8022-DF8943729BA1';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateAction'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM ${mjSchema}."spUpdateAction"(p_data := jsonb_build_object(
    'CategoryID', p_CategoryID_4ddd1ff52095,
    'Name', p_Name_4ddd1ff52095,
    'Description', p_Description_4ddd1ff52095,
    'Type', p_Type_4ddd1ff52095,
    'UserPrompt', p_UserPrompt_4ddd1ff52095,
    'UserComments', p_UserComments_4ddd1ff52095,
    'Code', p_Code_4ddd1ff52095,
    'CodeComments', p_CodeComments_4ddd1ff52095,
    'CodeApprovalStatus', p_CodeApprovalStatus_4ddd1ff52095,
    'CodeApprovalComments', p_CodeApprovalComments_4ddd1ff52095,
    'CodeApprovedByUserID', p_CodeApprovedByUserID_4ddd1ff52095,
    'CodeApprovedAt', p_CodeApprovedAt_4ddd1ff52095,
    'CodeLocked', p_CodeLocked_4ddd1ff52095,
    'ForceCodeGeneration', p_ForceCodeGeneration_4ddd1ff52095,
    'RetentionPeriod', p_RetentionPeriod_4ddd1ff52095,
    'Status', p_Status_4ddd1ff52095,
    'DriverClass', p_DriverClass_4ddd1ff52095,
    'ParentID', p_ParentID_4ddd1ff52095,
    'IconClass', p_IconClass_4ddd1ff52095,
    'DefaultCompactPromptID', p_DefaultCompactPromptID_4ddd1ff52095,
    'Config', p_Config_4ddd1ff52095,
    'RuntimeActionConfiguration', p_RuntimeActionConfiguration_4ddd1ff52095,
    'MaxExecutionTimeMS', p_MaxExecutionTimeMS_4ddd1ff52095,
    'CreatedByAgentID', p_CreatedByAgentID_4ddd1ff52095,
    'ID', p_ID_4ddd1ff52095
  ));
  ELSE
    PERFORM ${mjSchema}."spUpdateAction"(p_CategoryID := p_CategoryID_4ddd1ff52095, p_Name := p_Name_4ddd1ff52095, p_Description := p_Description_4ddd1ff52095, p_Type := p_Type_4ddd1ff52095, p_UserPrompt := p_UserPrompt_4ddd1ff52095, p_UserComments := p_UserComments_4ddd1ff52095, p_UserComments_Clear := TRUE, p_Code := p_Code_4ddd1ff52095, p_Code_Clear := TRUE, p_CodeComments := p_CodeComments_4ddd1ff52095, p_CodeComments_Clear := TRUE, p_CodeApprovalStatus := p_CodeApprovalStatus_4ddd1ff52095, p_CodeApprovalComments := p_CodeApprovalComments_4ddd1ff52095, p_CodeApprovalComments_Clear := TRUE, p_CodeApprovedByUserID := p_CodeApprovedByUserID_4ddd1ff52095, p_CodeApprovedByUserID_Clear := TRUE, p_CodeApprovedAt := p_CodeApprovedAt_4ddd1ff52095, p_CodeApprovedAt_Clear := TRUE, p_CodeLocked := p_CodeLocked_4ddd1ff52095, p_ForceCodeGeneration := p_ForceCodeGeneration_4ddd1ff52095, p_RetentionPeriod := p_RetentionPeriod_4ddd1ff52095, p_RetentionPeriod_Clear := TRUE, p_Status := p_Status_4ddd1ff52095, p_DriverClass := p_DriverClass_4ddd1ff52095, p_ParentID := p_ParentID_4ddd1ff52095, p_ParentID_Clear := TRUE, p_IconClass := p_IconClass_4ddd1ff52095, p_DefaultCompactPromptID := p_DefaultCompactPromptID_4ddd1ff52095, p_DefaultCompactPromptID_Clear := TRUE, p_Config := p_Config_4ddd1ff52095, p_Config_Clear := TRUE, p_RuntimeActionConfiguration := p_RuntimeActionConfiguration_4ddd1ff52095, p_RuntimeActionConfiguration_Clear := TRUE, p_MaxExecutionTimeMS := p_MaxExecutionTimeMS_4ddd1ff52095, p_MaxExecutionTimeMS_Clear := TRUE, p_CreatedByAgentID := p_CreatedByAgentID_4ddd1ff52095, p_CreatedByAgentID_Clear := TRUE, p_ID := p_ID_4ddd1ff52095);
  END IF;
END $mj$;

-- Save MJ: Actions (core SP call only)
DO $mj$
DECLARE
  p_CategoryID_2848e3e34bdd UUID;
  p_Name_2848e3e34bdd VARCHAR(425);
  p_Description_2848e3e34bdd TEXT;
  p_Type_2848e3e34bdd VARCHAR(20);
  p_UserPrompt_2848e3e34bdd TEXT;
  p_UserComments_2848e3e34bdd TEXT;
  p_Code_2848e3e34bdd TEXT;
  p_CodeComments_2848e3e34bdd TEXT;
  p_CodeApprovalStatus_2848e3e34bdd VARCHAR(20);
  p_CodeApprovalComments_2848e3e34bdd TEXT;
  p_CodeApprovedByUserID_2848e3e34bdd UUID;
  p_CodeApprovedAt_2848e3e34bdd TIMESTAMPTZ;
  p_CodeLocked_2848e3e34bdd BOOLEAN;
  p_ForceCodeGeneration_2848e3e34bdd BOOLEAN;
  p_RetentionPeriod_2848e3e34bdd INTEGER;
  p_Status_2848e3e34bdd VARCHAR(20);
  p_DriverClass_2848e3e34bdd VARCHAR(255);
  p_ParentID_2848e3e34bdd UUID;
  p_IconClass_2848e3e34bdd VARCHAR(100);
  p_DefaultCompactPromptID_2848e3e34bdd UUID;
  p_Config_2848e3e34bdd TEXT;
  p_RuntimeActionConfiguration_2848e3e34bdd TEXT;
  p_MaxExecutionTimeMS_2848e3e34bdd INTEGER;
  p_CreatedByAgentID_2848e3e34bdd UUID;
  p_ID_2848e3e34bdd UUID;
BEGIN
  p_CategoryID_2848e3e34bdd := '074DF299-8D1F-438B-B855-8DFF17AE565E';
  p_Name_2848e3e34bdd := 'Run ERP Sync';
  p_Description_2848e3e34bdd := 'Pulls chart of accounts, dimensions, and dimension values from every credentialed Company Integration via AccountingERPEngine.SyncMasterData. One job, all companies. Hosts disable the scheduled job rather than deleting this action.';
  p_Type_2848e3e34bdd := 'Custom';
  p_UserPrompt_2848e3e34bdd := 'Sync ERP master data for accounting.';
  p_CodeApprovalStatus_2848e3e34bdd := 'Approved';
  p_CodeLocked_2848e3e34bdd := FALSE;
  p_ForceCodeGeneration_2848e3e34bdd := FALSE;
  p_Status_2848e3e34bdd := 'Active';
  p_DriverClass_2848e3e34bdd := 'Accounting.RunERPSync';
  p_IconClass_2848e3e34bdd := 'fa-solid fa-cloud-arrow-down';
  p_ID_2848e3e34bdd := 'A839FB12-5813-4B85-8022-DF8943729BA2';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateAction'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM ${mjSchema}."spUpdateAction"(p_data := jsonb_build_object(
    'CategoryID', p_CategoryID_2848e3e34bdd,
    'Name', p_Name_2848e3e34bdd,
    'Description', p_Description_2848e3e34bdd,
    'Type', p_Type_2848e3e34bdd,
    'UserPrompt', p_UserPrompt_2848e3e34bdd,
    'UserComments', p_UserComments_2848e3e34bdd,
    'Code', p_Code_2848e3e34bdd,
    'CodeComments', p_CodeComments_2848e3e34bdd,
    'CodeApprovalStatus', p_CodeApprovalStatus_2848e3e34bdd,
    'CodeApprovalComments', p_CodeApprovalComments_2848e3e34bdd,
    'CodeApprovedByUserID', p_CodeApprovedByUserID_2848e3e34bdd,
    'CodeApprovedAt', p_CodeApprovedAt_2848e3e34bdd,
    'CodeLocked', p_CodeLocked_2848e3e34bdd,
    'ForceCodeGeneration', p_ForceCodeGeneration_2848e3e34bdd,
    'RetentionPeriod', p_RetentionPeriod_2848e3e34bdd,
    'Status', p_Status_2848e3e34bdd,
    'DriverClass', p_DriverClass_2848e3e34bdd,
    'ParentID', p_ParentID_2848e3e34bdd,
    'IconClass', p_IconClass_2848e3e34bdd,
    'DefaultCompactPromptID', p_DefaultCompactPromptID_2848e3e34bdd,
    'Config', p_Config_2848e3e34bdd,
    'RuntimeActionConfiguration', p_RuntimeActionConfiguration_2848e3e34bdd,
    'MaxExecutionTimeMS', p_MaxExecutionTimeMS_2848e3e34bdd,
    'CreatedByAgentID', p_CreatedByAgentID_2848e3e34bdd,
    'ID', p_ID_2848e3e34bdd
  ));
  ELSE
    PERFORM ${mjSchema}."spUpdateAction"(p_CategoryID := p_CategoryID_2848e3e34bdd, p_Name := p_Name_2848e3e34bdd, p_Description := p_Description_2848e3e34bdd, p_Type := p_Type_2848e3e34bdd, p_UserPrompt := p_UserPrompt_2848e3e34bdd, p_UserComments := p_UserComments_2848e3e34bdd, p_UserComments_Clear := TRUE, p_Code := p_Code_2848e3e34bdd, p_Code_Clear := TRUE, p_CodeComments := p_CodeComments_2848e3e34bdd, p_CodeComments_Clear := TRUE, p_CodeApprovalStatus := p_CodeApprovalStatus_2848e3e34bdd, p_CodeApprovalComments := p_CodeApprovalComments_2848e3e34bdd, p_CodeApprovalComments_Clear := TRUE, p_CodeApprovedByUserID := p_CodeApprovedByUserID_2848e3e34bdd, p_CodeApprovedByUserID_Clear := TRUE, p_CodeApprovedAt := p_CodeApprovedAt_2848e3e34bdd, p_CodeApprovedAt_Clear := TRUE, p_CodeLocked := p_CodeLocked_2848e3e34bdd, p_ForceCodeGeneration := p_ForceCodeGeneration_2848e3e34bdd, p_RetentionPeriod := p_RetentionPeriod_2848e3e34bdd, p_RetentionPeriod_Clear := TRUE, p_Status := p_Status_2848e3e34bdd, p_DriverClass := p_DriverClass_2848e3e34bdd, p_ParentID := p_ParentID_2848e3e34bdd, p_ParentID_Clear := TRUE, p_IconClass := p_IconClass_2848e3e34bdd, p_DefaultCompactPromptID := p_DefaultCompactPromptID_2848e3e34bdd, p_DefaultCompactPromptID_Clear := TRUE, p_Config := p_Config_2848e3e34bdd, p_Config_Clear := TRUE, p_RuntimeActionConfiguration := p_RuntimeActionConfiguration_2848e3e34bdd, p_RuntimeActionConfiguration_Clear := TRUE, p_MaxExecutionTimeMS := p_MaxExecutionTimeMS_2848e3e34bdd, p_MaxExecutionTimeMS_Clear := TRUE, p_CreatedByAgentID := p_CreatedByAgentID_2848e3e34bdd, p_CreatedByAgentID_Clear := TRUE, p_ID := p_ID_2848e3e34bdd);
  END IF;
END $mj$;

-- Save MJ: Queries (core SP call only)
DO $mj$
DECLARE
  p_ID_918af2bd6163 UUID;
  p_Name_918af2bd6163 VARCHAR(255);
  p_CategoryID_918af2bd6163 UUID;
  p_UserQuestion_918af2bd6163 TEXT;
  p_Description_918af2bd6163 TEXT;
  p_SQL_918af2bd6163 TEXT;
  p_TechnicalDescription_918af2bd6163 TEXT;
  p_OriginalSQL_918af2bd6163 TEXT;
  p_Feedback_918af2bd6163 TEXT;
  p_Status_918af2bd6163 VARCHAR(15);
  p_QualityRank_918af2bd6163 INTEGER;
  p_ExecutionCostRank_918af2bd6163 INTEGER;
  p_UsesTemplate_918af2bd6163 BOOLEAN;
  p_AuditQueryRuns_918af2bd6163 BOOLEAN;
  p_CacheEnabled_918af2bd6163 BOOLEAN;
  p_CacheTTLMinutes_918af2bd6163 INTEGER;
  p_CacheMaxSize_918af2bd6163 INTEGER;
  p_EmbeddingVector_918af2bd6163 TEXT;
  p_EmbeddingModelID_918af2bd6163 UUID;
  p_CacheValidationSQL_918af2bd6163 TEXT;
  p_SQLDialectID_918af2bd6163 UUID;
  p_Reusable_918af2bd6163 BOOLEAN;
  p_ExternalDataSourceID_918af2bd6163 UUID;
  p_IsMaterialized_918af2bd6163 BOOLEAN;
BEGIN
  p_ID_918af2bd6163 := 'A4884796-443D-49BB-915B-B94DF79EEA0C';
  p_Name_918af2bd6163 := 'Finance Exceptions Cleared';
  p_CategoryID_918af2bd6163 := '126B4161-E7AF-41F6-88B0-0F1F4D8D0867';
  p_UserQuestion_918af2bd6163 := 'Which finance exceptions were cleared this month, by whom, with what outcome and note?';
  p_Description_918af2bd6163 := 'Every cleared (Reviewed or Corrected) finance exception, newest first, with the month it was cleared in, its type, the reviewer, the review note and the source record''s creator. The monthly list of clearing decisions for the finance lead''s review.';
  p_SQL_918af2bd6163 := '-- Every cleared finance exception, newest first: the monthly list of clearing decisions
-- (golive #320 §4). ReviewedMonth is the first day of the month the exception was cleared in,
-- in UTC; filter on it for one month''s list. SourceCreatedByUser names the source record''s
-- creator (the system user for a record a job created); CreatorUnresolved marks one whose
-- creator had no linked login.
SELECT
    DATEFROMPARTS(YEAR(fe.ReviewedAt), MONTH(fe.ReviewedAt), 1) AS ReviewedMonth,
    fe.CompanyID,
    fe.Company,
    fet.Code AS TypeCode,
    fe.FinanceExceptionType,
    fe.Status AS Outcome,
    fe.ReviewedAt,
    fe.ReviewedByUserID,
    fe.ReviewedByUser,
    fe.ReviewNote,
    fe.SourceCreatedByUserID,
    fe.SourceCreatedByUser,
    fe.CreatorUnresolved,
    fe.ExceptionDate,
    fe.Amount,
    fe.Summary,
    fe.SourceEntity,
    fe.SourceRecordID,
    fe.ID AS FinanceExceptionID
FROM [__mj_BizAppsAccounting].vwFinanceExceptions fe
INNER JOIN [__mj_BizAppsAccounting].FinanceExceptionType fet
    ON fet.ID = fe.FinanceExceptionTypeID
WHERE fe.Status <> N''Open''
ORDER BY
    fe.ReviewedAt DESC;
';
  p_TechnicalDescription_918af2bd6163 := 'Reads __mj_BizAppsAccounting.vwFinanceExceptions joined to FinanceExceptionType for the type Code, WHERE Status <> ''Open''. ReviewedMonth = DATEFROMPARTS(YEAR(ReviewedAt), MONTH(ReviewedAt), 1) on the stored UTC instant. Outcome is Status (Reviewed or Corrected). Ordered by ReviewedAt DESC.';
  p_Status_918af2bd6163 := 'Approved';
  p_QualityRank_918af2bd6163 := 8;
  p_ExecutionCostRank_918af2bd6163 := 2;
  p_UsesTemplate_918af2bd6163 := FALSE;
  p_AuditQueryRuns_918af2bd6163 := FALSE;
  p_CacheEnabled_918af2bd6163 := FALSE;
  p_EmbeddingVector_918af2bd6163 := '[0.01734786294400692,-0.017221424728631973,0.016741657629609108,-0.02272729203104973,0.009747196920216084,-0.01427466794848442,0.009876314550638199,0.016339736059308052,-0.04779667779803276,0.03370865061879158,0.008618785999715328,-0.02474755421280861,0.03195546939969063,0.04858892783522606,-0.025909507647156715,0.01891489326953888,0.014296743087470531,-0.016318103298544884,0.08200990408658981,-0.024507703259587288,0.0005885293358005583,0.010399225167930126,-0.02724144048988819,0.015363084152340889,0.01537151075899601,0.0005894438363611698,-0.003535910276696086,-0.01326995249837637,-0.011630761437118053,-0.07865066826343536,0.05781454220414162,-0.011001193895936012,0.00814299937337637,-0.01564509980380535,0.000002612430989756831,0.024218766018748283,-0.01738135516643524,-0.005065197125077248,-0.04489874839782715,0.05832017958164215,-0.05137673765420914,-0.09438014030456543,-0.004674128256738186,-0.00215906766243279,0.014053692109882832,0.029589127749204636,0.012680712155997753,0.017775507643818855,0.005985058378428221,0.024674048647284508,0.022766148671507835,0.017002180218696594,-0.06927535682916641,0.0031909840181469917,0.04273831844329834,-0.02930676005780697,-0.017094086855649948,-0.04972640797495842,-0.019661789759993553,-0.10168556123971939,-0.026211781427264214,-0.006517598405480385,0.001250180066563189,-0.026969794183969498,-0.013039153069257736,0.004369442351162434,-0.010694852098822594,-0.04555864632129669,-0.012878728099167347,0.0002954323426820338,0.06638076156377792,-0.014826142229139805,-0.05182558670639992,-0.060553837567567825,-0.014198703691363335,-0.0018726970301941037,-0.05040477588772774,0.048681389540433884,-0.001863864716142416,-0.01975029520690441,0.021826185286045074,0.005493297707289457,-0.008111812174320221,-0.021785400807857513,-0.038079120218753815,-0.07839332520961761,-0.0046820673160254955,0.00920331571251154,-0.023774147033691406,-0.0008327236282639205,0.058522265404462814,-0.020600056275725365,-0.03376036882400513,-0.009796524420380592,0.00780067453160882,-0.019692502915859222,-0.00624382309615612,0.027635157108306885,0.00594809977337718,0.008294419385492802,0.08109185844659805,0.010472705587744713,-0.005119360517710447,0.02092880569398403,0.02444763295352459,0.006220061331987381,0.03241785615682602,-0.01634894497692585,0.021041013300418854,0.035373255610466,0.021934978663921356,-0.002104277955368161,-0.0013473865110427141,0.06914503127336502,-0.02740045264363289,0.03542178124189377,-0.013117549940943718,-0.004011527169495821,-0.028307871893048286,0.03515749052166939,0.06887899339199066,-0.0015690389554947615,-0.04908313602209091,-0.012997334823012352,-0.010647718794643879,-0.05905003100633621,0.008784341625869274,-0.030372077599167824,0.0362858772277832,0.01845005340874195,-0.038232725113630295,-0.02793760597705841,0.0370115302503109,-0.05288694426417351,-0.0010764586040750146,-0.02783910743892193,-0.0027566305361688137,0.0025699776597321033,-0.0742822214961052,0.006543027237057686,0.02661498636007309,0.007285322528332472,-0.05259541794657707,0.061540670692920685,-0.01095900684595108,-0.03282753378152847,-0.025445876643061638,-0.016398364678025246,0.00009544261411065236,0.007384342607110739,-0.0007830894901417196,-0.0032048628199845552,-0.041237346827983856,-0.00937320664525032,-0.012481152079999447,-0.010503851808607578,0.01744922064244747,-0.03282427787780762,-0.04793668910861015,0.02102314867079258,-0.05140751972794533,-0.01165513601154089,0.03511188551783562,-0.006702587008476257,0.030490722507238388,-0.052775412797927856,-0.06451347470283508,-0.0031641842797398567,-0.10109774023294449,-0.032421186566352844,0.0194428451359272,-0.01803252287209034,-0.0021659182384610176,0.00843050330877304,-0.029208652675151825,-0.003718956373631954,0.010466035455465317,-0.0008849639561958611,-0.0031250345055013895,-0.06252290308475494,-0.007147884927690029,-0.0362662710249424,-0.050085123628377914,-0.020723572000861168,-0.012192705646157265,-0.023061510175466537,-0.09134741127490997,0.0027804283890873194,-0.0268455371260643,0.009995205327868462,-0.00955964345484972,-0.006415454670786858,-0.027983924373984337,0.020127879455685616,-0.00785757601261139,0.0057227048091590405,0.014451134949922562,0.08616698533296585,0.032983191311359406,0.04494664818048477,-0.022260397672653198,0.00826967228204012,0.058797359466552734,0.05510704219341278,0.004334329627454281,-0.005236268043518066,-0.04427848383784294,0.018272005021572113,-0.017176108434796333,-0.0045943483710289,-0.017626095563173294,0.009309866465628147,-0.0025824771728366613,0.001779105281457305,0.0172437634319067,0.042850445955991745,0.05548886954784393,0.060557302087545395,-0.038309723138809204,0.01922808773815632,0.0009815124794840813,-0.04294309765100479,-0.05176140367984772,0.004174192436039448,0.08384189754724503,0.0051023042760789394,0.010543460957705975,0.00029748782981187105,-0.012843227945268154,0.004565857816487551,0.004911125637590885,-0.020200544968247414,0.03106880746781826,0.015423356555402279,0.07573161274194717,0.05314734950661659,0.028948748484253883,0.0106963487342,0.024246860295534134,0.014815200120210648,-0.007949811406433582,0.041303716599941254,-0.03270740807056427,-0.011824075132608414,0.007024983409792185,-0.003315035719424486,-0.008852151222527027,-0.04293571785092354,0.0007487072143703699,0.05832880362868309,-0.009321560151875019,0.07997024804353714,0.011141335591673851,-0.019089285284280777,0.036325737833976746,0.005286963656544685,-0.06499239057302475,0.030659519135951996,-0.0144186494871974,0.053294435143470764,0.052221450954675674,-0.054816585034132004,-0.012789861299097538,-0.03698977455496788,0.033882986754179,-0.010747001506388187,0.07272646576166153,0.08039798587560654,-0.06539573520421982,0.010853545740246773,-0.03852232173085213,-0.026888355612754822,0.009461588226258755,-0.010883075185120106,-0.014916210435330868,0.04752004146575928,-0.08876267075538635,-0.008047990500926971,0.03507597744464874,-0.0026095903012901545,-0.02231214940547943,0.04261229932308197,0.008198113180696964,0.010015025734901428,0.03979799523949623,0.013165483251214027,0.007362007163465023,-0.05882151797413826,-0.06709441542625427,-0.00511766504496336,-0.01910237781703472,-0.042609766125679016,0.02032652124762535,0.006306857336312532,-0.03262932598590851,-0.004456968512386084,-0.03348292410373688,0.040247149765491486,0.0038292070385068655,0.07047593593597412,-0.014328156597912312,0.03082657791674137,-0.043426305055618286,-0.018081139773130417,0.060057103633880615,0.014329847879707813,0.047628775238990784,0.035632457584142685,-0.007607249543070793,-0.03721296042203903,-0.015462473966181278,0.011549246497452259,-0.04429056495428085,0.03377557545900345,-0.031115969642996788,-0.006709962151944637,0.002125042024999857,0.048416703939437866,-0.060939401388168335,0.09698987752199173,-0.0009095817222259939,0.02636442892253399,0.005315954331308603,0.06229550763964653,-0.03159477934241295,0.026540320366621017,-0.039864618331193924,-0.02828037180006504,-0.014531844295561314,-0.12557193636894226,0.003805661341175437,0.01046071108430624,-0.08365020155906677,0.019239695742726326,-0.08847429603338242,0.04153357446193695,0.02610063925385475,0.09583274275064468,-0.04950889199972153,0.018627632409334183,-0.05174925550818443,0.019085686653852463,0.016774948686361313,-0.11135806888341904,-0.015533903613686562,-0.01453309878706932,0.011831202544271946,0.028074124827980995,-0.0694492906332016,0.04078487679362297,-0.04861922934651375,0.0303035881370306,0.01428429689258337,-0.00461840583011508,0.012004200369119644,-0.04869937524199486,-0.0697917491197586,-0.05140696465969086,-0.009134375490248203,-0.0876174122095108,-0.02698933333158493,-0.013045739382505417,-0.003420282155275345,0.019076500087976456,0.09156938642263412,-0.002111223293468356,-0.0099570844322443,-0.02259173057973385,0.005388194695115089,-0.04041041061282158,0.0041727484203875065,-0.07505736500024796,-0.00429822551086545,0.027567189186811447,0.00034730610786937177,-0.007391699124127626,-0.02758445031940937,0.003162542823702097,0.024867476895451546,0.014021704904735088,-0.015312335453927517,-0.036666810512542725,0.07531122118234634,0.010497979819774628,0.03788542374968529,0.04269714653491974,-0.05211373791098595,-0.015051876194775105,-0.02082068659365177,0.02414577826857567,-0.014286529272794724,0.01717400550842285,-0.05763528123497963,0.01567847467958927,0.01036211010068655,-0.002027261070907116,-0.032263729721307755,0.02666463330388069,0.01691061072051525,0.017628610134124756,0.03872695192694664,-0.011903682723641396,0.009094895794987679,-0.007115774787962437,0.06163916736841202,-0.014271091669797897,-0.07353312522172928,-0.047787703573703766,-0.061375077813863754,0.07678448408842087,-0.03708939254283905,-0.04780420660972595,0.023289140313863754,-0.029191695153713226,-0.024225270375609398,0.06386616826057434,0.0036334022879600525,0.0591583214700222,0.0332382395863533,0.027415752410888672,0.030244147405028343,-0.013022572733461857,0.03418239578604698,-0.032163865864276886,-0.004077209159731865,0.007259723264724016,-0.009120363742113113,-0.016532165929675102,0.026037652045488358,-0.01597398705780506,-0.00657427404075861,-0.0023431163281202316,-0.01884988136589527,0.020727017894387245,-0.04534260183572769,0.07710179686546326,-0.04634731262922287,-0.0158131942152977,-0.008079488761723042,0.003166313050314784,-0.08963721990585327,0.03423139452934265,0.03326864913105965,0.008875160478055477,0.013131668791174889,-0.01030565146356821,-0.0015139564638957381,-0.0208648219704628,-0.02734379656612873,-0.009308872744441032,0.02014326862990856,-0.040855348110198975,0.049103088676929474,-0.01752614788711071,0.016450338065624237,-0.023501362651586533,0.007685947697609663,0.048605892807245255,0.015211441554129124,0.003507978981360793,-0.045995574444532394,0.001609494094736874,-0.054065778851509094,0.008295922540128231,0.06832975894212723,-0.04093329980969429,-0.01087183877825737,-0.02184355817735195,0.005196921527385712,0.022784417495131493,0.013995813205838203,-0.01651753857731819,-0.003751164535060525,-0.022878993302583694,-0.010750386863946915,-0.004264294169843197,0.011338584125041962,0.002895209239795804,0.028557348996400833,0.045497965067625046,-0.03975067660212517,0.007666343357414007,0.033465586602687836,-0.0609513558447361,-0.04273007810115814,0.007823602296411991,-0.011720455251634121,0.012477600015699863,-0.0012435602257028222,0.008343501016497612,0.062380943447351456,-0.04855090007185936,-0.042172543704509735,0.08114547282457352,-0.032346148043870926,0.039752427488565445,0.01713743805885315,-0.0035788677632808685,-0.018234552815556526,-0.010398201644420624,-0.006583662237972021,0.019129864871501923,0.016576262190937996,-0.029443813487887383,-0.020557187497615814,0.003387896344065666,0.022134196013212204,-0.005239322781562805,0.009441684000194073,0.023727867752313614,-0.0025788377970457077,-0.06081293895840645,0.027369072660803795,0.060954805463552475,-0.01723795384168625,-0.012995134107768536,0.018262211233377457,0.013861984014511108,-0.04542136564850807,0.021598108112812042,0.0058436612598598,0.02502620406448841,0.06427992880344391,0.006888311356306076,0.045738834887742996,-0.015677642077207565,0.005761553067713976,0.013362864032387733,-0.04593086615204811,0.030318235978484154,0.015559324994683266,0.052569858729839325,-0.02475765533745289,0.07260248064994812,0.018301386386156082,-0.018890541046857834,-0.05783781781792641,-0.02541835978627205,0.04775286093354225,-0.0626068189740181,-0.056656334549188614,-0.003925547935068607,0.07909498363733292,0.005507426802068949,0.010135354474186897,-0.001519931829534471,-0.004654607269912958,-0.008362650871276855,0.007224437780678272,0.04132343456149101,0.031256046146154404,0.017791030928492546,0.04323013126850128,-0.005097879096865654,-0.09560910612344742,-8.259207714553677e-33,-0.024556145071983337,0.022102631628513336,0.014325915835797787,0.007467792835086584,0.022181756794452667,-0.004156444221735001,-0.0055400049313902855,-0.013586938381195068,-0.010888386517763138,0.006087350659072399,-0.022214118391275406,0.08551153540611267,0.023826608434319496,-0.016293304041028023,0.08231285214424133,0.051742225885391235,0.03086153045296669,-0.03668290004134178,0.013234255835413933,-0.02916865237057209,-0.05922786146402359,0.04599160701036453,0.05685488507151604,0.0017703131306916475,-0.02739022672176361,0.026033969596028328,-0.0035611814819276333,0.050132349133491516,0.0384039543569088,-0.04199206084012985,0.031096598133444786,-0.047402702271938324,0.01851504296064377,-0.03440646082162857,-0.01833229511976242,-0.12399942427873611,0.004500939045101404,-0.049630362540483475,0.0035980232059955597,-0.05077128857374191,0.047525156289339066,0.01567438803613186,-0.012756653130054474,-0.019816284999251366,-0.0018868129700422287,-0.03146521374583244,0.005594504065811634,-0.015602524392306805,-0.011493018828332424,0.04269885644316673,0.035786814987659454,0.05311894044280052,0.0000054382553571485914,0.047263361513614655,-0.023475894704461098,0.0339713990688324,0.025935333222150803,-0.030767932534217834,0.016840921714901924,-0.009747226722538471,0.022538792341947556,0.005192876327782869,-0.03274819627404213,-0.0006823857547715306,-0.06632023304700851,-0.005961493588984013,-0.02956503815948963,0.050665587186813354,-0.022973865270614624,-0.0032170547638088465,-0.026715513318777084,0.09035735577344894,-0.0733027532696724,0.06048073619604111,-0.02659323439002037,-0.04879622906446457,0.004576720762997866,0.03281503543257713,0.011172301135957241,0.07541850954294205,-0.009777474217116833,-0.01677696779370308,0.01986006833612919,-0.00823915097862482,0.013124785386025906,0.10119355469942093,0.0035065871197730303,0.017703380435705185,0.030975548550486565,0.0171807873994112,0.05597026273608208,-0.0203047264367342,-0.06698315590620041,0.0224043857306242,-0.037558794021606445,0.04106970876455307,0.07523109763860703,0.013525237329304218,-0.006907576695084572,-0.0028133168816566467,-0.04540853202342987,0.007095800247043371,-0.00035340298200026155,0.06717271357774734,-0.006719463504850864,-0.02434387244284153,0.03399656340479851,0.045175157487392426,-0.02289482206106186,0.00962306559085846,0.021782193332910538,0.02597384713590145,-0.03062657080590725,0.03611089661717415,-0.010893309488892555,-0.00567766185849905,0.015896232798695564,-0.03781704977154732,0.024729229509830475,0.04577189311385155,-0.038714393973350525,0.0061718556098639965,0.028157826513051987,0.07454665750265121,-0.017783978953957558,-0.017951656132936478,0.03769564628601074,0.04007122665643692,0.020823292434215546,0.07065784931182861,0.01425564382225275,0.04016052559018135,3.341587841987348e-7,0.00661906972527504,-0.012545458041131496,0.002252898644655943,0.01168903335928917,0.032742321491241455,-0.058293238282203674,-0.04007304087281227,0.0006280438392423093,-0.023423846811056137,0.0816369503736496,0.07240383327007294,-0.03978583216667175,0.019655784592032433,-0.03873623535037041,0.024939104914665222,-0.011820606887340546,-0.030730465427041054,-0.04191817343235016,-0.042222317308187485,-0.006788057740777731,-0.011507621966302395,-0.02296864427626133,0.014628659933805466,-0.04784434661269188,0.0032058742363005877,-0.006801917217671871,-0.011700686998665333,-0.0303913876414299,-0.09612173587083817,0.017388738691806793,0.0714249536395073,-0.007368740160018206,0.02509356662631035,-0.07321269065141678,0.007308758329600096,-0.019637659192085266,-0.050411250442266464,-0.008513635024428368,-0.022351618856191635,-0.029136929661035538,-0.01871326006948948,0.023097647354006767,-0.04499644786119461,0.027796290814876556,-0.009796911850571632,0.04976421967148781,0.0074449339881539345,0.016284745186567307,-0.0748547911643982,-0.018438441678881645,-0.01724812760949135,0.015872089192271233,-0.002281571738421917,-0.017746012657880783,0.0226507056504488,0.04363938421010971,-0.021115100011229515,0.038876973092556,0.022068213671445847,0.020145392045378685,-0.002953893970698118,0.01253490336239338,0.019217882305383682,-0.07486201077699661,-0.0444362610578537,-0.04545753449201584,-0.008551975712180138,2.424761074063251e-34,0.041223764419555664,-0.009610111825168133,-0.021340543404221535,0.0248064287006855,0.05781151354312897,-0.0019543429370969534,-0.02090398408472538,-0.014732498675584793,-0.013969582505524158,0.04551824927330017,0.020541833713650703]';
  p_EmbeddingModelID_918af2bd6163 := '1D45AA65-41EC-4572-9ECD-AB2826C9B059';
  p_Reusable_918af2bd6163 := FALSE;
  p_IsMaterialized_918af2bd6163 := FALSE;
  p_CategoryID_918af2bd6163 := COALESCE((SELECT "ID" FROM ${mjSchema}."QueryCategory" WHERE "Name" = 'Accounting' ORDER BY CASE WHEN "ID" = p_CategoryID_918af2bd6163 THEN 0 ELSE 1 END LIMIT 1), p_CategoryID_918af2bd6163);
  IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."Query"
               WHERE "ID" = p_ID_918af2bd6163
                  OR ("Name" = p_Name_918af2bd6163 AND ("CategoryID" = p_CategoryID_918af2bd6163 OR ("CategoryID" IS NULL AND p_CategoryID_918af2bd6163 IS NULL)))) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQuery'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM ${mjSchema}."spCreateQuery"(p_data := jsonb_build_object(
      'ID', p_ID_918af2bd6163,
      'Name', p_Name_918af2bd6163,
      'CategoryID', p_CategoryID_918af2bd6163,
      'UserQuestion', p_UserQuestion_918af2bd6163,
      'Description', p_Description_918af2bd6163,
      'SQL', p_SQL_918af2bd6163,
      'TechnicalDescription', p_TechnicalDescription_918af2bd6163,
      'OriginalSQL', p_OriginalSQL_918af2bd6163,
      'Feedback', p_Feedback_918af2bd6163,
      'Status', p_Status_918af2bd6163,
      'QualityRank', p_QualityRank_918af2bd6163,
      'ExecutionCostRank', p_ExecutionCostRank_918af2bd6163,
      'UsesTemplate', p_UsesTemplate_918af2bd6163,
      'AuditQueryRuns', p_AuditQueryRuns_918af2bd6163,
      'CacheEnabled', p_CacheEnabled_918af2bd6163,
      'CacheTTLMinutes', p_CacheTTLMinutes_918af2bd6163,
      'CacheMaxSize', p_CacheMaxSize_918af2bd6163,
      'EmbeddingVector', p_EmbeddingVector_918af2bd6163,
      'EmbeddingModelID', p_EmbeddingModelID_918af2bd6163,
      'CacheValidationSQL', p_CacheValidationSQL_918af2bd6163,
      'SQLDialectID', p_SQLDialectID_918af2bd6163,
      'Reusable', p_Reusable_918af2bd6163,
      'ExternalDataSourceID', p_ExternalDataSourceID_918af2bd6163,
      'IsMaterialized', p_IsMaterialized_918af2bd6163
    ));
    ELSE
      PERFORM ${mjSchema}."spCreateQuery"(p_ID := p_ID_918af2bd6163, p_Name := p_Name_918af2bd6163, p_CategoryID := p_CategoryID_918af2bd6163, p_UserQuestion := p_UserQuestion_918af2bd6163, p_Description := p_Description_918af2bd6163, p_SQL := p_SQL_918af2bd6163, p_TechnicalDescription := p_TechnicalDescription_918af2bd6163, p_OriginalSQL := p_OriginalSQL_918af2bd6163, p_OriginalSQL_Clear := TRUE, p_Feedback := p_Feedback_918af2bd6163, p_Feedback_Clear := TRUE, p_Status := p_Status_918af2bd6163, p_QualityRank := p_QualityRank_918af2bd6163, p_ExecutionCostRank := p_ExecutionCostRank_918af2bd6163, p_UsesTemplate := p_UsesTemplate_918af2bd6163, p_AuditQueryRuns := p_AuditQueryRuns_918af2bd6163, p_CacheEnabled := p_CacheEnabled_918af2bd6163, p_CacheTTLMinutes := p_CacheTTLMinutes_918af2bd6163, p_CacheTTLMinutes_Clear := TRUE, p_CacheMaxSize := p_CacheMaxSize_918af2bd6163, p_CacheMaxSize_Clear := TRUE, p_EmbeddingVector := p_EmbeddingVector_918af2bd6163, p_EmbeddingModelID := p_EmbeddingModelID_918af2bd6163, p_CacheValidationSQL := p_CacheValidationSQL_918af2bd6163, p_CacheValidationSQL_Clear := TRUE, p_SQLDialectID := p_SQLDialectID_918af2bd6163, p_Reusable := p_Reusable_918af2bd6163, p_ExternalDataSourceID := p_ExternalDataSourceID_918af2bd6163, p_ExternalDataSourceID_Clear := TRUE, p_IsMaterialized := p_IsMaterialized_918af2bd6163);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_7679730dee15 UUID;
  p_QueryID_7679730dee15 UUID;
  p_Name_7679730dee15 VARCHAR(255);
  p_Description_7679730dee15 TEXT;
  p_Sequence_7679730dee15 INTEGER;
  p_SQLBaseType_7679730dee15 VARCHAR(50);
  p_SQLFullType_7679730dee15 VARCHAR(100);
  p_SourceEntityID_7679730dee15 UUID;
  p_SourceFieldName_7679730dee15 VARCHAR(255);
  p_IsComputed_7679730dee15 BOOLEAN;
  p_ComputationDescription_7679730dee15 TEXT;
  p_IsSummary_7679730dee15 BOOLEAN;
  p_SummaryDescription_7679730dee15 TEXT;
  p_DetectionMethod_7679730dee15 VARCHAR(50);
  p_AutoDetectConfidenceScore_7679730dee15 NUMERIC(3,2);
BEGIN
  p_ID_7679730dee15 := 'd5d1a041-6348-4d47-8c5b-ade2da12976a';
  p_QueryID_7679730dee15 := 'A4884796-443D-49BB-915B-B94DF79EEA0C';
  p_Name_7679730dee15 := 'ReviewedMonth';
  p_Description_7679730dee15 := 'Computed column: ReviewedMonth';
  p_Sequence_7679730dee15 := 1;
  p_SQLBaseType_7679730dee15 := 'nvarchar';
  p_SQLFullType_7679730dee15 := 'nvarchar(MAX)';
  p_IsComputed_7679730dee15 := TRUE;
  p_IsSummary_7679730dee15 := FALSE;
  p_DetectionMethod_7679730dee15 := 'Manual';
  p_QueryID_7679730dee15 := COALESCE((SELECT "ID" FROM ${mjSchema}."Query" WHERE "Name" = 'Finance Exceptions Cleared' ORDER BY CASE WHEN "ID" = p_QueryID_7679730dee15 THEN 0 ELSE 1 END LIMIT 1), p_QueryID_7679730dee15);
  IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."QueryField"
               WHERE "ID" = p_ID_7679730dee15
                  OR ("QueryID" = p_QueryID_7679730dee15 AND "Name" = p_Name_7679730dee15)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM ${mjSchema}."spCreateQueryField"(p_data := jsonb_build_object(
      'ID', p_ID_7679730dee15,
      'QueryID', p_QueryID_7679730dee15,
      'Name', p_Name_7679730dee15,
      'Description', p_Description_7679730dee15,
      'Sequence', p_Sequence_7679730dee15,
      'SQLBaseType', p_SQLBaseType_7679730dee15,
      'SQLFullType', p_SQLFullType_7679730dee15,
      'SourceEntityID', p_SourceEntityID_7679730dee15,
      'SourceFieldName', p_SourceFieldName_7679730dee15,
      'IsComputed', p_IsComputed_7679730dee15,
      'ComputationDescription', p_ComputationDescription_7679730dee15,
      'IsSummary', p_IsSummary_7679730dee15,
      'SummaryDescription', p_SummaryDescription_7679730dee15,
      'DetectionMethod', p_DetectionMethod_7679730dee15,
      'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_7679730dee15
    ));
    ELSE
      PERFORM ${mjSchema}."spCreateQueryField"(p_ID := p_ID_7679730dee15, p_QueryID := p_QueryID_7679730dee15, p_Name := p_Name_7679730dee15, p_Description := p_Description_7679730dee15, p_Sequence := p_Sequence_7679730dee15, p_SQLBaseType := p_SQLBaseType_7679730dee15, p_SQLFullType := p_SQLFullType_7679730dee15, p_SourceEntityID := p_SourceEntityID_7679730dee15, p_SourceEntityID_Clear := TRUE, p_SourceFieldName := p_SourceFieldName_7679730dee15, p_SourceFieldName_Clear := TRUE, p_IsComputed := p_IsComputed_7679730dee15, p_ComputationDescription := p_ComputationDescription_7679730dee15, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_7679730dee15, p_SummaryDescription := p_SummaryDescription_7679730dee15, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_7679730dee15, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_7679730dee15, p_AutoDetectConfidenceScore_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_8f947357ba13 UUID;
  p_QueryID_8f947357ba13 UUID;
  p_Name_8f947357ba13 VARCHAR(255);
  p_Description_8f947357ba13 TEXT;
  p_Sequence_8f947357ba13 INTEGER;
  p_SQLBaseType_8f947357ba13 VARCHAR(50);
  p_SQLFullType_8f947357ba13 VARCHAR(100);
  p_SourceEntityID_8f947357ba13 UUID;
  p_SourceFieldName_8f947357ba13 VARCHAR(255);
  p_IsComputed_8f947357ba13 BOOLEAN;
  p_ComputationDescription_8f947357ba13 TEXT;
  p_IsSummary_8f947357ba13 BOOLEAN;
  p_SummaryDescription_8f947357ba13 TEXT;
  p_DetectionMethod_8f947357ba13 VARCHAR(50);
  p_AutoDetectConfidenceScore_8f947357ba13 NUMERIC(3,2);
BEGIN
  p_ID_8f947357ba13 := 'b66ad7c1-4a6e-4f16-be22-aff5751f3b1f';
  p_QueryID_8f947357ba13 := 'A4884796-443D-49BB-915B-B94DF79EEA0C';
  p_Name_8f947357ba13 := 'CompanyID';
  p_Description_8f947357ba13 := 'CompanyID';
  p_Sequence_8f947357ba13 := 2;
  p_SQLBaseType_8f947357ba13 := 'uniqueidentifier';
  p_SQLFullType_8f947357ba13 := 'uniqueidentifier';
  p_SourceEntityID_8f947357ba13 := '25D46762-4EA5-4FD5-A99F-F5870F72164C';
  p_SourceFieldName_8f947357ba13 := 'CompanyID';
  p_IsComputed_8f947357ba13 := FALSE;
  p_IsSummary_8f947357ba13 := FALSE;
  p_DetectionMethod_8f947357ba13 := 'Manual';
  p_QueryID_8f947357ba13 := COALESCE((SELECT "ID" FROM ${mjSchema}."Query" WHERE "Name" = 'Finance Exceptions Cleared' ORDER BY CASE WHEN "ID" = p_QueryID_8f947357ba13 THEN 0 ELSE 1 END LIMIT 1), p_QueryID_8f947357ba13);
  IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."QueryField"
               WHERE "ID" = p_ID_8f947357ba13
                  OR ("QueryID" = p_QueryID_8f947357ba13 AND "Name" = p_Name_8f947357ba13)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM ${mjSchema}."spCreateQueryField"(p_data := jsonb_build_object(
      'ID', p_ID_8f947357ba13,
      'QueryID', p_QueryID_8f947357ba13,
      'Name', p_Name_8f947357ba13,
      'Description', p_Description_8f947357ba13,
      'Sequence', p_Sequence_8f947357ba13,
      'SQLBaseType', p_SQLBaseType_8f947357ba13,
      'SQLFullType', p_SQLFullType_8f947357ba13,
      'SourceEntityID', p_SourceEntityID_8f947357ba13,
      'SourceFieldName', p_SourceFieldName_8f947357ba13,
      'IsComputed', p_IsComputed_8f947357ba13,
      'ComputationDescription', p_ComputationDescription_8f947357ba13,
      'IsSummary', p_IsSummary_8f947357ba13,
      'SummaryDescription', p_SummaryDescription_8f947357ba13,
      'DetectionMethod', p_DetectionMethod_8f947357ba13,
      'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_8f947357ba13
    ));
    ELSE
      PERFORM ${mjSchema}."spCreateQueryField"(p_ID := p_ID_8f947357ba13, p_QueryID := p_QueryID_8f947357ba13, p_Name := p_Name_8f947357ba13, p_Description := p_Description_8f947357ba13, p_Sequence := p_Sequence_8f947357ba13, p_SQLBaseType := p_SQLBaseType_8f947357ba13, p_SQLFullType := p_SQLFullType_8f947357ba13, p_SourceEntityID := p_SourceEntityID_8f947357ba13, p_SourceFieldName := p_SourceFieldName_8f947357ba13, p_IsComputed := p_IsComputed_8f947357ba13, p_ComputationDescription := p_ComputationDescription_8f947357ba13, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_8f947357ba13, p_SummaryDescription := p_SummaryDescription_8f947357ba13, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_8f947357ba13, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_8f947357ba13, p_AutoDetectConfidenceScore_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_8604098c4bbe UUID;
  p_QueryID_8604098c4bbe UUID;
  p_Name_8604098c4bbe VARCHAR(255);
  p_Description_8604098c4bbe TEXT;
  p_Sequence_8604098c4bbe INTEGER;
  p_SQLBaseType_8604098c4bbe VARCHAR(50);
  p_SQLFullType_8604098c4bbe VARCHAR(100);
  p_SourceEntityID_8604098c4bbe UUID;
  p_SourceFieldName_8604098c4bbe VARCHAR(255);
  p_IsComputed_8604098c4bbe BOOLEAN;
  p_ComputationDescription_8604098c4bbe TEXT;
  p_IsSummary_8604098c4bbe BOOLEAN;
  p_SummaryDescription_8604098c4bbe TEXT;
  p_DetectionMethod_8604098c4bbe VARCHAR(50);
  p_AutoDetectConfidenceScore_8604098c4bbe NUMERIC(3,2);
BEGIN
  p_ID_8604098c4bbe := '3d50ddc5-4b98-4a4b-abd6-e83291286b44';
  p_QueryID_8604098c4bbe := 'A4884796-443D-49BB-915B-B94DF79EEA0C';
  p_Name_8604098c4bbe := 'Company';
  p_Description_8604098c4bbe := 'Company';
  p_Sequence_8604098c4bbe := 3;
  p_SQLBaseType_8604098c4bbe := 'nvarchar';
  p_SQLFullType_8604098c4bbe := 'nvarchar(50)';
  p_SourceEntityID_8604098c4bbe := '25D46762-4EA5-4FD5-A99F-F5870F72164C';
  p_SourceFieldName_8604098c4bbe := 'Company';
  p_IsComputed_8604098c4bbe := FALSE;
  p_IsSummary_8604098c4bbe := FALSE;
  p_DetectionMethod_8604098c4bbe := 'Manual';
  p_QueryID_8604098c4bbe := COALESCE((SELECT "ID" FROM ${mjSchema}."Query" WHERE "Name" = 'Finance Exceptions Cleared' ORDER BY CASE WHEN "ID" = p_QueryID_8604098c4bbe THEN 0 ELSE 1 END LIMIT 1), p_QueryID_8604098c4bbe);
  IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."QueryField"
               WHERE "ID" = p_ID_8604098c4bbe
                  OR ("QueryID" = p_QueryID_8604098c4bbe AND "Name" = p_Name_8604098c4bbe)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM ${mjSchema}."spCreateQueryField"(p_data := jsonb_build_object(
      'ID', p_ID_8604098c4bbe,
      'QueryID', p_QueryID_8604098c4bbe,
      'Name', p_Name_8604098c4bbe,
      'Description', p_Description_8604098c4bbe,
      'Sequence', p_Sequence_8604098c4bbe,
      'SQLBaseType', p_SQLBaseType_8604098c4bbe,
      'SQLFullType', p_SQLFullType_8604098c4bbe,
      'SourceEntityID', p_SourceEntityID_8604098c4bbe,
      'SourceFieldName', p_SourceFieldName_8604098c4bbe,
      'IsComputed', p_IsComputed_8604098c4bbe,
      'ComputationDescription', p_ComputationDescription_8604098c4bbe,
      'IsSummary', p_IsSummary_8604098c4bbe,
      'SummaryDescription', p_SummaryDescription_8604098c4bbe,
      'DetectionMethod', p_DetectionMethod_8604098c4bbe,
      'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_8604098c4bbe
    ));
    ELSE
      PERFORM ${mjSchema}."spCreateQueryField"(p_ID := p_ID_8604098c4bbe, p_QueryID := p_QueryID_8604098c4bbe, p_Name := p_Name_8604098c4bbe, p_Description := p_Description_8604098c4bbe, p_Sequence := p_Sequence_8604098c4bbe, p_SQLBaseType := p_SQLBaseType_8604098c4bbe, p_SQLFullType := p_SQLFullType_8604098c4bbe, p_SourceEntityID := p_SourceEntityID_8604098c4bbe, p_SourceFieldName := p_SourceFieldName_8604098c4bbe, p_IsComputed := p_IsComputed_8604098c4bbe, p_ComputationDescription := p_ComputationDescription_8604098c4bbe, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_8604098c4bbe, p_SummaryDescription := p_SummaryDescription_8604098c4bbe, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_8604098c4bbe, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_8604098c4bbe, p_AutoDetectConfidenceScore_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_5fd87d8d3da7 UUID;
  p_QueryID_5fd87d8d3da7 UUID;
  p_Name_5fd87d8d3da7 VARCHAR(255);
  p_Description_5fd87d8d3da7 TEXT;
  p_Sequence_5fd87d8d3da7 INTEGER;
  p_SQLBaseType_5fd87d8d3da7 VARCHAR(50);
  p_SQLFullType_5fd87d8d3da7 VARCHAR(100);
  p_SourceEntityID_5fd87d8d3da7 UUID;
  p_SourceFieldName_5fd87d8d3da7 VARCHAR(255);
  p_IsComputed_5fd87d8d3da7 BOOLEAN;
  p_ComputationDescription_5fd87d8d3da7 TEXT;
  p_IsSummary_5fd87d8d3da7 BOOLEAN;
  p_SummaryDescription_5fd87d8d3da7 TEXT;
  p_DetectionMethod_5fd87d8d3da7 VARCHAR(50);
  p_AutoDetectConfidenceScore_5fd87d8d3da7 NUMERIC(3,2);
BEGIN
  p_ID_5fd87d8d3da7 := '25433b15-dc59-400c-ae12-16451dcce32a';
  p_QueryID_5fd87d8d3da7 := 'A4884796-443D-49BB-915B-B94DF79EEA0C';
  p_Name_5fd87d8d3da7 := 'TypeCode';
  p_Description_5fd87d8d3da7 := 'Code (aliased as TypeCode)';
  p_Sequence_5fd87d8d3da7 := 4;
  p_SQLBaseType_5fd87d8d3da7 := 'nvarchar';
  p_SQLFullType_5fd87d8d3da7 := 'nvarchar(60)';
  p_SourceEntityID_5fd87d8d3da7 := '57FD0C9B-C308-41A4-988A-E4C378A9803D';
  p_SourceFieldName_5fd87d8d3da7 := 'Code';
  p_IsComputed_5fd87d8d3da7 := FALSE;
  p_IsSummary_5fd87d8d3da7 := FALSE;
  p_DetectionMethod_5fd87d8d3da7 := 'Manual';
  p_QueryID_5fd87d8d3da7 := COALESCE((SELECT "ID" FROM ${mjSchema}."Query" WHERE "Name" = 'Finance Exceptions Cleared' ORDER BY CASE WHEN "ID" = p_QueryID_5fd87d8d3da7 THEN 0 ELSE 1 END LIMIT 1), p_QueryID_5fd87d8d3da7);
  IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."QueryField"
               WHERE "ID" = p_ID_5fd87d8d3da7
                  OR ("QueryID" = p_QueryID_5fd87d8d3da7 AND "Name" = p_Name_5fd87d8d3da7)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM ${mjSchema}."spCreateQueryField"(p_data := jsonb_build_object(
      'ID', p_ID_5fd87d8d3da7,
      'QueryID', p_QueryID_5fd87d8d3da7,
      'Name', p_Name_5fd87d8d3da7,
      'Description', p_Description_5fd87d8d3da7,
      'Sequence', p_Sequence_5fd87d8d3da7,
      'SQLBaseType', p_SQLBaseType_5fd87d8d3da7,
      'SQLFullType', p_SQLFullType_5fd87d8d3da7,
      'SourceEntityID', p_SourceEntityID_5fd87d8d3da7,
      'SourceFieldName', p_SourceFieldName_5fd87d8d3da7,
      'IsComputed', p_IsComputed_5fd87d8d3da7,
      'ComputationDescription', p_ComputationDescription_5fd87d8d3da7,
      'IsSummary', p_IsSummary_5fd87d8d3da7,
      'SummaryDescription', p_SummaryDescription_5fd87d8d3da7,
      'DetectionMethod', p_DetectionMethod_5fd87d8d3da7,
      'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_5fd87d8d3da7
    ));
    ELSE
      PERFORM ${mjSchema}."spCreateQueryField"(p_ID := p_ID_5fd87d8d3da7, p_QueryID := p_QueryID_5fd87d8d3da7, p_Name := p_Name_5fd87d8d3da7, p_Description := p_Description_5fd87d8d3da7, p_Sequence := p_Sequence_5fd87d8d3da7, p_SQLBaseType := p_SQLBaseType_5fd87d8d3da7, p_SQLFullType := p_SQLFullType_5fd87d8d3da7, p_SourceEntityID := p_SourceEntityID_5fd87d8d3da7, p_SourceFieldName := p_SourceFieldName_5fd87d8d3da7, p_IsComputed := p_IsComputed_5fd87d8d3da7, p_ComputationDescription := p_ComputationDescription_5fd87d8d3da7, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_5fd87d8d3da7, p_SummaryDescription := p_SummaryDescription_5fd87d8d3da7, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_5fd87d8d3da7, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_5fd87d8d3da7, p_AutoDetectConfidenceScore_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_36e1c3ffe4e7 UUID;
  p_QueryID_36e1c3ffe4e7 UUID;
  p_Name_36e1c3ffe4e7 VARCHAR(255);
  p_Description_36e1c3ffe4e7 TEXT;
  p_Sequence_36e1c3ffe4e7 INTEGER;
  p_SQLBaseType_36e1c3ffe4e7 VARCHAR(50);
  p_SQLFullType_36e1c3ffe4e7 VARCHAR(100);
  p_SourceEntityID_36e1c3ffe4e7 UUID;
  p_SourceFieldName_36e1c3ffe4e7 VARCHAR(255);
  p_IsComputed_36e1c3ffe4e7 BOOLEAN;
  p_ComputationDescription_36e1c3ffe4e7 TEXT;
  p_IsSummary_36e1c3ffe4e7 BOOLEAN;
  p_SummaryDescription_36e1c3ffe4e7 TEXT;
  p_DetectionMethod_36e1c3ffe4e7 VARCHAR(50);
  p_AutoDetectConfidenceScore_36e1c3ffe4e7 NUMERIC(3,2);
BEGIN
  p_ID_36e1c3ffe4e7 := '98d296d8-0e1d-420f-b89e-14f0641070ea';
  p_QueryID_36e1c3ffe4e7 := 'A4884796-443D-49BB-915B-B94DF79EEA0C';
  p_Name_36e1c3ffe4e7 := 'FinanceExceptionType';
  p_Description_36e1c3ffe4e7 := 'FinanceExceptionType';
  p_Sequence_36e1c3ffe4e7 := 5;
  p_SQLBaseType_36e1c3ffe4e7 := 'nvarchar';
  p_SQLFullType_36e1c3ffe4e7 := 'nvarchar(100)';
  p_SourceEntityID_36e1c3ffe4e7 := '25D46762-4EA5-4FD5-A99F-F5870F72164C';
  p_SourceFieldName_36e1c3ffe4e7 := 'FinanceExceptionType';
  p_IsComputed_36e1c3ffe4e7 := FALSE;
  p_IsSummary_36e1c3ffe4e7 := FALSE;
  p_DetectionMethod_36e1c3ffe4e7 := 'Manual';
  p_QueryID_36e1c3ffe4e7 := COALESCE((SELECT "ID" FROM ${mjSchema}."Query" WHERE "Name" = 'Finance Exceptions Cleared' ORDER BY CASE WHEN "ID" = p_QueryID_36e1c3ffe4e7 THEN 0 ELSE 1 END LIMIT 1), p_QueryID_36e1c3ffe4e7);
  IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."QueryField"
               WHERE "ID" = p_ID_36e1c3ffe4e7
                  OR ("QueryID" = p_QueryID_36e1c3ffe4e7 AND "Name" = p_Name_36e1c3ffe4e7)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM ${mjSchema}."spCreateQueryField"(p_data := jsonb_build_object(
      'ID', p_ID_36e1c3ffe4e7,
      'QueryID', p_QueryID_36e1c3ffe4e7,
      'Name', p_Name_36e1c3ffe4e7,
      'Description', p_Description_36e1c3ffe4e7,
      'Sequence', p_Sequence_36e1c3ffe4e7,
      'SQLBaseType', p_SQLBaseType_36e1c3ffe4e7,
      'SQLFullType', p_SQLFullType_36e1c3ffe4e7,
      'SourceEntityID', p_SourceEntityID_36e1c3ffe4e7,
      'SourceFieldName', p_SourceFieldName_36e1c3ffe4e7,
      'IsComputed', p_IsComputed_36e1c3ffe4e7,
      'ComputationDescription', p_ComputationDescription_36e1c3ffe4e7,
      'IsSummary', p_IsSummary_36e1c3ffe4e7,
      'SummaryDescription', p_SummaryDescription_36e1c3ffe4e7,
      'DetectionMethod', p_DetectionMethod_36e1c3ffe4e7,
      'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_36e1c3ffe4e7
    ));
    ELSE
      PERFORM ${mjSchema}."spCreateQueryField"(p_ID := p_ID_36e1c3ffe4e7, p_QueryID := p_QueryID_36e1c3ffe4e7, p_Name := p_Name_36e1c3ffe4e7, p_Description := p_Description_36e1c3ffe4e7, p_Sequence := p_Sequence_36e1c3ffe4e7, p_SQLBaseType := p_SQLBaseType_36e1c3ffe4e7, p_SQLFullType := p_SQLFullType_36e1c3ffe4e7, p_SourceEntityID := p_SourceEntityID_36e1c3ffe4e7, p_SourceFieldName := p_SourceFieldName_36e1c3ffe4e7, p_IsComputed := p_IsComputed_36e1c3ffe4e7, p_ComputationDescription := p_ComputationDescription_36e1c3ffe4e7, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_36e1c3ffe4e7, p_SummaryDescription := p_SummaryDescription_36e1c3ffe4e7, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_36e1c3ffe4e7, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_36e1c3ffe4e7, p_AutoDetectConfidenceScore_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_ece8b26248ca UUID;
  p_QueryID_ece8b26248ca UUID;
  p_Name_ece8b26248ca VARCHAR(255);
  p_Description_ece8b26248ca TEXT;
  p_Sequence_ece8b26248ca INTEGER;
  p_SQLBaseType_ece8b26248ca VARCHAR(50);
  p_SQLFullType_ece8b26248ca VARCHAR(100);
  p_SourceEntityID_ece8b26248ca UUID;
  p_SourceFieldName_ece8b26248ca VARCHAR(255);
  p_IsComputed_ece8b26248ca BOOLEAN;
  p_ComputationDescription_ece8b26248ca TEXT;
  p_IsSummary_ece8b26248ca BOOLEAN;
  p_SummaryDescription_ece8b26248ca TEXT;
  p_DetectionMethod_ece8b26248ca VARCHAR(50);
  p_AutoDetectConfidenceScore_ece8b26248ca NUMERIC(3,2);
BEGIN
  p_ID_ece8b26248ca := '5db18a3a-1d1e-46ae-ad33-3f19baf0a556';
  p_QueryID_ece8b26248ca := 'A4884796-443D-49BB-915B-B94DF79EEA0C';
  p_Name_ece8b26248ca := 'Outcome';
  p_Description_ece8b26248ca := 'Status (aliased as Outcome)';
  p_Sequence_ece8b26248ca := 6;
  p_SQLBaseType_ece8b26248ca := 'nvarchar';
  p_SQLFullType_ece8b26248ca := 'nvarchar(20)';
  p_SourceEntityID_ece8b26248ca := '25D46762-4EA5-4FD5-A99F-F5870F72164C';
  p_SourceFieldName_ece8b26248ca := 'Status';
  p_IsComputed_ece8b26248ca := FALSE;
  p_IsSummary_ece8b26248ca := FALSE;
  p_DetectionMethod_ece8b26248ca := 'Manual';
  p_QueryID_ece8b26248ca := COALESCE((SELECT "ID" FROM ${mjSchema}."Query" WHERE "Name" = 'Finance Exceptions Cleared' ORDER BY CASE WHEN "ID" = p_QueryID_ece8b26248ca THEN 0 ELSE 1 END LIMIT 1), p_QueryID_ece8b26248ca);
  IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."QueryField"
               WHERE "ID" = p_ID_ece8b26248ca
                  OR ("QueryID" = p_QueryID_ece8b26248ca AND "Name" = p_Name_ece8b26248ca)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM ${mjSchema}."spCreateQueryField"(p_data := jsonb_build_object(
      'ID', p_ID_ece8b26248ca,
      'QueryID', p_QueryID_ece8b26248ca,
      'Name', p_Name_ece8b26248ca,
      'Description', p_Description_ece8b26248ca,
      'Sequence', p_Sequence_ece8b26248ca,
      'SQLBaseType', p_SQLBaseType_ece8b26248ca,
      'SQLFullType', p_SQLFullType_ece8b26248ca,
      'SourceEntityID', p_SourceEntityID_ece8b26248ca,
      'SourceFieldName', p_SourceFieldName_ece8b26248ca,
      'IsComputed', p_IsComputed_ece8b26248ca,
      'ComputationDescription', p_ComputationDescription_ece8b26248ca,
      'IsSummary', p_IsSummary_ece8b26248ca,
      'SummaryDescription', p_SummaryDescription_ece8b26248ca,
      'DetectionMethod', p_DetectionMethod_ece8b26248ca,
      'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_ece8b26248ca
    ));
    ELSE
      PERFORM ${mjSchema}."spCreateQueryField"(p_ID := p_ID_ece8b26248ca, p_QueryID := p_QueryID_ece8b26248ca, p_Name := p_Name_ece8b26248ca, p_Description := p_Description_ece8b26248ca, p_Sequence := p_Sequence_ece8b26248ca, p_SQLBaseType := p_SQLBaseType_ece8b26248ca, p_SQLFullType := p_SQLFullType_ece8b26248ca, p_SourceEntityID := p_SourceEntityID_ece8b26248ca, p_SourceFieldName := p_SourceFieldName_ece8b26248ca, p_IsComputed := p_IsComputed_ece8b26248ca, p_ComputationDescription := p_ComputationDescription_ece8b26248ca, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_ece8b26248ca, p_SummaryDescription := p_SummaryDescription_ece8b26248ca, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_ece8b26248ca, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_ece8b26248ca, p_AutoDetectConfidenceScore_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_b74f0c88f154 UUID;
  p_QueryID_b74f0c88f154 UUID;
  p_Name_b74f0c88f154 VARCHAR(255);
  p_Description_b74f0c88f154 TEXT;
  p_Sequence_b74f0c88f154 INTEGER;
  p_SQLBaseType_b74f0c88f154 VARCHAR(50);
  p_SQLFullType_b74f0c88f154 VARCHAR(100);
  p_SourceEntityID_b74f0c88f154 UUID;
  p_SourceFieldName_b74f0c88f154 VARCHAR(255);
  p_IsComputed_b74f0c88f154 BOOLEAN;
  p_ComputationDescription_b74f0c88f154 TEXT;
  p_IsSummary_b74f0c88f154 BOOLEAN;
  p_SummaryDescription_b74f0c88f154 TEXT;
  p_DetectionMethod_b74f0c88f154 VARCHAR(50);
  p_AutoDetectConfidenceScore_b74f0c88f154 NUMERIC(3,2);
BEGIN
  p_ID_b74f0c88f154 := '3f6a511e-f879-43b1-a315-f9de28fcdb57';
  p_QueryID_b74f0c88f154 := 'A4884796-443D-49BB-915B-B94DF79EEA0C';
  p_Name_b74f0c88f154 := 'ReviewedAt';
  p_Description_b74f0c88f154 := 'ReviewedAt';
  p_Sequence_b74f0c88f154 := 7;
  p_SQLBaseType_b74f0c88f154 := 'datetimeoffset';
  p_SQLFullType_b74f0c88f154 := 'datetimeoffset';
  p_SourceEntityID_b74f0c88f154 := '25D46762-4EA5-4FD5-A99F-F5870F72164C';
  p_SourceFieldName_b74f0c88f154 := 'ReviewedAt';
  p_IsComputed_b74f0c88f154 := FALSE;
  p_IsSummary_b74f0c88f154 := FALSE;
  p_DetectionMethod_b74f0c88f154 := 'Manual';
  p_QueryID_b74f0c88f154 := COALESCE((SELECT "ID" FROM ${mjSchema}."Query" WHERE "Name" = 'Finance Exceptions Cleared' ORDER BY CASE WHEN "ID" = p_QueryID_b74f0c88f154 THEN 0 ELSE 1 END LIMIT 1), p_QueryID_b74f0c88f154);
  IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."QueryField"
               WHERE "ID" = p_ID_b74f0c88f154
                  OR ("QueryID" = p_QueryID_b74f0c88f154 AND "Name" = p_Name_b74f0c88f154)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM ${mjSchema}."spCreateQueryField"(p_data := jsonb_build_object(
      'ID', p_ID_b74f0c88f154,
      'QueryID', p_QueryID_b74f0c88f154,
      'Name', p_Name_b74f0c88f154,
      'Description', p_Description_b74f0c88f154,
      'Sequence', p_Sequence_b74f0c88f154,
      'SQLBaseType', p_SQLBaseType_b74f0c88f154,
      'SQLFullType', p_SQLFullType_b74f0c88f154,
      'SourceEntityID', p_SourceEntityID_b74f0c88f154,
      'SourceFieldName', p_SourceFieldName_b74f0c88f154,
      'IsComputed', p_IsComputed_b74f0c88f154,
      'ComputationDescription', p_ComputationDescription_b74f0c88f154,
      'IsSummary', p_IsSummary_b74f0c88f154,
      'SummaryDescription', p_SummaryDescription_b74f0c88f154,
      'DetectionMethod', p_DetectionMethod_b74f0c88f154,
      'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_b74f0c88f154
    ));
    ELSE
      PERFORM ${mjSchema}."spCreateQueryField"(p_ID := p_ID_b74f0c88f154, p_QueryID := p_QueryID_b74f0c88f154, p_Name := p_Name_b74f0c88f154, p_Description := p_Description_b74f0c88f154, p_Sequence := p_Sequence_b74f0c88f154, p_SQLBaseType := p_SQLBaseType_b74f0c88f154, p_SQLFullType := p_SQLFullType_b74f0c88f154, p_SourceEntityID := p_SourceEntityID_b74f0c88f154, p_SourceFieldName := p_SourceFieldName_b74f0c88f154, p_IsComputed := p_IsComputed_b74f0c88f154, p_ComputationDescription := p_ComputationDescription_b74f0c88f154, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_b74f0c88f154, p_SummaryDescription := p_SummaryDescription_b74f0c88f154, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_b74f0c88f154, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_b74f0c88f154, p_AutoDetectConfidenceScore_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_86e5bfcee3dc UUID;
  p_QueryID_86e5bfcee3dc UUID;
  p_Name_86e5bfcee3dc VARCHAR(255);
  p_Description_86e5bfcee3dc TEXT;
  p_Sequence_86e5bfcee3dc INTEGER;
  p_SQLBaseType_86e5bfcee3dc VARCHAR(50);
  p_SQLFullType_86e5bfcee3dc VARCHAR(100);
  p_SourceEntityID_86e5bfcee3dc UUID;
  p_SourceFieldName_86e5bfcee3dc VARCHAR(255);
  p_IsComputed_86e5bfcee3dc BOOLEAN;
  p_ComputationDescription_86e5bfcee3dc TEXT;
  p_IsSummary_86e5bfcee3dc BOOLEAN;
  p_SummaryDescription_86e5bfcee3dc TEXT;
  p_DetectionMethod_86e5bfcee3dc VARCHAR(50);
  p_AutoDetectConfidenceScore_86e5bfcee3dc NUMERIC(3,2);
BEGIN
  p_ID_86e5bfcee3dc := '2254d0cb-c0be-47c8-901f-79ffd0accbb6';
  p_QueryID_86e5bfcee3dc := 'A4884796-443D-49BB-915B-B94DF79EEA0C';
  p_Name_86e5bfcee3dc := 'ReviewedByUserID';
  p_Description_86e5bfcee3dc := 'ReviewedByUserID';
  p_Sequence_86e5bfcee3dc := 8;
  p_SQLBaseType_86e5bfcee3dc := 'uniqueidentifier';
  p_SQLFullType_86e5bfcee3dc := 'uniqueidentifier';
  p_SourceEntityID_86e5bfcee3dc := '25D46762-4EA5-4FD5-A99F-F5870F72164C';
  p_SourceFieldName_86e5bfcee3dc := 'ReviewedByUserID';
  p_IsComputed_86e5bfcee3dc := FALSE;
  p_IsSummary_86e5bfcee3dc := FALSE;
  p_DetectionMethod_86e5bfcee3dc := 'Manual';
  p_QueryID_86e5bfcee3dc := COALESCE((SELECT "ID" FROM ${mjSchema}."Query" WHERE "Name" = 'Finance Exceptions Cleared' ORDER BY CASE WHEN "ID" = p_QueryID_86e5bfcee3dc THEN 0 ELSE 1 END LIMIT 1), p_QueryID_86e5bfcee3dc);
  IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."QueryField"
               WHERE "ID" = p_ID_86e5bfcee3dc
                  OR ("QueryID" = p_QueryID_86e5bfcee3dc AND "Name" = p_Name_86e5bfcee3dc)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM ${mjSchema}."spCreateQueryField"(p_data := jsonb_build_object(
      'ID', p_ID_86e5bfcee3dc,
      'QueryID', p_QueryID_86e5bfcee3dc,
      'Name', p_Name_86e5bfcee3dc,
      'Description', p_Description_86e5bfcee3dc,
      'Sequence', p_Sequence_86e5bfcee3dc,
      'SQLBaseType', p_SQLBaseType_86e5bfcee3dc,
      'SQLFullType', p_SQLFullType_86e5bfcee3dc,
      'SourceEntityID', p_SourceEntityID_86e5bfcee3dc,
      'SourceFieldName', p_SourceFieldName_86e5bfcee3dc,
      'IsComputed', p_IsComputed_86e5bfcee3dc,
      'ComputationDescription', p_ComputationDescription_86e5bfcee3dc,
      'IsSummary', p_IsSummary_86e5bfcee3dc,
      'SummaryDescription', p_SummaryDescription_86e5bfcee3dc,
      'DetectionMethod', p_DetectionMethod_86e5bfcee3dc,
      'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_86e5bfcee3dc
    ));
    ELSE
      PERFORM ${mjSchema}."spCreateQueryField"(p_ID := p_ID_86e5bfcee3dc, p_QueryID := p_QueryID_86e5bfcee3dc, p_Name := p_Name_86e5bfcee3dc, p_Description := p_Description_86e5bfcee3dc, p_Sequence := p_Sequence_86e5bfcee3dc, p_SQLBaseType := p_SQLBaseType_86e5bfcee3dc, p_SQLFullType := p_SQLFullType_86e5bfcee3dc, p_SourceEntityID := p_SourceEntityID_86e5bfcee3dc, p_SourceFieldName := p_SourceFieldName_86e5bfcee3dc, p_IsComputed := p_IsComputed_86e5bfcee3dc, p_ComputationDescription := p_ComputationDescription_86e5bfcee3dc, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_86e5bfcee3dc, p_SummaryDescription := p_SummaryDescription_86e5bfcee3dc, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_86e5bfcee3dc, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_86e5bfcee3dc, p_AutoDetectConfidenceScore_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_c82e2f96e0cf UUID;
  p_QueryID_c82e2f96e0cf UUID;
  p_Name_c82e2f96e0cf VARCHAR(255);
  p_Description_c82e2f96e0cf TEXT;
  p_Sequence_c82e2f96e0cf INTEGER;
  p_SQLBaseType_c82e2f96e0cf VARCHAR(50);
  p_SQLFullType_c82e2f96e0cf VARCHAR(100);
  p_SourceEntityID_c82e2f96e0cf UUID;
  p_SourceFieldName_c82e2f96e0cf VARCHAR(255);
  p_IsComputed_c82e2f96e0cf BOOLEAN;
  p_ComputationDescription_c82e2f96e0cf TEXT;
  p_IsSummary_c82e2f96e0cf BOOLEAN;
  p_SummaryDescription_c82e2f96e0cf TEXT;
  p_DetectionMethod_c82e2f96e0cf VARCHAR(50);
  p_AutoDetectConfidenceScore_c82e2f96e0cf NUMERIC(3,2);
BEGIN
  p_ID_c82e2f96e0cf := '16946613-a04e-46ea-b791-42df7b8f3e45';
  p_QueryID_c82e2f96e0cf := 'A4884796-443D-49BB-915B-B94DF79EEA0C';
  p_Name_c82e2f96e0cf := 'ReviewedByUser';
  p_Description_c82e2f96e0cf := 'ReviewedByUser';
  p_Sequence_c82e2f96e0cf := 9;
  p_SQLBaseType_c82e2f96e0cf := 'nvarchar';
  p_SQLFullType_c82e2f96e0cf := 'nvarchar(100)';
  p_SourceEntityID_c82e2f96e0cf := '25D46762-4EA5-4FD5-A99F-F5870F72164C';
  p_SourceFieldName_c82e2f96e0cf := 'ReviewedByUser';
  p_IsComputed_c82e2f96e0cf := FALSE;
  p_IsSummary_c82e2f96e0cf := FALSE;
  p_DetectionMethod_c82e2f96e0cf := 'Manual';
  p_QueryID_c82e2f96e0cf := COALESCE((SELECT "ID" FROM ${mjSchema}."Query" WHERE "Name" = 'Finance Exceptions Cleared' ORDER BY CASE WHEN "ID" = p_QueryID_c82e2f96e0cf THEN 0 ELSE 1 END LIMIT 1), p_QueryID_c82e2f96e0cf);
  IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."QueryField"
               WHERE "ID" = p_ID_c82e2f96e0cf
                  OR ("QueryID" = p_QueryID_c82e2f96e0cf AND "Name" = p_Name_c82e2f96e0cf)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM ${mjSchema}."spCreateQueryField"(p_data := jsonb_build_object(
      'ID', p_ID_c82e2f96e0cf,
      'QueryID', p_QueryID_c82e2f96e0cf,
      'Name', p_Name_c82e2f96e0cf,
      'Description', p_Description_c82e2f96e0cf,
      'Sequence', p_Sequence_c82e2f96e0cf,
      'SQLBaseType', p_SQLBaseType_c82e2f96e0cf,
      'SQLFullType', p_SQLFullType_c82e2f96e0cf,
      'SourceEntityID', p_SourceEntityID_c82e2f96e0cf,
      'SourceFieldName', p_SourceFieldName_c82e2f96e0cf,
      'IsComputed', p_IsComputed_c82e2f96e0cf,
      'ComputationDescription', p_ComputationDescription_c82e2f96e0cf,
      'IsSummary', p_IsSummary_c82e2f96e0cf,
      'SummaryDescription', p_SummaryDescription_c82e2f96e0cf,
      'DetectionMethod', p_DetectionMethod_c82e2f96e0cf,
      'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_c82e2f96e0cf
    ));
    ELSE
      PERFORM ${mjSchema}."spCreateQueryField"(p_ID := p_ID_c82e2f96e0cf, p_QueryID := p_QueryID_c82e2f96e0cf, p_Name := p_Name_c82e2f96e0cf, p_Description := p_Description_c82e2f96e0cf, p_Sequence := p_Sequence_c82e2f96e0cf, p_SQLBaseType := p_SQLBaseType_c82e2f96e0cf, p_SQLFullType := p_SQLFullType_c82e2f96e0cf, p_SourceEntityID := p_SourceEntityID_c82e2f96e0cf, p_SourceFieldName := p_SourceFieldName_c82e2f96e0cf, p_IsComputed := p_IsComputed_c82e2f96e0cf, p_ComputationDescription := p_ComputationDescription_c82e2f96e0cf, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_c82e2f96e0cf, p_SummaryDescription := p_SummaryDescription_c82e2f96e0cf, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_c82e2f96e0cf, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_c82e2f96e0cf, p_AutoDetectConfidenceScore_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_61e55dd986fe UUID;
  p_QueryID_61e55dd986fe UUID;
  p_Name_61e55dd986fe VARCHAR(255);
  p_Description_61e55dd986fe TEXT;
  p_Sequence_61e55dd986fe INTEGER;
  p_SQLBaseType_61e55dd986fe VARCHAR(50);
  p_SQLFullType_61e55dd986fe VARCHAR(100);
  p_SourceEntityID_61e55dd986fe UUID;
  p_SourceFieldName_61e55dd986fe VARCHAR(255);
  p_IsComputed_61e55dd986fe BOOLEAN;
  p_ComputationDescription_61e55dd986fe TEXT;
  p_IsSummary_61e55dd986fe BOOLEAN;
  p_SummaryDescription_61e55dd986fe TEXT;
  p_DetectionMethod_61e55dd986fe VARCHAR(50);
  p_AutoDetectConfidenceScore_61e55dd986fe NUMERIC(3,2);
BEGIN
  p_ID_61e55dd986fe := 'e226adcd-a44f-4b0a-abb7-49a8299c40ea';
  p_QueryID_61e55dd986fe := 'A4884796-443D-49BB-915B-B94DF79EEA0C';
  p_Name_61e55dd986fe := 'ReviewNote';
  p_Description_61e55dd986fe := 'ReviewNote';
  p_Sequence_61e55dd986fe := 10;
  p_SQLBaseType_61e55dd986fe := 'nvarchar';
  p_SQLFullType_61e55dd986fe := 'nvarchar(MAX)';
  p_SourceEntityID_61e55dd986fe := '25D46762-4EA5-4FD5-A99F-F5870F72164C';
  p_SourceFieldName_61e55dd986fe := 'ReviewNote';
  p_IsComputed_61e55dd986fe := FALSE;
  p_IsSummary_61e55dd986fe := FALSE;
  p_DetectionMethod_61e55dd986fe := 'Manual';
  p_QueryID_61e55dd986fe := COALESCE((SELECT "ID" FROM ${mjSchema}."Query" WHERE "Name" = 'Finance Exceptions Cleared' ORDER BY CASE WHEN "ID" = p_QueryID_61e55dd986fe THEN 0 ELSE 1 END LIMIT 1), p_QueryID_61e55dd986fe);
  IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."QueryField"
               WHERE "ID" = p_ID_61e55dd986fe
                  OR ("QueryID" = p_QueryID_61e55dd986fe AND "Name" = p_Name_61e55dd986fe)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM ${mjSchema}."spCreateQueryField"(p_data := jsonb_build_object(
      'ID', p_ID_61e55dd986fe,
      'QueryID', p_QueryID_61e55dd986fe,
      'Name', p_Name_61e55dd986fe,
      'Description', p_Description_61e55dd986fe,
      'Sequence', p_Sequence_61e55dd986fe,
      'SQLBaseType', p_SQLBaseType_61e55dd986fe,
      'SQLFullType', p_SQLFullType_61e55dd986fe,
      'SourceEntityID', p_SourceEntityID_61e55dd986fe,
      'SourceFieldName', p_SourceFieldName_61e55dd986fe,
      'IsComputed', p_IsComputed_61e55dd986fe,
      'ComputationDescription', p_ComputationDescription_61e55dd986fe,
      'IsSummary', p_IsSummary_61e55dd986fe,
      'SummaryDescription', p_SummaryDescription_61e55dd986fe,
      'DetectionMethod', p_DetectionMethod_61e55dd986fe,
      'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_61e55dd986fe
    ));
    ELSE
      PERFORM ${mjSchema}."spCreateQueryField"(p_ID := p_ID_61e55dd986fe, p_QueryID := p_QueryID_61e55dd986fe, p_Name := p_Name_61e55dd986fe, p_Description := p_Description_61e55dd986fe, p_Sequence := p_Sequence_61e55dd986fe, p_SQLBaseType := p_SQLBaseType_61e55dd986fe, p_SQLFullType := p_SQLFullType_61e55dd986fe, p_SourceEntityID := p_SourceEntityID_61e55dd986fe, p_SourceFieldName := p_SourceFieldName_61e55dd986fe, p_IsComputed := p_IsComputed_61e55dd986fe, p_ComputationDescription := p_ComputationDescription_61e55dd986fe, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_61e55dd986fe, p_SummaryDescription := p_SummaryDescription_61e55dd986fe, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_61e55dd986fe, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_61e55dd986fe, p_AutoDetectConfidenceScore_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_fc30aadae70f UUID;
  p_QueryID_fc30aadae70f UUID;
  p_Name_fc30aadae70f VARCHAR(255);
  p_Description_fc30aadae70f TEXT;
  p_Sequence_fc30aadae70f INTEGER;
  p_SQLBaseType_fc30aadae70f VARCHAR(50);
  p_SQLFullType_fc30aadae70f VARCHAR(100);
  p_SourceEntityID_fc30aadae70f UUID;
  p_SourceFieldName_fc30aadae70f VARCHAR(255);
  p_IsComputed_fc30aadae70f BOOLEAN;
  p_ComputationDescription_fc30aadae70f TEXT;
  p_IsSummary_fc30aadae70f BOOLEAN;
  p_SummaryDescription_fc30aadae70f TEXT;
  p_DetectionMethod_fc30aadae70f VARCHAR(50);
  p_AutoDetectConfidenceScore_fc30aadae70f NUMERIC(3,2);
BEGIN
  p_ID_fc30aadae70f := '9bf1401a-4a94-4d6a-baaa-0d37ef154b57';
  p_QueryID_fc30aadae70f := 'A4884796-443D-49BB-915B-B94DF79EEA0C';
  p_Name_fc30aadae70f := 'SourceCreatedByUserID';
  p_Description_fc30aadae70f := 'SourceCreatedByUserID';
  p_Sequence_fc30aadae70f := 11;
  p_SQLBaseType_fc30aadae70f := 'uniqueidentifier';
  p_SQLFullType_fc30aadae70f := 'uniqueidentifier';
  p_SourceEntityID_fc30aadae70f := '25D46762-4EA5-4FD5-A99F-F5870F72164C';
  p_SourceFieldName_fc30aadae70f := 'SourceCreatedByUserID';
  p_IsComputed_fc30aadae70f := FALSE;
  p_IsSummary_fc30aadae70f := FALSE;
  p_DetectionMethod_fc30aadae70f := 'Manual';
  p_QueryID_fc30aadae70f := COALESCE((SELECT "ID" FROM ${mjSchema}."Query" WHERE "Name" = 'Finance Exceptions Cleared' ORDER BY CASE WHEN "ID" = p_QueryID_fc30aadae70f THEN 0 ELSE 1 END LIMIT 1), p_QueryID_fc30aadae70f);
  IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."QueryField"
               WHERE "ID" = p_ID_fc30aadae70f
                  OR ("QueryID" = p_QueryID_fc30aadae70f AND "Name" = p_Name_fc30aadae70f)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM ${mjSchema}."spCreateQueryField"(p_data := jsonb_build_object(
      'ID', p_ID_fc30aadae70f,
      'QueryID', p_QueryID_fc30aadae70f,
      'Name', p_Name_fc30aadae70f,
      'Description', p_Description_fc30aadae70f,
      'Sequence', p_Sequence_fc30aadae70f,
      'SQLBaseType', p_SQLBaseType_fc30aadae70f,
      'SQLFullType', p_SQLFullType_fc30aadae70f,
      'SourceEntityID', p_SourceEntityID_fc30aadae70f,
      'SourceFieldName', p_SourceFieldName_fc30aadae70f,
      'IsComputed', p_IsComputed_fc30aadae70f,
      'ComputationDescription', p_ComputationDescription_fc30aadae70f,
      'IsSummary', p_IsSummary_fc30aadae70f,
      'SummaryDescription', p_SummaryDescription_fc30aadae70f,
      'DetectionMethod', p_DetectionMethod_fc30aadae70f,
      'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_fc30aadae70f
    ));
    ELSE
      PERFORM ${mjSchema}."spCreateQueryField"(p_ID := p_ID_fc30aadae70f, p_QueryID := p_QueryID_fc30aadae70f, p_Name := p_Name_fc30aadae70f, p_Description := p_Description_fc30aadae70f, p_Sequence := p_Sequence_fc30aadae70f, p_SQLBaseType := p_SQLBaseType_fc30aadae70f, p_SQLFullType := p_SQLFullType_fc30aadae70f, p_SourceEntityID := p_SourceEntityID_fc30aadae70f, p_SourceFieldName := p_SourceFieldName_fc30aadae70f, p_IsComputed := p_IsComputed_fc30aadae70f, p_ComputationDescription := p_ComputationDescription_fc30aadae70f, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_fc30aadae70f, p_SummaryDescription := p_SummaryDescription_fc30aadae70f, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_fc30aadae70f, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_fc30aadae70f, p_AutoDetectConfidenceScore_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_edc700d5ccf5 UUID;
  p_QueryID_edc700d5ccf5 UUID;
  p_Name_edc700d5ccf5 VARCHAR(255);
  p_Description_edc700d5ccf5 TEXT;
  p_Sequence_edc700d5ccf5 INTEGER;
  p_SQLBaseType_edc700d5ccf5 VARCHAR(50);
  p_SQLFullType_edc700d5ccf5 VARCHAR(100);
  p_SourceEntityID_edc700d5ccf5 UUID;
  p_SourceFieldName_edc700d5ccf5 VARCHAR(255);
  p_IsComputed_edc700d5ccf5 BOOLEAN;
  p_ComputationDescription_edc700d5ccf5 TEXT;
  p_IsSummary_edc700d5ccf5 BOOLEAN;
  p_SummaryDescription_edc700d5ccf5 TEXT;
  p_DetectionMethod_edc700d5ccf5 VARCHAR(50);
  p_AutoDetectConfidenceScore_edc700d5ccf5 NUMERIC(3,2);
BEGIN
  p_ID_edc700d5ccf5 := 'da0db906-b72e-4a03-a036-004bdbbca29a';
  p_QueryID_edc700d5ccf5 := 'A4884796-443D-49BB-915B-B94DF79EEA0C';
  p_Name_edc700d5ccf5 := 'SourceCreatedByUser';
  p_Description_edc700d5ccf5 := 'SourceCreatedByUser';
  p_Sequence_edc700d5ccf5 := 12;
  p_SQLBaseType_edc700d5ccf5 := 'nvarchar';
  p_SQLFullType_edc700d5ccf5 := 'nvarchar(100)';
  p_SourceEntityID_edc700d5ccf5 := '25D46762-4EA5-4FD5-A99F-F5870F72164C';
  p_SourceFieldName_edc700d5ccf5 := 'SourceCreatedByUser';
  p_IsComputed_edc700d5ccf5 := FALSE;
  p_IsSummary_edc700d5ccf5 := FALSE;
  p_DetectionMethod_edc700d5ccf5 := 'Manual';
  p_QueryID_edc700d5ccf5 := COALESCE((SELECT "ID" FROM ${mjSchema}."Query" WHERE "Name" = 'Finance Exceptions Cleared' ORDER BY CASE WHEN "ID" = p_QueryID_edc700d5ccf5 THEN 0 ELSE 1 END LIMIT 1), p_QueryID_edc700d5ccf5);
  IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."QueryField"
               WHERE "ID" = p_ID_edc700d5ccf5
                  OR ("QueryID" = p_QueryID_edc700d5ccf5 AND "Name" = p_Name_edc700d5ccf5)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM ${mjSchema}."spCreateQueryField"(p_data := jsonb_build_object(
      'ID', p_ID_edc700d5ccf5,
      'QueryID', p_QueryID_edc700d5ccf5,
      'Name', p_Name_edc700d5ccf5,
      'Description', p_Description_edc700d5ccf5,
      'Sequence', p_Sequence_edc700d5ccf5,
      'SQLBaseType', p_SQLBaseType_edc700d5ccf5,
      'SQLFullType', p_SQLFullType_edc700d5ccf5,
      'SourceEntityID', p_SourceEntityID_edc700d5ccf5,
      'SourceFieldName', p_SourceFieldName_edc700d5ccf5,
      'IsComputed', p_IsComputed_edc700d5ccf5,
      'ComputationDescription', p_ComputationDescription_edc700d5ccf5,
      'IsSummary', p_IsSummary_edc700d5ccf5,
      'SummaryDescription', p_SummaryDescription_edc700d5ccf5,
      'DetectionMethod', p_DetectionMethod_edc700d5ccf5,
      'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_edc700d5ccf5
    ));
    ELSE
      PERFORM ${mjSchema}."spCreateQueryField"(p_ID := p_ID_edc700d5ccf5, p_QueryID := p_QueryID_edc700d5ccf5, p_Name := p_Name_edc700d5ccf5, p_Description := p_Description_edc700d5ccf5, p_Sequence := p_Sequence_edc700d5ccf5, p_SQLBaseType := p_SQLBaseType_edc700d5ccf5, p_SQLFullType := p_SQLFullType_edc700d5ccf5, p_SourceEntityID := p_SourceEntityID_edc700d5ccf5, p_SourceFieldName := p_SourceFieldName_edc700d5ccf5, p_IsComputed := p_IsComputed_edc700d5ccf5, p_ComputationDescription := p_ComputationDescription_edc700d5ccf5, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_edc700d5ccf5, p_SummaryDescription := p_SummaryDescription_edc700d5ccf5, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_edc700d5ccf5, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_edc700d5ccf5, p_AutoDetectConfidenceScore_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_08fdea60f1f9 UUID;
  p_QueryID_08fdea60f1f9 UUID;
  p_Name_08fdea60f1f9 VARCHAR(255);
  p_Description_08fdea60f1f9 TEXT;
  p_Sequence_08fdea60f1f9 INTEGER;
  p_SQLBaseType_08fdea60f1f9 VARCHAR(50);
  p_SQLFullType_08fdea60f1f9 VARCHAR(100);
  p_SourceEntityID_08fdea60f1f9 UUID;
  p_SourceFieldName_08fdea60f1f9 VARCHAR(255);
  p_IsComputed_08fdea60f1f9 BOOLEAN;
  p_ComputationDescription_08fdea60f1f9 TEXT;
  p_IsSummary_08fdea60f1f9 BOOLEAN;
  p_SummaryDescription_08fdea60f1f9 TEXT;
  p_DetectionMethod_08fdea60f1f9 VARCHAR(50);
  p_AutoDetectConfidenceScore_08fdea60f1f9 NUMERIC(3,2);
BEGIN
  p_ID_08fdea60f1f9 := '9e34e854-7381-49ce-a7d7-612ec5c1b78f';
  p_QueryID_08fdea60f1f9 := 'A4884796-443D-49BB-915B-B94DF79EEA0C';
  p_Name_08fdea60f1f9 := 'CreatorUnresolved';
  p_Description_08fdea60f1f9 := 'CreatorUnresolved';
  p_Sequence_08fdea60f1f9 := 13;
  p_SQLBaseType_08fdea60f1f9 := 'bit';
  p_SQLFullType_08fdea60f1f9 := 'bit';
  p_SourceEntityID_08fdea60f1f9 := '25D46762-4EA5-4FD5-A99F-F5870F72164C';
  p_SourceFieldName_08fdea60f1f9 := 'CreatorUnresolved';
  p_IsComputed_08fdea60f1f9 := FALSE;
  p_IsSummary_08fdea60f1f9 := FALSE;
  p_DetectionMethod_08fdea60f1f9 := 'Manual';
  p_QueryID_08fdea60f1f9 := COALESCE((SELECT "ID" FROM ${mjSchema}."Query" WHERE "Name" = 'Finance Exceptions Cleared' ORDER BY CASE WHEN "ID" = p_QueryID_08fdea60f1f9 THEN 0 ELSE 1 END LIMIT 1), p_QueryID_08fdea60f1f9);
  IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."QueryField"
               WHERE "ID" = p_ID_08fdea60f1f9
                  OR ("QueryID" = p_QueryID_08fdea60f1f9 AND "Name" = p_Name_08fdea60f1f9)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM ${mjSchema}."spCreateQueryField"(p_data := jsonb_build_object(
      'ID', p_ID_08fdea60f1f9,
      'QueryID', p_QueryID_08fdea60f1f9,
      'Name', p_Name_08fdea60f1f9,
      'Description', p_Description_08fdea60f1f9,
      'Sequence', p_Sequence_08fdea60f1f9,
      'SQLBaseType', p_SQLBaseType_08fdea60f1f9,
      'SQLFullType', p_SQLFullType_08fdea60f1f9,
      'SourceEntityID', p_SourceEntityID_08fdea60f1f9,
      'SourceFieldName', p_SourceFieldName_08fdea60f1f9,
      'IsComputed', p_IsComputed_08fdea60f1f9,
      'ComputationDescription', p_ComputationDescription_08fdea60f1f9,
      'IsSummary', p_IsSummary_08fdea60f1f9,
      'SummaryDescription', p_SummaryDescription_08fdea60f1f9,
      'DetectionMethod', p_DetectionMethod_08fdea60f1f9,
      'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_08fdea60f1f9
    ));
    ELSE
      PERFORM ${mjSchema}."spCreateQueryField"(p_ID := p_ID_08fdea60f1f9, p_QueryID := p_QueryID_08fdea60f1f9, p_Name := p_Name_08fdea60f1f9, p_Description := p_Description_08fdea60f1f9, p_Sequence := p_Sequence_08fdea60f1f9, p_SQLBaseType := p_SQLBaseType_08fdea60f1f9, p_SQLFullType := p_SQLFullType_08fdea60f1f9, p_SourceEntityID := p_SourceEntityID_08fdea60f1f9, p_SourceFieldName := p_SourceFieldName_08fdea60f1f9, p_IsComputed := p_IsComputed_08fdea60f1f9, p_ComputationDescription := p_ComputationDescription_08fdea60f1f9, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_08fdea60f1f9, p_SummaryDescription := p_SummaryDescription_08fdea60f1f9, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_08fdea60f1f9, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_08fdea60f1f9, p_AutoDetectConfidenceScore_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_87d28897348f UUID;
  p_QueryID_87d28897348f UUID;
  p_Name_87d28897348f VARCHAR(255);
  p_Description_87d28897348f TEXT;
  p_Sequence_87d28897348f INTEGER;
  p_SQLBaseType_87d28897348f VARCHAR(50);
  p_SQLFullType_87d28897348f VARCHAR(100);
  p_SourceEntityID_87d28897348f UUID;
  p_SourceFieldName_87d28897348f VARCHAR(255);
  p_IsComputed_87d28897348f BOOLEAN;
  p_ComputationDescription_87d28897348f TEXT;
  p_IsSummary_87d28897348f BOOLEAN;
  p_SummaryDescription_87d28897348f TEXT;
  p_DetectionMethod_87d28897348f VARCHAR(50);
  p_AutoDetectConfidenceScore_87d28897348f NUMERIC(3,2);
BEGIN
  p_ID_87d28897348f := 'e5585905-8ed3-4978-9a7b-88a4a69fd324';
  p_QueryID_87d28897348f := 'A4884796-443D-49BB-915B-B94DF79EEA0C';
  p_Name_87d28897348f := 'ExceptionDate';
  p_Description_87d28897348f := 'ExceptionDate';
  p_Sequence_87d28897348f := 14;
  p_SQLBaseType_87d28897348f := 'date';
  p_SQLFullType_87d28897348f := 'date';
  p_SourceEntityID_87d28897348f := '25D46762-4EA5-4FD5-A99F-F5870F72164C';
  p_SourceFieldName_87d28897348f := 'ExceptionDate';
  p_IsComputed_87d28897348f := FALSE;
  p_IsSummary_87d28897348f := FALSE;
  p_DetectionMethod_87d28897348f := 'Manual';
  p_QueryID_87d28897348f := COALESCE((SELECT "ID" FROM ${mjSchema}."Query" WHERE "Name" = 'Finance Exceptions Cleared' ORDER BY CASE WHEN "ID" = p_QueryID_87d28897348f THEN 0 ELSE 1 END LIMIT 1), p_QueryID_87d28897348f);
  IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."QueryField"
               WHERE "ID" = p_ID_87d28897348f
                  OR ("QueryID" = p_QueryID_87d28897348f AND "Name" = p_Name_87d28897348f)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM ${mjSchema}."spCreateQueryField"(p_data := jsonb_build_object(
      'ID', p_ID_87d28897348f,
      'QueryID', p_QueryID_87d28897348f,
      'Name', p_Name_87d28897348f,
      'Description', p_Description_87d28897348f,
      'Sequence', p_Sequence_87d28897348f,
      'SQLBaseType', p_SQLBaseType_87d28897348f,
      'SQLFullType', p_SQLFullType_87d28897348f,
      'SourceEntityID', p_SourceEntityID_87d28897348f,
      'SourceFieldName', p_SourceFieldName_87d28897348f,
      'IsComputed', p_IsComputed_87d28897348f,
      'ComputationDescription', p_ComputationDescription_87d28897348f,
      'IsSummary', p_IsSummary_87d28897348f,
      'SummaryDescription', p_SummaryDescription_87d28897348f,
      'DetectionMethod', p_DetectionMethod_87d28897348f,
      'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_87d28897348f
    ));
    ELSE
      PERFORM ${mjSchema}."spCreateQueryField"(p_ID := p_ID_87d28897348f, p_QueryID := p_QueryID_87d28897348f, p_Name := p_Name_87d28897348f, p_Description := p_Description_87d28897348f, p_Sequence := p_Sequence_87d28897348f, p_SQLBaseType := p_SQLBaseType_87d28897348f, p_SQLFullType := p_SQLFullType_87d28897348f, p_SourceEntityID := p_SourceEntityID_87d28897348f, p_SourceFieldName := p_SourceFieldName_87d28897348f, p_IsComputed := p_IsComputed_87d28897348f, p_ComputationDescription := p_ComputationDescription_87d28897348f, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_87d28897348f, p_SummaryDescription := p_SummaryDescription_87d28897348f, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_87d28897348f, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_87d28897348f, p_AutoDetectConfidenceScore_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_2b81b40352d5 UUID;
  p_QueryID_2b81b40352d5 UUID;
  p_Name_2b81b40352d5 VARCHAR(255);
  p_Description_2b81b40352d5 TEXT;
  p_Sequence_2b81b40352d5 INTEGER;
  p_SQLBaseType_2b81b40352d5 VARCHAR(50);
  p_SQLFullType_2b81b40352d5 VARCHAR(100);
  p_SourceEntityID_2b81b40352d5 UUID;
  p_SourceFieldName_2b81b40352d5 VARCHAR(255);
  p_IsComputed_2b81b40352d5 BOOLEAN;
  p_ComputationDescription_2b81b40352d5 TEXT;
  p_IsSummary_2b81b40352d5 BOOLEAN;
  p_SummaryDescription_2b81b40352d5 TEXT;
  p_DetectionMethod_2b81b40352d5 VARCHAR(50);
  p_AutoDetectConfidenceScore_2b81b40352d5 NUMERIC(3,2);
BEGIN
  p_ID_2b81b40352d5 := '881e5eb4-c446-4b06-9c43-efa0cc92e810';
  p_QueryID_2b81b40352d5 := 'A4884796-443D-49BB-915B-B94DF79EEA0C';
  p_Name_2b81b40352d5 := 'Amount';
  p_Description_2b81b40352d5 := 'Amount';
  p_Sequence_2b81b40352d5 := 15;
  p_SQLBaseType_2b81b40352d5 := 'decimal';
  p_SQLFullType_2b81b40352d5 := 'decimal(19, 4)';
  p_SourceEntityID_2b81b40352d5 := '25D46762-4EA5-4FD5-A99F-F5870F72164C';
  p_SourceFieldName_2b81b40352d5 := 'Amount';
  p_IsComputed_2b81b40352d5 := FALSE;
  p_IsSummary_2b81b40352d5 := FALSE;
  p_DetectionMethod_2b81b40352d5 := 'Manual';
  p_QueryID_2b81b40352d5 := COALESCE((SELECT "ID" FROM ${mjSchema}."Query" WHERE "Name" = 'Finance Exceptions Cleared' ORDER BY CASE WHEN "ID" = p_QueryID_2b81b40352d5 THEN 0 ELSE 1 END LIMIT 1), p_QueryID_2b81b40352d5);
  IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."QueryField"
               WHERE "ID" = p_ID_2b81b40352d5
                  OR ("QueryID" = p_QueryID_2b81b40352d5 AND "Name" = p_Name_2b81b40352d5)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM ${mjSchema}."spCreateQueryField"(p_data := jsonb_build_object(
      'ID', p_ID_2b81b40352d5,
      'QueryID', p_QueryID_2b81b40352d5,
      'Name', p_Name_2b81b40352d5,
      'Description', p_Description_2b81b40352d5,
      'Sequence', p_Sequence_2b81b40352d5,
      'SQLBaseType', p_SQLBaseType_2b81b40352d5,
      'SQLFullType', p_SQLFullType_2b81b40352d5,
      'SourceEntityID', p_SourceEntityID_2b81b40352d5,
      'SourceFieldName', p_SourceFieldName_2b81b40352d5,
      'IsComputed', p_IsComputed_2b81b40352d5,
      'ComputationDescription', p_ComputationDescription_2b81b40352d5,
      'IsSummary', p_IsSummary_2b81b40352d5,
      'SummaryDescription', p_SummaryDescription_2b81b40352d5,
      'DetectionMethod', p_DetectionMethod_2b81b40352d5,
      'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_2b81b40352d5
    ));
    ELSE
      PERFORM ${mjSchema}."spCreateQueryField"(p_ID := p_ID_2b81b40352d5, p_QueryID := p_QueryID_2b81b40352d5, p_Name := p_Name_2b81b40352d5, p_Description := p_Description_2b81b40352d5, p_Sequence := p_Sequence_2b81b40352d5, p_SQLBaseType := p_SQLBaseType_2b81b40352d5, p_SQLFullType := p_SQLFullType_2b81b40352d5, p_SourceEntityID := p_SourceEntityID_2b81b40352d5, p_SourceFieldName := p_SourceFieldName_2b81b40352d5, p_IsComputed := p_IsComputed_2b81b40352d5, p_ComputationDescription := p_ComputationDescription_2b81b40352d5, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_2b81b40352d5, p_SummaryDescription := p_SummaryDescription_2b81b40352d5, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_2b81b40352d5, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_2b81b40352d5, p_AutoDetectConfidenceScore_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_20467079e042 UUID;
  p_QueryID_20467079e042 UUID;
  p_Name_20467079e042 VARCHAR(255);
  p_Description_20467079e042 TEXT;
  p_Sequence_20467079e042 INTEGER;
  p_SQLBaseType_20467079e042 VARCHAR(50);
  p_SQLFullType_20467079e042 VARCHAR(100);
  p_SourceEntityID_20467079e042 UUID;
  p_SourceFieldName_20467079e042 VARCHAR(255);
  p_IsComputed_20467079e042 BOOLEAN;
  p_ComputationDescription_20467079e042 TEXT;
  p_IsSummary_20467079e042 BOOLEAN;
  p_SummaryDescription_20467079e042 TEXT;
  p_DetectionMethod_20467079e042 VARCHAR(50);
  p_AutoDetectConfidenceScore_20467079e042 NUMERIC(3,2);
BEGIN
  p_ID_20467079e042 := '286941c4-dcd2-4169-9091-cb3807db9e46';
  p_QueryID_20467079e042 := 'A4884796-443D-49BB-915B-B94DF79EEA0C';
  p_Name_20467079e042 := 'Summary';
  p_Description_20467079e042 := 'Summary';
  p_Sequence_20467079e042 := 16;
  p_SQLBaseType_20467079e042 := 'nvarchar';
  p_SQLFullType_20467079e042 := 'nvarchar(1000)';
  p_SourceEntityID_20467079e042 := '25D46762-4EA5-4FD5-A99F-F5870F72164C';
  p_SourceFieldName_20467079e042 := 'Summary';
  p_IsComputed_20467079e042 := FALSE;
  p_IsSummary_20467079e042 := FALSE;
  p_DetectionMethod_20467079e042 := 'Manual';
  p_QueryID_20467079e042 := COALESCE((SELECT "ID" FROM ${mjSchema}."Query" WHERE "Name" = 'Finance Exceptions Cleared' ORDER BY CASE WHEN "ID" = p_QueryID_20467079e042 THEN 0 ELSE 1 END LIMIT 1), p_QueryID_20467079e042);
  IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."QueryField"
               WHERE "ID" = p_ID_20467079e042
                  OR ("QueryID" = p_QueryID_20467079e042 AND "Name" = p_Name_20467079e042)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM ${mjSchema}."spCreateQueryField"(p_data := jsonb_build_object(
      'ID', p_ID_20467079e042,
      'QueryID', p_QueryID_20467079e042,
      'Name', p_Name_20467079e042,
      'Description', p_Description_20467079e042,
      'Sequence', p_Sequence_20467079e042,
      'SQLBaseType', p_SQLBaseType_20467079e042,
      'SQLFullType', p_SQLFullType_20467079e042,
      'SourceEntityID', p_SourceEntityID_20467079e042,
      'SourceFieldName', p_SourceFieldName_20467079e042,
      'IsComputed', p_IsComputed_20467079e042,
      'ComputationDescription', p_ComputationDescription_20467079e042,
      'IsSummary', p_IsSummary_20467079e042,
      'SummaryDescription', p_SummaryDescription_20467079e042,
      'DetectionMethod', p_DetectionMethod_20467079e042,
      'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_20467079e042
    ));
    ELSE
      PERFORM ${mjSchema}."spCreateQueryField"(p_ID := p_ID_20467079e042, p_QueryID := p_QueryID_20467079e042, p_Name := p_Name_20467079e042, p_Description := p_Description_20467079e042, p_Sequence := p_Sequence_20467079e042, p_SQLBaseType := p_SQLBaseType_20467079e042, p_SQLFullType := p_SQLFullType_20467079e042, p_SourceEntityID := p_SourceEntityID_20467079e042, p_SourceFieldName := p_SourceFieldName_20467079e042, p_IsComputed := p_IsComputed_20467079e042, p_ComputationDescription := p_ComputationDescription_20467079e042, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_20467079e042, p_SummaryDescription := p_SummaryDescription_20467079e042, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_20467079e042, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_20467079e042, p_AutoDetectConfidenceScore_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_e31b373debb0 UUID;
  p_QueryID_e31b373debb0 UUID;
  p_Name_e31b373debb0 VARCHAR(255);
  p_Description_e31b373debb0 TEXT;
  p_Sequence_e31b373debb0 INTEGER;
  p_SQLBaseType_e31b373debb0 VARCHAR(50);
  p_SQLFullType_e31b373debb0 VARCHAR(100);
  p_SourceEntityID_e31b373debb0 UUID;
  p_SourceFieldName_e31b373debb0 VARCHAR(255);
  p_IsComputed_e31b373debb0 BOOLEAN;
  p_ComputationDescription_e31b373debb0 TEXT;
  p_IsSummary_e31b373debb0 BOOLEAN;
  p_SummaryDescription_e31b373debb0 TEXT;
  p_DetectionMethod_e31b373debb0 VARCHAR(50);
  p_AutoDetectConfidenceScore_e31b373debb0 NUMERIC(3,2);
BEGIN
  p_ID_e31b373debb0 := 'bd5bb8b8-c5a4-422b-aab9-e66b504b6e8f';
  p_QueryID_e31b373debb0 := 'A4884796-443D-49BB-915B-B94DF79EEA0C';
  p_Name_e31b373debb0 := 'SourceEntity';
  p_Description_e31b373debb0 := 'SourceEntity';
  p_Sequence_e31b373debb0 := 17;
  p_SQLBaseType_e31b373debb0 := 'nvarchar';
  p_SQLFullType_e31b373debb0 := 'nvarchar(255)';
  p_SourceEntityID_e31b373debb0 := '25D46762-4EA5-4FD5-A99F-F5870F72164C';
  p_SourceFieldName_e31b373debb0 := 'SourceEntity';
  p_IsComputed_e31b373debb0 := FALSE;
  p_IsSummary_e31b373debb0 := FALSE;
  p_DetectionMethod_e31b373debb0 := 'Manual';
  p_QueryID_e31b373debb0 := COALESCE((SELECT "ID" FROM ${mjSchema}."Query" WHERE "Name" = 'Finance Exceptions Cleared' ORDER BY CASE WHEN "ID" = p_QueryID_e31b373debb0 THEN 0 ELSE 1 END LIMIT 1), p_QueryID_e31b373debb0);
  IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."QueryField"
               WHERE "ID" = p_ID_e31b373debb0
                  OR ("QueryID" = p_QueryID_e31b373debb0 AND "Name" = p_Name_e31b373debb0)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM ${mjSchema}."spCreateQueryField"(p_data := jsonb_build_object(
      'ID', p_ID_e31b373debb0,
      'QueryID', p_QueryID_e31b373debb0,
      'Name', p_Name_e31b373debb0,
      'Description', p_Description_e31b373debb0,
      'Sequence', p_Sequence_e31b373debb0,
      'SQLBaseType', p_SQLBaseType_e31b373debb0,
      'SQLFullType', p_SQLFullType_e31b373debb0,
      'SourceEntityID', p_SourceEntityID_e31b373debb0,
      'SourceFieldName', p_SourceFieldName_e31b373debb0,
      'IsComputed', p_IsComputed_e31b373debb0,
      'ComputationDescription', p_ComputationDescription_e31b373debb0,
      'IsSummary', p_IsSummary_e31b373debb0,
      'SummaryDescription', p_SummaryDescription_e31b373debb0,
      'DetectionMethod', p_DetectionMethod_e31b373debb0,
      'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_e31b373debb0
    ));
    ELSE
      PERFORM ${mjSchema}."spCreateQueryField"(p_ID := p_ID_e31b373debb0, p_QueryID := p_QueryID_e31b373debb0, p_Name := p_Name_e31b373debb0, p_Description := p_Description_e31b373debb0, p_Sequence := p_Sequence_e31b373debb0, p_SQLBaseType := p_SQLBaseType_e31b373debb0, p_SQLFullType := p_SQLFullType_e31b373debb0, p_SourceEntityID := p_SourceEntityID_e31b373debb0, p_SourceFieldName := p_SourceFieldName_e31b373debb0, p_IsComputed := p_IsComputed_e31b373debb0, p_ComputationDescription := p_ComputationDescription_e31b373debb0, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_e31b373debb0, p_SummaryDescription := p_SummaryDescription_e31b373debb0, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_e31b373debb0, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_e31b373debb0, p_AutoDetectConfidenceScore_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_3c0f1790a38f UUID;
  p_QueryID_3c0f1790a38f UUID;
  p_Name_3c0f1790a38f VARCHAR(255);
  p_Description_3c0f1790a38f TEXT;
  p_Sequence_3c0f1790a38f INTEGER;
  p_SQLBaseType_3c0f1790a38f VARCHAR(50);
  p_SQLFullType_3c0f1790a38f VARCHAR(100);
  p_SourceEntityID_3c0f1790a38f UUID;
  p_SourceFieldName_3c0f1790a38f VARCHAR(255);
  p_IsComputed_3c0f1790a38f BOOLEAN;
  p_ComputationDescription_3c0f1790a38f TEXT;
  p_IsSummary_3c0f1790a38f BOOLEAN;
  p_SummaryDescription_3c0f1790a38f TEXT;
  p_DetectionMethod_3c0f1790a38f VARCHAR(50);
  p_AutoDetectConfidenceScore_3c0f1790a38f NUMERIC(3,2);
BEGIN
  p_ID_3c0f1790a38f := '5e5007be-15aa-4752-9c87-67a57234ecd6';
  p_QueryID_3c0f1790a38f := 'A4884796-443D-49BB-915B-B94DF79EEA0C';
  p_Name_3c0f1790a38f := 'SourceRecordID';
  p_Description_3c0f1790a38f := 'SourceRecordID';
  p_Sequence_3c0f1790a38f := 18;
  p_SQLBaseType_3c0f1790a38f := 'nvarchar';
  p_SQLFullType_3c0f1790a38f := 'nvarchar(450)';
  p_SourceEntityID_3c0f1790a38f := '25D46762-4EA5-4FD5-A99F-F5870F72164C';
  p_SourceFieldName_3c0f1790a38f := 'SourceRecordID';
  p_IsComputed_3c0f1790a38f := FALSE;
  p_IsSummary_3c0f1790a38f := FALSE;
  p_DetectionMethod_3c0f1790a38f := 'Manual';
  p_QueryID_3c0f1790a38f := COALESCE((SELECT "ID" FROM ${mjSchema}."Query" WHERE "Name" = 'Finance Exceptions Cleared' ORDER BY CASE WHEN "ID" = p_QueryID_3c0f1790a38f THEN 0 ELSE 1 END LIMIT 1), p_QueryID_3c0f1790a38f);
  IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."QueryField"
               WHERE "ID" = p_ID_3c0f1790a38f
                  OR ("QueryID" = p_QueryID_3c0f1790a38f AND "Name" = p_Name_3c0f1790a38f)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM ${mjSchema}."spCreateQueryField"(p_data := jsonb_build_object(
      'ID', p_ID_3c0f1790a38f,
      'QueryID', p_QueryID_3c0f1790a38f,
      'Name', p_Name_3c0f1790a38f,
      'Description', p_Description_3c0f1790a38f,
      'Sequence', p_Sequence_3c0f1790a38f,
      'SQLBaseType', p_SQLBaseType_3c0f1790a38f,
      'SQLFullType', p_SQLFullType_3c0f1790a38f,
      'SourceEntityID', p_SourceEntityID_3c0f1790a38f,
      'SourceFieldName', p_SourceFieldName_3c0f1790a38f,
      'IsComputed', p_IsComputed_3c0f1790a38f,
      'ComputationDescription', p_ComputationDescription_3c0f1790a38f,
      'IsSummary', p_IsSummary_3c0f1790a38f,
      'SummaryDescription', p_SummaryDescription_3c0f1790a38f,
      'DetectionMethod', p_DetectionMethod_3c0f1790a38f,
      'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_3c0f1790a38f
    ));
    ELSE
      PERFORM ${mjSchema}."spCreateQueryField"(p_ID := p_ID_3c0f1790a38f, p_QueryID := p_QueryID_3c0f1790a38f, p_Name := p_Name_3c0f1790a38f, p_Description := p_Description_3c0f1790a38f, p_Sequence := p_Sequence_3c0f1790a38f, p_SQLBaseType := p_SQLBaseType_3c0f1790a38f, p_SQLFullType := p_SQLFullType_3c0f1790a38f, p_SourceEntityID := p_SourceEntityID_3c0f1790a38f, p_SourceFieldName := p_SourceFieldName_3c0f1790a38f, p_IsComputed := p_IsComputed_3c0f1790a38f, p_ComputationDescription := p_ComputationDescription_3c0f1790a38f, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_3c0f1790a38f, p_SummaryDescription := p_SummaryDescription_3c0f1790a38f, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_3c0f1790a38f, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_3c0f1790a38f, p_AutoDetectConfidenceScore_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_d430174df1a1 UUID;
  p_QueryID_d430174df1a1 UUID;
  p_Name_d430174df1a1 VARCHAR(255);
  p_Description_d430174df1a1 TEXT;
  p_Sequence_d430174df1a1 INTEGER;
  p_SQLBaseType_d430174df1a1 VARCHAR(50);
  p_SQLFullType_d430174df1a1 VARCHAR(100);
  p_SourceEntityID_d430174df1a1 UUID;
  p_SourceFieldName_d430174df1a1 VARCHAR(255);
  p_IsComputed_d430174df1a1 BOOLEAN;
  p_ComputationDescription_d430174df1a1 TEXT;
  p_IsSummary_d430174df1a1 BOOLEAN;
  p_SummaryDescription_d430174df1a1 TEXT;
  p_DetectionMethod_d430174df1a1 VARCHAR(50);
  p_AutoDetectConfidenceScore_d430174df1a1 NUMERIC(3,2);
BEGIN
  p_ID_d430174df1a1 := '7707a681-e721-4ebd-9694-3f6eebfd3418';
  p_QueryID_d430174df1a1 := 'A4884796-443D-49BB-915B-B94DF79EEA0C';
  p_Name_d430174df1a1 := 'FinanceExceptionID';
  p_Description_d430174df1a1 := 'ID (aliased as FinanceExceptionID)';
  p_Sequence_d430174df1a1 := 19;
  p_SQLBaseType_d430174df1a1 := 'uniqueidentifier';
  p_SQLFullType_d430174df1a1 := 'uniqueidentifier';
  p_SourceEntityID_d430174df1a1 := '25D46762-4EA5-4FD5-A99F-F5870F72164C';
  p_SourceFieldName_d430174df1a1 := 'ID';
  p_IsComputed_d430174df1a1 := FALSE;
  p_IsSummary_d430174df1a1 := FALSE;
  p_DetectionMethod_d430174df1a1 := 'Manual';
  p_QueryID_d430174df1a1 := COALESCE((SELECT "ID" FROM ${mjSchema}."Query" WHERE "Name" = 'Finance Exceptions Cleared' ORDER BY CASE WHEN "ID" = p_QueryID_d430174df1a1 THEN 0 ELSE 1 END LIMIT 1), p_QueryID_d430174df1a1);
  IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."QueryField"
               WHERE "ID" = p_ID_d430174df1a1
                  OR ("QueryID" = p_QueryID_d430174df1a1 AND "Name" = p_Name_d430174df1a1)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM ${mjSchema}."spCreateQueryField"(p_data := jsonb_build_object(
      'ID', p_ID_d430174df1a1,
      'QueryID', p_QueryID_d430174df1a1,
      'Name', p_Name_d430174df1a1,
      'Description', p_Description_d430174df1a1,
      'Sequence', p_Sequence_d430174df1a1,
      'SQLBaseType', p_SQLBaseType_d430174df1a1,
      'SQLFullType', p_SQLFullType_d430174df1a1,
      'SourceEntityID', p_SourceEntityID_d430174df1a1,
      'SourceFieldName', p_SourceFieldName_d430174df1a1,
      'IsComputed', p_IsComputed_d430174df1a1,
      'ComputationDescription', p_ComputationDescription_d430174df1a1,
      'IsSummary', p_IsSummary_d430174df1a1,
      'SummaryDescription', p_SummaryDescription_d430174df1a1,
      'DetectionMethod', p_DetectionMethod_d430174df1a1,
      'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_d430174df1a1
    ));
    ELSE
      PERFORM ${mjSchema}."spCreateQueryField"(p_ID := p_ID_d430174df1a1, p_QueryID := p_QueryID_d430174df1a1, p_Name := p_Name_d430174df1a1, p_Description := p_Description_d430174df1a1, p_Sequence := p_Sequence_d430174df1a1, p_SQLBaseType := p_SQLBaseType_d430174df1a1, p_SQLFullType := p_SQLFullType_d430174df1a1, p_SourceEntityID := p_SourceEntityID_d430174df1a1, p_SourceFieldName := p_SourceFieldName_d430174df1a1, p_IsComputed := p_IsComputed_d430174df1a1, p_ComputationDescription := p_ComputationDescription_d430174df1a1, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_d430174df1a1, p_SummaryDescription := p_SummaryDescription_d430174df1a1, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_d430174df1a1, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_d430174df1a1, p_AutoDetectConfidenceScore_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Entities (core SP call only)
DO $mj$
DECLARE
  p_ID_4427f9bf340f UUID;
  p_QueryID_4427f9bf340f UUID;
  p_EntityID_4427f9bf340f UUID;
  p_DetectionMethod_4427f9bf340f VARCHAR(50);
  p_AutoDetectConfidenceScore_4427f9bf340f NUMERIC(3,2);
BEGIN
  p_ID_4427f9bf340f := 'c1377889-a3cb-440b-928d-20eb47acf78e';
  p_QueryID_4427f9bf340f := 'A4884796-443D-49BB-915B-B94DF79EEA0C';
  p_EntityID_4427f9bf340f := '25D46762-4EA5-4FD5-A99F-F5870F72164C';
  p_DetectionMethod_4427f9bf340f := 'AI';
  p_AutoDetectConfidenceScore_4427f9bf340f := 1;
  p_QueryID_4427f9bf340f := COALESCE((SELECT "ID" FROM ${mjSchema}."Query" WHERE "Name" = 'Finance Exceptions Cleared' ORDER BY CASE WHEN "ID" = p_QueryID_4427f9bf340f THEN 0 ELSE 1 END LIMIT 1), p_QueryID_4427f9bf340f);
  IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."QueryEntity"
               WHERE "ID" = p_ID_4427f9bf340f
                  OR ("QueryID" = p_QueryID_4427f9bf340f AND "EntityID" = p_EntityID_4427f9bf340f)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryEntity'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM ${mjSchema}."spCreateQueryEntity"(p_data := jsonb_build_object(
      'ID', p_ID_4427f9bf340f,
      'QueryID', p_QueryID_4427f9bf340f,
      'EntityID', p_EntityID_4427f9bf340f,
      'DetectionMethod', p_DetectionMethod_4427f9bf340f,
      'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_4427f9bf340f
    ));
    ELSE
      PERFORM ${mjSchema}."spCreateQueryEntity"(p_ID := p_ID_4427f9bf340f, p_QueryID := p_QueryID_4427f9bf340f, p_EntityID := p_EntityID_4427f9bf340f, p_DetectionMethod := p_DetectionMethod_4427f9bf340f, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_4427f9bf340f);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Entities (core SP call only)
DO $mj$
DECLARE
  p_ID_a4722a3bf1e0 UUID;
  p_QueryID_a4722a3bf1e0 UUID;
  p_EntityID_a4722a3bf1e0 UUID;
  p_DetectionMethod_a4722a3bf1e0 VARCHAR(50);
  p_AutoDetectConfidenceScore_a4722a3bf1e0 NUMERIC(3,2);
BEGIN
  p_ID_a4722a3bf1e0 := '092bfe2d-3753-4911-ab26-8413df00d8db';
  p_QueryID_a4722a3bf1e0 := 'A4884796-443D-49BB-915B-B94DF79EEA0C';
  p_EntityID_a4722a3bf1e0 := '57FD0C9B-C308-41A4-988A-E4C378A9803D';
  p_DetectionMethod_a4722a3bf1e0 := 'AI';
  p_AutoDetectConfidenceScore_a4722a3bf1e0 := 1;
  p_QueryID_a4722a3bf1e0 := COALESCE((SELECT "ID" FROM ${mjSchema}."Query" WHERE "Name" = 'Finance Exceptions Cleared' ORDER BY CASE WHEN "ID" = p_QueryID_a4722a3bf1e0 THEN 0 ELSE 1 END LIMIT 1), p_QueryID_a4722a3bf1e0);
  IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."QueryEntity"
               WHERE "ID" = p_ID_a4722a3bf1e0
                  OR ("QueryID" = p_QueryID_a4722a3bf1e0 AND "EntityID" = p_EntityID_a4722a3bf1e0)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryEntity'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM ${mjSchema}."spCreateQueryEntity"(p_data := jsonb_build_object(
      'ID', p_ID_a4722a3bf1e0,
      'QueryID', p_QueryID_a4722a3bf1e0,
      'EntityID', p_EntityID_a4722a3bf1e0,
      'DetectionMethod', p_DetectionMethod_a4722a3bf1e0,
      'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_a4722a3bf1e0
    ));
    ELSE
      PERFORM ${mjSchema}."spCreateQueryEntity"(p_ID := p_ID_a4722a3bf1e0, p_QueryID := p_QueryID_a4722a3bf1e0, p_EntityID := p_EntityID_a4722a3bf1e0, p_DetectionMethod := p_DetectionMethod_a4722a3bf1e0, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_a4722a3bf1e0);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Queries (core SP call only)
DO $mj$
DECLARE
  p_ID_d1039fb03394 UUID;
  p_Name_d1039fb03394 VARCHAR(255);
  p_CategoryID_d1039fb03394 UUID;
  p_UserQuestion_d1039fb03394 TEXT;
  p_Description_d1039fb03394 TEXT;
  p_SQL_d1039fb03394 TEXT;
  p_TechnicalDescription_d1039fb03394 TEXT;
  p_OriginalSQL_d1039fb03394 TEXT;
  p_Feedback_d1039fb03394 TEXT;
  p_Status_d1039fb03394 VARCHAR(15);
  p_QualityRank_d1039fb03394 INTEGER;
  p_ExecutionCostRank_d1039fb03394 INTEGER;
  p_UsesTemplate_d1039fb03394 BOOLEAN;
  p_AuditQueryRuns_d1039fb03394 BOOLEAN;
  p_CacheEnabled_d1039fb03394 BOOLEAN;
  p_CacheTTLMinutes_d1039fb03394 INTEGER;
  p_CacheMaxSize_d1039fb03394 INTEGER;
  p_EmbeddingVector_d1039fb03394 TEXT;
  p_EmbeddingModelID_d1039fb03394 UUID;
  p_CacheValidationSQL_d1039fb03394 TEXT;
  p_SQLDialectID_d1039fb03394 UUID;
  p_Reusable_d1039fb03394 BOOLEAN;
  p_ExternalDataSourceID_d1039fb03394 UUID;
  p_IsMaterialized_d1039fb03394 BOOLEAN;
BEGIN
  p_ID_d1039fb03394 := '5DF477D8-D037-4EF7-8A6A-AB3C0FB93B05';
  p_Name_d1039fb03394 := 'Journal Entries Held Back By Posting Start Date';
  p_CategoryID_d1039fb03394 := '126B4161-E7AF-41F6-88B0-0F1F4D8D0867';
  p_UserQuestion_d1039fb03394 := 'Which journal entries are held back from batching because they are dated before their company''s posting start date?';
  p_Description_d1039fb03394 := 'Pending journal entries dated before their company''s PostingStartDate, one row per entry line, with company, entry number, effective date, entry type, GL account and debit/credit amount. No batch build, preview or sweep picks these up, so finance reconciles them against what was booked directly in the ERP. Export from the query grid.';
  p_SQL_d1039fb03394 := '-- Journal entries held back by their company''s PostingStartDate.
-- Every batch build, preview and sweep selects Pending, non-summary entries dated on or after the
-- company''s PostingStartDate, so the entries listed here never enter a batch. One row per entry
-- line, so finance can reconcile them by account against what was booked directly in the ERP.
-- An entry with no lines yet still appears once, with the line columns empty.
SELECT
    je.CompanyID,
    je.Company,
    acp.PostingStartDate,
    je.EntryNumber,
    je.EffectiveDate,
    je.EntryType,
    je.Description AS EntryDescription,
    jel.LineNumber,
    ga.Code AS GLAccountCode,
    ga.Name AS GLAccountName,
    jel.DebitAmount,
    jel.CreditAmount,
    jel.Description AS LineDescription,
    je.ID AS JournalEntryID
FROM [__mj_BizAppsAccounting].vwJournalEntries je
INNER JOIN [__mj_BizAppsAccounting].AccountingCompanyProfile acp
    ON acp.ID = je.CompanyID
INNER JOIN [__mj_BizAppsAccounting].JournalEntryType jet
    ON jet.ID = je.EntryTypeID
LEFT JOIN [__mj_BizAppsAccounting].JournalEntryLine jel
    ON jel.JournalEntryID = je.ID
LEFT JOIN [__mj_BizAppsAccounting].GLAccount ga
    ON ga.ID = jel.GLAccountID
WHERE je.Status = N''Pending''
    AND jet.IsJournalEntryBatchSummary = 0
    AND acp.PostingStartDate IS NOT NULL
    AND je.EffectiveDate < acp.PostingStartDate
ORDER BY
    je.Company,
    je.EffectiveDate,
    je.EntryNumber,
    jel.LineNumber;
';
  p_TechnicalDescription_d1039fb03394 := 'Reads __mj_BizAppsAccounting.vwJournalEntries joined to AccountingCompanyProfile on CompanyID. Keeps Status = Pending, entry types with IsJournalEntryBatchSummary = 0, and EffectiveDate < PostingStartDate where PostingStartDate is set: the same rows the batch engine''s posting-start clause removes from its candidate filter. LEFT JOINs JournalEntryLine and GLAccount, so an entry with no lines appears once with empty line columns. Ordered by company, effective date, entry number, line number.';
  p_Status_d1039fb03394 := 'Approved';
  p_QualityRank_d1039fb03394 := 8;
  p_ExecutionCostRank_d1039fb03394 := 2;
  p_UsesTemplate_d1039fb03394 := FALSE;
  p_AuditQueryRuns_d1039fb03394 := FALSE;
  p_CacheEnabled_d1039fb03394 := FALSE;
  p_EmbeddingVector_d1039fb03394 := '[0.011181195266544819,0.06732438504695892,0.033537670969963074,-0.04880242049694061,0.0033769276924431324,0.0026788983959704638,0.09315530210733414,0.030692698433995247,0.0022258281242102385,0.006093471776694059,0.031803879886865616,-0.034135378897190094,0.020534906536340714,0.07807731628417969,-0.007095228414982557,0.057533979415893555,0.034503281116485596,-0.003412525402382016,-0.06142118573188782,-0.028572751209139824,-0.04880014434456825,0.022607045248150826,-0.023258114233613014,0.006612964440137148,-0.005840125493705273,0.009853705763816833,-0.027485454455018044,0.009053287096321583,-0.024799088016152382,-0.09889812767505646,-0.0055364565923810005,0.006112939678132534,0.04074881970882416,-0.01458660140633583,0.0000020748659608216258,-0.03193160891532898,-0.0496380478143692,0.011335424147546291,-0.08234821259975433,0.0789499431848526,-0.05436469987034798,-0.09649970382452011,0.0005995081155560911,-0.00536517146974802,-0.028073417022824287,-0.14322786033153534,-0.015520780347287655,-0.014017757028341293,0.01730966940522194,-0.009840602986514568,0.00926161091774702,0.03143199533224106,-0.01677573285996914,-0.018931305035948753,0.05703921616077423,-0.09796087443828583,0.02117527835071087,-0.006276069674640894,0.032322704792022705,-0.08082984387874603,-0.02820611000061035,-0.019230399280786514,0.0057835085317492485,-0.029204344376921654,-0.012722227722406387,0.03495756909251213,0.049987293779850006,-0.043923038989305496,0.010784554295241833,-0.026504019275307655,0.1157413050532341,-0.029874242842197418,-0.039750706404447556,-0.029568785801529884,-0.00011436967179179192,-0.06478966772556305,-0.0033813994377851486,-0.0003036334819626063,-0.029284648597240448,0.014401962980628014,0.019473660737276077,0.059865888208150864,0.012545335106551647,-0.015309122391045094,0.009415844455361366,-0.007223267573863268,0.0030171226244419813,-0.039113327860832214,-0.010775879956781864,0.007576878182590008,0.07491642236709595,0.0028392465319484472,0.016081474721431732,0.0075330003164708614,0.020500969141721725,-0.007410927210003138,0.015326031483709812,-0.035140957683324814,-0.01879122294485569,0.01629462279379368,0.037854693830013275,0.04186221957206726,0.04067603126168251,0.0474809966981411,0.014344998635351658,0.02302374318242073,0.02713342383503914,-0.05035929009318352,0.015781491994857788,0.006807753816246986,0.016015559434890747,-0.023731153458356857,-0.019038107246160507,0.015028455294668674,-0.010086467489600182,0.007425767369568348,-0.030334988608956337,0.049451373517513275,-0.024012593552470207,0.03984810784459114,0.09741955995559692,-0.0009359563118778169,-0.009270037524402142,-0.025969548150897026,0.01856851950287819,-0.09984800219535828,0.013105623424053192,-0.02146303281188011,-0.020490892231464386,-0.021016186103224754,-0.032215092331171036,-0.07915138453245163,0.0626518577337265,-0.02604353055357933,0.021331386640667915,-0.00922288279980421,0.013912986032664776,0.019501108676195145,-0.0739816427230835,0.0018204578664153814,0.0399295799434185,0.009914214722812176,0.01162036694586277,0.0529627650976181,-0.031025145202875137,-0.0013683781726285815,-0.020937584340572357,-0.051707975566387177,-0.01327939797192812,0.009275808930397034,0.025204962119460106,0.012663329020142555,-0.06197370961308479,-0.00411577383056283,-0.03162120282649994,-0.008240052498877048,0.052094969898462296,-0.025400714948773384,-0.02814008668065071,-0.016173841431736946,0.013301361352205276,-0.05543931946158409,0.005617779679596424,-0.00009535558638162911,0.00858620647341013,-0.027338409796357155,-0.03452856093645096,0.015966573730111122,0.008444919250905514,-0.02643299661576748,-0.009203610010445118,-0.032784152776002884,0.007836506702005863,0.04110698774456978,0.002126748440787196,-0.02124684676527977,0.0003901947056874633,0.006832325365394354,0.028419416397809982,-0.06903455406427383,-0.00900558102875948,-0.043101388961076736,-0.007679036818444729,-0.013035501353442669,0.06664559245109558,0.0013933510053902864,0.06459374725818634,0.010036963038146496,0.0028664220590144396,-0.008241266012191772,-0.027906518429517746,0.03478708490729332,-0.0993085727095604,0.018933750689029694,0.0002445427526254207,0.01044392678886652,-0.02002355083823204,-0.042650312185287476,0.004271175246685743,0.003931441344320774,0.005343374330550432,0.002125632483512163,-0.0003132397832814604,0.06289016455411911,0.019262881949543953,-0.033111415803432465,-0.06963188946247101,0.013055154122412205,-0.02724156528711319,-0.0008947820169851184,0.06618861109018326,0.009393488988280296,0.014968936331570148,0.0014637913554906845,-0.0032998514361679554,0.07553817331790924,0.0313875675201416,0.031652823090553284,-0.04317818954586983,0.029418477788567543,-0.037559375166893005,0.009691881947219372,-0.0665435791015625,0.03811361640691757,-0.000015471288861590438,-0.030260512605309486,0.02026357129216194,-0.0009994055144488811,0.040331192314624786,-0.011945257894694805,-0.0144382044672966,-0.01286160759627819,0.038943100720644,-0.02031124010682106,0.05666261911392212,0.04169769957661629,-0.003938969690352678,0.01096681784838438,-0.001249448163434863,0.07382994890213013,-0.01918881945312023,-0.04284941032528877,-0.016614263877272606,-0.01128803938627243,-0.020868411287665367,0.04915012791752815,-0.05730973556637764,-0.053174834698438644,-0.028062347322702408,0.028195738792419434,-0.0016022752970457077,0.004552579019218683,0.017452070489525795,0.004301355220377445,0.01995166763663292,0.0022111949510872364,-0.10756944864988327,0.01943371817469597,-0.025525106117129326,0.05208670347929001,0.025090422481298447,-0.03865650296211243,-0.009394005872309208,-0.011935296468436718,-0.015413152985274792,0.014232263900339603,0.03669111803174019,-0.011539977975189686,-0.05533442273736,0.03273836523294449,0.004880122374743223,0.015224055387079716,-0.016796959564089775,-0.028154073283076286,-0.013133843429386616,0.015194687992334366,-0.11927985399961472,0.06640806049108505,0.020626051351428032,-0.0031150660943239927,0.02123086526989937,0.03699234500527382,0.005705392453819513,0.02524978294968605,0.01346507202833891,0.025594789534807205,0.0014330579433590174,-0.10829195380210876,-0.05128771811723709,-0.00958305411040783,0.017705321311950684,-0.034828346222639084,0.027499046176671982,0.011870432645082474,-0.05664090812206268,-0.013039740733802319,-0.042758744210004807,0.10301767289638519,0.005075966008007526,0.021981069818139076,-0.044328879565000534,0.02362515591084957,-0.004696722608059645,-0.002788146026432514,0.023999834433197975,0.0995703935623169,0.03758370876312256,0.01738424226641655,0.00718515831977129,-0.024301011115312576,-0.013208343647420406,-0.0013772561214864254,-0.02659555710852146,0.07270866632461548,-0.014805199578404427,-0.03410143777728081,-0.03019654005765915,0.022576432675123215,-0.05765508860349655,0.1067252829670906,0.011554953642189503,-0.0024469303898513317,-0.0019279159605503082,0.015987709164619446,-0.037734244018793106,0.04204459488391876,-0.002725426107645035,-0.02806457132101059,-0.031875334680080414,-0.029893100261688232,0.007489580195397139,-0.01544144656509161,-0.0377010703086853,0.0031806956976652145,-0.011200334876775742,-0.03470621258020401,0.03223322331905365,0.010521238669753075,0.0355527326464653,-0.027074189856648445,-0.029853733256459236,0.014077076688408852,0.0027194179128855467,-0.057205844670534134,0.007015099748969078,-0.003163340035825968,-0.002239563735201955,0.02945820614695549,-0.031785257160663605,0.03107547014951706,-0.0621589794754982,0.05884147807955742,-0.03185198828577995,-0.03874608501791954,-0.026107672601938248,-0.10966964811086655,-0.02899729087948799,-0.03925425559282303,0.02242922969162464,-0.051249343901872635,0.00706765940412879,-0.03371087834239006,0.05379985645413399,0.00974973477423191,0.07492563128471375,0.04450010508298874,0.037117354571819305,-0.01865185610949993,0.029912104830145836,0.007154738064855337,-0.041721951216459274,-0.010838434100151062,-0.014890974387526512,0.02189450152218342,-0.005799891427159309,0.008924078196287155,0.012951921671628952,0.04513470456004143,0.03677694872021675,0.02066137082874775,0.028281675651669502,0.06740482896566391,0.05948558449745178,0.014848367311060429,0.03613948076963425,-0.0056168679147958755,-0.06503594666719437,-0.0836348608136177,-0.0584280826151371,0.023299064487218857,-0.007693369407206774,-0.025933457538485527,0.009870436042547226,0.005475920625030994,0.0006513583357445896,-0.02247943915426731,-0.024628039449453354,0.019516441971063614,-0.030314207077026367,-0.0016938450280576944,0.022853964939713478,-0.02051163651049137,-0.007962891831994057,-0.023261547088623047,0.03993099182844162,-0.031736306846141815,0.015773452818393707,-0.020876483991742134,-0.014203871600329876,0.01747078262269497,0.011322426609694958,-0.015395157039165497,0.01591547019779682,-0.037571974098682404,0.02836463786661625,-0.017702816054224968,0.0016283668810501695,0.017564183101058006,0.01776002161204815,-0.018083617091178894,0.03362999111413956,-0.013210817240178585,0.05429889261722565,-0.010474221780896187,-0.020168473944067955,0.006544757168740034,0.028875038027763367,-0.0048926351591944695,-0.0025282602291554213,-0.0016311201034113765,-0.055837780237197876,-0.0035234736278653145,0.0031495122238993645,0.05012109875679016,-0.03989588841795921,0.08073362708091736,-0.021723732352256775,-0.055516332387924194,0.0021690609864890575,-0.010718140751123428,-0.08633895963430405,0.017439303919672966,0.09166664630174637,0.01434256136417389,0.014804484322667122,0.001441999338567257,-0.0029051699675619602,0.06161334738135338,-0.0536334365606308,0.001984755042940378,-0.025268258526921272,-0.08850812911987305,0.05266992002725601,-0.03995374217629433,-0.0027229194529354572,-0.0384635291993618,-0.038036830723285675,-0.03599289804697037,-0.03216280788183212,0.06493361294269562,-0.024975810199975967,0.029100855812430382,-0.07774429023265839,0.017259450629353523,0.04758526757359505,-0.0225082915276289,0.013840650208294392,0.06520625948905945,-0.0011339521734043956,0.007712140679359436,-0.0027640201151371002,-0.02182704024016857,-0.015595289878547192,-0.027280112728476524,0.03031461127102375,0.04037235304713249,-0.0021322311367839575,0.019098948687314987,-0.030300356447696686,0.009927909821271896,0.007859847508370876,0.003113600891083479,0.03154341131448746,-0.09148839116096497,-0.033524513244628906,0.0330495648086071,0.014030281454324722,0.033450622111558914,-0.03277244791388512,-0.01150455605238676,0.02051384560763836,0.014247334562242031,-0.040144674479961395,0.10754430294036865,-0.005797277204692364,0.06467059999704361,0.009239645674824715,-0.03144417703151703,-0.009874329902231693,0.06851794570684433,-0.06194527447223663,0.02344505861401558,-0.014222025871276855,0.007588345091789961,-0.04739869758486748,-0.019554466009140015,0.004275234881788492,0.0086583960801363,-0.026048483327031136,0.04297047108411789,-0.021574867889285088,-0.00021839645341970026,-0.08392100036144257,0.054738812148571014,0.043345291167497635,0.024148788303136826,0.039688605815172195,-0.01814858801662922,-0.008474329486489296,-0.006878910586237907,0.003792910370975733,0.016238246113061905,0.03531722351908684,0.07731431722640991,0.03711733967065811,-0.03455144912004471,0.032481592148542404,-0.04672945290803909,0.014206329360604286,0.05599286034703255,0.05268637090921402,0.05392775684595108,0.05264786258339882,0.03971334919333458,0.02726912498474121,0.015080769546329975,0.02456306852400303,-0.008458573371171951,0.038232434540987015,0.0030150676611810923,-0.039586279541254044,0.017364826053380966,0.08817154914140701,0.004523075185716152,-0.05234265699982643,-0.0035277227871119976,-0.029573731124401093,0.006625075358897448,0.030606141313910484,0.05863840505480766,0.013636057265102863,-0.008373080752789974,-0.03502700477838516,0.002421403769403696,-0.05443393066525459,-6.862374389627276e-33,-0.009796466678380966,-0.0382787249982357,-0.03494420647621155,0.003500379156321287,-0.009102251380681992,0.02316773124039173,0.025275500491261482,-0.07513953000307083,-0.03756444528698921,-0.004165607504546642,-0.04063545912504196,0.012613673694431782,0.02087247185409069,-0.016534585505723953,0.008153635077178478,-0.015993252396583557,0.00903335865586996,-0.020290791988372803,0.0043163602240383625,-0.022243110463023186,0.028775721788406372,0.04408909007906914,0.021383168175816536,0.07005222141742706,0.001868814812041819,0.03532077372074127,0.03383152186870575,0.030470119789242744,-0.00033650698605924845,-0.020005835220217705,0.019801992923021317,-0.07884161919355392,0.010138306766748428,-0.04568616300821304,-0.01120127085596323,-0.05223461613059044,-0.015436426736414433,0.0053472514264285564,0.006667350884526968,-0.04712960496544838,0.08689692616462708,-0.007303263526409864,0.0020124688744544983,-0.03652544319629669,-0.05302991345524788,0.0003290605964139104,-0.011882871389389038,0.0028026411309838295,-0.04114304482936859,-0.03124810755252838,-0.003986542113125324,-0.023242542520165443,0.017251627519726753,0.07510536909103394,-0.014187644235789776,0.024426180869340897,0.033851508051157,0.012226611375808716,-0.056932494044303894,-0.03156615048646927,-0.08696126192808151,0.053652264177799225,-0.01914403587579727,0.0216034147888422,0.05137474089860916,0.004379154182970524,-0.057297881692647934,0.07363535463809967,-0.022503236308693886,0.019010059535503387,-0.027699287980794907,0.032596953213214874,-0.07240026444196701,-0.01214700099080801,0.07917468994855881,-0.003414140548557043,-0.0007289786008186638,-0.011547763831913471,-0.04658300057053566,0.005155134946107864,0.07084435969591141,-0.044956374913454056,0.0018875626847147942,0.0024597812443971634,0.018445061519742012,0.007368957623839378,-0.0019092776346951723,0.03798120468854904,0.01704714074730873,0.01459413394331932,-0.015081414021551609,-0.015686918050050735,-0.011853509582579136,0.013450554572045803,-0.02047962322831154,0.05982940271496773,0.03656212240457535,-0.016371039673686028,0.009918559342622757,-0.024289298802614212,-0.05287966877222061,0.035188499838113785,0.013156173750758171,0.05680803209543228,0.018868939951062202,-0.027525221928954124,0.04244932532310486,-0.01393609493970871,-0.049365393817424774,0.014053640887141228,0.01705061085522175,0.06081687659025192,-0.0014816340990364552,0.021820560097694397,0.03682578727602959,-0.011240518651902676,0.022974101826548576,-0.0196982454508543,0.024609794840216637,0.01002008281648159,0.030653366819024086,0.01778685487806797,-0.00022679608082398772,0.041534945368766785,0.027830036357045174,0.019108863547444344,0.014942760579288006,0.020366404205560684,-0.0013023948995396495,0.04313487932085991,0.022942282259464264,0.047735776752233505,2.8505996851890814e-7,-0.025343693792819977,-0.0037800671998411417,0.023751981556415558,0.04581529274582863,0.03441392257809639,-0.019016357138752937,-0.019171640276908875,-0.015181082300841808,0.005160756409168243,0.040146488696336746,0.033253416419029236,-0.002035500481724739,0.007210480980575085,-0.012289829552173615,0.004519409500062466,-0.050423383712768555,-0.07109632343053818,0.0038396164309233427,-0.02207682654261589,-0.02098562754690647,-0.009087938815355301,-0.01505485363304615,-0.003692871890962124,-0.022532561793923378,0.03255980461835861,-0.05112432315945625,-0.009483780711889267,-0.03674423694610596,-0.005594799295067787,-0.0006347621092572808,0.030990563333034515,-0.059763867408037186,-0.011671364307403564,-0.011338076554238796,0.021628500893712044,0.012059696018695831,-0.0020347863901406527,-0.04705275222659111,0.002146225655451417,0.0026267634239047766,-0.014051551930606365,-0.004777415655553341,-0.03168530389666557,0.04855659604072571,0.04974951222538948,0.060810402035713196,-0.0193885937333107,-0.02477787435054779,-0.010133986361324787,-0.017244359478354454,0.013409976847469807,0.02699916623532772,0.04599585011601448,0.00952912587672472,0.03137128800153732,-0.002517328830435872,-0.00407945504412055,0.029492199420928955,-0.01241484098136425,-0.06514507532119751,0.01574205979704857,-0.0038737456779927015,0.016156349331140518,0.01745428703725338,0.029481908306479454,0.014175547286868095,-0.009500797837972641,3.0096452778816693e-34,0.009951137937605381,-0.0016345917247235775,0.03287029266357422,-0.04396861046552658,0.007917692884802818,-0.027302011847496033,0.018531614914536476,-0.02204221673309803,-0.0016272143693640828,-0.04527566209435463,0.00043765350710600615]';
  p_EmbeddingModelID_d1039fb03394 := '1D45AA65-41EC-4572-9ECD-AB2826C9B059';
  p_Reusable_d1039fb03394 := FALSE;
  p_IsMaterialized_d1039fb03394 := FALSE;
  p_CategoryID_d1039fb03394 := COALESCE((SELECT "ID" FROM ${mjSchema}."QueryCategory" WHERE "Name" = 'Accounting' ORDER BY CASE WHEN "ID" = p_CategoryID_d1039fb03394 THEN 0 ELSE 1 END LIMIT 1), p_CategoryID_d1039fb03394);
  IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."Query"
               WHERE "ID" = p_ID_d1039fb03394
                  OR ("Name" = p_Name_d1039fb03394 AND ("CategoryID" = p_CategoryID_d1039fb03394 OR ("CategoryID" IS NULL AND p_CategoryID_d1039fb03394 IS NULL)))) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQuery'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM ${mjSchema}."spCreateQuery"(p_data := jsonb_build_object(
      'ID', p_ID_d1039fb03394,
      'Name', p_Name_d1039fb03394,
      'CategoryID', p_CategoryID_d1039fb03394,
      'UserQuestion', p_UserQuestion_d1039fb03394,
      'Description', p_Description_d1039fb03394,
      'SQL', p_SQL_d1039fb03394,
      'TechnicalDescription', p_TechnicalDescription_d1039fb03394,
      'OriginalSQL', p_OriginalSQL_d1039fb03394,
      'Feedback', p_Feedback_d1039fb03394,
      'Status', p_Status_d1039fb03394,
      'QualityRank', p_QualityRank_d1039fb03394,
      'ExecutionCostRank', p_ExecutionCostRank_d1039fb03394,
      'UsesTemplate', p_UsesTemplate_d1039fb03394,
      'AuditQueryRuns', p_AuditQueryRuns_d1039fb03394,
      'CacheEnabled', p_CacheEnabled_d1039fb03394,
      'CacheTTLMinutes', p_CacheTTLMinutes_d1039fb03394,
      'CacheMaxSize', p_CacheMaxSize_d1039fb03394,
      'EmbeddingVector', p_EmbeddingVector_d1039fb03394,
      'EmbeddingModelID', p_EmbeddingModelID_d1039fb03394,
      'CacheValidationSQL', p_CacheValidationSQL_d1039fb03394,
      'SQLDialectID', p_SQLDialectID_d1039fb03394,
      'Reusable', p_Reusable_d1039fb03394,
      'ExternalDataSourceID', p_ExternalDataSourceID_d1039fb03394,
      'IsMaterialized', p_IsMaterialized_d1039fb03394
    ));
    ELSE
      PERFORM ${mjSchema}."spCreateQuery"(p_ID := p_ID_d1039fb03394, p_Name := p_Name_d1039fb03394, p_CategoryID := p_CategoryID_d1039fb03394, p_UserQuestion := p_UserQuestion_d1039fb03394, p_Description := p_Description_d1039fb03394, p_SQL := p_SQL_d1039fb03394, p_TechnicalDescription := p_TechnicalDescription_d1039fb03394, p_OriginalSQL := p_OriginalSQL_d1039fb03394, p_OriginalSQL_Clear := TRUE, p_Feedback := p_Feedback_d1039fb03394, p_Feedback_Clear := TRUE, p_Status := p_Status_d1039fb03394, p_QualityRank := p_QualityRank_d1039fb03394, p_ExecutionCostRank := p_ExecutionCostRank_d1039fb03394, p_UsesTemplate := p_UsesTemplate_d1039fb03394, p_AuditQueryRuns := p_AuditQueryRuns_d1039fb03394, p_CacheEnabled := p_CacheEnabled_d1039fb03394, p_CacheTTLMinutes := p_CacheTTLMinutes_d1039fb03394, p_CacheTTLMinutes_Clear := TRUE, p_CacheMaxSize := p_CacheMaxSize_d1039fb03394, p_CacheMaxSize_Clear := TRUE, p_EmbeddingVector := p_EmbeddingVector_d1039fb03394, p_EmbeddingModelID := p_EmbeddingModelID_d1039fb03394, p_CacheValidationSQL := p_CacheValidationSQL_d1039fb03394, p_CacheValidationSQL_Clear := TRUE, p_SQLDialectID := p_SQLDialectID_d1039fb03394, p_Reusable := p_Reusable_d1039fb03394, p_ExternalDataSourceID := p_ExternalDataSourceID_d1039fb03394, p_ExternalDataSourceID_Clear := TRUE, p_IsMaterialized := p_IsMaterialized_d1039fb03394);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_29ff7b869f62 UUID;
  p_QueryID_29ff7b869f62 UUID;
  p_Name_29ff7b869f62 VARCHAR(255);
  p_Description_29ff7b869f62 TEXT;
  p_Sequence_29ff7b869f62 INTEGER;
  p_SQLBaseType_29ff7b869f62 VARCHAR(50);
  p_SQLFullType_29ff7b869f62 VARCHAR(100);
  p_SourceEntityID_29ff7b869f62 UUID;
  p_SourceFieldName_29ff7b869f62 VARCHAR(255);
  p_IsComputed_29ff7b869f62 BOOLEAN;
  p_ComputationDescription_29ff7b869f62 TEXT;
  p_IsSummary_29ff7b869f62 BOOLEAN;
  p_SummaryDescription_29ff7b869f62 TEXT;
  p_DetectionMethod_29ff7b869f62 VARCHAR(50);
  p_AutoDetectConfidenceScore_29ff7b869f62 NUMERIC(3,2);
BEGIN
  p_ID_29ff7b869f62 := '98308a04-ca63-4f83-aa59-678010d58b28';
  p_QueryID_29ff7b869f62 := '5DF477D8-D037-4EF7-8A6A-AB3C0FB93B05';
  p_Name_29ff7b869f62 := 'CompanyID';
  p_Description_29ff7b869f62 := 'CompanyID';
  p_Sequence_29ff7b869f62 := 1;
  p_SQLBaseType_29ff7b869f62 := 'uniqueidentifier';
  p_SQLFullType_29ff7b869f62 := 'uniqueidentifier';
  p_SourceEntityID_29ff7b869f62 := 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762';
  p_SourceFieldName_29ff7b869f62 := 'CompanyID';
  p_IsComputed_29ff7b869f62 := FALSE;
  p_IsSummary_29ff7b869f62 := FALSE;
  p_DetectionMethod_29ff7b869f62 := 'Manual';
  p_QueryID_29ff7b869f62 := COALESCE((SELECT "ID" FROM ${mjSchema}."Query" WHERE "Name" = 'Journal Entries Held Back By Posting Start Date' ORDER BY CASE WHEN "ID" = p_QueryID_29ff7b869f62 THEN 0 ELSE 1 END LIMIT 1), p_QueryID_29ff7b869f62);
  IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."QueryField"
               WHERE "ID" = p_ID_29ff7b869f62
                  OR ("QueryID" = p_QueryID_29ff7b869f62 AND "Name" = p_Name_29ff7b869f62)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM ${mjSchema}."spCreateQueryField"(p_data := jsonb_build_object(
      'ID', p_ID_29ff7b869f62,
      'QueryID', p_QueryID_29ff7b869f62,
      'Name', p_Name_29ff7b869f62,
      'Description', p_Description_29ff7b869f62,
      'Sequence', p_Sequence_29ff7b869f62,
      'SQLBaseType', p_SQLBaseType_29ff7b869f62,
      'SQLFullType', p_SQLFullType_29ff7b869f62,
      'SourceEntityID', p_SourceEntityID_29ff7b869f62,
      'SourceFieldName', p_SourceFieldName_29ff7b869f62,
      'IsComputed', p_IsComputed_29ff7b869f62,
      'ComputationDescription', p_ComputationDescription_29ff7b869f62,
      'IsSummary', p_IsSummary_29ff7b869f62,
      'SummaryDescription', p_SummaryDescription_29ff7b869f62,
      'DetectionMethod', p_DetectionMethod_29ff7b869f62,
      'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_29ff7b869f62
    ));
    ELSE
      PERFORM ${mjSchema}."spCreateQueryField"(p_ID := p_ID_29ff7b869f62, p_QueryID := p_QueryID_29ff7b869f62, p_Name := p_Name_29ff7b869f62, p_Description := p_Description_29ff7b869f62, p_Sequence := p_Sequence_29ff7b869f62, p_SQLBaseType := p_SQLBaseType_29ff7b869f62, p_SQLFullType := p_SQLFullType_29ff7b869f62, p_SourceEntityID := p_SourceEntityID_29ff7b869f62, p_SourceFieldName := p_SourceFieldName_29ff7b869f62, p_IsComputed := p_IsComputed_29ff7b869f62, p_ComputationDescription := p_ComputationDescription_29ff7b869f62, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_29ff7b869f62, p_SummaryDescription := p_SummaryDescription_29ff7b869f62, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_29ff7b869f62, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_29ff7b869f62, p_AutoDetectConfidenceScore_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_18b6fbfbfad1 UUID;
  p_QueryID_18b6fbfbfad1 UUID;
  p_Name_18b6fbfbfad1 VARCHAR(255);
  p_Description_18b6fbfbfad1 TEXT;
  p_Sequence_18b6fbfbfad1 INTEGER;
  p_SQLBaseType_18b6fbfbfad1 VARCHAR(50);
  p_SQLFullType_18b6fbfbfad1 VARCHAR(100);
  p_SourceEntityID_18b6fbfbfad1 UUID;
  p_SourceFieldName_18b6fbfbfad1 VARCHAR(255);
  p_IsComputed_18b6fbfbfad1 BOOLEAN;
  p_ComputationDescription_18b6fbfbfad1 TEXT;
  p_IsSummary_18b6fbfbfad1 BOOLEAN;
  p_SummaryDescription_18b6fbfbfad1 TEXT;
  p_DetectionMethod_18b6fbfbfad1 VARCHAR(50);
  p_AutoDetectConfidenceScore_18b6fbfbfad1 NUMERIC(3,2);
BEGIN
  p_ID_18b6fbfbfad1 := '2df62f03-7ba2-412b-9d95-9b6a8baf85b2';
  p_QueryID_18b6fbfbfad1 := '5DF477D8-D037-4EF7-8A6A-AB3C0FB93B05';
  p_Name_18b6fbfbfad1 := 'Company';
  p_Description_18b6fbfbfad1 := 'Company';
  p_Sequence_18b6fbfbfad1 := 2;
  p_SQLBaseType_18b6fbfbfad1 := 'nvarchar';
  p_SQLFullType_18b6fbfbfad1 := 'nvarchar(50)';
  p_SourceEntityID_18b6fbfbfad1 := 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762';
  p_SourceFieldName_18b6fbfbfad1 := 'Company';
  p_IsComputed_18b6fbfbfad1 := FALSE;
  p_IsSummary_18b6fbfbfad1 := FALSE;
  p_DetectionMethod_18b6fbfbfad1 := 'Manual';
  p_QueryID_18b6fbfbfad1 := COALESCE((SELECT "ID" FROM ${mjSchema}."Query" WHERE "Name" = 'Journal Entries Held Back By Posting Start Date' ORDER BY CASE WHEN "ID" = p_QueryID_18b6fbfbfad1 THEN 0 ELSE 1 END LIMIT 1), p_QueryID_18b6fbfbfad1);
  IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."QueryField"
               WHERE "ID" = p_ID_18b6fbfbfad1
                  OR ("QueryID" = p_QueryID_18b6fbfbfad1 AND "Name" = p_Name_18b6fbfbfad1)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM ${mjSchema}."spCreateQueryField"(p_data := jsonb_build_object(
      'ID', p_ID_18b6fbfbfad1,
      'QueryID', p_QueryID_18b6fbfbfad1,
      'Name', p_Name_18b6fbfbfad1,
      'Description', p_Description_18b6fbfbfad1,
      'Sequence', p_Sequence_18b6fbfbfad1,
      'SQLBaseType', p_SQLBaseType_18b6fbfbfad1,
      'SQLFullType', p_SQLFullType_18b6fbfbfad1,
      'SourceEntityID', p_SourceEntityID_18b6fbfbfad1,
      'SourceFieldName', p_SourceFieldName_18b6fbfbfad1,
      'IsComputed', p_IsComputed_18b6fbfbfad1,
      'ComputationDescription', p_ComputationDescription_18b6fbfbfad1,
      'IsSummary', p_IsSummary_18b6fbfbfad1,
      'SummaryDescription', p_SummaryDescription_18b6fbfbfad1,
      'DetectionMethod', p_DetectionMethod_18b6fbfbfad1,
      'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_18b6fbfbfad1
    ));
    ELSE
      PERFORM ${mjSchema}."spCreateQueryField"(p_ID := p_ID_18b6fbfbfad1, p_QueryID := p_QueryID_18b6fbfbfad1, p_Name := p_Name_18b6fbfbfad1, p_Description := p_Description_18b6fbfbfad1, p_Sequence := p_Sequence_18b6fbfbfad1, p_SQLBaseType := p_SQLBaseType_18b6fbfbfad1, p_SQLFullType := p_SQLFullType_18b6fbfbfad1, p_SourceEntityID := p_SourceEntityID_18b6fbfbfad1, p_SourceFieldName := p_SourceFieldName_18b6fbfbfad1, p_IsComputed := p_IsComputed_18b6fbfbfad1, p_ComputationDescription := p_ComputationDescription_18b6fbfbfad1, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_18b6fbfbfad1, p_SummaryDescription := p_SummaryDescription_18b6fbfbfad1, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_18b6fbfbfad1, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_18b6fbfbfad1, p_AutoDetectConfidenceScore_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_5219e72f0253 UUID;
  p_QueryID_5219e72f0253 UUID;
  p_Name_5219e72f0253 VARCHAR(255);
  p_Description_5219e72f0253 TEXT;
  p_Sequence_5219e72f0253 INTEGER;
  p_SQLBaseType_5219e72f0253 VARCHAR(50);
  p_SQLFullType_5219e72f0253 VARCHAR(100);
  p_SourceEntityID_5219e72f0253 UUID;
  p_SourceFieldName_5219e72f0253 VARCHAR(255);
  p_IsComputed_5219e72f0253 BOOLEAN;
  p_ComputationDescription_5219e72f0253 TEXT;
  p_IsSummary_5219e72f0253 BOOLEAN;
  p_SummaryDescription_5219e72f0253 TEXT;
  p_DetectionMethod_5219e72f0253 VARCHAR(50);
  p_AutoDetectConfidenceScore_5219e72f0253 NUMERIC(3,2);
BEGIN
  p_ID_5219e72f0253 := '1b5785a3-1cbe-49d2-abcd-e7c9044a5ab8';
  p_QueryID_5219e72f0253 := '5DF477D8-D037-4EF7-8A6A-AB3C0FB93B05';
  p_Name_5219e72f0253 := 'PostingStartDate';
  p_Description_5219e72f0253 := 'PostingStartDate';
  p_Sequence_5219e72f0253 := 3;
  p_SQLBaseType_5219e72f0253 := 'date';
  p_SQLFullType_5219e72f0253 := 'date';
  p_SourceEntityID_5219e72f0253 := '3E551198-AB66-478E-BEB6-C34EDBE242EC';
  p_SourceFieldName_5219e72f0253 := 'PostingStartDate';
  p_IsComputed_5219e72f0253 := FALSE;
  p_IsSummary_5219e72f0253 := FALSE;
  p_DetectionMethod_5219e72f0253 := 'Manual';
  p_QueryID_5219e72f0253 := COALESCE((SELECT "ID" FROM ${mjSchema}."Query" WHERE "Name" = 'Journal Entries Held Back By Posting Start Date' ORDER BY CASE WHEN "ID" = p_QueryID_5219e72f0253 THEN 0 ELSE 1 END LIMIT 1), p_QueryID_5219e72f0253);
  IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."QueryField"
               WHERE "ID" = p_ID_5219e72f0253
                  OR ("QueryID" = p_QueryID_5219e72f0253 AND "Name" = p_Name_5219e72f0253)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM ${mjSchema}."spCreateQueryField"(p_data := jsonb_build_object(
      'ID', p_ID_5219e72f0253,
      'QueryID', p_QueryID_5219e72f0253,
      'Name', p_Name_5219e72f0253,
      'Description', p_Description_5219e72f0253,
      'Sequence', p_Sequence_5219e72f0253,
      'SQLBaseType', p_SQLBaseType_5219e72f0253,
      'SQLFullType', p_SQLFullType_5219e72f0253,
      'SourceEntityID', p_SourceEntityID_5219e72f0253,
      'SourceFieldName', p_SourceFieldName_5219e72f0253,
      'IsComputed', p_IsComputed_5219e72f0253,
      'ComputationDescription', p_ComputationDescription_5219e72f0253,
      'IsSummary', p_IsSummary_5219e72f0253,
      'SummaryDescription', p_SummaryDescription_5219e72f0253,
      'DetectionMethod', p_DetectionMethod_5219e72f0253,
      'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_5219e72f0253
    ));
    ELSE
      PERFORM ${mjSchema}."spCreateQueryField"(p_ID := p_ID_5219e72f0253, p_QueryID := p_QueryID_5219e72f0253, p_Name := p_Name_5219e72f0253, p_Description := p_Description_5219e72f0253, p_Sequence := p_Sequence_5219e72f0253, p_SQLBaseType := p_SQLBaseType_5219e72f0253, p_SQLFullType := p_SQLFullType_5219e72f0253, p_SourceEntityID := p_SourceEntityID_5219e72f0253, p_SourceFieldName := p_SourceFieldName_5219e72f0253, p_IsComputed := p_IsComputed_5219e72f0253, p_ComputationDescription := p_ComputationDescription_5219e72f0253, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_5219e72f0253, p_SummaryDescription := p_SummaryDescription_5219e72f0253, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_5219e72f0253, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_5219e72f0253, p_AutoDetectConfidenceScore_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_5105f2fe5433 UUID;
  p_QueryID_5105f2fe5433 UUID;
  p_Name_5105f2fe5433 VARCHAR(255);
  p_Description_5105f2fe5433 TEXT;
  p_Sequence_5105f2fe5433 INTEGER;
  p_SQLBaseType_5105f2fe5433 VARCHAR(50);
  p_SQLFullType_5105f2fe5433 VARCHAR(100);
  p_SourceEntityID_5105f2fe5433 UUID;
  p_SourceFieldName_5105f2fe5433 VARCHAR(255);
  p_IsComputed_5105f2fe5433 BOOLEAN;
  p_ComputationDescription_5105f2fe5433 TEXT;
  p_IsSummary_5105f2fe5433 BOOLEAN;
  p_SummaryDescription_5105f2fe5433 TEXT;
  p_DetectionMethod_5105f2fe5433 VARCHAR(50);
  p_AutoDetectConfidenceScore_5105f2fe5433 NUMERIC(3,2);
BEGIN
  p_ID_5105f2fe5433 := '9180839b-ccc2-422b-8660-3d4c12512bc8';
  p_QueryID_5105f2fe5433 := '5DF477D8-D037-4EF7-8A6A-AB3C0FB93B05';
  p_Name_5105f2fe5433 := 'EntryNumber';
  p_Description_5105f2fe5433 := 'EntryNumber';
  p_Sequence_5105f2fe5433 := 4;
  p_SQLBaseType_5105f2fe5433 := 'nvarchar';
  p_SQLFullType_5105f2fe5433 := 'nvarchar(40)';
  p_SourceEntityID_5105f2fe5433 := 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762';
  p_SourceFieldName_5105f2fe5433 := 'EntryNumber';
  p_IsComputed_5105f2fe5433 := FALSE;
  p_IsSummary_5105f2fe5433 := FALSE;
  p_DetectionMethod_5105f2fe5433 := 'Manual';
  p_QueryID_5105f2fe5433 := COALESCE((SELECT "ID" FROM ${mjSchema}."Query" WHERE "Name" = 'Journal Entries Held Back By Posting Start Date' ORDER BY CASE WHEN "ID" = p_QueryID_5105f2fe5433 THEN 0 ELSE 1 END LIMIT 1), p_QueryID_5105f2fe5433);
  IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."QueryField"
               WHERE "ID" = p_ID_5105f2fe5433
                  OR ("QueryID" = p_QueryID_5105f2fe5433 AND "Name" = p_Name_5105f2fe5433)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM ${mjSchema}."spCreateQueryField"(p_data := jsonb_build_object(
      'ID', p_ID_5105f2fe5433,
      'QueryID', p_QueryID_5105f2fe5433,
      'Name', p_Name_5105f2fe5433,
      'Description', p_Description_5105f2fe5433,
      'Sequence', p_Sequence_5105f2fe5433,
      'SQLBaseType', p_SQLBaseType_5105f2fe5433,
      'SQLFullType', p_SQLFullType_5105f2fe5433,
      'SourceEntityID', p_SourceEntityID_5105f2fe5433,
      'SourceFieldName', p_SourceFieldName_5105f2fe5433,
      'IsComputed', p_IsComputed_5105f2fe5433,
      'ComputationDescription', p_ComputationDescription_5105f2fe5433,
      'IsSummary', p_IsSummary_5105f2fe5433,
      'SummaryDescription', p_SummaryDescription_5105f2fe5433,
      'DetectionMethod', p_DetectionMethod_5105f2fe5433,
      'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_5105f2fe5433
    ));
    ELSE
      PERFORM ${mjSchema}."spCreateQueryField"(p_ID := p_ID_5105f2fe5433, p_QueryID := p_QueryID_5105f2fe5433, p_Name := p_Name_5105f2fe5433, p_Description := p_Description_5105f2fe5433, p_Sequence := p_Sequence_5105f2fe5433, p_SQLBaseType := p_SQLBaseType_5105f2fe5433, p_SQLFullType := p_SQLFullType_5105f2fe5433, p_SourceEntityID := p_SourceEntityID_5105f2fe5433, p_SourceFieldName := p_SourceFieldName_5105f2fe5433, p_IsComputed := p_IsComputed_5105f2fe5433, p_ComputationDescription := p_ComputationDescription_5105f2fe5433, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_5105f2fe5433, p_SummaryDescription := p_SummaryDescription_5105f2fe5433, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_5105f2fe5433, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_5105f2fe5433, p_AutoDetectConfidenceScore_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_5456a79f7211 UUID;
  p_QueryID_5456a79f7211 UUID;
  p_Name_5456a79f7211 VARCHAR(255);
  p_Description_5456a79f7211 TEXT;
  p_Sequence_5456a79f7211 INTEGER;
  p_SQLBaseType_5456a79f7211 VARCHAR(50);
  p_SQLFullType_5456a79f7211 VARCHAR(100);
  p_SourceEntityID_5456a79f7211 UUID;
  p_SourceFieldName_5456a79f7211 VARCHAR(255);
  p_IsComputed_5456a79f7211 BOOLEAN;
  p_ComputationDescription_5456a79f7211 TEXT;
  p_IsSummary_5456a79f7211 BOOLEAN;
  p_SummaryDescription_5456a79f7211 TEXT;
  p_DetectionMethod_5456a79f7211 VARCHAR(50);
  p_AutoDetectConfidenceScore_5456a79f7211 NUMERIC(3,2);
BEGIN
  p_ID_5456a79f7211 := '71156870-20a4-48e9-b0a5-ed5351a122de';
  p_QueryID_5456a79f7211 := '5DF477D8-D037-4EF7-8A6A-AB3C0FB93B05';
  p_Name_5456a79f7211 := 'EffectiveDate';
  p_Description_5456a79f7211 := 'EffectiveDate';
  p_Sequence_5456a79f7211 := 5;
  p_SQLBaseType_5456a79f7211 := 'date';
  p_SQLFullType_5456a79f7211 := 'date';
  p_SourceEntityID_5456a79f7211 := 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762';
  p_SourceFieldName_5456a79f7211 := 'EffectiveDate';
  p_IsComputed_5456a79f7211 := FALSE;
  p_IsSummary_5456a79f7211 := FALSE;
  p_DetectionMethod_5456a79f7211 := 'Manual';
  p_QueryID_5456a79f7211 := COALESCE((SELECT "ID" FROM ${mjSchema}."Query" WHERE "Name" = 'Journal Entries Held Back By Posting Start Date' ORDER BY CASE WHEN "ID" = p_QueryID_5456a79f7211 THEN 0 ELSE 1 END LIMIT 1), p_QueryID_5456a79f7211);
  IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."QueryField"
               WHERE "ID" = p_ID_5456a79f7211
                  OR ("QueryID" = p_QueryID_5456a79f7211 AND "Name" = p_Name_5456a79f7211)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM ${mjSchema}."spCreateQueryField"(p_data := jsonb_build_object(
      'ID', p_ID_5456a79f7211,
      'QueryID', p_QueryID_5456a79f7211,
      'Name', p_Name_5456a79f7211,
      'Description', p_Description_5456a79f7211,
      'Sequence', p_Sequence_5456a79f7211,
      'SQLBaseType', p_SQLBaseType_5456a79f7211,
      'SQLFullType', p_SQLFullType_5456a79f7211,
      'SourceEntityID', p_SourceEntityID_5456a79f7211,
      'SourceFieldName', p_SourceFieldName_5456a79f7211,
      'IsComputed', p_IsComputed_5456a79f7211,
      'ComputationDescription', p_ComputationDescription_5456a79f7211,
      'IsSummary', p_IsSummary_5456a79f7211,
      'SummaryDescription', p_SummaryDescription_5456a79f7211,
      'DetectionMethod', p_DetectionMethod_5456a79f7211,
      'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_5456a79f7211
    ));
    ELSE
      PERFORM ${mjSchema}."spCreateQueryField"(p_ID := p_ID_5456a79f7211, p_QueryID := p_QueryID_5456a79f7211, p_Name := p_Name_5456a79f7211, p_Description := p_Description_5456a79f7211, p_Sequence := p_Sequence_5456a79f7211, p_SQLBaseType := p_SQLBaseType_5456a79f7211, p_SQLFullType := p_SQLFullType_5456a79f7211, p_SourceEntityID := p_SourceEntityID_5456a79f7211, p_SourceFieldName := p_SourceFieldName_5456a79f7211, p_IsComputed := p_IsComputed_5456a79f7211, p_ComputationDescription := p_ComputationDescription_5456a79f7211, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_5456a79f7211, p_SummaryDescription := p_SummaryDescription_5456a79f7211, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_5456a79f7211, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_5456a79f7211, p_AutoDetectConfidenceScore_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_d2c6b1bbe116 UUID;
  p_QueryID_d2c6b1bbe116 UUID;
  p_Name_d2c6b1bbe116 VARCHAR(255);
  p_Description_d2c6b1bbe116 TEXT;
  p_Sequence_d2c6b1bbe116 INTEGER;
  p_SQLBaseType_d2c6b1bbe116 VARCHAR(50);
  p_SQLFullType_d2c6b1bbe116 VARCHAR(100);
  p_SourceEntityID_d2c6b1bbe116 UUID;
  p_SourceFieldName_d2c6b1bbe116 VARCHAR(255);
  p_IsComputed_d2c6b1bbe116 BOOLEAN;
  p_ComputationDescription_d2c6b1bbe116 TEXT;
  p_IsSummary_d2c6b1bbe116 BOOLEAN;
  p_SummaryDescription_d2c6b1bbe116 TEXT;
  p_DetectionMethod_d2c6b1bbe116 VARCHAR(50);
  p_AutoDetectConfidenceScore_d2c6b1bbe116 NUMERIC(3,2);
BEGIN
  p_ID_d2c6b1bbe116 := 'e6416cee-13dd-47ae-86da-5dadad28d796';
  p_QueryID_d2c6b1bbe116 := '5DF477D8-D037-4EF7-8A6A-AB3C0FB93B05';
  p_Name_d2c6b1bbe116 := 'EntryType';
  p_Description_d2c6b1bbe116 := 'EntryType';
  p_Sequence_d2c6b1bbe116 := 6;
  p_SQLBaseType_d2c6b1bbe116 := 'nvarchar';
  p_SQLFullType_d2c6b1bbe116 := 'nvarchar(100)';
  p_SourceEntityID_d2c6b1bbe116 := 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762';
  p_SourceFieldName_d2c6b1bbe116 := 'EntryType';
  p_IsComputed_d2c6b1bbe116 := FALSE;
  p_IsSummary_d2c6b1bbe116 := FALSE;
  p_DetectionMethod_d2c6b1bbe116 := 'Manual';
  p_QueryID_d2c6b1bbe116 := COALESCE((SELECT "ID" FROM ${mjSchema}."Query" WHERE "Name" = 'Journal Entries Held Back By Posting Start Date' ORDER BY CASE WHEN "ID" = p_QueryID_d2c6b1bbe116 THEN 0 ELSE 1 END LIMIT 1), p_QueryID_d2c6b1bbe116);
  IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."QueryField"
               WHERE "ID" = p_ID_d2c6b1bbe116
                  OR ("QueryID" = p_QueryID_d2c6b1bbe116 AND "Name" = p_Name_d2c6b1bbe116)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM ${mjSchema}."spCreateQueryField"(p_data := jsonb_build_object(
      'ID', p_ID_d2c6b1bbe116,
      'QueryID', p_QueryID_d2c6b1bbe116,
      'Name', p_Name_d2c6b1bbe116,
      'Description', p_Description_d2c6b1bbe116,
      'Sequence', p_Sequence_d2c6b1bbe116,
      'SQLBaseType', p_SQLBaseType_d2c6b1bbe116,
      'SQLFullType', p_SQLFullType_d2c6b1bbe116,
      'SourceEntityID', p_SourceEntityID_d2c6b1bbe116,
      'SourceFieldName', p_SourceFieldName_d2c6b1bbe116,
      'IsComputed', p_IsComputed_d2c6b1bbe116,
      'ComputationDescription', p_ComputationDescription_d2c6b1bbe116,
      'IsSummary', p_IsSummary_d2c6b1bbe116,
      'SummaryDescription', p_SummaryDescription_d2c6b1bbe116,
      'DetectionMethod', p_DetectionMethod_d2c6b1bbe116,
      'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_d2c6b1bbe116
    ));
    ELSE
      PERFORM ${mjSchema}."spCreateQueryField"(p_ID := p_ID_d2c6b1bbe116, p_QueryID := p_QueryID_d2c6b1bbe116, p_Name := p_Name_d2c6b1bbe116, p_Description := p_Description_d2c6b1bbe116, p_Sequence := p_Sequence_d2c6b1bbe116, p_SQLBaseType := p_SQLBaseType_d2c6b1bbe116, p_SQLFullType := p_SQLFullType_d2c6b1bbe116, p_SourceEntityID := p_SourceEntityID_d2c6b1bbe116, p_SourceFieldName := p_SourceFieldName_d2c6b1bbe116, p_IsComputed := p_IsComputed_d2c6b1bbe116, p_ComputationDescription := p_ComputationDescription_d2c6b1bbe116, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_d2c6b1bbe116, p_SummaryDescription := p_SummaryDescription_d2c6b1bbe116, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_d2c6b1bbe116, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_d2c6b1bbe116, p_AutoDetectConfidenceScore_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_975334b331ff UUID;
  p_QueryID_975334b331ff UUID;
  p_Name_975334b331ff VARCHAR(255);
  p_Description_975334b331ff TEXT;
  p_Sequence_975334b331ff INTEGER;
  p_SQLBaseType_975334b331ff VARCHAR(50);
  p_SQLFullType_975334b331ff VARCHAR(100);
  p_SourceEntityID_975334b331ff UUID;
  p_SourceFieldName_975334b331ff VARCHAR(255);
  p_IsComputed_975334b331ff BOOLEAN;
  p_ComputationDescription_975334b331ff TEXT;
  p_IsSummary_975334b331ff BOOLEAN;
  p_SummaryDescription_975334b331ff TEXT;
  p_DetectionMethod_975334b331ff VARCHAR(50);
  p_AutoDetectConfidenceScore_975334b331ff NUMERIC(3,2);
BEGIN
  p_ID_975334b331ff := '7fb1e5e6-e5f4-4774-bc94-ca53fccfa44c';
  p_QueryID_975334b331ff := '5DF477D8-D037-4EF7-8A6A-AB3C0FB93B05';
  p_Name_975334b331ff := 'EntryDescription';
  p_Description_975334b331ff := 'Description (aliased as EntryDescription)';
  p_Sequence_975334b331ff := 7;
  p_SQLBaseType_975334b331ff := 'nvarchar';
  p_SQLFullType_975334b331ff := 'nvarchar(MAX)';
  p_SourceEntityID_975334b331ff := 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762';
  p_SourceFieldName_975334b331ff := 'Description';
  p_IsComputed_975334b331ff := FALSE;
  p_IsSummary_975334b331ff := FALSE;
  p_DetectionMethod_975334b331ff := 'Manual';
  p_QueryID_975334b331ff := COALESCE((SELECT "ID" FROM ${mjSchema}."Query" WHERE "Name" = 'Journal Entries Held Back By Posting Start Date' ORDER BY CASE WHEN "ID" = p_QueryID_975334b331ff THEN 0 ELSE 1 END LIMIT 1), p_QueryID_975334b331ff);
  IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."QueryField"
               WHERE "ID" = p_ID_975334b331ff
                  OR ("QueryID" = p_QueryID_975334b331ff AND "Name" = p_Name_975334b331ff)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM ${mjSchema}."spCreateQueryField"(p_data := jsonb_build_object(
      'ID', p_ID_975334b331ff,
      'QueryID', p_QueryID_975334b331ff,
      'Name', p_Name_975334b331ff,
      'Description', p_Description_975334b331ff,
      'Sequence', p_Sequence_975334b331ff,
      'SQLBaseType', p_SQLBaseType_975334b331ff,
      'SQLFullType', p_SQLFullType_975334b331ff,
      'SourceEntityID', p_SourceEntityID_975334b331ff,
      'SourceFieldName', p_SourceFieldName_975334b331ff,
      'IsComputed', p_IsComputed_975334b331ff,
      'ComputationDescription', p_ComputationDescription_975334b331ff,
      'IsSummary', p_IsSummary_975334b331ff,
      'SummaryDescription', p_SummaryDescription_975334b331ff,
      'DetectionMethod', p_DetectionMethod_975334b331ff,
      'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_975334b331ff
    ));
    ELSE
      PERFORM ${mjSchema}."spCreateQueryField"(p_ID := p_ID_975334b331ff, p_QueryID := p_QueryID_975334b331ff, p_Name := p_Name_975334b331ff, p_Description := p_Description_975334b331ff, p_Sequence := p_Sequence_975334b331ff, p_SQLBaseType := p_SQLBaseType_975334b331ff, p_SQLFullType := p_SQLFullType_975334b331ff, p_SourceEntityID := p_SourceEntityID_975334b331ff, p_SourceFieldName := p_SourceFieldName_975334b331ff, p_IsComputed := p_IsComputed_975334b331ff, p_ComputationDescription := p_ComputationDescription_975334b331ff, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_975334b331ff, p_SummaryDescription := p_SummaryDescription_975334b331ff, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_975334b331ff, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_975334b331ff, p_AutoDetectConfidenceScore_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_ade05c0d9553 UUID;
  p_QueryID_ade05c0d9553 UUID;
  p_Name_ade05c0d9553 VARCHAR(255);
  p_Description_ade05c0d9553 TEXT;
  p_Sequence_ade05c0d9553 INTEGER;
  p_SQLBaseType_ade05c0d9553 VARCHAR(50);
  p_SQLFullType_ade05c0d9553 VARCHAR(100);
  p_SourceEntityID_ade05c0d9553 UUID;
  p_SourceFieldName_ade05c0d9553 VARCHAR(255);
  p_IsComputed_ade05c0d9553 BOOLEAN;
  p_ComputationDescription_ade05c0d9553 TEXT;
  p_IsSummary_ade05c0d9553 BOOLEAN;
  p_SummaryDescription_ade05c0d9553 TEXT;
  p_DetectionMethod_ade05c0d9553 VARCHAR(50);
  p_AutoDetectConfidenceScore_ade05c0d9553 NUMERIC(3,2);
BEGIN
  p_ID_ade05c0d9553 := '7765d3a5-6a56-4f4b-b2a0-96fcbd34dd43';
  p_QueryID_ade05c0d9553 := '5DF477D8-D037-4EF7-8A6A-AB3C0FB93B05';
  p_Name_ade05c0d9553 := 'LineNumber';
  p_Description_ade05c0d9553 := 'LineNumber';
  p_Sequence_ade05c0d9553 := 8;
  p_SQLBaseType_ade05c0d9553 := 'int';
  p_SQLFullType_ade05c0d9553 := 'int';
  p_SourceEntityID_ade05c0d9553 := 'D70C29F6-F5A1-472C-B267-67CE7C2C2319';
  p_SourceFieldName_ade05c0d9553 := 'LineNumber';
  p_IsComputed_ade05c0d9553 := FALSE;
  p_IsSummary_ade05c0d9553 := FALSE;
  p_DetectionMethod_ade05c0d9553 := 'Manual';
  p_QueryID_ade05c0d9553 := COALESCE((SELECT "ID" FROM ${mjSchema}."Query" WHERE "Name" = 'Journal Entries Held Back By Posting Start Date' ORDER BY CASE WHEN "ID" = p_QueryID_ade05c0d9553 THEN 0 ELSE 1 END LIMIT 1), p_QueryID_ade05c0d9553);
  IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."QueryField"
               WHERE "ID" = p_ID_ade05c0d9553
                  OR ("QueryID" = p_QueryID_ade05c0d9553 AND "Name" = p_Name_ade05c0d9553)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM ${mjSchema}."spCreateQueryField"(p_data := jsonb_build_object(
      'ID', p_ID_ade05c0d9553,
      'QueryID', p_QueryID_ade05c0d9553,
      'Name', p_Name_ade05c0d9553,
      'Description', p_Description_ade05c0d9553,
      'Sequence', p_Sequence_ade05c0d9553,
      'SQLBaseType', p_SQLBaseType_ade05c0d9553,
      'SQLFullType', p_SQLFullType_ade05c0d9553,
      'SourceEntityID', p_SourceEntityID_ade05c0d9553,
      'SourceFieldName', p_SourceFieldName_ade05c0d9553,
      'IsComputed', p_IsComputed_ade05c0d9553,
      'ComputationDescription', p_ComputationDescription_ade05c0d9553,
      'IsSummary', p_IsSummary_ade05c0d9553,
      'SummaryDescription', p_SummaryDescription_ade05c0d9553,
      'DetectionMethod', p_DetectionMethod_ade05c0d9553,
      'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_ade05c0d9553
    ));
    ELSE
      PERFORM ${mjSchema}."spCreateQueryField"(p_ID := p_ID_ade05c0d9553, p_QueryID := p_QueryID_ade05c0d9553, p_Name := p_Name_ade05c0d9553, p_Description := p_Description_ade05c0d9553, p_Sequence := p_Sequence_ade05c0d9553, p_SQLBaseType := p_SQLBaseType_ade05c0d9553, p_SQLFullType := p_SQLFullType_ade05c0d9553, p_SourceEntityID := p_SourceEntityID_ade05c0d9553, p_SourceFieldName := p_SourceFieldName_ade05c0d9553, p_IsComputed := p_IsComputed_ade05c0d9553, p_ComputationDescription := p_ComputationDescription_ade05c0d9553, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_ade05c0d9553, p_SummaryDescription := p_SummaryDescription_ade05c0d9553, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_ade05c0d9553, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_ade05c0d9553, p_AutoDetectConfidenceScore_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_45dea03e39dc UUID;
  p_QueryID_45dea03e39dc UUID;
  p_Name_45dea03e39dc VARCHAR(255);
  p_Description_45dea03e39dc TEXT;
  p_Sequence_45dea03e39dc INTEGER;
  p_SQLBaseType_45dea03e39dc VARCHAR(50);
  p_SQLFullType_45dea03e39dc VARCHAR(100);
  p_SourceEntityID_45dea03e39dc UUID;
  p_SourceFieldName_45dea03e39dc VARCHAR(255);
  p_IsComputed_45dea03e39dc BOOLEAN;
  p_ComputationDescription_45dea03e39dc TEXT;
  p_IsSummary_45dea03e39dc BOOLEAN;
  p_SummaryDescription_45dea03e39dc TEXT;
  p_DetectionMethod_45dea03e39dc VARCHAR(50);
  p_AutoDetectConfidenceScore_45dea03e39dc NUMERIC(3,2);
BEGIN
  p_ID_45dea03e39dc := '8c5a5f6b-e3d7-4e9c-8314-d6c500edc5a1';
  p_QueryID_45dea03e39dc := '5DF477D8-D037-4EF7-8A6A-AB3C0FB93B05';
  p_Name_45dea03e39dc := 'GLAccountCode';
  p_Description_45dea03e39dc := 'Code (aliased as GLAccountCode)';
  p_Sequence_45dea03e39dc := 9;
  p_SQLBaseType_45dea03e39dc := 'nvarchar';
  p_SQLFullType_45dea03e39dc := 'nvarchar(40)';
  p_SourceEntityID_45dea03e39dc := '690BE4C8-C8F2-4067-B48B-57C0671B05A5';
  p_SourceFieldName_45dea03e39dc := 'Code';
  p_IsComputed_45dea03e39dc := FALSE;
  p_IsSummary_45dea03e39dc := FALSE;
  p_DetectionMethod_45dea03e39dc := 'Manual';
  p_QueryID_45dea03e39dc := COALESCE((SELECT "ID" FROM ${mjSchema}."Query" WHERE "Name" = 'Journal Entries Held Back By Posting Start Date' ORDER BY CASE WHEN "ID" = p_QueryID_45dea03e39dc THEN 0 ELSE 1 END LIMIT 1), p_QueryID_45dea03e39dc);
  IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."QueryField"
               WHERE "ID" = p_ID_45dea03e39dc
                  OR ("QueryID" = p_QueryID_45dea03e39dc AND "Name" = p_Name_45dea03e39dc)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM ${mjSchema}."spCreateQueryField"(p_data := jsonb_build_object(
      'ID', p_ID_45dea03e39dc,
      'QueryID', p_QueryID_45dea03e39dc,
      'Name', p_Name_45dea03e39dc,
      'Description', p_Description_45dea03e39dc,
      'Sequence', p_Sequence_45dea03e39dc,
      'SQLBaseType', p_SQLBaseType_45dea03e39dc,
      'SQLFullType', p_SQLFullType_45dea03e39dc,
      'SourceEntityID', p_SourceEntityID_45dea03e39dc,
      'SourceFieldName', p_SourceFieldName_45dea03e39dc,
      'IsComputed', p_IsComputed_45dea03e39dc,
      'ComputationDescription', p_ComputationDescription_45dea03e39dc,
      'IsSummary', p_IsSummary_45dea03e39dc,
      'SummaryDescription', p_SummaryDescription_45dea03e39dc,
      'DetectionMethod', p_DetectionMethod_45dea03e39dc,
      'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_45dea03e39dc
    ));
    ELSE
      PERFORM ${mjSchema}."spCreateQueryField"(p_ID := p_ID_45dea03e39dc, p_QueryID := p_QueryID_45dea03e39dc, p_Name := p_Name_45dea03e39dc, p_Description := p_Description_45dea03e39dc, p_Sequence := p_Sequence_45dea03e39dc, p_SQLBaseType := p_SQLBaseType_45dea03e39dc, p_SQLFullType := p_SQLFullType_45dea03e39dc, p_SourceEntityID := p_SourceEntityID_45dea03e39dc, p_SourceFieldName := p_SourceFieldName_45dea03e39dc, p_IsComputed := p_IsComputed_45dea03e39dc, p_ComputationDescription := p_ComputationDescription_45dea03e39dc, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_45dea03e39dc, p_SummaryDescription := p_SummaryDescription_45dea03e39dc, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_45dea03e39dc, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_45dea03e39dc, p_AutoDetectConfidenceScore_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_4f61984872d0 UUID;
  p_QueryID_4f61984872d0 UUID;
  p_Name_4f61984872d0 VARCHAR(255);
  p_Description_4f61984872d0 TEXT;
  p_Sequence_4f61984872d0 INTEGER;
  p_SQLBaseType_4f61984872d0 VARCHAR(50);
  p_SQLFullType_4f61984872d0 VARCHAR(100);
  p_SourceEntityID_4f61984872d0 UUID;
  p_SourceFieldName_4f61984872d0 VARCHAR(255);
  p_IsComputed_4f61984872d0 BOOLEAN;
  p_ComputationDescription_4f61984872d0 TEXT;
  p_IsSummary_4f61984872d0 BOOLEAN;
  p_SummaryDescription_4f61984872d0 TEXT;
  p_DetectionMethod_4f61984872d0 VARCHAR(50);
  p_AutoDetectConfidenceScore_4f61984872d0 NUMERIC(3,2);
BEGIN
  p_ID_4f61984872d0 := '95090d87-680b-42e6-825d-625275ca8c6b';
  p_QueryID_4f61984872d0 := '5DF477D8-D037-4EF7-8A6A-AB3C0FB93B05';
  p_Name_4f61984872d0 := 'GLAccountName';
  p_Description_4f61984872d0 := 'Name (aliased as GLAccountName)';
  p_Sequence_4f61984872d0 := 10;
  p_SQLBaseType_4f61984872d0 := 'nvarchar';
  p_SQLFullType_4f61984872d0 := 'nvarchar(200)';
  p_SourceEntityID_4f61984872d0 := '690BE4C8-C8F2-4067-B48B-57C0671B05A5';
  p_SourceFieldName_4f61984872d0 := 'Name';
  p_IsComputed_4f61984872d0 := FALSE;
  p_IsSummary_4f61984872d0 := FALSE;
  p_DetectionMethod_4f61984872d0 := 'Manual';
  p_QueryID_4f61984872d0 := COALESCE((SELECT "ID" FROM ${mjSchema}."Query" WHERE "Name" = 'Journal Entries Held Back By Posting Start Date' ORDER BY CASE WHEN "ID" = p_QueryID_4f61984872d0 THEN 0 ELSE 1 END LIMIT 1), p_QueryID_4f61984872d0);
  IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."QueryField"
               WHERE "ID" = p_ID_4f61984872d0
                  OR ("QueryID" = p_QueryID_4f61984872d0 AND "Name" = p_Name_4f61984872d0)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM ${mjSchema}."spCreateQueryField"(p_data := jsonb_build_object(
      'ID', p_ID_4f61984872d0,
      'QueryID', p_QueryID_4f61984872d0,
      'Name', p_Name_4f61984872d0,
      'Description', p_Description_4f61984872d0,
      'Sequence', p_Sequence_4f61984872d0,
      'SQLBaseType', p_SQLBaseType_4f61984872d0,
      'SQLFullType', p_SQLFullType_4f61984872d0,
      'SourceEntityID', p_SourceEntityID_4f61984872d0,
      'SourceFieldName', p_SourceFieldName_4f61984872d0,
      'IsComputed', p_IsComputed_4f61984872d0,
      'ComputationDescription', p_ComputationDescription_4f61984872d0,
      'IsSummary', p_IsSummary_4f61984872d0,
      'SummaryDescription', p_SummaryDescription_4f61984872d0,
      'DetectionMethod', p_DetectionMethod_4f61984872d0,
      'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_4f61984872d0
    ));
    ELSE
      PERFORM ${mjSchema}."spCreateQueryField"(p_ID := p_ID_4f61984872d0, p_QueryID := p_QueryID_4f61984872d0, p_Name := p_Name_4f61984872d0, p_Description := p_Description_4f61984872d0, p_Sequence := p_Sequence_4f61984872d0, p_SQLBaseType := p_SQLBaseType_4f61984872d0, p_SQLFullType := p_SQLFullType_4f61984872d0, p_SourceEntityID := p_SourceEntityID_4f61984872d0, p_SourceFieldName := p_SourceFieldName_4f61984872d0, p_IsComputed := p_IsComputed_4f61984872d0, p_ComputationDescription := p_ComputationDescription_4f61984872d0, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_4f61984872d0, p_SummaryDescription := p_SummaryDescription_4f61984872d0, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_4f61984872d0, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_4f61984872d0, p_AutoDetectConfidenceScore_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_1c58fef3deb7 UUID;
  p_QueryID_1c58fef3deb7 UUID;
  p_Name_1c58fef3deb7 VARCHAR(255);
  p_Description_1c58fef3deb7 TEXT;
  p_Sequence_1c58fef3deb7 INTEGER;
  p_SQLBaseType_1c58fef3deb7 VARCHAR(50);
  p_SQLFullType_1c58fef3deb7 VARCHAR(100);
  p_SourceEntityID_1c58fef3deb7 UUID;
  p_SourceFieldName_1c58fef3deb7 VARCHAR(255);
  p_IsComputed_1c58fef3deb7 BOOLEAN;
  p_ComputationDescription_1c58fef3deb7 TEXT;
  p_IsSummary_1c58fef3deb7 BOOLEAN;
  p_SummaryDescription_1c58fef3deb7 TEXT;
  p_DetectionMethod_1c58fef3deb7 VARCHAR(50);
  p_AutoDetectConfidenceScore_1c58fef3deb7 NUMERIC(3,2);
BEGIN
  p_ID_1c58fef3deb7 := '0d422787-8dba-4da3-8b3e-4572d6b4a2bf';
  p_QueryID_1c58fef3deb7 := '5DF477D8-D037-4EF7-8A6A-AB3C0FB93B05';
  p_Name_1c58fef3deb7 := 'DebitAmount';
  p_Description_1c58fef3deb7 := 'DebitAmount';
  p_Sequence_1c58fef3deb7 := 11;
  p_SQLBaseType_1c58fef3deb7 := 'decimal';
  p_SQLFullType_1c58fef3deb7 := 'decimal(18, 2)';
  p_SourceEntityID_1c58fef3deb7 := 'D70C29F6-F5A1-472C-B267-67CE7C2C2319';
  p_SourceFieldName_1c58fef3deb7 := 'DebitAmount';
  p_IsComputed_1c58fef3deb7 := FALSE;
  p_IsSummary_1c58fef3deb7 := FALSE;
  p_DetectionMethod_1c58fef3deb7 := 'Manual';
  p_QueryID_1c58fef3deb7 := COALESCE((SELECT "ID" FROM ${mjSchema}."Query" WHERE "Name" = 'Journal Entries Held Back By Posting Start Date' ORDER BY CASE WHEN "ID" = p_QueryID_1c58fef3deb7 THEN 0 ELSE 1 END LIMIT 1), p_QueryID_1c58fef3deb7);
  IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."QueryField"
               WHERE "ID" = p_ID_1c58fef3deb7
                  OR ("QueryID" = p_QueryID_1c58fef3deb7 AND "Name" = p_Name_1c58fef3deb7)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM ${mjSchema}."spCreateQueryField"(p_data := jsonb_build_object(
      'ID', p_ID_1c58fef3deb7,
      'QueryID', p_QueryID_1c58fef3deb7,
      'Name', p_Name_1c58fef3deb7,
      'Description', p_Description_1c58fef3deb7,
      'Sequence', p_Sequence_1c58fef3deb7,
      'SQLBaseType', p_SQLBaseType_1c58fef3deb7,
      'SQLFullType', p_SQLFullType_1c58fef3deb7,
      'SourceEntityID', p_SourceEntityID_1c58fef3deb7,
      'SourceFieldName', p_SourceFieldName_1c58fef3deb7,
      'IsComputed', p_IsComputed_1c58fef3deb7,
      'ComputationDescription', p_ComputationDescription_1c58fef3deb7,
      'IsSummary', p_IsSummary_1c58fef3deb7,
      'SummaryDescription', p_SummaryDescription_1c58fef3deb7,
      'DetectionMethod', p_DetectionMethod_1c58fef3deb7,
      'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_1c58fef3deb7
    ));
    ELSE
      PERFORM ${mjSchema}."spCreateQueryField"(p_ID := p_ID_1c58fef3deb7, p_QueryID := p_QueryID_1c58fef3deb7, p_Name := p_Name_1c58fef3deb7, p_Description := p_Description_1c58fef3deb7, p_Sequence := p_Sequence_1c58fef3deb7, p_SQLBaseType := p_SQLBaseType_1c58fef3deb7, p_SQLFullType := p_SQLFullType_1c58fef3deb7, p_SourceEntityID := p_SourceEntityID_1c58fef3deb7, p_SourceFieldName := p_SourceFieldName_1c58fef3deb7, p_IsComputed := p_IsComputed_1c58fef3deb7, p_ComputationDescription := p_ComputationDescription_1c58fef3deb7, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_1c58fef3deb7, p_SummaryDescription := p_SummaryDescription_1c58fef3deb7, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_1c58fef3deb7, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_1c58fef3deb7, p_AutoDetectConfidenceScore_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_4d3e94a2d971 UUID;
  p_QueryID_4d3e94a2d971 UUID;
  p_Name_4d3e94a2d971 VARCHAR(255);
  p_Description_4d3e94a2d971 TEXT;
  p_Sequence_4d3e94a2d971 INTEGER;
  p_SQLBaseType_4d3e94a2d971 VARCHAR(50);
  p_SQLFullType_4d3e94a2d971 VARCHAR(100);
  p_SourceEntityID_4d3e94a2d971 UUID;
  p_SourceFieldName_4d3e94a2d971 VARCHAR(255);
  p_IsComputed_4d3e94a2d971 BOOLEAN;
  p_ComputationDescription_4d3e94a2d971 TEXT;
  p_IsSummary_4d3e94a2d971 BOOLEAN;
  p_SummaryDescription_4d3e94a2d971 TEXT;
  p_DetectionMethod_4d3e94a2d971 VARCHAR(50);
  p_AutoDetectConfidenceScore_4d3e94a2d971 NUMERIC(3,2);
BEGIN
  p_ID_4d3e94a2d971 := 'f0fdac5b-c69e-4b66-8492-32c2531c9427';
  p_QueryID_4d3e94a2d971 := '5DF477D8-D037-4EF7-8A6A-AB3C0FB93B05';
  p_Name_4d3e94a2d971 := 'CreditAmount';
  p_Description_4d3e94a2d971 := 'CreditAmount';
  p_Sequence_4d3e94a2d971 := 12;
  p_SQLBaseType_4d3e94a2d971 := 'decimal';
  p_SQLFullType_4d3e94a2d971 := 'decimal(18, 2)';
  p_SourceEntityID_4d3e94a2d971 := 'D70C29F6-F5A1-472C-B267-67CE7C2C2319';
  p_SourceFieldName_4d3e94a2d971 := 'CreditAmount';
  p_IsComputed_4d3e94a2d971 := FALSE;
  p_IsSummary_4d3e94a2d971 := FALSE;
  p_DetectionMethod_4d3e94a2d971 := 'Manual';
  p_QueryID_4d3e94a2d971 := COALESCE((SELECT "ID" FROM ${mjSchema}."Query" WHERE "Name" = 'Journal Entries Held Back By Posting Start Date' ORDER BY CASE WHEN "ID" = p_QueryID_4d3e94a2d971 THEN 0 ELSE 1 END LIMIT 1), p_QueryID_4d3e94a2d971);
  IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."QueryField"
               WHERE "ID" = p_ID_4d3e94a2d971
                  OR ("QueryID" = p_QueryID_4d3e94a2d971 AND "Name" = p_Name_4d3e94a2d971)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM ${mjSchema}."spCreateQueryField"(p_data := jsonb_build_object(
      'ID', p_ID_4d3e94a2d971,
      'QueryID', p_QueryID_4d3e94a2d971,
      'Name', p_Name_4d3e94a2d971,
      'Description', p_Description_4d3e94a2d971,
      'Sequence', p_Sequence_4d3e94a2d971,
      'SQLBaseType', p_SQLBaseType_4d3e94a2d971,
      'SQLFullType', p_SQLFullType_4d3e94a2d971,
      'SourceEntityID', p_SourceEntityID_4d3e94a2d971,
      'SourceFieldName', p_SourceFieldName_4d3e94a2d971,
      'IsComputed', p_IsComputed_4d3e94a2d971,
      'ComputationDescription', p_ComputationDescription_4d3e94a2d971,
      'IsSummary', p_IsSummary_4d3e94a2d971,
      'SummaryDescription', p_SummaryDescription_4d3e94a2d971,
      'DetectionMethod', p_DetectionMethod_4d3e94a2d971,
      'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_4d3e94a2d971
    ));
    ELSE
      PERFORM ${mjSchema}."spCreateQueryField"(p_ID := p_ID_4d3e94a2d971, p_QueryID := p_QueryID_4d3e94a2d971, p_Name := p_Name_4d3e94a2d971, p_Description := p_Description_4d3e94a2d971, p_Sequence := p_Sequence_4d3e94a2d971, p_SQLBaseType := p_SQLBaseType_4d3e94a2d971, p_SQLFullType := p_SQLFullType_4d3e94a2d971, p_SourceEntityID := p_SourceEntityID_4d3e94a2d971, p_SourceFieldName := p_SourceFieldName_4d3e94a2d971, p_IsComputed := p_IsComputed_4d3e94a2d971, p_ComputationDescription := p_ComputationDescription_4d3e94a2d971, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_4d3e94a2d971, p_SummaryDescription := p_SummaryDescription_4d3e94a2d971, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_4d3e94a2d971, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_4d3e94a2d971, p_AutoDetectConfidenceScore_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_6d22676c0296 UUID;
  p_QueryID_6d22676c0296 UUID;
  p_Name_6d22676c0296 VARCHAR(255);
  p_Description_6d22676c0296 TEXT;
  p_Sequence_6d22676c0296 INTEGER;
  p_SQLBaseType_6d22676c0296 VARCHAR(50);
  p_SQLFullType_6d22676c0296 VARCHAR(100);
  p_SourceEntityID_6d22676c0296 UUID;
  p_SourceFieldName_6d22676c0296 VARCHAR(255);
  p_IsComputed_6d22676c0296 BOOLEAN;
  p_ComputationDescription_6d22676c0296 TEXT;
  p_IsSummary_6d22676c0296 BOOLEAN;
  p_SummaryDescription_6d22676c0296 TEXT;
  p_DetectionMethod_6d22676c0296 VARCHAR(50);
  p_AutoDetectConfidenceScore_6d22676c0296 NUMERIC(3,2);
BEGIN
  p_ID_6d22676c0296 := 'd7291644-9fb4-4ce9-ab6a-282b14c805aa';
  p_QueryID_6d22676c0296 := '5DF477D8-D037-4EF7-8A6A-AB3C0FB93B05';
  p_Name_6d22676c0296 := 'LineDescription';
  p_Description_6d22676c0296 := 'Description (aliased as LineDescription)';
  p_Sequence_6d22676c0296 := 13;
  p_SQLBaseType_6d22676c0296 := 'nvarchar';
  p_SQLFullType_6d22676c0296 := 'nvarchar(MAX)';
  p_SourceEntityID_6d22676c0296 := 'D70C29F6-F5A1-472C-B267-67CE7C2C2319';
  p_SourceFieldName_6d22676c0296 := 'Description';
  p_IsComputed_6d22676c0296 := FALSE;
  p_IsSummary_6d22676c0296 := FALSE;
  p_DetectionMethod_6d22676c0296 := 'Manual';
  p_QueryID_6d22676c0296 := COALESCE((SELECT "ID" FROM ${mjSchema}."Query" WHERE "Name" = 'Journal Entries Held Back By Posting Start Date' ORDER BY CASE WHEN "ID" = p_QueryID_6d22676c0296 THEN 0 ELSE 1 END LIMIT 1), p_QueryID_6d22676c0296);
  IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."QueryField"
               WHERE "ID" = p_ID_6d22676c0296
                  OR ("QueryID" = p_QueryID_6d22676c0296 AND "Name" = p_Name_6d22676c0296)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM ${mjSchema}."spCreateQueryField"(p_data := jsonb_build_object(
      'ID', p_ID_6d22676c0296,
      'QueryID', p_QueryID_6d22676c0296,
      'Name', p_Name_6d22676c0296,
      'Description', p_Description_6d22676c0296,
      'Sequence', p_Sequence_6d22676c0296,
      'SQLBaseType', p_SQLBaseType_6d22676c0296,
      'SQLFullType', p_SQLFullType_6d22676c0296,
      'SourceEntityID', p_SourceEntityID_6d22676c0296,
      'SourceFieldName', p_SourceFieldName_6d22676c0296,
      'IsComputed', p_IsComputed_6d22676c0296,
      'ComputationDescription', p_ComputationDescription_6d22676c0296,
      'IsSummary', p_IsSummary_6d22676c0296,
      'SummaryDescription', p_SummaryDescription_6d22676c0296,
      'DetectionMethod', p_DetectionMethod_6d22676c0296,
      'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_6d22676c0296
    ));
    ELSE
      PERFORM ${mjSchema}."spCreateQueryField"(p_ID := p_ID_6d22676c0296, p_QueryID := p_QueryID_6d22676c0296, p_Name := p_Name_6d22676c0296, p_Description := p_Description_6d22676c0296, p_Sequence := p_Sequence_6d22676c0296, p_SQLBaseType := p_SQLBaseType_6d22676c0296, p_SQLFullType := p_SQLFullType_6d22676c0296, p_SourceEntityID := p_SourceEntityID_6d22676c0296, p_SourceFieldName := p_SourceFieldName_6d22676c0296, p_IsComputed := p_IsComputed_6d22676c0296, p_ComputationDescription := p_ComputationDescription_6d22676c0296, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_6d22676c0296, p_SummaryDescription := p_SummaryDescription_6d22676c0296, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_6d22676c0296, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_6d22676c0296, p_AutoDetectConfidenceScore_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_8ba068b3105e UUID;
  p_QueryID_8ba068b3105e UUID;
  p_Name_8ba068b3105e VARCHAR(255);
  p_Description_8ba068b3105e TEXT;
  p_Sequence_8ba068b3105e INTEGER;
  p_SQLBaseType_8ba068b3105e VARCHAR(50);
  p_SQLFullType_8ba068b3105e VARCHAR(100);
  p_SourceEntityID_8ba068b3105e UUID;
  p_SourceFieldName_8ba068b3105e VARCHAR(255);
  p_IsComputed_8ba068b3105e BOOLEAN;
  p_ComputationDescription_8ba068b3105e TEXT;
  p_IsSummary_8ba068b3105e BOOLEAN;
  p_SummaryDescription_8ba068b3105e TEXT;
  p_DetectionMethod_8ba068b3105e VARCHAR(50);
  p_AutoDetectConfidenceScore_8ba068b3105e NUMERIC(3,2);
BEGIN
  p_ID_8ba068b3105e := '48e0576d-d2cf-4541-957a-29b3c5e0ad06';
  p_QueryID_8ba068b3105e := '5DF477D8-D037-4EF7-8A6A-AB3C0FB93B05';
  p_Name_8ba068b3105e := 'JournalEntryID';
  p_Description_8ba068b3105e := 'ID (aliased as JournalEntryID)';
  p_Sequence_8ba068b3105e := 14;
  p_SQLBaseType_8ba068b3105e := 'uniqueidentifier';
  p_SQLFullType_8ba068b3105e := 'uniqueidentifier';
  p_SourceEntityID_8ba068b3105e := 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762';
  p_SourceFieldName_8ba068b3105e := 'ID';
  p_IsComputed_8ba068b3105e := FALSE;
  p_IsSummary_8ba068b3105e := FALSE;
  p_DetectionMethod_8ba068b3105e := 'Manual';
  p_QueryID_8ba068b3105e := COALESCE((SELECT "ID" FROM ${mjSchema}."Query" WHERE "Name" = 'Journal Entries Held Back By Posting Start Date' ORDER BY CASE WHEN "ID" = p_QueryID_8ba068b3105e THEN 0 ELSE 1 END LIMIT 1), p_QueryID_8ba068b3105e);
  IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."QueryField"
               WHERE "ID" = p_ID_8ba068b3105e
                  OR ("QueryID" = p_QueryID_8ba068b3105e AND "Name" = p_Name_8ba068b3105e)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM ${mjSchema}."spCreateQueryField"(p_data := jsonb_build_object(
      'ID', p_ID_8ba068b3105e,
      'QueryID', p_QueryID_8ba068b3105e,
      'Name', p_Name_8ba068b3105e,
      'Description', p_Description_8ba068b3105e,
      'Sequence', p_Sequence_8ba068b3105e,
      'SQLBaseType', p_SQLBaseType_8ba068b3105e,
      'SQLFullType', p_SQLFullType_8ba068b3105e,
      'SourceEntityID', p_SourceEntityID_8ba068b3105e,
      'SourceFieldName', p_SourceFieldName_8ba068b3105e,
      'IsComputed', p_IsComputed_8ba068b3105e,
      'ComputationDescription', p_ComputationDescription_8ba068b3105e,
      'IsSummary', p_IsSummary_8ba068b3105e,
      'SummaryDescription', p_SummaryDescription_8ba068b3105e,
      'DetectionMethod', p_DetectionMethod_8ba068b3105e,
      'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_8ba068b3105e
    ));
    ELSE
      PERFORM ${mjSchema}."spCreateQueryField"(p_ID := p_ID_8ba068b3105e, p_QueryID := p_QueryID_8ba068b3105e, p_Name := p_Name_8ba068b3105e, p_Description := p_Description_8ba068b3105e, p_Sequence := p_Sequence_8ba068b3105e, p_SQLBaseType := p_SQLBaseType_8ba068b3105e, p_SQLFullType := p_SQLFullType_8ba068b3105e, p_SourceEntityID := p_SourceEntityID_8ba068b3105e, p_SourceFieldName := p_SourceFieldName_8ba068b3105e, p_IsComputed := p_IsComputed_8ba068b3105e, p_ComputationDescription := p_ComputationDescription_8ba068b3105e, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_8ba068b3105e, p_SummaryDescription := p_SummaryDescription_8ba068b3105e, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_8ba068b3105e, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_8ba068b3105e, p_AutoDetectConfidenceScore_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Entities (core SP call only)
DO $mj$
DECLARE
  p_ID_e101c6226c64 UUID;
  p_QueryID_e101c6226c64 UUID;
  p_EntityID_e101c6226c64 UUID;
  p_DetectionMethod_e101c6226c64 VARCHAR(50);
  p_AutoDetectConfidenceScore_e101c6226c64 NUMERIC(3,2);
BEGIN
  p_ID_e101c6226c64 := '44bff06d-520e-4abe-96ff-c1d124a46fec';
  p_QueryID_e101c6226c64 := '5DF477D8-D037-4EF7-8A6A-AB3C0FB93B05';
  p_EntityID_e101c6226c64 := 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762';
  p_DetectionMethod_e101c6226c64 := 'AI';
  p_AutoDetectConfidenceScore_e101c6226c64 := 1;
  p_QueryID_e101c6226c64 := COALESCE((SELECT "ID" FROM ${mjSchema}."Query" WHERE "Name" = 'Journal Entries Held Back By Posting Start Date' ORDER BY CASE WHEN "ID" = p_QueryID_e101c6226c64 THEN 0 ELSE 1 END LIMIT 1), p_QueryID_e101c6226c64);
  IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."QueryEntity"
               WHERE "ID" = p_ID_e101c6226c64
                  OR ("QueryID" = p_QueryID_e101c6226c64 AND "EntityID" = p_EntityID_e101c6226c64)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryEntity'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM ${mjSchema}."spCreateQueryEntity"(p_data := jsonb_build_object(
      'ID', p_ID_e101c6226c64,
      'QueryID', p_QueryID_e101c6226c64,
      'EntityID', p_EntityID_e101c6226c64,
      'DetectionMethod', p_DetectionMethod_e101c6226c64,
      'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_e101c6226c64
    ));
    ELSE
      PERFORM ${mjSchema}."spCreateQueryEntity"(p_ID := p_ID_e101c6226c64, p_QueryID := p_QueryID_e101c6226c64, p_EntityID := p_EntityID_e101c6226c64, p_DetectionMethod := p_DetectionMethod_e101c6226c64, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_e101c6226c64);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Entities (core SP call only)
DO $mj$
DECLARE
  p_ID_3b4b6e0ffc38 UUID;
  p_QueryID_3b4b6e0ffc38 UUID;
  p_EntityID_3b4b6e0ffc38 UUID;
  p_DetectionMethod_3b4b6e0ffc38 VARCHAR(50);
  p_AutoDetectConfidenceScore_3b4b6e0ffc38 NUMERIC(3,2);
BEGIN
  p_ID_3b4b6e0ffc38 := '4219da3f-c418-4527-a6f3-cc1e9ed2c5bd';
  p_QueryID_3b4b6e0ffc38 := '5DF477D8-D037-4EF7-8A6A-AB3C0FB93B05';
  p_EntityID_3b4b6e0ffc38 := '3E551198-AB66-478E-BEB6-C34EDBE242EC';
  p_DetectionMethod_3b4b6e0ffc38 := 'AI';
  p_AutoDetectConfidenceScore_3b4b6e0ffc38 := 1;
  p_QueryID_3b4b6e0ffc38 := COALESCE((SELECT "ID" FROM ${mjSchema}."Query" WHERE "Name" = 'Journal Entries Held Back By Posting Start Date' ORDER BY CASE WHEN "ID" = p_QueryID_3b4b6e0ffc38 THEN 0 ELSE 1 END LIMIT 1), p_QueryID_3b4b6e0ffc38);
  IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."QueryEntity"
               WHERE "ID" = p_ID_3b4b6e0ffc38
                  OR ("QueryID" = p_QueryID_3b4b6e0ffc38 AND "EntityID" = p_EntityID_3b4b6e0ffc38)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryEntity'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM ${mjSchema}."spCreateQueryEntity"(p_data := jsonb_build_object(
      'ID', p_ID_3b4b6e0ffc38,
      'QueryID', p_QueryID_3b4b6e0ffc38,
      'EntityID', p_EntityID_3b4b6e0ffc38,
      'DetectionMethod', p_DetectionMethod_3b4b6e0ffc38,
      'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_3b4b6e0ffc38
    ));
    ELSE
      PERFORM ${mjSchema}."spCreateQueryEntity"(p_ID := p_ID_3b4b6e0ffc38, p_QueryID := p_QueryID_3b4b6e0ffc38, p_EntityID := p_EntityID_3b4b6e0ffc38, p_DetectionMethod := p_DetectionMethod_3b4b6e0ffc38, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_3b4b6e0ffc38);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Entities (core SP call only)
DO $mj$
DECLARE
  p_ID_b55f6a374b1a UUID;
  p_QueryID_b55f6a374b1a UUID;
  p_EntityID_b55f6a374b1a UUID;
  p_DetectionMethod_b55f6a374b1a VARCHAR(50);
  p_AutoDetectConfidenceScore_b55f6a374b1a NUMERIC(3,2);
BEGIN
  p_ID_b55f6a374b1a := '1a91549e-06e7-4fe1-82a1-bcd1ab85c280';
  p_QueryID_b55f6a374b1a := '5DF477D8-D037-4EF7-8A6A-AB3C0FB93B05';
  p_EntityID_b55f6a374b1a := '8E2751A1-D113-4125-953D-6F32509B6290';
  p_DetectionMethod_b55f6a374b1a := 'AI';
  p_AutoDetectConfidenceScore_b55f6a374b1a := 1;
  p_QueryID_b55f6a374b1a := COALESCE((SELECT "ID" FROM ${mjSchema}."Query" WHERE "Name" = 'Journal Entries Held Back By Posting Start Date' ORDER BY CASE WHEN "ID" = p_QueryID_b55f6a374b1a THEN 0 ELSE 1 END LIMIT 1), p_QueryID_b55f6a374b1a);
  IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."QueryEntity"
               WHERE "ID" = p_ID_b55f6a374b1a
                  OR ("QueryID" = p_QueryID_b55f6a374b1a AND "EntityID" = p_EntityID_b55f6a374b1a)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryEntity'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM ${mjSchema}."spCreateQueryEntity"(p_data := jsonb_build_object(
      'ID', p_ID_b55f6a374b1a,
      'QueryID', p_QueryID_b55f6a374b1a,
      'EntityID', p_EntityID_b55f6a374b1a,
      'DetectionMethod', p_DetectionMethod_b55f6a374b1a,
      'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_b55f6a374b1a
    ));
    ELSE
      PERFORM ${mjSchema}."spCreateQueryEntity"(p_ID := p_ID_b55f6a374b1a, p_QueryID := p_QueryID_b55f6a374b1a, p_EntityID := p_EntityID_b55f6a374b1a, p_DetectionMethod := p_DetectionMethod_b55f6a374b1a, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_b55f6a374b1a);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Entities (core SP call only)
DO $mj$
DECLARE
  p_ID_cad755675396 UUID;
  p_QueryID_cad755675396 UUID;
  p_EntityID_cad755675396 UUID;
  p_DetectionMethod_cad755675396 VARCHAR(50);
  p_AutoDetectConfidenceScore_cad755675396 NUMERIC(3,2);
BEGIN
  p_ID_cad755675396 := '54da43a4-63db-4efc-871d-b069dec9a0e1';
  p_QueryID_cad755675396 := '5DF477D8-D037-4EF7-8A6A-AB3C0FB93B05';
  p_EntityID_cad755675396 := 'D70C29F6-F5A1-472C-B267-67CE7C2C2319';
  p_DetectionMethod_cad755675396 := 'AI';
  p_AutoDetectConfidenceScore_cad755675396 := 1;
  p_QueryID_cad755675396 := COALESCE((SELECT "ID" FROM ${mjSchema}."Query" WHERE "Name" = 'Journal Entries Held Back By Posting Start Date' ORDER BY CASE WHEN "ID" = p_QueryID_cad755675396 THEN 0 ELSE 1 END LIMIT 1), p_QueryID_cad755675396);
  IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."QueryEntity"
               WHERE "ID" = p_ID_cad755675396
                  OR ("QueryID" = p_QueryID_cad755675396 AND "EntityID" = p_EntityID_cad755675396)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryEntity'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM ${mjSchema}."spCreateQueryEntity"(p_data := jsonb_build_object(
      'ID', p_ID_cad755675396,
      'QueryID', p_QueryID_cad755675396,
      'EntityID', p_EntityID_cad755675396,
      'DetectionMethod', p_DetectionMethod_cad755675396,
      'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_cad755675396
    ));
    ELSE
      PERFORM ${mjSchema}."spCreateQueryEntity"(p_ID := p_ID_cad755675396, p_QueryID := p_QueryID_cad755675396, p_EntityID := p_EntityID_cad755675396, p_DetectionMethod := p_DetectionMethod_cad755675396, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_cad755675396);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Entities (core SP call only)
DO $mj$
DECLARE
  p_ID_4b41deff44b8 UUID;
  p_QueryID_4b41deff44b8 UUID;
  p_EntityID_4b41deff44b8 UUID;
  p_DetectionMethod_4b41deff44b8 VARCHAR(50);
  p_AutoDetectConfidenceScore_4b41deff44b8 NUMERIC(3,2);
BEGIN
  p_ID_4b41deff44b8 := 'b517f6eb-330c-4529-8457-06f5f86f2736';
  p_QueryID_4b41deff44b8 := '5DF477D8-D037-4EF7-8A6A-AB3C0FB93B05';
  p_EntityID_4b41deff44b8 := '690BE4C8-C8F2-4067-B48B-57C0671B05A5';
  p_DetectionMethod_4b41deff44b8 := 'AI';
  p_AutoDetectConfidenceScore_4b41deff44b8 := 1;
  p_QueryID_4b41deff44b8 := COALESCE((SELECT "ID" FROM ${mjSchema}."Query" WHERE "Name" = 'Journal Entries Held Back By Posting Start Date' ORDER BY CASE WHEN "ID" = p_QueryID_4b41deff44b8 THEN 0 ELSE 1 END LIMIT 1), p_QueryID_4b41deff44b8);
  IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."QueryEntity"
               WHERE "ID" = p_ID_4b41deff44b8
                  OR ("QueryID" = p_QueryID_4b41deff44b8 AND "EntityID" = p_EntityID_4b41deff44b8)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryEntity'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM ${mjSchema}."spCreateQueryEntity"(p_data := jsonb_build_object(
      'ID', p_ID_4b41deff44b8,
      'QueryID', p_QueryID_4b41deff44b8,
      'EntityID', p_EntityID_4b41deff44b8,
      'DetectionMethod', p_DetectionMethod_4b41deff44b8,
      'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_4b41deff44b8
    ));
    ELSE
      PERFORM ${mjSchema}."spCreateQueryEntity"(p_ID := p_ID_4b41deff44b8, p_QueryID := p_QueryID_4b41deff44b8, p_EntityID := p_EntityID_4b41deff44b8, p_DetectionMethod := p_DetectionMethod_4b41deff44b8, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_4b41deff44b8);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Authorizations (core SP call only)
DO $mj$
DECLARE
  p_ID_fefd41452685 UUID;
  p_ParentID_fefd41452685 UUID;
  p_Name_fefd41452685 VARCHAR(100);
  p_IsActive_fefd41452685 BOOLEAN;
  p_UseAuditLog_fefd41452685 BOOLEAN;
  p_Description_fefd41452685 TEXT;
BEGIN
  p_ID_fefd41452685 := 'D6E5D7D7-2D25-4D40-A48E-4276B08F8728';
  p_Name_fefd41452685 := 'MJ.BizApps.Accounting.BooksClosedThroughDate.Set';
  p_IsActive_fefd41452685 := TRUE;
  p_UseAuditLog_fefd41452685 := TRUE;
  p_Description_fefd41452685 := 'Set or move a company''s BooksClosedThroughDate on its Accounting Company Profile: closing a month moves it forward, reopening one moves it back. Held by the Finance role. Every change is kept in the profile''s record-change history.';
  IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."Authorization"
               WHERE "ID" = p_ID_fefd41452685
                  OR ("Name" = p_Name_fefd41452685)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateAuthorization'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM ${mjSchema}."spCreateAuthorization"(p_data := jsonb_build_object(
      'ID', p_ID_fefd41452685,
      'ParentID', p_ParentID_fefd41452685,
      'Name', p_Name_fefd41452685,
      'IsActive', p_IsActive_fefd41452685,
      'UseAuditLog', p_UseAuditLog_fefd41452685,
      'Description', p_Description_fefd41452685
    ));
    ELSE
      PERFORM ${mjSchema}."spCreateAuthorization"(p_ID := p_ID_fefd41452685, p_ParentID := p_ParentID_fefd41452685, p_ParentID_Clear := TRUE, p_Name := p_Name_fefd41452685, p_IsActive := p_IsActive_fefd41452685, p_UseAuditLog := p_UseAuditLog_fefd41452685, p_Description := p_Description_fefd41452685);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Authorizations (core SP call only)
DO $mj$
DECLARE
  p_ID_aa0b56ee8c94 UUID;
  p_ParentID_aa0b56ee8c94 UUID;
  p_Name_aa0b56ee8c94 VARCHAR(100);
  p_IsActive_aa0b56ee8c94 BOOLEAN;
  p_UseAuditLog_aa0b56ee8c94 BOOLEAN;
  p_Description_aa0b56ee8c94 TEXT;
BEGIN
  p_ID_aa0b56ee8c94 := '0CBE1D3B-6949-4340-A895-F790C9D2DF3A';
  p_Name_aa0b56ee8c94 := 'MJ.BizApps.Accounting.FinanceExceptions.ClearType.WON_DEAL_ORDER_NOT_CONFIRMED';
  p_IsActive_aa0b56ee8c94 := TRUE;
  p_UseAuditLog_aa0b56ee8c94 := TRUE;
  p_Description_aa0b56ee8c94 := 'Who may clear WON_DEAL_ORDER_NOT_CONFIRMED finance exceptions through Accounting.ClearFinanceException. Shipped granted to no role, which leaves the type under MJ.BizApps.Accounting.FinanceExceptions.Clear. Once any role is granted it (Allow), only its holders may clear this type, and holding MJ.BizApps.Accounting.FinanceExceptions.Clear no longer does. Checked as a direct grant: it has no parent. The source record''s creator is still refused, and an unattributed or escalated creator is decided by MJ.BizApps.Accounting.FinanceExceptions.ClearUnattributed / MJ.BizApps.Accounting.FinanceExceptions.ClearEscalated when those are granted.';
  IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."Authorization"
               WHERE "ID" = p_ID_aa0b56ee8c94
                  OR ("Name" = p_Name_aa0b56ee8c94)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateAuthorization'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM ${mjSchema}."spCreateAuthorization"(p_data := jsonb_build_object(
      'ID', p_ID_aa0b56ee8c94,
      'ParentID', p_ParentID_aa0b56ee8c94,
      'Name', p_Name_aa0b56ee8c94,
      'IsActive', p_IsActive_aa0b56ee8c94,
      'UseAuditLog', p_UseAuditLog_aa0b56ee8c94,
      'Description', p_Description_aa0b56ee8c94
    ));
    ELSE
      PERFORM ${mjSchema}."spCreateAuthorization"(p_ID := p_ID_aa0b56ee8c94, p_ParentID := p_ParentID_aa0b56ee8c94, p_ParentID_Clear := TRUE, p_Name := p_Name_aa0b56ee8c94, p_IsActive := p_IsActive_aa0b56ee8c94, p_UseAuditLog := p_UseAuditLog_aa0b56ee8c94, p_Description := p_Description_aa0b56ee8c94);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Authorizations (core SP call only)
DO $mj$
DECLARE
  p_ID_71dea4a396f8 UUID;
  p_ParentID_71dea4a396f8 UUID;
  p_Name_71dea4a396f8 VARCHAR(100);
  p_IsActive_71dea4a396f8 BOOLEAN;
  p_UseAuditLog_71dea4a396f8 BOOLEAN;
  p_Description_71dea4a396f8 TEXT;
BEGIN
  p_ID_71dea4a396f8 := '6D6EB2DD-7A11-4F7A-9B76-6E6245796393';
  p_Name_71dea4a396f8 := 'MJ.BizApps.Accounting.FinanceExceptions.ClearType.OVERLAPPING_SUBSCRIPTION';
  p_IsActive_71dea4a396f8 := TRUE;
  p_UseAuditLog_71dea4a396f8 := TRUE;
  p_Description_71dea4a396f8 := 'Who may clear OVERLAPPING_SUBSCRIPTION finance exceptions through Accounting.ClearFinanceException. Shipped granted to no role, which leaves the type under MJ.BizApps.Accounting.FinanceExceptions.Clear. Once any role is granted it (Allow), only its holders may clear this type, and holding MJ.BizApps.Accounting.FinanceExceptions.Clear no longer does. Checked as a direct grant: it has no parent. The source record''s creator is still refused, and an unattributed or escalated creator is decided by MJ.BizApps.Accounting.FinanceExceptions.ClearUnattributed / MJ.BizApps.Accounting.FinanceExceptions.ClearEscalated when those are granted.';
  IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."Authorization"
               WHERE "ID" = p_ID_71dea4a396f8
                  OR ("Name" = p_Name_71dea4a396f8)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateAuthorization'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM ${mjSchema}."spCreateAuthorization"(p_data := jsonb_build_object(
      'ID', p_ID_71dea4a396f8,
      'ParentID', p_ParentID_71dea4a396f8,
      'Name', p_Name_71dea4a396f8,
      'IsActive', p_IsActive_71dea4a396f8,
      'UseAuditLog', p_UseAuditLog_71dea4a396f8,
      'Description', p_Description_71dea4a396f8
    ));
    ELSE
      PERFORM ${mjSchema}."spCreateAuthorization"(p_ID := p_ID_71dea4a396f8, p_ParentID := p_ParentID_71dea4a396f8, p_ParentID_Clear := TRUE, p_Name := p_Name_71dea4a396f8, p_IsActive := p_IsActive_71dea4a396f8, p_UseAuditLog := p_UseAuditLog_71dea4a396f8, p_Description := p_Description_71dea4a396f8);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Authorizations (core SP call only)
DO $mj$
DECLARE
  p_ID_0875d9d496e7 UUID;
  p_ParentID_0875d9d496e7 UUID;
  p_Name_0875d9d496e7 VARCHAR(100);
  p_IsActive_0875d9d496e7 BOOLEAN;
  p_UseAuditLog_0875d9d496e7 BOOLEAN;
  p_Description_0875d9d496e7 TEXT;
BEGIN
  p_ID_0875d9d496e7 := '01003664-5843-41B5-A6B7-B0D892ECC7C8';
  p_Name_0875d9d496e7 := 'MJ.BizApps.Accounting.FinanceExceptions.ClearType.ERP_POSTING_NOT_READ_BACK';
  p_IsActive_0875d9d496e7 := TRUE;
  p_UseAuditLog_0875d9d496e7 := TRUE;
  p_Description_0875d9d496e7 := 'Who may clear ERP_POSTING_NOT_READ_BACK finance exceptions through Accounting.ClearFinanceException. Shipped granted to no role, which leaves the type under MJ.BizApps.Accounting.FinanceExceptions.Clear. Once any role is granted it (Allow), only its holders may clear this type, and holding MJ.BizApps.Accounting.FinanceExceptions.Clear no longer does. Checked as a direct grant: it has no parent. The source record''s creator is still refused, and an unattributed or escalated creator is decided by MJ.BizApps.Accounting.FinanceExceptions.ClearUnattributed / MJ.BizApps.Accounting.FinanceExceptions.ClearEscalated when those are granted.';
  IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."Authorization"
               WHERE "ID" = p_ID_0875d9d496e7
                  OR ("Name" = p_Name_0875d9d496e7)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateAuthorization'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM ${mjSchema}."spCreateAuthorization"(p_data := jsonb_build_object(
      'ID', p_ID_0875d9d496e7,
      'ParentID', p_ParentID_0875d9d496e7,
      'Name', p_Name_0875d9d496e7,
      'IsActive', p_IsActive_0875d9d496e7,
      'UseAuditLog', p_UseAuditLog_0875d9d496e7,
      'Description', p_Description_0875d9d496e7
    ));
    ELSE
      PERFORM ${mjSchema}."spCreateAuthorization"(p_ID := p_ID_0875d9d496e7, p_ParentID := p_ParentID_0875d9d496e7, p_ParentID_Clear := TRUE, p_Name := p_Name_0875d9d496e7, p_IsActive := p_IsActive_0875d9d496e7, p_UseAuditLog := p_UseAuditLog_0875d9d496e7, p_Description := p_Description_0875d9d496e7);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Authorizations (core SP call only)
DO $mj$
DECLARE
  p_ID_83f6ea0bc7ee UUID;
  p_ParentID_83f6ea0bc7ee UUID;
  p_Name_83f6ea0bc7ee VARCHAR(100);
  p_IsActive_83f6ea0bc7ee BOOLEAN;
  p_UseAuditLog_83f6ea0bc7ee BOOLEAN;
  p_Description_83f6ea0bc7ee TEXT;
BEGIN
  p_ID_83f6ea0bc7ee := '6036FD7E-7B88-41FD-87AA-A9F3C6247556';
  p_Name_83f6ea0bc7ee := 'MJ.BizApps.Accounting.FinanceExceptions.ClearType.PROGRESS_UNATTESTED';
  p_IsActive_83f6ea0bc7ee := TRUE;
  p_UseAuditLog_83f6ea0bc7ee := TRUE;
  p_Description_83f6ea0bc7ee := 'Who may clear PROGRESS_UNATTESTED finance exceptions through Accounting.ClearFinanceException. Shipped granted to no role, which leaves the type under MJ.BizApps.Accounting.FinanceExceptions.Clear. Once any role is granted it (Allow), only its holders may clear this type, and holding MJ.BizApps.Accounting.FinanceExceptions.Clear no longer does. Checked as a direct grant: it has no parent. The source record''s creator is still refused, and an unattributed or escalated creator is decided by MJ.BizApps.Accounting.FinanceExceptions.ClearUnattributed / MJ.BizApps.Accounting.FinanceExceptions.ClearEscalated when those are granted.';
  IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."Authorization"
               WHERE "ID" = p_ID_83f6ea0bc7ee
                  OR ("Name" = p_Name_83f6ea0bc7ee)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateAuthorization'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM ${mjSchema}."spCreateAuthorization"(p_data := jsonb_build_object(
      'ID', p_ID_83f6ea0bc7ee,
      'ParentID', p_ParentID_83f6ea0bc7ee,
      'Name', p_Name_83f6ea0bc7ee,
      'IsActive', p_IsActive_83f6ea0bc7ee,
      'UseAuditLog', p_UseAuditLog_83f6ea0bc7ee,
      'Description', p_Description_83f6ea0bc7ee
    ));
    ELSE
      PERFORM ${mjSchema}."spCreateAuthorization"(p_ID := p_ID_83f6ea0bc7ee, p_ParentID := p_ParentID_83f6ea0bc7ee, p_ParentID_Clear := TRUE, p_Name := p_Name_83f6ea0bc7ee, p_IsActive := p_IsActive_83f6ea0bc7ee, p_UseAuditLog := p_UseAuditLog_83f6ea0bc7ee, p_Description := p_Description_83f6ea0bc7ee);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Authorizations (core SP call only)
DO $mj$
DECLARE
  p_ID_509ea60fa788 UUID;
  p_ParentID_509ea60fa788 UUID;
  p_Name_509ea60fa788 VARCHAR(100);
  p_IsActive_509ea60fa788 BOOLEAN;
  p_UseAuditLog_509ea60fa788 BOOLEAN;
  p_Description_509ea60fa788 TEXT;
BEGIN
  p_ID_509ea60fa788 := '0A54FC89-3302-4F16-AC53-925F3160FB61';
  p_Name_509ea60fa788 := 'MJ.BizApps.Accounting.FinanceExceptions.ClearType.PROGRESS_JUDGMENT_CALL';
  p_IsActive_509ea60fa788 := TRUE;
  p_UseAuditLog_509ea60fa788 := TRUE;
  p_Description_509ea60fa788 := 'Who may clear PROGRESS_JUDGMENT_CALL finance exceptions through Accounting.ClearFinanceException. Shipped granted to no role, which leaves the type under MJ.BizApps.Accounting.FinanceExceptions.Clear. Once any role is granted it (Allow), only its holders may clear this type, and holding MJ.BizApps.Accounting.FinanceExceptions.Clear no longer does. Checked as a direct grant: it has no parent. The source record''s creator is still refused, and an unattributed or escalated creator is decided by MJ.BizApps.Accounting.FinanceExceptions.ClearUnattributed / MJ.BizApps.Accounting.FinanceExceptions.ClearEscalated when those are granted.';
  IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."Authorization"
               WHERE "ID" = p_ID_509ea60fa788
                  OR ("Name" = p_Name_509ea60fa788)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateAuthorization'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM ${mjSchema}."spCreateAuthorization"(p_data := jsonb_build_object(
      'ID', p_ID_509ea60fa788,
      'ParentID', p_ParentID_509ea60fa788,
      'Name', p_Name_509ea60fa788,
      'IsActive', p_IsActive_509ea60fa788,
      'UseAuditLog', p_UseAuditLog_509ea60fa788,
      'Description', p_Description_509ea60fa788
    ));
    ELSE
      PERFORM ${mjSchema}."spCreateAuthorization"(p_ID := p_ID_509ea60fa788, p_ParentID := p_ParentID_509ea60fa788, p_ParentID_Clear := TRUE, p_Name := p_Name_509ea60fa788, p_IsActive := p_IsActive_509ea60fa788, p_UseAuditLog := p_UseAuditLog_509ea60fa788, p_Description := p_Description_509ea60fa788);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Authorizations (core SP call only)
DO $mj$
DECLARE
  p_ID_2d66d8a59c8b UUID;
  p_ParentID_2d66d8a59c8b UUID;
  p_Name_2d66d8a59c8b VARCHAR(100);
  p_IsActive_2d66d8a59c8b BOOLEAN;
  p_UseAuditLog_2d66d8a59c8b BOOLEAN;
  p_Description_2d66d8a59c8b TEXT;
BEGIN
  p_ID_2d66d8a59c8b := '9CD9E6CA-55BA-477E-9383-ED2846FA88C8';
  p_Name_2d66d8a59c8b := 'MJ.BizApps.Accounting.FinanceExceptions.ClearType.PRICE_BELOW_ENGINE_UNAPPROVED';
  p_IsActive_2d66d8a59c8b := TRUE;
  p_UseAuditLog_2d66d8a59c8b := TRUE;
  p_Description_2d66d8a59c8b := 'Who may clear PRICE_BELOW_ENGINE_UNAPPROVED finance exceptions through Accounting.ClearFinanceException. Shipped granted to no role, which leaves the type under MJ.BizApps.Accounting.FinanceExceptions.Clear. Once any role is granted it (Allow), only its holders may clear this type, and holding MJ.BizApps.Accounting.FinanceExceptions.Clear no longer does. Checked as a direct grant: it has no parent. The source record''s creator is still refused, and an unattributed or escalated creator is decided by MJ.BizApps.Accounting.FinanceExceptions.ClearUnattributed / MJ.BizApps.Accounting.FinanceExceptions.ClearEscalated when those are granted.';
  IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."Authorization"
               WHERE "ID" = p_ID_2d66d8a59c8b
                  OR ("Name" = p_Name_2d66d8a59c8b)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateAuthorization'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM ${mjSchema}."spCreateAuthorization"(p_data := jsonb_build_object(
      'ID', p_ID_2d66d8a59c8b,
      'ParentID', p_ParentID_2d66d8a59c8b,
      'Name', p_Name_2d66d8a59c8b,
      'IsActive', p_IsActive_2d66d8a59c8b,
      'UseAuditLog', p_UseAuditLog_2d66d8a59c8b,
      'Description', p_Description_2d66d8a59c8b
    ));
    ELSE
      PERFORM ${mjSchema}."spCreateAuthorization"(p_ID := p_ID_2d66d8a59c8b, p_ParentID := p_ParentID_2d66d8a59c8b, p_ParentID_Clear := TRUE, p_Name := p_Name_2d66d8a59c8b, p_IsActive := p_IsActive_2d66d8a59c8b, p_UseAuditLog := p_UseAuditLog_2d66d8a59c8b, p_Description := p_Description_2d66d8a59c8b);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Authorizations (core SP call only)
DO $mj$
DECLARE
  p_ID_0293a34d3d17 UUID;
  p_ParentID_0293a34d3d17 UUID;
  p_Name_0293a34d3d17 VARCHAR(100);
  p_IsActive_0293a34d3d17 BOOLEAN;
  p_UseAuditLog_0293a34d3d17 BOOLEAN;
  p_Description_0293a34d3d17 TEXT;
BEGIN
  p_ID_0293a34d3d17 := '3118412C-8B4E-43E8-9CB2-FAAB85DC138D';
  p_Name_0293a34d3d17 := 'MJ.BizApps.Accounting.FinanceExceptions.ClearUnattributed';
  p_IsActive_0293a34d3d17 := TRUE;
  p_UseAuditLog_0293a34d3d17 := TRUE;
  p_Description_0293a34d3d17 := 'Who may clear a finance exception whose source record has no attributable creator: CreatorUnresolved is set, or the creator is the MJ system user (a renewal job, conversion or import). Shipped granted to no role, which keeps the original rules: an unresolved creator is refused until the login is linked, and a system-created record follows its type. Once granted (Allow), only its holders may clear those exceptions, whatever their type. Checked as a direct grant.';
  IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."Authorization"
               WHERE "ID" = p_ID_0293a34d3d17
                  OR ("Name" = p_Name_0293a34d3d17)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateAuthorization'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM ${mjSchema}."spCreateAuthorization"(p_data := jsonb_build_object(
      'ID', p_ID_0293a34d3d17,
      'ParentID', p_ParentID_0293a34d3d17,
      'Name', p_Name_0293a34d3d17,
      'IsActive', p_IsActive_0293a34d3d17,
      'UseAuditLog', p_UseAuditLog_0293a34d3d17,
      'Description', p_Description_0293a34d3d17
    ));
    ELSE
      PERFORM ${mjSchema}."spCreateAuthorization"(p_ID := p_ID_0293a34d3d17, p_ParentID := p_ParentID_0293a34d3d17, p_ParentID_Clear := TRUE, p_Name := p_Name_0293a34d3d17, p_IsActive := p_IsActive_0293a34d3d17, p_UseAuditLog := p_UseAuditLog_0293a34d3d17, p_Description := p_Description_0293a34d3d17);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Authorizations (core SP call only)
DO $mj$
DECLARE
  p_ID_51963c7c16f3 UUID;
  p_ParentID_51963c7c16f3 UUID;
  p_Name_51963c7c16f3 VARCHAR(100);
  p_IsActive_51963c7c16f3 BOOLEAN;
  p_UseAuditLog_51963c7c16f3 BOOLEAN;
  p_Description_51963c7c16f3 TEXT;
BEGIN
  p_ID_51963c7c16f3 := 'EFF34891-7228-4B2D-B32C-07920D22A407';
  p_Name_51963c7c16f3 := 'MJ.BizApps.Accounting.FinanceExceptions.EscalatedCreator';
  p_IsActive_51963c7c16f3 := TRUE;
  p_UseAuditLog_51963c7c16f3 := FALSE;
  p_Description_51963c7c16f3 := 'A marker, not a permission: grant it to the roles whose own work must be reviewed one level up. A finance exception on a source record created by a holder is cleared only by a holder of MJ.BizApps.Accounting.FinanceExceptions.ClearEscalated, whatever its type. Takes effect only while both this and MJ.BizApps.Accounting.FinanceExceptions.ClearEscalated are granted to some role. A creator the user cache does not know is treated as a holder.';
  IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."Authorization"
               WHERE "ID" = p_ID_51963c7c16f3
                  OR ("Name" = p_Name_51963c7c16f3)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateAuthorization'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM ${mjSchema}."spCreateAuthorization"(p_data := jsonb_build_object(
      'ID', p_ID_51963c7c16f3,
      'ParentID', p_ParentID_51963c7c16f3,
      'Name', p_Name_51963c7c16f3,
      'IsActive', p_IsActive_51963c7c16f3,
      'UseAuditLog', p_UseAuditLog_51963c7c16f3,
      'Description', p_Description_51963c7c16f3
    ));
    ELSE
      PERFORM ${mjSchema}."spCreateAuthorization"(p_ID := p_ID_51963c7c16f3, p_ParentID := p_ParentID_51963c7c16f3, p_ParentID_Clear := TRUE, p_Name := p_Name_51963c7c16f3, p_IsActive := p_IsActive_51963c7c16f3, p_UseAuditLog := p_UseAuditLog_51963c7c16f3, p_Description := p_Description_51963c7c16f3);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Authorizations (core SP call only)
DO $mj$
DECLARE
  p_ID_d280968d78dc UUID;
  p_ParentID_d280968d78dc UUID;
  p_Name_d280968d78dc VARCHAR(100);
  p_IsActive_d280968d78dc BOOLEAN;
  p_UseAuditLog_d280968d78dc BOOLEAN;
  p_Description_d280968d78dc TEXT;
BEGIN
  p_ID_d280968d78dc := '1F99A6A5-D421-4B74-8A78-DD205E65779D';
  p_Name_d280968d78dc := 'MJ.BizApps.Accounting.FinanceExceptions.ClearEscalated';
  p_IsActive_d280968d78dc := TRUE;
  p_UseAuditLog_d280968d78dc := TRUE;
  p_Description_d280968d78dc := 'Who may clear a finance exception on a source record created by a holder of MJ.BizApps.Accounting.FinanceExceptions.EscalatedCreator. Shipped granted to no role (escalation off). Checked as a direct grant.';
  IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."Authorization"
               WHERE "ID" = p_ID_d280968d78dc
                  OR ("Name" = p_Name_d280968d78dc)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateAuthorization'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM ${mjSchema}."spCreateAuthorization"(p_data := jsonb_build_object(
      'ID', p_ID_d280968d78dc,
      'ParentID', p_ParentID_d280968d78dc,
      'Name', p_Name_d280968d78dc,
      'IsActive', p_IsActive_d280968d78dc,
      'UseAuditLog', p_UseAuditLog_d280968d78dc,
      'Description', p_Description_d280968d78dc
    ));
    ELSE
      PERFORM ${mjSchema}."spCreateAuthorization"(p_ID := p_ID_d280968d78dc, p_ParentID := p_ParentID_d280968d78dc, p_ParentID_Clear := TRUE, p_Name := p_Name_d280968d78dc, p_IsActive := p_IsActive_d280968d78dc, p_UseAuditLog := p_UseAuditLog_d280968d78dc, p_Description := p_Description_d280968d78dc);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Authorizations (core SP call only)
DO $mj$
DECLARE
  p_ParentID_201b61c280c7 UUID;
  p_Name_201b61c280c7 VARCHAR(100);
  p_IsActive_201b61c280c7 BOOLEAN;
  p_UseAuditLog_201b61c280c7 BOOLEAN;
  p_Description_201b61c280c7 TEXT;
  p_ID_201b61c280c7 UUID;
BEGIN
  p_Name_201b61c280c7 := 'MJ.BizApps.Accounting.FinanceExceptions.Clear';
  p_IsActive_201b61c280c7 := TRUE;
  p_UseAuditLog_201b61c280c7 := TRUE;
  p_Description_201b61c280c7 := 'Clear an Open finance exception as Reviewed or Corrected through Accounting.ClearFinanceException. Held by the Finance role. The default right: it decides only for a type whose MJ.BizApps.Accounting.FinanceExceptions.ClearType.<CODE> right is granted to no role, and only when the creator is not unattributed or escalated under a granted ClearUnattributed / EscalatedCreator + ClearEscalated right. The operation still refuses the source record''s creator, so holding this does not let anyone clear an exception raised on their own work.';
  p_ID_201b61c280c7 := '6C8AB53F-B37E-43A2-B18F-C11EDE2CC2E6';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateAuthorization'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM ${mjSchema}."spUpdateAuthorization"(p_data := jsonb_build_object(
    'ParentID', p_ParentID_201b61c280c7,
    'Name', p_Name_201b61c280c7,
    'IsActive', p_IsActive_201b61c280c7,
    'UseAuditLog', p_UseAuditLog_201b61c280c7,
    'Description', p_Description_201b61c280c7,
    'ID', p_ID_201b61c280c7
  ));
  ELSE
    PERFORM ${mjSchema}."spUpdateAuthorization"(p_ParentID := p_ParentID_201b61c280c7, p_ParentID_Clear := TRUE, p_Name := p_Name_201b61c280c7, p_IsActive := p_IsActive_201b61c280c7, p_UseAuditLog := p_UseAuditLog_201b61c280c7, p_Description := p_Description_201b61c280c7, p_ID := p_ID_201b61c280c7);
  END IF;
END $mj$;

-- Save MJ: Authorizations (core SP call only)
DO $mj$
DECLARE
  p_ID_88b678165115 UUID;
  p_ParentID_88b678165115 UUID;
  p_Name_88b678165115 VARCHAR(100);
  p_IsActive_88b678165115 BOOLEAN;
  p_UseAuditLog_88b678165115 BOOLEAN;
  p_Description_88b678165115 TEXT;
BEGIN
  p_ID_88b678165115 := '96D18911-0436-4821-9CC5-78D841A32760';
  p_Name_88b678165115 := 'MJ.BizApps.Accounting.JournalEntryBatches.Operate';
  p_IsActive_88b678165115 := TRUE;
  p_UseAuditLog_88b678165115 := TRUE;
  p_Description_88b678165115 := 'Build, regenerate, dispatch or archive a journal entry batch through the Accounting.BuildJournalEntryBatch, RegenerateJournalEntryBatch, DispatchJournalEntryBatch and ArchiveJournalEntryBatch operations. Held by the Finance role. Archiving also requires the company''s configured approver (or, past approval, the batch''s approver), and dispatching still requires the batch''s approval.';
  IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."Authorization"
               WHERE "ID" = p_ID_88b678165115
                  OR ("Name" = p_Name_88b678165115)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateAuthorization'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM ${mjSchema}."spCreateAuthorization"(p_data := jsonb_build_object(
      'ID', p_ID_88b678165115,
      'ParentID', p_ParentID_88b678165115,
      'Name', p_Name_88b678165115,
      'IsActive', p_IsActive_88b678165115,
      'UseAuditLog', p_UseAuditLog_88b678165115,
      'Description', p_Description_88b678165115
    ));
    ELSE
      PERFORM ${mjSchema}."spCreateAuthorization"(p_ID := p_ID_88b678165115, p_ParentID := p_ParentID_88b678165115, p_ParentID_Clear := TRUE, p_Name := p_Name_88b678165115, p_IsActive := p_IsActive_88b678165115, p_UseAuditLog := p_UseAuditLog_88b678165115, p_Description := p_Description_88b678165115);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Authorization Roles (core SP call only)
DO $mj$
DECLARE
  p_ID_c8d97bc05ae3 UUID;
  p_AuthorizationID_c8d97bc05ae3 UUID;
  p_RoleID_c8d97bc05ae3 UUID;
  p_Type_c8d97bc05ae3 CHAR(10);
BEGIN
  p_ID_c8d97bc05ae3 := 'A9EBD6CF-6EF5-4B12-A4D0-1014C4F4689A';
  p_AuthorizationID_c8d97bc05ae3 := 'D6E5D7D7-2D25-4D40-A48E-4276B08F8728';
  p_RoleID_c8d97bc05ae3 := '76ABD76E-3FCE-474B-84B8-18F5188E2AB9';
  p_Type_c8d97bc05ae3 := 'Allow';
  p_AuthorizationID_c8d97bc05ae3 := COALESCE((SELECT "ID" FROM ${mjSchema}."Authorization" WHERE "Name" = 'MJ.BizApps.Accounting.BooksClosedThroughDate.Set' ORDER BY CASE WHEN "ID" = p_AuthorizationID_c8d97bc05ae3 THEN 0 ELSE 1 END LIMIT 1), p_AuthorizationID_c8d97bc05ae3);
  p_RoleID_c8d97bc05ae3 := COALESCE((SELECT "ID" FROM ${mjSchema}."Role" WHERE "Name" = 'Finance' ORDER BY CASE WHEN "ID" = p_RoleID_c8d97bc05ae3 THEN 0 ELSE 1 END LIMIT 1), p_RoleID_c8d97bc05ae3);
  IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."AuthorizationRole"
               WHERE "ID" = p_ID_c8d97bc05ae3
                  OR ("AuthorizationID" = p_AuthorizationID_c8d97bc05ae3 AND "RoleID" = p_RoleID_c8d97bc05ae3)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateAuthorizationRole'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM ${mjSchema}."spCreateAuthorizationRole"(p_data := jsonb_build_object(
      'ID', p_ID_c8d97bc05ae3,
      'AuthorizationID', p_AuthorizationID_c8d97bc05ae3,
      'RoleID', p_RoleID_c8d97bc05ae3,
      'Type', p_Type_c8d97bc05ae3
    ));
    ELSE
      PERFORM ${mjSchema}."spCreateAuthorizationRole"(p_ID := p_ID_c8d97bc05ae3, p_AuthorizationID := p_AuthorizationID_c8d97bc05ae3, p_RoleID := p_RoleID_c8d97bc05ae3, p_Type := p_Type_c8d97bc05ae3);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Authorization Roles (core SP call only)
DO $mj$
DECLARE
  p_ID_2632fa840b0d UUID;
  p_AuthorizationID_2632fa840b0d UUID;
  p_RoleID_2632fa840b0d UUID;
  p_Type_2632fa840b0d CHAR(10);
BEGIN
  p_ID_2632fa840b0d := 'CEA898E5-DF81-413B-A46F-FAA50FCB1059';
  p_AuthorizationID_2632fa840b0d := '96D18911-0436-4821-9CC5-78D841A32760';
  p_RoleID_2632fa840b0d := '76ABD76E-3FCE-474B-84B8-18F5188E2AB9';
  p_Type_2632fa840b0d := 'Allow';
  p_AuthorizationID_2632fa840b0d := COALESCE((SELECT "ID" FROM ${mjSchema}."Authorization" WHERE "Name" = 'MJ.BizApps.Accounting.JournalEntryBatches.Operate' ORDER BY CASE WHEN "ID" = p_AuthorizationID_2632fa840b0d THEN 0 ELSE 1 END LIMIT 1), p_AuthorizationID_2632fa840b0d);
  p_RoleID_2632fa840b0d := COALESCE((SELECT "ID" FROM ${mjSchema}."Role" WHERE "Name" = 'Finance' ORDER BY CASE WHEN "ID" = p_RoleID_2632fa840b0d THEN 0 ELSE 1 END LIMIT 1), p_RoleID_2632fa840b0d);
  IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."AuthorizationRole"
               WHERE "ID" = p_ID_2632fa840b0d
                  OR ("AuthorizationID" = p_AuthorizationID_2632fa840b0d AND "RoleID" = p_RoleID_2632fa840b0d)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateAuthorizationRole'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM ${mjSchema}."spCreateAuthorizationRole"(p_data := jsonb_build_object(
      'ID', p_ID_2632fa840b0d,
      'AuthorizationID', p_AuthorizationID_2632fa840b0d,
      'RoleID', p_RoleID_2632fa840b0d,
      'Type', p_Type_2632fa840b0d
    ));
    ELSE
      PERFORM ${mjSchema}."spCreateAuthorizationRole"(p_ID := p_ID_2632fa840b0d, p_AuthorizationID := p_AuthorizationID_2632fa840b0d, p_RoleID := p_RoleID_2632fa840b0d, p_Type := p_Type_2632fa840b0d);
    END IF;
  END IF;
END $mj$;
