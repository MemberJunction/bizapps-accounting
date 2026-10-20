-- ============================================================================
-- MemberJunction PostgreSQL Migration
-- PostgreSQL counterpart of migrations/V202610161900__v0.23.x__Batch_Approval_Assignee_Person.sql
-- ============================================================================
--
-- WRITTEN BY HAND, NOT CONVERTED. `mj sql-convert` emits invalid PostgreSQL for
-- the T-SQL file (MemberJunction/MJ#5799 lists the gaps: TRY_CONVERT, the
-- recursive CTE, UPDATE <alias> ... FROM, PRINT). Replace this file with the
-- converter's output once the converter handles that shape, if the output
-- matches; until then, keep the two files' logic identical by hand.
--
-- Data only: open journal entry batch approval tasks are moved from the CFO's
-- MJ: Users record to the CFO's Person (#387). See the T-SQL file for the full
-- rules. Rows it cannot move are left and listed in a NOTICE.
--
-- DETERMINISTIC, NOT IDEMPOTENT: this runs once, in order, against a database
-- that has the prior migrations.
-- ============================================================================

SET search_path TO __mj_BizAppsAccounting, public;

WITH RECURSIVE "PeopleEntity" AS (
    SELECT e."ID"
    FROM ${mjSchema}."Entity" e
    WHERE e."Name" = 'MJ_BizApps_Common: People'
    UNION ALL
    SELECT child."ID"
    FROM ${mjSchema}."Entity" child
    INNER JOIN "PeopleEntity" parent ON child."ParentID" = parent."ID"
),
"UserPerson" AS (
    SELECT
        u."ID" AS "UserID",
        CASE
            WHEN u."LinkedEntityID" IN (SELECT "ID" FROM "PeopleEntity")
                THEN (SELECT p."ID" FROM __mj_BizAppsCommon."Person" p
                      WHERE p."ID" = (CASE WHEN u."LinkedEntityRecordID" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                                           THEN u."LinkedEntityRecordID"::UUID END)
                        AND p."Status" = 'Active')
            ELSE (SELECT p."ID" FROM __mj_BizAppsCommon."Person" p
                  WHERE p."LinkedUserID" = u."ID" AND p."Status" = 'Active'
                  ORDER BY p."__mj_CreatedAt"
                  LIMIT 1)
        END AS "PersonID"
    FROM ${mjSchema}."User" u
),
"Move" AS (
    SELECT ta."ID" AS "AssignmentID", pe."ID" AS "PeopleEntityID", up."PersonID"
    FROM __mj_BizAppsTasks."TaskAssignment" ta
    INNER JOIN __mj_BizAppsTasks."Task" t ON t."ID" = ta."TaskID"
    INNER JOIN __mj_BizAppsAccounting."JournalEntryBatch" b ON b."ApprovalTaskID" = t."ID"
    INNER JOIN ${mjSchema}."Entity" ue ON ue."ID" = ta."AssigneeEntityID" AND ue."Name" = 'MJ: Users'
    INNER JOIN "UserPerson" up ON up."UserID" = (CASE WHEN ta."AssigneeRecordID" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                                                      THEN ta."AssigneeRecordID"::UUID END)
    INNER JOIN ${mjSchema}."Entity" pe ON pe."Name" = 'MJ_BizApps_Common: People'
    WHERE t."Status" IN ('Open', 'InProgress', 'Blocked')
      AND up."PersonID" IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM __mj_BizAppsTasks."TaskAssignment" other
          WHERE other."TaskID" = ta."TaskID"
            AND other."AssigneeEntityID" = pe."ID"
            AND LOWER(other."AssigneeRecordID") = LOWER(up."PersonID"::TEXT)
            AND other."RoleID" IS NOT DISTINCT FROM ta."RoleID"
      )
)
UPDATE __mj_BizAppsTasks."TaskAssignment" ta
SET "AssigneeEntityID" = m."PeopleEntityID",
    "AssigneeRecordID" = UPPER(m."PersonID"::TEXT),
    "__mj_UpdatedAt" = NOW()
FROM "Move" m
WHERE ta."ID" = m."AssignmentID";

DO $$
DECLARE
    v_left TEXT;
BEGIN
    SELECT STRING_AGG('task ' || t."ID"::TEXT || ' (user ' || ta."AssigneeRecordID" || ')', '; ')
    INTO v_left
    FROM __mj_BizAppsTasks."TaskAssignment" ta
    INNER JOIN __mj_BizAppsTasks."Task" t ON t."ID" = ta."TaskID"
    INNER JOIN __mj_BizAppsAccounting."JournalEntryBatch" b ON b."ApprovalTaskID" = t."ID"
    INNER JOIN ${mjSchema}."Entity" ue ON ue."ID" = ta."AssigneeEntityID" AND ue."Name" = 'MJ: Users'
    WHERE t."Status" IN ('Open', 'InProgress', 'Blocked');
    RAISE NOTICE 'Batch approval assignments still on a user: %', COALESCE(v_left, 'none');
END $$;
