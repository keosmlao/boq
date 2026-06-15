import { createRequest, getRequests } from "@/_actions/requests";
import { fail, ok, serverError } from "@/_lib/http";
import { requireSession } from "@/_lib/api_auth";

export async function GET(request: Request) {
  try {
    const { response } = await requireSession();
    if (response) return response;
    const { searchParams } = new URL(request.url);
    const data = await getRequests({
      status: searchParams.get("status") || undefined,
      projectId: searchParams.get("projectId") || undefined,
    });

    return ok(data);
  } catch (error) {
    return serverError(error, "Failed to load requests");
  }
}

export async function POST(request: Request) {
  try {
    const { response } = await requireSession();
    if (response) return response;
    const result = await createRequest(await request.json());

    if (result.success === false) {
      return fail(result.message, 400);
    }

    return ok(result);
  } catch (error) {
    return serverError(error, "Failed to create request");
  }
}
