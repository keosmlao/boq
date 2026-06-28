"use server";

import { query, withTransaction } from "@/_lib/db";
import { invalidate } from "@/_lib/cache";
import { ensureWorkOrderSchema } from "@/_lib/schemas/work-order";
import { ensureProjectTaskSchema } from "@/_lib/schemas/tasks";
import { requireUser, requirePermission } from "@/_lib/server-auth";
import { can } from "@/_lib/permissions";
import { logActivity } from "./chatter";
import {
  approveWorkOrderAs,
  respondWorkOrderAs,
  checkInWorkOrderAs,
  checkOutWorkOrderAs,
  closeWorkOrderAs,
} from "@/_lib/workorder-core";
import { notifyCraftsman } from "@/_lib/push";

type Fail = { success: false; message: string };
function fail(message: string): Fail {
  return { success: false, message };
}

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const mapLegacyWo = (w: any) => ({
  id: `erp-${w.id}`,
  work_no: w.code,
  project_id: w.project_code || "",
  contract_no: w.contract_no || null,
  technician_name: w.technician_name_resolved || w.technician_id || "",
  technician_code: w.technician_id || null, // ERP stores the technician code in technician_id
  title: w.title || w.task_name || "",
  work_date: w.scheduled_date || w.created_at,
  total_hours: 0,
  labor_cost: 0,
  status: w.status || "",
  src: "erp",
});

const LEGACY_WO_SELECT = `
  SELECT w.*, t.name_1 AS technician_name_resolved
  FROM odg_work_orders w
  LEFT JOIN odg_technicians t ON t.code = w.technician_id`;

// Active work orders + a best-effort technician code. When a row has no stored
// technician_code (older / seeded rows), resolve it from odg_technicians by the
// stored technician_name. LATERAL + LIMIT 1 keeps it one row per work order.
const WO_SELECT_WITH_TECH = `
  SELECT w.*, tc.code AS resolved_tech_code
    FROM odg_work_order w
    LEFT JOIN LATERAL (
      SELECT code FROM odg_technicians t
       WHERE NULLIF(w.technician_code, '') IS NULL
         AND ( btrim(t.name_1) = btrim(w.technician_name)
            OR btrim(w.technician_name) LIKE '%' || btrim(t.name_1) )
       ORDER BY length(t.name_1) DESC
       LIMIT 1
    ) tc ON true`;

export async function getWorkOrders(opts: { projectId?: string; projectCode?: string } = {}): Promise<{ success: true; data: any[] } | Fail> {
  try {
    await ensureWorkOrderSchema();
    const r = opts.projectId
      ? await query(`${WO_SELECT_WITH_TECH} WHERE w.project_id = $1 ORDER BY w.created_at DESC`, [String(opts.projectId)])
      : await query(`${WO_SELECT_WITH_TECH} ORDER BY w.created_at DESC LIMIT 500`);
    const rows: any[] = r.rows.map((x: any) => ({
      ...x,
      technician_code: x.technician_code || x.resolved_tech_code || null,
      src: "v2",
    }));

    // Merge legacy ERP work orders (odg_work_orders, linked by project_code).
    // Skip any ERP order already mirrored into a v2 work order (legacy_code) so
    // the list doesn't show duplicates.
    const mirrored = new Set(rows.map((x) => x.legacy_code).filter(Boolean).map(String));
    try {
      if (opts.projectCode) {
        const lg = await query(`${LEGACY_WO_SELECT} WHERE w.project_code = $1 ORDER BY w.created_at DESC`, [String(opts.projectCode)]);
        for (const w of lg.rows as any[]) if (!mirrored.has(String(w.code))) rows.push(mapLegacyWo(w));
      } else if (!opts.projectId) {
        const lg = await query(`${LEGACY_WO_SELECT} ORDER BY w.created_at DESC LIMIT 500`);
        for (const w of lg.rows as any[]) if (!mirrored.has(String(w.code))) rows.push(mapLegacyWo(w));
      }
    } catch {
      /* legacy WO table/cols differ — v2 still returned */
    }
    return { success: true, data: rows };
  } catch (e) {
    return fail((e as Error).message);
  }
}

