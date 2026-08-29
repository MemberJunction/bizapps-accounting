-- ============================================================================
-- MemberJunction PostgreSQL Migration
-- Converted from SQL Server using TypeScript conversion pipeline
-- ============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Schema
--
-- The schema name is emitted UNQUOTED, so PostgreSQL folds it to lowercase. That is deliberate and
-- self-consistent: everything downstream in a converted migration refers to it unquoted too, so
-- both definition and lookup land on the same folded name.
--
-- DOWNSTREAM NOTE for the build engineer: a PostgreSQL database that was populated by an EARLIER
-- converter — one that emitted a quoted, case-preserved name — already holds that mixed-case
-- schema: for a target named MySchema_Name, the quoted "MySchema_Name". Re-converting against
-- that database creates a SECOND, empty schema myschema_name rather than reusing the existing
-- one, because IF NOT EXISTS compares the folded name and finds no match. The repo's own committed
-- migrations-pg files are unaffected (the only quoted CREATE SCHEMAs there are the four pg_dump
-- baselines, which this path does not produce), so this is an open-app / downstream concern, not
-- one for this repo's Flyway history.
CREATE SCHEMA IF NOT EXISTS __mj_BizAppsAccounting;
SET search_path TO __mj_BizAppsAccounting, public;

-- Ensure backslashes in string literals are treated literally (not as escape sequences)
SET standard_conforming_strings = on;

-- NOTE: Earlier converter versions made INTEGER to BOOLEAN cast implicit by
-- modifying the system catalog so SS-style INSERT INTO bool_col VALUES (1)
-- would work. That modification required pg_catalog write privileges, which
-- managed PG (RDS, Aurora, Cloud SQL, Azure) does not grant. As of v5.30 all
-- bulk INSERTs are emitted with native TRUE/FALSE values directly, so the
-- cast modification is no longer needed. Removed to support managed-PG
-- installs out of the box.


-- ===================== DDL: Tables, PKs, Indexes =====================

-- =============================================================================
-- Migration: V202608292100__v0.1.x__AccountingEngineExtension.sql
-- Description: Accounting engine extension registry + Configuration JSON bag
-- =============================================================================
--
-- Design: plans/erp-provider-layer.md (Rev 2)
-- Wave: MJ verbs → this table + AccountingERPEngine → FP&A ImportBankAccountBalances
--
-- WHY
--
-- AccountingERPEngine invokes other Open Apps around engine verbs (SyncMasterData,
-- PostJournalBatch, later others). ClassFactory finds the implementation
-- (BaseAccountingEngineExtension subclass). This table is the host-visible
-- registry: enable/disable without a rebuild, run order, optional company scope,
-- and a JSON Configuration bag.
--
-- Hook participation is NOT columns and NOT Configuration. It lives on the class:
-- getters (RunAfterSyncMasterData, …) default false; Before/After methods are
-- no-ops the subclass overrides. Adding a hook does not require a migration.
--
-- Accounting does NOT seed any extension. FP&A (and later payroll, expense)
-- inserts its own row. Accounting does not know CashBalance.
--
-- ERP provider plugins are NOT rows here. They remain @RegisterClass on
-- BaseAccountingERPProvider.
--
-- Deterministic new-object V. No IF OBJECT_ID / IF NOT EXISTS / IF COL_LENGTH.
-- No __mj_CreatedAt / __mj_UpdatedAt (CodeGen). No FK indexes (CodeGen).
-- =============================================================================


CREATE TABLE __mj_BizAppsAccounting."AccountingEngineExtension" (
 "ID" UUID NOT NULL DEFAULT gen_random_uuid(),
 "Code" VARCHAR(80) NOT NULL,
 "Name" VARCHAR(200) NOT NULL,
 "Description" TEXT NULL,
 "DriverClass" VARCHAR(255) NOT NULL,
 "Status" VARCHAR(20) NOT NULL DEFAULT 'Active',
 "Sequence" INTEGER NOT NULL DEFAULT 0,
 "CompanyID" UUID NULL,
 "Configuration" TEXT NULL,
 CONSTRAINT "PK_AccountingEngineExtension" PRIMARY KEY ("ID"),
 CONSTRAINT "UQ_AccountingEngineExtension_Code" UNIQUE ("Code"),
 CONSTRAINT "CK_AccountingEngineExtension_Status" CHECK ("Status" IN ('Active', 'Disabled')),
 CONSTRAINT "CK_AccountingEngineExtension_Configuration" CHECK (
 "Configuration" IS NULL OR ("Configuration") IS JSON
 ),
 CONSTRAINT "FK_AccountingEngineExtension_Company"
 FOREIGN KEY ("CompanyID") REFERENCES __mj."Company"("ID")
);

ALTER TABLE __mj_BizAppsAccounting."AccountingEngineExtension"
 ADD COLUMN IF NOT EXISTS "__mj_CreatedAt" TIMESTAMPTZ NULL;

/* SQL text to add special date field __mj_UpdatedAt to entity __mj_BizAppsAccounting.AccountingEngineExtension */
ALTER TABLE __mj_BizAppsAccounting."AccountingEngineExtension"
 ADD COLUMN IF NOT EXISTS "__mj_UpdatedAt" TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_AccountingEngineExtension_CompanyID" ON __mj_BizAppsAccounting."AccountingEngineExtension" ("CompanyID");


-- ===================== Views =====================

DO $do$
DECLARE
  v_target_schema CONSTANT TEXT := '__mj_BizAppsAccounting';
  v_target_name CONSTANT TEXT := 'vwAccountingEngineExtensions';
  vsql CONSTANT TEXT := $vsql$CREATE OR REPLACE VIEW __mj_BizAppsAccounting."vwAccountingEngineExtensions"
AS SELECT
    a.*,
    "MJCompany_CompanyID"."Name" AS "Company"
FROM
    __mj_BizAppsAccounting."AccountingEngineExtension" AS a
LEFT OUTER JOIN
    ${mjSchema}."Company" AS "MJCompany_CompanyID"
  ON
    a."CompanyID" = "MJCompany_CompanyID"."ID"$vsql$;
  v_target_oid OID;
  v_dep RECORD;
  v_captured JSONB[] := ARRAY[]::JSONB[];
  v_n INTEGER;
BEGIN
  EXECUTE vsql;
