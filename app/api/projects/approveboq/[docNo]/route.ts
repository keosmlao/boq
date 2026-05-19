export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/_lib/db";
import { serverError, toNumber } from "@/_lib/http";

type Params = { params: Promise<{ docNo: string }> };

export async function PUT(request: NextRequest, context: Params) {
  try {
    const { docNo } = await context.params;
    const decodedDocNo = decodeURIComponent(docNo);
    const payload = await request.json().catch(() => ({}));
    const status = toNumber(payload?.status, 0);
    const username = payload?.username ? String(payload.username) : null;

    await query(
      `
        UPDATE odg_projects_boq
        SET approve_status = $1,
            approver = $2
        WHERE doc_no = $3
      `,
      [status, username, decodedDocNo],
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    return serverError(error, "Approve BOQ failed");
  }
}
