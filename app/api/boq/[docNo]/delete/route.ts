export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { withTransaction } from "@/_lib/db";
import { serverError } from "@/_lib/http";

type Params = { params: Promise<{ docNo: string }> };

export async function DELETE(_request: NextRequest, context: Params) {
  try {
    const { docNo } = await context.params;
    const decodedDocNo = decodeURIComponent(docNo);

    await withTransaction(async (client) => {
      await client.query(`DELETE FROM odg_projects_boq_detail WHERE doc_no = $1`, [decodedDocNo]);
      await client.query(`DELETE FROM odg_projects_boq WHERE doc_no = $1`, [decodedDocNo]);
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return serverError(error, "Delete BOQ failed");
  }
}
