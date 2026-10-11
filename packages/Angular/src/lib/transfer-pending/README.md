# transfer-pending/ — parked framework-clean components

> **Parking discipline (non-negotiable).**

Everything in this folder is **owed to another home** (`bizapps-common` or MJ base).
It is parked here only for iteration speed during the UI wave (no extra dev-linked apps / feature
branches mid-wave).

## The rule that makes extraction cheap

**Nothing in this folder may import an accounting entity, an accounting engine type, or anything from
`../custom/`.** Only Angular, MJ core/base packages, and other files in this folder.

That constraint is what keeps extraction a **file move + import rename** rather than a refactor. If
you find yourself wanting an accounting type in here, the component doesn't belong here — either it's
accounting-domain (put it in `../custom/shared/`) or the type needs to be an `@Input()`/generic.

There is a test that enforces this: `src/__tests__/transfer-pending-purity.test.ts`. It fails the
build if any file here imports an accounting package. Don't weaken it — it IS the discipline.

## What's parked here

| Folder | What it holds | Target home |
|---|---|---|
| `workspace-tabs/` | `mj-workspace-card`, the workspace tab strip and its pure state store, the `mjTip` tooltip directive | bizapps-common |
| `list-scaffold/` | pure list helpers: grid row-key parsing, `ExtraFilter` escaping, time-window defaults | bizapps-common → MJ base |
| `dialog-dismiss/` | backdrop-click and Escape dismissal for editor dialogs, with a discard prompt when there are unsaved edits | bizapps-common → MJ base |
| `cross-app-link/` | opens another app's nav item as an Explorer tab through `NavigationService` | MJ base |
| `shell-refresh/` | sends the shell header's Refresh to the page currently mounted | MJ base |

The `plans/TRANSFER-BACKLOG.md` that several file headers name is not on `next`.

## Check MJ first — the cheapest parked component is the one you don't build

There was a `nav-rail/` here. It is gone: MJ already ships `<mj-left-nav>`
(`@memberjunction/ng-ui-components`) with sections, badges, active state, `[header]`/`[footer]`
slots and a responsive drawer. We deleted ours and adopted MJ's (the MJ-wins rule), so there was
nothing to park and nothing to hand over later.

Before parking anything new here, **search MJ's `ng-ui-components` / `ng-shared*` packages for the
idiom first.** A parked component is a debt owed to a future transfer; an MJ component is free.

## DESIGN RULE — size workspace content by CONTAINER, not viewport (2026-07-21)

Inside a workspace, **use CONTAINER units for sizing, never viewport units.** The workspace card
(`mj-workspace-card`) is declared a query container (`container-type: size`), so content sizes with
**`cqh` / `cqw` / `cqi`** — relative to the card, which is a **window/pane** in the inward (dock/split)
system. A `vh`/`vw` value would size to the whole screen regardless of the pane the card sits in, so
it breaks the moment the card is in a split or a smaller window.

- ✅ `height: 55cqh;` (55% of the workspace card) · `max-height: 88cqh;`
- ❌ `height: min(45vh, 560px);` (viewport-relative — wrong in a pane)
- Fixed **px** floors/ceilings are fine as bounds (`min-height: 160px`); the *proportional* size is `cq*`.
- Reference: the JE workspace line grid (`je-workspace.page.css` `.jew__gridwrap`) — `cqh` default +
  a full-width drag bar (`.jew__resize`) the user pulls to resize it.

Applies going forward to every workspace surface (JE + batch workspaces, order editor, future ones).
