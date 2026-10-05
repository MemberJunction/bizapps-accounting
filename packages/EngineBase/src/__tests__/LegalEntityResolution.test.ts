/**
 * Unit tests for the legal-entity walk (bc-aidp-next-golive#313): which company's books a company
 * uses. A Division, Department or Branch walks up its parents to the first company of any other
 * type; every other type is its own legal entity.
 *
 * Driven through `AccountingEngineBase.LegalEntityFor` with the cached profiles stubbed by shadowing
 * the getter, so no DB, no BaseEngine.Config, no provider.
 *
 * CONNECTS TO:
 *   TESTS: ../AccountingEngineBase.ts (ResolveLegalEntity, LegalEntityFor, UsesParentBooks)
 *   DB:    trg_ACP_NoChains refuses a stored cycle; the walk refuses one too
 */
import { describe, it, expect } from 'vitest';
import {
  AccountingEngineBase,
  AccountingResolutionError,
  UsesParentBooks,
  type LegalEntityProfile,
} from '../AccountingEngineBase.js';

const HOLDING = 'AAAAAAAA-0000-0000-0000-000000000001';
const CONSULTING = 'BBBBBBBB-0000-0000-0000-000000000002';
const BRAND = 'CCCCCCCC-0000-0000-0000-000000000003';
const BRAND_TEAM = 'DDDDDDDD-0000-0000-0000-000000000004';
const SUBSIDIARY = 'EEEEEEEE-0000-0000-0000-000000000005';
const NO_PROFILE = 'FFFFFFFF-0000-0000-0000-000000000006';

const profile = (ID: string, EntityType: string, ParentAccountingCompanyID: string | null = null): LegalEntityProfile => ({
  ID,
  EntityType,
  ParentAccountingCompanyID,
});

/** A holding company, a legal entity under it, a division of that entity, and a team inside the division. */
const TREE: LegalEntityProfile[] = [
  profile(HOLDING, 'LegalEntity'),
  profile(CONSULTING, 'Subsidiary', HOLDING),
  profile(BRAND, 'Division', CONSULTING),
  profile(BRAND_TEAM, 'Department', BRAND),
  profile(SUBSIDIARY, 'Subsidiary', HOLDING),
];

function engineWith(profiles: LegalEntityProfile[]): AccountingEngineBase {
  const engine = Object.create(AccountingEngineBase.prototype) as AccountingEngineBase;
  Object.defineProperty(engine, 'CompanyProfiles', { get: () => profiles });
  return engine;
}

function unresolvedMessage(fn: () => unknown): string {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(AccountingResolutionError);
    expect((e as AccountingResolutionError).Code).toBe('LEGAL_ENTITY_UNRESOLVED');
    return (e as Error).message;
  }
  throw new Error('expected LEGAL_ENTITY_UNRESOLVED');
}

describe('LegalEntityFor — the walk', () => {
  const engine = engineWith(TREE);

  it('walks a Division up to its parent legal entity', () => {
    expect(engine.LegalEntityFor(BRAND)).toBe(CONSULTING);
  });

  it('walks through more than one hop (a Department inside a Division)', () => {
    expect(engine.LegalEntityFor(BRAND_TEAM)).toBe(CONSULTING);
  });

  it('stops at a Subsidiary even though it has a parent: it keeps its own books', () => {
    expect(engine.LegalEntityFor(SUBSIDIARY)).toBe(SUBSIDIARY);
    expect(engine.LegalEntityFor(CONSULTING)).toBe(CONSULTING);
  });

  it('returns a root legal entity as itself', () => {
    expect(engine.LegalEntityFor(HOLDING)).toBe(HOLDING);
  });

  it('treats a company with no profile as its own legal entity, as it booked before the rule', () => {
    expect(engine.LegalEntityFor(NO_PROFILE)).toBe(NO_PROFILE);
  });

  it('matches ids case-insensitively, as SQL Server and randomUUID() disagree on case', () => {
    expect(engine.LegalEntityFor(BRAND.toLowerCase())).toBe(CONSULTING);
  });

  it.each(['Partner', 'JointVenture', 'CostCenter', 'Other', 'LegalEntity'])('stops at a %s', (type) => {
    const e = engineWith([profile(HOLDING, 'LegalEntity'), profile(CONSULTING, type, HOLDING)]);
    expect(e.LegalEntityFor(CONSULTING)).toBe(CONSULTING);
  });
});

describe('LegalEntityFor — incomplete setup is refused, naming the company', () => {
  it('refuses a Division with no parent', () => {
    const message = unresolvedMessage(() => engineWith([profile(BRAND, 'Division')]).LegalEntityFor(BRAND));
    expect(message).toContain(BRAND);
    expect(message).toContain('no parent company');
  });

  it('refuses a Division whose parent has no profile', () => {
    const message = unresolvedMessage(() => engineWith([profile(BRAND, 'Branch', NO_PROFILE)]).LegalEntityFor(BRAND));
    expect(message).toContain(NO_PROFILE);
    expect(message).toContain('has no Accounting Company Profile');
  });

  it('refuses a loop of Divisions rather than spinning', () => {
    const loop = [profile(BRAND, 'Division', BRAND_TEAM), profile(BRAND_TEAM, 'Department', BRAND)];
    const message = unresolvedMessage(() => engineWith(loop).LegalEntityFor(BRAND));
    expect(message).toContain(BRAND);
    expect(message).toContain('loop');
  });
});

describe('UsesParentBooks', () => {
  it('is true for exactly Division, Department and Branch', () => {
    expect(['Division', 'Department', 'Branch'].every(UsesParentBooks)).toBe(true);
    expect(['LegalEntity', 'Subsidiary', 'Partner', 'JointVenture', 'CostCenter', 'Other'].some(UsesParentBooks)).toBe(false);
    expect(UsesParentBooks(null)).toBe(false);
  });
});
