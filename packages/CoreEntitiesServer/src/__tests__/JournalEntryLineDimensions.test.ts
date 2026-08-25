/**
 * Unit tests for the encapsulated Dimensions collection on JournalEntryLineEntityServer
 * (phase 2 — dimension tags ride the same transactional Save as the line/JE).
 * Written from EXPECTED behavior: the collection bookkeeping and the dimension-pair
 * validation rules (both IDs present; one value per dimension per line —
 * UQ_JELDimension_Line_Dimension). No DB — mock EntityInfo, same harness pattern as
 * JournalEntryExtendedServer.test.ts.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Metadata, EntityInfo } from '@memberjunction/core';
import { JournalEntryLineEntityServer } from '../JournalEntryLineEntityServer.js';
import { mjBizAppsAccountingJournalEntryLineDimensionEntity } from '@mj-biz-apps/accounting-entities';

const JEL_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Lines';
const JELD_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Line Dimensions';

describe('JournalEntryLineEntityServer — Dimensions collection', () => {
  let line: JournalEntryLineEntityServer;
  let jeldEntityInfo: EntityInfo;

  const createMockEntity = (name: string, fieldNames: string[]) => {
    const info = Object.create(EntityInfo.prototype);
    info.ID = `id-${name}`;
    info.Name = name;
    info.Status = 'Active';
    info.AllowDirectSQL = true;
    const fields = fieldNames.map(fn => ({
      Name: fn,
      CodeName: fn,
      Type: fn === 'ID' || fn.endsWith('ID') ? 'uniqueidentifier' : 'nvarchar',
      TSType: 'string',
      IsPrimaryKey: fn === 'ID',
      AutoIncrement: false,
      ReadOnly: false,
      AllowsNull: true,
      ValueIsPermittedByValueList: () => true,
    })) as any[];
    Object.defineProperty(info, 'Fields', { get: () => fields, configurable: true });
    Object.defineProperty(info, 'PrimaryKeys', { get: () => fields.filter((f: any) => f.IsPrimaryKey), configurable: true });
    Object.defineProperty(info, 'HasInactiveFields', { get: () => false, configurable: true });
    return info;
  };

  const newDimension = (dimensionId?: string, valueId?: string): mjBizAppsAccountingJournalEntryLineDimensionEntity => {
    const dim = new mjBizAppsAccountingJournalEntryLineDimensionEntity(jeldEntityInfo as any);
    dim.NewRecord();
    if (dimensionId) dim.DimensionID = dimensionId;
    if (valueId) dim.DimensionValueID = valueId;
    return dim;
  };

  beforeEach(() => {
    const jelEntityInfo = createMockEntity(JEL_ENTITY, ['ID', 'JournalEntryID', 'LineNumber', 'GLAccountID', 'DebitAmount', 'CreditAmount', 'Description']);
    jeldEntityInfo = createMockEntity(JELD_ENTITY, ['ID', 'JournalEntryLineID', 'DimensionID', 'DimensionValueID']);
    const entities = [jelEntityInfo, jeldEntityInfo];
    Metadata.Provider = {
      Entities: entities,
      FindEntityByName: (name: string) => entities.find(e => e.Name.toLowerCase() === name.toLowerCase()),
      Config: { ActiveStatusAssertions: false },
      BeginTransaction: async () => {},
      CommitTransaction: async () => {},
      RollbackTransaction: async () => {},
    } as any;

    line = new JournalEntryLineEntityServer(jelEntityInfo as any);
    line.NewRecord();
    line.GLAccountID = 'GL_1';
    line.DebitAmount = 100;
  });

  const getErrorText = (e: any): string => (typeof e === 'string' ? e : (e?.Message || e?.Error || e?.message || String(e)));

  describe('collection bookkeeping', () => {
    it('initializes with an empty Dimensions array', () => {
      expect(line.Dimensions.Items).toEqual([]);
    });

    it('AddDimension appends and stamps the line FK when the line has an ID', () => {
      const dim = newDimension('DIM_DEPT', 'VAL_SALES');
      line.AddDimension(dim);
      expect(line.Dimensions.Items).toHaveLength(1);
      if (line.ID) {
        expect(dim.JournalEntryLineID).toBe(line.ID);
      }
    });

    it('RemoveDimension removes by instance and by index', () => {
      const d1 = newDimension('DIM_A', 'VAL_1');
      const d2 = newDimension('DIM_B', 'VAL_2');
      line.AddDimension(d1);
      line.AddDimension(d2);

      line.RemoveDimension(d1);
      expect(line.Dimensions.Items).toHaveLength(1);
      expect(line.Dimensions.Items[0]).toBe(d2);

      line.RemoveDimension(0);
      expect(line.Dimensions.Items).toHaveLength(0);
    });

    it('SetLoadedDimensions replaces the collection wholesale', () => {
      line.AddDimension(newDimension('DIM_A', 'VAL_1'));
      const loaded = [newDimension('DIM_B', 'VAL_2'), newDimension('DIM_C', 'VAL_3')];
      line.SetLoadedDimensions(loaded);
      expect(line.Dimensions.Items).toHaveLength(2);
      expect(line.Dimensions.Items[0].DimensionID).toBe('DIM_B');
    });
  });

  describe('dimension-pair validation', () => {
    it('fails when a dimension tag is missing its DimensionValueID', () => {
      line.AddDimension(newDimension('DIM_DEPT', undefined));
      const result = line.Validate();
      expect(result.Success).toBe(false);
      expect(result.Errors.some(e => getErrorText(e).includes('BOTH DimensionID and DimensionValueID'))).toBe(true);
    });

    it('fails when the SAME dimension is tagged twice on one line (UQ_JELDimension_Line_Dimension)', () => {
      line.AddDimension(newDimension('DIM_DEPT', 'VAL_SALES'));
      line.AddDimension(newDimension('DIM_DEPT', 'VAL_MKTG'));
      const result = line.Validate();
      expect(result.Success).toBe(false);
      expect(result.Errors.some(e => getErrorText(e).includes('tagged more than once'))).toBe(true);
    });

    it('passes with distinct dimensions each carrying a full pair', () => {
      line.AddDimension(newDimension('DIM_DEPT', 'VAL_SALES'));
      line.AddDimension(newDimension('DIM_REGION', 'VAL_WEST'));
      const result = line.Validate();
      const dimensionErrors = result.Errors.filter(e => getErrorText(e).toLowerCase().includes('dimension'));
      expect(dimensionErrors).toEqual([]);
    });
  });
});
