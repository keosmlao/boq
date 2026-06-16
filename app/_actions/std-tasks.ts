"use server";

import { query } from "@/_lib/db";
import { requirePermission } from "@/_lib/server-auth";
import { ensureStdTaskTable, backfillStandardInstallTasks } from "@/_lib/standard-tasks";

export type StdTask = { id: number; title: string; sort_order: number };

type Ok<T = unknown> = { success: true } & T;
type Fail = { success: false; message: string };
const fail = (message: string): Fail => ({ success: false, message });

/** List the editable standard installation tasks, in order. */
export async function getStandardTasks(): Promise<Ok<{ data: StdTask[] }> | Fail> {
  try {
    await requirePermission("std-tasks", "view");
    await ensureStdTaskTable();
    const r = await query(`SELECT id, title, sort_order FROM odg_std_install_task ORDER BY sort_order ASC, id ASC`);
    return { success: true, data: r.rows as StdTask[] };
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function createStandardTask(title: string): Promise<Ok<{ id: number }> | Fail> {
  try {
    await requirePermission("std-tasks", "create");
    await ensureStdTaskTable();
    const t = String(title ?? "").trim();
    if (!t) return fail("ກະລຸນາໃສ່ຊື່ງານ");
    const m = await query(`SELECT COALESCE(MAX(sort_order), 0)::int AS m FROM odg_std_install_task`);
    const r = await query(
      `INSERT INTO odg_std_install_task (title, sort_order) VALUES ($1, $2) RETURNING id`,
      [t, Number(m.rows[0]?.m ?? 0) + 1],
    );
    return { success: true, id: Number(r.rows[0]?.id) };
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function updateStandardTask(id: number, title: string): Promise<Ok | Fail> {
  try {
    await requirePermission("std-tasks", "edit");
    await ensureStdTaskTable();
    const t = String(title ?? "").trim();
    if (!t) return fail("ກະລຸນາໃສ່ຊື່ງານ");
    await query(`UPDATE odg_std_install_task SET title = $1 WHERE id = $2`, [t, Number(id)]);
    return { success: true };
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function deleteStandardTask(id: number): Promise<Ok | Fail> {
  try {
    await requirePermission("std-tasks", "delete");
    await ensureStdTaskTable();
    await query(`DELETE FROM odg_std_install_task WHERE id = $1`, [Number(id)]);
    return { success: true };
  } catch (e) {
    return fail((e as Error).message);
  }
}

/** Apply the standard checklist to every project (idempotent). Admin/edit only. */
export async function applyStandardTasksToAllProjects(): Promise<Ok<{ projects: number; tasks: number }> | Fail> {
  try {
    await requirePermission("std-tasks", "edit");
    const res = await backfillStandardInstallTasks();
    return { success: true, ...res };
  } catch (e) {
    return fail((e as Error).message);
  }
}

/** Persist a new order: `ids` is the full list of task ids in the desired order. */
export async function reorderStandardTasks(ids: number[]): Promise<Ok | Fail> {
  try {
    await requirePermission("std-tasks", "edit");
    await ensureStdTaskTable();
    const list = (Array.isArray(ids) ? ids : []).map(Number).filter((n) => Number.isFinite(n));
    if (!list.length) return { success: true };
    // One statement: map id → new order via a VALUES list.
    const tuples = list.map((_, i) => `($${i * 2 + 1}::bigint, $${i * 2 + 2}::int)`).join(", ");
    const values: unknown[] = [];
    list.forEach((id, i) => values.push(id, i + 1));
    await query(
      `UPDATE odg_std_install_task AS s SET sort_order = v.ord
         FROM (VALUES ${tuples}) AS v(id, ord)
        WHERE s.id = v.id`,
      values,
    );
    return { success: true };
  } catch (e) {
    return fail((e as Error).message);
  }
}
