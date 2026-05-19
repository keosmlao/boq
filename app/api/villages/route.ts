export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { cleanText, fail, ok, serverError } from "@/_lib/http";
import { listVillages } from "@/_lib/projects";

export async function GET(request) {
  try {
    const province = cleanText(request.nextUrl.searchParams.get("province"));
    const district = cleanText(request.nextUrl.searchParams.get("district"));

    if (!province || !district) {
      return fail("province and district are required", 400);
    }

    return ok({
      success: true,
      data: await listVillages({ province, district }),
    });
  } catch (error) {
    return serverError(error);
  }
}
