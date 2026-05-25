#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { Client } from "pg";

const env = {};
const raw = readFileSync(new URL("../.env", import.meta.url), "utf8");
for (const line of raw.split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const client = new Client({
  host: env.DB_HOST,
  port: Number(env.DB_PORT || 5432),
  database: env.DB_NAME,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
});
await client.connect();

// Latest odg_requests including time
const odg = await client.query(
  `SELECT doc_no, doc_date, created_at, updated_at
     FROM odg_requests
    ORDER BY created_at DESC NULLS LAST LIMIT 10`,
);
console.log("Latest odg_requests:");
for (const r of odg.rows) {
  console.log(`  ${r.doc_no.padEnd(22)} created_at=${r.created_at}`);
}

// Look for REQ-* in ic_trans (any time)
const icReq = await client.query(
  `SELECT doc_no, doc_date, create_date_time_now
     FROM ic_trans
    WHERE doc_no LIKE 'REQ-%' AND trans_type = 3 AND trans_flag = 122
    ORDER BY create_date_time_now DESC NULLS LAST LIMIT 5`,
);
console.log(`\nic_trans REQ-* rows (type=3 flag=122): ${icReq.rows.length}`);
for (const r of icReq.rows) {
  console.log(`  ${r.doc_no.padEnd(22)} create=${r.create_date_time_now}`);
}

await client.end();
