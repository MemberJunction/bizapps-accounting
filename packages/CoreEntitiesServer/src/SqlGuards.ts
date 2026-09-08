/**
 * SqlGuards — validate-don't-escape helpers for UUIDs that get interpolated into SQL predicates.
 *
 * Every server-side `ExtraFilter` in this package that embeds an id embeds a UUID: entity primary
 * keys, FK values, batch/company/GL-account ids. There is NO legitimate UUID that needs quoting or
 * escaping, so the safe posture is validation — anything that is not a plain UUID is refused
 * outright with a clear message, rather than escaped into the predicate. This closes the
 * predicate-injection hole where a client-supplied "id" like `x' OR 1=1--` reaches a filter string.
 *
 * Extracted from JournalEntryBatchEngine's private `sqlGuid` (2026-09-05 security sweep) so every
 * EntityServer / gate / operation shares ONE validator instead of growing ad-hoc copies.
 */

/** Strict UUID shape: 8-4-4-4-12 hex. (SQL Server returns uppercase, randomUUID() lowercase — both pass.) */
const UUID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/** True when the value is a plain UUID string, safe to embed in a SQL predicate. */
export function isSqlGuid(value: string | null | undefined): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

/**
 * Require a plain UUID and return it unchanged. Throws with `context` in the message otherwise —
 * use at operation boundaries where the id arrives from a remote caller.
 */
export function requireSqlGuid(value: string, context: string): string {
  if (!isSqlGuid(value)) {
    throw new Error(`${context}: '${value}' is not a valid UUID — refusing to use it in a database filter.`);
  }
  return value;
}

/** A validated, quoted SQL GUID literal (`'xxxxxxxx-…'`) ready to embed in an ExtraFilter. */
export function sqlGuidLiteral(value: string, context: string): string {
  return `'${requireSqlGuid(value, context)}'`;
}