/** Delete a work order and un-assign its tasks (so they can be re-issued). */
export async function deleteWorkOrder(id: string): Promise<{ success: true } | Fail> {
  try {
    await requirePermission("work-orders", "delete");
    await ensureWorkOrderSchema();
    await ensureProjectTaskSchema();
    await withTransaction(async (client) => {
      await client.query(
        `UPDATE odg_project_task
            SET work_order_id = NULL, technician_code = NULL, technician_name = NULL,
                planned_start = NULL, planned_end = NULL, actual_hours = 0, status = 'planned'
          WHERE work_order_id = $1`,
        [String(id)],
      );
      await client.query(`DELETE FROM odg_work_order WHERE id = $1`, [id]);
    });
    await logActivity("work_order", String(id), "ລຶບໃບງານ");
    invalidate("wo:");
    invalidate("tasks:");
    return { success: true };
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function getWorkOrderById(id: string): Promise<{ success: true; data: any } | Fail> {
  try {
    await ensureWorkOrderSchema();
    // Legacy old-system work order (id like "erp-9").
    if (String(id).startsWith("erp-")) {
      const realId = String(id).slice(4);
      const r = await query(`${LEGACY_WO_SELECT} WHERE w.id = $1 LIMIT 1`, [realId]);
      if (!r.rows.length) return fail("Work order not found");
      const w: any = r.rows[0];
      // Resolve helper technician codes -> names.
      let helpers: string[] = [];
      try {
        const codes = (Array.isArray(w.helper_ids) ? w.helper_ids : []).map(String).filter(Boolean);
        if (codes.length) {
          const h = await query(`SELECT code, name_1 FROM odg_technicians WHERE code = ANY($1::text[])`, [codes]);
          const m: Record<string, string> = {};
          for (const x of h.rows as any[]) m[String(x.code)] = x.name_1;
          helpers = codes.map((c: string) => m[c] || c);
        }
      } catch {
        /* ignore */
      }
      return {
        success: true,
        data: {
          ...mapLegacyWo(w),
          end_date: w.due_date,
          notes: w.description,
          helpers,
          tasks: [{ title: w.title || w.task_name || "", actual_hours: 0 }],
        },
      };
    }
    const r = await query(`${WO_SELECT_WITH_TECH} WHERE w.id = $1 LIMIT 1`, [id]);
    if (!r.rows.length) return fail("Work order not found");
    const row: any = r.rows[0];
    const techCode = row.technician_code || row.resolved_tech_code || null;
    // ຜູ້ຊ່ວຍຊ່າງ: helpers are defined on the lead technician (odg_technicians.helpers,
    // an array of codes). Resolve their names for display.
    const helpers = await resolveHelpers(techCode);
    return { success: true, data: { ...row, technician_code: techCode, helpers } };
  } catch (e) {
    return fail((e as Error).message);
  }
}

/**
 * Monthly work summary for one craftsman (by their technician/employee code):
 * total work orders, total hours, project count, and a per-project breakdown.
 * Merges v2 (odg_work_order) + legacy ERP (odg_work_orders). Hours come from v2
 * total_hours (ERP carries no hours → counted as 0).
 */
export async function getCraftsmanSummary(techCode: string, month?: string): Promise<{ success: true; data: any } | Fail> {
  try {
    await ensureWorkOrderSchema();
    const code = String(techCode || "");
    const ym = month && /^\d{4}-\d{2}$/.test(month) ? month : new Date().toISOString().slice(0, 7);
    if (!code) return { success: true, data: { month: ym, totals: { workOrders: 0, hours: 0, projects: 0 }, byProject: [] } };

    const r = await query(
      `
      WITH wo AS (
        SELECT w.project_id::text AS pid, COALESCE(w.total_hours,0)::numeric AS hours,
               COALESCE(w.work_date, w.created_at) AS dt
          FROM odg_work_order w WHERE w.technician_code = $1
        UNION ALL
        SELECT w.project_code::text AS pid, 0::numeric AS hours,
               COALESCE(w.scheduled_date, w.created_at) AS dt
          FROM odg_work_orders w WHERE w.technician_id = $1
      ),
      agg AS (
        SELECT pid, count(*)::int AS wo_count, COALESCE(sum(hours),0)::numeric AS hours
          FROM wo
         WHERE to_char(dt,'YYYY-MM') = $2
         GROUP BY pid
      )
      SELECT a.pid, a.wo_count, a.hours,
             (SELECT project_name FROM odg_projects p WHERE p.id::text = a.pid OR p.sml_code = a.pid LIMIT 1) AS project_name
        FROM agg a
       ORDER BY a.wo_count DESC, a.hours DESC
      `,
      [code, ym],
    );
    const byProject = (r.rows as any[]).map((x) => ({
      project_id: x.pid,
      project_name: x.project_name || x.pid || "(ບໍ່ລະບຸໂຄງການ)",
      workOrders: Number(x.wo_count) || 0,
      hours: Number(x.hours) || 0,
    }));
    const totals = {
      workOrders: byProject.reduce((s, p) => s + p.workOrders, 0),
      hours: byProject.reduce((s, p) => s + p.hours, 0),
      projects: byProject.length,
    };
    return { success: true, data: { month: ym, totals, byProject } };
  } catch (e) {
    return fail((e as Error).message);
  }
}

/** Resolve a lead technician's helper codes → names (for ຜູ້ຊ່ວຍຊ່າງ display). */
async function resolveHelpers(techCode: string | null): Promise<string[]> {
  if (!techCode) return [];
  try {
    const lead = await query(`SELECT helpers FROM odg_technicians WHERE code = $1 LIMIT 1`, [String(techCode)]);
    const raw = lead.rows[0]?.helpers;
    const codes = (Array.isArray(raw) ? raw : [])
      .map((h: any) => (h && typeof h === "object" ? (h.code ?? h.name_1 ?? h.name) : h))
      .map(String)
      .filter(Boolean);
    if (!codes.length) return [];
    const hs = await query(`SELECT code, name_1 FROM odg_technicians WHERE code = ANY($1::text[])`, [codes]);
    const m: Record<string, string> = {};
    for (const x of hs.rows as any[]) m[String(x.code)] = x.name_1;
    return codes.map((c: string) => m[c] || c);
  } catch {
    return [];
  }
}

/**
 * Create ONE work order: a team does a SELECTED set of the project's tasks over
 * a date range. A project can have many work orders; each task is assigned to a
 * single work order (work_order_id). Labour cost = Σ actual hours × rate/hour.
 */
export async function createWorkOrder(body: any): Promise<{ success: true; data: any } | Fail> {
  try {
    await ensureWorkOrderSchema();
    await ensureProjectTaskSchema();
    if (!body?.project_id) return fail("project_id is required");

    // Plan tasks have an id; ad-hoc tasks (added on the WO) have only a title.
    const tasks = (Array.isArray(body.tasks) ? body.tasks : []).filter((t: any) => t?.id || (t?.title && String(t.title).trim()));
    if (!tasks.length) return fail("ກະລຸນາເລືອກໜ້າວຽກຢ່າງໜ້ອຍ 1 ອັນ");

    // Material template the technician needs on site (admin issues the actual ໃບຂໍເບີກ later, in rounds).
    const materials = (Array.isArray(body.materials) ? body.materials : []).filter((m: any) => num(m.qty) > 0);

    const totalHours = tasks.reduce((s: number, t: any) => s + num(t.actual_hours), 0);
    const rate = num(body.rate_per_hour);
    const laborCost = totalHours * rate;

    const d = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    const workNo =
      body.work_no ||
      `WO-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;

    const result = await withTransaction(async (client) => {
      const wo = await client.query(
        `INSERT INTO odg_work_order
          (work_no, project_id, contract_id, work_date, end_date, technician_code, technician_name,
           rate_per_hour, total_hours, labor_cost, status, notes, tasks, materials, assigned_username, shift)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
        [
          workNo,
          String(body.project_id),
          body.contract_id ? String(body.contract_id) : null,
          body.work_date || null,
          body.end_date || null,
          body.technician_code || null,
          body.technician_name || null,
          rate,
          totalHours,
          laborCost,
          body.status || "open",
          body.notes || null,
          JSON.stringify(tasks),
          JSON.stringify(materials),
          body.technician_code || null, // bind the assigned craftsman (employee_code)
          body.shift || null,
        ],
      );
      const woId = String(wo.rows[0].id);
      // Assign plan tasks; create ad-hoc tasks (no id) as new project tasks.
      for (const t of tasks) {
        if (t.id) {
          await client.query(
            `UPDATE odg_project_task
               SET work_order_id = $2, technician_code = $3, technician_name = $4,
                   planned_start = $5, planned_end = $6, actual_hours = $7,
                   status = 'done'
             WHERE id = $1`,
            [t.id, woId, body.technician_code || null, body.technician_name || null, body.work_date || null, body.end_date || null, num(t.actual_hours)],
          );
        } else if (t.title && String(t.title).trim()) {
          await client.query(
            `INSERT INTO odg_project_task
               (project_id, contract_id, task_code, title, phase, technician_code, technician_name,
                planned_start, planned_end, est_hours, actual_hours, work_order_id, status)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10,$11,'done')`,
            [
              String(body.project_id),
              body.contract_id ? String(body.contract_id) : null,
              t.task_code || null,
              String(t.title).trim(),
              t.phase || "ນອກແຜນ",
              body.technician_code || null,
              body.technician_name || null,
              body.work_date || null,
              body.end_date || null,
              num(t.actual_hours),
              woId,
            ],
          );
        }
      }
      return wo.rows[0];
    });

    invalidate("wo:");
    invalidate("tasks:");

    // Notify the assigned craftsman that a work order has been issued to them.
    await notifyCraftsman(
      body.technician_code,
      "ມີໃບງານໃໝ່",
      `${result.work_no || "ໃບງານ"} ຖືກມອບໝາຍໃຫ້ທ່ານ`,
      { workOrderId: String(result.id), type: "wo_issued" },
    );

    await logActivity("work_order", String(result.id), "ສ້າງໃບງານ", result.work_no ?? undefined);
    return { success: true, data: result };
  } catch (e) {
    return fail((e as Error).message);
  }
}

