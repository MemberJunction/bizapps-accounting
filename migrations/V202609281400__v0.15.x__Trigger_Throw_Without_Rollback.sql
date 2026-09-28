-- =============================================================================
-- Migration: V202609281400__v0.15.x__Trigger_Throw_Without_Rollback.sql
-- Description: #211 — every accounting trigger THROWs without a ROLLBACK
--              TRANSACTION first, so a refused save reports the trigger's own
--              error instead of error 3915.
-- =============================================================================
--
-- WHY
--
-- The entity layer saves through INSERT INTO @ResultTable EXEC sp<Create|Update>,
-- and a ROLLBACK inside INSERT-EXEC is itself an error (3915: "Cannot use the
-- ROLLBACK statement within an INSERT-EXEC statement"). Each trigger below ran
-- ROLLBACK TRANSACTION before its THROW, so the caller got 3915 in place of the
-- trigger's message (50001 … 50031). The write was still refused; only the
-- reason was lost.
--
-- A trigger runs with XACT_ABORT on, so THROW alone rolls the statement's
-- transaction back. Removing the ROLLBACK changes the error the caller sees and
-- nothing else.
--
-- WHAT
--
-- Each trigger is re-created from its current definition (the baseline, or
-- V202609261000 for the two immutability triggers) with the ROLLBACK TRANSACTION
-- lines removed. Conditions, error numbers and messages are unchanged. None of
-- these triggers has a First/Last order set, so ALTER drops no ordering.
--
-- New triggers follow the same rule: THROW, never ROLLBACK then THROW.
--
-- DETERMINISTIC, NOT IDEMPOTENT: this runs once, in order, against a database
-- that has the prior migrations.
-- =============================================================================
SET NOCOUNT ON;
GO

CREATE OR ALTER TRIGGER __mj_BizAppsAccounting.trg_JournalEntry_BalancedOnLock
ON __mj_BizAppsAccounting.JournalEntry
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT UPDATE(Status) AND NOT EXISTS (SELECT 1 FROM inserted WHERE Status IN ('Batched','GLPosted'))
        RETURN;

    IF EXISTS (
        SELECT 1
        FROM inserted i
        WHERE i.Status IN ('Batched','GLPosted')
          AND ABS(
            ISNULL((SELECT SUM(jel.DebitAmount)  FROM __mj_BizAppsAccounting.JournalEntryLine jel WHERE jel.JournalEntryID = i.ID), 0) -
            ISNULL((SELECT SUM(jel.CreditAmount) FROM __mj_BizAppsAccounting.JournalEntryLine jel WHERE jel.JournalEntryID = i.ID), 0)
          ) > 0.005
    )
    BEGIN
        THROW 50001, 'JournalEntry cannot transition to Batched/GLPosted unless Sum(Debits) = Sum(Credits). See plan §5.2 / BA-D5.', 1;
    END;

    -- (The former AM-4 per-company balance check is retired: JEs are
    --  SINGLE-company (plan D3) — whole-entry balance + the company-match
    --  trigger (4.5) make a per-company check redundant.)
END;
GO

CREATE OR ALTER TRIGGER __mj_BizAppsAccounting.trg_JEL_RecheckParentBalance
ON __mj_BizAppsAccounting.JournalEntryLine
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @AffectedJEs TABLE (JournalEntryID UNIQUEIDENTIFIER PRIMARY KEY);
    INSERT INTO @AffectedJEs (JournalEntryID)
        SELECT DISTINCT JournalEntryID FROM inserted
        UNION
        SELECT DISTINCT JournalEntryID FROM deleted;

    IF EXISTS (
        SELECT 1
        FROM @AffectedJEs aj
        JOIN __mj_BizAppsAccounting.JournalEntry je ON je.ID = aj.JournalEntryID
        WHERE je.Status IN ('Batched','GLPosted')
          AND ABS(
            ISNULL((SELECT SUM(jel.DebitAmount)  FROM __mj_BizAppsAccounting.JournalEntryLine jel WHERE jel.JournalEntryID = je.ID), 0) -
            ISNULL((SELECT SUM(jel.CreditAmount) FROM __mj_BizAppsAccounting.JournalEntryLine jel WHERE jel.JournalEntryID = je.ID), 0)
          ) > 0.005
    )
    BEGIN
        THROW 50002, 'JournalEntryLine change broke balance on a locked JournalEntry (Status=Batched/GLPosted).', 1;
    END;

END;
GO

CREATE OR ALTER TRIGGER __mj_BizAppsAccounting.trg_JournalEntry_Immutability
ON __mj_BizAppsAccounting.JournalEntry
AFTER UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    -- DELETE: block if any deleted row was locked
    IF NOT EXISTS (SELECT 1 FROM inserted) AND EXISTS (SELECT 1 FROM deleted WHERE Status IN ('Batched','GLPosted'))
    BEGIN
        THROW 50003, 'JournalEntry cannot be deleted once Status is Batched or GLPosted. Use the reversal pattern (new Pending JE with ReversesJournalEntryID).', 1;
    END;

    -- UPDATE: block changes to frozen fields when previous Status was locked.
    -- Allowed on a locked row: GLPostedAt, GLReferenceID, ReversedByJournalEntryID,
    -- Status Batched→GLPosted, and the reversible unlock (Status Batched→Pending +
    -- JournalEntryBatchID→NULL while the owning batch is Pending or Cancelled).
    IF EXISTS (
        SELECT 1
        FROM deleted d
        JOIN inserted i ON i.ID = d.ID
        WHERE d.Status IN ('Batched','GLPosted')
          AND (
            -- (A) any frozen field OTHER THAN JournalEntryBatchID changed → never allowed on a locked row
            i.EntryNumber                 <> d.EntryNumber                 OR
            i.CompanyID                   <> d.CompanyID                   OR
            i.EffectiveDate               <> d.EffectiveDate               OR
            i.EntryTypeID                 <> d.EntryTypeID                 OR
            ISNULL(CAST(i.Description AS NVARCHAR(MAX)),N'') <> ISNULL(CAST(d.Description AS NVARCHAR(MAX)),N'') OR
            ISNULL(i.LinkedEntityID,           '00000000-0000-0000-0000-000000000000') <> ISNULL(d.LinkedEntityID,           '00000000-0000-0000-0000-000000000000') OR
            ISNULL(i.LinkedRecordID,           N'')                                    <> ISNULL(d.LinkedRecordID,           N'')                                    OR
            ISNULL(i.ReversesJournalEntryID,   '00000000-0000-0000-0000-000000000000') <> ISNULL(d.ReversesJournalEntryID,   '00000000-0000-0000-0000-000000000000') OR
            ISNULL(i.FileID,                   '00000000-0000-0000-0000-000000000000') <> ISNULL(d.FileID,                   '00000000-0000-0000-0000-000000000000') OR
            -- (B) JournalEntryBatchID changed, and this is NOT the sanctioned reversible unlock
            (
                ISNULL(i.JournalEntryBatchID, '00000000-0000-0000-0000-000000000000') <> ISNULL(d.JournalEntryBatchID, '00000000-0000-0000-0000-000000000000')
                AND NOT (
                    d.Status = 'Batched'
                    AND i.Status = 'Pending'
                    AND i.JournalEntryBatchID IS NULL
                    AND EXISTS (SELECT 1 FROM __mj_BizAppsAccounting.JournalEntryBatch b WHERE b.ID = d.JournalEntryBatchID AND b.Status IN ('Pending','Cancelled'))
                )
            )
          )
    )
    BEGIN
        THROW 50004, 'JournalEntry is locked (Status=Batched/GLPosted). Only GLPostedAt, GLReferenceID, ReversedByJournalEntryID, Status (Batched→GLPosted), and the reversible unlock (Batched→Pending + JournalEntryBatchID→NULL while the batch is Pending or Cancelled) may change.', 1;
    END;

    -- Disallow regressing Status backwards on a locked row. Batched→Pending is permitted ONLY as the
    -- reversible unlock (JournalEntryBatchID cleared, owning batch Pending or Cancelled); GLPosted never regresses.
    IF EXISTS (
        SELECT 1
        FROM deleted d
        JOIN inserted i ON i.ID = d.ID
        WHERE (d.Status = 'GLPosted' AND i.Status IN ('Pending','Batched'))
           OR (
               d.Status = 'Batched' AND i.Status = 'Pending'
               AND NOT (
                   i.JournalEntryBatchID IS NULL
                   AND EXISTS (SELECT 1 FROM __mj_BizAppsAccounting.JournalEntryBatch b WHERE b.ID = d.JournalEntryBatchID AND b.Status IN ('Pending','Cancelled'))
               )
           )
    )
    BEGIN
        THROW 50005, 'JournalEntry Status cannot regress (only Pending→Batched, Batched→GLPosted, and the reversible Batched→Pending unlock of a Pending or Cancelled batch are allowed).', 1;
    END;
END;
GO

CREATE OR ALTER TRIGGER __mj_BizAppsAccounting.trg_JEL_Immutability
ON __mj_BizAppsAccounting.JournalEntryLine
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @LockedJEs TABLE (JournalEntryID UNIQUEIDENTIFIER PRIMARY KEY);
    INSERT INTO @LockedJEs (JournalEntryID)
        SELECT DISTINCT je.ID
          FROM __mj_BizAppsAccounting.JournalEntry je
         WHERE je.ID IN (SELECT JournalEntryID FROM inserted UNION SELECT JournalEntryID FROM deleted)
           AND je.Status IN ('Batched','GLPosted');

    IF EXISTS (SELECT 1 FROM @LockedJEs)
    BEGIN
        THROW 50006, 'JournalEntryLine on a locked JournalEntry (Status=Batched/GLPosted) cannot be inserted, modified, or deleted. Use the reversal pattern.', 1;
    END;
END;
GO

CREATE OR ALTER TRIGGER __mj_BizAppsAccounting.trg_JEL_CompanyMatch
ON __mj_BizAppsAccounting.JournalEntryLine
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (
        SELECT 1
        FROM inserted i
        JOIN __mj_BizAppsAccounting.JournalEntry je ON je.ID = i.JournalEntryID
        JOIN __mj_BizAppsAccounting.GLAccount gl ON gl.ID = i.GLAccountID
        WHERE gl.CompanyID <> je.CompanyID
    )
    BEGIN
        THROW 50019, 'JournalEntryLine.GLAccountID must belong to the parent JournalEntry''s company (single-company JE, plan D3).', 1;
    END;
END;
GO

CREATE OR ALTER TRIGGER __mj_BizAppsAccounting.trg_JE_CompanyMatch
ON __mj_BizAppsAccounting.JournalEntry
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF UPDATE(CompanyID) AND EXISTS (
        SELECT 1
        FROM inserted i
        JOIN __mj_BizAppsAccounting.JournalEntryLine jel ON jel.JournalEntryID = i.ID
        JOIN __mj_BizAppsAccounting.GLAccount gl ON gl.ID = jel.GLAccountID
        WHERE gl.CompanyID <> i.CompanyID
    )
    BEGIN
        THROW 50022, 'JournalEntry.CompanyID cannot change to a company that does not own every line''s GLAccount (single-company JE, plan D3).', 1;
    END;
END;
GO

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

    -- STATUS: Cancelled releases entries, so only Pending / Approved / Failed may reach it, an
    -- Approved or Failed batch reaches it only with its summary pointer cleared in the same update,
    -- and the terminal statuses never change again. Nothing moves back to Pending (a Pending batch's
    -- members can be released by any journal entry save), only a Pending batch is approved, and a
    -- Sent batch is not archived (it may still be posting in the ERP).
    -- Pending -> Sent / Posted / Failed is refused by the entity only (tracked separately).
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
            OR (i.Status = 'Cancelled' AND d.Status IN ('Approved','Failed') AND i.SummaryJournalEntryID IS NOT NULL)
          )
    )
    BEGIN
        THROW 50031, 'JournalEntryBatch status change refused. Posted, Cancelled and Archived are terminal; no batch returns to Pending; only a Pending batch is approved; Archived is reachable only from Pending, Approved or Failed; Cancelled is reachable only from Pending, Approved or Failed; and an Approved or Failed batch is cancelled only with its summary pointer cleared in the same update (JournalEntryBatchEntityServer.Cancel).', 1;
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
        THROW 50009, 'JournalEntryBatch is locked (Status=Approved/Sent/Posted/Failed/Archived/Cancelled). Only Status / SentAt / PostedAt / the Archive audit triple / ExternalJournalEntryBatchRef / ErrorMessage may evolve; the Cancel audit and ERP check are written only by the update that cancels the batch (50032). CompanyID, PostingDate, SummaryJournalEntryID, the approval-task pointer, ApprovedAt / ApprovedByUserID and ApprovedContentHash freeze at approval; the summary pointer may clear only as an Approved or Failed batch is Cancelled.', 1;
    END;
