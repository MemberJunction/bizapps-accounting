/**
 * Separation-of-duties guard on the JE-batch approval gate.
 *
 * The 2026-09-05 sweep made `recordDecision` require the caller to be the company's configured
 * `AccountingCompanyProfile.ApprovalCFOUserID`. That still lets a CFO who builds a batch approve
 * their own batch, so the gate additionally refuses the batch's `BatchedByUserID`. It also refuses
 * a decision the batch cannot carry out: on a batch no longer Pending (#306), or a rejection whose
 * notes do not fit the batch's CancelReason (#307). Isolated unit test, no DB — the provider is a
 * stub that answers only the entity loads the guards reach.
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

/** CancelReason's length as the entity metadata reports it (NVARCHAR(1000)). */
const CANCEL_REASON_MAX_LENGTH = 1000;

/** The batch entity's metadata: its ID, and the CancelReason field the rejection-notes check reads. */
const batchEntityInfo = { ID: BATCH_ENTITY_ID, Fields: [{ Name: 'CancelReason', MaxLength: CANCEL_REASON_MAX_LENGTH }] };

/**
 * A provider that serves one batch (built by `batchedByUserId`, in `status`) for a company whose CFO is
 * CFO_USER_ID. `lookups` counts the RunView calls, which start only once every guard has passed.
 */
function stubProvider(batchedByUserId: string, status = 'Pending', lookups = { count: 0 }): IMetadataProvider {
  return {
    GetEntityObject: async (entityName: string) => {
      if (entityName === BATCH_ENTITY) {
        return {
          Load: async () => true,
          ID: BATCH_ID,
          CompanyID: COMPANY_ID,
          JournalEntryBatchNumber: 'BATCH-0007',
          BatchedByUserID: batchedByUserId,
          Status: status,
        };
      }
      if (entityName === ACP_ENTITY) {
        return { Load: async () => true, ApprovalCFOUserID: CFO_USER_ID };
      }
      throw new Error(`stubProvider: unexpected entity '${entityName}'`);
    },
    EntityByName: (entityName: string) => (entityName === BATCH_ENTITY ? batchEntityInfo : undefined),
    // Reached only once the guards pass; no Task Link exists, so recordDecision fails further down.
    RunView: async () => {
      lookups.count++;
      return { Success: true, Results: [] };
    },
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
    // Past both guards; the stub's batch has no stamped Task, which is where it stops.
    await expect(gate.recordDecision(BATCH_ID, 'Approved', undefined, undefined, cfo)).rejects.toThrow(
      /has no stamped approval Task to record a decision against/,
    );
  });
});

describe('TasksAppApprovalGate.recordDecision — only a decision the batch can carry out (#306, #307)', () => {
  // Every refusal comes before the approval Task is looked up, so nothing is written to it.
  it.each(['Cancelled', 'Approved', 'Archived'])('refuses a decision on a %s batch, before reading its Task', async (status) => {
    const lookups = { count: 0 };
    const gate = new TasksAppApprovalGate(stubProvider(OTHER_USER_ID, status, lookups));
    await expect(gate.recordDecision(BATCH_ID, 'Approved', undefined, undefined, cfo)).rejects.toThrow(
      `Batch BATCH-0007 is ${status}; a decision can be recorded only on a Pending batch.`,
    );
    expect(lookups.count).toBe(0);
  });

  it('refuses rejection notes longer than the batch\'s cancel reason holds, before reading its Task', async () => {
    const lookups = { count: 0 };
    const gate = new TasksAppApprovalGate(stubProvider(OTHER_USER_ID, 'Pending', lookups));
    await expect(gate.recordDecision(BATCH_ID, 'Rejected', undefined, 'x'.repeat(CANCEL_REASON_MAX_LENGTH + 1), cfo)).rejects.toThrow(
      `holds at most ${CANCEL_REASON_MAX_LENGTH} characters; these notes are ${CANCEL_REASON_MAX_LENGTH + 1}`,
    );
    expect(lookups.count).toBe(0);
  });

  it('accepts rejection notes at the limit, measured without surrounding spaces as the cancel stores them', async () => {
    const gate = new TasksAppApprovalGate(stubProvider(OTHER_USER_ID));
    const notes = `  ${'x'.repeat(CANCEL_REASON_MAX_LENGTH)}  `;
    await expect(gate.recordDecision(BATCH_ID, 'Rejected', undefined, notes, cfo)).rejects.toThrow(
      /has no stamped approval Task to record a decision against/,
    );
  });

  it('does not limit approval notes, which are never written to the batch', async () => {
    const gate = new TasksAppApprovalGate(stubProvider(OTHER_USER_ID));
    await expect(gate.recordDecision(BATCH_ID, 'Approved', undefined, 'x'.repeat(CANCEL_REASON_MAX_LENGTH + 1), cfo)).rejects.toThrow(
      /has no stamped approval Task to record a decision against/,
    );
  });

  it('tells a user who may not decide only that, even on a batch that is no longer Pending', async () => {
    const gate = new TasksAppApprovalGate(stubProvider(CFO_USER_ID, 'Cancelled'));
    await expect(gate.recordDecision(BATCH_ID, 'Approved', undefined, undefined, cfo)).rejects.toThrow(
      /the user who built a batch may not approve it/,
    );
  });
});

