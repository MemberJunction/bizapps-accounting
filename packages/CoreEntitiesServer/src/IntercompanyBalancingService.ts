/**
 * IntercompanyBalancingService — Block 3. The intercompany "net + batch" engine.
 *
 * DESIGN (plan §C1, ERD §7 — "gross preserved, net shipped"):
 *   Orders/Payments EMIT the Due-To / Due-From journal-entry legs upstream; Accounting does NOT
 *   generate them. The gross JE legs are the system of record and stay UNTOUCHED. This service only
 *   NETS the bilateral position per company-pair when building the batch summary that ships to the
 *   GL — so the ERP sees one consolidated intercompany line per pair instead of two gross legs. The
 *   net is balance-preserving: replacing {Dr on Due-From, Cr on Due-To} with the single net on one
 *   side leaves total-Dr − total-Cr unchanged (see netIntercompanyPositions docstring for the proof).
 *
 * TWO PUBLIC SURFACES:
 *   1. Eager provisioning (provisionIntercompanyAccountsFor) — when a new AccountingCompanyProfile is
 *      created, wire up the 4 per-pair Due-To/Due-From GL accounts + the IntercompanyRelationship row
 *      against every OTHER existing company. Idempotent. Called from AccountingCompanyProfileEntityServer.
 *   2. Bilateral netting (netIntercompanyPositions / applyIntercompanyNetting) — fold each pair's gross
 *      net-groups into one net group. Called from BatchingEngine.buildBatch before summary lines build.
 *
 * CONNECTS TO:
 *   READS/WRITES: GL Accounts · Intercompany Relationships · Accounting Company Profiles
 *   DB TRIGGER:   trg_ICR_AccountOwnershipAndType (50015) — each account must be in its owner's COA
 *                 with the right type (Due-To=Liability, Due-From=Asset). Un-bypassable; this service
 *                 builds the accounts to satisfy it.
 *   ENTITY:       'MJ_BizApps_Accounting: Intercompany Relationships'
 *   DOC:          docs/ARCHITECTURE.md (intercompany) · plan §C1 (net+batch) · ERD §7
 */
import { Metadata, RunView, UserInfo } from '@memberjunction/core';
import { NormalizeUUID, UUIDsEqual } from '@memberjunction/global';
import type {
  mjBizAppsAccountingGLAccountEntity,
  mjBizAppsAccountingIntercompanyRelationshipEntity,
  mjBizAppsAccountingAccountingCompanyProfileEntity,
} from '@mj-biz-apps/accounting-entities';
import type { NetGroup } from './BatchingEngine.js';

const GL_ENTITY = 'MJ_BizApps_Accounting: GL Accounts';
const ICR_ENTITY = 'MJ_BizApps_Accounting: Intercompany Relationships';
const ACP_ENTITY = 'MJ_BizApps_Accounting: Accounting Company Profiles';

/** Net groups under this absolute value are treated as zero (decimal(18,2) cent-level tolerance). */
const NET_TOLERANCE = 0.005;

/** Code prefixes for the per-pair accounts (plan §C1): Due-From = Asset 11211, Due-To = Liability 21501. */
const DUE_FROM_CODE_PREFIX = '11211';
const DUE_TO_CODE_PREFIX = '21501';

// ─── Canonical pair ordering (SQL Server uniqueidentifier order) ─────────────

/**
 * Compare two GUID strings using SQL Server's `uniqueidentifier` ordering — NOT a plain string sort.
 * SQL Server compares the 16 bytes in this group order (least- to most-significant for the comparison):
 * bytes [10..15], then [8..9], then [6..7], then [4..5], then [0..3] (each group little-endian within
 * the first three 4/2/2-byte fields). Replicating it here is essential: the DB CHECK CK_ICR_CanonicalPair
 * enforces `CompanyAID < CompanyBID` in THIS order, so canonicalizing any other way would fail the insert.
 * Returns <0 if a<b, 0 if equal, >0 if a>b — matching `a < b` in T-SQL.
 */
export function compareSqlServerGuid(a: string, b: string): number {
  const ba = guidToSqlOrderBytes(a);
  const bb = guidToSqlOrderBytes(b);
  for (let i = 0; i < ba.length; i++) {
    if (ba[i] !== bb[i]) return ba[i] - bb[i];
  }
  return 0;
}

/** Reorder a GUID's bytes into the sequence SQL Server compares most- to least-significant. */
function guidToSqlOrderBytes(guid: string): number[] {
  const hex = guid.replace(/-/g, '');
  const b: number[] = [];
  for (let i = 0; i < 32; i += 2) b.push(parseInt(hex.substr(i, 2), 16));
  // SQL Server most-significant first: group6 [10..15] in order, then group5 [8..9],
  // then group4 [7,6], group3 [5,4], group2 [3,2,1,0].
  return [
    b[10], b[11], b[12], b[13], b[14], b[15],
    b[8], b[9],
    b[7], b[6],
    b[5], b[4],
    b[3], b[2], b[1], b[0],
  ];
}

