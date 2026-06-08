/**
 * Work-order, scheduling & technician domain — clean rebuild of
 * public.odg_work_orders (+ tasks/logs/materials/checkins),
 * public.odg_work_schedule and public.odg_technicians.
 *
 * `work_order_materials` and `work_order_checkins` are written by the
 * technician mobile app (not this codebase). We model them so the web app can
 * read/cascade them, but their write contract belongs to the mobile client —
 * keep their column shape stable. (See SCHEMA_DESIGN.md.)
 */
import {
  bigserial,
  bigint,
  integer,
  text,
  numeric,
  date,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { pm, technicianRole, workOrderStatus, workOrderPriority } from "./_pm";
import { projects } from "./projects";
import { contracts } from "./contracts";
import { boqDocs } from "./boq";

export const technicians = pm.table(
  "technicians",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    code: text("code"),
    name: text("name").notNull(),
    phone: text("phone"),
    role: technicianRole("role").notNull().default("technician"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("technicians_code_idx").on(t.code)],
);

export const workOrders = pm.table(
  "work_orders",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    code: text("code").notNull().unique(), // WO-YYYYMMDD-XXXXXX

    projectId: bigint("project_id", { mode: "number" }).references(() => projects.id, {
      onDelete: "set null",
    }),
    /** Source contract the work order is issued under. */
    contractId: bigint("contract_id", { mode: "number" }).references(() => contracts.id, {
      onDelete: "set null",
    }),
    contractNo: text("contract_no"),
    /** Source BOQ whose lines are pulled into this work order. */
    boqId: bigint("boq_id", { mode: "number" }).references(() => boqDocs.id, {
      onDelete: "set null",
    }),

    taskId: integer("task_id"), // -> erp odg_task_master.id (external)
    taskName: text("task_name"),
    title: text("title"),
    description: text("description"),

    technicianId: bigint("technician_id", { mode: "number" }).references(
      () => technicians.id,
      { onDelete: "set null" },
    ),
    helperIds: jsonb("helper_ids").notNull().default("[]"),

    status: workOrderStatus("status").notNull().default("assigned"),
    priority: workOrderPriority("priority").notNull().default("normal"),
    createdBy: text("created_by"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("work_orders_project_idx").on(t.projectId),
    index("work_orders_status_idx").on(t.status),
  ],
);

export const workOrderTasks = pm.table(
  "work_order_tasks",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    workOrderId: bigint("work_order_id", { mode: "number" })
      .notNull()
      .references(() => workOrders.id, { onDelete: "cascade" }),
    taskId: integer("task_id"),
    taskName: text("task_name"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("work_order_tasks_wo_idx").on(t.workOrderId)],
);

/** Planned material lines pulled from the BOQ into the work order. */
export const workOrderItems = pm.table(
  "work_order_items",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    workOrderId: bigint("work_order_id", { mode: "number" })
      .notNull()
      .references(() => workOrders.id, { onDelete: "cascade" }),
    /** Source BOQ line (pm.boq_lines.id), if pulled from a BOQ. */
    boqLineId: bigint("boq_line_id", { mode: "number" }),
    itemCode: text("item_code"),
    itemName: text("item_name"),
    unitCode: text("unit_code"),
    qty: numeric("qty", { precision: 18, scale: 4 }).notNull().default("0"),
  },
  (t) => [index("work_order_items_wo_idx").on(t.workOrderId)],
);

export const workOrderLogs = pm.table(
  "work_order_logs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    workOrderId: bigint("work_order_id", { mode: "number" })
      .notNull()
      .references(() => workOrders.id, { onDelete: "cascade" }),
    status: text("status"),
    note: text("note"),
    actor: text("actor"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("work_order_logs_wo_idx").on(t.workOrderId)],
);

/** Written by the technician mobile app — keep column shape stable. */
export const workOrderCheckins = pm.table(
  "work_order_checkins",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    workOrderId: bigint("work_order_id", { mode: "number" })
      .notNull()
      .references(() => workOrders.id, { onDelete: "cascade" }),
    actor: text("actor"),
    lat: numeric("lat", { precision: 10, scale: 6 }),
    lng: numeric("lng", { precision: 10, scale: 6 }),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("work_order_checkins_wo_idx").on(t.workOrderId)],
);

/** Written by the technician mobile app — keep column shape stable. */
export const workOrderMaterials = pm.table(
  "work_order_materials",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    workOrderId: bigint("work_order_id", { mode: "number" })
      .notNull()
      .references(() => workOrders.id, { onDelete: "cascade" }),
    itemCode: text("item_code"),
    itemName: text("item_name"),
    unitCode: text("unit_code"),
    qty: numeric("qty", { precision: 18, scale: 4 }).notNull().default("0"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("work_order_materials_wo_idx").on(t.workOrderId)],
);

/** Gantt-style schedule rows per project/contract (was odg_work_schedule). */
export const workSchedule = pm.table(
  "work_schedule",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    projectId: bigint("project_id", { mode: "number" }).references(() => projects.id, {
      onDelete: "cascade",
    }),
    contractId: bigint("contract_id", { mode: "number" }).references(() => contracts.id, {
      onDelete: "cascade",
    }),
    projectCode: text("project_code"),
    contractNo: text("contract_no"),
    phase: text("phase"),
    task: text("task"),
    owner: text("owner"),
    startDate: date("start_date"),
    endDate: date("end_date"),
    progress: integer("progress").notNull().default(0),
    status: text("status"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("work_schedule_project_idx").on(t.projectId)],
);
