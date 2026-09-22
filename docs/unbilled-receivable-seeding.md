# Seeding the Unbilled Receivable account, per company

One `GLAccountLink` per company, pointing at that company's own `11300`. **Until a company has that link, its contract asset does not appear on the balance sheet at all** — orders folds the amount into Deferred Revenue instead and logs a warning. Who creates the links is not decided here.

## What to create

| | |
|---|---|
| **Role** | `Unbilled Receivable` (ID `3EFC77F3-2468-463F-9197-D0A8A6762A36`, seeded by the row in `metadata/gl-account-roles`, which reaches a host through the release's `*__Metadata_Sync.sql`) |
| **Account** | `11300 Unbilled Revenue (Contract Asset)`, account type `Asset` — Jeremy's 9/18 chart of accounts |
| **Level** | Company. Not product, not category, not product type |
| **How many** | Exactly one per company. The role is `Cardinality: One`, so a second Active link for the same company is refused by the tie guard |

Each company needs its **own** 11300 account, not a shared one. Orders refuses an account belonging to another company outright (D6 — accounting derives a journal entry's company from the account, so a cross-company link would book revenue to the wrong legal entity with nothing downstream to catch it).

## Why the account exists

Revenue can be earned before it is billed — a contract we have performed against but not yet invoiced. That is a real asset and it needs a name on the balance sheet: a **contract asset**, distinct from a receivable, because no customer owes us anything until we bill them.

Orders maintains the position on the order line itself — `BilledToDate` and `RecognizedToDate` — and this account is where the gap lands whenever recognition runs ahead of billing. Two rules use it (orders D92): **recognising** revenue debits Deferred Revenue down to what has been billed and then debits this account for the rest, and **invoicing** an instalment credits this account first, down to zero, before opening any new Deferred. So the balance here is only ever service delivered that the contract does not yet let us bill.

## The name is a cross-repo contract

bizapps-orders writes this role's `Name` down in one place — `GL_ROLE.UnbilledReceivable = 'Unbilled Receivable'` in `packages/CoreEntitiesServer/src/GLAccountResolver.ts` — and resolves roles by accounting's exact `Name` string, case- and whitespace-insensitive but otherwise literal. Spaced Title Case matches every role orders resolves; `BankAccount` is the one unspaced role and it is FP&A's. **If the two repos ever disagree by one character the role simply never resolves**, and because every journal entry still balances either way, nothing downstream reports it. Rename it in one repo only and you will not find out from a failure.

## How the row reaches a database

`metadata/gl-account-roles/.gl-account-roles.json` is the **source of truth**, and it is the only thing this PR contributes. A release reaches hosts through one `*__Metadata_Sync.sql` migration that the build engineer generates from the JSON when cutting the release — PRs do not carry seed migrations of their own (`scripts/check-release-seed-coverage.mjs`: *"NOT a PR gate. PRs contribute JSON only; the build engineer generates one Metadata_Sync per release."*).

The row already exists on the shared MJ dev database under this UUID, because an earlier revision of this change carried a migration that was run there once before Amith corrected the approach. A later `mj sync push` matches it by `primaryKey.ID` and no-ops, so there is nothing to undo.

## What happens for a company with no link

**The contract asset disappears into Deferred Revenue.** Orders resolves this role every time either rule needs it; when no account is linked it puts the amount on Deferred Revenue instead and logs a warning naming the company and what was not separated. Nothing fails, every entry still balances, and no revenue is misstated — but the balance sheet then shows one number where there should be two, and a reader cannot tell revenue earned ahead of billing from billing taken ahead of performance.

That is the cost of leaving a company unlinked, and it is silent apart from the log line. Grep the MJAPI log for `no 'Unbilled Receivable' GL account is linked` after any run that recognises or invoices.

## Open question, not blocking

One contract-asset account or two? Strictly, an unconditional right to consideration is a receivable and a conditional one is a contract asset; a future instalment on a contract we must still perform against is conditional, so both cases are the same account. Finance may still want them presented separately. This is built for one, and splitting later is additive — a second role and a second link, with no change to what is already seeded (plan §14.1, Johanna).
