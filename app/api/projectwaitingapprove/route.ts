export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { ok, serverError } from "@/_lib/http";
import { listPendingProjectApprovals } from "@/_lib/projects";

export async function GET() {
  try {
    return ok({
      success: true,
      data: await listPendingProjectApprovals(),
    });
  } catch (error) {
    return serverError(error);
  }
}
