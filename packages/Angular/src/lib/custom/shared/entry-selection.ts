/**
 * The operator's ticked entries in a batch preview (golive #284): either every candidate, or an
 * explicit include set.
 *
 * `null` means every candidate, whatever the criteria return next. An array is the explicit set:
 * exactly those ids, and a candidate that enters the pool later (a widened filter) starts
 * unticked. The value goes to the preview request as it is, so the totals the server computes and
 * the ticks on screen describe the same selection. The previous model kept an exclude list and
 * derived the include set from the LAST preview's candidates, so a filter change sent a selection
 * computed from the old pool while the screen counted the new one.
 */
export type EntrySelection = readonly string[] | null;

/** Every candidate. */
export const ALL_ENTRIES: EntrySelection = null;

/** Nothing ticked; entries that enter the pool later stay unticked. */
export const NO_ENTRIES: EntrySelection = [];

export function IsEntryIncluded(selection: EntrySelection, id: string): boolean {
  return selection === null || selection.includes(id);
}

/**
 * Tick or untick one entry. Unticking from "every candidate" turns the selection into the explicit
 * set of the candidates on screen, less that one.
 */
export function ToggleEntrySelection(selection: EntrySelection, id: string, candidateIds: readonly string[]): EntrySelection {
  if (selection === null) return candidateIds.filter((c) => c !== id);
  return selection.includes(id) ? selection.filter((c) => c !== id) : [...selection, id];
}

/** The candidates the selection ticks, in candidate order: what the preview totals and the build sends. */
export function IncludedCandidateIds(selection: EntrySelection, candidateIds: readonly string[]): string[] {
  if (selection === null) return [...candidateIds];
  const set = new Set(selection);
  return candidateIds.filter((c) => set.has(c));
}

/** The preview request's `IncludedJournalEntryIDs`: the selection as it is, never derived from a previous response. */
export function SelectionRequestIds(selection: EntrySelection): string[] | null {
  return selection === null ? null : [...selection];
}