EXCEPTION WHEN invalid_table_definition THEN
  -- Column list changed; need CASCADE. Preserve dependent views first.
  SELECT c.oid INTO v_target_oid
  FROM pg_class c JOIN pg_namespace n ON c.relnamespace = n.oid
  WHERE n.nspname = v_target_schema AND c.relname = v_target_name AND c.relkind = 'v';
  IF v_target_oid IS NOT NULL THEN
    FOR v_dep IN
      WITH RECURSIVE deps AS (
        SELECT c.oid, c.relname AS name, n.nspname AS schema, 1 AS depth
        FROM pg_rewrite r
        JOIN pg_depend d ON d.objid = r.oid
        JOIN pg_class c ON c.oid = r.ev_class
        JOIN pg_namespace n ON c.relnamespace = n.oid
        WHERE d.refobjid = v_target_oid AND d.deptype = 'n'
          AND c.oid <> v_target_oid AND c.relkind = 'v'
        UNION
        SELECT c.oid, c.relname, n.nspname, p.depth + 1
        FROM deps p
        JOIN pg_rewrite r ON TRUE
        JOIN pg_depend d ON d.objid = r.oid AND d.refobjid = p.oid
        JOIN pg_class c ON c.oid = r.ev_class
        JOIN pg_namespace n ON c.relnamespace = n.oid
        WHERE c.relkind = 'v' AND c.oid <> p.oid
      )
      SELECT oid, name, schema, MAX(depth) AS max_depth,
             pg_catalog.pg_get_viewdef(oid, true) AS viewdef
      FROM deps GROUP BY oid, name, schema
      ORDER BY MAX(depth) ASC
    LOOP
      v_captured := v_captured || jsonb_build_object(
        'schema', v_dep.schema, 'name', v_dep.name, 'def', v_dep.viewdef);
    END LOOP;
  END IF;
  EXECUTE format('DROP VIEW IF EXISTS %I.%I CASCADE', v_target_schema, v_target_name);
  EXECUTE vsql;
  IF v_captured IS NOT NULL AND array_length(v_captured, 1) > 0 THEN
    FOR v_n IN 1..array_length(v_captured, 1) LOOP
      BEGIN
        EXECUTE format('CREATE VIEW %I.%I AS %s',
          v_captured[v_n]->>'schema', v_captured[v_n]->>'name', v_captured[v_n]->>'def');
      EXCEPTION WHEN others THEN
        RAISE WARNING 'Could not restore dependent view %.%: %',
          v_captured[v_n]->>'schema', v_captured[v_n]->>'name', SQLERRM;
      END;
    END LOOP;
  END IF;
END;
$do$;

DO $do$
DECLARE
  v_target_schema CONSTANT TEXT := '__mj_BizAppsAccounting';
  v_target_name CONSTANT TEXT := 'vwJournalEntries';
  vsql CONSTANT TEXT := $vsql$CREATE OR REPLACE VIEW __mj_BizAppsAccounting."vwJournalEntries"
AS SELECT
    j.*,
    "MJCompany_CompanyID"."Name" AS "Company",
    "mjBizAppsAccountingJournalEntryType_EntryTypeID"."Name" AS "EntryType",
    "MJEntity_LinkedEntityID"."Name" AS "LinkedEntity",
    "mjBizAppsAccountingJournalEntry_ReversesJournalEntryID"."EntryNumber" AS "ReversesJournalEntry",
    "mjBizAppsAccountingJournalEntry_ReversedByJournalEntryID"."EntryNumber" AS "ReversedByJournalEntry",
    "mjBizAppsAccountingJournalEntryBatch_JournalEntryBatchID"."JournalEntryBatchNumber" AS "JournalEntryBatch",
    "MJFile_FileID"."Name" AS "File"
FROM
    __mj_BizAppsAccounting."JournalEntry" AS j
INNER JOIN
    ${mjSchema}."Company" AS "MJCompany_CompanyID"
  ON
    j."CompanyID" = "MJCompany_CompanyID"."ID"
INNER JOIN
    __mj_BizAppsAccounting."JournalEntryType" AS "mjBizAppsAccountingJournalEntryType_EntryTypeID"
  ON
    j."EntryTypeID" = "mjBizAppsAccountingJournalEntryType_EntryTypeID"."ID"
LEFT OUTER JOIN
    ${mjSchema}."Entity" AS "MJEntity_LinkedEntityID"
  ON
    j."LinkedEntityID" = "MJEntity_LinkedEntityID"."ID"
LEFT OUTER JOIN
    __mj_BizAppsAccounting."JournalEntry" AS "mjBizAppsAccountingJournalEntry_ReversesJournalEntryID"
  ON
    j."ReversesJournalEntryID" = "mjBizAppsAccountingJournalEntry_ReversesJournalEntryID"."ID"
LEFT OUTER JOIN
    __mj_BizAppsAccounting."JournalEntry" AS "mjBizAppsAccountingJournalEntry_ReversedByJournalEntryID"
  ON
    j."ReversedByJournalEntryID" = "mjBizAppsAccountingJournalEntry_ReversedByJournalEntryID"."ID"
LEFT OUTER JOIN
    __mj_BizAppsAccounting."JournalEntryBatch" AS "mjBizAppsAccountingJournalEntryBatch_JournalEntryBatchID"
  ON
    j."JournalEntryBatchID" = "mjBizAppsAccountingJournalEntryBatch_JournalEntryBatchID"."ID"
LEFT OUTER JOIN
    ${mjSchema}."File" AS "MJFile_FileID"
  ON
    j."FileID" = "MJFile_FileID"."ID"$vsql$;
  v_target_oid OID;
  v_dep RECORD;
  v_captured JSONB[] := ARRAY[]::JSONB[];
  v_n INTEGER;
BEGIN
  EXECUTE vsql;
EXCEPTION WHEN invalid_table_definition THEN
  -- Column list changed; need CASCADE. Preserve dependent views first.
  SELECT c.oid INTO v_target_oid
  FROM pg_class c JOIN pg_namespace n ON c.relnamespace = n.oid
  WHERE n.nspname = v_target_schema AND c.relname = v_target_name AND c.relkind = 'v';
  IF v_target_oid IS NOT NULL THEN
    FOR v_dep IN
      WITH RECURSIVE deps AS (
        SELECT c.oid, c.relname AS name, n.nspname AS schema, 1 AS depth
        FROM pg_rewrite r
        JOIN pg_depend d ON d.objid = r.oid
        JOIN pg_class c ON c.oid = r.ev_class
        JOIN pg_namespace n ON c.relnamespace = n.oid
        WHERE d.refobjid = v_target_oid AND d.deptype = 'n'
          AND c.oid <> v_target_oid AND c.relkind = 'v'
        UNION
        SELECT c.oid, c.relname, n.nspname, p.depth + 1
        FROM deps p
        JOIN pg_rewrite r ON TRUE
        JOIN pg_depend d ON d.objid = r.oid AND d.refobjid = p.oid
        JOIN pg_class c ON c.oid = r.ev_class
        JOIN pg_namespace n ON c.relnamespace = n.oid
        WHERE c.relkind = 'v' AND c.oid <> p.oid
      )
      SELECT oid, name, schema, MAX(depth) AS max_depth,
             pg_catalog.pg_get_viewdef(oid, true) AS viewdef
      FROM deps GROUP BY oid, name, schema
      ORDER BY MAX(depth) ASC
    LOOP
      v_captured := v_captured || jsonb_build_object(
        'schema', v_dep.schema, 'name', v_dep.name, 'def', v_dep.viewdef);
    END LOOP;
  END IF;
  EXECUTE format('DROP VIEW IF EXISTS %I.%I CASCADE', v_target_schema, v_target_name);
  EXECUTE vsql;
  IF v_captured IS NOT NULL AND array_length(v_captured, 1) > 0 THEN
    FOR v_n IN 1..array_length(v_captured, 1) LOOP
      BEGIN
        EXECUTE format('CREATE VIEW %I.%I AS %s',
          v_captured[v_n]->>'schema', v_captured[v_n]->>'name', v_captured[v_n]->>'def');
      EXCEPTION WHEN others THEN
        RAISE WARNING 'Could not restore dependent view %.%: %',
          v_captured[v_n]->>'schema', v_captured[v_n]->>'name', SQLERRM;
      END;
    END LOOP;
  END IF;
END;
$do$;


-- ===================== Stored Procedures (sp*) =====================

