/** TIER 4 (4e) — the company-scope chip. Presentational; its roster comes from an injected service
 *  (CompanyScopeService, itself fed by AccountingEngineBase's cache — DB-shaped, covered at its own
 *  tier). Faking the service is the correct form here: tier 4 owns the DOM contract over it. */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CompanyScopeChipComponent } from '../../src/lib/custom/shared/company-scope-chip.component';
import { CompanyScopeService } from '../../src/lib/custom/shared/company-scope.service';

class FakeCompanyScopeService {
  public Companies = [ { ID: 'co-1', Name: 'Acme Co.', CompanyCode: 'ACME' }, { ID: 'co-2', Name: 'Beta Ltd.', CompanyCode: 'BETA' } ];
  public SelectedIDs: string[] = [];
  public get IsAllCompanies(): boolean { return this.SelectedIDs.length === 0; }
  public get Label(): string {
    if (this.SelectedIDs.length === 0) return 'All companies';
    const first = this.Companies.find((c) => c.ID === this.SelectedIDs[0]);
    return this.SelectedIDs.length === 1 ? (first?.Name ?? '?') : `${first?.Name ?? '?'} +${this.SelectedIDs.length - 1}`;
  }
  public Toggle = vi.fn((id: string) => { this.SelectedIDs = this.SelectedIDs.includes(id) ? this.SelectedIDs.filter((x) => x !== id) : [...this.SelectedIDs, id]; });
  public SelectAll = vi.fn(() => { this.SelectedIDs = []; });
}

describe('TIER 4: company scope chip (presentational, faked service)', () => {
  let fixture: ComponentFixture<CompanyScopeChipComponent>;
  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [CompanyScopeChipComponent], providers: [{ provide: CompanyScopeService, useValue: new FakeCompanyScopeService() }] });
    fixture = TestBed.createComponent(CompanyScopeChipComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  });
  it('renders the chip button showing the "All companies" scope label (nothing selected)', () => {
    const btn = fixture.nativeElement.querySelector('.scope-chip__btn') as HTMLButtonElement | null;
    expect(btn, 'chip button renders').not.toBeNull();
    expect(btn!.textContent).toContain('All companies');
  });
  it('does not render the menu until opened', () => {
    expect(fixture.nativeElement.querySelector('.scope-chip__menu')).toBeNull();
  });
});
