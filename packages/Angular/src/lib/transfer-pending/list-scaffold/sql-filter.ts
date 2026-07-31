/**
 * Filter-fragment helpers for list screens.
 *
 * `RunView.ExtraFilter` is a SQL predicate STRING — there is no parameter binding on that seam — so
 * any user-supplied text composed into it must be escaped here. Free-text search boxes are exactly
 * that path, which is why this is a shared, unit-tested seam rather than an inline template literal
 * at each call site.
 *
 * Pure + framework-free (tier-1 boundary).
 */

/**
 * Escape a value for use inside a single-quoted T-SQL string literal.
 *
 * Doubling the single quote is the T-SQL escape: `O'Brien` → `O''Brien`. Without it, a quote in the
 * search box terminates the literal early and the rest of the input is parsed as SQL.
 *
 * Returns the INNER text only — callers still supply the surrounding quotes, so the escaping and the
 * quoting stay visibly adjacent at the call site.
 */
export function sqlLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

/**
 * Escape a value for a `LIKE` pattern: the literal escape, plus LIKE's own wildcards.
 *
 * `%`, `_` and `[` are wildcards in T-SQL `LIKE`. Un-escaped, a user typing `50%` would match far
 * more than they meant, and a lone `[` raises a malformed-pattern error. We neutralise them with an
 * explicit ESCAPE character — callers MUST pair this with `ESCAPE '\'` (see `likeContains`).
 */
export function sqlLikePattern(value: string): string {
  return sqlLiteral(value)
    .replace(/\\/g, '\\\\') // the escape char itself first, or we'd double-escape the ones we add
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
    .replace(/\[/g, '\\[');
}

/**
 * A `contains` predicate over one or more columns, ORed together.
 * Returns null for blank input so it composes away to nothing.
 *
 * The result is intentionally NOT parenthesised — `andFilters` wraps each fragment, which is what
 * stops this OR-chain from binding loosely against sibling filters.
 */
export function likeContains(columns: readonly string[], search: string): string | null {
  const term = search.trim();
  if (!term || columns.length === 0) return null;

  const pattern = sqlLikePattern(term);
  return columns.map((c) => `${c} LIKE '%${pattern}%' ESCAPE '\\'`).join(' OR ');
}
