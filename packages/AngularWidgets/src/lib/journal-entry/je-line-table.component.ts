import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { RecordOpenRequestedEventArgs } from './je-events';
import { sumCredits, sumDebits, type JELineView } from './je-view-models';

const GL_ACCOUNT_ENTITY = 'MJ_BizApps_Accounting: GL Accounts';

/**
 * `<mjacc-je-line-table>` — a journal entry's lines, with dimension tags and Dr/Cr totals.
 *
 * **Layer 1.** Takes lines, renders lines. It does not know which entry they belong to, does
 * not read them, and does not navigate — clicking an account emits
 * {@link RecordOpenRequestedEventArgs} and the host decides what that means.
 *
 * ## Why this component exists
 *
 * Before the layering work, this table was written twice: once read-only in the Explorer
 * Journal Entry form and once in the journal-entry slide-in panel. The two copies drifted, and
 * one of them shipped a totals row whose `colspan` was off by one, so the Dr total rendered
 * under the **Cr** heading and the Cr total under **Dimensions**. That is the ordinary cost of
 * a duplicate: not a dramatic failure, just a number quietly sitting in the wrong column in
 * one of the two places an accountant might look at it.
 *
 * ## Example
 * ```html
 * <mjacc-je-line-table
 *   [Lines]="lines"
 *   [ShowDimensions]="true"
 *   (RecordOpenRequested)="openRecord($event)" />
 * ```
 */
@Component({
  selector: 'mjacc-je-line-table',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <table class="jelt">
      <thead>
        <tr>
          <th class="jelt__num" scope="col">#</th>
          <th scope="col">Account</th>
          <th scope="col">Description</th>
          <th class="jelt__amt" scope="col">Debit</th>
          <th class="jelt__amt" scope="col">Credit</th>
          @if (ShowDimensions) {
            <th scope="col">Dimensions</th>
          }
        </tr>
      </thead>
      <tbody>
        @for (line of Lines; track line.ID) {
          <tr>
            <td class="jelt__num">{{ line.LineNumber }}</td>
            <td>
              @if (line.GLAccountID) {
                <button type="button" class="jelt__link" (click)="onAccountClick(line)">
                  <span class="jelt__code">{{ line.AccountCode }}</span>
                  <span class="jelt__name">{{ line.AccountName }}</span>
                </button>
              } @else {
                <span class="jelt__code">{{ line.AccountCode }}</span>
                <span class="jelt__name">{{ line.AccountName }}</span>
              }
            </td>
            <td class="jelt__desc">{{ line.Description }}</td>
            <td class="jelt__amt">{{ line.Debit ? (line.Debit | number: '1.2-2') : '' }}</td>
            <td class="jelt__amt">{{ line.Credit ? (line.Credit | number: '1.2-2') : '' }}</td>
            @if (ShowDimensions) {
              <td>
                <div class="jelt__chips">
                  @for (dim of line.Dimensions; track dim.Dimension + dim.DimensionValue) {
                    <span class="jelt__chip">
                      <span class="jelt__chip-key">{{ dim.Dimension }}</span>
                      <span class="jelt__chip-val">{{ dim.DimensionValue }}</span>
                    </span>
                  }
                </div>
              </td>
            }
          </tr>
        }
      </tbody>
      <tfoot>
        <!--
          colspan 3 covers #, Account and Description, so the totals land under the Debit and
          Credit headings. This is the alignment the duplicate got wrong; the test in
          __tests__/je-line-table.test.ts pins it.
        -->
        <tr>
          <td colspan="3" class="jelt__total-label">Totals</td>
          <td class="jelt__amt jelt__total">{{ TotalDebits | number: '1.2-2' }}</td>
          <td class="jelt__amt jelt__total">{{ TotalCredits | number: '1.2-2' }}</td>
          @if (ShowDimensions) {
            <td></td>
          }
        </tr>
        @if (!IsBalanced) {
          <tr>
            <td [attr.colspan]="ColumnCount" class="jelt__unbalanced" role="alert">
              <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
              Debits and credits do not match.
            </td>
          </tr>
        }
      </tfoot>
    </table>
  `,
  styleUrls: ['./je-line-table.component.css'],
})
export class JELineTableComponent {
  /** The lines to render, in the order they should appear. */
  @Input() Lines: JELineView[] = [];

  /** Show the dimension-tag column. Off for surfaces with no dimensions configured. */
  @Input() ShowDimensions = true;

  /**
   * Whether Dr equals Cr. Supplied by the host rather than computed here, because the cent
   * tolerance is a domain rule that lives in the L0 package (`isBalanced`) and must have
   * exactly one definition. A widget that re-derived it would be a second one.
   */
  @Input() IsBalanced = true;

  /** The operator clicked an account. The host decides how to open it. */
  @Output() RecordOpenRequested = new EventEmitter<RecordOpenRequestedEventArgs>();

  public get TotalDebits(): number {
    return sumDebits(this.Lines);
  }

  public get TotalCredits(): number {
    return sumCredits(this.Lines);
  }

  /** Column count, so the full-width alert row spans correctly with or without dimensions. */
  public get ColumnCount(): number {
    return this.ShowDimensions ? 6 : 5;
  }

  protected onAccountClick(line: JELineView): void {
    if (!line.GLAccountID) return;
    this.RecordOpenRequested.emit(
      new RecordOpenRequestedEventArgs(
        GL_ACCOUNT_ENTITY,
        line.GLAccountID,
        `${line.AccountCode} ${line.AccountName}`.trim(),
        'dialog',
      ),
    );
  }
}
