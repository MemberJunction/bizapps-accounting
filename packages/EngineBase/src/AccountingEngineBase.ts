/**
 * AccountingEngineBase — the browser-safe accounting metadata cache (plan §2.1, CH-10;
 * modeled on AIEngineBase). Caches the small reference tables so lookups are instant, with
 * BaseEngine's auto-refresh keeping them current on entity save/delete:
 *
 *   GL Accounts · GL Account Roles · GL Account Links (+ their ordered Link Dimensions) ·
 *   Dimensions · Dimension Values · Accounting Company Profiles · Currencies (reference only — FX deferred) ·
 *   Intercompany Account Matches (+ their ordered Match Dimensions)
 *
 * Also exposes:
 *   - ResolveLinkedAccount(entityId, recordId, role, asOfDate) — the per-record link primitive
 *     Orders' resolver walks (product → category → company default; the WALK order is Orders'
 *     code, the per-record lookup is ours — plan §2.1).
 *   - ResolveIntercompanyAccounts(sourceCompanyId, targetCompanyId, asOfDate) — the Due To/Due From
 *     pair for an ordered company pair, used when one company collects cash settling another's
 *     line (BA-D26). Separate from the role/link path on purpose: an intercompany account is
 *     per-company-PAIR, which a per-record role lookup cannot express.
 *   - CreatePipelineLookups() — the cache-backed lookups the pure draft pipeline consumes.
 *
 * Browser-safe: deps are @memberjunction/core + global + the app's Entities package ONLY.
 *
 * CONNECTS TO:
 *   SERVER:  AccountingEngine (CoreEntitiesServer) wraps this for the write path
 *   PIPELINE: ./pipeline.ts consumes CreatePipelineLookups()
 *   DOC:     plans/accounting-engine-plan.md §2.1
 */
import { BaseEngine, BaseEnginePropertyConfig, IMetadataProvider, UserInfo } from '@memberjunction/core';
import { RegisterForStartup } from '@memberjunction/core';
import type {
  mjBizAppsAccountingAccountingCompanyProfileEntity,
  mjBizAppsAccountingCurrencyEntity,
  mjBizAppsAccountingDimensionEntity,
  mjBizAppsAccountingDimensionValueEntity,
  mjBizAppsAccountingGLAccountEntity,
  mjBizAppsAccountingGLAccountLinkDimensionEntity,
  mjBizAppsAccountingGLAccountLinkEntity,
  mjBizAppsAccountingGLAccountRoleEntity,
  mjBizAppsAccountingIntercompanyAccountMatchDimensionEntity,
  mjBizAppsAccountingIntercompanyAccountMatchEntity,
  mjBizAppsAccountingJournalEntryTypeEntity,
} from '@mj-biz-apps/accounting-entities';
import type { PipelineLookups } from './pipeline.js';

const uuidKey = (id: string | null | undefined): string => (id ?? '').trim().toLowerCase();

/** A resolved link: the winning GLAccountLink + its ordered dimension requirements. */
export interface ResolvedLinkedAccount {
  Link: mjBizAppsAccountingGLAccountLinkEntity;
  /** The link's GLAccountLinkDimension rows, ordered by Sequence — the dimensions a JE line built from this link must carry (values come from caller context — OQ-I). */
  Dimensions: mjBizAppsAccountingGLAccountLinkDimensionEntity[];
}

/** One dimension to stamp on an intercompany leg. `DimensionValueID` null = take it from context. */
export interface IntercompanyDimensionRequirement {
  DimensionID: string;
  DimensionValueID: string | null;
  Sequence: number;
}

/** One side of a resolved intercompany pair — the account plus what to tag it with. */
export interface IntercompanyLeg {
  GLAccountID: string;
  /** The company whose books this leg lands on. Guaranteed to own `GLAccountID` (DB trigger 50024/50025). */
  CompanyID: string;
  Dimensions: IntercompanyDimensionRequirement[];
}

