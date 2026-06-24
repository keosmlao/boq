/**
 * App-owned tables MOVED from `public.*` into the `pm.*` schema.
 *
 * These were originally grouped under app/_db/erp as "external ERP" tables, but
 * they belong to THIS project-manager app — the external ERP no longer uses
 * them. Migration drizzle/manual/0006_move_legacy_to_pm.sql moves them with
 * `ALTER TABLE ... SET SCHEMA pm` (data preserved). Their table names are kept.
 *
 * Only the columns the app actually reads/writes are declared (inferred from the
 * legacy SQL). `SELECT *` usages may surface more columns at runtime.
 *
 * Kept OUTSIDE app/_db/schema (the drizzle-kit glob) on purpose: these tables
 * already exist after the SET SCHEMA migration, so drizzle-kit must NOT try to
 * re-CREATE them. The schema barrel re-exports this file for typed ORM access.
 */
import { integer, text, date } from "drizzle-orm/pg-core";

import { pm } from "./schema/_pm";

/* ── Auth: login user store (app-owned) ──────────────────────────────────── */
export const odgUser = pm.table("odg_project_manager_user", {
  username: text("username").primaryKey(),
  password: text("password"),
  role: text("role"), // comma-separated role list
  name1: text("name_1"),
});

/* ── Project taxonomy lookups ────────────────────────────────────────────── */
export const odgBusinessType = pm.table("odg_project_business_type", {
  roworder: integer("roworder"),
  code: text("code"),
  name1: text("name_1"),
});
export const odgBusinessModel = pm.table("odg_project_business_model", {
  roworder: integer("roworder"),
  code: text("code"),
  name1: text("name_1"),
  businessTypeId: text("business_type_id"),
});
export const odgProjectType = pm.table("odg_project_type", {
  roworder: integer("roworder"),
  code: text("code"),
  name1: text("name_1"),
  businessTypeId: text("business_type_id"),
  businessModelId: text("business_model_id"),
});
export const odgTaskMaster = pm.table("odg_task_master", {
  id: integer("id").primaryKey(),
  code: text("code"),
  phase: text("phase"),
  task: text("task"),
  owner: text("owner"),
  status: text("status"),
});

/* ── Warehouse-side withdrawal info (read by the request flow) ────────────── */
export const odgWithdrawInfo = pm.table("odg_withdraw_info", {
  docNo: text("doc_no"),
  docDate: date("doc_date"),
  createuser: text("createuser"),
  whName: text("wh_name"),
  shelfName: text("shelf_name"),
});
