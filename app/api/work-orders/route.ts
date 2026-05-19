export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { query, withTransaction } from "@/_lib/db";
import { cleanText, serverError, toNumber } from "@/_lib/http";

function normalizeHelpers(value: unknown) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string") return value.split(",").map((s) => s.trim()).filter(Boolean);
  return [];
}

function parseTaskId(value: unknown) {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : null;
}

function makeWorkOrderCode() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const suffix = Math.random().toString(16).slice(2, 8).toUpperCase();
  return `WO-${y}${m}${d}-${suffix}`;
}

async function listWorkOrders(status?: string) {
  const values: unknown[] = [];
  const where: string[] = [];
  if (status) {
    values.push(status);
    where.push(`wo.status = $${values.length}`);
  }

  const result = await query(
    `
      WITH task_list AS (
        SELECT
          work_order_id,
          json_agg(
            json_build_object(
              'task_id', task_id,
              'task_name', task_name,
              'sort_order', sort_order
            )
            ORDER BY sort_order ASC, id ASC
          ) AS tasks
        FROM odg_work_order_tasks
        GROUP BY work_order_id
      )
      SELECT
        wo.*,
        p.project_name,
        tech.name_1 AS technician_name,
        creator.name_1 AS creator_name,
        COALESCE(tl.tasks, '[]'::json) AS tasks
      FROM odg_work_orders wo
      LEFT JOIN odg_projects p
        ON p.sml_code = wo.project_code OR p.id::text = wo.project_code
      LEFT JOIN odg_technicians tech
        ON tech.code = wo.technician_id OR tech.name_1 = wo.technician_id
      LEFT JOIN biotime_employee creator
        ON creator.code = wo.created_by
      LEFT JOIN task_list tl
        ON tl.work_order_id = wo.id
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY wo.created_at DESC, wo.id DESC
    `,
    values,
  );

  return result.rows;
}

export async function GET(request: NextRequest) {
  try {
    const status = cleanText(request.nextUrl.searchParams.get("status"));
    const rows = await listWorkOrders(status);
    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    return serverError(error, "Load work orders failed");
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const projectCode = cleanText(payload?.project_code);
    const contractNo = cleanText(payload?.contract_no);
    const taskList = Array.isArray(payload?.task_list) ? payload.task_list : [];
    const taskName = cleanText(payload?.task_name || taskList[0]?.task_name || taskList[0]?.task);
    const taskId = parseTaskId(payload?.task_id || taskList[0]?.task_id || taskList[0]?.id);
    const technicianId = cleanText(payload?.technician_id);

    if (!projectCode || !contractNo || !taskName || !technicianId) {
      return NextResponse.json({ success: false, message: "Missing required work order fields" }, { status: 400 });
    }

    const result = await withTransaction(async (client) => {
      const code = makeWorkOrderCode();
      const inserted = await client.query(
        `
          INSERT INTO odg_work_orders (
            code,
            project_code,
            contract_no,
            task_id,
            task_name,
            title,
            description,
            technician_id,
            helper_ids,
            status,
            priority,
            created_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12)
          RETURNING id, code
        `,
        [
          code,
          projectCode,
          contractNo,
          taskId,
          taskName,
          taskName,
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
        const name = cleanText(task?.task_name || task?.task || task?.name);
        if (!name) continue;
        await client.query(
          `
            INSERT INTO odg_work_order_tasks (work_order_id, task_id, task_name, sort_order)
            VALUES ($1, $2, $3, $4)
          `,
          [workOrderId, parseTaskId(task?.task_id || task?.id), name, idx],
        );
      }

      await client.query(
        `INSERT INTO odg_work_order_logs (work_order_id, status, note, actor) VALUES ($1, $2, $3, $4)`,
        [workOrderId, "assigned", "created", cleanText(payload?.created_by) || null],
      );

      return inserted.rows[0];
    });

    return NextResponse.json({ success: true, data: result, ...result });
  } catch (error) {
    return serverError(error, "Create work order failed");
  }
}
