"use server";

import { query } from "@/_lib/db";
import { logActivity } from "./chatter";
import { cached, invalidate } from "@/_lib/cache";
import { cleanText, isTruthyFlag } from "@/_lib/http";
import { requireManager, requirePermission } from "@/_lib/server-auth";
import {
  approveProjectRequest,
  createProject,
  createProjectRequest,
  deleteProjectCascade,
  deleteProjectContractCascade,
  getDashboardStats,
  getProjectById,
  getRevenueStats,
  listPendingProjectApprovals,
  listProjects,
  listProjectStatusHistory,
  updateProjectEdit,
  updateProjectLocations,
  updateProjectStage,
} from "@/_lib/projects";
import { saveWebFile } from "@/_lib/uploads";

// Short TTL — keeps rapid navigations snappy without making writes feel stale.
// Mutating actions below call `invalidate("projects:")` to drop these.
const LIST_TTL_MS = 10_000;

type Ok<T> = { success: true; data?: T; message?: string; id?: unknown };
type Fail = { success: false; message: string };
type Result<T = unknown> = Ok<T> | Fail;

function ok<T>(extra: Partial<Ok<T>> = {}): Ok<T> { return { success: true, ...extra }; }
function fail(message: string): Fail { return { success: false, message }; }

function f(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
}

export async function getProjects(opts: { summary?: boolean } = {}): Promise<Result<unknown[]>> {
  try {
    const summary = !!opts.summary;
    const data = await cached(
      `projects:list:${summary ? "summary" : "full"}`,
      LIST_TTL_MS,
      () => listProjects({ summary }),
    );
    return ok({ data });
  } catch (e) { return fail((e as Error).message); }
}

export async function createProjectAction(formData: FormData): Promise<Result> {
  try {
    const projectName = f(formData, "projectName");
    const province = f(formData, "province");
    const district = f(formData, "district");
    const village = f(formData, "village");
    const registrationDate = f(formData, "registrationDate");

    if (!projectName || !province || !district || !village || !registrationDate) {
      return fail("Missing required project fields");
    }

    const files = formData.getAll("imageFiles");
    const firstFile = files.find((file: unknown) => typeof (file as File)?.arrayBuffer === "function") as File | undefined;
    const imageUrl = firstFile ? await saveWebFile(firstFile, "static/uploads") : null;

    const projectId = await createProject({
      projectName,
      projectDescription: f(formData, "projectDescription"),
      province,
      district,
      village,
      coordinator: f(formData, "coordinator"),
      coordinatorPhone: f(formData, "coordinatorPhone"),
      registrationDate,
      saleStaffId: f(formData, "saleStaffId"),
      smlCode: f(formData, "smlCode"),
      officeCoord: f(formData, "officeCoord"),
      projectCoord: f(formData, "projectCoord"),
      projectType: f(formData, "projectType"),
      businessType: f(formData, "businessType"),
      businessModel: f(formData, "businessModel"),
      projectStatus: f(formData, "status"),
      imageUrl,
    });

    invalidate("projects:");
    await logActivity("project", String(projectId), "ລົງທະບຽນໂຄງການ", projectName);
    return ok({ message: "Created", id: projectId });
  } catch (e) { return fail((e as Error).message); }
}

export async function getProject(id: string, opts: { includeContracts?: boolean } = {}): Promise<Result<unknown>> {
  try {
    const clean = cleanText(id);
    const includeContracts = !!opts.includeContracts;
    const project = await cached(
      `projects:detail:${clean}:${includeContracts ? "with-contracts" : "plain"}`,
      LIST_TTL_MS,
      () => getProjectById(clean, { includeContracts }),
    );
    if (!project) return fail("Project not found");
    return ok({ data: project });
  } catch (e) { return fail((e as Error).message); }
}

/**
 * Lightweight project fetch — only the fields forms need (name + customer +
 * location), as a single-row select. Avoids the heavy contractlist / boq_list
 * json_agg joins in getProjectsBoq, which made the quotation/BOQ forms slow.
 */
