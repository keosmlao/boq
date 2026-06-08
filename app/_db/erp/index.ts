/**
 * READ-ONLY models for tables this app does NOT own.
 *
 * These live in the default `public` schema and are managed by the external
 * ERP / other systems. They are deliberately kept OUT of app/_db/schema so
 * drizzle-kit (schemaFilter: ["pm"]) never generates DDL against them.
 *
 * Use them only for typed SELECT/JOIN. The ONE exception is the ic_trans /
 * ic_trans_detail mirror, which the request action writes as an ERP sync
 * (trans_type=3, trans_flag=122) — that write stays in the action layer.
 *
 * Only the columns the app actually reads are declared (inferred from legacy
 * SQL). `SELECT *` usages may surface more columns at runtime.
 */
import { pgTable, integer, text, numeric, date, timestamp } from "drizzle-orm/pg-core";

/* ── Auth: login user store (read-only here; provisioned elsewhere) ───────── */
export const odgUser = pgTable("odg_project_manager_user", {
  username: text("username").primaryKey(),
  password: text("password"),
  role: text("role"), // comma-separated role list
  name1: text("name_1"),
});

/* ── Lao geo lookups ─────────────────────────────────────────────────────── */
export const erpProvince = pgTable("erp_province", {
  code: text("code").primaryKey(),
  name1: text("name_1"),
});
export const erpAmper = pgTable("erp_amper", {
  code: text("code"),
  province: text("province"),
  name1: text("name_1"),
});
export const erpTambon = pgTable("erp_tambon", {
  code: text("code"),
  amper: text("amper"),
  province: text("province"),
  name1: text("name_1"),
});

/* ── HR / employees ──────────────────────────────────────────────────────── */
export const biotimeEmployee = pgTable("biotime_employee", {
  code: text("code").primaryKey(),
  name1: text("name_1"),
  status: integer("status"),
});

/* ── Project taxonomy lookups ────────────────────────────────────────────── */
export const odgBusinessType = pgTable("odg_project_business_type", {
  roworder: integer("roworder"),
  code: text("code"),
  name1: text("name_1"),
});
export const odgBusinessModel = pgTable("odg_project_business_model", {
  roworder: integer("roworder"),
  code: text("code"),
  name1: text("name_1"),
  businessTypeId: text("business_type_id"),
});
export const odgProjectType = pgTable("odg_project_type", {
  roworder: integer("roworder"),
  code: text("code"),
  name1: text("name_1"),
  businessTypeId: text("business_type_id"),
  businessModelId: text("business_model_id"),
});
export const odgTaskMaster = pgTable("odg_task_master", {
  id: integer("id").primaryKey(),
  code: text("code"),
  phase: text("phase"),
  task: text("task"),
  owner: text("owner"),
  status: text("status"),
});

/* ── Inventory / warehouse (ic_*) ────────────────────────────────────────── */
export const icInventory = pgTable("ic_inventory", {
  code: text("code").primaryKey(),
  name1: text("name_1"),
  unitCost: numeric("unit_cost"),
  salePrice: numeric("sale_price"),
});
export const icWarehouse = pgTable("ic_warehouse", {
  code: text("code").primaryKey(),
  name1: text("name_1"),
  name2: text("name_2"),
  branchCode: text("branch_code"),
  whManager: text("wh_manager"),
});
export const icShelf = pgTable("ic_shelf", {
  code: text("code"),
  name1: text("name_1"),
  name2: text("name_2"),
  whcode: text("whcode"),
  remark: text("remark"),
});
export const icWhShelf = pgTable("ic_wh_shelf", {
  whCode: text("wh_code"),
  shelfCode: text("shelf_code"),
});

/* ── Warehouse-side withdrawal info (populated by ERP; read-only) ─────────── */
export const odgWithdrawInfo = pgTable("odg_withdraw_info", {
  docNo: text("doc_no"),
  docDate: date("doc_date"),
  createuser: text("createuser"),
  whName: text("wh_name"),
  shelfName: text("shelf_name"),
});

/* ── ERP transaction mirror (request sync; app writes trans_type=3/flag=122) ─ */
export const icTrans = pgTable("ic_trans", {
  transType: integer("trans_type"),
  transFlag: integer("trans_flag"),
  docDate: date("doc_date"),
  docNo: text("doc_no"),
  docRef: text("doc_ref"),
  custCode: text("cust_code"),
  whFrom: text("wh_from"),
  locationFrom: text("location_from"),
  creatorCode: text("creator_code"),
  userRequest: text("user_request"),
  remark: text("remark"),
  docSuccess: integer("doc_success"),
});
export const icTransDetail = pgTable("ic_trans_detail", {
  transType: integer("trans_type"),
  transFlag: integer("trans_flag"),
  docDate: date("doc_date"),
  docNo: text("doc_no"),
  docRef: text("doc_ref"),
  custCode: text("cust_code"),
  itemCode: text("item_code"),
  itemName: text("item_name"),
  unitCode: text("unit_code"),
  qty: numeric("qty"),
  whCode: text("wh_code"),
  shelfCode: text("shelf_code"),
  lineNumber: integer("line_number"),
  remark: text("remark"),
});
