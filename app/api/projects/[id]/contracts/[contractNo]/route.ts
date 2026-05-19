export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { cleanText, fail, ok, serverError } from "@/_lib/http";
import { deleteProjectContractCascade } from "@/_lib/projects";

type Ctx = { params: Promise<{ id: string; contractNo: string }> };

export async function DELETE(_request: Request, { params }: Ctx) {
  try {
    const resolvedParams = await params;
    const result = await deleteProjectContractCascade(
      cleanText(resolvedParams.id),
      cleanText(decodeURIComponent(resolvedParams.contractNo)),
    );

    if (!result) {
      return fail("Contract not found", 404);
    }

    return ok({
      success: true,
      message: "Contract deleted",
      data: result,
    });
  } catch (error) {
    return serverError(error);
  }
}