-- SKIPPED: procedure (auto-conversion not supported)
-- CREATE PROCEDURE [__mj_BizAppsAccounting].[spCreateAccountingEngineExtension]
--     @ID UUID = NULL,
--     @Code VARCHAR(80),
--     @Name VARCHAR(200),
--     @Description_Clear bit = 0,
--     @Des...

-- SKIPPED: procedure (auto-conversion not supported)
-- CREATE PROCEDURE [__mj_BizAppsAccounting].[spUpdateAccountingEngineExtension]
--     @ID UUID,
--     @Code VARCHAR(80) = NULL,
--     @Name VARCHAR(200) = NULL,
--     @Description_Clear bit = 0,
--  ...

-- SKIPPED: procedure (auto-conversion not supported)
-- CREATE PROCEDURE [__mj_BizAppsAccounting].[spDeleteAccountingEngineExtension]
--     @ID UUID
-- AS
-- BEGIN
--     SET NOCOUNT ON;
-- 
--     DELETE FROM
--         [__mj_BizAppsAccounting].[AccountingEngineE...

-- SKIPPED: procedure (auto-conversion not supported)
-- CREATE PROCEDURE [__mj_BizAppsAccounting].[spCreateJournalEntry]
--     @ID UUID = NULL,
--     @EntryNumber VARCHAR(40),
--     @CompanyID UUID,
--     @EffectiveDate date,
--     @EntryTyp...

-- SKIPPED: procedure (auto-conversion not supported)
-- CREATE PROCEDURE [__mj_BizAppsAccounting].[spUpdateJournalEntry]
--     @ID UUID,
--     @EntryNumber VARCHAR(40) = NULL,
--     @CompanyID UUID = NULL,
--     @EffectiveDate date = NULL,...

-- SKIPPED: procedure (auto-conversion not supported)
-- CREATE PROCEDURE [__mj_BizAppsAccounting].[spDeleteJournalEntry]
--     @ID UUID
-- AS
-- BEGIN
--     SET NOCOUNT ON;
-- 
--     DELETE FROM
--         [__mj_BizAppsAccounting].[JournalEntry]
--     WHERE
--       ...


-- ===================== Triggers =====================

-- SKIPPED: trigger (auto-conversion not supported)
-- CREATE TRIGGER [__mj_BizAppsAccounting].trgUpdateAccountingEngineExtension
ON "__mj_BizAppsAccounting"."AccountingEngineExtension"
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        "__mj_Bi

-- SKIPPED: trigger (auto-conversion not supported)
-- CREATE TRIGGER [__mj_BizAppsAccounting".trgUpdateJournalEntry
ON "__mj_BizAppsAccounting"."JournalEntry"
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        "__mj_BizAppsAccounting".[JournalE


-- ===================== Data (INSERT/UPDATE/DELETE) =====================

INSERT INTO ${mjSchema}."Entity" (
         "ID",
         "Name",
         "DisplayName",
         "Description",
         "NameSuffix",
         "BaseTable",
         "BaseView",
         "SchemaName",
         "IncludeInAPI",
         "AllowUserSearchAPI",
         "AllowCaching"
         , "TrackRecordChanges"
         , "AuditRecordAccess"
         , "AuditViewRuns"
         , "AllowAllRowsAPI"
         , "AllowCreateAPI"
         , "AllowUpdateAPI"
         , "AllowDeleteAPI"
         , "UserViewMaxRows"
         , "__mj_CreatedAt"
         , "__mj_UpdatedAt"
      )
      VALUES (
         '17b0dc00-2fbb-475e-8da7-388570dadf0e',
         'MJ_BizApps_Accounting: Accounting Engine Extensions',
         'Accounting Engine Extensions',
         'Registry of extensions the Accounting engine invokes around its verbs (sync, post, later others). Other Open Apps insert a row and @RegisterClass a BaseAccountingEngineExtension. Status lets a host disable without a rebuild. Configuration is a JSON bag (IAccountingEngineExtensionConfiguration) for host-tunable parameters. Hook participation is on the class (getters + Before/After overrides), not columns. Empty in this app — consumers seed their own rows. Not the ERP provider plugin list.',
         NULL,
         'AccountingEngineExtension',
         'vwAccountingEngineExtensions',
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
         , NOW()
         , NOW()
      );

/* SQL generated to add new entity MJ_BizApps_Accounting: Accounting Engine Extensions to application ID: 'E609083D-D3E2-44AD-9DF3-CB833BEF381D' */

INSERT INTO ${mjSchema}."ApplicationEntity"
                                       ("ApplicationID", "EntityID", "Sequence", "__mj_CreatedAt", "__mj_UpdatedAt") VALUES
                                       ('E609083D-D3E2-44AD-9DF3-CB833BEF381D', '17b0dc00-2fbb-475e-8da7-388570dadf0e', (SELECT COALESCE(MAX("Sequence"),0)+1 FROM ${mjSchema}."ApplicationEntity" WHERE "ApplicationID" = 'E609083D-D3E2-44AD-9DF3-CB833BEF381D'), NOW(), NOW());

/* SQL generated to add new permission for entity MJ_BizApps_Accounting: Accounting Engine Extensions for role UI */

INSERT INTO ${mjSchema}."EntityPermission"
                                                   ("EntityID", "RoleID", "CanRead", "CanCreate", "CanUpdate", "CanDelete", "__mj_CreatedAt", "__mj_UpdatedAt") VALUES
                                                   ('17b0dc00-2fbb-475e-8da7-388570dadf0e', 'E0AFCCEC-6A37-EF11-86D4-000D3A4E707E', 1, 0, 0, 0, NOW(), NOW());

/* SQL generated to add new permission for entity MJ_BizApps_Accounting: Accounting Engine Extensions for role Developer */

INSERT INTO ${mjSchema}."EntityPermission"
                                                   ("EntityID", "RoleID", "CanRead", "CanCreate", "CanUpdate", "CanDelete", "__mj_CreatedAt", "__mj_UpdatedAt") VALUES
                                                   ('17b0dc00-2fbb-475e-8da7-388570dadf0e', 'DEAFCCEC-6A37-EF11-86D4-000D3A4E707E', 1, 1, 1, 1, NOW(), NOW());

/* SQL generated to add new permission for entity MJ_BizApps_Accounting: Accounting Engine Extensions for role Integration */

INSERT INTO ${mjSchema}."EntityPermission"
                                                   ("EntityID", "RoleID", "CanRead", "CanCreate", "CanUpdate", "CanDelete", "__mj_CreatedAt", "__mj_UpdatedAt") VALUES
                                                   ('17b0dc00-2fbb-475e-8da7-388570dadf0e', 'DFAFCCEC-6A37-EF11-86D4-000D3A4E707E', 1, 1, 1, 1, NOW(), NOW());

/* SQL text to update existing entities from schema */

/* SQL text to add special date field __mj_CreatedAt to entity __mj_BizAppsAccounting."AccountingEngineExtension" */
UPDATE "__mj_BizAppsAccounting"."AccountingEngineExtension" SET "__mj_CreatedAt" = NOW() WHERE "__mj_CreatedAt" IS NULL;

/* SQL text to add special date field __mj_CreatedAt to entity __mj_BizAppsAccounting.AccountingEngineExtension */
ALTER TABLE __mj_BizAppsAccounting."AccountingEngineExtension" ALTER COLUMN "__mj_CreatedAt" SET NOT NULL;

ALTER TABLE __mj_BizAppsAccounting."AccountingEngineExtension"
  ALTER COLUMN "__mj_CreatedAt" SET DEFAULT NOW();

/* SQL text to add special date field __mj_UpdatedAt to entity __mj_BizAppsAccounting."AccountingEngineExtension" */
UPDATE "__mj_BizAppsAccounting"."AccountingEngineExtension" SET "__mj_UpdatedAt" = NOW() WHERE "__mj_UpdatedAt" IS NULL;

/* SQL text to add special date field __mj_UpdatedAt to entity __mj_BizAppsAccounting.AccountingEngineExtension */
ALTER TABLE __mj_BizAppsAccounting."AccountingEngineExtension" ALTER COLUMN "__mj_UpdatedAt" SET NOT NULL;

ALTER TABLE __mj_BizAppsAccounting."AccountingEngineExtension"
  ALTER COLUMN "__mj_UpdatedAt" SET DEFAULT NOW();

UPDATE ${mjSchema}."EntityField"
         SET "Sequence" = "Sequence" + 100000
       WHERE "EntityID" = '17B0DC00-2FBB-475E-8DA7-388570DADF0E'
         AND "Sequence" < 100000;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = 'f4372536-200f-49f7-954a-f495feeacb5c' OR ("EntityID" = '17B0DC00-2FBB-475E-8DA7-388570DADF0E' AND "Name" = 'ID')
    ) THEN
        INSERT INTO ${mjSchema}."EntityField"
        (
        "ID",
        "EntityID",
        "Sequence",
        "Name",
        "DisplayName",
        "Description",
        "Type",
        "Length",
        "Precision",
        "Scale",
        "AllowsNull",
        "DefaultValue",
        "AutoIncrement",
        "AllowUpdateAPI",
        "IsVirtual",
        "IsComputed",
        "RelatedEntityID",
        "RelatedEntityFieldName",
        "IsNameField",
        "IncludeInUserSearchAPI",
        "IncludeRelatedEntityNameFieldInBaseView",
        "DefaultInView",
        "IsPrimaryKey",
        "IsUnique",
        "RelatedEntityDisplayType",
        "__mj_CreatedAt",
        "__mj_UpdatedAt"
        )
        VALUES
        (
        'f4372536-200f-49f7-954a-f495feeacb5c',
        '17B0DC00-2FBB-475E-8DA7-388570DADF0E', -- "Entity": "MJ_BizApps_Accounting": "Accounting" "Engine" "Extensions"
        1,
        'ID',
        'ID',
        'Unique identifier.',
        'UUID',
        16,
        0,
        0,
        0,
        'gen_random_uuid()',
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
        NOW(),
        NOW()
        );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = '6519585a-a6f5-443b-8ab4-87805a40359f' OR ("EntityID" = '17B0DC00-2FBB-475E-8DA7-388570DADF0E' AND "Name" = 'Code')
    ) THEN
        INSERT INTO ${mjSchema}."EntityField"
        (
        "ID",
        "EntityID",
        "Sequence",
        "Name",
        "DisplayName",
        "Description",
        "Type",
        "Length",
        "Precision",
        "Scale",
        "AllowsNull",
        "DefaultValue",
        "AutoIncrement",
        "AllowUpdateAPI",
        "IsVirtual",
        "IsComputed",
        "RelatedEntityID",
        "RelatedEntityFieldName",
        "IsNameField",
        "IncludeInUserSearchAPI",
        "IncludeRelatedEntityNameFieldInBaseView",
        "DefaultInView",
        "IsPrimaryKey",
        "IsUnique",
        "RelatedEntityDisplayType",
        "__mj_CreatedAt",
        "__mj_UpdatedAt"
        )
        VALUES
        (
        '6519585a-a6f5-443b-8ab4-87805a40359f',
        '17B0DC00-2FBB-475E-8DA7-388570DADF0E', -- "Entity": "MJ_BizApps_Accounting": "Accounting" "Engine" "Extensions"
        2,
        'Code',
        'Code',
        'Stable engine key, unique. Must match the subclass Code getter. Example: ImportBankAccountBalances.',
        'TEXT',
        160,
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
        NOW(),
        NOW()
        );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = '70fa6917-b008-4459-b343-6e6a6309dab1' OR ("EntityID" = '17B0DC00-2FBB-475E-8DA7-388570DADF0E' AND "Name" = 'Name')
    ) THEN
        INSERT INTO ${mjSchema}."EntityField"
        (
        "ID",
        "EntityID",
        "Sequence",
        "Name",
        "DisplayName",
        "Description",
        "Type",
        "Length",
        "Precision",
        "Scale",
        "AllowsNull",
        "DefaultValue",
        "AutoIncrement",
        "AllowUpdateAPI",
        "IsVirtual",
        "IsComputed",
        "RelatedEntityID",
        "RelatedEntityFieldName",
        "IsNameField",
        "IncludeInUserSearchAPI",
        "IncludeRelatedEntityNameFieldInBaseView",
        "DefaultInView",
        "IsPrimaryKey",
        "IsUnique",
        "RelatedEntityDisplayType",
        "__mj_CreatedAt",
        "__mj_UpdatedAt"
        )
        VALUES
        (
        '70fa6917-b008-4459-b343-6e6a6309dab1',
        '17B0DC00-2FBB-475E-8DA7-388570DADF0E', -- "Entity": "MJ_BizApps_Accounting": "Accounting" "Engine" "Extensions"
        3,
        'Name',
        'Name',
        'Display name in Explorer and the accounting dashboard.',
        'TEXT',
        400,
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
        NOW(),
        NOW()
        );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = '5ca64999-88c8-4692-9e95-5242ffc66a84' OR ("EntityID" = '17B0DC00-2FBB-475E-8DA7-388570DADF0E' AND "Name" = 'Description')
    ) THEN
        INSERT INTO ${mjSchema}."EntityField"
        (
        "ID",
        "EntityID",
        "Sequence",
        "Name",
        "DisplayName",
        "Description",
        "Type",
        "Length",
        "Precision",
        "Scale",
        "AllowsNull",
        "DefaultValue",
        "AutoIncrement",
        "AllowUpdateAPI",
        "IsVirtual",
        "IsComputed",
        "RelatedEntityID",
        "RelatedEntityFieldName",
        "IsNameField",
        "IncludeInUserSearchAPI",
        "IncludeRelatedEntityNameFieldInBaseView",
        "DefaultInView",
        "IsPrimaryKey",
        "IsUnique",
        "RelatedEntityDisplayType",
        "__mj_CreatedAt",
        "__mj_UpdatedAt"
        )
        VALUES
        (
        '5ca64999-88c8-4692-9e95-5242ffc66a84',
        '17B0DC00-2FBB-475E-8DA7-388570DADF0E', -- "Entity": "MJ_BizApps_Accounting": "Accounting" "Engine" "Extensions"
        4,
        'Description',
        'Description',
        'What this extension does, which app owns it, and what it writes (its own tables, never accounting''s).',
        'TEXT',
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
        NOW(),
        NOW()
        );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = 'bd6f55de-2597-494a-8ef9-c8332e65bb9b' OR ("EntityID" = '17B0DC00-2FBB-475E-8DA7-388570DADF0E' AND "Name" = 'DriverClass')
    ) THEN
        INSERT INTO ${mjSchema}."EntityField"
        (
        "ID",
        "EntityID",
        "Sequence",
        "Name",
        "DisplayName",
        "Description",
        "Type",
        "Length",
        "Precision",
        "Scale",
        "AllowsNull",
        "DefaultValue",
        "AutoIncrement",
        "AllowUpdateAPI",
        "IsVirtual",
        "IsComputed",
        "RelatedEntityID",
        "RelatedEntityFieldName",
        "IsNameField",
        "IncludeInUserSearchAPI",
        "IncludeRelatedEntityNameFieldInBaseView",
        "DefaultInView",
        "IsPrimaryKey",
        "IsUnique",
        "RelatedEntityDisplayType",
        "__mj_CreatedAt",
        "__mj_UpdatedAt"
        )
        VALUES
        (
        'bd6f55de-2597-494a-8ef9-c8332e65bb9b',
        '17B0DC00-2FBB-475E-8DA7-388570DADF0E', -- "Entity": "MJ_BizApps_Accounting": "Accounting" "Engine" "Extensions"
        5,
        'DriverClass',
        'Driver Class',
        'ClassFactory key for the @RegisterClass subclass of BaseAccountingEngineExtension. Must be loaded in the host (MJAPI) or the engine logs and skips.',
        'TEXT',
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
        NOW(),
        NOW()
        );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = 'bb7064ac-415c-40aa-bc20-f10018bb2962' OR ("EntityID" = '17B0DC00-2FBB-475E-8DA7-388570DADF0E' AND "Name" = 'Status')
    ) THEN
        INSERT INTO ${mjSchema}."EntityField"
        (
        "ID",
        "EntityID",
        "Sequence",
        "Name",
        "DisplayName",
        "Description",
        "Type",
        "Length",
        "Precision",
        "Scale",
        "AllowsNull",
        "DefaultValue",
        "AutoIncrement",
        "AllowUpdateAPI",
        "IsVirtual",
        "IsComputed",
        "RelatedEntityID",
        "RelatedEntityFieldName",
        "IsNameField",
        "IncludeInUserSearchAPI",
        "IncludeRelatedEntityNameFieldInBaseView",
        "DefaultInView",
        "IsPrimaryKey",
        "IsUnique",
        "RelatedEntityDisplayType",
        "__mj_CreatedAt",
        "__mj_UpdatedAt"
        )
        VALUES
        (
        'bb7064ac-415c-40aa-bc20-f10018bb2962',
        '17B0DC00-2FBB-475E-8DA7-388570DADF0E', -- "Entity": "MJ_BizApps_Accounting": "Accounting" "Engine" "Extensions"
        6,
        'Status',
        'Status',
        'Active = engine instantiates this extension and honors its class getters. Disabled = skip without a rebuild.',
        'TEXT',
        40,
        0,
        0,
        0,
        'Active',
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
        NOW(),
        NOW()
        );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = '4f7f0861-0469-470c-9261-32043e345293' OR ("EntityID" = '17B0DC00-2FBB-475E-8DA7-388570DADF0E' AND "Name" = 'Sequence')
    ) THEN
        INSERT INTO ${mjSchema}."EntityField"
        (
        "ID",
        "EntityID",
        "Sequence",
        "Name",
        "DisplayName",
        "Description",
        "Type",
        "Length",
        "Precision",
        "Scale",
        "AllowsNull",
        "DefaultValue",
        "AutoIncrement",
        "AllowUpdateAPI",
        "IsVirtual",
        "IsComputed",
        "RelatedEntityID",
        "RelatedEntityFieldName",
        "IsNameField",
        "IncludeInUserSearchAPI",
        "IncludeRelatedEntityNameFieldInBaseView",
        "DefaultInView",
        "IsPrimaryKey",
        "IsUnique",
        "RelatedEntityDisplayType",
        "__mj_CreatedAt",
        "__mj_UpdatedAt"
        )
        VALUES
        (
        '4f7f0861-0469-470c-9261-32043e345293',
        '17B0DC00-2FBB-475E-8DA7-388570DADF0E', -- "Entity": "MJ_BizApps_Accounting": "Accounting" "Engine" "Extensions"
        7,
        'Sequence',
        'Sequence',
        'Run order among Active extensions at the same verb. Lower first. Ties break on Code.',
        'INTEGER',
        4,
        10,
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
        NOW(),
        NOW()
        );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = '9945123e-730c-45ad-9f80-c01caacf45cb' OR ("EntityID" = '17B0DC00-2FBB-475E-8DA7-388570DADF0E' AND "Name" = 'CompanyID')
    ) THEN
        INSERT INTO ${mjSchema}."EntityField"
        (
        "ID",
        "EntityID",
        "Sequence",
        "Name",
        "DisplayName",
        "Description",
        "Type",
        "Length",
        "Precision",
        "Scale",
        "AllowsNull",
        "DefaultValue",
        "AutoIncrement",
        "AllowUpdateAPI",
        "IsVirtual",
        "IsComputed",
        "RelatedEntityID",
        "RelatedEntityFieldName",
        "IsNameField",
        "IncludeInUserSearchAPI",
        "IncludeRelatedEntityNameFieldInBaseView",
        "DefaultInView",
        "IsPrimaryKey",
        "IsUnique",
        "RelatedEntityDisplayType",
        "__mj_CreatedAt",
        "__mj_UpdatedAt"
        )
        VALUES
        (
        '9945123e-730c-45ad-9f80-c01caacf45cb',
        '17B0DC00-2FBB-475E-8DA7-388570DADF0E', -- "Entity": "MJ_BizApps_Accounting": "Accounting" "Engine" "Extensions"
        8,
        'CompanyID',
        'Company ID',
        'NULL = run for every company in the engine call. Set = run only for that Company. One row per Code; subset-of-companies is a later child table if a host needs it.',
        'UUID',
        16,
        0,
        0,
        1,
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
        NOW(),
        NOW()
        );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = 'e823d31f-b6ba-4858-8527-e42297b73645' OR ("EntityID" = '17B0DC00-2FBB-475E-8DA7-388570DADF0E' AND "Name" = 'Configuration')
    ) THEN
        INSERT INTO ${mjSchema}."EntityField"
        (
        "ID",
        "EntityID",
        "Sequence",
        "Name",
        "DisplayName",
        "Description",
        "Type",
        "Length",
        "Precision",
        "Scale",
        "AllowsNull",
        "DefaultValue",
        "AutoIncrement",
        "AllowUpdateAPI",
        "IsVirtual",
        "IsComputed",
        "RelatedEntityID",
        "RelatedEntityFieldName",
        "IsNameField",
        "IncludeInUserSearchAPI",
        "IncludeRelatedEntityNameFieldInBaseView",
        "DefaultInView",
        "IsPrimaryKey",
        "IsUnique",
        "RelatedEntityDisplayType",
        "__mj_CreatedAt",
        "__mj_UpdatedAt"
        )
        VALUES
        (
        'e823d31f-b6ba-4858-8527-e42297b73645',
        '17B0DC00-2FBB-475E-8DA7-388570DADF0E', -- "Entity": "MJ_BizApps_Accounting": "Accounting" "Engine" "Extensions"
        9,
        'Configuration',
        'Configuration',
        'Host-tunable JSON bag (IAccountingEngineExtensionConfiguration): AsOf, Objects, ContinueOnError, plus extension-specific keys. NOT hook flags — those are class getters. NULL = class/engine defaults. ISJSON-enforced.',
        'TEXT',
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
        NOW(),
        NOW()
        );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = 'ee75ffcf-332b-4882-b46d-be60a6604ed4' OR ("EntityID" = '17B0DC00-2FBB-475E-8DA7-388570DADF0E' AND "Name" = '__mj_CreatedAt')
    ) THEN
        INSERT INTO ${mjSchema}."EntityField"
        (
        "ID",
        "EntityID",
        "Sequence",
        "Name",
        "DisplayName",
        "Description",
        "Type",
        "Length",
        "Precision",
        "Scale",
        "AllowsNull",
        "DefaultValue",
        "AutoIncrement",
        "AllowUpdateAPI",
        "IsVirtual",
        "IsComputed",
        "RelatedEntityID",
        "RelatedEntityFieldName",
        "IsNameField",
        "IncludeInUserSearchAPI",
        "IncludeRelatedEntityNameFieldInBaseView",
        "DefaultInView",
        "IsPrimaryKey",
        "IsUnique",
        "RelatedEntityDisplayType",
        "__mj_CreatedAt",
        "__mj_UpdatedAt"
        )
        VALUES
        (
        'ee75ffcf-332b-4882-b46d-be60a6604ed4',
        '17B0DC00-2FBB-475E-8DA7-388570DADF0E', -- "Entity": "MJ_BizApps_Accounting": "Accounting" "Engine" "Extensions"
        10,
        '__mj_CreatedAt',
        'Created At',
        NULL,
        'TIMESTAMPTZ',
        10,
        34,
        7,
        0,
        'NOW()',
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
        NOW(),
        NOW()
        );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = 'eaeff513-4801-4324-8f8c-41dbf3138b4a' OR ("EntityID" = '17B0DC00-2FBB-475E-8DA7-388570DADF0E' AND "Name" = '__mj_UpdatedAt')
    ) THEN
        INSERT INTO ${mjSchema}."EntityField"
        (
        "ID",
        "EntityID",
        "Sequence",
        "Name",
        "DisplayName",
        "Description",
        "Type",
        "Length",
        "Precision",
        "Scale",
        "AllowsNull",
        "DefaultValue",
        "AutoIncrement",
        "AllowUpdateAPI",
        "IsVirtual",
        "IsComputed",
        "RelatedEntityID",
        "RelatedEntityFieldName",
        "IsNameField",
        "IncludeInUserSearchAPI",
        "IncludeRelatedEntityNameFieldInBaseView",
        "DefaultInView",
        "IsPrimaryKey",
        "IsUnique",
        "RelatedEntityDisplayType",
        "__mj_CreatedAt",
        "__mj_UpdatedAt"
        )
        VALUES
        (
        'eaeff513-4801-4324-8f8c-41dbf3138b4a',
        '17B0DC00-2FBB-475E-8DA7-388570DADF0E', -- "Entity": "MJ_BizApps_Accounting": "Accounting" "Engine" "Extensions"
        11,
        '__mj_UpdatedAt',
        'Updated At',
        NULL,
        'TIMESTAMPTZ',
        10,
        34,
        7,
        0,
        'NOW()',
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
        NOW(),
        NOW()
        );
    END IF;
