export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { ok, serverError } from "@/_lib/http";
import { listSaleStaffs } from "@/_lib/projects";

export async function GET() {
  try {
    return ok({
      success: true,
      data: await listSaleStaffs(),
    });
  } catch (error) {
    return serverError(error);
  }
}
