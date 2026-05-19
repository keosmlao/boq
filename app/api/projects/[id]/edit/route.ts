export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { cleanText, fail, ok, serverError } from "@/_lib/http";
import { updateProjectEdit } from "@/_lib/projects";
import { saveWebFile } from "@/_lib/uploads";

function getFormValue(formData, key) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function PUT(request, { params }) {
  try {
    const resolvedParams = await params;
    const projectId = cleanText(resolvedParams.id);
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

    await updateProjectEdit(projectId, {
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
      username: getFormValue(formData, "username"),
      imageUrl,
    });

    return ok({
      success: true,
      message: "Updated",
    });
  } catch (error) {
    return serverError(error);
  }
}
