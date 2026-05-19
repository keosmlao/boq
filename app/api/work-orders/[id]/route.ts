export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { query, withTransaction } from "@/_lib/db";
import { cleanText, serverError } from "@/_lib/http";

type Params = { params: Promise<{ id: string }> };

function normalizeHelpers(value: unknown) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string") return value.split(",").map((s) => s.trim()).filter(Boolean);
  return [];
}

function parseTaskId(value: unknown) {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : null;
}

async function getWorkOrder(id: number) {
  const result = await query(
    `
      SELECT
        wo.*,
        p.project_name,
        tech.name_1 AS technician_name,
        creator.name_1 AS creator_name
      FROM odg_work_orders wo
      LEFT JOIN odg_projects p
        ON p.sml_code = wo.project_code OR p.id::text = wo.project_code
      LEFT JOIN odg_technicians tech
        ON tech.code = wo.technician_id OR tech.name_1 = wo.technician_id
      LEFT JOIN biotime_employee creator
        ON creator.code = wo.created_by
      WHERE wo.id = $1
      LIMIT 1
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

export async function GET(_request: NextRequest, context: Params) {
  try {
    const { id } = await context.params;
    const workOrder = await getWorkOrder(Number(id));
    if (!workOrder) {
      return NextResponse.json({ success: false, message: "Work order not found" }, { status: 404 });
    }
    return NextResponse.json(workOrder);
  } catch (error) {
    return serverError(error, "Load work order failed");
  }
}

export async function PUT(request: NextRequest, context: Params) {
  try {
    const { id } = await context.params;
    const workOrderId = Number(id);
    const payload = await request.json();
    const taskList = Array.isArray(payload?.task_list) ? payload.task_list : [];
    const taskName = cleanText(payload?.task_name || taskList[0]?.task_name || taskList[0]?.task);
    const taskId = parseTaskId(payload?.task_id || taskList[0]?.task_id || taskList[0]?.id);

    await withTransaction(async (client) => {
      await client.query(
        `
          UPDATE odg_work_orders
          SET project_code = $1,
              contract_no = $2,
              task_id = $3,
              task_name = $4,
              title = $5,
              description = $6,
              technician_id = $7,
              helper_ids = $8::jsonb,
              priority = $9,
              status = COALESCE(NULLIF($10, ''), status),
              updated_at = NOW()
          WHERE id = $11
        `,
        [
          cleanText(payload?.project_code),
          cleanText(payload?.contract_no),
          taskId,
          taskName,
          taskName,
          cleanText(payload?.description),
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
        const name = cleanText(task?.task_name || task?.task || task?.name);
        if (!name) continue;
        await client.query(
          `INSERT INTO odg_work_order_tasks (work_order_id, task_id, task_name, sort_order) VALUES ($1, $2, $3, $4)`,
          [workOrderId, parseTaskId(task?.task_id || task?.id), name, idx],
        );
      }
    });

    return NextResponse.json({ success: true, data: await getWorkOrder(workOrderId) });
  } catch (error) {
    return serverError(error, "Update work order failed");
  }
}

export async function DELETE(_request: NextRequest, context: Params) {
  try {
    const { id } = await context.params;
    const workOrderId = Number(id);
    await withTransaction(async (client) => {
      await client.query(`DELETE FROM odg_work_order_checkins WHERE work_order_id = $1`, [workOrderId]);
      await client.query(`DELETE FROM odg_work_order_logs WHERE work_order_id = $1`, [workOrderId]);
      await client.query(`DELETE FROM odg_work_order_materials WHERE work_order_id = $1`, [workOrderId]);
      await client.query(`DELETE FROM odg_work_order_tasks WHERE work_order_id = $1`, [workOrderId]);
      await client.query(`DELETE FROM odg_work_orders WHERE id = $1`, [workOrderId]);
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return serverError(error, "Delete work order failed");
  }
}
