import { describe, it, expect, beforeEach } from 'vitest';
import { EntityInfo, Metadata } from '@memberjunction/core';
import {
    JournalEntryEntity,
    JournalEntryLineEntity,
    mjBizAppsAccountingJournalEntryLineDimensionEntity as JournalEntryLineDimensionEntity,
} from '@mj-biz-apps/accounting-entities';
import {
  parseMoney,
  TextIssue,
  LiveLines,
  draftTotals,
  toCreateInput,
  newAmountText,
  type JEDraftState,
} from '../lib/custom/shell/pages/je-draft';

/**
 * Tier 1 for what is LEFT of the JE workspace's pure seam (§8.1).
 *
 * WHAT USED TO BE HERE, AND WHY IT IS NOT. This file tested a `JEDraftState`/`JEDraftLine` mirror of
 * the journal entry: its own money math, its own one-side-only rule, its own balance check. All of
 * those are now `JournalEntryEntity.Validate()` and `JournalEntryLineEntity.Validate()` — the SAME
 * calls the server makes — and they are tested where they live, against the entity, in
 * `JournalEntryExtendedServer.test.ts`. Re-testing them through a screen-shaped copy is what let the
 * two statements of each rule drift in the first place.
 *
 * WHAT REMAINS IS GENUINELY THE SCREEN'S, and the exact values still matter — a dropped side or a
 * sent zero books a real, wrong journal entry:
 *
 *   · money TEXT parsing, and the one complaint the entity cannot make (a box holding a typo)
 *   · which rows count as live
 *   · the one-way mapping onto the engine contract
 */

const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';
const JEL_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Lines';
const JELD_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Line Dimensions';

/**
 * EntityInfo stubs, so `BaseEntity`'s constructor succeeds with no database.
 *
 * The same shape `JournalEntryExtendedServer.test.ts` uses. Kept local rather than shared because a
 * test helper crossing package boundaries is a dependency the packages do not otherwise have.
 */
function mockEntityInfo(name: string, fieldNames: string[]): EntityInfo {
  const info = Object.create(EntityInfo.prototype);
  info.ID = `id-${name}`;
  info.Name = name;
  info.Status = 'Active';
  info.AllowDirectSQL = true;

  const fields = fieldNames.map((fn) => ({
    Name: fn,
    CodeName: fn,
    Type: fn === 'ID' || fn.endsWith('ID') ? 'uniqueidentifier' : 'nvarchar',
    TSType: 'string',
    IsPrimaryKey: fn === 'ID',
    AutoIncrement: false,
    ReadOnly: false,
    AllowsNull: true,
  })) as unknown[];

  Object.defineProperty(info, 'Fields', { get: () => fields, configurable: true });
  Object.defineProperty(info, 'PrimaryKeys', {
    get: () => (fields as Array<{ IsPrimaryKey: boolean }>).filter((f) => f.IsPrimaryKey),
    configurable: true,
  });
  Object.defineProperty(info, 'HasInactiveFields', { get: () => false, configurable: true });
  return info as EntityInfo;
}

let jeInfo: EntityInfo;
let jelInfo: EntityInfo;
let jeldInfo: EntityInfo;

beforeEach(() => {
  jeInfo = mockEntityInfo(JE_ENTITY, ['ID', 'CompanyID', 'EffectiveDate', 'EntryTypeID', 'Status', 'EntryNumber', 'Description']);
  jelInfo = mockEntityInfo(JEL_ENTITY, ['ID', 'JournalEntryID', 'LineNumber', 'GLAccountID', 'DebitAmount', 'CreditAmount', 'Description']);
  jeldInfo = mockEntityInfo(JELD_ENTITY, ['ID', 'JournalEntryLineID', 'DimensionID', 'DimensionValueID']);
  const entities = [jeInfo, jelInfo, jeldInfo];

  Metadata.Provider = {
    Entities: entities,
    FindEntityByName: (name: string) => entities.find((e) => e.Name.toLowerCase() === name.toLowerCase()),
    Config: { ActiveStatusAssertions: false },
    BeginTransaction: async () => undefined,
    CommitTransaction: async () => undefined,
    RollbackTransaction: async () => undefined,
  } as never;
});

