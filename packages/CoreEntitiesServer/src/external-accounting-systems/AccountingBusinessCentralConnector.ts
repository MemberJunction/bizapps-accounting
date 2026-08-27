/**
 * AccountingBusinessCentralConnector — a BRIDGE, not a feature.
 *
 * WHY THIS EXISTS. `VerifyPosted` must answer one bounded question after a lost `Microsoft.NAV.post`
 * response: does Business Central hold general-ledger entries for our document number? The connector
 * surface cannot express it — `FetchContext` models incremental sync (watermark / page / offset /
 * cursor / keyset) and carries no predicate, and the public surface is `TestConnection`,
 * `FetchChanges`, `PostJournal`, `ResolveConfig`. Answering it through `FetchChanges` would mean
 * pulling the whole `generalLedgerEntries` object and scanning client-side: already 6,247 rows on our
 * sandbox and unbounded on a real tenant, which is precisely the failure mode the connector lifecycle
 * guide documents — the read is killed inside `FetchChangesMs`, a killed batch persists nothing, and
 * the probe reports "no rows". That would mean reporting NOT POSTED for a batch that IS posted, which
 * is the most dangerous answer this question has.
 *
 * Filed upstream as Integrations#265, and Madhav's own suggestion was to subclass in the meantime.
 * DELETE THIS CLASS when a bounded filtered-read surface ships; `VerifyPosted` should move to it.
 *
 * DELIBERATELY NARROW. One method answering one question. It is not a general query API — a general
 * one is what #265 asks Madhav for, and building a parallel one here is how a bridge becomes
 * permanent. Everything it uses (`Authenticate`, `BuildHeaders`, `MakeHTTPRequest`, `GetBaseURL`) is
 * inherited `protected` surface, i.e. the extension point subclassing exists for — not a reach past
 * an encapsulation boundary.
 *
 * REGISTRATION. Registered against the SAME ClassFactory key the base connector uses, so
 * `ConnectorFactory.Resolve` returns this subclass everywhere in this app. That is safe because this
 * class only ADDS a method — no override changes behaviour.
 */
import { RegisterClass } from '@memberjunction/global';
import { UserInfo } from '@memberjunction/core';
import type { MJCompanyIntegrationEntity } from '@memberjunction/core-entities';
import { BaseIntegrationConnector } from '@memberjunction/integration-engine';
import { BusinessCentralConnector } from '@memberjunction/connector-business-central';

/** The G/L fields this probe needs. Narrow on purpose: enough to verify and to reconcile amounts. */
export interface PostedGeneralLedgerEntry {
  EntryNumber: number;
  PostingDate: string;
  AccountNumber: string;
  DocumentNumber: string;
  Description: string;
  DebitAmount: number;
  CreditAmount: number;
}

/** OData string literals are single-quoted; an embedded quote is escaped by doubling it. */
function escapeODataString(value: string): string {
  return value.replace(/'/g, "''");
}

@RegisterClass(BaseIntegrationConnector, 'BusinessCentralConnector')
export class AccountingBusinessCentralConnector extends BusinessCentralConnector {
  /**
   * Posted general-ledger entries carrying `documentNumber`. Bounded to one request.
   *
   * Returns an empty array when BC genuinely holds nothing for that document number, and THROWS on
   * any transport or HTTP failure. Callers must keep those apart: an empty array means "not posted",
   * a throw means "cannot tell". Collapsing them is what turns a network blip into a double post.
   */
  public async GetPostedEntriesByDocumentNumber(
    companyIntegration: MJCompanyIntegrationEntity,
    documentNumber: string,
    contextUser: UserInfo,
  ): Promise<PostedGeneralLedgerEntry[]> {
    if (!documentNumber?.trim()) {
      throw new Error('GetPostedEntriesByDocumentNumber: documentNumber is required.');
    }
    const auth = await this.Authenticate(companyIntegration, contextUser);
    const config = await this.ResolveConfig(companyIntegration, contextUser);
    const companyId = config.CompanyId;
    if (!companyId) {
      throw new Error(
        `GetPostedEntriesByDocumentNumber: no CompanyId resolved for CompanyIntegration ${companyIntegration.ID}.`,
      );
    }
    const root = this.GetBaseURL(companyIntegration, auth);
    const filter = `documentNumber eq '${escapeODataString(documentNumber.trim())}'`;
    const select = 'entryNumber,postingDate,accountNumber,documentNumber,description,debitAmount,creditAmount';
    const url = `${root}/companies(${encodeURIComponent(companyId)})/generalLedgerEntries`
      + `?$filter=${encodeURIComponent(filter)}&$select=${encodeURIComponent(select)}`;

    const response = await this.MakeHTTPRequest(auth, url, 'GET', this.BuildHeaders(auth), undefined);
    if (response.Status < 200 || response.Status >= 300) {
      // Throw rather than return []: an error is "cannot tell", never "not posted".
      throw new Error(
        `Business Central rejected the general-ledger probe for document ${documentNumber} `
        + `(HTTP ${response.Status}): ${this.describeBody(response.Body)}`,
      );
    }
    const rows = (response.Body as { value?: unknown[] } | undefined)?.value;
    if (!Array.isArray(rows)) {
      throw new Error(
        `Business Central returned an unexpected shape for the general-ledger probe for document `
        + `${documentNumber}: ${this.describeBody(response.Body)}`,
      );
    }
    return rows.map((r) => {
      const row = r as Record<string, unknown>;
      return {
        EntryNumber: Number(row.entryNumber),
        PostingDate: String(row.postingDate ?? ''),
        AccountNumber: String(row.accountNumber ?? ''),
        DocumentNumber: String(row.documentNumber ?? ''),
        Description: String(row.description ?? ''),
        DebitAmount: Number(row.debitAmount ?? 0),
        CreditAmount: Number(row.creditAmount ?? 0),
      };
    });
  }

  private describeBody(body: unknown): string {
    try {
      const s = typeof body === 'string' ? body : JSON.stringify(body ?? {});
      return s.length > 300 ? `${s.slice(0, 300)}…` : s;
    } catch {
      return '<unserialisable response body>';
    }
  }
}
