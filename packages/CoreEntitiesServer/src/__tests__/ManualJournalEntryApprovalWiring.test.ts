/**
 * golive #353, PR #463 review — the approval WIRING inside the entity servers, on real entity objects
 * (mock EntityInfo, no database). The service itself is covered by ManualJournalEntryApproval.test.ts;
 * these pin what the review's surviving mutations showed was untested:
 *   - JournalEntryEntityServer.HasApprovalRelevantChanges sees line changes;
 *   - a re-routed save clears ApprovedAt / ApprovedByUserID before the write (applyApprovalAction);
 *   - JournalEntryLineEntityServer / JournalEntryLineDimensionEntityServer call the standalone guard;
 *   - the approval columns and the D25 origin pair cannot be written by an ordinary save — the
 *     review's two Required findings (the author typing in an approval; setting the origin pair).
 *
 * The persistence step (BaseEntity.Save) is replaced by a recorder that runs Validate() as the real
 * one does and snapshots the row it would have written.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BaseEntity, EntityInfo, Metadata, type UserInfo } from '@memberjunction/core';

const approval = vi.hoisted(() => ({
  planForSave: vi.fn(),
  raiseApprovalTask: vi.fn(),
  closeSupersededTask: vi.fn(),
  assertLine: vi.fn(),
  assertDimension: vi.fn(),
}));
vi.mock('../ManualJournalEntryApproval.js', async importOriginal => {
  const actual = await importOriginal<typeof import('../ManualJournalEntryApproval.js')>();
  return {
    ...actual,
    ManualJournalEntryApprovalService: class {
      PlanForSave = approval.planForSave;
      RaiseApprovalTask = approval.raiseApprovalTask;
      CloseSupersededTask = approval.closeSupersededTask;
      AssertStandaloneLineChangeAllowed = approval.assertLine;
      AssertStandaloneDimensionChangeAllowed = approval.assertDimension;
    },
  };
});
vi.mock('../JournalEntryTypes.js', () => ({
  LookupJournalEntryTypeByID: vi.fn(async () => ({ ID: 'JET_MANUAL', Code: 'Manual', IsJournalEntryBatchSummary: false, IsActive: true })),
  RequireJournalEntryTypeID: vi.fn(async () => 'JET_REVERSAL'),
}));

import { JournalEntryEntityServer } from '../JournalEntryEntityServer.js';
import { JournalEntryLineEntityServer } from '../JournalEntryLineEntityServer.js';
import { JournalEntryLineDimensionEntityServer, WithDimensionsSavedThroughLine } from '../JournalEntryLineDimensionEntityServer.js';

const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';
const JEL_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Lines';
const JELD_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Line Dimensions';
const GL_ENTITY = 'MJ_BizApps_Accounting: GL Accounts';
const ORDER_LINE_ENTITY = 'MJ_BizApps_Orders: Order Lines';

const JE_ID = '77777777-7777-4777-8777-777777777777';
const CREATOR = '33333333-3333-4333-8333-333333333333';
const APPROVER = '44444444-4444-4444-8444-444444444444';
const OLD_TASK = '88888888-8888-4888-8888-888888888881';
const NEW_TASK = '88888888-8888-4888-8888-888888888882';
const ORDER_LINE_ENTITY_ID = 'eeeeeeee-0000-4000-8000-000000000001';
const ORDER_LINE_ID = 'eeeeeeee-0000-4000-8000-0000000000aa';
const GL_A = '99999999-9999-4999-8999-999999999991';
const GL_B = '99999999-9999-4999-8999-999999999992';

const JE_FIELDS = [
  'ID', 'CompanyID', 'EffectiveDate', 'EntryTypeID', 'Status', 'EntryNumber', 'Description', 'ReversesJournalEntryID',
  'ReversedByJournalEntryID', 'FileID', 'JournalEntryBatchID', 'LinkedEntityID', 'LinkedRecordID',
  'ApprovalLevel', 'ApprovalRequestedByUserID', 'ApprovalTaskID', 'ApprovedAt', 'ApprovedByUserID',
];
const JEL_FIELDS = ['ID', 'JournalEntryID', 'LineNumber', 'GLAccountID', 'DebitAmount', 'CreditAmount', 'Description'];
const JELD_FIELDS = ['ID', 'JournalEntryLineID', 'DimensionID', 'DimensionValueID'];

function mockEntity(name: string, fieldNames: string[], id = `id-${name}`): EntityInfo {
  const info = Object.create(EntityInfo.prototype);
  info.ID = id;
  info.Name = name;
  info.Status = 'Active';
  info.AllowDirectSQL = true;
  const fields = fieldNames.map(fn => ({
    Name: fn,
    CodeName: fn,
    Type: fn === 'ID' || fn.endsWith('ID') ? 'uniqueidentifier' : fn.endsWith('At') || fn === 'EffectiveDate' ? 'datetimeoffset' : fn.endsWith('Amount') ? 'decimal' : 'nvarchar',
    TSType: fn.endsWith('Amount') ? 'number' : fn.endsWith('At') || fn === 'EffectiveDate' ? 'Date' : 'string',
    NeedsQuotes: true,
    IsPrimaryKey: fn === 'ID',
    AutoIncrement: false,
    ReadOnly: false,
    AllowsNull: true,
    ValueIsPermittedByValueList: () => true,
  }));
  Object.defineProperty(info, 'Fields', { get: () => fields, configurable: true });
  Object.defineProperty(info, 'PrimaryKeys', { get: () => fields.filter(f => f.IsPrimaryKey), configurable: true });
  Object.defineProperty(info, 'HasInactiveFields', { get: () => false, configurable: true });
  return info;
}

const jeInfo = mockEntity(JE_ENTITY, JE_FIELDS);
const jelInfo = mockEntity(JEL_ENTITY, JEL_FIELDS);
const jeldInfo = mockEntity(JELD_ENTITY, JELD_FIELDS);
const glInfo = mockEntity(GL_ENTITY, ['ID', 'CompanyID', 'Code', 'IsActive']);
const orderLineInfo = mockEntity(ORDER_LINE_ENTITY, ['ID'], ORDER_LINE_ENTITY_ID);

/** Order-line rows the source-record read finds; a view failure when `failViews` is set. */
const world = { orderLines: [ORDER_LINE_ID], failViews: false };