END;
GO

CREATE OR ALTER TRIGGER __mj_BizAppsAccounting.trg_JournalEntryBatch_SummaryCoherence
ON __mj_BizAppsAccounting.JournalEntryBatch
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (
        SELECT 1
        FROM inserted b
        LEFT JOIN __mj_BizAppsAccounting.JournalEntry s ON s.ID = b.SummaryJournalEntryID
        LEFT JOIN __mj_BizAppsAccounting.JournalEntryType st ON st.ID = s.EntryTypeID
        WHERE b.SummaryJournalEntryID IS NOT NULL
          AND (
            s.ID IS NULL
            OR ISNULL(st.IsJournalEntryBatchSummary, 0) = 0
            OR ISNULL(s.JournalEntryBatchID, '00000000-0000-0000-0000-000000000000') <> b.ID
            OR s.CompanyID <> b.CompanyID
          )
    )
    BEGIN
        THROW 50023, 'JournalEntryBatch.SummaryJournalEntryID must reference a JournalEntry whose JournalEntryType has IsJournalEntryBatchSummary=1, JournalEntryBatchID = this batch, and the batch''s CompanyID.', 1;
    END;
END;
GO

CREATE OR ALTER TRIGGER __mj_BizAppsAccounting.trg_ACP_NoChains
ON __mj_BizAppsAccounting.AccountingCompanyProfile
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (
        SELECT 1
        FROM inserted i
        JOIN __mj_BizAppsAccounting.AccountingCompanyProfile parent
          ON parent.ID = i.ParentAccountingCompanyID
        WHERE parent.ParentAccountingCompanyID IS NOT NULL
    )
    BEGIN
        THROW 50010, 'AccountingCompanyProfile.ParentAccountingCompanyID cannot point to a profile that itself has a parent (no chains, per BA-D9).', 1;
    END;
