export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { query } from "@/_lib/db";
import { serverError } from "@/_lib/http";

export async function GET() {
  try {
    const result = await query(`
      SELECT roworder, code, name_1, phone, role
      FROM odg_technicians
      WHERE lower(coalesce(role, '')) IN ('assistant', 'helper', 'technician', 'lead')
      ORDER BY role ASC, name_1 ASC, code ASC
    `);
    return NextResponse.json({ success: true, data: { data: result.rows } });
  } catch (error) {
    return serverError(error, "Load helpers failed");
  }
}
