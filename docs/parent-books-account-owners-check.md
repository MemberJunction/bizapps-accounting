# Check: Division, Department and Branch profiles that own active GL accounts

A one-off, read-only check for databases that ran a release before the application refused this state on every profile save.

## Why it exists

A Division, Department or Branch keeps no books of its own. Its entries use the accounts of its legal entity: the first company above it, following `ParentAccountingCompanyID`, whose type is anything else. An active GL account owned by such a company is never resolved for new entries, and an entry that does land on it is booked under a company that may have no ERP connection.

The application refuses this state when it is created:

- a GL account saved active, or reactivated, on such a company, and
- a profile saved as one of those types while its company owns active accounts.

Until the second check covered new profiles, a profile could be created as a Division, Department or Branch for a company that already owned active accounts. Profiles saved before either check existed are in the same position. The application does not re-check those rows when they are saved again, so this script finds them.

## Running it

`scripts/check-parent-books-account-owners.sql` contains SELECTs only. Run it against each installation's database with an account that can read `__mj_BizAppsAccounting` and `__mj`:

```bash
sqlcmd -S <host>,<port> -d <database> -U <user> -P '<password>' -C -b -W -s "|" \
  -i scripts/check-parent-books-account-owners.sql
```

It is T-SQL (SQL Server 2017 or later, for `STRING_AGG`).

## Reading the output

No rows means there is nothing to do on that installation.

Each row is one profile:

| Column | Meaning |
|---|---|
| `CompanyID`, `Company`, `CompanyCode` | The profile |
| `EntityType` | Division, Department or Branch |
| `ParentAccountingCompanyID`, `ParentCompany` | The company above it; its legal entity is this one or the first one further up that keeps books |
| `ActiveAccounts`, `ActiveAccountCodes` | Active GL accounts the company owns |
| `PendingEntryLines` | Lines on those accounts in entries not yet batched |
| `UnpostedEntryLines` | Lines on those accounts in entries batched but not yet posted to the GL |
| `ActiveAccountLinks` | Active GL account links (role assignments) that point at those accounts |

## What to do with a row

First decide, with finance, whether the company keeps its own books.

**It does not keep its own books (the type is right).** Deactivate its accounts.

1. If `PendingEntryLines` or `UnpostedEntryLines` is above zero, those entries were built against this company's accounts and will still batch under it. Have finance decide what happens to them (reverse and rebook against the legal entity's accounts, or let the batch go out) before going further. Deactivating an account does not change entries that already reference it.
2. If `ActiveAccountLinks` is above zero, disable those links, and make sure the legal entity has a link for each role they covered.
3. Set `IsActive` off on each account in `ActiveAccountCodes` (GL Accounts form, or a `GLAccount` save through the API). Inactive accounts keep their history; they take no new lines.

**It does keep its own books (the type is wrong).** Change the profile's `EntityType` to the type that matches (for example `Subsidiary` or `LegalEntity`). Its accounts then become the ones its entries use. Check its children first: any Division, Department or Branch below it now resolves this company as its legal entity instead of the one further up.

Re-run the script afterwards; the row should be gone.

## When to retire it

Once every installation that ran a release before the profile check has returned no rows, this script has done its job and can be deleted.
