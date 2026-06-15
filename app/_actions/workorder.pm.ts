"use server";

/**
 * Drizzle / pm.work_orders drop-in for app/_actions/workorder.ts. Same API +
 * legacy snake_case rows. NOT wired in — switch over after pm.work_orders is
 * backfilled (0008 technicians + 0009 work orders). See quotations.pm.ts.
 *
 * The old ERP work-order system (odg_work_orders, ids like "erp-N") is a separate
 * legacy source not migrated here; getWorkOrderById keeps a stub for it.
 */
import { and, asc, desc, eq, or } from "drizzle-orm";
import { db } from "@/_db/client";
import {
  workOrders,
  workOrderTasks,
  workOrderItems,
  technicians,
  projectTasks,
  projects,
} from "@/_db/schema";

type Fail = { success: false; message: string };
const fail = (message: string): Fail => ({ success: false, message });
const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : (v ?? null));

const WO_STATUS_TO_LEGACY: Record<string, string> = {
  assigned: "open",
  in_progress: "in_progress",
  paused: "paused",
  done: "done",
  cancelled: "cancelled",
};
type WoStatus = typeof workOrders.$inferInsert.status;
const toWoStatus = (s: unknown): WoStatus => {
  const v = String(s ?? "");
  return v === "in_progress" || v === "paused" || v === "done" || v === "cancelled" ? (v as WoStatus) : "assigned";
};

async function resolvePmProjectId(projectId: unknown): Promise<number | null> {
  const raw = String(projectId ?? "").trim();
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  const rows = await db.select({ id: projects.id }).from(projects).where(or(eq(projects.id, n), eq(projects.legacyId, n))).limit(1);
  return rows[0]?.id ?? null;
}

function toLegacy(w: typeof workOrders.$inferSelect, technicianName: string | null) {
  return {
    id: w.id,
    work_no: w.code,
    project_id: w.projectId,
    contract_id: w.contractId,
    contract_no: w.contractNo,
    technician_name: technicianName || "",
    work_date: w.workDate,
    end_date: w.endDate,
    rate_per_hour: w.ratePerHour,
    total_hours: w.totalHours,
    labor_cost: w.laborCost,
    status: WO_STATUS_TO_LEGACY[w.status] ?? w.status,
    notes: w.description,
    created_at: iso(w.createdAt),
    src: "v2",
  };
}

