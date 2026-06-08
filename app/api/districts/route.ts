import { getDistricts } from "@/_actions/lookups";
import { fail, ok, serverError } from "@/_lib/http";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const result = await getDistricts(searchParams.get("province") || "");

    if (result.success === false) {
      return fail(result.message, 400);
    }

    return ok(result.data);
  } catch (error) {
    return serverError(error, "Failed to load districts");
  }
}
