export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { cleanText, fail, ok, serverError } from "@/_lib/http";
import { listDistricts } from "@/_lib/projects";

export async function GET(request) {
  try {
    const province = cleanText(request.nextUrl.searchParams.get("province"));
    if (!province) {
      return fail("province is required", 400);
    }
    return ok({ success: true, data: await listDistricts(province) });
  } catch (error) {
    return serverError(error);
  }
}
