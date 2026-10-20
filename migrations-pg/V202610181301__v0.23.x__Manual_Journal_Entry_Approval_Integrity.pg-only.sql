-- =============================================================================
-- Migration: V202610181301__v0.23.x__Manual_Journal_Entry_Approval_Integrity.pg-only.sql
-- Description: PostgreSQL twin of trg_JournalEntry_ApprovalIntegrity
--              (bc-aidp-next-golive#353, PR #463 review).
-- =============================================================================
--
-- WHY A PG-ONLY FILE
--
-- V202610181300__v0.23.x__Manual_Journal_Entry_Approval creates
-- trg_JournalEntry_ApprovalIntegrity on SQL Server. The SQL converter does not
-- convert triggers (its .pg.sql output marks the trigger SKIPPED), so the
-- PostgreSQL trigger is written here by hand, with the same five rules:
--   50035  an entry is never approved by the user who raised its approval.
--   50036  an approval stamp, when it is set or changed, is recorded on an
--          entry that has an approval Task, by the company's Approval CFO or —
--          for a Standard entry — by a holder of its manual-entry approver role.
--   50037  an approval level is not cleared while the entry's company still
--          has a ManualJournalEntryApprovalThreshold.
--   50038  the approval columns are frozen once the entry is Batched or
--          GLPosted.
--   50039  the origin pair (LinkedEntityID, LinkedRecordID) never changes after
--          the entry is created, in any status.
--
-- A row-level AFTER trigger: each row checks itself against its OLD image
-- (absent on INSERT).
--
-- Runs after the converted V202610181300 file, once, in order.
-- =============================================================================

CREATE OR REPLACE FUNCTION __mj_BizAppsAccounting."fn_trg_JournalEntry_ApprovalIntegrity"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_cfo_user_id UUID;
    v_approver_role_id UUID;
    v_threshold NUMERIC;
    v_stamp_changed BOOLEAN;
BEGIN
    IF NEW."ApprovedByUserID" IS NOT NULL AND NEW."ApprovedByUserID" = NEW."ApprovalRequestedByUserID" THEN
        RAISE EXCEPTION 'A journal entry cannot be approved by the user who raised its approval (ApprovedByUserID = ApprovalRequestedByUserID).'
            USING ERRCODE = 'P0001', DETAIL = '50035';
    END IF;

    SELECT acp."ApprovalCFOUserID", acp."ManualJournalEntryApproverRoleID", acp."ManualJournalEntryApprovalThreshold"
      INTO v_cfo_user_id, v_approver_role_id, v_threshold
      FROM __mj_BizAppsAccounting."AccountingCompanyProfile" acp
     WHERE acp."ID" = NEW."CompanyID";

    IF NEW."ApprovedAt" IS NULL THEN
        v_stamp_changed := FALSE;
    ELSIF TG_OP = 'INSERT' THEN
        v_stamp_changed := TRUE;
    ELSE
        v_stamp_changed := OLD."ApprovedAt" IS DISTINCT FROM NEW."ApprovedAt"
                        OR OLD."ApprovedByUserID" IS DISTINCT FROM NEW."ApprovedByUserID";
    END IF;
    IF v_stamp_changed AND NOT (
        NEW."ApprovalTaskID" IS NOT NULL
        AND (
            NEW."ApprovedByUserID" = v_cfo_user_id
            OR (
                NEW."ApprovalLevel" = 'Standard'
                AND EXISTS (
                    SELECT 1 FROM __mj."UserRole" ur
                     WHERE ur."UserID" = NEW."ApprovedByUserID" AND ur."RoleID" = v_approver_role_id
                )
            )
        )
    ) THEN
        RAISE EXCEPTION 'A journal entry approval must be recorded on an entry with an approval Task, by the company''s Approval CFO or, for a Standard-level entry, by a holder of its manual-entry approver role.'
            USING ERRCODE = 'P0001', DETAIL = '50036';
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF OLD."ApprovalLevel" IS NOT NULL AND NEW."ApprovalLevel" IS NULL AND v_threshold IS NOT NULL THEN
            RAISE EXCEPTION 'A journal entry''s approval level cannot be cleared while its company has a manual journal entry approval threshold.'
                USING ERRCODE = 'P0001', DETAIL = '50037';
        END IF;

        IF OLD."Status" IN ('Batched', 'GLPosted') AND (
            OLD."ApprovalLevel" IS DISTINCT FROM NEW."ApprovalLevel"
            OR OLD."ApprovalRequestedByUserID" IS DISTINCT FROM NEW."ApprovalRequestedByUserID"
            OR OLD."ApprovalTaskID" IS DISTINCT FROM NEW."ApprovalTaskID"
            OR OLD."ApprovedAt" IS DISTINCT FROM NEW."ApprovedAt"
            OR OLD."ApprovedByUserID" IS DISTINCT FROM NEW."ApprovedByUserID"
        ) THEN
            RAISE EXCEPTION 'A journal entry''s approval (ApprovalLevel, ApprovalRequestedByUserID, ApprovalTaskID, ApprovedAt, ApprovedByUserID) cannot change once it is Batched or GLPosted.'
                USING ERRCODE = 'P0001', DETAIL = '50038';
        END IF;

        IF OLD."LinkedEntityID" IS DISTINCT FROM NEW."LinkedEntityID" OR OLD."LinkedRecordID" IS DISTINCT FROM NEW."LinkedRecordID" THEN
            RAISE EXCEPTION 'A journal entry''s origin pair (LinkedEntityID, LinkedRecordID) cannot change after the entry is created: it records the booking that created it, and an entry without it is a manual entry that needs approval.'
                USING ERRCODE = 'P0001', DETAIL = '50039';
        END IF;
    END IF;

    RETURN NULL;
END;
$$;

CREATE TRIGGER "trg_JournalEntry_ApprovalIntegrity"
AFTER INSERT OR UPDATE ON __mj_BizAppsAccounting."JournalEntry"
FOR EACH ROW
EXECUTE FUNCTION __mj_BizAppsAccounting."fn_trg_JournalEntry_ApprovalIntegrity"();
