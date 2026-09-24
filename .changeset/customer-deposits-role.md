---
"@mj-biz-apps/accounting-core-entities-server": minor
---

Seed the `Customer Deposits` GL account role, paired with bizapps-orders #234.

A customer can pay an instalment before it is invoiced. No receivable exists yet, so that cash is a liability: money held for something not yet billed. Orders credits this role when the cash lands, debits it when that cash is refunded, and clears it against Accounts Receivable when the instalment is issued. Its balance is only ever cash held ahead of billing.

`metadata/gl-account-roles/.gl-account-roles.json` gains one row: `Customer Deposits`, ID `30F23B36-3BEB-4687-BF49-A5607A9B268A`, Active, Cardinality `One`, Sequence 110. The JSON is the only thing this change contributes. Hosts receive it through the single `*__Metadata_Sync.sql` the build engineer generates per release, not through a migration in this PR.

`docs/customer-deposits-seeding.md` covers the link. Finance picks the account: a dedicated Customer Deposits liability, or the Deferred Revenue account if they want fewer accounts. The entries come out the same either way. With no link, orders refuses a payment that needs the deposit leg, naming the role and the company; it does not fall back to another account.
