"use server";

import { query, withTransaction } from "@/_lib/db";
import { cleanText, toNumber } from "@/_lib/http";

type Fail = { success: false; message: string };
function fail(message: string): Fail { return { success: false, message }; }

function normalizeHelpers(value: unknown) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string") return value.split(",").map((s) => s.trim()).filter(Boolean);
  return [];
}

function parseTaskId(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function makeWorkOrderCode() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const suffix = Math.random().toString(16).slice(2, 8).toUpperCase();
  return `WO-${y}${m}${d}-${suffix}`;
}

async function fetchWorkOrder(id: number) {
  const result = await query(
    `
      SELECT wo.*, p.project_name, tech.name_1 AS technician_name, creator.name_1 AS creator_name
      FROM odg_work_orders wo
      LEFT JOIN odg_projects p ON p.sml_code = wo.project_code OR p.id::text = wo.project_code
      LEFT JOIN odg_technicians tech ON tech.code = wo.technician_id OR tech.name_1 = wo.technician_id
      LEFT JOIN biotime_employee creator ON creator.code = wo.created_by
      WHERE wo.id = $1 LIMIT 1
    `,
    [id],
  );
  const row = result.rows[0];
  if (!row) return null;

  const [tasks, logs, materials, checkins, helpers] = await Promise.all([
    query(`SELECT task_id, task_name, sort_order FROM odg_work_order_tasks WHERE work_order_id = $1 ORDER BY sort_order ASC, id ASC`, [id]),
    query(`SELECT * FROM odg_work_order_logs WHERE work_order_id = $1 ORDER BY created_at ASC, id ASC`, [id]),
    query(`SELECT * FROM odg_work_order_materials WHERE work_order_id = $1 ORDER BY created_at ASC, id ASC`, [id]),
    query(`SELECT * FROM odg_work_order_checkins WHERE work_order_id = $1 ORDER BY created_at ASC, id ASC`, [id]),
    query(`SELECT code, name_1 FROM odg_technicians ORDER BY name_1 ASC`, []),
  ]);

  return {
    ...row,
    tasks: tasks.rows,
    logs: logs.rows,
    materials: materials.rows,
    checkins: checkins.rows,
    helper_lookup: helpers.rows,
  };
}

export async function getWorkOrders(opts: { status?: string } = {}): Promise<{ success: true; data: unknown[] } | Fail> {
  try {
    const values: unknown[] = [];
    const where: string[] = [];
    const status = cleanText(opts.status);
    if (status) { values.push(status); where.push(`wo.status = $${values.length}`); }

    const result = await query(
      `
        WITH task_list AS (
          SELECT work_order_id,
            json_agg(json_build_object('task_id', task_id, 'task_name', task_name, 'sort_order', sort_order) ORDER BY sort_order ASC, id ASC) AS tasks
          FROM odg_work_order_tasks GROUP BY work_order_id
        )
        SELECT wo.*, p.project_name, tech.name_1 AS technician_name, creator.name_1 AS creator_name,
               COALESCE(tl.tasks, '[]'::json) AS tasks
        FROM odg_work_orders wo
        LEFT JOIN odg_projects p ON p.sml_code = wo.project_code OR p.id::text = wo.project_code
        LEFT JOIN odg_technicians tech ON tech.code = wo.technician_id OR tech.name_1 = wo.technician_id
        LEFT JOIN biotime_employee creator ON creator.code = wo.created_by
        LEFT JOIN task_list tl ON tl.work_order_id = wo.id
        ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
        ORDER BY wo.created_at DESC, wo.id DESC
      `,
      values,
    );
    return { success: true, data: result.rows };
  } catch (e) { return fail((e as Error).message); }
}

export async function createWorkOrder(payload: any): Promise<{ success: true; data: any; id: any; code: any } | Fail> {
  try {
    const projectCode = cleanText(payload?.project_code);
    const contractNo = cleanText(payload?.contract_no);
    const taskList = Array.isArray(payload?.task_list) ? payload.task_list : [];
    const taskName = cleanText(payload?.task_name || taskList[0]?.task_name || taskList[0]?.task);
    const taskId = parseTaskId(payload?.task_id || taskList[0]?.task_id || taskList[0]?.id);
    const technicianId = cleanText(payload?.technician_id);

    if (!projectCode || !contractNo || !taskName || !technicianId) {
      return fail("Missing required work order fields");
    }

    const result = await withTransaction(async (client) => {
      const code = makeWorkOrderCode();
      const inserted = await client.query(
        `INSERT INTO odg_work_orders (
          code, project_code, contract_no, task_id, task_name, title, description,
          technician_id, helper_ids, status, priority, created_by
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12)
        RETURNING id, code`,
        [
          code, projectCode, contractNo, taskId, taskName, taskName,
          cleanText(payload?.description),
          technicianId,
          JSON.stringify(normalizeHelpers(payload?.helper_ids)),
          cleanText(payload?.status) || "assigned",
          cleanText(payload?.priority) || "Normal",
          cleanText(payload?.created_by) || null,
        ],
      );

      const workOrderId = inserted.rows[0].id;
      const tasks = taskList.length ? taskList : [{ task_id: taskId, task_name: taskName }];
      for (const [idx, task] of tasks.entries()) {
        const name = cleanText((task as any)?.task_name || (task as any)?.task || (task as any)?.name);
        if (!name) continue;
        await client.query(
          `INSERT INTO odg_work_order_tasks (work_order_id, task_id, task_name, sort_order) VALUES ($1,$2,$3,$4)`,
          [workOrderId, parseTaskId((task as any)?.task_id || (task as any)?.id), name, idx],
        );
      }

      await client.query(
        `INSERT INTO odg_work_order_logs (work_order_id, status, note, actor) VALUES ($1,$2,$3,$4)`,
        [workOrderId, "assigned", "created", cleanText(payload?.created_by) || null],
      );

      return inserted.rows[0];
    });

    return { success: true, data: result, id: result.id, code: result.code };
  } catch (e) { return fail((e as Error).message); }
}

