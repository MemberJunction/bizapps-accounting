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

  it('refuses when the cancelling user has no linked Person, so the cancel rolls back rather than going unrecorded', async () => {
    const w: CancelWorld = { comments: [] };
    const gate = new TasksAppApprovalGate(cancelProvider({ cfoUserId: CFO_USER_ID, approvalTaskId: TASK_ID, hasPerson: false }, w));
    await expect(gate.recordCancellation(BATCH_ID, { reason: 'Wrong posting period', fromStatus: 'Approved' }, cfo)).rejects.toThrow(/has no linked Person/);
    expect(w.comments).toHaveLength(0);
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

  it('refuses an allowed user with no linked Person when the batch has an approval Task', async () => {
    const gate = new TasksAppApprovalGate(cancelProvider({ cfoUserId: CFO_USER_ID, approvalTaskId: TASK_ID, hasPerson: false }, world()));
    await expect(gate.assertMayCancelPending(BATCH_ID, { ID: BUILDER_USER_ID } as UserInfo)).rejects.toThrow(/has no linked Person/);
  });

  it('does not ask for a Person when only a Task Link, not the stamp, names an approval Task (#223)', async () => {
    const gate = new TasksAppApprovalGate(cancelProvider({ cfoUserId: CFO_USER_ID, approvalTaskId: null, hasPerson: false }, world()));
    await expect(gate.assertMayCancelPending(BATCH_ID, { ID: BUILDER_USER_ID } as UserInfo)).resolves.toBeUndefined();
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
function decisionProvider(opts: { hasTask: boolean; outcomeIds: string[]; forgedRejectedLink?: boolean }): IMetadataProvider {
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
        if (opts.forgedRejectedLink) return { Success: true, Results: [{ TaskID: FORGED_TASK_ID }] };
        return { Success: true, Results: opts.hasTask ? [{ TaskID: TASK_ID }] : [] };
      }
      if (params.EntityName === 'MJ_BizApps_Tasks: Task Decisions') {
        const outcomeIds = params.ExtraFilter?.includes(FORGED_TASK_ID) ? [REJECTED_OUTCOME_ID] : opts.outcomeIds;
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

// ─── only an allowed decider's approval counts (golive #320 §3) ─────────────

const CFO_PERSON_ID = 'c0c0c0c0-0000-4000-8000-0000000c0f00';
const BUILDER_PERSON_ID = 'b0b0b0b0-0000-4000-8000-0000000b0d00';
const OTHER_PERSON_ID = 'd0d0d0d0-0000-4000-8000-0000000d0d00';
const PEOPLE_ENTITY_ID = 'e0e0e0e0-0000-4000-8000-0000000e0e00';
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
        const byLinkedUser = Object.entries(w.peopleByUser).filter(([userId]) => filter.includes(`LinkedUserID='${userId}'`)).flatMap(([, ids]) => ids);
        const byOwnLink = [...filter.matchAll(/ID='([0-9a-f-]{36})'/g)].map(m => m[1]).filter(id => !filter.includes(`LinkedUserID='${id}'`));
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
    expect(calls.filter(c => c.EntityName === 'MJ_BizApps_Common: People').map(c => c.ExtraFilter)).toEqual([`LinkedUserID='${CFO_USER_ID}'`]);
  });

  it('never puts a user link that is not a GUID into the People filter', async () => {
    const calls: AllowedDeciderWorld['calls'] = [];
    const injected = `x' OR 1=1 --`;
    const gate = new TasksAppApprovalGate(allowedDeciderProvider(base({
      approvedBy: [OTHER_PERSON_ID], peopleByUser: {}, calls, userLinks: { [CFO_USER_ID]: injected },
    })));
    await expect(gate.assertApproved(BATCH_ID, cfo)).rejects.toThrow(NOT_THE_APPROVER);
    const peopleFilters = calls.filter(c => c.EntityName === 'MJ_BizApps_Common: People').map(c => c.ExtraFilter);
    expect(peopleFilters).toEqual([`LinkedUserID='${CFO_USER_ID}'`]);
    expect(peopleFilters.join(' ')).not.toContain('1=1');
  });

  it('fails closed with a message when the people lookup fails', async () => {
    const gate = new TasksAppApprovalGate(allowedDeciderProvider(base({ failPeopleLookup: true })));
    await expect(gate.assertApproved(BATCH_ID, cfo)).rejects.toThrow(/Could not look up the people linked to user .*database unavailable/);
  });

  it('fails closed with a message when the user lookup fails', async () => {
    const gate = new TasksAppApprovalGate(allowedDeciderProvider(base({ failUserLookup: true })));
    await expect(gate.assertApproved(BATCH_ID, cfo)).rejects.toThrow(/Could not look up user 48d60bcc.*users table unavailable/);
  });

  it('fails closed with a message when the decisions cannot be read', async () => {
    const gate = new TasksAppApprovalGate(allowedDeciderProvider(base({ failDecisionsLookup: true })));
    await expect(gate.assertApproved(BATCH_ID, cfo)).rejects.toThrow(/Could not read the decisions on approval task .*decisions table unavailable/);
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
    EntityByName: (entityName: string) => ({ ID: entityName === BATCH_ENTITY ? BATCH_ENTITY_ID : OTHER_USER_ID }),
    EntityByID: (id: string) => (id === PEOPLE_ENTITY_ID ? { Name: 'MJ_BizApps_Common: People', ParentChain: [] } : undefined),
    RunView: async (params: { EntityName: string; ExtraFilter?: string }) => {
      if (params.EntityName === 'MJ: Users') {
        const own = builderOwnLink && params.ExtraFilter?.includes(BUILDER_USER_ID);
        return { Success: true, Results: [own ? { LinkedEntityID: PEOPLE_ENTITY_ID, LinkedEntityRecordID: builderOwnLink } : { LinkedEntityID: null, LinkedEntityRecordID: null }] };
      }
      if (params.EntityName === 'MJ_BizApps_Tasks: Task Types') return { Success: true, Results: [{ ID: TASK_ID }] };
      if (params.EntityName === 'MJ_BizApps_Tasks: Task Links') return { Success: true, Results: [{ TaskID: TASK_ID }] };
      if (params.EntityName === 'MJ_BizApps_Common: People') {
        return { Success: true, Results: params.ExtraFilter?.includes(BUILDER_USER_ID) ? builderPeople.map(ID => ({ ID })) : [] };
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
