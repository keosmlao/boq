/**
 * Dedicated Postgres schema namespace for the rebuilt, app-owned domain.
 *
 * Everything the app fully owns lives under `pm.*` (new, clean tables).
 * Legacy `public.odg_*` tables and external ERP tables (`erp_*`, `ic_*`,
 * `biotime_*`, lookups) are left untouched in `public` and modelled
 * read-only under app/_db/erp. This separation makes the rebuild additive:
 * we create `pm.*`, migrate data into it, run both side-by-side, then cut over.
 *
 * drizzle.config.ts uses `schemaFilter: ["pm"]` so drizzle-kit can NEVER
 * generate destructive migrations against public/ERP tables.
 */
import { pgSchema } from "drizzle-orm/pg-core";

export const pm = pgSchema("pm");

/* ── Enums (English keys internally; Lao labels live in the UI layer) ────────
 *
 * project_status Lao label mapping (see SCHEMA_DESIGN.md):
 *   pending            -> ລໍຖ້າດຳເນີນ
 *   in_progress        -> ຂັ້ນຕອນດຳເນີນໂຄງການ
 *   ready_to_withdraw  -> ສາມາດເບີກຂອງໃດ້
 *   installing         -> ດຳເນີນການຕິດຕັ້ງ
 *   pending_close      -> ລໍຖ້າອະນຸມັດປິດໂຄງການ
 *   closed             -> ປິດໂຄງການ
 *   cancelled          -> ຍົກເລີກ
 */
export const projectStatus = pm.enum("project_status", [
  "pending",
  "in_progress",
  "ready_to_withdraw",
  "installing",
  "pending_close",
  "closed",
  "cancelled",
]);

export const contractStatus = pm.enum("contract_status", [
  "draft",
  "awaiting_sales",
  "awaiting_accounting",
  "active",
  "closed",
  "cancelled",
]);

export const quotationStatus = pm.enum("quotation_status", [
  "draft",
  "pending",
  "approved",
  "rejected",
  "expired",
]);

/** Shared approval lifecycle for BOQ docs. */
export const approvalStatus = pm.enum("approval_status", [
  "pending",
  "approved",
  "rejected",
]);

export const workOrderStatus = pm.enum("work_order_status", [
  "assigned",
  "in_progress",
  "paused",
  "done",
  "cancelled",
]);

export const workOrderPriority = pm.enum("work_order_priority", [
  "low",
  "normal",
  "high",
  "urgent",
]);

export const technicianRole = pm.enum("technician_role", [
  "technician",
  "assistant",
  "lead",
]);

/** Survey stage (between project registration and quotation). */
export const surveyStatus = pm.enum("survey_status", [
  "pending",
  "scheduled",
  "done",
  "cancelled",
]);