/**
 * A resolved intercompany pair, already oriented: `DueTo` is the payable on the collecting
 * company's books, `DueFrom` the receivable on the owed company's books.
 *
 * Callers should not re-derive which leg belongs to whom — reading the pair backwards still
 * produces a BALANCED entry, so the mistake is invisible downstream. That is why this returns
 * two named, company-stamped legs rather than the raw row.
 */
export interface ResolvedIntercompanyAccounts {
  Match: mjBizAppsAccountingIntercompanyAccountMatchEntity;
  /** Liability on the SOURCE company — the collector owes. */
  DueTo: IntercompanyLeg;
  /** Asset on the TARGET company — the owner of the line is owed. */
  DueFrom: IntercompanyLeg;
}

/** The window/status subset of a GLAccountLink that the pure picker needs (unit-testable shape). */
export interface LinkCandidate {
  Status: mjBizAppsAccountingGLAccountLinkEntity['Status'];
  StartedAt: Date | null;
  EndedAt: Date | null;
}

/**
 * Pure link picker: of the candidates, return the index of the Active link whose
 * StartedAt/EndedAt window covers `asOf` (null bounds are open). When several qualify,
 * the LATEST StartedAt wins (most specific window; null StartedAt loses to any dated one).
 * Returns -1 when none qualify. Exported for unit tests.
 */
export function pickActiveLinkIndex(candidates: LinkCandidate[], asOf: Date): number {
  let winner = -1;
  let winnerStarted: number | null = null;
  candidates.forEach((c, i) => {
    if (c.Status !== 'Active') return;
    const started = c.StartedAt ? new Date(c.StartedAt).getTime() : null;
    const ended = c.EndedAt ? new Date(c.EndedAt).getTime() : null;
    const t = asOf.getTime();
    if (started !== null && t < started) return;
    if (ended !== null && t > ended) return;
    if (winner === -1 || (started ?? -Infinity) > (winnerStarted ?? -Infinity)) {
      winner = i;
      winnerStarted = started;
    }
  });
  return winner;
}

@RegisterForStartup()
export class AccountingEngineBase extends BaseEngine<AccountingEngineBase> {
  private _glAccounts: mjBizAppsAccountingGLAccountEntity[] = [];
  private _glAccountRoles: mjBizAppsAccountingGLAccountRoleEntity[] = [];
  private _glAccountLinks: mjBizAppsAccountingGLAccountLinkEntity[] = [];
  private _glAccountLinkDimensions: mjBizAppsAccountingGLAccountLinkDimensionEntity[] = [];
  private _dimensions: mjBizAppsAccountingDimensionEntity[] = [];
  private _dimensionValues: mjBizAppsAccountingDimensionValueEntity[] = [];
  private _companyProfiles: mjBizAppsAccountingAccountingCompanyProfileEntity[] = [];
  private _currencies: mjBizAppsAccountingCurrencyEntity[] = [];
  private _intercompanyMatches: mjBizAppsAccountingIntercompanyAccountMatchEntity[] = [];
  private _intercompanyMatchDimensions: mjBizAppsAccountingIntercompanyAccountMatchDimensionEntity[] = [];

  public static get Instance(): AccountingEngineBase {
    return super.getInstance<AccountingEngineBase>();
  }

  public async Config(forceRefresh?: boolean, contextUser?: UserInfo, provider?: IMetadataProvider): Promise<unknown> {
    const params: Array<Partial<BaseEnginePropertyConfig>> = [
      { PropertyName: '_glAccounts', EntityName: 'MJ_BizApps_Accounting: GL Accounts' },
      { PropertyName: '_glAccountRoles', EntityName: 'MJ_BizApps_Accounting: GL Account Roles', OrderBy: 'Sequence ASC' },
      { PropertyName: '_glAccountLinks', EntityName: 'MJ_BizApps_Accounting: GL Account Links' },
      { PropertyName: '_glAccountLinkDimensions', EntityName: 'MJ_BizApps_Accounting: GL Account Link Dimensions', OrderBy: 'Sequence ASC' },
      { PropertyName: '_dimensions', EntityName: 'MJ_BizApps_Accounting: Dimensions' },
      { PropertyName: '_dimensionValues', EntityName: 'MJ_BizApps_Accounting: Dimension Values' },
      { PropertyName: '_companyProfiles', EntityName: 'MJ_BizApps_Accounting: Accounting Company Profiles' },
      { PropertyName: '_currencies', EntityName: 'MJ_BizApps_Accounting: Currencies' },
      { PropertyName: '_journalEntryTypes', EntityName: 'MJ_BizApps_Accounting: Journal Entry Types' },
      { PropertyName: '_intercompanyMatches', EntityName: 'MJ_BizApps_Accounting: Intercompany Account Matches' },
      {
        PropertyName: '_intercompanyMatchDimensions',
        EntityName: 'MJ_BizApps_Accounting: Intercompany Account Match Dimensions',
        OrderBy: 'Sequence ASC',
      },
    ];
    return await this.Load(params, provider as IMetadataProvider, forceRefresh ?? false, contextUser);
  }