END $$;

INSERT INTO ${mjSchema}."EntityFieldValue"
                                       ("ID", "EntityFieldID", "Sequence", "Value", "Code", "__mj_CreatedAt", "__mj_UpdatedAt")
                                    VALUES
                                       ('2bf0b09f-58e6-4488-a09a-0c89d2164aed', 'BB7064AC-415C-40AA-BC20-F10018BB2962', 1, 'Active', 'Active', NOW(), NOW());

/* SQL text to insert entity field value with ID 8ee91a93-0b34-414c-9a3f-7737abd4c38f */

INSERT INTO ${mjSchema}."EntityFieldValue"
                                       ("ID", "EntityFieldID", "Sequence", "Value", "Code", "__mj_CreatedAt", "__mj_UpdatedAt")
                                    VALUES
                                       ('8ee91a93-0b34-414c-9a3f-7737abd4c38f', 'BB7064AC-415C-40AA-BC20-F10018BB2962', 2, 'Disabled', 'Disabled', NOW(), NOW());

/* SQL text to update ValueListType for entity field ID BB7064AC-415C-40AA-BC20-F10018BB2962 */

UPDATE ${mjSchema}."EntityField" SET "ValueListType"='List' WHERE "ID"='BB7064AC-415C-40AA-BC20-F10018BB2962';


