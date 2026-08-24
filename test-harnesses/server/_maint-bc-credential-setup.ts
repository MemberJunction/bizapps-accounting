/** _maint-bc-credential-setup.ts — wire a Business Central connection from a local key blob.
 *
 *  Reads a `Label - value` blob (default: <instance>/keys.txt — NEVER committed, never echoed),
 *  then, through BaseEntity so field-level encryption actually engages:
 *    1. upserts an `MJ: Credentials` row of the BC credential type
 *    2. upserts the single active `MJ: Company Integrations` row for the BC Integration
 *  Then PROVES the wiring rather than assuming it:
 *    - re-reads Values through BaseEntity  -> decrypt-on-load returns the plaintext JSON
 *    - reads the raw SQL column            -> confirms ciphertext at rest (not plaintext)
 *    - calls the connector's TestConnection -> confirms the credential authenticates
 *
 *  Run from the instance MJ worktree (mj/):
 *    npx tsx ../bizapps-accounting/test-harnesses/server/_maint-bc-credential-setup.ts [blobPath]
 */
import sql from 'mssql'; import dotenv from 'dotenv'; import path from 'path'; import fs from 'fs';
import { Metadata } from '@memberjunction/core';
import { setupSQLServerClient, SQLServerProviderConfigData, UserCache } from '@memberjunction/sqlserver-dataprovider';
import '@memberjunction/server-bootstrap-lite';
import '@memberjunction/connector-business-central';
import { ConnectorFactory } from '@memberjunction/integration-engine';

const BC_CREDENTIAL_TYPE_ID = '220D6680-68A4-4DC4-A271-2206C64C585E';
const CONNECTION_NAME = 'BC Sandbox';

/** Maps the blob's human labels onto the keys ResolveConfig actually reads (Integrations#207). */
function parseBlob(file: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const s = line.trim(); if (!s) continue;
    const i = s.indexOf('-'); if (i < 0) continue;
    const label = s.slice(0, i).trim().toLowerCase().replace(/[^a-z]/g, '');
    const value = s.slice(i + 1).replace(/^\s*[:=]?\s*/, '').trim();
    if (!value) continue;
    if (label === 'tenantid') out.TenantId = value;
    else if (label === 'clientid') out.ClientId = value;
    else if (label === 'clientsecret') out.ClientSecret = value;
    else if (label === 'environmentname' || label === 'environment') out.environmentName = value;
    else if (label === 'company' || label === 'companyid') out.companyId = value;
    // 'Base URL' is deliberately DROPPED: the connector composes
    // {Server}/v2.0/[{TenantId}/]{Environment}/api/{ApiVersion} itself, and its defaults already
    // reproduce the documented URL exactly. Passing the composed URL as Server would double the path.
  }
  return out;
}

