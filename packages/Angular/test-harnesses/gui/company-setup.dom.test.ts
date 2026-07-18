/** TIER 4 — Company Setup dashboard, real API path: loads company profiles (+ people/GL options)
 *  through the real client and renders cleanly. */
import { describe, it, expect, beforeAll } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { bootstrapTier4 } from './tier4-bootstrap';
import { CompanySetupModule } from '../../src/lib/custom/CompanySetup/company-setup.module';
import { CompanySetupDashboardComponent } from '../../src/lib/custom/CompanySetup/company-setup-dashboard.component';

interface Model { IsLoading?: boolean; LoadError: string | null; Companies: Array<{ ID?: string }>; }

describe('TIER 4: Company Setup (real API)', () => {
  beforeAll(async () => { await bootstrapTier4(); }, 180000);
  it('loads accounting company profiles through the real client and renders cleanly', async () => {
    TestBed.configureTestingModule({ imports: [CompanySetupModule] });
    const fixture = TestBed.createComponent(CompanySetupDashboardComponent);
    const cmp = fixture.componentInstance as unknown as Model;
    fixture.detectChanges();
    for (let i = 0; i < 40; i++) { await new Promise((r) => setTimeout(r, 250)); if (cmp.LoadError !== null) break; if (i > 3 && cmp.IsLoading === false) break; }
    fixture.detectChanges();
    await fixture.whenStable();
    expect(cmp.LoadError, `LoadError: ${cmp.LoadError}`).toBeNull();
    expect((fixture.nativeElement as HTMLElement).innerHTML.length).toBeGreaterThan(0);
    expect(cmp.Companies.length, 'company profiles loaded through the real client').toBeGreaterThan(0);
  });
});
