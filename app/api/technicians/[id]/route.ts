export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/_lib/db";
import { cleanText, serverError } from "@/_lib/http";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, context: Params) {
  try {
    const { id } = await context.params;
    const payload = await request.json();
    const updates: string[] = [];
    const values: unknown[] = [];

    if (payload?.code !== undefined) {
      values.push(cleanText(payload.code));
      updates.push(`code = $${values.length}`);
    }
    if (payload?.name_1 !== undefined || payload?.name !== undefined) {
      values.push(cleanText(payload.name_1 || payload.name));
      updates.push(`name_1 = $${values.length}`);
    }
    if (payload?.phone !== undefined) {
      values.push(cleanText(payload.phone));
      updates.push(`phone = $${values.length}`);
    }
    if (payload?.role !== undefined) {
      values.push(cleanText(payload.role));
      updates.push(`role = $${values.length}`);
    }
    if (payload?.helpers !== undefined) {
      values.push(JSON.stringify(Array.isArray(payload.helpers) ? payload.helpers : []));
      updates.push(`helpers = $${values.length}::jsonb`);
    }

    if (!updates.length) return NextResponse.json({ success: true });

    values.push(Number(id));
    await query(
      `
        UPDATE odg_technicians
        SET ${updates.join(", ")}
        WHERE roworder = $${values.length}
      `,
      values,
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    return serverError(error, "Update technician failed");
  }
}

export async function DELETE(_request: NextRequest, context: Params) {
  try {
    const { id } = await context.params;
    await query(`DELETE FROM odg_technicians WHERE roworder = $1`, [Number(id)]);
    return NextResponse.json({ success: true });
  } catch (error) {
    return serverError(error, "Delete technician failed");
  }
}
