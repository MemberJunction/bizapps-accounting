/**
 * Block 5 unit tests — the PURE date-range overlap used by the COA-mapping strict-1:1 supersession.
 * (Getting overlap wrong would either leave two ERP mappings active for one local account, or wrongly
 * supersede a non-overlapping one — both corrupt the §5.5 resolution.)
 */
import { describe, it, expect } from 'vitest';
import { rangesOverlap } from '../ChartOfAccountsMappingService.js';

const d = (s: string) => new Date(s);

describe('rangesOverlap', () => {
  it('detects overlapping closed ranges', () => {
    expect(rangesOverlap(d('2026-01-01'), d('2026-06-30'), d('2026-06-01'), d('2026-12-31'))).toBe(true);
  });
  it('detects disjoint closed ranges as non-overlapping', () => {
    expect(rangesOverlap(d('2026-01-01'), d('2026-03-31'), d('2026-04-01'), d('2026-06-30'))).toBe(false);
  });
  it('treats a null end as open-ended (overlaps anything at/after its start)', () => {
    expect(rangesOverlap(d('2026-01-01'), null, d('2030-01-01'), null)).toBe(true);
    expect(rangesOverlap(d('2026-01-01'), null, d('2025-01-01'), d('2025-12-31'))).toBe(false);
  });
  it('counts touching endpoints as overlap (same day)', () => {
    expect(rangesOverlap(d('2026-01-01'), d('2026-06-30'), d('2026-06-30'), null)).toBe(true);
  });
  it('a prior open-ended approved mapping overlaps a new one starting later (the supersession case)', () => {
    // prior: 2026-01-01 .. open ; new: 2026-07-01 .. open  → overlap → prior must be superseded
    expect(rangesOverlap(d('2026-01-01'), null, d('2026-07-01'), null)).toBe(true);
  });
});
