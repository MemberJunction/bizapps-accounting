---
'@mj-biz-apps/accounting-ng': patch
---

Date-only fields (`PostingDate`, `EffectiveDate`) now show the stored day for viewers west of UTC instead of the day before (golive #168). This covers the company overview's recent batches, the Batches page list, Build Batch preview rows and covered range, the Accounting overview's batch list, and the Batch Status dashboard. The overview's monthly JE volume bars now bucket by calendar month, so entries dated the 1st no longer count toward the prior month.
