import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

/** A quick-filter chip. `Count` renders as a pill; omit — or pass 0 — for no pill. */
export interface MJAPresetChip {
    Key: string;
    Label: string;
    Count?: number | null;
    Icon?: string;
}

/**
 * `mja-list-toolbar` — the standard chrome above every accounting list grid: a search box,
 * a row of preset chips, and a trailing “Filters” button that discloses the complex filters.
 *
 * Mirrors the orders All-Orders idiom (`mjo-worklist-table`'s toolbar + `orders-kit.css`
 * `.mj-filter-chip` / `.mjo-search`, copied here byte-for-byte where possible so the two apps
 * read identically), with one deliberate addition: the trailing **Filters** disclosure. Orders'
 * pages get by on chips + search alone; accounting's lists legitimately need company / entry-type
 * / date-window narrowing, and burying those in a second always-visible control row is the
 * two-filter-systems mistake the orders header warns about. The disclosure keeps ONE system:
 * chips + search up front, everything else behind the one button — with a count pill on the
 * button so a hidden active filter can never silently shape the grid.
 *
 * The host owns ALL state. Chips emit toggles (multi- or single-select is the host's call),
 * search is controlled, and the advanced area is projected content (`<ng-content>`), so each
 * page keeps its own field markup and bindings.
 */
@Component({
    selector: 'mja-list-toolbar',
    standalone: true,
    imports: [CommonModule],
    template: `
        <div class="mja-lt" [class.mja-lt--bare]="Bare">
            <div class="mja-lt__row">
                @if (Searchable) {
                    <div class="mja-search">
                        <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
                        <input
                            type="search"
                            [value]="Search"
                            (input)="SearchChanged.emit($any($event.target).value)"
                            [placeholder]="SearchPlaceholder"
                            [attr.aria-label]="SearchLabel" />
                    </div>
                }

                @if (Presets.length) {
                    <div class="mja-lt__presets" role="group" aria-label="Quick filters">
                        @for (preset of Presets; track preset.Key) {
                            <button
                                type="button"
                                class="mj-filter-chip"
                                [class.is-active]="ActiveKeys.includes(preset.Key)"
                                [attr.aria-pressed]="ActiveKeys.includes(preset.Key)"
                                (click)="PresetToggled.emit(preset.Key)">
                                @if (preset.Icon) {
                                    <i [class]="preset.Icon" aria-hidden="true"></i>
                                }
                                {{ preset.Label }}
                                @if (preset.Count) {
                                    <span class="count">{{ preset.Count }}</span>
                                }
                            </button>
                        }
                    </div>
                }

                @if (HasAdvanced) {
                    <button
                        type="button"
                        class="mj-filter-chip mja-lt__more"
                        [class.is-active]="AdvancedOpen || AdvancedCount > 0"
                        [attr.aria-expanded]="AdvancedOpen"
                        (click)="ToggleAdvanced()">
                        <i class="fa-solid fa-sliders" aria-hidden="true"></i>
                        Filters
                        @if (AdvancedCount > 0) {
                            <span class="count">{{ AdvancedCount }}</span>
                        }
                        <i
                            class="fa-solid"
                            [class.fa-chevron-down]="!AdvancedOpen"
                            [class.fa-chevron-up]="AdvancedOpen"
                            aria-hidden="true"></i>
                    </button>
                }

                <!-- Page-local verbs that belong ON the toolbar row (e.g. an inline "New account"
                     that has no workspace to route to). Projected so the toolbar stays generic. -->
                <ng-content select="[toolbar-actions]"></ng-content>
            </div>

            <!-- Projected advanced filters. Hidden with CSS rather than @if so the host's
                 [(ngModel)] bindings and field state survive close/open untouched. -->
            <div class="mja-lt__advanced" [hidden]="!AdvancedOpen">
                <ng-content></ng-content>
            </div>
        </div>
    `,
    styles: [
        `
            .mja-lt {
                background: var(--mj-bg-surface);
                border: 1px solid var(--mj-border-default);
                border-radius: var(--mj-radius-lg);
                padding: var(--mj-space-3) var(--mj-space-4);
                margin-bottom: var(--mj-space-4);
            }
            .mja-lt--bare {
                background: none;
                border: none;
                border-radius: 0;
                margin-bottom: 0;
            }
            .mja-lt__row {
                display: flex;
                align-items: center;
                gap: var(--mj-space-3);
                flex-wrap: wrap;
            }
            .mja-lt__presets {
                display: flex;
                flex-wrap: wrap;
                gap: 6px;
            }
            .mja-lt__more {
                margin-left: auto;
            }
            .mja-lt__advanced:not([hidden]) {
                display: flex;
                flex-wrap: wrap;
                gap: var(--mj-space-3) var(--mj-space-4);
                align-items: flex-end;
                margin-top: var(--mj-space-3);
                padding-top: var(--mj-space-3);
                border-top: 1px solid var(--mj-border-default);
            }

            /* .mj-filter-chip + .mja-search — verbatim from orders-kit.css so the idiom is
               pixel-identical across the two apps (rename aside). */
            .mj-filter-chip {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                padding: 5px 11px;
                border-radius: var(--mj-radius-full);
                border: 1px solid var(--mj-border-default);
                background: var(--mj-bg-surface);
                font-family: inherit;
                font-size: 12.5px;
                font-weight: var(--mj-font-medium);
                color: var(--mj-text-secondary);
                cursor: pointer;
                white-space: nowrap;
            }
            .mj-filter-chip:hover {
                background: var(--mj-bg-surface-hover);
                color: var(--mj-text-primary);
            }
            .mj-filter-chip .count {
                font-variant-numeric: tabular-nums;
                font-size: 11px;
                background: var(--mj-bg-surface-sunken);
                border-radius: var(--mj-radius-full);
                padding: 0 6px;
            }
            .mj-filter-chip.is-active {
                background: color-mix(in srgb, var(--mj-brand-primary) 12%, transparent);
                border-color: color-mix(in srgb, var(--mj-brand-primary) 45%, transparent);
                color: var(--mj-brand-primary);
                font-weight: var(--mj-font-semibold);
            }
            .mj-filter-chip.is-active .count {
                background: color-mix(in srgb, var(--mj-brand-primary) 18%, transparent);
            }
            .mja-search {
                display: flex;
                align-items: center;
                gap: var(--mj-space-2);
                background: var(--mj-bg-surface);
                border: 1px solid var(--mj-border-strong);
                border-radius: var(--mj-radius-md);
                padding: 6px 10px;
                min-width: 260px;
            }
            .mja-search i {
                color: var(--mj-text-muted);
                font-size: 12px;
            }
            .mja-search input {
                border: none;
                outline: none;
                background: none;
                font-family: inherit;
                font-size: 13px;
                color: inherit;
                width: 100%;
            }

            @media (max-width: 760px) {
                .mja-search {
                    min-width: 0;
                    flex: 1 1 100%;
                }
                .mja-lt__more {
                    margin-left: 0;
                }
            }
        `,
    ],
})
export class MJAListToolbarComponent {
    /** Preset chips, in reading order. */
    @Input() Presets: MJAPresetChip[] = [];

