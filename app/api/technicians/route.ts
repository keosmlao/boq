export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/_lib/db";
import { cleanText, serverError } from "@/_lib/http";

export async function GET() {
  try {
    const result = await query(`
      SELECT roworder, code, name_1, phone, role, helpers, created_at
      FROM odg_technicians
      ORDER BY role DESC, name_1 ASC, code ASC
    `);
    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    return serverError(error, "Load technicians failed");
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const result = await query(
      `
        INSERT INTO odg_technicians (code, name_1, phone, role, helpers)
        VALUES ($1, $2, $3, $4, $5::jsonb)
        RETURNING roworder
      `,
      [
        cleanText(payload?.code),
        cleanText(payload?.name_1 || payload?.name),
        cleanText(payload?.phone),
        cleanText(payload?.role) || "technician",
        JSON.stringify(Array.isArray(payload?.helpers) ? payload.helpers : []),
      ],
    );
    return NextResponse.json({ success: true, roworder: result.rows[0]?.roworder });
  } catch (error) {
    return serverError(error, "Create technician failed");
  }
}
