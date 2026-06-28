/**
 * One-off backfill: mirror existing v2 material requests (odg_request) into SML
 * (ic_trans + ic_trans_detail, trans_type 3 / flag 122) so the warehouse sees
 * requests created before the live SML mirror existed.
 *
 * Mirrors:
 *   - every non-rejected request that has NO item substitution, AND
 *   - substituted requests only once their substitution is approved.
 * Idempotent: re-running deletes + re-inserts each request's mirror.
 *
 * Run:  node --env-file=.env scripts/backfill-requests-to-sml.mjs
 *       node --env-file=.env scripts/backfill-requests-to-sml.mjs --dry
 */
import { Pool } from "pg";

const DRY = process.argv.includes("--dry");
const TYPE = 3;
const FLAG = 122;
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const isSub = (it) => {
  const b = String(it?.boq_item_code || "").trim();
  return b && b !== String(it?.item_code || "").trim();
};

const pool = new Pool({
  host: process.env.DB_HOST, port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD,
  options: "-c search_path=pm,public",
});

async function projectCustCode(client, projectId) {
  try {
    const r = await client.query(`SELECT sml_code FROM odg_projects WHERE id::text = $1 LIMIT 1`, [String(projectId)]);
    return String(r.rows[0]?.sml_code || "");
  } catch { return ""; }
}

async function mirror(client, req) {
  const items = Array.isArray(req.items) ? req.items : [];
  const docNo = req.request_no;
  if (!docNo || !items.length) return false;
  const hasSub = items.some(isSub);
  if (hasSub && !req.substitute_approved) return false; // wait for approval
  const custCode = await projectCustCode(client, req.project_id);
  const docDate = new Date(req.created_at || Date.now()).toISOString().slice(0, 10);
  const first = items[0] || {};
  const whFrom = String(first.wh_code || "");
  const locFrom = String(first.shelf_code || "");
  if (DRY) { console.log(`  would mirror ${docNo} (${items.length} items)`); return true; }

  await client.query(`DELETE FROM ic_trans_detail WHERE doc_no=$1 AND trans_type=$2 AND trans_flag=$3`, [docNo, TYPE, FLAG]);
  await client.query(`DELETE FROM ic_trans WHERE doc_no=$1 AND trans_type=$2 AND trans_flag=$3`, [docNo, TYPE, FLAG]);
  await client.query(
    `INSERT INTO ic_trans (trans_type,trans_flag,doc_date,doc_no,doc_ref,cust_code,wh_from,location_from,creator_code,user_request,remark,doc_success)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9,$10,0)`,
    [TYPE, FLAG, docDate, docNo, "", custCode, whFrom, locFrom, req.requester || "", req.notes || ""],
  );
  let line = 0;
  for (const it of items) {
    if (!(num(it.qty) > 0)) continue;
    line++;
    const remark = isSub(it) ? `substitute of ${it.boq_item_name || it.boq_item_code}` : (it.remark || "");
    await client.query(
      `INSERT INTO ic_trans_detail (trans_type,trans_flag,doc_date,doc_no,doc_ref,cust_code,item_code,item_name,unit_code,qty,wh_code,shelf_code,line_number,remark)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [TYPE, FLAG, docDate, docNo, "", custCode, String(it.item_code || ""), String(it.description || it.item_name || ""),
       String(it.unit || it.unit_code || ""), num(it.qty), String(it.wh_code || whFrom), String(it.shelf_code || locFrom), line, remark],
    );
  }
  return true;
}

(async () => {
  const client = await pool.connect();
  let done = 0, skipped = 0;
  try {
    const r = await client.query(`SELECT id, request_no, project_id, items, notes, requester, created_at, substitute_approved FROM odg_request WHERE COALESCE(status,'') <> 'rejected' ORDER BY id`);
    console.log(`${DRY ? "[DRY] " : ""}backfilling ${r.rows.length} v2 requests...`);
    for (const req of r.rows) {
      const ok = await mirror(client, req).catch((e) => { console.error(`  ! ${req.request_no}:`, e.message); return false; });
      if (ok) done++; else skipped++;
    }
    console.log(`done: ${done} mirrored, ${skipped} skipped (no items / pending substitution approval).`);
  } finally {
    client.release();
    await pool.end();
  }
})();
