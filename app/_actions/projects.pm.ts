"use server";

/**
 * Drizzle / pm.projects drop-in for the v2-facing project reads (subset of
 * app/_actions/projects.ts). NOT wired in — switch over after pm.projects is
 * backfilled (0000). See quotations.pm.ts.
 *
 * Covered: getProjects (list, with ERP province/district/village names + status
 * enum→Lao), advanceProjectStage, deleteProjectAction.
 * NOT covered (heavy ERP contract/BOQ aggregation or FormData parsing — port at
 * cut-over): getProjectsBoq, getProject (detail + contractlist), createProject,
 * getProjectsBoqClose, getProjectsWaitingApprove.
 */
import { and, desc, eq, or } from "drizzle-orm";
import { db } from "@/_db/client";
import { projects } from "@/_db/schema";
import { erpProvince, erpAmper, erpTambon } from "@/_db/erp";

type Ok = { success: true; message?: string; id?: unknown };
type Fail = { success: false; message: string };
const fail = (message: string): Fail => ({ success: false, message });
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : (v ?? null));

/** pm enum -> the Lao project_status labels the UI shows. */
const STATUS_TO_LAO: Record<string, string> = {
  pending: "ລໍຖ້າດຳເນີນ",
  in_progress: "ຂັ້ນຕອນດຳເນີນໂຄງການ",
  ready_to_withdraw: "ສາມາດເບີກຂອງໃດ້",
  installing: "ດຳເນີນການຕິດຕັ້ງ",
  pending_close: "ລໍຖ້າອະນຸມັດປິດໂຄງການ",
  closed: "ປິດໂຄງການ",
  cancelled: "ຍົກເລີກ",
};
/** Lao lifecycle OR v2 pipeline-stage label -> pm enum (best-effort). */
type PmStatus = typeof projects.$inferInsert.status;
const STAGE_TO_ENUM: Record<string, PmStatus> = {
  ລົງທະບຽນ: "pending",
  ລໍຖ້າດຳເນີນ: "pending",
  ສຳຫຼວດ: "in_progress",
  ສະເໜີລາຄາ: "in_progress",
  ສັນຍາ: "in_progress",
  ຂັ້ນຕອນດຳເນີນໂຄງການ: "in_progress",
  BOQ: "ready_to_withdraw",
  ສາມາດເບີກຂອງໃດ້: "ready_to_withdraw",
  ກຳນົດໜ້າວຽກ: "installing",
  ໃບງານ: "installing",
  ດຳເນີນການຕິດຕັ້ງ: "installing",
  ລໍຖ້າອະນຸມັດປິດໂຄງການ: "pending_close",
  ປິດໂຄງການ: "closed",
  ຍົກເລີກ: "cancelled",
};

async function resolvePmProjectId(projectId: unknown): Promise<number | null> {
  const raw = String(projectId ?? "").trim();
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  const rows = await db.select({ id: projects.id }).from(projects).where(or(eq(projects.id, n), eq(projects.legacyId, n))).limit(1);
  return rows[0]?.id ?? null;
}

export async function getProjects(_opts: { summary?: boolean; boq?: boolean } = {}): Promise<{ success: true; data: any[] } | Fail> {
  try {
    const rows = await db
      .select({
        p: projects,
        provinceName: erpProvince.name1,
        districtName: erpAmper.name1,
        villageName: erpTambon.name1,
      })
      .from(projects)
      .leftJoin(erpProvince, eq(erpProvince.code, projects.provinceCode))
      .leftJoin(erpAmper, and(eq(erpAmper.code, projects.districtCode), eq(erpAmper.province, projects.provinceCode)))
      .leftJoin(
        erpTambon,
        and(eq(erpTambon.code, projects.villageCode), eq(erpTambon.amper, projects.districtCode), eq(erpTambon.province, projects.provinceCode)),
      )
      .orderBy(desc(projects.id))
      .limit(500);

    const data = rows.map((r) => ({
      id: r.p.id,
      project_name: r.p.name,
      project_description: r.p.description,
      sml_code: r.p.smlCode,
      province: r.p.provinceCode,
      district: r.p.districtCode,
      village: r.p.villageCode,
      province_name: r.provinceName,
      district_name: r.districtName,
      village_name: r.villageName,
      coordinator: r.p.coordinator,
      phone: r.p.phone,
      image_url: r.p.imageUrl,
      sale_code: r.p.saleCode,
      project_type: r.p.projectTypeCode,
      business_type_id: r.p.businessTypeCode,
      business_model_id: r.p.businessModelCode,
      project_status: STATUS_TO_LAO[r.p.status] ?? r.p.status,
      date_register: r.p.registeredOn,
      created_at: iso(r.p.createdAt),
    }));
    return { success: true, data };
  } catch (e) {
    return fail((e as Error).message);
  }
}

/** Bump the project lifecycle. Maps the v2 pipeline-stage label to the pm enum. */
export async function advanceProjectStage(projectId: string, target: string): Promise<Ok | Fail> {
  try {
    const pid = await resolvePmProjectId(projectId);
    if (pid == null) return fail("Project not found");
    const next = STAGE_TO_ENUM[String(target)] ?? "in_progress";
    await db.update(projects).set({ status: next, updatedAt: new Date() }).where(eq(projects.id, pid));
    return { success: true };
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function deleteProjectAction(projectId: string): Promise<Ok | Fail> {
  try {
    const pid = await resolvePmProjectId(projectId);
    if (pid == null) return fail("Project not found");
    // FK cascades remove quotations/contracts/boq/surveys/tasks/etc.
    await db.delete(projects).where(eq(projects.id, pid));
    return { success: true, message: "Deleted" };
  } catch (e) {
    return fail((e as Error).message);
  }
}
