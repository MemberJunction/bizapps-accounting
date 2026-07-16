import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CompanyScopeChipComponent } from './company-scope-chip.component';
import { CompanyScopeService, ScopeCompany } from './company-scope.service';

/**
 * TIER 4 — the company scope chip, rendered headless (real Angular, jsdom, zoneless).
 *
 * The keystone in `vitest.dom.setup.ts` fails any test that logs a console.error / hits Angular's
 * ErrorHandler during render, so these also prove the chip renders CLEANLY.
 *
 * The scope SERVICE is faked here — not because tier 4 tolerates mocks, but because the service's
 * real behaviour (persistence, empty-means-all, unknown-id dropping, the roster read from
 * AccountingEngineBase's cache) is DB/engine-shaped and is covered at its own tier. What tier 4
 * owns is the DOM contract over that service: what renders, what is checked, what clicking emits.
 */

class FakeCompanyScopeService {
  public Companies: ScopeCompany[] = [
    { ID: 'co-1', Name: 'Acme Co.', CompanyCode: 'ACME' },
    { ID: 'co-2', Name: 'Beta Ltd.', CompanyCode: 'BETA' },
  ];
  public SelectedIDs: string[] = [];

  public get IsAllCompanies(): boolean {
    return this.SelectedIDs.length === 0;
  }
  public get Label(): string {
    if (this.SelectedIDs.length === 0) return 'All companies';
    const first = this.Companies.find((c) => c.ID === this.SelectedIDs[0]);
    return this.SelectedIDs.length === 1 ? (first?.Name ?? '?') : `${first?.Name ?? '?'} +${this.SelectedIDs.length - 1}`;
  }
  public Toggle = vi.fn((id: string) => {
    this.SelectedIDs = this.SelectedIDs.includes(id)
      ? this.SelectedIDs.filter((x) => x !== id)
      : [...this.SelectedIDs, id];
  });
  public SelectAll = vi.fn(() => {
    this.SelectedIDs = [];
  });
}

