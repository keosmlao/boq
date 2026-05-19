export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { ok, serverError } from "@/_lib/http";
import {
  ensureRequestsSchema,
  generateRequestDocNo,
} from "../../requests/_schema";

/**
 * GET /api/rwpj/nextno
 *
 * Returns the next material-request document number (REQ-YYMMDD-NNNN).
 * Used by BoqRequestModal to pre-fill the doc_no field before the user saves.
 */
export async function GET() {
  try {
    await ensureRequestsSchema();
    const docNo = await generateRequestDocNo();
    return ok({ success: true, doc_no: docNo });
  } catch (error) {
    return serverError(error);
  }
}
