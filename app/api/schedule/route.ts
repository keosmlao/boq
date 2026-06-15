import { getScheduleByProject } from "@/_actions/tasks-v2";
import { fail, ok, serverError } from "@/_lib/http";
import { requireSession } from "@/_lib/api_auth";

export async function GET() {
  try {
    const { response } = await requireSession();
    if (response) return response;

    const result = await getScheduleByProject();
    if (result.success === false) return fail(result.message, 500);
    return ok(result);
  } catch (error) {
    return serverError(error, "Failed to load schedule");
  }
}
