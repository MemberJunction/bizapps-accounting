---
"@mj-biz-apps/accounting-core-entities-server": minor
---

Seed the `Unbilled Receivable` GL account role (contract asset) — orders D91, golive #240.

Revenue can be earned before it is billed. Under orders' D91 model an order billed by instalment puts no contract value on the balance sheet at confirm, each instalment's invoicing posts `Dr Accounts Receivable / Cr Deferred Revenue`, and a contract's Deferred Revenue nets billing against recognition — so when recognition runs ahead of billing, that account carries a debit balance. That debit balance is the contract asset, and this role gives a period-end process somewhere to present it under its own name (`Dr Unbilled Receivable / Cr Deferred Revenue`, auto-reversing). That reclass is a separate ticket; **nothing in orders resolves this role today**, which is deliberate.

`metadata/gl-account-roles/.gl-account-roles.json` gains one row — `Unbilled Receivable`, ID `3EFC77F3-2468-463F-9197-D0A8A6762A36`, Active, Cardinality `One`, Sequence 100. The JSON is the source of truth and the only thing this change contributes: hosts receive it through the single `*__Metadata_Sync.sql` the build engineer generates per release, not through a migration in this PR.

`docs/unbilled-receivable-seeding.md` is the runbook for the company-level `GLAccountLink` rows Johanna will eventually create, one per company against that company's own `11300 Unbilled Revenue (Contract Asset)`. It records why the account exists, that seeding is not urgent while the role is inert, and that the role's `Name` is a cross-repo contract — bizapps-orders resolves roles by accounting's exact `Name` string, so a one-character difference makes the role silently unresolvable while every entry still balances.
