/** _maint-bc-flow-proof.ts — AUDITABLE end-to-end proof: what goes in, what BC actually holds.
 *
 *  PURPOSE. Show, in one run and without hand-waving, that the journal-entry data we submit is the
 *  data Business Central ends up with. Every BC figure printed here is READ BACK FROM BC over HTTP
 *  and printed as BC returned it. Nothing is reformatted to agree with our side, and nothing is
 *  written to BC after the post.
 *
 *  HOW TO DISTRUST IT PRODUCTIVELY (what to check if you don't take my word for it):
 *    - Stage 2 and Stage 7 are plain GETs against api.businesscentral.dynamics.com. The raw JSON
 *      body is printed. Compare Stage 7's numbers to Stage 8's table yourself.
 *    - Stage 2 is captured BEFORE the post and Stage 7 AFTER, so the delta is bounded by this run.
 *    - Stage 5 logs every HTTP call the adapter makes. The wrapper only records and returns the
 *      untouched result — it cannot alter a request, a response, or the outcome.
 *    - There is no code path in this file that UPDATEs or DELETEs anything in BC. Read it.
 *
 *  THE ONE TRANSFORMATION YOU MUST KNOW ABOUT. We do not send raw JE lines. The batch engine nets
 *  the batch into a single SUMMARY journal entry (one line per GL account, debits and credits
 *  netted), and the adapter sends THOSE lines. So "data in = data out" is:
 *        sum of our JE lines per account  ==  summary line per account  ==  BC ledger per account
 *  Stage 3 prints the netting so you can check the arithmetic yourself.
 *
 *    npx tsx ../bizapps-accounting/test-harnesses/server/_maint-bc-flow-proof.ts          # read-only preview
 *    npx tsx ../bizapps-accounting/test-harnesses/server/_maint-bc-flow-proof.ts --post   # IRREVERSIBLE
 */
import sql from 'mssql'; import dotenv from 'dotenv'; import path from 'path';
import { Metadata, UserInfo } from '@memberjunction/core';
import { setupSQLServerClient, SQLServerProviderConfigData } from '@memberjunction/sqlserver-dataprovider';
import { UserCache } from '@memberjunction/generic-database-provider';
import '@memberjunction/server-bootstrap-lite';
import '@memberjunction/connector-business-central';
import '@mj-biz-apps/common-entities';
import '@mj-biz-apps/accounting-entities';
import '@mj-biz-apps/tasks-entities';
import '@mj-biz-apps/tasks-entities-server';
import '@mj-biz-apps/accounting-core-entities-server';
import { BusinessCentralConnector } from '@memberjunction/connector-business-central';
import { ConnectorFactory } from '@memberjunction/integration-engine';
import {
  DispatchJournalEntryBatchOperation, buildJournalEntryBatch, TasksAppApprovalGate, approveJournalEntryBatch,
} from '@mj-biz-apps/accounting-core-entities-server';

const S = '__mj_BizAppsAccounting';
const money = (n: number): string => n.toFixed(2).padStart(10);
const rule = (t: string): void => console.log(`\n${'='.repeat(78)}\n${t}\n${'='.repeat(78)}`);
/** Exit immediately after the verdict so MJ's background init cannot print noise after it. */
async function done(pool: sql.ConnectionPool, code: number): Promise<never> {
  try { await pool.close(); } catch { /* teardown only */ }
  process.exit(code);
}

/** Every HTTP call the adapter makes, recorded verbatim. Observation only. */
interface WireEntry { method: string; url: string; status: number; reqBody: unknown; resBody: unknown }
const wire: WireEntry[] = [];

