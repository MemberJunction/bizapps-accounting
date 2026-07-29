import { describe, it, expect } from 'vitest';
import { sqlLiteral, sqlLikePattern, likeContains } from '../lib/transfer-pending/list-scaffold/sql-filter';
import { andFilters } from '../lib/transfer-pending/list-scaffold/time-window';

/**
 * TIER 1 — filter escaping.
 *
 * `RunView.ExtraFilter` is a SQL string with no parameter binding, so a search box composes user
 * text straight into a predicate. These tests pin the escaping that keeps that safe and correct.
 */

describe('sqlLiteral', () => {
  it('passes ordinary text through unchanged', () => {
    expect(sqlLiteral('Acme Corp')).toBe('Acme Corp');
  });

  it("doubles a single quote (T-SQL literal escape)", () => {
    expect(sqlLiteral("O'Brien")).toBe("O''Brien");
  });

  it('escapes EVERY quote, not just the first', () => {
    expect(sqlLiteral("a'b'c")).toBe("a''b''c");
  });

  it('neutralises a classic literal-breakout attempt', () => {
    // Unescaped, this would close the literal and append a statement.
    const malicious = "x'; DROP TABLE JournalEntry--";
    const composed = `Description = '${sqlLiteral(malicious)}'`;

    expect(composed).toBe("Description = 'x''; DROP TABLE JournalEntry--'");
    // The payload is now inert: the literal never terminates early.
    expect(composed.match(/'/g)!.length % 2).toBe(0);
  });
});

describe('sqlLikePattern', () => {
  it('escapes the LIKE wildcards % and _', () => {
    // A user typing "50%" means the characters "50%", not "starts with 50".
    expect(sqlLikePattern('50%')).toBe('50\\%');
    expect(sqlLikePattern('a_b')).toBe('a\\_b');
  });

  it('escapes a bracket (a T-SQL LIKE character-class opener)', () => {
    expect(sqlLikePattern('a[b')).toBe('a\\[b');
  });

  it('escapes the escape character itself, and does so FIRST (no double-escaping)', () => {
    // If the backslash were escaped after %, the "\" we add for % would be re-escaped and the
    // pattern would stop matching. Order matters — this pins it.
    expect(sqlLikePattern('a\\b')).toBe('a\\\\b');
    expect(sqlLikePattern('a\\%b')).toBe('a\\\\\\%b');
  });

  it('still applies the quote escape', () => {
    expect(sqlLikePattern("O'%")).toBe("O''\\%");
  });
});

describe('likeContains', () => {
  it('is null for blank/whitespace input so it composes away', () => {
    expect(likeContains(['Description'], '')).toBeNull();
    expect(likeContains(['Description'], '   ')).toBeNull();
  });

  it('is null when no columns are given', () => {
    expect(likeContains([], 'abc')).toBeNull();
  });

  it('builds a contains predicate with an explicit ESCAPE clause', () => {
    expect(likeContains(['Description'], 'rent')).toBe("Description LIKE '%rent%' ESCAPE '\\'");
  });

  it('ORs across multiple columns', () => {
    expect(likeContains(['EntryNumber', 'Description'], 'JE-1')).toBe(
      "EntryNumber LIKE '%JE-1%' ESCAPE '\\' OR Description LIKE '%JE-1%' ESCAPE '\\'",
    );
  });

  it('trims the term', () => {
    expect(likeContains(['A'], '  x  ')).toBe("A LIKE '%x%' ESCAPE '\\'");
  });

  it('the OR-chain is safely bound once andFilters wraps it', () => {
    // The real bug this guards: "A OR B" ANDed with "C" must not become "A OR (B AND C)".
    const composed = andFilters(likeContains(['A', 'B'], 'x'), "Status='Pending'");

    expect(composed).toBe(
      "(A LIKE '%x%' ESCAPE '\\' OR B LIKE '%x%' ESCAPE '\\') AND (Status='Pending')",
    );
  });

  it('a quote in the search box cannot break out of the predicate', () => {
    const composed = likeContains(['Description'], "O'Brien")!;
    expect(composed).toBe("Description LIKE '%O''Brien%' ESCAPE '\\'");
    expect(composed.match(/'/g)!.length % 2).toBe(0);
  });
});
