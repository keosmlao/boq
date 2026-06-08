/**
 * BOQ (Bill of Quantities) domain — clean rebuild of
 * public.odg_projects_boq + public.odg_projects_boq_detail.
 *
 * `docNo` (BOQ-YYYYMM-NNNN) stays the human/business key, but rows now link by
 * real FKs (projectId, contractId) instead of fragile ::int casts on text
 * columns — the exact class of bug that produced the "0/0" contract list.
 */
import {
  bigserial,
  bigint,
  integer,
  text,
  numeric,
  date,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { pm, approvalStatus } from "./_pm";
import { projects } from "./projects";
import { contracts } from "./contracts";

export const boqDocs = pm.table(
  "boq_docs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    docNo: text("doc_no").notNull().unique(),
    docDate: date("doc_date").notNull().defaultNow(),

    projectId: bigint("project_id", { mode: "number" })
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    contractId: bigint("contract_id", { mode: "number" })
      .notNull()
      .references(() => contracts.id, { onDelete: "cascade" }),

    customerCode: text("customer_code"),
    createdBy: text("created_by"),

    status: approvalStatus("status").notNull().default("pending"),
    approver: text("approver"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("boq_docs_project_idx").on(t.projectId),
    index("boq_docs_contract_idx").on(t.contractId),
    index("boq_docs_status_idx").on(t.status),
  ],
);

export const boqLines = pm.table(
  "boq_lines",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    boqId: bigint("boq_id", { mode: "number" })
      .notNull()
      .references(() => boqDocs.id, { onDelete: "cascade" }),
    lineNo: integer("line_no").notNull().default(1),
    /** ERP inventory code (ic_inventory.code) — not FK'd (external table). */
    itemCode: text("item_code").notNull(),
    itemName: text("item_name"),
    unitCode: text("unit_code"),
    qty: numeric("qty", { precision: 18, scale: 4 }).notNull().default("0"),
  },
  (t) => [index("boq_lines_boq_idx").on(t.boqId)],
);
