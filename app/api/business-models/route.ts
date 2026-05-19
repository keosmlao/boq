export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { cleanText, ok, serverError } from "@/_lib/http";
import { listBusinessModels } from "@/_lib/projects";

export async function GET(request) {
  try {
    const businessType = cleanText(request.nextUrl.searchParams.get("businessType"));
    return ok({
      success: true,
      data: await listBusinessModels(businessType),
    });
  } catch (error) {
    return serverError(error);
  }
}