/** What each persisted write looked like, and whether Validate let it through. */
interface Write { row: Record<string, unknown>; ok: boolean; errors: string[] }
let writes: Write[] = [];
const user = { ID: CREATOR, Email: 'creator@example.test' } as UserInfo;

beforeEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  writes = [];
  world.orderLines = [ORDER_LINE_ID];
  world.failViews = false;
  const entities = [jeInfo, jelInfo, jeldInfo, glInfo, orderLineInfo];
  Metadata.Provider = {
    Entities: entities,
    FindEntityByName: (name: string) => entities.find(e => e.Name.toLowerCase() === name.toLowerCase()),
    EntityByName: (name: string) => entities.find(e => e.Name.toLowerCase() === name.toLowerCase()),
    Config: { ActiveStatusAssertions: false },
    BeginTransaction: async () => {},
    CommitTransaction: async () => {},
    RollbackTransaction: async () => {},
    RunView: async (params: { EntityName: string; ExtraFilter?: string }) => {
      if (world.failViews) return { Success: false, ErrorMessage: 'timeout', Results: [] };
      if (params.EntityName === ORDER_LINE_ENTITY) {
        return { Success: true, Results: world.orderLines.filter(id => params.ExtraFilter?.includes(id)).map(id => ({ ID: id })) };
      }
      if (params.EntityName === GL_ENTITY) {
        return { Success: true, Results: [GL_A, GL_B].map(id => ({ ID: id, CompanyID: 'CO-1', Code: id.slice(-4), IsActive: true })) };
      }
      return { Success: true, Results: [] };
    },
  } as unknown as typeof Metadata.Provider;
  // Entity objects resolve ProviderToUse through BaseEntity's own global, not Metadata's.
  (BaseEntity as unknown as { Provider: unknown }).Provider = Metadata.Provider;
  // The persistence step: validate as BaseEntity.Save does, then record the row instead of writing it.
  vi.spyOn(BaseEntity.prototype, 'Save').mockImplementation(async function (this: BaseEntity) {
    const result = this.Validate();
    const errors = result.Errors.map(e => String(e.Message));
    writes.push({ row: this.GetAll(), ok: result.Success, errors });
    return result.Success;
  });
  vi.spyOn(BaseEntity.prototype, 'Delete').mockResolvedValue(true);
  approval.raiseApprovalTask.mockResolvedValue(NEW_TASK);
  approval.closeSupersededTask.mockResolvedValue(undefined);
  approval.assertLine.mockResolvedValue(undefined);
  approval.assertDimension.mockResolvedValue(undefined);
});

function line(id: string, gl: string, debit: number | null, credit: number | null): JournalEntryLineEntityServer {
  const l = new JournalEntryLineEntityServer(jelInfo);
  l.ContextCurrentUser = user;
  l.SetMany({ ID: id, JournalEntryID: JE_ID, LineNumber: id.endsWith('1') ? 1 : 2, GLAccountID: gl, DebitAmount: debit, CreditAmount: credit, Description: null }, true, true);
  return l;
}

