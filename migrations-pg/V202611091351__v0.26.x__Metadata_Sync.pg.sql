-- =============================================================================================
-- PostgreSQL counterpart of V202611091351__v0.26.x__Metadata_Sync.sql
-- =============================================================================================
-- Same records, same values, same order as the T-SQL file; see its header for what ships, what is
-- held back, and why.
--
-- HOW IT WAS MADE
--   * `mj sql-convert --from tsql --to postgres` (MJ CLI 6.1.6) on the push log the T-SQL file was
--     generated from, held-back records removed as in the T-SQL file. Each record is a DO block that
--     calls the function in whichever signature the host has (jsonb or named parameters).
--   * The converter does not translate the lookups and guards the T-SQL file adds, so they are
--     written here by hand from the T-SQL ones, block for block:
--       - SELECT TOP 1 @x = [ID] ... ORDER BY ... becomes
--         p_x := COALESCE((SELECT "ID" ... ORDER BY ... LIMIT 1), p_x), which keeps the literal
--         ID when nothing matches, as the T-SQL assignment does.
--       - IF <guard> EXEC ... becomes IF <guard> THEN <call> END IF.
--   * Core calls use ${mjSchema}; signature checks name this app's schema in lowercase, as
--     PostgreSQL stores it.
--   * Every string value is taken verbatim from the T-SQL file.
-- =============================================================================================

-- Save MJ: Applications (core SP call only)
DO $mj$
DECLARE
  p_Name_8602735ca0ab VARCHAR(100);
  p_Description_8602735ca0ab TEXT;
  p_Icon_8602735ca0ab VARCHAR(500);
  p_DefaultForNewUser_8602735ca0ab BOOLEAN;
  p_SchemaAutoAddNewEntities_8602735ca0ab TEXT;
  p_Color_8602735ca0ab VARCHAR(20);
  p_DefaultNavItems_8602735ca0ab TEXT;
  p_ClassName_8602735ca0ab VARCHAR(255);
  p_DefaultSequence_8602735ca0ab INTEGER;
  p_Status_8602735ca0ab VARCHAR(20);
  p_NavigationStyle_8602735ca0ab VARCHAR(20);
  p_TopNavLocation_8602735ca0ab VARCHAR(30);
  p_HideNavBarIconWhenActive_8602735ca0ab BOOLEAN;
  p_Path_8602735ca0ab VARCHAR(100);
  p_AutoUpdatePath_8602735ca0ab BOOLEAN;
  p_AgentSettings_8602735ca0ab TEXT;
  p_ID_8602735ca0ab UUID;
