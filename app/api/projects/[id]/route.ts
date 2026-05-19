export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { cleanText, fail, isTruthyFlag, ok, serverError } from "@/_lib/http";
import {
  deleteProjectCascade,
  getProjectById,
  updateProjectStage,
} from "@/_lib/projects";

export async function GET(request, { params }) {
  try {
    const resolvedParams = await params;
    const includeContracts = isTruthyFlag(request.nextUrl.searchParams.get("include_contracts"));
    const project = await getProjectById(cleanText(resolvedParams.id), { includeContracts });

    if (!project) {
      return fail("Project not found", 404);
    }

    return ok({
      success: true,
      data: project,
    });
  } catch (error) {
    return serverError(error);
  }
}

export async function PUT(request, { params }) {
  try {
    const resolvedParams = await params;
    const payload = await request.json();
    const updated = await updateProjectStage(cleanText(resolvedParams.id), payload || {});

    if (!updated) {
      return fail("No valid fields to update", 400);
    }

    return ok({
      success: true,
      message: "Updated",
    });
  } catch (error) {
    return serverError(error);
  }
}

export async function DELETE(_request, { params }) {
  try {
    const resolvedParams = await params;
    await deleteProjectCascade(cleanText(resolvedParams.id));
    return ok({
      success: true,
      message: "Deleted",
    });
  } catch (error) {
    return serverError(error);
  }
}