/** A saved Pending manual entry with two balanced lines, loaded as LoadLines would load it. */
function savedEntry(header: Record<string, unknown> = {}): JournalEntryEntityServer {
  const je = new JournalEntryEntityServer(jeInfo);
  je.ContextCurrentUser = user;
  je.SetMany({
    ID: JE_ID, CompanyID: 'CO-1', EffectiveDate: new Date('2026-10-15T00:00:00Z'), EntryTypeID: 'JET_MANUAL', Status: 'Pending',
    EntryNumber: 'JE-1', Description: 'Accrual', LinkedEntityID: null, LinkedRecordID: null,
    ApprovalLevel: null, ApprovalRequestedByUserID: null, ApprovalTaskID: null, ApprovedAt: null, ApprovedByUserID: null,
    ...header,
  }, true, true);
  const lines = [line('aaaaaaaa-0000-4000-8000-000000000001', GL_A, 1200, null), line('aaaaaaaa-0000-4000-8000-000000000002', GL_B, null, 1200)];
  je.Lines.SetLoadedItems(lines);
  for (const l of lines) l.ParentJournalEntry = je;
  return je;
}

const APPROVED = {
  ApprovalLevel: 'Standard', ApprovalRequestedByUserID: CREATOR, ApprovalTaskID: OLD_TASK,
  ApprovedAt: new Date('2026-10-16T09:00:00Z'), ApprovedByUserID: APPROVER,
};
const AWAITING = { ApprovalLevel: 'Standard', ApprovalRequestedByUserID: CREATOR, ApprovalTaskID: OLD_TASK };
const lines = (je: JournalEntryEntityServer) => je.Lines.Items as JournalEntryLineEntityServer[];
const errorText = (je: JournalEntryEntityServer) => je.Validate().Errors.map(e => String(e.Message)).join(' | ');

describe('HasApprovalRelevantChanges — what re-raises an approval', () => {
  it('is false for an untouched entry and for a description-only edit', () => {
    const je = savedEntry();
    expect(je.HasApprovalRelevantChanges()).toBe(false);
    je.Description = 'Accrual, reworded';
    lines(je)[0].Description = 'memo';
    expect(je.HasApprovalRelevantChanges()).toBe(false);
  });

  it.each([
    ['a line amount', (je: JournalEntryEntityServer) => { lines(je)[0].DebitAmount = 9000; lines(je)[1].CreditAmount = 9000; }],
    ['a line account', (je: JournalEntryEntityServer) => { lines(je)[0].GLAccountID = GL_B; }],
    ['a removed line', (je: JournalEntryEntityServer) => { je.RemoveLine(1); }],
    ['an added line', (je: JournalEntryEntityServer) => { const l = new JournalEntryLineEntityServer(jelInfo); l.NewRecord(); je.AddLine(l); }],
    ['the company', (je: JournalEntryEntityServer) => { je.CompanyID = 'CO-2'; }],
    ['the effective date', (je: JournalEntryEntityServer) => { je.EffectiveDate = new Date('2026-11-01T00:00:00Z'); }],
  ])('is true after changing %s', (_label, change) => {
    const je = savedEntry();
    change(je);
    expect(je.HasApprovalRelevantChanges()).toBe(true);
  });
});

describe('a re-routed save clears the earlier approval before it writes', () => {
  it('stamps the new level and requester, clears ApprovedAt/ApprovedByUserID and the old Task, then links the new Task', async () => {
    const je = savedEntry(APPROVED);
    lines(je)[0].DebitAmount = 9000;
    lines(je)[1].CreditAmount = 9000;
    approval.planForSave.mockResolvedValue({ Action: 'Raise', Plan: { Level: 'CFO', ApproverUserIDs: ['cfo'], Reason: 'above', TotalDebits: 9000 } });

    expect(await je.Save()).toBe(true);

    const headerWrites = writes.filter(w => w.row.EntryNumber === 'JE-1');
    expect(headerWrites).toHaveLength(2);
    expect(headerWrites[0]).toMatchObject({ ok: true, row: { ApprovalLevel: 'CFO', ApprovalRequestedByUserID: CREATOR, ApprovalTaskID: null, ApprovedAt: null, ApprovedByUserID: null } });
    expect(headerWrites[1]).toMatchObject({ ok: true, row: { ApprovalTaskID: NEW_TASK, ApprovedAt: null } });
    expect(approval.closeSupersededTask).toHaveBeenCalledWith(OLD_TASK, user);
  });

  it('does not route at all for a description-only edit, and keeps the approval', async () => {
    const je = savedEntry(APPROVED);
    je.Description = 'reworded';
    expect(await je.Save()).toBe(true);
    expect(approval.planForSave).not.toHaveBeenCalled();
    expect(writes[0].row).toMatchObject({ ApprovedByUserID: APPROVER, ApprovalTaskID: OLD_TASK });
  });
});

