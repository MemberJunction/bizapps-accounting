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
CREATE SCHEMA IF NOT EXISTS "__mj_BizAppsAccounting";
SET search_path TO "__mj_BizAppsAccounting", public;

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
-- Migration: V202611131600__v0.29.x__GLAccount_ExternalBankAccountNumber.sql
-- Description: a GL account can name the Business Central bank account it sits
--              behind, so batches post its lines to that bank account.
-- DETERMINISTIC, NOT IDEMPOTENT: runs once, after V202611121300.
-- =============================================================================
--
-- WHY
--
-- A batch sends every line to Business Central as a "G/L Account" line. In BC,
-- a cash G/L account such as 11101 usually sits behind a bank account: finance
-- enters cash against the bank account, and BC posts the G/L entry through the
-- bank account's posting group, writing a bank ledger entry on the way. A G/L
-- line skips the bank ledger, so those payments never reach bank
-- reconciliation. Where finance has turned Direct Posting off on the G/L
-- account, BC refuses the line outright and the batch fails ("Direct Posting
-- must be equal to 'Yes' in G/L Account").
--
-- WHAT CHANGES
--
-- GLAccount.ExternalBankAccountNumber (VARCHAR(20), nullable): the No. of the
-- Business Central bank account this GL account sits behind. When set, a batch
-- sends this account's lines as "Bank Account" lines with that No.; BC then
-- posts the G/L entry to the bank's posting-group account. 20 characters is
-- BC's Code[20] for a bank account No. Only Business Central reads it.
--
-- EXISTING DATA
--
-- No row changes. Every account reads NULL and keeps posting as a G/L line
-- until finance sets a bank account number.
-- =============================================================================

ALTER TABLE "__mj_BizAppsAccounting"."GLAccount"
 ADD COLUMN IF NOT EXISTS "ExternalBankAccountNumber" VARCHAR(20) NULL;

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_GLAccount_CompanyID" ON "__mj_BizAppsAccounting"."GLAccount" ("CompanyID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_GLAccount_ParentGLAccountID" ON "__mj_BizAppsAccounting"."GLAccount" ("ParentGLAccountID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_GLAccount_CurrencyCode" ON "__mj_BizAppsAccounting"."GLAccount" ("CurrencyCode");


-- ===================== Helper Functions (fn*) =====================

CREATE FUNCTION "__mj_BizAppsAccounting"."fnGLAccountParentGLAccountID_GetHierarchyMeta"
(
    p_RecordID UUID,
    p_ParentID UUID
)
RETURNS TABLE
AS
RETURN
(
    WITH CTE_Ancestors AS (
        SELECT
            "ID",
            "ParentGLAccountID",
            0 AS "Depth",
            CAST('/' || CAST("ID" AS VARCHAR(36)) || '/' AS TEXT) AS "Path"
        FROM
            "__mj_BizAppsAccounting"."GLAccount"
        WHERE
            "ID" = p_RecordID

        UNION ALL

        SELECT
            p."ID",
            p."ParentGLAccountID",
            c."Depth" + 1 AS "Depth",
            CAST('/' || CAST(p."ID" AS VARCHAR(36)) || c."Path" AS TEXT) AS "Path"
        FROM
            "__mj_BizAppsAccounting"."GLAccount" p
        INNER JOIN
            CTE_Ancestors c ON p."ID" = c."ParentGLAccountID"
        WHERE
            c."Depth" < 100
    )
    SELECT         a."ID" AS "RootID",
        (SELECT MAX("Depth") FROM CTE_Ancestors) AS "Depth",
        (SELECT "Path" FROM CTE_Ancestors ORDER BY "Depth" DESC
LIMIT 1) AS "Path",
        CAST(CASE WHEN EXISTS (SELECT 1 FROM "__mj_BizAppsAccounting"."GLAccount" WHERE "ParentGLAccountID" = p_RecordID) THEN 0 ELSE 1 END AS BOOLEAN) AS "IsLeaf",
        (SELECT COUNT(1) FROM "__mj_BizAppsAccounting"."GLAccount" WHERE "ParentGLAccountID" = p_RecordID) AS "ChildCount"
    FROM
        CTE_Ancestors a
    WHERE
        a."ParentGLAccountID" IS NULL OR p_ParentID IS NULL
    ORDER BY
        a."Depth" DESC

LIMIT 1);

CREATE FUNCTION "__mj_BizAppsAccounting"."fnGLAccountParentGLAccountID_GetDescendants"
(
    p_RootID UUID,
    p_MaxDepth INTEGER = NULL
)
RETURNS TABLE
AS
RETURN
(
    WITH CTE_Descendants AS (
        SELECT
            "ID",
            "ParentGLAccountID",
            0 AS "RelativeDepth",
            CAST('/' || CAST("ID" AS VARCHAR(36)) || '/' AS TEXT) AS "Path"
        FROM
            "__mj_BizAppsAccounting"."GLAccount"
        WHERE
            "ID" = p_RootID

        UNION ALL

        SELECT
            c."ID",
            c."ParentGLAccountID",
            p."RelativeDepth" || 1 AS "RelativeDepth",
            CAST(p."Path" || CAST(c."ID" AS VARCHAR(36)) || '/' AS TEXT) AS "Path"
        FROM
            "__mj_BizAppsAccounting"."GLAccount" c
        INNER JOIN
            CTE_Descendants p ON c."ParentGLAccountID" = p."ID"
        WHERE
            (p_MaxDepth IS NULL OR p."RelativeDepth" < p_MaxDepth)
            AND p."RelativeDepth" < 100
    )
    SELECT
        d."ID" AS "ID",
        d."RelativeDepth" AS "Depth",
        d."Path",
        CAST(CASE WHEN EXISTS (SELECT 1 FROM "__mj_BizAppsAccounting"."GLAccount" WHERE "ParentGLAccountID" = d."ID") THEN 0 ELSE 1 END AS BOOLEAN) AS "IsLeaf",
        (SELECT COUNT(1) FROM "__mj_BizAppsAccounting"."GLAccount" WHERE "ParentGLAccountID" = d."ID") AS "ChildCount"
    FROM
        CTE_Descendants d
);

CREATE FUNCTION "__mj_BizAppsAccounting"."fnGLAccountParentGLAccountID_GetAncestors"
(
    p_RecordID UUID
)
RETURNS TABLE
AS
RETURN
(
    WITH CTE_Ancestors AS (
        SELECT
            "ID",
            "ParentGLAccountID",
            0 AS "LevelUp",
            CAST('/' || CAST("ID" AS VARCHAR(36)) || '/' AS TEXT) AS "Path"
        FROM
            "__mj_BizAppsAccounting"."GLAccount"
        WHERE
            "ID" = p_RecordID

        UNION ALL

        SELECT
            p."ID",
            p."ParentGLAccountID",
            c."LevelUp" + 1 AS "LevelUp",
            CAST('/' || CAST(p."ID" AS VARCHAR(36)) || c."Path" AS TEXT) AS "Path"
        FROM
            "__mj_BizAppsAccounting"."GLAccount" p
        INNER JOIN
            CTE_Ancestors c ON p."ID" = c."ParentGLAccountID"
        WHERE
            c."LevelUp" < 100
    )
    SELECT
        a."ID" AS "ID",
        a."LevelUp",
        a."Path"
    FROM
        CTE_Ancestors a
);

CREATE FUNCTION "__mj_BizAppsAccounting"."fnGLAccountParentGLAccountID_GetRootID"
(
    p_RecordID UUID,
    p_ParentID UUID
)
RETURNS TABLE
AS
RETURN
(
    WITH CTE_RootParent AS (
        SELECT
            "ID",
            "ParentGLAccountID",
            "ID" AS "RootParentID",
            0 AS "Depth"
        FROM
            "__mj_BizAppsAccounting"."GLAccount"
        WHERE
            "ID" = COALESCE(p_ParentID, p_RecordID)

        UNION ALL

        SELECT
            c."ID",
            c."ParentGLAccountID",
            c."ID" AS "RootParentID",
            p."Depth" + 1 AS "Depth"
        FROM
            "__mj_BizAppsAccounting"."GLAccount" c
        INNER JOIN
            CTE_RootParent p ON c."ID" = p."ParentGLAccountID"
        WHERE
            p."Depth" < 100
    )
    SELECT         "RootParentID" AS RootID
    FROM
        CTE_RootParent
    WHERE
        "ParentGLAccountID" IS NULL
    ORDER BY
        "RootParentID"

LIMIT 1);


-- ===================== Views =====================

DO $do$
DECLARE
  v_target_schema CONSTANT TEXT := '__mj_BizAppsAccounting';
  v_target_name CONSTANT TEXT := 'vwGLAccounts';
  vsql CONSTANT TEXT := $vsql$CREATE OR REPLACE VIEW "__mj_BizAppsAccounting"."vwGLAccounts"
AS SELECT
    g.*,
    "MJCompany_CompanyID"."Name" AS "Company",
    "mjBizAppsAccountingGLAccount_ParentGLAccountID"."Name" AS "ParentGLAccount",
    "mjBizAppsAccountingCurrency_CurrencyCode"."Name" AS "CurrencyCode_Virtual",
    "hier_ParentGLAccountID"."RootID" AS "RootParentGLAccountID",
    "hier_ParentGLAccountID"."Depth" AS "ParentGLAccountIDDepth",
    "hier_ParentGLAccountID"."Path" AS "ParentGLAccountIDPath",
    "hier_ParentGLAccountID"."IsLeaf" AS "ParentGLAccountIDIsLeaf",
    "hier_ParentGLAccountID"."ChildCount" AS "ParentGLAccountIDChildCount"
FROM
    "__mj_BizAppsAccounting"."GLAccount" AS g
INNER JOIN
    ${mjSchema}."Company" AS "MJCompany_CompanyID"
  ON
    g."CompanyID" = "MJCompany_CompanyID"."ID"
LEFT OUTER JOIN
    "__mj_BizAppsAccounting"."GLAccount" AS "mjBizAppsAccountingGLAccount_ParentGLAccountID"
  ON
    g."ParentGLAccountID" = "mjBizAppsAccountingGLAccount_ParentGLAccountID"."ID"
LEFT OUTER JOIN
    "__mj_BizAppsAccounting"."Currency" AS "mjBizAppsAccountingCurrency_CurrencyCode"
  ON
    g."CurrencyCode" = "mjBizAppsAccountingCurrency_CurrencyCode"."Code"
LEFT JOIN LATERAL (SELECT * FROM "__mj_BizAppsAccounting"."fnGLAccountParentGLAccountID_GetHierarchyMeta"(g."ID", g."ParentGLAccountID")) AS "hier_ParentGLAccountID"
    ON TRUE$vsql$;
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
-- CREATE PROCEDURE [__mj_BizAppsAccounting].[spCreateGLAccount]
--     @ID UUID = NULL,
--     @CompanyID UUID,
--     @Code VARCHAR(40),
--     @Name VARCHAR(200),
--     @AccountType nvarch...

-- SKIPPED: procedure (auto-conversion not supported)
-- CREATE PROCEDURE [__mj_BizAppsAccounting].[spUpdateGLAccount]
--     @ID UUID,
--     @CompanyID UUID = NULL,
--     @Code VARCHAR(40) = NULL,
--     @Name VARCHAR(200) = NULL,
--     @Acco...

-- SKIPPED: procedure (auto-conversion not supported)
-- CREATE PROCEDURE [__mj_BizAppsAccounting].[spDeleteGLAccount]
--     @ID UUID
-- AS
-- BEGIN
--     SET NOCOUNT ON;
-- 
--     DELETE FROM
--         [__mj_BizAppsAccounting].[GLAccount]
--     WHERE
--         [ID]...


-- ===================== Triggers =====================

-- SKIPPED: trigger (auto-conversion not supported)
-- CREATE TRIGGER [__mj_BizAppsAccounting].trgUpdateGLAccount
ON "__mj_BizAppsAccounting"."GLAccount"
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        "__mj_BizAppsAccounting"."GLAccount"
   


-- ===================== Data (INSERT/UPDATE/DELETE) =====================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = '7079a8d4-1616-4cad-94fd-e60deee37a61' OR ("EntityID" = '690BE4C8-C8F2-4067-B48B-57C0671B05A5' AND "Name" = 'ExternalBankAccountNumber')
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
        '7079a8d4-1616-4cad-94fd-e60deee37a61',
        '690BE4C8-C8F2-4067-B48B-57C0671B05A5', -- "Entity": "MJ_BizApps_Accounting": "GL" "Accounts"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = '690BE4C8-C8F2-4067-B48B-57C0671B05A5'),
        'ExternalBankAccountNumber',
        'External Bank Account Number',
        'The No. of the Business Central bank account this GL account sits behind. When set, a journal entry batch sends this account''s lines to Business Central as Bank Account lines with this No., so they post through the bank ledger and the bank''s posting group. NULL posts them as G/L Account lines. Business Central only; asset accounts only.',
        'TEXT',
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
        NOW(),
        NOW()
        );
    END IF;
