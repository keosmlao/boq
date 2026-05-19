export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { cleanText, fail, ok, serverError } from "@/_lib/http";
import { approveProjectRequest } from "@/_lib/projects";

export async function PUT(request, { params }) {
  try {
    const resolvedParams = await params;
    const payload = await request.json();
    const updated = await approveProjectRequest(cleanText(resolvedParams.id), {
      username: payload?.username,
      contractNo: payload?.contract_no,
    });

    if (!updated) {
      return fail("No pending contract found for this project", 404);
    }

    return ok({
      success: true,
      message: "Approved",
    });
  } catch (error) {
    return serverError(error);
  }
}
