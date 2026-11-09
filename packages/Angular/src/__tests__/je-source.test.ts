import { describe, it, expect, vi, afterEach } from 'vitest';
import { RunView, UserInfo, type IMetadataProvider, type RunViewParams } from '@memberjunction/core';
import { LoadJournalEntrySources, SourceLabel } from '../lib/custom/shared/je-source';

/**
 * Batch lists label each entry's source record generically (bc-aidp-next-golive#452): by the
 * linked entity's name field when it has one, else by the entity's display name — with names read
 * in ONE RunViews call, one query per entity, never per row.
 */

const NAMED = 'Test: Invoices';
const UNNAMED = 'Test: Payment Lines';

/** Entity metadata shaped like EntityInfo for the three members the helper reads. */
const ENTITIES: Record<string, { Name: string; DisplayNameOrName: string; NameField: { Name: string } | null; PrimaryKeys: Array<{ Name: string }> }> = {
  [NAMED]: { Name: NAMED, DisplayNameOrName: 'Invoices', NameField: { Name: 'InvoiceNumber' }, PrimaryKeys: [{ Name: 'ID' }] },
  [UNNAMED]: { Name: UNNAMED, DisplayNameOrName: 'Payment Lines', NameField: null, PrimaryKeys: [{ Name: 'ID' }] },
};

function provider(): IMetadataProvider {
  const p: Pick<IMetadataProvider, 'CurrentUser' | 'EntityByName'> = {
    CurrentUser: new UserInfo(),
    EntityByName: (name: string) => ENTITIES[name] as never,
  };
  return p as IMetadataProvider;
}

function stubRunViews(rowsFor: (p: RunViewParams) => Array<Record<string, string>>) {
  return vi.spyOn(RunView.prototype, 'RunViews').mockImplementation(async (ps: RunViewParams[]) =>
    ps.map((p) => ({ Success: true, Results: rowsFor(p), RowCount: 0, TotalRowCount: 0, ExecutionTime: 0, ErrorMessage: '' })));
}

afterEach(() => vi.restoreAllMocks());

describe('LoadJournalEntrySources', () => {
  it('names records by the entity name field in one batched call, one query per entity', async () => {
    const spy = stubRunViews(() => [{ ID: 'INV-ID-1', InvoiceNumber: 'INV-0001' }, { ID: 'inv-id-2', InvoiceNumber: 'INV-0002' }]);

    const sources = await LoadJournalEntrySources(provider(), [
      { ID: 'je-1', LinkedEntity: NAMED, LinkedRecordID: 'inv-id-1' },
      { ID: 'je-2', LinkedEntity: NAMED, LinkedRecordID: 'inv-id-2' },
      { ID: 'je-3', LinkedEntity: NAMED, LinkedRecordID: 'inv-id-1' },
    ]);

    expect(spy).toHaveBeenCalledTimes(1);
    const [params] = spy.mock.calls[0];
    expect(params).toHaveLength(1);
    expect(params[0].EntityName).toBe(NAMED);
    expect(params[0].Fields).toEqual(['ID', 'InvoiceNumber']);
    // Each record id once, even when two entries share it.
    expect(params[0].ExtraFilter).toBe("ID IN ('inv-id-1','inv-id-2')");
    expect(SourceLabel(sources.get('je-1')!)).toBe('INV-0001');
    expect(SourceLabel(sources.get('je-3')!)).toBe('INV-0001');
    expect(sources.get('je-2')).toMatchObject({ EntityName: NAMED, RecordID: 'inv-id-2', RecordName: 'INV-0002' });
  });

  it('labels a record of an entity with no name field by the entity, with no query', async () => {
    const spy = stubRunViews(() => []);

    const sources = await LoadJournalEntrySources(provider(), [{ ID: 'je-1', LinkedEntity: UNNAMED, LinkedRecordID: 'pl-1' }]);

    expect(spy).not.toHaveBeenCalled();
    expect(sources.get('je-1')).toMatchObject({ EntityName: UNNAMED, RecordID: 'pl-1', RecordName: null });
    expect(SourceLabel(sources.get('je-1')!)).toBe('Payment Lines');
  });

  it('leaves manual entries out', async () => {
    const spy = stubRunViews(() => []);

    const sources = await LoadJournalEntrySources(provider(), [
      { ID: 'je-1', LinkedEntity: null, LinkedRecordID: null },
      { ID: 'je-2' },
    ]);

    expect(spy).not.toHaveBeenCalled();
    expect(sources.size).toBe(0);
  });

  it('falls back to the entity label when the name read fails', async () => {
    vi.spyOn(RunView.prototype, 'RunViews').mockResolvedValue([
      { Success: false, Results: [], RowCount: 0, TotalRowCount: 0, ExecutionTime: 0, ErrorMessage: 'denied' },
    ]);

    const sources = await LoadJournalEntrySources(provider(), [{ ID: 'je-1', LinkedEntity: NAMED, LinkedRecordID: 'inv-id-1' }]);

    expect(SourceLabel(sources.get('je-1')!)).toBe('Invoices');
  });

  it('escapes a quote in a record id', async () => {
    const spy = stubRunViews(() => []);

    await LoadJournalEntrySources(provider(), [{ ID: 'je-1', LinkedEntity: NAMED, LinkedRecordID: "o'brien" }]);

    expect(spy.mock.calls[0][0][0].ExtraFilter).toBe("ID IN ('o''brien')");
  });
});
