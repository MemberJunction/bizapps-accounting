/**
 * sqlLiteral — strict, validated SQL literal builders for values that reach us from a client and
 * get concatenated into a RunView `ExtraFilter`.
 *
 * The threat is second-order SQL injection: a client-settable UUID field (an EntityID, a role ID,
 * a company ID, a FileID) is stored on a row, then later interpolated RAW into a filter string.
 * Anything that is not a plain UUID is REJECTED outright rather than escaped — there is no
 * legitimate UUID value that needs quoting, so refusing beats quoting and closes the whole class.
 *
 * NB: use {@link sqlGuidLiteral} only for values that are genuinely UUIDs (PK / FK columns). A
 * polymorphic RecordID that may hold a non-UUID composite key must NOT be validated this way — quote
 * it with {@link sqlTextLiteral} instead (single-quote doubling is already injection-safe).
 */

/** A GUID literal shape: 32 hex digits + hyphens, exactly 36 chars. Rejects quotes, spaces, keywords. */
const GUID_SHAPE = /^[0-9a-fA-F-]{36}$/;

/**
 * Validate `id` as a UUID and return it as a quoted T-SQL literal (`'<id>'`). Throws with `context`
 * in the message when the value is not a plain UUID.
 */
export function sqlGuidLiteral(id: string, context: string): string {
  if (typeof id !== 'string' || !GUID_SHAPE.test(id)) {
    throw new Error(`${context}: expected a UUID but got '${String(id)}'`);
  }
  return `'${id}'`;
}

/** A quoted T-SQL string literal (single quotes doubled) for values that are legitimately non-UUID. */
export function sqlTextLiteral(value: string): string {
  return `'${String(value).replace(/'/g, "''")}'`;
}
