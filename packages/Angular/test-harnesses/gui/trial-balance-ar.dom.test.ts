/**
 * TIER 4 — Trial Balance / AR dashboard, rendered headless against the REAL API path
 * (component → GraphQLDataProvider → MJAPI → DB). Pinned to the Association demo company CO1, whose
 * exact figures are proven at tier 3 (readmodels-client 29/29): the trial balance FOOTS to 3920 and
 * AR (11201) nets 2300. Here we prove those exact values flow through the component's real client and
 * populate its model, and the dashboard renders cleanly (keystone).
 *
 * jsdom note: the money grid is AG Grid, externalized in vitest.gui.config.ts, so it does not paint
 * cells under jsdom — the exact-value proof is the component MODEL (the array the grid binds) plus a
 * non-empty render; grid-cell pixels are a tier-5 concern (per TEST-ARCHITECTURE jsdom limits).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { bootstrapTier4 } from './tier4-bootstrap';
import { ReadModelsModule } from '../../src/lib/custom/shared/read-models.module';
import { TrialBalanceARDashboardComponent } from '../../src/lib/custom/TrialBalanceAR/trial-balance-ar-dashboard.component';

const CO1 = 'a55c0de1-0001-4000-8000-000000000001';

interface TBRow { GLAccountCode: string; TotalDebits: number; TotalCredits: number; NetBalance: number; }
interface Model { SelectedCompanyID: string | null; IsLoading: boolean; LoadError: string | null; TrialBalance: TBRow[]; OpenAR: Array<{ OpenBalance: number }>; }

// NOTE: the scaffold's beforeEach (keystone) calls configureTestingModule per test, so the render
// must happen INSIDE the test (not beforeAll) — configuring after instantiation throws. One render,
// all assertions, matching the scaffold's example pattern.
describe('TIER 4: Trial Balance / AR dashboard (real API, CO1)', () => {
  beforeAll(async () => { await bootstrapTier4(); }, 180000);

  it('renders CO1 trial balance through the real client with EXACT values', async () => {
    TestBed.configureTestingModule({ imports: [ReadModelsModule] });
    const fixture = TestBed.createComponent(TrialBalanceARDashboardComponent);
    const cmp = fixture.componentInstance as unknown as Model;
    cmp.SelectedCompanyID = CO1; // pin BEFORE ngOnInit → loadData uses CO1, not the first company
    fixture.detectChanges(); // ngOnInit → loadData(CO1) (async, in flight)
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 250));
      if (cmp.LoadError !== null) break;
      if (i > 3 && cmp.IsLoading === false) break;
    }
    fixture.detectChanges();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    // loaded cleanly + rendered
    expect(cmp.LoadError, `LoadError: ${cmp.LoadError}`).toBeNull();
    expect(cmp.SelectedCompanyID).toBe(CO1);
    expect(el.innerHTML.length).toBeGreaterThan(0);

    // EXACT values through the real client → API → DB (grid cells are AG-Grid/external in jsdom, so
    // the value proof is the component model the grid binds):
    const dr = cmp.TrialBalance.reduce((s, r) => s + Number(r.TotalDebits), 0);
    const cr = cmp.TrialBalance.reduce((s, r) => s + Number(r.TotalCredits), 0);
    const net = cmp.TrialBalance.reduce((s, r) => s + Number(r.NetBalance), 0);
    expect(dr, 'trial balance foots — debits').toBe(3920);
    expect(cr, 'trial balance foots — credits').toBe(3920);
    expect(net, 'trial balance nets to zero').toBe(0);
    expect(cmp.TrialBalance.find((r) => r.GLAccountCode === '11201')?.NetBalance, 'AR 11201 net').toBe(2300);
    expect(cmp.OpenAR.reduce((s, r) => s + Number(r.OpenBalance), 0), 'open AR total').toBe(2300);
  });
});
