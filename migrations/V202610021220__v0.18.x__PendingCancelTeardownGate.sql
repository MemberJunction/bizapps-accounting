-- =============================================================================
-- Migration: V202610021220__v0.18.x__PendingCancelTeardownGate.sql
-- Description: #213 — a Pending batch reaches Cancelled only with its summary
--              pointer cleared, as an Approved or Failed batch already must.
-- =============================================================================
--
-- WHY
--
-- A Pending batch could be set to Cancelled by an ordinary save (the generic
-- form or the GraphQL update). That skips JournalEntryBatchEntityServer.Cancel's
-- teardown: the summary journal entry is not deleted, and the member entries
-- stay Batched under a Cancelled batch, where trg_JournalEntry_Immutability
-- then lets any journal entry save release them. V202609261000 closed this for
-- Approved and Failed batches; the Pending edge predates it.
--
-- WHAT CHANGES
--
-- trg_JournalEntryBatch_Immutability's status rule (50031) now refuses a move to
-- Cancelled from ANY status while SummaryJournalEntryID is still set. The
-- sanctioned paths both clear it first:
--   * Cancel() clears the pointer in the update that marks the batch Cancelled,
--     then releases the members and deletes the summary.
--   * regenerateJournalEntryBatch's empty cancel runs TearDownSummaryAndUnlock
--     (pointer cleared, members released, summary deleted) and only then marks
--     the batch Cancelled.
--
-- The trigger cannot require "no Batched members" instead: Cancel() marks the
-- batch Cancelled BEFORE releasing its members, because the release is what
-- trg_JournalEntry_Immutability sanctions only once the batch is Cancelled.
-- A save that clears the pointer itself is still accepted here, as it is from
-- Approved or Failed; the entity (JournalEntryBatchEntityServer.Validate) is
-- what refuses a cancel that did not come through Cancel().
--
-- Only the 50031 condition, its comment and its message differ from the body
-- V202610021210 (BatchStatusFromSent) left; everything else is that body
-- verbatim, so its Posted/Failed-only-from-Sent rule is kept. Existing rows are
-- not re-checked: the rule applies to status changes from now on.
--
-- DETERMINISTIC, NOT IDEMPOTENT: this runs once, in order, against a database
-- that has the prior migrations.
-- =============================================================================


