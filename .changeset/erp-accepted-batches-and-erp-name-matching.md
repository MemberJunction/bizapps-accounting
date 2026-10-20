---
"@mj-biz-apps/accounting-core-entities-server": patch
"@mj-biz-apps/accounting-ng": patch
---

A Failed batch the ERP already accepted (it carries the ERP's reference) is no longer offered Cancel on Dispatch status and the Batches overview (#412), and can no longer be archived: `Archive()` refuses it and points to Retry, and the screens hide Archive for it (#413). When raising `ERP_POSTING_NOT_READ_BACK` fails, the engine now holds the raise in the process, answers `Unavailable` instead of trusting "nothing found" in that company, and tries the raise again at each such lookup outside a transaction until it lands (#414). A lookup inside a transaction, such as a cancel's recheck before it commits, keeps the hold and does not write. An Integration named `BC` now matches Business Central batches (#418). QuickBooks Online is matched by its own name (or bare `QuickBooks`), so a QuickBooks Desktop or other QuickBooks Integration no longer matches QuickBooks batches or resolves to the QuickBooks Online provider (#419).
