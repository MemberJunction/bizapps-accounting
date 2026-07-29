import { Component, ChangeDetectionStrategy, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/** One resolved step in the fallback chain, e.g. "Category: Software → 4000 Revenue". */
export interface GlResolutionStep {
  /** What was tried, e.g. "Product: Widget" / "Category: Software" / "Company default". */
  Scope: string;
  /** The GL account it resolved to, or null when this step had no link. */
  AccountCode: string | null;
  AccountName: string | null;
  /** True for the step that WON — the account actually used. */
  Won: boolean;
  /** Dimensions the winning link requires, in Sequence order. */
  Dimensions?: string[];
}

export interface GlResolutionResult {
  Role: string;
  Steps: GlResolutionStep[];
  /** Null when nothing in the chain resolved — the case the Confirm-failure deep link lands on. */
  ResolvedCode: string | null;
  ResolvedName: string | null;
}

/**
 * GL-resolution preview — "Product X resolves: Revenue → 4000 via category Software".
 *
 * An accounting-DOMAIN shared component (component inventory: permanently accounting-homed, NOT a
 * transfer-pending candidate). Consumers: this app's Account links screen, and orders' product panel
 * + Confirm-failure UX — which is why it takes a plain result object rather than reaching for the
 * engine itself. Orders resolves with its OWN fallback chain (product → category → company default;
 * that chain is Orders' code, per ResolveLinkedAccount's contract), then hands the outcome here to
 * render. Presentation only: no engine import, no data access.
 *
 * The point is the CHAIN, not just the answer: an accountant asking "why is this booking to 4000?"
 * needs to see which link won and what was skipped.
 */
@Component({
  standalone: true,
  selector: 'mj-gl-resolution-preview',
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (Result) {
      <div class="glr" [class.glr--unresolved]="!Result.ResolvedCode">
        <p class="glr__headline">
          <i class="fa-solid fa-diagram-project" aria-hidden="true"></i>
          <span class="glr__role">{{ Result.Role }}</span>
          @if (Result.ResolvedCode) {
            resolves to <b class="glr__mono">{{ Result.ResolvedCode }}</b> {{ Result.ResolvedName }}
          } @else {
            <b class="glr__none">does not resolve — no link in the chain matches</b>
          }
        </p>

        <ol class="glr__chain">
          @for (s of Result.Steps; track s.Scope) {
            <li class="glr__step" [class.glr__step--won]="s.Won" [class.glr__step--miss]="!s.AccountCode">
              <span class="glr__scope">{{ s.Scope }}</span>
              @if (s.AccountCode) {
                <span class="glr__mono">{{ s.AccountCode }}</span> {{ s.AccountName }}
                @if (s.Won) {
                  <span class="glr__badge">used</span>
                } @else {
                  <span class="glr__skipped">overridden by a more specific link</span>
                }
              } @else {
                <span class="glr__skipped">no link</span>
              }
              @if (s.Won && s.Dimensions?.length) {
                <span class="glr__dims">requires: {{ s.Dimensions!.join(', ') }}</span>
              }
            </li>
          }
        </ol>
      </div>
    }
  `,
  styleUrls: ['./gl-resolution-preview.component.css'],
})
export class GlResolutionPreviewComponent {
  @Input() Result: GlResolutionResult | null = null;
}
