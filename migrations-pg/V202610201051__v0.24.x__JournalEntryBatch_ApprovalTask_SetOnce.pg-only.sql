-- =============================================================================
-- Migration: V202610201051__v0.24.x__JournalEntryBatch_ApprovalTask_SetOnce.pg-only.sql
-- Description: #313 — PostgreSQL twin of trg_JournalEntryBatch_ApprovalTaskSetOnce.
-- =============================================================================
--
-- WHY A PG-ONLY FILE
--
-- V202610201050__v0.24.x__JournalEntryBatch_ApprovalTask_SetOnce creates
-- trg_JournalEntryBatch_ApprovalTaskSetOnce on SQL Server. The SQL converter
-- does not convert triggers (its .pg.sql output marks the trigger SKIPPED), so
-- the PostgreSQL trigger is written here by hand. The converted file carries
-- the unique index.
--
-- The rule: once ApprovalTaskID is set, neither it nor ApprovalTaskRaisedAt
-- changes or clears, in any status. Setting them on a batch that has none (the
-- build's stamp) is allowed. ApprovalTaskRaisedAt compares at millisecond
-- precision, as on SQL Server: the entity writes JavaScript dates.
--
-- Runs after the converted V202610201050 file, once, in order.
-- =============================================================================

CREATE OR REPLACE FUNCTION __mj_BizAppsAccounting."fn_trg_JournalEntryBatch_ApprovalTaskSetOnce"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD."ApprovalTaskID" IS NOT NULL
       AND (
           NEW."ApprovalTaskID" IS NULL
           OR NEW."ApprovalTaskID" <> OLD."ApprovalTaskID"
           OR NEW."ApprovalTaskRaisedAt" IS NULL
           OR ABS(EXTRACT(EPOCH FROM (NEW."ApprovalTaskRaisedAt" - OLD."ApprovalTaskRaisedAt"))) >= 0.001
       )
    THEN
        RAISE EXCEPTION 'JournalEntryBatch approval Task refused. ApprovalTaskID and ApprovalTaskRaisedAt are set once, by the build that raises the approval Task, and never change or clear after that, in any status.'
            USING ERRCODE = 'P0001', DETAIL = '50035';
    END IF;

    RETURN NULL;
END;
$$;

CREATE TRIGGER "trg_JournalEntryBatch_ApprovalTaskSetOnce"
AFTER UPDATE ON __mj_BizAppsAccounting."JournalEntryBatch"
FOR EACH ROW
EXECUTE FUNCTION __mj_BizAppsAccounting."fn_trg_JournalEntryBatch_ApprovalTaskSetOnce"();
