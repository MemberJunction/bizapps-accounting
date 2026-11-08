# Seeding the Customer Deposits account, per company

One `GLAccountLink` per company for the `Customer Deposits` role. **Until a company has that link, orders refuses any payment that needs a deposit leg**, which means any cash received against an instalment that has not been invoiced yet. Payments against invoiced instalments and orders with no payment schedule never need the role and are unaffected.

## What to create

| | |
|---|---|
| **Role** | `Customer Deposits` (ID `30F23B36-3BEB-4687-BF49-A5607A9B268A`, seeded by the row in `metadata/gl-account-roles`, which reaches a host through the release's `*__Metadata_Sync.sql`) |
| **Account** | Finance's choice: a dedicated Customer Deposits liability account, or the company's Deferred Revenue account |
| **Level** | Company is enough. The role resolves like every other role (product, product category, product type, then company), so a product-level link overrides the company one where finance wants that |
| **How many** | One per company at company level. The role is `Cardinality: One`, so the tie guard refuses a second Active link for the same record with the same `StartedAt`; a link with a later `StartedAt` supersedes the earlier one |

Each legal entity needs its **own** account. A Division, Department or Branch keeps no books of its own: its entries use its legal entity's account, found through a link on the Division's own record or, failing that, on the legal entity's (golive #313). Orders refuses an account belonging to another legal entity outright (orders D6: accounting derives a journal entry's company from the account).

## What orders books against it

- **Cash before the invoice.** A payment against an instalment that has not been issued: `Dr Cash / Cr Customer Deposits`. Accounts Receivable is credited only up to what the company has actually invoiced and not been paid.
- **Issuing the instalment.** The invoice posts at full value (`Dr AR / Cr Deferred Revenue`, or Unbilled Receivable first where revenue ran ahead of billing), then a separate pair clears the deposit: `Dr Customer Deposits / Cr AR`.
- **Refunding a deposit.** Mirrors the capture: `Dr Customer Deposits / Cr Cash`.

Worked example. A customer prepays 200 against a 200 instalment not yet invoiced. Capture: `Dr Cash 200 / Cr Customer Deposits 200`. Issue: `Dr AR 200 / Cr Deferred Revenue 200`, then `Dr Customer Deposits 200 / Cr AR 200`. End state: Cash 200, Deferred Revenue 200, AR and Customer Deposits both zero. If the role is linked to the Deferred Revenue account, the issue entry debits and credits the same account for 200 and the end state is identical.

## The name is a cross-repo contract

bizapps-orders writes this role's `Name` in one place, `GL_ROLE.CustomerDeposits = 'Customer Deposits'` in `packages/CoreEntitiesServer/src/GLAccountResolver.ts`, and resolves roles by accounting's exact `Name` string. Rename it in one repo only and every deposit is refused as unlinked.

## How the row reaches a database

`metadata/gl-account-roles/.gl-account-roles.json` is the source of truth; the change that added this role contributed only its row there. A release reaches hosts through one `*__Metadata_Sync.sql` migration that the build engineer generates from the JSON when cutting the release; PRs do not carry seed migrations of their own (`scripts/check-release-seed-coverage.mjs`). This row shipped in `V202609282330__v0.16.x__Metadata_Sync.sql`.
