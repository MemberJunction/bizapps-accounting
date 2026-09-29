---
"@mj-biz-apps/accounting-core-entities-server": patch
---

A Business Central account's External Account ID must be a BC account number (bc-aidp-next-golive#282).

For Business Central, `GLAccount.ExternalAccountID` is the BC account number the account posts under: the remap for an account whose `Code` (immutable) is not its BC number. Blank posts under the `Code`. Dispatch has always sent it as the journal line's `accountNumber`. The AIDP Next data conversion wrote BC's account id there instead, a 36-character GUID, which BC's `accountNumber` (20 characters at most) would reject on every batch.

- **At save.** A GL account with External System `BusinessCentral` and an External Account ID longer than 20 characters is refused, naming the account and saying to enter the BC account number or clear the field.
- **At dispatch.** A batch bound for Business Central whose GL account resolves to an External Account ID longer than 20 characters is refused before BC is called, with the same message. The pre-send lookup reports it as an error rather than a mismatch. This also covers accounts with External System blank, and accounts already saved with an id.
- `BusinessCentralAccountNumberError` and `BUSINESS_CENTRAL_ACCOUNT_NUMBER_MAX_LENGTH` are exported from `GLAccountEntityServer`.

Accounts already holding BC's account id need their External Account ID cleared, or set to the BC account number (for converted accounts, their `Code`), before a batch posts to Business Central.
