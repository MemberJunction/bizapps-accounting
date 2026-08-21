import { CompositeKey } from '@memberjunction/core';

/**
 * Turn `<mj-entity-data-grid>`'s `AfterRowClick` **rowKey** into a usable primary-key value.
 *
 * ⚠ THE TRAP THIS EXISTS FOR: `rowKey` is NOT the record's ID. The grid builds it with
 * `buildPkString()` → `CompositeKey.ToConcatenatedString()`, whose format is
 * `Field|Value` (multi-key: `F1|V1||F2|V2`). For a single-PK entity you therefore get
 *
 *     "ID|A6A961F5-A511-4E40-A294-B7EBB5BBA7D4"
 *
 * not the bare GUID. The event's own doc comment says "The row key (ID)", which reads as though it
 * IS the id — and the value LOOKS id-ish in a debugger — so the natural `ExtraFilter: ID='<rowKey>'`
 * compiles, runs, and silently returns nothing. Both apps shipped that bug: every detail slide-in
 * opened and then reported "could not be loaded", because the filter was
 * `ID='ID|A6A961F5-…'`. Nothing throws; there is no console error; the panel just never has data.
 *
 * So: never interpolate a rowKey into a filter. Parse it here, once.
 *
 * @param rowKey the grid's `AfterRowClickEventArgs.rowKey`
 * @param fieldName the PK field to extract (default `ID` — the MJ convention)
 * @returns the primary-key VALUE, or null when the key is absent/unparseable (callers show nothing
 *          rather than issuing a malformed query)
 */
export function rowKeyToId(rowKey: string | null | undefined, fieldName = 'ID'): string | null {
  if (!rowKey) return null;

  // A bare value (no delimiter) is returned as-is: the grid falls back to a plain KeyField lookup
  // when it has no EntityInfo, and that path yields an unwrapped value.
  if (!rowKey.includes('|')) return rowKey;

  // MJ parses with an INSTANCE method (there is no static FromString), using the same '||' / '|'
  // delimiters the grid encoded with.
  const key = new CompositeKey();
  key.LoadFromConcatenatedString(rowKey);
  const value = key.GetValueByFieldName(fieldName);
  return value == null ? null : String(value);
}
