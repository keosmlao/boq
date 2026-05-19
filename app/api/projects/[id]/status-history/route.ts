export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { cleanText, ok, serverError } from "@/_lib/http";
import { listProjectStatusHistory } from "@/_lib/projects";

export async function GET(_request, { params }) {
  try {
    const resolvedParams = await params;
    const history = await listProjectStatusHistory(cleanText(resolvedParams.id));
    return ok({
      success: true,
      data: history,
    });
  } catch (error) {
    return serverError(error);
  }
}
