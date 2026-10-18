/**
 * golive #353 — manual journal entry approval. No database: routing and the decider rule are pure,
 * and the service runs against a stub provider that answers only the reads each path makes. The
 * tasks-core orchestration service is replaced so the Task writes are recorded, not performed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IMetadataProvider, UserInfo } from '@memberjunction/core';

const tasks = vi.hoisted(() => ({
  createApprovalRequest: vi.fn(),
  recordDecision: vi.fn(),
}));
vi.mock('@mj-biz-apps/tasks-core', async importOriginal => {
  const actual = await importOriginal<typeof import('@mj-biz-apps/tasks-core')>();
  return {
    ...actual,
    TaskOrchestrationService: class {
      CreateApprovalRequest = tasks.createApprovalRequest;
      RecordDecision = tasks.recordDecision;
    },
  };
});

import {
  AssertMayDecideManualJournalEntry,
  IsManualJournalEntry,
  ManualJournalEntryApprovalError,
  ManualJournalEntryApprovalService,
  RouteManualJournalEntryApproval,
  type ManualJournalEntryApprovalPolicy,
} from '../ManualJournalEntryApproval.js';
import type { JournalEntryEntityServer } from '../JournalEntryEntityServer.js';

const COMPANY = '11111111-1111-4111-8111-111111111111';
const CFO = '22222222-2222-4222-8222-222222222222';
const CREATOR = '33333333-3333-4333-8333-333333333333';
const APPROVER_A = '44444444-4444-4444-8444-444444444444';
const APPROVER_B = '55555555-5555-4555-8555-555555555555';
const ROLE = '66666666-6666-4666-8666-666666666666';
const JE_ID = '77777777-7777-4777-8777-777777777777';
const TASK_ID = '88888888-8888-4888-8888-888888888888';
const GL_PLAIN = '99999999-9999-4999-8999-999999999991';
const GL_CONTROL = '99999999-9999-4999-8999-999999999992';
const MANUAL_TYPE = 'aaaaaaaa-0000-4000-8000-000000000001';
const SUMMARY_TYPE = 'aaaaaaaa-0000-4000-8000-000000000002';
const PERSON = 'bbbbbbbb-0000-4000-8000-000000000001';

const POLICY: ManualJournalEntryApprovalPolicy = { Threshold: 5000, ApproverRoleID: ROLE, CFOUserID: CFO };

describe('RouteManualJournalEntryApproval — pure routing', () => {
  const route = (overrides: Partial<Parameters<typeof RouteManualJournalEntryApproval>[0]> = {}) =>
    RouteManualJournalEntryApproval({
      TotalDebits: 1200,
      TouchesControlAccount: false,
      RequesterUserID: CREATOR,
      Policy: POLICY,
      RoleHolderUserIDs: [APPROVER_A, APPROVER_B],
      ...overrides,
    });

  it('sends an entry within the threshold to every holder of the approver role', () => {
    const plan = route();
    expect(plan.Level).toBe('Standard');
    expect(plan.ApproverUserIDs).toEqual([APPROVER_A, APPROVER_B]);
  });

  it('treats the threshold itself as within it ("up to $5,000")', () => {
    expect(route({ TotalDebits: 5000 }).Level).toBe('Standard');
  });

  it('sends an entry above the threshold to the Approval CFO', () => {
    const plan = route({ TotalDebits: 5000.01 });
    expect(plan).toMatchObject({ Level: 'CFO', ApproverUserIDs: [CFO] });
    expect(plan.Reason).toMatch(/5,000\.01 is above .* 5,000\.00/);
  });

  it('sends a control-account entry to the CFO whatever its amount', () => {
    expect(route({ TotalDebits: 1, TouchesControlAccount: true })).toMatchObject({ Level: 'CFO', Reason: 'it has a line on a control account' });
  });

  it('sends everything to the CFO when the company has no approver role', () => {
    expect(route({ Policy: { ...POLICY, ApproverRoleID: null }, RoleHolderUserIDs: [] }).Level).toBe('CFO');
  });

  it('never assigns the requester, and de-duplicates holders case-insensitively', () => {
    const plan = route({ RequesterUserID: APPROVER_A, RoleHolderUserIDs: [APPROVER_A, APPROVER_B, APPROVER_B.toUpperCase()] });
    expect(plan.ApproverUserIDs).toEqual([APPROVER_B]);
  });

  it('escalates to the CFO when the requester is the only holder of the role', () => {
    const plan = route({ RequesterUserID: APPROVER_A, RoleHolderUserIDs: [APPROVER_A.toUpperCase()] });
    expect(plan).toMatchObject({ Level: 'CFO', ApproverUserIDs: [CFO] });
    expect(plan.Reason).toMatch(/no active holder .* other than you/);
  });

  it('refuses a CFO-level entry when the company has no Approval CFO', () => {
    expect(() => route({ TotalDebits: 9000, Policy: { ...POLICY, CFOUserID: null } })).toThrow(ManualJournalEntryApprovalError);
    expect(() => route({ TotalDebits: 9000, Policy: { ...POLICY, CFOUserID: null } })).toThrow(/has no Approval CFO/);
  });

  it("refuses the CFO's own CFO-level entry rather than routing it to someone with less authority", () => {
    expect(() => route({ TotalDebits: 9000, RequesterUserID: CFO.toUpperCase() })).toThrow(/you are the Approval CFO.*Nobody may approve their own entry/);
  });

  it("still routes the CFO's own small entry to the approver role", () => {
    expect(route({ RequesterUserID: CFO })).toMatchObject({ Level: 'Standard', ApproverUserIDs: [APPROVER_A, APPROVER_B] });
  });

  it('refuses when there is no requester or the total is not a number', () => {
    expect(() => route({ RequesterUserID: '' })).toThrow(/signed-in user/);
    expect(() => route({ TotalDebits: Number.NaN })).toThrow(/total could not be worked out/);
  });
});

describe('AssertMayDecideManualJournalEntry — who may decide', () => {
  const decide = (overrides: Partial<Parameters<typeof AssertMayDecideManualJournalEntry>[0]> = {}) =>
    AssertMayDecideManualJournalEntry({
      Level: 'Standard',
      RequesterUserID: CREATOR,
      DeciderUserID: APPROVER_A,
      CFOUserID: CFO,
      DeciderHoldsApproverRole: true,
      EntryLabel: 'Journal entry JE-1',
      ...overrides,
    });

  it('lets a holder of the approver role decide a Standard entry', () => {
    expect(() => decide()).not.toThrow();
  });

  it('lets the CFO decide a Standard entry without holding the role', () => {
    expect(() => decide({ DeciderUserID: CFO, DeciderHoldsApproverRole: false })).not.toThrow();
  });

  it('refuses the requester, even when the requester holds the role or is the CFO', () => {
    expect(() => decide({ DeciderUserID: CREATOR })).toThrow(/you raised this approval request/);
    expect(() => decide({ Level: 'CFO', RequesterUserID: CFO, DeciderUserID: CFO.toUpperCase() })).toThrow(/you raised this approval request/);
  });

  it('refuses a Standard entry to someone with neither the role nor the CFO seat', () => {
    expect(() => decide({ DeciderHoldsApproverRole: false })).toThrow(/only a holder of the company's manual-entry approver role/);
  });

  it('refuses a CFO-level entry to anyone but the CFO, role or not', () => {
    expect(() => decide({ Level: 'CFO' })).toThrow(/only the company's Approval CFO/);
    expect(() => decide({ Level: 'CFO', DeciderUserID: CFO })).not.toThrow();
  });

  it('refuses a CFO-level entry when the company has no CFO', () => {
    expect(() => decide({ Level: 'CFO', CFOUserID: null, DeciderUserID: CFO })).toThrow(/only the company's Approval CFO/);
  });
});

describe('IsManualJournalEntry', () => {
  it('is true only when the D25 origin pair is empty', () => {
    expect(IsManualJournalEntry({ LinkedEntityID: null, LinkedRecordID: null })).toBe(true);
    expect(IsManualJournalEntry({ LinkedEntityID: 'x', LinkedRecordID: 'y' })).toBe(false);
  });
});

// ─── the service, over a stub provider ───────────────────────────────────────────────────────

interface World {
  threshold: number | null;
  roleId: string | null;
  cfo: string | null;
  profileExists?: boolean;
  controlAccounts?: string[];
  roleHolders?: Array<{ ID: string; IsActive: boolean }>;
  deciderHoldsRole?: boolean;
  taskStatus?: string;
  taskLoads?: boolean;
  entry?: Partial<FakeEntry>;
  /** The header a standalone line's parent read returns (AssertStandaloneLineChangeAllowed). */
  parentHeader?: { EntryNumber: string; Status: string; CompanyID: string; LinkedEntityID: string | null; LinkedRecordID: string | null; ApprovalLevel: string | null } | null;
  saves: Array<Record<string, unknown>>;
  taskSaves: string[];
  tx: { begin: number; commit: number; rollback: number };
  views: string[];
}

