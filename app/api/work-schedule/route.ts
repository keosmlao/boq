export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { withTransaction } from "@/_lib/db";
import { cleanText, serverError, toNumber } from "@/_lib/http";

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const projectCode = cleanText(payload?.project_code);
    const contractNo = cleanText(payload?.contract_no);
    const tasks = Array.isArray(payload?.tasks) ? payload.tasks : [];

    if (!projectCode) {
      return NextResponse.json({ success: false, message: "Missing project_code" }, { status: 400 });
    }

    await withTransaction(async (client) => {
      await client.query(
        `DELETE FROM odg_work_schedule WHERE project_code = $1 AND coalesce(contract_no, '') = coalesce($2, '')`,
        [projectCode, contractNo],
      );

      for (const [idx, task] of tasks.entries()) {
        await client.query(
          `
            INSERT INTO odg_work_schedule (
              project_code,
              contract_no,
              phase,
              task,
              owner,
              start_date,
              end_date,
              progress,
              status,
              sort_order
            ) VALUES ($1, $2, $3, $4, $5, NULLIF($6, '')::date, NULLIF($7, '')::date, $8, $9, $10)
          `,
          [
            projectCode,
            contractNo || null,
            cleanText(task?.phase),
            cleanText(task?.task || task?.task_name || task?.name),
            cleanText(task?.owner),
            cleanText(task?.start || task?.start_date),
            cleanText(task?.end || task?.end_date),
            toNumber(task?.progress, 0),
            cleanText(task?.status),
            idx,
          ],
        );
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return serverError(error, "Save work schedule failed");
  }
}