BEGIN
  p_Name_8602735ca0ab := 'Accounting';
  p_Description_8602735ca0ab := 'AR subledger, journal entries, and JE batch dispatch to the ERP';
  p_Icon_8602735ca0ab := 'fa-solid fa-book';
  p_DefaultForNewUser_8602735ca0ab := TRUE;
  p_Color_8602735ca0ab := '#0076b6';
  p_DefaultNavItems_8602735ca0ab := '[
  {
    "Label": "Overview",
    "Icon": "fa-solid fa-gauge-high",
    "ResourceType": "Custom",
    "DriverClass": "AccountingOverviewResource",
    "isDefault": true
  },
  {
    "Label": "Batches",
    "Icon": "fa-solid fa-layer-group",
    "ResourceType": "Custom",
    "DriverClass": "BatchesResource",
    "isDefault": false
  },
  {
    "Label": "Periods",
    "Icon": "fa-solid fa-calendar-check",
    "ResourceType": "Custom",
    "DriverClass": "PeriodsResource",
    "isDefault": false
  }
]';
  p_DefaultSequence_8602735ca0ab := 2010;
  p_Status_8602735ca0ab := 'Active';
  p_NavigationStyle_8602735ca0ab := 'App Switcher';
  p_HideNavBarIconWhenActive_8602735ca0ab := FALSE;
  p_Path_8602735ca0ab := 'accounting';
  p_AutoUpdatePath_8602735ca0ab := TRUE;
  p_ID_8602735ca0ab := '08BC1CF8-7BBE-4798-A933-091BD87547BC';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateApplication'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateApplication"(p_data := jsonb_build_object(
    'Name', p_Name_8602735ca0ab,
    'Description', p_Description_8602735ca0ab,
    'Icon', p_Icon_8602735ca0ab,
    'DefaultForNewUser', p_DefaultForNewUser_8602735ca0ab,
    'SchemaAutoAddNewEntities', p_SchemaAutoAddNewEntities_8602735ca0ab,
    'Color', p_Color_8602735ca0ab,
    'DefaultNavItems', p_DefaultNavItems_8602735ca0ab,
    'ClassName', p_ClassName_8602735ca0ab,
    'DefaultSequence', p_DefaultSequence_8602735ca0ab,
    'Status', p_Status_8602735ca0ab,
    'NavigationStyle', p_NavigationStyle_8602735ca0ab,
    'TopNavLocation', p_TopNavLocation_8602735ca0ab,
    'HideNavBarIconWhenActive', p_HideNavBarIconWhenActive_8602735ca0ab,
    'Path', p_Path_8602735ca0ab,
    'AutoUpdatePath', p_AutoUpdatePath_8602735ca0ab,
    'AgentSettings', p_AgentSettings_8602735ca0ab,
    'ID', p_ID_8602735ca0ab
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateApplication"(p_Name := p_Name_8602735ca0ab, p_Description := p_Description_8602735ca0ab, p_Icon := p_Icon_8602735ca0ab, p_DefaultForNewUser := p_DefaultForNewUser_8602735ca0ab, p_SchemaAutoAddNewEntities := p_SchemaAutoAddNewEntities_8602735ca0ab, p_SchemaAutoAddNewEntities_Clear := TRUE, p_Color := p_Color_8602735ca0ab, p_DefaultNavItems := p_DefaultNavItems_8602735ca0ab, p_ClassName := p_ClassName_8602735ca0ab, p_ClassName_Clear := TRUE, p_DefaultSequence := p_DefaultSequence_8602735ca0ab, p_Status := p_Status_8602735ca0ab, p_NavigationStyle := p_NavigationStyle_8602735ca0ab, p_TopNavLocation := p_TopNavLocation_8602735ca0ab, p_TopNavLocation_Clear := TRUE, p_HideNavBarIconWhenActive := p_HideNavBarIconWhenActive_8602735ca0ab, p_Path := p_Path_8602735ca0ab, p_AutoUpdatePath := p_AutoUpdatePath_8602735ca0ab, p_AgentSettings := p_AgentSettings_8602735ca0ab, p_AgentSettings_Clear := TRUE, p_ID := p_ID_8602735ca0ab);
  END IF;
END $mj$;

-- Save MJ: Authorizations (core SP call only)
DO $mj$
DECLARE
  p_ParentID_88b678165115 UUID;
  p_Name_88b678165115 VARCHAR(100);
  p_IsActive_88b678165115 BOOLEAN;
  p_UseAuditLog_88b678165115 BOOLEAN;
  p_Description_88b678165115 TEXT;
  p_ID_88b678165115 UUID;
BEGIN
  p_Name_88b678165115 := 'MJ.BizApps.Accounting.JournalEntryBatches.Operate';
  p_IsActive_88b678165115 := TRUE;
  p_UseAuditLog_88b678165115 := TRUE;
  p_Description_88b678165115 := 'Build, regenerate, dispatch or archive a journal entry batch through the Accounting.BuildJournalEntryBatch, RegenerateJournalEntryBatch, DispatchJournalEntryBatch and ArchiveJournalEntryBatch operations, and correct the date of Pending, unbatched entries through Accounting.RedatePendingJournalEntries. Held by the Finance role. Archiving also requires the company''s configured approver (or, past approval, the batch''s approver), and dispatching still requires the batch''s approval.';
  p_ID_88b678165115 := '96D18911-0436-4821-9CC5-78D841A32760';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateAuthorization'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateAuthorization"(p_data := jsonb_build_object(
    'ParentID', p_ParentID_88b678165115,
    'Name', p_Name_88b678165115,
    'IsActive', p_IsActive_88b678165115,
    'UseAuditLog', p_UseAuditLog_88b678165115,
    'Description', p_Description_88b678165115,
    'ID', p_ID_88b678165115
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateAuthorization"(p_ParentID := p_ParentID_88b678165115, p_ParentID_Clear := TRUE, p_Name := p_Name_88b678165115, p_IsActive := p_IsActive_88b678165115, p_UseAuditLog := p_UseAuditLog_88b678165115, p_Description := p_Description_88b678165115, p_ID := p_ID_88b678165115);
  END IF;
END $mj$;

