-- =============================================================================
-- B1 / §8.2 — JournalEntryBatch approval-task pointer
--
-- Marcelo's ruling (2026-07-16): raising the CFO approval Task is a SEPARATE
-- action from building the batch, in its OWN transaction — batch creation must
-- NOT be gated on task success (today `raiseApprovalTaskOrReverse` CANCELS the
-- whole batch if the gate throws). But the task-raise and the stamp below commit
-- TOGETHER, in one accounting-owned transaction, so the two can never disagree:
-- you can never have a Task with no pointer, nor a pointer with no Task.
--
-- Why a column rather than the existing TaskLink join: "so we can easily check
-- and validate that batches have a task associated" (Marcelo). `ApprovalTaskID
-- IS NULL` on a built batch is then a cheap, indexable, *detectable* state —
-- the retry/repair signal — instead of a cross-schema join through
-- MJ_BizApps_Tasks: Task Links.
--
-- NO FOREIGN KEY, deliberately. bizapps-tasks is a separate OpenApp with its own
-- schema and lifecycle; a cross-app FK would hard-couple accounting's DDL to the
-- tasks schema and make accounting un-migratable without it. Accounting OWNS this
-- transaction (tasks is a dependency of accounting, not the reverse), so the ID is
-- stored as a soft reference and integrity is enforced by the engine that writes
-- both rows in one transaction. NB: CodeGen therefore will NOT auto-index this
-- column (it only auto-indexes real FKs), which is why the index is explicit below.
-- =============================================================================

ALTER TABLE __mj_BizAppsAccounting.JournalEntryBatch ADD
    ApprovalTaskID UNIQUEIDENTIFIER NULL,
    ApprovalTaskRaisedAt DATETIMEOFFSET NULL;
GO

EXEC sp_addextendedproperty @name = N'MS_Description',
    @value = N'Soft reference to the MJ_BizApps_Tasks Task that carries this batch''s CFO approval. Written by the accounting-owned task transaction, which raises the Task and stamps this column together (all-or-none), so the two can never disagree. NULL on a built batch means the task-raise did not complete — a detectable, retryable state, NOT a gate on batch creation (the batch itself is already committed and valid). Intentionally NOT a foreign key: bizapps-tasks is a separate OpenApp schema and a cross-app FK would couple accounting''s DDL to it.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting',
    @level1type = N'TABLE',  @level1name = N'JournalEntryBatch',
    @level2type = N'COLUMN', @level2name = N'ApprovalTaskID';
GO

EXEC sp_addextendedproperty @name = N'MS_Description',
    @value = N'When the approval Task was raised and stamped (UTC). Set in the same transaction as ApprovalTaskID; both are NULL together or set together.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting',
    @level1type = N'TABLE',  @level1name = N'JournalEntryBatch',
    @level2type = N'COLUMN', @level2name = N'ApprovalTaskRaisedAt';
GO

-- The two columns are set together or not at all. This makes the "half-stamped"
-- state unrepresentable at the DB level rather than merely unlikely — the same
-- posture as the app's other financial invariants (50001 etc.).
ALTER TABLE __mj_BizAppsAccounting.JournalEntryBatch
    ADD CONSTRAINT CK_JournalEntryBatch_ApprovalTaskStamp
    CHECK (
        (ApprovalTaskID IS NULL AND ApprovalTaskRaisedAt IS NULL)
        OR (ApprovalTaskID IS NOT NULL AND ApprovalTaskRaisedAt IS NOT NULL)
    );
GO

-- Explicit: CodeGen auto-indexes FK columns only, and this is deliberately a soft
-- reference. The index serves the repair/validation query this column exists for
-- ("which built batches have no approval task?") — filtered, so it stays tiny.
CREATE INDEX IDX_JournalEntryBatch_ApprovalTaskID
    ON __mj_BizAppsAccounting.JournalEntryBatch (ApprovalTaskID)
    WHERE ApprovalTaskID IS NOT NULL;
GO