/* Create Entity Relationship: MJ: Companies -> MJ_BizApps_Accounting: Accounting Engine Extensions (One To Many via CompanyID) */

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityRelationship" WHERE "ID" = 'a0f37470-5f99-48b4-b5d6-1062c9caa2d2'
    ) THEN
        INSERT INTO ${mjSchema}."EntityRelationship" ("ID", "EntityID", "RelatedEntityID", "RelatedEntityJoinField", "Type", "BundleInAPI", "DisplayInForm", "Sequence", "__mj_CreatedAt", "__mj_UpdatedAt")
        VALUES ('a0f37470-5f99-48b4-b5d6-1062c9caa2d2', 'D4238F34-2837-EF11-86D4-6045BDEE16E6', '17B0DC00-2FBB-475E-8DA7-388570DADF0E', 'CompanyID', 'One To Many', 1, 1, 43, NOW(), NOW());
    END IF;
END $$;

UPDATE ${mjSchema}."EntityField"
         SET "Sequence" = "Sequence" + 100000
       WHERE "EntityID" = '17B0DC00-2FBB-475E-8DA7-388570DADF0E'
         AND "Sequence" < 100000;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = 'd6a10416-c4b4-444f-8e5d-fd8725daea65' OR ("EntityID" = '17B0DC00-2FBB-475E-8DA7-388570DADF0E' AND "Name" = 'Company')
    ) THEN
        INSERT INTO ${mjSchema}."EntityField"
        (
        "ID",
        "EntityID",
        "Sequence",
        "Name",
        "DisplayName",
        "Description",
        "Type",
        "Length",
        "Precision",
        "Scale",
        "AllowsNull",
        "DefaultValue",
        "AutoIncrement",
        "AllowUpdateAPI",
        "IsVirtual",
        "IsComputed",
        "RelatedEntityID",
        "RelatedEntityFieldName",
        "IsNameField",
        "IncludeInUserSearchAPI",
        "IncludeRelatedEntityNameFieldInBaseView",
        "DefaultInView",
        "IsPrimaryKey",
        "IsUnique",
        "RelatedEntityDisplayType",
        "__mj_CreatedAt",
        "__mj_UpdatedAt"
        )
        VALUES
        (
        'd6a10416-c4b4-444f-8e5d-fd8725daea65',
        '17B0DC00-2FBB-475E-8DA7-388570DADF0E', -- "Entity": "MJ_BizApps_Accounting": "Accounting" "Engine" "Extensions"
        12,
        'Company',
        'Company',
        NULL,
        'TEXT',
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
        NOW(),
        NOW()
        );
    END IF;
