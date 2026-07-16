# transfer-pending/ — parked framework-clean components

> **Parking discipline (non-negotiable — UI action plan §0, `plans/TRANSFER-BACKLOG.md`).**

Everything in this folder is **owed to another home** (`bizapps-common`, `bizapps-tasks`, or MJ base).
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

| Folder | Target home | Tracked in |
|---|---|---|
| `workspace-tabs/` | bizapps-common | TRANSFER-BACKLOG |
| `list-scaffold/` | bizapps-common → MJ base | TRANSFER-BACKLOG |
| `approval-inbox/` | bizapps-tasks | TRANSFER-BACKLOG |

## Check MJ first — the cheapest parked component is the one you don't build

There was a `nav-rail/` here. It is gone: MJ already ships `<mj-left-nav>`
(`@memberjunction/ng-ui-components`) with sections, badges, active state, `[header]`/`[footer]`
slots and a responsive drawer. We deleted ours and adopted MJ's (UI plan §8 MJ-wins rule), which
retired a TRANSFER-BACKLOG row outright — nothing to park, nothing to hand over later.

Before parking anything new here, **search MJ's `ng-ui-components` / `ng-shared*` packages for the
idiom first.** A parked component is a debt owed to a future transfer; an MJ component is free.

See `plans/TRANSFER-BACKLOG.md` for each row's target + trigger, and
`design-docs/ui-design/README.md` for the component inventory / MJ-base candidacy.