export async function getWorkOrders(
  opts: { projectId?: string; projectCode?: string } = {},
): Promise<{ success: true; data: any[] } | Fail> {
  try {
    const conds = [];
    if (opts.projectId) {
      const pid = await resolvePmProjectId(opts.projectId);
      if (pid == null) return { success: true, data: [] };
      conds.push(eq(workOrders.projectId, pid));
    }
    const rows = await db
      .select({ w: workOrders, technicianName: technicians.name })
      .from(workOrders)
      .leftJoin(technicians, eq(workOrders.technicianId, technicians.id))
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(workOrders.createdAt))
      .limit(500);
    return { success: true, data: rows.map((r) => toLegacy(r.w, r.technicianName)) };
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function deleteWorkOrder(id: string): Promise<{ success: true } | Fail> {
  try {
    const n = Number(id);
    await db.transaction(async (tx) => {
      // Un-assign tasks so they can be re-issued.
      await tx
        .update(projectTasks)
        .set({ workOrderId: null, technicianCode: null, technicianName: null, plannedStart: null, plannedEnd: null, actualHours: "0", status: "planned" })
        .where(eq(projectTasks.workOrderId, n));
      await tx.delete(workOrders).where(eq(workOrders.id, n));
    });
    return { success: true };
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function getWorkOrderById(id: string): Promise<{ success: true; data: any } | Fail> {
  try {
    if (String(id).startsWith("erp-")) {
      // Old ERP work-order system — not migrated to pm; port the legacy read if still needed.
      return fail("Legacy ERP work order — not available in pm");
    }
    const n = Number(id);
    const rows = await db
      .select({ w: workOrders, technicianName: technicians.name })
      .from(workOrders)
      .leftJoin(technicians, eq(workOrders.technicianId, technicians.id))
      .where(eq(workOrders.id, n))
      .limit(1);
    if (!rows.length) return fail("Work order not found");
    const taskRows = await db.select().from(workOrderTasks).where(eq(workOrderTasks.workOrderId, n)).orderBy(asc(workOrderTasks.sortOrder));
    const itemRows = await db.select().from(workOrderItems).where(eq(workOrderItems.workOrderId, n));
    return {
      success: true,
      data: {
        ...toLegacy(rows[0].w, rows[0].technicianName),
        helpers: Array.isArray(rows[0].w.helperIds) ? rows[0].w.helperIds : [],
        tasks: taskRows.map((t) => ({ title: t.taskName, actual_hours: 0 })),
        materials: itemRows.map((m) => ({ item_code: m.itemCode, item_name: m.itemName, unit: m.unitCode, qty: num(m.qty) })),
      },
    };
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function createWorkOrder(body: any): Promise<{ success: true; data: any } | Fail> {
  try {
    const pid = body?.project_id != null ? await resolvePmProjectId(body.project_id) : null;
    if (pid == null) return fail("project_id is required");

    const tasks = (Array.isArray(body.tasks) ? body.tasks : []).filter((t: any) => t?.id || (t?.title && String(t.title).trim()));
    if (!tasks.length) return fail("ກະລຸນາເລືອກໜ້າວຽກຢ່າງໜ້ອຍ 1 ອັນ");
    const materials = (Array.isArray(body.materials) ? body.materials : []).filter((m: any) => num(m.qty) > 0);

    const totalHours = tasks.reduce((s: number, t: any) => s + num(t.actual_hours), 0);
    const rate = num(body.rate_per_hour);
    const laborCost = totalHours * rate;

    const d = new Date();
    const p = (x: number) => String(x).padStart(2, "0");
    const workNo =
      body.work_no ||
      `WO-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;

    const techId = body.technician_code
      ? (await db.select({ id: technicians.id }).from(technicians).where(eq(technicians.code, String(body.technician_code))).limit(1))[0]?.id ?? null
      : null;

    const created = await db.transaction(async (tx) => {
      const wo = (
        await tx
          .insert(workOrders)
          .values({
            code: String(workNo),
            projectId: pid,
            contractNo: body.contract_no || null,
            technicianId: techId,
            status: toWoStatus(body.status || "open"),
            description: body.notes || null,
            workDate: body.work_date || null,
            endDate: body.end_date || null,
            ratePerHour: String(rate),
            totalHours: String(totalHours),
            laborCost: String(laborCost),
            createdBy: body.technician_name || null,
          })
          .returning()
      )[0];

      // Snapshot the selected tasks on the work order.
      await tx.insert(workOrderTasks).values(
        tasks.map((t: any, i: number) => ({
          workOrderId: wo.id,
          taskId: /^\d+$/.test(String(t.id ?? "")) ? Number(t.id) : null,
          taskName: t.title || null,
          sortOrder: i,
        })),
      );

      if (materials.length) {
        await tx.insert(workOrderItems).values(
          materials.map((m: any) => ({
            workOrderId: wo.id,
            itemCode: m.item_code || null,
            itemName: m.item_name || m.description || null,
            unitCode: m.unit || m.unit_code || null,
            qty: String(num(m.qty)),
          })),
        );
      }

      // Assign existing plan tasks; create ad-hoc tasks as new project tasks.
      for (const t of tasks) {
        if (/^\d+$/.test(String(t.id ?? ""))) {
          await tx
            .update(projectTasks)
            .set({
              workOrderId: wo.id,
              technicianCode: body.technician_code || null,
              technicianName: body.technician_name || null,
              plannedStart: body.work_date || null,
              plannedEnd: body.end_date || null,
              actualHours: String(num(t.actual_hours)),
              status: "done",
            })
            .where(eq(projectTasks.id, Number(t.id)));
        } else if (t.title && String(t.title).trim()) {
          await tx.insert(projectTasks).values({
            projectId: pid,
            taskCode: t.task_code || null,
            title: String(t.title).trim(),
            phase: t.phase || "ນອກແຜນ",
            technicianCode: body.technician_code || null,
            technicianName: body.technician_name || null,
            plannedStart: body.work_date || null,
            plannedEnd: body.end_date || null,
            estHours: String(num(t.actual_hours)),
            actualHours: String(num(t.actual_hours)),
            workOrderId: wo.id,
            status: "done",
          });
        }
      }
      return wo;
    });

    return { success: true, data: created };
  } catch (e) {
    return fail((e as Error).message);
  }
}