  // ─── cached collections ────────────────────────────────────────────────────
  // Getters go through BaseEngine.GetConfigData (MJ doctrine): it throws
  // PermissionConstrainedError when the property was skipped for lack of read
  // access, instead of silently serving an empty array.

  public get GLAccounts(): mjBizAppsAccountingGLAccountEntity[] {
    return this.GetConfigData<mjBizAppsAccountingGLAccountEntity>('_glAccounts');
  }
  public get GLAccountRoles(): mjBizAppsAccountingGLAccountRoleEntity[] {
    return this.GetConfigData<mjBizAppsAccountingGLAccountRoleEntity>('_glAccountRoles');
  }
  public get GLAccountLinks(): mjBizAppsAccountingGLAccountLinkEntity[] {
    return this.GetConfigData<mjBizAppsAccountingGLAccountLinkEntity>('_glAccountLinks');
  }
  public get GLAccountLinkDimensions(): mjBizAppsAccountingGLAccountLinkDimensionEntity[] {
    return this.GetConfigData<mjBizAppsAccountingGLAccountLinkDimensionEntity>('_glAccountLinkDimensions');
  }
  public get Dimensions(): mjBizAppsAccountingDimensionEntity[] {
    return this.GetConfigData<mjBizAppsAccountingDimensionEntity>('_dimensions');
  }
  public get DimensionValues(): mjBizAppsAccountingDimensionValueEntity[] {
    return this.GetConfigData<mjBizAppsAccountingDimensionValueEntity>('_dimensionValues');
  }
  public get CompanyProfiles(): mjBizAppsAccountingAccountingCompanyProfileEntity[] {
    return this.GetConfigData<mjBizAppsAccountingAccountingCompanyProfileEntity>('_companyProfiles');
  }
  public get Currencies(): mjBizAppsAccountingCurrencyEntity[] {
    return this.GetConfigData<mjBizAppsAccountingCurrencyEntity>('_currencies');
  }
  public get JournalEntryTypes(): mjBizAppsAccountingJournalEntryTypeEntity[] {
    return this.GetConfigData<mjBizAppsAccountingJournalEntryTypeEntity>('_journalEntryTypes');
  }
  public get IntercompanyAccountMatches(): mjBizAppsAccountingIntercompanyAccountMatchEntity[] {
    return this.GetConfigData<mjBizAppsAccountingIntercompanyAccountMatchEntity>('_intercompanyMatches');
  }
  public get IntercompanyAccountMatchDimensions(): mjBizAppsAccountingIntercompanyAccountMatchDimensionEntity[] {
    return this.GetConfigData<mjBizAppsAccountingIntercompanyAccountMatchDimensionEntity>('_intercompanyMatchDimensions');
  }

  // ─── point lookups ─────────────────────────────────────────────────────────

  public GLAccountByID(glAccountId: string): mjBizAppsAccountingGLAccountEntity | undefined {
    const key = uuidKey(glAccountId);
    return this.GLAccounts.find(a => uuidKey(a.ID) === key);
  }

  public GLAccountByCompanyAndCode(companyId: string, code: string): mjBizAppsAccountingGLAccountEntity | undefined {
    const companyKey = uuidKey(companyId);
    const codeKey = (code ?? '').trim();
    return this.GLAccounts.find(a => uuidKey(a.CompanyID) === companyKey && a.Code === codeKey);
  }

