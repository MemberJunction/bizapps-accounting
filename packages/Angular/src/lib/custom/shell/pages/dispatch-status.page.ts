import { Component, ChangeDetectionStrategy, ChangeDetectorRef, inject, OnInit } from '@angular/core';
import { GraphQLDataProvider } from '@memberjunction/graphql-dataprovider';
import { BaseAngularComponent } from '@memberjunction/ng-base-types';
import { MJStatBadgeVariant } from '@memberjunction/ng-ui-components';
import { ReadModelsClient, type BatchDispatchStatusRow } from '../../shared/read-models.client';
import { BatchDispatchClient } from '../../BatchDispatch/batch-dispatch.client';

/**
 * Dispatch status (UI plan §8.2) — the ERP-facing view of every batch: did it land, and if not, why.
 *
 * Reads `vw_BatchDispatchStatus` through the existing read-model client (already built + tier-2/3
 * tested — no new server surface). The one verb is **Retry dispatch** on a Failed batch, which calls
 * the same `DispatchJEBatch` the Batch approvals screen uses (approval gate included: a batch that
 * was never approved still cannot be dispatched from here).
 *
 * Refetches on completion + one header refresh control; no polling (§8 refresh policy).
 */
@Component({
  standalone: false,
  selector: 'mj-dispatch-status-page',
  templateUrl: './dispatch-status.page.html',
  styleUrls: ['./dispatch-status.page.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DispatchStatusPageComponent extends BaseAngularComponent implements OnInit {
  private cdr = inject(ChangeDetectorRef);

  public Rows: BatchDispatchStatusRow[] = [];
  public IsLoading = false;
  public LoadError: string | null = null;
  public RetryingBatchID: string | null = null;
  public ActionMessage: string | null = null;
  public ActionIsError = false;

  /** The dispatch-relevant slice of the batch lifecycle. */
  public StatusFilter: 'All' | 'Failed' | 'Sent' | 'Posted' = 'All';

  ngOnInit(): void {
    void this.load();
  }

  public get Filtered(): BatchDispatchStatusRow[] {
    if (this.StatusFilter === 'All') return this.Rows;
    return this.Rows.filter((r) => r.Status === this.StatusFilter);
  }

  public get FailedCount(): number {
    return this.Rows.filter((r) => r.Status === 'Failed').length;
  }

  public StatusVariant(status: string): MJStatBadgeVariant {
    switch (status) {
      case 'Posted':
        return 'success';
      case 'Failed':
        return 'error';
      case 'Sent':
        return 'info';
      default:
        return 'default';
    }
  }

  /** Only a Failed dispatch is retryable — a Posted batch is settled, a Pending one never left. */
  public CanRetry(row: BatchDispatchStatusRow): boolean {
    return row.Status === 'Failed' && this.RetryingBatchID !== row.BatchID;
  }

  public RetryBlockedReason(row: BatchDispatchStatusRow): string | null {
    if (row.Status === 'Failed') return null;
    if (row.Status === 'Posted') return 'This batch already posted to the ERP.';
    if (row.Status === 'Sent') return 'This batch is in flight.';
    return `A ${row.Status} batch has not been dispatched — approve and dispatch it from Batch approvals.`;
  }

  public async Retry(row: BatchDispatchStatusRow): Promise<void> {
    if (!this.CanRetry(row)) return;
    this.RetryingBatchID = row.BatchID;
    this.ActionMessage = null;
    this.cdr.markForCheck();
    try {
      const client = new BatchDispatchClient(this.ProviderToUse as GraphQLDataProvider);
      const res = await client.DispatchBatch(row.BatchID);
      if (res.Success) {
        this.ActionMessage = `Re-dispatched ${row.BatchNumber}${res.ExternalBatchRef ? ` — ERP ref ${res.ExternalBatchRef}` : ''}.`;
        this.ActionIsError = false;
        await this.load(); // refetch-on-mutating-action
      } else {
        this.setError(res.ErrorMessage ?? 'Dispatch failed.');
      }
    } catch (e) {
      this.setError(e instanceof Error ? e.message : String(e));
    } finally {
      this.RetryingBatchID = null;
      this.cdr.markForCheck();
    }
  }

  public Refresh(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    this.IsLoading = true;
    this.LoadError = null;
    this.cdr.markForCheck();
    try {
      // The read model is company-scoped by contract; '' means every company the user can see.
      // Batches are MULTI-company (CH-4), so this screen is deliberately unscoped — filtering it by
      // the app scope chip would hide a batch that merely TOUCHES another company.
      this.Rows = await new ReadModelsClient(this.ProviderToUse as GraphQLDataProvider).BatchDispatchStatus('');
    } catch (e) {
      this.LoadError = e instanceof Error ? e.message : String(e);
      this.Rows = [];
    } finally {
      this.IsLoading = false;
      this.cdr.markForCheck();
    }
  }

  private setError(message: string): void {
    this.ActionMessage = message;
    this.ActionIsError = true;
    this.cdr.markForCheck();
  }
}