/* ──────────────────────────────────────────────────────────────────────────
 * Mobile head-craftsman lifecycle (web entrypoints)
 *   issue → (manager) approve → (head craftsman) accept/reject
 *         → on-site check-in (photo + GPS) → check-out (photo + GPS) = close
 * The shared rules live in @/_lib/workorder-core; these thin wrappers add the
 * cookie-session auth. The mobile REST API calls the same core with a Bearer
 * user. erp-* (legacy) ids are rejected inside the core.
 * ────────────────────────────────────────────────────────────────────────── */

export async function approveWorkOrder(id: string, opts: { approve: boolean; note?: string } = { approve: true }) {
  try {
    const user = await requireUser();
    return await approveWorkOrderAs(user, id, opts);
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function respondWorkOrder(id: string, opts: { accept: boolean; reason?: string }) {
  try {
    const user = await requireUser();
    return await respondWorkOrderAs(user, id, opts);
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function checkInWorkOrder(id: string, opts: { lat: number; lng: number; photoBase64: string; photoName?: string }) {
  try {
    const user = await requireUser();
    return await checkInWorkOrderAs(user, id, opts);
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function checkOutWorkOrder(id: string, opts: { lat: number; lng: number; photoBase64: string; photoName?: string }) {
  try {
    const user = await requireUser();
    return await checkOutWorkOrderAs(user, id, opts);
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function closeWorkOrder(id: string, opts: { note?: string } = {}) {
  try {
    const user = await requireUser();
    return await closeWorkOrderAs(user, id, opts);
  } catch (e) {
    return fail((e as Error).message);
  }
}

/**
 * Make a legacy ERP work order usable by the mobile flow: mirror it into a v2
 * odg_work_order (idempotent via legacy_code) and approve it in one step, so
 * the assigned craftsman can accept it on mobile. Returns the v2 work order id.
 */
async function mirrorErpToV2(erpId: string): Promise<string | null> {
  const realId = String(erpId).replace(/^erp-/, "");
  const lg = await query(`${LEGACY_WO_SELECT} WHERE w.id = $1 LIMIT 1`, [realId]);
  if (!lg.rows.length) return null;
  const w: any = lg.rows[0];
  const existing = await query(`SELECT id FROM odg_work_order WHERE legacy_code = $1 LIMIT 1`, [w.code]);
  if (existing.rows.length) return String(existing.rows[0].id);
  const tasks = [{ title: w.title || w.task_name || "ວຽກ", actual_hours: 0 }];
  const ins = await query(
    `INSERT INTO odg_work_order
       (work_no, project_id, contract_id, work_date, end_date, technician_code, technician_name,
        status, notes, tasks, materials, assigned_username, legacy_code)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'open',$8,$9::jsonb,'[]'::jsonb,$10,$11) RETURNING id`,
    [
      w.code,
      w.project_code || null,
      w.contract_no || null,
      w.scheduled_date || null,
      w.due_date || null,
      w.technician_id || null,
      w.technician_name_resolved || w.technician_id || null,
      w.description || null,
      JSON.stringify(tasks),
      w.technician_id || null,
      w.code,
    ],
  );
  return String(ins.rows[0].id);
}

export async function startWorkOrderFromErp(erpId: string): Promise<{ success: true; data: { id: string } } | Fail> {
  try {
    const user = await requireUser();
    if (!can(user, "work-orders", "approve")) return fail("ບໍ່ມີສິດອະນຸມັດ");
    await ensureWorkOrderSchema();
    const id = await mirrorErpToV2(String(erpId));
    if (!id) return fail("ບໍ່ພົບໃບງານ ERP");
    // Approve immediately (the manager issuing it IS the approval) → notifies craftsman.
    await approveWorkOrderAs(user, id, { approve: true });
    invalidate("wo:");
    return { success: true, data: { id } };
  } catch (e) {
    return fail((e as Error).message);
  }
}
