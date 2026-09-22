# Seeding the Unbilled Receivable account, per company

**Owner: Johanna.** One `GLAccountLink` per company, pointing at that company's own `11300`. **Not urgent** — read "Not yet, though" below before you start: under D91 nothing in orders resolves this role, so seeding it changes nothing until the period-end reclass ticket ships.

## What to create

| | |
|---|---|
| **Role** | `Unbilled Receivable` (ID `3EFC77F3-2468-463F-9197-D0A8A6762A36`, seeded by `migrations/V202609201200__v0.1.x__UnbilledReceivableRole.sql`) |
| **Account** | `11300 Unbilled Revenue (Contract Asset)`, account type `Asset` — Jeremy's 9/18 chart of accounts |
| **Level** | Company. Not product, not category, not product type |
| **How many** | Exactly one per company. The role is `Cardinality: One`, so a second Active link for the same company is refused by the tie guard |

Each company needs its **own** 11300 account, not a shared one. Orders refuses an account belonging to another company outright (D6 — accounting derives a journal entry's company from the account, so a cross-company link would book revenue to the wrong legal entity with nothing downstream to catch it).

## Why the account exists

Revenue can be earned before it is billed — a contract we have performed against but not yet invoiced. That is a real asset and it needs a name on the balance sheet: a **contract asset**, distinct from a receivable, because no customer owes us anything until we bill them.

Orders tracks the position but does not maintain a running balance in this account. A contract's Deferred Revenue nets billing against recognition, so when recognition runs ahead of billing that account carries a debit balance — and that debit balance IS the contract asset. This role gives a period-end process somewhere to present it.

## The name is a cross-repo contract

bizapps-orders writes this role's `Name` down in one place — `GL_ROLE.UnbilledReceivable = 'Unbilled Receivable'` in `packages/CoreEntitiesServer/src/GLAccountResolver.ts` — and resolves roles by accounting's exact `Name` string, case- and whitespace-insensitive but otherwise literal. Spaced Title Case matches every role orders resolves; `BankAccount` is the one unspaced role and it is FP&A's. **If the two repos ever disagree by one character the role simply never resolves**, and because every journal entry still balances either way, nothing downstream reports it. Rename it in one repo only and you will not find out from a failure. (Nothing in orders resolves it today — see below — but the rule binds the moment the reclass ships.)

## How the row reaches a database

`metadata/gl-account-roles/.gl-account-roles.json` is the **source of truth**, and it is the only thing this PR contributes. A release reaches hosts through one `*__Metadata_Sync.sql` migration that the build engineer generates from the JSON when cutting the release — PRs do not carry seed migrations of their own (`scripts/check-release-seed-coverage.mjs`: *"NOT a PR gate. PRs contribute JSON only; the build engineer generates one Metadata_Sync per release."*).

The row already exists on the shared MJ dev database under this UUID, because an earlier revision of this change carried a migration that was run there once before Amith corrected the approach. A later `mj sync push` matches it by `primaryKey.ID` and no-ops, so there is nothing to undo.

## Not yet, though — nothing in orders resolves this role (D91)

**Read this before you seed anything.** The model changed after this page was first written. Orders no longer books a contract asset at all: an order billed by instalment now puts no value on the balance sheet at confirm, and each instalment's invoicing posts `Dr Accounts Receivable / Cr Deferred Revenue`. Between billing and recognition a contract's Deferred Revenue runs to a **debit balance**, and that debit balance is the contract asset.

So this role is **inert by design**. It is seeded so that a period-end process can present that Deferred debit balance under its own name — a reclass entry, `Dr Unbilled Receivable / Cr Deferred Revenue`, auto-reversing — rather than having the booking code maintain a second running account all month. That reclass is a separate ticket and does not exist yet.

What that means for you: **the links below are not urgent and seeding them changes nothing today.** No order will post to an Unbilled Receivable account until the reclass ships. Seed them when the reclass ticket lands, or seed them now so the accounts are ready — either is fine, and neither affects the ledger in the meantime. The rest of this page is the reference for when you do.

## What happens until then

Nothing. Under D91 the ledger does not reach for this account, so an unseeded company is not a silent misstatement — it is simply a company whose period-end presentation is not wired up yet. (An earlier version of this page warned that an unseeded company would quietly reproduce the long-term-AR gross-up. That was true of the superseded D89 design, where booking split its debit between AR and this account and fell back to AR when no link existed. It is not true now: there is no fallback because there is no lookup.)

## Open question, not blocking

One contract-asset account or two? Strictly, an unconditional right to consideration is a receivable and a conditional one is a contract asset; a future instalment on a contract we must still perform against is conditional, so both cases are the same account. Finance may still want them presented separately. This is built for one, and splitting later is additive — a second role and a second link, with no change to what is already seeded (plan §14.1, Johanna).
