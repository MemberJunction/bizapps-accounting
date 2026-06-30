-- =============================================================================
-- Block 3 (account wiring) + Block 2 (CFO approval) schema.
--
-- 1) IntercompanyRelationship — the per-company-pair Due-To/Due-From GL account WIRING
--    (OQ-A; ERD §7). Per §C1 this table holds ONLY the account wiring; the balancing
--    legs are generated UPSTREAM (Orders/Payments) and Accounting NETS + batches them.
--    One row per UNORDERED pair, kept canonical via UQ + CHECK(CompanyAID < CompanyBID).
--    A trigger enforces each of the 4 GL accounts lives in its OWNER company's COA with
--    the correct AccountType (Due-To = Liability, Due-From = Asset) — FKs can't express
--    that cross-column rule, so it joins the §11.1 DB-invariant matrix (THROW 50015).
--
-- 2) AccountingCompanyProfile.ApprovalCFOPersonID — the per-company CFO who approves a
--    JE batch before dispatch (the real bizapps-tasks approval gate resolves the
--    approver from here). Nullable FK to the bizapps-common Person.
--
-- Conventions: hardcoded schema __mj_BizAppsAccounting (this app's convention); NO
-- __mj_Created/UpdatedAt columns and NO FK indexes (CodeGen adds them); extended
-- properties on every new column so CodeGen documents them.
-- =============================================================================

---------------------------------------------------------------------------
-- 1. IntercompanyRelationship
---------------------------------------------------------------------------
CREATE TABLE __mj_BizAppsAccounting.IntercompanyRelationship (
    ID UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    CompanyAID UNIQUEIDENTIFIER NOT NULL,
    CompanyBID UNIQUEIDENTIFIER NOT NULL,
    ADueToBGLAccountID UNIQUEIDENTIFIER NOT NULL,
    ADueFromBGLAccountID UNIQUEIDENTIFIER NOT NULL,
    BDueToAGLAccountID UNIQUEIDENTIFIER NOT NULL,
    BDueFromAGLAccountID UNIQUEIDENTIFIER NOT NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    CONSTRAINT PK_IntercompanyRelationship PRIMARY KEY (ID),
    CONSTRAINT FK_ICR_CompanyA      FOREIGN KEY (CompanyAID)          REFERENCES __mj_BizAppsAccounting.AccountingCompanyProfile(ID),
    CONSTRAINT FK_ICR_CompanyB      FOREIGN KEY (CompanyBID)          REFERENCES __mj_BizAppsAccounting.AccountingCompanyProfile(ID),
    CONSTRAINT FK_ICR_ADueToB       FOREIGN KEY (ADueToBGLAccountID)  REFERENCES __mj_BizAppsAccounting.GLAccount(ID),
    CONSTRAINT FK_ICR_ADueFromB     FOREIGN KEY (ADueFromBGLAccountID) REFERENCES __mj_BizAppsAccounting.GLAccount(ID),
    CONSTRAINT FK_ICR_BDueToA       FOREIGN KEY (BDueToAGLAccountID)  REFERENCES __mj_BizAppsAccounting.GLAccount(ID),
    CONSTRAINT FK_ICR_BDueFromA     FOREIGN KEY (BDueFromAGLAccountID) REFERENCES __mj_BizAppsAccounting.GLAccount(ID),
    -- Canonical, dedup-safe pair: (A,B) with A<B can't be re-stored as (B,A), and A<B excludes self-pairs.
    CONSTRAINT UQ_ICR_Pair          UNIQUE (CompanyAID, CompanyBID),
    CONSTRAINT CK_ICR_CanonicalPair CHECK (CompanyAID < CompanyBID),
    -- The 4 accounts must be distinct.
    CONSTRAINT CK_ICR_DistinctAccts CHECK (
        ADueToBGLAccountID <> ADueFromBGLAccountID
        AND BDueToAGLAccountID <> BDueFromAGLAccountID
        AND ADueToBGLAccountID <> BDueToAGLAccountID
        AND ADueFromBGLAccountID <> BDueFromAGLAccountID
    )
);
GO

EXEC sp_addextendedproperty @name = N'MS_Description',
    @value = N'Per-company-pair Due-To/Due-From GL account wiring for intercompany settlement (ERD §7, OQ-A). Holds ONLY the account wiring; balancing legs are generated upstream (Orders/Payments) and Accounting nets + batches them (§C1). One row per unordered pair, kept canonical via CompanyAID < CompanyBID.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'IntercompanyRelationship';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The lower-ordered company of the pair (canonical: CompanyAID < CompanyBID). FK to AccountingCompanyProfile so both ends are accounting-enabled.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'IntercompanyRelationship', @level2type = N'COLUMN', @level2name = N'CompanyAID';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The higher-ordered company of the pair (canonical: CompanyAID < CompanyBID). FK to AccountingCompanyProfile.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'IntercompanyRelationship', @level2type = N'COLUMN', @level2name = N'CompanyBID';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Company A''s Due-To-B account (a Liability in A''s COA): what A owes B.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'IntercompanyRelationship', @level2type = N'COLUMN', @level2name = N'ADueToBGLAccountID';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Company A''s Due-From-B account (an Asset in A''s COA): what B owes A.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'IntercompanyRelationship', @level2type = N'COLUMN', @level2name = N'ADueFromBGLAccountID';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Company B''s Due-To-A account (a Liability in B''s COA): what B owes A.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'IntercompanyRelationship', @level2type = N'COLUMN', @level2name = N'BDueToAGLAccountID';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Company B''s Due-From-A account (an Asset in B''s COA): what A owes B.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'IntercompanyRelationship', @level2type = N'COLUMN', @level2name = N'BDueFromAGLAccountID';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Whether this intercompany relationship is active (eligible for netting/settlement).',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'IntercompanyRelationship', @level2type = N'COLUMN', @level2name = N'IsActive';
GO

---------------------------------------------------------------------------
-- 1a. Invariant trigger: each Due-To/Due-From account in its owner's COA + right type.
--     Due-To = Liability (owed by the owner); Due-From = Asset (owed to the owner).
---------------------------------------------------------------------------
CREATE OR ALTER TRIGGER __mj_BizAppsAccounting.trg_ICR_AccountOwnershipAndType
ON __mj_BizAppsAccounting.IntercompanyRelationship
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (
        SELECT 1 FROM inserted i
        WHERE NOT EXISTS (SELECT 1 FROM __mj_BizAppsAccounting.GLAccount g
                          WHERE g.ID = i.ADueToBGLAccountID   AND g.CompanyID = i.CompanyAID AND g.AccountType = 'Liability')
           OR NOT EXISTS (SELECT 1 FROM __mj_BizAppsAccounting.GLAccount g
                          WHERE g.ID = i.ADueFromBGLAccountID AND g.CompanyID = i.CompanyAID AND g.AccountType = 'Asset')
           OR NOT EXISTS (SELECT 1 FROM __mj_BizAppsAccounting.GLAccount g
                          WHERE g.ID = i.BDueToAGLAccountID   AND g.CompanyID = i.CompanyBID AND g.AccountType = 'Liability')
           OR NOT EXISTS (SELECT 1 FROM __mj_BizAppsAccounting.GLAccount g
                          WHERE g.ID = i.BDueFromAGLAccountID AND g.CompanyID = i.CompanyBID AND g.AccountType = 'Asset')
    )
    BEGIN
        THROW 50015, 'IntercompanyRelationship: each Due-To/Due-From GL account must live in its owner company''s COA with the correct AccountType (Due-To=Liability, Due-From=Asset).', 1;
    END
END;
GO

---------------------------------------------------------------------------
-- 2. AccountingCompanyProfile.ApprovalCFOPersonID — per-company CFO approver.
---------------------------------------------------------------------------
ALTER TABLE __mj_BizAppsAccounting.AccountingCompanyProfile
    ADD ApprovalCFOPersonID UNIQUEIDENTIFIER NULL;
GO

ALTER TABLE __mj_BizAppsAccounting.AccountingCompanyProfile
    ADD CONSTRAINT FK_ACP_ApprovalCFOPerson
    FOREIGN KEY (ApprovalCFOPersonID) REFERENCES __mj_BizAppsCommon.Person(ID);
GO

EXEC sp_addextendedproperty @name = N'MS_Description',
    @value = N'The CFO (a bizapps-common Person) who must approve a Journal Entry Batch for this company before it dispatches to the ERP. Resolved by the bizapps-tasks approval gate. Nullable: companies without a configured CFO fall back to the role-based resolver.',
    @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsAccounting', @level1type = N'TABLE', @level1name = N'AccountingCompanyProfile', @level2type = N'COLUMN', @level2name = N'ApprovalCFOPersonID';
GO
