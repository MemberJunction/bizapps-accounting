-- ============================================================================
-- MemberJunction PostgreSQL Migration
-- Converted from SQL Server using TypeScript conversion pipeline
-- ============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Schema
--
-- The schema name is quoted so it keeps its case. `mj migrate --schema` (Skyway) and the Open App
-- installer create the schema quoted, and MJ quotes it in runtime SQL. Unquoted, PostgreSQL folds it
-- to __mj_bizappsaccounting, a different and empty schema. The converter emits it unquoted, so the
-- quotes are added after conversion (see migrations-pg/README.md).
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
-- GLAccount.IsControlAccount (BOOLEAN, default 0): the accounts whose manual entries
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
-- "ApprovalLevel IS NOT NULL", and a BOOLEAN compared to a literal inside a CHECK
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
-- trg_JournalEntry_ApprovalIntegrity is the floor under the approval columns
-- themselves and under the origin pair: never approved by the requester, a
-- stamp only from the Approval CFO or an approver-role holder on an entry with
-- an approval Task, no level cleared while the company has a threshold, the
-- approval frozen once Batched/GLPosted, and the origin pair fixed after
-- insert (50035-50039).
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

ALTER TABLE "__mj_BizAppsAccounting"."GLAccount"
 ADD COLUMN IF NOT EXISTS "IsControlAccount" BOOLEAN NOT NULL CONSTRAINT "DF_GLAccount_IsControlAccount" DEFAULT FALSE;

ALTER TABLE "__mj_BizAppsAccounting"."AccountingCompanyProfile"
 ADD COLUMN IF NOT EXISTS "ManualJournalEntryApprovalThreshold" DECIMAL(19,4) NULL
            CONSTRAINT "CK_AccountingCompanyProfile_ManualJEApprovalThreshold"
            CHECK ("ManualJournalEntryApprovalThreshold" IS NULL OR "ManualJournalEntryApprovalThreshold" >= 0),
 ADD COLUMN IF NOT EXISTS "ManualJournalEntryApproverRoleID" UUID NULL
            CONSTRAINT "FK_AccountingCompanyProfile_ManualJEApproverRole" REFERENCES __mj."Role"("ID");

