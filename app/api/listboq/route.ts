export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { query } from "@/_lib/db";
import { cleanText, serverError } from "@/_lib/http";
import { NextResponse } from "next/server";

/**
 * GET /api/listboq?include_items=1&item={search}
 *
 * Returns BOQ documents with per-item withdraw totals computed from
 * `odg_requests` + `odg_requests_detail` (joined on doc_ref = boq.doc_no).
 *
 * Counts include all requests regardless of approval/withdrawal status.
 */
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const includeItems = cleanText(params.get("include_items")) === "1";
    const itemSearch = cleanText(params.get("item"));

    const values: unknown[] = [];
    let itemFilter = "";
    if (itemSearch) {
      values.push(`%${itemSearch}%`);
      itemFilter = `
        AND EXISTS (
          SELECT 1
          FROM odg_projects_boq_detail fd
          WHERE fd.doc_no = b.doc_no
            AND (fd.item_code ILIKE $${values.length} OR fd.item_name ILIKE $${values.length})
        )
      `;
    }

    const result = await query(
      `
        WITH requested_per_item AS (
          -- Per (BOQ doc_no, item_code): split pending vs withdrawn qty.
          --   request_qty  = qty from requests where doc_success = 0 (pending)
          --   withdraw_qty = qty from requests where doc_success = 1 (fulfilled)
          SELECT
            r.doc_ref AS boq_doc_no,
            d.item_code,
            SUM(CASE WHEN COALESCE(r.doc_success, 0) = 0 THEN d.qty ELSE 0 END)::numeric AS request_qty,
            SUM(CASE WHEN COALESCE(r.doc_success, 0) = 1 THEN d.qty ELSE 0 END)::numeric AS withdraw_qty
          FROM odg_requests r
          INNER JOIN odg_requests_detail d ON d.doc_no = r.doc_no
          WHERE r.doc_ref IS NOT NULL AND r.doc_ref <> ''
          GROUP BY r.doc_ref, d.item_code
        ),
        requested_per_boq AS (
          SELECT
            boq_doc_no,
            SUM(request_qty)::numeric  AS total_request,
            SUM(withdraw_qty)::numeric AS total_withdraw
          FROM requested_per_item
          GROUP BY boq_doc_no
        ),
        boq_totals AS (
          SELECT
            bd.doc_no,
            COUNT(*)::int AS total_items,
            COALESCE(SUM(bd.qty), 0)::numeric AS boq_total_qty,
            json_agg(
              json_build_object(
                'item_code',   bd.item_code,
                'item_name',   bd.item_name,
                'qty',         bd.qty,
                'boq_qty',     bd.qty,
                'unit_code',   bd.unit_code,
                'contract_id', bd.contract_id,
                'project_id',  bd.project_id,
                'request_qty', COALESCE(rpi.request_qty, 0),
                'withdraw',    COALESCE(rpi.withdraw_qty, 0),
                'withdraw_qty',COALESCE(rpi.withdraw_qty, 0),
                'balance',     GREATEST(bd.qty - COALESCE(rpi.request_qty, 0) - COALESCE(rpi.withdraw_qty, 0), 0)
              )
              ORDER BY bd.roworder ASC
            ) AS boq_list
          FROM odg_projects_boq_detail bd
          LEFT JOIN requested_per_item rpi
            ON rpi.boq_doc_no = bd.doc_no AND rpi.item_code = bd.item_code
          GROUP BY bd.doc_no
        )
        SELECT
          b.roworder AS id,
          b.doc_no,
          b.doc_date,
          b.cust_code,
          b.project_id,
          b.user_created,
          COALESCE(b.approve_status, 0)::int AS approve_status,
          b.approver,
          b.contract_id,
          p.project_name,
          p.coordinator,
          p.phone,
          p.image_url,
          c.contract_no,
          c.contract_name,
          COALESCE(t.total_items, 0)::int                 AS total_items,
          COALESCE(t.boq_total_qty, 0)::numeric           AS boq_total_qty,
          COALESCE(rpb.total_request, 0)::numeric         AS request_total_qty,
          COALESCE(rpb.total_withdraw, 0)::numeric        AS withdraw_total_qty
          ${includeItems ? ", COALESCE(t.boq_list, '[]'::json) AS boq_list" : ""}
        FROM odg_projects_boq b
        LEFT JOIN odg_projects p
          ON p.id::text = b.project_id::text
        LEFT JOIN odg_projects_contract c
          ON c.roworder = b.contract_id
        LEFT JOIN boq_totals t
          ON t.doc_no = b.doc_no
        LEFT JOIN requested_per_boq rpb
          ON rpb.boq_doc_no = b.doc_no
        WHERE 1=1
        ${itemFilter}
        ORDER BY b.doc_date DESC NULLS LAST, b.roworder DESC
      `,
      values,
    );

    return NextResponse.json(result.rows);
  } catch (error) {
    return serverError(error, "Load BOQ list failed");
  }
}
