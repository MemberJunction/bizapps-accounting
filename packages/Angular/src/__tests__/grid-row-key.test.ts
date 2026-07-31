import { describe, it, expect } from 'vitest';
import { rowKeyToId } from '../lib/transfer-pending/list-scaffold/grid-row-key';

/**
 * Tier 1 for the grid rowKey parser.
 *
 * This pins a bug that SHIPPED in both apps: every detail slide-in filtered
 * `ID='<rowKey>'`, but rowKey is CompositeKey's concatenated form ("ID|<guid>"), so the filter was
 * `ID='ID|<guid>'` — it matched nothing, threw nothing, logged nothing, and the panel simply said
 * "could not be loaded". Silent, and invisible to any test that only asserts the panel opened.
 */
describe('rowKeyToId', () => {
  const GUID = 'A6A961F5-A511-4E40-A294-B7EBB5BBA7D4';

  it('extracts the id from the grid’s concatenated single-PK key', () => {
    expect(rowKeyToId(`ID|${GUID}`)).toBe(GUID);
  });

  it('extracts the named field from a MULTI-key row', () => {
    expect(rowKeyToId(`CompanyID|abc||ID|${GUID}`, 'ID')).toBe(GUID);
    expect(rowKeyToId(`CompanyID|abc||ID|${GUID}`, 'CompanyID')).toBe('abc');
  });

  it('passes a bare value through — the grid emits one when it has no EntityInfo', () => {
    expect(rowKeyToId(GUID)).toBe(GUID);
  });

  it('returns null for an absent key rather than a string that would break a filter', () => {
    expect(rowKeyToId(null)).toBeNull();
    expect(rowKeyToId(undefined)).toBeNull();
    expect(rowKeyToId('')).toBeNull();
  });

  it('returns null when the requested field is not in the key', () => {
    // The important half: null makes the caller show nothing, instead of issuing ID='undefined'.
    expect(rowKeyToId(`CompanyID|abc`, 'ID')).toBeNull();
  });

  it('never returns the raw "ID|…" form — the exact shape that caused the shipped bug', () => {
    const result = rowKeyToId(`ID|${GUID}`);
    expect(result).not.toContain('|');
    expect(result).not.toMatch(/^ID/);
  });
});
