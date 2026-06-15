"use server";

/**
 * Drizzle / pm.project_tasks drop-in for app/_actions/tasks-v2.ts. Same API +
 * legacy snake_case rows. NOT wired in — switch over after pm.project_tasks is
 * backfilled (drizzle/backfill/0010_tasks.sql). See quotations.pm.ts.
 *
 * NOTE: getScheduleByProject here does NOT auto-recreate task plans from work
 * orders (a legacy migration crutch) — once tasks are first-class in pm that
 * heuristic is unnecessary. Port it if you still need it.
 */
import { asc, desc, eq, or } from "drizzle-orm";
import { db } from "@/_db/client";
import { projectTasks, projects, workOrders } from "@/_db/schema";

type Fail = { success: false; message: string };
const fail = (message: string): Fail => ({ success: false, message });
const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : (v ?? null));

async function resolvePmProjectId(projectId: unknown): Promise<number | null> {
  const raw = String(projectId ?? "").trim();
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  const rows = await db
    .select({ id: projects.id })
    .from(projects)
    .where(or(eq(projects.id, n), eq(projects.legacyId, n)))
    .limit(1);
  return rows[0]?.id ?? null;
}

function toLegacy(t: typeof projectTasks.$inferSelect, projectName?: string | null) {
  return {
    id: t.id,
    project_id: t.projectId,
    contract_id: t.legacyContractRef,
    task_code: t.taskCode,
    title: t.title,
    phase: t.phase,
    technician_code: t.technicianCode,
    technician_name: t.technicianName,
    planned_start: t.plannedStart,
    planned_end: t.plannedEnd,
    est_days: t.estDays,
    est_hours: t.estHours,
    actual_hours: t.actualHours,
    work_order_id: t.workOrderId,
    status: t.status,
    sort_order: t.sortOrder,
    project_name: projectName ?? undefined,
    created_at: iso(t.createdAt),
  };
}

export async function getProjectTasks(opts: { projectId: string }): Promise<{ success: true; data: any[] } | Fail> {
  try {
    const pid = await resolvePmProjectId(opts.projectId);
    if (pid == null) return { success: true, data: [] };
    const rows = await db
      .select()
      .from(projectTasks)
      .where(eq(projectTasks.projectId, pid))
      .orderBy(asc(projectTasks.sortOrder), asc(projectTasks.id));
    return { success: true, data: rows.map((t) => toLegacy(t)) };
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function deleteTaskPlan(projectId: string): Promise<{ success: true } | Fail> {
  try {
    const pid = await resolvePmProjectId(projectId);
    if (pid != null) await db.delete(projectTasks).where(eq(projectTasks.projectId, pid));
    return { success: true };
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function getAllTasks(): Promise<{ success: true; data: any[] } | Fail> {
  try {
    const rows = await db
      .select({ t: projectTasks, projectName: projects.name })
      .from(projectTasks)
      .leftJoin(projects, eq(projectTasks.projectId, projects.id))
      .orderBy(desc(projectTasks.createdAt))
      .limit(500);
    return { success: true, data: rows.map((r) => toLegacy(r.t, r.projectName)) };
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function getScheduleByProject(): Promise<{ success: true; data: any[] } | Fail> {
  try {
    const rows = await db
      .select({ t: projectTasks, projectName: projects.name })
      .from(projectTasks)
      .leftJoin(projects, eq(projectTasks.projectId, projects.id))
      .orderBy(asc(projectTasks.projectId), asc(projectTasks.sortOrder), asc(projectTasks.id));

    const woRows = await db.select({ projectId: workOrders.projectId }).from(workOrders);
    const woCount = new Map<number, number>();
    for (const w of woRows) if (w.projectId != null) woCount.set(w.projectId, (woCount.get(w.projectId) ?? 0) + 1);

    const groups = new Map<string, any>();
    for (const r of rows) {
      const pid = String(r.t.projectId ?? "");
      if (!groups.has(pid)) {
        groups.set(pid, {
          project_id: pid,
          project_name: r.projectName || pid,
          tasks: [],
          wo_count: r.t.projectId != null ? woCount.get(r.t.projectId) ?? 0 : 0,
        });
      }
      groups.get(pid).tasks.push(toLegacy(r.t, r.projectName));
    }
    return { success: true, data: Array.from(groups.values()) };
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function saveTaskPlan(
  projectId: string,
  contractId: string | null,
  tasks: any[],
): Promise<{ success: true; count: number } | Fail> {
  try {
    const pid = await resolvePmProjectId(projectId);
    if (pid == null) return fail("project not found");
    const valid = (Array.isArray(tasks) ? tasks : []).filter((t) => String(t?.title || "").trim());

    await db.transaction(async (tx) => {
      await tx.delete(projectTasks).where(eq(projectTasks.projectId, pid));
      if (valid.length) {
        await tx.insert(projectTasks).values(
          valid.map((t, i) => ({
            projectId: pid,
            legacyContractRef: contractId ? String(contractId) : null,
            taskCode: t.task_code || null,
            title: String(t.title),
            phase: t.phase || null,
            technicianCode: t.technician_code || null,
            technicianName: t.technician_name || null,
            plannedStart: t.planned_start || null,
            plannedEnd: t.planned_end || null,
            estDays: String(num(t.est_days)),
            estHours: String(num(t.est_hours)),
            status: t.status || "planned",
            sortOrder: i,
          })),
        );
      }
    });
    return { success: true, count: valid.length };
  } catch (e) {
    return fail((e as Error).message);
  }
}
