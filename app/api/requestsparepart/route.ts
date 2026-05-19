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
} from "../requests/_schema";

/**
 * POST /api/requestsparepart
 *
 * Create a material request (ໃບຂໍເບີກ). Called by BoqRequestModal — the
 * payload uses `requester`, `warehouse_code`, `location_code`, `doc_ref`
 * (the originating BOQ doc_no). If `project_id` is not provided, it's
 * derived from the BOQ ref.
 *
 * Returns `{ success, doc_no }` at root so the modal can pick it up.
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
    const docRef = cleanText(body.doc_ref);

    // Derive project_id from BOQ ref when not provided
    let projectId: number | null = body.project_id ? Number(body.project_id) : null;
    if (!projectId && docRef) {
      const r = await query(
        `SELECT project_id FROM odg_projects_boq WHERE doc_no = $1 LIMIT 1`,
        [docRef],
      );
      if (r.rows.length) projectId = Number(r.rows[0].project_id) || null;
    }

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
      ON CONFLICT (doc_no) DO NOTHING
      `,
      [
        docNo,
        docDate,
        docRef,
        projectId,
        cleanText(body.contract_no),
        cleanText(body.cust_code),
        cleanText(body.warehouse_code || body.wh_from),
        cleanText(body.location_code || body.location_from),
        cleanText(body.creator_code || body.requester),
        cleanText(body.requester_name || body.requester),
        cleanText(body.remark),
      ],
    );

    // Replace details (in case caller retried with same doc_no)
    await query(`DELETE FROM odg_requests_detail WHERE doc_no = $1`, [docNo]);
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
          docNo,
          i + 1,
          cleanText(it.item_code),
          cleanText(it.item_name),
          cleanText(it.unit_code),
          qty,
          cleanText(it.remark),
        ],
      );
    }

    return ok({ success: true, doc_no: docNo });
  } catch (error) {
    return serverError(error);
  }
}
