/**
 * TIER 4 — Revenue & Tax dashboard, headless against the REAL API (component → GraphQLDataProvider →
 * MJAPI → DB). Pinned to CO1, whose figures are proven at tier 3: deferred revenue defers 300 /
 * releases 120 (a period closes at 180); sales tax accrued 1500 / remitted 350 / outstanding 1150.
 * Grid cells are AG-Grid (external in jsdom) → the exact-value proof is the component model + the
 * TotalOutstandingTax getter; clean render via the keystone.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { bootstrapTier4 } from './tier4-bootstrap';
import { ReadModelsModule } from '../../src/lib/custom/shared/read-models.module';
import { RevenueTaxDashboardComponent } from '../../src/lib/custom/RevenueTax/revenue-tax-dashboard.component';

const CO1 = 'a55c0de1-0001-4000-8000-000000000001';
interface DefRev { Additions: number; Releases: number; ClosingBalance: number; }
interface Tax { AccruedAmount: number; RemittedAmount: number; OutstandingLiability: number; Status: string; }
interface Model { SelectedCompanyID: string | null; IsLoading: boolean; LoadError: string | null; DeferredRevenue: DefRev[]; SalesTax: Tax[]; TotalOutstandingTax: number; }

describe('TIER 4: Revenue & Tax dashboard (real API, CO1)', () => {
  beforeAll(async () => { await bootstrapTier4(); }, 180000);

  it('renders CO1 deferred-revenue + sales-tax through the real client with EXACT values', async () => {
    TestBed.configureTestingModule({ imports: [ReadModelsModule] });
    const fixture = TestBed.createComponent(RevenueTaxDashboardComponent);
    const cmp = fixture.componentInstance as unknown as Model;
    cmp.SelectedCompanyID = CO1;
    fixture.detectChanges();
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 250));
      if (cmp.LoadError !== null) break;
      if (i > 3 && cmp.IsLoading === false) break;
    }
    fixture.detectChanges();
    await fixture.whenStable();

    expect(cmp.LoadError, `LoadError: ${cmp.LoadError}`).toBeNull();
    expect((fixture.nativeElement as HTMLElement).innerHTML.length).toBeGreaterThan(0);

    // Deferred revenue waterfall — EXACT
    expect(cmp.DeferredRevenue.reduce((s, r) => s + Number(r.Additions), 0), 'defrev additions').toBe(300);
    expect(cmp.DeferredRevenue.reduce((s, r) => s + Number(r.Releases), 0), 'defrev releases').toBe(120);
    expect(cmp.DeferredRevenue.some((r) => Number(r.ClosingBalance) === 180), 'a defrev period closes at 180').toBe(true);

    // Sales tax liability — EXACT
    expect(cmp.SalesTax.reduce((s, r) => s + Number(r.AccruedAmount), 0), 'tax accrued').toBe(1500);
    expect(cmp.SalesTax.reduce((s, r) => s + Number(r.RemittedAmount), 0), 'tax remitted').toBe(350);
    expect(cmp.SalesTax.reduce((s, r) => s + Number(r.OutstandingLiability), 0), 'tax outstanding').toBe(1150);
    expect(cmp.TotalOutstandingTax, 'TotalOutstandingTax getter').toBe(1150);
    const partial = cmp.SalesTax.find((r) => r.Status === 'PartiallyPaid');
    expect(partial?.AccruedAmount === 1000 && partial?.OutstandingLiability === 650, 'PartiallyPaid 1000/650').toBe(true);
  });
});
