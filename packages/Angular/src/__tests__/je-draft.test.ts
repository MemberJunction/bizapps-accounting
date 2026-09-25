import { describe, it, expect, beforeEach } from 'vitest';
import type { JournalEntryEntity } from '@mj-biz-apps/accounting-entities';
import { entityObject, installStubProvider, stubEntityInfo } from './support/entity-stubs';
import {
  parseMoney,
  TextIssue,
  LiveLines,
  draftTotals,
  toCreateInput,
  newAmountText,
  CalendarDayValue,
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
 *
 * ## Children come from their collection, never from `new`
 *
 * Every line and every dimension below is issued by `Lines.Create()` / `Dimensions.Create()`, which
 * is what the workspace itself calls. `new JournalEntryLineDimensionEntity(...)` would hardcode a
 * class name — defeating the class factory, so a registered server subclass would never be the thing
 * under test — and would hand the collection an object it did not issue and therefore does not
 * track. A test that builds its subject differently from production is testing a different subject.
 */

const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';
const JEL_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Lines';
const JELD_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Line Dimensions';

beforeEach(() => {
  installStubProvider([
    stubEntityInfo(JE_ENTITY, ['ID', 'CompanyID', 'EffectiveDate', 'EntryTypeID', 'Status', 'EntryNumber', 'Description']),
    stubEntityInfo(JEL_ENTITY, ['ID', 'JournalEntryID', 'LineNumber', 'GLAccountID', 'DebitAmount', 'CreditAmount', 'Description']),
    stubEntityInfo(JELD_ENTITY, ['ID', 'JournalEntryLineID', 'DimensionID', 'DimensionValueID']),
  ]);
});

interface LineSpec {
  GLAccountID?: string;
  Debit?: number;
  Credit?: number;
  Description?: string;
}

/** A composed entry with the given lines, plus the money text that produced them. */
async function draft(
  lines: LineSpec[],
  over: Partial<{ CompanyID: string; Description: string }> = {},
): Promise<JEDraftState> {
  const entry = await entityObject<JournalEntryEntity>(JE_ENTITY);
  entry.NewRecord();
  entry.CompanyID = over.CompanyID ?? 'c1';
  entry.EffectiveDate = new Date('2026-07-16T00:00:00.000Z');
  entry.Description = over.Description ?? 'Event deposit accrual';

  const state: JEDraftState = { Entry: entry, Amounts: new Map() };

  for (const spec of lines) {
    // ISSUED BY THE COLLECTION. It stamps the foreign key at save and tracks the child for the save
    // plan; a hand-built line is a stranger the collection has to be told about.
    const line = await entry.Lines.Create();
    if (spec.GLAccountID) line.GLAccountID = spec.GLAccountID;
    if (spec.Debit !== undefined) line.DebitAmount = spec.Debit;
    if (spec.Credit !== undefined) line.CreditAmount = spec.Credit;
    if (spec.Description !== undefined) line.Description = spec.Description;
    state.Amounts.set(line.ID, {
      Debit: spec.Debit !== undefined ? String(spec.Debit) : '',
      Credit: spec.Credit !== undefined ? String(spec.Credit) : '',
    });
  }
  return state;
}

/** The shape most tests vary from: 860 in, 860 out. */
function balanced(): Promise<JEDraftState> {
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

describe('the collection issues its own children', () => {
  it('Create() appends a tracked line, so the entry sees it without being told', async () => {
    const state = await draft([{ GLAccountID: 'gl-cash', Debit: 860 }]);
    expect(state.Entry.Lines.Items.length).toBe(1);
    expect(state.Entry.Lines.Items[0].GLAccountID).toBe('gl-cash');
  });

  it('resolves the REGISTERED subclass, not a hardcoded class name', async () => {
    // Why `new JournalEntryLineEntity(...)` is wrong even when it compiles: the factory is what lets
    // a registered subclass carry its own rules. Naming a class inline opts out of that silently,
    // and the test would then pass against a class production never uses.
    const state = await draft([{ GLAccountID: 'gl-cash', Debit: 1 }]);
    const line = state.Entry.Lines.Items[0];

    // Asserted on the RESOLVED class, not on the entity name — a plain `BaseEntity` carries the
    // same EntityInfo.Name, so checking that alone would pass without the factory doing anything.
    expect(line.constructor.name).toBe('JournalEntryLineEntity');

    // And the behaviour that only the subclass declares: a line the factory built can hold
    // dimensions, which is what the rest of this file goes on to use.
    expect(line.Dimensions).toBeDefined();
    expect(line.Dimensions.Items).toEqual([]);
  });
});

describe('LiveLines', () => {
  it('drops untouched rows and keeps everything else', async () => {
    const state = await draft([
      { GLAccountID: 'gl-cash', Debit: 860 },
      {}, // the blank row the editor always leaves at the bottom
      { GLAccountID: 'gl-deposits', Credit: 860 },
    ]);
    expect(LiveLines(state.Entry).length).toBe(2);
  });

  it('counts a row carrying only a memo — somebody typed it', async () => {
    const state = await draft([{ Description: 'still working this out' }]);
    expect(LiveLines(state.Entry).length).toBe(1);
  });
});

describe('draftTotals', () => {
  it('sums each side independently and ignores empty rows', async () => {
    const state = await draft([
      { GLAccountID: 'a', Debit: 302.59 },
      { GLAccountID: 'b', Credit: 233.51 },
      { GLAccountID: 'c', Credit: 69.08 },
      {},
    ]);
    expect(draftTotals(state.Entry)).toEqual({ Debits: 302.59, Credits: 302.59 });
  });

  it('is zero for a draft nobody has typed in', async () => {
    expect(draftTotals((await draft([{}, {}])).Entry)).toEqual({ Debits: 0, Credits: 0 });
  });
});

describe('toCreateInput', () => {
  it('maps a balanced draft onto the engine contract', async () => {
    const input = toCreateInput(await balanced());
    expect(input.EffectiveDate).toBe('2026-07-16');
    expect(input.EntryType).toBe('Manual');
    expect(input.Description).toBe('Event deposit accrual');
    expect(input.Lines.length).toBe(2);
  });

  it('sends ONLY the side that carries an amount — absent, never zero', async () => {
    // The contract's optional Debit/CreditAmount means ABSENT. A zero would read as a stated amount
    // of nothing rather than as the side this line is not on.
    const [debitLine, creditLine] = toCreateInput(await balanced()).Lines;
    expect(debitLine.DebitAmount).toBe(860);
    expect(debitLine.CreditAmount).toBeUndefined();
    expect(creditLine.CreditAmount).toBe(860);
    expect(creditLine.DebitAmount).toBeUndefined();
  });

  it('never sends a CompanyID — the engine derives the company from the accounts (MOD-12)', async () => {
    expect('CompanyID' in toCreateInput(await balanced())).toBe(false);
  });

  it('drops empty rows so a trailing blank line does not reach the ledger', async () => {
    const state = await draft([
      { GLAccountID: 'gl-cash', Debit: 860 },
      { GLAccountID: 'gl-deposits', Credit: 860 },
      {},
    ]);
    expect(toCreateInput(state).Lines.length).toBe(2);
  });

  it('sends only COMPLETE dimension pairs, read off the line itself', async () => {
    // The picks live on the line's own `Dimensions` collection now, not in a component Map keyed by
    // line id. A tag with an axis and no value is a half-made choice: values are never auto-created
    // (CH-12), so an unmatched one is a mistake rather than a request, and it must not travel.
    const state = await balanced();
    const [first] = LiveLines(state.Entry);

    const chosen = await first.Dimensions.Create();
    chosen.DimensionID = 'dim-fund';
    chosen.DimensionValueID = 'val-general';

    const halfMade = await first.Dimensions.Create();
    halfMade.DimensionID = 'dim-program';

    const [line] = toCreateInput(state).Lines;
    expect(line.Dimensions).toEqual([{ DimensionID: 'dim-fund', DimensionValueID: 'val-general' }]);
  });

  it('omits Dimensions entirely when none are chosen', async () => {
    expect(toCreateInput(await balanced()).Lines[0].Dimensions).toBeUndefined();
  });

  it('omits a blank memo rather than sending an empty string', async () => {
    const state = await draft([{ GLAccountID: 'a', Debit: 1 }, { GLAccountID: 'b', Credit: 1 }], { Description: '   ' });
    expect(state.Entry.Description?.trim()).toBe('');
    expect(toCreateInput(state).Description).toBeUndefined();
  });

  it('trims a line description', async () => {
    const state = await draft([
      { GLAccountID: 'a', Debit: 1, Description: '  deposit  ' },
      { GLAccountID: 'b', Credit: 1 },
    ]);
    expect(toCreateInput(state).Lines[0].Description).toBe('deposit');
  });

  it('formats the posting date from its UTC parts, not the local ones', async () => {
    // `toCreateInput` reads `EffectiveDate` through `CalendarDayValue`, which is UTC parts only —
    // it no longer reads local parts at all. This test just pins the plain case; the zone-pinned
    // describe below is what proves the UTC read discriminates from a local one.
    //
    // The fixture is an explicit UTC INSTANT (trailing Z), not a bare local one. A bare
    // '2026-01-01T00:00:00' is LOCAL midnight, which reads back as 2026-01-01 only on a runner at
    // or behind UTC — on any runner east of Greenwich it is 2025-12-31T22:00Z and this test failed
    // for a reason that had nothing to do with the code under test.
    const state = await balanced();
    state.Entry.EffectiveDate = new Date('2026-01-01T00:00:00.000Z');
    expect(toCreateInput(state).EffectiveDate).toBe('2026-01-01');
  });
});

/**
 * Run `fn` with the machine's zone pinned. Restoring an UNSET `TZ` must `delete` it: assigning
 * `undefined` back stores the string "undefined", which ICU reads as UTC, so every later test in
 * this worker would quietly run in a zone nobody chose.
 */
const AT = (tz: string, fn: () => void) => {
  const original = process.env.TZ;
  process.env.TZ = tz;
  try {
    fn();
  } finally {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  }
};

describe('the effective date travels as the calendar day the user picked, in every zone', () => {
  it('a UTC-midnight EffectiveDate maps to its own day west of Greenwich', async () => {
    const state = await balanced();
    state.Entry.EffectiveDate = new Date('2026-01-01T00:00:00.000Z');
    AT('America/New_York', () => {
      expect(toCreateInput(state).EffectiveDate).toBe('2026-01-01');
    });
  });

  it('and east of it', async () => {
    const state = await balanced();
    state.Entry.EffectiveDate = new Date('2026-08-31T00:00:00.000Z');
    AT('Asia/Kolkata', () => {
      expect(toCreateInput(state).EffectiveDate).toBe('2026-08-31');
    });
  });
});

describe('CalendarDayValue renders the stored calendar day in any browser zone', () => {
  it('shows the stored day west of Greenwich, where local parts would show the day before', () => {
    AT('America/New_York', () => {
      expect(CalendarDayValue(new Date('2026-08-31T00:00:00.000Z'))).toBe('2026-08-31');
      expect(CalendarDayValue(new Date('2026-01-01T00:00:00.000Z'))).toBe('2026-01-01');
    });
  });

  it('shows the stored day east of Greenwich too', () => {
    AT('Asia/Kolkata', () => {
      expect(CalendarDayValue(new Date('2026-08-31T00:00:00.000Z'))).toBe('2026-08-31');
    });
  });

  it('is empty for absent or unreadable values rather than showing a wrong day', () => {
    expect(CalendarDayValue(null)).toBe('');
    expect(CalendarDayValue(new Date('nonsense'))).toBe('');
  });
});
