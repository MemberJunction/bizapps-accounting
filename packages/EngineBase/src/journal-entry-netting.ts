/**
 * Pure journal-entry netting — collapse many JE lines into one group per
 * (Company × GLAccount × dimension-combo), with debits netted against credits
 * to a single side. Groups that net to ~zero drop out.
 *
 * No I/O. Lives here so the browser (Orders' accounting tab) and the server
 * (JournalEntryBatchEngine) run the same function.
 *
 * CONNECTS TO:
 *   SERVER: JournalEntryBatchEngine.buildJournalEntryBatch / previewBatch
 *   CLIENT: Orders Order Header accounting tab (display-only rollup)
 */

/** Cent-level tolerance — amounts are decimal(18,2), so anything under half a cent is "zero". */
export const NET_TOLERANCE = 0.005;

export interface DimRef {
    DimensionID: string;
    DimensionValueID: string;
}

/** Pure netting input: one JE line, dimension-tagged. Company = the parent JE's header CompanyID. */
export interface NettableLine {
    companyId: string;
    glAccountId: string;
    debit: number;
    credit: number;
    dims: DimRef[];
}

/** Pure netting output: one consolidated summary group (Dr/Cr collapsed to a single side). */
export interface NetGroup {
    companyId: string;
    glAccountId: string;
    dims: DimRef[];
    dimKey: string;
    /** signed net = Σdebits − Σcredits; >0 → debit side, <0 → credit side. */
    net: number;
    side: 'Debit' | 'Credit';
    sourceLineCount: number;
}

/**
 * Collapse JE lines to consolidated summary groups: one per (Company × GLAccount × dimension-combo),
 * with debits netted against credits to a single side. Groups that net to ~zero drop out. In a
 * single-company batch the company key is constant — it stays in the key as a safety net so a
 * mixed-company input can never silently merge across companies. No I/O — pure + deterministic.
 */
export function NetLines(lines: NettableLine[]): NetGroup[] {
    const map = new Map<string, Accumulator>();
    for (const line of lines) {
        accumulateLine(map, line);
    }
    return emitGroups(map);
}

interface Accumulator {
    companyId: string;
    glAccountId: string;
    dims: DimRef[];
    dimKey: string;
    debit: number;
    credit: number;
    sourceLineCount: number;
}

function accumulateLine(map: Map<string, Accumulator>, line: NettableLine): void {
    const dims = [...line.dims].sort((a, b) => a.DimensionID.localeCompare(b.DimensionID));
    const dimKey = dims.map((d) => `${d.DimensionID}:${d.DimensionValueID}`).join('|');
    const key = `${line.companyId}#${line.glAccountId}#${dimKey}`;
    let group = map.get(key);
    if (!group) {
        group = {
            companyId: line.companyId,
            glAccountId: line.glAccountId,
            dims,
            dimKey,
            debit: 0,
            credit: 0,
            sourceLineCount: 0,
        };
        map.set(key, group);
    }
    group.debit += line.debit;
    group.credit += line.credit;
    group.sourceLineCount += 1;
}

function emitGroups(map: Map<string, Accumulator>): NetGroup[] {
    const groups: NetGroup[] = [];
    for (const group of map.values()) {
        const net = Math.round((group.debit - group.credit) * 100) / 100;
        if (Math.abs(net) <= NET_TOLERANCE) continue;
        groups.push({
            companyId: group.companyId,
            glAccountId: group.glAccountId,
            dims: group.dims,
            dimKey: group.dimKey,
            net,
            side: net > 0 ? 'Debit' : 'Credit',
            sourceLineCount: group.sourceLineCount,
        });
    }
    return sortAsJournal(groups);
}

/**
 * A journal always lists every debit, then every credit. Company is the outer
 * key so a mixed-company rollup still reads as one entry per set of books.
 */
function sortAsJournal(groups: NetGroup[]): NetGroup[] {
    return [...groups].sort((a, b) => {
        const byCompany = a.companyId.localeCompare(b.companyId);
        if (byCompany !== 0) return byCompany;
        if (a.side !== b.side) return a.side === 'Debit' ? -1 : 1;
        return a.glAccountId.localeCompare(b.glAccountId);
    });
}
