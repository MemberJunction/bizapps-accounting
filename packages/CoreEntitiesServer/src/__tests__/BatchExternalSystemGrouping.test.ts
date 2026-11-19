import { describe, expect, it } from 'vitest';
import {
  MixedExternalSystemError,
  partitionEntriesByExternalSystem,
} from '../JournalEntryBatchEngine.js';

describe('partitionEntriesByExternalSystem (#68)', () => {
  it('groups entries with unmapped accounts (ExternalSystem = null) under the default system', () => {
    const entryIds = ['je-1', 'je-2'];
    const lines = [
      { JournalEntryID: 'je-1', GLAccountID: 'gl-unmapped-1' },
      { JournalEntryID: 'je-1', GLAccountID: 'gl-unmapped-2' },
      { JournalEntryID: 'je-2', GLAccountID: 'gl-bc-1' },
      { JournalEntryID: 'je-2', GLAccountID: 'gl-unmapped-2' },
    ];
    const externalSystemByAccountId = new Map<string, string | null>([
      ['gl-unmapped-1', null],
      ['gl-unmapped-2', null],
      ['gl-bc-1', 'BusinessCentral'],
    ]);

    const grouped = partitionEntriesByExternalSystem(entryIds, lines, externalSystemByAccountId, 'BusinessCentral');
    expect([...grouped.keys()]).toEqual(['BusinessCentral']);
    expect(grouped.get('BusinessCentral')).toEqual(['je-1', 'je-2']);
  });

  it('partitions entries whose accounts declare different external systems into separate groups', () => {
    const entryIds = ['je-bc', 'je-qb', 'je-unmapped'];
    const lines = [
      { JournalEntryID: 'je-bc', GLAccountID: 'gl-bc-1' },
      { JournalEntryID: 'je-bc', GLAccountID: 'gl-bc-2' },
      { JournalEntryID: 'je-qb', GLAccountID: 'gl-qb-1' },
      { JournalEntryID: 'je-qb', GLAccountID: 'gl-qb-2' },
      { JournalEntryID: 'je-unmapped', GLAccountID: 'gl-unmapped' },
    ];
    const externalSystemByAccountId = new Map<string, string | null>([
      ['gl-bc-1', 'BusinessCentral'],
      ['gl-bc-2', 'BusinessCentral'],
      ['gl-qb-1', 'QuickBooks'],
      ['gl-qb-2', 'QuickBooks'],
      ['gl-unmapped', null],
    ]);

    const grouped = partitionEntriesByExternalSystem(entryIds, lines, externalSystemByAccountId, 'BusinessCentral');
    expect(grouped.get('BusinessCentral')).toEqual(['je-bc', 'je-unmapped']);
    expect(grouped.get('QuickBooks')).toEqual(['je-qb']);
  });

  it('refuses a single journal entry whose lines mix different explicit external systems', () => {
    const entryIds = ['je-mixed'];
    const lines = [
      { JournalEntryID: 'je-mixed', GLAccountID: 'gl-bc' },
      { JournalEntryID: 'je-mixed', GLAccountID: 'gl-qb' },
    ];
    const externalSystemByAccountId = new Map<string, string | null>([
      ['gl-bc', 'BusinessCentral'],
      ['gl-qb', 'QuickBooks'],
    ]);

    expect(() =>
      partitionEntriesByExternalSystem(entryIds, lines, externalSystemByAccountId, 'BusinessCentral'),
    ).toThrow(MixedExternalSystemError);
    expect(() =>
      partitionEntriesByExternalSystem(entryIds, lines, externalSystemByAccountId, 'BusinessCentral'),
    ).toThrow(/mixes external accounting systems across its lines \(BusinessCentral, QuickBooks\)/);
  });
});
