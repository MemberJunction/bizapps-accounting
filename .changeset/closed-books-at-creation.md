---
'@mj-biz-apps/accounting-engine-base': patch
'@mj-biz-apps/accounting-core-entities-server': patch
---

Enforce BooksClosedThroughDate at journal-entry CREATION: the engine pipeline now refuses a new entry whose effective date falls in a month finance has closed (new typed error EFFECTIVE_DATE_CLOSED_BOOKS), closing the asymmetry where redating into a closed month was refused but creating there was not. Also hardens person-user-link's quoteList to enforce (not just document) its UUID-only invariant.
