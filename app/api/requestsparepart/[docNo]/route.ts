import {
  getSparepartRequest,
  updateSparepartRequest,
} from "@/_actions/requests";
import { fail, ok, serverError } from "@/_lib/http";
import { requireSession } from "@/_lib/api_auth";

type RouteContext = {
  params: Promise<{
    docNo: string;
  }>;
};

function failureStatus(message: string) {
  if (message === "Request not found") return 404;
  if (message === "ALREADY_WITHDRAWN" || message === "NOT_EDITABLE") return 409;
  return 400;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { response } = await requireSession();
    if (response) return response;
    const { docNo } = await context.params;
    const data = await getSparepartRequest(docNo);

    if (data.success === false) {
      const msg = String(data.message || "Failed");
      return fail(msg, failureStatus(msg), { code: msg });
    }

    return ok(data);
  } catch (error) {
    return serverError(error, "Failed to load request");
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { response } = await requireSession();
    if (response) return response;
    const { docNo } = await context.params;
    const result = await updateSparepartRequest(docNo, await request.json());

    if (result.success === false) {
      const msg = String(result.message || "Failed");
      return fail(msg, failureStatus(msg), { code: msg });
    }

    return ok(result);
  } catch (error) {
    return serverError(error, "Failed to update request");
  }
}
