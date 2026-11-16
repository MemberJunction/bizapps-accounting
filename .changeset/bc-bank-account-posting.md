---
"@mj-biz-apps/accounting-entities": minor
"@mj-biz-apps/accounting-actions": minor
"@mj-biz-apps/accounting-core-entities-server": minor
"@mj-biz-apps/accounting-ng": minor
---

A GL account can name the Business Central bank account it sits behind (`GLAccount.ExternalBankAccountNumber`). A batch then sends that account's lines to Business Central as Bank Account lines, so they post through the bank ledger, and a cash account with Direct Posting turned off no longer fails the batch. The GL account forms show the field; only Business Central asset accounts can carry it.
