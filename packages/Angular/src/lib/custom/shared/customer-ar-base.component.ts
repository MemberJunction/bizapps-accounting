import { Component, ChangeDetectionStrategy, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MJStatBadgeComponent } from '@memberjunction/ng-ui-components';

/** One customer's A/R position — the shape both read models collapse into. */
export interface CustomerARView {
  CustomerOrganizationID: string | null;
  CustomerName: string;
  OpenBalance: number;
  TotalCharges: number;
  TotalPayments: number;
  /** Aging buckets, oldest money last. */
  Current_0_30: number;
  Days_31_60: number;
  Days_61_90: number;
  Days_Over_90: number;
  TotalOpen: number;
}

/**
 * Customer A/R — the READ-ONLY base view (§0 shared-component placement ruling, 2026-07-15).
 *
 * Accounting-homed and deliberately verb-free: A/R *is* accounting's subsidiary ledger, so the
 * numbers are defined here, once. Orders imports this and wraps it with ITS verbs (record payment,
 * open order, dunning note) — §13.4. That direction (common → accounting → orders) is why the money
 * cannot drift between the two apps: there is one component computing nothing and rendering what
 * accounting's read models say.
 *
 * Presentation only: no engine, no data access, no round-trip. The host supplies the resolved view.
 *
 * The aging strip is DRIFT-PROOF by construction: the buckets it renders come straight from
 * `vw_ARAging`, and `TotalOpen` is asserted against their sum rather than recomputed — if a bucket
 * and the total ever disagree, that is a read-model bug and this says so instead of hiding it behind
 * a locally-summed number that always looks consistent.
 */
@Component({
  standalone: true,
  selector: 'mj-customer-ar-base',
  imports: [CommonModule, MJStatBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './customer-ar-base.component.html',
  styleUrls: ['./customer-ar-base.component.css'],
})
export class CustomerARBaseComponent {
  @Input() View: CustomerARView | null = null;

  /** The aging buckets, in order, for the strip. */
  public get Buckets(): Array<{ Label: string; Amount: number; Overdue: boolean }> {
    const v = this.View;
    if (!v) return [];
    return [
      { Label: 'Current (0–30)', Amount: v.Current_0_30, Overdue: false },
      { Label: '31–60', Amount: v.Days_31_60, Overdue: true },
      { Label: '61–90', Amount: v.Days_61_90, Overdue: true },
      { Label: 'Over 90', Amount: v.Days_Over_90, Overdue: true },
    ];
  }

  /**
   * Do the buckets foot to TotalOpen?
   *
   * Asserted, not assumed: a silent mismatch between the buckets and the total is the kind of thing
   * an accountant would (rightly) never forgive, and it is invisible if the UI just sums the
   * buckets itself. Cent tolerance — never `===` on money.
   */
  public get BucketsFoot(): boolean {
    const v = this.View;
    if (!v) return true;
    const sum = v.Current_0_30 + v.Days_31_60 + v.Days_61_90 + v.Days_Over_90;
    return Math.abs(sum - v.TotalOpen) < 0.005;
  }

  public get BucketSum(): number {
    const v = this.View;
    if (!v) return 0;
    return v.Current_0_30 + v.Days_31_60 + v.Days_61_90 + v.Days_Over_90;
  }

  /** Money past 30 days — the number a dunning conversation starts from. */
  public get PastDue(): number {
    const v = this.View;
    if (!v) return 0;
    return v.Days_31_60 + v.Days_61_90 + v.Days_Over_90;
  }
}
