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

// ─── cancel past approval (#183) ─────────────────────────────────────────────

const APPROVER_USER_ID = 'f0c1a2b3-0000-4000-8000-00000000a11c';
const TASK_ID = '7a5c0d1e-0000-4000-8000-0000000074a5';
const PERSON_ID = '5e2b9c4d-0000-4000-8000-000000009e25';

interface CancelWorld { comments: Array<{ TaskID: string; PersonID: string; Content: string }> }

/** A provider serving an Approved batch approved by APPROVER_USER_ID, its approval Task, and (optionally) the caller's Person. */
function cancelProvider(opts: { cfoUserId: string | null; hasTask: boolean; hasPerson: boolean }, world: CancelWorld): IMetadataProvider {
  return {
    GetEntityObject: async (entityName: string) => {
      if (entityName === BATCH_ENTITY) {
        return { Load: async () => true, ID: BATCH_ID, CompanyID: COMPANY_ID, JournalEntryBatchNumber: 'BATCH-0007', Status: 'Failed', ApprovedByUserID: APPROVER_USER_ID };
      }
      if (entityName === ACP_ENTITY) return { Load: async () => true, ApprovalCFOUserID: opts.cfoUserId };
      if (entityName === 'MJ_BizApps_Tasks: Tasks') return { Load: async () => true, ID: TASK_ID };
      if (entityName === 'MJ_BizApps_Tasks: Task Comments') {
        const c = { TaskID: '', PersonID: '', Content: '', LatestResult: null, NewRecord: () => undefined, Save: async () => { world.comments.push({ TaskID: c.TaskID, PersonID: c.PersonID, Content: c.Content }); return true; } };
        return c;
      }
      throw new Error(`cancelProvider: unexpected entity '${entityName}'`);
    },
    EntityByName: (entityName: string) => (entityName === BATCH_ENTITY ? { ID: BATCH_ENTITY_ID } : undefined),
    RunView: async (params: { EntityName: string }) => {
      if (params.EntityName === 'MJ_BizApps_Tasks: Task Links') return { Success: true, Results: opts.hasTask ? [{ TaskID: TASK_ID }] : [] };
      if (params.EntityName === 'MJ_BizApps_Common: People') return { Success: true, Results: opts.hasPerson ? [{ ID: PERSON_ID }] : [] };
      return { Success: true, Results: [] };
    },
  } as unknown as IMetadataProvider;
}

describe('TasksAppApprovalGate — who may cancel past approval', () => {
  const world = (): CancelWorld => ({ comments: [] });

  it.each([
    ['the configured CFO', CFO_USER_ID],
    ['the user who approved the batch', APPROVER_USER_ID],
  ])('lets %s cancel', async (_label, userId) => {
    const gate = new TasksAppApprovalGate(cancelProvider({ cfoUserId: CFO_USER_ID, hasTask: true, hasPerson: true }, world()));
    await expect(gate.assertMayCancelApproved(BATCH_ID, { ID: userId } as UserInfo)).resolves.toBeUndefined();
  });

  it('refuses anyone else', async () => {
    const gate = new TasksAppApprovalGate(cancelProvider({ cfoUserId: CFO_USER_ID, hasTask: true, hasPerson: true }, world()));
    await expect(gate.assertMayCancelApproved(BATCH_ID, { ID: OTHER_USER_ID } as UserInfo)).rejects.toThrow(/only the company's configured approver/);
  });

  it('still lets the approver cancel when the company has no CFO configured', async () => {
    const gate = new TasksAppApprovalGate(cancelProvider({ cfoUserId: null, hasTask: true, hasPerson: true }, world()));
    await expect(gate.assertMayCancelApproved(BATCH_ID, { ID: APPROVER_USER_ID } as UserInfo)).resolves.toBeUndefined();
  });
});

describe('TasksAppApprovalGate.recordCancellation — the approval Task records the cancel', () => {
  it('writes a comment on the approval Task, by the cancelling user\'s Person, with the reason', async () => {
    const w: CancelWorld = { comments: [] };
    const gate = new TasksAppApprovalGate(cancelProvider({ cfoUserId: CFO_USER_ID, hasTask: true, hasPerson: true }, w));
    await gate.recordCancellation(BATCH_ID, '  Wrong posting period  ', cfo);

    expect(w.comments).toHaveLength(1);
    expect(w.comments[0].TaskID).toBe(TASK_ID);
    expect(w.comments[0].PersonID).toBe(PERSON_ID);
    expect(w.comments[0].Content).toMatch(/BATCH-0007 was cancelled after approval.*Reason: Wrong posting period$/);
  });

  it('does nothing for a batch with no approval Task', async () => {
    const w: CancelWorld = { comments: [] };
    const gate = new TasksAppApprovalGate(cancelProvider({ cfoUserId: CFO_USER_ID, hasTask: false, hasPerson: true }, w));
    await gate.recordCancellation(BATCH_ID, 'Wrong posting period', cfo);
    expect(w.comments).toHaveLength(0);
  });

  it('refuses when the cancelling user has no linked Person, so the cancel rolls back rather than going unrecorded', async () => {
    const w: CancelWorld = { comments: [] };
    const gate = new TasksAppApprovalGate(cancelProvider({ cfoUserId: CFO_USER_ID, hasTask: true, hasPerson: false }, w));
    await expect(gate.recordCancellation(BATCH_ID, 'Wrong posting period', cfo)).rejects.toThrow(/has no linked Person/);
    expect(w.comments).toHaveLength(0);
  });
});