END $$;

UPDATE ${mjSchema}."EntityField"
               SET "DefaultInView" = TRUE
               WHERE "ID" = '6519585A-A6F5-443B-8AB4-87805A40359F'
               AND "AutoUpdateDefaultInView" = TRUE;

UPDATE ${mjSchema}."EntityField"
               SET "DefaultInView" = TRUE
               WHERE "ID" = 'BB7064AC-415C-40AA-BC20-F10018BB2962'
               AND "AutoUpdateDefaultInView" = TRUE;

UPDATE ${mjSchema}."EntityField"
               SET "DefaultInView" = TRUE
               WHERE "ID" = '4F7F0861-0469-470C-9261-32043E345293'
               AND "AutoUpdateDefaultInView" = TRUE;

UPDATE ${mjSchema}."EntityField"
               SET "DefaultInView" = TRUE
               WHERE "ID" = 'D6A10416-C4B4-444F-8E5D-FD8725DAEA65'
               AND "AutoUpdateDefaultInView" = TRUE;

UPDATE ${mjSchema}."Entity"
            SET "AllowUserSearchAPI" = FALSE
            WHERE "ID" = '17B0DC00-2FBB-475E-8DA7-388570DADF0E'
            AND "AutoUpdateAllowUserSearchAPI" = TRUE;