END;
GO

CREATE OR ALTER TRIGGER __mj_BizAppsAccounting.trg_JE_ReversalConsistency
ON __mj_BizAppsAccounting.JournalEntry
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (
        SELECT 1
        FROM inserted i
        JOIN __mj_BizAppsAccounting.JournalEntryType t ON t.ID = i.EntryTypeID
        WHERE i.ReversesJournalEntryID IS NOT NULL
          AND t.Code <> 'Reversal'
    )
    BEGIN
        THROW 50012, 'JournalEntry that sets ReversesJournalEntryID must be typed with JournalEntryType Code = ''Reversal''.', 1;
    END;
END;
GO

CREATE OR ALTER TRIGGER __mj_BizAppsAccounting.trg_IAM_AccountIntegrity
ON __mj_BizAppsAccounting.IntercompanyAccountMatch
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (
        SELECT 1
        FROM inserted i
        JOIN __mj_BizAppsAccounting.GLAccount gl ON gl.ID = i.DueToGLAccountID
        WHERE gl.CompanyID <> i.SourceCompanyID
    )
    BEGIN
        THROW 50024, 'IntercompanyAccountMatch.DueToGLAccountID must belong to SourceCompanyID — the Due To liability sits on the books of the company that owes (BA-D27).', 1;
    END;

    IF EXISTS (
        SELECT 1
        FROM inserted i
        JOIN __mj_BizAppsAccounting.GLAccount gl ON gl.ID = i.DueFromGLAccountID
        WHERE gl.CompanyID <> i.TargetCompanyID
    )
    BEGIN
        THROW 50025, 'IntercompanyAccountMatch.DueFromGLAccountID must belong to TargetCompanyID — the Due From receivable sits on the books of the company that is owed (BA-D27).', 1;
    END;

    IF EXISTS (
        SELECT 1
        FROM inserted i
        JOIN __mj_BizAppsAccounting.GLAccount dt ON dt.ID = i.DueToGLAccountID
        JOIN __mj_BizAppsAccounting.GLAccount df ON df.ID = i.DueFromGLAccountID
        WHERE dt.AccountType <> 'Liability' OR df.AccountType <> 'Asset'
    )
    BEGIN
        THROW 50026, 'IntercompanyAccountMatch requires DueToGLAccountID to be a Liability account and DueFromGLAccountID to be an Asset account.', 1;
    END;
END;
GO

CREATE OR ALTER TRIGGER __mj_BizAppsAccounting.trg_IAMD_DimensionValueBelongs
ON __mj_BizAppsAccounting.IntercompanyAccountMatchDimension
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (
        SELECT 1
        FROM inserted i
        JOIN __mj_BizAppsAccounting.DimensionValue dv ON dv.ID = i.DimensionValueID
        WHERE i.DimensionValueID IS NOT NULL
          AND dv.DimensionID <> i.DimensionID
    )
    BEGIN
        THROW 50027, 'IntercompanyAccountMatchDimension.DimensionValueID must be a value of DimensionID.', 1;
    END;
END;
GO
