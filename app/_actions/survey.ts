"use server";

import { query } from "@/_lib/db";
import { requirePermission } from "@/_lib/server-auth";
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

export async function deleteSurvey(id: string): Promise<{ success: true } | Fail> {
  try {
    await requirePermission("projects", "delete");
    await ensureSurveySchema();
    const r = await query(`DELETE FROM odg_survey WHERE id = $1 RETURNING id`, [id]);
    if (!r.rows.length) return fail("Survey not found");
    return { success: true };
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function createSurvey(formData: FormData): Promise<{ success: true; data: unknown } | Fail> {
  try {
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
    return { success: true, data: result.rows[0] };
  } catch (e) {
    return fail((e as Error).message);
  }
}
