export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { ok, serverError } from "@/_lib/http";
import { getDashboardStats } from "@/_lib/projects";

export async function GET() {
  try {
    return ok(await getDashboardStats());
  } catch (error) {
    return serverError(error);
  }
}
