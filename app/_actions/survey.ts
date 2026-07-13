"use server";

import { query } from "@/_lib/db";
import { requirePermission } from "@/_lib/server-auth";
import { logActivity } from "./chatter";
import { ensureSurveySchema } from "@/_lib/schemas/survey";
import { dateOrNull } from "@/_lib/schemas/quotations";
import { saveWebFile } from "@/_lib/uploads";

type Fail = { success: false; message: string };
function fail(message: string): Fail {
  return { success: false, message };
}

export async function getSurveys(projectId: string): Promise<{ success: true; data: unknown[] } | Fail> {
  try {
    await ensureSurveySchema();
    const result = await query(
      `SELECT * FROM odg_survey WHERE project_id = $1 ORDER BY created_at DESC`,
      [String(projectId)],
    );
    return { success: true, data: result.rows };
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function getSurvey(id: string): Promise<{ success: true; data: any } | Fail> {
  try {
    await ensureSurveySchema();
    const result = await query(`SELECT * FROM odg_survey WHERE id = $1 LIMIT 1`, [String(id)]);
    if (!result.rows.length) return fail("ບໍ່ພົບການສຳຫຼວດ");
    return { success: true, data: result.rows[0] };
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function deleteSurvey(id: string): Promise<{ success: true } | Fail> {
  try {
    await requirePermission("projects", "delete");
    await ensureSurveySchema();
    const r = await query(`DELETE FROM odg_survey WHERE id = $1 RETURNING id, project_id`, [id]);
    if (!r.rows.length) return fail("Survey not found");
    await logActivity("project", String(r.rows[0].project_id ?? ""), "ລຶບການສຳຫຼວດ");
    return { success: true };
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function createSurvey(formData: FormData): Promise<{ success: true; data: unknown } | Fail> {
  try {
    // No dedicated "survey" module in the matrix — a site survey is a project
    // document, so it follows `projects` (deleteSurvey already uses projects.delete).
    await requirePermission("projects", "create");
    await ensureSurveySchema();
    const projectId = String(formData.get("project_id") || "");
    if (!projectId) return fail("project_id is required");

    let data: any = {};
    try {
      data = JSON.parse(String(formData.get("data") || "{}")) || {};
    } catch {
      data = {};
    }

    // Save uploaded site photos locally and keep their URLs in data.photos.
    const files = formData
      .getAll("photoFiles")
      .filter((f: unknown) => typeof (f as File)?.arrayBuffer === "function") as File[];
    const photoUrls: string[] = [];
    for (const f of files) {
      const url = await saveWebFile(f, "static/uploads");
      if (url) photoUrls.push(url);
    }
    data.photos = [...(Array.isArray(data.photos) ? data.photos : []), ...photoUrls];

    const result = await query(
      `INSERT INTO odg_survey (project_id, survey_date, surveyor, status, findings, data)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        projectId,
        dateOrNull(formData.get("survey_date")),
        String(formData.get("surveyor") || "") || null,
        "done",
        String(formData.get("findings") || "") || null,
        JSON.stringify(data),
      ],
    );
    await logActivity("project", projectId, "ສ້າງການສຳຫຼວດ");
    return { success: true, data: result.rows[0] };
  } catch (e) {
    return fail((e as Error).message);
  }
}

/**
 * Fix an existing survey (a mistake must be correctable). Same permission family
 * as create/delete — a survey is a project document, so it follows `projects`
 * (create → projects.create, delete → projects.delete, edit → projects.edit).
 * Photos: `data.photos` carries the URLs the user KEPT; new files come in as
 * `photoFiles` and are appended.
 */
export async function updateSurvey(formData: FormData): Promise<{ success: true; data: unknown } | Fail> {
  try {
    await requirePermission("projects", "edit");
    await ensureSurveySchema();
    const id = String(formData.get("id") || "");
    if (!id) return fail("id is required");

    const existing = await query(`SELECT id, project_id FROM odg_survey WHERE id = $1 LIMIT 1`, [id]);
    if (!existing.rows.length) return fail("ບໍ່ພົບການສຳຫຼວດ");
    const projectId = String(existing.rows[0].project_id ?? "");

    let data: any = {};
    try {
      data = JSON.parse(String(formData.get("data") || "{}")) || {};
    } catch {
      data = {};
    }

    const files = formData
      .getAll("photoFiles")
      .filter((f: unknown) => typeof (f as File)?.arrayBuffer === "function") as File[];
    const photoUrls: string[] = [];
    for (const f of files) {
      const url = await saveWebFile(f, "static/uploads");
      if (url) photoUrls.push(url);
    }
    data.photos = [...(Array.isArray(data.photos) ? data.photos : []), ...photoUrls];

    const result = await query(
      `UPDATE odg_survey
          SET survey_date = $2, surveyor = $3, findings = $4, data = $5, updated_at = now()
        WHERE id = $1
        RETURNING *`,
      [
        id,
        dateOrNull(formData.get("survey_date")),
        String(formData.get("surveyor") || "") || null,
        String(formData.get("findings") || "") || null,
        JSON.stringify(data),
      ],
    );
    await logActivity("project", projectId, "ແກ້ໄຂການສຳຫຼວດ");
    return { success: true, data: result.rows[0] };
  } catch (e) {
    return fail((e as Error).message);
  }
}
