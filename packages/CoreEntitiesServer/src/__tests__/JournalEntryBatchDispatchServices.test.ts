/**
 * Who may replace the batch approval gate, ERP poster and ERP lookup (#452). The ClassFactory hands
 * back the highest-priority registration, so any server package could register a gate that approves
 * everything. A replacement is honoured only in a unit-test run or when the server's environment
 * names it; anywhere else the real services are used. Also: approveJournalEntryBatch records the
 * context user as the approver and refuses to be told otherwise (#447).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { IMetadataProvider, UserInfo } from '@memberjunction/core';
import { MJGlobal } from '@memberjunction/global';
import { DISPATCH_SERVICES_OVERRIDE_ENV, JournalEntryBatchDispatchServices } from '../JournalEntryBatchDispatchServices.js';
import { approveJournalEntryBatch } from '../JournalEntryBatchEngine.js';

class ReplacementDispatchServices extends JournalEntryBatchDispatchServices {}

describe('JournalEntryBatchDispatchServices.Resolve — a replacement must be deliberate (#452)', () => {
  let savedVitest: string | undefined;
  let savedOverride: string | undefined;

  beforeEach(() => {
    savedVitest = process.env.VITEST;
    savedOverride = process.env[DISPATCH_SERVICES_OVERRIDE_ENV];
    // Above every other test file's registration, so this file decides what the ClassFactory returns.
    MJGlobal.Instance.ClassFactory.Register(JournalEntryBatchDispatchServices, ReplacementDispatchServices, null, 100000, true);
  });

  afterEach(() => {
    if (savedVitest === undefined) delete process.env.VITEST;
    else process.env.VITEST = savedVitest;
    if (savedOverride === undefined) delete process.env[DISPATCH_SERVICES_OVERRIDE_ENV];
    else process.env[DISPATCH_SERVICES_OVERRIDE_ENV] = savedOverride;
  });

  it('honours a replacement in a unit-test run', () => {
    expect(JournalEntryBatchDispatchServices.Resolve()).toBeInstanceOf(ReplacementDispatchServices);
  });

  it('uses the real services outside a test run when the environment names no replacement', () => {
    delete process.env.VITEST;
    delete process.env[DISPATCH_SERVICES_OVERRIDE_ENV];
    const services = JournalEntryBatchDispatchServices.Resolve();
    expect(services.constructor).toBe(JournalEntryBatchDispatchServices);
  });

  it('uses the real services when the environment names a different class', () => {
    delete process.env.VITEST;
    process.env[DISPATCH_SERVICES_OVERRIDE_ENV] = 'SomeOtherDispatchServices';
    expect(JournalEntryBatchDispatchServices.Resolve().constructor).toBe(JournalEntryBatchDispatchServices);
  });

  it('honours the replacement the environment names', () => {
    delete process.env.VITEST;
    process.env[DISPATCH_SERVICES_OVERRIDE_ENV] = ReplacementDispatchServices.name;
    expect(JournalEntryBatchDispatchServices.Resolve()).toBeInstanceOf(ReplacementDispatchServices);
  });
});

describe('approveJournalEntryBatch — the approver is the context user (#447)', () => {
  it('refuses an approvedByUserId other than the context user, before reading anything', async () => {
    const contextUser = { ID: 'a1a1a1a1-0000-4000-8000-0000000000a1' } as UserInfo;
    const provider = {} as IMetadataProvider;
    await expect(approveJournalEntryBatch('e9521aa3-f4ef-4ec5-a899-d9dd59f320b7', 'b2b2b2b2-0000-4000-8000-0000000000b2', contextUser, provider))
      .rejects.toThrow(/is not the context user/);
  });
});
