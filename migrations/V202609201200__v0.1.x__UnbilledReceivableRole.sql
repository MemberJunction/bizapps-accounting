-- =============================================================================
-- Migration: V202609201200__v0.1.x__UnbilledReceivableRole.sql
-- Description: The 'Unbilled Receivable' GL account role (contract asset) — D89
-- =============================================================================
--
-- Design: bizapps-orders PR #201, plans/payment-schedules-and-percent-complete-revrec.md
--         §1.1 and §5 (Part B) · Decision D89 · work item W2
-- Issue:   MemberJunction/bc-aidp-next-golive#240 (closed by the companion
--          bizapps-orders PR, which carries the code half)
--
-- WHY
--
-- Orders books the whole contract value to Accounts Receivable at confirm,
-- whatever the billing schedule says. A three-year contract billed annually
-- therefore lands all three years in AR on day one — the gross-up Jeremy's
-- monthly long-term AR reclass exists to undo by hand, and the one converting
-- Active Contracts would otherwise recreate inside AiDP on day one.
--
-- The fix needs a second asset account for the portion that is contracted but
-- not yet billable, so the booking entry can split:
--
--     At confirm, per line:
--       Dr  Unbilled Receivable   the future-dated portion   (contract asset)
--       Dr  Accounts Receivable   the rest
--           Cr  Sales / Deferred Revenue                     (unchanged)
--
--     At each instalment's invoicing:
--       Dr  Accounts Receivable   instalment amount
--           Cr  Unbilled Receivable
--
-- Read at any date the balance sheet then says: AR = billed and unpaid ·
-- Unbilled = contracted, not yet billable · Deferred Revenue = unearned. That is
-- the ASC 606 presentation. Maps to '11300 Unbilled Revenue (Contract Asset)' in
-- Jeremy's 9/18 chart of accounts.
--
-- THE NAME IS A CROSS-REPO CONTRACT. bizapps-orders resolves this role by its
-- exact `Name` string — `GL_ROLE.UnbilledReceivable = 'Unbilled Receivable'` in
-- packages/CoreEntitiesServer/src/GLAccountResolver.ts. One character of drift
-- and the role never resolves, orders falls back to AR forever, and the ledger
-- is quietly exactly as wrong as it is today. Do not rename either side alone.
--
-- Cardinality 'One': a company has one contract-asset account. (Finance has not
-- yet said whether they want conditional and unconditional rights presented
-- separately — plan §14.1, Johanna. Written for one; a second role is additive.)
-- Sequence 100 — the tail of the seeded roles; 10..90 and 15 are taken.
--
-- DATA SEED, NO DDL. This migration inserts one row and changes no schema, so
-- there is no CodeGen output to fold in below a banner. (The BankAccount
-- migration this one copies carried CodeGen only because it also added a column.)
--
-- Seeded here rather than left to metadata sync because MIGRATIONS ARE THE ONLY
-- THING THAT REACHES A HOST: `mj app install` runs migrations and never
-- `mj sync push`. metadata/gl-account-roles carries the same row as the dev
-- source of truth, and a later regenerated Metadata_Sync will find it present
-- and no-op. Precedent and wording: the BankAccount role in
-- V202608271852__v0.1.x__GLAccountRole_Cardinality.sql:99-128.
--
-- THE ROLE ALONE BOOKS NOTHING. Each company needs a GLAccountLink pointing at
-- its own 11300 account before any of the above happens; until then orders
-- records a fallback to AR and warns. That seeding is a data task —
-- docs/unbilled-receivable-seeding.md is the runbook.
-- =============================================================================

IF NOT EXISTS (
    SELECT 1 FROM __mj_BizAppsAccounting.GLAccountRole
    WHERE ID = '3EFC77F3-2468-463F-9197-D0A8A6762A36' OR Name = 'Unbilled Receivable'
)
BEGIN
    INSERT INTO __mj_BizAppsAccounting.GLAccountRole
        (ID, Name, Description, Status, Sequence, Cardinality)
    VALUES
        (
            '3EFC77F3-2468-463F-9197-D0A8A6762A36',
            'Unbilled Receivable',
            'Contract-asset account for contracted revenue that is not yet billable (orders D89). Debited at order confirm for the portion of a line covered by future-dated payment schedule instalments, and relieved to Accounts Receivable as each instalment is invoiced, so AR means "billed and unpaid" specifically. Maps to 11300 Unbilled Revenue (Contract Asset). Company-level link, one per company; without a link orders books the whole line to AR, records the fallback and warns.',
            'Active',
            100,
            'One'
        );
END
GO