  public GLAccountRoleByName(name: string): mjBizAppsAccountingGLAccountRoleEntity | undefined {
    const key = (name ?? '').trim().toLowerCase();
    return this.GLAccountRoles.find(r => r.Name.trim().toLowerCase() === key);
  }

  // ─── the link primitive (plan §2.1) ────────────────────────────────────────

  /**
   * The Active GLAccountLink for a polymorphic record (EntityID + RecordID) in a given role,
   * whose StartedAt/EndedAt window covers `asOfDate` — plus its ordered dimension requirements.
   * `role` accepts a GLAccountRole ID or Name. Returns null when no link qualifies (the caller
   * walks its own fallback chain — product → category → company default is Orders' code).
   *
   * `forCompanyID` (optional — Amith 2026-07-28/29): scope resolution to links whose GL account
   * belongs to that company. A record (e.g. a shared product) can carry one link per company for
   * the same role; a multi-company caller passes the booking company to get ITS account. The
   * company is derived through the link's GLAccount FK (both tables live in this engine's cache,
   * so the join is free) — GLAccountLink deliberately carries no denormalized CompanyID, and the
   * derivation is stable because GLAccount identity fields are immutable from creation.
   */
  public ResolveLinkedAccount(entityId: string, recordId: string, role: string, asOfDate: Date, forCompanyID?: string): ResolvedLinkedAccount | null {
    const roleId = uuidKey(this.GLAccountRoles.find(r => uuidKey(r.ID) === uuidKey(role))?.ID ?? this.GLAccountRoleByName(role)?.ID);
    if (!roleId) return null;
    const entityKey = uuidKey(entityId);
    const recordKey = (recordId ?? '').trim().toLowerCase();
    const companyKey = uuidKey(forCompanyID ?? '');
    const candidates = this.GLAccountLinks.filter(l =>
      uuidKey(l.EntityID) === entityKey &&
      (l.RecordID ?? '').trim().toLowerCase() === recordKey &&
      uuidKey(l.GLAccountRoleID) === roleId &&
      (!companyKey || uuidKey(this.GLAccountByID(l.GLAccountID)?.CompanyID ?? '') === companyKey),
    );
    const winner = pickActiveLinkIndex(
      candidates.map(l => ({ Status: l.Status, StartedAt: l.StartedAt, EndedAt: l.EndedAt })),
      asOfDate,
    );
    if (winner === -1) return null;
    const link = candidates[winner];
    const linkKey = uuidKey(link.ID);
    const dimensions = this.GLAccountLinkDimensions
      .filter(d => uuidKey(d.GLAccountLinkID) === linkKey)
      .sort((a, b) => a.Sequence - b.Sequence);
    return { Link: link, Dimensions: dimensions };
  }

  // ─── the intercompany primitive (BA-D26) ───────────────────────────────────

  /**
   * The Due To / Due From account pair for an ORDERED company pair, as of a date.
   *
   * Read the arguments as the sentence the row encodes: `sourceCompanyId` COLLECTED cash that
   * settles a line owned by `targetCompanyId`, so source owes target. Swapping them is a different
   * lookup that may resolve to entirely different accounts, or to nothing.
   *
   * Returns null when no Active pair covers `asOfDate`. Callers MUST treat that as a hard failure
   * and refuse the entry — never fall back to a default account. A guessed intercompany account
   * still balances, so the misposting would be invisible until two entities' books disagree.
   *
   * Resolution matches `ResolveLinkedAccount` exactly (Active, window covers the date, latest
   * StartedAt wins) because both answer the same question — "which mapping is in force today?" —
   * and having them differ would be a trap.
   */
  public ResolveIntercompanyAccounts(
    sourceCompanyId: string,
    targetCompanyId: string,
    asOfDate: Date,
  ): ResolvedIntercompanyAccounts | null {
    const sourceKey = uuidKey(sourceCompanyId);
    const targetKey = uuidKey(targetCompanyId);
    // A company never owes itself. Returning null rather than throwing keeps this a pure lookup:
    // the caller that skips same-company legs entirely (the common case — a single-company order)
    // does not need a special case, and the DB CHECK already makes such a row unstorable.
    if (!sourceKey || !targetKey || sourceKey === targetKey) return null;

    const candidates = this.IntercompanyAccountMatches.filter(
      (m) => uuidKey(m.SourceCompanyID) === sourceKey && uuidKey(m.TargetCompanyID) === targetKey,
    );
    const winner = pickActiveLinkIndex(
      candidates.map((m) => ({ Status: m.Status, StartedAt: m.StartedAt, EndedAt: m.EndedAt })),
      asOfDate,
    );
    if (winner === -1) return null;

    const match = candidates[winner];
    return {
      Match: match,
      DueTo: {
        GLAccountID: match.DueToGLAccountID,
        CompanyID: match.SourceCompanyID,
        Dimensions: this.intercompanyDimensions(match.ID, 'DueTo'),
      },
      DueFrom: {
        GLAccountID: match.DueFromGLAccountID,
        CompanyID: match.TargetCompanyID,
        Dimensions: this.intercompanyDimensions(match.ID, 'DueFrom'),
      },
    };
  }

