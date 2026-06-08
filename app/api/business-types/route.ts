import { getBusinessTypes } from "@/_actions/lookups";
import { fail, ok, serverError } from "@/_lib/http";

export async function GET() {
  try {
    const result = await getBusinessTypes();

    if (result.success === false) {
      return fail(result.message, 400);
    }

    return ok(result.data);
  } catch (error) {
    return serverError(error, "Failed to load business types");
  }
}