async function main(): Promise<void> {
  const blobPath = process.argv[2] ?? path.resolve(process.cwd(), '..', 'keys.txt');
  const vals = parseBlob(blobPath);
  const required = ['ClientId', 'ClientSecret', 'TenantId', 'companyId', 'environmentName'];
  const missing = required.filter(k => !vals[k]);
  if (missing.length) throw new Error(`blob ${blobPath} missing: ${missing.join(', ')}`);
  console.log(`blob parsed: ${required.map(k => `${k}=${k === 'ClientSecret' ? '<redacted>' : `${vals[k].slice(0, 4)}…`}`).join(' · ')} (environmentName=${vals.environmentName})`);

  dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });
  const pool = await new sql.ConnectionPool({ server: process.env.DB_HOST as string, port: Number(process.env.DB_PORT ?? 1433), user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD, database: process.env.DB_DATABASE, options: { encrypt: false, trustServerCertificate: true } }).connect();
  const cfg = new SQLServerProviderConfigData(pool, process.env.MJ_CORE_SCHEMA || '__mj');
  await setupSQLServerClient(cfg);
  await UserCache.Instance.Refresh(pool);
  const user = UserCache.Users.find(u => u?.Type?.trim().toLowerCase() === 'owner') ?? UserCache.Users[0];
  if (!user) throw new Error('no context user');
  const md = new Metadata();

  // ── the Integration row (seeded by the connector's own migration) ──
  const integ = (await pool.request().query(`SELECT ID, Name, ClassName FROM __mj.Integration WHERE ClassName LIKE '%BusinessCentral%' OR Name LIKE '%Business Central%'`)).recordset;
  if (integ.length !== 1) throw new Error(`expected exactly 1 Business Central Integration, found ${integ.length}: ${JSON.stringify(integ)}`);
  console.log(`Integration: ${integ[0].Name} (ClassName=${integ[0].ClassName})`);

  // ── the MJ Company to bind the connection to ──
  const company = (await pool.request().query(`SELECT TOP 1 ID, Name FROM __mj.Company ORDER BY __mj_CreatedAt`)).recordset[0];
  if (!company) throw new Error('no __mj.Company row to bind the CompanyIntegration to');
  console.log(`Company: ${company.Name}`);

  // ── 1. Credential (through BaseEntity => encrypt-on-save) ──
  const existingCred = (await pool.request().query(`SELECT ID FROM __mj.Credential WHERE CredentialTypeID='${BC_CREDENTIAL_TYPE_ID}' AND Name='${CONNECTION_NAME}'`)).recordset[0];
  const cred = await md.GetEntityObject<any>('MJ: Credentials', user);
  if (existingCred) { await cred.Load(existingCred.ID); console.log('updating existing Credential', existingCred.ID); }
  else { cred.NewRecord(); cred.CredentialTypeID = BC_CREDENTIAL_TYPE_ID; cred.Name = CONNECTION_NAME; console.log('creating Credential'); }
  cred.Description = 'Business Central sandbox (Test environment) for JE-batch export';
  cred.Values = JSON.stringify({ ClientId: vals.ClientId, ClientSecret: vals.ClientSecret, TenantId: vals.TenantId, companyId: vals.companyId, environmentName: vals.environmentName }, null, 2);
  cred.IsActive = true;
  if (!(await cred.Save())) throw new Error(`Credential save failed: ${cred.LatestResult?.CompleteMessage}`);
  console.log(`✔ Credential ${cred.ID}`);

  // ── 2. CompanyIntegration — exactly ONE active row for this Integration ──
  const others = (await pool.request().query(`SELECT ID FROM __mj.CompanyIntegration WHERE IntegrationID='${integ[0].ID}' AND IsActive=1`)).recordset;
  const ci = await md.GetEntityObject<any>('MJ: Company Integrations', user);
  if (others.length === 1) { await ci.Load(others[0].ID); console.log('reusing active CompanyIntegration', others[0].ID); }
  else if (others.length > 1) throw new Error(`${others.length} active CompanyIntegrations already exist — deactivate all but one first`);
  else { ci.NewRecord(); ci.IntegrationID = integ[0].ID; ci.CompanyID = company.ID; console.log('creating CompanyIntegration'); }
  ci.Name = CONNECTION_NAME;
  ci.CredentialID = cred.ID;
  ci.IsActive = true;
  if (!(await ci.Save())) throw new Error(`CompanyIntegration save failed: ${ci.LatestResult?.CompleteMessage}`);
  console.log(`✔ CompanyIntegration ${ci.ID}`);

  // ── 3. PROVE encryption: BaseEntity round-trip vs the raw column ──
  const reread = await md.GetEntityObject<any>('MJ: Credentials', user);
  await reread.Load(cred.ID);
  let decrypted: Record<string, string>;
  try { decrypted = JSON.parse(reread.Values); }
  catch { throw new Error('decrypt-on-load FAILED: Values did not come back as JSON through BaseEntity'); }
  const okKeys = required.every(k => decrypted[k] === vals[k]);
  console.log(`${okKeys ? '✔' : '✗'} decrypt-on-load: all ${required.length} values round-tripped intact through BaseEntity`);
  if (!okKeys) throw new Error('round-trip mismatch');

  const rawCol = (await pool.request().query(`SELECT [Values] AS v FROM __mj.Credential WHERE ID='${cred.ID}'`)).recordset[0].v as string;
  const rawIsPlaintext = rawCol.includes(vals.ClientSecret);
  console.log(`${rawIsPlaintext ? '✗' : '✔'} at rest: raw SQL column ${rawIsPlaintext ? 'CONTAINS THE PLAINTEXT SECRET' : 'is ciphertext'} (marker=${rawCol.slice(0, 5)}, len=${rawCol.length})`);
  if (rawIsPlaintext) throw new Error('SECRET STORED IN PLAINTEXT — field-level encryption did not engage');

  // ── 4. PROVE the credential authenticates ──
  const ciEnt = await md.GetEntityObject<any>('MJ: Company Integrations', user);
  await ciEnt.Load(ci.ID);
  const integEnt = await md.GetEntityObject<any>('MJ: Integrations', user);
  await integEnt.Load(integ[0].ID);
  const connector: any = ConnectorFactory.Resolve(integEnt);
  if (!connector) throw new Error(`ConnectorFactory could not resolve ClassName '${integ[0].ClassName}'`);
  console.log(`connector resolved: ${connector.constructor?.name}`);
  const test = await connector.TestConnection(ciEnt, user);
  console.log(`${test?.Success ? '✔' : '✗'} TestConnection: ${JSON.stringify(test)}`);
  if (!test?.Success) throw new Error(`TestConnection FAILED: ${test?.Message ?? 'no message'}`);

  console.log('\nALL CHECKS PASSED');
  await pool.close();
}
main().catch(e => { console.error('FAILED:', e?.message ?? e); process.exit(1); });