/** Order a company pair into canonical (A,B) with A < B under SQL Server's uniqueidentifier comparison. */
export function canonicalPair(companyX: string, companyY: string): { aId: string; bId: string } {
  return compareSqlServerGuid(companyX, companyY) < 0
    ? { aId: companyX, bId: companyY }
    : { aId: companyY, bId: companyX };
}

// ─── Bilateral netting (pure — unit-tested without a DB) ─────────────────────

/** The pair-wise accounts THIS company holds for one counterparty (resolved from a relationship row). */
export interface IntercompanyPair {
  /** This company's Due-To-counterparty account (a Liability; net-owing nets here as a credit). */
  dueToAccountId: string;
  /** This company's Due-From-counterparty account (an Asset; net-owed nets here as a debit). */
  dueFromAccountId: string;
}

/**
 * Net each company-pair's gross intercompany position into a single net group (plan §C1).
 *
 * For every pair, we look at the company's two intercompany net-groups:
 *   - the Due-From group (an Asset — a positive `net` is a debit: "the counterparty owes us"),
 *   - the Due-To group   (a Liability — a negative `net` is a credit: "we owe the counterparty").
 * The bilateral position = Σ(Due-From net) + Σ(Due-To net)  [both already signed: Dr>0, Cr<0].
 *   - position > 0 → net-owed   → one Debit net group on the Due-From account.
 *   - position < 0 → net-owing  → one Credit net group on the Due-To account.
 *   - position ≈ 0 → drop both (nothing to settle).
 * The gross Due-To/Due-From groups for the pair are REMOVED and replaced by (at most) the single net.
 *
 * BALANCE-PRESERVATION (one-line proof): each group contributes its signed `net` to Σ(Dr) − Σ(Cr)
 * (Debit groups add +net, Credit groups add −(−net)=+net, so every group contributes exactly its
 * signed net). We remove a set of groups whose signed nets sum to `position`, and add back a single
 * group whose signed net is exactly `position` (Debit net=position, or Credit net=position). Net change
 * to Σ(signed net) = −position + position = 0. ∎  Non-intercompany groups pass through untouched.
 *
 * DIMENSION HANDLING (documented simplification): an intercompany position is a single bilateral
 * balance with the counterparty, not an analytical breakdown, so we net the pair's TOTAL across ALL
 * dimensions into ONE UNDIMENSIONED net group (dims: []). Per-dimension intercompany settlement is out
 * of scope for Block 3; if it is ever needed, key the accumulation by (accountPairKey, dimKey) instead.
 */
export function netIntercompanyPositions(groups: NetGroup[], pairs: IntercompanyPair[]): NetGroup[] {
  if (pairs.length === 0) return groups;
  const intercompanyAccountIds = collectIntercompanyAccountIds(pairs);
  const passthrough = groups.filter(g => !intercompanyAccountIds.has(NormalizeUUID(g.glAccountId)));

  const netted: NetGroup[] = [];
  for (const pair of pairs) {
    const nettedGroup = nettPairPosition(groups, pair);
    if (nettedGroup) netted.push(nettedGroup);
  }
  return [...passthrough, ...netted];
}

/** All GL account ids referenced by any pair, NORMALIZED — used to partition gross intercompany groups
 *  out. Normalized because group ids and pair ids can differ in case (SQL Server upper vs lower). */
function collectIntercompanyAccountIds(pairs: IntercompanyPair[]): Set<string> {
  const ids = new Set<string>();
  for (const p of pairs) {
    ids.add(NormalizeUUID(p.dueToAccountId));
    ids.add(NormalizeUUID(p.dueFromAccountId));
  }
  return ids;
}

/** Fold one pair's gross Due-To/Due-From groups into a single signed net group (or null when ~zero). */
function nettPairPosition(groups: NetGroup[], pair: IntercompanyPair): NetGroup | null {
  let position = 0;
  let sourceLineCount = 0;
  for (const g of groups) {
    // UUIDsEqual (not ===): group ids and the relationship's account ids may differ in case.
    if (UUIDsEqual(g.glAccountId, pair.dueFromAccountId) || UUIDsEqual(g.glAccountId, pair.dueToAccountId)) {
      position += g.net; // g.net is already signed (Dr>0, Cr<0)
      sourceLineCount += g.sourceLineCount;
    }
  }
  position = Math.round(position * 100) / 100;
  if (Math.abs(position) <= NET_TOLERANCE) return null; // net settles to zero → drop both sides

  const isNetOwed = position > 0;
  return {
    glAccountId: isNetOwed ? pair.dueFromAccountId : pair.dueToAccountId,
    dims: [],
    dimKey: '',
    net: position,
    side: isNetOwed ? 'Debit' : 'Credit',
    sourceLineCount,
  };
}