// ─── cancel past approval (#183) ─────────────────────────────────────────────

const APPROVER_USER_ID = 'f0c1a2b3-0000-4000-8000-00000000a11c';
const TASK_ID = '7a5c0d1e-0000-4000-8000-0000000074a5';
const PERSON_ID = '5e2b9c4d-0000-4000-8000-000000009e25';

const BUILDER_USER_ID = 'b0b1b2b3-0000-4000-8000-00000000b17d';

const FORGED_TASK_ID = '0badf00d-0000-4000-8000-00000000f0f0';

interface CancelWorld {
  comments: Array<{ TaskID: string; PersonID: string; Content: string }>;
  /** The approval Task's Status each time it was saved. */
  taskSaves?: string[];
}

/**
 * A provider serving a batch built by BUILDER_USER_ID and approved by APPROVER_USER_ID, its open approval Task,
 * and (optionally) the caller's Person. `approvalTaskId` is the batch's stamped ApprovalTaskID; `loadableTaskIds`
 * are the Tasks that load. Task Links always answer with a newer, forged link to FORGED_TASK_ID — the gate must
 * not follow it.
 */
function cancelProvider(opts: { cfoUserId: string | null; approvalTaskId: string | null; hasPerson: boolean; loadableTaskIds?: string[] }, world: CancelWorld): IMetadataProvider {
  const loadable = opts.loadableTaskIds ?? [TASK_ID, FORGED_TASK_ID];
  return {
    GetEntityObject: async (entityName: string) => {
      if (entityName === BATCH_ENTITY) {
        // Cancelled, as the batch reads when recordCancellation runs: after the cancel was saved, inside its transaction.
        return { Load: async () => true, ID: BATCH_ID, CompanyID: COMPANY_ID, JournalEntryBatchNumber: 'BATCH-0007', Status: 'Cancelled', ApprovedByUserID: APPROVER_USER_ID, BatchedByUserID: BUILDER_USER_ID, ApprovalTaskID: opts.approvalTaskId };
      }
      if (entityName === ACP_ENTITY) return { Load: async () => true, ApprovalCFOUserID: opts.cfoUserId };
      if (entityName === 'MJ_BizApps_Tasks: Tasks') {
        const t = {
          ID: '', Status: 'Open', LatestResult: null,
          Load: async (id: string) => { t.ID = id; return loadable.includes(id); },
          Save: async () => { (world.taskSaves ??= []).push(t.Status); return true; },
        };
        return t;
      }
      if (entityName === 'MJ_BizApps_Tasks: Task Comments') {
        const c = { TaskID: '', PersonID: '', Content: '', LatestResult: null, NewRecord: () => undefined, Save: async () => { world.comments.push({ TaskID: c.TaskID, PersonID: c.PersonID, Content: c.Content }); return true; } };
        return c;
      }
      throw new Error(`cancelProvider: unexpected entity '${entityName}'`);
    },
    EntityByName: (entityName: string) => (entityName === BATCH_ENTITY ? { ID: BATCH_ENTITY_ID } : undefined),
    RunView: async (params: { EntityName: string }) => {
      if (params.EntityName === 'MJ_BizApps_Tasks: Task Links') return { Success: true, Results: [{ TaskID: FORGED_TASK_ID }] };
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
    const gate = new TasksAppApprovalGate(cancelProvider({ cfoUserId: CFO_USER_ID, approvalTaskId: TASK_ID, hasPerson: true }, world()));
    await expect(gate.assertMayCancelApproved(BATCH_ID, { ID: userId } as UserInfo)).resolves.toBeUndefined();
  });

  it('refuses anyone else', async () => {
    const gate = new TasksAppApprovalGate(cancelProvider({ cfoUserId: CFO_USER_ID, approvalTaskId: TASK_ID, hasPerson: true }, world()));
    await expect(gate.assertMayCancelApproved(BATCH_ID, { ID: OTHER_USER_ID } as UserInfo)).rejects.toThrow(/only the company's configured approver/);
  });

  it('still lets the approver cancel when the company has no CFO configured', async () => {
    const gate = new TasksAppApprovalGate(cancelProvider({ cfoUserId: null, approvalTaskId: TASK_ID, hasPerson: true }, world()));
    await expect(gate.assertMayCancelApproved(BATCH_ID, { ID: APPROVER_USER_ID } as UserInfo)).resolves.toBeUndefined();
  });

  // #212: recordCancellation needs the canceller's Person, so the refusal comes before the cancel starts.
  it('refuses an allowed user with no linked Person when the batch has an approval Task', async () => {
    const gate = new TasksAppApprovalGate(cancelProvider({ cfoUserId: CFO_USER_ID, approvalTaskId: TASK_ID, hasPerson: false }, world()));
    await expect(gate.assertMayCancelApproved(BATCH_ID, cfo)).rejects.toThrow(/BATCH-0007: .*has no linked Person.*An administrator must link this user to a Person/);
  });

  it('finds the Person through the user\'s link to a People subtype when LinkedUserID names no one', async () => {
    const PEOPLE_ENTITY_ID = 'e0000000-0000-4000-8000-0000000000e1';
    const SUBTYPE_ENTITY_ID = 'e0000000-0000-4000-8000-0000000000e2';
    const peopleEntity = { ID: PEOPLE_ENTITY_ID, Name: 'MJ_BizApps_Common: People', ParentChain: [] };
    const subtype = { ID: SUBTYPE_ENTITY_ID, Name: 'Platform: People', ParentChain: [peopleEntity] };
    const base = cancelProvider({ cfoUserId: CFO_USER_ID, approvalTaskId: TASK_ID, hasPerson: false }, world());
    const provider = {
      ...base,
      Entities: [peopleEntity, subtype],
      EntityByID: (id: string) => [peopleEntity, subtype].find((e) => e.ID === id),
      RunView: async (params: { EntityName: string; ExtraFilter?: string }) =>
        params.EntityName === 'MJ_BizApps_Common: People' && params.ExtraFilter === `ID = '${PERSON_ID}'`
          ? { Success: true, Results: [{ ID: PERSON_ID }] }
          : (base as unknown as { RunView: (p: { EntityName: string }) => Promise<unknown> }).RunView(params),
    } as unknown as IMetadataProvider;
    const linkedCfo = { ID: CFO_USER_ID, LinkedEntityID: SUBTYPE_ENTITY_ID, LinkedEntityRecordID: PERSON_ID } as unknown as UserInfo;
    const gate = new TasksAppApprovalGate(provider);
    await expect(gate.assertMayCancelApproved(BATCH_ID, linkedCfo)).resolves.toBeUndefined();
  });

  it('lets an allowed user with no linked Person cancel a batch with no stamped approval Task, even when a Task Link names one', async () => {
    const gate = new TasksAppApprovalGate(cancelProvider({ cfoUserId: CFO_USER_ID, approvalTaskId: null, hasPerson: false }, world()));
    await expect(gate.assertMayCancelApproved(BATCH_ID, cfo)).resolves.toBeUndefined();
  });

  it('tells a user who may not cancel only that, even when they also have no linked Person', async () => {
    const gate = new TasksAppApprovalGate(cancelProvider({ cfoUserId: CFO_USER_ID, approvalTaskId: TASK_ID, hasPerson: false }, world()));
    await expect(gate.assertMayCancelApproved(BATCH_ID, { ID: OTHER_USER_ID } as UserInfo)).rejects.toThrow(/only the company's configured approver/);
  });
});

describe('TasksAppApprovalGate.recordCancellation — the approval Task records the cancel', () => {
  it('writes a comment on the approval Task, by the cancelling user\'s Person, with the reason', async () => {
    const w: CancelWorld = { comments: [] };
    const gate = new TasksAppApprovalGate(cancelProvider({ cfoUserId: CFO_USER_ID, approvalTaskId: TASK_ID, hasPerson: true }, w));
    await gate.recordCancellation(BATCH_ID, { reason: '  Wrong posting period  ', fromStatus: 'Failed', erpCheck: 'The ERP lookup found nothing posted under document BATCH-0007.' }, cfo);

    expect(w.comments).toHaveLength(1);
    expect(w.comments[0].TaskID).toBe(TASK_ID);
    expect(w.comments[0].PersonID).toBe(PERSON_ID);
    expect(w.comments[0].Content).toMatch(/BATCH-0007 was cancelled after approval \(it was Failed\).*Reason: Wrong posting period ERP check: The ERP lookup found nothing/);
    expect(w.comments[0].Content).not.toMatch(/it was Cancelled/);
  });

  it('leaves the approval Task open after approval — it keeps the approver\'s decision', async () => {
    const w: CancelWorld = { comments: [] };
    const gate = new TasksAppApprovalGate(cancelProvider({ cfoUserId: CFO_USER_ID, approvalTaskId: TASK_ID, hasPerson: true }, w));
    await gate.recordCancellation(BATCH_ID, { reason: 'Wrong posting period', fromStatus: 'Approved' }, cfo);
    expect(w.taskSaves).toBeUndefined();
  });

  it('closes the stamped approval Task as Cancelled, with a comment, for a batch cancelled before approval (golive #302)', async () => {
    const w: CancelWorld = { comments: [] };
    const gate = new TasksAppApprovalGate(cancelProvider({ cfoUserId: CFO_USER_ID, approvalTaskId: TASK_ID, hasPerson: true }, w));
    await gate.recordCancellation(BATCH_ID, { reason: 'Built with the wrong entries', fromStatus: 'Pending' }, { ID: BUILDER_USER_ID } as UserInfo);

    expect(w.comments).toHaveLength(1);
    expect(w.comments[0].TaskID).toBe(TASK_ID);
    expect(w.comments[0].Content).toMatch(/BATCH-0007 was cancelled before approval, so this approval request is closed\..*Reason: Built with the wrong entries/);
    expect(w.taskSaves).toEqual(['Cancelled']);
  });

  it('does nothing for a batch with no stamped approval Task, even when a Task Link names one', async () => {
    const w: CancelWorld = { comments: [] };
    const gate = new TasksAppApprovalGate(cancelProvider({ cfoUserId: CFO_USER_ID, approvalTaskId: null, hasPerson: true }, w));
    await gate.recordCancellation(BATCH_ID, { reason: 'Wrong posting period', fromStatus: 'Approved' }, cfo);
    expect(w.comments).toHaveLength(0);
  });

  it('writes to the stamped approval Task, not the Task named by a newer Task Link (#223)', async () => {
    const w: CancelWorld = { comments: [] };
    const gate = new TasksAppApprovalGate(cancelProvider({ cfoUserId: CFO_USER_ID, approvalTaskId: TASK_ID, hasPerson: true }, w));
    await gate.recordCancellation(BATCH_ID, { reason: 'Wrong posting period', fromStatus: 'Approved' }, cfo);
    expect(w.comments.map(c => c.TaskID)).toEqual([TASK_ID]);
  });

  it('refuses when the stamped approval Task does not load, so the cancel rolls back rather than going unrecorded', async () => {
    const w: CancelWorld = { comments: [] };
    const gate = new TasksAppApprovalGate(cancelProvider({ cfoUserId: CFO_USER_ID, approvalTaskId: TASK_ID, hasPerson: true, loadableTaskIds: [FORGED_TASK_ID] }, w));
    await expect(gate.recordCancellation(BATCH_ID, { reason: 'Wrong posting period', fromStatus: 'Approved' }, cfo)).rejects.toThrow(/approval Task .* did not load/);
    expect(w.comments).toHaveLength(0);
  });

  it('closes the approval Task without a comment when a user with no linked Person cancels before approval (golive #325)', async () => {
    const w: CancelWorld = { comments: [] };
    const gate = new TasksAppApprovalGate(cancelProvider({ cfoUserId: CFO_USER_ID, approvalTaskId: TASK_ID, hasPerson: false }, w));
    await gate.recordCancellation(BATCH_ID, { reason: 'Built with the wrong entries', fromStatus: 'Pending' }, { ID: BUILDER_USER_ID } as UserInfo);
    expect(w.comments).toHaveLength(0);
    expect(w.taskSaves).toEqual(['Cancelled']);
  });

  it('refuses when the cancelling user has no linked Person, so the cancel rolls back rather than going unrecorded', async () => {
    const w: CancelWorld = { comments: [] };
    const gate = new TasksAppApprovalGate(cancelProvider({ cfoUserId: CFO_USER_ID, approvalTaskId: TASK_ID, hasPerson: false }, w));
    await expect(gate.recordCancellation(BATCH_ID, { reason: 'Wrong posting period', fromStatus: 'Approved' }, cfo)).rejects.toThrow(/has no linked Person/);
    expect(w.comments).toHaveLength(0);
  });
});

describe('TasksAppApprovalGate.recordArchive — the approval Task records an archive (golive #325)', () => {
  it('closes the approval Task as Cancelled, with a comment, for a batch archived before approval', async () => {
    const w: CancelWorld = { comments: [] };
    const gate = new TasksAppApprovalGate(cancelProvider({ cfoUserId: CFO_USER_ID, approvalTaskId: TASK_ID, hasPerson: true }, w));
    await gate.recordArchive(BATCH_ID, { reason: '  Posted in the legacy system  ', fromStatus: 'Pending' }, cfo);

    expect(w.comments).toHaveLength(1);
    expect(w.comments[0].TaskID).toBe(TASK_ID);
    expect(w.comments[0].PersonID).toBe(PERSON_ID);
    expect(w.comments[0].Content).toMatch(/BATCH-0007 was archived before approval, so this approval request is closed\..*stay locked to it\. Reason: Posted in the legacy system$/);
    expect(w.taskSaves).toEqual(['Cancelled']);
  });

  it('closes the approval Task without a comment when the user has no linked Person', async () => {
    const w: CancelWorld = { comments: [] };
    const gate = new TasksAppApprovalGate(cancelProvider({ cfoUserId: CFO_USER_ID, approvalTaskId: TASK_ID, hasPerson: false }, w));
    await gate.recordArchive(BATCH_ID, { reason: 'Posted in the legacy system', fromStatus: 'Pending' }, cfo);
    expect(w.comments).toHaveLength(0);
    expect(w.taskSaves).toEqual(['Cancelled']);
  });

  it.each(['Approved', 'Failed'])('comments on a %s batch\'s approval Task and leaves its decision in place', async (from) => {
    const w: CancelWorld = { comments: [] };
    const gate = new TasksAppApprovalGate(cancelProvider({ cfoUserId: CFO_USER_ID, approvalTaskId: TASK_ID, hasPerson: true }, w));
    await gate.recordArchive(BATCH_ID, { reason: 'Posted in the legacy system', fromStatus: from }, cfo);
    expect(w.comments.map(c => c.Content)).toEqual([expect.stringMatching(new RegExp(`archived after approval \\(it was ${from}\\)`))]);
    expect(w.taskSaves).toBeUndefined();
  });

  it('refuses an archive past approval by a user with no linked Person, so the archive rolls back', async () => {
    const w: CancelWorld = { comments: [] };
    const gate = new TasksAppApprovalGate(cancelProvider({ cfoUserId: CFO_USER_ID, approvalTaskId: TASK_ID, hasPerson: false }, w));
    await expect(gate.recordArchive(BATCH_ID, { reason: 'Posted in the legacy system', fromStatus: 'Approved' }, cfo))
      .rejects.toThrow(/BATCH-0007: the archive cannot be recorded .*has no linked Person.*before the batch can be archived after approval/);
    expect(w.comments).toHaveLength(0);
  });

  it('writes to the stamped approval Task, not the Task named by a newer Task Link (#223)', async () => {
    const w: CancelWorld = { comments: [] };
    const gate = new TasksAppApprovalGate(cancelProvider({ cfoUserId: CFO_USER_ID, approvalTaskId: TASK_ID, hasPerson: true }, w));
    await gate.recordArchive(BATCH_ID, { reason: 'Posted in the legacy system', fromStatus: 'Approved' }, cfo);
    expect(w.comments.map(c => c.TaskID)).toEqual([TASK_ID]);
  });

  it('does nothing for a batch with no stamped approval Task', async () => {
    const w: CancelWorld = { comments: [] };
    const gate = new TasksAppApprovalGate(cancelProvider({ cfoUserId: CFO_USER_ID, approvalTaskId: null, hasPerson: false }, w));
    await gate.recordArchive(BATCH_ID, { reason: 'Posted in the legacy system', fromStatus: 'Approved' }, cfo);
    expect(w.comments).toHaveLength(0);
    expect(w.taskSaves).toBeUndefined();
  });
});

describe('TasksAppApprovalGate — who may cancel before approval (golive #302)', () => {
  const world = (): CancelWorld => ({ comments: [] });

  it.each([
    ['the configured CFO', CFO_USER_ID],
    ['the user who built the batch', BUILDER_USER_ID],
  ])('lets %s cancel', async (_label, userId) => {
    const gate = new TasksAppApprovalGate(cancelProvider({ cfoUserId: CFO_USER_ID, approvalTaskId: TASK_ID, hasPerson: true }, world()));
    await expect(gate.assertMayCancelPending(BATCH_ID, { ID: userId } as UserInfo)).resolves.toBeUndefined();
  });

  it('refuses anyone else', async () => {
    const gate = new TasksAppApprovalGate(cancelProvider({ cfoUserId: CFO_USER_ID, approvalTaskId: TASK_ID, hasPerson: true }, world()));
    await expect(gate.assertMayCancelPending(BATCH_ID, { ID: OTHER_USER_ID } as UserInfo)).rejects.toThrow(/or the user who built this batch may cancel it before approval/);
  });

  it('still lets the builder cancel when the company has no CFO configured', async () => {
    const gate = new TasksAppApprovalGate(cancelProvider({ cfoUserId: null, approvalTaskId: TASK_ID, hasPerson: true }, world()));
    await expect(gate.assertMayCancelPending(BATCH_ID, { ID: BUILDER_USER_ID } as UserInfo)).resolves.toBeUndefined();
  });

  it('lets an allowed user with no linked Person cancel — nobody approved the batch (golive #325)', async () => {
    const gate = new TasksAppApprovalGate(cancelProvider({ cfoUserId: CFO_USER_ID, approvalTaskId: TASK_ID, hasPerson: false }, world()));
    await expect(gate.assertMayCancelPending(BATCH_ID, { ID: BUILDER_USER_ID } as UserInfo)).resolves.toBeUndefined();
  });

  it('still refuses a user with no linked Person who may not cancel', async () => {
    const gate = new TasksAppApprovalGate(cancelProvider({ cfoUserId: CFO_USER_ID, approvalTaskId: TASK_ID, hasPerson: false }, world()));
    await expect(gate.assertMayCancelPending(BATCH_ID, { ID: OTHER_USER_ID } as UserInfo)).rejects.toThrow(/or the user who built this batch may cancel it before approval/);
  });
});

// ─── a rejected Pending batch (#233) ─────────────────────────────────────────

const APPROVED_OUTCOME_ID = '0a0a0a0a-0000-4000-8000-00000000a001';
const CONDITIONS_OUTCOME_ID = '0a0a0a0a-0000-4000-8000-00000000a002';
const REJECTED_OUTCOME_ID = '0a0a0a0a-0000-4000-8000-00000000a003';

/**
 * A provider serving a batch with (optionally) a stamped approval Task carrying decisions of the given outcomes.
 * With `forgedRejectedLink`, Task Links answer with a newer link to FORGED_TASK_ID, which carries a rejection.
 */
function decisionProvider(opts: { hasTask: boolean; outcomeIds: string[]; forgedRejectedLink?: boolean; forgedApprovedLink?: boolean }): IMetadataProvider {
  return {
    GetEntityObject: async (entityName: string) => {
      // assertApproved and isRejected load the batch for its stamped ApprovalTaskID.
      if (entityName === BATCH_ENTITY) return { Load: async () => true, ID: BATCH_ID, ApprovalTaskID: opts.hasTask ? TASK_ID : null };
      if (entityName === 'MJ_BizApps_Tasks: Tasks') {
        const t = { ID: '', Load: async (id: string) => { t.ID = id; return true; } };
        return t;
      }
      throw new Error(`decisionProvider: unexpected entity '${entityName}'`);
    },
    EntityByName: (entityName: string) => (entityName === BATCH_ENTITY ? { ID: BATCH_ENTITY_ID } : undefined),
    RunView: async (params: { EntityName: string; ExtraFilter?: string }) => {
      if (params.EntityName === 'MJ_BizApps_Tasks: Task Links') {
        if (opts.forgedRejectedLink || opts.forgedApprovedLink) return { Success: true, Results: [{ TaskID: FORGED_TASK_ID }] };
        return { Success: true, Results: opts.hasTask ? [{ TaskID: TASK_ID }] : [] };
      }
      if (params.EntityName === 'MJ_BizApps_Tasks: Task Decisions') {
        const forgedOutcome = opts.forgedApprovedLink ? APPROVED_OUTCOME_ID : REJECTED_OUTCOME_ID;
        const outcomeIds = params.ExtraFilter?.includes(FORGED_TASK_ID) ? [forgedOutcome] : opts.outcomeIds;
        return { Success: true, Results: outcomeIds.map(OutcomeID => ({ OutcomeID })) };
      }
      if (params.EntityName === 'MJ_BizApps_Tasks: Task Decision Outcomes') {
        return {
          Success: true,
          Results: [
            { ID: APPROVED_OUTCOME_ID, Code: 'Approved' },
            { ID: CONDITIONS_OUTCOME_ID, Code: 'ApprovedWithConditions' },
            { ID: REJECTED_OUTCOME_ID, Code: 'Rejected' },
          ],
        };
      }
      return { Success: true, Results: [] };
    },
  } as unknown as IMetadataProvider;
}

describe('TasksAppApprovalGate.isRejected — whether the approval Task records a rejection', () => {
  it('is true when the approval Task carries a rejection', async () => {
    const gate = new TasksAppApprovalGate(decisionProvider({ hasTask: true, outcomeIds: [REJECTED_OUTCOME_ID] }));
    await expect(gate.isRejected(BATCH_ID, cfo)).resolves.toBe(true);
  });

  it.each([[[]], [[APPROVED_OUTCOME_ID]], [[CONDITIONS_OUTCOME_ID]]])('is false for a Task whose decisions are %j', async (outcomeIds) => {
    const gate = new TasksAppApprovalGate(decisionProvider({ hasTask: true, outcomeIds }));
    await expect(gate.isRejected(BATCH_ID, cfo)).resolves.toBe(false);
  });

  it('is false for a batch with no approval Task — nothing could have rejected it', async () => {
    const gate = new TasksAppApprovalGate(decisionProvider({ hasTask: false, outcomeIds: [] }));
    await expect(gate.isRejected(BATCH_ID, cfo)).resolves.toBe(false);
  });

  it('ignores a newer Task Link to a rejected Task when the stamped Task carries no rejection (#223)', async () => {
    const gate = new TasksAppApprovalGate(decisionProvider({ hasTask: true, outcomeIds: [], forgedRejectedLink: true }));
    await expect(gate.isRejected(BATCH_ID, cfo)).resolves.toBe(false);
  });

  it('is false for a batch with no stamped approval Task, even when a Task Link names a rejected Task (#223)', async () => {
    const gate = new TasksAppApprovalGate(decisionProvider({ hasTask: false, outcomeIds: [], forgedRejectedLink: true }));
    await expect(gate.isRejected(BATCH_ID, cfo)).resolves.toBe(false);
  });

  it('does not count a rejection as an approval', async () => {
    const gate = new TasksAppApprovalGate(decisionProvider({ hasTask: true, outcomeIds: [REJECTED_OUTCOME_ID] }));
    await expect(gate.assertApproved(BATCH_ID, cfo)).rejects.toThrow(/is not approved/);
  });
});

// ─── the stamped Task decides, not the newest Task Link (#313) ──────────────

describe('TasksAppApprovalGate.assertApproved — the stamped approval Task decides', () => {
  it('passes when the stamped Task carries an approval', async () => {
    const gate = new TasksAppApprovalGate(decisionProvider({ hasTask: true, outcomeIds: [APPROVED_OUTCOME_ID] }));
    await expect(gate.assertApproved(BATCH_ID, cfo)).resolves.toBeUndefined();
  });

  it('refuses when a newer Task Link names an approved Task but the stamped Task carries no approval', async () => {
    const gate = new TasksAppApprovalGate(decisionProvider({ hasTask: true, outcomeIds: [], forgedApprovedLink: true }));
    await expect(gate.assertApproved(BATCH_ID, cfo)).rejects.toThrow(/is not approved/);
  });

  it('refuses a batch with no stamped approval Task, even when a Task Link names an approved Task', async () => {
    const gate = new TasksAppApprovalGate(decisionProvider({ hasTask: false, outcomeIds: [], forgedApprovedLink: true }));
    await expect(gate.assertApproved(BATCH_ID, cfo)).rejects.toThrow(/has no stamped approval Task/);
  });
});

describe('TasksAppApprovalGate.recordDecision — the decision lands on the stamped approval Task', () => {
  /** A gate over a Pending batch someone else built, whose Task Links name FORGED_TASK_ID; captures each decision. */
  function decidingGate(approvalTaskId: string | null): { gate: TasksAppApprovalGate; decidedTaskIds: string[] } {
    const provider = cancelProvider({ cfoUserId: CFO_USER_ID, approvalTaskId, hasPerson: true }, { comments: [] });
    const getEntityObject = provider.GetEntityObject.bind(provider);
    (provider as unknown as { GetEntityObject: typeof getEntityObject }).GetEntityObject = (async (entityName: string, user?: UserInfo) => {
      const entity = await getEntityObject(entityName, user);
      if (entityName === BATCH_ENTITY) Object.assign(entity, { Status: 'Pending', ApprovedByUserID: null });
      return entity;
    }) as typeof getEntityObject;
    const gate = new TasksAppApprovalGate(provider);
    const decidedTaskIds: string[] = [];
    (gate as unknown as { orchestration: { RecordDecision: (req: { TaskID: string }) => Promise<void> } })
      .orchestration = { RecordDecision: async (req) => { decidedTaskIds.push(req.TaskID); } };
    return { gate, decidedTaskIds };
  }

  it('records on the stamped Task, not the Task a newer Task Link names', async () => {
    const { gate, decidedTaskIds } = decidingGate(TASK_ID);
    await gate.recordDecision(BATCH_ID, 'Approved', undefined, undefined, cfo);
    expect(decidedTaskIds).toEqual([TASK_ID]);
  });

  it('refuses a batch with no stamped approval Task and records nothing, even when a Task Link names one', async () => {
    const { gate, decidedTaskIds } = decidingGate(null);
    await expect(gate.recordDecision(BATCH_ID, 'Approved', undefined, undefined, cfo)).rejects.toThrow(
      /has no stamped approval Task to record a decision against/,
    );
    expect(decidedTaskIds).toEqual([]);
  });
});

// ─── the approval Task shows the posting date (golive #315) ─────────────────

describe('TasksAppApprovalGate.onBatchBuilt — the approval Task names the posting date', () => {
  it('puts the batch PostingDate in the Task name and description', async () => {
    const requests: Array<{ Name: string; Description: string }> = [];
    const provider = {
      GetEntityObject: async (entityName: string) => {
        if (entityName === BATCH_ENTITY) {
          return {
            Load: async () => true,
            ID: BATCH_ID,
            CompanyID: COMPANY_ID,
            JournalEntryBatchNumber: 'BATCH-0007',
            TargetSystem: 'BusinessCentral',
            PostingDate: new Date('2026-08-31T00:00:00Z'),
          };
        }
        if (entityName === ACP_ENTITY) return { Load: async () => true, ApprovalCFOUserID: CFO_USER_ID };
        if (entityName === 'MJ_BizApps_Tasks: Tasks') return { Load: async () => true, ID: TASK_ID };
        throw new Error(`unexpected entity '${entityName}'`);
      },
      EntityByName: (entityName: string) => ({ ID: entityName === BATCH_ENTITY ? BATCH_ENTITY_ID : OTHER_USER_ID }),
      RunView: async (params: { EntityName: string }) => {
        if (params.EntityName === 'MJ_BizApps_Tasks: Task Types') return { Success: true, Results: [{ ID: TASK_ID }] };
        if (params.EntityName === 'MJ_BizApps_Tasks: Task Links') return { Success: true, Results: [{ TaskID: TASK_ID }] };
        return { Success: true, Results: [] };
      },
    } as unknown as IMetadataProvider;
    const gate = new TasksAppApprovalGate(provider);
    (gate as unknown as { orchestration: { CreateApprovalRequest: (req: { Name: string; Description: string }) => Promise<void> } })
      .orchestration = { CreateApprovalRequest: async (req) => { requests.push(req); } };

    await expect(gate.onBatchBuilt(BATCH_ID, cfo)).resolves.toBe(TASK_ID);
    expect(requests).toHaveLength(1);
    expect(requests[0].Name).toBe('Approve Journal Entry Batch #BATCH-0007 (posting date 2026-08-31)');
    expect(requests[0].Description).toContain('posting date 2026-08-31 — the journal date BusinessCentral receives');
  });
});
