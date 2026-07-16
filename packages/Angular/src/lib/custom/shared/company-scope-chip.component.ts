import { Component, ChangeDetectionStrategy, ChangeDetectorRef, ElementRef, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CompanyScopeService, ScopeCompany } from './company-scope.service';

/**
 * The rail-top company scope chip (UI plan §8.0; approved mockup round 2).
 *
 * App-wide company scope, persisted per user. Projected into the nav rail's `railScopeChip` slot —
 * the rail stays app-agnostic, this chip owns the accounting binding.
 *
 * Interim home: the rail. It relocates to the Explorer header if the upstream header-widget-slot ask
 * lands (plans/QUESTIONS.md#q26) — which is exactly why it is a self-contained component and not
 * inlined into the rail.
 */
@Component({
  standalone: true,
  selector: 'mj-company-scope-chip',
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="scope-chip">
      <button
        type="button"
        class="scope-chip__btn"
        (click)="ToggleMenu()"
        [attr.aria-expanded]="MenuOpen"
        aria-haspopup="true"
        title="App-wide company scope (persisted per user)">
        <i class="fa-solid fa-building" aria-hidden="true"></i>
        <span class="scope-chip__label">Scope: <b>{{ Scope.Label }}</b></span>
        <i class="fa-solid fa-chevron-down scope-chip__caret" aria-hidden="true"></i>
      </button>

      @if (MenuOpen) {
        <div class="scope-chip__menu" role="dialog" aria-label="Select company scope">
          <button type="button" class="scope-chip__all" [class.scope-chip__all--on]="Scope.IsAllCompanies" (click)="SelectAll()">
            @if (Scope.IsAllCompanies) {
              <i class="fa-solid fa-check" aria-hidden="true"></i>
            }
            <span>All companies</span>
          </button>
          <div class="scope-chip__sep"></div>
          @for (c of Companies; track c.ID) {
            <label class="scope-chip__item">
              <input type="checkbox" class="mj-checkbox" [checked]="IsSelected(c)" (change)="Toggle(c)" />
              <span class="scope-chip__name">{{ c.Name }}</span>
              <span class="scope-chip__code">{{ c.CompanyCode }}</span>
            </label>
          }
          @if (Companies.length === 0) {
            <div class="scope-chip__empty">No accounting-enabled companies</div>
          }
        </div>
      }
    </div>
  `,
  styleUrls: ['./company-scope-chip.component.css'],
})
export class CompanyScopeChipComponent {
  public Scope = inject(CompanyScopeService);
  private cdr = inject(ChangeDetectorRef);
  private host = inject(ElementRef<HTMLElement>);

  public MenuOpen = false;

  public get Companies(): ScopeCompany[] {
    return this.Scope.Companies;
  }

  public ToggleMenu(): void {
    this.MenuOpen = !this.MenuOpen;
    this.cdr.markForCheck();
  }

  public IsSelected(c: ScopeCompany): boolean {
    return this.Scope.SelectedIDs.includes(c.ID);
  }

  public Toggle(c: ScopeCompany): void {
    this.Scope.Toggle(c.ID);
    this.cdr.markForCheck();
  }

  public SelectAll(): void {
    this.Scope.SelectAll();
    this.cdr.markForCheck();
  }

  /** Click-away closes the menu — a scope popover pinned open over the rail is just in the way. */
  @HostListener('document:click', ['$event'])
  public OnDocumentClick(event: MouseEvent): void {
    if (!this.MenuOpen) return;
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.MenuOpen = false;
      this.cdr.markForCheck();
    }
  }

  @HostListener('document:keydown.escape')
  public OnEscape(): void {
    if (!this.MenuOpen) return;
    this.MenuOpen = false;
    this.cdr.markForCheck();
  }
}