interface FakeEntry {
  ID: string;
  EntryNumber: string;
  CompanyID: string;
  EntryTypeID: string;
  EffectiveDate: Date;
  Description: string | null;
  Status: string;
  LinkedEntityID: string | null;
  LinkedRecordID: string | null;
  IsSaved: boolean;
  ApprovalLevel: 'Standard' | 'CFO' | null;
  ApprovalRequestedByUserID: string | null;
  ApprovalTaskID: string | null;
  ApprovedAt: Date | null;
  ApprovedByUserID: string | null;
  changed: boolean;
  lines: Array<{ GLAccountID: string; DebitAmount: number | null; CreditAmount: number | null }>;
  saveResult: boolean;
}

function fakeEntry(world: World): FakeEntry & Record<string, unknown> {
  const entry = {
    ID: JE_ID,
    EntryNumber: 'JE-ACME-2026-0001',
    CompanyID: COMPANY,
    EntryTypeID: MANUAL_TYPE,
    EffectiveDate: new Date('2026-10-15T00:00:00.000Z'),
    Description: 'Accrual true-up',
    Status: 'Pending',
    LinkedEntityID: null,
    LinkedRecordID: null,
    IsSaved: false,
    ApprovalLevel: null,
    ApprovalRequestedByUserID: null,
    ApprovalTaskID: null,
    ApprovedAt: null,
    ApprovedByUserID: null,
    changed: true,
    lines: [
      { GLAccountID: GL_PLAIN, DebitAmount: 1200, CreditAmount: null },
      { GLAccountID: GL_PLAIN, DebitAmount: null, CreditAmount: 1200 },
    ],
    saveResult: true,
    ...world.entry,
  };
  return Object.assign(entry, {
    get Lines() { return { IsLoaded: true, Items: entry.lines }; },
    HasApprovalRelevantChanges: () => entry.changed,
    LoadLines: async () => entry.lines,
    Load: async () => true,
    LatestResult: { CompleteMessage: 'save failed' },
    Save: async () => {
      world.saves.push({ ApprovedAt: entry.ApprovedAt, ApprovedByUserID: entry.ApprovedByUserID });
      return entry.saveResult;
    },
  });
}

