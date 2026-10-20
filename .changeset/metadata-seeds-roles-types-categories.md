---
'@mj-biz-apps/accounting-entities': minor
'@mj-biz-apps/accounting-core-entities-server': minor
---

Metadata seeds and one filter guard:

- A `Gift Card Liability` GL account role (sequence 120), the name orders resolves when it books a gift card sale or redemption. Until a company links an account to it, orders books the card to Deferred Revenue and warns (#250).
- A `SUBSCRIPTION_TERM_LENGTH` finance exception type owned by orders, so a subscription line sold for a length other than its type's term is raised for finance review (#454).
- The Deferred Revenue role's description now says only what the role means (#441).
- The two Accounting actions look up their category by the ID this app seeds, not by the name `Accounting`, which MJ core also uses for a category (#406).
- Seeding the default chart of accounts validates the company ID as a UUID before putting it in a filter (#384).

All metadata changes reach a host with the next Metadata_Sync (`mj sync push`).
