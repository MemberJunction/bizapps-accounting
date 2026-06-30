-- =============================================================================
-- Drop the IntercompanyRelationship table + its invariant trigger.
--
-- Design correction: the Payments app owns intercompany balancing, so Accounting
-- must NOT carry an intercompany provisioning/netting engine. This forward
-- migration removes the Block-3 IntercompanyRelationship wiring table (added in
-- v0.1.4) and its trg_ICR_AccountOwnershipAndType (50015) invariant trigger.
--
-- The AccountingCompanyProfile.ApprovalCFOPersonID column (also added in v0.1.4)
-- is intentionally LEFT IN PLACE — it is the per-company CFO approver the
-- bizapps-tasks approval gate resolves from, and is unrelated to intercompany.
--
-- Conventions: hardcoded schema __mj_BizAppsAccounting (this app's convention).
-- =============================================================================

DROP TRIGGER IF EXISTS __mj_BizAppsAccounting.trg_ICR_AccountOwnershipAndType;
GO

DROP TABLE IF EXISTS __mj_BizAppsAccounting.IntercompanyRelationship;
GO