/* Set categories for 12 fields */

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Accounting Engine Extensions.ID

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'System Metadata',
   "GeneratedFormSection" = 'Category',
   "ExtendedType" = NULL,
   "CodeType" = NULL
WHERE 
   "ID" = 'F4372536-200F-49F7-954A-F495FEEACB5C' AND "AutoUpdateCategory" = TRUE;

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Accounting Engine Extensions.Code

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Extension Definition',
   "GeneratedFormSection" = 'Category',
   "ExtendedType" = NULL,
   "CodeType" = NULL
WHERE 
   "ID" = '6519585A-A6F5-443B-8AB4-87805A40359F' AND "AutoUpdateCategory" = TRUE;

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Accounting Engine Extensions.Name

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Extension Definition',
   "GeneratedFormSection" = 'Category',
   "ExtendedType" = NULL,
   "CodeType" = NULL
WHERE 
   "ID" = '70FA6917-B008-4459-B343-6E6A6309DAB1' AND "AutoUpdateCategory" = TRUE;

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Accounting Engine Extensions.Description

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Extension Definition',
   "GeneratedFormSection" = 'Category',
   "ExtendedType" = NULL,
   "CodeType" = NULL
WHERE 
   "ID" = '5CA64999-88C8-4692-9E95-5242FFC66A84' AND "AutoUpdateCategory" = TRUE;

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Accounting Engine Extensions.DriverClass

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Extension Definition',
   "GeneratedFormSection" = 'Category',
   "ExtendedType" = NULL,
   "CodeType" = NULL
WHERE 
   "ID" = 'BD6F55DE-2597-494A-8EF9-C8332E65BB9B' AND "AutoUpdateCategory" = TRUE;

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Accounting Engine Extensions.Status

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Operational Settings',
   "GeneratedFormSection" = 'Category',
   "ExtendedType" = NULL,
   "CodeType" = NULL
WHERE 
   "ID" = 'BB7064AC-415C-40AA-BC20-F10018BB2962' AND "AutoUpdateCategory" = TRUE;

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Accounting Engine Extensions.Sequence

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Operational Settings',
   "GeneratedFormSection" = 'Category',
   "ExtendedType" = NULL,
   "CodeType" = NULL
WHERE 
   "ID" = '4F7F0861-0469-470C-9261-32043E345293' AND "AutoUpdateCategory" = TRUE;

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Accounting Engine Extensions.CompanyID

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Operational Settings',
   "GeneratedFormSection" = 'Category',
   "ExtendedType" = NULL,
   "CodeType" = NULL
WHERE 
   "ID" = '9945123E-730C-45AD-9F80-C01CAACF45CB' AND "AutoUpdateCategory" = TRUE;

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Accounting Engine Extensions.Company

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Operational Settings',
   "GeneratedFormSection" = 'Category',
   "ExtendedType" = NULL,
   "CodeType" = NULL
WHERE 
   "ID" = 'D6A10416-C4B4-444F-8E5D-FD8725DAEA65' AND "AutoUpdateCategory" = TRUE;

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Accounting Engine Extensions.Configuration

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Configuration',
   "GeneratedFormSection" = 'Category',
   "ExtendedType" = 'Code',
   "CodeType" = 'Other'
WHERE 
   "ID" = 'E823D31F-B6BA-4858-8527-E42297B73645' AND "AutoUpdateCategory" = TRUE;

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Accounting Engine Extensions.__mj_CreatedAt

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'System Metadata',
   "GeneratedFormSection" = 'Category',
   "ExtendedType" = NULL,
   "CodeType" = NULL
WHERE 
   "ID" = 'EE75FFCF-332B-4882-B46D-BE60A6604ED4' AND "AutoUpdateCategory" = TRUE;

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: Accounting Engine Extensions.__mj_UpdatedAt

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'System Metadata',
   "GeneratedFormSection" = 'Category',
   "ExtendedType" = NULL,
   "CodeType" = NULL
WHERE 
   "ID" = 'EAEFF513-4801-4324-8F8C-41DBF3138B4A' AND "AutoUpdateCategory" = TRUE;

/* Set entity icon to fa fa-plug */

UPDATE ${mjSchema}."Entity"
               SET "Icon" = 'fa fa-plug', "__mj_UpdatedAt" = NOW()
               WHERE "ID" = '17B0DC00-2FBB-475E-8DA7-388570DADF0E';

/* Insert FieldCategoryInfo setting for entity */

INSERT INTO ${mjSchema}."EntitySetting" ("ID", "EntityID", "Name", "Value", "__mj_CreatedAt", "__mj_UpdatedAt")
               VALUES ('e0b5b704-568f-4632-972a-821632e17f23', '17B0DC00-2FBB-475E-8DA7-388570DADF0E', 'FieldCategoryInfo', '{"Extension Definition":{"icon":"fa fa-info-circle","description":"Core identity and implementation details for the accounting extension"},"Operational Settings":{"icon":"fa fa-sliders-h","description":"Runtime controls including status, execution order, and scope"},"Configuration":{"icon":"fa fa-cog","description":"Host-tunable parameters and JSON configuration settings"},"System Metadata":{"icon":"fa fa-database","description":"System-managed audit and tracking fields"}}', NOW(), NOW());

/* Insert FieldCategoryIcons setting (legacy) */

INSERT INTO ${mjSchema}."EntitySetting" ("ID", "EntityID", "Name", "Value", "__mj_CreatedAt", "__mj_UpdatedAt")
               VALUES ('a3549112-d85f-4e7a-abaa-645aa009406c', '17B0DC00-2FBB-475E-8DA7-388570DADF0E', 'FieldCategoryIcons', '{"Extension Definition":"fa fa-info-circle","Operational Settings":"fa fa-sliders-h","Configuration":"fa fa-cog","System Metadata":"fa fa-database"}', NOW(), NOW());

/* Set DefaultForNewUser=false for NEW entity (category: supporting, confidence: high) */

UPDATE ${mjSchema}."ApplicationEntity"
         SET "DefaultForNewUser" = FALSE, "__mj_UpdatedAt" = NOW()
         WHERE "EntityID" = '17B0DC00-2FBB-475E-8DA7-388570DADF0E';

/* Generated Validation Functions for MJ_BizApps_Accounting: Accounting Engine Extensions */
-- CHECK constraint for MJ_BizApps_Accounting: Accounting Engine Extensions: Field: Configuration was newly set or modified since the last generation of the validation function, the code was regenerated and updating the GeneratedCode table with the new generated validation function

