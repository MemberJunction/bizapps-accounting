---
"@mj-biz-apps/accounting-ng": patch
---

The deferred-revenue waterfall counts an entry as recognized from its `EffectiveDate` day, not from the first of
its month, and a month's "Released" amount and chip follow the same rule. Reversed entries and reversal entries
are left out, since the pair nets to zero. The "Recognized YTD" KPI, which summed the whole schedule, is now
"Recognized to Date" (`WaterfallSummary.TotalRecognizedToDate`). The unused `FormatCompact` method is removed.
