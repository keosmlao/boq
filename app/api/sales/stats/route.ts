export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { ok, serverError } from "@/_lib/http";
import { getSalesStats } from "@/_lib/projects";

export async function GET() {
  try {
    return ok(await getSalesStats());
  } catch (error) {
    return serverError(error);
  }
}
