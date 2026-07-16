/**
 * _maint — inspect Explorer app registration for this instance.
 *
 * Answers "why can't I see the Accounting app on the Explorer home screen?": lists the
 * __mj.Application rows, their nav items, and which users have access (__mj.UserApplication).
 * Read-only.
 */
import sql from 'mssql';
import dotenv from 'dotenv';
import path from 'node:path';
dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });

(async () => {
  const pool = await new sql.ConnectionPool({
    server: process.env.DB_HOST!, port: Number(process.env.DB_PORT ?? 1433),
    user: process.env.DB_USERNAME!, password: process.env.DB_PASSWORD!, database: process.env.DB_DATABASE!,
    options: { encrypt: false, trustServerCertificate: true },
  }).connect();

  const apps = await pool.request().query(
    `SELECT ID, Name, DefaultForNewUser, Icon FROM __mj.Application ORDER BY Name`);
  console.log('=== __mj.Application ===');
  for (const r of apps.recordset) console.log(`  ${String(r.Name).padEnd(28)} defaultForNewUser=${r.DefaultForNewUser}  icon=${r.Icon ?? '-'}`);

  // Nav items are a JSON column on Application (there is NO ApplicationNavItem table).
  const nav = await pool.request().query(
    `SELECT Name, Status, DefaultNavItems FROM __mj.Application WHERE DefaultNavItems IS NOT NULL ORDER BY Name`);
  console.log('\n=== Application.DefaultNavItems (JSON column, not a table) ===');
  for (const r of nav.recordset) {
    let labels = '(unparseable)';
    try {
      const parsed = JSON.parse(r.DefaultNavItems) as Array<{ Label: string }>;
      labels = `${parsed.length}: ${parsed.map((n) => n.Label).join(' | ')}`;
    } catch { /* leave as unparseable — that itself is the finding */ }
    console.log(`  ${String(r.Name).padEnd(28)} [${r.Status}] ${labels}`);
  }

  const ua = await pool.request().query(
    `SELECT u.Email, a.Name AS AppName, ua.Sequence FROM __mj.UserApplication ua
     JOIN __mj.Application a ON a.ID = ua.ApplicationID
     JOIN __mj.[User] u ON u.ID = ua.UserID ORDER BY u.Email, ua.Sequence`);
  console.log('\n=== __mj.UserApplication — the home screen, IN ORDER ===');
  // Sequence is what buries an app: an app can be Active + granted and still sit at #27 of 29.
  for (const r of ua.recordset) console.log(`  ${String(r.Email).padEnd(30)} ${String(r.Sequence).padStart(3)}  ${r.AppName}`);

  await pool.close();
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