describe('Required finding 1 — the approval columns are not writable by an ordinary save', () => {
  it("refuses the entry's author typing an approval into Approved At / Approved By", async () => {
    const je = savedEntry(AWAITING);
    je.ApprovedAt = new Date();
    je.ApprovedByUserID = CREATOR;
    expect(errorText(je)).toMatch(/ApprovedAt, ApprovedByUserID cannot be set directly/);
    expect(await je.Save()).toBe(false);
    expect(writes.every(w => !w.ok)).toBe(true);
  });

  it('refuses nulling the level and requester to switch the approval off', async () => {
    const je = savedEntry(AWAITING);
    je.ApprovalLevel = null;
    je.ApprovalRequestedByUserID = null;
    expect(errorText(je)).toMatch(/ApprovalLevel, ApprovalRequestedByUserID cannot be set directly/);
    expect(await je.Save()).toBe(false);
  });

  it('refuses re-pointing the requester or the Task', () => {
    const je = savedEntry(AWAITING);
    je.ApprovalRequestedByUserID = APPROVER;
    je.ApprovalTaskID = NEW_TASK;
    expect(errorText(je)).toMatch(/ApprovalRequestedByUserID, ApprovalTaskID cannot be set directly/);
  });

  it('refuses a new entry that arrives already carrying approval values', () => {
    const je = new JournalEntryEntityServer(jeInfo);
    je.NewRecord();
    je.ApprovalLevel = 'Standard';
    je.ApprovedAt = new Date();
    je.ApprovedByUserID = APPROVER;
    expect(errorText(je)).toMatch(/ApprovalLevel, ApprovedAt, ApprovedByUserID cannot be set directly/);
  });

  it('lets the decision path stamp the approval, and only the two stamp columns', async () => {
    const je = savedEntry(AWAITING);
    expect(await je.SaveApprovalStamp(APPROVER, new Date('2026-10-17T10:00:00Z'))).toBe(true);
    expect(writes[0]).toMatchObject({ ok: true, row: { ApprovedByUserID: APPROVER, ApprovalLevel: 'Standard' } });

    const tampered = savedEntry(AWAITING);
    tampered.ApprovalLevel = 'CFO';
    expect(await tampered.SaveApprovalStamp(APPROVER, new Date())).toBe(false);
    expect(writes[writes.length - 1].errors.join(' ')).toMatch(/ApprovalLevel cannot be set directly/);
  });

  it('closes the allowance again after a stamp save', async () => {
    const je = savedEntry(AWAITING);
    await je.SaveApprovalStamp(APPROVER, new Date());
    je.ApprovedByUserID = CREATOR;
    expect(errorText(je)).toMatch(/ApprovedByUserID cannot be set directly/);
  });
});

