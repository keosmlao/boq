export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/_lib/db";
import { serverError } from "@/_lib/http";

type Params = { params: Promise<{ projectCode: string; contractNo: string }> };

export async function GET(_request: NextRequest, context: Params) {
  try {
    const { projectCode, contractNo } = await context.params;
    const result = await query(
      `
        SELECT
          id,
          id AS master_id,
          phase,
          task,
          task AS task_name,
          owner,
          start_date AS start,
          end_date AS "end",
          progress,
          status,
          sort_order
        FROM odg_work_schedule
        WHERE project_code = $1
          AND coalesce(contract_no, '') = coalesce($2, '')
        ORDER BY sort_order ASC, id ASC
      `,
      [decodeURIComponent(projectCode), decodeURIComponent(contractNo)],
    );
    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    return serverError(error, "Load work schedule failed");
  }
}
