/**
 * MaterializeScheduledEntriesOperation — invoke the DATE-driven materializer (B3.2, MOD-11).
 *
 * `Accounting.MaterializeDueScheduledEntries` — the invokable seam for BOTH the daily MJ Scheduled
 * Action (automatic, the primary path) AND the manual admin "materialize due through <date>"
 * override (B-Q3, Admin-visible). Code-only Remote Operation; in-process + over GraphQL. Idempotent.
 *
 * CONNECTS TO:
 *   SERVICE: ./MaterializationService (materializeDueScheduledEntries)
 */
import { BaseRemotableOperation, IMetadataProvider, UserInfo } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import { materializeDueScheduledEntries, type MaterializeResult } from './MaterializationService.js';

export interface MaterializeScheduledEntriesInput {
  /** ISO date/datetime; materialize everything due on/before it. Defaults to now (the daily-job case). */
  AsOf?: string;
}

@RegisterClass(BaseRemotableOperation, 'Accounting.MaterializeDueScheduledEntries')
export class MaterializeScheduledEntriesOperation extends BaseRemotableOperation<MaterializeScheduledEntriesInput, MaterializeResult> {
  public readonly OperationKey = 'Accounting.MaterializeDueScheduledEntries';

  protected async InternalExecute(
    input: MaterializeScheduledEntriesInput,
    provider: IMetadataProvider,
    user: UserInfo,
  ): Promise<MaterializeResult> {
    const asOf = input?.AsOf ? new Date(input.AsOf) : new Date();
    return materializeDueScheduledEntries(asOf, user, provider);
  }
}

/** Tree-shaking anchor — called from the server bootstrap so `@RegisterClass` is retained. */
export function LoadMaterializeScheduledEntriesOperation(): void {
  // intentionally empty
}
