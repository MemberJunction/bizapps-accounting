---
"@mj-biz-apps/accounting-core-entities-server": patch
"@mj-biz-apps/accounting-ng": patch
---

New companies start with an EMPTY chart of accounts: the W1 auto-seed on AccountingCompanyProfile
first-save is retired (auto-seeding collided with the immediate GL-account identity lock, forcing
ten locked-identity accounts on every company). The starter chart remains available as the explicit,
idempotent, audited `AccountingCompanyProfileEntityServer.SeedDefaultChartOfAccounts()`. UI line:
All-journal-entries gains a "New journal entry" verb routed to the JE workspace; batch drill-downs
no longer double-count by including the batch's own summary JE; company/account pickers dedupe by
normalized UUID and self-heal stale caches (reactive scope roster, one-shot workspace re-check);
GL editor shows human save errors instead of raw SQL; COA editor currency is a searchable
code-or-name combobox; nav-rail hover-peek is off by default, the collapse toggle highlights only
its own chip, and count badges no longer shift layout (row-edge pill expanded / icon-corner
count collapsed).