describe('Required finding 2 — the D25 origin pair cannot switch approval off', () => {
  it('refuses setting the pair on an existing manual entry', () => {
    const je = savedEntry(AWAITING);
    je.LinkedEntityID = ORDER_LINE_ENTITY_ID;
    je.LinkedRecordID = ORDER_LINE_ID;
    expect(errorText(je)).toMatch(/LinkedEntityID and LinkedRecordID cannot change once a journal entry exists/);
  });

  it('refuses clearing the pair on an existing booked entry', () => {
    const je = savedEntry({ LinkedEntityID: ORDER_LINE_ENTITY_ID, LinkedRecordID: ORDER_LINE_ID });
    je.LinkedRecordID = null;
    expect(errorText(je)).toMatch(/LinkedRecordID cannot change once a journal entry exists/);
  });

  const newEntry = (entityId: string, recordId: string) => {
    const je = new JournalEntryEntityServer(jeInfo);
    je.ContextCurrentUser = user;
    je.NewRecord();
    je.CompanyID = 'CO-1';
    je.Status = 'Pending';
    je.LinkedEntityID = entityId;
    je.LinkedRecordID = recordId;
    return je;
  };
  const originErrors = async (je: JournalEntryEntityServer) =>
    (await je.ValidateAsync()).Errors.map(e => String(e.Message)).filter(m => /source|LinkedEntityID|LinkedRecordID/.test(m));

  it('refuses a new entry whose pair names an entity that does not exist', async () => {
    expect(await originErrors(newEntry('ffffffff-0000-4000-8000-000000000000', ORDER_LINE_ID))).toEqual([expect.stringMatching(/is not an entity/)]);
  });

  it('refuses a new entry whose pair names a record that does not exist, or is not an ID', async () => {
    expect(await originErrors(newEntry(ORDER_LINE_ENTITY_ID, 'eeeeeeee-0000-4000-8000-0000000000bb'))).toEqual([expect.stringMatching(/source record .* does not exist/)]);
    expect(await originErrors(newEntry(ORDER_LINE_ENTITY_ID, "x' OR 1=1 --"))).toEqual([expect.stringMatching(/is not a valid .* ID/)]);
  });

  it('accepts a new entry whose pair names a real source record (the booking path)', async () => {
    expect(await originErrors(newEntry(ORDER_LINE_ENTITY_ID, ORDER_LINE_ID))).toEqual([]);
  });

  it('fails closed when the source read fails', async () => {
    world.failViews = true;
    expect(await originErrors(newEntry(ORDER_LINE_ENTITY_ID, ORDER_LINE_ID))).toEqual([expect.stringMatching(/Could not check the journal entry's source record.*timeout/)]);
  });
});

describe('the line-level guard', () => {
  it('a line written on its own that changes an amount calls the standalone guard, and a refusal stops the save', async () => {
    const l = savedEntry(AWAITING).Lines.Items[0] as JournalEntryLineEntityServer;
    l.DebitAmount = 50;
    expect(l.ChangesWhatApprovalCovers()).toBe(true);
    approval.assertLine.mockRejectedValueOnce(new Error('edit the entry, not the line'));
    await expect(l.Save()).rejects.toThrow(/edit the entry, not the line/);
    expect(approval.assertLine).toHaveBeenCalledWith(JE_ID, user);
    expect(writes).toEqual([]);
  });

  it.each([
    ['a new line', () => { const l = new JournalEntryLineEntityServer(jelInfo); l.NewRecord(); l.JournalEntryID = JE_ID; return l; }, true],
    ['an account change', () => { const l = line('aaaaaaaa-0000-4000-8000-000000000001', GL_A, 10, null); l.GLAccountID = GL_B; return l; }, true],
    ['a description-only change', () => { const l = line('aaaaaaaa-0000-4000-8000-000000000001', GL_A, 10, null); l.Description = 'memo'; return l; }, false],
    ['an amount change saved through its entry', () => { const l = line('aaaaaaaa-0000-4000-8000-000000000001', GL_A, 10, null); l.DebitAmount = 20; l.SavingThroughJournalEntry = true; return l; }, false],
  ])('ChangesWhatApprovalCovers is right for %s', (_label, make, expected) => {
    expect(make().ChangesWhatApprovalCovers()).toBe(expected);
  });

  it('a line deleted on its own calls the standalone guard', async () => {
    const l = line('aaaaaaaa-0000-4000-8000-000000000001', GL_A, 10, null);
    l.Dimensions.SetLoadedItems([]);
    vi.spyOn(l.Dimensions, 'Load').mockResolvedValue(undefined as never);
    await l.Delete();
    expect(approval.assertLine).toHaveBeenCalledWith(JE_ID, user);
  });
});

describe('the dimension-tag guard (not blocking finding)', () => {
  const tag = () => {
    const d = new JournalEntryLineDimensionEntityServer(jeldInfo);
    d.ContextCurrentUser = user;
    d.SetMany({ ID: 'dddddddd-0000-4000-8000-000000000001', JournalEntryLineID: 'aaaaaaaa-0000-4000-8000-000000000001', DimensionID: 'dim-1', DimensionValueID: 'val-1' }, true, true);
    return d;
  };

  it('a tag re-pointed on its own calls the guard, and a refusal stops the save', async () => {
    const d = tag();
    d.DimensionValueID = 'val-2';
    approval.assertDimension.mockRejectedValueOnce(new Error('edit the entry'));
    await expect(d.Save()).rejects.toThrow(/edit the entry/);
    expect(approval.assertDimension).toHaveBeenCalledWith('aaaaaaaa-0000-4000-8000-000000000001', user);
  });

  it('a tag deleted on its own calls the guard', async () => {
    await tag().Delete();
    expect(approval.assertDimension).toHaveBeenCalledTimes(1);
  });

  it('a tag written by its line defers to the line', async () => {
    const d = tag();
    d.DimensionValueID = 'val-2';
    await WithDimensionsSavedThroughLine([d], () => d.Save());
    expect(approval.assertDimension).not.toHaveBeenCalled();
    expect(d.SavingThroughLine).toBe(false);
  });
});
