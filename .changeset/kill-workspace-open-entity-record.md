---
"@mj-biz-apps/accounting-ng": patch
---

Open journal entries and batches as Explorer records instead of an in-shell workspace tab. New journal entry uses OpenNewEntityRecord; Build JE batch is the create verb for batches. Lists and the review queue emit RecordOpened and the category calls NavigationService.
