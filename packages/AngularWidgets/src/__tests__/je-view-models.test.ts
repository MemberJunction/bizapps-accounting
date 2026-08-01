import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  JE_STATUS_ORDER,
  buildJETimeline,
  sumCredits,
  sumDebits,
  type JELineView,
} from '../lib/journal-entry/je-view-models';

/**
 * TIER 1 — the journal-entry view models.
 *
 * The point of the layering, demonstrated: every assertion here is an object literal. No MJ
 * metadata, no data provider, no Angular TestBed. When the same logic lived inside a form
 * component that loaded its own data, none of it was reachable this cheaply — which is why it
 * went untested, and why the two copies were free to drift apart.
 */

function line(overrides: Partial<JELineView> = {}): JELineView {
  return {
    ID: 'line-1',
    LineNumber: 1,
    AccountCode: '1200',
    AccountName: 'Accounts Receivable',
    GLAccountID: 'acct-1',
    Debit: 0,
    Credit: 0,
    Description: null,
    Dimensions: [],
    ...overrides,
  };
}

describe('buildJETimeline', () => {
  it('marks only the first step done for a Pending entry', () => {
    const steps = buildJETimeline('Pending');
    expect(steps.map((s) => s.Done)).toEqual([true, false, false]);
    expect(steps.filter((s) => s.Current).map((s) => s.Key)).toEqual(['Pending']);
  });

  it('marks everything up to and including the current step done', () => {
    const steps = buildJETimeline('Batched');
    expect(steps.map((s) => s.Done)).toEqual([true, true, false]);
    expect(steps.filter((s) => s.Current).map((s) => s.Key)).toEqual(['Batched']);
  });

  it('marks the whole chain done for a posted entry', () => {
    expect(buildJETimeline('GLPosted').every((s) => s.Done)).toBe(true);
  });

  it('names exactly one step current', () => {
    for (const status of Object.keys(JE_STATUS_ORDER) as Array<keyof typeof JE_STATUS_ORDER>) {
      expect(buildJETimeline(status).filter((s) => s.Current)).toHaveLength(1);
    }
  });

  it('covers every status the entity allows', () => {
    // If CodeGen widens the Status CHECK constraint, this fails and the timeline gets updated —
    // rather than silently rendering an all-pending chain for the new value.
    const rendered = buildJETimeline('Pending').map((s) => s.Key);
    expect(rendered.sort()).toEqual(Object.keys(JE_STATUS_ORDER).sort());
  });
});

describe('sumDebits / sumCredits', () => {
  it('sums each column independently', () => {
    const lines = [
      line({ ID: 'a', Debit: 100 }),
      line({ ID: 'b', Credit: 60 }),
      line({ ID: 'c', Credit: 40 }),
    ];
    expect(sumDebits(lines)).toBe(100);
    expect(sumCredits(lines)).toBe(100);
  });

  it('treats an empty entry as zero rather than NaN', () => {
    expect(sumDebits([])).toBe(0);
    expect(sumCredits([])).toBe(0);
  });
});

describe('line table column alignment', () => {
  /**
   * A structural pin, not a rendering test.
   *
   * The read-only copy this widget replaced footed its totals with `colspan="4"` across a
   * six-column table, so the debit total rendered under the **Credit** heading and the credit
   * total under **Dimensions**. Nobody noticed, because the numbers were present and plausible —
   * just one column to the right.
   *
   * The header spans #, Account and Description, so the totals land under Debit and Credit:
   * colspan must be 3.
   */
  const template = readFileSync(
    join(fileURLToPath(new URL('.', import.meta.url)), '..', 'lib', 'journal-entry', 'je-line-table.component.ts'),
    'utf8',
  );

  it('foots the totals row with colspan 3 so Dr/Cr land under their own headings', () => {
    expect(template).toContain('<td colspan="3" class="jelt__total-label">');
  });

  it('spans the out-of-balance alert across every column', () => {
    // Bound rather than literal, because the dimension column is optional.
    expect(template).toContain('[attr.colspan]="ColumnCount"');
  });
});
