/** Project domain — the root entity everything else hangs off. */
import {
  bigserial,
  bigint,
  integer,
  text,
  date,
  timestamp,
  doublePrecision,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { pm, projectStatus, surveyStatus } from "./_pm";

export const projects = pm.table(
  "projects",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    /** Maps back to legacy public.odg_projects.id during migration. */
    legacyId: integer("legacy_id").unique(),

    name: text("name").notNull(),
    description: text("description"),
    /** Customer / ERP code (was sml_code); also used as work-order project_code. */
    smlCode: text("sml_code"),

    // Location — store ERP codes (resolve names via erp_* at read time).
    provinceCode: text("province_code"),
    districtCode: text("district_code"),
    villageCode: text("village_code"),

    coordinator: text("coordinator"),
    phone: text("phone"),
    imageUrl: text("image_url"),

    /** -> biotime_employee.code */
    saleCode: text("sale_code"),

    // Taxonomy — ERP lookup codes.
    projectTypeCode: text("project_type_code"),
    businessTypeCode: text("business_type_code"),
    businessModelCode: text("business_model_code"),

    // Geo, normalised out of the legacy "lat,lng" strings.
    officeLat: doublePrecision("office_lat"),
    officeLng: doublePrecision("office_lng"),
    projectLat: doublePrecision("project_lat"),
    projectLng: doublePrecision("project_lng"),

    status: projectStatus("status").notNull().default("pending"),

    registeredOn: date("registered_on"),
    closedOn: date("closed_on"),
    closedBy: text("closed_by"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("projects_status_idx").on(t.status),
    index("projects_sale_code_idx").on(t.saleCode),
    index("projects_sml_code_idx").on(t.smlCode),
  ],
);

/** Append-only audit log of status / field changes across the project lifecycle. */
export const projectStatusHistory = pm.table(
  "project_status_history",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    /** Plain ref (no FK) so the audit trail survives project deletion. */
    projectId: bigint("project_id", { mode: "number" }).notNull(),
    contractNo: text("contract_no"),
    entityType: text("entity_type").notNull(), // 'project' | 'contract' | ...
    fieldName: text("field_name").notNull(),
    actionName: text("action_name").notNull(),
    oldValue: text("old_value"),
    newValue: text("new_value"),
    changedBy: text("changed_by"),
    note: text("note"),
    extraPayload: jsonb("extra_payload"),
    changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("psh_project_idx").on(t.projectId, t.changedAt),
    index("psh_contract_idx").on(t.contractNo, t.changedAt),
  ],
);

/**
 * Site survey — stage 2 of the pipeline (ສຳຫຼວດ), between project registration
 * and quotation. Captures the visit, who did it, findings and structured data
 * (measurements/photos refs) that feed the quotation.
 */
export const surveys = pm.table(
  "surveys",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    projectId: bigint("project_id", { mode: "number" })
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    status: surveyStatus("status").notNull().default("pending"),
    surveyor: text("surveyor"),
    scheduledDate: date("scheduled_date"),
    completedDate: date("completed_date"),
    findings: text("findings"),
    /** Structured survey data: measurements, room counts, photo refs, etc. */
    data: jsonb("data"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("surveys_project_idx").on(t.projectId)],
);

/** Files attached to a project / contract request. */
export const projectAttachments = pm.table(
  "project_attachments",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    projectId: bigint("project_id", { mode: "number" })
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    contractNo: text("contract_no"),
    fileName: text("file_name").notNull(),
    filePath: text("file_path").notNull(),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("project_attachments_project_idx").on(t.projectId)],
);