ALTER TABLE "__mj_BizAppsAccounting"."JournalEntry"
 ADD COLUMN IF NOT EXISTS "ApprovalLevel" VARCHAR(20) NULL
            CONSTRAINT "CK_JournalEntry_ApprovalLevel" CHECK ("ApprovalLevel" IN ('Standard','CFO')),
 ADD COLUMN IF NOT EXISTS "ApprovalRequestedByUserID" UUID NULL
            CONSTRAINT "FK_JournalEntry_ApprovalRequestedByUser" REFERENCES __mj."User"("ID"),
 ADD COLUMN IF NOT EXISTS "ApprovalTaskID" UUID NULL
            CONSTRAINT "FK_JournalEntry_ApprovalTask" REFERENCES __mj_BizAppsTasks."Task"("ID"),
 ADD COLUMN IF NOT EXISTS "ApprovedAt" TIMESTAMPTZ NULL,
 ADD COLUMN IF NOT EXISTS "ApprovedByUserID" UUID NULL
            CONSTRAINT "FK_JournalEntry_ApprovedByUser" REFERENCES __mj."User"("ID"),
 ADD CONSTRAINT "CK_JournalEntry_ApprovalRequester" CHECK (
            ("ApprovalLevel" IS NULL AND "ApprovalRequestedByUserID" IS NULL) OR
            ("ApprovalLevel" IS NOT NULL AND "ApprovalRequestedByUserID" IS NOT NULL)
        ) NOT VALID,
 ADD CONSTRAINT "CK_JournalEntry_ApprovalAudit" CHECK (
            ("ApprovedAt" IS NULL AND "ApprovedByUserID" IS NULL) OR
            ("ApprovedAt" IS NOT NULL AND "ApprovedByUserID" IS NOT NULL AND "ApprovalLevel" IS NOT NULL)
        ) NOT VALID,
 ADD CONSTRAINT "CK_JournalEntry_ApprovedBeforeBatch" CHECK (
            "ApprovalLevel" IS NULL OR "ApprovedAt" IS NOT NULL OR "JournalEntryBatchID" IS NULL
        ) NOT VALID;

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_AccountingCompanyProfile_FunctionalCu_98e9c0ae" ON "__mj_BizAppsAccounting"."AccountingCompanyProfile" ("FunctionalCurrencyCode");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_AccountingCompanyProfile_ReportingCurrencyCode" ON "__mj_BizAppsAccounting"."AccountingCompanyProfile" ("ReportingCurrencyCode");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_AccountingCompanyProfile_ParentAccoun_010bb056" ON "__mj_BizAppsAccounting"."AccountingCompanyProfile" ("ParentAccountingCompanyID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_AccountingCompanyProfile_ApprovalCFOUserID" ON "__mj_BizAppsAccounting"."AccountingCompanyProfile" ("ApprovalCFOUserID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_AccountingCompanyProfile_ManualJourna_ac02941c" ON "__mj_BizAppsAccounting"."AccountingCompanyProfile" ("ManualJournalEntryApproverRoleID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_GLAccount_CompanyID" ON "__mj_BizAppsAccounting"."GLAccount" ("CompanyID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_GLAccount_ParentGLAccountID" ON "__mj_BizAppsAccounting"."GLAccount" ("ParentGLAccountID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_GLAccount_CurrencyCode" ON "__mj_BizAppsAccounting"."GLAccount" ("CurrencyCode");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_JournalEntry_CompanyID" ON "__mj_BizAppsAccounting"."JournalEntry" ("CompanyID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_JournalEntry_EntryTypeID" ON "__mj_BizAppsAccounting"."JournalEntry" ("EntryTypeID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_JournalEntry_LinkedEntityID" ON "__mj_BizAppsAccounting"."JournalEntry" ("LinkedEntityID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_JournalEntry_ReversesJournalEntryID" ON "__mj_BizAppsAccounting"."JournalEntry" ("ReversesJournalEntryID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_JournalEntry_ReversedByJournalEntryID" ON "__mj_BizAppsAccounting"."JournalEntry" ("ReversedByJournalEntryID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_JournalEntry_JournalEntryBatchID" ON "__mj_BizAppsAccounting"."JournalEntry" ("JournalEntryBatchID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_JournalEntry_FileID" ON "__mj_BizAppsAccounting"."JournalEntry" ("FileID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_JournalEntry_ApprovalRequestedByUserID" ON "__mj_BizAppsAccounting"."JournalEntry" ("ApprovalRequestedByUserID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_JournalEntry_ApprovalTaskID" ON "__mj_BizAppsAccounting"."JournalEntry" ("ApprovalTaskID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_JournalEntry_ApprovedByUserID" ON "__mj_BizAppsAccounting"."JournalEntry" ("ApprovedByUserID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_JournalEntry_CompanyID" ON "__mj_BizAppsAccounting"."JournalEntry" ("CompanyID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_JournalEntry_EntryTypeID" ON "__mj_BizAppsAccounting"."JournalEntry" ("EntryTypeID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_JournalEntry_LinkedEntityID" ON "__mj_BizAppsAccounting"."JournalEntry" ("LinkedEntityID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_JournalEntry_ReversesJournalEntryID" ON "__mj_BizAppsAccounting"."JournalEntry" ("ReversesJournalEntryID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_JournalEntry_ReversedByJournalEntryID" ON "__mj_BizAppsAccounting"."JournalEntry" ("ReversedByJournalEntryID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_JournalEntry_JournalEntryBatchID" ON "__mj_BizAppsAccounting"."JournalEntry" ("JournalEntryBatchID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_JournalEntry_FileID" ON "__mj_BizAppsAccounting"."JournalEntry" ("FileID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_JournalEntry_ApprovalRequestedByUserID" ON "__mj_BizAppsAccounting"."JournalEntry" ("ApprovalRequestedByUserID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_JournalEntry_ApprovalTaskID" ON "__mj_BizAppsAccounting"."JournalEntry" ("ApprovalTaskID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_JournalEntry_ApprovedByUserID" ON "__mj_BizAppsAccounting"."JournalEntry" ("ApprovedByUserID");


-- ===================== Helper Functions (fn*) =====================

CREATE FUNCTION "__mj_BizAppsAccounting"."fnAccountingCompanyProfileParentAccountingCompanyID_GetHierarchyMeta"
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
            "ParentAccountingCompanyID",
            0 AS "Depth",
            CAST('/' || CAST("ID" AS VARCHAR(36)) || '/' AS TEXT) AS "Path"
        FROM
            "__mj_BizAppsAccounting"."AccountingCompanyProfile"
        WHERE
            "ID" = p_RecordID

        UNION ALL

        SELECT
            p."ID",
            p."ParentAccountingCompanyID",
            c."Depth" + 1 AS "Depth",
            CAST('/' || CAST(p."ID" AS VARCHAR(36)) || c."Path" AS TEXT) AS "Path"
        FROM
            "__mj_BizAppsAccounting"."AccountingCompanyProfile" p
        INNER JOIN
            CTE_Ancestors c ON p."ID" = c."ParentAccountingCompanyID"
        WHERE
            c."Depth" < 100
    )
    SELECT         a."ID" AS "RootID",
        (SELECT MAX("Depth") FROM CTE_Ancestors) AS "Depth",
        (SELECT "Path" FROM CTE_Ancestors ORDER BY "Depth" DESC
LIMIT 1) AS "Path",
        CAST(CASE WHEN EXISTS (SELECT 1 FROM "__mj_BizAppsAccounting"."AccountingCompanyProfile" WHERE "ParentAccountingCompanyID" = p_RecordID) THEN 0 ELSE 1 END AS BOOLEAN) AS "IsLeaf",
        (SELECT COUNT(1) FROM "__mj_BizAppsAccounting"."AccountingCompanyProfile" WHERE "ParentAccountingCompanyID" = p_RecordID) AS "ChildCount"
    FROM
        CTE_Ancestors a
    WHERE
        a."ParentAccountingCompanyID" IS NULL OR p_ParentID IS NULL
    ORDER BY
        a."Depth" DESC

LIMIT 1);

CREATE FUNCTION "__mj_BizAppsAccounting"."fnAccountingCompanyProfileParentAccountingCompanyID_GetDescendants"
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
            "ParentAccountingCompanyID",
            0 AS "RelativeDepth",
            CAST('/' || CAST("ID" AS VARCHAR(36)) || '/' AS TEXT) AS "Path"
        FROM
            "__mj_BizAppsAccounting"."AccountingCompanyProfile"
        WHERE
            "ID" = p_RootID

        UNION ALL

        SELECT
            c."ID",
            c."ParentAccountingCompanyID",
            p."RelativeDepth" || 1 AS "RelativeDepth",
            CAST(p."Path" || CAST(c."ID" AS VARCHAR(36)) || '/' AS TEXT) AS "Path"
        FROM
            "__mj_BizAppsAccounting"."AccountingCompanyProfile" c
        INNER JOIN
            CTE_Descendants p ON c."ParentAccountingCompanyID" = p."ID"
        WHERE
            (p_MaxDepth IS NULL OR p."RelativeDepth" < p_MaxDepth)
            AND p."RelativeDepth" < 100
    )
    SELECT
        d."ID" AS "ID",
        d."RelativeDepth" AS "Depth",
        d."Path",
        CAST(CASE WHEN EXISTS (SELECT 1 FROM "__mj_BizAppsAccounting"."AccountingCompanyProfile" WHERE "ParentAccountingCompanyID" = d."ID") THEN 0 ELSE 1 END AS BOOLEAN) AS "IsLeaf",
        (SELECT COUNT(1) FROM "__mj_BizAppsAccounting"."AccountingCompanyProfile" WHERE "ParentAccountingCompanyID" = d."ID") AS "ChildCount"
    FROM
        CTE_Descendants d
);

CREATE FUNCTION "__mj_BizAppsAccounting"."fnAccountingCompanyProfileParentAccountingCompanyID_GetAncestors"
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
            "ParentAccountingCompanyID",
            0 AS "LevelUp",
            CAST('/' || CAST("ID" AS VARCHAR(36)) || '/' AS TEXT) AS "Path"
        FROM
            "__mj_BizAppsAccounting"."AccountingCompanyProfile"
        WHERE
            "ID" = p_RecordID

        UNION ALL

        SELECT
            p."ID",
            p."ParentAccountingCompanyID",
            c."LevelUp" + 1 AS "LevelUp",
            CAST('/' || CAST(p."ID" AS VARCHAR(36)) || c."Path" AS TEXT) AS "Path"
        FROM
            "__mj_BizAppsAccounting"."AccountingCompanyProfile" p
        INNER JOIN
            CTE_Ancestors c ON p."ID" = c."ParentAccountingCompanyID"
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

CREATE FUNCTION "__mj_BizAppsAccounting"."fnAccountingCompanyProfileParentAccountingCompanyID_GetRootID"
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
            "ParentAccountingCompanyID",
            "ID" AS "RootParentID",
            0 AS "Depth"
        FROM
            "__mj_BizAppsAccounting"."AccountingCompanyProfile"
        WHERE
            "ID" = COALESCE(p_ParentID, p_RecordID)

        UNION ALL

        SELECT
            c."ID",
            c."ParentAccountingCompanyID",
            c."ID" AS "RootParentID",
            p."Depth" + 1 AS "Depth"
        FROM
            "__mj_BizAppsAccounting"."AccountingCompanyProfile" c
        INNER JOIN
            CTE_RootParent p ON c."ID" = p."ParentAccountingCompanyID"
        WHERE
            p."Depth" < 100
    )
    SELECT         "RootParentID" AS RootID
    FROM
        CTE_RootParent
    WHERE
        "ParentAccountingCompanyID" IS NULL
    ORDER BY
        "RootParentID"

LIMIT 1);

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
  v_target_name CONSTANT TEXT := 'vwAccountingCompanyProfiles';
  vsql CONSTANT TEXT := $vsql$CREATE OR REPLACE VIEW "__mj_BizAppsAccounting"."vwAccountingCompanyProfiles"
AS SELECT
    a.*,
    ${mjSchema}_isa_p1."Name",
    ${mjSchema}_isa_p1."Description",
    ${mjSchema}_isa_p1."Website",
    ${mjSchema}_isa_p1."LogoURL",
    ${mjSchema}_isa_p1."Domain",
    "mjBizAppsAccountingCurrency_FunctionalCurrencyCode"."Name" AS "FunctionalCurrencyCode_Virtual",
    "mjBizAppsAccountingCurrency_ReportingCurrencyCode"."Name" AS "ReportingCurrencyCode_Virtual",
    "MJUser_ApprovalCFOUserID"."Name" AS "ApprovalCFOUser",
    "MJRole_ManualJournalEntryApproverRoleID"."Name" AS "ManualJournalEntryApproverRole",
    ${mjSchema}_rgc."Latitude" AS "${mjSchema}_Latitude",
    ${mjSchema}_rgc."Longitude" AS "${mjSchema}_Longitude",
    "hier_ParentAccountingCompanyID"."RootID" AS "RootParentAccountingCompanyID",
    "hier_ParentAccountingCompanyID"."Depth" AS "ParentAccountingCompanyIDDepth",
    "hier_ParentAccountingCompanyID"."Path" AS "ParentAccountingCompanyIDPath",
    "hier_ParentAccountingCompanyID"."IsLeaf" AS "ParentAccountingCompanyIDIsLeaf",
    "hier_ParentAccountingCompanyID"."ChildCount" AS "ParentAccountingCompanyIDChildCount"
FROM
    "__mj_BizAppsAccounting"."AccountingCompanyProfile" AS a
INNER JOIN
    ${mjSchema}."Company" AS ${mjSchema}_isa_p1
  ON
    a."ID" = ${mjSchema}_isa_p1."ID"
INNER JOIN
    "__mj_BizAppsAccounting"."Currency" AS "mjBizAppsAccountingCurrency_FunctionalCurrencyCode"
  ON
    a."FunctionalCurrencyCode" = "mjBizAppsAccountingCurrency_FunctionalCurrencyCode"."Code"
LEFT OUTER JOIN
    "__mj_BizAppsAccounting"."Currency" AS "mjBizAppsAccountingCurrency_ReportingCurrencyCode"
  ON
    a."ReportingCurrencyCode" = "mjBizAppsAccountingCurrency_ReportingCurrencyCode"."Code"
LEFT OUTER JOIN
    ${mjSchema}."User" AS "MJUser_ApprovalCFOUserID"
  ON
    a."ApprovalCFOUserID" = "MJUser_ApprovalCFOUserID"."ID"
LEFT OUTER JOIN
    ${mjSchema}."Role" AS "MJRole_ManualJournalEntryApproverRoleID"
  ON
    a."ManualJournalEntryApproverRoleID" = "MJRole_ManualJournalEntryApproverRoleID"."ID"
LEFT OUTER JOIN
    ${mjSchema}."vwRecordGeoCodes" AS ${mjSchema}_rgc
  ON
    ${mjSchema}_rgc."EntityID" = '3E551198-AB66-478E-BEB6-C34EDBE242EC'
    AND ${mjSchema}_rgc."RecordID" = CAST(a."ID" AS VARCHAR(450))
    AND ${mjSchema}_rgc."LocationType" = 'Primary'
LEFT JOIN LATERAL (SELECT * FROM "__mj_BizAppsAccounting"."fnAccountingCompanyProfileParentAccountingCompanyID_GetHierarchyMeta"(a."ID", a."ParentAccountingCompanyID")) AS "hier_ParentAccountingCompanyID"
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

DO $do$
DECLARE
  v_target_schema CONSTANT TEXT := '__mj_BizAppsAccounting';
  v_target_name CONSTANT TEXT := 'vwJournalEntriesGenerated';
  vsql CONSTANT TEXT := $vsql$CREATE OR REPLACE VIEW "__mj_BizAppsAccounting"."vwJournalEntriesGenerated"
AS SELECT
    j.*,
    "MJCompany_CompanyID"."Name" AS "Company",
    "mjBizAppsAccountingJournalEntryType_EntryTypeID"."Name" AS "EntryType",
    "MJEntity_LinkedEntityID"."Name" AS "LinkedEntity",
    "mjBizAppsAccountingJournalEntry_ReversesJournalEntryID"."EntryNumber" AS "ReversesJournalEntry",
    "mjBizAppsAccountingJournalEntry_ReversedByJournalEntryID"."EntryNumber" AS "ReversedByJournalEntry",
    "mjBizAppsAccountingJournalEntryBatch_JournalEntryBatchID"."JournalEntryBatchNumber" AS "JournalEntryBatch",
    "MJFile_FileID"."Name" AS "File",
    "MJUser_ApprovalRequestedByUserID"."Name" AS "ApprovalRequestedByUser",
    "mjBizAppsTasksTask_ApprovalTaskID"."Name" AS "ApprovalTask",
    "MJUser_ApprovedByUserID"."Name" AS "ApprovedByUser"
FROM
    "__mj_BizAppsAccounting"."JournalEntry" AS j
INNER JOIN
    ${mjSchema}."Company" AS "MJCompany_CompanyID"
  ON
    j."CompanyID" = "MJCompany_CompanyID"."ID"
INNER JOIN
    "__mj_BizAppsAccounting"."JournalEntryType" AS "mjBizAppsAccountingJournalEntryType_EntryTypeID"
  ON
    j."EntryTypeID" = "mjBizAppsAccountingJournalEntryType_EntryTypeID"."ID"
LEFT OUTER JOIN
    ${mjSchema}."Entity" AS "MJEntity_LinkedEntityID"
  ON
    j."LinkedEntityID" = "MJEntity_LinkedEntityID"."ID"
LEFT OUTER JOIN
    "__mj_BizAppsAccounting"."JournalEntry" AS "mjBizAppsAccountingJournalEntry_ReversesJournalEntryID"
  ON
    j."ReversesJournalEntryID" = "mjBizAppsAccountingJournalEntry_ReversesJournalEntryID"."ID"
LEFT OUTER JOIN
    "__mj_BizAppsAccounting"."JournalEntry" AS "mjBizAppsAccountingJournalEntry_ReversedByJournalEntryID"
  ON
    j."ReversedByJournalEntryID" = "mjBizAppsAccountingJournalEntry_ReversedByJournalEntryID"."ID"
LEFT OUTER JOIN
    "__mj_BizAppsAccounting"."JournalEntryBatch" AS "mjBizAppsAccountingJournalEntryBatch_JournalEntryBatchID"
  ON
    j."JournalEntryBatchID" = "mjBizAppsAccountingJournalEntryBatch_JournalEntryBatchID"."ID"
LEFT OUTER JOIN
    ${mjSchema}."File" AS "MJFile_FileID"
  ON
    j."FileID" = "MJFile_FileID"."ID"
LEFT OUTER JOIN
    ${mjSchema}."User" AS "MJUser_ApprovalRequestedByUserID"
  ON
    j."ApprovalRequestedByUserID" = "MJUser_ApprovalRequestedByUserID"."ID"
LEFT OUTER JOIN
    "${mjSchema}_BizAppsTasks"."Task" AS "mjBizAppsTasksTask_ApprovalTaskID"
  ON
    j."ApprovalTaskID" = "mjBizAppsTasksTask_ApprovalTaskID"."ID"
LEFT OUTER JOIN
    ${mjSchema}."User" AS "MJUser_ApprovedByUserID"
  ON
    j."ApprovedByUserID" = "MJUser_ApprovedByUserID"."ID"$vsql$;
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
  v_target_name CONSTANT TEXT := 'vwJournalEntriesGenerated';
  vsql CONSTANT TEXT := $vsql$CREATE OR REPLACE VIEW "__mj_BizAppsAccounting"."vwJournalEntriesGenerated"
AS SELECT
    j.*,
    "MJCompany_CompanyID"."Name" AS "Company",
    "mjBizAppsAccountingJournalEntryType_EntryTypeID"."Name" AS "EntryType",
    "MJEntity_LinkedEntityID"."Name" AS "LinkedEntity",
    "mjBizAppsAccountingJournalEntry_ReversesJournalEntryID"."EntryNumber" AS "ReversesJournalEntry",
    "mjBizAppsAccountingJournalEntry_ReversedByJournalEntryID"."EntryNumber" AS "ReversedByJournalEntry",
    "mjBizAppsAccountingJournalEntryBatch_JournalEntryBatchID"."JournalEntryBatchNumber" AS "JournalEntryBatch",
    "MJFile_FileID"."Name" AS "File",
    "MJUser_ApprovalRequestedByUserID"."Name" AS "ApprovalRequestedByUser",
    "mjBizAppsTasksTask_ApprovalTaskID"."Name" AS "ApprovalTask",
    "MJUser_ApprovedByUserID"."Name" AS "ApprovedByUser"
FROM
    "__mj_BizAppsAccounting"."JournalEntry" AS j
INNER JOIN
    ${mjSchema}."Company" AS "MJCompany_CompanyID"
  ON
    j."CompanyID" = "MJCompany_CompanyID"."ID"
INNER JOIN
    "__mj_BizAppsAccounting"."JournalEntryType" AS "mjBizAppsAccountingJournalEntryType_EntryTypeID"
  ON
    j."EntryTypeID" = "mjBizAppsAccountingJournalEntryType_EntryTypeID"."ID"
LEFT OUTER JOIN
    ${mjSchema}."Entity" AS "MJEntity_LinkedEntityID"
  ON
    j."LinkedEntityID" = "MJEntity_LinkedEntityID"."ID"
LEFT OUTER JOIN
    "__mj_BizAppsAccounting"."JournalEntry" AS "mjBizAppsAccountingJournalEntry_ReversesJournalEntryID"
  ON
    j."ReversesJournalEntryID" = "mjBizAppsAccountingJournalEntry_ReversesJournalEntryID"."ID"
LEFT OUTER JOIN
    "__mj_BizAppsAccounting"."JournalEntry" AS "mjBizAppsAccountingJournalEntry_ReversedByJournalEntryID"
  ON
    j."ReversedByJournalEntryID" = "mjBizAppsAccountingJournalEntry_ReversedByJournalEntryID"."ID"
LEFT OUTER JOIN
    "__mj_BizAppsAccounting"."JournalEntryBatch" AS "mjBizAppsAccountingJournalEntryBatch_JournalEntryBatchID"
  ON
    j."JournalEntryBatchID" = "mjBizAppsAccountingJournalEntryBatch_JournalEntryBatchID"."ID"
LEFT OUTER JOIN
    ${mjSchema}."File" AS "MJFile_FileID"
  ON
    j."FileID" = "MJFile_FileID"."ID"
LEFT OUTER JOIN
    ${mjSchema}."User" AS "MJUser_ApprovalRequestedByUserID"
  ON
    j."ApprovalRequestedByUserID" = "MJUser_ApprovalRequestedByUserID"."ID"
LEFT OUTER JOIN
    "${mjSchema}_BizAppsTasks"."Task" AS "mjBizAppsTasksTask_ApprovalTaskID"
  ON
    j."ApprovalTaskID" = "mjBizAppsTasksTask_ApprovalTaskID"."ID"
LEFT OUTER JOIN
    ${mjSchema}."User" AS "MJUser_ApprovedByUserID"
  ON
    j."ApprovedByUserID" = "MJUser_ApprovedByUserID"."ID"$vsql$;
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
-- CREATE PROCEDURE [__mj_BizAppsAccounting].[spCreateAccountingCompanyProfile]
--     @ID UUID = NULL,
--     @EntityType VARCHAR(30) = NULL,
--     @LegalStructureType_Clear bit = 0,
--     @LegalStru...

-- SKIPPED: procedure (auto-conversion not supported)
-- CREATE PROCEDURE [__mj_BizAppsAccounting].[spUpdateAccountingCompanyProfile]
--     @ID UUID,
--     @EntityType VARCHAR(30) = NULL,
--     @LegalStructureType_Clear bit = 0,
--     @LegalStructureTy...

-- SKIPPED: procedure (auto-conversion not supported)
-- CREATE PROCEDURE [__mj_BizAppsAccounting].[spDeleteAccountingCompanyProfile]
--     @ID UUID
-- AS
-- BEGIN
--     SET NOCOUNT ON;
-- 
--     DELETE FROM
--         [__mj_BizAppsAccounting].[AccountingCompanyP...

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
-- -- -----------------------------------------------------------------------------
-- trg_JournalEntry_ApprovalIntegrity — the database floor under the approval
-- columns and the origin pair (PR #463 r

-- SKIPPED: trigger (auto-conversion not supported)
-- CREATE TRIGGER [__mj_BizAppsAccounting].trgUpdateAccountingCompanyProfile
ON "__mj_BizAppsAccounting"."AccountingCompanyProfile"
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        "__mj_BizA

-- SKIPPED: trigger (auto-conversion not supported)
-- CREATE TRIGGER [__mj_BizAppsAccounting".trgUpdateGLAccount
ON "__mj_BizAppsAccounting"."GLAccount"
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        "__mj_BizAppsAccounting"."GLAccount"
   

-- SKIPPED: trigger (auto-conversion not supported)
-- CREATE TRIGGER [__mj_BizAppsAccounting].trgUpdateJournalEntry
ON "__mj_BizAppsAccounting"."JournalEntry"
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        "__mj_BizAppsAccounting"."JournalE

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

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = 'dcae4c02-26ff-41e1-af26-9e379453e38c' OR ("EntityID" = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762' AND "Name" = 'ApprovalLevel')
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
        'dcae4c02-26ff-41e1-af26-9e379453e38c',
        'C040A1FC-16CE-49CB-B0E2-4F233BD0D762', -- "Entity": "MJ_BizApps_Accounting": "Journal" "Entries"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762'),
        'ApprovalLevel',
        'Approval Level',
        'Set when the entry needs approval: Standard (a holder of the company''s manual-entry approver role) or CFO (above the threshold, a line on a control account, or no other approver available). Set when a manual entry is created, or its amounts, accounts, date or company change, while its company has a ManualJournalEntryApprovalThreshold. An entry with a level is not a batch candidate until ApprovedAt is set. NULL: no approval needed.',
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

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = 'd2a395b8-61b0-4209-aa5e-c5e896b0c214' OR ("EntityID" = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762' AND "Name" = 'ApprovalRequestedByUserID')
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
        'd2a395b8-61b0-4209-aa5e-c5e896b0c214',
        'C040A1FC-16CE-49CB-B0E2-4F233BD0D762', -- "Entity": "MJ_BizApps_Accounting": "Journal" "Entries"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762'),
        'ApprovalRequestedByUserID',
        'Approval Requested By User ID',
        'The user whose save raised the current approval request: the creator, or whoever last changed the entry''s amounts, accounts, date or company. That user may not approve it. Set exactly when ApprovalLevel is.',
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
        'E1238F34-2837-EF11-86D4-6045BDEE16E6',
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
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = '3b9807de-48e1-40cb-977d-f78c79b23d90' OR ("EntityID" = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762' AND "Name" = 'ApprovalTaskID')
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
        '3b9807de-48e1-40cb-977d-f78c79b23d90',
        'C040A1FC-16CE-49CB-B0E2-4F233BD0D762', -- "Entity": "MJ_BizApps_Accounting": "Journal" "Entries"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762'),
        'ApprovalTaskID',
        'Approval Task ID',
        'The approval Task raised for this manual entry, stamped in the same transaction. The approval is read from this column, never from a Task Link.',
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
        'B348FFA2-B1A7-4AC2-B6FD-F4E0C0697466',
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
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = '9027a89c-ab6c-41fc-8636-943aba82ad8e' OR ("EntityID" = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762' AND "Name" = 'ApprovedAt')
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
        '9027a89c-ab6c-41fc-8636-943aba82ad8e',
        'C040A1FC-16CE-49CB-B0E2-4F233BD0D762', -- "Entity": "MJ_BizApps_Accounting": "Journal" "Entries"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762'),
        'ApprovedAt',
        'Approved At',
        'When the manual entry was approved. Set together with ApprovedByUserID, only on an entry with an ApprovalLevel; cleared when the entry''s amounts, accounts, date or company change afterwards.',
        'TIMESTAMPTZ',
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
        NOW(),
        NOW()
        );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = '19391880-f1a2-424e-838e-97b3929b4fd6' OR ("EntityID" = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762' AND "Name" = 'ApprovedByUserID')
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
        '19391880-f1a2-424e-838e-97b3929b4fd6',
        'C040A1FC-16CE-49CB-B0E2-4F233BD0D762', -- "Entity": "MJ_BizApps_Accounting": "Journal" "Entries"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762'),
        'ApprovedByUserID',
        'Approved By User ID',
        'The user who approved the manual entry: never ApprovalRequestedByUserID. Set together with ApprovedAt.',
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
        'E1238F34-2837-EF11-86D4-6045BDEE16E6',
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
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = 'e4505aff-df19-41cd-bc3a-137341a72fbc' OR ("EntityID" = '690BE4C8-C8F2-4067-B48B-57C0671B05A5' AND "Name" = 'IsControlAccount')
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
        'e4505aff-df19-41cd-bc3a-137341a72fbc',
        '690BE4C8-C8F2-4067-B48B-57C0671B05A5', -- "Entity": "MJ_BizApps_Accounting": "GL" "Accounts"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = '690BE4C8-C8F2-4067-B48B-57C0671B05A5'),
        'IsControlAccount',
        'Is Control Account',
        'A control account (AR, deferred revenue, unbilled, customer deposits, cash, or any account the company names): a manual journal entry with a line on it always needs the company''s Approval CFO, whatever its amount. Default 0.',
        'BOOLEAN',
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
        NOW(),
        NOW()
        );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = 'd3a4db04-71b4-48bc-84a1-8d6e29a5d4f1' OR ("EntityID" = '3E551198-AB66-478E-BEB6-C34EDBE242EC' AND "Name" = 'ManualJournalEntryApprovalThreshold')
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
        'd3a4db04-71b4-48bc-84a1-8d6e29a5d4f1',
        '3E551198-AB66-478E-BEB6-C34EDBE242EC', -- "Entity": "MJ_BizApps_Accounting": "Accounting" "Company" "Profiles"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = '3E551198-AB66-478E-BEB6-C34EDBE242EC'),
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
        NOW(),
        NOW()
        );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = '16e6dbc9-1e36-4a47-a70e-85ed192bd6a7' OR ("EntityID" = '3E551198-AB66-478E-BEB6-C34EDBE242EC' AND "Name" = 'ManualJournalEntryApproverRoleID')
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
        '16e6dbc9-1e36-4a47-a70e-85ed192bd6a7',
        '3E551198-AB66-478E-BEB6-C34EDBE242EC', -- "Entity": "MJ_BizApps_Accounting": "Accounting" "Company" "Profiles"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = '3E551198-AB66-478E-BEB6-C34EDBE242EC'),
        'ManualJournalEntryApproverRoleID',
        'Manual Journal Entry Approver Role ID',
        'The role whose holders approve a manual journal entry at or below ManualJournalEntryApprovalThreshold, never the entry''s creator. NULL sends every manual entry to the Approval CFO while the threshold is set.',
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
        'DA238F34-2837-EF11-86D4-6045BDEE16E6',
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

INSERT INTO ${mjSchema}."EntityFieldValue"
                                       ("ID", "EntityFieldID", "Sequence", "Value", "Code", "__mj_CreatedAt", "__mj_UpdatedAt")
                                    VALUES
                                       ('53880bcb-0d93-4d27-9d1a-322aea998f7b', 'DCAE4C02-26FF-41E1-AF26-9E379453E38C', 1, 'CFO', 'CFO', NOW(), NOW());

/* SQL text to insert entity field value with ID 8f430f86-9f77-4f76-b582-8d34cb70d6d8 */

INSERT INTO ${mjSchema}."EntityFieldValue"
                                       ("ID", "EntityFieldID", "Sequence", "Value", "Code", "__mj_CreatedAt", "__mj_UpdatedAt")
                                    VALUES
                                       ('8f430f86-9f77-4f76-b582-8d34cb70d6d8', 'DCAE4C02-26FF-41E1-AF26-9E379453E38C', 2, 'Standard', 'Standard', NOW(), NOW());

/* SQL text to update ValueListType for entity field ID DCAE4C02-26FF-41E1-AF26-9E379453E38C */

UPDATE ${mjSchema}."EntityField" SET "ValueListType"='List' WHERE "ID"='DCAE4C02-26FF-41E1-AF26-9E379453E38C';


/* Create Entity Relationship: MJ: Roles -> MJ_BizApps_Accounting: Accounting Company Profiles (One To Many via ManualJournalEntryApproverRoleID) */

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityRelationship" WHERE "ID" = '0cf56726-2d88-4e3d-a3c7-ede4577586a4'
    ) THEN
        INSERT INTO ${mjSchema}."EntityRelationship" ("ID", "EntityID", "RelatedEntityID", "RelatedEntityJoinField", "Type", "BundleInAPI", "DisplayInForm", "Sequence", "__mj_CreatedAt", "__mj_UpdatedAt")
        VALUES ('0cf56726-2d88-4e3d-a3c7-ede4577586a4', 'DA238F34-2837-EF11-86D4-6045BDEE16E6', '3E551198-AB66-478E-BEB6-C34EDBE242EC', 'ManualJournalEntryApproverRoleID', 'One To Many', 1, 1, 18, NOW(), NOW());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityRelationship" WHERE "ID" = 'ad41de6b-3255-454e-9862-620958113139'
    ) THEN
        INSERT INTO ${mjSchema}."EntityRelationship" ("ID", "EntityID", "RelatedEntityID", "RelatedEntityJoinField", "Type", "BundleInAPI", "DisplayInForm", "Sequence", "__mj_CreatedAt", "__mj_UpdatedAt")
        VALUES ('ad41de6b-3255-454e-9862-620958113139', 'E1238F34-2837-EF11-86D4-6045BDEE16E6', 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762', 'ApprovalRequestedByUserID', 'One To Many', 1, 1, 119, NOW(), NOW());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityRelationship" WHERE "ID" = '5e4f729f-e603-4217-98bc-c232daaf3978'
    ) THEN
        INSERT INTO ${mjSchema}."EntityRelationship" ("ID", "EntityID", "RelatedEntityID", "RelatedEntityJoinField", "Type", "BundleInAPI", "DisplayInForm", "Sequence", "__mj_CreatedAt", "__mj_UpdatedAt")
        VALUES ('5e4f729f-e603-4217-98bc-c232daaf3978', 'E1238F34-2837-EF11-86D4-6045BDEE16E6', 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762', 'ApprovedByUserID', 'One To Many', 1, 1, 120, NOW(), NOW());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityRelationship" WHERE "ID" = 'a503a88e-90a5-494f-8619-9a9991dc1d3e'
    ) THEN
        INSERT INTO ${mjSchema}."EntityRelationship" ("ID", "EntityID", "RelatedEntityID", "RelatedEntityJoinField", "Type", "BundleInAPI", "DisplayInForm", "Sequence", "__mj_CreatedAt", "__mj_UpdatedAt")
        VALUES ('a503a88e-90a5-494f-8619-9a9991dc1d3e', 'B348FFA2-B1A7-4AC2-B6FD-F4E0C0697466', 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762', 'ApprovalTaskID', 'One To Many', 1, 1, 12, NOW(), NOW());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = '0f216bab-f9f2-44f1-8177-c15fe5d384d6' OR ("EntityID" = '3E551198-AB66-478E-BEB6-C34EDBE242EC' AND "Name" = 'ManualJournalEntryApproverRole')
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
        '0f216bab-f9f2-44f1-8177-c15fe5d384d6',
        '3E551198-AB66-478E-BEB6-C34EDBE242EC', -- "Entity": "MJ_BizApps_Accounting": "Accounting" "Company" "Profiles"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = '3E551198-AB66-478E-BEB6-C34EDBE242EC'),
        'ManualJournalEntryApproverRole',
        'Manual Journal Entry Approver Role',
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

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = 'fcd8c833-8cba-4a3a-814d-f9b678c9cd05' OR ("EntityID" = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762' AND "Name" = 'ApprovalRequestedByUser')
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
        'fcd8c833-8cba-4a3a-814d-f9b678c9cd05',
        'C040A1FC-16CE-49CB-B0E2-4F233BD0D762', -- "Entity": "MJ_BizApps_Accounting": "Journal" "Entries"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762'),
        'ApprovalRequestedByUser',
        'Approval Requested By User',
        NULL,
        'TEXT',
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
        NOW(),
        NOW()
        );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = 'da9dd1eb-2fa2-4f99-801d-91775f8b1f12' OR ("EntityID" = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762' AND "Name" = 'ApprovalTask')
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
        'da9dd1eb-2fa2-4f99-801d-91775f8b1f12',
        'C040A1FC-16CE-49CB-B0E2-4F233BD0D762', -- "Entity": "MJ_BizApps_Accounting": "Journal" "Entries"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762'),
        'ApprovalTask',
        'Approval Task',
        NULL,
        'TEXT',
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
        NOW(),
        NOW()
        );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = '2ede0581-5be1-4235-9d74-4ec4811bc9f2' OR ("EntityID" = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762' AND "Name" = 'ApprovedByUser')
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
        '2ede0581-5be1-4235-9d74-4ec4811bc9f2',
        'C040A1FC-16CE-49CB-B0E2-4F233BD0D762', -- "Entity": "MJ_BizApps_Accounting": "Journal" "Entries"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = 'C040A1FC-16CE-49CB-B0E2-4F233BD0D762'),
        'ApprovedByUser',
        'Approved By User',
        NULL,
        'TEXT',
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
        NOW(),
        NOW()
        );
    END IF;
END $$;


-- ===================== Grants =====================

DO $$ BEGIN REVOKE SELECT ON "__mj_BizAppsAccounting"."vwAccountingCompanyProfiles" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE SELECT ON "__mj_BizAppsAccounting"."vwAccountingCompanyProfiles" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE SELECT ON "__mj_BizAppsAccounting"."vwAccountingCompanyProfiles" FROM "cdp_UI"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT ON "__mj_BizAppsAccounting"."vwAccountingCompanyProfiles" TO "cdp_UI", "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* Base View Permissions SQL for MJ_BizApps_Accounting: Accounting Company Profiles */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: Accounting Company Profiles
-- Item: Permissions for vwAccountingCompanyProfiles
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------;

DO $$ BEGIN REVOKE SELECT ON "__mj_BizAppsAccounting"."vwAccountingCompanyProfiles" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE SELECT ON "__mj_BizAppsAccounting"."vwAccountingCompanyProfiles" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE SELECT ON "__mj_BizAppsAccounting"."vwAccountingCompanyProfiles" FROM "cdp_UI"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT ON "__mj_BizAppsAccounting"."vwAccountingCompanyProfiles" TO "cdp_UI", "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
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
------------------------------------------------------------;

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spCreateAccountingCompanyProfile" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spCreateAccountingCompanyProfile" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spCreateAccountingCompanyProfile" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* spCreate Permissions for MJ_BizApps_Accounting: Accounting Company Profiles */

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spCreateAccountingCompanyProfile" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spCreateAccountingCompanyProfile" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spCreateAccountingCompanyProfile" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
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
------------------------------------------------------------;

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spUpdateAccountingCompanyProfile" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spUpdateAccountingCompanyProfile" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spUpdateAccountingCompanyProfile" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spUpdateAccountingCompanyProfile" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spUpdateAccountingCompanyProfile" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spUpdateAccountingCompanyProfile" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
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
------------------------------------------------------------;

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spDeleteAccountingCompanyProfile" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spDeleteAccountingCompanyProfile" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spDeleteAccountingCompanyProfile" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* spDelete Permissions for MJ_BizApps_Accounting: Accounting Company Profiles */

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spDeleteAccountingCompanyProfile" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spDeleteAccountingCompanyProfile" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spDeleteAccountingCompanyProfile" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* Index for Foreign Keys for GLAccount */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Accounting: GL Accounts
-- Item: Index for Foreign Keys
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------
-- Index for foreign key CompanyID in table GLAccount;

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
/* SQL text to update entity field related entity name field map for entity field ID 3B9807DE-48E1-40CB-977D-F78C79B23D90 */

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spCreateJournalEntry" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spCreateJournalEntry" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spCreateJournalEntry" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* spCreate Permissions for MJ_BizApps_Accounting: Journal Entries */

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spCreateJournalEntry" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spCreateJournalEntry" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spCreateJournalEntry" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
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

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spUpdateJournalEntry" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spUpdateJournalEntry" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spUpdateJournalEntry" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spUpdateJournalEntry" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spUpdateJournalEntry" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spUpdateJournalEntry" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
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

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spDeleteJournalEntry" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spDeleteJournalEntry" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spDeleteJournalEntry" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* spDelete Permissions for MJ_BizApps_Accounting: Journal Entries */

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spDeleteJournalEntry" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spDeleteJournalEntry" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spDeleteJournalEntry" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* SQL text to insert 1 new entity field(s) */

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spCreateJournalEntry" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spCreateJournalEntry" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spCreateJournalEntry" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* spCreate Permissions for MJ_BizApps_Accounting: Journal Entries */

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spCreateJournalEntry" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spCreateJournalEntry" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spCreateJournalEntry" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
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

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spUpdateJournalEntry" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spUpdateJournalEntry" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spUpdateJournalEntry" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spUpdateJournalEntry" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spUpdateJournalEntry" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spUpdateJournalEntry" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
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

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spDeleteJournalEntry" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spDeleteJournalEntry" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spDeleteJournalEntry" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* spDelete Permissions for MJ_BizApps_Accounting: Journal Entries */

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spDeleteJournalEntry" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spDeleteJournalEntry" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION "__mj_BizAppsAccounting"."spDeleteJournalEntry" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* SQL text to update existing entity fields from schema (1 scoped entities) */


-- ===================== Comments =====================

COMMENT ON COLUMN "__mj_BizAppsAccounting"."GLAccount"."IsControlAccount" IS 'A control account (AR, deferred revenue, unbilled, customer deposits, cash, or any account the company names): a manual journal entry with a line on it always needs the company''s Approval CFO, whatever its amount. Default 0.';

COMMENT ON COLUMN "__mj_BizAppsAccounting"."AccountingCompanyProfile"."ManualJournalEntryApprovalThreshold" IS 'The amount (total debits) at or below which a manual journal entry is approved by a holder of ManualJournalEntryApproverRoleID; above it, by the Approval CFO. NULL, the default, switches manual-entry approval off for this company: manual entries batch as before.';

COMMENT ON COLUMN "__mj_BizAppsAccounting"."AccountingCompanyProfile"."ManualJournalEntryApproverRoleID" IS 'The role whose holders approve a manual journal entry at or below ManualJournalEntryApprovalThreshold, never the entry''s creator. NULL sends every manual entry to the Approval CFO while the threshold is set.';

COMMENT ON COLUMN "__mj_BizAppsAccounting"."JournalEntry"."ApprovalLevel" IS 'Set when the entry needs approval: Standard (a holder of the company''s manual-entry approver role) or CFO (above the threshold, a line on a control account, or no other approver available). Set when a manual entry is created, or its amounts, accounts, date or company change, while its company has a ManualJournalEntryApprovalThreshold. An entry with a level is not a batch candidate until ApprovedAt is set. NULL: no approval needed.';

COMMENT ON COLUMN "__mj_BizAppsAccounting"."JournalEntry"."ApprovalRequestedByUserID" IS 'The user whose save raised the current approval request: the creator, or whoever last changed the entry''s amounts, accounts, date or company. That user may not approve it. Set exactly when ApprovalLevel is.';

COMMENT ON COLUMN "__mj_BizAppsAccounting"."JournalEntry"."ApprovalTaskID" IS 'The approval Task raised for this manual entry, stamped in the same transaction. The approval is read from this column, never from a Task Link.';

COMMENT ON COLUMN "__mj_BizAppsAccounting"."JournalEntry"."ApprovedAt" IS 'When the manual entry was approved. Set together with ApprovedByUserID, only on an entry with an ApprovalLevel; cleared when the entry''s amounts, accounts, date or company change afterwards.';

COMMENT ON COLUMN "__mj_BizAppsAccounting"."JournalEntry"."ApprovedByUserID" IS 'The user who approved the manual entry: never ApprovalRequestedByUserID. Set together with ApprovedAt.';


-- ===================== Other =====================

-- The Journal Entries entity's base view is the hand-written layer vwJournalEntries over CodeGen's
-- vwJournalEntriesGenerated (V202609202352). Both select `*`, which SQL Server binds when a view is
-- created, so neither shows the columns added above until it is refreshed. The CodeGen block below
-- syncs entity fields against vwJournalEntries BEFORE it recreates vwJournalEntriesGenerated; run
-- against stale views, that sync drops the new Journal Entry fields it has just inserted.

-- =============================================================================
-- CODEGEN OUTPUT — GENERATED CODE BELOW THIS LINE. DO NOT EDIT BY HAND.
-- =============================================================================


/* SQL text to update existing entities from schema */

/* spUpdate Permissions for MJ_BizApps_Accounting: Accounting Company Profiles */

/* spUpdate Permissions for MJ_BizApps_Accounting: GL Accounts */

/* spUpdate Permissions for MJ_BizApps_Accounting: Journal Entries */

/* spUpdate Permissions for MJ_BizApps_Accounting: Journal Entries */
