export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/_lib/db";
import { serverError } from "@/_lib/http";

type Params = { params: Promise<{ docNo: string }> };

/**
 * GET /api/boq/{docNo}
 * Returns a BOQ document with its items. Each item includes `withdraw_qty`
 * aggregated from all material requests (`odg_requests_detail`) that reference
 * this BOQ via `doc_ref`.
 */
export async function GET(_request: NextRequest, context: Params) {
  try {
    const { docNo } = await context.params;
    const decodedDocNo = decodeURIComponent(docNo);

    const header = await query(
      `
        SELECT
          b.*,
          p.project_name,
          p.coordinator,
          p.phone,
          p.image_url,
          c.contract_no,
          c.contract_name
        FROM odg_projects_boq b
        LEFT JOIN odg_projects p
          ON p.id::text = b.project_id::text
        LEFT JOIN odg_projects_contract c
          ON c.roworder = b.contract_id
        WHERE b.doc_no = $1
        LIMIT 1
      `,
      [decodedDocNo],
    );

    if (!header.rows[0]) {
      return NextResponse.json(
        { success: false, message: "BOQ not found" },
        { status: 404 },
      );
    }

    const details = await query(
      `
        WITH requested_per_item AS (
          SELECT
            d.item_code,
            SUM(CASE WHEN COALESCE(r.doc_success, 0) = 0 THEN d.qty ELSE 0 END)::numeric AS request_qty,
            SUM(CASE WHEN COALESCE(r.doc_success, 0) = 1 THEN d.qty ELSE 0 END)::numeric AS withdraw_qty
          FROM odg_requests r
          INNER JOIN odg_requests_detail d ON d.doc_no = r.doc_no
          WHERE r.doc_ref = $1
          GROUP BY d.item_code
        )
        SELECT
          bd.roworder,
          bd.doc_no,
          bd.doc_date,
          bd.cust_code,
          bd.item_code,
          bd.item_name,
          bd.qty,
          bd.qty AS boq_qty,
          bd.unit_code,
          bd.contract_id,
          bd.project_id,
          COALESCE(rpi.request_qty, 0)::numeric  AS request_qty,
          COALESCE(rpi.withdraw_qty, 0)::numeric AS withdraw,
          COALESCE(rpi.withdraw_qty, 0)::numeric AS withdraw_qty,
          GREATEST(bd.qty - COALESCE(rpi.request_qty, 0) - COALESCE(rpi.withdraw_qty, 0), 0)::numeric AS balance
        FROM odg_projects_boq_detail bd
        LEFT JOIN requested_per_item rpi ON rpi.item_code = bd.item_code
        WHERE bd.doc_no = $1
        ORDER BY bd.roworder ASC
      `,
      [decodedDocNo],
    );

    const boqTotal = details.rows.reduce(
      (sum, item) => sum + Number(item.qty || 0),
      0,
    );
    const requestTotal = details.rows.reduce(
      (sum, item) => sum + Number(item.request_qty || 0),
      0,
    );
    const withdrawTotal = details.rows.reduce(
      (sum, item) => sum + Number(item.withdraw || 0),
      0,
    );

    return NextResponse.json({
      ...header.rows[0],
      boq_list: details.rows,
      total_items: details.rows.length,
      boq_total_qty: boqTotal,
      request_total_qty: requestTotal,
      withdraw_total_qty: withdrawTotal,
      remaining_total_qty: Math.max(boqTotal - requestTotal - withdrawTotal, 0),
    });
  } catch (error) {
    return serverError(error, "Load BOQ failed");
  }
}
