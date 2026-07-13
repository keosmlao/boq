"use server";

import { query, withTransaction } from "@/_lib/db";
import { cached, invalidate } from "@/_lib/cache";
import { requirePermission, requireUser } from "@/_lib/server-auth";
import { can } from "@/_lib/permissions";
import { logActivity } from "./chatter";
import { ensureProjectTaskSchema } from "@/_lib/schemas/tasks";
import { ensureWorkOrderSchema } from "@/_lib/schemas/work-order";

type Fail = { success: false; message: string };
function fail(message: string): Fail {
  return { success: false, message };
}

const TTL = 10_000;
const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export async function getProjectTasks(opts: { projectId: string }): Promise<{ success: true; data: any[] } | Fail> {
  try {
    const load = async () => {
      await ensureProjectTaskSchema();
      const r = await query(
        `SELECT * FROM odg_project_task WHERE project_id = $1 ORDER BY sort_order ASC, id ASC`,
        [String(opts.projectId)],
      );
      return r.rows;
    };
    const data = await cached(`tasks:list:${opts.projectId}`, TTL, load);
    return { success: true, data };
  } catch (e) {
    return fail((e as Error).message);
  }
}

/** Delete the whole task plan for a project. */
export async function deleteTaskPlan(projectId: string): Promise<{ success: true } | Fail> {
  try {
    await requirePermission("schedule", "delete");
    await ensureProjectTaskSchema();
    await query(`DELETE FROM odg_project_task WHERE project_id = $1`, [String(projectId)]);
    await logActivity("project", String(projectId), "ລຶບແຜນວຽກ");
    invalidate("tasks:");
    return { success: true };
  } catch (e) {
    return fail((e as Error).message);
  }
}

/** All planned tasks across projects (for the schedule list), with project name. */
export async function getAllTasks(): Promise<{ success: true; data: any[] } | Fail> {
  try {
    await ensureProjectTaskSchema();
    const r = await query(
      `SELECT t.*, p.project_name
       FROM odg_project_task t
       LEFT JOIN odg_projects p ON p.id::text = t.project_id
       ORDER BY t.created_at DESC LIMIT 500`,
    );
    return { success: true, data: r.rows };
  } catch (e) {
    return fail((e as Error).message);
  }
}

/**
 * Schedule grouped BY PROJECT (what tasks each project has, which technician,
 * which days). Reconciles with work orders: a project that has work order(s) but
 * NO task plan gets its tasks auto-recreated from the work-order snapshots.
 */
export async function getScheduleByProject(): Promise<{ success: true; data: any[] } | Fail> {
  try {
    await ensureProjectTaskSchema();
    await ensureWorkOrderSchema();

    const [woRes, tcRes] = await Promise.all([
      query(`SELECT * FROM odg_work_order ORDER BY created_at ASC`),
      query(`SELECT project_id, COUNT(*)::int AS n FROM odg_project_task GROUP BY project_id`),
    ]);
    const haveTasks = new Set((tcRes.rows as any[]).map((r) => String(r.project_id)));
    const woByProj = new Map<string, any[]>();
    for (const w of woRes.rows as any[]) {
      const pid = String(w.project_id ?? "");
      if (!pid) continue;
      if (!woByProj.has(pid)) woByProj.set(pid, []);
      woByProj.get(pid)!.push(w);
    }

    // Auto-recreate task plans for projects that have work orders but no tasks.
    let recreated = false;
    for (const [pid, wos] of woByProj) {
      if (haveTasks.has(pid)) continue;
      let order = 0;
      for (const w of wos) {
        const snap = Array.isArray(w.tasks) ? w.tasks : [];
        for (const s of snap) {
          if (!s?.title) continue;
          await query(
            `INSERT INTO odg_project_task
              (project_id, contract_id, title, technician_code, technician_name,
               planned_start, planned_end, est_hours, actual_hours, status, work_order_id, sort_order)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'done',$10,$11)`,
            [
              pid,
              w.contract_id ? String(w.contract_id) : null,
              String(s.title),
              w.technician_code || null,
              w.technician_name || null,
              w.work_date || null,
              w.end_date || null,
              num(s.actual_hours),
              num(s.actual_hours),
              String(w.id),
              order++,
            ],
          );
          recreated = true;
        }
      }
    }
    if (recreated) invalidate("tasks:");

    const r = await query(
      `SELECT t.*, pn.project_name
       FROM odg_project_task t
       LEFT JOIN LATERAL (
         SELECT project_name FROM odg_projects p
          WHERE p.id::text = t.project_id OR p.sml_code = t.project_id
          LIMIT 1
       ) pn ON true
       ORDER BY t.project_id, t.sort_order ASC, t.id ASC`,
    );
    const groups = new Map<string, any>();
    for (const t of r.rows as any[]) {
      const pid = String(t.project_id ?? "");
      if (!groups.has(pid)) groups.set(pid, { project_id: pid, project_name: t.project_name || pid, tasks: [], wo_count: 0 });
      groups.get(pid).tasks.push(t);
    }
    for (const g of groups.values()) g.wo_count = (woByProj.get(g.project_id) || []).length;
    return { success: true, data: Array.from(groups.values()) };
  } catch (e) {
    return fail((e as Error).message);
  }
}

/** Replace the whole task plan for a project (bulk save from the editor). */
export async function saveTaskPlan(
  projectId: string,
  contractId: string | null,
  tasks: any[],
): Promise<{ success: true; count: number } | Fail> {
  try {
    // The task plan is owned by the "schedule" module (ກຳນົດໜ້າວຽກ) — same as
    // deleteTaskPlan. This one action both creates and replaces a plan, so either
    // schedule.create or schedule.edit is enough (admins pass via `can`).
    const user = await requireUser();
    if (!can(user, "schedule", "create") && !can(user, "schedule", "edit")) {
      return fail("ບໍ່ມີສິດດຳເນີນການນີ້");
    }
    await ensureProjectTaskSchema();
    const valid = (Array.isArray(tasks) ? tasks : []).filter((t) => String(t?.title || "").trim());
    await withTransaction(async (client) => {
      await client.query(`DELETE FROM odg_project_task WHERE project_id = $1`, [String(projectId)]);
      for (let i = 0; i < valid.length; i++) {
        const t = valid[i];
        await client.query(
          `INSERT INTO odg_project_task
            (project_id, contract_id, task_code, title, phase, technician_code, technician_name,
             planned_start, planned_end, est_days, est_hours, status, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
          [
            String(projectId),
            contractId ? String(contractId) : null,
            t.task_code || null,
            String(t.title),
            t.phase || null,
            t.technician_code || null,
            t.technician_name || null,
            t.planned_start || null,
            t.planned_end || null,
            num(t.est_days),
            num(t.est_hours),
            t.status || "planned",
            i,
          ],
        );
      }
    });
    await logActivity("project", String(projectId), "ບັນທຶກແຜນວຽກ");
    invalidate("tasks:");
    return { success: true, count: valid.length };
  } catch (e) {
    return fail((e as Error).message);
  }
}