function stub(world: World): { provider: IMetadataProvider; entry: ReturnType<typeof fakeEntry> } {
  const entry = fakeEntry(world);
  const provider = {
    GetEntityObject: async (name: string) => {
      if (name === 'MJ_BizApps_Accounting: Accounting Company Profiles') {
        return {
          Load: async () => world.profileExists !== false,
          ManualJournalEntryApprovalThreshold: world.threshold,
          ManualJournalEntryApproverRoleID: world.roleId,
          ApprovalCFOUserID: world.cfo,
        };
      }
      if (name === 'MJ_BizApps_Accounting: Journal Entries') return entry;
      if (name === 'MJ_BizApps_Tasks: Tasks') {
        const task = {
          ID: TASK_ID,
          Status: world.taskStatus ?? 'Open',
          LatestResult: null,
          Load: async () => world.taskLoads !== false,
          Save: async () => { world.taskSaves.push(task.Status); return true; },
        };
        return task;
      }
      throw new Error(`stub: unexpected entity ${name}`);
    },
    EntityByName: (name: string) => ({ ID: `entity:${name}` }),
    RunView: async (params: { EntityName: string; ExtraFilter?: string }) => {
      world.views.push(params.EntityName);
      switch (params.EntityName) {
        case 'MJ_BizApps_Accounting: Journal Entry Types':
          return { Success: true, Results: [params.ExtraFilter?.includes(SUMMARY_TYPE)
            ? { ID: SUMMARY_TYPE, Code: 'JournalEntryBatchSummary', IsJournalEntryBatchSummary: true }
            : { ID: MANUAL_TYPE, Code: 'Manual', IsJournalEntryBatchSummary: false }] };
        case 'MJ_BizApps_Accounting: GL Accounts':
          return { Success: true, Results: [GL_PLAIN, GL_CONTROL].filter(id => params.ExtraFilter?.includes(id)).map(id => ({ ID: id, IsControlAccount: (world.controlAccounts ?? []).includes(id) })) };
        case 'MJ: User Roles':
          if (params.ExtraFilter?.includes('UserID=')) return { Success: true, Results: world.deciderHoldsRole ? [{ ID: 'ur-1' }] : [] };
          return { Success: true, Results: (world.roleHolders ?? []).map(u => ({ UserID: u.ID })) };
        case 'MJ: Users':
          return { Success: true, Results: world.roleHolders ?? [] };
        case 'MJ_BizApps_Tasks: Task Types':
          return { Success: true, Results: [{ ID: 'task-type-approval' }] };
        case 'MJ_BizApps_Common: People':
          return { Success: true, Results: [{ ID: PERSON }] };
        case 'MJ_BizApps_Accounting: Journal Entries':
          return { Success: true, Results: world.parentHeader ? [world.parentHeader] : [] };
        default:
          throw new Error(`stub: unexpected view ${params.EntityName}`);
      }
    },
    BeginTransaction: async () => { world.tx.begin++; },
    CommitTransaction: async () => { world.tx.commit++; },
    RollbackTransaction: async () => { world.tx.rollback++; },
  } as unknown as IMetadataProvider;
  return { provider, entry };
}

