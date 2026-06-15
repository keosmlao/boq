import { getBoq } from "@/_actions/boq";
import { fail, ok, serverError } from "@/_lib/http";
import { requireSession } from "@/_lib/api_auth";

type RouteContext = {
  params: Promise<{
    docNo: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { response } = await requireSession();
    if (response) return response;
    const { docNo } = await context.params;
    const data = await getBoq(docNo);

    if (data?.success === false) {
      return fail(String(data.message || "BOQ not found"), 404);
    }

    return ok(data);
  } catch (error) {
    return serverError(error, "Failed to load BOQ");
  }
}
