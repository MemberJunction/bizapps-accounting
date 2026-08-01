# UI Layering in BizApps Accounting

How UI is structured in this repo, why, and what is left to convert.

> **The standard itself lives in the MJ repo:
> [`guides/UI_LAYERING_GUIDE.md`](https://github.com/MemberJunction/MJ/blob/next/guides/UI_LAYERING_GUIDE.md)**
> (introduced in [MemberJunction/MJ#3403](https://github.com/MemberJunction/MJ/pull/3403)). Read
> that first — it is the rule for every MemberJunction repo. This document is the accounting-
> specific companion: how the rule maps onto our packages, what the Journal Entry slice looks like
> now that it has been converted, and the checklist for the rest.

---

## 1. The four layers, in this repo

| Layer | Package | What lives there |
|---|---|---|
| **L0** domain runtime | `@mj-biz-apps/accounting-entities`, `@mj-biz-apps/accounting-engine-base` | Pure TS. Money math, the JE rules, the draft pipeline, remote-op clients, metadata caches. No Angular. |
| **L1** presentational widget | `@mj-biz-apps/accounting-ng-widgets` | Props in, events out. Zero data access. `<mjacc-je-line-table>`, `<mjacc-je-status-timeline>`, `<mjacc-je-reversal-panel>`. |
| **L2** composite widget | `@mj-biz-apps/accounting-ng-widgets` | Assembles L1, may read data **through `ProviderToUse`**, emits intent. `<mjacc-journal-entry-detail>`. |
| **L3** Explorer surface | `@mj-biz-apps/accounting-ng` | Entity forms + resource/dashboard components. Owns `NavigationService` / `MJFormPresenterService`. No domain logic. |

Two hard boundaries:

1. **Nothing at L0–L2 may import `@angular/router`, `@memberjunction/ng-shared`, or any
   `@memberjunction/ng-explorer-*` package.**
2. **Nothing at L3 may contain domain logic or markup a widget should own.**

Both are checked, not merely written down:

```bash
npm run check:ui-layers                      # repo-wide, opt-in via "mjUILayer" in package.json
cd packages/AngularWidgets && npm test       # the same boundary, inside the package's own tests
```

---

## 2. Why we did this — the actual evidence from this repo

This was not a theoretical clean-up. Before the change, **two components rendered a journal entry
independently**: `JournalEntryFormComponentExtended` (the Explorer entity form) and
`JournalEntryDetailPanelComponent` (the journal-entries slide-in). They were written months apart,
each by someone solving the screen in front of them. Neither was careless work. They still
diverged, in four ways, and every one of them was invisible from inside either file:

| | Explorer form | Slide-in panel |
|---|---|---|
| **Reversal rule** | `Status === 'GLPosted' && !ReversedByJournalEntryID` | `canReverse()` from `je-rules` |
| **Line loading** | 2 sequential reads, dimensions only | batched `RunViews`, dimensions + account code/name |
| **Totals row** | `colspan="4"` in a 6-column table | correct |
| **Lineage** | none | batch number + reversal chain |

Read the consequences carefully, because they are the argument:

- **The reversal rule was wrong in both directions.** `je-rules.canReverse()` is deliberately
  status-independent and blocks a reversal-of-a-reversal. The form's hand-rolled version instead
  refused reversals the server *permits* (a `Batched` entry — you cannot delete posted history,
  you offset it) and offered reversals the server *rejects* (reversing a `Reversal`, which is how
  you get an infinite Dr/Cr chain). A correct, unit-tested rule already existed in this repo, a
  few directories away, and was in use by the other surface.
- **The totals were one column to the right.** `colspan="4"` across `#`, `Account`,
  `Description`, `Debit` pushed the debit total under the **Credit** heading and the credit total
  under **Dimensions**. Plausible numbers, wrong column, on a ledger screen.
- **A third bug fell out during the merge.** The slide-in read `OrderID` off the header to offer
  "Open source order". That column was replaced by the polymorphic `LinkedEntityID` /
  `LinkedRecordID` pair. Because the row was read as an untyped `ResultType: 'simple'` result and
  cast to an interface, nothing complained — the property was `undefined`, the guard was always
  false, and the button silently stopped rendering. It surfaced the moment the projection had to
  be written against the generated entity in a typed view model.

None of these is a "bad code" story. They are the ordinary, predictable cost of the same concept
existing in two places. **Layering is not about tidiness; it is about there being one place for a
rule to be wrong, so that fixing it once fixes it everywhere.**

---

## 3. The Journal Entry slice, as converted

```
L0  @mj-biz-apps/accounting-engine-base
      je-rules.ts             canReverse · reversalBlockedReason · isBalanced · statusVariant
      je-draft.ts             money parsing · line validation · draft → contract mapping
      journal-entry.client.ts the GenerateReversal remote op
        ↑ all three MOVED here from the Angular package — they were always pure TS,
          they were just living in a package that forced an Angular dependency on them

L1  @mj-biz-apps/accounting-ng-widgets
      <mjacc-je-status-timeline>   one input, no outputs, no services
      <mjacc-je-line-table>        lines in, RecordOpenRequested out
      <mjacc-je-reversal-panel>    renders the verb; does NOT decide if it is legal

L2  @mj-biz-apps/accounting-ng-widgets
      <mjacc-journal-entry-detail> loads via ProviderToUse, composes the three above,
                                   emits Before/After + RecordOpenRequested. Never navigates.

L3  @mj-biz-apps/accounting-ng
      JournalEntryFormComponentExtended   193 → 118 lines, no markup of its own
      JournalEntryDetailPanelComponent    ~380 → 135 lines, chrome + pop-out only
```

Net: **−914 lines** across the two hosts, one implementation instead of two, three bugs gone, and
22 new unit tests that were previously impossible to write.

### What L3 kept, and why each thing is genuinely L3's

The form is not thin because we hid things in the widget. It is thin because there turned out to
be only three things it actually owned:

```typescript
// 1. Project the record the form ALREADY has into the widget's view model.
//    A projection, not a cast — which is precisely what caught the dead OrderID.
public get HeaderView(): JEHeaderView | null { … }

// 2. Veto the reversal on a state only THIS surface knows about.
//    Synchronous by contract: emit() runs listeners inline, so an async handler
//    would return at its first await and the flag would be set too late.
public OnBeforeReversal(event: BeforeReversalRequestedEventArgs): void {
  if (this.record?.Dirty) {
    event.Cancel = true;
    event.CancelReason = 'Save or cancel your changes to this entry before reversing it.';
  }
}

// 3. Turn intent into presentation. The widget named a record; L3 decides it opens as a
//    slide-in, via MJ's form presenter — never via Router, which would desync the shell.
public OnRecordOpenRequested(event: RecordOpenRequestedEventArgs): void { … }
```

The slide-in receives the *same* events and answers them differently — it also closes itself,
because a panel that stays open hides the record it just opened. **That difference is the entire
justification for events over direct calls.** Two hosts, two correct-but-different behaviours, one
widget.

---

## 4. The event contract

Full rules in the MJ guide §6. The three that get broken most often:

**1. `After*` must not fire on the canceled path.** Hosts rely on it. In the composite:

```typescript
this.BeforeReversalRequested.emit(before);
if (before.Cancel) {
  this.setMessage(before.CancelReason ?? 'Reversal canceled.', true);
  return;                       // ← After* deliberately NOT emitted
}
```

**2. `Before*` handlers must be synchronous.** `EventEmitter.emit()` runs synchronous listeners
inline, which is the only reason the widget can read `Cancel` after emitting. An `async` handler
returns at its first `await` — before it sets the flag — so the veto silently does nothing. If a
host truly needs to await (a confirm dialog), cancel unconditionally and call the widget's
imperative method after the await resolves.

**3. Don't invent a veto for something that cannot be vetoed.** `AfterHeaderLoaded` and
`AfterLoadCompleted` have no `Before` pair, because you cannot cancel a load that already happened.

---

## 5. Converting the next screen

Order matters. Each step is independently shippable and independently reviewable.

1. **Find the duplicate first.** The strongest case for layering is two components rendering the
   same concept. Extract that one first — it pays for itself immediately and makes the argument
   for the rest. (In this repo it was the JE detail; look next at the batch detail.)
2. **Push math down to L0.** Anything that would still be correct with no DOM: totals, validation,
   state transitions, remote-op clients. Move it to `packages/EngineBase`, export it from
   `index.ts`, and bring its tests with it.
3. **Carve markup into L1 widgets.** One widget per visual concept. Inputs are plain view models,
   not `BaseEntity` subclasses — that is what makes them testable with an object literal.
4. **Assemble an L2 composite.** It owns loading via `ProviderToUse` and the arrangement. It emits
   `Before*`/`After*` and `*Requested`. It never navigates.
5. **Reduce the original to L3.** If it does not end up as a template plus a handful of short
   handlers, something in 2–4 is unfinished.
6. **Move L1+L2 into `packages/AngularWidgets`** and let the gate hold the gain.

**Do not do this as one sweep.** One screen at a time, each fully converted with tests.

---

## 6. What is left

Ordered by payoff. Each row is a full L0→L3 conversion, not a cosmetic move.

| Screen | Files | Why it is on the list |
|---|---|---|
| **Batch detail** | `batch-status-dashboard.component.ts` (489), `dispatch-status.page.ts` (454), `batches-dashboard.page.ts` (287), `batch-dispatch-dashboard.component.ts` (279) | The next duplicate: **four** components render batch state, each with its own status/target value handling and its own reads. Start here. |
| **JE line editor** | `je-workspace.page.ts` (474) | The editable twin of the table we just extracted. An `<mjacc-je-line-editor>` next to `<mjacc-je-line-table>` gives one place for the money rules to be right — `je-draft.ts` is already at L0 and waiting. |
| **JE list + review** | `all-journal-entries.page.ts` (389), `je-dashboard.page.ts` (302), `je-approvals.page.ts` (194) | Three list surfaces over the same entity with three filter implementations. |
| **GL Account form** | `gl-account-form.component.ts` (179) | Same shape as the JE form was: 5 `RunView` calls and its own markup inside an entity form. The smallest complete example to convert second. |
| **Chart of accounts** | `coa-dashboard.component.ts` (417) | Tree rendering that other screens will want. |
| **Company setup** | `company-setup-dashboard.component.ts` (275) | Lowest priority — genuinely one surface, so the duplication argument does not apply yet. |

`transfer-pending/` is a **separate** concern and stays as it is. Those components are owed to
`bizapps-common` / `bizapps-tasks` / MJ base; the parking discipline test guards a different
boundary (app-specific imports) than the layer gate (routing + Explorer). Both are correct and
both should stay.

---

## 7. Rules of thumb

- **Check MJ first.** The cheapest widget is the one you do not write. Search
  `@memberjunction/ng-ui-components` and MJ's `packages/Angular/Generic/**` before adding anything
  here. That is how the `nav-rail/` component was retired in favour of `<mj-left-nav>`.
- **A widget that needs `NavigationService` is not a widget.** It is an L3 surface, or it needs an
  event.
- **`new RunView()` in a widget is a bug**, not a style issue — it ignores the `Provider` the
  component was handed. Use `RunView.FromMetadataProvider(this.ProviderToUse)`. The gate catches it.
- **Duplicated markup is a duplicated bug waiting for a schedule.** When you catch yourself
  copying a template, that is the moment to extract, not later.
