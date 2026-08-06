import { ChangeDetectionStrategy, Component, ElementRef, EventEmitter, HostListener, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

/** One selectable row. `ID`/`Name` mirror the entity rows the pages already hold. */
export interface CheckDropdownOption {
  ID: string;
  Name: string;
}

/**
 * `mja-check-dropdown` — a CHECKBOX multi-select dropdown for list-page filters
 * (Marcelo 2026-08-05: the company filter is multi-select on every list tab, not select-one).
 *
 * Semantics are FILTER semantics, not form semantics: an EMPTY selection means "no narrowing"
 * (the trigger reads the `AllLabel`, e.g. "All companies"), never "nothing matches". That is why
 * this is not a form control / CVA — pages bind `[SelectedIDs]` + `(SelectedIDsChange)` and build
 * an `IN (…)` predicate when the list is non-empty.
 *
 * Chrome matches `mj-dropdown`'s trigger (an `.mj-input`-shaped box with a chevron) so a mixed
 * toolbar of single- and multi-selects reads as one family; the panel is a token-styled card of
 * native checkboxes (`.mj-checkbox`). Closes on outside click and Escape.
 */
@Component({
  standalone: true,
  selector: 'mja-check-dropdown',
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="mja-cd__trigger mj-input"
      [attr.aria-label]="AriaLabel || AllLabel"
      [attr.aria-expanded]="IsOpen"
      aria-haspopup="listbox"
      (click)="Toggle()">
      <span class="mja-cd__value" [class.mja-cd__value--all]="SelectedIDs.length === 0">{{ Summary }}</span>
      <i class="fa-solid fa-chevron-down mja-cd__arrow" aria-hidden="true"></i>
    </button>

    @if (IsOpen) {
      <div class="mja-cd__panel" role="listbox" aria-multiselectable="true" [attr.aria-label]="AriaLabel || AllLabel">
        <!-- "All" = clear-the-filter, deliberately a row (not a checkbox): it is the absence of a
             narrowing, not one more selectable value. -->
        <button type="button" class="mja-cd__all" [class.mja-cd__all--active]="SelectedIDs.length === 0" (click)="ClearAll()">
          {{ AllLabel }}
        </button>
        @for (opt of Options; track opt.ID) {
          <label class="mja-cd__opt" role="option" [attr.aria-selected]="IsChecked(opt.ID)">
            <input
              class="mj-checkbox"
              type="checkbox"
              [checked]="IsChecked(opt.ID)"
              (change)="ToggleOption(opt.ID)" />
            <span class="mja-cd__opt-label">{{ opt.Name }}</span>
          </label>
        }
      </div>
    }
  `,
  styles: [`
    :host {
      display: inline-block;
      position: relative;
    }

    /* Trigger — .mj-input supplies the box chrome; these lay the value + chevron out inside it. */
    .mja-cd__trigger {
      display: inline-flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      width: 100%;
      min-width: 150px;
      cursor: pointer;
      text-align: left;
      font-family: inherit;
    }

    .mja-cd__value {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* "All …" reads as the resting (unfiltered) state — muted like a placeholder, since no
       narrowing is applied. A real selection renders at full strength. */
    .mja-cd__value--all {
      color: var(--mj-text-muted);
    }

    .mja-cd__arrow {
      flex: none;
      font-size: 11px;
      color: var(--mj-text-muted);
    }

    .mja-cd__panel {
      position: absolute;
      top: calc(100% + 4px);
      left: 0;
      z-index: 60;
      min-width: 100%;
      max-height: 300px;
      overflow-y: auto;
      padding: 6px;
      background: var(--mj-bg-surface-elevated, var(--mj-bg-surface));
      border: 1px solid var(--mj-border-default);
      border-radius: 8px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.16);
    }

    .mja-cd__all {
      display: block;
      width: 100%;
      padding: 7px 9px;
      border: none;
      border-radius: 6px;
      background: transparent;
      color: var(--mj-text-secondary);
      font-family: inherit;
      font-size: 13px;
      text-align: left;
      cursor: pointer;
    }
    .mja-cd__all:hover {
      background: var(--mj-bg-surface-hover);
    }
    .mja-cd__all--active {
      color: var(--mj-brand-primary);
      font-weight: 600;
    }

    .mja-cd__opt {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 9px;
      border-radius: 6px;
      font-size: 13px;
      color: var(--mj-text-primary);
      cursor: pointer;
      white-space: nowrap;
    }
    .mja-cd__opt:hover {
      background: var(--mj-bg-surface-hover);
    }

    .mja-cd__opt-label {
      overflow: hidden;
      text-overflow: ellipsis;
    }
  `],
})
export class MJACheckDropdownComponent {
  private host = inject(ElementRef).nativeElement as HTMLElement;

  /** The selectable rows (e.g. the page's loaded companies). */
  @Input() Options: readonly CheckDropdownOption[] = [];

  /** Currently-checked IDs. EMPTY = no narrowing (the "All" state). */
  @Input() SelectedIDs: string[] = [];

  /** Trigger + clear-row label for the unfiltered state — "All companies". */
  @Input() AllLabel = 'All';

  /** Accessible name for the trigger + panel; falls back to AllLabel. */
  @Input() AriaLabel: string | null = null;

  @Output() SelectedIDsChange = new EventEmitter<string[]>();

  public IsOpen = false;

  public get Summary(): string {
    const n = this.SelectedIDs.length;
    if (n === 0) return this.AllLabel;
    if (n === 1) {
      const match = this.Options.find((o) => o.ID === this.SelectedIDs[0]);
      return match?.Name ?? '1 selected';
    }
    return `${n} selected`;
  }

  public Toggle(): void {
    this.IsOpen = !this.IsOpen;
  }

  public IsChecked(id: string): boolean {
    return this.SelectedIDs.includes(id);
  }

  public ToggleOption(id: string): void {
    const next = this.IsChecked(id) ? this.SelectedIDs.filter((x) => x !== id) : [...this.SelectedIDs, id];
    this.SelectedIDsChange.emit(next);
  }

  /** Clear = back to "All" (no narrowing). Panel stays open so multi-adjust flows aren't broken. */
  public ClearAll(): void {
    if (this.SelectedIDs.length) this.SelectedIDsChange.emit([]);
  }

  /** Outside click closes; clicks inside the host (trigger or panel) don't. */
  @HostListener('document:click', ['$event'])
  onDocClick(ev: MouseEvent): void {
    if (this.IsOpen && !this.host.contains(ev.target as Node)) this.IsOpen = false;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.IsOpen = false;
  }
}