export async function getWorkOrder(id: string | number): Promise<Record<string, unknown> | Fail> {
  try {
    const wo = await fetchWorkOrder(Number(id));
    if (!wo) return fail("Work order not found");
    return wo;
  } catch (e) { return fail((e as Error).message); }
}

export async function updateWorkOrder(id: string | number, payload: any): Promise<{ success: true; data: any } | Fail> {
  try {
    const workOrderId = Number(id);
    const taskList = Array.isArray(payload?.task_list) ? payload.task_list : [];
    const taskName = cleanText(payload?.task_name || taskList[0]?.task_name || taskList[0]?.task);
    const taskId = parseTaskId(payload?.task_id || taskList[0]?.task_id || taskList[0]?.id);

    await withTransaction(async (client) => {
      await client.query(
        `UPDATE odg_work_orders SET
          project_code = $1, contract_no = $2, task_id = $3, task_name = $4,
          title = $5, description = $6, technician_id = $7, helper_ids = $8::jsonb,
          priority = $9, status = COALESCE(NULLIF($10, ''), status), updated_at = NOW()
         WHERE id = $11`,
        [
          cleanText(payload?.project_code), cleanText(payload?.contract_no),
          taskId, taskName, taskName, cleanText(payload?.description),
          cleanText(payload?.technician_id),
          JSON.stringify(normalizeHelpers(payload?.helper_ids)),
          cleanText(payload?.priority) || "Normal",
          cleanText(payload?.status),
          workOrderId,
        ],
      );

      await client.query(`DELETE FROM odg_work_order_tasks WHERE work_order_id = $1`, [workOrderId]);
      const tasks = taskList.length ? taskList : [{ task_id: taskId, task_name: taskName }];
      for (const [idx, task] of tasks.entries()) {
        const name = cleanText((task as any)?.task_name || (task as any)?.task || (task as any)?.name);
        if (!name) continue;
        await client.query(
          `INSERT INTO odg_work_order_tasks (work_order_id, task_id, task_name, sort_order) VALUES ($1,$2,$3,$4)`,
          [workOrderId, parseTaskId((task as any)?.task_id || (task as any)?.id), name, idx],
        );
      }
    });

    return { success: true, data: await fetchWorkOrder(workOrderId) };
  } catch (e) { return fail((e as Error).message); }
}

export async function deleteWorkOrder(id: string | number): Promise<{ success: true } | Fail> {
  try {
    const workOrderId = Number(id);
    await withTransaction(async (client) => {
      await client.query(`DELETE FROM odg_work_order_checkins WHERE work_order_id = $1`, [workOrderId]);
      await client.query(`DELETE FROM odg_work_order_logs WHERE work_order_id = $1`, [workOrderId]);
      await client.query(`DELETE FROM odg_work_order_materials WHERE work_order_id = $1`, [workOrderId]);
      await client.query(`DELETE FROM odg_work_order_tasks WHERE work_order_id = $1`, [workOrderId]);
      await client.query(`DELETE FROM odg_work_orders WHERE id = $1`, [workOrderId]);
    });
    return { success: true };
  } catch (e) { return fail((e as Error).message); }
}

export async function saveWorkSchedule(payload: any): Promise<{ success: true } | Fail> {
  try {
    const projectCode = cleanText(payload?.project_code);
    const contractNo = cleanText(payload?.contract_no);
    const tasks = Array.isArray(payload?.tasks) ? payload.tasks : [];

    if (!projectCode) return fail("Missing project_code");

    await withTransaction(async (client) => {
      await client.query(
        `DELETE FROM odg_work_schedule WHERE project_code = $1 AND coalesce(contract_no, '') = coalesce($2, '')`,
        [projectCode, contractNo],
      );
      for (const [idx, task] of tasks.entries()) {
        await client.query(
          `INSERT INTO odg_work_schedule (
            project_code, contract_no, phase, task, owner,
            start_date, end_date, progress, status, sort_order
          ) VALUES ($1,$2,$3,$4,$5,NULLIF($6,'')::date,NULLIF($7,'')::date,$8,$9,$10)`,
          [
            projectCode, contractNo || null,
            cleanText((task as any)?.phase),
            cleanText((task as any)?.task || (task as any)?.task_name || (task as any)?.name),
            cleanText((task as any)?.owner),
            cleanText((task as any)?.start || (task as any)?.start_date),
            cleanText((task as any)?.end || (task as any)?.end_date),
            toNumber((task as any)?.progress, 0),
            cleanText((task as any)?.status),
            idx,
          ],
        );
      }
    });

    return { success: true };
  } catch (e) { return fail((e as Error).message); }
}

export async function getWorkSchedule(projectCode: string, contractNo: string): Promise<{ success: true; data: unknown[] } | Fail> {
  try {
    const result = await query(
      `SELECT id, id AS master_id, phase, task, task AS task_name, owner,
              start_date AS start, end_date AS "end", progress, status, sort_order
       FROM odg_work_schedule
       WHERE project_code = $1 AND coalesce(contract_no, '') = coalesce($2, '')
       ORDER BY sort_order ASC, id ASC`,
      [decodeURIComponent(projectCode), decodeURIComponent(contractNo)],
    );
    return { success: true, data: result.rows };
  } catch (e) { return fail((e as Error).message); }
}
