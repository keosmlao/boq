"use server";

/**
 * Drizzle / pm.surveys drop-in for app/_actions/survey.ts. Same API + return
 * shapes (legacy snake_case rows). NOT wired in — switch over after pm.surveys
 * is backfilled (drizzle/backfill/0003_surveys.sql). See quotations.pm.ts.
 */
import { desc, eq, or } from "drizzle-orm";
import { db } from "@/_db/client";
import { surveys, projects } from "@/_db/schema";
import { saveWebFile } from "@/_lib/uploads";

type Fail = { success: false; message: string };
const fail = (message: string): Fail => ({ success: false, message });
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : (v ?? null));
const dateOrNull = (v: unknown) => {
  const s = String(v ?? "").trim();
  return s ? s.slice(0, 10) : null;
};

async function resolvePmProjectId(projectId: unknown): Promise<number | null> {
  const raw = String(projectId ?? "").trim();
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  const rows = await db
    .select({ id: projects.id })
    .from(projects)
    .where(or(eq(projects.id, n), eq(projects.legacyId, n)))
    .limit(1);
  return rows[0]?.id ?? null;
}

function toLegacy(s: typeof surveys.$inferSelect) {
  return {
    id: s.id,
    project_id: s.projectId,
    survey_date: s.completedDate ?? s.scheduledDate,
    surveyor: s.surveyor,
    status: s.status,
    findings: s.findings,
    data: s.data ?? {},
    created_at: iso(s.createdAt),
    updated_at: iso(s.updatedAt),
  };
}

export async function getSurveys(projectId: string): Promise<{ success: true; data: unknown[] } | Fail> {
  try {
    const pid = await resolvePmProjectId(projectId);
    if (pid == null) return { success: true, data: [] };
    const rows = await db.select().from(surveys).where(eq(surveys.projectId, pid)).orderBy(desc(surveys.createdAt));
    return { success: true, data: rows.map(toLegacy) };
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function deleteSurvey(id: string): Promise<{ success: true } | Fail> {
  try {
    const r = await db.delete(surveys).where(eq(surveys.id, Number(id))).returning({ id: surveys.id });
    if (!r.length) return fail("Survey not found");
    return { success: true };
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function createSurvey(formData: FormData): Promise<{ success: true; data: unknown } | Fail> {
  try {
    const pid = await resolvePmProjectId(formData.get("project_id"));
    if (pid == null) return fail("project_id is required");

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

    const inserted = await db
      .insert(surveys)
      .values({
        projectId: pid,
        completedDate: dateOrNull(formData.get("survey_date")),
        surveyor: String(formData.get("surveyor") || "") || null,
        status: "done",
        findings: String(formData.get("findings") || "") || null,
        data,
      })
      .returning();
    return { success: true, data: inserted[0] };
  } catch (e) {
    return fail((e as Error).message);
  }
}
