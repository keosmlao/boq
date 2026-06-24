// Read-only: list tables in public + pm, categorised, to see what's left to separate.
import pg from "pg";
const pool = new pg.Pool({
  host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME,
  user: process.env.DB_USER, password: process.env.DB_PASSWORD, connectionTimeoutMillis: 10_000,
});
const { rows } = await pool.query(
  `SELECT table_schema, table_name FROM information_schema.tables
     WHERE table_schema IN ('public','pm') AND table_type='BASE TABLE'
     ORDER BY table_schema, table_name`);
const pub = rows.filter(r => r.table_schema === 'public').map(r => r.table_name);
const pm = rows.filter(r => r.table_schema === 'pm').map(r => r.table_name);
const isErp = n => /^(erp_|ic_|biotime_|ar_|ap_)/.test(n) || n === 'profitloss';
console.log(`\n=== pm schema (${pm.length}) ===`); pm.forEach(n => console.log('  ' + n));
console.log(`\n=== public — ERP (keep) (${pub.filter(isErp).length}) ===`); pub.filter(isErp).forEach(n => console.log('  ' + n));
console.log(`\n=== public — app-owned odg_* (candidates to move) (${pub.filter(n=>!isErp(n)).length}) ===`);
pub.filter(n => !isErp(n)).forEach(n => console.log('  ' + n));
await pool.end();