// ─── Bilateral netting (DB wrapper) ──────────────────────────────────────────

/**
 * Load this company's active intercompany relationships, derive THIS company's {dueTo,dueFrom} accounts
 * for each, and apply the pure netting. Returns the groups unchanged when the company has no relationships.
 */
export async function applyIntercompanyNetting(
  groups: NetGroup[],
  companyId: string,
  contextUser: UserInfo,
): Promise<NetGroup[]> {
  const pairs = await loadIntercompanyPairsForCompany(companyId, contextUser);
  return netIntercompanyPositions(groups, pairs);
}

/** Resolve the {dueTo,dueFrom} account pair THIS company holds for each active counterparty. */
async function loadIntercompanyPairsForCompany(companyId: string, contextUser: UserInfo): Promise<IntercompanyPair[]> {
  const rv = new RunView();
  const res = await rv.RunView<mjBizAppsAccountingIntercompanyRelationshipEntity>(
    {
      EntityName: ICR_ENTITY,
      ExtraFilter: `IsActive = 1 AND (CompanyAID = '${companyId}' OR CompanyBID = '${companyId}')`,
      ResultType: 'entity_object',
      BypassCache: true,
    },
    contextUser,
  );
  if (!res.Success) return [];
  return (res.Results ?? []).map(r => pairForCompany(r, companyId));
}

/** Pick the side of the relationship row that belongs to `companyId` (A-side vs B-side accounts).
 *  UUIDsEqual (not ===) because SQL Server returns UUIDs uppercase while `companyId` may be lowercase —
 *  a string === would mis-pick the side and the netting would never match the JE-line accounts. */
function pairForCompany(
  rel: mjBizAppsAccountingIntercompanyRelationshipEntity,
  companyId: string,
): IntercompanyPair {
  return UUIDsEqual(rel.CompanyAID, companyId)
    ? { dueToAccountId: rel.ADueToBGLAccountID, dueFromAccountId: rel.ADueFromBGLAccountID }
    : { dueToAccountId: rel.BDueToAGLAccountID, dueFromAccountId: rel.BDueFromAGLAccountID };
}

// ─── Eager provisioning ──────────────────────────────────────────────────────

/** A company's identity for provisioning: its ID (= AccountingCompanyProfile/Company ID) and CompanyCode. */
interface CompanyRef {
  id: string;
  code: string;
  currencyCode: string;
}

/**
 * When a NEW AccountingCompanyProfile `newCompany` is created, provision the intercompany account wiring
 * against every OTHER existing AccountingCompanyProfile. For each other company we canonical-order the
 * pair → (A,B), create the 4 per-pair GL accounts (idempotently) and the IntercompanyRelationship row
 * (skipped if it already exists). Safe to re-run. Called AFTER COA seeding so account-code collisions
 * with the seeded chart can't occur (the 11211-/21501- prefixes aren't in the default COA).
 */
export async function provisionIntercompanyAccountsFor(
  newCompany: CompanyRef,
  contextUser: UserInfo,
): Promise<void> {
  const others = await loadOtherCompanies(newCompany.id, contextUser);
  for (const other of others) {
    await provisionPair(newCompany, other, contextUser);
  }
}

/** Load every accounting-enabled company other than `excludeId` (its id, code, functional currency). */
async function loadOtherCompanies(excludeId: string, contextUser: UserInfo): Promise<CompanyRef[]> {
  const rv = new RunView();
  const res = await rv.RunView<mjBizAppsAccountingAccountingCompanyProfileEntity>(
    {
      EntityName: ACP_ENTITY,
      ExtraFilter: `ID <> '${excludeId}'`,
      ResultType: 'entity_object',
      BypassCache: true,
    },
    contextUser,
  );
  if (!res.Success) return [];
  return (res.Results ?? []).map(c => ({ id: c.ID, code: c.CompanyCode, currencyCode: c.FunctionalCurrencyCode }));
}