INSERT INTO ${mjSchema}."GeneratedCode" ("CategoryID", "GeneratedByModelID", "GeneratedAt", "Language", "Status", "Source", "Code", "Description", "Name", "LinkedEntityID", "LinkedRecordPrimaryKey")
                      VALUES ((SELECT "ID" FROM ${mjSchema}."vwGeneratedCodeCategories" WHERE "Name"='CodeGen: Validators'), 'C43229F6-4CC8-4838-9D04-03419A2DA191', NOW(), 'TypeScript', 'Approved', '([Configuration] IS NULL OR ([Configuration]) IS JSON=TRUE)', 'public ValidateConfiguration(result: ValidationResult) IS JSON {
    if (this.Configuration != null && this.Configuration.trim() !== "") {
        try {
            JSON.parse(this.Configuration);
        } catch (e) {
            result.Errors.push(new ValidationErrorInfo(
                "Configuration",
                "The Configuration field must be a valid JSON string.",
                this.Configuration,
                ValidationErrorType.Failure
            ));
        }
    }
}', 'The configuration settings, if provided, must be in a valid JSON format to ensure they can be correctly parsed and processed by the system.', 'ValidateConfigurationIsJson', 'DF238F34-2837-EF11-86D4-6045BDEE16E6', 'E823D31F-B6BA-4858-8527-E42297B73645');


-- ===================== Grants =====================

DO $$ BEGIN GRANT SELECT ON __mj_BizAppsAccounting."vwAccountingEngineExtensions" TO "cdp_UI", "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* Base View Permissions SQL for MJ_BizApps_Accounting: Accounting Engine Extensions */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Accounting Engine Extensions
-- Item: Permissions for vwAccountingEngineExtensions
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------;

DO $$ BEGIN GRANT SELECT ON __mj_BizAppsAccounting."vwAccountingEngineExtensions" TO "cdp_UI", "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* spCreate SQL for MJ_BizApps_Accounting: Accounting Engine Extensions */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Accounting Engine Extensions
-- Item: spCreateAccountingEngineExtension
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- CREATE PROCEDURE FOR AccountingEngineExtension
------------------------------------------------------------;

DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsAccounting."spCreateAccountingEngineExtension" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* spCreate Permissions for MJ_BizApps_Accounting: Accounting Engine Extensions */

DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsAccounting."spCreateAccountingEngineExtension" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* spUpdate SQL for MJ_BizApps_Accounting: Accounting Engine Extensions */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Accounting Engine Extensions
-- Item: spUpdateAccountingEngineExtension
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- UPDATE PROCEDURE FOR AccountingEngineExtension
------------------------------------------------------------;

DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsAccounting."spUpdateAccountingEngineExtension" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsAccounting."spUpdateAccountingEngineExtension" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* spDelete SQL for MJ_BizApps_Accounting: Accounting Engine Extensions */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Accounting Engine Extensions
-- Item: spDeleteAccountingEngineExtension
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- DELETE PROCEDURE FOR AccountingEngineExtension
------------------------------------------------------------;

DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsAccounting."spDeleteAccountingEngineExtension" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* spDelete Permissions for MJ_BizApps_Accounting: Accounting Engine Extensions */

DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsAccounting."spDeleteAccountingEngineExtension" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
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
-----               SCHEMA:      __mj_BizAppsAccounting
-----               BASE TABLE:  JournalEntry
-----               PRIMARY KEY: ID
------------------------------------------------------------;

DO $$ BEGIN GRANT SELECT ON __mj_BizAppsAccounting."vwJournalEntries" TO "cdp_UI", "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* Base View Permissions SQL for MJ_BizApps_Accounting: Journal Entries */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Journal Entries
-- Item: Permissions for vwJournalEntries
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------;

DO $$ BEGIN GRANT SELECT ON __mj_BizAppsAccounting."vwJournalEntries" TO "cdp_UI", "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
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
------------------------------------------------------------;

DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsAccounting."spCreateJournalEntry" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* spCreate Permissions for MJ_BizApps_Accounting: Journal Entries */

DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsAccounting."spCreateJournalEntry" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
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
------------------------------------------------------------;

DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsAccounting."spUpdateJournalEntry" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsAccounting."spUpdateJournalEntry" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
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
------------------------------------------------------------;

DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsAccounting."spDeleteJournalEntry" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* spDelete Permissions for MJ_BizApps_Accounting: Journal Entries */

DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsAccounting."spDeleteJournalEntry" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* SQL text to delete unneeded entity fields (1 scoped entities) */


-- ===================== Comments =====================

COMMENT ON TABLE __mj_BizAppsAccounting."AccountingEngineExtension" IS 'Registry of extensions the Accounting engine invokes around its verbs (sync, post, later others). Other Open Apps insert a row and @RegisterClass a BaseAccountingEngineExtension. Status lets a host disable without a rebuild. Configuration is a JSON bag (IAccountingEngineExtensionConfiguration) for host-tunable parameters. Hook participation is on the class (getters + Before/After overrides), not columns. Empty in this app — consumers seed their own rows. Not the ERP provider plugin list.';

COMMENT ON COLUMN __mj_BizAppsAccounting."AccountingEngineExtension"."ID" IS 'Unique identifier.';

COMMENT ON COLUMN __mj_BizAppsAccounting."AccountingEngineExtension"."Code" IS 'Stable engine key, unique. Must match the subclass Code getter. Example: ImportBankAccountBalances.';

COMMENT ON COLUMN __mj_BizAppsAccounting."AccountingEngineExtension"."Name" IS 'Display name in Explorer and the accounting dashboard.';

COMMENT ON COLUMN __mj_BizAppsAccounting."AccountingEngineExtension"."Description" IS 'What this extension does, which app owns it, and what it writes (its own tables, never accounting''s).';

COMMENT ON COLUMN __mj_BizAppsAccounting."AccountingEngineExtension"."DriverClass" IS 'ClassFactory key for the @RegisterClass subclass of BaseAccountingEngineExtension. Must be loaded in the host (MJAPI) or the engine logs and skips.';

COMMENT ON COLUMN __mj_BizAppsAccounting."AccountingEngineExtension"."Status" IS 'Active = engine instantiates this extension and honors its class getters. Disabled = skip without a rebuild.';

COMMENT ON COLUMN __mj_BizAppsAccounting."AccountingEngineExtension"."Sequence" IS 'Run order among Active extensions at the same verb. Lower first. Ties break on Code.';

COMMENT ON COLUMN __mj_BizAppsAccounting."AccountingEngineExtension"."CompanyID" IS 'NULL = run for every company in the engine call. Set = run only for that Company. One row per Code; subset-of-companies is a later child table if a host needs it.';

COMMENT ON COLUMN __mj_BizAppsAccounting."AccountingEngineExtension"."Configuration" IS 'Host-tunable JSON bag (IAccountingEngineExtensionConfiguration): AsOf, Objects, ContinueOnError, plus extension-specific keys. NOT hook flags — those are class getters. NULL = class/engine defaults. ISJSON-enforced.';


-- ===================== Other =====================

-- =============================================================================
-- CODEGEN OUTPUT — GENERATED CODE BELOW THIS LINE. DO NOT EDIT BY HAND.
-- Captured 2026-08-29 from CodeGen after AccountingEngineExtension.
-- =============================================================================


/* SQL generated to create new entity MJ_BizApps_Accounting: Accounting Engine Extensions */

/* SQL text to insert 12 new entity field(s) */

/* spUpdate Permissions for MJ_BizApps_Accounting: Accounting Engine Extensions */

/* spUpdate Permissions for MJ_BizApps_Accounting: Journal Entries */
