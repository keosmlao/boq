/**
 * One-off backfill: make SML the master of the unit of measure.
 *
 * The item master (ic_inventory.unit_standard) decides what unit an item is
 * counted in. Anywhere the app stored its own copy of that unit, it is rewritten
 * to match. ERP-owned BOQ lines are REPORTED but never rewritten by default —
 * changing a signed BOQ document is a business decision, not a data fix.
 *
 * Touches (app-owned):
 *   - odg_request.items[].unit          (ໃບຂໍເບີກ v2)
 *   - odg_requests_detail.unit_code     (ໃບຂໍເບີກ legacy)
 *   - odg_purchase_request.unit         (ຂໍຊື້)
 *
 * Reports (ERP-owned, rewrite only with --include-boq):
 *   - odg_projects_boq_detail.unit_code (BOQ lines)
 *
 * Run:  node --env-file=.env scripts/backfill-units-from-sml.mjs --dry
 *       node --env-file=.env scripts/backfill-units-from-sml.mjs
 *       node --env-file=.env scripts/backfill-units-from-sml.mjs --include-boq
 */
import { Pool } from "pg";

const DRY = process.argv.includes("--dry");
const INCLUDE_BOQ = process.argv.includes("--include-boq");

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: "-c search_path=pm,public",
});

const clean = (v) => String(v ?? "").trim();
/** Same normalisation the app uses when comparing units. */
const key = (v) => clean(v).toLowerCase().replace(/[\s.]+/g, "");

async function main() {
  console.log(DRY ? "— DRY RUN (no writes) —" : "— WRITING —");

  const master = new Map();
  const inv = await pool.query(
    `SELECT trim(code) AS code, NULLIF(trim(COALESCE(unit_standard, '')), '') AS unit
       FROM ic_inventory
      WHERE NULLIF(trim(COALESCE(unit_standard, '')), '') IS NOT NULL`,
  );
  for (const r of inv.rows) master.set(clean(r.code), clean(r.unit));
  console.log(`ic_inventory: ${master.size} items with a master unit`);

  let fixed = 0;
  let skipped = 0;

  // ── 1. v2 requests: unit lives inside the items jsonb ──────────────────────
  const reqs = await pool.query(`SELECT id, request_no, items FROM odg_request`);
  for (const row of reqs.rows) {
    const items = Array.isArray(row.items) ? row.items : [];
    let changed = false;
    const next = items.map((it) => {
      const code = clean(it.item_code);
      const want = master.get(code);
      if (!code || !want) {
        if (code && !want) skipped++;
        return it;
      }
      if (key(it.unit) === key(want)) return it;
      console.log(`  ${row.request_no} ${code}: "${clean(it.unit) || "(ວ່າງ)"}" → "${want}"`);
      changed = true;
      return { ...it, unit: want };
    });
    if (!changed) continue;
    fixed++;
    if (!DRY) {
      await pool.query(`UPDATE odg_request SET items = $2::jsonb, updated_at = now() WHERE id = $1`, [
        row.id,
        JSON.stringify(next),
      ]);
    }
  }
  console.log(`odg_request: ${fixed} document(s) with corrected units`);

  // ── 2. legacy request lines ────────────────────────────────────────────────
  const legacy = await pool.query(
    `SELECT d.id, d.doc_no, trim(d.item_code) AS item_code, d.unit_code
       FROM odg_requests_detail d
      WHERE trim(COALESCE(d.item_code, '')) <> ''`,
  );
  let legacyFixed = 0;
  for (const r of legacy.rows) {
    const want = master.get(clean(r.item_code));
    if (!want || key(r.unit_code) === key(want)) continue;
    legacyFixed++;
    console.log(`  ${r.doc_no} ${r.item_code}: "${clean(r.unit_code) || "(ວ່າງ)"}" → "${want}"`);
    if (!DRY) await pool.query(`UPDATE odg_requests_detail SET unit_code = $2 WHERE id = $1`, [r.id, want]);
  }
  console.log(`odg_requests_detail: ${legacyFixed} line(s) corrected`);

  // ── 3. purchase lines ──────────────────────────────────────────────────────
  let poFixed = 0;
  try {
    const po = await pool.query(`SELECT id, pr_no, trim(item_code) AS item_code, unit FROM odg_purchase_request`);
    for (const r of po.rows) {
      const want = master.get(clean(r.item_code));
      if (!want || key(r.unit) === key(want)) continue;
      poFixed++;
      console.log(`  ${r.pr_no} ${r.item_code}: "${clean(r.unit) || "(ວ່າງ)"}" → "${want}"`);
      if (!DRY) await pool.query(`UPDATE odg_purchase_request SET unit = $2, updated_at = now() WHERE id = $1`, [r.id, want]);
    }
    console.log(`odg_purchase_request: ${poFixed} line(s) corrected`);
  } catch {
    console.log("odg_purchase_request: table not present yet — skipped");
  }

  // ── 4. BOQ lines — report, and rewrite only when explicitly asked ──────────
  const boq = await pool.query(
    `SELECT d.doc_no, trim(d.item_code) AS item_code, d.unit_code, SUM(d.qty)::numeric AS qty
       FROM odg_projects_boq_detail d
      WHERE trim(COALESCE(d.item_code, '')) <> ''
      GROUP BY d.doc_no, trim(d.item_code), d.unit_code`,
  );
  const boqMismatch = boq.rows.filter((r) => {
    const want = master.get(clean(r.item_code));
    return want && key(r.unit_code) !== key(want);
  });
  console.log(`\nodg_projects_boq_detail: ${boqMismatch.length} line(s) disagree with the master unit`);
  for (const r of boqMismatch.slice(0, 40)) {
    console.log(`  ${r.doc_no} ${r.item_code}: BOQ "${clean(r.unit_code) || "(ວ່າງ)"}" vs SML "${master.get(clean(r.item_code))}" (qty ${r.qty})`);
  }
  if (boqMismatch.length > 40) console.log(`  … +${boqMismatch.length - 40} more`);

  if (INCLUDE_BOQ && boqMismatch.length) {
    if (DRY) {
      console.log("--include-boq given, but this is a dry run — BOQ lines left untouched");
    } else {
      for (const r of boqMismatch) {
        await pool.query(
          `UPDATE odg_projects_boq_detail SET unit_code = $3 WHERE doc_no = $1 AND trim(item_code) = $2`,
          [r.doc_no, clean(r.item_code), master.get(clean(r.item_code))],
        );
      }
      console.log(`odg_projects_boq_detail: ${boqMismatch.length} line(s) rewritten to the master unit`);
    }
  } else if (boqMismatch.length) {
    console.log("(BOQ lines left as they are — re-run with --include-boq to rewrite them)");
  }

  if (skipped) console.log(`\n${skipped} request line(s) reference an item with no master unit in ic_inventory`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