/** Provision one company-pair: canonical-order, create the 4 accounts, then the relationship row. */
async function provisionPair(newCompany: CompanyRef, other: CompanyRef, contextUser: UserInfo): Promise<void> {
  if (await relationshipExists(newCompany.id, other.id, contextUser)) return; // idempotent

  const byId = new Map<string, CompanyRef>([[newCompany.id, newCompany], [other.id, other]]);
  const { aId, bId } = canonicalPair(newCompany.id, other.id);
  const a = byId.get(aId)!;
  const b = byId.get(bId)!;

  // A's accounts (in A's COA) reference B's code; B's accounts (in B's COA) reference A's code.
  const aDueFromB = await ensureGLAccount(a, `${DUE_FROM_CODE_PREFIX}-${b.code}`, `Due From ${b.code}`, 'Asset', contextUser);
  const aDueToB = await ensureGLAccount(a, `${DUE_TO_CODE_PREFIX}-${b.code}`, `Due To ${b.code}`, 'Liability', contextUser);
  const bDueFromA = await ensureGLAccount(b, `${DUE_FROM_CODE_PREFIX}-${a.code}`, `Due From ${a.code}`, 'Asset', contextUser);
  const bDueToA = await ensureGLAccount(b, `${DUE_TO_CODE_PREFIX}-${a.code}`, `Due To ${a.code}`, 'Liability', contextUser);

  await createRelationshipRow(aId, bId, { aDueToB, aDueFromB, bDueToA, bDueFromA }, contextUser);
}

/** Is there already a relationship row for this unordered pair? (Either canonical orientation.) */
async function relationshipExists(companyX: string, companyY: string, contextUser: UserInfo): Promise<boolean> {
  const { aId, bId } = canonicalPair(companyX, companyY);
  const rv = new RunView();
  const res = await rv.RunView<{ ID: string }>(
    {
      EntityName: ICR_ENTITY,
      ExtraFilter: `CompanyAID = '${aId}' AND CompanyBID = '${bId}'`,
      Fields: ['ID'],
      ResultType: 'simple',
      BypassCache: true,
    },
    contextUser,
  );
  return res.Success && (res.Results?.length ?? 0) > 0;
}

/**
 * Idempotently ensure a system-seeded GL account with `code` exists in `company`'s COA; return its id.
 * Reuses an existing account with the same code (provisioning re-runs / shared codes across pairs).
 */
async function ensureGLAccount(
  company: CompanyRef,
  code: string,
  name: string,
  accountType: 'Asset' | 'Liability',
  contextUser: UserInfo,
): Promise<string> {
  const existing = await findGLAccountByCode(company.id, code, contextUser);
  if (existing) return existing;

  const md = new Metadata();
  const account = await md.GetEntityObject<mjBizAppsAccountingGLAccountEntity>(GL_ENTITY, contextUser);
  account.NewRecord();
  account.CompanyID = company.id;
  account.Code = code;
  account.Name = name;
  account.AccountType = accountType;
  account.CurrencyCode = company.currencyCode;
  account.IsSystemSeeded = true;
  account.IsActive = true;
  if (!(await account.Save())) {
    throw new Error(`provisionIntercompany: failed to create GL account ${code} for company ${company.id}: ${account.LatestResult?.CompleteMessage ?? 'unknown'}`);
  }
  return account.ID;
}

/** Look up a GL account id by (CompanyID, Code); null if absent. */
async function findGLAccountByCode(companyId: string, code: string, contextUser: UserInfo): Promise<string | null> {
  const rv = new RunView();
  const res = await rv.RunView<{ ID: string }>(
    {
      EntityName: GL_ENTITY,
      ExtraFilter: `CompanyID = '${companyId}' AND Code = '${code}'`,
      Fields: ['ID'],
      ResultType: 'simple',
      BypassCache: true,
    },
    contextUser,
  );
  return res.Success && res.Results.length > 0 ? res.Results[0].ID : null;
}

interface PairAccounts { aDueToB: string; aDueFromB: string; bDueToA: string; bDueFromA: string }

/** Create the IntercompanyRelationship row with the 4 account ids in their canonical A/B slots. */
async function createRelationshipRow(
  aId: string,
  bId: string,
  accounts: PairAccounts,
  contextUser: UserInfo,
): Promise<void> {
  const md = new Metadata();
  const rel = await md.GetEntityObject<mjBizAppsAccountingIntercompanyRelationshipEntity>(ICR_ENTITY, contextUser);
  rel.NewRecord();
  rel.CompanyAID = aId;
  rel.CompanyBID = bId;
  rel.ADueToBGLAccountID = accounts.aDueToB;
  rel.ADueFromBGLAccountID = accounts.aDueFromB;
  rel.BDueToAGLAccountID = accounts.bDueToA;
  rel.BDueFromAGLAccountID = accounts.bDueFromA;
  rel.IsActive = true;
  if (!(await rel.Save())) {
    throw new Error(`provisionIntercompany: failed to create relationship ${aId}/${bId}: ${rel.LatestResult?.CompleteMessage ?? 'unknown'}`);
  }
}
