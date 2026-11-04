import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  BaseEntity,
  CrossEntityPolicyEngine,
  type DatabaseProviderBase,
  DocumentNumberingEngine,
  EntityFieldInfo,
  EntityInfo,
  EntityLifecyclePolicyEngine,
  type IMetadataProvider,
  InMemoryDocumentSequenceStore,
  Metadata,
  UserInfo,
  ValidationResult,
} from '@memberjunction/core';
import { AccountingEngineBase } from '@mj-biz-apps/accounting-engine-base';
import {
  CustomRoutineDocumentSequenceStore,
  JOURNAL_ENTRY_BATCH_LIFECYCLE_POLICY,
  JOURNAL_ENTRY_BATCH_NUMBER_POLICY,
  JOURNAL_ENTRY_LIFECYCLE_POLICY,
  JOURNAL_ENTRY_LINE_CROSS_ENTITY_POLICY,
  JOURNAL_ENTRY_NUMBER_POLICY,
  JournalEntryBatchEntityServer,
  JournalEntryEntityServer,
  JournalEntryLineEntityServer,
  registerAccountingNumberingPolicies,
  registerJournalEntryBatchLifecyclePolicy,
  registerJournalEntryLifecyclePolicy,
  registerJournalEntryLineCrossEntityPolicy,
} from '../index.js';

const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';
const JEL_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Lines';
const BATCH_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Batches';