interface LineSpec {
  GLAccountID?: string;
  Debit?: number;
  Credit?: number;
  Description?: string;
}

/** A composed entry with the given lines, plus the money text that produced them. */
function draft(lines: LineSpec[], over: Partial<{ CompanyID: string; Description: string }> = {}): JEDraftState {
  const entry = new JournalEntryEntity(jeInfo as never);
  entry.NewRecord();
  entry.CompanyID = over.CompanyID ?? 'c1';
  entry.EffectiveDate = new Date('2026-07-16T00:00:00');
  entry.Description = over.Description ?? 'Event deposit accrual';

  const state: JEDraftState = { Entry: entry, Amounts: new Map(), Dimensions: new Map() };

  for (const spec of lines) {
    const line = new JournalEntryLineEntity(jelInfo as never);
    line.NewRecord();
    if (spec.GLAccountID) line.GLAccountID = spec.GLAccountID;
    if (spec.Debit !== undefined) line.DebitAmount = spec.Debit;
    if (spec.Credit !== undefined) line.CreditAmount = spec.Credit;
    if (spec.Description !== undefined) line.Description = spec.Description;
    entry.Lines.Add(line);
    state.Amounts.set(line.ID, {
      Debit: spec.Debit !== undefined ? String(spec.Debit) : '',
      Credit: spec.Credit !== undefined ? String(spec.Credit) : '',
    });
  }
  return state;
}

/** The shape most tests vary from: 860 in, 860 out. */
function balanced(): JEDraftState {
  return draft([
    { GLAccountID: 'gl-cash', Debit: 860 },
    { GLAccountID: 'gl-deposits', Credit: 860 },
  ]);
}

describe('parseMoney', () => {
  it('reads a plain decimal', () => {
    expect(parseMoney('860.00')).toBe(860);
  });

  it('treats blank and whitespace as zero — an untouched side is not an error', () => {
    expect(parseMoney('')).toBe(0);
    expect(parseMoney('   ')).toBe(0);
  });

  it('strips thousands separators, because people type them', () => {
    expect(parseMoney('1,250.50')).toBe(1250.5);
  });

  it('returns NaN for a typo rather than coercing it to zero', () => {
    // The whole point: a line that books as zero because somebody typed "8o" is a silently wrong
    // journal entry that still balances.
    expect(Number.isNaN(parseMoney('8o'))).toBe(true);
  });
});

describe('TextIssue', () => {
  it('passes numbers and blanks', () => {
    expect(TextIssue({ Debit: '860.00', Credit: '' })).toBeNull();
    expect(TextIssue(newAmountText())).toBeNull();
  });

  it('names a typo on either side', () => {
    expect(TextIssue({ Debit: '8o', Credit: '' })).toBe('Amounts must be numbers.');
    expect(TextIssue({ Debit: '', Credit: 'ten' })).toBe('Amounts must be numbers.');
  });

  it('says nothing about a row it has no text for', () => {
    expect(TextIssue(undefined)).toBeNull();
  });
});

describe('LiveLines', () => {
  it('drops untouched rows and keeps everything else', () => {
    const state = draft([
      { GLAccountID: 'gl-cash', Debit: 860 },
      {}, // the blank row the editor always leaves at the bottom
      { GLAccountID: 'gl-deposits', Credit: 860 },
    ]);
    expect(LiveLines(state.Entry).length).toBe(2);
  });

  it('counts a row carrying only a memo — somebody typed it', () => {
    const state = draft([{ Description: 'still working this out' }]);
    expect(LiveLines(state.Entry).length).toBe(1);
  });
});