function world(overrides: Partial<World> = {}): World {
  return {
    threshold: 5000,
    roleId: ROLE,
    cfo: CFO,
    roleHolders: [{ ID: APPROVER_A, IsActive: true }, { ID: APPROVER_B, IsActive: false }],
    saves: [],
    taskSaves: [],
    tx: { begin: 0, commit: 0, rollback: 0 },
    views: [],
    ...overrides,
  };
}

const user = (id: string) => ({ ID: id, Email: `${id}@example.test` }) as UserInfo;
const asEntry = (e: ReturnType<typeof fakeEntry>) => e as unknown as JournalEntryEntityServer;

describe('ManualJournalEntryApprovalService.PlanForSave', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does nothing, without a query, for an entry a booking path created', async () => {
    const w = world({ entry: { LinkedEntityID: 'entity', LinkedRecordID: 'order-line' } });
    const { provider, entry } = stub(w);
    expect(await new ManualJournalEntryApprovalService(provider).PlanForSave(asEntry(entry), user(CREATOR))).toBeNull();
    expect(w.views).toEqual([]);
  });

  it('does nothing when the company has no threshold: existing installs are unaffected', async () => {
    const { provider, entry } = stub(world({ threshold: null }));
    expect(await new ManualJournalEntryApprovalService(provider).PlanForSave(asEntry(entry), user(CREATOR))).toBeNull();
  });

  it('does nothing when the company has no Accounting Company Profile', async () => {
    const { provider, entry } = stub(world({ profileExists: false }));
    expect(await new ManualJournalEntryApprovalService(provider).PlanForSave(asEntry(entry), user(CREATOR))).toBeNull();
  });

  it('does nothing for a batch summary entry, a non-Pending entry, or a save that changes nothing it covers', async () => {
    for (const entryOverrides of [{ EntryTypeID: SUMMARY_TYPE }, { Status: 'Batched' }, { IsSaved: true, changed: false }]) {
      const { provider, entry } = stub(world({ entry: entryOverrides }));
      expect(await new ManualJournalEntryApprovalService(provider).PlanForSave(asEntry(entry), user(CREATOR))).toBeNull();
    }
  });

  it('routes a small entry to the ACTIVE holders of the approver role', async () => {
    const { provider, entry } = stub(world());
    const action = await new ManualJournalEntryApprovalService(provider).PlanForSave(asEntry(entry), user(CREATOR));
    expect(action).toEqual({ Action: 'Raise', Plan: expect.objectContaining({ Level: 'Standard', ApproverUserIDs: [APPROVER_A], TotalDebits: 1200 }) });
  });

  it('routes an entry with a line on a control account to the CFO', async () => {
    const w = world({ controlAccounts: [GL_CONTROL], entry: { lines: [
      { GLAccountID: GL_CONTROL, DebitAmount: 10, CreditAmount: null },
      { GLAccountID: GL_PLAIN, DebitAmount: null, CreditAmount: 10 },
    ] } });
    const { provider, entry } = stub(w);
    const action = await new ManualJournalEntryApprovalService(provider).PlanForSave(asEntry(entry), user(CREATOR));
    expect(action).toEqual({ Action: 'Raise', Plan: expect.objectContaining({ Level: 'CFO', ApproverUserIDs: [CFO] }) });
  });

  it('refuses the save when nobody may approve it', async () => {
    const { provider, entry } = stub(world({ cfo: null, entry: { lines: [
      { GLAccountID: GL_PLAIN, DebitAmount: 7500, CreditAmount: null },
      { GLAccountID: GL_PLAIN, DebitAmount: null, CreditAmount: 7500 },
    ] } }));
    await expect(new ManualJournalEntryApprovalService(provider).PlanForSave(asEntry(entry), user(CREATOR))).rejects.toThrow(/has no Approval CFO/);
  });

  it('clears the approval of a changed entry once its company turns the feature off', async () => {
    const { provider, entry } = stub(world({ threshold: null, entry: { IsSaved: true, ApprovalLevel: 'Standard' } }));
    expect(await new ManualJournalEntryApprovalService(provider).PlanForSave(asEntry(entry), user(CREATOR))).toEqual({ Action: 'Clear' });
  });

  it('fails loudly when a read it depends on fails, rather than routing below the CFO', async () => {
    const { provider, entry } = stub(world());
    const failing = { ...provider, RunView: async () => ({ Success: false, ErrorMessage: 'boom', Results: [] }) } as unknown as IMetadataProvider;
    await expect(new ManualJournalEntryApprovalService(failing).PlanForSave(asEntry(entry), user(CREATOR))).rejects.toThrow(/boom/);
  });

  it('refuses to be built without a provider', () => {
    expect(() => new ManualJournalEntryApprovalService(undefined as unknown as IMetadataProvider)).toThrow(/without a database provider/);
  });
});

