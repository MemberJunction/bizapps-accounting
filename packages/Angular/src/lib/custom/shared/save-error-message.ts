/**
 * Turning a failed save into text a user can act on (#383).
 *
 * A failed `Save()` reports through `LatestResult.CompleteMessage`, which for a database failure
 * carries the constraint name, column names and, after "Query:", the SQL that ran. None of that is
 * UI copy. A known constraint becomes a sentence; any other database text becomes the caller's
 * fallback; a plain sentence (an entity validation message or a server-side rule's own wording) is
 * shown as written, first line only.
 *
 * Nothing is logged here: MJ's data provider already logs the full failure, SQL included, when a
 * save or request fails, and a second copy would only double the console noise.
 */

interface KnownSaveError {
  Pattern: RegExp;
  Message: string;
}

/** The constraints a user can reach from the Accounting editors, by name. */
const KNOWN_SAVE_ERRORS: readonly KnownSaveError[] = [
  {
    Pattern: /\bFK_GLAccount_Company\b/i,
    Message: 'The selected owning company no longer exists — it may have been removed since this page loaded. Refresh and choose again.',
  },
  {
    Pattern: /\bUQ_GLAccount_CompanyID_Code\b/i,
    Message: 'Another account in this company already uses this code. Choose a different code.',
  },
  {
    Pattern: /\bFK_GLAccount_Parent\b/i,
    Message: 'The selected parent account no longer exists. Refresh and choose again.',
  },
  {
    Pattern: /\bCK_GLAccount_NoSelfParent\b/i,
    Message: 'An account cannot be its own parent. Choose a different parent account.',
  },
  {
    Pattern: /\bFK_GLAccount_Currency\b/i,
    Message: 'The selected currency is not set up. Choose another currency.',
  },
  {
    Pattern: /\bFK_ACP_ApprovalCFOUser\b/i,
    Message: 'The selected user no longer exists. Refresh and choose again.',
  },
];

/** Text that comes from the database or its driver rather than from a rule written for people. */
const DATABASE_TEXT =
  /\b(constraint|violation of|conflicted with|cannot insert|duplicate key|sp(create|update|delete)\w*|invalid (column|object) name|conversion failed|would be truncated|sql|msg \d+)\b/i;

/**
 * The message to show for a failed save. `raw` is the save's `CompleteMessage` or a caught error's
 * message; `fallback` is the caller's "not saved" sentence for anything not fit to show.
 */
export function SaveErrorMessage(raw: string | null | undefined, fallback: string): string {
  const text = raw?.trim();
  if (!text) return fallback;
  const known = KNOWN_SAVE_ERRORS.find((k) => k.Pattern.test(text));
  if (known) return known.Message;
  const firstLine = text.split(/\bQuery:/)[0].split('\n').map((l) => l.trim()).find((l) => l.length > 0);
  return !firstLine || DATABASE_TEXT.test(firstLine) ? fallback : firstLine;
}