const COMPANY_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_COMPANY_ID = '22222222-2222-4222-8222-222222222222';
const JE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const GL_MATCH_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const GL_OTHER_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const USER = { ID: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' } as UserInfo;

function createEntityInfo(name: string, fieldNames: ReadonlyArray<string>, nonNullableFields: ReadonlyArray<string> = []): EntityInfo {
  const info = Object.create(EntityInfo.prototype) as EntityInfo;
  info.ID = `id-${name}`;
  info.Name = name;
  info.Status = 'Active';
  info.AllowDirectSQL = true;
  Object.defineProperty(info, 'Settings', {
    get: () => [],
    configurable: true,
  });

  const nonNullSet = new Set(nonNullableFields);
  const fields: EntityFieldInfo[] = fieldNames.map(
    (fn) =>
      ({
        Name: fn,
        DisplayName: fn,
        DisplayNameOrName: fn,
        CodeName: fn,
        Type: fn === 'ID' || fn.endsWith('ID') ? 'uniqueidentifier' : 'nvarchar',
        TSType: 'string',
        MaxLength: 50,
        IsPrimaryKey: fn === 'ID',
        IsVirtual: false,
        IsSpecialDateField: false,
        AutoIncrement: false,
        ReadOnly: false,
        AllowsNull: !nonNullSet.has(fn),
        ValueListType: 'None',
        EntityFieldValues: [],
        ValueIsPermittedByValueList: () => true,
      }) as EntityFieldInfo,
  );

  Object.defineProperty(info, 'Fields', {
    get: () => fields,
    configurable: true,
  });
  Object.defineProperty(info, 'PrimaryKeys', {
    get: () => fields.filter((f) => f.IsPrimaryKey),
    configurable: true,
  });
  Object.defineProperty(info, 'FirstPrimaryKey', {
    get: () => fields.find((f) => f.IsPrimaryKey) ?? fields[0],
    configurable: true,
  });
  Object.defineProperty(info, 'HasInactiveFields', {
    get: () => false,
    configurable: true,
  });
  return info;
}

describe('Platform Primitives Adoption (PR #6203) — bizapps-accounting', () => {
  let jeInfo: EntityInfo;
  let jelInfo: EntityInfo;
  let batchInfo: EntityInfo;

  beforeEach(() => {
    registerJournalEntryLifecyclePolicy();
    registerJournalEntryBatchLifecyclePolicy();
    registerAccountingNumberingPolicies();
    registerJournalEntryLineCrossEntityPolicy();

    jeInfo = createEntityInfo(
      JE_ENTITY,
      [
        'ID',
        'CompanyID',
        'EffectiveDate',
        'EntryTypeID',
        'Status',
        'EntryNumber',
        'JournalEntryBatchID',
        'LinkedEntityID',
        'LinkedRecordID',
      ],
      ['EntryNumber'],
    );
    jelInfo = createEntityInfo(JEL_ENTITY, [
      'ID',
      'JournalEntryID',
      'LineNumber',
      'GLAccountID',
      'DebitAmount',
      'CreditAmount',
      'Description',
    ]);
    batchInfo = createEntityInfo(
      BATCH_ENTITY,
      [
        'ID',
        'JournalEntryBatchNumber',
        'CompanyID',
        'PostingDate',
        'SummaryJournalEntryID',
        'TargetSystem',
        'Status',
        'TotalEntries',
        'TotalDebits',
        'TotalCredits',
      ],
      ['JournalEntryBatchNumber'],
    );

    const entities = [jeInfo, jelInfo, batchInfo];
    const provider = {
      Entities: entities,
      FindEntityByName: (n: string) => entities.find((e) => e.Name.toLowerCase() === n.toLowerCase()),
      Config: { ActiveStatusAssertions: false },
    } as IMetadataProvider;
    Metadata.Provider = provider;
    BaseEntity.Provider = provider;
  });

  describe('EntityLifecyclePolicyEngine registrations', () => {
    it('registers state machine and immutableAfterCreateFields for Journal Entries', () => {
      const resolved = EntityLifecyclePolicyEngine.Instance.ResolvePolicy(jeInfo);
      expect(resolved).not.toBeNull();
      expect(resolved?.stateMachine?.statusField).toBe('Status');
      expect(resolved?.stateMachine?.initialStates).toEqual(['Pending']);
      expect(resolved?.stateMachine?.terminalStates).toEqual(['GLPosted']);
      expect(resolved?.stateMachine?.immutableAfterCreateFields).toEqual(['LinkedEntityID', 'LinkedRecordID']);
      expect(resolved?.stateMachine?.transitions).toEqual(JOURNAL_ENTRY_LIFECYCLE_POLICY.stateMachine?.transitions);
    });

    it('enforces Journal Entry transition rules, clearedFieldsOnTransition, and post-create immutability via EntityLifecyclePolicyEngine', () => {
      const je = new JournalEntryEntityServer(jeInfo);
      je.SetMany(
        {
          ID: JE_ID,
          CompanyID: COMPANY_ID,
          Status: 'Batched',
          EntryNumber: 'JE-ACME-2026-000001',
          JournalEntryBatchID: 'batch-1',
          LinkedEntityID: 'entity-1',
          LinkedRecordID: 'rec-1',
        },
        true,
        true,
      );

      // Batched -> Pending without clearing JournalEntryBatchID is rejected by EntityLifecyclePolicyEngine
      je.Status = 'Pending';
      const unclearedResult = new ValidationResult();
      EntityLifecyclePolicyEngine.Instance.ValidateLifecycleOnEntity(je, USER, unclearedResult);
      expect(unclearedResult.Success).toBe(false);
      expect(unclearedResult.Errors.some((e) => e.Message.includes('JournalEntryBatchID'))).toBe(true);

      // Clearing JournalEntryBatchID satisfies the transition rule
      je.JournalEntryBatchID = null;
      const clearedResult = new ValidationResult();
      clearedResult.Success = true;
      EntityLifecyclePolicyEngine.Instance.ValidateLifecycleOnEntity(je, USER, clearedResult);
      expect(clearedResult.Success).toBe(true);
      expect(clearedResult.Errors).toHaveLength(0);

      // Modifying LinkedEntityID or LinkedRecordID after creation is rejected
      je.LinkedRecordID = 'rec-tampered';
      const immutableResult = new ValidationResult();
      EntityLifecyclePolicyEngine.Instance.ValidateLifecycleOnEntity(je, USER, immutableResult);
      expect(immutableResult.Success).toBe(false);
      expect(immutableResult.Errors.some((e) => e.Message.includes("Field 'LinkedRecordID'"))).toBe(true);
    });

    it('registers state machine for Journal Entry Batches and enforces legal transitions and terminal states', () => {
      const resolved = EntityLifecyclePolicyEngine.Instance.ResolvePolicy(batchInfo);
      expect(resolved).not.toBeNull();
      expect(resolved?.stateMachine?.statusField).toBe('Status');
      expect(resolved?.stateMachine?.initialStates).toEqual(['Pending']);
      expect(resolved?.stateMachine?.terminalStates).toEqual(['Posted', 'Cancelled', 'Archived']);
      expect(resolved?.stateMachine?.transitions).toEqual(JOURNAL_ENTRY_BATCH_LIFECYCLE_POLICY.stateMachine?.transitions);

      const batch = new JournalEntryBatchEntityServer(batchInfo);
      batch.SetMany(
        {
          ID: 'batch-1',
          JournalEntryBatchNumber: 'BATCH-000001',
          Status: 'Posted',
        },
        true,
        true,
      );
      batch.Status = 'Pending';
      const terminalResult = new ValidationResult();
      EntityLifecyclePolicyEngine.Instance.ValidateLifecycleOnEntity(batch, USER, terminalResult);
      expect(terminalResult.Success).toBe(false);
      expect(terminalResult.Errors.some((e) => e.Message.includes("terminal state 'Posted'"))).toBe(true);
    });
  });

  describe('DocumentNumberingEngine registrations & SequenceService integration', () => {
    it('registers EntryNumber and JournalEntryBatchNumber / BatchNumber policies on DocumentNumberingEngine', () => {
      const jePolicies = DocumentNumberingEngine.Instance.ResolvePolicies(jeInfo);
      expect(jePolicies).toHaveLength(1);
      expect(jePolicies[0]).toMatchObject({
        targetField: JOURNAL_ENTRY_NUMBER_POLICY.targetField,
        pattern: 'JE-{Scope:CompanyCode}-{FY}-{SEQ:6}',
        scopeFields: ['CompanyID'],
        resetPeriod: 'FiscalYear',
      });

      const batchPolicies = DocumentNumberingEngine.Instance.ResolvePolicies(batchInfo);
      expect(batchPolicies.map((p) => p.targetField)).toEqual(['JournalEntryBatchNumber']);
      expect(batchPolicies[0].pattern).toBe(JOURNAL_ENTRY_BATCH_NUMBER_POLICY.pattern);

      expect(DocumentNumberingEngine.Instance.WillAutoPopulateOnCreate(jeInfo, 'EntryNumber')).toBe(true);
      expect(DocumentNumberingEngine.Instance.WillAutoPopulateOnCreate(batchInfo, 'JournalEntryBatchNumber')).toBe(true);
    });

    it('allocates formatted EntryNumber and JournalEntryBatchNumber via DocumentNumberingEngine', async () => {
      const previousStore = DocumentNumberingEngine.Instance.GetSequenceStore();
      const memStore = new InMemoryDocumentSequenceStore();
      DocumentNumberingEngine.Instance.SetSequenceStore(memStore);
      try {
        const je = new JournalEntryEntityServer(jeInfo);
        je.NewRecord();
        je.CompanyID = 'ACME';
        je.EffectiveDate = new Date('2026-07-15T00:00:00Z');

        const assignedJeFields = await DocumentNumberingEngine.Instance.AllocateAndAssignForEntity(
          je,
          Metadata.Provider as DatabaseProviderBase,
          USER,
        );
        expect(assignedJeFields).toEqual(['EntryNumber']);
        expect(je.EntryNumber).toBe('JE-ACME-2026-000001');

        const batch = new JournalEntryBatchEntityServer(batchInfo);
        batch.NewRecord();
        const assignedBatchFields = await DocumentNumberingEngine.Instance.AllocateAndAssignForEntity(
          batch,
          Metadata.Provider as DatabaseProviderBase,
          USER,
        );
        expect(assignedBatchFields).toEqual(['JournalEntryBatchNumber']);
        expect(batch.JournalEntryBatchNumber).toBe('BATCH-000001');
      } finally {
        DocumentNumberingEngine.Instance.SetSequenceStore(previousStore);
      }
    });

    it('CustomRoutineDocumentSequenceStore parses trailing sequence integer from SQL routines', async () => {
      const store = new CustomRoutineDocumentSequenceStore();
      const executeSQL = vi
        .fn()
        .mockResolvedValueOnce([{ EntryNumber: 'JE-ACME-2026-000042' }])
        .mockResolvedValueOnce([{ JournalEntryBatchNumber: 'BATCH-000019' }]);
      const provider = Object.assign(Object.create( null ) as DatabaseProviderBase, {
        PlatformKey: 'sqlserver' as const,
        ExecuteSQL: executeSQL,
      });

      const jeSeq = await store.AllocateNext({
        sequenceKey: `${JE_ENTITY}.EntryNumber`,
        scopeKey: `Field:CompanyID=${COMPANY_ID}|Scope:CompanyCode=ACME|Scope:FY=2026|FY=2026`,
        startAt: 1,
        incrementBy: 1,
        provider,
        contextUser: USER,
      });
      expect(jeSeq).toBe(42);

      const batchSeq = await store.AllocateNext({
        sequenceKey: `${BATCH_ENTITY}.JournalEntryBatchNumber`,
        scopeKey: '__GLOBAL__',
        startAt: 1,
        incrementBy: 1,
        provider,
        contextUser: USER,
      });
      expect(batchSeq).toBe(19);
    });
  });

  describe('CrossEntityPolicyEngine — 100-line JournalEntry transaction memoization', () => {
    it('memoizes parent JournalEntry lookup per transaction so saving 100 lines queries the parent only once', async () => {
      let parentStatus = 'Pending';
      const runView = vi.fn(async () => ({
        Success: true,
        Results: [{ ID: JE_ID, Status: parentStatus, CompanyID: COMPANY_ID }],
      }));

      const txProvider = Object.assign(Object.create(null) as IMetadataProvider, {
        Entities: [jeInfo, jelInfo, batchInfo],
        FindEntityByName: (n: string) => [jeInfo, jelInfo, batchInfo].find((e) => e.Name.toLowerCase() === n.toLowerCase()),
        Config: { ActiveStatusAssertions: false },
        TransactionScopeCacheKey: 'tx-epoch-100-lines',
        RunView: runView,
      });

      const lines: JournalEntryLineEntityServer[] = [];
      for (let i = 1; i <= 100; i++) {
        const line = new JournalEntryLineEntityServer(jelInfo);
        line.NewRecord();
        line.JournalEntryID = JE_ID;
        line.LineNumber = i;
        line.GLAccountID = GL_MATCH_ID;
        if (i % 2 === 1) {
          line.DebitAmount = 10;
        } else {
          line.CreditAmount = 10;
        }
        lines.push(line);
      }

      for (const line of lines) {
        const err = await CrossEntityPolicyEngine.Instance.EnforceBeforeSave(line, USER, txProvider);
        expect(err).toBeNull();
      }

      // All 100 line evaluations shared the single memoized parent query!
      expect(runView).toHaveBeenCalledTimes(1);

      // Mutating the parent JournalEntry invalidates the transaction scope cache
      const parentJe = new JournalEntryEntityServer(jeInfo);
      parentJe.SetMany({ ID: JE_ID, Status: 'Batched', CompanyID: COMPANY_ID }, true, true);
      parentStatus = 'Batched';
      CrossEntityPolicyEngine.Instance.NotifyEntityMutated(txProvider, parentJe, 'Update');

      const lockedErr = await CrossEntityPolicyEngine.Instance.EnforceBeforeSave(lines[0], USER, txProvider);
      expect(lockedErr).toContain("while parent MJ_BizApps_Accounting: Journal Entries Status is 'Batched'");
      expect(runView).toHaveBeenCalledTimes(2);
    });

    it('PreEvaluateBatch primes parent JournalEntry in 1 bulk query and enforces company alignment', async () => {
      const runView = vi.fn(async () => ({
        Success: true,
        Results: [{ ID: JE_ID, Status: 'Pending', CompanyID: COMPANY_ID }],
      }));

      const batchProvider = Object.assign(Object.create(null) as IMetadataProvider, {
        Entities: [jeInfo, jelInfo],
        FindEntityByName: (n: string) => [jeInfo, jelInfo].find((e) => e.Name.toLowerCase() === n.toLowerCase()),
        Config: { ActiveStatusAssertions: false },
        TransactionScopeCacheKey: 'tx-epoch-batch',
        RunView: runView,
      });

      const glSpy = vi.spyOn(AccountingEngineBase.Instance, 'GLAccountByID').mockImplementation((id: string) => {
        if (id === GL_OTHER_ID) {
          return { ID: GL_OTHER_ID, CompanyID: OTHER_COMPANY_ID, Code: '9999', IsActive: true } as ReturnType<
            AccountingEngineBase['GLAccountByID']
          >;
        }
        return { ID: GL_MATCH_ID, CompanyID: COMPANY_ID, Code: '1000', IsActive: true } as ReturnType<
          AccountingEngineBase['GLAccountByID']
        >;
      });

      try {
        const lineOk = new JournalEntryLineEntityServer(jelInfo);
        lineOk.NewRecord();
        lineOk.JournalEntryID = JE_ID;
        lineOk.GLAccountID = GL_MATCH_ID;
        lineOk.DebitAmount = 50;

        const lineMismatch = new JournalEntryLineEntityServer(jelInfo);
        lineMismatch.NewRecord();
        lineMismatch.JournalEntryID = JE_ID;
        lineMismatch.GLAccountID = GL_OTHER_ID;
        lineMismatch.CreditAmount = 50;

        const batchErr = await CrossEntityPolicyEngine.Instance.PreEvaluateBatch(
          [
            { Entity: lineOk, Operation: 'Create' },
            { Entity: lineMismatch, Operation: 'Create' },
          ],
          batchProvider,
          USER,
        );
        expect(batchErr).toContain(`belongs to company ${OTHER_COMPANY_ID}, but parent journal entry belongs to company ${COMPANY_ID}`);
        expect(runView).toHaveBeenCalledTimes(1);
        expect(JOURNAL_ENTRY_LINE_CROSS_ENTITY_POLICY.PolicyKey).toBe(
          'MJ_BizApps_Accounting.JournalEntryLine.ParentJournalEntryPolicy',
        );
      } finally {
        glSpy.mockRestore();
      }
    });

    it('vetoes reassigning JournalEntryID away from a locked (Batched) JournalEntry', async () => {
      const PENDING_JE_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
      const runView = vi.fn(async (params: { ExtraFilter?: string }) => {
        if (params.ExtraFilter?.includes(JE_ID)) {
          return {
            Success: true,
            Results: [{ ID: JE_ID, Status: 'Batched', CompanyID: COMPANY_ID }],
          };
        }
        return {
          Success: true,
          Results: [{ ID: PENDING_JE_ID, Status: 'Pending', CompanyID: COMPANY_ID }],
        };
      });

      const reassignProvider = Object.assign(Object.create(null) as IMetadataProvider, {
        Entities: [jeInfo, jelInfo],
        FindEntityByName: (n: string) => [jeInfo, jelInfo].find((e) => e.Name.toLowerCase() === n.toLowerCase()),
        Config: { ActiveStatusAssertions: false },
        TransactionScopeCacheKey: 'tx-epoch-reassign',
        RunView: runView,
      });

      const savedLine = new JournalEntryLineEntityServer(jelInfo);
      savedLine.SetMany(
        {
          ID: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
          JournalEntryID: JE_ID,
          LineNumber: 1,
          GLAccountID: GL_MATCH_ID,
          DebitAmount: 25,
        },
        true,
        true,
      );
      savedLine.JournalEntryID = PENDING_JE_ID;

      const err = await CrossEntityPolicyEngine.Instance.EnforceBeforeSave(savedLine, USER, reassignProvider);
      expect(err).toContain("while parent MJ_BizApps_Accounting: Journal Entries Status is 'Batched'");
    });
  });
});