describe('ManualJournalEntryApprovalService — Task writes', () => {
  beforeEach(() => vi.clearAllMocks());

  it('raises one approval Task linked to the entry and assigned to the planned users', async () => {
    tasks.createApprovalRequest.mockResolvedValue({ ID: TASK_ID });
    const { provider, entry } = stub(world({ entry: { IsSaved: true } }));
    const taskId = await new ManualJournalEntryApprovalService(provider).RaiseApprovalTask(
      asEntry(entry), { Level: 'CFO', ApproverUserIDs: [CFO], Reason: 'it has a line on a control account', TotalDebits: 10 }, user(CREATOR));
    expect(taskId).toBe(TASK_ID);
    expect(tasks.createApprovalRequest).toHaveBeenCalledWith(expect.objectContaining({
      LinkEntityID: 'entity:MJ_BizApps_Accounting: Journal Entries',
      LinkRecordID: JE_ID,
      ApproverPersonEntityID: 'entity:MJ: Users',
      ApproverPersonRecordIDs: [CFO],
      Priority: 'High',
    }), expect.anything());
    expect(tasks.createApprovalRequest.mock.calls[0][0].Description).toMatch(/2026-10-15.*control account/);
  });

  it('refuses to raise a Task for an unsaved entry or with nobody to send it to', async () => {
    const { provider, entry } = stub(world());
    const service = new ManualJournalEntryApprovalService(provider);
    await expect(service.RaiseApprovalTask(asEntry(entry), { Level: 'CFO', ApproverUserIDs: [CFO], Reason: 'r', TotalDebits: 1 }, user(CREATOR))).rejects.toThrow(/must be saved/);
    entry.IsSaved = true;
    await expect(service.RaiseApprovalTask(asEntry(entry), { Level: 'CFO', ApproverUserIDs: [], Reason: 'r', TotalDebits: 1 }, user(CREATOR))).rejects.toThrow(/nobody to send/);
  });

  it('closes a superseded open Task, leaves a decided one alone, and refuses one that does not load', async () => {
    const open = world();
    await new ManualJournalEntryApprovalService(stub(open).provider).CloseSupersededTask(TASK_ID, user(CREATOR));
    expect(open.taskSaves).toEqual(['Cancelled']);

    const decided = world({ taskStatus: 'Completed' });
    await new ManualJournalEntryApprovalService(stub(decided).provider).CloseSupersededTask(TASK_ID, user(CREATOR));
    expect(decided.taskSaves).toEqual([]);

    await expect(new ManualJournalEntryApprovalService(stub(world({ taskLoads: false })).provider).CloseSupersededTask(TASK_ID, user(CREATOR)))
      .rejects.toThrow(/did not load/);
  });
});

