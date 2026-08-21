/**
 * TIER 4 — Company Setup dashboard (Configuration category), headless on the REAL path:
 * component → real GraphQL client → running MJAPI → live DB.
 *
 * What only this tier catches: the page's render/bindings/gating on real data — including the
 * two regressions found live on 2026-07-29:
 *   1. the CFO picker's user query used the pre-v5 entity name 'Users' → the whole page red-carded
 *      with "Entity Users not found in metadata" (fixed to 'MJ: Users'); the Users-populated
 *      assertion below is the standing guard.
 *   2. the page had no create affordance — the "New company" header button is now load-bearing
 *      (Marcelo: "I don't have the ability to create companies").
 *
 * Values are EXACT and drift-proof: every DOM assertion is cross-checked against an INDEPENDENT
 * RunView of the same data (not against constants that rot as the demo set grows).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { RunView } from '@memberjunction/core';
import { bootstrapTier4 } from './tier4-bootstrap';
import { CompanySetupModule } from '../../src/lib/custom/CompanySetup/company-setup.module';
import { CompanySetupDashboardComponent } from '../../src/lib/custom/CompanySetup/company-setup-dashboard.component';

const ACP_ENTITY = 'MJ_BizApps_Accounting: Accounting Company Profiles';

async function waitFor(fixture: ComponentFixture<CompanySetupDashboardComponent>, cond: () => boolean, ms = 30_000): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > ms) throw new Error('waitFor: condition not met in time');
    await new Promise((r) => setTimeout(r, 150));
    fixture.detectChanges();
  }
  fixture.detectChanges();
}

describe('Company Setup dashboard (tier 4)', () => {
  let expectedCompanies: Array<{ ID: string; Name: string; CompanyCode: string }> = [];
  let expectedUserCount = 0;

  beforeAll(async () => {
    await bootstrapTier4();
    // Independent expectations — the same data the page will load, fetched separately.
    const rv = new RunView();
    const [companies, users] = await rv.RunViews([
      { EntityName: ACP_ENTITY, Fields: ['ID', 'Name', 'CompanyCode'], OrderBy: 'Name ASC', ResultType: 'simple' },
      { EntityName: 'MJ: Users', Fields: ['ID'], MaxRows: 500, ResultType: 'simple' },
    ]);
    if (!companies.Success || !users.Success) throw new Error('tier-4 expectation queries failed');
    expectedCompanies = (companies.Results ?? []) as Array<{ ID: string; Name: string; CompanyCode: string }>;
    expectedUserCount = users.Results?.length ?? 0;
  }, 120_000);

  it('renders the full company roster with codes, exactly matching an independent read', async () => {
    await TestBed.configureTestingModule({ imports: [CompanySetupModule] }).compileComponents();
    const fixture = TestBed.createComponent(CompanySetupDashboardComponent);
    fixture.detectChanges(); // ngOnInit → loadData
    const comp = fixture.componentInstance;
    await waitFor(fixture, () => !comp.IsBusy);

    expect(comp.LoadError, `page load must not error (was: ${comp.LoadError})`).toBeNull();
    // The roster must list EVERY profile the independent read returned — same count, same names.
    expect(comp.Companies.length).toBe(expectedCompanies.length);
    expect(expectedCompanies.length, 'demo seed guarantees at least the 3 Assoc Demo companies').toBeGreaterThanOrEqual(3);

    const el: HTMLElement = fixture.nativeElement;
    const items = [...el.querySelectorAll('.cs-listitem')];
    expect(items.length).toBe(expectedCompanies.length);
    for (const c of expectedCompanies) {
      const item = items.find((i) => (i.textContent ?? '').includes(c.Name));
      expect(item, `roster row for ${c.Name}`).toBeTruthy();
      expect(item!.textContent).toContain(c.CompanyCode);
    }

    // First company auto-selected → detail card shows its fiscal-year string.
    expect(comp.Selected).not.toBeNull();
    expect(comp.FiscalYearStart.length).toBeGreaterThan(0);
  }, 60_000);

  it("populates the CFO user picker from 'MJ: Users' (regression: pre-v5 'Users' red-carded the page)", async () => {
    await TestBed.configureTestingModule({ imports: [CompanySetupModule] }).compileComponents();
    const fixture = TestBed.createComponent(CompanySetupDashboardComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    await waitFor(fixture, () => !comp.IsBusy);

    expect(comp.LoadError).toBeNull();
    expect(comp.Users.length, 'the CFO picker options must load').toBe(expectedUserCount);
    expect(expectedUserCount).toBeGreaterThan(0);
  }, 60_000);

  it('ships NO local New-company button — the create verb lives in the CATEGORY header (Marcelo 2026-08-05)', async () => {
    await TestBed.configureTestingModule({ imports: [CompanySetupModule] }).compileComponents();
    const fixture = TestBed.createComponent(CompanySetupDashboardComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    await waitFor(fixture, () => !comp.IsBusy);

    const el: HTMLElement = fixture.nativeElement;
    const btn = [...el.querySelectorAll('button')].find((b) => /New company/i.test(b.textContent ?? ''));
    // The header create verb was HOISTED to the category shell (orders-style rule). The dashboard
    // itself must ship no duplicate; its create path is the CreateSignal input the shell bumps.
    expect(btn, 'no local New company button — the category header owns the verb').toBeUndefined();
  }, 60_000);
});
