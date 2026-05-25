#!/usr/bin/env node
/**
 * Backfill missing ic_trans / ic_trans_detail rows for material requests that
 * were saved into odg_requests BEFORE the sync was added (commit 46b608b on
 * 2026-05-19). Uses the same trans_type / trans_flag as syncRequestToIcTrans
 * in app/_actions/requests.ts.
 *
 * Idempotent — skips any odg_requests row that already has a matching
 * ic_trans entry. Safe to re-run.
 *
 * Usage:
 *   node scripts/backfill-ic-trans.mjs            # dry run (default)
 *   node scripts/backfill-ic-trans.mjs --apply    # actually insert
 */
import { readFileSync } from "node:fs";
import { Client } from "pg";

const env = {};
const raw = readFileSync(new URL("../.env", import.meta.url), "utf8");
for (const line of raw.split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const APPLY = process.argv.includes("--apply");
const TRANS_TYPE = 3;
const TRANS_FLAG = 122;

const client = new Client({
  host: env.DB_HOST,
  port: Number(env.DB_PORT || 5432),
  database: env.DB_NAME,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
});

await client.connect();
console.log(`Mode: ${APPLY ? "APPLY (will INSERT)" : "DRY RUN (use --apply to commit)"}\n`);

// Find odg_requests rows missing their ic_trans counterpart.
const missing = await client.query(
  `SELECT r.doc_no, r.doc_date, r.doc_ref, r.cust_code,
          r.wh_from, r.location_from, r.creator_code, r.requester_name, r.remark
     FROM odg_requests r
     LEFT JOIN ic_trans ic
       ON ic.doc_no = r.doc_no
      AND ic.trans_type = $1
      AND ic.trans_flag = $2
    WHERE ic.doc_no IS NULL
    ORDER BY r.doc_date ASC, r.doc_no ASC`,
  [TRANS_TYPE, TRANS_FLAG],
);

console.log(`Found ${missing.rows.length} odg_requests row(s) without ic_trans:\n`);
for (const row of missing.rows) {
  console.log(`  ${row.doc_no.padEnd(22)}  doc_date=${row.doc_date.toISOString().slice(0,10)}`);
}

if (!APPLY) {
  console.log(`\nNo changes made. Re-run with --apply to backfill.`);
  await client.end();
  process.exit(0);
}

let okCount = 0;
let failCount = 0;
for (const r of missing.rows) {
  const docDateStr = r.doc_date.toISOString().slice(0, 10);
  try {
    await client.query("BEGIN");

    await client.query(
      `INSERT INTO ic_trans (
        trans_type, trans_flag, doc_date, doc_no, doc_ref,
        cust_code, wh_from, location_from,
        creator_code, user_request, remark, doc_success
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9,$10,0)`,
      [
        TRANS_TYPE, TRANS_FLAG, docDateStr, r.doc_no,
        r.doc_ref || "",
        r.cust_code || "", r.wh_from || "", r.location_from || "",
        r.creator_code || "",
        r.remark || "",
      ],
    );

    // Pull items
    const detail = await client.query(
      `SELECT line_no, item_code, item_name, unit_code, qty, remark
         FROM odg_requests_detail WHERE doc_no = $1 ORDER BY line_no, id`,
      [r.doc_no],
    );

    let line = 1;
    for (const it of detail.rows) {
      if (!(Number(it.qty) > 0)) continue;
      await client.query(
        `INSERT INTO ic_trans_detail (
          trans_type, trans_flag, doc_date, doc_no, doc_ref, cust_code,
          item_code, item_name, unit_code, qty,
          wh_code, shelf_code, line_number, remark
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [
          TRANS_TYPE, TRANS_FLAG, docDateStr, r.doc_no,
          r.doc_ref || "", r.cust_code || "",
          it.item_code || "", it.item_name || "", it.unit_code || "",
          Number(it.qty) || 0,
          r.wh_from || "", r.location_from || "",
          line, it.remark || "",
        ],
      );
      line++;
    }

    await client.query("COMMIT");
    okCount++;
    console.log(`  ✓ ${r.doc_no} — ${detail.rows.length} item(s)`);
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    failCount++;
    console.log(`  ✗ ${r.doc_no} — ${e.message}`);
  }
}

console.log(`\nDone: ${okCount} succeeded, ${failCount} failed.`);
await client.end();
