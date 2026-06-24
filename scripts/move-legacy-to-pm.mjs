/**
 * Move the 6 app-owned legacy tables from `public.*` into the `pm.*` schema.
 *
 * Run from a machine that can reach the DB (the same one that runs the app):
 *     npm run db:move-legacy
 *
 * SET SCHEMA preserves all data, indexes and constraints (no drop / no copy).
 * Idempotent: tables already in pm are skipped (IF EXISTS on public). Because
 * the pool uses search_path=pm,public, the app keeps working before AND after
 * this runs — no deploy cutover needed.
 *
 * Reverse: change SET SCHEMA pm -> SET SCHEMA public.
 */
import pg from "pg";

// All tables OWNED by the BOQ2026 app (referenced in app code). Moved into pm.
// EXCLUDES odg_employee — a shared HR master other systems own; the app only
// JOIN-reads it, so it stays in public (modelled read-only under app/_db/erp).
const TABLES = [
  // lookups / auth / reference
  "odg_project_manager_user",
  "odg_project_type",
  "odg_project_business_type",
  "odg_project_business_model",
  "odg_task_master",
  "odg_withdraw_info",
  // app-created (v2)
  "odg_activities",
  "odg_app_user",
  "odg_chat_messages",
  "odg_chat_read",
  "odg_notifications",
  "odg_record_activities",
  "odg_record_followers",
  "odg_device_token",
  "odg_craftsman_location",
  "odg_craftsman_presence",
  // project management domain
  "odg_projects",
  "odg_projects_boq",
  "odg_projects_boq_detail",
  "odg_projects_contract",
  "odg_projects_contract_detail",
  "odg_projects_item",
  "odg_project_task",
  "odg_project_pause",
  "odg_project_status_history",
  "odg_project_request_attachments",
  "odg_quotation",
  "odg_contract",
  "odg_request",
  "odg_requests",
  "odg_requests_detail",
  "odg_survey",
  "odg_technicians",
  "odg_std_install_task",
  "odg_wo_material_request",
  "odg_work_order",
  "odg_work_orders",
  "odg_work_order_checkins",
  "odg_work_order_logs",
  "odg_work_order_materials",
  "odg_work_order_tasks",
  "odg_work_schedule",
];

const pool = new pg.Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  connectionTimeoutMillis: 10_000,
});

async function schemaOf(name) {
  const { rows } = await pool.query(
    `SELECT table_schema FROM information_schema.tables
       WHERE table_name = $1 AND table_schema IN ('pm','public')`,
    [name],
  );
  return rows.map((r) => r.table_schema);
}

async function main() {
  console.log(`Connecting to ${process.env.DB_HOST}/${process.env.DB_NAME} ...`);
  await pool.query("SELECT 1");

  // The pm schema may not exist yet on this DB (the rebuild's 0000 migration
  // hasn't been applied here). Create it so the app-owned tables have a home.
  await pool.query("CREATE SCHEMA IF NOT EXISTS pm");
  console.log("  schema pm ready");

  for (const t of TABLES) {
    const before = await schemaOf(t);
    if (before.includes("pm")) {
      console.log(`  ✓ ${t} already in pm — skip`);
      continue;
    }
    if (!before.includes("public")) {
      console.log(`  ! ${t} not found in public or pm — skip`);
      continue;
    }
    await pool.query(`ALTER TABLE IF EXISTS public.${t} SET SCHEMA pm`);
    console.log(`  → moved public.${t}  ->  pm.${t}`);
  }

  console.log("Done. Verifying final placement:");
  for (const t of TABLES) console.log(`  ${t}: [${(await schemaOf(t)).join(", ") || "MISSING"}]`);

  await pool.end();
}

main().catch(async (e) => {
  console.error("Migration failed:", e.message);
  await pool.end().catch(() => {});
  process.exit(1);
});