END $$;

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Integration Details',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = '7079A8D4-1616-4CAD-94FD-E60DEEE37A61';


-- ===================== Grants =====================

DO $$ BEGIN REVOKE SELECT ON "__mj_BizAppsAccounting"."vwGLAccounts" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE SELECT ON "__mj_BizAppsAccounting"."vwGLAccounts" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE SELECT ON "__mj_BizAppsAccounting"."vwGLAccounts" FROM "cdp_UI"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT ON "__mj_BizAppsAccounting"."vwGLAccounts" TO "cdp_UI", "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* Base View Permissions SQL for MJ_BizApps_Accounting: GL Accounts */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: GL Accounts
-- Item: Permissions for vwGLAccounts
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------;

DO $$ BEGIN REVOKE SELECT ON "__mj_BizAppsAccounting"."vwGLAccounts" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE SELECT ON "__mj_BizAppsAccounting"."vwGLAccounts" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE SELECT ON "__mj_BizAppsAccounting"."vwGLAccounts" FROM "cdp_UI"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT ON "__mj_BizAppsAccounting"."vwGLAccounts" TO "cdp_UI", "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
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
------------------------------------------------------------;

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spCreateGLAccount" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spCreateGLAccount" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spCreateGLAccount" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* spCreate Permissions for MJ_BizApps_Accounting: GL Accounts */

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spCreateGLAccount" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spCreateGLAccount" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spCreateGLAccount" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
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
------------------------------------------------------------;

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spUpdateGLAccount" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spUpdateGLAccount" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spUpdateGLAccount" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spUpdateGLAccount" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spUpdateGLAccount" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spUpdateGLAccount" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
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
------------------------------------------------------------;

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spDeleteGLAccount" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spDeleteGLAccount" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spDeleteGLAccount" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* spDelete Permissions for MJ_BizApps_Accounting: GL Accounts */

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spDeleteGLAccount" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spDeleteGLAccount" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spDeleteGLAccount" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* Set categories for 1 fields */

-- UPDATE Entity Field Category Info MJ_BizApps_Accounting: GL Accounts.ExternalBankAccountNumber;


-- ===================== Comments =====================

COMMENT ON COLUMN "__mj_BizAppsAccounting"."GLAccount"."ExternalBankAccountNumber" IS 'The No. of the Business Central bank account this GL account sits behind. When set, a journal entry batch sends this account''s lines to Business Central as Bank Account lines with this No., so they post through the bank ledger and the bank''s posting group. NULL posts them as G/L Account lines. Business Central only; asset accounts only.';


-- ===================== Other =====================

-- =============================================================================
-- CODEGEN OUTPUT — GENERATED CODE BELOW THIS LINE. DO NOT EDIT BY HAND.
-- =============================================================================

/* SQL text to update existing entities from schema */

/* spUpdate Permissions for MJ_BizApps_Accounting: GL Accounts */