CREATE OR ALTER TRIGGER __mj_BizAppsAccounting.trg_JournalEntryBatch_Immutability
ON __mj_BizAppsAccounting.JournalEntryBatch
AFTER UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    -- DELETE: an approved batch is never deleted, and neither is the record that one was cancelled.
    IF NOT EXISTS (SELECT 1 FROM inserted) AND EXISTS (
        SELECT 1 FROM deleted
        WHERE Status IN ('Approved','Sent','Posted','Failed','Archived')
           OR (Status = 'Cancelled' AND ApprovedAt IS NOT NULL)
    )
    BEGIN
        THROW 50008, 'JournalEntryBatch cannot be deleted once Status is Approved, Sent, Posted, Failed, or Archived, or once it was cancelled after approval. Cancel it instead.', 1;
    END;

    -- STATUS: Cancelled releases entries, so only Pending / Approved / Failed may reach it, a batch
    -- reaches it only with its summary pointer cleared (by the same update, or by regenerate's
    -- teardown before it), and the terminal statuses never change again. Nothing moves back to
    -- Pending (a Pending batch's members can be released by any journal entry save), only a Pending
    -- batch is approved, and a Sent batch is not archived (it may still be posting in the ERP).
    -- Posted and Failed are the outcomes of a send, so only a Sent batch reaches them; -> Sent is
    -- policed by trg_JournalEntryBatch_SendOnce (50030).
    IF EXISTS (
        SELECT 1
        FROM deleted d
        JOIN inserted i ON i.ID = d.ID
        WHERE i.Status <> d.Status
          AND (
            d.Status IN ('Posted','Cancelled','Archived')
            OR i.Status = 'Pending'
            OR (i.Status = 'Approved' AND d.Status <> 'Pending')
            OR (i.Status = 'Archived' AND d.Status NOT IN ('Pending','Approved','Failed'))
            OR (i.Status = 'Cancelled' AND d.Status NOT IN ('Pending','Approved','Failed'))
            OR (i.Status = 'Cancelled' AND i.SummaryJournalEntryID IS NOT NULL)
            OR (i.Status IN ('Posted','Failed') AND d.Status <> 'Sent')
          )
    )
    BEGIN
        THROW 50031, 'JournalEntryBatch status change refused. Posted, Cancelled and Archived are terminal; no batch returns to Pending; only a Pending batch is approved; Posted and Failed are reachable only from Sent; Archived is reachable only from Pending, Approved or Failed; Cancelled is reachable only from Pending, Approved or Failed; and a batch is cancelled only with its summary pointer cleared (JournalEntryBatchEntityServer.Cancel).', 1;
    END;

    -- AUDIT: the cancel audit and the ERP check are written only by the update that cancels the
    -- batch, so no other save can stamp a "not posted in the ERP" record on it; and SentAt, once set,
    -- is never cleared, because it is the evidence CK_JournalEntryBatch_CancelERPCheck keys on. A
    -- retry re-stamps SentAt with a new time, which is allowed.
    IF EXISTS (
        SELECT 1
        FROM deleted d
        JOIN inserted i ON i.ID = d.ID
        WHERE (d.SentAt IS NOT NULL AND i.SentAt IS NULL)
           OR (
               NOT (i.Status = 'Cancelled' AND d.Status <> 'Cancelled')
               AND (
                   ISNULL(i.CancelReason,                  N'')                                    <> ISNULL(d.CancelReason,                  N'')                                    OR
                   (CASE WHEN i.CancelledAt IS NULL AND d.CancelledAt IS NULL THEN 0 WHEN i.CancelledAt IS NULL OR d.CancelledAt IS NULL THEN 1 WHEN ABS(DATEDIFF_BIG(MICROSECOND, i.CancelledAt, d.CancelledAt)) >= 1000 THEN 1 ELSE 0 END) = 1 OR
                   ISNULL(i.CancelledByUserID,             '00000000-0000-0000-0000-000000000000') <> ISNULL(d.CancelledByUserID,             '00000000-0000-0000-0000-000000000000') OR
                   (CASE WHEN i.ERPNotPostedConfirmedAt IS NULL AND d.ERPNotPostedConfirmedAt IS NULL THEN 0 WHEN i.ERPNotPostedConfirmedAt IS NULL OR d.ERPNotPostedConfirmedAt IS NULL THEN 1 WHEN ABS(DATEDIFF_BIG(MICROSECOND, i.ERPNotPostedConfirmedAt, d.ERPNotPostedConfirmedAt)) >= 1000 THEN 1 ELSE 0 END) = 1 OR
                   ISNULL(i.ERPNotPostedConfirmedByUserID, '00000000-0000-0000-0000-000000000000') <> ISNULL(d.ERPNotPostedConfirmedByUserID, '00000000-0000-0000-0000-000000000000') OR
                   ISNULL(i.ERPNotPostedBasis,             N'')                                    <> ISNULL(d.ERPNotPostedBasis,             N'')
               )
           )
    )
    BEGIN
        THROW 50032, 'JournalEntryBatch audit refused. CancelReason / CancelledAt / CancelledByUserID and ERPNotPostedConfirmedAt / ERPNotPostedConfirmedByUserID / ERPNotPostedBasis are written only by the update that cancels the batch, and SentAt is never cleared once set.', 1;
    END;

    -- CONTENT: frozen from approval on, Failed and Cancelled included. The timestamps this migration
    -- freezes compare at millisecond precision: every entity save writes each column back through a
    -- JavaScript Date, so a value written by SQL with sub-millisecond digits would otherwise read as
    -- changed on the next ordinary save.
    IF EXISTS (
        SELECT 1
        FROM deleted d
        JOIN inserted i ON i.ID = d.ID
        WHERE d.Status IN ('Approved','Sent','Posted','Failed','Archived','Cancelled')
          AND (
            i.JournalEntryBatchNumber          <> d.JournalEntryBatchNumber          OR
            i.CompanyID            <> d.CompanyID            OR
            i.PostingDate          <> d.PostingDate          OR
            -- The summary pointer is frozen, except for the one sanctioned change: an Approved or
            -- Failed batch clearing it in the same update that marks it Cancelled.
            (
                ISNULL(i.SummaryJournalEntryID, '00000000-0000-0000-0000-000000000000') <> ISNULL(d.SummaryJournalEntryID, '00000000-0000-0000-0000-000000000000')
                AND NOT (
                    d.Status IN ('Approved','Failed')
                    AND i.Status = 'Cancelled'
                    AND i.SummaryJournalEntryID IS NULL
                )
            ) OR
            ISNULL(i.ApprovalTaskID,        '00000000-0000-0000-0000-000000000000') <> ISNULL(d.ApprovalTaskID,        '00000000-0000-0000-0000-000000000000') OR
            (CASE WHEN i.ApprovedAt IS NULL AND d.ApprovedAt IS NULL THEN 0 WHEN i.ApprovedAt IS NULL OR d.ApprovedAt IS NULL THEN 1 WHEN ABS(DATEDIFF_BIG(MICROSECOND, i.ApprovedAt, d.ApprovedAt)) >= 1000 THEN 1 ELSE 0 END) = 1 OR
            ISNULL(i.ApprovedByUserID,      '00000000-0000-0000-0000-000000000000') <> ISNULL(d.ApprovedByUserID,      '00000000-0000-0000-0000-000000000000') OR
            ISNULL(i.ApprovedContentHash,   N'')                                    <> ISNULL(d.ApprovedContentHash,   N'')                                    OR
            i.TargetSystem         <> d.TargetSystem         OR
            i.BatchedAt            <> d.BatchedAt            OR
            i.BatchedByUserID      <> d.BatchedByUserID      OR
            i.TotalEntries         <> d.TotalEntries         OR
            i.TotalDebits          <> d.TotalDebits          OR
            i.TotalCredits         <> d.TotalCredits         OR
            -- Once Cancelled, the cancel audit and the ERP-check attestation are the record; they freeze too.
            (
                d.Status = 'Cancelled'
                AND (
                    ISNULL(i.CancelReason,                  N'')                                    <> ISNULL(d.CancelReason,                  N'')                                    OR
                    (CASE WHEN i.CancelledAt IS NULL AND d.CancelledAt IS NULL THEN 0 WHEN i.CancelledAt IS NULL OR d.CancelledAt IS NULL THEN 1 WHEN ABS(DATEDIFF_BIG(MICROSECOND, i.CancelledAt, d.CancelledAt)) >= 1000 THEN 1 ELSE 0 END) = 1 OR
                    ISNULL(i.CancelledByUserID,             '00000000-0000-0000-0000-000000000000') <> ISNULL(d.CancelledByUserID,             '00000000-0000-0000-0000-000000000000') OR
                    (CASE WHEN i.ERPNotPostedConfirmedAt IS NULL AND d.ERPNotPostedConfirmedAt IS NULL THEN 0 WHEN i.ERPNotPostedConfirmedAt IS NULL OR d.ERPNotPostedConfirmedAt IS NULL THEN 1 WHEN ABS(DATEDIFF_BIG(MICROSECOND, i.ERPNotPostedConfirmedAt, d.ERPNotPostedConfirmedAt)) >= 1000 THEN 1 ELSE 0 END) = 1 OR
                    ISNULL(i.ERPNotPostedConfirmedByUserID, '00000000-0000-0000-0000-000000000000') <> ISNULL(d.ERPNotPostedConfirmedByUserID, '00000000-0000-0000-0000-000000000000')
                )
            )
          )
    )
    BEGIN
        THROW 50009, 'JournalEntryBatch is locked (Status=Approved/Sent/Posted/Failed/Archived/Cancelled). Only Status / PostedAt / the Archive audit triple / ExternalJournalEntryBatchRef / ErrorMessage may evolve; the send stamp (SentAt / SentByUserID / SendAttemptCount) changes only on a send (50030); the Cancel audit and ERP check are written only by the update that cancels the batch (50032). CompanyID, PostingDate, SummaryJournalEntryID, the approval-task pointer, ApprovedAt / ApprovedByUserID and ApprovedContentHash freeze at approval; the summary pointer may clear only as an Approved or Failed batch is Cancelled.', 1;
    END;
END;
GO
