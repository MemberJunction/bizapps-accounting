-- =============================================================================
-- Migration: V202609111415__v0.1.x__ArchivedJournalEntryBatchStatus.sql
-- Description: golive #214 — a terminal `Archived` batch status for batches that
--              must never post to the ERP, with a required archive audit triple.
-- =============================================================================
--
-- WHY
--
-- Before this, a batch had exactly two terminal states and neither fits "close
-- this batch, it must never go to Business Central":
--
--   Posted     keeps the member entries locked, but is only reachable through a
--              SUCCESSFUL ERP send (sendJournalEntryBatch refuses anything that
--              is not Approved; markBatchPosted is its only writer).
--   Cancelled  makes no ERP call, but RELEASES the members — Cancel() runs
--              TearDownSummaryAndUnlock, which flips every Batched member back
--              to Pending and clears its JournalEntryBatchID, so the entries
--              return to the nightly/monthly candidate pool.
--
-- `Archived` is the missing third: no ERP call, members stay locked.
--
-- ENTRY LOCKING — WHY NOTHING ON JournalEntry CHANGES
--
-- The member entries stay at Status='Batched' and gain no new JE status. Two
-- existing mechanisms already make that a permanent lock:
--   * The candidate pool is `Status='Pending'` (JournalEntryBatchEngine's
--     pendingCandidateFilter, and the dashboards' own candidate list), so a
--     Batched entry is invisible to every build path already.
--   * trg_JournalEntry_Immutability only sanctions the Batched -> Pending
--     unlock while the OWNING BATCH is still Pending. It keys on that, not on
--     an enumerated list of terminal batch statuses — so the moment the batch
--     is Archived the database itself refuses to release the entries, exactly
--     as it does for Approved / Sent / Posted.
-- A matching terminal JE status would need its own CHECK value and its own
-- trigger branch and would buy nothing on top of that.
--
-- DETERMINISTIC, NOT IDEMPOTENT (release-process.md §CodeGen): this runs once,
-- in order, against a database that has the baseline.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Widen the status enum
-- -----------------------------------------------------------------------------
ALTER TABLE __mj_BizAppsAccounting.JournalEntryBatch
    DROP CONSTRAINT CK_JournalEntryBatch_Status;
GO

ALTER TABLE __mj_BizAppsAccounting.JournalEntryBatch
    ADD CONSTRAINT CK_JournalEntryBatch_Status
    CHECK (Status IN ('Pending','Approved','Sent','Posted','Failed','Cancelled','Archived'));
GO


-- -----------------------------------------------------------------------------
-- 2. The archive audit triple — reason, who, when
-- -----------------------------------------------------------------------------
-- Mirrors ApprovedAt / ApprovedByUserID, and nullable for the same reason: the
-- columns are meaningless until the transition happens. The CHECK in §4 is what
-- makes them mandatory AT the transition.
-- -----------------------------------------------------------------------------
ALTER TABLE __mj_BizAppsAccounting.JournalEntryBatch ADD
    ArchiveReason     NVARCHAR(500)    NULL,
    ArchivedAt        DATETIMEOFFSET   NULL,
    ArchivedByUserID  UNIQUEIDENTIFIER NULL;
GO


-- -----------------------------------------------------------------------------
-- 3. FK on the who, matching FK_JournalEntryBatch_ApprovedBy
-- -----------------------------------------------------------------------------
ALTER TABLE __mj_BizAppsAccounting.JournalEntryBatch
    ADD CONSTRAINT FK_JournalEntryBatch_ArchivedBy
    FOREIGN KEY (ArchivedByUserID) REFERENCES __mj.[User](ID);
GO


-- -----------------------------------------------------------------------------
-- 4. The audit triple is REQUIRED once Status='Archived'
-- -----------------------------------------------------------------------------
-- #214 calls the reason required, and a required field belongs in a constraint.
-- This is deliberately STRONGER than the Approved pair, which is enforced by the
-- entity only (JournalEntryBatchEntityServer.Validate) and has no DB CHECK. Flag
-- for review: the alternative is symmetry — drop this and rely on the entity.
-- No existing row is Archived, so it is safe to add unconditionally.
-- -----------------------------------------------------------------------------
ALTER TABLE __mj_BizAppsAccounting.JournalEntryBatch
    ADD CONSTRAINT CK_JournalEntryBatch_ArchiveAudit CHECK (
        Status <> 'Archived' OR (
            ArchiveReason IS NOT NULL
            AND LEN(LTRIM(RTRIM(ArchiveReason))) > 0
            AND ArchivedAt IS NOT NULL
            AND ArchivedByUserID IS NOT NULL
        )
    );
GO


-- -----------------------------------------------------------------------------
-- 5. Freeze an Archived batch, exactly as Approved / Sent / Posted are frozen
-- -----------------------------------------------------------------------------
-- Body is the baseline trigger verbatim with 'Archived' added to both status
-- lists. Without this an Archived batch is deletable and its Status editable by
-- direct SQL back to 'Pending' — which re-opens trg_JournalEntry_Immutability's
-- unlock door and releases the members. That is precisely the lock this ticket
-- exists to make permanent.
-- -----------------------------------------------------------------------------
CREATE OR ALTER TRIGGER __mj_BizAppsAccounting.trg_JournalEntryBatch_Immutability
ON __mj_BizAppsAccounting.JournalEntryBatch
AFTER UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM inserted) AND EXISTS (SELECT 1 FROM deleted WHERE Status IN ('Approved','Sent','Posted','Archived'))
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 50008, 'JournalEntryBatch cannot be deleted once Status is Approved, Sent, Posted, or Archived. Cancel it instead.', 1;
    END;

    IF EXISTS (
        SELECT 1
        FROM deleted d
        JOIN inserted i ON i.ID = d.ID
        WHERE d.Status IN ('Approved','Sent','Posted','Archived')
          AND (
            i.JournalEntryBatchNumber          <> d.JournalEntryBatchNumber          OR
            i.CompanyID            <> d.CompanyID            OR
            i.PostingDate          <> d.PostingDate          OR
            ISNULL(i.SummaryJournalEntryID, '00000000-0000-0000-0000-000000000000') <> ISNULL(d.SummaryJournalEntryID, '00000000-0000-0000-0000-000000000000') OR
            ISNULL(i.ApprovalTaskID,        '00000000-0000-0000-0000-000000000000') <> ISNULL(d.ApprovalTaskID,        '00000000-0000-0000-0000-000000000000') OR
            i.TargetSystem         <> d.TargetSystem         OR
            i.BatchedAt            <> d.BatchedAt            OR
            i.BatchedByUserID      <> d.BatchedByUserID      OR
            i.TotalEntries         <> d.TotalEntries         OR
            i.TotalDebits          <> d.TotalDebits          OR
            i.TotalCredits         <> d.TotalCredits
          )
    )
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 50009, 'JournalEntryBatch is locked (Status=Approved/Sent/Posted/Archived). Only Status / ApprovedAt / ApprovedByUserID / SentAt / PostedAt / the Archive audit triple / ExternalJournalEntryBatchRef / ErrorMessage may evolve (CompanyID, PostingDate, SummaryJournalEntryID, and the approval-task pointer freeze at approval).', 1;
    END;
