export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { fail, ok, serverError } from "@/_lib/http";
import { createProjectRequest } from "@/_lib/projects";

export async function POST(request) {
  try {
    const payload = await request.json();

    if (!payload?.existing_project_id && !payload?.project_id) {
      return fail("project_id is required", 400);
    }

    if (!payload?.contract_no || !payload?.contract_name) {
      return fail("contract_no and contract_name are required", 400);
    }

    const result = await createProjectRequest(payload);

    return ok({
      success: true,
      message: "Request submitted",
      data: result,
    });
  } catch (error) {
    return serverError(error);
  }
}