describe('draftTotals', () => {
  it('sums each side independently and ignores empty rows', () => {
    const state = draft([
      { GLAccountID: 'a', Debit: 302.59 },
      { GLAccountID: 'b', Credit: 233.51 },
      { GLAccountID: 'c', Credit: 69.08 },
      {},
    ]);
    expect(draftTotals(state.Entry)).toEqual({ Debits: 302.59, Credits: 302.59 });
  });

  it('is zero for a draft nobody has typed in', () => {
    expect(draftTotals(draft([{}, {}]).Entry)).toEqual({ Debits: 0, Credits: 0 });
  });
});

describe('toCreateInput', () => {
  it('maps a balanced draft onto the engine contract', () => {
    const input = toCreateInput(balanced());
    expect(input.EffectiveDate).toBe('2026-07-16');
    expect(input.EntryType).toBe('Manual');
    expect(input.Description).toBe('Event deposit accrual');
    expect(input.Lines.length).toBe(2);
  });

  it('sends ONLY the side that carries an amount — absent, never zero', () => {
    // The contract's optional Debit/CreditAmount means ABSENT. A zero would read as a stated amount
    // of nothing rather than as the side this line is not on.
    const [debitLine, creditLine] = toCreateInput(balanced()).Lines;
    expect(debitLine.DebitAmount).toBe(860);
    expect(debitLine.CreditAmount).toBeUndefined();
    expect(creditLine.CreditAmount).toBe(860);
    expect(creditLine.DebitAmount).toBeUndefined();
  });

  it('never sends a CompanyID — the engine derives the company from the accounts (MOD-12)', () => {
    expect('CompanyID' in toCreateInput(balanced())).toBe(false);
  });

  it('drops empty rows so a trailing blank line does not reach the ledger', () => {
    const state = draft([
      { GLAccountID: 'gl-cash', Debit: 860 },
      { GLAccountID: 'gl-deposits', Credit: 860 },
      {},
    ]);
    expect(toCreateInput(state).Lines.length).toBe(2);
  });

  it('sends only COMPLETE dimension pairs, read off the line itself', () => {
    // The picks live on the line's own `Dimensions` collection now, not in a component Map keyed by
    // line id. A tag with an axis and no value is a half-made choice: values are never auto-created
    // (CH-12), so an unmatched one is a mistake rather than a request, and it must not travel.
    const state = balanced();
    const [first] = LiveLines(state.Entry);

    const chosen = new JournalEntryLineDimensionEntity(jeldInfo as never);
    chosen.NewRecord();
    chosen.DimensionID = 'dim-fund';
    chosen.DimensionValueID = 'val-general';
    first.Dimensions.Add(chosen);

    const halfMade = new JournalEntryLineDimensionEntity(jeldInfo as never);
    halfMade.NewRecord();
    halfMade.DimensionID = 'dim-program';
    first.Dimensions.Add(halfMade);

    const [line] = toCreateInput(state).Lines;
    expect(line.Dimensions).toEqual([{ DimensionID: 'dim-fund', DimensionValueID: 'val-general' }]);
  });

  it('omits Dimensions entirely when none are chosen', () => {
    expect(toCreateInput(balanced()).Lines[0].Dimensions).toBeUndefined();
  });

  it('omits a blank memo rather than sending an empty string', () => {
    const state = draft([{ GLAccountID: 'a', Debit: 1 }, { GLAccountID: 'b', Credit: 1 }], { Description: '   ' });
    expect(state.Entry.Description?.trim()).toBe('');
    expect(toCreateInput(state).Description).toBeUndefined();
  });

  it('trims a line description', () => {
    const state = draft([
      { GLAccountID: 'a', Debit: 1, Description: '  deposit  ' },
      { GLAccountID: 'b', Credit: 1 },
    ]);
    expect(toCreateInput(state).Lines[0].Description).toBe('deposit');
  });

  it('formats the posting date from LOCAL parts, so it cannot slip a day', () => {
    // `toISOString()` on a local-midnight Date lands on the previous day anywhere west of Greenwich,
    // which files the entry in the wrong period — balanced, reconciling, and wrong.
    const state = balanced();
    state.Entry.EffectiveDate = new Date('2026-01-01T00:00:00');
    expect(toCreateInput(state).EffectiveDate).toBe('2026-01-01');
  });
});