async function render(): Promise<{ fixture: ComponentFixture<CompanyScopeChipComponent>; scope: FakeCompanyScopeService }> {
  const scope = new FakeCompanyScopeService();
  TestBed.configureTestingModule({
    imports: [CompanyScopeChipComponent],
    providers: [{ provide: CompanyScopeService, useValue: scope }],
  });
  const fixture = TestBed.createComponent(CompanyScopeChipComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  return { fixture, scope };
}

function el<T extends HTMLElement>(fixture: ComponentFixture<unknown>, selector: string): T | null {
  return fixture.nativeElement.querySelector(selector) as T | null;
}
function all(fixture: ComponentFixture<unknown>, selector: string): HTMLElement[] {
  return Array.from(fixture.nativeElement.querySelectorAll(selector)) as HTMLElement[];
}

describe('CompanyScopeChipComponent (DOM)', () => {
  let fixture: ComponentFixture<CompanyScopeChipComponent>;
  let scope: FakeCompanyScopeService;

  beforeEach(async () => {
    ({ fixture, scope } = await render());
  });

  describe('closed state', () => {
    it('renders the chip button with the scope label', () => {
      const btn = el<HTMLButtonElement>(fixture, '.scope-chip__btn');
      expect(btn).not.toBeNull();
      expect(btn!.textContent).toContain('All companies');
    });

    it('does not render the menu until opened', () => {
      expect(el(fixture, '.scope-chip__menu')).toBeNull();
      expect(el<HTMLButtonElement>(fixture, '.scope-chip__btn')!.getAttribute('aria-expanded')).toBe('false');
    });
  });

  describe('opening the menu', () => {
    beforeEach(async () => {
      el<HTMLButtonElement>(fixture, '.scope-chip__btn')!.click();
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it('renders the menu and flags aria-expanded', () => {
      expect(el(fixture, '.scope-chip__menu')).not.toBeNull();
      expect(el<HTMLButtonElement>(fixture, '.scope-chip__btn')!.getAttribute('aria-expanded')).toBe('true');
    });

    it('lists EVERY company with its name and code (real values reach the DOM)', () => {
      const names = all(fixture, '.scope-chip__name').map((n) => n.textContent?.trim());
      const codes = all(fixture, '.scope-chip__code').map((n) => n.textContent?.trim());

      expect(names).toEqual(['Acme Co.', 'Beta Ltd.']);
      expect(codes).toEqual(['ACME', 'BETA']);
    });

    it('marks "All companies" active when nothing is selected', () => {
      expect(el(fixture, '.scope-chip__all--on')).not.toBeNull();
    });

    it('leaves every company checkbox unchecked when scope is All', () => {
      const boxes = all(fixture, 'input[type="checkbox"]') as HTMLInputElement[];
      expect(boxes).toHaveLength(2);
      expect(boxes.every((b) => !b.checked)).toBe(true);
    });
  });

  describe('behaviour — the control actually drives the scope', () => {
    beforeEach(async () => {
      el<HTMLButtonElement>(fixture, '.scope-chip__btn')!.click();
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it('ticking a company toggles it on the service', async () => {
      const box = (all(fixture, 'input[type="checkbox"]')[0] as HTMLInputElement);
      box.click();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(scope.Toggle).toHaveBeenCalledWith('co-1');
      expect(scope.SelectedIDs).toEqual(['co-1']);
    });

    it('the chip label reflects the new scope after a toggle', async () => {
      (all(fixture, 'input[type="checkbox"]')[0] as HTMLInputElement).click();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(el(fixture, '.scope-chip__btn')!.textContent).toContain('Acme Co.');
    });

    it('shows the "+N" label form when several companies are scoped', async () => {
      const boxes = all(fixture, 'input[type="checkbox"]') as HTMLInputElement[];
      boxes[0].click();
      boxes[1].click();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(el(fixture, '.scope-chip__btn')!.textContent).toContain('Acme Co. +1');
    });

    it('"All companies" clears the scope', async () => {
      (all(fixture, 'input[type="checkbox"]')[0] as HTMLInputElement).click();
      fixture.detectChanges();
      await fixture.whenStable();

      el<HTMLButtonElement>(fixture, '.scope-chip__all')!.click();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(scope.SelectAll).toHaveBeenCalled();
      expect(scope.SelectedIDs).toEqual([]);
      expect(el(fixture, '.scope-chip__btn')!.textContent).toContain('All companies');
    });
  });

  describe('dismissal', () => {
    beforeEach(async () => {
      el<HTMLButtonElement>(fixture, '.scope-chip__btn')!.click();
      fixture.detectChanges();
      await fixture.whenStable();
      expect(el(fixture, '.scope-chip__menu')).not.toBeNull();
    });

    it('a click OUTSIDE the chip closes the menu', async () => {
      document.body.click();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(el(fixture, '.scope-chip__menu')).toBeNull();
    });

    it('a click INSIDE the menu does NOT close it (ticking several companies must be possible)', async () => {
      (all(fixture, 'input[type="checkbox"]')[0] as HTMLInputElement).click();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(el(fixture, '.scope-chip__menu')).not.toBeNull();
    });

    it('Escape closes the menu', async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      fixture.detectChanges();
      await fixture.whenStable();

      expect(el(fixture, '.scope-chip__menu')).toBeNull();
    });
  });

  describe('empty roster', () => {
    it('explains that there are no accounting-enabled companies rather than rendering an empty menu', async () => {
      scope.Companies = [];
      el<HTMLButtonElement>(fixture, '.scope-chip__btn')!.click();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(el(fixture, '.scope-chip__empty')!.textContent).toContain('No accounting-enabled companies');
      expect(all(fixture, 'input[type="checkbox"]')).toHaveLength(0);
    });
  });
});
