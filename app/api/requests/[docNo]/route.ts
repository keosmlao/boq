import { deleteRequest } from "@/_actions/requests";
import { fail, ok, serverError } from "@/_lib/http";
import { requireSession } from "@/_lib/api_auth";

type RouteContext = {
  params: Promise<{
    docNo: string;
  }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { response } = await requireSession();
    if (response) return response;
    const { docNo } = await context.params;
    const result = await deleteRequest(docNo);

    if (result.success === false) {
      const message = result.message || "Request not found";
      const status = message === "Request not found" ? 404 : 400;
      return fail(message, status, { code: message });
    }

    return ok(result);
  } catch (error) {
    return serverError(error, "Failed to delete request");
  }
}