-- Save MJ: Authorizations (core SP call only)
DO $mj$
DECLARE
  p_ID_ec87c247c61c UUID;
  p_ParentID_ec87c247c61c UUID;
  p_Name_ec87c247c61c VARCHAR(100);
  p_IsActive_ec87c247c61c BOOLEAN;
  p_UseAuditLog_ec87c247c61c BOOLEAN;
  p_Description_ec87c247c61c TEXT;
BEGIN
  p_ID_ec87c247c61c := '039A20CB-D70D-4C4C-8212-68B8FE12DA33';
  p_Name_ec87c247c61c := 'MJ.BizApps.Accounting.PostingStartDate.Set';
  p_IsActive_ec87c247c61c := TRUE;
  p_UseAuditLog_ec87c247c61c := TRUE;
  p_Description_ec87c247c61c := 'Set, move or clear a company''s PostingStartDate on its Accounting Company Profile: moving it earlier puts the journal entries dated before it into batches, moving it later holds them back. Held by the Finance role. Every change is kept in the profile''s record-change history.';
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."Authorization"
               WHERE "ID" = p_ID_ec87c247c61c
                  OR "Name" = p_Name_ec87c247c61c) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateAuthorization'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateAuthorization"(p_data := jsonb_build_object(
      'ID', p_ID_ec87c247c61c,
      'ParentID', p_ParentID_ec87c247c61c,
      'Name', p_Name_ec87c247c61c,
      'IsActive', p_IsActive_ec87c247c61c,
      'UseAuditLog', p_UseAuditLog_ec87c247c61c,
      'Description', p_Description_ec87c247c61c
    ));
    ELSE
      PERFORM "${mjSchema}"."spCreateAuthorization"(p_ID := p_ID_ec87c247c61c, p_ParentID := p_ParentID_ec87c247c61c, p_ParentID_Clear := TRUE, p_Name := p_Name_ec87c247c61c, p_IsActive := p_IsActive_ec87c247c61c, p_UseAuditLog := p_UseAuditLog_ec87c247c61c, p_Description := p_Description_ec87c247c61c);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Authorization Roles (core SP call only)
DO $mj$
DECLARE
  p_ID_166b9891ce1a UUID;
  p_AuthorizationID_166b9891ce1a UUID;
  p_RoleID_166b9891ce1a UUID;
  p_Type_166b9891ce1a CHAR(10);
BEGIN
  p_ID_166b9891ce1a := 'A7EB8C8F-8232-40F2-A5DB-D940BCB49715';
  p_AuthorizationID_166b9891ce1a := '039A20CB-D70D-4C4C-8212-68B8FE12DA33';
  p_RoleID_166b9891ce1a := '76ABD76E-3FCE-474B-84B8-18F5188E2AB9';
  p_Type_166b9891ce1a := 'Allow';
  p_RoleID_166b9891ce1a := COALESCE((SELECT "ID" FROM "${mjSchema}"."Role" WHERE "Name" = 'Finance' ORDER BY CASE WHEN "ID" = p_RoleID_166b9891ce1a THEN 0 ELSE 1 END LIMIT 1), p_RoleID_166b9891ce1a);
  p_AuthorizationID_166b9891ce1a := COALESCE((SELECT "ID" FROM "${mjSchema}"."Authorization" WHERE "Name" = 'MJ.BizApps.Accounting.PostingStartDate.Set' ORDER BY CASE WHEN "ID" = p_AuthorizationID_166b9891ce1a THEN 0 ELSE 1 END LIMIT 1), p_AuthorizationID_166b9891ce1a);
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."AuthorizationRole"
               WHERE "ID" = p_ID_166b9891ce1a
                  OR ("AuthorizationID" = p_AuthorizationID_166b9891ce1a AND "RoleID" = p_RoleID_166b9891ce1a)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateAuthorizationRole'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateAuthorizationRole"(p_data := jsonb_build_object(
      'ID', p_ID_166b9891ce1a,
      'AuthorizationID', p_AuthorizationID_166b9891ce1a,
      'RoleID', p_RoleID_166b9891ce1a,
      'Type', p_Type_166b9891ce1a
    ));
    ELSE
      PERFORM "${mjSchema}"."spCreateAuthorizationRole"(p_ID := p_ID_166b9891ce1a, p_AuthorizationID := p_AuthorizationID_166b9891ce1a, p_RoleID := p_RoleID_166b9891ce1a, p_Type := p_Type_166b9891ce1a);
    END IF;
  END IF;
END $mj$;
