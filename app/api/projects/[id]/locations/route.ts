export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { cleanText, ok, serverError } from "@/_lib/http";
import { updateProjectLocations } from "@/_lib/projects";

export async function PUT(request, { params }) {
  try {
    const resolvedParams = await params;
    const payload = await request.json();
    await updateProjectLocations(cleanText(resolvedParams.id), payload || {});
    return ok({
      success: true,
      message: "Locations updated",
    });
  } catch (error) {
    return serverError(error);
  }
}
