export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { query } from "@/_lib/db";
import { fail, ok, serverError } from "@/_lib/http";
import {
  cleanText,
  dateOrNull,
  ensureRequestsSchema,
  generateRequestDocNo,
  num,
} from "./_schema";

/**
 * GET /api/requests?status={0|1|all}&project_id={id}
 *
 * Returns material request documents (ໃບຂໍເບີກ) with line items + a summary
 * of any matching withdrawal (from `odg_withdraw_info`, joined by
 * `withdraw_doc_no`).
 */
export async function GET(request: NextRequest) {
  try {
    await ensureRequestsSchema();
    const url = new URL(request.url);
    const status = url.searchParams.get("status") || "all";
    const projectId = url.searchParams.get("project_id");

    const conds: string[] = [];
    const params: unknown[] = [];
    if (status === "0" || status === "1") {
      params.push(Number(status));
      conds.push(`r.doc_success = $${params.length}`);
    }
    if (projectId) {
      params.push(Number(projectId));
      conds.push(`r.project_id = $${params.length}`);
    }
    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";

    const result = await query(
      `
      SELECT
        r.doc_no,
        r.doc_date,
        r.doc_ref,
        r.project_id,
        r.contract_no,
        r.cust_code,
        r.wh_from,
        r.location_from,
        r.creator_code,
        r.requester_name,
        r.remark,
        r.doc_success,
        r.withdraw_doc_no,
        r.withdraw_date,
        r.created_at,
        p.project_name,
        COALESCE((
          SELECT json_agg(json_build_object(
            'item_code', d.item_code,
            'item_name', d.item_name,
            'unit_code', d.unit_code,
            'qty', d.qty,
            'remark', d.remark
          ) ORDER BY d.line_no, d.id)
          FROM odg_requests_detail d
          WHERE d.doc_no = r.doc_no
        ), '[]'::json) AS list,
        CASE WHEN r.withdraw_doc_no IS NOT NULL THEN 1 ELSE 0 END AS withdraw_count,
        CASE
          WHEN r.withdraw_doc_no IS NOT NULL
          THEN ARRAY[r.withdraw_doc_no]::text[]
          ELSE ARRAY[]::text[]
        END AS withdraw_docs,
        CASE
          WHEN wd.first_date IS NOT NULL
          THEN ARRAY[to_char(wd.first_date, 'YYYY-MM-DD')]::text[]
          ELSE ARRAY[]::text[]
        END AS withdraw_dates,
        CASE
          WHEN wd.users IS NOT NULL
          THEN ARRAY[wd.users]::text[]
          ELSE ARRAY[]::text[]
        END AS withdraw_names,
        CASE
          WHEN wd.wh_names IS NOT NULL
          THEN ARRAY[wd.wh_names]::text[]
          ELSE ARRAY[]::text[]
        END AS withdraw_wh_labels,
        CASE
          WHEN wd.shelf_names IS NOT NULL
          THEN ARRAY[wd.shelf_names]::text[]
          ELSE ARRAY[]::text[]
        END AS withdraw_location_labels
      FROM odg_requests r
      LEFT JOIN odg_projects p ON p.id = r.project_id
      LEFT JOIN LATERAL (
        SELECT
          MIN(w.doc_date)                          AS first_date,
          STRING_AGG(DISTINCT w.createuser, ', ') AS users,
          STRING_AGG(DISTINCT w.wh_name,    ', ') AS wh_names,
          STRING_AGG(DISTINCT w.shelf_name, ', ') AS shelf_names
        FROM odg_withdraw_info w
        WHERE w.doc_no = r.withdraw_doc_no
      ) wd ON r.withdraw_doc_no IS NOT NULL
      ${where}
      ORDER BY r.doc_date DESC, r.doc_no DESC
      LIMIT 1000
      `,
      params,
    );
    return ok(result.rows);
  } catch (error) {
    return serverError(error);
  }
}

/**
 * POST /api/requests
 *
 * Create a new material request. Generates doc_no if not provided.
 *
 * Body:
 *   {
 *     doc_date, doc_ref?, project_id?, contract_no?, cust_code?,
 *     wh_from?, location_from?, creator_code?, requester_name?, remark?,
 *     items: [{ item_code, item_name, unit_code, qty, remark? }]
 *   }
 */
export async function POST(request: NextRequest) {
  try {
    await ensureRequestsSchema();
    const body = await request.json().catch(() => ({}));
    const items: any[] = Array.isArray(body?.items) ? body.items : [];
    if (items.length === 0) {
      return fail("At least one item is required", 400);
    }

    const docNo = cleanText(body.doc_no) || (await generateRequestDocNo());
    const docDate = dateOrNull(body.doc_date) || new Date().toISOString().slice(0, 10);

    // Insert header
    await query(
      `
      INSERT INTO odg_requests (
        doc_no, doc_date, doc_ref, project_id, contract_no, cust_code,
        wh_from, location_from, creator_code, requester_name, remark,
        doc_success, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11,
        0, now(), now()
      )
      `,
      [
        docNo,
        docDate,
        cleanText(body.doc_ref),
        body.project_id ? Number(body.project_id) : null,
        cleanText(body.contract_no),
        cleanText(body.cust_code),
        cleanText(body.wh_from || body.warehouse_code),
        cleanText(body.location_from || body.location_code),
        cleanText(body.creator_code),
        cleanText(body.requester_name),
        cleanText(body.remark),
      ],
    );

    // Insert detail rows
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      await query(
        `
        INSERT INTO odg_requests_detail (
          doc_no, line_no, item_code, item_name, unit_code, qty, remark
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          docNo,
          i + 1,
          cleanText(it.item_code),
          cleanText(it.item_name),
          cleanText(it.unit_code),
          num(it.qty),
          cleanText(it.remark),
        ],
      );
    }

    return ok({ success: true, doc_no: docNo, data: { doc_no: docNo } });
  } catch (error) {
    return serverError(error);
  }
}
