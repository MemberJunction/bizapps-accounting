import { describe, expect, it, beforeEach } from 'vitest';
import { BaseEntity, EntityInfo, Metadata } from '@memberjunction/core';
import { MJGlobal } from '@memberjunction/global';
import type {
    mjBizAppsAccountingJournalEntryEntity,
    mjBizAppsAccountingJournalEntryLineEntity,
} from '@mj-biz-apps/accounting-entities';
import '@mj-biz-apps/accounting-entities';
import { DeferredRevenueWaterfallComponent } from '../lib/components/deferred-revenue-waterfall/deferred-revenue-waterfall.component';

const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';
const JEL_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Lines';

/**
 * EntityInfo stubs, so `BaseEntity`'s constructor succeeds with no database. Same shape as
 * `je-draft.test.ts`: the component takes real entities, so the spec hands it real entities
 * rather than an object literal cast to one.
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

let entities: EntityInfo[];

/** An entity through the class factory, as a real provider's `GetEntityObject` does. */
async function entityObject(entityName: string): Promise<BaseEntity> {
    const info = entities.find((e) => e.Name.toLowerCase() === entityName.toLowerCase());
    if (!info) throw new Error(`No EntityInfo registered in this test for '${entityName}'.`);
    return MJGlobal.Instance.ClassFactory.CreateInstance<BaseEntity>(BaseEntity, entityName, info)!;
}

beforeEach(() => {
    entities = [
        mockEntityInfo(JE_ENTITY, ['ID', 'EntryNumber', 'EffectiveDate', 'LinkedRecordID', 'Description']),
        mockEntityInfo(JEL_ENTITY, ['ID', 'JournalEntryID', 'DebitAmount', 'CreditAmount']),
    ];
    const provider = {
        Entities: entities,
        FindEntityByName: (name: string) => entities.find((e) => e.Name.toLowerCase() === name.toLowerCase()),
        // What `Lines.Create()` calls to issue a child.
        GetEntityObject: (name: string) => entityObject(name),
        Config: { ActiveStatusAssertions: false },
    } as never;
    Metadata.Provider = provider;
    BaseEntity.Provider = provider;
});

async function mockEntry(fields: {
    EntryNumber: string;
    EffectiveDate: Date;
    LinkedRecordID: string;
    Description: string;
    CreditAmount: number;
}): Promise<mjBizAppsAccountingJournalEntryEntity> {
    const entry = (await entityObject(JE_ENTITY)) as mjBizAppsAccountingJournalEntryEntity;
    entry.NewRecord();
    entry.EntryNumber = fields.EntryNumber;
    entry.EffectiveDate = fields.EffectiveDate;
    entry.LinkedRecordID = fields.LinkedRecordID;
    entry.Description = fields.Description;

    const line = (await entry.Lines.Create()) as mjBizAppsAccountingJournalEntryLineEntity;
    line.CreditAmount = fields.CreditAmount;
    return entry;
}

describe('DeferredRevenueWaterfallComponent', () => {
    it('computes summary statistics for an array of Journal Entries', async () => {
        const comp = new DeferredRevenueWaterfallComponent();

        const entries: mjBizAppsAccountingJournalEntryEntity[] = [];
        for (let i = 1; i <= 12; i++) {
            entries.push(await mockEntry({
                EntryNumber: String(1000 + i),
                EffectiveDate: new Date(2026, i - 1, 1),
                LinkedRecordID: 'sub-term-1',
                Description: 'Monthly Subscription Rev Rec',
                CreditAmount: 100,
            }));
        }

        comp.JournalEntries = entries;
        comp.ngOnChanges({
            JournalEntries: {
                currentValue: entries,
                previousValue: [],
                firstChange: true,
                isFirstChange: () => true,
            },
        });

        expect(comp.Rows.length).toBe(1);
        expect(comp.Summary.TotalDeferredBeginning).toBe(1200);
        expect(comp.IsSingleItem).toBe(true);
        expect(comp.MonthHeaders.length).toBe(12);
    });

    it('formats money and compact currency correctly', () => {
        const comp = new DeferredRevenueWaterfallComponent();
        expect(comp.FormatMoney(1200)).toBe('$1,200.00');
        expect(comp.FormatCompact(1500)).toBe('$2k');
        expect(comp.FormatCompact(1500000)).toBe('$1.5M');
        expect(comp.FormatCompact(0)).toBe('—');
    });

    it('handles empty entries gracefully', () => {
        const comp = new DeferredRevenueWaterfallComponent();
        comp.JournalEntries = [];
        comp.ngOnChanges({
            JournalEntries: {
                currentValue: [],
                previousValue: [],
                firstChange: true,
                isFirstChange: () => true,
            },
        });
        expect(comp.Rows.length).toBe(0);
        expect(comp.Summary.TotalDeferredBeginning).toBe(0);
    });
});
