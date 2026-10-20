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
      /has no approval task to record the decision on/,
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
      /has no approval task to record the decision on/,
    );
  });

  it('does not limit approval notes, which are never written to the batch', async () => {
    const gate = new TasksAppApprovalGate(stubProvider(OTHER_USER_ID));
    await expect(gate.recordDecision(BATCH_ID, 'Approved', undefined, 'x'.repeat(CANCEL_REASON_MAX_LENGTH + 1), cfo)).rejects.toThrow(
      /has no approval task to record the decision on/,
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
function cancelProvider(
  opts: { cfoUserId: string | null; approvalTaskId: string | null; hasPerson: boolean; loadableTaskIds?: string[]; status?: string }, world: CancelWorld,
): IMetadataProvider {
  const loadable = opts.loadableTaskIds ?? [TASK_ID, FORGED_TASK_ID];
  return {
    GetEntityObject: async (entityName: string) => {
      if (entityName === BATCH_ENTITY) {
        // Cancelled by default, as the batch reads when recordCancellation runs: after the cancel was saved, inside its transaction.
        return { Load: async () => true, ID: BATCH_ID, CompanyID: COMPANY_ID, JournalEntryBatchNumber: 'BATCH-0007', Status: opts.status ?? 'Cancelled', ApprovedByUserID: APPROVER_USER_ID, BatchedByUserID: BUILDER_USER_ID, ApprovalTaskID: opts.approvalTaskId };
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
      // The CFO approved it through the sanctioned path (its audit names the CFO), and someone else built it.
      if (entityName === BATCH_ENTITY) {
        return {
          Load: async () => true, ID: BATCH_ID, ApprovalTaskID: opts.hasTask ? TASK_ID : null,
          CompanyID: COMPANY_ID, BatchedByUserID: BUILDER_USER_ID, ApprovedByUserID: CFO_USER_ID,
        };
      }
      // assertApproved reads the company's CFO to check who made the approval (golive #320 §3).
      if (entityName === ACP_ENTITY) return { Load: async () => true, ApprovalCFOUserID: CFO_USER_ID };
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
    await expect(gate.assertApproved(BATCH_ID, cfo)).rejects.toThrow(/has no Approved decision/);
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
    await expect(gate.assertApproved(BATCH_ID, cfo)).rejects.toThrow(/has no Approved decision/);
  });

  it('refuses a batch with no stamped approval Task, even when a Task Link names an approved Task', async () => {
    const gate = new TasksAppApprovalGate(decisionProvider({ hasTask: false, outcomeIds: [], forgedApprovedLink: true }));
    await expect(gate.assertApproved(BATCH_ID, cfo)).rejects.toThrow(/has no approval task, so it was not built/);
  });
});

// ─── who may archive (#448) ─────────────────────────────────────────────────

describe('TasksAppApprovalGate.assertMayArchive — who may archive (#448)', () => {
  const world = (): CancelWorld => ({ comments: [] });
  const gateFor = (status: string, hasPerson = true, cfoUserId: string | null = CFO_USER_ID) =>
    new TasksAppApprovalGate(cancelProvider({ cfoUserId, approvalTaskId: TASK_ID, hasPerson, status }, world()));

  it('lets only the configured CFO archive a Pending batch', async () => {
    await expect(gateFor('Pending').assertMayArchive(BATCH_ID, { ID: CFO_USER_ID } as UserInfo)).resolves.toBeUndefined();
  });

  it.each([BUILDER_USER_ID, OTHER_USER_ID, APPROVER_USER_ID])('refuses anyone else on a Pending batch, the builder included (%s)', async (userId) => {
    await expect(gateFor('Pending').assertMayArchive(BATCH_ID, { ID: userId } as UserInfo)).rejects.toThrow(
      /only the company's configured approver \(the Approval CFO on its Accounting Company Profile\) may archive it before approval/,
    );
  });

  it('refuses the builder of a Pending batch even when the company has no CFO configured', async () => {
    await expect(gateFor('Pending', true, null).assertMayArchive(BATCH_ID, { ID: BUILDER_USER_ID } as UserInfo)).rejects.toThrow(/may archive it before approval/);
  });

  it('still lets the builder cancel the Pending batch it may not archive', async () => {
    await expect(gateFor('Pending').assertMayCancelPending(BATCH_ID, { ID: BUILDER_USER_ID } as UserInfo)).resolves.toBeUndefined();
  });

  it.each(['Approved', 'Failed'])('lets the configured CFO and the approver archive a %s batch', async (status) => {
    await expect(gateFor(status).assertMayArchive(BATCH_ID, { ID: CFO_USER_ID } as UserInfo)).resolves.toBeUndefined();
    await expect(gateFor(status).assertMayArchive(BATCH_ID, { ID: APPROVER_USER_ID } as UserInfo)).resolves.toBeUndefined();
  });

  it.each(['Approved', 'Failed'])('refuses the builder and anyone else on a %s batch', async (status) => {
    for (const userId of [BUILDER_USER_ID, OTHER_USER_ID]) {
      await expect(gateFor(status).assertMayArchive(BATCH_ID, { ID: userId } as UserInfo)).rejects.toThrow(
        /or the user who approved this batch may archive it after approval/,
      );
    }
  });

  it('refuses an allowed user with no linked Person past approval, naming the archive', async () => {
    await expect(gateFor('Approved', false).assertMayArchive(BATCH_ID, { ID: CFO_USER_ID } as UserInfo)).rejects.toThrow(
      /the archive cannot be recorded on its approval Task/,
    );
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
      /has no approval task to record the decision on/,
    );
    expect(decidedTaskIds).toEqual([]);
  });
});

// ─── building a batch raises its approval Task ──────────────────────────────

const PEOPLE_ENTITY_NAME = 'MJ_BizApps_Common: People';
const PEOPLE_ENTITY_ID = 'c0c0c0c0-0000-4000-8000-0000000000e1';
const USERS_ENTITY_NAME = 'MJ: Users';
const CFO_PERSON_ID = 'c0c0c0c0-0000-4000-8000-0000000000f1';

interface BuildWorld {
  requests: Array<{ Name: string; Description: string; ApproverPersonEntityID: string; ApproverPersonRecordIDs: string[] }>;
  peopleFilters: string[];
}

/**
 * A provider for onBatchBuilt / assertCanRaise: one batch for a company whose CFO is CFO_USER_ID.
 * `cfoLink` is how that user reaches a Person: through the user's own People link, through the
 * deprecated People.LinkedUserID, or not at all.
 */
function buildProvider(cfoLink: 'user-link' | 'linked-user-id' | 'none', world: BuildWorld): IMetadataProvider {
  const peopleEntity = { ID: PEOPLE_ENTITY_ID, Name: PEOPLE_ENTITY_NAME, ParentChain: [] };
  return {
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
    Entities: [peopleEntity],
    EntityByID: (id: string) => (id === PEOPLE_ENTITY_ID ? peopleEntity : undefined),
    EntityByName: (entityName: string) => {
      if (entityName === BATCH_ENTITY) return { ID: BATCH_ENTITY_ID };
      if (entityName === PEOPLE_ENTITY_NAME) return peopleEntity;
      return undefined;
    },
    RunView: async (params: { EntityName: string; ExtraFilter?: string }) => {
      if (params.EntityName === 'MJ_BizApps_Tasks: Task Types') return { Success: true, Results: [{ ID: TASK_ID }] };
      if (params.EntityName === 'MJ_BizApps_Tasks: Task Links') return { Success: true, Results: [{ TaskID: TASK_ID }] };
      if (params.EntityName === USERS_ENTITY_NAME) {
        const linked = cfoLink === 'user-link';
        return { Success: true, Results: [{ ID: CFO_USER_ID, LinkedEntityID: linked ? PEOPLE_ENTITY_ID : null, LinkedEntityRecordID: linked ? CFO_PERSON_ID : null }] };
      }
      if (params.EntityName === PEOPLE_ENTITY_NAME) {
        world.peopleFilters.push(params.ExtraFilter ?? '');
        if (cfoLink === 'user-link') return { Success: true, Results: [{ ID: CFO_PERSON_ID, LinkedUserID: null }] };
        if (cfoLink === 'linked-user-id') return { Success: true, Results: [{ ID: CFO_PERSON_ID, LinkedUserID: CFO_USER_ID }] };
        return { Success: true, Results: [] };
      }
      return { Success: true, Results: [] };
    },
  } as unknown as IMetadataProvider;
}

function gateRecording(provider: IMetadataProvider, world: BuildWorld): TasksAppApprovalGate {
  const gate = new TasksAppApprovalGate(provider);
  (gate as unknown as { orchestration: { CreateApprovalRequest: (req: BuildWorld['requests'][number]) => Promise<void> } })
    .orchestration = { CreateApprovalRequest: async (req) => { world.requests.push(req); } };
  return gate;
}

describe('TasksAppApprovalGate.onBatchBuilt — the approval Task', () => {
  const world = (): BuildWorld => ({ requests: [], peopleFilters: [] });

  // golive #315
  it('puts the batch PostingDate in the Task name and description', async () => {
    const w = world();
    const gate = gateRecording(buildProvider('user-link', w), w);

    await expect(gate.onBatchBuilt(BATCH_ID, cfo)).resolves.toBe(TASK_ID);
    expect(w.requests).toHaveLength(1);
    expect(w.requests[0].Name).toBe('Approve Journal Entry Batch #BATCH-0007 (posting date 2026-08-31)');
    expect(w.requests[0].Description).toContain('posting date 2026-08-31 — the journal date BusinessCentral receives');
  });

  // #387: the Tasks app lists a viewer's tasks by their Person, so a User assignee reached no inbox.
  it.each([
    ['the user\'s own People link', 'user-link' as const],
    ['People.LinkedUserID', 'linked-user-id' as const],
  ])('assigns the Task to the CFO\'s Person, found through %s', async (_label, link) => {
    const w = world();
    const gate = gateRecording(buildProvider(link, w), w);

    await gate.onBatchBuilt(BATCH_ID, cfo);
    expect(w.requests[0].ApproverPersonEntityID).toBe(PEOPLE_ENTITY_ID);
    expect(w.requests[0].ApproverPersonRecordIDs).toEqual([CFO_PERSON_ID]);
  });

  it('looks only for an active Person, as the Tasks app does', async () => {
    const w = world();
    await gateRecording(buildProvider('user-link', w), w).onBatchBuilt(BATCH_ID, cfo);
    expect(w.peopleFilters[0]).toContain(`Status = 'Active'`);
  });

  it('refuses, raising no Task, when the CFO has no linked Person', async () => {
    const w = world();
    const gate = gateRecording(buildProvider('none', w), w);

    await expect(gate.onBatchBuilt(BATCH_ID, cfo)).rejects.toThrow(
      /Approval CFO on company .* is not linked to an active Person.*An administrator must link that user to a Person/,
    );
    expect(w.requests).toHaveLength(0);
  });
});

describe('TasksAppApprovalGate.assertCanRaise — refuses the build before any write', () => {
  it('refuses when the CFO has no linked Person', async () => {
    const w: BuildWorld = { requests: [], peopleFilters: [] };
    const gate = new TasksAppApprovalGate(buildProvider('none', w));
    await expect(gate.assertCanRaise(COMPANY_ID, cfo)).rejects.toThrow(/is not linked to an active Person/);
  });

  it('passes when the CFO has a linked Person', async () => {
    const w: BuildWorld = { requests: [], peopleFilters: [] };
    const gate = new TasksAppApprovalGate(buildProvider('user-link', w));
    await expect(gate.assertCanRaise(COMPANY_ID, cfo)).resolves.toBeUndefined();
  });
});

// ─── only an allowed decider's approval counts (golive #320 §3) ─────────────

// CFO_PERSON_ID and PEOPLE_ENTITY_ID are declared with the build tests above.
const BUILDER_PERSON_ID = 'b0b0b0b0-0000-4000-8000-0000000b0d00';
const OTHER_PERSON_ID = 'd0d0d0d0-0000-4000-8000-0000000d0d00';
/** An IS-A subtype of People (its ParentChain names People). */
const EMPLOYEE_ENTITY_ID = 'e1e1e1e1-0000-4000-8000-0000000e1e10';
/** An entity that is not People at all. */
const CONTACT_ENTITY_ID = 'e2e2e2e2-0000-4000-8000-0000000e2e20';
/** One Person bound to two user accounts. */
const SHARED_PERSON_ID = '5a5a5a5a-0000-4000-8000-00000005a5a0';

interface AllowedDeciderWorld {
  cfoUserId: string | null;
  batchedByUserId: string;
  approvedByUserId: string | null;
  /** DecidedByPersonID of each Approved decision on the stamped Task (null = no Person recorded). */
  approvedBy: Array<string | null>;
  /** Person IDs bound to each user through People.LinkedUserID. */
  peopleByUser: Record<string, string[]>;
  /** A user's own People link (User.LinkedEntityRecordID), by user ID. */
  userLinks?: Record<string, string>;
  /** The entity of a user's own link (User.LinkedEntityID), by user ID. Defaults to People. */
  userLinkEntities?: Record<string, string>;
  failPeopleLookup?: boolean;
  failUserLookup?: boolean;
  failDecisionsLookup?: boolean;
  /** Decisions whose outcome is Rejected (by DecidedByPersonID), for isRejected. */
  rejectedBy?: Array<string | null>;
  /** Every RunView call, in order, for asserting which lookups ran and what reached a filter. */
  calls?: Array<{ EntityName: string; ExtraFilter: string }>;
  /** Counts the batch entity objects handed out. */
  batchLoads?: { count: number };
}

function allowedDeciderProvider(w: AllowedDeciderWorld): IMetadataProvider {
  return {
    GetEntityObject: async (entityName: string) => {
      if (entityName === BATCH_ENTITY) {
        if (w.batchLoads) w.batchLoads.count++;
        return {
          Load: async () => true, ID: BATCH_ID, CompanyID: COMPANY_ID, JournalEntryBatchNumber: 'BATCH-0007',
          ApprovalTaskID: TASK_ID, BatchedByUserID: w.batchedByUserId, ApprovedByUserID: w.approvedByUserId,
        };
      }
      if (entityName === ACP_ENTITY) return { Load: async () => true, ApprovalCFOUserID: w.cfoUserId };
      if (entityName === 'MJ_BizApps_Tasks: Tasks') {
        const t = { ID: '', Load: async (id: string) => { t.ID = id; return true; } };
        return t;
      }
      throw new Error(`allowedDeciderProvider: unexpected entity '${entityName}'`);
    },
    EntityByName: (entityName: string) => (entityName === BATCH_ENTITY ? { ID: BATCH_ENTITY_ID } : undefined),
    EntityByID: (id: string) => {
      if (id === PEOPLE_ENTITY_ID) return { Name: 'MJ_BizApps_Common: People', ParentChain: [] };
      if (id === EMPLOYEE_ENTITY_ID) return { Name: 'HR: Employees', ParentChain: [{ Name: 'MJ_BizApps_Common: People' }] };
      if (id === CONTACT_ENTITY_ID) return { Name: 'CRM: Contacts', ParentChain: [] };
      return undefined;
    },
    RunView: async (params: { EntityName: string; ExtraFilter?: string }) => {
      const filter = params.ExtraFilter ?? '';
      w.calls?.push({ EntityName: params.EntityName, ExtraFilter: filter });
      if (params.EntityName === 'MJ_BizApps_Tasks: Task Decisions') {
        if (w.failDecisionsLookup) return { Success: false, Results: [], ErrorMessage: 'decisions table unavailable' };
        return {
          Success: true,
          Results: [
            ...w.approvedBy.map(DecidedByPersonID => ({ OutcomeID: APPROVED_OUTCOME_ID, DecidedByPersonID })),
            ...(w.rejectedBy ?? []).map(DecidedByPersonID => ({ OutcomeID: REJECTED_OUTCOME_ID, DecidedByPersonID })),
          ],
        };
      }
      if (params.EntityName === 'MJ_BizApps_Tasks: Task Decision Outcomes') {
        return { Success: true, Results: [{ ID: APPROVED_OUTCOME_ID, Code: 'Approved' }, { ID: REJECTED_OUTCOME_ID, Code: 'Rejected' }] };
      }
      if (params.EntityName === 'MJ: Users') {
        if (w.failUserLookup) return { Success: false, Results: [], ErrorMessage: 'users table unavailable' };
        const userId = Object.keys(w.userLinks ?? {}).find(id => filter.includes(id));
        return {
          Success: true,
          Results: userId
            ? [{ LinkedEntityID: w.userLinkEntities?.[userId] ?? PEOPLE_ENTITY_ID, LinkedEntityRecordID: w.userLinks![userId] }]
            : [{ LinkedEntityID: null, LinkedEntityRecordID: null }],
        };
      }
      if (params.EntityName === 'MJ_BizApps_Common: People') {
        if (w.failPeopleLookup) return { Success: false, Results: [], ErrorMessage: 'database unavailable' };
        const byLinkedUser = Object.entries(w.peopleByUser).filter(([userId]) => filter.includes(`LinkedUserID = '${userId}'`)).flatMap(([, ids]) => ids);
        const byOwnLink = [...filter.matchAll(/(?<!LinkedUser)ID = '([0-9a-f-]{36})'/g)].map(m => m[1]);
        return { Success: true, Results: [...new Set([...byLinkedUser, ...byOwnLink])].map(ID => ({ ID })) };
      }
      return { Success: true, Results: [] };
    },
  } as unknown as IMetadataProvider;
}

describe('TasksAppApprovalGate.assertApproved — only an allowed decider\'s approval counts', () => {
  const base = (over: Partial<AllowedDeciderWorld> = {}): AllowedDeciderWorld => ({
    cfoUserId: CFO_USER_ID,
    batchedByUserId: BUILDER_USER_ID,
    approvedByUserId: CFO_USER_ID,
    approvedBy: [CFO_PERSON_ID],
    peopleByUser: { [CFO_USER_ID]: [CFO_PERSON_ID], [BUILDER_USER_ID]: [BUILDER_PERSON_ID] },
    ...over,
  });

  it('accepts an approval recorded by the CFO\'s Person (the in-app CFO path)', async () => {
    const gate = new TasksAppApprovalGate(allowedDeciderProvider(base()));
    await expect(gate.assertApproved(BATCH_ID, cfo)).resolves.toBeUndefined();
  });

  it('accepts the CFO\'s Person reached through the user\'s own People link', async () => {
    const gate = new TasksAppApprovalGate(allowedDeciderProvider(base({ peopleByUser: {}, userLinks: { [CFO_USER_ID]: CFO_PERSON_ID } })));
    await expect(gate.assertApproved(BATCH_ID, cfo)).resolves.toBeUndefined();
  });

  const NOT_THE_APPROVER = /but not one made by the company's configured approver \(the Approval CFO on its Accounting Company Profile, user 48d60bcc/;
  const BUILDER_IS_DECIDER = /approval came from a Person linked to the company's Approval CFO .* who is also linked to the user who built the batch/;
  const CFO_BUILT_IT = /the company's Approval CFO \(user 48d60bcc-044b-4cc2-9675-0d3b57bcdcba\) built this batch/;
  const NO_APPROVER = /company 411df6dc-3652-4151-836f-cda2e46a5038 has no approver configured.*Set the Approval CFO/;

  it('refuses an approval saved straight into the tasks app by someone else (the inbox bypass)', async () => {
    const gate = new TasksAppApprovalGate(allowedDeciderProvider(base({ approvedBy: [OTHER_PERSON_ID] })));
    await expect(gate.assertApproved(BATCH_ID, cfo)).rejects.toThrow(NOT_THE_APPROVER);
  });

  it('refuses an approval by the builder\'s Person — it is not the CFO\'s Person', async () => {
    const gate = new TasksAppApprovalGate(allowedDeciderProvider(base({ approvedBy: [BUILDER_PERSON_ID] })));
    await expect(gate.assertApproved(BATCH_ID, cfo)).rejects.toThrow(NOT_THE_APPROVER);
  });

  // The builder-exclusion clause: reachable only when one Person is bound to the builder user AND the CFO user.
  it.each([
    ['the CFO through the user\'s own People link, the builder through People.LinkedUserID',
      { userLinks: { [CFO_USER_ID]: SHARED_PERSON_ID }, peopleByUser: { [BUILDER_USER_ID]: [SHARED_PERSON_ID] } }],
    ['both through People.LinkedUserID',
      { peopleByUser: { [CFO_USER_ID]: [SHARED_PERSON_ID], [BUILDER_USER_ID]: [SHARED_PERSON_ID] } }],
    // A one-Person-per-user lookup (ResolvePersonIDsForUsers) returns only the builder's own link and
    // would let the shared Person's approval through; the check needs every Person bound to the builder.
    ['the builder through People.LinkedUserID besides their own People link',
      { userLinks: { [CFO_USER_ID]: SHARED_PERSON_ID, [BUILDER_USER_ID]: BUILDER_PERSON_ID }, peopleByUser: { [BUILDER_USER_ID]: [SHARED_PERSON_ID] } }],
  ])('refuses an approval by a Person bound to both the CFO and the builder (%s)', async (_label, links) => {
    const gate = new TasksAppApprovalGate(allowedDeciderProvider(base({ approvedBy: [SHARED_PERSON_ID], ...links })));
    await expect(gate.assertApproved(BATCH_ID, cfo)).rejects.toThrow(BUILDER_IS_DECIDER);
  });

  it('accepts the CFO\'s other Person when the shared Person also approved', async () => {
    const gate = new TasksAppApprovalGate(allowedDeciderProvider(base({
      approvedBy: [SHARED_PERSON_ID, CFO_PERSON_ID],
      peopleByUser: { [CFO_USER_ID]: [SHARED_PERSON_ID, CFO_PERSON_ID], [BUILDER_USER_ID]: [SHARED_PERSON_ID] },
    })));
    await expect(gate.assertApproved(BATCH_ID, cfo)).resolves.toBeUndefined();
  });

  it('refuses every approval when the CFO built the batch, and says so', async () => {
    const gate = new TasksAppApprovalGate(allowedDeciderProvider(base({ batchedByUserId: CFO_USER_ID })));
    await expect(gate.assertApproved(BATCH_ID, cfo)).rejects.toThrow(CFO_BUILT_IT);
  });

  it('refuses when the company has no CFO configured, and blames the configuration, not the decider', async () => {
    const gate = new TasksAppApprovalGate(allowedDeciderProvider(base({ cfoUserId: null })));
    const send = gate.assertApproved(BATCH_ID, cfo);
    await expect(send).rejects.toThrow(NO_APPROVER);
    await expect(send).rejects.not.toThrow(/not one made by/);
  });

  it('accepts a decision with no Person when the batch\'s approval audit names the CFO (a CFO with no linked Person)', async () => {
    const calls: AllowedDeciderWorld['calls'] = [];
    const gate = new TasksAppApprovalGate(allowedDeciderProvider(base({ approvedBy: [null], peopleByUser: {}, calls })));
    await expect(gate.assertApproved(BATCH_ID, cfo)).resolves.toBeUndefined();
    // No Person to compare, so neither Person lookup runs.
    expect(calls.filter(c => c.EntityName === 'MJ: Users' || c.EntityName === 'MJ_BizApps_Common: People')).toEqual([]);
  });

  it('refuses a decision with no Person when the batch\'s approval audit names someone else', async () => {
    const gate = new TasksAppApprovalGate(allowedDeciderProvider(base({ approvedBy: [null], approvedByUserId: OTHER_USER_ID })));
    await expect(gate.assertApproved(BATCH_ID, cfo)).rejects.toThrow(NOT_THE_APPROVER);
  });

  it('accepts when one of several approvals is the CFO\'s', async () => {
    const gate = new TasksAppApprovalGate(allowedDeciderProvider(base({ approvedBy: [OTHER_PERSON_ID, CFO_PERSON_ID] })));
    await expect(gate.assertApproved(BATCH_ID, cfo)).resolves.toBeUndefined();
  });

  it('compares Person and user IDs case-insensitively', async () => {
    const upperPerson = new TasksAppApprovalGate(allowedDeciderProvider(base({ approvedBy: [CFO_PERSON_ID.toUpperCase()] })));
    await expect(upperPerson.assertApproved(BATCH_ID, cfo)).resolves.toBeUndefined();
    const upperAudit = new TasksAppApprovalGate(allowedDeciderProvider(base({ approvedBy: [null], approvedByUserId: CFO_USER_ID.toUpperCase(), peopleByUser: {} })));
    await expect(upperAudit.assertApproved(BATCH_ID, cfo)).resolves.toBeUndefined();
  });

  it('looks up the builder\'s Persons only when an approval came from the CFO\'s Person', async () => {
    const calls: AllowedDeciderWorld['calls'] = [];
    const gate = new TasksAppApprovalGate(allowedDeciderProvider(base({ approvedBy: [OTHER_PERSON_ID], calls })));
    await expect(gate.assertApproved(BATCH_ID, cfo)).rejects.toThrow(NOT_THE_APPROVER);
    expect(calls.filter(c => c.ExtraFilter.includes(BUILDER_USER_ID))).toEqual([]);
  });

  it('loads the batch once per send', async () => {
    const batchLoads = { count: 0 };
    await new TasksAppApprovalGate(allowedDeciderProvider(base({ batchLoads }))).assertApproved(BATCH_ID, cfo);
    expect(batchLoads.count).toBe(1);
  });

  it('counts a CFO Person reached through a People IS-A subtype link', async () => {
    const gate = new TasksAppApprovalGate(allowedDeciderProvider(base({
      peopleByUser: {}, userLinks: { [CFO_USER_ID]: CFO_PERSON_ID }, userLinkEntities: { [CFO_USER_ID]: EMPLOYEE_ENTITY_ID },
    })));
    await expect(gate.assertApproved(BATCH_ID, cfo)).resolves.toBeUndefined();
  });

  it('ignores a CFO user link to an entity that is not People, even when its record ID is the decider\'s', async () => {
    const calls: AllowedDeciderWorld['calls'] = [];
    const gate = new TasksAppApprovalGate(allowedDeciderProvider(base({
      approvedBy: [OTHER_PERSON_ID], peopleByUser: {}, calls,
      userLinks: { [CFO_USER_ID]: OTHER_PERSON_ID }, userLinkEntities: { [CFO_USER_ID]: CONTACT_ENTITY_ID },
    })));
    await expect(gate.assertApproved(BATCH_ID, cfo)).rejects.toThrow(NOT_THE_APPROVER);
    expect(calls.filter(c => c.EntityName === 'MJ_BizApps_Common: People').map(c => c.ExtraFilter)).toEqual([`LinkedUserID = '${CFO_USER_ID}'`]);
  });

  it('never puts a user link that is not a GUID into the People filter', async () => {
    const calls: AllowedDeciderWorld['calls'] = [];
    const injected = `x' OR 1=1 --`;
    const gate = new TasksAppApprovalGate(allowedDeciderProvider(base({
      approvedBy: [OTHER_PERSON_ID], peopleByUser: {}, calls, userLinks: { [CFO_USER_ID]: injected },
    })));
    await expect(gate.assertApproved(BATCH_ID, cfo)).rejects.toThrow(NOT_THE_APPROVER);
    const peopleFilters = calls.filter(c => c.EntityName === 'MJ_BizApps_Common: People').map(c => c.ExtraFilter);
    expect(peopleFilters).toEqual([`LinkedUserID = '${CFO_USER_ID}'`]);
    expect(peopleFilters.join(' ')).not.toContain('1=1');
  });

  it('fails closed with a message when the people lookup fails', async () => {
    const gate = new TasksAppApprovalGate(allowedDeciderProvider(base({ failPeopleLookup: true })));
    await expect(gate.assertApproved(BATCH_ID, cfo)).rejects.toThrow(/Could not look up the Persons linked to user .*Person lookup failed: database unavailable/);
  });

  it('fails closed with a message when the user lookup fails', async () => {
    const gate = new TasksAppApprovalGate(allowedDeciderProvider(base({ failUserLookup: true })));
    await expect(gate.assertApproved(BATCH_ID, cfo)).rejects.toThrow(/Could not look up the Persons linked to user 48d60bcc.*User lookup failed: users table unavailable/);
  });

  it('fails closed with a message when the decisions cannot be read', async () => {
    const gate = new TasksAppApprovalGate(allowedDeciderProvider(base({ failDecisionsLookup: true })));
    await expect(gate.assertApproved(BATCH_ID, cfo)).rejects.toThrow(/Could not read the decisions on approval task .*decisions table unavailable/);
  });
});

describe('TasksAppApprovalGate.assertApproved — the batch records an approver who did not build it (#446)', () => {
  const world = (over: Partial<AllowedDeciderWorld>): AllowedDeciderWorld => ({
    cfoUserId: CFO_USER_ID,
    batchedByUserId: BUILDER_USER_ID,
    approvedByUserId: CFO_USER_ID,
    approvedBy: [CFO_PERSON_ID],
    peopleByUser: { [CFO_USER_ID]: [CFO_PERSON_ID], [BUILDER_USER_ID]: [BUILDER_PERSON_ID] },
    ...over,
  });

  it('refuses the CFO\'s approval on a batch that records no approver — one written outside the approval', async () => {
    const gate = new TasksAppApprovalGate(allowedDeciderProvider(world({ approvedByUserId: null })));
    await expect(gate.assertApproved(BATCH_ID, cfo)).rejects.toThrow(/records no approver/);
  });

  it('refuses the CFO\'s approval on a batch whose recorded approver built it', async () => {
    const gate = new TasksAppApprovalGate(allowedDeciderProvider(world({ approvedByUserId: BUILDER_USER_ID })));
    await expect(gate.assertApproved(BATCH_ID, cfo)).rejects.toThrow(/recorded approver is the user who built it/);
  });
});

describe('TasksAppApprovalGate.isRejected — a failed decisions read', () => {
  it('throws rather than reading as "not rejected", so a Pending cancel is refused instead of guessed', async () => {
    const gate = new TasksAppApprovalGate(allowedDeciderProvider({
      cfoUserId: CFO_USER_ID, batchedByUserId: BUILDER_USER_ID, approvedByUserId: null, approvedBy: [], peopleByUser: {}, failDecisionsLookup: true,
    }));
    await expect(gate.isRejected(BATCH_ID, cfo)).rejects.toThrow(/Could not read the decisions on approval task/);
  });

  it('still reads a rejection from the stamped Task', async () => {
    const gate = new TasksAppApprovalGate(allowedDeciderProvider({
      cfoUserId: CFO_USER_ID, batchedByUserId: BUILDER_USER_ID, approvedByUserId: null, approvedBy: [], peopleByUser: {}, rejectedBy: [CFO_PERSON_ID],
    }));
    await expect(gate.isRejected(BATCH_ID, cfo)).resolves.toBe(true);
  });
});

describe('TasksAppApprovalGate.onBatchBuilt — the builder is recorded as the Task\'s creator', () => {
  const buildProvider = (builderPeople: string[], builderOwnLink?: string): IMetadataProvider => ({
    GetEntityObject: async (entityName: string) => {
      if (entityName === BATCH_ENTITY) {
        return {
          Load: async () => true, ID: BATCH_ID, CompanyID: COMPANY_ID, JournalEntryBatchNumber: 'BATCH-0007',
          TargetSystem: 'BusinessCentral', PostingDate: new Date('2026-08-31T00:00:00Z'), BatchedByUserID: BUILDER_USER_ID,
        };
      }
      if (entityName === ACP_ENTITY) return { Load: async () => true, ApprovalCFOUserID: CFO_USER_ID };
      if (entityName === 'MJ_BizApps_Tasks: Tasks') return { Load: async () => true, ID: TASK_ID };
      throw new Error(`unexpected entity '${entityName}'`);
    },
    EntityByID: (id: string) => (id === PEOPLE_ENTITY_ID ? { Name: 'MJ_BizApps_Common: People', ParentChain: [] } : undefined),
    EntityByName: (entityName: string) => ({ ID: entityName === BATCH_ENTITY ? BATCH_ENTITY_ID : PEOPLE_ENTITY_ID }),
    RunView: async (params: { EntityName: string; ExtraFilter?: string }) => {
      const filter = (params.ExtraFilter ?? '').toLowerCase();
      if (params.EntityName === 'MJ: Users') {
        // The CFO reaches their Person through LinkedUserID; the builder optionally through their own link.
        const users = [
          { ID: CFO_USER_ID, LinkedEntityID: null, LinkedEntityRecordID: null },
          { ID: BUILDER_USER_ID, LinkedEntityID: builderOwnLink ? PEOPLE_ENTITY_ID : null, LinkedEntityRecordID: builderOwnLink ?? null },
        ];
        return { Success: true, Results: users.filter(u => filter.includes(`'${u.ID.toLowerCase()}'`)) };
      }
      if (params.EntityName === 'MJ_BizApps_Tasks: Task Types') return { Success: true, Results: [{ ID: TASK_ID }] };
      if (params.EntityName === 'MJ_BizApps_Tasks: Task Links') return { Success: true, Results: [{ TaskID: TASK_ID }] };
      if (params.EntityName === 'MJ_BizApps_Common: People') {
        // Rows in creation order; a row matches an ID clause by its ID or a LinkedUserID clause by its LinkedUserID.
        const people = [{ ID: CFO_PERSON_ID, LinkedUserID: CFO_USER_ID }, ...builderPeople.map(ID => ({ ID, LinkedUserID: BUILDER_USER_ID }))];
        const clauses = filter.replace(/ and status = 'active'/, '').split(' or ');
        const matches = (row: { ID: string; LinkedUserID: string }): boolean => clauses.some(c => c.includes('linkeduserid')
          ? c.includes(`'${row.LinkedUserID.toLowerCase()}'`)
          : c.includes(`'${row.ID.toLowerCase()}'`));
        return { Success: true, Results: people.filter(matches) };
      }
      return { Success: true, Results: [] };
    },
  } as unknown as IMetadataProvider);

  const capture = (gate: TasksAppApprovalGate, requests: Array<{ CreatedByPersonID?: string }>): void => {
    (gate as unknown as { orchestration: { CreateApprovalRequest: (req: { CreatedByPersonID?: string }) => Promise<void> } })
      .orchestration = { CreateApprovalRequest: async (req) => { requests.push(req); } };
  };

  it('passes the builder\'s Person as CreatedByPersonID', async () => {
    const requests: Array<{ CreatedByPersonID?: string }> = [];
    const gate = new TasksAppApprovalGate(buildProvider([BUILDER_PERSON_ID]));
    capture(gate, requests);
    await gate.onBatchBuilt(BATCH_ID, cfo);
    expect(requests[0].CreatedByPersonID).toBe(BUILDER_PERSON_ID);
  });

  it('records the builder\'s own People link, the Person the tasks app resolves, when the builder has several', async () => {
    const requests: Array<{ CreatedByPersonID?: string }> = [];
    // The view answers in an order that puts another Person first; the own link still wins.
    const gate = new TasksAppApprovalGate(buildProvider([OTHER_PERSON_ID, BUILDER_PERSON_ID], BUILDER_PERSON_ID));
    capture(gate, requests);
    await gate.onBatchBuilt(BATCH_ID, cfo);
    expect(requests[0].CreatedByPersonID).toBe(BUILDER_PERSON_ID);
  });

  it('leaves CreatedByPersonID blank, and still builds, when the builder has no Person', async () => {
    const requests: Array<{ CreatedByPersonID?: string }> = [];
    const gate = new TasksAppApprovalGate(buildProvider([]));
    capture(gate, requests);
    await expect(gate.onBatchBuilt(BATCH_ID, cfo)).resolves.toBe(TASK_ID);
    expect(requests[0].CreatedByPersonID).toBeUndefined();
  });
});
