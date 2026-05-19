export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { query } from "@/_lib/db";
import { fail, ok, serverError } from "@/_lib/http";
import {
  cleanText,
  dateOrNull,
  ensureRequestsSchema,
  num,
} from "../../requests/_schema";

/**
 * GET /api/requestsparepart/{docNo}
 *
 * Returns a single material request with its line items + linked BOQ ref.
 * Powers the edit modal in listrequest.tsx.
 */
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ docNo: string }> },
) {
  try {
    await ensureRequestsSchema();
    const { docNo } = await ctx.params;
    const decoded = decodeURIComponent(docNo);

    const header = await query(
      `
      SELECT
        r.doc_no, r.doc_date, r.doc_ref, r.project_id, r.contract_no,
        r.cust_code, r.wh_from, r.location_from, r.creator_code,
        r.requester_name, r.remark, r.doc_success, r.withdraw_doc_no,
        r.withdraw_date, r.created_at, r.updated_at,
        p.project_name
      FROM odg_requests r
      LEFT JOIN odg_projects p ON p.id = r.project_id
      WHERE r.doc_no = $1
      LIMIT 1
      `,
      [decoded],
    );
    if (!header.rows.length) return fail("Request not found", 404);

    const items = await query(
      `
      SELECT line_no, item_code, item_name, unit_code, qty, remark
      FROM odg_requests_detail
      WHERE doc_no = $1
      ORDER BY line_no, id
      `,
      [decoded],
    );

    const row = header.rows[0];
    return ok({
      ...row,
      items: items.rows,
    });
  } catch (error) {
    return serverError(error);
  }
}

/**
 * PUT /api/requestsparepart/{docNo}
 *
 * Update a request's header + replace its line items. Refuses if already
 * withdrawn. The frontend sends:
 *   { doc_date, remark, warehouse_code, location_code, items: [...] }
 */
export async function PUT(
  request: Request,
  ctx: { params: Promise<{ docNo: string }> },
) {
  try {
    await ensureRequestsSchema();
    const { docNo } = await ctx.params;
    const decoded = decodeURIComponent(docNo);
    const body = await request.json().catch(() => ({}));

    const existing = await query(
      `SELECT doc_success FROM odg_requests WHERE doc_no = $1 LIMIT 1`,
      [decoded],
    );
    if (!existing.rows.length) return fail("Request not found", 404);
    if (Number(existing.rows[0].doc_success) === 1) {
      return fail("ALREADY_WITHDRAWN", 409);
    }

    const items: any[] = Array.isArray(body?.items) ? body.items : [];

    // Update header
    await query(
      `
      UPDATE odg_requests
         SET doc_date      = COALESCE($2, doc_date),
             remark        = $3,
             wh_from       = $4,
             location_from = $5,
             updated_at    = now()
       WHERE doc_no = $1
      `,
      [
        decoded,
        dateOrNull(body.doc_date),
        cleanText(body.remark),
        cleanText(body.warehouse_code || body.wh_from),
        cleanText(body.location_code || body.location_from),
      ],
    );

    // Replace details
    await query(`DELETE FROM odg_requests_detail WHERE doc_no = $1`, [decoded]);
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const qty = num(it.qty);
      if (qty <= 0) continue;
      await query(
        `
        INSERT INTO odg_requests_detail (
          doc_no, line_no, item_code, item_name, unit_code, qty, remark
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          decoded,
          i + 1,
          cleanText(it.item_code),
          cleanText(it.item_name),
          cleanText(it.unit_code),
          qty,
          cleanText(it.remark),
        ],
      );
    }

    return ok({ success: true, message: "Updated" });
  } catch (error) {
    return serverError(error);
  }
}
