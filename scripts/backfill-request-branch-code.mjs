// One-off: set ic_trans.branch_code / ic_trans_detail.branch_code = '00' on the
// material requests this app mirrored into SML before the branch was written.
// Scoped to doc_no values this app owns (pm.odg_requests / pm.odg_request), so
// requests created inside SML itself are never touched.
//
//   set -a; . ./.env; set +a; node scripts/backfill-request-branch-code.mjs        # dry run
//   set -a; . ./.env; set +a; node scripts/backfill-request-branch-code.mjs --commit
import pg from "pg";

const COMMIT = process.argv.includes("--commit");
const BRANCH_CODE = "00";

const pool = new pg.Pool({
  host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME,
  user: process.env.DB_USER, password: process.env.DB_PASSWORD, connectionTimeoutMillis: 10_000,
  options: "-c search_path=pm,public",
});

const OWNED = `(SELECT doc_no AS n FROM pm.odg_requests UNION SELECT request_no AS n FROM pm.odg_request)`;
const WHERE = `trans_type = 3 AND trans_flag = 122 AND coalesce(branch_code,'') = '' AND doc_no IN (SELECT n FROM ${OWNED} o)`;

const c = await pool.connect();
try {
  await c.query("BEGIN");

  const targets = await c.query(
    `SELECT doc_no, doc_date::text AS doc_date, wh_from, creator_code
       FROM public.ic_trans WHERE ${WHERE} ORDER BY doc_date, doc_no`);
  console.log(`requests with a blank branch: ${targets.rowCount}`);
  console.table(targets.rows);

  const h = await c.query(`UPDATE public.ic_trans SET branch_code = $1 WHERE ${WHERE}`, [BRANCH_CODE]);
  const d = await c.query(`UPDATE public.ic_trans_detail SET branch_code = $1 WHERE ${WHERE}`, [BRANCH_CODE]);
  console.log(`\nheaders updated:      ${h.rowCount}`);
  console.log(`detail lines updated: ${d.rowCount}`);

  const left = await c.query(`SELECT count(*)::int AS n FROM public.ic_trans WHERE ${WHERE}`);
  console.log(`app-owned requests still blank: ${left.rows[0].n}`);

  console.log("\nbranch_code across all app-owned requests:");
  console.table((await c.query(
    `SELECT coalesce(branch_code,'(null)') AS branch_code, count(*)::int AS n
       FROM public.ic_trans WHERE trans_type = 3 AND trans_flag = 122 AND doc_no IN (SELECT n FROM ${OWNED} o)
      GROUP BY 1 ORDER BY n DESC`)).rows);

  if (COMMIT) {
    await c.query("COMMIT");
    console.log("\nCOMMITTED");
  } else {
    await c.query("ROLLBACK");
    console.log("\nDRY RUN — rolled back. Re-run with --commit to apply.");
  }
} catch (e) {
  await c.query("ROLLBACK");
  console.error("rolled back:", e.message);
  process.exitCode = 1;
} finally {
  c.release();
  await pool.end();
}