async function main(): Promise<void> {
  const doRun = process.argv.includes('--run');
  // Rehearsal: run the whole pipeline but stop immediately before the irreversible dispatch.
  const noDispatch = process.argv.includes('--no-dispatch');
  const buildIdx = process.argv.indexOf('--build');
  const doBuild = buildIdx >= 0 || doRun;
  // indexOf returns -1 when the flag is absent; argv[-1 + 1] is argv[0] (the node binary), so the
  // index must be checked before reading the value after it.
  const buildBatchNo = buildIdx >= 0 ? (process.argv[buildIdx + 1] ?? '') : '';
  const postIdx = process.argv.indexOf('--post');
  const doPost = postIdx >= 0 || doRun;
  // An explicit batch number is REQUIRED to post. Guessing which batch to dispatch is how you
  // post the wrong one — an earlier version of this script selected the newest un-dispatched
  // batch and picked up a pre-existing mixed-system batch instead of the proof batch.
  const postBatchNo = postIdx >= 0 ? (process.argv[postIdx + 1] ?? '') : '';
  if (doPost && !doRun && !/^BATCH-/i.test(postBatchNo)) {
    console.error('--post requires the batch number to dispatch, e.g.  --post BATCH-000003');
    console.error('Run --build first; it prints the batch number it created.');
    process.exit(2);
  }
  dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });
  const pool = await new sql.ConnectionPool({ server: process.env.DB_HOST as string, port: Number(process.env.DB_PORT ?? 1433), user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD, database: process.env.DB_DATABASE, options: { encrypt: false, trustServerCertificate: true } }).connect();
  await setupSQLServerClient(new SQLServerProviderConfigData(pool, process.env.MJ_CORE_SCHEMA || '__mj'));
  await UserCache.Instance.Refresh(pool);
  const user: UserInfo = UserCache.Users.find(u => u?.Type?.trim().toLowerCase() === 'owner') ?? UserCache.Users[0];
  const provider = Metadata.Provider as never;
  const md = new Metadata();

  // Resolve the BC connector the same way production does, then attach the wire recorder.
  const ir = (await pool.request().query(`SELECT ID FROM __mj.Integration WHERE ClassName='BusinessCentralConnector'`)).recordset[0];
  const integ = await md.GetEntityObject<any>('MJ: Integrations', user); await integ.Load(ir.ID);
  const cir = (await pool.request().query(`SELECT TOP 1 ID, CompanyID FROM __mj.CompanyIntegration WHERE IntegrationID='${ir.ID}' AND IsActive=1`)).recordset[0];
  const ci = await md.GetEntityObject<any>('MJ: Company Integrations', user); await ci.Load(cir.ID);
  const COMPANY: string = cir.CompanyID;
  const connector = ConnectorFactory.Resolve(integ) as BusinessCentralConnector;

  // Wrap on the PROTOTYPE so the adapter's own connector instance is covered too. Records and
  // returns the untouched result — it changes no request, no response, and no outcome.
  const proto = Object.getPrototypeOf(connector) as any;
  const origMake = proto.MakeHTTPRequest;
  proto.MakeHTTPRequest = async function (auth: unknown, url: string, method: string, headers: unknown, body: unknown) {
    const res = await origMake.call(this, auth, url, method, headers, body);
    wire.push({ method, url, status: res?.Status, reqBody: body, resBody: res?.Body });
    return res;
  };

  const auth = await (connector as any).Authenticate(ci, user);
  const cfg = await connector.ResolveConfig(ci, user);
  const root = `https://api.businesscentral.dynamics.com/v2.0/${cfg.Environment}/api/v2.0`;
  const co = cfg.CompanyId;
  /** Raw GET straight at BC. Returns BC's parsed body untouched. */
  const bcGet = async (rel: string): Promise<any> => {
    const r = await origMake.call(connector, auth, `${root}/companies(${co})/${rel}`, 'GET', (connector as any).BuildHeaders(auth), undefined);
    if (r.Status >= 400) throw new Error(`GET ${rel} -> ${r.Status} ${JSON.stringify(r.Body).slice(0, 300)}`);
    return r.Body;
  };

  rule('STAGE 0 — CONNECTION + ACCOUNT MAPPING (what "our account" means in BC)');
  console.log(`BC environment : ${cfg.Environment}`);
  console.log(`BC company id  : ${co}`);
  console.log(`API root       : ${root}`);
  console.log(`our company    : ${COMPANY}`);
  const mapped = (await pool.request().query(`SELECT Name, AccountType, ExternalSystem, ExternalAccountID FROM ${S}.GLAccount WHERE CompanyID='${COMPANY}' AND ExternalSystem='BusinessCentral' ORDER BY AccountType`)).recordset;
  console.log(`\nGL accounts mapped to BusinessCentral (${mapped.length}):`);
  const bcAccounts = (await bcGet('accounts?$select=id,number,displayName')).value as any[];
  const byId = new Map<string, any>(bcAccounts.map(a => [String(a.id).toLowerCase(), a]));
  const acctLabel = new Map<string, string>();
  for (const m of mapped) {
    const hit = byId.get(String(m.ExternalAccountID).toLowerCase());
    const label = hit ? `BC ${hit.number} ${hit.displayName}` : '** NOT FOUND IN BC **';
    acctLabel.set(String(m.ExternalAccountID).toLowerCase(), `${hit?.number ?? '?'}`);
    console.log(`   ${String(m.AccountType).padEnd(10)} ${String(m.Name).padEnd(24)} ${m.ExternalAccountID}  ->  ${label}`);
  }

  if (doRun) {
    rule('STAGE 1a — CREATE three fresh journal entries');
    const leftovers = (await pool.request().query(`SELECT COUNT(*) n FROM ${S}.JournalEntry WHERE CompanyID='${COMPANY}' AND JournalEntryBatchID IS NULL AND Status='Pending'`)).recordset[0].n;
    if (leftovers > 0) {
      // buildJournalEntryBatch sweeps EVERY Pending unbatched JE on the company. Rather than
      // refuse (which strands a half-finished run, as happened when an earlier --run created its
      // JEs and then died), continue with what is already there and let STAGE 1 list every entry
      // that will be included — visible, not silent.
      console.log(`   ${leftovers} Pending unbatched JE(s) already exist — skipping creation and using them.`);
      console.log('   STAGE 1 below lists exactly what will be batched.');
    } else {
    const glRows = (await pool.request().query(`SELECT ID, Name FROM ${S}.GLAccount WHERE CompanyID='${COMPANY}' AND ExternalSystem='BusinessCentral'`)).recordset;
    const glByName = new Map<string, string>(glRows.map((g: any) => [g.Name as string, g.ID as string]));
    const need = ['Accounts Receivable', 'Commission Payable', 'Sales Revenue'];
    for (const n of need) if (!glByName.has(n)) { console.error(`GL account '${n}' is not mapped to BusinessCentral on this company`); await done(pool, 2); }
    const etId = (await pool.request().query(`SELECT TOP 1 ID FROM ${S}.JournalEntryType WHERE Name='Manual' AND IsJournalEntryBatchSummary=0`)).recordset[0]?.ID
      ?? (await pool.request().query(`SELECT TOP 1 ID FROM ${S}.JournalEntryType WHERE IsJournalEntryBatchSummary=0 ORDER BY Name`)).recordset[0].ID;
    const plan: Array<{ desc: string; lines: Array<[string, number | null, number | null]> }> = [
      { desc: 'BC proof — dues billed', lines: [['Accounts Receivable', 1200, null], ['Sales Revenue', null, 1200]] },
      { desc: 'BC proof — commission accrued (asset/liability)', lines: [['Accounts Receivable', 400, null], ['Commission Payable', null, 400]] },
      { desc: 'BC proof — three-account split', lines: [['Accounts Receivable', 900, null], ['Sales Revenue', null, 600], ['Commission Payable', null, 300]] },
    ];
    for (const spec of plan) {
      const dr = spec.lines.reduce((t, l) => t + (l[1] ?? 0), 0);
      const cr = spec.lines.reduce((t, l) => t + (l[2] ?? 0), 0);
      if (dr !== cr) { console.error(`plan '${spec.desc}' is unbalanced (${dr}/${cr})`); await done(pool, 2); }
      const je = await md.GetEntityObject<any>('MJ_BizApps_Accounting: Journal Entries', user);
      je.NewRecord();
      je.CompanyID = COMPANY; je.EffectiveDate = new Date(); je.EntryTypeID = etId;
      je.Status = 'Pending'; je.Description = spec.desc;
      for (const [name, d, c2] of spec.lines) {
        const line = await je.CreateLine(user);
        line.GLAccountID = glByName.get(name);
        if (d != null) line.DebitAmount = d;
        if (c2 != null) line.CreditAmount = c2;
      }
      if (!(await je.Save())) { console.error(`JE save failed: ${je.LatestResult?.CompleteMessage}`); await done(pool, 1); }
      console.log(`   created ${je.EntryNumber}  ${spec.desc}  (Dr ${dr} / Cr ${cr})`);
    }
    }
  }

  rule('STAGE 1 — INPUT: the journal entries we are about to submit (from OUR database)');
  // When posting, the input is exactly the JEs inside the named batch — so Stage 8 reconciles BC
  // against the entries that were actually dispatched, not against whatever happens to be Pending.
  const namedBatchNo = doPost ? postBatchNo : (/^BATCH-/i.test(buildBatchNo) ? buildBatchNo : '');
  const targetBatch = namedBatchNo
    ? (await pool.request().query(`SELECT ID, JournalEntryBatchNumber n, Status, ExternalJournalEntryBatchRef ref FROM ${S}.JournalEntryBatch WHERE JournalEntryBatchNumber='${namedBatchNo.replace(/'/g, "''")}' AND CompanyID='${COMPANY}'`)).recordset[0]
    : null;
  if (namedBatchNo && !targetBatch) { console.error(`batch ${namedBatchNo} not found on this company`); await done(pool, 2); }
  if (doPost && targetBatch?.ref) { console.error(`batch ${namedBatchNo} already carries external ref ${targetBatch.ref} — already posted. Refusing.`); await done(pool, 2); }
  const jes = (await pool.request().query(
    namedBatchNo
      ? `SELECT j.ID, j.EntryNumber, j.Status, j.Description FROM ${S}.JournalEntry j
         WHERE j.JournalEntryBatchID='${targetBatch.ID}' AND j.EntryTypeID NOT IN (SELECT ID FROM ${S}.JournalEntryType WHERE IsJournalEntryBatchSummary=1)
         ORDER BY j.EntryNumber`
      : `SELECT j.ID, j.EntryNumber, j.Status, j.Description FROM ${S}.JournalEntry j
         WHERE j.CompanyID='${COMPANY}' AND j.JournalEntryBatchID IS NULL AND j.Status='Pending'
         ORDER BY j.EntryNumber`)).recordset;
  if (jes.length === 0 && !doPost) { console.log('No Pending unbatched JEs on this company — nothing to prove.'); await done(pool, 0); }
  const inputByAccount = new Map<string, { dr: number; cr: number }>();
  let inDr = 0, inCr = 0;
  for (const j of jes) {
    console.log(`\n${j.EntryNumber}  [${j.Status}]  ${j.Description}`);
    const lines = (await pool.request().query(`
      SELECT l.LineNumber, g.Name acct, g.ExternalAccountID ext, ISNULL(l.DebitAmount,0) dr, ISNULL(l.CreditAmount,0) cr
      FROM ${S}.JournalEntryLine l JOIN ${S}.GLAccount g ON g.ID=l.GLAccountID
      WHERE l.JournalEntryID='${j.ID}' ORDER BY l.LineNumber`)).recordset;
    for (const l of lines) {
      const key = String(l.ext).toLowerCase();
      const agg = inputByAccount.get(key) ?? { dr: 0, cr: 0 };
      agg.dr += Number(l.dr); agg.cr += Number(l.cr); inputByAccount.set(key, agg);
      inDr += Number(l.dr); inCr += Number(l.cr);
      console.log(`   line ${l.LineNumber}  ${String(l.acct).padEnd(24)} BC ${String(acctLabel.get(key) ?? '?').padEnd(6)} Dr ${money(Number(l.dr))}  Cr ${money(Number(l.cr))}`);
    }
  }
  console.log(`\nINPUT TOTALS: Dr ${money(inDr)}  Cr ${money(inCr)}   ${inDr === inCr ? 'BALANCED' : '** UNBALANCED **'}`);
  console.log('\nNetted by BC account (this is what SHOULD reach the ledger):');
  for (const [ext, v] of inputByAccount) {
    console.log(`   BC ${String(acctLabel.get(ext) ?? '?').padEnd(6)} net ${money(v.dr - v.cr)}   (Dr ${money(v.dr)} Cr ${money(v.cr)})`);
  }

  rule('STAGE 2 — BUSINESS CENTRAL, BEFORE (read directly from BC, printed as returned)');
  const glBefore = (await bcGet(`generalLedgerEntries?$select=id,entryNumber,postingDate,accountNumber,documentNumber,debitAmount,creditAmount&$orderby=entryNumber desc&$top=3`)).value as any[];
  const countBefore = ((await bcGet(`generalLedgerEntries?$select=id&$top=10000`)).value as any[]).length;
  console.log(`generalLedgerEntries total rows: ${countBefore}`);
  console.log('newest 3 entries as BC returned them:');
  console.log(JSON.stringify(glBefore, null, 2));

  if (!doBuild && !doPost) {
    rule('PREVIEW ONLY — nothing was sent, nothing was built.');
    console.log('Next:  --build   build + approve the batch and PROVE the netting (writes nothing to BC)');
    console.log('       --post    dispatch it (IRREVERSIBLE — posts to the live general ledger)');
    await done(pool, 0);
  }

  rule('STAGE 3 — the netted summary journal entry');
  const gate = new TasksAppApprovalGate(provider);
  let batchId: string;
  // Gate on whether a batch was NAMED, not on the mode: --run posts without naming one, so keying
  // this off doPost dereferenced a null targetBatch.
  if (targetBatch) {
    batchId = targetBatch.ID;
    console.log(`using batch ${targetBatch.n} (status ${targetBatch.Status}) — named explicitly on the command line`);
  } else if (/^BATCH-/i.test(buildBatchNo)) {
    const b = (await pool.request().query(`SELECT ID FROM ${S}.JournalEntryBatch WHERE JournalEntryBatchNumber='${buildBatchNo.replace(/'/g, "''")}' AND CompanyID='${COMPANY}'`)).recordset[0];
    if (!b) { console.error(`batch ${buildBatchNo} not found`); await done(pool, 2); }
    batchId = b.ID;
    console.log(`re-checking existing batch ${buildBatchNo} (named on the command line)`);
  } else {
    const built = await buildJournalEntryBatch(COMPANY, 'BusinessCentral', user.ID, user, provider, gate);
    batchId = built.batchId;
  }
  const build = { batchId };
  const batch = (await pool.request().query(`SELECT JournalEntryBatchNumber n, SummaryJournalEntryID s, Status FROM ${S}.JournalEntryBatch WHERE ID='${build.batchId}'`)).recordset[0];
  console.log(`batch ${batch.n}  status ${batch.Status}  summary JE ${batch.s}`);
  const sum = (await pool.request().query(`
    SELECT l.LineNumber, g.Name acct, g.ExternalAccountID ext, ISNULL(l.DebitAmount,0) dr, ISNULL(l.CreditAmount,0) cr
    FROM ${S}.JournalEntryLine l JOIN ${S}.GLAccount g ON g.ID=l.GLAccountID
    WHERE l.JournalEntryID='${batch.s}' ORDER BY l.LineNumber`)).recordset;
  console.log('\nSUMMARY LINES — these, and only these, are sent to BC:');
  for (const l of sum) console.log(`   ${String(l.acct).padEnd(24)} BC ${String(acctLabel.get(String(l.ext).toLowerCase()) ?? '?').padEnd(6)} Dr ${money(Number(l.dr))}  Cr ${money(Number(l.cr))}`);

  // Prove the netting NOW, against Stage 1, while nothing has been sent anywhere.
  const netOk = (() => {
    const summed = new Map<string, number>();
    for (const l of sum) {
      const k = String(l.ext).toLowerCase();
      summed.set(k, (summed.get(k) ?? 0) + (Number(l.dr) - Number(l.cr)));
    }
    let ok = true;
    console.log(`\n${'BC acct'.padEnd(10)}${'stage-1 net'.padStart(16)}${'summary net'.padStart(16)}   match`);
    const keys = new Set<string>([...inputByAccount.keys(), ...summed.keys()]);
    for (const k of keys) {
      const a = inputByAccount.get(k); const ours = a ? a.dr - a.cr : NaN;
      const theirs = summed.get(k);
      const good = a != null && theirs != null && Math.abs(ours - theirs) < 0.005;
      if (!good) ok = false;
      console.log(`${String(acctLabel.get(k) ?? '?').padEnd(10)}${(a ? money(ours) : 'ABSENT').padStart(16)}${(theirs == null ? 'ABSENT' : money(theirs)).padStart(16)}   ${good ? 'yes' : 'NO'}`);
    }
    return ok;
  })();
  console.log(`\nNETTING: ${netOk ? 'PASS — the summary matches the input exactly.' : 'FAIL — summary does not match input; do NOT post.'}`);
  if (!netOk) await done(pool, 1);

  if (!doPost) {
    // recordDecision's third parameter is a PERSON id (FK -> __mj_BizAppsCommon.Person), NOT the
    // AccountingCompanyProfile.ApprovalCFOUserID, which is an __mj.User. The gate does not translate
    // between them, and this instance has zero Person rows, so passing the User id violates
    // FK_TaskDecision_DecidedByPerson. The column is nullable, so record the decision without a
    // person rather than inventing one. (_maint-bc-gate4-post.ts has the same latent misuse.)
    const already = (await pool.request().query(`SELECT Status FROM ${S}.JournalEntryBatch WHERE ID='${build.batchId}'`)).recordset[0]?.Status;
    if (already === 'Approved') {
      console.log(`\nbatch already Approved — leaving the existing decision in place.`);
    } else {
      await gate.recordDecision(build.batchId, 'Approved', undefined, 'flow proof build', user);
      console.log(`\nApproval decision recorded (no DecidedByPerson — column is nullable and this instance has no Person rows).`);
    }
    // Approval is TWO decoupled operations: the Task decision above, and the batch Status flip
    // below. sendJournalEntryBatch() requires BOTH (the gate seam AND Status='Approved'), so
    // recording the decision alone leaves the batch un-dispatchable at Pending.
    const st = (await pool.request().query(`SELECT Status FROM ${S}.JournalEntryBatch WHERE ID='${build.batchId}'`)).recordset[0]?.Status;
    if (st !== 'Approved') {
      await approveJournalEntryBatch(build.batchId, user.ID, user, Metadata.Provider);
      const st2 = (await pool.request().query(`SELECT Status FROM ${S}.JournalEntryBatch WHERE ID='${build.batchId}'`)).recordset[0]?.Status;
      console.log(`batch Status ${st} -> ${st2}`);
      if (st2 !== 'Approved') { console.error(`batch did not reach Approved (is ${st2}) — not dispatchable`); await done(pool, 1); }
    }
    rule('BUILD ONLY — the batch is built and approved. NOTHING was sent to Business Central.');
    console.log(`Batch ${batch.n} is built, approved and PROVEN to match the input.`);
    console.log(`\nTo dispatch it (IRREVERSIBLE):`);
    console.log(`   npx tsx ../bizapps-accounting/test-harnesses/server/_maint-bc-flow-proof.ts --post ${batch.n}`);
    await done(pool, 0);
  }

  rule('STAGE 4 — APPROVE through the real gate, then DISPATCH through the real remote operation');
  // Approval is TWO decoupled operations and sendJournalEntryBatch requires BOTH: the gate's Task
  // decision AND Status='Approved'. Recording only the decision leaves the batch un-dispatchable.
  if (batch.Status !== 'Approved') {
    await gate.recordDecision(build.batchId, 'Approved', undefined, 'flow proof', user);
    await approveJournalEntryBatch(build.batchId, user.ID, user, Metadata.Provider);
    const st = (await pool.request().query(`SELECT Status FROM ${S}.JournalEntryBatch WHERE ID='${build.batchId}'`)).recordset[0]?.Status;
    console.log(`approval decision recorded; batch Status ${batch.Status} -> ${st}`);
    if (st !== 'Approved') { console.error(`batch did not reach Approved (is ${st}) — dispatch would be rejected`); await done(pool, 1); }
  } else {
    console.log('batch already Approved — no new decision recorded');
  }
  const wireStart = wire.length;
  if (noDispatch) {
    rule('REHEARSAL COMPLETE (--no-dispatch) — everything up to the post ran. NOTHING was sent to BC.');
    console.log(`Batch ${batch.n} is built, approved and netting-verified.`);
    console.log(`\nTo dispatch it for real:`);
    console.log(`   npx tsx ../bizapps-accounting/test-harnesses/server/_maint-bc-flow-proof.ts --post ${batch.n}`);
    await done(pool, 0);
  }
  const res = await new DispatchJournalEntryBatchOperation().ExecuteServer({ JournalEntryBatchID: build.batchId }, { provider, user } as never);
  console.log(`dispatch Success=${res.Success}${(res as any).ErrorMessage ? '  error=' + (res as any).ErrorMessage : ''}`);

  rule('STAGE 5 — THE WIRE: every HTTP call the adapter made to Business Central');
  for (const w of wire.slice(wireStart)) {
    console.log(`\n${w.method} ${w.url.replace(root, '')}  -> ${w.status}`);
    if (w.reqBody && Object.keys(w.reqBody as object).length) console.log(`  request : ${JSON.stringify(w.reqBody)}`);
    const rb = JSON.stringify(w.resBody ?? {});
    console.log(`  response: ${rb.length > 400 ? rb.slice(0, 400) + '…' : rb}`);
  }

  rule('STAGE 6 — OUR SIDE after dispatch');
  const after = (await pool.request().query(`
    SELECT b.JournalEntryBatchNumber n, b.Status, b.ExternalJournalEntryBatchRef ref,
      (SELECT COUNT(*) FROM ${S}.JournalEntry j WHERE j.JournalEntryBatchID=b.ID AND j.Status='GLPosted') posted,
      (SELECT COUNT(*) FROM ${S}.JournalEntry j WHERE j.JournalEntryBatchID=b.ID) total
    FROM ${S}.JournalEntryBatch b WHERE b.ID='${build.batchId}'`)).recordset[0];
  console.log(JSON.stringify(after, null, 2));

  rule('STAGE 7 — BUSINESS CENTRAL, AFTER (fresh read from BC, printed as returned)');
  const countAfter = ((await bcGet(`generalLedgerEntries?$select=id&$top=10000`)).value as any[]).length;
  console.log(`generalLedgerEntries total rows: ${countBefore} -> ${countAfter}   (delta ${countAfter - countBefore})`);
  // Take the document number from the payload we actually SENT, captured in the wire log. Deriving
  // it independently would duplicate adapter logic (the divergence trap Gate 3 fell into), and the
  // stored ExternalJournalEntryBatchRef is the wrong thing to filter on if it ever drifts again.
  const docFromWire = (() => {
    for (const w of wire.slice(wireStart)) {
      const reqs = (w.reqBody as { requests?: Array<{ body?: { documentNumber?: string } }> } | undefined)?.requests;
      const d = reqs?.map(r => r.body?.documentNumber).find(Boolean);
      if (d) return d;
      const direct = (w.reqBody as { documentNumber?: string } | undefined)?.documentNumber;
      if (direct) return direct;
    }
    return undefined;
  })();
  const docNo = String(docFromWire ?? after.ref ?? '');
  console.log(`filtering BC on documentNumber '${docNo}'${docFromWire ? ' (taken from the payload we sent)' : ' (fallback: stored external ref)'}`);
  if (docFromWire && after.ref && docFromWire !== after.ref) {
    console.log(`NOTE: stored ExternalJournalEntryBatchRef is '${after.ref}', which differs from the document number stamped on the entries.`);
  }
  const mine = (await bcGet(`generalLedgerEntries?$filter=documentNumber eq '${docNo}'&$select=entryNumber,postingDate,accountNumber,accountId,documentNumber,description,debitAmount,creditAmount`)).value as any[];
  console.log(`\nentries BC holds for documentNumber '${docNo}' — raw, exactly as BC returned:`);
  console.log(JSON.stringify(mine, null, 2));

  rule('STAGE 8 — RECONCILE: our input vs what BC actually holds');
  const bcByAccount = new Map<string, number>();
  for (const e of mine) {
    const k = String(e.accountNumber);
    bcByAccount.set(k, (bcByAccount.get(k) ?? 0) + (Number(e.debitAmount) - Number(e.creditAmount)));
  }
  console.log(`${'BC acct'.padEnd(10)}${'our net (Dr-Cr)'.padStart(18)}${'BC net (Dr-Cr)'.padStart(18)}   match`);
  let allMatch = true;
  const seen = new Set<string>();
  for (const [ext, v] of inputByAccount) {
    const acct = String(acctLabel.get(ext) ?? '?'); seen.add(acct);
    const ours = v.dr - v.cr; const theirs = bcByAccount.get(acct);
    const ok = theirs != null && Math.abs(ours - theirs) < 0.005;
    if (!ok) allMatch = false;
    console.log(`${acct.padEnd(10)}${money(ours).padStart(18)}${(theirs == null ? 'ABSENT' : money(theirs)).padStart(18)}   ${ok ? 'yes' : 'NO'}`);
  }
  for (const [acct, theirs] of bcByAccount) {
    if (seen.has(acct)) continue;
    allMatch = false;
    console.log(`${acct.padEnd(10)}${'(not sent)'.padStart(18)}${money(theirs).padStart(18)}   NO  <- BC has an account we did not send`);
  }
  // Every check is reported the same way and contributes to one verdict — nothing exits early,
  // so a single run always shows the complete picture rather than stopping at the first problem.
  const refOk = docFromWire != null && String(after.ref) === String(docFromWire);
  const refResolves = mine.length > 0 && mine.every(e => String(e.documentNumber) === String(after.ref));
  const bcTotal = [...bcByAccount.values()].reduce((s2, n) => s2 + n, 0);
  const balances = Math.abs(bcTotal) < 0.005;
  const entryCount = mine.length === sum.length;

  const checks: Array<[string, boolean, string]> = [
    ['dispatch reported success', res.Success === true, String(res.Success)],
    ['every account matches BC', allMatch, allMatch ? 'all accounts reconcile' : 'see the NO rows above'],
    ['one G/L entry per summary line', entryCount, `${mine.length} entries vs ${sum.length} summary lines`],
    ['BC entries balance to zero', balances, money(bcTotal).trim()],
    ['external ref = stamped document number', refOk, `stored '${after.ref}' vs stamped '${docFromWire ?? '(none captured)'}'`],
    ['stored ref resolves in BC ledger', refResolves, refResolves ? `${mine.length} matching entries` : 'filtering on the stored ref finds nothing'],
  ];
  console.log('');
  let pass = true;
  for (const [name, ok, detail] of checks) {
    if (!ok) pass = false;
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(40)} ${detail}`);
  }
  if (!refOk || !refResolves) {
    console.log('\n  NOTE: ExternalJournalEntryBatchRef must be the document number stamped on the G/L');
    console.log('        entries, not the shared journal code. VerifyPosted looks entries up BY document');
    console.log('        number, so a wrong ref makes a genuinely-posted batch report as unposted.');
  }
  console.log(`\nRESULT: ${pass ? 'PASS' : 'FAIL'}`);
  await done(pool, pass ? 0 : 1);
}
main().catch(e => { console.error('FAILED:', e?.message ?? e); process.exit(1); });
