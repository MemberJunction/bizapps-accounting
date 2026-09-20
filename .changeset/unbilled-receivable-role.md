---
"@mj-biz-apps/accounting-core-entities-server": minor
---

Seed the `Unbilled Receivable` GL account role (contract asset) — orders D89, golive #240.

Orders books the whole contract value to Accounts Receivable at confirm, whatever the billing schedule says, so a three-year contract billed annually lands all three years in AR on day one. That is the gross-up Jeremy's monthly long-term AR reclass undoes by hand, and the one converting Active Contracts would otherwise recreate inside AiDP on day one. Splitting the booking debit needs a second asset account to route the not-yet-billable portion to, and there was none: the ten seeded roles are Cash, BankAccount, Accounts Receivable, Inventory, COGS, Sales, Sales Discounts, Sales Returns and Allowances, Deferred Revenue and Processing Fee.

`V202609201200__v0.1.x__UnbilledReceivableRole.sql` inserts one `GLAccountRole` row — `Unbilled Receivable`, hardcoded ID `3EFC77F3-2468-463F-9197-D0A8A6762A36`, Active, Cardinality `One`, Sequence 100 — behind the same `IF NOT EXISTS (… ID = … OR Name = …)` guard the BankAccount role uses. `metadata/gl-account-roles/.gl-account-roles.json` carries the same row as the dev source of truth. It is seeded in a migration rather than left to metadata sync for the reason the BankAccount role states: `mj app install` runs migrations and never `mj sync push`, so a metadata-only role reaches no host. A data seed with no DDL, so there is no CodeGen output folded below a banner.

The role's `Name` is a cross-repo contract — bizapps-orders resolves it by the exact string `'Unbilled Receivable'` via `GL_ROLE.UnbilledReceivable`. Renaming either side alone makes the role silently unresolvable, and orders then falls back to AR forever while every entry still balances.

`docs/unbilled-receivable-seeding.md` is the runbook for the other half: one company-level `GLAccountLink` per company, pointing at that company's own `11300 Unbilled Revenue (Contract Asset)`. Until those links exist orders books to AR exactly as it does today and logs a warning — nothing fails, which is precisely why the runbook spells out what the silence means.
