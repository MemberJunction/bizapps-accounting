/**
 * Unit tests for the refresh-once-on-miss link walk (bc-aidp-next-golive#438):
 * ResolveFirstLinkedAccount / RefreshAfterLinkMiss.
 *
 * The cached collections are stubbed by shadowing getters on an instance, and `Config` is stubbed
 * to stand in for the database: a "reload" swaps in the rows a direct SQL write would have added.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountingEngineBase, LINK_MISS_REFRESH_INTERVAL_MS, type LinkedRecordRef } from '../AccountingEngineBase.js';

const COMPANY = 'aaaaaaaa-0000-0000-0000-000000000001';
const PRODUCT_ENTITY = 'bbbbbbbb-0000-0000-0000-000000000001';
const CATEGORY_ENTITY = 'bbbbbbbb-0000-0000-0000-000000000002';
const PRODUCT = 'cccccccc-0000-0000-0000-000000000001';
const CATEGORY = 'cccccccc-0000-0000-0000-000000000002';
const SALES_ROLE = 'dddddddd-0000-0000-0000-000000000001';
const SALES_GL = '11111111-0000-0000-0000-000000000001';
const CATEGORY_GL = '11111111-0000-0000-0000-000000000002';

interface LinkRow {
  ID: string;
  EntityID: string;
  RecordID: string;
  GLAccountRoleID: string;
  GLAccountID: string;
  Status: 'Active' | 'Pending' | 'Disabled';
  StartedAt: Date | null;
  EndedAt: Date | null;
}

const link = (id: string, entityId: string, recordId: string, glAccountId: string): LinkRow => ({
  ID: id,
  EntityID: entityId,
  RecordID: recordId,
  GLAccountRoleID: SALES_ROLE,
  GLAccountID: glAccountId,
  Status: 'Active',
  StartedAt: null,
  EndedAt: null,
});

const WALK: LinkedRecordRef[] = [
  { EntityID: PRODUCT_ENTITY, RecordID: PRODUCT },
  { EntityID: CATEGORY_ENTITY, RecordID: CATEGORY },
];
const AS_OF = new Date('2026-11-05');

/** An engine whose cache holds `cached`, and whose reload replaces it with `database`. */
function engineWith(cached: LinkRow[], database: LinkRow[]): { engine: AccountingEngineBase; config: ReturnType<typeof vi.fn> } {
  const engine = Object.create(AccountingEngineBase.prototype) as AccountingEngineBase;
  let links = cached;
  Object.defineProperty(engine, 'GLAccountRoles', { get: () => [{ ID: SALES_ROLE, Name: 'Sales', Cardinality: 'One' }] });
  Object.defineProperty(engine, 'GLAccountLinks', { get: () => links });
  Object.defineProperty(engine, 'GLAccountLinkDimensions', { get: () => [] });
  Object.defineProperty(engine, 'GLAccounts', {
    get: () => [
      { ID: SALES_GL, CompanyID: COMPANY },
      { ID: CATEGORY_GL, CompanyID: COMPANY },
    ],
  });
  const config = vi.fn(async () => {
    links = database;
  });
  Object.defineProperty(engine, 'Config', { value: config });
  return { engine, config };
}

describe('ResolveFirstLinkedAccount', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-05T16:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the first record in walk order that resolves, without reloading', async () => {
    const both = [link('l-cat', CATEGORY_ENTITY, CATEGORY, CATEGORY_GL), link('l-prod', PRODUCT_ENTITY, PRODUCT, SALES_GL)];
    const { engine, config } = engineWith(both, both);

    const hit = await engine.ResolveFirstLinkedAccount(WALK, 'Sales', AS_OF, { ForCompanyID: COMPANY });

    expect(hit?.Link.GLAccountID).toBe(SALES_GL);
    expect(hit?.Record).toEqual(WALK[0]);
    expect(config).not.toHaveBeenCalled();
  });

  it('falls through a record with no link without reloading', async () => {
    const categoryOnly = [link('l-cat', CATEGORY_ENTITY, CATEGORY, CATEGORY_GL)];
    const { engine, config } = engineWith(categoryOnly, categoryOnly);

    const hit = await engine.ResolveFirstLinkedAccount(WALK, 'Sales', AS_OF);

    expect(hit?.Record).toEqual(WALK[1]);
    expect(config).not.toHaveBeenCalled();
  });

  it('reloads once and finds a link written behind the cache', async () => {
    const { engine, config } = engineWith([], [link('l-sql', CATEGORY_ENTITY, CATEGORY, CATEGORY_GL)]);

    const hit = await engine.ResolveFirstLinkedAccount(WALK, 'Sales', AS_OF, { ForCompanyID: COMPANY });

    expect(config).toHaveBeenCalledTimes(1);
    expect(config.mock.calls[0][0]).toBe(true);
    expect(hit?.Link.ID).toBe('l-sql');
  });

  it('returns null after one reload when the database has no link either', async () => {
    const { engine, config } = engineWith([], []);

    expect(await engine.ResolveFirstLinkedAccount(WALK, 'Sales', AS_OF)).toBeNull();
    expect(config).toHaveBeenCalledTimes(1);
  });

  it('does not reload for an empty walk', async () => {
    const { engine, config } = engineWith([], []);

    expect(await engine.ResolveFirstLinkedAccount([], 'Sales', AS_OF)).toBeNull();
    expect(config).not.toHaveBeenCalled();
  });

  it('does not reload again within the interval, and does after it', async () => {
    const { engine, config } = engineWith([], []);

    await engine.ResolveFirstLinkedAccount(WALK, 'Sales', AS_OF);
    await engine.ResolveFirstLinkedAccount(WALK, 'Sales', AS_OF);
    expect(config).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(LINK_MISS_REFRESH_INTERVAL_MS);
    await engine.ResolveFirstLinkedAccount(WALK, 'Sales', AS_OF);
    expect(config).toHaveBeenCalledTimes(2);
  });

  it('keeps the company scope on the retry', async () => {
    const otherCompanyOnly = [link('l-other', CATEGORY_ENTITY, CATEGORY, CATEGORY_GL)];
    const { engine } = engineWith([], otherCompanyOnly);

    const hit = await engine.ResolveFirstLinkedAccount(WALK, 'Sales', AS_OF, {
      ForCompanyID: 'eeeeeeee-0000-0000-0000-000000000009',
    });

    expect(hit).toBeNull();
  });
});

describe('RefreshAfterLinkMiss', () => {
  it('shares one reload between concurrent callers', async () => {
    const { engine, config } = engineWith([], []);

    const results = await Promise.all([engine.RefreshAfterLinkMiss(), engine.RefreshAfterLinkMiss()]);

    expect(results).toEqual([true, true]);
    expect(config).toHaveBeenCalledTimes(1);
  });

  it('lets the next miss retry when a reload fails', async () => {
    const { engine, config } = engineWith([], []);
    config.mockRejectedValueOnce(new Error('database unavailable'));

    await expect(engine.RefreshAfterLinkMiss()).rejects.toThrow('database unavailable');
    expect(await engine.RefreshAfterLinkMiss()).toBe(true);
    expect(config).toHaveBeenCalledTimes(2);
  });
});