  /** The ordered dimension requirements for one side of a match. */
  private intercompanyDimensions(matchId: string, side: 'DueTo' | 'DueFrom'): IntercompanyDimensionRequirement[] {
    const matchKey = uuidKey(matchId);
    return this.IntercompanyAccountMatchDimensions.filter(
      (d) => uuidKey(d.IntercompanyAccountMatchID) === matchKey && d.Side === side,
    )
      .sort((a, b) => a.Sequence - b.Sequence)
      .map((d) => ({ DimensionID: d.DimensionID, DimensionValueID: d.DimensionValueID, Sequence: d.Sequence }));
  }

  // ─── pipeline adapter ──────────────────────────────────────────────────────

  /** Point lookup: the JournalEntryType with this Code (case-insensitive), or undefined. */
  public JournalEntryTypeByCode(code: string): mjBizAppsAccountingJournalEntryTypeEntity | undefined {
    const key = (code ?? '').trim().toLowerCase();
    return this.JournalEntryTypes.find(t => t.Code.trim().toLowerCase() === key);
  }

  /** The single IsJournalEntryBatchSummary=1 type row (filtered unique index guarantees at most one). */
  public get JournalEntryBatchSummaryEntryType(): mjBizAppsAccountingJournalEntryTypeEntity | undefined {
    return this.JournalEntryTypes.find(t => t.IsJournalEntryBatchSummary);
  }

  /** Cache-backed lookups for the pure draft pipeline (./pipeline.ts). */
  public CreatePipelineLookups(): PipelineLookups {
    const accounts = new Map(this.GLAccounts.map(a => [uuidKey(a.ID), a]));
    const entryTypes = new Map(this.JournalEntryTypes.map(t => [t.Code.trim().toLowerCase(), t]));
    const dimensions = new Set(this.Dimensions.map(d => uuidKey(d.ID)));
    const valuesByDimension = new Map<string, Set<string>>();
    for (const v of this.DimensionValues) {
      const dimKey = uuidKey(v.DimensionID);
      const set = valuesByDimension.get(dimKey) ?? new Set<string>();
      set.add(uuidKey(v.ID));
      valuesByDimension.set(dimKey, set);
    }
    return {
      accountByID: (id) => {
        const a = accounts.get(uuidKey(id));
        return a ? { ID: a.ID, CompanyID: a.CompanyID, IsActive: a.IsActive } : undefined;
      },
      entryTypeByCode: (code) => {
        const t = entryTypes.get((code ?? '').trim().toLowerCase());
        return t ? { ID: t.ID, Code: t.Code, IsActive: t.IsActive, IsJournalEntryBatchSummary: t.IsJournalEntryBatchSummary } : undefined;
      },
      dimensionExists: (id) => dimensions.has(uuidKey(id)),
      dimensionValueBelongs: (dimensionId, valueId) => valuesByDimension.get(uuidKey(dimensionId))?.has(uuidKey(valueId)) ?? false,
    };
  }
}