export async function getProjectBasic(id: string): Promise<Result<unknown>> {
  try {
    const clean = cleanText(id);
    const data = await cached(`projects:basic:${clean}`, LIST_TTL_MS, async () => {
      const r = await query(
        `SELECT id, project_name, sml_code, coordinator, phone, province, district, village
           FROM odg_projects WHERE id = $1 LIMIT 1`,
        [clean],
      );
      return r.rows[0] || null;
    });
    if (!data) return fail("Project not found");
    return ok({ data });
  } catch (e) { return fail((e as Error).message); }
}

export async function updateProjectAction(id: string, payload: Record<string, unknown>): Promise<Result> {
  try {
    const updated = await updateProjectStage(cleanText(id), payload || {});
    if (!updated) return fail("No valid fields to update");
    invalidate("projects:");
    return ok({ message: "Updated" });
  } catch (e) { return fail((e as Error).message); }
}

/** v2 pipeline stages a document/approval can advance a project to, in order. */
const V2_STAGES = [
  "ລົງທະບຽນ",
  "ສຳຫຼວດ",
  "ສະເໜີລາຄາ",
  "ສັນຍາ",
  "BOQ",
  "ກຳນົດໜ້າວຽກ",
  "ໃບງານ",
];

/** Close-out statuses — written ONLY by the close actions below, never by advanceProjectStage. */
const PENDING_CLOSE_STATUS = "ລໍຖ້າອະນຸມັດປິດໂຄງການ";
const CLOSED_STATUS = "ປິດໂຄງການ";
const INSTALL_STATUS = "ດຳເນີນການຕິດຕັ້ງ";

/**
 * Rank of EVERY project_status the system writes, on one pipeline axis.
 * The ERP lifecycle labels (ສາມາດເບີກຂອງໃດ້, ດຳເນີນການຕິດຕັ້ງ …) are folded in so
 * a pipeline advance can never pull a project BACK to an earlier label than the
 * one ERP already gave it.
 */
const STAGE_RANK: Record<string, number> = {
  "ລໍຖ້າດຳເນີນ": 0,
  "ລົງທະບຽນ": 0,
  "ສຳຫຼວດ": 1,
  "ສະເໜີລາຄາ": 2,
  "ສັນຍາ": 3,
  "ຂັ້ນຕອນດຳເນີນໂຄງການ": 3,
  BOQ: 4,
  "ສາມາດເບີກຂອງໃດ້": 4,
  "ກຳນົດໜ້າວຽກ": 5,
  "ໃບງານ": 6,
  [INSTALL_STATUS]: 6,
  [PENDING_CLOSE_STATUS]: 7,
  [CLOSED_STATUS]: 8,
};

/** Statuses the pipeline must never overwrite (paused / closing / closed / cancelled). */
const FROZEN_STATUSES = new Set(["ພັກໂຄງການ", PENDING_CLOSE_STATUS, CLOSED_STATUS, "ຍົກເລີກ"]);

/** True when the row exists. A missing/legacy table means "cannot prove" → false. */
async function rowExists(sql: string, params: unknown[]): Promise<boolean> {
  try {
    const r = await query(sql, params);
    return r.rows.length > 0;
  } catch {
    return false;
  }
}

/**
 * Is `stage` actually REACHED by the real data? Stage advancement follows
 * APPROVAL, not creation — so a create form that calls advanceProjectStage
 * before the document is approved is a no-op until the approval lands.
 */
