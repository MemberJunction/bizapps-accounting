/**
 * @fileoverview Before/After cancelable event args for the journal-entry widgets.
 *
 * Follows MJ's established Before/After pattern — see
 * `packages/Angular/Generic/base-forms/src/lib/types/form-events.ts` and
 * `packages/Angular/Generic/conversations/src/lib/events/chat-events.ts` in the MJ repo,
 * and `guides/UI_LAYERING_GUIDE.md` §6 for the full contract.
 *
 * **The contract, in three sentences.** An action a host might want to veto ships as a
 * `Before*` / `After*` pair. The `Before*` args extend {@link CancellableJournalEntryEventArgs}
 * and carry a mutable `Cancel` flag the listener flips. The widget checks
 * `if (args.Cancel) return;` and does **not** emit the `After*` on the canceled path —
 * hosts rely on that, so it is a contract rather than a convention.
 *
 * Informational events (a load finished, a record should open) have no `Before` pair.
 * Don't invent a veto for something that cannot be vetoed.
 *
 * ⚠ `Before*` handlers must be SYNCHRONOUS. `EventEmitter.emit()` runs synchronous
 * listeners inline, which is the only reason the widget can read `Cancel` after emitting.
 * An `async` handler returns at its first `await` — before it sets the flag — so the veto
 * silently does nothing. A host that genuinely needs to await (a confirm dialog) should let
 * the `Before*` cancel unconditionally and then call the widget's imperative method once its
 * own await resolves.
 *
 * @module @mj-biz-apps/accounting-ng-widgets
 */

/**
 * Base for cancelable journal-entry events. Flip `Cancel = true` to halt the default
 * behavior; the matching `After*` event will NOT fire. `CancelReason` is free-form and is
 * surfaced to the operator, so write it as something a person can act on.
 */
export class CancellableJournalEntryEventArgs {
  public Cancel: boolean = false;
  public CancelReason?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Reversal
// ────────────────────────────────────────────────────────────────────────────

/**
 * Fired BEFORE a reversal request leaves the widget. Cancel to block it — e.g. a host that
 * knows the target accounting period is closed, or one that wants a confirmation step.
 */
export class BeforeReversalRequestedEventArgs extends CancellableJournalEntryEventArgs {
  constructor(
    public readonly JournalEntryID: string,
    public readonly EntryNumber: string,
    /** The operator-supplied reason, already trimmed. Never empty — the widget defaults it. */
    public readonly Reason: string,
  ) {
    super();
  }
}

/**
 * Fired AFTER a reversal request completes, whether it succeeded or failed — the host needs
 * to know either way (refresh a list on success, log on failure). NOT fired when the
 * corresponding {@link BeforeReversalRequestedEventArgs} was canceled.
 */
export class AfterReversalRequestedEventArgs {
  constructor(
    public readonly JournalEntryID: string,
    public readonly Success: boolean,
    public readonly ReversalEntryNumber: string | null = null,
    public readonly ErrorMessage: string | null = null,
  ) {}
}

// ────────────────────────────────────────────────────────────────────────────
// Navigation intent (informational — the widget never navigates)
// ────────────────────────────────────────────────────────────────────────────

/**
 * The operator asked to open a related record. The widget states *what* was asked for and
 * stops there; the host decides whether that means an Explorer tab, a dialog, a slide-in, or
 * (in a test) an entry in an array.
 *
 * This is the entire reason these widgets can live in a package that has never heard of
 * `NavigationService`.
 */
export class RecordOpenRequestedEventArgs {
  constructor(
    /** Fully-qualified MJ entity name, e.g. `MJ_BizApps_Accounting: GL Accounts`. */
    public readonly EntityName: string,
    public readonly RecordID: string,
    /** A human label for the target, so a host can title a dialog without a second read. */
    public readonly Title: string,
    /** What the host should aim for. Advisory — the host owns presentation. */
    public readonly Preference: 'tab' | 'dialog' | 'slide-in' = 'dialog',
  ) {}
}

// ────────────────────────────────────────────────────────────────────────────
// Load lifecycle (informational)
// ────────────────────────────────────────────────────────────────────────────

/**
 * The composite finished a load attempt. Hosts use this to clear a shell spinner — in MJ
 * Explorer, to call `NotifyLoadComplete()` — without reaching into the widget's state.
 */
export class AfterLoadCompletedEventArgs {
  constructor(
    public readonly JournalEntryID: string | null,
    public readonly Success: boolean,
    public readonly ErrorMessage: string | null = null,
  ) {}
}