    /** Keys of the currently-active chips — multi- vs single-select is the host's policy. */
    @Input() ActiveKeys: string[] = [];

    /** Show the search box. */
    @Input() Searchable = true;

    /** Current search text — controlled by the host. */
    @Input() Search = '';

    @Input() SearchPlaceholder = 'Search…';
    /**
     * The search input's ACCESSIBLE NAME (aria-label) — distinct from the placeholder on purpose.
     * A placeholder is hint copy, not a name; screen readers and role-based test locators need a
     * stable, purpose-describing label. Pages should pass "Search <things>".
     */
    @Input() SearchLabel = 'Search';

    /** Render the trailing Filters disclosure button. */
    @Input() HasAdvanced = false;

    /** Bare mode: no card chrome — for composing into the fused list subheader (see summary strip). */
    @Input() Bare = false;

    /** How many advanced filters are ACTIVE — the pill that keeps hidden filters honest. */
    @Input() AdvancedCount = 0;

    /** Whether the advanced area is open. Host-bindable, two-way. */
    @Input() AdvancedOpen = false;
    @Output() AdvancedOpenChange = new EventEmitter<boolean>();

    @Output() PresetToggled = new EventEmitter<string>();
    @Output() SearchChanged = new EventEmitter<string>();

    protected ToggleAdvanced(): void {
        this.AdvancedOpen = !this.AdvancedOpen;
        this.AdvancedOpenChange.emit(this.AdvancedOpen);
    }
}
