---
'@mj-biz-apps/accounting-engine-base': patch
'@mj-biz-apps/accounting-core-entities-server': patch
---

A journal-entry draft line can carry the amount it had in another currency: `OriginalCurrencyCode`, `OriginalDebitAmount` or `OriginalCreditAmount`, and `ExchangeRateUsed`. The engine writes them to the line, and a reversal mirrors them. A line whose original amount times its rate differs from its debit or credit by more than one cent is refused, by the draft pipeline (`ORIGINAL_AMOUNT_MISMATCH`) and by the line's own validation. `GetCurrencySpotRate(from, to, day)` returns the latest active spot rate for a currency pair on or before a day, or null.
