/**
 * Separation-of-duties guard on the JE-batch approval gate.
 *
 * The 2026-09-05 sweep made `recordDecision` require the caller to be the company's configured
 * `AccountingCompanyProfile.ApprovalCFOUserID`. That still lets a CFO who builds a batch approve
 * their own batch, so the gate additionally refuses the batch's `BatchedByUserID`. Isolated unit
 * test, no DB — the provider is a stub that answers only the two entity loads the guard reaches.
 */
import { describe, it, expect } from 'vitest';
import type { IMetadataProvider, UserInfo } from '@memberjunction/core';
import { TasksAppApprovalGate } from '../TasksAppApprovalGate.js';

const BATCH_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Batches';
const ACP_ENTITY = 'MJ_BizApps_Accounting: Accounting Company Profiles';

const CFO_USER_ID = '48d60bcc-044b-4cc2-9675-0d3b57bcdcba';
const OTHER_USER_ID = '684c06d4-55da-49d7-8453-e046fc82b895';
const COMPANY_ID = '411df6dc-3652-4151-836f-cda2e46a5038';
const BATCH_ID = 'e9521aa3-f4ef-4ec5-a899-d9dd59f320b7';
const BATCH_ENTITY_ID = '87ad37e9-62f9-4f0e-a15b-f64adf009112';

const cfo = { ID: CFO_USER_ID } as UserInfo;

/** A provider that serves one batch (built by `batchedByUserId`) for a company whose CFO is CFO_USER_ID. */
function stubProvider(batchedByUserId: string): IMetadataProvider {
  return {
    GetEntityObject: async (entityName: string) => {
      if (entityName === BATCH_ENTITY) {
        return {
          Load: async () => true,
          ID: BATCH_ID,
          CompanyID: COMPANY_ID,
          JournalEntryBatchNumber: 'BATCH-0007',
          BatchedByUserID: batchedByUserId,
        };
      }
      if (entityName === ACP_ENTITY) {
        return { Load: async () => true, ApprovalCFOUserID: CFO_USER_ID };
      }
      throw new Error(`stubProvider: unexpected entity '${entityName}'`);
    },
    EntityByName: (entityName: string) => (entityName === BATCH_ENTITY ? { ID: BATCH_ENTITY_ID } : undefined),
    // Reached only once the guards pass; no Task Link exists, so recordDecision fails further down.
    RunView: async () => ({ Success: true, Results: [] }),
  } as unknown as IMetadataProvider;
}

describe('TasksAppApprovalGate.recordDecision — separation of duties', () => {
  it('refuses a decision from the user who built the batch, even when that user is the configured CFO', async () => {
    const gate = new TasksAppApprovalGate(stubProvider(CFO_USER_ID));
    await expect(gate.recordDecision(BATCH_ID, 'Approved', undefined, undefined, cfo)).rejects.toThrow(
      /the user who built a batch may not approve it/,
    );
  });

  it('lets the configured CFO decide on a batch someone else built', async () => {
    const gate = new TasksAppApprovalGate(stubProvider(OTHER_USER_ID));
    // Past both guards; the stub has no linked Task, which is where it stops.
    await expect(gate.recordDecision(BATCH_ID, 'Approved', undefined, undefined, cfo)).rejects.toThrow(
      /has no approval Task to record a decision against/,
    );
  });
});
