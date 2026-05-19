export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { query } from "@/_lib/db";
import { serverError } from "@/_lib/http";

export async function GET() {
  try {
    const result = await query(`
      SELECT
        id,
        code,
        phase,
        task,
        task AS name,
        owner,
        status
      FROM odg_task_master
      ORDER BY id ASC
    `);
    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    return serverError(error, "Load tasks failed");
  }
}
