import { getBusinessModels } from "@/_actions/lookups";
import { fail, ok, serverError } from "@/_lib/http";
import { requireSession } from "@/_lib/api_auth";

export async function GET(request: Request) {
  try {
    const { response } = await requireSession();
    if (response) return response;
    const { searchParams } = new URL(request.url);
    const result = await getBusinessModels(searchParams.get("businessType") || undefined);

    if (result.success === false) {
      return fail(result.message, 400);
    }

    return ok(result.data);
  } catch (error) {
    return serverError(error, "Failed to load business models");
  }
}
