import {
  getSparepartRequest,
  updateSparepartRequest,
} from "@/_actions/requests";
import { fail, ok, serverError } from "@/_lib/http";

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
    const { docNo } = await context.params;
    const data = await getSparepartRequest(docNo);

    if (data.success === false) {
      return fail(data.message, failureStatus(data.message), { code: data.message });
    }

    return ok(data);
  } catch (error) {
    return serverError(error, "Failed to load request");
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { docNo } = await context.params;
    const result = await updateSparepartRequest(docNo, await request.json());

    if (result.success === false) {
      return fail(result.message, failureStatus(result.message), { code: result.message });
    }

    return ok(result);
  } catch (error) {
    return serverError(error, "Failed to update request");
  }
}
