-- =============================================================================
-- V202608062100 — AccountingCompanyProfile: surface the required mirrored fields
--                 in the leading form section.
-- =============================================================================
-- WHY THIS IS A V MIGRATION AND NOT AN EDIT TO THE BASELINE
--
-- The baseline's generated half is produced by CodeGen and is regenerated wholesale
-- (the codegen capture replaces everything below its banner), so a hand edit there
-- would be silently discarded on the next regeneration. A V migration runs AFTER the
-- baseline on every deploy — clean or existing — so it is the supported way to state a
-- deliberate deviation from what CodeGen's AI decided.
--
-- WHAT CODEGEN'S AI DECIDED, AND WHY WE OVERRIDE IT
--
-- AccountingCompanyProfile is an IS-A (Table-Per-Type) child of __mj.Company, so CodeGen
-- mirrors the parent's columns onto it as VIRTUAL fields. Virtual fields are appended after
-- the real columns, which puts them at the END of the sequence.
--
-- FORM LAYOUT: `FormLayoutGeneration` grouped every mirrored field into a
-- "Company Details" category. Section order follows the lowest Sequence in each
-- category, so that section renders FIFTH — and it holds `Name` and `Description`,
-- both of which are NOT NULL. A create dialog that hides two required fields five
-- sections down cannot be completed without hunting for them. Moving just those two
-- into the leading "Accounting Profile" section fixes that; the genuinely optional
-- mirrored fields (Website, LogoURL, Domain) stay in Company Details, which is a
-- reasonable home for them.
--
-- (A second override — restoring IsNameField on `Name`, MJ#3551 — used to live here.
-- The upstream fix (MJ PR #3651) landed in CodeGen, so the baseline now captures the
-- correct value and that block was removed on the 2026-08-09 recapture.)
--
-- The AutoUpdate* flags are MJ's own opt-out: setting them to 0 marks these values as
-- human-decided, so a later `codegen --ai` cannot revert them. Without that, the next
-- enrichment run would simply undo this migration.
--
-- Keyed by entity + field NAME, never by ID: a from-zero rebuild re-mints metadata IDs,
-- and this migration must survive that.
--
-- RECAPTURE WORKFLOW NOTE: this file depends on the baseline's CodeGen tail (the THROW
-- below is a deliberate tripwire against shipping a tail-less baseline). When
-- recapturing the tail, set this file ASIDE (out of migrations/) before migrating the
-- trimmed baseline, and restore it before the from-zero stage-test proof.
-- =============================================================================

DECLARE @EntityID UNIQUEIDENTIFIER =
    (SELECT ID FROM [${mjSchema}].[Entity]
     WHERE Name = 'MJ_BizApps_Accounting: Accounting Company Profiles');

IF @EntityID IS NULL
    THROW 50100, 'V202608062100: AccountingCompanyProfile entity not found — CodeGen metadata must exist before this migration runs.', 1;

-- Surface the two REQUIRED mirrored fields in the leading section, and pin the choice.
UPDATE [${mjSchema}].[EntityField]
   SET Category = 'Accounting Profile',
       AutoUpdateCategory = 0
 WHERE EntityID = @EntityID
   AND Name IN ('Name', 'Description');
GO