async function stageIsReal(pid: number, stage: string): Promise<boolean> {
  const id = String(pid);
  switch (stage) {
    case "ລົງທະບຽນ":
      return true;
    case "ສຳຫຼວດ":
      return rowExists(`SELECT 1 FROM odg_survey WHERE project_id::text = $1 LIMIT 1`, [id]);
    case "ສະເໜີລາຄາ":
      return rowExists(
        `SELECT 1 FROM odg_quotation WHERE project_id::text = $1 AND status = 'ອະນຸມັດແລ້ວ' LIMIT 1`,
        [id],
      );
    case "ສັນຍາ": {
      // Fully approved = sales AND accounting (v2 odg_contract or legacy ERP).
      const v2 = await rowExists(
        `SELECT 1 FROM odg_contract
          WHERE project_id::text = $1
            AND COALESCE(sales_approved, false)
            AND COALESCE(accounting_approved, false)
          LIMIT 1`,
        [id],
      );
      if (v2) return true;
      return rowExists(
        `SELECT 1 FROM odg_projects_contract
          WHERE project_id::text = $1
            AND COALESCE(approve_status_1, 0) = 1
            AND GREATEST(COALESCE(approve_status_2, 0), COALESCE(acc_approve, 0)) = 1
          LIMIT 1`,
        [id],
      );
    }
    case "BOQ":
      return rowExists(
        `SELECT 1 FROM odg_projects_boq WHERE project_id::text = $1 AND COALESCE(approve_status, 0) = 1 LIMIT 1`,
        [id],
      );
    case "ກຳນົດໜ້າວຽກ":
      return rowExists(`SELECT 1 FROM odg_project_task WHERE project_id::text = $1 LIMIT 1`, [id]);
    case "ໃບງານ":
      return rowExists(`SELECT 1 FROM odg_work_order WHERE project_id::text = $1 LIMIT 1`, [id]);
    default:
      return false;
  }
}

/**
 * Move a project's status FORWARD to `target`.
 *
 * Guarantees (safe to call twice, safe to call early):
 *  - monotonic  — never moves a project to a lower-ranked status;
 *  - idempotent — a second call for the same stage is a no-op;
 *  - honest     — only advances when the DATA already justifies the stage
 *                 (approved quotation / fully approved contract / approved BOQ /
 *                 real task rows / real work orders), so the create forms that
 *                 call this at CREATION time cannot push the project past reality;
 *  - never closes, never touches a paused/closing/closed/cancelled project.
 */
export async function advanceProjectStage(id: string, target: string): Promise<Result> {
  try {
    const stage = cleanText(target);
    if (!V2_STAGES.includes(stage)) return fail("Unknown stage");
    const pid = Number(cleanText(id));
    if (!pid) return fail("Invalid project id");
    const cur = await query(`SELECT project_status FROM odg_projects WHERE id = $1`, [pid]);
    if (!cur.rows.length) return fail("Project not found");
    const curStatus = cleanText(cur.rows[0]?.project_status);
    if (FROZEN_STATUSES.has(curStatus)) return ok({ message: "skipped" });

    const ti = STAGE_RANK[stage] ?? -1;
    const ci = STAGE_RANK[curStatus] ?? 0; // unknown label → treat as the very start
    if (ti <= ci) return ok({ message: "skipped" }); // already at/past this stage

    if (!(await stageIsReal(pid, stage))) return ok({ message: "not-reached" });

    // updateProjectStage also records odg_project_status_history (the timeline reads it).
    await updateProjectStage(String(pid), { project_status: stage });
    invalidate("projects:");
    await logActivity("project", String(pid), "ປ່ຽນຂັ້ນຕອນ", stage);
    return ok({ message: "advanced" });
  } catch (e) { return fail((e as Error).message); }
}

/* ── Close-out: ໃບງານປິດຄົບ → ຮ້ອງຂໍປິດ → ຜູ້ຈັດການອະນຸມັດ → ປິດໂຄງການ ────────── */

