# UI Architecture — bind to the primitives, not to a service layer

> **The rule:** no data-access service layer. Angular components talk to `BaseEntity` subclasses and
> Remote Operation classes directly. Services are for Angular-shaped, non-persistent state only.

## Why this is different from ordinary Angular advice

The classical Angular service layer exists to solve four problems. In a MemberJunction app, three of
them are already solved by stronger primitives, and wrapping those primitives makes each one *worse*.

**Data access.** `BaseEntity` already is the data access layer, and it is network-transparent: the
same object runs against GraphQL in the browser and SQL on the server, because the provider is
injected rather than assumed. A service that wraps it is a second, weaker abstraction over an
existing one.

**Typing.** This is where the real damage is. Generated entity classes are typed from the schema —
the compiler knows `JournalEntryLine.DebitAmount` is `DECIMAL(18,2)` and that `JournalEntry.Status`
is `Pending | Batched | GLPosted`. A service that accepts and returns DTOs re-types the same data by
hand, and every field is a place the two can drift. In practice the boundary degrades to `any` and
the strong typing the platform generated for free is thrown away one method signature at a time.

**Orchestration.** That is what Remote Operations *are*: typed, registered, network-capable units of
server work, with a generated base class per operation. `Accounting.RecordJournalEntryBatchDecision`
already has an `.Execute()` with a typed input and output. A service method wrapping it adds a call
with a weaker contract and one more place for the shapes to disagree.

**Shared state.** The one job that genuinely remains — and for cached, metadata-shaped data
(currencies, GL account roles, journal entry types) `AccountingEngineBase` already covers it.

## What changed in MJ 6.1

Before related-record collections, a journal entry and its lines could not be modelled in the
browser at all: the collection existed only as a hand-rolled array on `JournalEntryEntityServer`
(`_lines`, `_deletedLines`, `AddLine`, `RemoveLine`, `CreateLine`, `LoadLines`), in a server-only
package. So the JE editor reached through a service layer to compose something it had no type for,
and learned an entry was unbalanced only after a round trip.

`DeclareRelatedRecords` removes the reason. `entry.Lines.Create()` works in the browser, the
double-entry invariants run there via `JournalEntryEntity.Validate()`, and `entry.Save()` ships the
whole graph in one call.

## The patterns

**Read one entry and its lines**

```typescript
const md = new Metadata();
const entry = await md.GetEntityObject<JournalEntryEntity>('MJ_BizApps_Accounting: Journal Entries');
await entry.Load(entryId);
await entry.Lines.Load();
```

**Read a list — never loop children (that is the N+1)**

```typescript
const rv = new RunView();
const result = await rv.RunView<JournalEntryEntity>({
    EntityName: 'MJ_BizApps_Accounting: Journal Entries',
    ExtraFilter: `Status = 'Pending'`,
    ResultType: 'entity_object',
    IncludeRelatedRecords: ['Lines'],   // 1 + K queries for ALL entries' lines
});
```

**Compose and save — one call, one transaction**

```typescript
const debit = await entry.Lines.Create();   // stamps JournalEntryID and LineNumber for you
debit.GLAccountID = arAccountId;
debit.DebitAmount = 302.59;

const credit = await entry.Lines.Create();
credit.GLAccountID = salesAccountId;
credit.CreditAmount = 302.59;

if (!(await entry.Save())) {
    this.error = entry.LatestResult?.CompleteMessage;
}
```

**Validate before the round trip — including the balance**

```typescript
const result = entry.Validate();   // at least two lines, and debits === credits
if (!result.Success) {
    this.errors = result.Errors;
    return;                        // no network call at all
}
```

That works because the invariants live on the shared subclass (`JournalEntryEntity` in
`@mj-biz-apps/accounting-entities`), not on the server subclass. Anything decidable from the entry
and its lines belongs there; anything needing the database — entry numbering, fiscal-year
derivation, the reversal-type discriminator, GL account existence and company scoping — stays in
`JournalEntryEntityServer`.

**Server-side work — call the operation**

```typescript
const op = new AccountingRecordJournalEntryBatchDecisionOperation();
const result = await op.Execute({ JournalEntryBatchID: id, Decision: 'Approved' });
```

**Cached lookups — ask the engine**

```typescript
await AccountingEngineBase.Instance.Config();
const currency = AccountingEngineBase.Instance.Currencies.find(c => c.ISOCode === 'USD');
```

## What a service IS still for

Angular-shaped, non-persistent state. A helper class, injected for lifetime and DI, holding nothing
that belongs in a table:

- wizard step, selection, expand/collapse, filter-panel state
- router coordination and navigation intent
- cross-component UI coordination that has no entity behind it

If a method on it loads, saves, validates or maps entity data, it is in the wrong place.

## The test to apply in review

> Could a non-Angular host — a script, a server job, another app — do this same work with the same
> objects?

If yes, it belongs on the entity, the shared subclass, or a Remote Operation. If the answer is "no,
because the logic is trapped in a service", the logic is in the wrong layer, and the giveaway is
usually a DTO that mirrors an entity.

## See also

- `packages/Entities/src/JournalEntryEntity.ts` — the shared subclass and what belongs on it
- `metadata/entity-relationships/` — how `Lines` is declared (metadata, not TypeScript)
- MJ: `packages/MJCore/docs/related-record-collections.md`
