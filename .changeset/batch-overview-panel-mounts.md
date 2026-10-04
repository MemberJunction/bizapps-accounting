---
'@mj-biz-apps/accounting-ng': patch
---

The Journal Entry Batch and Company overview panels mount again. Their card tools and footers sat on `<div>` elements, but `mj-card`'s `mjCardTools` and `mjCardFooter` slots are TemplateRef directives that need an `<ng-template>`, so both panels failed with NG0201 and the batch record lost its member journal entries table.