describe('ManualJournalEntryApprovalService.RecordDecision', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tasks.recordDecision.mockResolvedValue({});
  });

  const awaiting = { IsSaved: true, ApprovalLevel: 'Standard' as const, ApprovalRequestedByUserID: CREATOR, ApprovalTaskID: TASK_ID };

  it('approves: records the decision on the stamped Task and stamps the entry, in one transaction', async () => {
    const w = world({ deciderHoldsRole: true, entry: awaiting });
    const result = await new ManualJournalEntryApprovalService(stub(w).provider).RecordDecision(JE_ID, 'Approved', '  fine  ', user(APPROVER_A));
    expect(result.Approved).toBe(true);
    expect(result.ApprovedAt).toBeInstanceOf(Date);
    expect(tasks.recordDecision).toHaveBeenCalledWith({ TaskID: TASK_ID, OutcomeCode: 'Approved', DecidedByPersonID: PERSON, Notes: 'fine' }, expect.anything());
    expect(w.saves).toEqual([{ ApprovedAt: expect.any(Date), ApprovedByUserID: APPROVER_A }]);
    expect(w.tx).toEqual({ begin: 1, commit: 1, rollback: 0 });
  });

  it('rejects: records the decision and leaves the entry unapproved', async () => {
    const w = world({ deciderHoldsRole: true, entry: awaiting });
    const result = await new ManualJournalEntryApprovalService(stub(w).provider).RecordDecision(JE_ID, 'Rejected', 'wrong account', user(APPROVER_A));
    expect(result).toEqual({ Approved: false, ApprovedAt: null });
    expect(w.saves).toEqual([]);
    expect(w.tx.commit).toBe(1);
  });

  it('rolls back and reports when stamping the entry fails', async () => {
    const w = world({ deciderHoldsRole: true, entry: { ...awaiting, saveResult: false } });
    await expect(new ManualJournalEntryApprovalService(stub(w).provider).RecordDecision(JE_ID, 'Approved', undefined, user(APPROVER_A)))
      .rejects.toThrow(/recording the approval on the entry failed: save failed/);
    expect(w.tx).toEqual({ begin: 1, commit: 0, rollback: 1 });
  });

  it('refuses the user who raised the request', async () => {
    const w = world({ deciderHoldsRole: true, entry: awaiting });
    await expect(new ManualJournalEntryApprovalService(stub(w).provider).RecordDecision(JE_ID, 'Approved', undefined, user(CREATOR)))
      .rejects.toThrow(/you raised this approval request/);
    expect(tasks.recordDecision).not.toHaveBeenCalled();
  });

  it('refuses a role holder on a CFO-level entry', async () => {
    const w = world({ deciderHoldsRole: true, entry: { ...awaiting, ApprovalLevel: 'CFO' } });
    await expect(new ManualJournalEntryApprovalService(stub(w).provider).RecordDecision(JE_ID, 'Approved', undefined, user(APPROVER_A)))
      .rejects.toThrow(/only the company's Approval CFO/);
  });

  it.each([
    ['an entry that needs no approval', { ...awaiting, ApprovalLevel: null }, /does not need approval/],
    ['an entry already approved', { ...awaiting, ApprovedAt: new Date() }, /already approved/],
    ['an entry no longer Pending', { ...awaiting, Status: 'Batched' }, /only a Pending entry/],
    ['an entry with no approval Task', { ...awaiting, ApprovalTaskID: null }, /no approval request to decide/],
  ])('refuses %s', async (_label, entry, message) => {
    const w = world({ deciderHoldsRole: true, entry });
    await expect(new ManualJournalEntryApprovalService(stub(w).provider).RecordDecision(JE_ID, 'Approved', undefined, user(APPROVER_A))).rejects.toThrow(message);
    expect(tasks.recordDecision).not.toHaveBeenCalled();
  });

  it('refuses a request that was already decided or closed', async () => {
    const w = world({ deciderHoldsRole: true, taskStatus: 'Cancelled', entry: awaiting });
    await expect(new ManualJournalEntryApprovalService(stub(w).provider).RecordDecision(JE_ID, 'Approved', undefined, user(APPROVER_A)))
      .rejects.toThrow(/already rejected or closed/);
  });

  it('refuses an id that is not a GUID before any read', async () => {
    const w = world();
    await expect(new ManualJournalEntryApprovalService(stub(w).provider).RecordDecision("x' OR 1=1 --", 'Approved', undefined, user(APPROVER_A))).rejects.toThrow();
    expect(w.views).toEqual([]);
  });
});

