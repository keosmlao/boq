export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { fail, isTruthyFlag, ok, serverError } from "@/_lib/http";
import { createProject, listProjects } from "@/_lib/projects";
import { saveWebFile } from "@/_lib/uploads";

function getFormValue(formData, key) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function GET(request) {
  try {
    const summary = isTruthyFlag(request.nextUrl.searchParams.get("summary"));
    return ok({
      success: true,
      data: await listProjects({ summary }),
    });
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const projectName = getFormValue(formData, "projectName");
    const province = getFormValue(formData, "province");
    const district = getFormValue(formData, "district");
    const village = getFormValue(formData, "village");
    const registrationDate = getFormValue(formData, "registrationDate");

    if (!projectName || !province || !district || !village || !registrationDate) {
      return fail("Missing required project fields", 400);
    }

    const files = formData.getAll("imageFiles");
    const firstFile = files.find((file) => typeof file?.arrayBuffer === "function");
    const imageUrl = firstFile ? await saveWebFile(firstFile, "static/uploads") : null;

    const projectId = await createProject({
      projectName,
      projectDescription: getFormValue(formData, "projectDescription"),
      province,
      district,
      village,
      coordinator: getFormValue(formData, "coordinator"),
      coordinatorPhone: getFormValue(formData, "coordinatorPhone"),
      registrationDate,
      saleStaffId: getFormValue(formData, "saleStaffId"),
      smlCode: getFormValue(formData, "smlCode"),
      officeCoord: getFormValue(formData, "officeCoord"),
      projectCoord: getFormValue(formData, "projectCoord"),
      projectType: getFormValue(formData, "projectType"),
      businessType: getFormValue(formData, "businessType"),
      businessModel: getFormValue(formData, "businessModel"),
      projectStatus: getFormValue(formData, "status"),
      imageUrl,
    });

    return ok({
      success: true,
      message: "Created",
      id: projectId,
    });
  } catch (error) {
    return serverError(error);
  }
}
