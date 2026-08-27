/**
 * Unit tests for `JournalEntryBatchEntityServer.Approve` — the atomicity of a CFO sign-off.
 *
 * Approving used to be TWO independent writes that nothing coupled: `gate.recordDecision(...)`
 * (what `assertApproved` reads, blocking dispatch) and the batch's own `Status` (what
 * `sendJournalEntryBatch` reads). Neither implied the other, so both half-approved states were
 * reachable — and both were hit in practice:
 *
 *   A. Approved with no decision  → send clears its status check, then the gate throws.
 *   B. Decision recorded while Pending → the gate is satisfied, then send throws on the status.
 *
 * Both refusals are correct; the defect is that a batch could SIT in either state indefinitely.
 * These tests assert the state is gone, not merely that two calls happen in one method: the fake
 * world below models a transaction — writes land in a PENDING buffer that only becomes durable on
 * commit and is discarded on rollback — so "no half-approved state" is checked against what a
 * later reader (the gate / the dispatcher) would actually see.
 *
 * No DB (vitest.config.ts: isolated unit tests only). The live, DB-backed proof of the same
 * invariant belongs in the tsx harness at <app-root>/test-harnesses/server/.
 * Mock-entity harness pattern follows JournalEntryBatchInvariants.test.ts.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BaseEntity, EntityInfo, Metadata, UserInfo } from '@memberjunction/core';
import type { TaskDecisionOutcomeCode } from '@mj-biz-apps/tasks-core';
import { JournalEntryBatchEntityServer } from '../JournalEntryBatchEntityServer.js';
import type { JournalEntryBatchApprovalGate } from '../JournalEntryBatchEngine.js';

const BATCH_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Batches';
const BATCH_ID = '11111111-2222-3333-4444-555555555555';
const USER_ID = '99999999-8888-7777-6666-555555555555';

/**
 * A transactional world just real enough to answer the question these tests exist to ask:
 * "after this call, what would the NEXT reader see?" Writes go to a pending buffer; commit makes
 * them durable, rollback discards them. Both halves of an approval write here, so a half-approved
 * state is representable — which is what makes its absence worth asserting.
 */
class FakeWorld {
  /** Durable state — what `assertApproved` / `sendJournalEntryBatch` would read. */
  public committedDecision: TaskDecisionOutcomeCode | null = null;
  public committedStatus = 'Pending';
  /** In-flight state, discarded on rollback. */
  private pendingDecision: TaskDecisionOutcomeCode | null = null;
  private pendingStatus: string | null = null;
  /** Ordered trace of transaction + write events, so ordering bugs surface as trace mismatches. */
  public readonly trace: string[] = [];

  public begin(): void { this.trace.push('begin'); }

  public commit(): void {
    if (this.pendingDecision !== null) this.committedDecision = this.pendingDecision;
    if (this.pendingStatus !== null) this.committedStatus = this.pendingStatus;
    this.clearPending();
    this.trace.push('commit');
  }

  public rollback(): void {
    this.clearPending();
    this.trace.push('rollback');
  }

  public writeDecision(outcome: TaskDecisionOutcomeCode): void {
    this.pendingDecision = outcome;
    this.trace.push('write:decision');
  }

  public writeStatus(status: string): void {
    this.pendingStatus = status;
    this.trace.push('write:status');
  }

  private clearPending(): void {
    this.pendingDecision = null;
    this.pendingStatus = null;
  }
}

/** The two reads the production code makes of a sign-off — the gate's, and the dispatcher's. */
function gateWouldApprove(world: FakeWorld): boolean {
  return world.committedDecision === 'Approved' || world.committedDecision === 'ApprovedWithConditions';
}
function dispatcherWouldSend(world: FakeWorld): boolean {
  return world.committedStatus === 'Approved';
}

