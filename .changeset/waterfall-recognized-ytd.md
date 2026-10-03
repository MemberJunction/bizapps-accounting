---
'@mj-biz-apps/accounting-ng': minor
'@mj-biz-apps/accounting-engine-base': minor
'@mj-biz-apps/accounting-core-entities-server': patch
---

The deferred-revenue waterfall adds a "Recognized YTD" KPI (#231): entries recognized between the first day of the company's fiscal year and the business day, inclusive. The fiscal-year start comes from the company's Accounting Company Profile, 1 January when it has none. The rule (`FiscalYearOf`, `IsInFiscalYearToDate`, `AccountingEngineBase.FiscalYearStartFor`) moves to accounting-engine-base, and journal-entry numbering now uses it too, with no change in the fiscal years it assigns.
