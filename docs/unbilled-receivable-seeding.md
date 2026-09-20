# Seeding the Unbilled Receivable account, per company

**Owner: Johanna.** One `GLAccountLink` per company. Until it exists, the ledger keeps doing what it does today — see "What happens until then" at the bottom, because that part is the reason this page exists.

## What to create

| | |
|---|---|
| **Role** | `Unbilled Receivable` (ID `3EFC77F3-2468-463F-9197-D0A8A6762A36`, seeded by `migrations/V202609201200__v0.1.x__UnbilledReceivableRole.sql`) |
| **Account** | `11300 Unbilled Revenue (Contract Asset)`, account type `Asset` — Jeremy's 9/18 chart of accounts |
| **Level** | Company. Not product, not category, not product type |
| **How many** | Exactly one per company. The role is `Cardinality: One`, so a second Active link for the same company is refused by the tie guard |

Each company needs its **own** 11300 account, not a shared one. Orders refuses an account belonging to another company outright (D6 — accounting derives a journal entry's company from the account, so a cross-company link would book revenue to the wrong legal entity with nothing downstream to catch it).

## Why the account is needed

An order confirm books the whole contract value to Accounts Receivable today, whatever the billing schedule says, so a three-year contract billed annually lands all three years in AR on day one. With this account in place the booking entry splits the debit — Unbilled for the instalments that are not yet due, AR for the rest — and each instalment's invoicing moves its amount `Dr AR / Cr Unbilled`. AR then means "billed and unpaid" specifically, Unbilled means "contracted, not yet billable", and the monthly long-term AR reclass done by hand today has nothing left to do.

## What happens until then

Nothing breaks, and that is exactly the hazard. A company with no Unbilled link books the full line to AR just as it does today, the journal entry balances, the order reconciles, and **the only visible sign is a warning in the server log** naming the company and the order line. A converted Active Contract with instalments out to 2029 will sit in AR in full, which is the gross-up this whole change exists to remove.

So: a company is not finished being set up until it has this link, and an unseeded company is a silent reversion rather than a failure. The warning text is `no 'Unbilled Receivable' GL account is linked for company <id>` — grep the MJAPI log for it after a conversion run.

## Open question, not blocking

One contract-asset account or two? Strictly, an unconditional right to consideration is a receivable and a conditional one is a contract asset; a future instalment on a contract we still have to perform against is conditional, so both cases are the same account. Finance may still want them presented separately. This is built for one, and splitting later is additive — a second role and a second link, with no change to what is already seeded (plan §14.1, Johanna).