/** Minimal EntityInfo good enough to construct + hydrate the entity (no metadata service, no DB). */
function mockBatchEntityInfo(): EntityInfo {
  const info = Object.create(EntityInfo.prototype) as EntityInfo;
  const fieldNames = [
    'ID', 'JournalEntryBatchNumber', 'CompanyID', 'SummaryJournalEntryID', 'TargetSystem',
    'Status', 'TotalEntries', 'TotalDebits', 'TotalCredits', 'ApprovedAt', 'ApprovedByUserID',
    'ApprovalTaskID',
  ];
  const fields = fieldNames.map(fn => ({
    Name: fn, CodeName: fn,
    Type: fn === 'ID' || fn.endsWith('ID') ? 'uniqueidentifier' : 'nvarchar',
    TSType: 'string', IsPrimaryKey: fn === 'ID', AutoIncrement: false, ReadOnly: false, AllowsNull: true,
  }));
  // Populate EntityInfo's own BACKING fields rather than shadowing its getters: FieldByName builds
  // a lazy name→field map from `_Fields` and keys off `_fieldByNameMap === null`, so an instance
  // built with Object.create must seed both or every field read throws on undefined.
  const writable = info as unknown as Record<string, unknown>;
  writable.ID = 'entity-journal-entry-batches';
  writable.Name = BATCH_ENTITY;
  writable.Status = 'Active';
  writable.AllowDirectSQL = true;
  writable._Fields = fields;
  writable._fieldByNameMap = null;
  writable._primaryKeysCache = null;
  return info;
}

/** A gate whose `recordDecision` writes into the transactional world (and can be told to fail). */
function makeGate(world: FakeWorld, failWith?: string): JournalEntryBatchApprovalGate {
  return {
    async assertApproved(): Promise<void> {
      if (!gateWouldApprove(world)) throw new Error('not approved — no terminal decision');
    },
    async recordDecision(_batchId, outcome): Promise<void> {
      if (failWith) throw new Error(failWith);
      world.writeDecision(outcome);
    },
  };
}

