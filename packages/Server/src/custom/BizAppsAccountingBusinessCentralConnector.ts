/**
 * BizApps Accounting — Business Central connector with GL-account fetch handling.
 *
 * App-owned subclass of the platform Business Central connector, overriding `FetchChanges` to do two
 * things the base can't:
 *
 * 1. STAMP company context: write the running CompanyIntegration's company id onto every fetched
 *    record, so the field maps can map `CompanyID` from whichever integration is being pulled instead
 *    of a hardcoded GUID literal — the entity/field maps become a company-agnostic template that works
 *    for any company/credential (the connector's FetchChanges has `ctx.CompanyIntegration`; the
 *    mapping/transform layer does not, which is why this belongs here). The account links to a Company
 *    by id; that Company row already carries its name, so only the id is stamped.
 *
 * 2. DROP non-postable structural rows of the BC `accounts` collection (Heading / Total / Begin-Total /
 *    End-Total) BEFORE they enter the sync pipeline. Those rows carry a blank `category`, so they can't
 *    map to a GL `AccountType` and would otherwise dead-letter as per-record failures. Filtering them at
 *    fetch means they are neither imported nor counted as failed (they never reach mapping, so they're
 *    not in TotalRecords, RecordsErrored, or RecordsSkipped).
 *
 * Why here and not in the mapping: a field-map transform can skip a FIELD, never a RECORD, and the
 * entity-map Configuration has no record filter — the mapping always emits a Create. Record exclusion
 * is only possible at the connector (fetch) or in the platform engine; keeping it in the app repo
 * means an app-owned connector.
 *
 * Registration: same driver-class key as the base (`BusinessCentralConnector`) at an explicit high
 * priority, so ConnectorFactory resolves THIS connector for Business Central in this instance. The
 * base registers first (this module's own import of it runs before the decorator below), at a lower
 * auto-priority, so this subclass wins.
 */

import { RegisterClass } from '@memberjunction/global';
import { BusinessCentralConnector } from '@memberjunction/connector-business-central';
import { BaseIntegrationConnector, type FetchContext, type FetchBatchResult, type ExternalRecord } from '@memberjunction/integration-engine';

/** The BC `accounts` collection object name (the only object this connector filters). */
const BC_ACCOUNTS_OBJECT = 'accounts';

/**
 * Synthetic field name stamped onto every fetched record from the running CompanyIntegration, so a
 * field map can map CompanyID from the integration being pulled rather than a hardcoded literal —
 * making the entity/field maps a company-agnostic, clone-safe template. The account links to a
 * Company by id; the company's name lives on that Company row, so only the id is stamped. Prefixed
 * to avoid colliding with any real Business Central field.
 */
const COMPANY_ID_FIELD = 'MJCompanyID';

/**
 * Business Central account types that are NOT postable — presentation/rollup rows. They carry a blank
 * `category`, so they cannot become a GL account. Compared decoded + lowercased. Narrow this to just
 * `'total'` if only Total rows should be dropped (Heading/Begin-Total/End-Total would then fail as
 * before, since they map to a null AccountType).
 */
const NON_POSTABLE_ACCOUNT_TYPES: ReadonlySet<string> = new Set(['heading', 'total', 'begin-total', 'end-total']);

@RegisterClass(BaseIntegrationConnector, 'BusinessCentralConnector', 100)
export class BizAppsAccountingBusinessCentralConnector extends BusinessCentralConnector {

  public override async FetchChanges(ctx: FetchContext): Promise<FetchBatchResult> {
    const result = await super.FetchChanges(ctx);

    // Stamp the running CompanyIntegration's company id onto every fetched record, so field maps map
    // CompanyID from the integration being pulled (no hardcoded GUID). One template, any
    // company/credential. Done for all objects since it's generic company context.
    this.stampCompanyContext(result.Records, ctx);

    if ((ctx.ObjectName ?? '').toLowerCase() !== BC_ACCOUNTS_OBJECT) {
      return result;
    }
    const kept = result.Records.filter((record) => !this.isNonPostableAccount(record));
    // Preserve the original result object (watermark, cursor, warnings, HasMore) — only Records change.
    return kept.length === result.Records.length ? result : { ...result, Records: kept };
  }

  /** Writes the CompanyIntegration's company id onto each record's Fields (in place). */
  private stampCompanyContext(records: ExternalRecord[], ctx: FetchContext): void {
    const companyID = ctx.CompanyIntegration.CompanyID;
    for (const record of records) {
      record.Fields[COMPANY_ID_FIELD] = companyID;
    }
  }

  /** True when the BC record is a structural (non-postable) account we should not import. */
  private isNonPostableAccount(record: ExternalRecord): boolean {
    const raw = record.Fields['accountType'];
    if (typeof raw !== 'string') {
      return false; // unknown / absent accountType → keep, never over-drop
    }
    return NON_POSTABLE_ACCOUNT_TYPES.has(this.decodeODataCaption(raw).trim().toLowerCase());
  }

  /** BC OData encodes option captions (e.g. `Begin_x002D_Total`); decode to `Begin-Total` before matching. */
  private decodeODataCaption(value: string): string {
    return value.replace(/_x([0-9A-Fa-f]{4})_/g, (_match, hex: string) => String.fromCharCode(parseInt(hex, 16)));
  }
}

/** Tree-shaking anchor: call from the server bootstrap so the @RegisterClass side effect survives. */
export function LoadBizAppsAccountingBusinessCentralConnector(): void {
  // The @RegisterClass decorator above performs the registration; this keeps the class in the bundle.
}
