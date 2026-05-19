export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { cleanText, ok, serverError } from "@/_lib/http";
import { listProjectTypes } from "@/_lib/projects";

export async function GET(request) {
  try {
    const businessType = cleanText(request.nextUrl.searchParams.get("businessType"));
    const businessModel = cleanText(request.nextUrl.searchParams.get("businessModel"));

    return ok({
      success: true,
      data: await listProjectTypes({ businessType, businessModel }),
    });
  } catch (error) {
    return serverError(error);
  }
}
