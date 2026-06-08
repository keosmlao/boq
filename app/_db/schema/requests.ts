/**
 * Material request / withdrawal domain (ໃບຂໍເບີກ) — clean rebuild of
 * public.odg_requests + public.odg_requests_detail.
 *
 * NOTE: at runtime the app also mirrors each request into the ERP-owned
 * ic_trans / ic_trans_detail tables (trans_type=3, trans_flag=122). That ERP
 * write contract is unchanged and lives in the action layer, not here.
 */
import {
  bigserial,
  bigint,
  integer,
  text,
  numeric,
  date,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { pm } from "./_pm";
import { projects } from "./projects";
import { boqDocs } from "./boq";
import { workOrders } from "./work-orders";

export const materialRequests = pm.table(
  "material_requests",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    docNo: text("doc_no").notNull().unique(), // REQ-YYMMDD-NNNN
    docDate: date("doc_date").notNull().defaultNow(),

    /** Source BOQ (legacy doc_ref). A request is raised from a BOQ ... */
    boqId: bigint("boq_id", { mode: "number" }).references(() => boqDocs.id, {
      onDelete: "set null",
    }),
    boqDocNo: text("boq_doc_no"), // denormalised BOQ doc_no for the ERP mirror
    /** ... or from a work order's needs (ຕາມຄວາມຕ້ອງການຂອງໃບງານ). */
    workOrderId: bigint("work_order_id", { mode: "number" }).references(() => workOrders.id, {
      onDelete: "set null",
    }),

    projectId: bigint("project_id", { mode: "number" }).references(() => projects.id, {
      onDelete: "set null",
    }),
    contractNo: text("contract_no"),
    customerCode: text("customer_code"),

    warehouseFrom: text("warehouse_from"),
    locationFrom: text("location_from"),
    creatorCode: text("creator_code"),
    requesterName: text("requester_name"),
    remark: text("remark"),

    /** Was doc_success (0=requested, 1=withdrawn). */
    fulfilled: boolean("fulfilled").notNull().default(false),
    withdrawDocNo: text("withdraw_doc_no"),
    withdrawDate: date("withdraw_date"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("material_requests_project_idx").on(t.projectId),
    index("material_requests_boq_idx").on(t.boqId),
    index("material_requests_fulfilled_idx").on(t.fulfilled),
  ],
);

export const materialRequestLines = pm.table(
  "material_request_lines",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    requestId: bigint("request_id", { mode: "number" })
      .notNull()
      .references(() => materialRequests.id, { onDelete: "cascade" }),
    lineNo: integer("line_no").notNull().default(1),
    itemCode: text("item_code"),
    itemName: text("item_name"),
    unitCode: text("unit_code"),
    qty: numeric("qty", { precision: 18, scale: 4 }).notNull().default("0"),
    remark: text("remark"),
  },
  (t) => [index("material_request_lines_request_idx").on(t.requestId)],
);
