export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { ok, serverError } from "@/_lib/http";
import { listBusinessTypes } from "@/_lib/projects";

export async function GET() {
  try {
    return ok({
      success: true,
      data: await listBusinessTypes(),
    });
  } catch (error) {
    return serverError(error);
  }
}
