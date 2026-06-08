/** Quotation domain (clean rebuild of public.odg_quotation + its JSONB items). */
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
import { pm, quotationStatus } from "./_pm";
import { projects } from "./projects";

export const quotations = pm.table(
  "quotations",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    legacyId: integer("legacy_id").unique(),

    quotationNo: text("quotation_no").notNull().unique(),
    projectId: bigint("project_id", { mode: "number" }).references(() => projects.id, {
      onDelete: "set null",
    }),

    customerName: text("customer_name"),
    customerAddress: text("customer_address"),
    customerPhone: text("customer_phone"),

    quotationDate: date("quotation_date"),
    validityDate: date("validity_date"),
    terms: text("terms"),
    notes: text("notes"),

    discount: numeric("discount", { precision: 18, scale: 2 }).notNull().default("0"),
    tax: numeric("tax", { precision: 18, scale: 2 }).notNull().default("0"),
    taxType: text("tax_type").notNull().default("0"),
    subtotal: numeric("subtotal", { precision: 18, scale: 2 }).notNull().default("0"),
    totalAmount: numeric("total_amount", { precision: 18, scale: 2 }).notNull().default("0"),

    status: quotationStatus("status").notNull().default("pending"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("quotations_project_idx").on(t.projectId),
    index("quotations_status_idx").on(t.status),
  ],
);

/** Quotation line items — normalised out of the legacy `items` JSONB column. */
export const quotationLines = pm.table(
  "quotation_lines",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    quotationId: bigint("quotation_id", { mode: "number" })
      .notNull()
      .references(() => quotations.id, { onDelete: "cascade" }),
    lineNo: integer("line_no").notNull().default(1),
    itemCode: text("item_code"),
    description: text("description"),
    unitCode: text("unit_code"),
    qty: numeric("qty", { precision: 18, scale: 4 }).notNull().default("0"),
    unitPrice: numeric("unit_price", { precision: 18, scale: 2 }).notNull().default("0"),
    amount: numeric("amount", { precision: 18, scale: 2 }).notNull().default("0"),
    remark: text("remark"),
  },
  (t) => [index("quotation_lines_quotation_idx").on(t.quotationId)],
);
