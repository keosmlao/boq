export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { query } from "@/_lib/db";
import { fail, ok, serverError } from "@/_lib/http";
import { ensureRequestsSchema } from "../_schema";

/**
 * DELETE /api/requests/{docNo}
 *
 * Removes a material request (cascade-deletes its line items).
 * Refuses if the request has already been withdrawn (doc_success = 1) — the
 * frontend surfaces this as "ALREADY_WITHDRAWN".
 */
export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ docNo: string }> },
) {
  try {
    await ensureRequestsSchema();
    const { docNo } = await ctx.params;
    const decoded = decodeURIComponent(docNo);

    const existing = await query(
      `SELECT doc_success FROM odg_requests WHERE doc_no = $1 LIMIT 1`,
      [decoded],
    );
    if (!existing.rows.length) {
      return fail("Request not found", 404);
    }
    if (Number(existing.rows[0].doc_success) === 1) {
      return fail("ALREADY_WITHDRAWN", 409);
    }

    await query(`DELETE FROM odg_requests WHERE doc_no = $1`, [decoded]);
    return ok({ success: true, message: "Deleted" });
  } catch (error) {
    return serverError(error);
  }
}
