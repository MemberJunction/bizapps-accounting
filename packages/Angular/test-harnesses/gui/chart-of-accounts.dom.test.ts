/** TIER 4 — Chart of Accounts dashboard, real API path: loads the COA + companies through the real
 *  client and renders cleanly. */
import { describe, it, expect, beforeAll } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { bootstrapTier4 } from './tier4-bootstrap';
import { ChartOfAccountsModule } from '../../src/lib/custom/ChartOfAccounts/chart-of-accounts.module';
import { ChartOfAccountsDashboardComponent } from '../../src/lib/custom/ChartOfAccounts/coa-dashboard.component';

interface Model { IsLoading?: boolean; LoadError: string | null; AllAccounts: Array<{ ID?: string; Code?: string }>; Companies: Array<{ ID: string }>; }

describe('TIER 4: Chart of Accounts (real API)', () => {
  beforeAll(async () => { await bootstrapTier4(); }, 180000);
  it('loads the chart of accounts + companies through the real client and renders cleanly', async () => {
    TestBed.configureTestingModule({ imports: [ChartOfAccountsModule] });
    const fixture = TestBed.createComponent(ChartOfAccountsDashboardComponent);
    const cmp = fixture.componentInstance as unknown as Model;
    fixture.detectChanges();
    for (let i = 0; i < 40; i++) { await new Promise((r) => setTimeout(r, 250)); if (cmp.LoadError !== null) break; if (i > 3 && cmp.IsLoading === false) break; }
    fixture.detectChanges();
    await fixture.whenStable();
    expect(cmp.LoadError, `LoadError: ${cmp.LoadError}`).toBeNull();
    expect((fixture.nativeElement as HTMLElement).innerHTML.length).toBeGreaterThan(0);
    expect(cmp.AllAccounts.length, 'seeded GL accounts loaded').toBeGreaterThan(0);
    expect(cmp.AllAccounts.every((a) => !!a.Code), 'every account has a Code').toBe(true);
    expect(cmp.Companies.length, 'accounting-enabled companies loaded').toBeGreaterThan(0);
  });
});
