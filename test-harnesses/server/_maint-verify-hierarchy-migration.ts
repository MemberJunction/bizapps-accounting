/** READ-ONLY: verify the MJ6 hierarchy-gate regeneration migration converged. */
import sql from 'mssql'; import dotenv from 'dotenv'; import path from 'path';
const SCHEMA = '__mj_BizAppsAccounting';
const EXPECTED_FNS = [
  'fnAccountingCompanyProfileParentAccountingCompanyID_GetAncestors','fnAccountingCompanyProfileParentAccountingCompanyID_GetDescendants','fnAccountingCompanyProfileParentAccountingCompanyID_GetHierarchyMeta','fnAccountingCompanyProfileParentAccountingCompanyID_GetRootID',
  'fnDimensionValueParentDimensionValueID_GetAncestors','fnDimensionValueParentDimensionValueID_GetDescendants','fnDimensionValueParentDimensionValueID_GetHierarchyMeta','fnDimensionValueParentDimensionValueID_GetRootID',
  'fnGLAccountParentGLAccountID_GetAncestors','fnGLAccountParentGLAccountID_GetDescendants','fnGLAccountParentGLAccountID_GetHierarchyMeta','fnGLAccountParentGLAccountID_GetRootID',
  'fnTaxJurisdictionParentTaxJurisdictionID_GetAncestors','fnTaxJurisdictionParentTaxJurisdictionID_GetDescendants','fnTaxJurisdictionParentTaxJurisdictionID_GetHierarchyMeta','fnTaxJurisdictionParentTaxJurisdictionID_GetRootID'];
const FORBIDDEN_FNS = ['fnJournalEntryReversesJournalEntryID_GetRootID','fnJournalEntryReversedByJournalEntryID_GetRootID'];
async function main(): Promise<void> {
  dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });
  const p = await new sql.ConnectionPool({ server: process.env.DB_HOST as string, port: Number(process.env.DB_PORT ?? 1433), user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD, database: process.env.DB_DATABASE, options: { encrypt: false, trustServerCertificate: true } }).connect();
  const fns = (await p.request().query(`SELECT o.name FROM sys.objects o JOIN sys.schemas s ON s.schema_id=o.schema_id WHERE s.name='${SCHEMA}' AND o.name LIKE 'fn%'`)).recordset.map(r=>r.name as string);
  const missing = EXPECTED_FNS.filter(f=>!fns.includes(f));
  const lingering = FORBIDDEN_FNS.filter(f=>fns.includes(f));
  const cols=(await p.request().query(`SELECT c.name FROM sys.columns c JOIN sys.views v ON v.object_id=c.object_id JOIN sys.schemas s ON s.schema_id=v.schema_id WHERE s.name='${SCHEMA}' AND v.name='vwJournalEntries'`)).recordset.map(r=>r.name as string);
  const rootCols = cols.filter(c=>c.startsWith('Root'));
  const eid=(await p.request().query(`SELECT TOP 1 ID FROM __mj.Entity WHERE SchemaName='${SCHEMA}' AND BaseTable='JournalEntry'`)).recordset[0]?.ID;
  const flds=(await p.request().query(`SELECT Name FROM __mj.EntityField WHERE EntityID='${eid}'`)).recordset.map(r=>r.Name as string);
  const rootFlds = flds.filter(f=>f.startsWith('Root'));
  const dupes=(await p.request().query(`
    SELECT Name, COUNT(*) n FROM __mj.GeneratedCode
    WHERE Name IN ('ValidateFiscalYearStartMonthRange','ValidateParentAccountingCompanyIDNotSelf','ValidateIDEqualsOne','ValidateRateRange')
    GROUP BY Name, LinkedEntityID, LinkedRecordPrimaryKey HAVING COUNT(*)>1`)).recordset;
  const checks: Array<[string, boolean, string]> = [
    ['16 hierarchy TVFs present',            missing.length===0,        missing.length?`missing: ${missing.join(', ')}`:'all present'],
    ['orphan JE RootID fns dropped',         lingering.length===0,      lingering.length?`lingering: ${lingering.join(', ')}`:'none'],
    ['vwJournalEntries has no Root* cols',   rootCols.length===0,       rootCols.length?rootCols.join(', '):`${cols.length} cols, none Root*`],
    ['no orphan Root* EntityFields',         rootFlds.length===0,       rootFlds.length?rootFlds.join(', '):'none'],
    ['EntityFields match view columns',      cols.length===flds.length, `${flds.length} fields vs ${cols.length} cols`],
    ['no duplicate validator rows',          dupes.length===0,          dupes.length?dupes.map(d=>`${d.Name} x${d.n}`).join(', '):'none'],
  ];
  let pass = true;
  for (const [name, ok, detail] of checks) { if(!ok) pass=false; console.log(`  ${ok?'PASS':'FAIL'}  ${name.padEnd(34)} ${detail}`); }
  console.log(`\n${pass?'ALL CHECKS PASS':'*** FAILURES ***'}`);
  await p.close();
  if (!pass) process.exit(1);
}
main().catch(e=>{console.error('FAILED:',e?.message??e);process.exit(1);});
