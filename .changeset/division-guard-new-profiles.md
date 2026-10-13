---
"@mj-biz-apps/accounting-core-entities-server": patch
---

A new Accounting Company Profile saved as a Division, Department or Branch is refused when its company already owns an active GL account (#304). GL accounts reference `__mj.Company`, so a company can own accounts before its profile exists; the owner check ran only when a saved profile's EntityType changed. It now runs on create as well. Deactivate the company's accounts first, or create the profile as a type that keeps books.

Profiles saved before this release are not re-checked unless their EntityType is edited, and releases before v0.21.0 had no owner check at all (#328). After upgrading, find any Division, Department or Branch profile that still owns active GL accounts:

```sql
SELECT p.ID, p.EntityType, COUNT(*) AS ActiveAccounts
FROM __mj_BizAppsAccounting.AccountingCompanyProfile p
JOIN __mj_BizAppsAccounting.GLAccount a ON a.CompanyID = p.ID AND a.IsActive = 1
WHERE p.EntityType IN ('Division', 'Department', 'Branch')
GROUP BY p.ID, p.EntityType;
```

For each row, deactivate the profile's GL accounts; its entries already post to its legal entity's accounts. Change the profile to a type that keeps books only if the company should keep its own books.