describe('JournalEntryBatchEntityServer.Approve — decision + status, one transaction', () => {
  let world: FakeWorld;
  let batch: JournalEntryBatchEntityServer;
  let user: UserInfo;

  /** Stub Save() so the test exercises Approve's orchestration, not BaseEntity persistence. */
  const stubSave = (succeeds: boolean): void => {
    vi.spyOn(batch, 'Save').mockImplementation(async () => {
      if (!succeeds) return false;
      world.writeStatus(batch.Status);
      return true;
    });
  };

  beforeEach(async () => {
    world = new FakeWorld();
    const info = mockBatchEntityInfo();
    const provider = {
      Entities: [info],
      FindEntityByName: (name: string) => (name.toLowerCase() === BATCH_ENTITY.toLowerCase() ? info : undefined),
      Config: { ActiveStatusAssertions: false },
      BeginTransaction: async (): Promise<void> => { world.begin(); },
      CommitTransaction: async (): Promise<void> => { world.commit(); },
      RollbackTransaction: async (): Promise<void> => { world.rollback(); },
    };
    Metadata.Provider = provider as unknown as typeof Metadata.Provider;
    BaseEntity.Provider = provider as unknown as typeof BaseEntity.Provider;

    user = { ID: USER_ID, Name: 'CFO' } as unknown as UserInfo;
    batch = new JournalEntryBatchEntityServer(info);
    // LoadFromData marks the record saved — Approve refuses an unsaved batch.
    await batch.LoadFromData({ ID: BATCH_ID, JournalEntryBatchNumber: 'JEB-0001', Status: 'Pending', CompanyID: 'CO_1' });
    batch.ContextCurrentUser = user;
  });

  // ─── both halves commit together ─────────────────────────────────────────

  it('commits BOTH halves: the decision is recorded and the batch flips to Approved', async () => {
    const gate = makeGate(world);
    stubSave(true);

    await expect(batch.Approve('Approved', 'person-1', 'looks good', gate, user)).resolves.toBe(true);

    expect(world.committedDecision).toBe('Approved');
    expect(world.committedStatus).toBe('Approved');
    expect(world.trace).toEqual(['begin', 'write:decision', 'write:status', 'commit']);
  });

  it('stamps the approval audit pair from the context user', async () => {
    stubSave(true);
    await batch.Approve('Approved', 'person-1', undefined, makeGate(world), user);
    expect(batch.ApprovedByUserID).toBe(USER_ID);
  });

  it('accepts ApprovedWithConditions — tasks-core decides what approves, not a local literal', async () => {
    stubSave(true);
    await expect(batch.Approve('ApprovedWithConditions', undefined, undefined, makeGate(world), user)).resolves.toBe(true);
    expect(world.committedDecision).toBe('ApprovedWithConditions');
    expect(world.committedStatus).toBe('Approved');
  });

  // ─── a failure in EITHER half rolls back BOTH ────────────────────────────

  it('gate failure rolls back both halves — no decision, and the batch is still Pending', async () => {
    const gate = makeGate(world, 'no approval Task for this batch');
    stubSave(true);

    await expect(batch.Approve('Approved', 'person-1', undefined, gate, user)).rejects.toThrow('no approval Task');

    expect(world.committedDecision).toBeNull();
    expect(world.committedStatus).toBe('Pending');
    expect(world.trace).toEqual(['begin', 'rollback']);
  });

  it('status-save failure rolls back both halves — the recorded decision does NOT survive', async () => {
    const gate = makeGate(world);
    stubSave(false);

    await expect(batch.Approve('Approved', 'person-1', undefined, gate, user)).rejects.toThrow('Pending→Approved failed');

    // The half that DID run must be gone: this is failure mode B (decision recorded, batch Pending).
    expect(world.committedDecision).toBeNull();
    expect(world.committedStatus).toBe('Pending');
    expect(world.trace).toEqual(['begin', 'write:decision', 'rollback']);
  });

  // ─── the two pre-existing half-approved states are unreachable ───────────

  it('failure mode A (Approved with no decision) is unreachable — success implies the gate is satisfied', async () => {
    stubSave(true);
    await batch.Approve('Approved', 'person-1', undefined, makeGate(world), user);

    expect(dispatcherWouldSend(world)).toBe(true);
    // The exact state that used to pass the status check and then throw at the gate.
    await expect(makeGate(world).assertApproved(BATCH_ID, user)).resolves.toBeUndefined();
    expect(gateWouldApprove(world)).toBe(true);
  });

  it('failure mode B (decision recorded while Pending) is unreachable — success implies Approved', async () => {
    stubSave(true);
    await batch.Approve('Approved', 'person-1', undefined, makeGate(world), user);

    expect(gateWouldApprove(world)).toBe(true);
    // The exact state that used to satisfy the gate and then throw on "batch … is Pending".
    expect(dispatcherWouldSend(world)).toBe(true);
  });

  it('every outcome leaves the two halves AGREEING — never one without the other', async () => {
    for (const saveSucceeds of [true, false]) {
      for (const gateFails of [undefined, 'gate down']) {
        world = new FakeWorld();
        await batch.LoadFromData({ ID: BATCH_ID, JournalEntryBatchNumber: 'JEB-0001', Status: 'Pending', CompanyID: 'CO_1' });
        batch.ContextCurrentUser = user;
        stubSave(saveSucceeds);
        await batch.Approve('Approved', undefined, undefined, makeGate(world, gateFails), user).catch(() => undefined);
        expect(gateWouldApprove(world), `save=${saveSucceeds} gateFails=${gateFails}`).toBe(dispatcherWouldSend(world));
      }
    }
  });

  // ─── pre-transaction guards ──────────────────────────────────────────────

  it('refuses a non-approving outcome — Approve() may not record a rejection and flip to Approved', async () => {
    const gate = makeGate(world);
    stubSave(true);

    await expect(batch.Approve('Rejected', 'person-1', undefined, gate, user)).rejects.toThrow('is not an approval outcome');

    expect(world.committedDecision).toBeNull();
    expect(world.committedStatus).toBe('Pending');
    expect(world.trace).toEqual([]); // refused before the transaction opened
  });

  it('refuses a batch that is not Pending, and writes nothing', async () => {
    await batch.LoadFromData({ ID: BATCH_ID, JournalEntryBatchNumber: 'JEB-0001', Status: 'Sent', CompanyID: 'CO_1' });
    batch.ContextCurrentUser = user;
    stubSave(true);

    await expect(batch.Approve('Approved', 'person-1', undefined, makeGate(world), user)).rejects.toThrow('only a Pending batch can be approved');
    expect(world.trace).toEqual([]);
  });

  it('refuses an unsaved batch', async () => {
    const fresh = new JournalEntryBatchEntityServer(mockBatchEntityInfo());
    fresh.NewRecord();
    await expect(fresh.Approve('Approved', undefined, undefined, makeGate(world), user)).rejects.toThrow('must be saved');
  });
});
