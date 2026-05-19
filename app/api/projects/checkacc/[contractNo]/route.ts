export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { cleanText, fail, ok, serverError } from "@/_lib/http";
import { approveAccounting } from "@/_lib/projects";

export async function PUT(request, { params }) {
  try {
    const resolvedParams = await params;
    const payload = await request.json();
    const updated = await approveAccounting(cleanText(resolvedParams.contractNo), {
      username: payload?.username,
      projectId: payload?.project_id,
    });

    if (!updated) {
      return fail("Contract not found", 404);
    }

    return ok({
      success: true,
      message: "Checked by accounting",
    });
  } catch (error) {
    return serverError(error);
  }
}
