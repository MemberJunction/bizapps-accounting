/**
 * TIER 4 — All Accounts page (Accounts category), headless on the real client → MJAPI → DB path.
 * Rows are cross-checked against an INDEPENDENT GLAccount read (drift-proof exact values), and the
 * demo COA anchors one truly-exact assertion (code 11101 = 'Operating Cash', W1-seeded).
 *
 * Direct-declaration pattern (NOT ShellModule — its module graph has a circular import that
 * resolves undefined from a test entry; see je-dashboard.dom.test.ts).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RunView } from '@memberjunction/core';
import { bootstrapTier4 } from './tier4-bootstrap';
import {
  MJButtonDirective,
  MJPageHeaderInteriorComponent,
  MJPageBodyInteriorComponent,
  MJStatBadgeComponent,
  MJAlertComponent,
  MJEmptyStateComponent,
} from '@memberjunction/ng-ui-components';
import { SharedGenericModule } from '@memberjunction/ng-shared-generic';
import { GLAccountsPageComponent } from '../../src/lib/custom/shell/pages/gl-accounts.page';
import { PageRefreshService } from '../../src/lib/transfer-pending/shell-refresh/page-refresh.service';

const GL_ENTITY = 'MJ_BizApps_Accounting: GL Accounts';
const DEMO_CO1 = 'a55c0de1-0001-4000-8000-000000000001';

async function waitFor(fixture: ComponentFixture<GLAccountsPageComponent>, cond: () => boolean, ms = 30_000): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > ms) throw new Error('waitFor: condition not met in time');
    await new Promise((r) => setTimeout(r, 150));
    fixture.detectChanges();
  }
  fixture.detectChanges();
}

async function mount(): Promise<ComponentFixture<GLAccountsPageComponent>> {
  await TestBed.configureTestingModule({
    declarations: [GLAccountsPageComponent],
    imports: [CommonModule, FormsModule, SharedGenericModule, MJButtonDirective, MJPageHeaderInteriorComponent, MJPageBodyInteriorComponent, MJStatBadgeComponent, MJAlertComponent, MJEmptyStateComponent],
    providers: [PageRefreshService],
  }).compileComponents();
  const fixture = TestBed.createComponent(GLAccountsPageComponent);
  fixture.detectChanges();
  await waitFor(fixture, () => !fixture.componentInstance.IsLoading);
  return fixture;
}

describe('All Accounts page (tier 4)', () => {
  let expectedCount = 0;

  beforeAll(async () => {
    await bootstrapTier4();
    const r = await new RunView().RunView({ EntityName: GL_ENTITY, Fields: ['ID'], MaxRows: 1, ResultType: 'simple' });
    if (!r.Success) throw new Error(`expectation read failed: ${r.ErrorMessage}`);
    expectedCount = r.TotalRowCount ?? 0;
  }, 120_000);

  it('loads every account (scope All) and renders the demo COA anchor row exactly', async () => {
    const fixture = await mount();
    const comp = fixture.componentInstance;
    expect(comp.LoadError, `page load must not error (was: ${comp.LoadError})`).toBeNull();
    expect(comp.Rows.length).toBe(expectedCount);
    expect(expectedCount, 'demo seed guarantees at least CO1..CO3 × 10 accounts').toBeGreaterThanOrEqual(30);

    // W1-seeded anchor: CO1's 11101 is 'Operating Cash' — a truly exact, deterministic value.
    const anchor = comp.Rows.find((r) => r.Code === '11101' && String(r.CompanyID).toLowerCase() === DEMO_CO1);
    expect(anchor, 'CO1 account 11101 must be present').toBeTruthy();
    expect(anchor!.Name).toBe('Operating Cash');

    // The rendered table shows the same row.
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Operating Cash');
  }, 90_000);

  it('company filter narrows the Filtered view to exactly that company (client-side filter over loaded rows)', async () => {
    const fixture = await mount();
    const comp = fixture.componentInstance;
    const co1Expected = await new RunView().RunView({ EntityName: GL_ENTITY, ExtraFilter: `CompanyID='${DEMO_CO1}'`, Fields: ['ID'], MaxRows: 1, ResultType: 'simple' });
    comp.FilterCompanyID = DEMO_CO1.toUpperCase();
    fixture.detectChanges();
    // `Filtered` is the template's data source — assert it matches the independent per-company count
    // and that no row outside the filter leaks through.
    expect(comp.Filtered.length).toBe(co1Expected.TotalRowCount ?? -1);
    expect(comp.Filtered.every((r) => String(r.CompanyID).toLowerCase() === DEMO_CO1)).toBe(true);
  }, 90_000);
});
