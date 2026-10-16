-- =============================================================================
-- Migration: V202610161900__v0.22.x__Batch_Approval_Assignee_Person.sql
-- Description: open journal entry batch approval tasks are reassigned from the
--              CFO's user record to the CFO's Person (#387).
-- =============================================================================
--
-- WHY
--
-- TasksAppApprovalGate assigned each batch's approval task to the company's
-- Approval CFO as an MJ: Users record. The Tasks app finds a viewer's tasks by
-- their Person, so those tasks appeared in no one's My Tasks or Approvals. The
-- gate now assigns new approval tasks to the CFO's Person. This migration moves
-- the open ones already raised.
--
-- WHAT CHANGES
--
-- Data only; no schema change, so there is no CodeGen output.
--
-- Each TaskAssignment that
--   - belongs to a task named by a batch's ApprovalTaskID,
--   - whose task is still open (Open, InProgress or Blocked), and
--   - is assigned to an MJ: Users record
-- is repointed to that user's Person on MJ_BizApps_Common: People, found by the
-- rule the gate and the Tasks app use: the user's own link (LinkedEntityID is
-- People or an IS-A subtype of it, LinkedEntityRecordID is the Person) when the
-- user has one, else the Person whose LinkedUserID names the user. Only an
-- Active Person counts.
--
-- An assignment whose user has no active Person is left as it is, and so is one
-- whose task already has the same Person assigned in the same role (the unique
-- key would refuse the move). Both are listed in the output. Completed and
-- cancelled tasks keep their history unchanged.
--
-- DETERMINISTIC, NOT IDEMPOTENT: this runs once, in order, against a database
-- that has the prior migrations.
-- =============================================================================
SET NOCOUNT ON;
GO

WITH PeopleEntity AS (
    SELECT e.ID
    FROM ${mjSchema}.Entity e
    WHERE e.Name = 'MJ_BizApps_Common: People'
    UNION ALL
    SELECT child.ID
    FROM ${mjSchema}.Entity child
    INNER JOIN PeopleEntity parent ON child.ParentID = parent.ID
),
UserPerson AS (
    SELECT
        u.ID AS UserID,
        CASE
            WHEN u.LinkedEntityID IN (SELECT ID FROM PeopleEntity)
                THEN (SELECT p.ID FROM __mj_BizAppsCommon.Person p
                      WHERE p.ID = TRY_CONVERT(UNIQUEIDENTIFIER, u.LinkedEntityRecordID) AND p.Status = 'Active')
            ELSE (SELECT TOP 1 p.ID FROM __mj_BizAppsCommon.Person p
                  WHERE p.LinkedUserID = u.ID AND p.Status = 'Active'
                  ORDER BY p.__mj_CreatedAt)
        END AS PersonID
    FROM ${mjSchema}.[User] u
)
UPDATE ta
SET AssigneeEntityID = pe.ID,
    AssigneeRecordID = CONVERT(NVARCHAR(450), up.PersonID),
    __mj_UpdatedAt = GETUTCDATE()
FROM __mj_BizAppsTasks.TaskAssignment ta
INNER JOIN __mj_BizAppsTasks.Task t ON t.ID = ta.TaskID
INNER JOIN __mj_BizAppsAccounting.JournalEntryBatch b ON b.ApprovalTaskID = t.ID
INNER JOIN ${mjSchema}.Entity ue ON ue.ID = ta.AssigneeEntityID AND ue.Name = 'MJ: Users'
INNER JOIN UserPerson up ON up.UserID = TRY_CONVERT(UNIQUEIDENTIFIER, ta.AssigneeRecordID)
INNER JOIN ${mjSchema}.Entity pe ON pe.Name = 'MJ_BizApps_Common: People'
WHERE t.Status IN ('Open', 'InProgress', 'Blocked')
  AND up.PersonID IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM __mj_BizAppsTasks.TaskAssignment other
      WHERE other.TaskID = ta.TaskID
        AND other.AssigneeEntityID = pe.ID
        AND TRY_CONVERT(UNIQUEIDENTIFIER, other.AssigneeRecordID) = up.PersonID
        AND (other.RoleID = ta.RoleID OR (other.RoleID IS NULL AND ta.RoleID IS NULL))
  );

PRINT CONCAT('Batch approval assignments moved from a user to a Person: ', @@ROWCOUNT);
GO

-- What is still assigned to a user: its user has no active Person, or the task
-- already has that Person. An administrator links the user to a Person, then
-- reassigns the task in the Tasks app.
DECLARE @left NVARCHAR(MAX) = (
    SELECT STRING_AGG(CONCAT('task ', CONVERT(NVARCHAR(36), t.ID), ' (user ', ta.AssigneeRecordID, ')'), '; ')
    FROM __mj_BizAppsTasks.TaskAssignment ta
    INNER JOIN __mj_BizAppsTasks.Task t ON t.ID = ta.TaskID
    INNER JOIN __mj_BizAppsAccounting.JournalEntryBatch b ON b.ApprovalTaskID = t.ID
    INNER JOIN ${mjSchema}.Entity ue ON ue.ID = ta.AssigneeEntityID AND ue.Name = 'MJ: Users'
    WHERE t.Status IN ('Open', 'InProgress', 'Blocked')
);
PRINT CONCAT('Batch approval assignments still on a user: ', COALESCE(@left, 'none'));
GO
