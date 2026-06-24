/**
 * Contract domain — the consolidation that kills the "two parallel contract
 * systems" mess. Legacy had BOTH:
 *   - public.odg_projects_contract (ERP-style, PK roworder, drives BOQ)
 *   - public.odg_contract          (newer quotation->contract, PK id, JSONB items)
 * They were never joined. Here they become ONE `pm.contracts` table, with
 * `legacyRoworder` / `legacyContractId` to trace both sources during migration.
 *
 * Approvals are modelled as explicit boolean + who + when, replacing the
 * legacy soup of approve_status_1 / approve_status_2 / acc_approve ints.
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
import { pm, contractStatus } from "./_pm";
import { projects } from "./projects";
import { quotations } from "./quotations";

export const contracts = pm.table(
  "contracts",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    /** From legacy public.odg_projects_contract.roworder. */
    legacyRoworder: integer("legacy_roworder").unique(),
    /** From legacy public.odg_contract.id (the newer table), if migrated. */
    legacyContractId: integer("legacy_contract_id").unique(),

    contractNo: text("contract_no").notNull().unique(),
    name: text("name"),

    projectId: bigint("project_id", { mode: "number" })
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    quotationId: bigint("quotation_id", { mode: "number" }).references(
      () => quotations.id,
      { onDelete: "set null" },
    ),

    // Customer snapshot.
    customerCode: text("customer_code"), // was cust_code
    customerName: text("customer_name"),
    customerAddress: text("customer_address"),
    customerPhone: text("customer_phone"),

    currencyCode: text("currency_code").notNull().default("THB"),
    amount: numeric("amount", { precision: 18, scale: 2 }).notNull().default("0"),
    paymentType: text("payment_type"),
    brand: text("brand"),

    signDate: date("sign_date"),
    startDate: date("start_date"),
    endDate: date("end_date"),

    // Approvals — explicit, replacing approve_status_1/2 + acc_approve.
    salesApproved: boolean("sales_approved").notNull().default(false),
    salesApprover: text("sales_approver"),
    salesApprovedAt: timestamp("sales_approved_at", { withTimezone: true }),
    accountingApproved: boolean("accounting_approved").notNull().default(false),
    accountingApprover: text("accounting_approver"),
    accountingApprovedAt: timestamp("accounting_approved_at", { withTimezone: true }),

    status: contractStatus("status").notNull().default("draft"),
    notes: text("notes"),
    pdfUrl: text("pdf_url"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("contracts_project_idx").on(t.projectId),
    index("contracts_status_idx").on(t.status),
  ],
);

/**
 * Payment installments per contract (clean rebuild of public.odg_projects_item,
 * whose amounts lived in a JSONB `items` array — now normalised to lines).
 */
export const installments = pm.table(
  "installments",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    contractId: bigint("contract_id", { mode: "number" })
      .notNull()
      .references(() => contracts.id, { onDelete: "cascade" }),
    installmentNo: integer("installment_no").notNull(),
    totalAmount: numeric("total_amount", { precision: 18, scale: 2 }).notNull().default("0"),
    dueDate: date("due_date"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("installments_contract_idx").on(t.contractId)],
);

export const installmentLines = pm.table(
  "installment_lines",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    installmentId: bigint("installment_id", { mode: "number" })
      .notNull()
      .references(() => installments.id, { onDelete: "cascade" }),
    lineNo: integer("line_no").notNull().default(1),
    description: text("description"),
    amount: numeric("amount", { precision: 18, scale: 2 }).notNull().default("0"),
  },
  (t) => [index("installment_lines_installment_idx").on(t.installmentId)],
);
