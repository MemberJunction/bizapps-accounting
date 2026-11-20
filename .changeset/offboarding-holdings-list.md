---
"@mj-biz-apps/accounting-actions": minor
---

New action "Accounting: List Offboarding Holdings" (`Accounting.ListOffboardingHoldings`) for the offboarding screen (bc-aidp-next-golive#297). Given a departing user's User ID or Employee ID, it lists every company profile whose CFO approver is that user. Each item is marked not reassignable, because only a company's own CFO approver may name a successor, and carries a note to set a new approver in Company Setup. The action sits in the "Offboarding Holdings" action category, which bizapps-common ships, so `mj sync push` of this metadata needs that common release first.