/** Work-order gate: every work order of the project must be closed. */
async function workOrderCloseGate(pid: number): Promise<{ total: number; closed: number }> {
  try {
    const r = await query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (
                WHERE closed_at IS NOT NULL
                   OR lower(COALESCE(status, '')) = 'closed'
                   OR COALESCE(status, '') = 'ປິດງານແລ້ວ'
              )::int AS closed
         FROM odg_work_order WHERE project_id::text = $1`,
      [String(pid)],
    );
    return { total: Number(r.rows[0]?.total || 0), closed: Number(r.rows[0]?.closed || 0) };
  } catch {
    return { total: 0, closed: 0 };
  }
}

async function projectStatusOf(pid: number): Promise<string | null> {
  const r = await query(`SELECT project_status FROM odg_projects WHERE id = $1`, [pid]);
  if (!r.rows.length) return null;
  return cleanText(r.rows[0]?.project_status);
}

/**
 * Request close-out (ລໍຖ້າອະນຸມັດປິດໂຄງການ) — the status the project lists already
 * read. Requires projects.edit and EVERY work order of the project closed.
 */
export async function requestProjectClose(id: string, note = ""): Promise<Result> {
  try {
    const u = await requirePermission("projects", "edit");
    const pid = Number(cleanText(id));
    if (!pid) return fail("Invalid project id");
    const status = await projectStatusOf(pid);
    if (status === null) return fail("Project not found");
    if (status === CLOSED_STATUS) return fail("ໂຄງການນີ້ປິດແລ້ວ");
    if (status === PENDING_CLOSE_STATUS) return fail("ມີຄຳຮ້ອງຂໍປິດໂຄງການທີ່ລໍຖ້າອະນຸມັດຢູ່ແລ້ວ");

    const gate = await workOrderCloseGate(pid);
    if (!gate.total) return fail("ຍັງບໍ່ມີໃບງານ — ປິດໂຄງການບໍ່ໄດ້");
    if (gate.closed < gate.total) {
      return fail(`ຍັງມີໃບງານທີ່ຍັງບໍ່ປິດ (${gate.closed}/${gate.total})`);
    }

    await updateProjectStage(String(pid), {
      project_status: PENDING_CLOSE_STATUS,
      username: u.name || u.username,
    });
    invalidate("projects:");
    await logActivity("project", String(pid), "ຮ້ອງຂໍປິດໂຄງການ", cleanText(note));
    return ok({ message: "Close requested" });
  } catch (e) { return fail((e as Error).message); }
}

/** Manager/admin approves the close-out → ປິດໂຄງການ (terminal). Re-checks the gate. */
export async function approveProjectClose(id: string): Promise<Result> {
  try {
    const u = await requireManager();
    const pid = Number(cleanText(id));
    if (!pid) return fail("Invalid project id");
    const status = await projectStatusOf(pid);
    if (status === null) return fail("Project not found");
    if (status === CLOSED_STATUS) return ok({ message: "already closed" });
    if (status !== PENDING_CLOSE_STATUS) return fail("ຍັງບໍ່ມີຄຳຮ້ອງຂໍປິດໂຄງການ");

    const gate = await workOrderCloseGate(pid);
    if (!gate.total || gate.closed < gate.total) {
      return fail(`ຍັງມີໃບງານທີ່ຍັງບໍ່ປິດ (${gate.closed}/${gate.total})`);
    }

    await updateProjectStage(String(pid), {
      project_status: CLOSED_STATUS,
      username: u.name || u.username,
    });
    invalidate("projects:");
    await logActivity("project", String(pid), "ອະນຸມັດປິດໂຄງການ");
    return ok({ message: "Closed" });
  } catch (e) { return fail((e as Error).message); }
}

/** Manager/admin rejects the close request → back to the status it had before. */
export async function rejectProjectClose(id: string, reason = ""): Promise<Result> {
  try {
    const u = await requireManager();
    const pid = Number(cleanText(id));
    if (!pid) return fail("Invalid project id");
    const status = await projectStatusOf(pid);
    if (status === null) return fail("Project not found");
    if (status !== PENDING_CLOSE_STATUS) return fail("ຍັງບໍ່ມີຄຳຮ້ອງຂໍປິດໂຄງການ");

    // Restore the status the close request replaced (from the status history).
    let previous = INSTALL_STATUS;
    try {
      const h = await query(
        `SELECT old_value FROM odg_project_status_history
          WHERE project_id = $1 AND field_name = 'project_status' AND new_value = $2
          ORDER BY changed_at DESC, id DESC LIMIT 1`,
        [String(pid), PENDING_CLOSE_STATUS],
      );
      const old = cleanText(h.rows[0]?.old_value);
      if (old && !FROZEN_STATUSES.has(old)) previous = old;
    } catch {
      /* no history — fall back to the installation status */
    }

    await updateProjectStage(String(pid), { project_status: previous, username: u.name || u.username });
    invalidate("projects:");
    await logActivity("project", String(pid), "ປະຕິເສດ ຄຳຮ້ອງຂໍປິດໂຄງການ", cleanText(reason));
    return ok({ message: "Close rejected" });
  } catch (e) { return fail((e as Error).message); }
}

export async function deleteProjectAction(id: string): Promise<Result> {
  try {
    await requirePermission("projects", "delete");
    await deleteProjectCascade(cleanText(id));
    await logActivity("project", cleanText(id), "ລຶບໂຄງການ");
    invalidate("projects:");
    return ok({ message: "Deleted" });
  } catch (e) { return fail((e as Error).message); }
}

export async function editProjectAction(id: string, formData: FormData): Promise<Result> {
  try {
    await requirePermission("projects", "edit");
    const projectId = cleanText(id);
    const projectName = f(formData, "projectName");
    const province = f(formData, "province");
    const district = f(formData, "district");
    const village = f(formData, "village");
    const registrationDate = f(formData, "registrationDate");

    if (!projectName || !province || !district || !village || !registrationDate) {
      return fail("Missing required project fields");
    }

    const files = formData.getAll("imageFiles");
    const firstFile = files.find((file: unknown) => typeof (file as File)?.arrayBuffer === "function") as File | undefined;
    const imageUrl = firstFile ? await saveWebFile(firstFile, "static/uploads") : null;

    await updateProjectEdit(projectId, {
      projectName,
      projectDescription: f(formData, "projectDescription"),
      province,
      district,
      village,
      coordinator: f(formData, "coordinator"),
      coordinatorPhone: f(formData, "coordinatorPhone"),
      registrationDate,
      saleStaffId: f(formData, "saleStaffId"),
      smlCode: f(formData, "smlCode"),
      officeCoord: f(formData, "officeCoord"),
      projectCoord: f(formData, "projectCoord"),
      projectType: f(formData, "projectType"),
      businessType: f(formData, "businessType"),
      businessModel: f(formData, "businessModel"),
      projectStatus: f(formData, "status"),
      username: f(formData, "username"),
      imageUrl,
    });

    await logActivity("project", projectId, "ແກ້ໄຂໂຄງການ", projectName);
    invalidate("projects:");
    return ok({ message: "Updated" });
  } catch (e) { return fail((e as Error).message); }
}

export async function approveProjectAction(id: string, payload: { username?: string; contract_no?: string }): Promise<Result> {
  try {
    const updated = await approveProjectRequest(cleanText(id), {
      username: payload?.username,
      contractNo: payload?.contract_no,
    });
    if (!updated) return fail("No pending contract found for this project");
    invalidate("projects:");
    await logActivity("project", cleanText(id), "ອະນຸມັດໂຄງການ");
    return ok({ message: "Approved" });
  } catch (e) { return fail((e as Error).message); }
}

export async function updateProjectLocationsAction(id: string, payload: Record<string, unknown>): Promise<Result> {
  try {
    await updateProjectLocations(cleanText(id), payload || {});
    invalidate("projects:");
    return ok({ message: "Locations updated" });
  } catch (e) { return fail((e as Error).message); }
}

export async function getProjectStatusHistory(id: string): Promise<Result<unknown[]>> {
  try {
    return ok({ data: await listProjectStatusHistory(cleanText(id)) });
  } catch (e) { return fail((e as Error).message); }
}

export async function deleteProjectContract(id: string, contractNo: string): Promise<Result> {
  try {
    await requirePermission("contracts", "delete");
    const result = await deleteProjectContractCascade(cleanText(id), cleanText(decodeURIComponent(contractNo)));
    if (!result) return fail("Contract not found");
    invalidate("projects:");
    return ok({ message: "Contract deleted", data: result });
  } catch (e) { return fail((e as Error).message); }
}

export async function getProjectInstallments(): Promise<Result<unknown[]>> {
  try {
    const data = await cached("projects:installments", LIST_TTL_MS, async () => {
      const result = await query(`
      SELECT
        p.id,
        p.project_name,
        p.sml_code,
        p.project_status,
        c.contract_no,
        c.contract_name,
        c.amount AS contract_amount,
        i.installment_no,
        i.total_amount
      FROM odg_projects p
      JOIN odg_projects_contract c ON c.project_id::text = p.id::text
      LEFT JOIN odg_projects_item i ON i.contract_no::text = c.contract_no::text
      ORDER BY p.id DESC, c.contract_no, i.installment_no
    `);
      return result.rows;
    });
    return ok({ data });
  } catch (e) { return fail((e as Error).message); }
}

export async function getProjectDashboardStats(): Promise<Result> {
  try {
    const stats = await cached(
      "projects:dashboard-stats",
      LIST_TTL_MS,
      () => getDashboardStats() as Promise<Record<string, unknown>>,
    );
    return { success: true, ...stats };
  } catch (e) { return fail((e as Error).message); }
}

export async function getProjectRevenueStats(): Promise<Result> {
  try {
    const stats = await cached(
      "projects:revenue-stats",
      LIST_TTL_MS,
      () => getRevenueStats() as Promise<Record<string, unknown>>,
    );
    return { success: true, ...stats };
  } catch (e) { return fail((e as Error).message); }
}

export async function getProjectsBoq(opts: { projectId?: string; summary?: boolean; contracts?: boolean } = {}): Promise<Result<unknown[]>> {
  try {
    const projectId = cleanText(opts.projectId);
    const summary = !!opts.summary;
    const contracts = !!opts.contracts;

    // Per-project detail is page-specific; the three list variants below all
    // hit large joined queries we want to dedupe across navigations.
    const cacheKey = projectId
      ? null
      : `projects:boq:${contracts ? "contracts" : summary ? "summary" : "all"}`;

    if (projectId) {
      const data = await cached(
        `projects:boq:detail:${projectId}`,
        LIST_TTL_MS,
        async () => {
          const result = await query(
            `
            WITH boq_by_contract AS (
              SELECT
                obq.contract_id,
                json_agg(
                  json_build_object(
                    'doc_no', obq.doc_no,
                    'doc_date', obq.doc_date,
                    'approve_status', obq.approve_status,
                    'user_created', COALESCE(euc.fullname_lo, obq.user_created),
                    'approver', COALESCE(eap.fullname_lo, obq.approver)
                  )
                  ORDER BY obq.doc_no DESC
                ) AS boq_list
              FROM odg_projects_boq obq
              LEFT JOIN odg_employee euc ON euc.employee_code = obq.user_created
              LEFT JOIN odg_employee eap ON eap.employee_code = obq.approver
              WHERE obq.contract_id IS NOT NULL
              GROUP BY obq.contract_id
            )
            SELECT
              p.*,
              pv.name_1 AS province_name,
              d.name_1 AS district_name,
              v.name_1 AS village_name,
              json_agg(
                json_build_object(
                  'contract_no', c.contract_no,
                  'contract_name', c.contract_name,
                  'amount', c.amount,
                  'contract_value', c.amount,
                  'project_id', c.project_id,
                  'cust_code', c.cust_code,
                  'roworder', c.roworder,
                  'contract_id', c.roworder,
                  'approve_status_1', c.approve_status_1,
                  'approve_status_2', c.approve_status_2,
                  'acc_approve', c.acc_approve,
                  'has_boq', b.contract_id IS NOT NULL,
                  'boq_status', CASE WHEN b.contract_id IS NOT NULL THEN 'done' ELSE 'pending' END,
                  'boq_list', COALESCE(b.boq_list, '[]'::json)
                )
                ORDER BY c.created_at DESC, c.roworder DESC
              ) FILTER (WHERE c.contract_no IS NOT NULL) AS contractlist
            FROM odg_projects p
            LEFT JOIN erp_province pv ON pv.code = p.province
            LEFT JOIN erp_amper d ON d.code = p.district AND d.province = p.province
            LEFT JOIN erp_tambon v ON v.code = p.village AND v.amper = p.district AND v.province = p.province
            LEFT JOIN odg_projects_contract c ON c.project_id::text = p.id::text
            LEFT JOIN boq_by_contract b ON b.contract_id = c.roworder
            WHERE p.id = $1
            GROUP BY p.id, pv.name_1, d.name_1, v.name_1
            `,
            [projectId],
          );
          return result.rows;
        },
      );
      return ok({ data });
    }

    if (contracts) {
      const data = await cached(cacheKey!, LIST_TTL_MS, async () => {
        const result = await query(`
          WITH boq_contracts AS (
            SELECT DISTINCT contract_id
            FROM odg_projects_boq
            WHERE contract_id IS NOT NULL
          )
          SELECT
            c.contract_no, c.contract_name, c.amount, c.amount AS contract_value,
            c.cust_code, c.roworder, c.roworder AS contract_id,
            c.approve_status_1, c.approve_status_2, c.acc_approve,
            c.created_at AS contract_created_at,
            (bc.contract_id IS NOT NULL) AS has_boq,
            CASE WHEN bc.contract_id IS NOT NULL THEN 'done' ELSE 'pending' END AS boq_status,
            p.id AS project_id, p.project_name, p.sml_code, p.project_status,
            p.coordinator, p.phone,
            pv.name_1 AS province_name, d.name_1 AS district_name, v.name_1 AS village_name
          FROM odg_projects_contract c
          INNER JOIN odg_projects p ON p.id::text = c.project_id::text
          LEFT JOIN erp_province pv ON pv.code = p.province
          LEFT JOIN erp_amper d ON d.code = p.district AND d.province = p.province
          LEFT JOIN erp_tambon v ON v.code = p.village AND v.amper = p.district AND v.province = p.province
          LEFT JOIN boq_contracts bc ON bc.contract_id = c.roworder
          -- Show every active project contract; the UI categorises them by
          -- approval + BOQ state (waiting_contract / waiting_boq / boq_done).
          -- Closed projects have their own list (getProjectsBoqClose), so the
          -- only status excluded here is the terminal "ປິດໂຄງການ".
          WHERE COALESCE(p.project_status, '') <> 'ປິດໂຄງການ'
          ORDER BY p.id DESC, c.created_at DESC, c.roworder DESC
        `);
        return result.rows;
      });
      return ok({ data });
    }

    if (summary) {
      const data = await cached(cacheKey!, LIST_TTL_MS, async () => {
        const result = await query(`
        WITH boq_contracts AS (
          SELECT DISTINCT contract_id
          FROM odg_projects_boq
          WHERE contract_id IS NOT NULL
        )
        SELECT
          p.id, p.project_name, p.sml_code, p.project_status, p.coordinator, p.phone,
          p.province, p.district, p.village,
          pv.name_1 AS province_name, d.name_1 AS district_name, v.name_1 AS village_name,
          COUNT(c.contract_no)::int AS contract_count,
          COUNT(c.contract_no) FILTER (
            WHERE COALESCE(c.approve_status_1, 0) = 1
              AND GREATEST(COALESCE(c.approve_status_2, 0), COALESCE(c.acc_approve, 0)) = 1
          )::int AS ready_contract_count,
          COUNT(c.contract_no) FILTER (
            WHERE NOT (
              COALESCE(c.approve_status_1, 0) = 1
              AND GREATEST(COALESCE(c.approve_status_2, 0), COALESCE(c.acc_approve, 0)) = 1
            )
          )::int AS waiting_contract_count,
          COUNT(c.contract_no) FILTER (
            WHERE COALESCE(c.approve_status_1, 0) = 1
              AND GREATEST(COALESCE(c.approve_status_2, 0), COALESCE(c.acc_approve, 0)) = 1
              AND boq_contracts.contract_id IS NULL
          )::int AS waiting_boq_count,
          COUNT(c.contract_no) FILTER (
            WHERE boq_contracts.contract_id IS NOT NULL
          )::int AS boq_contract_count,
          COUNT(c.contract_no) FILTER (
            WHERE NOT (
              COALESCE(c.approve_status_1, 0) = 1
              AND GREATEST(COALESCE(c.approve_status_2, 0), COALESCE(c.acc_approve, 0)) = 1
            )
          ) > 0 AS waiting_contract,
          COUNT(c.contract_no) FILTER (
            WHERE COALESCE(c.approve_status_1, 0) = 1
              AND GREATEST(COALESCE(c.approve_status_2, 0), COALESCE(c.acc_approve, 0)) = 1
              AND boq_contracts.contract_id IS NULL
          ) > 0 AS waiting_boq,
          COUNT(c.contract_no) FILTER (
            WHERE boq_contracts.contract_id IS NOT NULL
          ) > 0 AS has_boq
        FROM odg_projects p
        LEFT JOIN erp_province pv ON pv.code = p.province
        LEFT JOIN erp_amper d ON d.code = p.district AND d.province = p.province
        LEFT JOIN erp_tambon v ON v.code = p.village AND v.amper = p.district AND v.province = p.province
        LEFT JOIN odg_projects_contract c ON c.project_id::text = p.id::text
        LEFT JOIN boq_contracts ON boq_contracts.contract_id = c.roworder
        WHERE p.project_status IN (
          'ຂັ້ນຕອນດຳເນີນໂຄງການ',
          'ສາມາດເບີກຂອງໃດ້',
          'ດຳເນີນການຕິດຕັ້ງ',
          'ລໍຖ້າອະນຸມັດປິດໂຄງການ'
        )
        GROUP BY p.id, pv.name_1, d.name_1, v.name_1
        ORDER BY p.id DESC
      `);
        return result.rows;
      });
      return ok({ data });
    }

    const data = await cached(cacheKey!, LIST_TTL_MS, async () => {
      const result = await query(`
        SELECT p.*, pv.name_1 AS province_name, d.name_1 AS district_name, v.name_1 AS village_name
        FROM odg_projects p
        LEFT JOIN erp_province pv ON pv.code = p.province
        LEFT JOIN erp_amper d ON d.code = p.district AND d.province = p.province
        LEFT JOIN erp_tambon v ON v.code = p.village AND v.amper = p.district AND v.province = p.province
        ORDER BY p.id DESC
      `);
      return result.rows;
    });
    return ok({ data });
  } catch (e) { return fail((e as Error).message); }
}

export async function getProjectsBoqClose(): Promise<Result<unknown[]>> {
  try {
    const data = await cached("projects:boq:close", LIST_TTL_MS, async () => {
      const result = await query(`
      SELECT
        p.id, p.project_name, p.sml_code, p.project_status,
        p.coordinator, p.phone,
        pv.name_1 AS province_name, d.name_1 AS district_name, v.name_1 AS village_name,
        c.contract_no, c.contract_name, c.amount
      FROM odg_projects p
      LEFT JOIN erp_province pv ON pv.code = p.province
      LEFT JOIN erp_amper d ON d.code = p.district AND d.province = p.province
      LEFT JOIN erp_tambon v ON v.code = p.village AND v.amper = p.district AND v.province = p.province
      LEFT JOIN odg_projects_contract c ON c.project_id::text = p.id::text
      WHERE p.project_status IN ('ລໍຖ້າອະນຸມັດປິດໂຄງການ', 'ປິດໂຄງການ')
      ORDER BY p.id DESC
    `);
      return result.rows;
    });
    return ok({ data });
  } catch (e) { return fail((e as Error).message); }
}

export async function getProjectsWaitingApprove(): Promise<Result<unknown[]>> {
  try {
    const data = await cached(
      "projects:waiting-approve",
      LIST_TTL_MS,
      () => listPendingProjectApprovals(),
    );
    return ok({ data });
  } catch (e) { return fail((e as Error).message); }
}

export async function createProjectRequestAction(payload: Record<string, unknown>): Promise<Result> {
  try {
    if (!payload?.existing_project_id && !payload?.project_id) {
      return fail("project_id is required");
    }
    if (!payload?.contract_no || !payload?.contract_name) {
      return fail("contract_no and contract_name are required");
    }
    const result = await createProjectRequest(payload);
    invalidate("projects:");
    return ok({ message: "Request submitted", data: result });
  } catch (e) { return fail((e as Error).message); }
}