END;
GO


-- -----------------------------------------------------------------------------
-- 6. Column descriptions — CodeGen carries these into EntityField.Description
-- -----------------------------------------------------------------------------
EXEC sp_updateextendedproperty @name = N'MS_Description',
    @value = N'Lifecycle: Pending | Approved | Sent | Posted | Failed | Cancelled | Archived. Pending is mutable/deletable; Approved locks content (human sign-off); Posted = the ERP confirmed posting; Failed triggers retry + escalation; Cancelled is terminal from Pending and RELEASES the member entries back to the candidate pool; Archived is terminal from Pending, Approved or Failed, makes no ERP call and KEEPS the member entries locked (trg_JournalEntryBatch_Immutability).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryBatch', @level2type = N'COLUMN', @level2name = N'Status';
GO

EXEC sp_addextendedproperty @name = N'MS_Description',
    @value = N'Why this batch was archived instead of posted. Required when Status = Archived (CK_JournalEntryBatch_ArchiveAudit).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryBatch', @level2type = N'COLUMN', @level2name = N'ArchiveReason';
GO

EXEC sp_addextendedproperty @name = N'MS_Description',
    @value = N'When the batch was archived. Required when Status = Archived.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryBatch', @level2type = N'COLUMN', @level2name = N'ArchivedAt';
GO

EXEC sp_addextendedproperty @name = N'MS_Description',
    @value = N'User who archived the batch. Required when Status = Archived.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'JournalEntryBatch', @level2type = N'COLUMN', @level2name = N'ArchivedByUserID';
GO







-- =============================================================================
-- CODEGEN OUTPUT — GENERATED CODE BELOW THIS LINE. DO NOT EDIT BY HAND.
-- =============================================================================