describe('ManualJournalEntryApprovalService.AssertStandaloneLineChangeAllowed — a line written on its own', () => {
  const header = (overrides: Partial<NonNullable<World['parentHeader']>> = {}) => ({
    EntryNumber: 'JE-ACME-2026-0001', Status: 'Pending', CompanyID: COMPANY, LinkedEntityID: null, LinkedRecordID: null, ApprovalLevel: null, ...overrides,
  });
  const assertFor = (w: World) => new ManualJournalEntryApprovalService(stub(w).provider).AssertStandaloneLineChangeAllowed(JE_ID, user(CREATOR));

  it('is refused on a Pending manual entry that has an approval level, even with the feature since turned off', async () => {
    await expect(assertFor(world({ threshold: null, parentHeader: header({ ApprovalLevel: 'Standard' }) }))).rejects.toThrow(/only by saving the journal entry itself/);
  });

  it('is refused on a Pending manual entry whose company has a threshold', async () => {
    await expect(assertFor(world({ parentHeader: header() }))).rejects.toThrow(ManualJournalEntryApprovalError);
  });

  it.each([
    ['a booking-path entry', { LinkedEntityID: 'entity', LinkedRecordID: 'order-line' }, 5000],
    ['an entry no longer Pending', { Status: 'Batched', ApprovalLevel: 'CFO' }, 5000],
    ['a manual entry of a company with the feature off', {}, null],
  ])('is allowed on %s', async (_label, overrides, threshold) => {
    await expect(assertFor(world({ threshold, parentHeader: header(overrides) }))).resolves.toBeUndefined();
  });

  it('leaves a missing parent or a malformed id to the FK and the line validation', async () => {
    await expect(assertFor(world({ parentHeader: null }))).resolves.toBeUndefined();
    const w = world({ parentHeader: header({ ApprovalLevel: 'CFO' }) });
    await expect(new ManualJournalEntryApprovalService(stub(w).provider).AssertStandaloneLineChangeAllowed('not-a-guid', user(CREATOR))).resolves.toBeUndefined();
    expect(w.views).toEqual([]);
  });

  it('fails loudly when the parent read fails', async () => {
    const { provider } = stub(world());
    const failing = { ...provider, RunView: async () => ({ Success: false, ErrorMessage: 'timeout', Results: [] }) } as unknown as IMetadataProvider;
    await expect(new ManualJournalEntryApprovalService(failing).AssertStandaloneLineChangeAllowed(JE_ID, user(CREATOR))).rejects.toThrow(/timeout/);
  });
});
