/**
 * TIER 4 (4e-ii) — Customer A/R base (`CustomerARBaseComponent`), the read-only aging view accounting
 * owns and orders wraps. Presentational (host supplies a resolved `View`); the money-correctness bit is
 * the BUCKETS-FOOT invariant (aging buckets must sum to TotalOpen — a silent mismatch is exactly what
 * an accountant never forgives). Previously blocked by the tier-4 locale crash; unblocked by 1.3.0.
 */
import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { CustomerARBaseComponent, type CustomerARView } from '../../src/lib/custom/shared/customer-ar-base.component';

interface Model {
  View: CustomerARView | null;
  Buckets: Array<{ Label: string; Amount: number; Overdue: boolean }>;
  BucketsFoot: boolean;
  BucketSum: number;
  PastDue: number;
}

const VIEW: CustomerARView = {
  CustomerOrganizationID: null, CustomerName: 'Umbrella Aging', OpenBalance: 1000,
  TotalCharges: 1000, TotalPayments: 0,
  Current_0_30: 100, Days_31_60: 200, Days_61_90: 300, Days_Over_90: 400, TotalOpen: 1000,
};

describe('TIER 4 (4e-ii): Customer A/R base — aging strip + buckets-foot invariant', () => {
  it('renders the aging strip and asserts buckets foot to TotalOpen', () => {
    TestBed.configureTestingModule({ imports: [CustomerARBaseComponent] });
    const f = TestBed.createComponent(CustomerARBaseComponent);
    const c = f.componentInstance as unknown as Model;

    c.View = { ...VIEW };
    f.detectChanges();
    expect(c.Buckets.length, 'four aging buckets').toBe(4);
    expect(c.BucketSum, 'bucket sum').toBe(1000);
    expect(c.BucketsFoot, 'buckets sum to TotalOpen (money-correctness invariant)').toBe(true);
    expect(c.PastDue, 'past-due = money > 30 days (200+300+400)').toBe(900);
    expect((f.nativeElement as HTMLElement).textContent, 'renders the customer').toContain('Umbrella Aging');

    // A buckets/total mismatch must be CAUGHT by the invariant (not silently summed away).
    c.View = { ...VIEW, TotalOpen: 999 };
    f.detectChanges();
    expect(c.BucketsFoot, 'mismatched total ⇒ invariant fails').toBe(false);
  });
});
