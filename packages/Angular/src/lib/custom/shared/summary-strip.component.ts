import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/** One figure in a summary strip. */
export interface MJASummaryFigure {
    /** Small uppercase caption. */
    Label: string;
    /** Already formatted — the strip does not know whether this is money, a count or a date. */
    Value: string;
    /**
     * Tone for the value. `credit` renders in the credit colour — a credit is money owed the
     * other way, and showing it in the same ink as a debt misreports the direction. `status`
     * tones map to the chip palette so a status figure reads like its grid chips.
     */
    Tone?: 'default' | 'credit' | 'muted' | 'success' | 'warning' | 'danger' | 'info';
}

/**
 * `mja-summary-strip` — a row of totals above a worklist, in its own bubble.
 *
 * The accounting twin of orders' `mjo-summary-strip` (bizapps-orders
 * `panels/summary-strip.component.ts`) — same layout, same tokens, so the two apps' list
 * pages read identically. Kept app-local because accounting cannot depend on orders
 * (dependencies point UP the graph); when the four-layer standard (MJ#3403 / PR #37) lands a
 * shared home for these, both copies should graduate there.
 *
 * WHY A STRIP RATHER THAN STAT TILES: tiles are for numbers a person navigates BY; the strip
 * describes what is currently on screen — the figures move with the filters, exactly like the
 * grid, and the host is expected to keep that true.
 *
 * Figures arrive already formatted. This component owns layout and tone, not arithmetic.
 */
@Component({
    selector: 'mja-summary-strip',
    standalone: true,
    imports: [CommonModule],
    template: `
        <div class="mja-strip" [class.mja-strip--bare]="Bare">
            @for (figure of Figures; track figure.Label) {
                <div class="mja-strip__figure">
                    <div class="mja-strip__label">{{ figure.Label }}</div>
                    <div
                        class="mja-strip__value"
                        [class.tone-credit]="figure.Tone === 'credit'"
                        [class.tone-muted]="figure.Tone === 'muted'"
                        [class.tone-success]="figure.Tone === 'success'"
                        [class.tone-warning]="figure.Tone === 'warning'"
                        [class.tone-danger]="figure.Tone === 'danger'"
                        [class.tone-info]="figure.Tone === 'info'">
                        {{ figure.Value }}
                    </div>
                </div>
            }

            @if (Note) {
                <div class="mja-strip__note">{{ Note }}</div>
            }
        </div>
    `,
    styles: [
        `
            .mja-strip {
                display: flex;
                gap: var(--mj-space-6);
                flex-wrap: wrap;
                padding: var(--mj-space-3) var(--mj-space-4);
                margin-bottom: var(--mj-space-4);
                background: var(--mj-bg-surface);
                border: 1px solid var(--mj-border-default);
                border-radius: var(--mj-radius-lg);
            }
            .mja-strip__figure {
                /* Uniform figure width (Marcelo 2026-08-04): every bubble the same size, so the
                   strip reads as a row of equal cells rather than a ragged line, and figures line
                   up column-for-column across the app's list pages. */
                flex: 0 0 auto;
                width: 120px;
            }
            .mja-strip__label {
                font-size: 10px;
                font-weight: var(--mj-font-bold);
                letter-spacing: 0.06em;
                text-transform: uppercase;
                color: var(--mj-text-muted);
            }
            .mja-strip__value {
                font-size: 16px;
                font-weight: var(--mj-font-bold);
                font-variant-numeric: tabular-nums;
            }
            .tone-credit {
                color: var(--mj-color-success, #1a7f37);
            }
            .tone-muted {
                color: var(--mj-text-muted);
            }
            .tone-success {
                color: var(--mj-color-success, #1a7f37);
            }
            .tone-warning {
                color: var(--mj-color-warning, #9a6700);
            }
            .tone-danger {
                color: var(--mj-color-danger, #cf222e);
            }
            .tone-info {
                color: var(--mj-color-info, #0969da);
            }
            .mja-strip__note {
                margin-left: auto;
                align-self: center;
                max-width: 42ch;
                font-size: 12px;
                color: var(--mj-text-muted);
            }

            .mja-strip--bare {
                background: none;
                border: none;
                border-radius: 0;
                margin-bottom: 0;
            }

            @media (max-width: 760px) {
                .mja-strip {
                    gap: var(--mj-space-4);
                }
                .mja-strip__note {
                    margin-left: 0;
                }
            }
        `,
    ],
})
export class MJASummaryStripComponent {
    /** The figures, in reading order. */
    @Input() Figures: MJASummaryFigure[] = [];

    /** Optional trailing note, right-aligned — where the strip's caveat belongs. */
    @Input() Note: string | null = null;

    /**
     * Bare mode: no card chrome (background/border/radius/margin) — for composing the strip INTO a
     * host card, e.g. the list subheader that fuses stats + toolbar into one band (Marcelo
     * 2026-08-04: "consolidate the cards at the top into one").
     */
    @Input() Bare = false;
}
